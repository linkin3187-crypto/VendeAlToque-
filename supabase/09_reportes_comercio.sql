-- =====================================================================
-- MercaFree · Fase 2G · Reportar un comercio
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo. Requiere haber ejecutado 02.
--
-- Qué hace: cualquier persona con cuenta puede reportar un comercio (cerrado, datos incorrectos,
-- ubicación equivocada, negocio falso u otro motivo), como en los anuncios. Solo los moderadores
-- ven y resuelven los reportes. Límites: 1 reporte pendiente por persona y comercio, y 10 por día.
-- =====================================================================

create table if not exists public.reportes_comercio (
  id            bigint generated always as identity primary key,
  comercio_id   bigint not null references public.comercios(id) on delete cascade,
  reportante_id uuid default auth.uid() references public.perfiles(id) on delete set null,
  motivo        text not null check (motivo in ('cerrado','datos','ubicacion','falso','otro')),
  detalle       text check (detalle is null or char_length(detalle) <= 500),
  estado        text not null default 'pendiente' check (estado in ('pendiente','revisado','descartado')),
  creado_en     timestamptz not null default now()
);

create index if not exists reportes_comercio_estado_idx on public.reportes_comercio (estado, creado_en desc);
create unique index if not exists reportes_comercio_unico_pendiente
  on public.reportes_comercio (comercio_id, reportante_id) where estado = 'pendiente';

-- Tope diario por persona (contra reportes masivos)
create or replace function public.reportes_comercio_limite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.reportante_id := coalesce(auth.uid(), new.reportante_id);
  new.estado := 'pendiente';
  if (select count(*) from public.reportes_comercio where reportante_id = new.reportante_id and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al máximo de reportes por hoy. Gracias por ayudarnos';
  end if;
  return new;
end $$;
revoke execute on function public.reportes_comercio_limite() from public, anon, authenticated;

drop trigger if exists reportes_comercio_antes_insert on public.reportes_comercio;
create trigger reportes_comercio_antes_insert before insert on public.reportes_comercio
  for each row execute function public.reportes_comercio_limite();

alter table public.reportes_comercio enable row level security;
grant select, insert, update on public.reportes_comercio to authenticated;

drop policy if exists reportes_comercio_crear on public.reportes_comercio;
create policy reportes_comercio_crear on public.reportes_comercio for insert to authenticated
  with check (reportante_id = (select auth.uid()));

drop policy if exists reportes_comercio_leer on public.reportes_comercio;
create policy reportes_comercio_leer on public.reportes_comercio for select to authenticated
  using (public.es_moderador());

drop policy if exists reportes_comercio_resolver on public.reportes_comercio;
create policy reportes_comercio_resolver on public.reportes_comercio for update to authenticated
  using (public.es_moderador()) with check (public.es_moderador());
