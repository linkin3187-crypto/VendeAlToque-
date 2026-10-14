-- =====================================================================
-- MercaFree · Fase 2C.2 · Favoritos (corazón «Guardar»)
-- Ejecutar UNA vez en Supabase → SQL Editor, ANTES de fusionar el cambio en GitHub.
-- Es seguro repetirlo.
--
-- Cada persona con sesión guarda anuncios en su lista. Solo ella ve la suya.
-- Si el anuncio se borra, su favorito desaparece solo (on delete cascade).
-- =====================================================================

create table if not exists public.favoritos (
  usuario_id uuid   not null default auth.uid() references public.perfiles(id) on delete cascade,
  anuncio_id bigint not null references public.anuncios(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (usuario_id, anuncio_id)
);

create index if not exists favoritos_anuncio_idx on public.favoritos (anuncio_id);

-- Anti-abuso: máximo 200 favoritos por persona
create or replace function public.favoritos_limite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.favoritos where usuario_id = new.usuario_id) >= 200 then
    raise exception 'Límite de 200 favoritos alcanzado';
  end if;
  return new;
end $$;

drop trigger if exists favoritos_bi on public.favoritos;
create trigger favoritos_bi before insert on public.favoritos
  for each row execute function public.favoritos_limite();

alter table public.favoritos enable row level security;

grant select, insert, delete on public.favoritos to authenticated;

drop policy if exists favoritos_leer on public.favoritos;
create policy favoritos_leer on public.favoritos for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists favoritos_crear on public.favoritos;
create policy favoritos_crear on public.favoritos for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from public.anuncios a where a.id = anuncio_id)   -- solo anuncios que puede ver
  );

drop policy if exists favoritos_borrar on public.favoritos;
create policy favoritos_borrar on public.favoritos for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- Es un trigger interno: nadie debe poder llamarlo desde la API
revoke execute on function public.favoritos_limite() from public, anon, authenticated;
