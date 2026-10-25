-- =====================================================================
-- Merkap · Fase DR-1a · «🛍️ Mi vitrina»: secciones, publicar/apagar, cantidades
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo.
-- Requiere 07, 29, 32, 36, 38 y 42 (ya ejecutados).
--
-- Qué hace:
--  1) secciones_vitrina: cada tienda ordena su vitrina en secciones propias («Bebidas», «Aseo»…).
--     Máximo comercios.limite_secciones (3 gratis); solo el administrador lo cambia.
--  2) productos_comercio gana: seccion_id, publicado (apagar sin borrar), orden, cantidad (opcional),
--     avisar_pocos («¡Quedan pocos!» con 1–3), agotar_en_cero y en_revision.
--  3) El cupo (10 gratis) cuenta SOLO los productos publicados, como dicen los Términos 4C.
--     Guardados (publicados + apagados): máximo 3 × cupo, para evitar abusos.
--  4) Lo que parece medicamento se guarda SIN publicar hasta que un moderador lo revise
--     (cola «💊 posibles medicamentos»). Si lo permite, se publica solo (si hay cupo).
--  5) El público solo ve productos publicados; «Ver tienda (n)» cuenta solo publicados.
-- =====================================================================

-- ---------- 1) Secciones ----------
alter table public.comercios add column if not exists limite_secciones smallint not null default 3;
alter table public.comercios drop constraint if exists comercios_limite_secciones_check;
alter table public.comercios add constraint comercios_limite_secciones_check check (limite_secciones between 0 and 50);

-- El cupo de productos y el de secciones solo los cambia el administrador (igual que en el SQL 38)
create or replace function public.comercios_limite_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or public.es_admin() or current_user not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then new.limite_productos := 10; new.limite_secciones := 3;
  else new.limite_productos := old.limite_productos; new.limite_secciones := old.limite_secciones; end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_guardia() from public, anon, authenticated;

create table if not exists public.secciones_vitrina (
  id          bigint generated always as identity primary key,
  comercio_id bigint not null references public.comercios(id) on delete cascade,
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 30),
  emoji       text check (emoji is null or char_length(emoji) <= 8),
  orden       integer not null default 0,
  creado_en   timestamptz not null default now()
);
create index if not exists secciones_vitrina_comercio_idx on public.secciones_vitrina (comercio_id, orden);

create or replace function public.secciones_limite()
returns trigger language plpgsql security definer set search_path = public as $$
declare tope int;
begin
  select coalesce(limite_secciones, 3) into tope from public.comercios where id = new.comercio_id for update;
  if (select count(*) from public.secciones_vitrina where comercio_id = new.comercio_id) >= coalesce(tope, 3) then
    raise exception 'Puedes tener hasta % secciones en tu vitrina. Borra o renombra una.', coalesce(tope, 3);
  end if;
  return new;
end $$;
revoke execute on function public.secciones_limite() from public, anon, authenticated;
drop trigger if exists secciones_antes_insert on public.secciones_vitrina;
create trigger secciones_antes_insert before insert on public.secciones_vitrina
  for each row execute function public.secciones_limite();

create or replace function public.secciones_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  new.nombre := btrim(new.nombre);
  if tg_op = 'UPDATE' and new.comercio_id is distinct from old.comercio_id then
    raise exception 'Una sección no puede cambiar de comercio';
  end if;
  return new;
end $$;
revoke execute on function public.secciones_guardia() from public, anon, authenticated;
drop trigger if exists secciones_antes_guardia on public.secciones_vitrina;
create trigger secciones_antes_guardia before insert or update on public.secciones_vitrina
  for each row execute function public.secciones_guardia();

alter table public.secciones_vitrina enable row level security;
grant select on public.secciones_vitrina to anon, authenticated;
grant insert, update, delete on public.secciones_vitrina to authenticated;
drop policy if exists secciones_leer on public.secciones_vitrina;
create policy secciones_leer on public.secciones_vitrina for select
  using (exists (select 1 from public.comercios c where c.id = comercio_id and c.activo)
         or public.es_moderador()
         or exists (select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));
drop policy if exists secciones_crear on public.secciones_vitrina;
create policy secciones_crear on public.secciones_vitrina for insert to authenticated
  with check (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));
drop policy if exists secciones_editar on public.secciones_vitrina;
create policy secciones_editar on public.secciones_vitrina for update to authenticated
  using (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())))
  with check (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));
drop policy if exists secciones_borrar on public.secciones_vitrina;
create policy secciones_borrar on public.secciones_vitrina for delete to authenticated
  using (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));

-- ---------- 2) Columnas nuevas de los productos ----------
alter table public.productos_comercio add column if not exists seccion_id bigint references public.secciones_vitrina(id) on delete set null;
alter table public.productos_comercio add column if not exists publicado boolean not null default true;
alter table public.productos_comercio add column if not exists orden integer not null default 0;
alter table public.productos_comercio add column if not exists cantidad integer;
alter table public.productos_comercio add column if not exists avisar_pocos boolean not null default false;
alter table public.productos_comercio add column if not exists agotar_en_cero boolean not null default true;
alter table public.productos_comercio add column if not exists en_revision boolean not null default false;
alter table public.productos_comercio drop constraint if exists productos_cantidad_check;
alter table public.productos_comercio add constraint productos_cantidad_check check (cantidad is null or cantidad between 0 and 100000);
create index if not exists productos_comercio_seccion_idx on public.productos_comercio (seccion_id);

-- Guardia (reemplaza la del SQL 07, con lo nuevo): oculto y en_revision solo los cambia un moderador o el sistema;
-- la sección debe ser del mismo comercio; con cantidad y «agotar en 0», la cantidad decide «agotado».
create or replace function public.productos_guardia()
returns trigger language plpgsql set search_path = public as $$
declare v_mod boolean := public.es_moderador() or pg_trigger_depth() > 1;
begin
  if tg_op = 'INSERT' then
    if not public.es_moderador() then new.oculto := false; end if;
    if not v_mod then new.en_revision := false; end if;
  else
    if not public.es_moderador() then new.oculto := old.oculto; end if;
    if not v_mod then new.en_revision := old.en_revision; end if;
    if new.comercio_id is distinct from old.comercio_id then
      raise exception 'Un producto no puede cambiar de comercio';
    end if;
    if not v_mod and new.en_revision and new.publicado and not old.publicado then
      raise exception 'Este producto está en revisión: un moderador lo revisa antes de publicarlo.';
    end if;
    new.actualizado_en := now();
  end if;
  if new.seccion_id is not null and not exists (
       select 1 from public.secciones_vitrina s where s.id = new.seccion_id and s.comercio_id = new.comercio_id) then
    raise exception 'Esa sección no es de esta tienda';
  end if;
  if new.cantidad is not null and new.agotar_en_cero
     and (tg_op = 'INSERT' or new.cantidad is distinct from old.cantidad) then
    new.disponible := new.cantidad > 0;
  end if;
  return new;
end $$;
revoke execute on function public.productos_guardia() from public, anon, authenticated;

-- ---------- 3) Cupo: cuenta solo publicados; guardados hasta 3 × cupo ----------
create or replace function public.productos_limite()
returns trigger language plpgsql security definer set search_path = public as $$
declare tope int;
begin
  select coalesce(limite_productos, 10) into tope from public.comercios where id = new.comercio_id for update;
  tope := coalesce(tope, 10);
  if tg_op = 'INSERT' and (select count(*) from public.productos_comercio where comercio_id = new.comercio_id) >= tope * 3 then
    raise exception 'Tu vitrina puede guardar hasta % productos (publicados y apagados). Borra uno para agregar otro.', tope * 3;
  end if;
  if new.publicado and (tg_op = 'INSERT' or not old.publicado)
     and (select count(*) from public.productos_comercio
           where comercio_id = new.comercio_id and publicado and id is distinct from new.id) >= tope then
    raise exception 'Tu vitrina gratis permite hasta % productos publicados. Apaga uno para publicar otro.', tope;
  end if;
  return new;
end $$;
revoke execute on function public.productos_limite() from public, anon, authenticated;
drop trigger if exists productos_antes_insert on public.productos_comercio;
drop trigger if exists productos_antes_cupo on public.productos_comercio;
create trigger productos_antes_cupo before insert or update of publicado on public.productos_comercio
  for each row execute function public.productos_limite();

-- «Ver tienda (n)» cuenta solo lo que el público puede ver
create or replace function public.productos_contar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint := coalesce(new.comercio_id, old.comercio_id);
begin
  update public.comercios set n_productos = (
    select count(*) from public.productos_comercio where comercio_id = v and not oculto and publicado
  ) where id = v;
  return null;
end $$;
revoke execute on function public.productos_contar() from public, anon, authenticated;

-- El público solo ve productos publicados (el dueño y los moderadores ven todo por productos_leer_gestion)
drop policy if exists productos_leer_publico on public.productos_comercio;
create policy productos_leer_publico on public.productos_comercio for select
  using (not oculto and publicado and exists (
    select 1 from public.comercios c where c.id = comercio_id and c.activo and c.nivel_verificacion >= 2));

-- ---------- 4) Posibles medicamentos: sin publicar hasta la revisión ----------
create or replace function public.productos_revision_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; tope int; v_com bigint;
begin
  r := coalesce(new, old);
  if r.tipo <> 'producto' or coalesce(r.motivo, 'salud') <> 'salud' then return null; end if;
  if tg_op = 'DELETE' then
    if old.estado = 'pendiente' then
      update public.productos_comercio set en_revision = false where id = old.ref_id;
    end if;
    return null;
  end if;
  if new.estado = 'pendiente' then
    update public.productos_comercio set en_revision = true, publicado = false
     where id = new.ref_id and (not en_revision or publicado);
  elsif new.estado = 'permitido' then
    select p.comercio_id into v_com from public.productos_comercio p where p.id = new.ref_id;
    select coalesce(limite_productos, 10) into tope from public.comercios where id = v_com;
    update public.productos_comercio p set en_revision = false,
           publicado = (select count(*) from public.productos_comercio x
                         where x.comercio_id = p.comercio_id and x.publicado and x.id <> p.id) < coalesce(tope, 10)
     where p.id = new.ref_id and p.en_revision;
  else   -- ocultado: el moderador ya lo ocultó; queda apagado
    update public.productos_comercio set en_revision = false where id = new.ref_id and en_revision;
  end if;
  return null;
end $$;
revoke execute on function public.productos_revision_sync() from public, anon, authenticated;
drop trigger if exists productos_revision_sync on public.revision_salud;
create trigger productos_revision_sync after insert or update of estado or delete on public.revision_salud
  for each row execute function public.productos_revision_sync();

-- Los que hoy están pendientes de revisión quedan sin publicar hasta que se revisen
update public.productos_comercio p set en_revision = true, publicado = false
 where exists (select 1 from public.revision_salud r
                where r.tipo = 'producto' and r.ref_id = p.id and r.motivo = 'salud' and r.estado = 'pendiente');
-- Recalcula «Ver tienda (n)»
update public.comercios c set n_productos = (
  select count(*) from public.productos_comercio p where p.comercio_id = c.id and not p.oculto and p.publicado);

-- Comprobación: debe mostrar 1 fila con todo en true.
select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'secciones_vitrina') as secciones,
       (select count(*) = 7 from information_schema.columns where table_schema = 'public' and table_name = 'productos_comercio'
          and column_name in ('seccion_id','publicado','orden','cantidad','avisar_pocos','agotar_en_cero','en_revision')) as columnas,
       (select prosrc like '%publicados%' from pg_proc where proname = 'productos_limite') as cupo_publicados,
       exists (select 1 from pg_trigger where tgname = 'productos_revision_sync') as revision,
       exists (select 1 from pg_policies where tablename = 'productos_comercio' and policyname = 'productos_leer_publico'
                 and qual like '%publicado%') as publico;
