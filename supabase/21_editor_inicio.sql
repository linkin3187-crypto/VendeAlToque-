-- =====================================================================
-- MercaFree · Fase 2Z.2 · Editor del inicio (carrusel + cuadros con imagen)
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esto el inicio se ve igual que hoy).
-- Es seguro repetirlo y no pisa lo que edites en el panel. Requiere 01 (es_moderador) y 20 (accesos_inicio).
--
-- Qué hace:
--  1) `accesos_inicio.imagen_url`: los cuadros pueden llevar una imagen propia en vez del emoji.
--     Los destinos aceptan también «#contenido» (bajar a los anuncios).
--  2) `banners_inicio`: las diapositivas del carrusel del inicio, editables desde «🎨 Editar inicio»:
--     etiqueta, título, texto, botón y a dónde lleva; paleta de colores (o dos colores propios);
--     dos íconos; imagen opcional (al lado o de fondo); orden y visible.
--     Se cargan las 5 diapositivas de hoy, tal cual.
--  3) Todos pueden leer; solo moderadores cambian. Los destinos solo pueden ser páginas del sitio,
--     «#publicar» o «#contenido» (nunca enlaces a otros sitios).
-- =====================================================================

-- 1) Cuadros: imagen opcional + destino «#contenido»
alter table public.accesos_inicio
  add column if not exists imagen_url text check (imagen_url is null or (imagen_url ~ '^https://' and char_length(imagen_url) <= 500));
alter table public.accesos_inicio drop constraint if exists accesos_inicio_destino_check;
alter table public.accesos_inicio add constraint accesos_inicio_destino_check
  check (destino in ('#publicar', '#contenido') or destino ~ '^[a-z0-9-]+\.html([?#][A-Za-z0-9=&%:_.#+-]*)?$');

-- 2) Diapositivas del carrusel
create table if not exists public.banners_inicio (
  id          bigint generated always as identity primary key,
  etiqueta    text not null default '' check (char_length(etiqueta) <= 40),
  titulo      text not null check (char_length(btrim(titulo)) between 2 and 60),
  texto       text not null default '' check (char_length(texto) <= 160),
  boton       text not null check (char_length(btrim(boton)) between 2 and 30),
  destino     text not null check (destino in ('#publicar', '#contenido') or destino ~ '^[a-z0-9-]+\.html([?#][A-Za-z0-9=&%:_.#+-]*)?$'),
  paleta      text not null default 'indigo' check (paleta in ('indigo', 'verde', 'azul', 'naranja', 'rosa', 'oscuro', 'dorado', 'menta', 'personal')),
  color1      text check (color1 is null or color1 ~ '^#[0-9a-fA-F]{6}$'),
  color2      text check (color2 is null or color2 ~ '^#[0-9a-fA-F]{6}$'),
  icono1      text not null default '⭐' check (char_length(icono1) between 1 and 8),
  icono2      text not null default '' check (char_length(icono2) <= 8),
  imagen_url  text check (imagen_url is null or (imagen_url ~ '^https://' and char_length(imagen_url) <= 500)),
  imagen_modo text not null default 'lado' check (imagen_modo in ('lado', 'fondo')),
  orden       integer not null default 100,
  activo      boolean not null default true
);

alter table public.banners_inicio enable row level security;
revoke all on public.banners_inicio from anon, authenticated;
grant select on public.banners_inicio to anon, authenticated;
grant insert, update, delete on public.banners_inicio to authenticated;

drop policy if exists banners_leer on public.banners_inicio;
create policy banners_leer on public.banners_inicio for select to anon, authenticated using (true);
drop policy if exists banners_moderar on public.banners_inicio;
create policy banners_moderar on public.banners_inicio for all to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

-- Las 5 diapositivas de hoy (solo si la tabla está vacía)
insert into public.banners_inicio (etiqueta, titulo, texto, boton, destino, paleta, icono1, icono2, orden)
select * from (values
  ('Publica en 1 minuto', 'Tu anuncio, gratis', 'Sube fotos, pon el pin en el mapa y recibe mensajes por WhatsApp. Sin comisiones.', 'Regístrate y publica gratis', '#publicar', 'indigo', '🚀', '📱', 10),
  ('Para negocios del barrio', 'Abre tu vitrina gratis', 'Registra tu tienda, muestra hasta 20 productos y recibe pedidos por WhatsApp.', 'Registrar mi negocio', 'registrar-negocio.html', 'verde', '🏪', '🛍️', 20),
  ('Ayúdanos a crecer el mapa', 'Recomienda los comercios que visitas', 'Tiendas, restaurantes, bares, puestos de comida y más. ¿No está en el mapa? Recomiéndalo en 1 minuto.', '🤝 Recomendar', 'recomendar.html', 'rosa', '🌭', '🍻', 30),
  ('Directorio y mapa', 'Comercios cerca de ti', 'Farmacias, panaderías, cajeros, tiendas y más, con sello de verificación honesto.', 'Ver el directorio', 'comercios.html', 'azul', '📍', '🗺️', 40),
  ('Compra con cuidado', 'Encuentro en lugar público', 'Usa «Cómo llegar» para acordar un punto de encuentro seguro y revisa antes de pagar.', 'Ver clasificados', '#contenido', 'naranja', '🤝', '🛡️', 50)
) v(etiqueta, titulo, texto, boton, destino, paleta, icono1, icono2, orden)
where not exists (select 1 from public.banners_inicio);

-- Comprobación: debe mostrar 1 fila con diapositivas = 5 (o las que tengas) y cuadros_con_imagen = true.
select (select count(*) from public.banners_inicio) as diapositivas,
       exists (select 1 from information_schema.columns where table_name = 'accesos_inicio' and column_name = 'imagen_url') as cuadros_con_imagen;
