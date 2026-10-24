-- =====================================================================
-- Merkap · Fase V-2b · Favoritos de comercios (el corazón ❤️ en las tarjetas de comercios)
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 05 (favoritos de anuncios, misma idea) y la tabla comercios.
--
-- Qué hace:
--  favoritos_comercio: cada persona con cuenta guarda los comercios que le gustan.
--  Solo ella ve su lista (en «❤️ Mis favoritos»). Máximo 200 por persona.
--  Si el comercio se borra, su favorito desaparece solo.
-- =====================================================================

create table if not exists public.favoritos_comercio (
  usuario_id  uuid   not null default auth.uid() references public.perfiles(id) on delete cascade,
  comercio_id bigint not null references public.comercios(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, comercio_id)
);
create index if not exists favoritos_comercio_comercio_idx on public.favoritos_comercio (comercio_id);

-- Anti-abuso: máximo 200 comercios guardados por persona
create or replace function public.favoritos_comercio_limite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.favoritos_comercio where usuario_id = new.usuario_id) >= 200 then
    raise exception 'Límite de 200 favoritos alcanzado';
  end if;
  return new;
end $$;
revoke execute on function public.favoritos_comercio_limite() from public, anon, authenticated;
drop trigger if exists favoritos_comercio_bi on public.favoritos_comercio;
create trigger favoritos_comercio_bi before insert on public.favoritos_comercio
  for each row execute function public.favoritos_comercio_limite();

alter table public.favoritos_comercio enable row level security;
revoke all on public.favoritos_comercio from anon, authenticated;
grant select, insert, delete on public.favoritos_comercio to authenticated;

drop policy if exists favcom_leer on public.favoritos_comercio;
create policy favcom_leer on public.favoritos_comercio for select to authenticated
  using (usuario_id = (select auth.uid()));
drop policy if exists favcom_crear on public.favoritos_comercio;
create policy favcom_crear on public.favoritos_comercio for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from public.comercios c where c.id = comercio_id)   -- solo comercios que puede ver
  );
drop policy if exists favcom_borrar on public.favoritos_comercio;
create policy favcom_borrar on public.favoritos_comercio for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---------- Comprobación ----------
-- Debe mostrar: tabla = true | segura = true
select exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'favoritos_comercio') as tabla,
       (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'favoritos_comercio') as segura;
