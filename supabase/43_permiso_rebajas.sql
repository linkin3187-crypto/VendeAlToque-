-- =====================================================================
-- Merkap · Fase 2AP-4a (arreglo) · Permiso para LEER el precio anterior de las rebajas
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo. Arregla de inmediato (sin esperar el PR).
--
-- Qué pasaba: la tabla anuncios da permiso de lectura COLUMNA POR COLUMNA (así se protege el
-- WhatsApp y el teléfono, SQL 13b). El SQL 42 agregó dos columnas nuevas (precio_anterior y
-- rebajado_en) pero no les dio permiso de lectura. La página las pedía y la base respondía
-- «permission denied» → no se veían los anuncios ni la Selección del día y no se podía publicar.
-- =====================================================================
grant select (precio_anterior, rebajado_en) on public.anuncios to anon, authenticated;

-- Comprobación: debe mostrar lectura = true
select has_column_privilege('anon', 'public.anuncios', 'precio_anterior', 'select')
   and has_column_privilege('authenticated', 'public.anuncios', 'rebajado_en', 'select') as lectura;
