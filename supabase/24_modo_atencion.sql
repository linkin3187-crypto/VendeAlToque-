-- =====================================================================
-- MercaFree · Fase 2Z.8 · ¿Cómo atiende el comercio? (local · desde casa · solo domicilios)
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto todo sigue como hoy).
-- Es seguro repetirlo. Requiere 07 (vitrina), 08 (registro de negocios) y 15 (categorías).
--
-- Qué hace:
--  1) comercios.modo_atencion y negocios_pendientes.modo_atencion: 'local' (por defecto), 'casa' o 'domicilio'.
--  2) PRIVACIDAD (lo hace el servidor, no se puede saltar desde el navegador):
--     si el comercio atiende «desde casa» o «solo domicilios», el punto PÚBLICO del mapa se corre
--     al azar entre 150 y 350 m (zona aproximada) y la dirección pública queda vacía.
--     Pasa al crearlo, al cambiar a uno de esos modos y cada vez que alguien mueve el pin.
--     La dirección exacta sigue solo en la solicitud (negocios_pendientes), que ven los moderadores.
--  3) El dueño puede cambiar su forma de atender desde «Mi tienda».
--  4) Al aprobar una solicitud, el comercio hereda su forma de atender.
-- =====================================================================

-- 1) Columnas
alter table public.comercios add column if not exists modo_atencion text not null default 'local';
alter table public.comercios drop constraint if exists comercios_modo_atencion_check;
alter table public.comercios add constraint comercios_modo_atencion_check check (modo_atencion in ('local', 'casa', 'domicilio'));

alter table public.negocios_pendientes add column if not exists modo_atencion text not null default 'local';
alter table public.negocios_pendientes drop constraint if exists negocios_pendientes_modo_atencion_check;
alter table public.negocios_pendientes add constraint negocios_pendientes_modo_atencion_check check (modo_atencion in ('local', 'casa', 'domicilio'));

-- 2) Privacidad: zona aproximada y sin dirección pública para «casa» y «domicilio»
--    (el nombre empieza por «zz» para que corra DESPUÉS de los demás triggers, incluido el límite del dueño)
create or replace function public.comercios_privacidad_casa()
returns trigger language plpgsql set search_path = public as $$
declare d double precision; ang double precision;
begin
  if new.modo_atencion = 'local' then return new; end if;
  new.direccion := null;
  if tg_op = 'INSERT' or old.modo_atencion = 'local'
     or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    d := 150 + random() * 200;                 -- metros
    ang := random() * 2 * pi();
    new.lat := new.lat + (d * cos(ang)) / 111320.0;
    new.lng := new.lng + (d * sin(ang)) / (111320.0 * cos(radians(new.lat)));
  end if;
  return new;
end $$;
revoke execute on function public.comercios_privacidad_casa() from public, anon, authenticated;

drop trigger if exists comercios_zz_privacidad_casa on public.comercios;
create trigger comercios_zz_privacidad_casa before insert or update on public.comercios
  for each row execute function public.comercios_privacidad_casa();

-- 3) El dueño también puede cambiar cómo atiende (misma función de 15_categorias_comercio.sql + 'modo_atencion')
create or replace function public.comercios_limite_dueno()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['descripcion','whatsapp','telefono','horario','foto_url','recoge','domicilio','domicilio_info','actualizado_en','tipo','tipos_extra','modo_atencion'];
begin
  -- pg_trigger_depth() > 1: cambios hechos por otros triggers (p. ej. el contador de productos)
  if tg_op <> 'UPDATE' or pg_trigger_depth() > 1 or auth.uid() is null or public.es_moderador() then
    return new;
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Solo puedes cambiar la descripción, el WhatsApp, el teléfono, el horario, la foto, la entrega, las categorías y cómo atiendes';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_dueno() from public, anon, authenticated;

-- 4) Aprobar una solicitud copia también la forma de atender (misma función de 08_registro_negocio.sql)
create or replace function public.resolver_negocio(p_id bigint, p_aprobar boolean, p_motivo text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare n public.negocios_pendientes; v_com bigint;
begin
  if not public.es_moderador() then raise exception 'Solo moderadores'; end if;
  select * into n from public.negocios_pendientes where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if n.estado <> 'pendiente' then raise exception 'Esta solicitud ya fue resuelta'; end if;
  if p_aprobar then
    insert into public.comercios (nombre, tipo, municipio_id, direccion, telefono, horario, foto_url, lat, lng,
                                  activo, fuente, owner_id, descripcion, whatsapp, modo_atencion)
    values (btrim(n.nombre), n.tipo, n.municipio_id, btrim(n.direccion), n.telefono, n.horario, n.foto_fachada_url, n.lat, n.lng,
            true, 'Registro del dueño', n.solicitante_id, n.descripcion, n.whatsapp, n.modo_atencion)
    returning id into v_com;
    update public.negocios_pendientes
       set estado = 'aprobado', comercio_id = v_com, resuelto_por = auth.uid(), resuelto_en = now()
     where id = p_id;
    return v_com;
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 5 then
    raise exception 'Escribe el motivo del rechazo (mínimo 5 letras)';
  end if;
  update public.negocios_pendientes
     set estado = 'rechazado', motivo_rechazo = btrim(p_motivo), resuelto_por = auth.uid(), resuelto_en = now()
   where id = p_id;
  return null;
end $$;
revoke execute on function public.resolver_negocio(bigint, boolean, text) from public, anon;
grant execute on function public.resolver_negocio(bigint, boolean, text) to authenticated;

-- Comprobación: debe mostrar 1 fila con modo_en_comercios = true, modo_en_solicitudes = true y privacidad = true.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comercios' and column_name = 'modo_atencion') as modo_en_comercios,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'negocios_pendientes' and column_name = 'modo_atencion') as modo_en_solicitudes,
       exists (select 1 from pg_trigger where tgname = 'comercios_zz_privacidad_casa') as privacidad;
