-- =====================================================================
-- Merkap · Fase 2AG · Vitrina gratis de 10 productos (con cupo por tienda para planes futuros)
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 07.
--
-- Qué hace:
--  1) comercios.limite_productos (por defecto 10): cuántos productos puede tener cada tienda.
--     Solo un moderador (tú) lo cambia. Sirve para el futuro plan pago (ej. 20, 50…).
--     El dueño NO puede subirse el cupo (aunque lo intente desde la consola del navegador).
--  2) productos_limite(): el servidor bloquea el producto nº 11 con el mensaje
--     «Tu vitrina gratis permite hasta 10 productos». Esto NO es RLS: RLS decide QUIÉN
--     puede escribir; el CUÁNTOS lo controla este trigger, que corre en el servidor.
--  3) Tiendas que ya tengan más de 10 (hoy ninguna): conservan lo que tienen,
--     solo no pueden agregar más hasta bajar de su cupo.
-- =====================================================================

-- 1) Cupo por tienda
alter table public.comercios add column if not exists limite_productos smallint not null default 10;
alter table public.comercios drop constraint if exists comercios_limite_productos_check;
alter table public.comercios add constraint comercios_limite_productos_check
  check (limite_productos between 0 and 500);

-- Solo un moderador cambia el cupo
create or replace function public.comercios_limite_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  -- tú desde el panel (moderador) o desde el SQL Editor (postgres) sí puedes cambiarlo
  if pg_trigger_depth() > 1 or public.es_moderador() or current_user not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then new.limite_productos := 10;
  else new.limite_productos := old.limite_productos; end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_guardia() from public, anon, authenticated;
drop trigger if exists comercios_limite_guardia on public.comercios;
create trigger comercios_limite_guardia before insert or update on public.comercios
  for each row execute function public.comercios_limite_guardia();

-- 2) El servidor no deja pasar del cupo
create or replace function public.productos_limite()
returns trigger language plpgsql security definer set search_path = public as $$
declare tope int;
begin
  select coalesce(limite_productos, 10) into tope from public.comercios where id = new.comercio_id for update;
  if (select count(*) from public.productos_comercio where comercio_id = new.comercio_id) >= coalesce(tope, 10) then
    raise exception 'Tu vitrina gratis permite hasta % productos. Borra uno para agregar otro.', coalesce(tope, 10);
  end if;
  return new;
end $$;
revoke execute on function public.productos_limite() from public, anon, authenticated;

drop trigger if exists productos_antes_insert on public.productos_comercio;
create trigger productos_antes_insert before insert on public.productos_comercio
  for each row execute function public.productos_limite();

-- Comprobación: debe mostrar 1 fila con cupo = true, tope_10 = true y tiendas_sobre_10 = 0.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comercios'
                 and column_name = 'limite_productos' and column_default = '10') as cupo,
       (select prosrc like '%limite_productos%' from pg_proc where proname = 'productos_limite') as tope_10,
       (select count(*) from (select comercio_id from public.productos_comercio group by comercio_id having count(*) > 10) x) as tiendas_sobre_10;
