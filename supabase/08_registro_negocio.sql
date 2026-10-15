-- =====================================================================
-- MercaFree · Fase 2D.6 · Registro de negocios nuevos (los que no están en el directorio)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo. Requiere haber ejecutado 06 y 07.
--
-- Qué hace:
--  1) Amplía los tipos de comercio (tienda de barrio, restaurante, belleza, ferretería, ropa, otro).
--  2) `negocios_pendientes`: solicitudes de registro. Cualquier persona con cuenta puede enviar
--     (máx. 3 pendientes y 5 por día); solo ella y los moderadores las ven. Exige foto de la fachada
--     y aceptar los términos.
--  3) `senales_negocio(id)`: criterios objetivos para el moderador (correo confirmado, antigüedad
--     de la cuenta, negocios parecidos a menos de 120 m, WhatsApp repetido…). Solo moderadores.
--  4) `resolver_negocio(id, aprobar, motivo)`: el moderador aprueba (crea el comercio en nivel 1
--     «Ubicado», con la persona como dueña) o rechaza con un motivo. El sello 2/3 se sigue dando
--     solo con una verificación registrada (06).
-- =====================================================================

-- 1) Más tipos de comercio
alter table public.comercios drop constraint if exists comercios_tipo_check;
alter table public.comercios add constraint comercios_tipo_check check (tipo in (
  'farmacia','cajero','comida_rapida','panaderia','supermercado','banco',
  'tienda','restaurante','belleza','ferreteria','ropa','otro'));

-- 2) Solicitudes de registro
create table if not exists public.negocios_pendientes (
  id               bigint generated always as identity primary key,
  solicitante_id   uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre           text not null check (char_length(btrim(nombre)) between 2 and 100),
  tipo             text not null check (tipo in (
    'farmacia','cajero','comida_rapida','panaderia','supermercado','banco',
    'tienda','restaurante','belleza','ferreteria','ropa','otro')),
  municipio_id     integer not null references public.municipios(id),
  direccion        text not null check (char_length(btrim(direccion)) between 5 and 160),
  lat              double precision not null check (lat between -5 and 14),
  lng              double precision not null check (lng between -80 and -66),
  telefono         text check (telefono is null or char_length(telefono) <= 40),
  whatsapp         text check (whatsapp is null or whatsapp ~ '^57[0-9]{10}$'),
  horario          text check (horario is null or char_length(horario) <= 120),
  descripcion      text check (descripcion is null or char_length(descripcion) <= 300),
  foto_fachada_url text not null check (foto_fachada_url ~ '^https://'),
  gps_cerca        boolean not null default false,   -- el celular estaba a menos de 150 m del pin (dato del dispositivo)
  acepta_terminos  boolean not null check (acepta_terminos),
  estado           text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  motivo_rechazo   text check (motivo_rechazo is null or char_length(motivo_rechazo) <= 300),
  comercio_id      bigint references public.comercios(id) on delete set null,
  resuelto_por     uuid references auth.users(id),
  resuelto_en      timestamptz,
  creado_en        timestamptz not null default now(),
  constraint negocio_contacto check (telefono is not null or whatsapp is not null),
  constraint negocio_rechazo_motivo check (estado <> 'rechazado' or (motivo_rechazo is not null and char_length(btrim(motivo_rechazo)) >= 5))
);

create index if not exists negocios_pend_estado_idx on public.negocios_pendientes (estado, creado_en);
create index if not exists negocios_pend_user_idx   on public.negocios_pendientes (solicitante_id, creado_en desc);

-- Límites y campos controlados por el servidor (la persona no decide el estado)
create or replace function public.negocios_pend_antes_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.solicitante_id := coalesce(auth.uid(), new.solicitante_id);
  new.estado := 'pendiente'; new.motivo_rechazo := null; new.comercio_id := null;
  new.resuelto_por := null;  new.resuelto_en := null;
  if (select count(*) from public.negocios_pendientes where solicitante_id = new.solicitante_id and estado = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 solicitudes en revisión. Espera la respuesta antes de enviar otra';
  end if;
  if (select count(*) from public.negocios_pendientes where solicitante_id = new.solicitante_id and creado_en > now() - interval '1 day') >= 5 then
    raise exception 'Llegaste al máximo de solicitudes por hoy. Intenta mañana';
  end if;
  return new;
end $$;
revoke execute on function public.negocios_pend_antes_insert() from public, anon, authenticated;

drop trigger if exists negocios_pend_antes_insert on public.negocios_pendientes;
create trigger negocios_pend_antes_insert before insert on public.negocios_pendientes
  for each row execute function public.negocios_pend_antes_insert();

alter table public.negocios_pendientes enable row level security;
grant select, insert on public.negocios_pendientes to authenticated;   -- cambios de estado solo por resolver_negocio

drop policy if exists negocios_pend_crear on public.negocios_pendientes;
create policy negocios_pend_crear on public.negocios_pendientes for insert to authenticated
  with check (solicitante_id = (select auth.uid()));

drop policy if exists negocios_pend_leer on public.negocios_pendientes;
create policy negocios_pend_leer on public.negocios_pendientes for select to authenticated
  using (solicitante_id = (select auth.uid()) or public.es_moderador());

-- 3) Criterios objetivos para decidir rápido (solo moderadores)
create or replace function public.senales_negocio(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n public.negocios_pendientes; u record; v jsonb;
begin
  if not public.es_moderador() then raise exception 'Solo moderadores'; end if;
  select * into n from public.negocios_pendientes where id = p_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  select email_confirmed_at is not null as confirmado, created_at into u from auth.users where id = n.solicitante_id;
  select coalesce(jsonb_agg(x order by x.metros), '[]'::jsonb) into v from (
    select c.id, c.nombre, c.tipo,
           round(sqrt(power((c.lat - n.lat) * 111320, 2) + power((c.lng - n.lng) * 111320 * cos(radians(n.lat)), 2)))::int as metros
    from public.comercios c
    where abs(c.lat - n.lat) < 0.0012 and abs(c.lng - n.lng) < 0.0012
  ) x where x.metros <= 120 limit 3;
  return jsonb_build_object(
    'correo_confirmado', coalesce(u.confirmado, false),
    'cuenta_dias', coalesce(extract(day from now() - u.created_at)::int, 0),
    'cerca', v,
    'whatsapp_repetido', n.whatsapp is not null and (
      exists (select 1 from public.comercios c where c.whatsapp = n.whatsapp)
      or exists (select 1 from public.negocios_pendientes o where o.whatsapp = n.whatsapp and o.id <> n.id and o.solicitante_id <> n.solicitante_id)),
    'rechazadas_previas', (select count(*) from public.negocios_pendientes o where o.solicitante_id = n.solicitante_id and o.estado = 'rechazado'),
    'aprobadas_previas',  (select count(*) from public.negocios_pendientes o where o.solicitante_id = n.solicitante_id and o.estado = 'aprobado')
  );
end $$;
revoke execute on function public.senales_negocio(bigint) from public, anon;
grant execute on function public.senales_negocio(bigint) to authenticated;

-- 4) Aprobar o rechazar (solo moderadores). Devuelve el id del comercio creado (o null si se rechaza).
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
                                  activo, fuente, owner_id, descripcion, whatsapp)
    values (btrim(n.nombre), n.tipo, n.municipio_id, btrim(n.direccion), n.telefono, n.horario, n.foto_fachada_url, n.lat, n.lng,
            true, 'Registro del dueño', n.solicitante_id, n.descripcion, n.whatsapp)
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
