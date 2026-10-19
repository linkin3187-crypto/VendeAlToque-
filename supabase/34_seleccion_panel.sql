-- =====================================================================
-- Merkap · Fase 2AD · Panel de la Selección del día
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar). Es seguro repetirlo. Requiere 32.
--
-- Qué hace:
--  · anuncios.seleccion_excluido: un moderador saca un anuncio de la Selección del día para que el
--    sorteo automático no lo vuelva a poner (hasta que lo permita de nuevo). Solo moderadores lo cambian.
--  · La fijación (⭐ seleccion_hasta) ya existía (SQL 32); ahora se maneja también desde «Editar inicio».
-- =====================================================================

alter table public.anuncios add column if not exists seleccion_excluido boolean not null default false;
grant select (seleccion_excluido) on public.anuncios to anon, authenticated;

-- Misma guardia del SQL 32, ahora también para seleccion_excluido
create or replace function public.anuncios_seleccion_guardia()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.es_moderador() then return new; end if;
  if tg_op = 'INSERT' then
    new.seleccion_hasta := null; new.seleccion_excluido := false;
  else
    new.seleccion_hasta := old.seleccion_hasta; new.seleccion_excluido := old.seleccion_excluido;
  end if;
  return new;
end $$;
revoke execute on function public.anuncios_seleccion_guardia() from public, anon, authenticated;

-- Comprobación: debe mostrar 1 fila con excluir = true.
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'anuncios' and column_name = 'seleccion_excluido') as excluir;
