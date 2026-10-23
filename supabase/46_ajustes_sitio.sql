-- =====================================================================
-- Merkap · Fase 2AO.1 · Ajustes del sitio (los cambia el administrador sin tocar código)
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 38 (es_admin).
--
-- Qué hace:
--  1) ajustes_sitio: una tabla pequeña de «clave → valor» para ajustes que tú cambias desde el panel.
--     Todos pueden leerlos (la página los necesita); solo el ADMINISTRADOR los cambia.
--  2) Primer ajuste: «rotacion_comercios» → franja 20 (rotación amplia, recomendada en el piloto).
--     Con 10 pesa más la calidad de la ficha; con 20 se turnan más tiendas el primer lugar.
-- =====================================================================

create table if not exists public.ajustes_sitio (
  clave           text primary key check (clave ~ '^[a-z][a-z0-9_]{2,40}$'),
  valor           jsonb not null default '{}'::jsonb,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id) on delete set null
);

create or replace function public.ajustes_sitio_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  -- rotación de comercios: solo 10 (normal) o 20 (amplia)
  if new.clave = 'rotacion_comercios' and coalesce((new.valor ->> 'franja')::int, 0) not in (10, 20) then
    raise exception 'La rotación solo puede ser 10 (normal) o 20 (amplia)';
  end if;
  return new;
end $$;
revoke execute on function public.ajustes_sitio_guardia() from public, anon, authenticated;
drop trigger if exists ajustes_sitio_guardia on public.ajustes_sitio;
create trigger ajustes_sitio_guardia before insert or update on public.ajustes_sitio
  for each row execute function public.ajustes_sitio_guardia();

alter table public.ajustes_sitio enable row level security;
revoke all on public.ajustes_sitio from anon, authenticated;
grant select on public.ajustes_sitio to anon, authenticated;
grant insert, update on public.ajustes_sitio to authenticated;
drop policy if exists "ajustes: todos leen" on public.ajustes_sitio;
drop policy if exists "ajustes: administrador cambia" on public.ajustes_sitio;
create policy "ajustes: todos leen" on public.ajustes_sitio for select to anon, authenticated using (true);
create policy "ajustes: administrador cambia" on public.ajustes_sitio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

insert into public.ajustes_sitio (clave, valor) values ('rotacion_comercios', '{"franja": 20}')
on conflict (clave) do nothing;

-- ---------- Comprobación ----------
-- Debe mostrar: rotacion = 20 | seguros = true
select (select (valor ->> 'franja')::int from public.ajustes_sitio where clave = 'rotacion_comercios') as rotacion,
       (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'ajustes_sitio') as seguros;
