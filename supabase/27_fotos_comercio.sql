-- =====================================================================
-- MercaFree · Fase 2AA.4 · Galería de hasta 5 fotos por comercio
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto cada comercio sigue con 1 foto).
-- Es seguro repetirlo. Requiere 02, 07 y 24 (usa la misma lista de columnas del dueño).
--
-- Qué hace:
--  1) comercios.fotos: lista de hasta 5 fotos (https). La PRIMERA es la portada.
--  2) comercios.foto_url (la portada de siempre) se mantiene sola en sintonía con fotos[1]:
--     si cambias la lista, la portada es la primera; si algo antiguo cambia solo foto_url, pasa al primer lugar.
--  3) Los comercios que ya tenían foto la conservan como primera de su galería.
--  4) El dueño puede cambiar su galería desde «Mi tienda».
-- =====================================================================

alter table public.comercios add column if not exists fotos text[] not null default '{}';

create or replace function public.fotos_comercio_validas(a text[])
returns boolean language sql immutable as $$
  select cardinality(a) <= 5 and not exists (select 1 from unnest(a) x where x !~ '^https://' or char_length(x) > 500);
$$;
alter table public.comercios drop constraint if exists comercios_fotos_check;
alter table public.comercios add constraint comercios_fotos_check check (public.fotos_comercio_validas(fotos));

-- Portada (foto_url) = primera foto
create or replace function public.comercios_fotos_portada()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.fotos) > 0 then new.foto_url := new.fotos[1];
    elsif new.foto_url is not null then new.fotos := array[new.foto_url];
    end if;
  elsif new.fotos is distinct from old.fotos then
    new.foto_url := new.fotos[1];                                   -- null si quedó vacía
  elsif new.foto_url is distinct from old.foto_url then              -- código antiguo: solo cambió la portada
    new.fotos := case when new.foto_url is null then coalesce(new.fotos[2:5], '{}')
                      else (array[new.foto_url] || array_remove(array_remove(new.fotos, old.foto_url), new.foto_url))[1:5] end;
  end if;
  return new;
end $$;
revoke execute on function public.comercios_fotos_portada() from public, anon, authenticated;
drop trigger if exists comercios_fotos_portada on public.comercios;
create trigger comercios_fotos_portada before insert or update on public.comercios
  for each row execute function public.comercios_fotos_portada();

-- La foto que ya tenían pasa a ser la primera de su galería
update public.comercios set fotos = array[foto_url] where foto_url is not null and cardinality(fotos) = 0;

-- El dueño también puede cambiar su galería (misma función de 24_modo_atencion.sql + 'fotos')
create or replace function public.comercios_limite_dueno()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['descripcion','whatsapp','telefono','horario','foto_url','fotos','recoge','domicilio','domicilio_info','actualizado_en','tipo','tipos_extra','modo_atencion'];
begin
  if tg_op <> 'UPDATE' or pg_trigger_depth() > 1 or auth.uid() is null or public.es_moderador() then
    return new;
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Solo puedes cambiar la descripción, el WhatsApp, el teléfono, el horario, las fotos, la entrega, las categorías y cómo atiendes';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_dueno() from public, anon, authenticated;

-- Comprobación: debe mostrar 1 fila con columna_fotos = true y sin_desfase = 0.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comercios' and column_name = 'fotos') as columna_fotos,
       (select count(*) from public.comercios where foto_url is distinct from fotos[1] and not (foto_url is null and cardinality(fotos) = 0)) as sin_desfase;
