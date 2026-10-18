-- =====================================================================
-- MercaFree · Fase 2AA.5 · Hasta 3 fotos por producto de la vitrina
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto cada producto sigue con 1 foto).
-- Es seguro repetirlo. Requiere 07 (vitrina) y 27 (usa la misma función de portada).
--
-- Qué hace:
--  · productos_comercio.fotos: hasta 3 fotos (https). La primera es la principal (foto_url se mantiene sola).
--  · Los productos que ya tenían foto la conservan como la primera.
--  · Permisos: los mismos de siempre (el dueño gestiona sus productos; solo un moderador oculta).
-- =====================================================================

alter table public.productos_comercio add column if not exists fotos text[] not null default '{}';

create or replace function public.fotos_producto_validas(a text[])
returns boolean language sql immutable as $$
  select cardinality(a) <= 3 and not exists (select 1 from unnest(a) x where x !~ '^https://' or char_length(x) > 500);
$$;
alter table public.productos_comercio drop constraint if exists productos_fotos_check;
alter table public.productos_comercio add constraint productos_fotos_check check (public.fotos_producto_validas(fotos));

-- Misma regla que los comercios: foto_url = primera foto (función de 27_fotos_comercio.sql)
drop trigger if exists productos_fotos_portada on public.productos_comercio;
create trigger productos_fotos_portada before insert or update on public.productos_comercio
  for each row execute function public.comercios_fotos_portada();

update public.productos_comercio set fotos = array[foto_url] where foto_url is not null and cardinality(fotos) = 0;

-- Comprobación: debe mostrar 1 fila con columna_fotos = true y sin_desfase = 0.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'productos_comercio' and column_name = 'fotos') as columna_fotos,
       (select count(*) from public.productos_comercio where foto_url is distinct from fotos[1] and not (foto_url is null and cardinality(fotos) = 0)) as sin_desfase;
