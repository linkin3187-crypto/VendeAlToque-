-- =====================================================================
-- Merkap · Fase 2AC.1 · Datos sanitarios OPCIONALES (nadie se frena para cargar productos)
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 29 y 31.
--
-- Qué hace:
--  1) Una droguería, naturista o tienda que marcó «farmacia» como categoría secundaria ya NO necesita
--     llenar los datos sanitarios para cargar productos. Los medicamentos siguen prohibidos para todos
--     (Términos 4B, aviso al cargar, cola «💊 Posibles medicamentos» y palabras prohibidas).
--  2) «Registrar mi negocio» acepta droguerías sin datos sanitarios; si los envía, se validan igual.
--  Quien los llena obtiene (con tu visto bueno) el distintivo 🧾, sale primero en su categoría y
--  tendrá hecho el primer paso para la venta libre (2AB.3).
-- =====================================================================

-- 1) Ya no se exige para cargar productos
drop trigger if exists productos_salud_requisito on public.productos_comercio;

-- 2) Registro: opcional; si vienen, se validan
create or replace function public.negocios_pend_salud()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.es_tipo_salud(new.tipo) then new.datos_sanitarios := null; return new; end if;
  if new.datos_sanitarios is null then return new; end if;
  perform public.validar_datos_sanitarios_json(new.datos_sanitarios);
  return new;
end $$;
revoke execute on function public.negocios_pend_salud() from public, anon, authenticated;

-- Comprobación: debe mostrar 1 fila con sin_requisito = true.
select not exists (select 1 from pg_trigger where tgname = 'productos_salud_requisito') as sin_requisito;
