-- =====================================================================
-- Merkap · Fase M-0 · Números de cada anuncio para su dueño
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 05 (favoritos), 37 (metricas_eventos, registrar_evento) y 38.
--
-- Qué hace:
--  1) registrar_evento(): ya no cuenta las visitas ni los contactos del DUEÑO en su propio anuncio
--     o en su propia tienda (antes solo se excluía a moderadores y administrador). Así los números
--     que ve cada dueño son de otras personas, no suyos. Cuando el dueño COMPARTE lo suyo sí se anota,
--     marcado «del_dueno» (sirve para saber si los dueños usan 📣 Compartir), pero no entra en sus números.
--  2) anuncio_numeros(): para cada anuncio de quien la llama, cuántas PERSONAS distintas
--       · lo abrieron (total y últimos 7 días)
--       · lo contactaron (💬 WhatsApp, 📞 Llamar o 🗺️ Cómo llegar)
--       · lo compartieron (otras personas: lo que compartes tú no suma aquí)
--     y cuántas lo guardaron en ❤️ Favoritos.
--     Solo números: nunca quién. Cada persona ve únicamente los de SUS anuncios.
--     Usa los datos que la página ya guarda desde la 2AJ (no se recoge nada nuevo).
-- =====================================================================

-- ---------- 1) El dueño no se cuenta a sí mismo ----------
alter table public.metricas_eventos add column if not exists del_dueno boolean not null default false;

create or replace function public.registrar_evento(p_tipo text, p_pagina text, p_ref_tipo text, p_ref_id bigint,
                                                   p_visitante text, p_origen text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_vis text := lower(coalesce(p_visitante, ''));
  v_pag text := nullif(lower(coalesce(p_pagina, '')), '');
  v_ori text := nullif(lower(left(coalesce(p_origen, ''), 40)), '');
  v_due boolean := false;
begin
  if p_tipo not in ('visita', 'whatsapp', 'llamar', 'como_llegar', 'compartir') then return; end if;
  if v_vis !~ '^[a-z0-9]{16,40}$' then return; end if;
  if v_pag is not null and v_pag !~ '^[a-z0-9-]{1,30}$' then v_pag := 'otra'; end if;
  if v_ori is not null and v_ori !~ '^[a-z0-9._-]{1,40}$' then v_ori := null; end if;
  if p_ref_tipo is not null and p_ref_tipo not in ('anuncio', 'comercio') then return; end if;
  if public.es_moderador() then return; end if;                       -- tus propias visitas no cuentan
  -- M-0: el dueño mirando o contactando su propio anuncio o su propia tienda no cuenta;
  --      si lo comparte, se anota marcado como del dueño
  if auth.uid() is not null and p_ref_id is not null then
    v_due := (p_ref_tipo = 'anuncio'  and exists (select 1 from public.anuncios  where id = p_ref_id and owner_id = auth.uid()))
          or (p_ref_tipo = 'comercio' and exists (select 1 from public.comercios where id = p_ref_id and owner_id = auth.uid()));
    if v_due and p_tipo <> 'compartir' then return; end if;
  end if;
  -- Topes contra abuso: 400 eventos por visitante al día y 50.000 en total al día
  if (select count(*) from public.metricas_eventos where visitante = v_vis and dia = v_hoy) >= 400 then return; end if;
  if (select count(*) from public.metricas_eventos where dia = v_hoy) >= 50000 then return; end if;
  insert into public.metricas_eventos (tipo, pagina, ref_tipo, ref_id, visitante, con_cuenta, origen, del_dueno)
  values (p_tipo, v_pag, case when p_ref_id is null then null else p_ref_tipo end, p_ref_id, v_vis,
          auth.uid() is not null, case when p_tipo = 'visita' then v_ori end, v_due);
  -- Limpieza: de vez en cuando (≈1 de cada 500 eventos) se borra lo de más de 13 meses
  if random() < 0.002 then
    delete from public.metricas_eventos where dia < v_hoy - interval '13 months';
  end if;
end $$;
revoke execute on function public.registrar_evento(text, text, text, bigint, text, text) from public;
grant execute on function public.registrar_evento(text, text, text, bigint, text, text) to anon, authenticated;

-- ---------- 2) Números de mis anuncios ----------
create or replace function public.anuncio_numeros()
returns table (anuncio_id bigint, vistas bigint, vistas_7d bigint, contactos bigint,
               whatsapp bigint, llamar bigint, como_llegar bigint, compartidos bigint, guardados bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_yo  uuid := auth.uid();
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if v_yo is null then raise exception 'Inicia sesión para ver los números de tus anuncios'; end if;
  return query
    with mios as (select a.id from public.anuncios a where a.owner_id = v_yo),
    ev as (
      select m.id,
             count(distinct e.visitante) filter (where e.tipo = 'visita')                                   as vistas,
             count(distinct e.visitante) filter (where e.tipo = 'visita' and e.dia > v_hoy - 7)             as vistas_7d,
             count(distinct e.visitante) filter (where e.tipo in ('whatsapp', 'llamar', 'como_llegar'))     as contactos,
             count(distinct e.visitante) filter (where e.tipo = 'whatsapp')                                 as whatsapp,
             count(distinct e.visitante) filter (where e.tipo = 'llamar')                                   as llamar,
             count(distinct e.visitante) filter (where e.tipo = 'como_llegar')                              as como_llegar,
             count(distinct e.visitante) filter (where e.tipo = 'compartir' and not e.del_dueno)            as compartidos
        from mios m
        left join public.metricas_eventos e on e.ref_tipo = 'anuncio' and e.ref_id = m.id
       group by m.id)
    select ev.id, ev.vistas, ev.vistas_7d, ev.contactos, ev.whatsapp, ev.llamar, ev.como_llegar, ev.compartidos,
           (select count(*) from public.favoritos f where f.anuncio_id = ev.id)
      from ev;
end $$;
revoke execute on function public.anuncio_numeros() from public, anon;
grant execute on function public.anuncio_numeros() to authenticated;

-- ---------- Comprobación ----------
-- Debe mostrar: funcion = true | columna = true | dueno_excluido = true
select exists (select 1 from pg_proc where proname = 'anuncio_numeros') as funcion,
       exists (select 1 from information_schema.columns where table_name = 'metricas_eventos' and column_name = 'del_dueno') as columna,
       position('owner_id = auth.uid()' in pg_get_functiondef('public.registrar_evento(text,text,text,bigint,text,text)'::regprocedure)) > 0 as dueno_excluido;
