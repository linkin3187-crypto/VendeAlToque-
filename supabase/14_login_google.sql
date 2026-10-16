-- =====================================================================
-- MercaFree · Fase 2T · Entrar con Google
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR de la 2T. Es seguro repetirlo.
-- Requiere haber ejecutado 10_referidos.sql.
--
-- Qué hace:
--  1) `crear_perfil()`: si la cuenta viene de Google, toma el nombre de Google (full_name / name)
--     cuando no hay «nombre». Todo lo demás queda igual que en el 10.
--  2) `asignar_ref_inicial(codigo)`: con Google no se puede enviar el código ?ref= al crear la cuenta,
--     así que la página lo envía justo después de entrar. Solo funciona UNA vez, si el perfil aún no
--     tiene código y se creó hace menos de 1 hora (así nadie puede cambiar su origen después).
-- =====================================================================

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ref text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'ref', '')));
begin
  if v_ref !~ '^[a-z0-9_-]{1,30}$' then v_ref := null; end if;
  insert into public.perfiles (id, nombre, ref)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),   -- Google
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),        -- Google
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'), 40),
    v_ref
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.crear_perfil() from public, anon, authenticated;

create or replace function public.asignar_ref_inicial(p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ref text := lower(btrim(coalesce(p_ref, '')));
begin
  if auth.uid() is null or v_ref !~ '^[a-z0-9_-]{1,30}$' then return false; end if;
  update public.perfiles set ref = v_ref
   where id = auth.uid() and ref is null and creado_en > now() - interval '1 hour';
  return found;
end $$;
revoke execute on function public.asignar_ref_inicial(text) from public, anon;
grant execute on function public.asignar_ref_inicial(text) to authenticated;

-- Comprobación: debe mostrar 1 fila con «asignar_ref_inicial».
select proname from pg_proc where proname = 'asignar_ref_inicial';
