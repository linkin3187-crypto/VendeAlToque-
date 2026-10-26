-- =====================================================================
-- Merkap · Fase RED-1 · Redes sociales y página web de cada comercio
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 49 (logo del comercio).
--
-- Qué hace:
--  1) comercios.facebook / instagram / tiktok: se guarda SOLO el nombre de usuario (limpio).
--     La página arma el enlace (facebook.com/…, instagram.com/…, tiktok.com/@…), así nadie puede
--     colar un enlace a otro sitio. La base revisa el formato (no solo la página).
--  2) comercios.sitio_web: enlace http(s) a la página web del negocio (máx. 200 caracteres).
--  3) El DUEÑO puede cambiar sus redes y su web (se agregan a lo que ya podía cambiar).
--     El administrador y los moderadores también.
-- =====================================================================

alter table public.comercios add column if not exists facebook  text;
alter table public.comercios add column if not exists instagram text;
alter table public.comercios add column if not exists tiktok    text;
alter table public.comercios add column if not exists sitio_web text;

-- Formatos permitidos (los mismos que revisa la página)
alter table public.comercios drop constraint if exists comercios_facebook_check;
alter table public.comercios add constraint comercios_facebook_check
  check (facebook is null or facebook ~ '^([A-Za-z0-9.\-]{2,80}|profile\.php\?id=[0-9]{5,20})$');
alter table public.comercios drop constraint if exists comercios_instagram_check;
alter table public.comercios add constraint comercios_instagram_check
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
alter table public.comercios drop constraint if exists comercios_tiktok_check;
alter table public.comercios add constraint comercios_tiktok_check
  check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{2,24}$');
alter table public.comercios drop constraint if exists comercios_sitio_web_check;
alter table public.comercios add constraint comercios_sitio_web_check
  check (sitio_web is null or (char_length(sitio_web) <= 200
    and sitio_web ~ '^https?://[A-Za-z0-9.\-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]"''<>`]*)?$'));

-- Lo que el dueño puede cambiar (misma función de 49_logo_comercio.sql + redes y web)
create or replace function public.comercios_limite_dueno()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['descripcion','whatsapp','telefono','horario','foto_url','fotos','logo_url','recoge','domicilio','domicilio_info','actualizado_en','tipo','tipos_extra','modo_atencion',
                             'facebook','instagram','tiktok','sitio_web'];
begin
  if tg_op <> 'UPDATE' or pg_trigger_depth() > 1 or auth.uid() is null or public.es_moderador() then
    return new;
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Solo puedes cambiar la descripción, el WhatsApp, el teléfono, el horario, las fotos, el logo, la entrega, las categorías, cómo atiendes, tus redes y tu página web';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_dueno() from public, anon, authenticated;

-- La tabla se lee completa (grant de tabla), así que las columnas nuevas ya se pueden leer.
-- ---------- Comprobación ----------
-- Debe mostrar: columnas = 4 | dueno_puede = true | revisa_formato = 4
select (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'comercios'
           and column_name in ('facebook','instagram','tiktok','sitio_web')) as columnas,
       position('sitio_web' in pg_get_functiondef('public.comercios_limite_dueno()'::regprocedure)) > 0 as dueno_puede,
       (select count(*) from pg_constraint where conrelid = 'public.comercios'::regclass
          and conname in ('comercios_facebook_check','comercios_instagram_check','comercios_tiktok_check','comercios_sitio_web_check')) as revisa_formato;
