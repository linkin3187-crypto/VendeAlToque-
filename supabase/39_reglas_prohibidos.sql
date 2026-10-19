-- =====================================================================
-- Merkap · Fase 2AL · Reglas, artículos prohibidos, Mascotas, +18 y filtro reforzado
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 32 y 38.
--
-- Qué hace:
--  1) Filtro más inteligente (sin desanimar a la gente honesta):
--     · entiende trucos: números por letras (c0c4ina), letras separadas (m.a.r.i), letras repetidas
--       (cocaaaina) y combinaciones de emojis en clave (❄️💊, 🍁🔌…);
--     · reconoce plurales solo (loro → loros, munición → municiones);
--     · FRASES PERMITIDAS que tú editas: «pistola de silicona», «huevos pericos», «periquito australiano»…
--       (pueden ser para todas las categorías o solo para una);
--     · cada palabra tiene un GRUPO (drogas, armas, fauna…) y dónde APLICA: «todo» o solo «anuncios»
--       (tabaco y vapeadores: los particulares no; los comercios sí, en su vitrina).
--  2) Lista ampliada (~200 palabras y frases): bloquea solo lo inequívoco; lo dudoso se publica y va a revisión.
--  3) El filtro de «bloquear» también cuida comercios, foro, comentarios, opiniones y el nombre público.
--  4) Revisión de lo YA publicado cada vez que cambias la lista: lo que choca con «bloquear» se oculta
--     solo y va a Moderación; lo de «revisar» va a la cola.
--  5) Ocultar solo cuando 3 personas distintas reportan un anuncio o producto como prohibido o estafa.
--  6) Sanciones: aviso, suspensión de 30 días o veto (perfil bloqueado + su WhatsApp, teléfono y correo
--     no pueden volver a publicar). Solo el administrador sanciona.
--  7) «Creo que es un error: pedir revisión» (solicitudes_revision).
--  8) Mascotas: subcategorías nuevas (sin «Otros») y declaración obligatoria «doméstico o de criadero».
--     Categoría nueva «🔞 Íntimo (+18)» y tipo de comercio «Tienda íntima (+18)».
-- =====================================================================

-- ---------- 1) Normalizar para el filtro ----------
create or replace function public.normalizar_filtro(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare t text; tok text; r text := '';
begin
  t := lower(translate(coalesce(p, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
  -- números y símbolos por letras SOLO dentro de palabras que mezclan letras y números (c0c4ina, m4rihu4na, c@rtel)
  foreach tok in array regexp_split_to_array(t, '\s+') loop
    if tok ~ '[a-z]' and tok ~ '[013457@$]' then tok := translate(tok, '013457@$', 'oieastas'); end if;
    r := r || ' ' || tok;
  end loop;
  t := regexp_replace(r, '[^a-z0-9]+', ' ', 'g');
  -- letras sueltas seguidas: «m a r i h u a n a» o «m.a.r.i.h.u.a.n.a» → «marihuana» (desde 4 letras)
  t := regexp_replace(t, '(?:\m[a-z]\M ){3,}[a-z]\M', '§\&§', 'g');
  -- (se deja también la versión sin la última letra: «m.a.r.i.h.u.a.n.a a domicilio» → «marihuanaa marihuana»)
  while t ~ '§[^§]*§' loop
    t := regexp_replace(t, '§([^§]*)§', replace(substring(t from '§([^§]*)§'), ' ', '') || ' ' || left(replace(substring(t from '§([^§]*)§'), ' ', ''), -1));
  end loop;
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  -- letras repetidas 3 o más veces: «cocaaaaina» → «cocaina» (se agrega como segunda versión, así «aaa» sigue existiendo)
  if t ~ '([a-z])\1{2,}' then t := t || ' | ' || regexp_replace(t, '([a-z])\1{2,}', '\1', 'g'); end if;
  return t;
end $$;

-- ---------- 2) Columnas nuevas, frases permitidas ----------
alter table public.palabras_prohibidas add column if not exists grupo text not null default 'otros';
alter table public.palabras_prohibidas drop constraint if exists palabras_prohibidas_grupo_check;
alter table public.palabras_prohibidas add constraint palabras_prohibidas_grupo_check
  check (grupo in ('drogas', 'armas', 'fauna', 'flora', 'fraude', 'estafa', 'pirateria', 'sexual', 'tabaco', 'otros'));
alter table public.palabras_prohibidas add column if not exists aplica text not null default 'todo';
alter table public.palabras_prohibidas drop constraint if exists palabras_prohibidas_aplica_check;
alter table public.palabras_prohibidas add constraint palabras_prohibidas_aplica_check check (aplica in ('todo', 'anuncios'));

create table if not exists public.palabras_permitidas (
  id         bigint generated always as identity primary key,
  frase      text not null check (frase ~ '^[a-z0-9]+( [a-z0-9]+)*$' and char_length(frase) between 2 and 60),
  categoria  text check (categoria is null or categoria ~ '^[a-z0-9_]{2,30}$'),
  nota       text check (nota is null or char_length(nota) <= 120),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create unique index if not exists palabras_permitidas_unica on public.palabras_permitidas (frase, coalesce(categoria, ''));
create or replace function public.palabras_permitidas_antes()
returns trigger language plpgsql set search_path = public as $$
begin new.frase := public.normalizar_texto(new.frase); return new; end $$;
revoke execute on function public.palabras_permitidas_antes() from public, anon, authenticated;
drop trigger if exists palabras_permitidas_antes on public.palabras_permitidas;
create trigger palabras_permitidas_antes before insert or update on public.palabras_permitidas
  for each row execute function public.palabras_permitidas_antes();
alter table public.palabras_permitidas enable row level security;
revoke all on public.palabras_permitidas from anon, authenticated;
grant select, insert, update, delete on public.palabras_permitidas to authenticated;
drop policy if exists palabras_permitidas_leer on public.palabras_permitidas;
create policy palabras_permitidas_leer on public.palabras_permitidas for select to authenticated using ((select public.es_moderador()));
drop policy if exists palabras_permitidas_admin on public.palabras_permitidas;
create policy palabras_permitidas_admin on public.palabras_permitidas for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
-- la lista de prohibidas: el moderador puede leerla (para entender la cola); editar, solo el administrador (SQL 38)
drop policy if exists palabras_prohibidas_leer on public.palabras_prohibidas;
create policy palabras_prohibidas_leer on public.palabras_prohibidas for select to authenticated using ((select public.es_moderador()));

-- ---------- 3) El buscador del filtro ----------
drop function if exists public.buscar_palabra_prohibida(text, text);
create or replace function public.buscar_palabra_prohibida(p_texto text, p_accion text default null,
                                                           p_categoria text default null, p_ambito text default 'anuncio')
returns table (palabra text, accion text, nota text, grupo text)
language plpgsql stable security definer set search_path = public as $$
declare t text; f record; n_droga int; n_arma int;
begin
  t := ' ' || public.normalizar_filtro(p_texto) || ' ';
  -- primero se tachan las frases permitidas (las más largas primero)
  for f in select x.frase from public.palabras_permitidas x
            where x.activo and (x.categoria is null or x.categoria = p_categoria)
            order by char_length(x.frase) desc loop
    t := regexp_replace(t, '\m' || f.frase || '(s|es)?\M', ' | ', 'g');
  end loop;
  return query
    select p.palabra, p.accion, p.nota, p.grupo from public.palabras_prohibidas p
     where p.activo and (p_accion is null or p.accion = p_accion)
       and (p.aplica = 'todo' or p_ambito = 'anuncio')
       and t ~ ('\m' || p.palabra || '(s|es)?\M')
     order by (p.accion = 'bloquear') desc, char_length(p.palabra) desc
     limit 1;
  if found or coalesce(p_accion, 'revisar') <> 'revisar' then return; end if;
  -- emojis en clave: 2 o más distintos del «menú» de drogas, o un arma con explosión
  select count(*) into n_droga from unnest(array['❄', '💊', '🍁', '🍃', '🌿', '🍄', '🔌', '💉', '🧊', '🍬']) e where position(e in coalesce(p_texto, '')) > 0;
  select count(*) into n_arma from unnest(array['💣', '🧨', '💥']) e where position(e in coalesce(p_texto, '')) > 0;
  if n_droga >= 2 or (position('🔫' in coalesce(p_texto, '')) > 0 and n_arma > 0) then
    return query select 'emojis en clave'::text, 'revisar'::text, 'Combinación de emojis usada para vender droga o armas'::text, 'drogas'::text;
  end if;
end $$;
revoke execute on function public.buscar_palabra_prohibida(text, text, text, text) from public, anon, authenticated;

-- ---------- 4) «bloquear» en todos los textos públicos ----------
-- tg_argv: las columnas de texto a revisar
create or replace function public.contenido_bloquear()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new); col text; txt text := ''; h record;
  v_amb text := case tg_table_name when 'anuncios' then 'anuncio' when 'productos_comercio' then 'producto'
                                   when 'comercios' then 'comercio' else 'otro' end;
begin
  if auth.uid() is null or public.es_moderador() then return new; end if;   -- SQL Editor o moderador
  foreach col in array tg_argv loop txt := txt || ' ' || coalesce(j ->> col, ''); end loop;
  select * into h from public.buscar_palabra_prohibida(txt, 'bloquear', j ->> 'categoria', v_amb);
  if h.palabra is not null then
    raise exception 'Tu publicación incluye «%», que no está permitido en Merkap%. Revisa «Artículos prohibidos». Si crees que es un error, toca «Pedir revisión».',
      h.palabra, case when h.nota is not null then ' (' || h.nota || ')' else '' end;
  end if;
  return new;
end $$;
revoke execute on function public.contenido_bloquear() from public, anon, authenticated;
drop trigger if exists contenido_bloquear on public.anuncios;
create trigger contenido_bloquear before insert or update of nombre, descripcion, categoria on public.anuncios
  for each row execute function public.contenido_bloquear('nombre', 'descripcion');
drop trigger if exists contenido_bloquear on public.productos_comercio;
create trigger contenido_bloquear before insert or update of nombre, descripcion on public.productos_comercio
  for each row execute function public.contenido_bloquear('nombre', 'descripcion');
drop trigger if exists contenido_bloquear on public.comercios;
create trigger contenido_bloquear before insert or update of nombre, descripcion on public.comercios
  for each row execute function public.contenido_bloquear('nombre', 'descripcion');
drop trigger if exists contenido_bloquear on public.temas_foro;
create trigger contenido_bloquear before insert or update on public.temas_foro
  for each row execute function public.contenido_bloquear('titulo', 'contenido');
drop trigger if exists contenido_bloquear on public.comentarios_foro;
create trigger contenido_bloquear before insert or update on public.comentarios_foro
  for each row execute function public.contenido_bloquear('texto');
drop trigger if exists contenido_bloquear on public.calificaciones_comercio;
create trigger contenido_bloquear before insert or update of comentario on public.calificaciones_comercio
  for each row execute function public.contenido_bloquear('comentario');
drop trigger if exists contenido_bloquear on public.perfiles;
create trigger contenido_bloquear before update of nombre, nombre_publico on public.perfiles
  for each row execute function public.contenido_bloquear('nombre', 'nombre_publico');

-- La cola de «revisar» (anuncios y productos) ahora pasa la categoría
create or replace function public.salud_revisar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text := case tg_table_name when 'anuncios' then 'anuncio' else 'producto' end;
        v_txt text; v_hit text; v_com bigint; v_cat text;
begin
  if tg_op = 'DELETE' then
    delete from public.revision_salud where tipo = v_tipo and ref_id = old.id;
    return null;
  end if;
  if public.es_moderador() then return null; end if;
  v_txt := left(btrim(coalesce(new.nombre, '') || ' · ' || coalesce(new.descripcion, '')), 300);
  if tg_op = 'UPDATE' and v_txt = left(btrim(coalesce(old.nombre, '') || ' · ' || coalesce(old.descripcion, '')), 300) then
    return null;
  end if;
  if v_tipo = 'producto' then v_com := new.comercio_id; else v_cat := to_jsonb(new) ->> 'categoria'; end if;
  v_hit := public.palabra_medicamento(v_txt);
  if v_hit is null then
    delete from public.revision_salud where tipo = v_tipo and ref_id = new.id and motivo = 'salud' and estado = 'pendiente';
  else
    insert into public.revision_salud (tipo, ref_id, comercio_id, texto, coincide, motivo)
    values (v_tipo, new.id, v_com, v_txt, v_hit, 'salud')
    on conflict (tipo, ref_id, motivo) do update
      set texto = excluded.texto, coincide = excluded.coincide, estado = 'pendiente',
          creado_en = now(), resuelto_por = null, resuelto_en = null;
  end if;
  select b.palabra into v_hit from public.buscar_palabra_prohibida(v_txt, 'revisar', v_cat, v_tipo) b;
  if v_hit is null then
    delete from public.revision_salud where tipo = v_tipo and ref_id = new.id and motivo = 'palabra' and estado = 'pendiente';
  else
    insert into public.revision_salud (tipo, ref_id, comercio_id, texto, coincide, motivo)
    values (v_tipo, new.id, v_com, v_txt, v_hit, 'palabra')
    on conflict (tipo, ref_id, motivo) do update
      set texto = excluded.texto, coincide = excluded.coincide, estado = 'pendiente',
          creado_en = now(), resuelto_por = null, resuelto_en = null;
  end if;
  return null;
end $$;

-- ---------- 5) Revisar lo ya publicado cuando cambia la lista ----------
create or replace function public.reescanear_contenido()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; h record; ocultos int := 0; cola int := 0; limpios int := 0;
begin
  -- (función del servidor: se distingue a la persona por auth.uid(); sin sesión = SQL Editor o el propio servidor)
  if auth.uid() is not null and not public.es_admin() then raise exception 'Solo el administrador'; end if;
  for r in select 'anuncio' as tipo, a.id, null::bigint as com, a.categoria as cat,
                  left(btrim(coalesce(a.nombre, '') || ' · ' || coalesce(a.descripcion, '')), 300) as txt
             from public.anuncios a where a.estado_publicacion = 'activo' and a.expira_en > now()
           union all
           select 'producto', p.id, p.comercio_id, null, left(btrim(coalesce(p.nombre, '') || ' · ' || coalesce(p.descripcion, '')), 300)
             from public.productos_comercio p where not p.oculto
           limit 20000 loop
    select * into h from public.buscar_palabra_prohibida(r.txt, null, r.cat, r.tipo);
    if h.palabra is null then continue; end if;
    if h.accion = 'bloquear' then
      if r.tipo = 'anuncio' then update public.anuncios set estado_publicacion = 'oculto' where id = r.id;
      else update public.productos_comercio set oculto = true where id = r.id; end if;
      ocultos := ocultos + 1;
    end if;
    insert into public.revision_salud (tipo, ref_id, comercio_id, texto, coincide, motivo)
    values (r.tipo, r.id, r.com, r.txt, h.palabra || case when h.accion = 'bloquear' then ' (ocultado solo)' else '' end, 'palabra')
    on conflict (tipo, ref_id, motivo) do nothing;
    if found then cola := cola + 1; end if;
  end loop;
  -- lo que estaba en la cola y ya no choca con nada (por una frase permitida nueva) sale de la cola
  delete from public.revision_salud q
   where q.motivo = 'palabra' and q.estado = 'pendiente'
     and q.coincide not like '%(ocultado solo)'
     and not exists (select 1 from public.buscar_palabra_prohibida(q.texto, null,
                       (select a.categoria from public.anuncios a where q.tipo = 'anuncio' and a.id = q.ref_id), q.tipo));
  get diagnostics limpios = row_count;
  return jsonb_build_object('ocultos', ocultos, 'a_revision', cola, 'salieron_de_la_cola', limpios);
end $$;
revoke execute on function public.reescanear_contenido() from public, anon;
grant execute on function public.reescanear_contenido() to authenticated;

create or replace function public.palabras_cambiaron()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.reescanear_contenido(); return null; end $$;
revoke execute on function public.palabras_cambiaron() from public, anon, authenticated;
drop trigger if exists palabras_cambiaron on public.palabras_prohibidas;
create trigger palabras_cambiaron after insert or update or delete on public.palabras_prohibidas
  for each statement execute function public.palabras_cambiaron();
drop trigger if exists palabras_cambiaron on public.palabras_permitidas;
create trigger palabras_cambiaron after insert or update or delete on public.palabras_permitidas
  for each statement execute function public.palabras_cambiaron();

-- ---------- 6) Ocultar solo con 3 reportes de personas distintas ----------
create or replace function public.reportes_ocultar_solo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'reportes' then
    if new.motivo in ('prohibido', 'estafa') and (select count(distinct reportante_id) from public.reportes
          where anuncio_id = new.anuncio_id and motivo in ('prohibido', 'estafa') and estado = 'pendiente') >= 3 then
      update public.anuncios set estado_publicacion = 'oculto' where id = new.anuncio_id and estado_publicacion = 'activo';
    end if;
  else
    if new.motivo = 'prohibido' and (select count(distinct reportante_id) from public.reportes_producto
          where producto_id = new.producto_id and motivo = 'prohibido' and estado = 'pendiente') >= 3 then
      update public.productos_comercio set oculto = true where id = new.producto_id;
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.reportes_ocultar_solo() from public, anon, authenticated;
drop trigger if exists reportes_ocultar_solo on public.reportes;
create trigger reportes_ocultar_solo after insert on public.reportes for each row execute function public.reportes_ocultar_solo();
drop trigger if exists reportes_ocultar_solo on public.reportes_producto;
create trigger reportes_ocultar_solo after insert on public.reportes_producto for each row execute function public.reportes_ocultar_solo();

-- ---------- 7) Sanciones y vetos ----------
alter table public.perfiles add column if not exists vetado boolean not null default false;
alter table public.perfiles add column if not exists suspendido_hasta timestamptz;
alter table public.perfiles add column if not exists sancion_motivo text check (sancion_motivo is null or char_length(sancion_motivo) <= 200);

create table if not exists public.sanciones (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  tipo        text not null check (tipo in ('aviso', 'suspension', 'veto', 'levantar')),
  motivo      text not null check (char_length(btrim(motivo)) between 3 and 200),
  por         uuid references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index if not exists sanciones_usuario_idx on public.sanciones (usuario_id, creado_en desc);
alter table public.sanciones enable row level security;
revoke all on public.sanciones from anon, authenticated;
grant select on public.sanciones to authenticated;
drop policy if exists sanciones_leer on public.sanciones;
create policy sanciones_leer on public.sanciones for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_moderador()));

create table if not exists public.vetados_contacto (
  valor      text primary key check (char_length(valor) between 5 and 120),   -- solo dígitos (WhatsApp/teléfono) o correo en minúscula
  tipo       text not null check (tipo in ('telefono', 'correo')),
  motivo     text,
  usuario_id uuid,
  creado_en  timestamptz not null default now()
);
alter table public.vetados_contacto enable row level security;
revoke all on public.vetados_contacto from anon, authenticated;
grant select, delete on public.vetados_contacto to authenticated;
drop policy if exists vetados_admin on public.vetados_contacto;
create policy vetados_admin on public.vetados_contacto for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

create or replace function public.sancionar(p_usuario uuid, p_tipo text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_rol text; v_motivo text := left(btrim(coalesce(p_motivo, '')), 200);
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede sancionar'; end if;
  if p_tipo not in ('aviso', 'suspension', 'veto', 'levantar') then raise exception 'Tipo de sanción no válido'; end if;
  if char_length(v_motivo) < 3 then raise exception 'Escribe el motivo (lo verá la persona)'; end if;
  select rol into v_rol from public.perfiles where id = p_usuario;
  if not found then raise exception 'Esa persona no tiene cuenta'; end if;
  if v_rol = 'admin' or p_usuario = auth.uid() then raise exception 'No se puede sancionar al administrador'; end if;
  insert into public.sanciones (usuario_id, tipo, motivo, por) values (p_usuario, p_tipo, v_motivo, auth.uid());
  if p_tipo = 'suspension' then
    update public.perfiles set suspendido_hasta = now() + interval '30 days', sancion_motivo = v_motivo where id = p_usuario;
  elsif p_tipo = 'veto' then
    update public.perfiles set vetado = true, rol = 'usuario', sancion_motivo = v_motivo where id = p_usuario;
    update public.anuncios set estado_publicacion = 'oculto' where owner_id = p_usuario and estado_publicacion <> 'oculto';
    update public.comercios set owner_id = null where owner_id = p_usuario;
    insert into public.vetados_contacto (valor, tipo, motivo, usuario_id)
      select distinct v, 'telefono', v_motivo, p_usuario from (
        select regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') as v from public.anuncios where owner_id = p_usuario
        union select regexp_replace(coalesce(telefono, ''), '\D', '', 'g') from public.anuncios where owner_id = p_usuario) x
       where char_length(v) >= 7
    on conflict (valor) do nothing;
    insert into public.vetados_contacto (valor, tipo, motivo, usuario_id)
      select lower(email), 'correo', v_motivo, p_usuario from auth.users where id = p_usuario and email is not null
    on conflict (valor) do nothing;
  elsif p_tipo = 'levantar' then
    update public.perfiles set vetado = false, suspendido_hasta = null, sancion_motivo = null where id = p_usuario;
    delete from public.vetados_contacto where usuario_id = p_usuario;
  end if;
end $$;
revoke execute on function public.sancionar(uuid, text, text) from public, anon;
grant execute on function public.sancionar(uuid, text, text) to authenticated;

-- Nadie suspendido o vetado publica (ni con otra cuenta usando el mismo WhatsApp, teléfono o correo)
create or replace function public.cuenta_puede_publicar()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; j jsonb := to_jsonb(new); v text;
begin
  if auth.uid() is null or public.es_moderador() then return new; end if;
  select vetado, suspendido_hasta, sancion_motivo into p from public.perfiles where id = auth.uid();
  if p.vetado then raise exception 'Tu cuenta fue bloqueada por incumplir los Términos de Merkap (%). Si crees que es un error, escríbenos.', coalesce(p.sancion_motivo, 'contenido prohibido'); end if;
  if p.suspendido_hasta > now() then
    raise exception 'Tu cuenta está suspendida hasta el % (%).', to_char(p.suspendido_hasta at time zone 'America/Bogota', 'DD/MM/YYYY'), coalesce(p.sancion_motivo, 'incumplir los Términos');
  end if;
  foreach v in array array[j ->> 'whatsapp', j ->> 'telefono'] loop
    if v is not null and exists (select 1 from public.vetados_contacto where valor = regexp_replace(v, '\D', '', 'g')) then
      raise exception 'Ese número no puede publicar en Merkap (Términos, sección 5).';
    end if;
  end loop;
  if exists (select 1 from public.vetados_contacto c join auth.users u on lower(u.email) = c.valor where u.id = auth.uid()) then
    raise exception 'Esta cuenta no puede publicar en Merkap (Términos, sección 5).';
  end if;
  return new;
end $$;
revoke execute on function public.cuenta_puede_publicar() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['anuncios', 'productos_comercio', 'temas_foro', 'comentarios_foro', 'calificaciones_comercio', 'negocios_pendientes', 'solicitudes_comercio'] loop
    execute format('drop trigger if exists cuenta_puede_publicar on public.%I', t);
    execute format('create trigger cuenta_puede_publicar before insert on public.%I for each row execute function public.cuenta_puede_publicar()', t);
  end loop;
end $$;
drop trigger if exists cuenta_puede_publicar_editar on public.anuncios;
create trigger cuenta_puede_publicar_editar before update of nombre, descripcion, whatsapp, telefono, fotos on public.anuncios
  for each row execute function public.cuenta_puede_publicar();

-- El administrador ve en 👥 Equipo si alguien está sancionado
drop function if exists public.buscar_persona(text);
create or replace function public.buscar_persona(p_texto text)
returns table (id uuid, nombre text, correo text, rol text, creado_en timestamptz, vetado boolean, suspendido_hasta timestamptz, sanciones bigint)
language plpgsql stable security definer set search_path = public as $$
declare t text := lower(btrim(coalesce(p_texto, '')));
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede ver el equipo'; end if;
  return query
    select p.id, coalesce(nullif(btrim(p.nombre_publico), ''), p.nombre)::text, u.email::text, p.rol, p.creado_en,
           p.vetado, p.suspendido_hasta, (select count(*) from public.sanciones s where s.usuario_id = p.id and s.tipo <> 'levantar')
      from public.perfiles p join auth.users u on u.id = p.id
     where (t = '' and p.rol in ('admin', 'moderador'))
        or (char_length(t) >= 2 and (lower(p.nombre) like '%' || t || '%' or lower(coalesce(p.nombre_publico, '')) like '%' || t || '%'
                                     or lower(u.email) like '%' || t || '%'))
     order by (p.rol = 'admin') desc, (p.rol = 'moderador') desc, p.nombre
     limit 20;
end $$;
revoke execute on function public.buscar_persona(text) from public, anon;
grant execute on function public.buscar_persona(text) to authenticated;

-- ---------- 8) «Creo que es un error: pedir revisión» ----------
create table if not exists public.solicitudes_revision (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  texto       text not null check (char_length(texto) between 2 and 400),
  palabra     text check (char_length(palabra) <= 60),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'permitida', 'rechazada')),
  creado_en   timestamptz not null default now()
);
alter table public.solicitudes_revision enable row level security;
revoke all on public.solicitudes_revision from anon, authenticated;
grant select, insert, update on public.solicitudes_revision to authenticated;
drop policy if exists solrev_crear on public.solicitudes_revision;
create policy solrev_crear on public.solicitudes_revision for insert to authenticated
  with check (usuario_id = (select auth.uid()) and estado = 'pendiente');
drop policy if exists solrev_leer on public.solicitudes_revision;
create policy solrev_leer on public.solicitudes_revision for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_moderador()));
drop policy if exists solrev_resolver on public.solicitudes_revision;
create policy solrev_resolver on public.solicitudes_revision for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));
drop trigger if exists tope_solicitudes_revision on public.solicitudes_revision;
create trigger tope_solicitudes_revision before insert on public.solicitudes_revision
  for each row execute function public.tope_por_usuario('usuario_id', '3', '10');

-- ---------- 9) Mascotas y +18 ----------
update public.categorias_anuncio set subcategorias = '[
  {"id":"perros","nombre":"Perros"},{"id":"gatos","nombre":"Gatos"},
  {"id":"conejos_roedores","nombre":"Conejos y roedores"},{"id":"aves_ornato","nombre":"Aves de ornato"},
  {"id":"peces","nombre":"Peces y acuarios"},{"id":"aves_corral","nombre":"Aves de corral y granja"},
  {"id":"animales_finca","nombre":"Animales de finca"},{"id":"alimentos_mascotas","nombre":"Alimentos"},
  {"id":"accesorios_mascotas","nombre":"Accesorios"},{"id":"veterinaria","nombre":"Veterinaria"},
  {"id":"adopcion","nombre":"Adopción"}]'::jsonb,
  palabras = 'mascota, mascotas, perro, perros, gato, gatos, cachorro, concentrado, veterinaria, adopcion, collar, arena, conejo, hamster, curi, cobayo, periquito, canario, ninfa, agapornis, pez, peces, acuario, gallina, pollo, pato, codorniz, cerdo, cabra, oveja, ternero, caballo'
 where id = 'mascotas';
insert into public.categorias_anuncio (id, nombre, icono, palabras, subcategorias, orden, activo, foro) values
  ('adultos', 'Íntimo +18', '🔞', 'intimo, juguete intimo, lenceria, lubricante, preservativos, condones, sex shop, pareja',
   '[{"id":"juguetes_intimos","nombre":"Juguetes íntimos"},{"id":"lenceria","nombre":"Lencería"},{"id":"cuidado_intimo","nombre":"Cuidado íntimo y preservativos"},{"id":"juegos_pareja","nombre":"Juegos para parejas"}]'::jsonb,
   125, true, false)
on conflict (id) do nothing;
insert into public.categorias_comercio (id, nombre, icono, palabras, orden, activo)
  select 'intimo', 'Tienda íntima (+18)', '🔞', 'sex shop, juguetes intimos, lenceria, lubricantes, preservativos', 390, true
  where not exists (select 1 from public.categorias_comercio where id = 'intimo');

-- Mascotas: declaración obligatoria «doméstico o de criadero» al publicar un animal
create or replace function public.mascotas_declaracion()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.es_moderador() then return new; end if;
  if new.categoria = 'mascotas' and coalesce(new.subcategoria, '') in ('perros', 'gatos', 'conejos_roedores', 'aves_ornato', 'peces', 'aves_corral', 'animales_finca', 'otros', '')
     and (tg_op = 'INSERT' or new.categoria is distinct from old.categoria or new.subcategoria is distinct from old.subcategoria)
     and coalesce(new.detalles ->> 'declara_domestico', '') <> 'true' then
    raise exception 'Para publicar un animal confirma que es doméstico o de criadero (no se permite fauna silvestre).';
  end if;
  return new;
end $$;
revoke execute on function public.mascotas_declaracion() from public, anon, authenticated;
drop trigger if exists mascotas_declaracion on public.anuncios;
create trigger mascotas_declaracion before insert or update of categoria, subcategoria on public.anuncios
  for each row execute function public.mascotas_declaracion();

-- ---------- 10) Lista de palabras (bloquear = inequívoco; revisar = dudoso, se publica y va a la cola) ----------
-- Ajustes a palabras viejas que frenaban a gente honesta
update public.palabras_prohibidas set activo = false
 where palabra in ('imitacion', 'seguidores', 'base de datos', 'piramide', 'multinivel', 'fenatanilo', 'replica');
update public.palabras_prohibidas set activo = true where palabra in ('mico', 'tortuga');
update public.palabras_prohibidas set accion = 'bloquear' where palabra in ('basuco', 'bazuco');
update public.palabras_prohibidas set accion = 'revisar' where palabra in ('puta', 'putas');   -- insulto: mejor revisar que bloquear

insert into public.palabras_prohibidas (palabra, accion, grupo, aplica, nota) values
  -- DROGAS (bloquear)
  ('cocaina', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('cocain', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('marihuana', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('mariguana', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('marijuana', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('cripy', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('cripa', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('bareta', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('ganja', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('tusi', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('tusibi', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('2cb', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('cocaina rosada', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('basuco', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('bazuco', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('mdma', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('lsd', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('metanfetamina', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('fentanilo', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('ketamina', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('escopolamina', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('burundanga', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('popper', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('hongos alucinogenos', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('hongos magicos', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('cucumelo', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  ('dosis personal', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'), ('cogollos de', 'revisar', 'drogas', 'todo', 'Puede ser marihuana'),
  -- DROGAS (revisar: tienen otro significado)
  ('heroina', 'revisar', 'drogas', 'todo', 'Droga (o «heroína» de una historia)'), ('extasis', 'revisar', 'drogas', 'todo', 'Droga o emoción'),
  ('perico', 'revisar', 'drogas', 'todo', 'Droga, ave o desayuno'), ('cannabis', 'revisar', 'drogas', 'todo', 'Solo cosméticos con INVIMA'),
  ('thc', 'revisar', 'drogas', 'todo', 'Derivados del cannabis'), ('weed', 'revisar', 'drogas', 'todo', 'Marihuana'),
  ('creepy', 'revisar', 'drogas', 'todo', 'Marihuana (o «creepy» en inglés)'), ('yage', 'revisar', 'drogas', 'todo', 'Sustancia ritual'),
  ('ayahuasca', 'revisar', 'drogas', 'todo', 'Sustancia ritual'), ('bong', 'revisar', 'drogas', 'todo', 'Parafernalia'),
  ('crack', 'revisar', 'drogas', 'todo', 'Droga (o «un crack»)'), ('cristal de meta', 'bloquear', 'drogas', 'todo', 'Drogas ilícitas'),
  -- ARMAS (bloquear)
  ('arma de fuego', 'bloquear', 'armas', 'todo', 'Armas'), ('armas de fuego', 'bloquear', 'armas', 'todo', 'Armas'),
  ('arma traumatica', 'bloquear', 'armas', 'todo', 'Armas traumáticas (requieren permiso)'), ('armas traumaticas', 'bloquear', 'armas', 'todo', 'Armas traumáticas'),
  ('pistola traumatica', 'bloquear', 'armas', 'todo', 'Armas traumáticas'), ('pistola de fogueo', 'bloquear', 'armas', 'todo', 'Armas'),
  ('arma de fogueo', 'bloquear', 'armas', 'todo', 'Armas'), ('municion', 'bloquear', 'armas', 'todo', 'Armas'),
  ('cartuchos calibre', 'bloquear', 'armas', 'todo', 'Munición'), ('granada de mano', 'bloquear', 'armas', 'todo', 'Explosivos'),
  ('granada de fragmentacion', 'bloquear', 'armas', 'todo', 'Explosivos'), ('material explosivo', 'bloquear', 'armas', 'todo', 'Explosivos'),
  ('dinamita', 'bloquear', 'armas', 'todo', 'Explosivos'), ('detonador', 'bloquear', 'armas', 'todo', 'Explosivos'),
  ('subametralladora', 'bloquear', 'armas', 'todo', 'Armas'), ('chaleco antibalas', 'bloquear', 'armas', 'todo', 'Uso privativo'),
  ('silenciador para pistola', 'bloquear', 'armas', 'todo', 'Armas'), ('proveedor para pistola', 'bloquear', 'armas', 'todo', 'Armas'),
  ('9mm', 'revisar', 'armas', 'todo', 'Calibre de arma'), ('calibre 38', 'bloquear', 'armas', 'todo', 'Armas'),
  ('calibre 22', 'revisar', 'armas', 'todo', 'Calibre de arma'), ('calibre 12', 'revisar', 'armas', 'todo', 'Calibre de arma'),
  -- ARMAS (revisar)
  ('pistola', 'revisar', 'armas', 'todo', 'Arma (pistolas de herramienta o juguete están permitidas)'),
  ('revolver', 'revisar', 'armas', 'todo', 'Arma (o el verbo revolver)'), ('escopeta', 'revisar', 'armas', 'todo', 'Arma'),
  ('rifle', 'revisar', 'armas', 'todo', 'Arma'), ('fusil', 'revisar', 'armas', 'todo', 'Arma'),
  ('ametralladora', 'revisar', 'armas', 'todo', 'Arma'), ('taser', 'revisar', 'armas', 'todo', 'Arma de electrochoque'),
  ('electrochoque', 'revisar', 'armas', 'todo', 'Arma de electrochoque'), ('manopla', 'revisar', 'armas', 'todo', 'Arma (o guante de cocina)'),
  ('navaja automatica', 'revisar', 'armas', 'todo', 'Arma blanca'), ('navaja mariposa', 'revisar', 'armas', 'todo', 'Arma blanca'),
  ('polvora', 'revisar', 'armas', 'todo', 'Pólvora y pirotecnia'), ('voladores', 'revisar', 'armas', 'todo', 'Pirotecnia'),
  ('uniforme de policia', 'revisar', 'armas', 'todo', 'Uso privativo de la fuerza pública'),
  ('uniforme militar', 'revisar', 'armas', 'todo', 'Uso privativo de la fuerza pública'), ('replica de arma', 'revisar', 'armas', 'todo', 'Réplica de arma'),
  -- FAUNA y FLORA
  ('carne de monte', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'), ('huevos de tortuga', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'),
  ('huevos de iguana', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'), ('huevos de babilla', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'),
  ('huevos de caiman', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'), ('morrocoy', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'),
  ('hicotea', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'), ('charapa', 'bloquear', 'fauna', 'todo', 'Fauna silvestre'),
  ('caracol africano', 'bloquear', 'fauna', 'todo', 'Especie invasora'), ('rana dorada', 'bloquear', 'fauna', 'todo', 'Fauna protegida'),
  ('rana venenosa', 'bloquear', 'fauna', 'todo', 'Fauna protegida'), ('palma de cera', 'bloquear', 'flora', 'todo', 'Flora protegida'),
  ('loro', 'revisar', 'fauna', 'todo', 'Solo con certificado de zoocriadero'), ('lora', 'revisar', 'fauna', 'todo', 'Solo con certificado de zoocriadero'),
  ('guacamaya', 'revisar', 'fauna', 'todo', 'Solo con certificado de zoocriadero'), ('tucan', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('turpial', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('sinsonte', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('canario costeno', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('mono titi', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('mico', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('oso perezoso', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('iguana', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('babilla', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('caiman', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('tortuga', 'revisar', 'fauna', 'todo', 'Fauna silvestre o invasora'),
  ('chiguiro', 'revisar', 'fauna', 'todo', 'Solo de zoocriadero legal'), ('armadillo', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('zarigueya', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('tarantula', 'revisar', 'fauna', 'todo', 'Fauna silvestre'),
  ('serpiente', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('rana toro', 'revisar', 'fauna', 'todo', 'Especie invasora'),
  ('pez leon', 'revisar', 'fauna', 'todo', 'Especie invasora'), ('gallos de pelea', 'revisar', 'fauna', 'todo', 'Peleas de animales'),
  ('carne de venado', 'revisar', 'fauna', 'todo', 'Fauna silvestre'), ('musgo', 'revisar', 'flora', 'todo', 'Musgo del monte (el artificial sí)'),
  ('liquen', 'revisar', 'flora', 'todo', 'Flora silvestre'), ('orquidea silvestre', 'revisar', 'flora', 'todo', 'Solo de vivero'),
  ('orquideas del monte', 'revisar', 'flora', 'todo', 'Solo de vivero'), ('helecho arboreo', 'revisar', 'flora', 'todo', 'Flora protegida'),
  -- FRAUDE y ESTAFA
  ('documentos falsos', 'bloquear', 'fraude', 'todo', 'Falsificación'), ('cedula falsa', 'bloquear', 'fraude', 'todo', 'Falsificación'),
  ('pasaporte falso', 'bloquear', 'fraude', 'todo', 'Falsificación'), ('diploma falso', 'bloquear', 'fraude', 'todo', 'Falsificación'),
  ('licencia falsa', 'bloquear', 'fraude', 'todo', 'Falsificación'), ('soat falso', 'bloquear', 'fraude', 'todo', 'Falsificación'),
  ('billetes falsos', 'bloquear', 'fraude', 'todo', 'Falsificación'), ('dinero falso', 'bloquear', 'fraude', 'todo', 'Falsificación'),
  ('tarjetas clonadas', 'bloquear', 'fraude', 'todo', 'Fraude'), ('imei cambiado', 'bloquear', 'fraude', 'todo', 'Celular robado'),
  ('imei alterado', 'bloquear', 'fraude', 'todo', 'Celular robado'), ('imei clonado', 'bloquear', 'fraude', 'todo', 'Celular robado'),
  ('gota a gota', 'bloquear', 'estafa', 'todo', 'Préstamos ilegales'), ('venta de bases de datos', 'bloquear', 'fraude', 'todo', 'Datos personales'),
  ('base de datos de clientes', 'revisar', 'fraude', 'todo', 'Datos personales'), ('venta de seguidores', 'revisar', 'fraude', 'todo', 'Seguidores falsos'),
  ('esquema piramidal', 'revisar', 'estafa', 'todo', 'Captación ilegal'), ('piramide financiera', 'revisar', 'estafa', 'todo', 'Captación ilegal'),
  ('doble tu dinero', 'revisar', 'estafa', 'todo', 'Posible estafa'), ('duplica tu dinero', 'revisar', 'estafa', 'todo', 'Posible estafa'),
  -- PIRATERÍA
  ('magis tv', 'bloquear', 'pirateria', 'todo', 'Televisión pirata'), ('magistv', 'bloquear', 'pirateria', 'todo', 'Televisión pirata'),
  ('xuper tv', 'bloquear', 'pirateria', 'todo', 'Televisión pirata'), ('flujo tv', 'bloquear', 'pirateria', 'todo', 'Televisión pirata'),
  ('lista iptv', 'bloquear', 'pirateria', 'todo', 'Televisión pirata'), ('software pirata', 'bloquear', 'pirateria', 'todo', 'Piratería'),
  ('iptv', 'revisar', 'pirateria', 'todo', 'Posible televisión pirata'), ('fire stick configurado', 'revisar', 'pirateria', 'todo', 'Posible televisión pirata'),
  ('firestick configurado', 'revisar', 'pirateria', 'todo', 'Posible televisión pirata'), ('tv box configurado', 'revisar', 'pirateria', 'todo', 'Posible televisión pirata'),
  ('replica aaa', 'revisar', 'pirateria', 'todo', 'Falsificación de marca'), ('replica 1 1', 'revisar', 'pirateria', 'todo', 'Falsificación de marca'),
  -- SEXUAL
  ('prepago', 'bloquear', 'sexual', 'todo', 'Servicios sexuales'), ('servicios sexuales', 'bloquear', 'sexual', 'todo', 'Servicios sexuales'),
  ('masajes con final feliz', 'bloquear', 'sexual', 'todo', 'Servicios sexuales'), ('acompanantes', 'revisar', 'sexual', 'todo', 'Posibles servicios sexuales'),
  ('escort', 'revisar', 'sexual', 'todo', 'Servicios sexuales (o el carro Ford Escort)'), ('pornografia', 'revisar', 'sexual', 'todo', 'Contenido sexual'),
  ('webcam modelo', 'revisar', 'sexual', 'todo', 'Posible explotación'),
  -- TABACO Y VAPEADORES: los particulares no; los comercios sí, en su vitrina
  ('vape', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados pueden vender vapeadores, en su vitrina'),
  ('vapeador', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados pueden vender vapeadores, en su vitrina'),
  ('cigarrillo electronico', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados, en su vitrina'),
  ('cigarrillos', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados pueden vender tabaco, en su vitrina'),
  ('tabaco', 'revisar', 'tabaco', 'anuncios', 'Solo comercios verificados venden tabaco'),
  ('hookah', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados, en su vitrina'),
  ('narguile', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados, en su vitrina'),
  ('elf bar', 'bloquear', 'tabaco', 'anuncios', 'Solo comercios verificados, en su vitrina')
on conflict (palabra) do update set grupo = excluded.grupo, aplica = excluded.aplica, nota = coalesce(public.palabras_prohibidas.nota, excluded.nota);
-- grupos de las palabras viejas que quedan
update public.palabras_prohibidas set grupo = 'estafa' where grupo = 'otros' and palabra in ('pague primero', 'pago anticipado', 'consigne primero', 'consignacion previa', 'western union', 'dinero facil', 'inversion garantizada', 'gana dinero');
update public.palabras_prohibidas set grupo = 'fraude' where grupo = 'otros' and palabra in ('copia aaa', 'sin papeles', 'cuentas premium', 'billetes falsos');
update public.palabras_prohibidas set grupo = 'sexual' where grupo = 'otros' and palabra in ('prepagos', 'puta', 'putas');
update public.palabras_prohibidas set grupo = 'armas' where grupo = 'otros' and palabra in ('municiones');

-- Frases permitidas (tachan la palabra dudosa para que la gente honesta no vaya a revisión)
insert into public.palabras_permitidas (frase, categoria, nota) values
  ('pistola de silicona', null, 'Herramienta'), ('pistola de calor', null, 'Herramienta'), ('pistola de aire caliente', null, 'Herramienta'),
  ('pistola de pintura', null, 'Herramienta'), ('pistola para pintar', null, 'Herramienta'), ('pistola de agua', null, 'Juguete'),
  ('pistola de juguete', null, 'Juguete'), ('pistola nerf', null, 'Juguete'), ('pistola de burbujas', null, 'Juguete'),
  ('pistola de clavos', null, 'Herramienta'), ('pistola de grapas', null, 'Herramienta'), ('pistola de impacto', null, 'Herramienta'),
  ('pistola de lavado', null, 'Herramienta'), ('pistola de presion', null, 'Herramienta'), ('pistola para inflar', null, 'Herramienta'),
  ('pistola de aire', null, 'Herramienta de compresor'), ('pistola de soldar', null, 'Herramienta'), ('pistola de masajes', null, 'Salud'),
  ('pistola masajeadora', null, 'Salud'), ('pistola de temperatura', null, 'Termómetro'), ('pistola termometro', null, 'Termómetro'),
  ('pistola de gasolina', null, 'Surtidor'), ('pistola para tatuar', null, 'Tatuajes'), ('pistola de cola', null, 'Herramienta'),
  ('para revolver', null, 'Verbo'), ('revolver la mezcla', null, 'Verbo'), ('revolver bien', null, 'Verbo'), ('revolver y servir', null, 'Verbo'),
  ('huevos pericos', null, 'Desayuno'), ('huevo perico', null, 'Desayuno'), ('cafe perico', null, 'Café con leche'),
  ('perico australiano', null, 'Ave de ornato'), ('pericos australianos', null, 'Ave de ornato'), ('periquito australiano', null, 'Ave de ornato'),
  ('perico', 'comida', 'En Comida es el desayuno o el café'),
  ('loro de peluche', null, 'Juguete'), ('mico de peluche', null, 'Juguete'), ('tortuga de peluche', null, 'Juguete'),
  ('tortuga de juguete', null, 'Juguete'), ('tortugas ninja', null, 'Juguete'), ('tortuga ninja', null, 'Juguete'),
  ('tortuga de ceramica', null, 'Decoración'), ('tortuga en ceramica', null, 'Decoración'), ('iguana de peluche', null, 'Juguete'),
  ('tucan de madera', null, 'Decoración'), ('tucan en ceramica', null, 'Decoración'), ('serpiente de juguete', null, 'Juguete'),
  ('escopeta de juguete', null, 'Juguete'), ('rifle de juguete', null, 'Juguete'), ('rifle de agua', null, 'Juguete'),
  ('manopla de cocina', null, 'Cocina'), ('manoplas para horno', null, 'Cocina'), ('manopla para horno', null, 'Cocina'), ('manopla de bano', null, 'Aseo'),
  ('musgo artificial', null, 'Decoración'), ('musgo sintetico', null, 'Decoración'), ('musgo sphagnum', null, 'Jardinería'),
  ('musgo preservado', null, 'Decoración'), ('encendedor de cigarrillo', null, 'Carro'), ('toma de cigarrillo', null, 'Carro'),
  ('disfraz de policia', null, 'Disfraz'), ('disfraz militar', null, 'Disfraz'), ('ford escort', null, 'Carro'),
  ('heroina de', null, 'Historia o libro'), ('es un crack', null, 'Expresión'), ('crack de', null, 'Expresión'),
  ('castillo de polvora', null, 'Artesanía'), ('rifle de aire comprimido', null, NULL)
on conflict do nothing;
-- (el «rifle de aire comprimido» se deja en la lista solo para que no choque con «rifle de agua»; se desactiva: sí debe revisarse)
update public.palabras_permitidas set activo = false where frase = 'rifle de aire comprimido';

-- Revisión inicial de lo publicado con la lista nueva
select public.reescanear_contenido() as revision_inicial;

-- Comprobación: debe mostrar prohibidas ≥ 170, permitidas ≥ 65, sanciones = true, mascotas = 11 y adultos = true.
select (select count(*) from public.palabras_prohibidas where activo) as prohibidas,
       (select count(*) from public.palabras_permitidas where activo) as permitidas,
       exists (select 1 from pg_proc where proname = 'sancionar') as sanciones,
       (select jsonb_array_length(subcategorias) from public.categorias_anuncio where id = 'mascotas') as mascotas,
       exists (select 1 from public.categorias_anuncio where id = 'adultos') as adultos;
