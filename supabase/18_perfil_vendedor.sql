-- =====================================================================
-- MercaFree · Fase 2C.5 · Perfil público del vendedor
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR de la 2C.5. Es seguro repetirlo.
-- Requiere 01 (perfiles, anuncios) y 02/06 (comercios).
--
-- Qué hace:
--  1) `perfiles.nombre_publico`: cómo te ven los compradores (apodo o nombre de tu tienda, 2 a 40 letras).
--     Si no lo pones, se muestra solo tu PRIMER nombre (nunca el apellido, el correo ni el rol).
--  2) `perfil_publico(id)`: entrega SOLO id, nombre visible, «miembro desde», cuántos anuncios activos tiene
--     y su comercio (si es dueño de uno). La tabla `perfiles` sigue privada.
--     Solo responde si la persona tiene anuncios activos o un comercio (o si eres tú): así no sirve para
--     averiguar quién tiene cuenta.
-- =====================================================================

alter table public.perfiles
  add column if not exists nombre_publico text
  check (nombre_publico is null or char_length(btrim(nombre_publico)) between 2 and 40);

-- Cada quien puede cambiar su nombre y su nombre público (nunca el rol)
revoke update on public.perfiles from authenticated;
grant update (nombre, nombre_publico) on public.perfiles to authenticated;

create or replace function public.perfil_publico(p_id uuid)
returns table (id uuid, nombre text, miembro_desde timestamptz, anuncios_activos integer,
               comercio_id bigint, comercio_nombre text)
language sql stable security definer set search_path = public as $$
  with p as (
    select pf.id, pf.nombre, pf.nombre_publico, pf.creado_en,
           (select count(*)::int from public.anuncios a
             where a.owner_id = pf.id and a.estado_publicacion = 'activo' and a.expira_en > now()) as activos
    from public.perfiles pf where pf.id = p_id
  )
  select p.id,
         left(coalesce(nullif(btrim(p.nombre_publico), ''), nullif(split_part(btrim(p.nombre), ' ', 1), ''), 'Vendedor'), 40),
         p.creado_en, p.activos, c.id, c.nombre
  from p
  left join lateral (
    select co.id, co.nombre from public.comercios co
     where co.owner_id = p.id and co.activo
     order by co.nivel_verificacion desc, co.id limit 1
  ) c on true
  where p.activos > 0 or c.id is not null or p.id = auth.uid();
$$;
revoke execute on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to anon, authenticated;

-- Comprobación: debe mostrar 1 fila con «perfil_publico» y la columna «nombre_publico».
select p.proname, (select column_name from information_schema.columns
                    where table_schema = 'public' and table_name = 'perfiles' and column_name = 'nombre_publico') as columna
  from pg_proc p where p.proname = 'perfil_publico';
