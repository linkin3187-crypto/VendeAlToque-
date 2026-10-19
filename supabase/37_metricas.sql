-- =====================================================================
-- Merkap · Fase 2AJ · Métricas básicas del piloto (G0)
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto la página funciona igual,
-- solo que no cuenta nada y el panel 📊 Métricas dice «falta el SQL 37»). Es seguro repetirlo.
-- Requiere 01 (es_moderador), 13 (contactos), 16 (búsquedas).
--
-- Qué hace:
--  1) metricas_eventos: cuenta visitas de página y toques en WhatsApp / Llamar / Cómo llegar / Compartir.
--     NO guarda nombre, correo, IP ni ubicación de la persona: solo un código al azar del navegador
--     («visitante») para saber cuántas personas distintas entran y cuántas vuelven.
--  2) registrar_evento(): la usa la página (visitantes incluidos). Valida todo y tiene topes contra abuso.
--     Las visitas de moderadores/administradores no se cuentan (para no inflar los números).
--  3) metricas_resumen(desde, hasta): SOLO moderadores. Devuelve todo el panel 📊 Métricas en un JSON.
--  4) Se borran solos los eventos de más de 13 meses.
-- =====================================================================

create table if not exists public.metricas_eventos (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),
  dia         date not null default (now() at time zone 'America/Bogota')::date,
  tipo        text not null check (tipo in ('visita', 'whatsapp', 'llamar', 'como_llegar', 'compartir')),
  pagina      text check (pagina ~ '^[a-z0-9-]{1,30}$'),
  ref_tipo    text check (ref_tipo in ('anuncio', 'comercio')),
  ref_id      bigint,
  visitante   text not null check (visitante ~ '^[a-z0-9]{16,40}$'),
  con_cuenta  boolean not null default false,
  origen      text check (origen ~ '^[a-z0-9._-]{1,40}$')      -- de dónde llegó: whatsapp, facebook, google, qr…
);
create index if not exists metricas_dia_idx on public.metricas_eventos (dia, tipo);
create index if not exists metricas_visitante_idx on public.metricas_eventos (visitante, dia);
create index if not exists metricas_ref_idx on public.metricas_eventos (ref_tipo, ref_id) where ref_id is not null;

-- Nadie lee ni escribe la tabla directamente: solo las dos funciones de abajo.
alter table public.metricas_eventos enable row level security;
revoke all on public.metricas_eventos from anon, authenticated;

create or replace function public.registrar_evento(p_tipo text, p_pagina text, p_ref_tipo text, p_ref_id bigint,
                                                   p_visitante text, p_origen text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_vis text := lower(coalesce(p_visitante, ''));
  v_pag text := nullif(lower(coalesce(p_pagina, '')), '');
  v_ori text := nullif(lower(left(coalesce(p_origen, ''), 40)), '');
begin
  if p_tipo not in ('visita', 'whatsapp', 'llamar', 'como_llegar', 'compartir') then return; end if;
  if v_vis !~ '^[a-z0-9]{16,40}$' then return; end if;
  if v_pag is not null and v_pag !~ '^[a-z0-9-]{1,30}$' then v_pag := 'otra'; end if;
  if v_ori is not null and v_ori !~ '^[a-z0-9._-]{1,40}$' then v_ori := null; end if;
  if p_ref_tipo is not null and p_ref_tipo not in ('anuncio', 'comercio') then return; end if;
  if public.es_moderador() then return; end if;                       -- tus propias visitas no cuentan
  -- Topes contra abuso: 400 eventos por visitante al día y 50.000 en total al día
  if (select count(*) from public.metricas_eventos where visitante = v_vis and dia = v_hoy) >= 400 then return; end if;
  if (select count(*) from public.metricas_eventos where dia = v_hoy) >= 50000 then return; end if;
  insert into public.metricas_eventos (tipo, pagina, ref_tipo, ref_id, visitante, con_cuenta, origen)
  values (p_tipo, v_pag, case when p_ref_id is null then null else p_ref_tipo end, p_ref_id, v_vis,
          auth.uid() is not null, case when p_tipo = 'visita' then v_ori end);
  -- Limpieza: de vez en cuando (≈1 de cada 500 eventos) se borra lo de más de 13 meses
  if random() < 0.002 then
    delete from public.metricas_eventos where dia < v_hoy - interval '13 months';
  end if;
end $$;
revoke execute on function public.registrar_evento(text, text, text, bigint, text, text) from public;
grant execute on function public.registrar_evento(text, text, text, bigint, text, text) to anon, authenticated;

-- Panel 📊 Métricas (solo moderadores)
create or replace function public.metricas_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d date := least(p_desde, p_hasta);
  h date := greatest(p_desde, p_hasta);
  tz text := 'America/Bogota';
  r jsonb;
begin
  if not public.es_moderador() then raise exception 'Solo moderadores pueden ver las métricas'; end if;
  if h - d > 400 then d := h - 400; end if;
  with ev as (select * from public.metricas_eventos where dia between d and h),
  dias as (select g::date as dia from generate_series(d, h, interval '1 day') g),
  por_dia as (
    select x.dia,
           count(e.*) filter (where e.tipo = 'visita') as visitas,
           count(distinct e.visitante) filter (where e.tipo = 'visita') as visitantes,
           count(e.*) filter (where e.tipo in ('whatsapp', 'llamar', 'como_llegar')) as contactos
      from dias x left join ev e on e.dia = x.dia group by x.dia order by x.dia),
  vis as (select visitante, count(distinct dia) as dias_activos, min(dia) as primero from ev group by visitante),
  nuevos_dia as (   -- cosas que se crearon en esos días (de las tablas de siempre)
    select x.dia,
      (select count(*) from public.anuncios a where (a.creado_en at time zone tz)::date = x.dia) as anuncios,
      (select count(*) from public.perfiles p where (p.creado_en at time zone tz)::date = x.dia) as usuarios,
      (select count(*) from public.negocios_pendientes n where (n.creado_en at time zone tz)::date = x.dia) as negocios,
      (select count(*) from public.solicitudes_comercio s where s.tipo = 'reclamar' and (s.creado_en at time zone tz)::date = x.dia) as reclamos
    from dias x)
  select jsonb_build_object(
    'desde', d, 'hasta', h,
    'totales', jsonb_build_object(
      'visitas',      (select count(*) from ev where tipo = 'visita'),
      'visitantes',   (select count(*) from vis),
      'volvieron',    (select count(*) from vis where dias_activos >= 2),
      'con_cuenta',   (select count(distinct visitante) from ev where con_cuenta),
      'whatsapp',     (select count(*) from ev where tipo = 'whatsapp'),
      'llamar',       (select count(*) from ev where tipo = 'llamar'),
      'como_llegar',  (select count(*) from ev where tipo = 'como_llegar'),
      'compartir',    (select count(*) from ev where tipo = 'compartir'),
      'anuncios',     (select sum(anuncios) from nuevos_dia),
      'usuarios',     (select sum(usuarios) from nuevos_dia),
      'negocios',     (select sum(negocios) from nuevos_dia),
      'reclamos',     (select sum(reclamos) from nuevos_dia),
      'anuncios_activos', (select count(*) from public.anuncios where estado_publicacion = 'activo' and expira_en > now()),
      'comercios_activos', (select count(*) from public.comercios where activo),
      'comercios_con_dueno', (select count(*) from public.comercios where activo and owner_id is not null)),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', p.dia, 'visitas', p.visitas, 'visitantes', p.visitantes,
                  'contactos', p.contactos, 'anuncios', n.anuncios, 'usuarios', n.usuarios) order by p.dia), '[]')
                from por_dia p join nuevos_dia n using (dia)),
    'paginas', (select coalesce(jsonb_agg(x order by x.visitas desc), '[]') from (
                  select coalesce(pagina, 'otra') as pagina, count(*) as visitas, count(distinct visitante) as visitantes
                    from ev where tipo = 'visita' group by 1 order by 2 desc limit 12) x),
    'origenes', (select coalesce(jsonb_agg(x order by x.visitantes desc), '[]') from (
                  select coalesce(origen, 'directo') as origen, count(distinct visitante) as visitantes
                    from ev where tipo = 'visita' group by 1 order by 2 desc limit 10) x),
    'top_comercios', (select coalesce(jsonb_agg(x order by x.contactos desc), '[]') from (
                  select c.id, c.nombre, coalesce(m.nombre, '') as municipio,
                         count(*) filter (where e.tipo in ('whatsapp', 'llamar', 'como_llegar')) as contactos,
                         count(*) filter (where e.tipo = 'whatsapp') as whatsapp,
                         count(*) filter (where e.tipo = 'llamar') as llamar,
                         count(*) filter (where e.tipo = 'como_llegar') as como_llegar
                    from ev e join public.comercios c on c.id = e.ref_id left join public.municipios m on m.id = c.municipio_id
                   where e.ref_tipo = 'comercio' group by c.id, c.nombre, m.nombre
                  having count(*) filter (where e.tipo in ('whatsapp', 'llamar', 'como_llegar')) > 0
                   order by 4 desc limit 10) x),
    'top_anuncios', (select coalesce(jsonb_agg(x order by x.contactos desc), '[]') from (
                  select a.id, a.nombre, coalesce(m.nombre, '') as municipio,
                         count(*) filter (where e.tipo in ('whatsapp', 'llamar', 'como_llegar')) as contactos
                    from ev e join public.anuncios a on a.id = e.ref_id left join public.municipios m on m.id = a.municipio_id
                   where e.ref_tipo = 'anuncio' group by a.id, a.nombre, m.nombre
                  having count(*) filter (where e.tipo in ('whatsapp', 'llamar', 'como_llegar')) > 0
                   order by 4 desc limit 10) x),
    'por_municipio', (select coalesce(jsonb_agg(x order by x.contactos desc), '[]') from (
                  select coalesce(m.nombre, 'Sin municipio') as municipio, count(*) as contactos
                    from ev e
                    left join public.comercios c on e.ref_tipo = 'comercio' and c.id = e.ref_id
                    left join public.anuncios a on e.ref_tipo = 'anuncio' and a.id = e.ref_id
                    left join public.municipios m on m.id = coalesce(c.municipio_id, a.municipio_id)
                   where e.tipo in ('whatsapp', 'llamar', 'como_llegar') group by 1 order by 2 desc limit 10) x),
    'sin_resultados', (select coalesce(jsonb_agg(x order by x.veces desc), '[]') from (
                  select termino, veces_sin_result as veces, ultima_vez from public.busquedas
                   where not resuelta and veces_sin_result > 0 and (ultima_vez at time zone tz)::date >= d
                   order by veces_sin_result desc, ultima_vez desc limit 10) x)
  ) into r;
  return r;
end $$;
revoke execute on function public.metricas_resumen(date, date) from public, anon;
grant execute on function public.metricas_resumen(date, date) to authenticated;

-- Comprobación: debe mostrar 1 fila con tabla = true, registrar = true y resumen = true.
select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'metricas_eventos') as tabla,
       exists (select 1 from pg_proc where proname = 'registrar_evento') as registrar,
       exists (select 1 from pg_proc where proname = 'metricas_resumen') as resumen;
