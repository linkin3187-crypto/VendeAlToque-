-- =====================================================================
-- Merkap · Fase V-2c · Logo de cada tienda
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 27 (fotos de comercios) y 38.
--
-- Qué hace:
--  1) comercios.logo_url: el logo del negocio (sale en el cuadro blanco sobre la portada, en las
--     tarjetas y en favoritos). Solo enlaces https. Vacío = se muestra el ícono de la categoría.
--  2) El DUEÑO puede cambiar su logo (se agrega a lo que ya podía cambiar: descripción, contacto,
--     horario, fotos…). El administrador y los moderadores también.
-- =====================================================================

alter table public.comercios add column if not exists logo_url text;
alter table public.comercios drop constraint if exists comercios_logo_check;
alter table public.comercios add constraint comercios_logo_check
  check (logo_url is null or (logo_url ~ '^https://' and char_length(logo_url) <= 500));

-- Lo que el dueño puede cambiar (misma función de 27_fotos_comercio.sql + 'logo_url')
create or replace function public.comercios_limite_dueno()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['descripcion','whatsapp','telefono','horario','foto_url','fotos','logo_url','recoge','domicilio','domicilio_info','actualizado_en','tipo','tipos_extra','modo_atencion'];
begin
  if tg_op <> 'UPDATE' or pg_trigger_depth() > 1 or auth.uid() is null or public.es_moderador() then
    return new;
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Solo puedes cambiar la descripción, el WhatsApp, el teléfono, el horario, las fotos, el logo, la entrega, las categorías y cómo atiendes';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_dueno() from public, anon, authenticated;

-- La tabla se lee completa (grant de tabla), así que la columna nueva ya se puede leer.
-- ---------- Comprobación ----------
-- Debe mostrar: columna = true | dueno_puede = true
select exists (select 1 from information_schema.columns where table_name = 'comercios' and column_name = 'logo_url') as columna,
       position('logo_url' in pg_get_functiondef('public.comercios_limite_dueno()'::regprocedure)) > 0 as dueno_puede;
