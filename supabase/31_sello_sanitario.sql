-- =====================================================================
-- Merkap · Fase 2AB.2b · Sello sanitario aparte del sello de verificación
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar. Es seguro repetirlo. Requiere 07, 29 y 03.
--
-- Qué hace:
--  1) comercios.salud_revisado_en (público): fecha en que Merkap revisó los datos sanitarios de una
--     droguería o naturista. Lo mantiene el servidor a partir de datos_sanitarios.revisado_en:
--     solo cambia cuando TÚ das o quitas el visto bueno (o cuando el dueño cambia sus datos, que lo quita).
--     La ficha muestra «🧾 Datos sanitarios revisados por Merkap». Los datos en sí siguen privados.
--  2) Vitrina de droguerías y naturistas: sus productos son públicos solo si el comercio está
--     verificado (teléfono o en persona) Y tiene el visto bueno sanitario.
--  3) «¿Es tu negocio? → Soy el dueño» de una droguería o naturista lleva los datos sanitarios
--     (solicitudes_comercio.datos_sanitarios, privado). Al asignarle el dueño, pasan solos a datos_sanitarios.
-- =====================================================================

-- 1) Fecha pública del visto bueno sanitario
alter table public.comercios add column if not exists salud_revisado_en timestamptz;

create or replace function public.datos_sanitarios_sello()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.comercios set salud_revisado_en = null where id = old.comercio_id;
  else
    update public.comercios set salud_revisado_en = new.revisado_en
     where id = new.comercio_id and salud_revisado_en is distinct from new.revisado_en;
  end if;
  return null;
end $$;
revoke execute on function public.datos_sanitarios_sello() from public, anon, authenticated;
drop trigger if exists datos_sanitarios_sello on public.datos_sanitarios;
create trigger datos_sanitarios_sello after insert or update or delete on public.datos_sanitarios
  for each row execute function public.datos_sanitarios_sello();

-- El sello solo lo cambia el servidor (o un moderador): ni el dueño ni nadie más
create or replace function public.comercios_sello_salud_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or public.es_moderador() then return new; end if;
  if tg_op = 'INSERT' then new.salud_revisado_en := null;
  else new.salud_revisado_en := old.salud_revisado_en; end if;
  return new;
end $$;
revoke execute on function public.comercios_sello_salud_guardia() from public, anon, authenticated;
drop trigger if exists comercios_sello_salud_guardia on public.comercios;
create trigger comercios_sello_salud_guardia before insert or update on public.comercios
  for each row execute function public.comercios_sello_salud_guardia();

-- Lo que ya revisaste antes de este SQL
update public.comercios c set salud_revisado_en = d.revisado_en
  from public.datos_sanitarios d
 where d.comercio_id = c.id and c.salud_revisado_en is distinct from d.revisado_en;

-- 2) Vitrina pública: droguerías y naturistas necesitan además el visto bueno sanitario
drop policy if exists productos_leer_publico on public.productos_comercio;
create policy productos_leer_publico on public.productos_comercio for select
  using (not oculto and exists (
    select 1 from public.comercios c
     where c.id = comercio_id and c.activo and c.nivel_verificacion >= 2
       and (not public.es_tipo_salud(c.tipo, c.tipos_extra) or c.salud_revisado_en is not null)));

-- 3) Reclamar una droguería trae sus datos sanitarios
alter table public.solicitudes_comercio add column if not exists datos_sanitarios jsonb;
alter table public.solicitudes_comercio drop constraint if exists solicitudes_comercio_datos_sanitarios_check;
alter table public.solicitudes_comercio add constraint solicitudes_comercio_datos_sanitarios_check check (
  datos_sanitarios is null or (jsonb_typeof(datos_sanitarios) = 'object' and pg_column_size(datos_sanitarios) <= 2048));

create or replace function public.validar_datos_sanitarios_json(d jsonb)
returns void language plpgsql immutable as $$
begin
  if coalesce(d->>'tipo_establecimiento', '') not in ('drogueria', 'farmacia_drogueria', 'naturista') then raise exception 'Elige el tipo de establecimiento'; end if;
  if char_length(btrim(coalesce(d->>'razon_social', ''))) < 2 then raise exception 'Escribe la razón social'; end if;
  if coalesce(d->>'nit', '') !~ '^[0-9]{5,12}(-[0-9])?$' then raise exception 'El NIT debe tener solo números (ej. 900123456-7)'; end if;
  if char_length(btrim(coalesce(d->>'director_tecnico', ''))) < 3 then raise exception 'Escribe el nombre del director técnico o regente'; end if;
  if coalesce(d->>'declara_autorizacion', '') <> 'true' then raise exception 'Debes declarar que cuentas con autorización de la Secretaría de Salud'; end if;
end $$;

create or replace function public.solicitudes_comercio_salud()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.datos_sanitarios is null then return new; end if;
  if new.tipo <> 'reclamar' or not exists (
       select 1 from public.comercios c where c.id = new.comercio_id and public.es_tipo_salud(c.tipo, c.tipos_extra)) then
    new.datos_sanitarios := null; return new;
  end if;
  perform public.validar_datos_sanitarios_json(new.datos_sanitarios);
  return new;
end $$;
revoke execute on function public.solicitudes_comercio_salud() from public, anon, authenticated;
drop trigger if exists solicitudes_comercio_salud on public.solicitudes_comercio;
create trigger solicitudes_comercio_salud before insert on public.solicitudes_comercio
  for each row execute function public.solicitudes_comercio_salud();

-- Al asignar el dueño, sus datos sanitarios del reclamo pasan al comercio
create or replace function public.comercios_dueno_copiar_salud()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if new.owner_id is null or new.owner_id is not distinct from old.owner_id then return null; end if;
  select s.datos_sanitarios into d from public.solicitudes_comercio s
   where s.comercio_id = new.id and s.solicitante_id = new.owner_id and s.tipo = 'reclamar' and s.datos_sanitarios is not null
   order by s.creado_en desc limit 1;
  if d is null then return null; end if;
  insert into public.datos_sanitarios (comercio_id, tipo_establecimiento, razon_social, nit, director_tecnico,
                                       declara_autorizacion, acta_numero, acta_fecha)
  values (new.id, d->>'tipo_establecimiento', btrim(d->>'razon_social'), d->>'nit', btrim(d->>'director_tecnico'),
          true, nullif(btrim(coalesce(d->>'acta_numero', '')), ''),
          case when coalesce(d->>'acta_fecha', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d->>'acta_fecha')::date <= current_date
               then (d->>'acta_fecha')::date end)
  on conflict (comercio_id) do nothing;
  return null;
end $$;
revoke execute on function public.comercios_dueno_copiar_salud() from public, anon, authenticated;
drop trigger if exists comercios_dueno_copiar_salud on public.comercios;
create trigger comercios_dueno_copiar_salud after update of owner_id on public.comercios
  for each row execute function public.comercios_dueno_copiar_salud();

-- Comprobación: debe mostrar 1 fila con sello_publico = true, en_reclamo = true y regla_vitrina = true.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comercios' and column_name = 'salud_revisado_en') as sello_publico,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'solicitudes_comercio' and column_name = 'datos_sanitarios') as en_reclamo,
       exists (select 1 from pg_policies where tablename = 'productos_comercio' and policyname = 'productos_leer_publico'
                 and qual like '%salud_revisado_en%') as regla_vitrina;
