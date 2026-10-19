-- =====================================================================
-- Merkap · Fase 2AK · Administrador ≠ moderador + revisión de seguridad
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 01 a 37.
--
-- Qué hace:
--  1) es_admin(): solo el rol «admin» (tú). es_moderador() sigue siendo «moderador o admin».
--  2) Pasan a SOLO ADMINISTRADOR (antes cualquier moderador):
--       logo, carrusel, cuadros de acceso, categorías, palabras prohibidas, entrenar el buscador,
--       Selección del día, cupo de productos, visto bueno sanitario, borrar comercios,
--       asignar dueño a un comercio, aprobar/rechazar negocios registrados, aprobar reclamos de fichas,
--       métricas, referidos y lista de espera.
--  3) El moderador PROPONE (👍 aprobar / 👎 rechazar + nota) negocios registrados y reclamos; tú decides.
--  4) Equipo: buscar_persona() y cambiar_rol() (solo admin) para nombrar o quitar moderadores.
--     El rol «admin» NUNCA se da ni se quita desde la página: solo aquí, en el SQL Editor.
--  5) Seguridad: search_path fijo en 6 funciones, topes contra spam en 7 tablas que no los tenían,
--     y notas en las 2 tablas que están cerradas a propósito.
-- =====================================================================

-- ---------- 1) ¿Es administrador? ----------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin');
$$;
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- El rol solo cambia desde el servidor (cambiar_rol) o el SQL Editor; nunca desde el navegador
create or replace function public.perfiles_rol_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.rol is distinct from old.rol and current_user in ('anon', 'authenticated') then
    raise exception 'El rol no se puede cambiar desde aquí';
  end if;
  return new;
end $$;
revoke execute on function public.perfiles_rol_guardia() from public, anon, authenticated;
drop trigger if exists perfiles_rol_guardia on public.perfiles;
create trigger perfiles_rol_guardia before update on public.perfiles
  for each row execute function public.perfiles_rol_guardia();

-- ---------- 2) Tablas que solo edita el administrador ----------
drop policy if exists logos_moderar on public.logos_pagina;
create policy logos_moderar on public.logos_pagina for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists banners_moderar on public.banners_inicio;
create policy banners_moderar on public.banners_inicio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists accesos_moderar on public.accesos_inicio;
create policy accesos_moderar on public.accesos_inicio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists categorias_moderar on public.categorias_comercio;
create policy categorias_moderar on public.categorias_comercio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists categorias_anuncio_moderar on public.categorias_anuncio;
create policy categorias_anuncio_moderar on public.categorias_anuncio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists palabras_prohibidas_moderar on public.palabras_prohibidas;
create policy palabras_prohibidas_moderar on public.palabras_prohibidas for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
-- Búsquedas: el moderador las puede ver; entrenar (marcar/borrar) es del administrador
drop policy if exists busquedas_editar_mod on public.busquedas;
create policy busquedas_editar_mod on public.busquedas for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop policy if exists busquedas_borrar_mod on public.busquedas;
create policy busquedas_borrar_mod on public.busquedas for delete to authenticated
  using ((select public.es_admin()));
-- Lista de espera (trae WhatsApp de personas): solo administrador
drop policy if exists espera_leer on public.lista_espera;
create policy espera_leer on public.lista_espera for select to authenticated
  using ((select public.es_admin()));
-- Borrar comercios: solo administrador (el moderador los puede ocultar)
drop policy if exists comercios_borrar on public.comercios;
create policy comercios_borrar on public.comercios for delete to authenticated
  using ((select public.es_admin()));
-- Reclamos de fichas: los resuelve el administrador; «actualizar» y «retirar» también el moderador
drop policy if exists solicitudes_comercio_resolver on public.solicitudes_comercio;
create policy solicitudes_comercio_resolver on public.solicitudes_comercio for update to authenticated
  using ((select public.es_admin()) or ((select public.es_moderador()) and tipo <> 'reclamar'))
  with check ((select public.es_admin()) or ((select public.es_moderador()) and tipo <> 'reclamar'));

-- Campos de un comercio que solo cambia el administrador: dueño y cupo de productos
create or replace function public.comercios_limite_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  -- tú desde el panel (administrador) o desde el SQL Editor (postgres) sí puedes cambiarlo
  if pg_trigger_depth() > 1 or public.es_admin() or current_user not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then new.limite_productos := 10;
  else new.limite_productos := old.limite_productos; end if;
  return new;
end $$;
create or replace function public.comercios_dueno_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.es_admin() or current_user not in ('anon', 'authenticated') then return new; end if;
  if public.es_moderador() and new.owner_id is distinct from old.owner_id then
    raise exception 'Solo el administrador asigna o quita el dueño de un comercio';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_dueno_guardia() from public, anon, authenticated;
drop trigger if exists comercios_dueno_guardia on public.comercios;
create trigger comercios_dueno_guardia before update of owner_id on public.comercios
  for each row execute function public.comercios_dueno_guardia();

-- Selección del día: solo administrador
create or replace function public.anuncios_seleccion_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.es_admin() or current_user not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then
    new.seleccion_hasta := null; new.seleccion_excluido := false;
  else
    new.seleccion_hasta := old.seleccion_hasta; new.seleccion_excluido := old.seleccion_excluido;
  end if;
  return new;
end $$;

-- Visto bueno sanitario: solo administrador (el moderador puede leer y dejar nota)
create or replace function public.datos_sanitarios_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.acta_fecha is not null and new.acta_fecha > current_date then
    raise exception 'La fecha del acta o concepto sanitario no puede ser futura';
  end if;
  new.nit := replace(btrim(new.nit), ' ', '');
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  if tg_op = 'UPDATE' and new.comercio_id is distinct from old.comercio_id then
    raise exception 'No se puede cambiar el comercio';
  end if;
  if public.es_admin() or current_user not in ('anon', 'authenticated') then return new; end if;
  if public.es_moderador() then
    -- el moderador puede corregir datos y dejar nota, pero el visto bueno no lo toca
    if tg_op = 'INSERT' then new.revisado_por := null; new.revisado_en := null;
    else new.revisado_por := old.revisado_por; new.revisado_en := old.revisado_en; end if;
  else
    -- el dueño no se pone el visto bueno a sí mismo; cualquier cambio suyo vuelve a «por revisar»
    new.revisado_por := null; new.revisado_en := null;
    new.nota_moderador := case when tg_op = 'UPDATE' then old.nota_moderador else null end;
  end if;
  return new;
end $$;
-- El distintivo público 🧾 solo lo mueve el servidor o el administrador
create or replace function public.comercios_sello_salud_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or public.es_admin() or current_user not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then new.salud_revisado_en := null;
  else new.salud_revisado_en := old.salud_revisado_en; end if;
  return new;
end $$;

-- Funciones del servidor que pasan a solo administrador
do $$
declare f text;
begin
  foreach f in array array['asignar_dueno_comercio', 'resolver_negocio', 'metricas_resumen', 'resumen_referidos'] loop
    -- se reemplaza la comprobación «es_moderador» por «es_admin» dentro de cada función (sin tocar lo demás)
    execute (
      select regexp_replace(pg_get_functiondef(p.oid),
               'if not public\.es_moderador\(\)\s+then\s+raise exception ''[^'']*''',
               'if not public.es_admin() then raise exception ''Solo el administrador puede hacer esto''', 'g')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f);
  end loop;
end $$;

-- ---------- 3) Propuestas del moderador ----------
alter table public.negocios_pendientes add column if not exists propuesta text check (propuesta in ('aprobar', 'rechazar'));
alter table public.negocios_pendientes add column if not exists propuesta_nota text check (char_length(propuesta_nota) <= 300);
alter table public.negocios_pendientes add column if not exists propuesta_por uuid references public.perfiles(id) on delete set null;
alter table public.negocios_pendientes add column if not exists propuesta_en timestamptz;
alter table public.solicitudes_comercio add column if not exists propuesta text check (propuesta in ('aprobar', 'rechazar'));
alter table public.solicitudes_comercio add column if not exists propuesta_nota text check (char_length(propuesta_nota) <= 300);
alter table public.solicitudes_comercio add column if not exists propuesta_por uuid references public.perfiles(id) on delete set null;
alter table public.solicitudes_comercio add column if not exists propuesta_en timestamptz;

create or replace function public.proponer_resolucion(p_tipo text, p_id bigint, p_decision text, p_nota text)
returns void language plpgsql security definer set search_path = public as $$
declare v_nota text := nullif(left(btrim(coalesce(p_nota, '')), 300), '');
begin
  if not public.es_moderador() then raise exception 'Solo moderadores'; end if;
  if p_decision not in ('aprobar', 'rechazar') then raise exception 'Decisión no válida'; end if;
  if p_decision = 'rechazar' and v_nota is null then raise exception 'Escribe por qué propones rechazar'; end if;
  if p_tipo = 'negocio' then
    update public.negocios_pendientes set propuesta = p_decision, propuesta_nota = v_nota, propuesta_por = auth.uid(), propuesta_en = now()
     where id = p_id and estado = 'pendiente';
  elsif p_tipo = 'reclamo' then
    update public.solicitudes_comercio set propuesta = p_decision, propuesta_nota = v_nota, propuesta_por = auth.uid(), propuesta_en = now()
     where id = p_id and tipo = 'reclamar' and estado = 'pendiente';
  else raise exception 'Tipo no válido'; end if;
  if not found then raise exception 'Esa solicitud ya no está pendiente'; end if;
end $$;
revoke execute on function public.proponer_resolucion(text, bigint, text, text) from public, anon;
grant execute on function public.proponer_resolucion(text, bigint, text, text) to authenticated;

-- ---------- 4) Equipo (solo administrador) ----------
create or replace function public.buscar_persona(p_texto text)
returns table (id uuid, nombre text, correo text, rol text, creado_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare t text := lower(btrim(coalesce(p_texto, '')));
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede ver el equipo'; end if;
  return query
    select p.id, coalesce(nullif(btrim(p.nombre_publico), ''), p.nombre)::text, u.email::text, p.rol, p.creado_en
      from public.perfiles p join auth.users u on u.id = p.id
     where (t = '' and p.rol in ('admin', 'moderador'))
        or (char_length(t) >= 2 and (lower(p.nombre) like '%' || t || '%' or lower(coalesce(p.nombre_publico, '')) like '%' || t || '%'
                                     or lower(u.email) like '%' || t || '%'))
     order by (p.rol = 'admin') desc, (p.rol = 'moderador') desc, p.nombre
     limit 20;
end $$;
revoke execute on function public.buscar_persona(text) from public, anon;
grant execute on function public.buscar_persona(text) to authenticated;

create or replace function public.cambiar_rol(p_usuario uuid, p_rol text)
returns void language plpgsql security definer set search_path = public as $$
declare v_actual text;
begin
  if not public.es_admin() then raise exception 'Solo el administrador nombra moderadores'; end if;
  if p_rol not in ('usuario', 'moderador') then raise exception 'Desde la página solo se puede nombrar o quitar moderadores'; end if;
  if p_usuario = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  select rol into v_actual from public.perfiles where id = p_usuario for update;
  if not found then raise exception 'Esa persona no tiene cuenta'; end if;
  if v_actual = 'admin' then raise exception 'El rol de administrador solo se cambia desde el SQL Editor'; end if;
  update public.perfiles set rol = p_rol where id = p_usuario;
end $$;
revoke execute on function public.cambiar_rol(uuid, text) from public, anon;
grant execute on function public.cambiar_rol(uuid, text) to authenticated;

-- ---------- 5) Endurecimiento ----------
-- search_path fijo (advertencia del revisor de Supabase)
alter function public.fotos_comercio_validas(text[]) set search_path = '';
alter function public.fotos_producto_validas(text[]) set search_path = '';
alter function public.es_tipo_salud(text, text[]) set search_path = '';
alter function public.palabra_medicamento(text) set search_path = '';
alter function public.validar_datos_sanitarios_json(jsonb) set search_path = '';
alter function public.normalizar_texto(text) set search_path = '';

-- Topes contra spam (cuántos por hora y por día por persona; lista de espera: total por hora)
create or replace function public.tope_por_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text := tg_argv[0];
  por_hora int := tg_argv[1]::int;
  por_dia int := tg_argv[2]::int;
  quien uuid;
  n_hora int; n_dia int;
begin
  -- (esta función corre como dueño de la base, así que se distingue a la persona por auth.uid(), no por el rol)
  if public.es_moderador() then return new; end if;
  if col = '-' then
    execute format('select count(*) filter (where creado_en > now() - interval ''1 hour''), count(*) filter (where creado_en > now() - interval ''1 day'') from public.%I', tg_table_name)
      into n_hora, n_dia;
  else
    execute format('select ($1).%I', col) using new into quien;
    execute format('select count(*) filter (where creado_en > now() - interval ''1 hour''), count(*) filter (where creado_en > now() - interval ''1 day'') from public.%I where %I = $1', tg_table_name, col)
      using quien into n_hora, n_dia;
  end if;
  if n_hora >= por_hora or n_dia >= por_dia then
    raise exception 'Hiciste muchos envíos seguidos. Espera un rato e inténtalo de nuevo';
  end if;
  return new;
end $$;
revoke execute on function public.tope_por_usuario() from public, anon, authenticated;

drop trigger if exists tope_reportes on public.reportes;
create trigger tope_reportes before insert on public.reportes for each row execute function public.tope_por_usuario('reportante_id', '10', '30');
drop trigger if exists tope_reportes_producto on public.reportes_producto;
create trigger tope_reportes_producto before insert on public.reportes_producto for each row execute function public.tope_por_usuario('reportante_id', '10', '30');
drop trigger if exists tope_solicitudes_comercio on public.solicitudes_comercio;
create trigger tope_solicitudes_comercio before insert on public.solicitudes_comercio for each row execute function public.tope_por_usuario('solicitante_id', '5', '10');
drop trigger if exists tope_solicitudes_verificacion on public.solicitudes_verificacion;
create trigger tope_solicitudes_verificacion before insert on public.solicitudes_verificacion for each row execute function public.tope_por_usuario('solicitante_id', '3', '5');
drop trigger if exists tope_temas_foro on public.temas_foro;
create trigger tope_temas_foro before insert on public.temas_foro for each row execute function public.tope_por_usuario('autor_id', '5', '15');
drop trigger if exists tope_comentarios_foro on public.comentarios_foro;
create trigger tope_comentarios_foro before insert on public.comentarios_foro for each row execute function public.tope_por_usuario('autor_id', '20', '100');
drop trigger if exists tope_lista_espera on public.lista_espera;
create trigger tope_lista_espera before insert on public.lista_espera for each row execute function public.tope_por_usuario('-', '100', '500');

-- Tablas cerradas a propósito (el revisor avisa «RLS sin reglas»: es lo que queremos)
comment on table public.contactos_anuncio is 'Privada a propósito: RLS sin reglas. Solo la usa la función contacto_anuncio() (security definer).';
comment on table public.municipios_alta is 'Privada a propósito: RLS sin reglas. Solo la usa la función crear_municipio() (security definer).';
comment on table public.metricas_eventos is 'Privada a propósito: RLS sin reglas. Solo registrar_evento() y metricas_resumen().';

-- Comprobación: debe mostrar 1 fila con es_admin_existe = true, administradores = 1, funciones_admin = 4, topes = 7 y equipo = true.
select public.es_admin() is not null as es_admin_existe,
       (select count(*) from public.perfiles where rol = 'admin') as administradores,
       (select count(*) from pg_proc where proname in ('asignar_dueno_comercio', 'resolver_negocio', 'metricas_resumen', 'resumen_referidos')
          and prosrc like '%es_admin()%') as funciones_admin,
       (select count(*) from pg_trigger where tgname like 'tope\_%') as topes,
       exists (select 1 from pg_proc where proname = 'cambiar_rol') as equipo;
