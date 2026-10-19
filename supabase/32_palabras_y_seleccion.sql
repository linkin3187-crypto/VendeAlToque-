-- =====================================================================
-- Merkap · Fase 2AC · Palabras prohibidas, Selección del día y opción B del sello sanitario
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 07, 13b, 29 y 31.
--
-- Qué hace:
--  1) OPCIÓN B: la vitrina de una droguería o naturista vuelve a necesitar solo lo que cualquier
--     comercio (estar verificado). El visto bueno sanitario sigue encendiendo el distintivo 🧾 y será
--     requisito para vender medicamentos de venta libre (2AB.3). Los datos sanitarios siguen siendo
--     obligatorios para cargar productos (SQL 29).
--  2) palabras_prohibidas: lista que editas en Moderación. Cada palabra o frase tiene una acción:
--       · «revisar»  → el anuncio o producto se publica, pero cae en la cola «🚫 Palabras prohibidas».
--       · «bloquear» → no deja publicar y le explica a la persona por qué.
--     Ignora mayúsculas, tildes y signos. Solo los moderadores ven la lista (así nadie aprende a esquivarla).
--  3) revision_salud gana la columna «motivo» ('salud' o 'palabra') para usar la misma cola.
--  4) anuncios.seleccion_hasta: un moderador elige anuncios para «⭐ Selección del día» (24 h por defecto).
--     Solo los moderadores pueden cambiarla.
-- =====================================================================

-- 1) Opción B: vitrina pública = comercio activo y verificado (como en el SQL 07)
drop policy if exists productos_leer_publico on public.productos_comercio;
create policy productos_leer_publico on public.productos_comercio for select
  using (not oculto and exists (
    select 1 from public.comercios c where c.id = comercio_id and c.activo and c.nivel_verificacion >= 2));

-- 2) Palabras prohibidas
create or replace function public.normalizar_texto(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', ' ', 'g'));
$$;

create table if not exists public.palabras_prohibidas (
  id         bigint generated always as identity primary key,
  palabra    text not null unique check (palabra ~ '^[a-z0-9]+( [a-z0-9]+)*$' and char_length(palabra) between 2 and 40),
  accion     text not null default 'revisar' check (accion in ('revisar', 'bloquear')),
  nota       text check (nota is null or char_length(nota) <= 120),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create or replace function public.palabras_prohibidas_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.palabra := public.normalizar_texto(new.palabra);
  return new;
end $$;
revoke execute on function public.palabras_prohibidas_antes() from public, anon, authenticated;
drop trigger if exists palabras_prohibidas_antes on public.palabras_prohibidas;
create trigger palabras_prohibidas_antes before insert or update on public.palabras_prohibidas
  for each row execute function public.palabras_prohibidas_antes();

alter table public.palabras_prohibidas enable row level security;
revoke all on public.palabras_prohibidas from anon, authenticated;
grant select, insert, update, delete on public.palabras_prohibidas to authenticated;
drop policy if exists palabras_prohibidas_moderar on public.palabras_prohibidas;
create policy palabras_prohibidas_moderar on public.palabras_prohibidas for all to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

-- Lista inicial (puedes cambiarla toda desde Moderación). No se repiten si ya existen.
insert into public.palabras_prohibidas (palabra, accion, nota) values
  ('cocaina', 'bloquear', 'Drogas ilícitas'), ('tusi', 'bloquear', 'Drogas ilícitas'), ('marihuana', 'bloquear', 'Drogas ilícitas'),
  ('cripy', 'bloquear', 'Drogas ilícitas'), ('municion', 'bloquear', 'Armas'), ('municiones', 'bloquear', 'Armas'),
  ('armas de fuego', 'bloquear', 'Armas'), ('prepago', 'bloquear', 'Servicios sexuales'), ('prepagos', 'bloquear', 'Servicios sexuales'),
  ('documentos falsos', 'bloquear', 'Falsificación'), ('billetes falsos', 'bloquear', 'Falsificación'),
  ('licencia falsa', 'bloquear', 'Falsificación'), ('soat falso', 'bloquear', 'Falsificación'),
  ('pague primero', 'revisar', 'Posible estafa'), ('pago anticipado', 'revisar', 'Posible estafa'),
  ('consigne primero', 'revisar', 'Posible estafa'), ('consignacion previa', 'revisar', 'Posible estafa'),
  ('western union', 'revisar', 'Posible estafa'), ('dinero facil', 'revisar', 'Posible estafa'),
  ('inversion garantizada', 'revisar', 'Posible estafa'), ('multinivel', 'revisar', 'Posible estafa'),
  ('piramide', 'revisar', 'Posible estafa'), ('gana dinero', 'revisar', 'Posible estafa'),
  ('pistola', 'revisar', 'Armas (ojo: pistola de silicona o de calor sí se permite)'), ('revolver', 'revisar', 'Armas'),
  ('escopeta', 'revisar', 'Armas'), ('perico', 'revisar', 'Puede ser droga (o un ave / bebida)'),
  ('replica', 'revisar', 'Posible falsificación'), ('imitacion', 'revisar', 'Posible falsificación'),
  ('copia aaa', 'revisar', 'Posible falsificación'), ('sin papeles', 'revisar', 'Vehículo u objeto de origen dudoso'),
  ('base de datos', 'revisar', 'Venta de datos personales'), ('cuentas premium', 'revisar', 'Cuentas ajenas'),
  ('seguidores', 'revisar', 'Venta de seguidores'), ('guacamaya', 'revisar', 'Fauna silvestre'),
  ('tortuga', 'revisar', 'Fauna silvestre'), ('mico', 'revisar', 'Fauna silvestre')
on conflict (palabra) do nothing;

-- La primera palabra activa que aparece en el texto (las de «bloquear» primero)
create or replace function public.buscar_palabra_prohibida(p_texto text, p_accion text default null)
returns table (palabra text, accion text) language sql stable security definer set search_path = public as $$
  select p.palabra, p.accion from public.palabras_prohibidas p
   where p.activo and (p_accion is null or p.accion = p_accion)
     and (' ' || public.normalizar_texto(p_texto) || ' ') like ('% ' || p.palabra || ' %')
   order by (p.accion = 'bloquear') desc, char_length(p.palabra) desc
   limit 1;
$$;
revoke execute on function public.buscar_palabra_prohibida(text, text) from public, anon, authenticated;

-- «bloquear»: no deja guardar (solo a quien no es moderador)
create or replace function public.contenido_bloquear()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_hit text;
begin
  if public.es_moderador() then return new; end if;
  select b.palabra into v_hit from public.buscar_palabra_prohibida(coalesce(new.nombre, '') || ' ' || coalesce(new.descripcion, ''), 'bloquear') b;
  if v_hit is not null then
    raise exception 'Tu publicación incluye «%», que no está permitido en Merkap (Términos, sección 4). Si crees que es un error, escríbenos.', v_hit;
  end if;
  return new;
end $$;
revoke execute on function public.contenido_bloquear() from public, anon, authenticated;
drop trigger if exists contenido_bloquear on public.anuncios;
create trigger contenido_bloquear before insert or update of nombre, descripcion on public.anuncios
  for each row execute function public.contenido_bloquear();
drop trigger if exists contenido_bloquear on public.productos_comercio;
create trigger contenido_bloquear before insert or update of nombre, descripcion on public.productos_comercio
  for each row execute function public.contenido_bloquear();

-- 3) Cola compartida: motivo 'salud' (medicamentos) o 'palabra' (palabras prohibidas)
alter table public.revision_salud add column if not exists motivo text not null default 'salud';
alter table public.revision_salud drop constraint if exists revision_salud_motivo_check;
alter table public.revision_salud add constraint revision_salud_motivo_check check (motivo in ('salud', 'palabra'));
alter table public.revision_salud drop constraint if exists revision_salud_tipo_ref_id_key;
create unique index if not exists revision_salud_unica on public.revision_salud (tipo, ref_id, motivo);

-- Medicamentos (igual que el SQL 29, ahora con motivo)
create or replace function public.salud_revisar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text := case tg_table_name when 'anuncios' then 'anuncio' else 'producto' end;
        v_txt text; v_hit text; v_com bigint;
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
  if v_tipo = 'producto' then v_com := new.comercio_id; end if;
  -- medicamentos
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
  -- palabras prohibidas («revisar»)
  select b.palabra into v_hit from public.buscar_palabra_prohibida(v_txt, 'revisar') b;
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
revoke execute on function public.salud_revisar() from public, anon, authenticated;

-- Lo ya publicado también se revisa una vez con la lista nueva
insert into public.revision_salud (tipo, ref_id, comercio_id, texto, coincide, motivo)
select 'producto', p.id, p.comercio_id, t.txt, b.palabra, 'palabra'
  from public.productos_comercio p
  cross join lateral (select left(btrim(coalesce(p.nombre, '') || ' · ' || coalesce(p.descripcion, '')), 300) as txt) t
  cross join lateral public.buscar_palabra_prohibida(t.txt, 'revisar') b
on conflict (tipo, ref_id, motivo) do nothing;
insert into public.revision_salud (tipo, ref_id, texto, coincide, motivo)
select 'anuncio', a.id, t.txt, b.palabra, 'palabra'
  from public.anuncios a
  cross join lateral (select left(btrim(coalesce(a.nombre, '') || ' · ' || coalesce(a.descripcion, '')), 300) as txt) t
  cross join lateral public.buscar_palabra_prohibida(t.txt, 'revisar') b
 where a.estado_publicacion = 'activo'
on conflict (tipo, ref_id, motivo) do nothing;

-- 4) Selección del día (la eligen los moderadores)
alter table public.anuncios add column if not exists seleccion_hasta timestamptz;
grant select (seleccion_hasta) on public.anuncios to anon, authenticated;
create index if not exists anuncios_seleccion_idx on public.anuncios (seleccion_hasta) where seleccion_hasta is not null;

create or replace function public.anuncios_seleccion_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.es_moderador() then return new; end if;
  if tg_op = 'INSERT' then new.seleccion_hasta := null;
  else new.seleccion_hasta := old.seleccion_hasta; end if;
  return new;
end $$;
revoke execute on function public.anuncios_seleccion_guardia() from public, anon, authenticated;
drop trigger if exists anuncios_seleccion_guardia on public.anuncios;
create trigger anuncios_seleccion_guardia before insert or update on public.anuncios
  for each row execute function public.anuncios_seleccion_guardia();

-- Comprobación: debe mostrar 1 fila con palabras >= 37, cola_con_motivo = true, seleccion = true y vitrina_opcion_b = true.
select (select count(*) from public.palabras_prohibidas) as palabras,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'revision_salud' and column_name = 'motivo') as cola_con_motivo,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'anuncios' and column_name = 'seleccion_hasta') as seleccion,
       not exists (select 1 from pg_policies where tablename = 'productos_comercio' and policyname = 'productos_leer_publico'
                     and qual like '%salud_revisado_en%') as vitrina_opcion_b;
