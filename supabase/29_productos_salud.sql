-- =====================================================================
-- MercaFree · Fase 2AB.1 · Droguerías y productos de salud (norma instalada, sin vender medicamentos)
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar). Es seguro repetirlo.
-- Requiere 07 (vitrina), 08 (registro de negocios), 15 (categorías), 19 (categorías de anuncios) y 20 (accesos).
--
-- Qué hace:
--  1) datos_sanitarios: datos PRIVADOS de droguerías, farmacias-droguerías y tiendas naturistas
--     (razón social, NIT, director técnico o regente, declaración de autorización de la Secretaría de Salud,
--     acta o concepto sanitario). Solo los ven y cambian el DUEÑO del comercio y los MODERADORES.
--     Si el dueño cambia algo, la marca «revisado por MercaFree» se borra sola.
--  2) negocios_pendientes.datos_sanitarios: el formulario «Registrar mi negocio» los envía cuando el tipo es
--     Farmacia/Droguería o Naturista (obligatorio). Al aprobar la solicitud pasan solos a datos_sanitarios.
--  3) Una droguería o naturista no puede agregar productos a su vitrina hasta llenar sus datos sanitarios.
--  4) revision_salud: cola para moderadores. Si un anuncio o un producto menciona algo que parece un
--     medicamento (acetaminofén, antibiótico, 500 mg, «sin fórmula»…), queda en «💊 Posibles medicamentos».
--     No se oculta solo: decides tú (permitir u ocultar).
--  5) Anuncios → Tiendas: «Droguería y salud» pasa a «Cuidado personal y aseo».
--     Belleza y salud: «Salud y bienestar» pasa a «Bienestar (sin medicamentos)».
--     Cuadro del inicio «Farmacias» → «Droguerías».
--  La prohibición de medicamentos sigue igual (Términos 4B). Esto NO habilita su venta.
-- =====================================================================

-- ¿Es un comercio de salud? (tipo principal o «también soy…»)
create or replace function public.es_tipo_salud(p_tipo text, p_extra text[] default null)
returns boolean language sql immutable as $$
  select p_tipo in ('farmacia', 'naturista') or coalesce(p_extra && array['farmacia', 'naturista'], false);
$$;

-- Palabra que hace pensar en un medicamento (o null). Ignora tildes y mayúsculas.
create or replace function public.palabra_medicamento(p_texto text)
returns text language sql immutable as $$
  select (regexp_match(
    lower(translate(coalesce(p_texto, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
    '(\mmedicamentos?\M|\macetaminofen\M|\mparacetamol\M|\mibuprofeno\M|\mnaproxeno\M|\mdiclofenaco\M|\maspirina\M'
    '|\mamoxicilina\M|\mampicilina\M|\mazitromicina\M|\mciprofloxacina\M|\mcefalexina\M|\mantibioticos?\M'
    '|\mlosartan\M|\menalapril\M|\mmetformina\M|\minsulinas?\M|\momeprazol\M|\mesomeprazol\M|\mloratadina\M|\mcetirizina\M'
    '|\mdexametasona\M|\mprednisolona\M|\mbetametasona\M|\mclonazepam\M|\malprazolam\M|\mdiazepam\M|\mtramadol\M'
    '|\mcodeina\M|\mmorfina\M|\msildenafil\M|\mviagra\M|\mmisoprostol\M|\mcytotec\M|\manticonceptiv[a-z]*'
    '|\mdolex\M|\madvil\M|\mnoxpirin\M|\mapronax\M|\mbuscapina\M|\msin formula\M|\msin receta\M|\mformula medica\M'
    '|\mampollas?\M|\minyectables?\M|\mjarabes?\M|\mtabletas?\M|\mcapsulas?\M|\mpastillas?\M|\mgrageas?\M'
    '|\m[0-9]+ ?mg\M)'))[1];
$$;

-- 1) Datos sanitarios (privados)
create table if not exists public.datos_sanitarios (
  comercio_id          bigint primary key references public.comercios(id) on delete cascade,
  tipo_establecimiento text not null check (tipo_establecimiento in ('drogueria', 'farmacia_drogueria', 'naturista')),
  razon_social         text not null check (char_length(btrim(razon_social)) between 2 and 150),
  nit                  text not null check (nit ~ '^[0-9]{5,12}(-[0-9])?$'),
  director_tecnico     text not null check (char_length(btrim(director_tecnico)) between 3 and 120),
  declara_autorizacion boolean not null check (declara_autorizacion),
  acta_numero          text check (acta_numero is null or char_length(acta_numero) <= 60),
  acta_fecha           date check (acta_fecha is null or acta_fecha >= date '1990-01-01'),
  nota_moderador       text check (nota_moderador is null or char_length(nota_moderador) <= 300),
  revisado_por         uuid references auth.users(id),
  revisado_en          timestamptz,
  actualizado_por      uuid references auth.users(id),
  actualizado_en       timestamptz not null default now()
);

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
  if not public.es_moderador() then
    -- el dueño no se pone el visto bueno a sí mismo; cualquier cambio suyo vuelve a «por revisar»
    new.revisado_por := null; new.revisado_en := null;
    new.nota_moderador := case when tg_op = 'UPDATE' then old.nota_moderador else null end;
  end if;
  return new;
end $$;
revoke execute on function public.datos_sanitarios_antes() from public, anon, authenticated;
drop trigger if exists datos_sanitarios_antes on public.datos_sanitarios;
create trigger datos_sanitarios_antes before insert or update on public.datos_sanitarios
  for each row execute function public.datos_sanitarios_antes();

alter table public.datos_sanitarios enable row level security;
revoke all on public.datos_sanitarios from anon, authenticated;
grant select, insert, update, delete on public.datos_sanitarios to authenticated;

drop policy if exists datos_sanitarios_leer on public.datos_sanitarios;
create policy datos_sanitarios_leer on public.datos_sanitarios for select to authenticated
  using ((select public.es_moderador()) or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));
drop policy if exists datos_sanitarios_crear on public.datos_sanitarios;
create policy datos_sanitarios_crear on public.datos_sanitarios for insert to authenticated
  with check ((select public.es_moderador()) or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));
drop policy if exists datos_sanitarios_cambiar on public.datos_sanitarios;
create policy datos_sanitarios_cambiar on public.datos_sanitarios for update to authenticated
  using ((select public.es_moderador()) or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())))
  with check ((select public.es_moderador()) or exists (
    select 1 from public.comercios c where c.id = comercio_id and c.owner_id = (select auth.uid())));
drop policy if exists datos_sanitarios_borrar on public.datos_sanitarios;
create policy datos_sanitarios_borrar on public.datos_sanitarios for delete to authenticated
  using ((select public.es_moderador()));

-- 2) En la solicitud de registro (la tabla ya es privada: solo el solicitante y los moderadores)
alter table public.negocios_pendientes add column if not exists datos_sanitarios jsonb;
alter table public.negocios_pendientes drop constraint if exists negocios_pend_datos_sanitarios_check;
alter table public.negocios_pendientes add constraint negocios_pend_datos_sanitarios_check check (
  datos_sanitarios is null or (jsonb_typeof(datos_sanitarios) = 'object' and pg_column_size(datos_sanitarios) <= 2048));

create or replace function public.negocios_pend_salud()
returns trigger language plpgsql set search_path = public as $$
declare d jsonb := new.datos_sanitarios;
begin
  if not public.es_tipo_salud(new.tipo) then new.datos_sanitarios := null; return new; end if;
  if d is null then
    raise exception 'Para droguerías, farmacias y tiendas naturistas faltan los datos sanitarios. Recarga la página (Ctrl+F5) y vuelve a intentarlo';
  end if;
  if coalesce(d->>'tipo_establecimiento', '') not in ('drogueria', 'farmacia_drogueria', 'naturista') then raise exception 'Elige el tipo de establecimiento'; end if;
  if char_length(btrim(coalesce(d->>'razon_social', ''))) < 2 then raise exception 'Escribe la razón social'; end if;
  if coalesce(d->>'nit', '') !~ '^[0-9]{5,12}(-[0-9])?$' then raise exception 'El NIT debe tener solo números (ej. 900123456-7)'; end if;
  if char_length(btrim(coalesce(d->>'director_tecnico', ''))) < 3 then raise exception 'Escribe el nombre del director técnico o regente'; end if;
  if coalesce(d->>'declara_autorizacion', '') <> 'true' then raise exception 'Debes declarar que cuentas con autorización de la Secretaría de Salud'; end if;
  return new;
end $$;
revoke execute on function public.negocios_pend_salud() from public, anon, authenticated;
drop trigger if exists negocios_pend_salud on public.negocios_pendientes;
create trigger negocios_pend_salud before insert on public.negocios_pendientes
  for each row execute function public.negocios_pend_salud();

-- Al aprobar, los datos pasan al comercio nuevo
create or replace function public.negocios_pend_copiar_salud()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.datos_sanitarios;
begin
  if new.estado = 'aprobado' and old.estado is distinct from 'aprobado' and new.comercio_id is not null and d is not null then
    insert into public.datos_sanitarios (comercio_id, tipo_establecimiento, razon_social, nit, director_tecnico,
                                         declara_autorizacion, acta_numero, acta_fecha)
    values (new.comercio_id, d->>'tipo_establecimiento', btrim(d->>'razon_social'), d->>'nit', btrim(d->>'director_tecnico'),
            true, nullif(btrim(coalesce(d->>'acta_numero', '')), ''),
            case when coalesce(d->>'acta_fecha', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d->>'acta_fecha')::date <= current_date
                 then (d->>'acta_fecha')::date end)
    on conflict (comercio_id) do nothing;
  end if;
  return null;
end $$;
revoke execute on function public.negocios_pend_copiar_salud() from public, anon, authenticated;
drop trigger if exists negocios_pend_copiar_salud on public.negocios_pendientes;
create trigger negocios_pend_copiar_salud after update on public.negocios_pendientes
  for each row execute function public.negocios_pend_copiar_salud();

-- 3) Vitrina de droguerías: primero los datos sanitarios
create or replace function public.productos_salud_requisito()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_moderador() then return new; end if;
  if exists (select 1 from public.comercios c where c.id = new.comercio_id and public.es_tipo_salud(c.tipo, c.tipos_extra))
     and not exists (select 1 from public.datos_sanitarios d where d.comercio_id = new.comercio_id) then
    raise exception 'Antes de agregar productos, completa los «Datos sanitarios» de tu negocio en Mi tienda';
  end if;
  return new;
end $$;
revoke execute on function public.productos_salud_requisito() from public, anon, authenticated;
drop trigger if exists productos_salud_requisito on public.productos_comercio;
create trigger productos_salud_requisito before insert on public.productos_comercio
  for each row execute function public.productos_salud_requisito();

-- 4) Cola «💊 Posibles medicamentos» (solo moderadores)
create table if not exists public.revision_salud (
  id           bigint generated always as identity primary key,
  tipo         text not null check (tipo in ('anuncio', 'producto')),
  ref_id       bigint not null,
  comercio_id  bigint references public.comercios(id) on delete cascade,
  texto        text not null,
  coincide     text not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'permitido', 'ocultado')),
  creado_en    timestamptz not null default now(),
  resuelto_por uuid references auth.users(id),
  resuelto_en  timestamptz,
  unique (tipo, ref_id)
);
create index if not exists revision_salud_estado_idx on public.revision_salud (estado, creado_en);
create index if not exists revision_salud_comercio_idx on public.revision_salud (comercio_id);

create or replace function public.salud_revisar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text := case tg_table_name when 'anuncios' then 'anuncio' else 'producto' end;
        v_txt text; v_hit text; v_com bigint;
begin
  if tg_op = 'DELETE' then
    delete from public.revision_salud where tipo = v_tipo and ref_id = old.id;
    return null;
  end if;
  if public.es_moderador() then return null; end if;   -- lo que escribe un moderador no entra a la cola
  v_txt := left(btrim(coalesce(new.nombre, '') || ' · ' || coalesce(new.descripcion, '')), 300);
  if tg_op = 'UPDATE' and v_txt = left(btrim(coalesce(old.nombre, '') || ' · ' || coalesce(old.descripcion, '')), 300) then
    return null;                                        -- el texto no cambió: se respeta lo que ya decidió el moderador
  end if;
  v_hit := public.palabra_medicamento(v_txt);
  if v_hit is null then
    delete from public.revision_salud where tipo = v_tipo and ref_id = new.id and estado = 'pendiente';
    return null;
  end if;
  if v_tipo = 'producto' then v_com := new.comercio_id; end if;
  insert into public.revision_salud (tipo, ref_id, comercio_id, texto, coincide)
  values (v_tipo, new.id, v_com, v_txt, v_hit)
  on conflict (tipo, ref_id) do update
    set texto = excluded.texto, coincide = excluded.coincide, estado = 'pendiente',
        creado_en = now(), resuelto_por = null, resuelto_en = null;
  return null;
end $$;
revoke execute on function public.salud_revisar() from public, anon, authenticated;

drop trigger if exists salud_revisar on public.productos_comercio;
create trigger salud_revisar after insert or update of nombre, descripcion or delete on public.productos_comercio
  for each row execute function public.salud_revisar();
drop trigger if exists salud_revisar on public.anuncios;
create trigger salud_revisar after insert or update of nombre, descripcion or delete on public.anuncios
  for each row execute function public.salud_revisar();

create or replace function public.revision_salud_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.estado <> old.estado and new.estado <> 'pendiente' then
    new.resuelto_por := auth.uid(); new.resuelto_en := now();
  end if;
  return new;
end $$;
revoke execute on function public.revision_salud_antes() from public, anon, authenticated;
drop trigger if exists revision_salud_antes on public.revision_salud;
create trigger revision_salud_antes before update on public.revision_salud
  for each row execute function public.revision_salud_antes();

alter table public.revision_salud enable row level security;
revoke all on public.revision_salud from anon, authenticated;
grant select, update on public.revision_salud to authenticated;
drop policy if exists revision_salud_leer on public.revision_salud;
create policy revision_salud_leer on public.revision_salud for select to authenticated
  using ((select public.es_moderador()));
drop policy if exists revision_salud_resolver on public.revision_salud;
create policy revision_salud_resolver on public.revision_salud for update to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

-- Lo que ya está publicado también se revisa una vez
insert into public.revision_salud (tipo, ref_id, comercio_id, texto, coincide)
select 'producto', p.id, p.comercio_id, t.txt, public.palabra_medicamento(t.txt)
  from public.productos_comercio p
  cross join lateral (select left(btrim(coalesce(p.nombre, '') || ' · ' || coalesce(p.descripcion, '')), 300) as txt) t
 where public.palabra_medicamento(t.txt) is not null
on conflict (tipo, ref_id) do nothing;
insert into public.revision_salud (tipo, ref_id, texto, coincide)
select 'anuncio', a.id, t.txt, public.palabra_medicamento(t.txt)
  from public.anuncios a
  cross join lateral (select left(btrim(coalesce(a.nombre, '') || ' · ' || coalesce(a.descripcion, '')), 300) as txt) t
 where a.estado_publicacion = 'activo' and public.palabra_medicamento(t.txt) is not null
on conflict (tipo, ref_id) do nothing;

-- 5) Nombres que ya no invitan a ofrecer medicamentos (los id se conservan)
update public.categorias_anuncio
   set subcategorias = (select jsonb_agg(case when e->>'id' = 'drogueria'
                                              then jsonb_set(e, '{nombre}', '"Cuidado personal y aseo"') else e end order by n)
                          from jsonb_array_elements(subcategorias) with ordinality x(e, n))
 where id = 'tienda' and subcategorias @> '[{"id":"drogueria"}]';
update public.categorias_anuncio
   set subcategorias = (select jsonb_agg(case when e->>'id' = 'salud'
                                              then jsonb_set(e, '{nombre}', '"Bienestar (sin medicamentos)"') else e end order by n)
                          from jsonb_array_elements(subcategorias) with ordinality x(e, n))
 where id = 'belleza_salud' and subcategorias @> '[{"id":"salud"}]';
update public.accesos_inicio set titulo = 'Droguerías'
 where titulo = 'Farmacias' and destino = 'comercios.html?tipo=farmacia';

-- Comprobación: debe mostrar 1 fila con tabla_privada = true, cola = true, en_registro = true y subcat_renombrada = true.
select to_regclass('public.datos_sanitarios') is not null as tabla_privada,
       to_regclass('public.revision_salud') is not null as cola,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'negocios_pendientes' and column_name = 'datos_sanitarios') as en_registro,
       not exists (select 1 from public.categorias_anuncio where id = 'tienda' and subcategorias::text like '%Droguería y salud%') as subcat_renombrada;
