-- =====================================================================
-- MercaFree · Fase 2P · Calificaciones con estrellas y opiniones de comercios (estilo Google)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo. Requiere haber ejecutado 01 a 11.
--
-- Qué hace:
--  1) `calificaciones_comercio`: 1 opinión por persona y comercio (1 a 5 estrellas + comentario
--     opcional de hasta 500 caracteres). La persona la puede editar o borrar cuando quiera.
--  2) TODOS pueden leer las opiniones (sin iniciar sesión). Para escribir hace falta cuenta.
--  3) El dueño NO puede calificar su propio negocio. Sí puede RESPONDER públicamente cada opinión
--     (función `responder_calificacion`).
--  4) `comercios.calif_promedio` y `comercios.calif_total` se recalculan solos (no se pueden editar
--     a mano: el dueño solo cambia sus columnas permitidas, ver 07_vitrina.sql).
--  5) `reportes_calificacion`: cualquiera con cuenta puede reportar una opinión ofensiva, falsa o con
--     datos personales. Solo un moderador puede ocultarla; las opiniones negativas NO se borran por serlo.
--  Límite contra abuso: máximo 20 opiniones nuevas por persona al día.
-- =====================================================================

-- ---------- 1. Promedio y total en cada comercio ----------
alter table public.comercios
  add column if not exists calif_promedio numeric(3,2) not null default 0,
  add column if not exists calif_total    integer      not null default 0;

-- ---------- 2. Opiniones ----------
create table if not exists public.calificaciones_comercio (
  id             bigint generated always as identity primary key,
  comercio_id    bigint not null references public.comercios(id) on delete cascade,
  usuario_id     uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  autor_nombre   text not null default 'Usuario' check (char_length(autor_nombre) between 1 and 40),
  estrellas      smallint not null check (estrellas between 1 and 5),
  comentario     text check (comentario is null or char_length(comentario) <= 500),
  respuesta      text check (respuesta is null or char_length(respuesta) <= 500),
  respuesta_en   timestamptz,
  oculto         boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (comercio_id, usuario_id)
);

create index if not exists calificaciones_comercio_idx on public.calificaciones_comercio (comercio_id, creado_en desc);
create index if not exists calificaciones_usuario_idx  on public.calificaciones_comercio (usuario_id, creado_en desc);

-- ---------- 3. Guardia: quién puede cambiar qué ----------
-- security definer: necesita leer perfiles (nombre) y comercios (dueño) sin quedar atrapada por sus reglas.
create or replace function public.calificaciones_guardia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dueno uuid;
  v_activo boolean;
begin
  if tg_op = 'INSERT' then
    new.usuario_id := coalesce(auth.uid(), new.usuario_id);
    select owner_id, activo into v_dueno, v_activo from public.comercios where id = new.comercio_id;
    if not found or not v_activo then
      raise exception 'Este comercio no está disponible para calificar';
    end if;
    if v_dueno is not null and v_dueno = new.usuario_id then
      raise exception 'No puedes calificar tu propio negocio';
    end if;
    if (select count(*) from public.calificaciones_comercio
        where usuario_id = new.usuario_id and creado_en > now() - interval '1 day') >= 20 then
      raise exception 'Llegaste al máximo de opiniones por hoy. Gracias por ayudar a tu comunidad';
    end if;
    new.respuesta := null; new.respuesta_en := null; new.oculto := false;
    new.creado_en := now(); new.actualizado_en := now();
  else
    -- Nunca cambian: el comercio, el autor y la fecha de creación
    new.comercio_id := old.comercio_id; new.usuario_id := old.usuario_id; new.creado_en := old.creado_en;

    if coalesce(current_setting('mercafree.respondiendo', true), '') = 'on' then
      -- Respuesta del dueño (viene de responder_calificacion): solo cambia la respuesta
      new.estrellas := old.estrellas; new.comentario := old.comentario;
      new.autor_nombre := old.autor_nombre; new.oculto := old.oculto;
      new.actualizado_en := old.actualizado_en;
      return new;
    end if;

    if not public.es_moderador() then
      -- El autor solo cambia sus estrellas y su comentario
      new.respuesta := old.respuesta; new.respuesta_en := old.respuesta_en; new.oculto := old.oculto;
    end if;
    if new.estrellas is distinct from old.estrellas or new.comentario is distinct from old.comentario then
      new.actualizado_en := now();
    end if;
  end if;

  -- El nombre visible sale del perfil (no se puede inventar uno ajeno)
  if tg_op = 'INSERT' or (auth.uid() is not null and auth.uid() = new.usuario_id) then
    new.autor_nombre := coalesce((select left(nombre, 40) from public.perfiles where id = new.usuario_id), 'Usuario');
  end if;
  new.comentario := nullif(btrim(new.comentario), '');
  return new;
end $$;
revoke execute on function public.calificaciones_guardia() from public, anon, authenticated;

drop trigger if exists calificaciones_antes on public.calificaciones_comercio;
create trigger calificaciones_antes before insert or update on public.calificaciones_comercio
  for each row execute function public.calificaciones_guardia();

-- ---------- 4. Recalcular promedio y total del comercio ----------
create or replace function public.calificaciones_recalcular()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint := coalesce(new.comercio_id, old.comercio_id);
begin
  update public.comercios c set
    calif_promedio = coalesce(r.prom, 0),
    calif_total    = coalesce(r.n, 0)
  from (select round(avg(estrellas)::numeric, 2) as prom, count(*)::int as n
          from public.calificaciones_comercio where comercio_id = v and not oculto) r
  where c.id = v
    and (c.calif_promedio is distinct from coalesce(r.prom, 0) or c.calif_total is distinct from coalesce(r.n, 0));
  return null;
end $$;
revoke execute on function public.calificaciones_recalcular() from public, anon, authenticated;

drop trigger if exists calificaciones_despues on public.calificaciones_comercio;
create trigger calificaciones_despues after insert or update or delete on public.calificaciones_comercio
  for each row execute function public.calificaciones_recalcular();

-- ---------- 5. Seguridad (RLS) ----------
alter table public.calificaciones_comercio enable row level security;
grant select on public.calificaciones_comercio to anon, authenticated;
grant insert, update, delete on public.calificaciones_comercio to authenticated;

-- Todos (con o sin cuenta) leen las opiniones visibles
drop policy if exists calificaciones_leer on public.calificaciones_comercio;
create policy calificaciones_leer on public.calificaciones_comercio for select to anon, authenticated
  using (not oculto);

-- El autor ve la suya aunque esté oculta, y los moderadores ven todas
drop policy if exists calificaciones_leer_propias on public.calificaciones_comercio;
create policy calificaciones_leer_propias on public.calificaciones_comercio for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_moderador());

drop policy if exists calificaciones_crear on public.calificaciones_comercio;
create policy calificaciones_crear on public.calificaciones_comercio for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists calificaciones_editar on public.calificaciones_comercio;
create policy calificaciones_editar on public.calificaciones_comercio for update to authenticated
  using (usuario_id = (select auth.uid()) or public.es_moderador())
  with check (usuario_id = (select auth.uid()) or public.es_moderador());

drop policy if exists calificaciones_borrar on public.calificaciones_comercio;
create policy calificaciones_borrar on public.calificaciones_comercio for delete to authenticated
  using (usuario_id = (select auth.uid()) or public.es_moderador());

-- ---------- 6. Respuesta pública del dueño ----------
-- Solo el dueño del comercio (o un moderador). Texto vacío = borrar la respuesta.
create or replace function public.responder_calificacion(p_id bigint, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if auth.uid() is null then raise exception 'Inicia sesión para responder'; end if;
  if v_texto is not null and char_length(v_texto) > 500 then raise exception 'La respuesta puede tener máximo 500 caracteres'; end if;
  if not exists (
    select 1 from public.calificaciones_comercio q join public.comercios c on c.id = q.comercio_id
    where q.id = p_id and (c.owner_id = auth.uid() or public.es_moderador())
  ) then
    raise exception 'Solo el dueño del negocio puede responder esta opinión';
  end if;
  perform set_config('mercafree.respondiendo', 'on', true);
  update public.calificaciones_comercio
     set respuesta = v_texto, respuesta_en = case when v_texto is null then null else now() end
   where id = p_id;
  perform set_config('mercafree.respondiendo', '', true);
end $$;
revoke execute on function public.responder_calificacion(bigint, text) from public, anon;
grant execute on function public.responder_calificacion(bigint, text) to authenticated;

-- ---------- 7. Reportar una opinión ----------
create table if not exists public.reportes_calificacion (
  id               bigint generated always as identity primary key,
  calificacion_id  bigint not null references public.calificaciones_comercio(id) on delete cascade,
  reportante_id    uuid default auth.uid() references public.perfiles(id) on delete set null,
  motivo           text not null check (motivo in ('ofensivo','falso','datos','spam','otro')),
  detalle          text check (detalle is null or char_length(detalle) <= 300),
  estado           text not null default 'pendiente' check (estado in ('pendiente','revisado','descartado')),
  creado_en        timestamptz not null default now()
);
create index if not exists reportes_calificacion_estado_idx on public.reportes_calificacion (estado, creado_en desc);
create unique index if not exists reportes_calificacion_unico_pendiente
  on public.reportes_calificacion (calificacion_id, reportante_id) where estado = 'pendiente';

create or replace function public.reportes_calificacion_limite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.reportante_id := coalesce(auth.uid(), new.reportante_id);
  new.estado := 'pendiente';
  if (select count(*) from public.reportes_calificacion where reportante_id = new.reportante_id and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al máximo de reportes por hoy. Gracias por ayudarnos';
  end if;
  return new;
end $$;
revoke execute on function public.reportes_calificacion_limite() from public, anon, authenticated;

drop trigger if exists reportes_calificacion_antes_insert on public.reportes_calificacion;
create trigger reportes_calificacion_antes_insert before insert on public.reportes_calificacion
  for each row execute function public.reportes_calificacion_limite();

alter table public.reportes_calificacion enable row level security;
grant select, insert, update on public.reportes_calificacion to authenticated;

drop policy if exists reportes_calificacion_crear on public.reportes_calificacion;
create policy reportes_calificacion_crear on public.reportes_calificacion for insert to authenticated
  with check (reportante_id = (select auth.uid()));

drop policy if exists reportes_calificacion_leer on public.reportes_calificacion;
create policy reportes_calificacion_leer on public.reportes_calificacion for select to authenticated
  using (public.es_moderador());

drop policy if exists reportes_calificacion_resolver on public.reportes_calificacion;
create policy reportes_calificacion_resolver on public.reportes_calificacion for update to authenticated
  using (public.es_moderador()) with check (public.es_moderador());

-- ---------- 8. Comprobación ----------
-- Debe devolver 2 filas: calificaciones_comercio y reportes_calificacion.
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('calificaciones_comercio', 'reportes_calificacion');
