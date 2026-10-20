-- =====================================================================
-- Merkap · Fase 2AR · Avisos y novedades editables + carrusel con fechas
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR. Es seguro repetirlo.
-- Requiere 21 (banners_inicio) y 38 (es_admin).
--
-- Qué hace:
--  1) avisos_inicio: las cajas de aviso del inicio («Novedades»), que antes estaban fijas en el código.
--     El ADMINISTRADOR las crea y edita desde «🎨 Editar inicio → 📣 Avisos y novedades»:
--     título, texto, ícono, botón y a dónde lleva; estilo de color (o dos colores propios);
--     tamaño (franja, tarjeta o grande); dónde aparece; a quién se le muestra; fechas desde/hasta;
--     si se puede cerrar; marca «Patrocinado» (para venderlo después); orden; visible.
--     Cuenta vistas y clics (para saber si funciona y, más adelante, para mostrárselo a un anunciante).
--     El público solo ve los visibles y vigentes; nadie más que el administrador los cambia.
--  2) Se cargan las 2 novedades que hoy están fijas (promociones para tiendas y rebajas para anuncios),
--     así que nada cambia hasta que tú las edites.
--  3) Carrusel del inicio: cada diapositiva gana fechas desde/hasta (se prende y apaga sola)
--     y la marca «Patrocinado».
-- =====================================================================

-- ---------- 1) Avisos ----------
create table if not exists public.avisos_inicio (
  id             bigint generated always as identity primary key,
  nombre         text not null default '' check (char_length(nombre) <= 60),          -- nombre interno (solo lo ves tú)
  titulo         text not null check (char_length(btrim(titulo)) between 2 and 90),
  texto          text not null default '' check (char_length(texto) <= 240),
  icono          text not null default '📣' check (char_length(icono) <= 8),
  boton          text check (boton is null or char_length(btrim(boton)) between 2 and 30),
  destino        text check (destino is null or destino in ('#publicar', '#contenido', '#mis-anuncios')
                             or destino ~ '^[a-z0-9-]+\.html([?#][A-Za-z0-9=&%:_.#+-]*)?$'),
  estilo         text not null default 'morado' check (estilo in ('morado', 'amarillo', 'verde', 'azul', 'rosa', 'oscuro', 'claro', 'personal')),
  color_fondo    text check (color_fondo is null or color_fondo ~ '^#[0-9a-fA-F]{6}$'),
  color_texto    text check (color_texto is null or color_texto ~ '^#[0-9a-fA-F]{6}$'),
  tamano         text not null default 'tarjeta' check (tamano in ('franja', 'tarjeta', 'grande')),
  ubicacion      text not null default 'arriba' check (ubicacion in ('arriba', 'despues_carrusel', 'antes_comercios', 'final')),
  publico        text not null default 'todos' check (publico in ('todos', 'visitantes', 'con_cuenta', 'tiendas', 'anunciantes')),
  cerrable       boolean not null default true,
  patrocinado    boolean not null default false,
  desde          date,
  hasta          date,
  orden          integer not null default 100,
  activo         boolean not null default true,
  vistas         integer not null default 0,
  clics          integer not null default 0,
  version        integer not null default 1,      -- sube al cambiar el contenido: quien lo cerró lo vuelve a ver
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint avisos_fechas check (desde is null or hasta is null or hasta >= desde)
);

-- Al cambiar lo que se lee (no los contadores), sube la versión
create or replace function public.avisos_version()
returns trigger language plpgsql set search_path = public as $$
begin
  if row(new.titulo, new.texto, new.icono, new.boton, new.destino) is distinct from row(old.titulo, old.texto, old.icono, old.boton, old.destino) then
    new.version := old.version + 1;
  end if;
  if row(new.vistas, new.clics) is not distinct from row(old.vistas, old.clics) then new.actualizado_en := now(); end if;
  return new;
end $$;
revoke execute on function public.avisos_version() from public, anon, authenticated;
drop trigger if exists avisos_version on public.avisos_inicio;
create trigger avisos_version before update on public.avisos_inicio for each row execute function public.avisos_version();

alter table public.avisos_inicio enable row level security;
revoke all on public.avisos_inicio from anon, authenticated;
grant select on public.avisos_inicio to anon, authenticated;
grant insert, update, delete on public.avisos_inicio to authenticated;
drop policy if exists "avisos: público ve los vigentes" on public.avisos_inicio;
drop policy if exists "avisos: administrador" on public.avisos_inicio;
create policy "avisos: público ve los vigentes" on public.avisos_inicio for select to anon, authenticated
  using (activo and (desde is null or desde <= (now() at time zone 'America/Bogota')::date)
                and (hasta is null or hasta >= (now() at time zone 'America/Bogota')::date));
create policy "avisos: administrador" on public.avisos_inicio for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- Contador de vistas y clics (cualquiera puede sumar 1; no puede cambiar nada más)
create or replace function public.aviso_contar(p_id bigint, p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tipo = 'vista' then
    update public.avisos_inicio set vistas = vistas + 1 where id = p_id and activo;
  elsif p_tipo = 'clic' then
    update public.avisos_inicio set clics = clics + 1 where id = p_id and activo;
  end if;
end $$;
revoke execute on function public.aviso_contar(bigint, text) from public;
grant execute on function public.aviso_contar(bigint, text) to anon, authenticated;

-- ---------- 2) Las 2 novedades de hoy (solo si la tabla está vacía) ----------
insert into public.avisos_inicio (nombre, titulo, texto, icono, boton, destino, estilo, tamano, ubicacion, publico, orden)
select * from (values
  ('Novedad: promociones', 'Nuevo para tu tienda: promociones',
   'Publica una oferta (2x1, −10 %, combo) y tu tienda sale con 🔥 en el directorio y el inicio. Luego compártela con imagen y QR en tus estados.',
   '🔥', 'Crear mi promo', 'mi-tienda.html#promos', 'morado', 'tarjeta', 'arriba', 'tiendas', 10),
  ('Novedad: rebajas', 'Nuevo: rebaja el precio de tu anuncio',
   'Si bajas el precio, tu anuncio sale con el precio anterior tachado y −% durante 15 días. Y con 📣 Compartir lo mandas con foto y QR a tus grupos.',
   '📉', 'Ver mis anuncios', '#mis-anuncios', 'morado', 'tarjeta', 'arriba', 'anunciantes', 20)
) v(nombre, titulo, texto, icono, boton, destino, estilo, tamano, ubicacion, publico, orden)
where not exists (select 1 from public.avisos_inicio);

-- ---------- 3) Carrusel: fechas y «Patrocinado» ----------
alter table public.banners_inicio add column if not exists desde date;
alter table public.banners_inicio add column if not exists hasta date;
alter table public.banners_inicio add column if not exists patrocinado boolean not null default false;
alter table public.banners_inicio drop constraint if exists banners_fechas;
alter table public.banners_inicio add constraint banners_fechas check (desde is null or hasta is null or hasta >= desde);

-- ---------- Comprobación ----------
-- Debe mostrar: avisos = 2 (o los que tengas) | seguros = true | carrusel_con_fechas = true
select (select count(*) from public.avisos_inicio) as avisos,
       (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'avisos_inicio') as seguros,
       exists (select 1 from information_schema.columns where table_name = 'banners_inicio' and column_name = 'hasta') as carrusel_con_fechas;
