-- =====================================================================
-- MercaFree · Fase 2X · Recomienda un comercio
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR de la 2X. Es seguro repetirlo.
-- Requiere 01 (es_moderador), 02 (comercios), 15 (categorias_comercio).
--
-- Qué hace:
--  1) Dos categorías nuevas: «Bares y discotecas» y «Puestos de comida» (no pisa si ya existen).
--  2) `recomendaciones_comercio`: la gente (con cuenta) recomienda un negocio que visitó y no está
--     en el directorio: nombre, categoría, municipio, dirección o «estoy aquí» (GPS), foto opcional
--     y un comentario. Límite: 10 por día y 15 en revisión por persona.
--     Cada quien ve solo las suyas; los moderadores las ven todas.
--  3) Solo los moderadores cambian el estado: «creado» (con el comercio que se creó) o «descartado».
-- =====================================================================

-- 1) Categorías nuevas
insert into public.categorias_comercio (id, nombre, icono, palabras, orden, activo) values
  ('bar', 'Bares y discotecas', '🍻',
   'bar, bares, discoteca, discotecas, cerveza, cervezas, rumba, licores, coctel, cocteles, gastrobar, karaoke, billar, tienda bar, estadero, cantina, pola, polas, trago, tragos', 62, true),
  ('puesto_comida', 'Puestos de comida', '🌭',
   'puesto de comida, puesto, carrito, chuzos, chuzo, arepas, arepa, empanadas, empanada, perro caliente, perros, salchipapa, mazorca, obleas, fritos, buñuelos, jugos naturales, salpicon, comida callejera, comidas rapidas, fritanga, chorizo', 63, true)
on conflict (id) do nothing;

-- 2) Recomendaciones
create table if not exists public.recomendaciones_comercio (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre        text not null check (char_length(btrim(nombre)) between 2 and 100),
  tipo          text not null references public.categorias_comercio(id),
  municipio_id  integer not null references public.municipios(id),
  direccion     text check (direccion is null or char_length(direccion) <= 160),
  lat           double precision check (lat is null or lat between -5 and 14),
  lng           double precision check (lng is null or lng between -80 and -66),
  foto_url      text check (foto_url is null or (foto_url ~ '^https://' and char_length(foto_url) <= 500)),
  comentario    text check (comentario is null or char_length(comentario) <= 300),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'creado', 'descartado')),
  comercio_id   bigint references public.comercios(id) on delete set null,
  resuelto_por  uuid references auth.users(id),
  resuelto_en   timestamptz,
  creado_en     timestamptz not null default now(),
  constraint recomendacion_ubicacion check ((lat is null) = (lng is null)),
  constraint recomendacion_donde check (lat is not null or char_length(btrim(coalesce(direccion, ''))) >= 5)
);
create index if not exists recomendaciones_estado_idx on public.recomendaciones_comercio (estado, creado_en);
create index if not exists recomendaciones_usuario_idx on public.recomendaciones_comercio (usuario_id, creado_en desc);

-- Al crear: el servidor fija quién la envía y el estado; aplica los límites
create or replace function public.recomendaciones_antes_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.usuario_id := coalesce(auth.uid(), new.usuario_id);
  new.estado := 'pendiente'; new.comercio_id := null; new.resuelto_por := null; new.resuelto_en := null;
  if (select count(*) from public.recomendaciones_comercio
       where usuario_id = new.usuario_id and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al máximo de recomendaciones por hoy (10). ¡Gracias! Sigue mañana';
  end if;
  if (select count(*) from public.recomendaciones_comercio
       where usuario_id = new.usuario_id and estado = 'pendiente') >= 15 then
    raise exception 'Tienes 15 recomendaciones en revisión. Espera a que las revisemos para enviar más';
  end if;
  return new;
end $$;
revoke execute on function public.recomendaciones_antes_insert() from public, anon, authenticated;

drop trigger if exists recomendaciones_antes_insert on public.recomendaciones_comercio;
create trigger recomendaciones_antes_insert before insert on public.recomendaciones_comercio
  for each row execute function public.recomendaciones_antes_insert();

-- Al resolver (solo moderadores por la regla de abajo): queda quién y cuándo
create or replace function public.recomendaciones_antes_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado <> old.estado then
    new.resuelto_por := auth.uid();
    new.resuelto_en := case when new.estado = 'pendiente' then null else now() end;
  end if;
  return new;
end $$;
revoke execute on function public.recomendaciones_antes_update() from public, anon, authenticated;

drop trigger if exists recomendaciones_antes_update on public.recomendaciones_comercio;
create trigger recomendaciones_antes_update before update on public.recomendaciones_comercio
  for each row execute function public.recomendaciones_antes_update();

alter table public.recomendaciones_comercio enable row level security;
revoke all on public.recomendaciones_comercio from anon, authenticated;
grant select, insert, update, delete on public.recomendaciones_comercio to authenticated;

drop policy if exists recomendaciones_crear on public.recomendaciones_comercio;
create policy recomendaciones_crear on public.recomendaciones_comercio for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists recomendaciones_leer on public.recomendaciones_comercio;
create policy recomendaciones_leer on public.recomendaciones_comercio for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_moderador()));

drop policy if exists recomendaciones_moderar on public.recomendaciones_comercio;
create policy recomendaciones_moderar on public.recomendaciones_comercio for update to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

drop policy if exists recomendaciones_borrar on public.recomendaciones_comercio;
create policy recomendaciones_borrar on public.recomendaciones_comercio for delete to authenticated
  using ((select public.es_moderador()));

-- Comprobación: debe mostrar 1 fila con categorias_nuevas = 2 y tabla_con_rls = true.
select (select count(*) from public.categorias_comercio where id in ('bar', 'puesto_comida')) as categorias_nuevas,
       (select relrowsecurity from pg_class where relname = 'recomendaciones_comercio' and relnamespace = 'public'::regnamespace) as tabla_con_rls;
