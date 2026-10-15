-- =====================================================================
-- MercaFree · Fase 2K · Subcategorías de anuncios + expansión automática de municipios
-- Es seguro repetirlo (todo usa "if not exists" / "create or replace").
--
--  1) anuncios.subcategoria: texto corto con el id de la subcategoría (ej. 'carros').
--     La lista de subcategorías vive en data.js (SUBCATEGORIAS); aquí solo se valida el formato.
--  2) crear_municipio(): cualquier persona con cuenta puede publicar en un municipio que aún no
--     está en la lista (ej. San Pedro de los Milagros). La función lo crea ACTIVO de inmediato,
--     sin duplicados (ignora tildes y mayúsculas) y con límite de 3 municipios nuevos por persona al día.
--     Un moderador puede desactivar uno falso:  update public.municipios set activo = false where id = ...;
-- =====================================================================

-- 1) Subcategoría ------------------------------------------------------
alter table public.anuncios
  add column if not exists subcategoria text;

alter table public.anuncios drop constraint if exists anuncios_subcategoria_formato;
alter table public.anuncios
  add constraint anuncios_subcategoria_formato
  check (subcategoria is null or subcategoria ~ '^[a-z0-9_]{2,30}$');

create index if not exists anuncios_subcategoria_idx on public.anuncios (categoria, subcategoria);

-- 2) Municipios nuevos -------------------------------------------------
-- Quién creó cada municipio (tabla privada: no se le da ningún permiso a anon/authenticated).
create table if not exists public.municipios_alta (
  municipio_id int primary key references public.municipios(id) on delete cascade,
  usuario_id   uuid,
  creado_en    timestamptz not null default now()
);
alter table public.municipios_alta enable row level security;

create or replace function public.crear_municipio(
  p_departamento text, p_nombre text, p_lat double precision, p_lng double precision)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_nombre text;
  v_norm   text;
  v_id     int;
  v_activo boolean;
  v_hoy    int;
  deptos constant text[] := array[
    'Amazonas','Antioquia','Arauca','Atlántico','Bogotá D.C.','Bolívar','Boyacá','Caldas','Caquetá','Casanare',
    'Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare','Huila','La Guajira','Magdalena',
    'Meta','Nariño','Norte de Santander','Putumayo','Quindío','Risaralda','San Andrés y Providencia',
    'Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada'];
begin
  if v_uid is null then raise exception 'Inicia sesión para continuar'; end if;
  if p_departamento is null or not (p_departamento = any (deptos)) then
    raise exception 'Elige un departamento de la lista';
  end if;
  v_nombre := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  if v_nombre !~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .''-]{2,38}$' then
    raise exception 'Escribe el nombre del municipio (solo letras, de 3 a 40 caracteres)';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -5 and 14 or p_lng not between -80 and -66 then
    raise exception 'La ubicación debe estar dentro de Colombia';
  end if;

  -- Mayúsculas y minúsculas bien puestas: "san pedro DE los milagros" -> "San Pedro de los Milagros"
  select string_agg(case when t.i > 1 and lower(t.w) in ('de','del','la','las','los','el','y')
                         then lower(t.w) else initcap(t.w) end, ' ' order by t.i)
    into v_nombre
    from unnest(string_to_array(v_nombre, ' ')) with ordinality as t(w, i);

  -- ¿Ya existe (sin importar tildes ni mayúsculas)? Entonces se usa ese, no se duplica.
  v_norm := translate(lower(v_nombre), 'áéíóúü', 'aeiouu');
  select m.id, m.activo into v_id, v_activo
    from public.municipios m
   where m.departamento = p_departamento
     and translate(lower(m.nombre), 'áéíóúü', 'aeiouu') = v_norm
   limit 1;
  if found then
    if not v_activo then raise exception 'Este municipio no está disponible por ahora'; end if;
    return v_id;
  end if;

  -- Freno anti-abuso: máximo 3 municipios nuevos por persona en 24 horas
  select count(*) into v_hoy from public.municipios_alta
   where usuario_id = v_uid and creado_en > now() - interval '24 hours';
  if v_hoy >= 3 then
    raise exception 'Llegaste al máximo de municipios nuevos por hoy. Prueba mañana';
  end if;

  insert into public.municipios (departamento, nombre, lat, lng, activo)
  values (p_departamento, v_nombre, p_lat, p_lng, true)
  returning id into v_id;
  insert into public.municipios_alta (municipio_id, usuario_id) values (v_id, v_uid);
  return v_id;
end $$;

revoke all on function public.crear_municipio(text, text, double precision, double precision) from public, anon;
grant execute on function public.crear_municipio(text, text, double precision, double precision) to authenticated;
