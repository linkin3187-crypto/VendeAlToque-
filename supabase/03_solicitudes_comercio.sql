-- =====================================================================
-- MercaFree · Fase 2B · Solicitudes de los comercios (actualizar / retirar / reclamar)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo.
--
-- Qué hace: crea la tabla `solicitudes_comercio`. Una persona con sesión puede
-- pedir que se actualicen los datos de un comercio, que se retire, o reclamar la
-- ficha como dueño. Solo los moderadores/admin ven y resuelven las solicitudes.
-- =====================================================================

create table if not exists public.solicitudes_comercio (
  id              bigint generated always as identity primary key,
  comercio_id     bigint not null references public.comercios(id) on delete cascade,
  solicitante_id  uuid default auth.uid() references public.perfiles(id) on delete set null,
  tipo            text not null check (tipo in ('actualizar', 'retirar', 'reclamar')),
  nombre_contacto text not null check (char_length(nombre_contacto) between 2 and 80),
  contacto        text not null check (char_length(contacto) between 5 and 80),   -- WhatsApp o correo
  mensaje         text check (mensaje is null or char_length(mensaje) <= 500),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'atendida', 'descartada')),
  creado_en       timestamptz not null default now()
);

create index if not exists solicitudes_comercio_estado_idx on public.solicitudes_comercio (estado, creado_en desc);
-- Anti-spam: una sola solicitud PENDIENTE por persona y comercio
create unique index if not exists solicitudes_comercio_unica_pendiente
  on public.solicitudes_comercio (comercio_id, solicitante_id) where estado = 'pendiente';

alter table public.solicitudes_comercio enable row level security;

grant insert on public.solicitudes_comercio to authenticated;
grant select, update on public.solicitudes_comercio to authenticated;

drop policy if exists solicitudes_comercio_crear on public.solicitudes_comercio;
create policy solicitudes_comercio_crear on public.solicitudes_comercio for insert to authenticated
  with check (solicitante_id = (select auth.uid()));

drop policy if exists solicitudes_comercio_leer on public.solicitudes_comercio;
create policy solicitudes_comercio_leer on public.solicitudes_comercio for select to authenticated
  using (public.es_moderador());

drop policy if exists solicitudes_comercio_resolver on public.solicitudes_comercio;
create policy solicitudes_comercio_resolver on public.solicitudes_comercio for update to authenticated
  using (public.es_moderador()) with check (public.es_moderador());
