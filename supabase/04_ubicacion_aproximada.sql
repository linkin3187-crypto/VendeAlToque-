-- =====================================================================
-- MercaFree · Fase 2C.1 · Ubicación aproximada de los anuncios (privacidad)
-- Ejecutar UNA vez en Supabase → SQL Editor, ANTES de fusionar el cambio en GitHub.
-- Es seguro repetirlo (la migración de anuncios viejos solo corre la primera vez).
--
-- PROBLEMA: hoy el pin de un anuncio es el punto EXACTO y la base de datos lo
-- entrega a cualquiera. Para una persona que vende desde su casa eso revela dónde vive.
--
-- SOLUCIÓN:
--  * `anuncios.lat/lng` pasan a ser el punto PÚBLICO: si `ubicacion_aprox` es true,
--    ya viene desplazado entre 150 y 350 m del punto real.
--  * El punto REAL se guarda aparte, en `anuncios_ubicacion`, y solo lo leen
--    el dueño (para editar su anuncio) y los moderadores (para investigar reportes).
--  * Los anuncios que ya existen se migran: se guarda su punto real y se desplaza
--    el público (una sola vez).
-- =====================================================================

alter table public.anuncios
  add column if not exists ubicacion_aprox boolean not null default false;

do $$
begin
  if to_regclass('public.anuncios_ubicacion') is null then

    create table public.anuncios_ubicacion (
      anuncio_id     bigint primary key references public.anuncios(id) on delete cascade,
      owner_id       uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
      lat            double precision not null check (lat between -5 and 14),
      lng            double precision not null check (lng between -80 and -66),
      actualizado_en timestamptz not null default now()
    );

    -- Migración de los anuncios que ya existen: 1) guardar el punto real…
    insert into public.anuncios_ubicacion (anuncio_id, owner_id, lat, lng)
      select id, owner_id, lat, lng from public.anuncios;

    -- …2) desplazar el público una distancia aleatoria (150–350 m) en una dirección aleatoria.
    with desplazo as (
      select id, 150 + 200 * random() as metros, 2 * pi() * random() as angulo
      from public.anuncios
    )
    update public.anuncios a
       set lat = a.lat + (d.metros * cos(d.angulo)) / 111320.0,
           lng = a.lng + (d.metros * sin(d.angulo)) / (111320.0 * cos(radians(a.lat))),
           ubicacion_aprox = true
      from desplazo d
     where a.id = d.id;

  end if;
end $$;

alter table public.anuncios_ubicacion enable row level security;

grant select, insert, update, delete on public.anuncios_ubicacion to authenticated;
-- (anon no recibe ningún permiso: el público JAMÁS puede leer el punto real)

drop policy if exists ubicacion_leer on public.anuncios_ubicacion;
create policy ubicacion_leer on public.anuncios_ubicacion for select to authenticated
  using (owner_id = (select auth.uid()) or public.es_moderador());

drop policy if exists ubicacion_crear on public.anuncios_ubicacion;
create policy ubicacion_crear on public.anuncios_ubicacion for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.anuncios a
                where a.id = anuncio_id and a.owner_id = (select auth.uid()))
  );

drop policy if exists ubicacion_editar on public.anuncios_ubicacion;
create policy ubicacion_editar on public.anuncios_ubicacion for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists ubicacion_borrar on public.anuncios_ubicacion;
create policy ubicacion_borrar on public.anuncios_ubicacion for delete to authenticated
  using (owner_id = (select auth.uid()) or public.es_moderador());
