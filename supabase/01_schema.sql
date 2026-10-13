-- =====================================================================
-- MercaFree - Fase 2A: esquema de base de datos (Supabase / PostgreSQL)
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO → Run.
-- Es seguro ejecutarlo más de una vez (usa "if not exists" / "or replace").
--
-- IDEAS CLAVE PARA APRENDER
--  * RLS (Row Level Security): reglas DENTRO de la base de datos que dicen
--    quién puede leer/escribir cada fila. La clave "anon" del navegador es
--    pública; lo que impide el abuso son estas reglas, no esconder la clave.
--  * Los "CHECK" validan los datos aunque alguien se salte tu página web.
--  * Los "triggers" son funciones que la base ejecuta sola al insertar/editar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MUNICIPIOS (lista cerrada: evita "envigado" vs "Envigado")
-- ---------------------------------------------------------------------
create table if not exists public.municipios (
  id           int generated always as identity primary key,
  departamento text not null,
  nombre       text not null,
  activo       boolean not null default true,
  lat          double precision,   -- centro aproximado, para centrar el mapa
  lng          double precision,
  unique (departamento, nombre)
);

-- Valle de Aburrá (coordenadas aproximadas del centro de cada municipio)
insert into public.municipios (departamento, nombre, lat, lng) values
  ('Antioquia', 'Medellín',   6.2442, -75.5812),
  ('Antioquia', 'Bello',      6.3373, -75.5579),
  ('Antioquia', 'Itagüí',     6.1846, -75.5991),
  ('Antioquia', 'Envigado',   6.1759, -75.5917),
  ('Antioquia', 'Sabaneta',   6.1515, -75.6165),
  ('Antioquia', 'La Estrella',6.1580, -75.6431),
  ('Antioquia', 'Caldas',     6.0911, -75.6360),
  ('Antioquia', 'Copacabana', 6.3463, -75.5086),
  ('Antioquia', 'Girardota',  6.3778, -75.4456),
  ('Antioquia', 'Barbosa',    6.4381, -75.3322)
on conflict (departamento, nombre) do nothing;

-- ---------------------------------------------------------------------
-- 2. PERFILES (uno por usuario de Supabase Auth) y ROLES
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null default 'Usuario' check (char_length(nombre) between 1 and 40),
  rol       text not null default 'usuario' check (rol in ('usuario', 'moderador', 'admin')),
  creado_en timestamptz not null default now()
);

-- Al registrarse alguien en Auth, se le crea su perfil automáticamente.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'), 40)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ¿El usuario actual es moderador o admin? (se usa en las reglas RLS)
-- security definer: lee perfiles sin quedar atrapada por las reglas de perfiles.
create or replace function public.es_moderador()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol in ('moderador', 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 3. ANUNCIOS
-- ---------------------------------------------------------------------
create table if not exists public.anuncios (
  id                 bigint generated always as identity primary key,
  owner_id           uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre             text not null check (char_length(nombre) between 3 and 80),
  descripcion        text not null check (char_length(descripcion) between 5 and 800),
  categoria          text not null check (categoria in (
                       'tienda','comida','autos','inmuebles','tecnologia','servicios',
                       'ferreteria','hogar','mascotas','empleos','ropa','otros')),
  estado             text not null default 'usado' check (estado in ('nuevo', 'usado')),
  precio             bigint check (precio is null or precio >= 0),   -- pesos COP, sin decimales
  municipio_id       int not null references public.municipios(id),
  barrio             text not null check (char_length(barrio) between 2 and 60),
  lat                double precision not null check (lat between -5 and 14),     -- dentro de Colombia
  lng                double precision not null check (lng between -80 and -66),
  whatsapp           text not null check (whatsapp ~ '^573[0-9]{9}$'),           -- 57 + celular de 10 dígitos
  fotos              text[] not null default '{}' check (cardinality(fotos) <= 3),
  estado_publicacion text not null default 'activo' check (estado_publicacion in ('activo', 'vendido', 'oculto')),
  creado_en          timestamptz not null default now(),
  expira_en          timestamptz not null default (now() + interval '30 days')
);

create index if not exists anuncios_publicos_idx on public.anuncios (estado_publicacion, expira_en desc);
create index if not exists anuncios_categoria_idx on public.anuncios (categoria);
create index if not exists anuncios_municipio_idx on public.anuncios (municipio_id);
create index if not exists anuncios_coords_idx   on public.anuncios (lat, lng);   -- búsqueda por zona del mapa
create index if not exists anuncios_owner_idx    on public.anuncios (owner_id);

-- Reglas que NO se pueden dejar al navegador (el usuario podría saltárselas):
--  - al crear: siempre 30 días de vigencia, siempre "activo", máximo 10 activos por persona
--  - al editar: no cambiar de dueño, no alargar la vigencia más de 30 días desde hoy,
--    y un anuncio ocultado por un moderador no puede reactivarse solo.
-- (Moderadores y el SQL Editor, donde auth.uid() es nulo, quedan exentos.)
create or replace function public.anuncios_antes_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare activos int;
begin
  if auth.uid() is not null then
    new.owner_id := auth.uid();
  end if;
  if auth.uid() is not null and not public.es_moderador() then
    new.expira_en := now() + interval '30 days';
    new.estado_publicacion := 'activo';
    select count(*) into activos from public.anuncios
      where owner_id = new.owner_id and estado_publicacion = 'activo' and expira_en > now();
    if activos >= 10 then
      raise exception 'Límite de 10 anuncios activos alcanzado';
    end if;
  end if;
  return new;
end $$;

create or replace function public.anuncios_antes_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.es_moderador() then
    new.owner_id  := old.owner_id;
    new.creado_en := old.creado_en;
    new.expira_en := least(greatest(new.expira_en, old.expira_en), now() + interval '30 days');
    if old.estado_publicacion = 'oculto' then
      new.estado_publicacion := 'oculto';
    elsif new.estado_publicacion = 'oculto' then
      new.estado_publicacion := old.estado_publicacion;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists anuncios_bi on public.anuncios;
create trigger anuncios_bi before insert on public.anuncios
  for each row execute function public.anuncios_antes_insert();

drop trigger if exists anuncios_bu on public.anuncios;
create trigger anuncios_bu before update on public.anuncios
  for each row execute function public.anuncios_antes_update();

-- ---------------------------------------------------------------------
-- 4. REPORTES (botón "Reportar anuncio")
-- ---------------------------------------------------------------------
create table if not exists public.reportes (
  id            bigint generated always as identity primary key,
  anuncio_id    bigint not null references public.anuncios(id) on delete cascade,
  reportante_id uuid default auth.uid() references public.perfiles(id) on delete set null,
  motivo        text not null check (motivo in ('estafa', 'prohibido', 'duplicado', 'vendido', 'otro')),
  detalle       text check (detalle is null or char_length(detalle) <= 300),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'revisado', 'descartado')),
  creado_en     timestamptz not null default now(),
  unique (anuncio_id, reportante_id)   -- una persona no puede reportar 100 veces lo mismo
);

-- ---------------------------------------------------------------------
-- 5. FORO
--    Para publicar hay que iniciar sesión (anti-spam), pero se puede
--    mostrar "Anónimo": guardamos autor_id para moderar y autor_nombre para mostrar.
-- ---------------------------------------------------------------------
create table if not exists public.temas_foro (
  id           bigint generated always as identity primary key,
  autor_id     uuid default auth.uid() references public.perfiles(id) on delete set null,
  autor_nombre text not null default 'Anónimo' check (char_length(autor_nombre) between 1 and 40),
  titulo       text not null check (char_length(titulo) between 5 and 120),
  contenido    text not null check (char_length(contenido) between 1 and 800),
  categoria    text not null check (categoria in ('autos','inmuebles','tecnologia','servicios','hogar','otros')),
  creado_en    timestamptz not null default now()
);

create table if not exists public.comentarios_foro (
  id           bigint generated always as identity primary key,
  tema_id      bigint not null references public.temas_foro(id) on delete cascade,
  autor_id     uuid default auth.uid() references public.perfiles(id) on delete set null,
  autor_nombre text not null default 'Anónimo' check (char_length(autor_nombre) between 1 and 40),
  texto        text not null check (char_length(texto) between 1 and 600),
  creado_en    timestamptz not null default now()
);
create index if not exists comentarios_tema_idx on public.comentarios_foro (tema_id, creado_en);

-- ---------------------------------------------------------------------
-- 6. LISTA DE ESPERA ("Aún no llegamos a tu ciudad")
-- ---------------------------------------------------------------------
create table if not exists public.lista_espera (
  id        bigint generated always as identity primary key,
  ciudad    text not null check (char_length(ciudad) between 2 and 60),
  whatsapp  text check (whatsapp is null or whatsapp ~ '^573[0-9]{9}$'),
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. PERMISOS (grants) + RLS
--    Dos capas: GRANT = qué operaciones existen para cada rol;
--    RLS = qué FILAS puede tocar. Ambas deben permitirlo.
-- ---------------------------------------------------------------------
alter table public.municipios       enable row level security;
alter table public.perfiles         enable row level security;
alter table public.anuncios         enable row level security;
alter table public.reportes         enable row level security;
alter table public.temas_foro       enable row level security;
alter table public.comentarios_foro enable row level security;
alter table public.lista_espera     enable row level security;

grant usage on schema public to anon, authenticated;

grant select on public.municipios to anon, authenticated;
grant select on public.anuncios, public.temas_foro, public.comentarios_foro to anon, authenticated;
grant insert, update, delete on public.anuncios to authenticated;
grant insert, delete on public.temas_foro, public.comentarios_foro to authenticated;
grant select, update on public.reportes to authenticated;
grant insert on public.reportes to authenticated;
grant select on public.perfiles to authenticated;
-- Un usuario solo puede cambiar su NOMBRE; jamás su rol:
revoke update on public.perfiles from authenticated;
grant update (nombre) on public.perfiles to authenticated;
grant insert on public.lista_espera to anon, authenticated;
grant select on public.lista_espera to authenticated;

-- municipios: lectura pública (se administran desde el SQL Editor)
drop policy if exists municipios_leer on public.municipios;
create policy municipios_leer on public.municipios for select using (activo);

-- perfiles: cada quien ve y edita el suyo; moderadores ven todos
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or public.es_moderador());
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- anuncios
drop policy if exists anuncios_leer_publicos on public.anuncios;
create policy anuncios_leer_publicos on public.anuncios for select
  using (estado_publicacion = 'activo' and expira_en > now());
drop policy if exists anuncios_leer_propios on public.anuncios;
create policy anuncios_leer_propios on public.anuncios for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists anuncios_leer_moderador on public.anuncios;
create policy anuncios_leer_moderador on public.anuncios for select to authenticated
  using (public.es_moderador());
drop policy if exists anuncios_crear on public.anuncios;
create policy anuncios_crear on public.anuncios for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists anuncios_editar on public.anuncios;
create policy anuncios_editar on public.anuncios for update to authenticated
  using (owner_id = (select auth.uid()) or public.es_moderador())
  with check (owner_id = (select auth.uid()) or public.es_moderador());
drop policy if exists anuncios_borrar on public.anuncios;
create policy anuncios_borrar on public.anuncios for delete to authenticated
  using (owner_id = (select auth.uid()) or public.es_moderador());

-- reportes: cualquiera con sesión reporta; solo moderadores leen y resuelven
drop policy if exists reportes_crear on public.reportes;
create policy reportes_crear on public.reportes for insert to authenticated
  with check (reportante_id = (select auth.uid()));
drop policy if exists reportes_leer on public.reportes;
create policy reportes_leer on public.reportes for select to authenticated
  using (public.es_moderador());
drop policy if exists reportes_resolver on public.reportes;
create policy reportes_resolver on public.reportes for update to authenticated
  using (public.es_moderador()) with check (public.es_moderador());

-- foro
drop policy if exists temas_leer on public.temas_foro;
create policy temas_leer on public.temas_foro for select using (true);
drop policy if exists temas_crear on public.temas_foro;
create policy temas_crear on public.temas_foro for insert to authenticated
  with check (autor_id = (select auth.uid()));
drop policy if exists temas_borrar on public.temas_foro;
create policy temas_borrar on public.temas_foro for delete to authenticated
  using (autor_id = (select auth.uid()) or public.es_moderador());

drop policy if exists comentarios_leer on public.comentarios_foro;
create policy comentarios_leer on public.comentarios_foro for select using (true);
drop policy if exists comentarios_crear on public.comentarios_foro;
create policy comentarios_crear on public.comentarios_foro for insert to authenticated
  with check (autor_id = (select auth.uid()));
drop policy if exists comentarios_borrar on public.comentarios_foro;
create policy comentarios_borrar on public.comentarios_foro for delete to authenticated
  using (autor_id = (select auth.uid()) or public.es_moderador());

-- lista de espera: cualquiera se apunta; solo con sesión se puede leer (y RLS limita a moderadores)
drop policy if exists espera_crear on public.lista_espera;
create policy espera_crear on public.lista_espera for insert to anon, authenticated
  with check (true);
drop policy if exists espera_leer on public.lista_espera;
create policy espera_leer on public.lista_espera for select to authenticated
  using (public.es_moderador());

-- ---------------------------------------------------------------------
-- 8. FOTOS (Supabase Storage): bucket público, 1 MB máx., solo imágenes.
--    Cada usuario solo sube/borra dentro de SU carpeta: <su-uuid>/archivo.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anuncios', 'anuncios', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fotos_lectura_publica on storage.objects;
create policy fotos_lectura_publica on storage.objects for select
  using (bucket_id = 'anuncios');
drop policy if exists fotos_subir_propias on storage.objects;
create policy fotos_subir_propias on storage.objects for insert to authenticated
  with check (bucket_id = 'anuncios' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists fotos_borrar_propias on storage.objects;
create policy fotos_borrar_propias on storage.objects for delete to authenticated
  using (bucket_id = 'anuncios' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 9. ASCENDERTE A ADMIN (ejecuta esto DESPUÉS de registrarte en la web
--    con tu correo; cambia TU_CORREO por el que usaste).
-- ---------------------------------------------------------------------
-- update public.perfiles set rol = 'admin'
--  where id = (select id from auth.users where email = 'TU_CORREO');
