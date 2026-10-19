-- =====================================================================
-- Merkap · Fase 2AN · El filtro aplica a TODOS (moderadores y administrador) + clave de seguridad
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 38 y 39.
--
-- Por qué: hasta ahora el filtro no revisaba a moderadores ni al administrador (por eso «Cocaina» se publicó
-- desde tu cuenta). Si alguien roba una sesión, podría publicar cualquier cosa.
--
-- Qué hace:
--  1) Moderadores: el filtro les aplica siempre (bloquear, cola de revisión, medicamentos y declaración de Mascotas).
--     Para quitar algo prohibido de un anuncio ajeno siguen pudiendo OCULTARLO o ELIMINARLO.
--  2) Administrador: el filtro también le aplica, salvo que lo DESBLOQUEE con su CLAVE DE SEGURIDAD
--     (distinta de la contraseña de la cuenta) por 15, 30 o 60 minutos. Se vuelve a bloquear solo.
--     5 claves equivocadas seguidas → la clave se bloquea 1 hora.
--  3) Historial: cada desbloqueo, bloqueo, cambio de clave o clave equivocada queda registrado con el dispositivo.
--  4) Aviso de sesión: el administrador ve las sesiones abiertas de su cuenta (dispositivo, IP, última actividad).
--  5) Se revisa lo ya publicado: lo prohibido que se publicó sin filtro se oculta y va a la cola.
--  (El SQL Editor de Supabase sigue sin filtro: es para emergencias.)
-- =====================================================================

create table if not exists public.seguridad_admin (
  usuario_id          uuid primary key references public.perfiles(id) on delete cascade,
  clave_hash          text not null,
  cambiada_en         timestamptz not null default now(),
  fallos              int not null default 0,
  bloqueada_hasta     timestamptz,
  desbloqueado_hasta  timestamptz
);
alter table public.seguridad_admin enable row level security;
revoke all on public.seguridad_admin from anon, authenticated;   -- nadie la lee directamente (ni siquiera el hash)
comment on table public.seguridad_admin is 'Privada a propósito: solo la usan las funciones de clave de seguridad.';

create table if not exists public.registro_seguridad (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null references public.perfiles(id) on delete cascade,
  accion       text not null check (accion in ('clave_creada', 'clave_cambiada', 'desbloquear', 'bloquear', 'clave_fallida', 'clave_bloqueada')),
  dispositivo  text check (char_length(dispositivo) <= 120),
  creado_en    timestamptz not null default now()
);
create index if not exists registro_seguridad_idx on public.registro_seguridad (usuario_id, creado_en desc);
alter table public.registro_seguridad enable row level security;
revoke all on public.registro_seguridad from anon, authenticated;
grant select on public.registro_seguridad to authenticated;
drop policy if exists registro_seguridad_leer on public.registro_seguridad;
create policy registro_seguridad_leer on public.registro_seguridad for select to authenticated
  using (usuario_id = (select auth.uid()) and (select public.es_admin()));

-- ¿El administrador tiene el filtro desbloqueado ahora?
create or replace function public.filtro_libre()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.es_admin() and exists (
    select 1 from public.seguridad_admin s where s.usuario_id = (select auth.uid()) and s.desbloqueado_hasta > now());
$$;
revoke execute on function public.filtro_libre() from public, anon;
grant execute on function public.filtro_libre() to authenticated;

create or replace function public.guardar_clave_seguridad(p_clave text, p_clave_actual text default null, p_dispositivo text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare s public.seguridad_admin;
begin
  if not public.es_admin() then raise exception 'Solo el administrador'; end if;
  if char_length(coalesce(p_clave, '')) < 6 then raise exception 'La clave debe tener al menos 6 caracteres'; end if;
  select * into s from public.seguridad_admin where usuario_id = auth.uid() for update;
  if found then
    if s.bloqueada_hasta > now() then raise exception 'Clave bloqueada por intentos fallidos hasta las %', to_char(s.bloqueada_hasta at time zone 'America/Bogota', 'HH24:MI'); end if;
    if p_clave_actual is null or crypt(p_clave_actual, s.clave_hash) <> s.clave_hash then
      raise exception 'La clave actual no es correcta';
    end if;
    update public.seguridad_admin set clave_hash = crypt(p_clave, gen_salt('bf', 10)), cambiada_en = now(), fallos = 0, desbloqueado_hasta = null
     where usuario_id = auth.uid();
    insert into public.registro_seguridad (usuario_id, accion, dispositivo) values (auth.uid(), 'clave_cambiada', left(p_dispositivo, 120));
  else
    insert into public.seguridad_admin (usuario_id, clave_hash) values (auth.uid(), crypt(p_clave, gen_salt('bf', 10)));
    insert into public.registro_seguridad (usuario_id, accion, dispositivo) values (auth.uid(), 'clave_creada', left(p_dispositivo, 120));
  end if;
end $$;
revoke execute on function public.guardar_clave_seguridad(text, text, text) from public, anon;
grant execute on function public.guardar_clave_seguridad(text, text, text) to authenticated;

create or replace function public.desbloquear_filtro(p_clave text, p_minutos int default 15, p_dispositivo text default null)
returns timestamptz language plpgsql security definer set search_path = public, extensions as $$
declare s public.seguridad_admin; v_hasta timestamptz;
begin
  if not public.es_admin() then raise exception 'Solo el administrador'; end if;
  select * into s from public.seguridad_admin where usuario_id = auth.uid() for update;
  if not found then raise exception 'Primero crea tu clave de seguridad'; end if;
  if s.bloqueada_hasta > now() then
    raise exception 'Clave bloqueada por intentos fallidos hasta las %', to_char(s.bloqueada_hasta at time zone 'America/Bogota', 'HH24:MI');
  end if;
  if crypt(coalesce(p_clave, ''), s.clave_hash) <> s.clave_hash then
    if s.fallos + 1 >= 5 then
      update public.seguridad_admin set fallos = 0, bloqueada_hasta = now() + interval '1 hour', desbloqueado_hasta = null where usuario_id = auth.uid();
      insert into public.registro_seguridad (usuario_id, accion, dispositivo) values (auth.uid(), 'clave_bloqueada', left(p_dispositivo, 120));
      return null;   -- (no se lanza error para que el registro quede guardado; la página avisa)
    end if;
    update public.seguridad_admin set fallos = fallos + 1 where usuario_id = auth.uid();
    insert into public.registro_seguridad (usuario_id, accion, dispositivo) values (auth.uid(), 'clave_fallida', left(p_dispositivo, 120));
    return null;
  end if;
  v_hasta := now() + make_interval(mins => least(greatest(coalesce(p_minutos, 15), 5), 60));
  update public.seguridad_admin set fallos = 0, desbloqueado_hasta = v_hasta where usuario_id = auth.uid();
  insert into public.registro_seguridad (usuario_id, accion, dispositivo) values (auth.uid(), 'desbloquear', left(p_dispositivo, 120));
  return v_hasta;
end $$;
revoke execute on function public.desbloquear_filtro(text, int, text) from public, anon;
grant execute on function public.desbloquear_filtro(text, int, text) to authenticated;

create or replace function public.bloquear_filtro(p_dispositivo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador'; end if;
  update public.seguridad_admin set desbloqueado_hasta = null where usuario_id = auth.uid() and desbloqueado_hasta > now();
  if found then insert into public.registro_seguridad (usuario_id, accion, dispositivo) values (auth.uid(), 'bloquear', left(p_dispositivo, 120)); end if;
end $$;
revoke execute on function public.bloquear_filtro(text) from public, anon;
grant execute on function public.bloquear_filtro(text) to authenticated;

-- Estado para la página: clave, desbloqueo, historial y sesiones abiertas de la cuenta
create or replace function public.estado_seguridad()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.seguridad_admin;
begin
  if not public.es_admin() then raise exception 'Solo el administrador'; end if;
  select * into s from public.seguridad_admin where usuario_id = auth.uid();
  return jsonb_build_object(
    'tiene_clave', s.usuario_id is not null,
    'desbloqueado_hasta', case when s.desbloqueado_hasta > now() then s.desbloqueado_hasta end,
    'bloqueada_hasta', case when s.bloqueada_hasta > now() then s.bloqueada_hasta end,
    'intentos_fallidos', coalesce(s.fallos, 0),
    'historial', (select coalesce(jsonb_agg(x order by x.creado_en desc), '[]') from (
                   select accion, dispositivo, creado_en from public.registro_seguridad
                    where usuario_id = auth.uid() order by creado_en desc limit 15) x),
    'sesiones', (select coalesce(jsonb_agg(x order by x.ultima desc), '[]') from (
                   select se.created_at as inicio, coalesce(se.refreshed_at::timestamptz, se.updated_at, se.created_at) as ultima,
                          left(coalesce(se.user_agent, ''), 200) as dispositivo, host(se.ip) as ip
                     from auth.sessions se where se.user_id = auth.uid() and (se.not_after is null or se.not_after > now())
                    order by 2 desc limit 10) x));
end $$;
revoke execute on function public.estado_seguridad() from public, anon;
grant execute on function public.estado_seguridad() to authenticated;

-- ---------- El filtro deja de saltarse a los moderadores ----------
create or replace function public.contenido_bloquear()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new); col text; txt text := ''; h record;
  v_amb text := case tg_table_name when 'anuncios' then 'anuncio' when 'productos_comercio' then 'producto'
                                   when 'comercios' then 'comercio' else 'otro' end;
begin
  -- solo el SQL Editor (sin sesión) o el administrador con el filtro desbloqueado por su clave
  if auth.uid() is null or public.filtro_libre() then return new; end if;
  foreach col in array tg_argv loop txt := txt || ' ' || coalesce(j ->> col, ''); end loop;
  select * into h from public.buscar_palabra_prohibida(txt, 'bloquear', j ->> 'categoria', v_amb);
  if h.palabra is not null then
    raise exception 'Tu publicación incluye «%», que no está permitido en Merkap%. Revisa «Artículos prohibidos». Si crees que es un error, toca «Pedir revisión».',
      h.palabra, case when h.nota is not null then ' (' || h.nota || ')' else '' end;
  end if;
  return new;
end $$;

-- La cola de revisión (medicamentos y palabras) también registra lo de moderadores
do $$
declare d text;
begin
  select pg_get_functiondef('public.salud_revisar()'::regprocedure) into d;
  if d like '%if public.es_moderador() then return null; end if;%' then
    execute replace(d, 'if public.es_moderador() then return null; end if;', 'if auth.uid() is null or public.filtro_libre() then return null; end if;');
  end if;
end $$;

create or replace function public.mascotas_declaracion()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.filtro_libre() then return new; end if;
  if new.categoria = 'mascotas' and coalesce(new.subcategoria, '') in ('perros', 'gatos', 'conejos_roedores', 'aves_ornato', 'peces', 'aves_corral', 'animales_finca', 'otros', '')
     and (tg_op = 'INSERT' or new.categoria is distinct from old.categoria or new.subcategoria is distinct from old.subcategoria)
     and coalesce(new.detalles ->> 'declara_domestico', '') <> 'true' then
    raise exception 'Para publicar un animal confirma que es doméstico o de criadero (no se permite fauna silvestre).';
  end if;
  return new;
end $$;

-- ---------- Revisar lo publicado sin filtro (ej. el anuncio de prueba «Cocaina») ----------
select public.reescanear_contenido() as revision;

-- Comprobación: debe mostrar 1 fila con clave = true, filtro_todos = true y cola_todos = true.
select exists (select 1 from pg_proc where proname = 'desbloquear_filtro') as clave,
       (select prosrc like '%filtro_libre()%' from pg_proc where proname = 'contenido_bloquear') as filtro_todos,
       (select prosrc like '%filtro_libre()%' from pg_proc where proname = 'salud_revisar') as cola_todos;
