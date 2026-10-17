-- =====================================================================
-- MercaFree · Fase 2Z.7 · Detalles de Inmuebles y Vehículos
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto los anuncios se publican
-- igual que hoy, solo que sin los campos nuevos). Es seguro repetirlo.
--
-- Qué hace:
--  · anuncios.detalles (jsonb): los datos propios de cada tipo de anuncio, por ejemplo
--      inmueble → {"operacion":"arriendo","habitaciones":3,"banos":2,"area":72,"estrato":4,…}
--      carro    → {"operacion":"venta","marca":"Mazda","modelo":2019,"km":45000,"transmision":"automatica",…}
--      moto     → {"operacion":"venta","marca":"Yamaha","modelo":2021,"cilindraje":150,"km":12000,…}
--    Siempre es un objeto, pequeño (máx. ~2 KB) y la operación solo puede ser venta, arriendo o arriendo por días.
--  · Todos pueden LEER la columna (como el resto de datos públicos del anuncio; el contacto sigue protegido).
--  · Índice para filtrar rápido por operación (venta / arriendo).
-- =====================================================================

alter table public.anuncios add column if not exists detalles jsonb not null default '{}'::jsonb;

alter table public.anuncios drop constraint if exists anuncios_detalles_check;
alter table public.anuncios add constraint anuncios_detalles_check check (
  jsonb_typeof(detalles) = 'object'
  and pg_column_size(detalles) <= 2048
  and (detalles->>'operacion' is null or detalles->>'operacion' in ('venta', 'arriendo', 'arriendo_dias'))
);

-- La lectura de anuncios es por columnas (13b_proteger_contacto.sql): hay que permitir esta también
grant select (detalles) on public.anuncios to anon, authenticated;

create index if not exists anuncios_operacion_idx on public.anuncios ((detalles->>'operacion')) where detalles <> '{}'::jsonb;

-- Comprobación: debe mostrar 1 fila con columna_detalles = true y se_puede_leer = true.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'anuncios' and column_name = 'detalles') as columna_detalles,
       has_column_privilege('anon', 'public.anuncios', 'detalles', 'select') as se_puede_leer;
