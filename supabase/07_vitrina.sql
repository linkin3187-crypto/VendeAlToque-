-- =====================================================================
-- MercaFree · Fase 2D.2/2D.3/2D.4 · Dueño del comercio y vitrina (mini-inventario)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo. Requiere haber ejecutado 06.
--
-- Qué hace:
--  1) `comercios`: dueño (owner_id), descripción, WhatsApp de pedidos, opciones de entrega
--     (recoger / domicilio propio) y contador de productos.
--  2) El DUEÑO puede editar solo: descripción, WhatsApp, teléfono, horario, foto y entrega.
--     Nombre, ubicación, sello, visibilidad y dueño solo los cambian los moderadores.
--  3) `productos_comercio`: hasta 20 por comercio. El público solo los ve si el comercio está
--     activo y verificado (nivel 2 o 3) y el producto no fue ocultado por un moderador.
--  4) `reportes_producto`: cualquier persona con cuenta puede reportar un producto.
--  5) Función `asignar_dueno_comercio`: un moderador aprueba el reclamo de un dueño.
-- =====================================================================

alter table public.comercios
  add column if not exists owner_id uuid references public.perfiles(id) on delete set null,
  add column if not exists descripcion text check (descripcion is null or char_length(descripcion) <= 300),
  add column if not exists whatsapp text check (whatsapp is null or whatsapp ~ '^57[0-9]{10}$'),
  add column if not exists recoge boolean not null default false,
  add column if not exists domicilio boolean not null default false,
  add column if not exists domicilio_info text check (domicilio_info is null or char_length(domicilio_info) <= 200),
  add column if not exists n_productos smallint not null default 0;

create index if not exists comercios_owner_idx on public.comercios (owner_id) where owner_id is not null;

-- El dueño ve y edita SU comercio (aunque esté oculto)
drop policy if exists comercios_leer_dueno on public.comercios;
create policy comercios_leer_dueno on public.comercios for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists comercios_editar_dueno on public.comercios;
create policy comercios_editar_dueno on public.comercios for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ...pero solo estas columnas. Todo lo demás (nombre, ubicación, sello, activo, dueño…) es de moderadores.
-- Se compara la fila entera menos las columnas permitidas, así una columna nueva queda protegida por defecto.
create or replace function public.comercios_limite_dueno()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['descripcion','whatsapp','telefono','horario','foto_url','recoge','domicilio','domicilio_info','actualizado_en'];
begin
  -- pg_trigger_depth() > 1: cambios hechos por otros triggers (p. ej. el contador de productos)
  if tg_op <> 'UPDATE' or pg_trigger_depth() > 1 or auth.uid() is null or public.es_moderador() then
    return new;
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Solo puedes cambiar la descripción, el WhatsApp, el teléfono, el horario, la foto y las opciones de entrega';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_dueno() from public, anon, authenticated;

drop trigger if exists comercios_limite_dueno on public.comercios;
create trigger comercios_limite_dueno before update on public.comercios
  for each row execute function public.comercios_limite_dueno();

-- ---------- Aprobar el reclamo de un dueño (solo moderadores) ----------
-- Pasa el id de la persona (viene en la solicitud) o su correo. Sin ninguno, quita al dueño.
create or replace function public.asignar_dueno_comercio(p_comercio bigint, p_usuario uuid default null, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.es_moderador() then
    raise exception 'Solo moderadores pueden asignar dueños';
  end if;
  if p_usuario is not null then
    v_id := p_usuario;
  elsif p_email is not null and btrim(p_email) <> '' then
    select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
    if v_id is null then raise exception 'No existe una cuenta con ese correo'; end if;
  end if;
  if v_id is not null and not exists (select 1 from public.perfiles where id = v_id) then
    raise exception 'Esa persona no tiene perfil';
  end if;
  update public.comercios set owner_id = v_id where id = p_comercio;
  if not found then raise exception 'Comercio no encontrado'; end if;
end $$;
revoke execute on function public.asignar_dueno_comercio(bigint, uuid, text) from public, anon;
grant execute on function public.asignar_dueno_comercio(bigint, uuid, text) to authenticated;

-- ---------- Productos de la vitrina ----------
create table if not exists public.productos_comercio (
  id             bigint generated always as identity primary key,
  comercio_id    bigint not null references public.comercios(id) on delete cascade,
  nombre         text not null check (char_length(btrim(nombre)) between 2 and 80),
  descripcion    text check (descripcion is null or char_length(descripcion) <= 200),
  precio         bigint check (precio is null or precio >= 0),           -- pesos COP, sin decimales
  foto_url       text check (foto_url is null or foto_url ~ '^https://'),
  disponible     boolean not null default true,                           -- false = «agotado»
  oculto         boolean not null default false,                          -- lo oculta un moderador
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists productos_comercio_idx on public.productos_comercio (comercio_id, creado_en);

-- Tope de 20 por comercio (security definer: cuenta todos, también los ocultos; bloquea la fila para evitar carreras)
create or replace function public.productos_limite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.comercios where id = new.comercio_id for update;
  if (select count(*) from public.productos_comercio where comercio_id = new.comercio_id) >= 20 then
    raise exception 'Límite de 20 productos por comercio';
  end if;
  return new;
end $$;
revoke execute on function public.productos_limite() from public, anon, authenticated;

drop trigger if exists productos_antes_insert on public.productos_comercio;
create trigger productos_antes_insert before insert on public.productos_comercio
  for each row execute function public.productos_limite();

-- El dueño no puede reactivar un producto que un moderador ocultó; fecha de edición al día
create or replace function public.productos_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.es_moderador() then new.oculto := false; end if;
  else
    if not public.es_moderador() then new.oculto := old.oculto; end if;
    if new.comercio_id is distinct from old.comercio_id then
      raise exception 'Un producto no puede cambiar de comercio';
    end if;
    new.actualizado_en := now();
  end if;
  return new;
end $$;
revoke execute on function public.productos_guardia() from public, anon, authenticated;

drop trigger if exists productos_antes_guardia on public.productos_comercio;
create trigger productos_antes_guardia before insert or update on public.productos_comercio
  for each row execute function public.productos_guardia();

-- Mantiene comercios.n_productos (productos no ocultos) para mostrar «Ver tienda» solo si hay algo
create or replace function public.productos_contar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v bigint := coalesce(new.comercio_id, old.comercio_id);
begin
  update public.comercios set n_productos = (
    select count(*) from public.productos_comercio where comercio_id = v and not oculto
  ) where id = v;
  return null;
end $$;
revoke execute on function public.productos_contar() from public, anon, authenticated;

drop trigger if exists productos_despues_contar on public.productos_comercio;
create trigger productos_despues_contar after insert or update or delete on public.productos_comercio
  for each row execute function public.productos_contar();

alter table public.productos_comercio enable row level security;
grant select on public.productos_comercio to anon, authenticated;
grant insert, update, delete on public.productos_comercio to authenticated;

drop policy if exists productos_leer_publico on public.productos_comercio;
create policy productos_leer_publico on public.productos_comercio for select
  using (not oculto and exists (
    select 1 from public.comercios c where c.id = comercio_id and c.activo and c.nivel_verificacion >= 2));

drop policy if exists productos_leer_gestion on public.productos_comercio;
create policy productos_leer_gestion on public.productos_comercio for select to authenticated
  using (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));

drop policy if exists productos_crear on public.productos_comercio;
create policy productos_crear on public.productos_comercio for insert to authenticated
  with check (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));

drop policy if exists productos_editar on public.productos_comercio;
create policy productos_editar on public.productos_comercio for update to authenticated
  using (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())))
  with check (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));

drop policy if exists productos_borrar on public.productos_comercio;
create policy productos_borrar on public.productos_comercio for delete to authenticated
  using (public.es_moderador() or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));

-- ---------- Reportar un producto ----------
create table if not exists public.reportes_producto (
  id            bigint generated always as identity primary key,
  producto_id   bigint not null references public.productos_comercio(id) on delete cascade,
  reportante_id uuid default auth.uid() references public.perfiles(id) on delete set null,
  motivo        text not null check (motivo in ('prohibido','precio','no_existe','otro')),
  detalle       text check (detalle is null or char_length(detalle) <= 500),
  estado        text not null default 'pendiente' check (estado in ('pendiente','revisado','descartado')),
  creado_en     timestamptz not null default now()
);

create index if not exists reportes_producto_estado_idx on public.reportes_producto (estado, creado_en desc);
create unique index if not exists reportes_producto_unico_pendiente
  on public.reportes_producto (producto_id, reportante_id) where estado = 'pendiente';

alter table public.reportes_producto enable row level security;
grant select, insert, update on public.reportes_producto to authenticated;

drop policy if exists reportes_producto_crear on public.reportes_producto;
create policy reportes_producto_crear on public.reportes_producto for insert to authenticated
  with check (reportante_id = (select auth.uid()));

drop policy if exists reportes_producto_leer on public.reportes_producto;
create policy reportes_producto_leer on public.reportes_producto for select to authenticated
  using (public.es_moderador());

drop policy if exists reportes_producto_resolver on public.reportes_producto;
create policy reportes_producto_resolver on public.reportes_producto for update to authenticated
  using (public.es_moderador()) with check (public.es_moderador());
