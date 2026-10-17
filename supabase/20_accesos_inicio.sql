-- =====================================================================
-- MercaFree · Fase 2Z.1 · Accesos en cuadros del inicio (administrables)
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar: sin esta tabla el inicio muestra los
-- cuadros de siempre). Es seguro repetirlo y no pisa lo que edites en el panel.
-- Requiere 01 (es_moderador).
--
-- Qué hace: `accesos_inicio` guarda los cuadros de la fila «accesos» del inicio: ícono, título, color,
-- a dónde lleva, orden y si se muestra. Todos pueden leerlos; solo moderadores los cambian.
-- «destino» solo acepta páginas propias del sitio (ej. comercios.html?tipo=farmacia) o «#publicar»:
-- nunca enlaces a otros sitios. Más adelante un cuadro podrá ser un comercio patrocinado (Fase 5).
-- =====================================================================

create table if not exists public.accesos_inicio (
  id       bigint generated always as identity primary key,
  titulo   text not null check (char_length(btrim(titulo)) between 2 and 24),
  icono    text not null default '⭐' check (char_length(icono) between 1 and 8),
  color    text not null default 'morado' check (color in ('morado', 'menta', 'amarillo', 'rosa', 'azul', 'naranja')),
  destino  text not null check (destino = '#publicar' or destino ~ '^[a-z0-9-]+\.html([?#][A-Za-z0-9=&%:_.#+-]*)?$'),
  orden    integer not null default 100,
  activo   boolean not null default true
);

alter table public.accesos_inicio enable row level security;
revoke all on public.accesos_inicio from anon, authenticated;
grant select on public.accesos_inicio to anon, authenticated;
grant insert, update, delete on public.accesos_inicio to authenticated;

drop policy if exists accesos_leer on public.accesos_inicio;
create policy accesos_leer on public.accesos_inicio for select to anon, authenticated using (true);
drop policy if exists accesos_moderar on public.accesos_inicio;
create policy accesos_moderar on public.accesos_inicio for all to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

-- Cuadros iniciales (solo si la tabla está vacía)
insert into public.accesos_inicio (titulo, icono, color, destino, orden)
select * from (values
  ('Farmacias',        '💊', 'menta',    'comercios.html?tipo=farmacia',     10),
  ('Mercado',          '🛒', 'amarillo', 'comercios.html?tipo=supermercado', 20),
  ('Comida',           '🍔', 'naranja',  'buscar.html?q=comida',             30),
  ('Bares',            '🍻', 'rosa',     'comercios.html?tipo=bar',          40),
  ('Tecnología',       '📱', 'azul',     'anuncios.html?cat=tecnologia',     50),
  ('Motos',            '🏍️', 'morado',   'anuncios.html?cat=motos',          60),
  ('Arriendos',        '🏡', 'menta',    'anuncios.html?cat=inmuebles',      70),
  ('Publica gratis',   '📢', 'amarillo', '#publicar',                        80),
  ('Recomienda',       '🤝', 'rosa',     'recomendar.html',                  90),
  ('Tu negocio',       '🏪', 'azul',     'registrar-negocio.html',          100)
) v(titulo, icono, color, destino, orden)
where not exists (select 1 from public.accesos_inicio);

-- Comprobación: debe mostrar 1 fila con cuadros = 10 (o los que tengas).
select count(*) as cuadros from public.accesos_inicio;
