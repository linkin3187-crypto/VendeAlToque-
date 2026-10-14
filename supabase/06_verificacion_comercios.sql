-- =====================================================================
-- MercaFree · Fase 2D.1 · Verificación de comercios (niveles de sello)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo.
--
-- Qué hace:
--  1) Agrega a `comercios` el nivel de sello: 1 Ubicado (OpenStreetMap, sin comprobar),
--     2 Verificado por teléfono, 3 Verificado en persona, y la fecha de la última verificación.
--  2) Crea `verificaciones_comercio`: el registro de cada verificación (quién, cuándo, método,
--     lista de comprobación, foto de la fachada, GPS de la puerta y notas). Solo lo ven moderadores.
--  3) Un trigger aplica el resultado al comercio: el sello SOLO cambia dejando un registro.
--     `comercios.verificado` pasa a ser derivado (nivel >= 2), así el directorio público sigue igual.
-- Privacidad: NO se guarda copia de la cédula ni datos personales del dueño (ver aviso en `notas`).
-- =====================================================================

alter table public.comercios
  add column if not exists nivel_verificacion smallint not null default 1
    check (nivel_verificacion between 1 and 3),
  add column if not exists verificado_en timestamptz;

-- Los comercios que ya estaban marcados «verificado» (visitados antes de este cambio) quedan en nivel 3.
update public.comercios
   set nivel_verificacion = 3, verificado_en = coalesce(verificado_en, actualizado_en)
 where verificado and nivel_verificacion = 1;

-- ---------- Registro de verificaciones ----------
create table if not exists public.verificaciones_comercio (
  id              bigint generated always as identity primary key,
  comercio_id     bigint not null references public.comercios(id) on delete cascade,
  verificador_id  uuid not null default auth.uid() references auth.users(id),
  metodo          text not null check (metodo in ('telefono','visita')),
  resultado       text not null check (resultado in ('aprobada','rechazada')),
  nivel           smallint not null check (nivel in (2,3)),
  lista           jsonb not null default '{}'::jsonb,                       -- {clave: true/false} de la lista de comprobación
  foto_fachada_url text check (foto_fachada_url is null or foto_fachada_url ~ '^https://'),
  lat             double precision check (lat is null or lat between -5 and 14),   -- GPS de la puerta (opcional)
  lng             double precision check (lng is null or lng between -80 and -66),
  notas           text check (notas is null or char_length(notas) <= 500),  -- NO escribir cédula ni datos personales
  creado_en       timestamptz not null default now(),
  -- coherencia: por teléfono → nivel 2; en persona → nivel 3 y con foto de la fachada si se aprueba
  constraint verif_metodo_nivel check ((metodo = 'telefono' and nivel = 2) or (metodo = 'visita' and nivel = 3)),
  constraint verif_visita_foto  check (not (metodo = 'visita' and resultado = 'aprobada') or foto_fachada_url is not null),
  constraint verif_rechazo_nota check (resultado = 'aprobada' or (notas is not null and char_length(btrim(notas)) >= 5)),
  constraint verif_gps_par      check ((lat is null) = (lng is null))
);

create index if not exists verif_comercio_idx on public.verificaciones_comercio (comercio_id, creado_en desc);

alter table public.verificaciones_comercio enable row level security;
grant select, insert on public.verificaciones_comercio to authenticated;   -- sin update ni delete: el registro no se reescribe

drop policy if exists verif_leer on public.verificaciones_comercio;
create policy verif_leer on public.verificaciones_comercio for select to authenticated
  using (public.es_moderador());

drop policy if exists verif_crear on public.verificaciones_comercio;
create policy verif_crear on public.verificaciones_comercio for insert to authenticated
  with check (public.es_moderador() and verificador_id = auth.uid());

-- ---------- El sello solo cambia con un registro ----------
-- Antes de guardar un comercio: `verificado` se deriva del nivel, y el nivel solo lo mueve el trigger
-- de verificaciones (que avisa con una variable local a la transacción).
create or replace function public.comercios_sello()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.nivel_verificacion := 1;
    new.verificado_en := null;
  elsif (new.nivel_verificacion is distinct from old.nivel_verificacion
         or new.verificado_en is distinct from old.verificado_en)
        and coalesce(current_setting('mercafree.verificando', true), '') <> 'on' then
    raise exception 'El sello de verificación solo cambia registrando una verificación';
  end if;
  new.verificado := new.nivel_verificacion >= 2;
  return new;
end $$;
revoke execute on function public.comercios_sello() from public, anon, authenticated;

drop trigger if exists comercios_antes_sello on public.comercios;
create trigger comercios_antes_sello before insert or update on public.comercios
  for each row execute function public.comercios_sello();

-- Después de registrar una verificación: aprobada → sube el nivel (nunca lo baja) y guarda la fecha;
-- si hay GPS de la puerta, actualiza el pin. Rechazada → vuelve a nivel 1 (la ficha ya no es confiable).
create or replace function public.verificacion_aplicar()
returns trigger language plpgsql set search_path = public as $$
begin
  perform set_config('mercafree.verificando', 'on', true);
  if new.resultado = 'aprobada' then
    update public.comercios c set
      nivel_verificacion = greatest(c.nivel_verificacion, new.nivel),
      verificado_en = new.creado_en,
      lat = coalesce(new.lat, c.lat),
      lng = coalesce(new.lng, c.lng)
    where c.id = new.comercio_id;
  else
    update public.comercios c set nivel_verificacion = 1, verificado_en = null
    where c.id = new.comercio_id;
  end if;
  perform set_config('mercafree.verificando', 'off', true);
  return new;
end $$;
revoke execute on function public.verificacion_aplicar() from public, anon, authenticated;

drop trigger if exists verificacion_despues_insert on public.verificaciones_comercio;
create trigger verificacion_despues_insert after insert on public.verificaciones_comercio
  for each row execute function public.verificacion_aplicar();
