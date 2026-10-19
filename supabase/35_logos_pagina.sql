-- =====================================================================
-- Merkap · Fase 2AF · Logo de la página editable (oficial + logos de temporada)
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto se ve el logo oficial). Es repetible.
--
-- Qué hace:
--  · logos_pagina: los logos que puedes poner en el encabezado (Oficial, Navidad, Halloween…).
--      - oficial:     el de siempre (no se puede borrar). Se usa cuando no hay otro vigente.
--      - usar_ahora:  si está marcado, se usa ya mismo (solo uno a la vez).
--      - desde/hasta: fechas de temporada; al pasar «hasta» vuelve solo el oficial.
--      - recortar:    recorta la imagen en cuadro redondeado (para imágenes con fondo blanco).
--      - animar:      hace el saludo del logo al abrir (apágalo si la imagen ya trae su propio movimiento).
--  · Todos pueden LEERLOS (los necesita la página); solo los moderadores los crean, cambian o borran.
-- =====================================================================

create table if not exists public.logos_pagina (
  id          bigint generated always as identity primary key,
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 40),
  imagen_url  text not null check (imagen_url ~ '^(https://|img/)' and char_length(imagen_url) <= 500),
  oficial     boolean not null default false,
  usar_ahora  boolean not null default false,
  desde       date,
  hasta       date,
  recortar    boolean not null default true,
  animar      boolean not null default true,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint logos_fechas check (desde is null or hasta is null or hasta >= desde)
);
create unique index if not exists logos_un_oficial on public.logos_pagina (oficial) where oficial;
create unique index if not exists logos_un_ahora on public.logos_pagina (usar_ahora) where usar_ahora;

-- Al marcar «usar ahora» en uno, se desmarca en los demás; el oficial no se borra ni se desactiva
create or replace function public.logos_pagina_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.oficial then raise exception 'El logo oficial no se puede borrar (puedes cambiar su imagen)'; end if;
    return old;
  end if;
  if new.oficial then new.activo := true; new.desde := null; new.hasta := null; end if;
  if new.usar_ahora and (tg_op = 'INSERT' or not old.usar_ahora) then
    update public.logos_pagina set usar_ahora = false where usar_ahora and id is distinct from new.id;
  end if;
  return new;
end $$;
revoke execute on function public.logos_pagina_antes() from public, anon, authenticated;
drop trigger if exists logos_pagina_antes on public.logos_pagina;
create trigger logos_pagina_antes before insert or update or delete on public.logos_pagina
  for each row execute function public.logos_pagina_antes();

alter table public.logos_pagina enable row level security;
revoke all on public.logos_pagina from anon, authenticated;
grant select on public.logos_pagina to anon, authenticated;
grant insert, update, delete on public.logos_pagina to authenticated;
drop policy if exists logos_leer on public.logos_pagina;
create policy logos_leer on public.logos_pagina for select using (true);
drop policy if exists logos_moderar on public.logos_pagina;
create policy logos_moderar on public.logos_pagina for all to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));
-- (la política «for all» también cubre select para moderadores; la de arriba deja leer a todos)

-- El oficial de arranque: la imagen que viene con la página
insert into public.logos_pagina (nombre, imagen_url, oficial, recortar, animar)
select 'Oficial', 'img/logo-merkap.png', true, false, true
 where not exists (select 1 from public.logos_pagina where oficial);

-- Comprobación: debe mostrar 1 fila con logos >= 1 y oficial = true.
select (select count(*) from public.logos_pagina) as logos,
       exists (select 1 from public.logos_pagina where oficial) as oficial;
