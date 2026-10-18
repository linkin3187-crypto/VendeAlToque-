-- =====================================================================
-- MercaFree · Fase 2Z.10 · La comunidad confirma comercios + «Acelerar mi verificación»
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto la página funciona como hoy,
-- solo que sin los botones nuevos). Es seguro repetirlo. Requiere 01, 02, 06 (sello) y 07.
--
-- Qué hace:
--  1) confirmaciones_comercio: cada persona (con cuenta) dice si un comercio «existe y atiende aquí» o
--     «no está / cerró». Un voto por persona y comercio; se puede cambiar después de 30 días.
--     El dueño no puede votar por su propio negocio. Máx. 40 votos al día por persona.
--     en_lugar = el celular estaba a menos de 150 m (lo calcula el navegador; es solo una señal).
--  2) comercios.confirma_si / confirma_no / confirma_lugar: totales públicos (se recalculan solos).
--     IMPORTANTE: los votos NUNCA dan el sello «Verificado»: eso lo hace solo un moderador.
--     La página muestra «👥 Confirmado por N vecinos» con 3+ «sí» (al menos 1 en el lugar) y avisa
--     «algunos dicen que ya no está» con 2+ «no». Nada se oculta solo.
--  3) solicitudes_verificacion: el dueño de un comercio «Ubicado» pide «Que me llamen» (mañana, tarde
--     o noche). Una solicitud cada 24 h por comercio. Los moderadores la ven primero en su cola.
--  Lectura: cada persona ve sus propios votos y solicitudes; los moderadores ven todo.
-- =====================================================================

-- 1) Votos
create table if not exists public.confirmaciones_comercio (
  id           bigint generated always as identity primary key,
  comercio_id  bigint not null references public.comercios(id) on delete cascade,
  usuario_id   uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  voto         text not null check (voto in ('existe', 'no_existe')),
  en_lugar     boolean not null default false,
  creado_en    timestamptz not null default now(),
  unique (comercio_id, usuario_id)
);
create index if not exists confirmaciones_usuario_idx on public.confirmaciones_comercio (usuario_id, creado_en desc);

alter table public.comercios add column if not exists confirma_si     integer not null default 0;
alter table public.comercios add column if not exists confirma_no     integer not null default 0;
alter table public.comercios add column if not exists confirma_lugar  integer not null default 0;

-- Reglas al votar (el servidor decide quién vota y cuándo)
create or replace function public.confirmaciones_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dueno uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para confirmar comercios'; end if;
  new.usuario_id := auth.uid();
  select owner_id into v_dueno from public.comercios where id = new.comercio_id;
  if v_dueno is not null and v_dueno = auth.uid() then
    raise exception 'No puedes confirmar tu propio negocio: pídele a tus clientes que lo hagan';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.confirmaciones_comercio
         where usuario_id = auth.uid() and creado_en > now() - interval '1 day') >= 40 then
      raise exception 'Ya confirmaste muchos comercios hoy. ¡Gracias! Vuelve mañana';
    end if;
  else
    if new.comercio_id is distinct from old.comercio_id then raise exception 'No se puede cambiar el comercio'; end if;
    if old.creado_en > now() - interval '30 days' then
      raise exception 'Ya diste tu opinión sobre este comercio. Podrás cambiarla 30 días después';
    end if;
  end if;
  new.creado_en := now();
  return new;
end $$;
revoke execute on function public.confirmaciones_antes() from public, anon, authenticated;
drop trigger if exists confirmaciones_antes on public.confirmaciones_comercio;
create trigger confirmaciones_antes before insert or update on public.confirmaciones_comercio
  for each row execute function public.confirmaciones_antes();

-- Totales en el comercio (los cambia este trigger, no el dueño)
create or replace function public.confirmaciones_recontar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint := coalesce(new.comercio_id, old.comercio_id);
begin
  update public.comercios c set
    confirma_si    = (select count(*) from public.confirmaciones_comercio x where x.comercio_id = v_id and x.voto = 'existe'),
    confirma_no    = (select count(*) from public.confirmaciones_comercio x where x.comercio_id = v_id and x.voto = 'no_existe'),
    confirma_lugar = (select count(*) from public.confirmaciones_comercio x where x.comercio_id = v_id and x.voto = 'existe' and x.en_lugar)
  where c.id = v_id;
  return null;
end $$;
revoke execute on function public.confirmaciones_recontar() from public, anon, authenticated;
drop trigger if exists confirmaciones_recontar on public.confirmaciones_comercio;
create trigger confirmaciones_recontar after insert or update or delete on public.confirmaciones_comercio
  for each row execute function public.confirmaciones_recontar();

alter table public.confirmaciones_comercio enable row level security;
revoke all on public.confirmaciones_comercio from anon, authenticated;
grant select, insert, update on public.confirmaciones_comercio to authenticated;
grant delete on public.confirmaciones_comercio to authenticated;

drop policy if exists confirmaciones_leer on public.confirmaciones_comercio;
create policy confirmaciones_leer on public.confirmaciones_comercio for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_moderador()));
drop policy if exists confirmaciones_crear on public.confirmaciones_comercio;
create policy confirmaciones_crear on public.confirmaciones_comercio for insert to authenticated
  with check (usuario_id = (select auth.uid()));
drop policy if exists confirmaciones_cambiar on public.confirmaciones_comercio;
create policy confirmaciones_cambiar on public.confirmaciones_comercio for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
drop policy if exists confirmaciones_borrar on public.confirmaciones_comercio;
create policy confirmaciones_borrar on public.confirmaciones_comercio for delete to authenticated
  using ((select public.es_moderador()));

-- 2) «Acelerar mi verificación» → que me llamen
create table if not exists public.solicitudes_verificacion (
  id            bigint generated always as identity primary key,
  comercio_id   bigint not null references public.comercios(id) on delete cascade,
  solicitante_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  franja        text not null check (franja in ('manana', 'tarde', 'noche')),
  telefono      text not null check (telefono ~ '^[0-9+ ]{7,20}$'),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'atendida')),
  creado_en     timestamptz not null default now(),
  atendida_por  uuid references auth.users(id),
  atendida_en   timestamptz
);
create index if not exists solicitudes_verif_estado_idx on public.solicitudes_verificacion (estado, creado_en);
create index if not exists solicitudes_verif_comercio_idx on public.solicitudes_verificacion (comercio_id, creado_en desc);

create or replace function public.solicitudes_verif_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.solicitante_id := auth.uid();
    new.estado := 'pendiente'; new.atendida_por := null; new.atendida_en := null; new.creado_en := now();
    if not exists (select 1 from public.comercios c where c.id = new.comercio_id and c.owner_id = auth.uid()) then
      raise exception 'Solo el dueño del negocio puede pedir que lo verifiquen';
    end if;
    if exists (select 1 from public.solicitudes_verificacion s
                where s.comercio_id = new.comercio_id and s.creado_en > now() - interval '1 day') then
      raise exception 'Ya pediste que te llamen hoy. Te contactaremos pronto';
    end if;
  else
    if not public.es_moderador() then raise exception 'Solo moderadores'; end if;
    if new.estado = 'atendida' and old.estado <> 'atendida' then
      new.atendida_por := auth.uid(); new.atendida_en := now();
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.solicitudes_verif_antes() from public, anon, authenticated;
drop trigger if exists solicitudes_verif_antes on public.solicitudes_verificacion;
create trigger solicitudes_verif_antes before insert or update on public.solicitudes_verificacion
  for each row execute function public.solicitudes_verif_antes();

alter table public.solicitudes_verificacion enable row level security;
revoke all on public.solicitudes_verificacion from anon, authenticated;
grant select, insert, update on public.solicitudes_verificacion to authenticated;

drop policy if exists solicitudes_verif_leer on public.solicitudes_verificacion;
create policy solicitudes_verif_leer on public.solicitudes_verificacion for select to authenticated
  using (solicitante_id = (select auth.uid()) or (select public.es_moderador()));
drop policy if exists solicitudes_verif_crear on public.solicitudes_verificacion;
create policy solicitudes_verif_crear on public.solicitudes_verificacion for insert to authenticated
  with check (solicitante_id = (select auth.uid()));
drop policy if exists solicitudes_verif_moderar on public.solicitudes_verificacion;
create policy solicitudes_verif_moderar on public.solicitudes_verificacion for update to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

-- Comprobación: debe mostrar 1 fila con tabla_votos = true, totales = true y tabla_llamadas = true.
select to_regclass('public.confirmaciones_comercio') is not null as tabla_votos,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comercios' and column_name = 'confirma_si') as totales,
       to_regclass('public.solicitudes_verificacion') is not null as tabla_llamadas;
