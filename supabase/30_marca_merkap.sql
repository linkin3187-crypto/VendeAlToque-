-- =====================================================================
-- Merkap · Fase 2AB.2 · Cambio de marca (MercaFree → Merkap) y cuadro «Motos»
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar). Es seguro repetirlo.
--
-- Qué hace:
--  1) El cuadro «Motos» del inicio apuntaba a la categoría «Motos», que se desactivó en el SQL 22
--     (ahora es Vehículos → Motos). Pasa a anuncios.html?cat=autos&sub=motos.
--  2) Si algún texto del carrusel o de los cuadros dice «MercaFree», lo cambia por «Merkap».
-- =====================================================================

update public.accesos_inicio set destino = 'anuncios.html?cat=autos&sub=motos'
 where destino = 'anuncios.html?cat=motos';

update public.accesos_inicio set titulo = replace(titulo, 'MercaFree', 'Merkap') where titulo like '%MercaFree%';

update public.banners_inicio set
  etiqueta = replace(etiqueta, 'MercaFree', 'Merkap'),
  titulo   = replace(titulo,   'MercaFree', 'Merkap'),
  texto    = replace(texto,    'MercaFree', 'Merkap'),
  boton    = replace(boton,    'MercaFree', 'Merkap')
 where concat_ws(' ', etiqueta, titulo, texto, boton) like '%MercaFree%';

-- Comprobación: debe mostrar 1 fila con motos_viejo = 0 y textos_viejos = 0.
select (select count(*) from public.accesos_inicio where destino = 'anuncios.html?cat=motos') as motos_viejo,
       (select count(*) from public.banners_inicio where concat_ws(' ', etiqueta, titulo, texto, boton) like '%MercaFree%')
     + (select count(*) from public.accesos_inicio where titulo like '%MercaFree%') as textos_viejos;
