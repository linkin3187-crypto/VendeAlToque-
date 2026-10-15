-- =====================================================================
-- MercaFree · Fase 2D.5 · Códigos de origen (?ref=) para medir de dónde llegan los registros
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo. Requiere haber ejecutado 01 y 08.
--
-- Qué hace:
--  1) `perfiles.ref`: el código con el que llegó la persona (p. ej. «grupo-envigado-1» o «tienda-drogueria»).
--     Solo se guarda al crear la cuenta; la persona NO puede cambiarlo después (ya solo puede editar su nombre).
--  2) `crear_perfil()`: toma el código del registro y lo guarda solo si tiene formato válido
--     (minúsculas, números, guion y guion bajo, hasta 30 caracteres). Si no, queda vacío.
--  3) `resumen_referidos()`: solo moderadores. Devuelve, por código, cuántas cuentas nuevas llegaron,
--     cuántas en los últimos 7 días, cuántas ya publicaron un anuncio y cuántas enviaron un negocio.
-- No se guarda nada de quien solo visita la página: únicamente el código de quien crea cuenta.
-- =====================================================================

alter table public.perfiles
  add column if not exists ref text check (ref is null or ref ~ '^[a-z0-9_-]{1,30}$');

create index if not exists perfiles_ref_idx on public.perfiles (ref) where ref is not null;

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
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'), 40),
    v_ref
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.crear_perfil() from public, anon, authenticated;

create or replace function public.resumen_referidos()
returns table (ref text, registros bigint, registros_7d bigint, con_anuncio bigint, con_negocio bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_moderador() then
    raise exception 'Solo moderadores pueden ver este resumen';
  end if;
  return query
    select coalesce(p.ref, '(directo)')::text,
           count(*)::bigint,
           count(*) filter (where p.creado_en >= now() - interval '7 days')::bigint,
           count(*) filter (where exists (select 1 from public.anuncios a where a.owner_id = p.id))::bigint,
           count(*) filter (where exists (select 1 from public.negocios_pendientes n where n.solicitante_id = p.id))::bigint
      from public.perfiles p
     group by coalesce(p.ref, '(directo)')
     order by 2 desc, 1;
end $$;
revoke execute on function public.resumen_referidos() from public, anon;
grant execute on function public.resumen_referidos() to authenticated;
