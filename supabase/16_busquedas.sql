-- =====================================================================
-- MercaFree · Fase 2W · Buscador inteligente: «lo que la gente busca»
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar el PR: la página funciona igual
-- sin esto, solo que no guarda las búsquedas). Es seguro repetirlo.
-- Requiere 01_schema.sql (función es_moderador) y 15_categorias_comercio.sql.
--
-- Qué hace:
--  1) `busquedas`: guarda QUÉ se busca (solo el texto, sin tildes ni mayúsculas) y cuántas veces,
--     cuántas veces no hubo resultados y cuándo fue la última. NO guarda quién buscó.
--  2) `registrar_busqueda(texto, resultados)`: la usa la página de resultados (visitantes incluidos).
--     Solo acepta letras, números y espacios (2 a 60 caracteres) y tiene tope de 5.000 textos distintos.
--  3) Solo moderadores pueden leer la lista, marcarla como «enseñada» o borrarla
--     (panel «Lo que la gente busca y no encuentra» en Moderación).
-- =====================================================================

create table if not exists public.busquedas (
  termino            text primary key check (termino ~ '^[a-z0-9 ]{2,60}$'),
  veces              integer not null default 1,
  veces_sin_result   integer not null default 0,
  ultimos_resultados integer not null default 0,
  primera_vez        timestamptz not null default now(),
  ultima_vez         timestamptz not null default now(),
  resuelta           boolean not null default false     -- un moderador ya la «enseñó» a una categoría
);
create index if not exists busquedas_sin_result_idx on public.busquedas (resuelta, veces_sin_result desc, ultima_vez desc);

alter table public.busquedas enable row level security;
revoke all on public.busquedas from anon, authenticated;
grant select, update, delete on public.busquedas to authenticated;   -- las reglas de abajo limitan a moderadores

drop policy if exists busquedas_leer_mod on public.busquedas;
create policy busquedas_leer_mod on public.busquedas for select to authenticated
  using ((select public.es_moderador()));
drop policy if exists busquedas_editar_mod on public.busquedas;
create policy busquedas_editar_mod on public.busquedas for update to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));
drop policy if exists busquedas_borrar_mod on public.busquedas;
create policy busquedas_borrar_mod on public.busquedas for delete to authenticated
  using ((select public.es_moderador()));

-- Registrar una búsqueda (visitantes y personas con cuenta). No devuelve nada de la tabla.
create or replace function public.registrar_busqueda(p_termino text, p_resultados integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t text := regexp_replace(lower(btrim(coalesce(p_termino, ''))), '\s+', ' ', 'g');
  v_r integer := greatest(0, least(coalesce(p_resultados, 0), 9999));
begin
  if v_t !~ '^[a-z0-9 ]{2,60}$' then return; end if;
  if not exists (select 1 from public.busquedas where termino = v_t)
     and (select count(*) from public.busquedas) >= 5000 then
    return;   -- tope contra abuso: textos nuevos se ignoran hasta que un moderador limpie la lista
  end if;
  insert into public.busquedas as b (termino, veces_sin_result, ultimos_resultados)
  values (v_t, case when v_r = 0 then 1 else 0 end, v_r)
  on conflict (termino) do update
    set veces = b.veces + 1,
        veces_sin_result = b.veces_sin_result + case when v_r = 0 then 1 else 0 end,
        ultimos_resultados = v_r,
        ultima_vez = now(),
        resuelta = case when v_r > 0 then b.resuelta else false end;
end $$;
revoke execute on function public.registrar_busqueda(text, integer) from public;
grant execute on function public.registrar_busqueda(text, integer) to anon, authenticated;

-- Comprobación: debe mostrar 1 fila con «registrar_busqueda» y la tabla con RLS = true.
select p.proname, c.relrowsecurity as tabla_con_rls
  from pg_proc p, pg_class c
 where p.proname = 'registrar_busqueda' and c.relname = 'busquedas' and c.relnamespace = 'public'::regnamespace;
