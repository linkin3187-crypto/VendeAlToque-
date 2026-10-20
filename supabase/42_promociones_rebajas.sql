-- =====================================================================
-- Merkap · Fase 2AP-4a · Promociones de las tiendas + rebajas de precio en anuncios
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 01, 07 (comercios y productos), 38 (es_admin) y 39/40 (filtro de palabras).
--
-- Qué hace:
--  1) promociones: cada tienda publica ofertas con fecha de inicio y fin.
--     · Las crea el DUEÑO de la tienda (o el ADMINISTRADOR a su nombre).
--     · Máximo 2 activas o programadas por tienda y máximo 15 días cada una.
--     · Precio especial (antes > ahora), % de descuento o combo (2x1…). Condiciones y cantidad opcionales.
--     · El público solo ve las vigentes de tiendas activas. Al vencer se ocultan solas.
--     · Pasan por el filtro de palabras prohibidas. El administrador puede ocultar cualquiera.
--  2) Rebajas en anuncios: si el dueño BAJA el precio, el anuncio guarda el precio anterior y la
--     fecha. La página muestra «antes tachado + ahora + −%» durante 15 días.
--     El precio anterior lo pone SOLO el servidor (no se puede inventar una rebaja falsa):
--     si sube el precio o lo quita, la rebaja desaparece.
-- =====================================================================

-- ---------- 1) Rebajas en anuncios ----------
alter table public.anuncios add column if not exists precio_anterior bigint check (precio_anterior is null or precio_anterior > 0);
alter table public.anuncios add column if not exists rebajado_en timestamptz;

create or replace function public.anuncios_rebaja()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.precio_anterior := null; new.rebajado_en := null;
    return new;
  end if;
  if new.precio is distinct from old.precio then
    if old.precio is not null and new.precio is not null and new.precio > 0 and new.precio < old.precio then
      -- rebaja sobre rebaja (dentro de los 15 días): se conserva el precio ORIGINAL
      new.precio_anterior := case when old.precio_anterior is not null and old.rebajado_en > now() - interval '15 days'
                                  then greatest(old.precio_anterior, old.precio) else old.precio end;
      new.rebajado_en := now();
    else
      new.precio_anterior := null; new.rebajado_en := null;    -- subió o quitó el precio: ya no es rebaja
    end if;
  else
    -- mismo precio: solo se permite QUITAR la etiqueta de rebaja, nunca poner un «antes» inventado
    if new.precio_anterior is not null then new.precio_anterior := old.precio_anterior; end if;
    new.rebajado_en := case when new.precio_anterior is null then null else old.rebajado_en end;
  end if;
  return new;
end $$;
revoke execute on function public.anuncios_rebaja() from public, anon, authenticated;
drop trigger if exists anuncios_rebaja on public.anuncios;
create trigger anuncios_rebaja before insert or update on public.anuncios
  for each row execute function public.anuncios_rebaja();

-- ---------- 2) Promociones ----------
create table if not exists public.promociones (
  id             bigint generated always as identity primary key,
  comercio_id    bigint not null references public.comercios(id) on delete cascade,
  titulo         text not null check (char_length(btrim(titulo)) between 3 and 80),
  descripcion    text check (descripcion is null or char_length(descripcion) <= 300),
  tipo           text not null default 'precio' check (tipo in ('precio', 'porcentaje', 'combo')),
  precio_antes   bigint check (precio_antes is null or precio_antes > 0),
  precio_promo   bigint check (precio_promo is null or precio_promo >= 0),
  descuento      smallint check (descuento is null or descuento between 1 and 90),
  producto_id    bigint references public.productos_comercio(id) on delete set null,
  foto_url       text check (foto_url is null or foto_url ~ '^https://'),
  desde          date not null default ((now() at time zone 'America/Bogota')::date),
  hasta          date not null,
  cantidad       integer check (cantidad is null or cantidad between 1 and 100000),
  condiciones    text check (condiciones is null or char_length(condiciones) <= 200),
  oculta         boolean not null default false,       -- la oculta el administrador
  creado_por     uuid references public.perfiles(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint promociones_fechas check (hasta >= desde and hasta - desde <= 14),          -- máximo 15 días
  constraint promociones_precio check (tipo <> 'precio' or (precio_antes is not null and precio_promo is not null and precio_promo < precio_antes)),
  constraint promociones_porcentaje check (tipo <> 'porcentaje' or descuento is not null)
);
create index if not exists promociones_comercio_idx on public.promociones (comercio_id, hasta);
create index if not exists promociones_vigentes_idx on public.promociones (hasta) where not oculta;

-- ¿Es el dueño de esa tienda? (security definer: lee comercios sin depender de sus reglas)
create or replace function public.es_dueno_comercio(p_comercio bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comercios where id = p_comercio and owner_id = auth.uid() and auth.uid() is not null)
$$;
revoke execute on function public.es_dueno_comercio(bigint) from public, anon;
grant execute on function public.es_dueno_comercio(bigint) to authenticated;

create or replace function public.promociones_guardia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_n int;
begin
  if auth.uid() is null then   -- SQL Editor
    new.actualizado_en := now();
    return new;
  end if;
  if not (public.es_admin() or public.es_dueno_comercio(new.comercio_id)) then
    raise exception 'Solo el dueño de la tienda (o el administrador) puede publicar sus promociones';
  end if;
  if not exists (select 1 from public.comercios where id = new.comercio_id and activo) then
    raise exception 'La tienda debe estar activa en el mapa para publicar promociones';
  end if;
  if new.producto_id is not null and not exists (select 1 from public.productos_comercio where id = new.producto_id and comercio_id = new.comercio_id) then
    raise exception 'Ese producto no es de esta tienda';
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_en := now();
    if new.desde < v_hoy then new.desde := v_hoy; end if;
  else
    new.comercio_id := old.comercio_id;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    if new.desde < v_hoy and new.desde is distinct from old.desde then new.desde := v_hoy; end if;
  end if;
  if not public.es_admin() then new.oculta := case when tg_op = 'UPDATE' then old.oculta else false end; end if;
  if new.hasta < new.desde or new.hasta - new.desde > 14 then
    raise exception 'Una promoción dura máximo 15 días';
  end if;
  -- Máximo 2 activas o programadas por tienda
  select count(*) into v_n from public.promociones
   where comercio_id = new.comercio_id and not oculta and hasta >= v_hoy and id is distinct from new.id;
  if not new.oculta and new.hasta >= v_hoy and v_n >= 2 then
    raise exception 'Máximo 2 promociones activas o programadas por tienda. Borra o termina una para publicar otra.';
  end if;
  new.titulo := btrim(new.titulo);
  new.actualizado_en := now();
  return new;
end $$;
revoke execute on function public.promociones_guardia() from public, anon, authenticated;
drop trigger if exists promociones_guardia on public.promociones;
create trigger promociones_guardia before insert or update on public.promociones
  for each row execute function public.promociones_guardia();

-- Filtro de palabras prohibidas (el mismo de anuncios y productos; las promos cuentan como «producto»)
create or replace function public.contenido_bloquear()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new); col text; txt text := ''; h record;
  v_amb text := case tg_table_name when 'anuncios' then 'anuncio' when 'productos_comercio' then 'producto'
                                   when 'promociones' then 'producto' when 'comercios' then 'comercio' else 'otro' end;
begin
  -- solo el SQL Editor (sin sesión) o el administrador con el filtro desbloqueado por su clave
  if auth.uid() is null or public.filtro_libre() then return new; end if;
  foreach col in array tg_argv loop txt := txt || ' ' || coalesce(j ->> col, ''); end loop;
  select * into h from public.buscar_palabra_prohibida(txt, 'bloquear', j ->> 'categoria', v_amb);
  if h.palabra is not null then
    raise exception 'Tu publicación incluye «%», que no está permitido en Merkap%. Revisa «Artículos prohibidos». Si crees que es un error, toca «Pedir revisión».',
      h.palabra, case when h.nota is not null then ' (' || h.nota || ')' else '' end;
  end if;
  return new;
end $$;
drop trigger if exists contenido_bloquear on public.promociones;
create trigger contenido_bloquear before insert or update of titulo, descripcion, condiciones on public.promociones
  for each row execute function public.contenido_bloquear('titulo', 'descripcion', 'condiciones');

-- Quién ve qué
alter table public.promociones enable row level security;
drop policy if exists "promociones: público ve las vigentes" on public.promociones;
drop policy if exists "promociones: dueño y admin ven las suyas" on public.promociones;
drop policy if exists "promociones: dueño y admin crean" on public.promociones;
drop policy if exists "promociones: dueño y admin editan" on public.promociones;
drop policy if exists "promociones: dueño y admin borran" on public.promociones;
create policy "promociones: público ve las vigentes" on public.promociones for select to anon, authenticated
  using (not oculta and desde <= (now() at time zone 'America/Bogota')::date and hasta >= (now() at time zone 'America/Bogota')::date
         and exists (select 1 from public.comercios c where c.id = comercio_id and c.activo));
create policy "promociones: dueño y admin ven las suyas" on public.promociones for select to authenticated
  using (public.es_admin() or public.es_dueno_comercio(comercio_id));
create policy "promociones: dueño y admin crean" on public.promociones for insert to authenticated
  with check (public.es_admin() or public.es_dueno_comercio(comercio_id));
create policy "promociones: dueño y admin editan" on public.promociones for update to authenticated
  using (public.es_admin() or public.es_dueno_comercio(comercio_id))
  with check (public.es_admin() or public.es_dueno_comercio(comercio_id));
create policy "promociones: dueño y admin borran" on public.promociones for delete to authenticated
  using (public.es_admin() or public.es_dueno_comercio(comercio_id));
grant select on public.promociones to anon;
grant select, insert, update, delete on public.promociones to authenticated;

-- ---------- Comprobación ----------
-- Debe mostrar: rebajas = true | promociones = true | seguras = true | filtro = true
select exists (select 1 from information_schema.columns where table_name = 'anuncios' and column_name = 'precio_anterior')
         and exists (select 1 from pg_trigger where tgname = 'anuncios_rebaja') as rebajas,
       exists (select 1 from pg_trigger where tgname = 'promociones_guardia') as promociones,
       (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'promociones') as seguras,
       exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'promociones' and t.tgname = 'contenido_bloquear') as filtro;
