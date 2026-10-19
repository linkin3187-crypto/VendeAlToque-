-- =====================================================================
-- Merkap · Fase 2AP-2 · Campañas con enlace corto redirigible (QR que no cambia)
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 01 (perfiles), 07 (comercios), 10 (perfiles.ref), 37 (métricas) y 38 (es_admin).
--
-- Qué hace:
--  1) campanas: cada campaña tiene un código fijo (el que va impreso en el QR: …/?c=codigo)
--     y un destino que el ADMINISTRADOR puede cambiar cuando quiera. El código NO se puede
--     cambiar (ya puede estar impreso). Pausada = quien escanea llega al inicio.
--  2) campanas_historial: cada cambio de destino queda anotado (antes → después, quién, cuándo).
--  3) campanas_escaneos: cuenta cuántas veces se abre cada enlace corto. Sin nombre, correo, IP
--     ni ubicación: solo el mismo código al azar del navegador que ya usan las métricas (SQL 37).
--     Tus propias visitas (administrador o moderador) no cuentan.
--  4) abrir_campana(codigo, visitante): la usa la página (cualquier visitante). Devuelve a dónde ir.
--  5) campanas_resumen(dias): SOLO administrador. Por campaña: escaneos, personas, cuentas nuevas,
--     cuántas publicaron o enviaron negocio, y contactos (WhatsApp / Llamar / Cómo llegar) de quienes escanearon.
--  6) marketing_textos: tus versiones de los textos del 📣 Centro de marketing (antes solo en el navegador).
-- =====================================================================

-- ---------- 1) Campañas ----------
create table if not exists public.campanas (
  codigo         text primary key check (codigo ~ '^[a-z0-9_-]{1,30}$'),
  nombre         text not null check (char_length(btrim(nombre)) between 2 and 80),
  -- Solo páginas de Merkap (ej.: «tienda.html?id=12&p=40#productos»): nunca otro sitio
  destino        text not null check (char_length(destino) <= 300
                   and destino ~ '^[a-z0-9-]{1,40}\.html([?#][A-Za-z0-9_.~%=&#?/+:,-]*)?$'
                   and destino !~ '//'),
  config         jsonb not null default '{}'::jsonb,       -- lo que elegiste en el panel (para volver a editar)
  canal          text check (canal is null or canal ~ '^[a-z0-9._-]{1,40}$'),
  comercio_id    bigint references public.comercios(id) on delete set null,
  activa         boolean not null default true,
  nota           text check (nota is null or char_length(nota) <= 300),
  creado_por     uuid references public.perfiles(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists campanas_comercio_idx on public.campanas (comercio_id) where comercio_id is not null;

create table if not exists public.campanas_historial (
  id            bigint generated always as identity primary key,
  codigo        text not null references public.campanas(codigo) on delete cascade,
  destino_antes text,
  destino_nuevo text,
  activa_antes  boolean,
  activa_nueva  boolean,
  cambiado_por  uuid references public.perfiles(id) on delete set null,
  cambiado_en   timestamptz not null default now()
);
create index if not exists campanas_historial_idx on public.campanas_historial (codigo, cambiado_en desc);

-- Guardia: el código no cambia, se anota el historial y las fechas no se pueden falsear
create or replace function public.campanas_guardia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.codigo <> old.codigo then
      raise exception 'El código de una campaña no se puede cambiar (ya puede estar impreso). Crea una campaña nueva.';
    end if;
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    if new.destino is distinct from old.destino or new.activa is distinct from old.activa then
      insert into public.campanas_historial (codigo, destino_antes, destino_nuevo, activa_antes, activa_nueva, cambiado_por)
      values (old.codigo, old.destino, new.destino, old.activa, new.activa, auth.uid());
    end if;
  else
    new.creado_en := now();
    new.creado_por := auth.uid();
  end if;
  new.nombre := btrim(new.nombre);
  new.actualizado_en := now();
  return new;
end $$;
revoke execute on function public.campanas_guardia() from public, anon, authenticated;
drop trigger if exists campanas_guardia on public.campanas;
create trigger campanas_guardia before insert or update on public.campanas
  for each row execute function public.campanas_guardia();

-- Solo el administrador ve y edita campañas e historial
alter table public.campanas enable row level security;
alter table public.campanas_historial enable row level security;
drop policy if exists "campanas: admin lee" on public.campanas;
drop policy if exists "campanas: admin crea" on public.campanas;
drop policy if exists "campanas: admin edita" on public.campanas;
drop policy if exists "campanas: admin borra" on public.campanas;
create policy "campanas: admin lee"   on public.campanas for select to authenticated using (public.es_admin());
create policy "campanas: admin crea"  on public.campanas for insert to authenticated with check (public.es_admin());
create policy "campanas: admin edita" on public.campanas for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "campanas: admin borra" on public.campanas for delete to authenticated using (public.es_admin());
drop policy if exists "campanas_historial: admin lee" on public.campanas_historial;
create policy "campanas_historial: admin lee" on public.campanas_historial for select to authenticated using (public.es_admin());
revoke all on public.campanas, public.campanas_historial from anon;
grant select, insert, update, delete on public.campanas to authenticated;
grant select on public.campanas_historial to authenticated;

-- ---------- 2) Escaneos ----------
create table if not exists public.campanas_escaneos (
  id        bigint generated always as identity primary key,
  codigo    text not null references public.campanas(codigo) on delete cascade,
  visitante text check (visitante is null or visitante ~ '^[a-z0-9]{16,40}$'),
  creado_en timestamptz not null default now(),
  dia       date not null default (now() at time zone 'America/Bogota')::date
);
create index if not exists campanas_escaneos_idx on public.campanas_escaneos (codigo, dia);
create index if not exists campanas_escaneos_vis_idx on public.campanas_escaneos (visitante, codigo) where visitante is not null;
alter table public.campanas_escaneos enable row level security;
revoke all on public.campanas_escaneos from anon, authenticated;   -- solo por las funciones de abajo

-- La página llama esto al abrir «…/?c=codigo». Devuelve {destino, canal} o null (no existe o está pausada).
create or replace function public.abrir_campana(p_codigo text, p_visitante text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cod text := lower(btrim(coalesce(p_codigo, '')));
  v_vis text := lower(coalesce(p_visitante, ''));
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  c record;
begin
  if v_cod !~ '^[a-z0-9_-]{1,30}$' then return null; end if;
  select codigo, destino, canal, activa into c from public.campanas where codigo = v_cod;
  if not found or not c.activa then return null; end if;
  if v_vis !~ '^[a-z0-9]{16,40}$' then v_vis := null; end if;
  -- Se cuenta el escaneo (no los tuyos; el mismo navegador cuenta 1 vez cada 30 min; topes contra abuso)
  if not public.es_moderador()
     and not exists (select 1 from public.campanas_escaneos
                      where codigo = v_cod and visitante = v_vis and creado_en > now() - interval '30 minutes')
     and (select count(*) from public.campanas_escaneos where codigo = v_cod and dia = v_hoy) < 3000
     and (select count(*) from public.campanas_escaneos where dia = v_hoy) < 50000 then
    insert into public.campanas_escaneos (codigo, visitante) values (v_cod, v_vis);
  end if;
  return jsonb_build_object('destino', c.destino, 'canal', c.canal);
end $$;
revoke execute on function public.abrir_campana(text, text) from public;
grant execute on function public.abrir_campana(text, text) to anon, authenticated;

-- ---------- 3) Resumen para el panel (solo administrador) ----------
create or replace function public.campanas_resumen(p_dias int default 30)
returns table (codigo text, nombre text, destino text, config jsonb, canal text, comercio_id bigint, comercio text,
               activa boolean, nota text, creado_en timestamptz, actualizado_en timestamptz,
               escaneos_total bigint, escaneos bigint, personas bigint, escaneos_7d bigint, ultimo_escaneo timestamptz,
               cuentas bigint, con_anuncio bigint, con_negocio bigint, contactos bigint, contactos_tienda bigint, cambios bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 400)));
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede ver las campañas'; end if;
  return query
    select c.codigo, c.nombre, c.destino, c.config, c.canal, c.comercio_id, co.nombre::text, c.activa, c.nota,
           c.creado_en, c.actualizado_en,
           (select count(*) from public.campanas_escaneos s where s.codigo = c.codigo),
           (select count(*) from public.campanas_escaneos s where s.codigo = c.codigo and s.creado_en >= v_desde),
           (select count(distinct s.visitante) from public.campanas_escaneos s where s.codigo = c.codigo and s.creado_en >= v_desde),
           (select count(*) from public.campanas_escaneos s where s.codigo = c.codigo and s.creado_en >= now() - interval '7 days'),
           (select max(s.creado_en) from public.campanas_escaneos s where s.codigo = c.codigo),
           (select count(*) from public.perfiles p where p.ref = c.codigo),
           (select count(*) from public.perfiles p where p.ref = c.codigo and exists (select 1 from public.anuncios a where a.owner_id = p.id)),
           (select count(*) from public.perfiles p where p.ref = c.codigo and exists (select 1 from public.negocios_pendientes n where n.solicitante_id = p.id)),
           -- contactos de quienes escanearon (después de escanear, dentro del periodo)
           (select count(*) from public.metricas_eventos e
             where e.tipo in ('whatsapp', 'llamar', 'como_llegar') and e.creado_en >= v_desde
               and exists (select 1 from public.campanas_escaneos s where s.codigo = c.codigo and s.visitante = e.visitante and s.creado_en <= e.creado_en)),
           (select count(*) from public.metricas_eventos e
             where c.comercio_id is not null and e.ref_tipo = 'comercio' and e.ref_id = c.comercio_id
               and e.tipo in ('whatsapp', 'llamar', 'como_llegar') and e.creado_en >= v_desde
               and exists (select 1 from public.campanas_escaneos s where s.codigo = c.codigo and s.visitante = e.visitante and s.creado_en <= e.creado_en)),
           (select count(*) from public.campanas_historial h where h.codigo = c.codigo)
      from public.campanas c
      left join public.comercios co on co.id = c.comercio_id
     order by c.activa desc, c.actualizado_en desc;
end $$;
revoke execute on function public.campanas_resumen(int) from public, anon;
grant execute on function public.campanas_resumen(int) to authenticated;

-- ---------- 4) Textos del Centro de marketing ----------
create table if not exists public.marketing_textos (
  clave          text primary key check (clave ~ '^[a-z]{3,20}\|[0-9]$'),   -- destino|versión (ej.: «registro|1»)
  texto          text not null check (char_length(texto) between 1 and 1500),
  actualizado_en timestamptz not null default now()
);
alter table public.marketing_textos enable row level security;
drop policy if exists "marketing_textos: admin" on public.marketing_textos;
create policy "marketing_textos: admin" on public.marketing_textos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
revoke all on public.marketing_textos from anon;
grant select, insert, update, delete on public.marketing_textos to authenticated;

-- ---------- Comprobación ----------
-- Debe mostrar: tablas = 4 | abrir = true | resumen = true | seguras = true
select (select count(*) from pg_tables where schemaname = 'public'
          and tablename in ('campanas', 'campanas_historial', 'campanas_escaneos', 'marketing_textos')) as tablas,
       exists (select 1 from pg_proc where proname = 'abrir_campana') as abrir,
       exists (select 1 from pg_proc where proname = 'campanas_resumen') as resumen,
       (select bool_and(rowsecurity) from pg_tables where schemaname = 'public'
          and tablename in ('campanas', 'campanas_historial', 'campanas_escaneos', 'marketing_textos')) as seguras;
