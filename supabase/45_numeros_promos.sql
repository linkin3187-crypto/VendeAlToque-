-- =====================================================================
-- Merkap · Fase 2AP-4c · Números de cada promoción
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 42 (promociones, es_dueno_comercio) y 38 (es_admin).
--
-- Qué hace:
--  1) promo_eventos: cuenta, por promoción, cuántas PERSONAS distintas por día
--       · vista     → vieron la promo en la ficha de la tienda
--       · inicio    → llegaron tocándola en «🔥 Promos cerca de ti» del inicio
--       · whatsapp  → tocaron «💬 Pedir esta promo»
--     Sin nombre, correo ni IP: solo el código al azar del navegador (el mismo de las métricas).
--     No cuentan el dueño de la tienda ni el administrador. Nadie puede leer la tabla directo.
--  2) promo_resumen(comercio): los totales de cada promo de esa tienda. Solo el DUEÑO o el ADMINISTRADOR.
-- =====================================================================

create table if not exists public.promo_eventos (
  promo_id   bigint not null references public.promociones(id) on delete cascade,
  tipo       text not null check (tipo in ('vista', 'inicio', 'whatsapp')),
  visitante  text not null check (visitante ~ '^[a-z0-9]{16,40}$'),
  dia        date not null default ((now() at time zone 'America/Bogota')::date),
  creado_en  timestamptz not null default now(),
  primary key (promo_id, tipo, visitante, dia)          -- 1 por persona, tipo y día
);
alter table public.promo_eventos enable row level security;
revoke all on public.promo_eventos from public, anon, authenticated;

-- Anotar (lo llama la página; cualquiera puede, pero solo suma 1 por persona/tipo/día)
create or replace function public.registrar_promo_evento(p_promo bigint, p_tipo text, p_visitante text)
returns void language plpgsql security definer set search_path = public as $$
declare v_com bigint;
begin
  if p_tipo not in ('vista', 'inicio', 'whatsapp') or p_visitante !~ '^[a-z0-9]{16,40}$' then return; end if;
  select comercio_id into v_com from public.promociones
   where id = p_promo and not oculta and hasta >= (now() at time zone 'America/Bogota')::date;
  if v_com is null then return; end if;                                    -- no existe, oculta o ya terminó
  if auth.uid() is not null and (public.es_admin() or public.es_dueno_comercio(v_com)) then return; end if;   -- el dueño y tú no cuentan
  insert into public.promo_eventos (promo_id, tipo, visitante) values (p_promo, p_tipo, p_visitante)
  on conflict do nothing;
end $$;
revoke execute on function public.registrar_promo_evento(bigint, text, text) from public;
grant execute on function public.registrar_promo_evento(bigint, text, text) to anon, authenticated;

-- Totales por promo de una tienda (solo dueño o administrador)
create or replace function public.promo_resumen(p_comercio bigint)
returns table (promo_id bigint, vistas bigint, desde_inicio bigint, whatsapp bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not (public.es_admin() or public.es_dueno_comercio(p_comercio)) then
    raise exception 'Solo el dueño de la tienda o el administrador ven estos números';
  end if;
  return query
    select p.id,
           count(distinct e.visitante) filter (where e.tipo = 'vista'),
           count(distinct e.visitante) filter (where e.tipo = 'inicio'),
           count(distinct e.visitante) filter (where e.tipo = 'whatsapp')
      from public.promociones p
      left join public.promo_eventos e on e.promo_id = p.id
     where p.comercio_id = p_comercio
     group by p.id;
end $$;
revoke execute on function public.promo_resumen(bigint) from public, anon;
grant execute on function public.promo_resumen(bigint) to authenticated;

-- ---------- Comprobación ----------
-- Debe mostrar: tabla = true | cerrada = true | funciones = 2
select exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'promo_eventos') as tabla,
       (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'promo_eventos') as cerrada,
       (select count(*) from pg_proc where proname in ('registrar_promo_evento', 'promo_resumen')) as funciones;
