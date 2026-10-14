-- =====================================================================
-- MercaFree · Fase 2B · Comercios del centro de cada municipio
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo.
--
-- Qué hace: crea la tabla `comercios` (farmacias, cajeros, comida rápida,
-- panaderías, supermercados, bancos) con datos que importamos de
-- OpenStreetMap. Todos entran como verificado = false; tú los verificas
-- en persona y les agregas teléfono, horario y foto.
-- Seguridad: cualquiera LEE los comercios activos; solo moderadores/admin
-- pueden crear, editar o borrar (reutiliza public.es_moderador()).
-- =====================================================================

create table if not exists public.comercios (
  id             bigint generated always as identity primary key,
  osm_id         text unique,                       -- ej. 'node/123456': evita duplicados al reimportar
  nombre         text not null check (char_length(nombre) between 2 and 100),
  tipo           text not null check (tipo in ('farmacia','cajero','comida_rapida','panaderia','supermercado','banco')),
  municipio_id   integer not null references public.municipios(id),
  direccion      text check (direccion is null or char_length(direccion) <= 160),
  telefono       text check (telefono is null or char_length(telefono) <= 40),
  horario        text check (horario is null or char_length(horario) <= 120),
  foto_url       text check (foto_url is null or foto_url ~ '^https://'),
  lat            double precision not null check (lat between -5 and 14),
  lng            double precision not null check (lng between -80 and -66),
  verificado     boolean not null default false,    -- true = ya lo visitaste/confirmaste
  activo         boolean not null default true,     -- false = oculto en el mapa
  fuente         text not null default 'OpenStreetMap',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists comercios_municipio_idx on public.comercios (municipio_id, tipo);
create index if not exists comercios_coords_idx    on public.comercios (lat, lng);

-- Mantiene actualizado_en al editar
create or replace function public.comercios_tocar()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
revoke execute on function public.comercios_tocar() from public, anon, authenticated;

drop trigger if exists comercios_antes_update on public.comercios;
create trigger comercios_antes_update before update on public.comercios
  for each row execute function public.comercios_tocar();

-- ---------- Seguridad (RLS) ----------
alter table public.comercios enable row level security;

grant select on public.comercios to anon, authenticated;
grant insert, update, delete on public.comercios to authenticated;

drop policy if exists comercios_leer on public.comercios;
create policy comercios_leer on public.comercios for select
  using (activo);

drop policy if exists comercios_leer_moderador on public.comercios;
create policy comercios_leer_moderador on public.comercios for select to authenticated
  using (public.es_moderador());

drop policy if exists comercios_crear on public.comercios;
create policy comercios_crear on public.comercios for insert to authenticated
  with check (public.es_moderador());

drop policy if exists comercios_editar on public.comercios;
create policy comercios_editar on public.comercios for update to authenticated
  using (public.es_moderador()) with check (public.es_moderador());

drop policy if exists comercios_borrar on public.comercios;
create policy comercios_borrar on public.comercios for delete to authenticated
  using (public.es_moderador());
