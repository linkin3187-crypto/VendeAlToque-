-- =====================================================================
-- MercaFree · Fase 2S (parte 2 de 2) · Proteger el WhatsApp y el teléfono de los anuncios
-- Ejecutar en Supabase → SQL Editor DESPUÉS de fusionar el PR de la fase 2S y de ver el check verde.
-- (Si lo ejecutas antes, la página vieja deja de cargar anuncios hasta que fusiones.) Es seguro repetirlo.
--
-- Qué hace: nadie (ni visitantes ni personas con cuenta) puede leer las columnas `whatsapp` y
-- `telefono` directamente de la tabla `anuncios`. El contacto solo se obtiene con la función
-- `contacto_anuncio(id)` (parte 1), que exige cuenta y tiene límite diario.
-- Todas las demás columnas siguen siendo legibles como hoy (las reglas RLS no cambian).
--
-- IMPORTANTE para el futuro: si algún día agregas una columna nueva a `anuncios`, vuelve a
-- ejecutar este archivo para que esa columna también se pueda leer.
-- =====================================================================

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'anuncios'
     and column_name not in ('whatsapp', 'telefono');
  execute 'revoke select on public.anuncios from anon, authenticated';
  execute format('grant select (%s) on public.anuncios to anon, authenticated', cols);
end $$;

-- Comprobación: debe mostrar 2 filas (anon y authenticated) con `false`
-- (= NO pueden leer la columna whatsapp directamente).
select r as rol, has_column_privilege(r, 'public.anuncios', 'whatsapp', 'SELECT') as puede_leer_whatsapp
  from unnest(array['anon', 'authenticated']) as r;
