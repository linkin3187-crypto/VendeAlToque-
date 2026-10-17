-- =====================================================================
-- MercaFree · Fase 2Z.6 · Categorías nuevas y buscador entrenado
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo: no crea duplicados ni repite palabras.
-- Requiere 15 (categorias_comercio) y 19 (categorias_anuncio).
--
-- Qué hace:
--  COMERCIOS
--   · Crea «Minimercados» 🧺, «Inmobiliarias» 🏢 y «Concesionarios y compraventas» 🚘.
--   · «Tiendas y misceláneas» → «Tiendas de barrio y misceláneas».
--   · Más palabras clave para Licoreras, Tiendas, Frutas y verduras, Supermercados
--     (grandes superficies, D1, Ara, mayoristas, plaza de mercado…), Motos y Talleres.
--   · «Clínicas y hospitales»: ícono 🏥 (tenía 🏪).
--  ANUNCIOS
--   · «Autos» → «Vehículos» 🚗 y absorbe «Motos»: subcategorías Carros, Motos, Camionetas y camperos,
--     Camiones y buses, Repuestos de carro, Repuestos y accesorios de moto, Bicicletas y patinetas, Otros.
--     Los anuncios que estaban en «Motos» pasan a Vehículos con su subcategoría; «Motos» queda
--     desactivada (no se borra, por seguridad).
--   · «Inmuebles»: agrega Apartaestudios y Bodegas.
--   · «Tiendas»: agrega Minimercado y Licorería a sus palabras.
--  Nada de lo que ya editaste en los paneles se borra: las palabras y subcategorías se SUMAN.
-- =====================================================================

-- Suma palabras separadas por coma sin repetir (ignora tildes y mayúsculas) y respeta el máximo de 1500
create or replace function pg_temp.sumar(actual text, nuevas text) returns text language sql immutable as $$
  with todas as (
    select btrim(p) as p, n from unnest(string_to_array(coalesce(actual, '') || ',' || nuevas, ',')) with ordinality as u(p, n)
  ), unicas as (
    select distinct on (lower(translate(p, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))) p, n from todas where p <> ''
    order by lower(translate(p, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), n
  )
  select left(string_agg(p, ', ' order by n), 1500) from unicas;
$$;
-- 'id:Nombre|id:Nombre' → jsonb
create or replace function pg_temp.subs(t text) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', split_part(x, ':', 1), 'nombre', split_part(x, ':', 2)) order by n), '[]'::jsonb)
  from unnest(string_to_array(t, '|')) with ordinality as u(x, n) where x <> '';
$$;
-- Agrega subcategorías que no existan (por id), dejando «Otros» al final
create or replace function pg_temp.sumar_subs(actual jsonb, nuevas jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(e order by g, n), '[]'::jsonb) from (
    select e, case when e->>'id' = 'otros' then 2 else 0 end g, n from jsonb_array_elements(actual) with ordinality a(e, n)
    union all
    select e, 1, n from jsonb_array_elements(nuevas) with ordinality b(e, n)
     where not exists (select 1 from jsonb_array_elements(actual) x where x->>'id' = e->>'id')
  ) t;
$$;

-- ========================= COMERCIOS =========================
insert into public.categorias_comercio (id, nombre, icono, orden, palabras, activo) values
  ('minimercado', 'Minimercados', '🧺', 25,
   'minimercado, minimercados, mini mercado, autoservicio, surtidora, granero, viveres, abarrotes, mercado, aseo, lacteos, carnes frias, fruver, verduras, frutas, licores, cerveza, gaseosa, mecato, pan, huevos, domicilio', true),
  ('inmobiliaria', 'Inmobiliarias', '🏢', 212,
   'inmobiliaria, inmobiliarias, finca raiz, bienes raices, arriendo, arriendos, alquiler, venta de casas, venta de apartamentos, apartamento, apartaestudio, casa, local, oficina, bodega, lote, avaluo, administracion de inmuebles, propiedad horizontal, agente inmobiliario', true),
  ('concesionario', 'Concesionarios y compraventas', '🚘', 172,
   'concesionario, concesionarios, compraventa, compraventa de carros, compraventa de motos, venta de carros, venta de motos, carros usados, motos usadas, carros nuevos, motos nuevas, vehiculos, autos, financiacion, permuta, traspaso, alquiler de carros, renta de carros', true)
on conflict (id) do nothing;

update public.categorias_comercio set nombre = 'Tiendas de barrio y misceláneas'
 where id = 'tienda' and nombre = 'Tiendas y misceláneas';
update public.categorias_comercio set icono = '🏥' where id = 'clinicas_y_hospitales' and icono = '🏪';

update public.categorias_comercio set palabras = pg_temp.sumar(palabras,
  'licoreria, licorerias, licores, estanco, trago, tragos, aguardiente, guaro, ron, cerveza, polas, vino, whisky, vodka, hielo, licores a domicilio')
 where id = 'licorera';
update public.categorias_comercio set palabras = pg_temp.sumar(palabras,
  'tienda de barrio, tiendas de barrio, la tienda, tendero, fruver, frutas, verduras, minimercado, granero, surtidora, viveres, abarrotes, licores, recargas, pagos, chance, fiado')
 where id = 'tienda';
update public.categorias_comercio set palabras = pg_temp.sumar(palabras,
  'fruver, fruteria, verduleria, plaza de mercado, galeria, aguacate, banano, platano, papa, cebolla, tomate, limon, mango, naranja, hortalizas, frutas a domicilio')
 where id = 'fruver';
update public.categorias_comercio set palabras = pg_temp.sumar(palabras,
  'supermercado, supermercados, grandes superficies, hipermercado, exito, carulla, olimpica, jumbo, makro, mayorista, mayoristas, autoservicio, descuento, tienda de descuento, d1, ara, justo y bueno, isimo, plaza de mercado, mercado del mes')
 where id = 'supermercado';
update public.categorias_comercio set palabras = pg_temp.sumar(palabras,
  'compraventa de motos, motos nuevas, motos usadas, repuestos, casco, llantas de moto, cadena, kit de arrastre')
 where id = 'motos';

-- ========================= ANUNCIOS =========================
-- Vehículos (antes «Autos»), con las subcategorías de Motos
update public.categorias_anuncio set
  nombre = 'Vehículos', icono = '🚗',
  subcategorias = pg_temp.sumar_subs(
    pg_temp.subs('carros:Carros|motos:Motos|camionetas:Camionetas y camperos|camiones:Camiones y buses|repuestos:Repuestos de carro|repuestos_moto:Repuestos y accesorios de moto|bicicletas:Bicicletas y patinetas|otros:Otros'),
    subcategorias),
  palabras = pg_temp.sumar(palabras,
    'vehiculo, vehiculos, carro, carros, auto, autos, automovil, moto, motos, motocicleta, camioneta, campero, camion, bus, buseta, furgon, taxi, carro usado, moto usada, carro nuevo, moto nueva, venta de carros, venta de motos, arriendo de carros, alquiler de carros, renta, repuestos, casco, llantas, rin, soat, tecnomecanica, kilometraje, modelo, mecanico, automatico, scooter, cuatrimoto')
 where id = 'autos';

-- Los anuncios de «Motos» pasan a Vehículos con su subcategoría
update public.anuncios set categoria = 'autos',
  subcategoria = case subcategoria when 'motos' then 'motos' when 'repuestos_moto' then 'repuestos_moto'
                                   when 'cascos_accesorios' then 'repuestos_moto' else 'motos' end
 where categoria = 'motos';
update public.categorias_anuncio set activo = false where id = 'motos';

-- Inmuebles
update public.categorias_anuncio set
  subcategorias = pg_temp.sumar_subs(subcategorias, pg_temp.subs('apartaestudios:Apartaestudios|bodegas:Bodegas')),
  palabras = pg_temp.sumar(palabras,
    'inmueble, inmuebles, inmobiliaria, finca raiz, arriendo, arriendos, alquiler, venta, se vende, se arrienda, casa, casas, apartamento, apartamentos, apto, apartaestudio, aparta estudio, estudio, habitacion, pieza, local, oficina, bodega, lote, finca, cabaña, estrato, amoblado, arriendo por dias')
 where id = 'inmuebles';

-- Tiendas (anuncios)
update public.categorias_anuncio set palabras = pg_temp.sumar(palabras,
  'tienda de barrio, minimercado, granero, fruver, frutas, verduras, licoreria, licores, viveres, abarrotes, mercado')
 where id = 'tienda';

-- Comprobación: debe mostrar 1 fila con comercios_nuevos = 3, vehiculos = 'Vehículos', motos_activa = false,
-- subs_vehiculos = 8 (o más si habías agregado otras) y anuncios_en_motos = 0.
select (select count(*) from public.categorias_comercio where id in ('minimercado', 'inmobiliaria', 'concesionario')) as comercios_nuevos,
       (select nombre from public.categorias_anuncio where id = 'autos') as vehiculos,
       (select activo from public.categorias_anuncio where id = 'motos') as motos_activa,
       (select jsonb_array_length(subcategorias) from public.categorias_anuncio where id = 'autos') as subs_vehiculos,
       (select count(*) from public.anuncios where categoria = 'motos') as anuncios_en_motos;
