-- =====================================================================
-- MercaFree · Fase 2Z · Categorías de anuncios administrables (y más categorías)
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR de la 2Z. Es seguro repetirlo
-- (no pisa categorías que ya hayas editado en el panel).
-- Requiere 01 (anuncios, es_moderador) y 11 (subcategorías).
--
-- Qué hace:
--  1) `categorias_anuncio`: la lista de categorías de anuncios vive en la base (como la de comercios, 2V):
--     ícono, nombre, palabras clave (para el buscador), subcategorías, orden y activa sí/no.
--  2) Se cargan las 12 de siempre + 11 nuevas: Motos, Electrodomésticos, Bebés y niños, Deportes y
--     bicicletas, Belleza y salud, Videojuegos y juguetes, Música e instrumentos, Libros y educación,
--     Eventos y fiestas, Agro y campo, Regalo o intercambio. Las subcategorías de siempre se conservan
--     (los anuncios que ya las usan no pierden nada).
--  3) `anuncios.categoria` deja de tener la lista fija y pasa a apuntar a esta tabla: cualquier categoría
--     que crees en el panel se puede usar al publicar. Los anuncios que ya existen no cambian.
--  4) Todos pueden leer la lista; solo moderadores la cambian.
-- =====================================================================

create table if not exists public.categorias_anuncio (
  id             text primary key check (id ~ '^[a-z0-9_]{2,30}$' and id <> 'todos'),
  nombre         text not null check (char_length(btrim(nombre)) between 2 and 40),
  icono          text not null default '📦' check (char_length(icono) between 1 and 8),
  palabras       text not null default '' check (char_length(palabras) <= 1500),
  -- [{"id":"motos","nombre":"Motos"}, …] (máx. 20)
  subcategorias  jsonb not null default '[]'::jsonb check (jsonb_typeof(subcategorias) = 'array' and jsonb_array_length(subcategorias) <= 20),
  orden          integer not null default 100,
  activo         boolean not null default true,
  foro           boolean not null default false
);

alter table public.categorias_anuncio enable row level security;
revoke all on public.categorias_anuncio from anon, authenticated;
grant select on public.categorias_anuncio to anon, authenticated;
grant insert, update, delete on public.categorias_anuncio to authenticated;

drop policy if exists categorias_anuncio_leer on public.categorias_anuncio;
create policy categorias_anuncio_leer on public.categorias_anuncio for select to anon, authenticated using (true);
drop policy if exists categorias_anuncio_moderar on public.categorias_anuncio;
create policy categorias_anuncio_moderar on public.categorias_anuncio for all to authenticated
  using ((select public.es_moderador())) with check ((select public.es_moderador()));

-- Ayuda para escribir las subcategorías: 'id:Nombre|id:Nombre' → jsonb
create or replace function pg_temp.subs(t text) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', split_part(x, ':', 1), 'nombre', split_part(x, ':', 2)) order by n), '[]'::jsonb)
  from unnest(string_to_array(t, '|')) with ordinality as u(x, n) where x <> '';
$$;

insert into public.categorias_anuncio (id, nombre, icono, palabras, subcategorias, orden, foro) values
  ('tienda', 'Tiendas', '🍎', 'tienda, viveres, abarrotes, mercado, granos, frutas, verduras, licores, cerveza, papeleria, utiles, drogueria',
    pg_temp.subs('abarrotes:Abarrotes y víveres|frutas_verduras:Frutas y verduras|carnes_lacteos:Carnes y lácteos|licores:Licores|drogueria:Droguería y salud|papeleria:Papelería|otros:Otros'), 10, false),
  ('comida', 'Comida', '🍔', 'comida, almuerzo, postres, postre, torta, ponque, pan, empanadas, arepas, tamales, hamburguesa, pizza, galletas, dulces, chocolates, helado, jugos, bebidas, cafe, casero, mecato, desayuno, cena, domicilio, buñuelos, natilla, pasteles',
    pg_temp.subs('restaurantes:Restaurantes|comidas_rapidas:Comidas rápidas|panaderia_postres:Panadería y postres|productos_caseros:Productos caseros|bebidas:Bebidas|otros:Otros'), 20, false),
  ('autos', 'Autos', '🚗', 'carro, carros, auto, camioneta, campero, llantas, repuestos, vehiculo, rines, bateria',
    pg_temp.subs('carros:Carros|motos:Motos|camionetas:Camionetas y camperos|repuestos:Repuestos y accesorios|bicicletas:Bicicletas y patinetas|otros:Otros'), 30, true),
  ('motos', 'Motos', '🏍️', 'moto, motos, motocicleta, scooter, casco, cascos, repuestos moto, llantas moto, chaqueta moto, guantes, impermeable',
    pg_temp.subs('motos:Motos|repuestos_moto:Repuestos|cascos_accesorios:Cascos y accesorios|otros:Otros'), 35, true),
  ('inmuebles', 'Inmuebles', '🏡', 'apartamento, apartaestudio, casa, arriendo, alquiler, venta, lote, finca, local, oficina, bodega, habitacion, pieza, inmueble',
    pg_temp.subs('apartamentos:Apartamentos|casas:Casas|lotes_fincas:Lotes y fincas|locales_oficinas:Locales y oficinas|habitaciones:Habitaciones|otros:Otros'), 40, true),
  ('tecnologia', 'Tecnología', '📱', 'celular, telefono, iphone, samsung, xiaomi, computador, portatil, laptop, tablet, televisor, tv, audifonos, parlante, camara, cargador, smartwatch',
    pg_temp.subs('celulares:Celulares|computadores:Computadores y tablets|tv_audio:TV y audio|consolas_juegos:Consolas y videojuegos|camaras:Cámaras|accesorios_tech:Accesorios|otros:Otros'), 50, true),
  ('electrodomesticos', 'Electrodomésticos', '🔌', 'nevera, lavadora, estufa, horno, microondas, licuadora, ventilador, aire acondicionado, plancha, freidora, cafetera, olla arrocera, televisor, electrodomestico',
    pg_temp.subs('neveras:Neveras|lavadoras:Lavadoras|cocina_electro:Estufas y hornos|pequenos:Pequeños electrodomésticos|clima:Ventiladores y aire|otros:Otros'), 55, true),
  ('servicios', 'Oficios', '🛠️', 'servicio, oficios, plomero, electricista, mecanico, carpintero, pintor, albañil, cerrajero, aseo, limpieza, mudanza, acarreo, trasteo, tecnico, reparacion, instalacion, jardineria, niñera, cuidador',
    pg_temp.subs('plomeria:Plomería|electricidad:Electricidad|mecanica:Mecánica|belleza:Belleza y peluquería|aseo_hogar:Aseo y hogar|construccion:Construcción y arreglos|mudanzas_transporte:Mudanzas y transporte|clases:Clases y tutorías|tecnicos:Técnicos (electrodomésticos, PC)|otros:Otros'), 60, true),
  ('ferreteria', 'Ferretería', '🔩', 'ferreteria, herramienta, herramientas, taladro, pintura, cemento, tornillos, tubos, cables, materiales, construccion',
    pg_temp.subs('herramientas:Herramientas|materiales:Materiales de construcción|pinturas:Pinturas|electricos_plomeria:Eléctricos y plomería|tornilleria:Tornillería|otros:Otros'), 70, false),
  ('hogar', 'Hogar', '🛋️', 'hogar, mueble, muebles, sofa, cama, colchon, comedor, decoracion, cortinas, plantas, cocina, ollas, vajilla',
    pg_temp.subs('muebles:Muebles|electrodomesticos:Electrodomésticos|decoracion:Decoración|jardin:Jardín|cocina:Cocina y menaje|bebes:Bebés y niños|otros:Otros'), 80, true),
  ('bebes', 'Bebés y niños', '👶', 'bebe, bebes, niño, niña, coche, cuna, corral, pañales, ropa de bebe, juguetes, silla para carro, tetero, caminador',
    pg_temp.subs('coches_sillas:Coches y sillas|cunas_muebles:Cunas y muebles|ropa_bebe:Ropa de bebé|alimentacion_bebe:Alimentación|otros:Otros'), 85, false),
  ('deportes', 'Deportes y bicicletas', '⚽', 'deporte, deportes, bicicleta, bici, patineta, patines, balon, pesas, gimnasio, guayos, raqueta, camping, pesca, natacion',
    pg_temp.subs('bicicletas:Bicicletas|gimnasio:Gimnasio y pesas|futbol:Fútbol|patines_patinetas:Patines y patinetas|camping_pesca:Camping y pesca|otros:Otros'), 90, true),
  ('belleza_salud', 'Belleza y salud', '💄', 'belleza, maquillaje, perfume, perfumes, crema, cabello, uñas, salud, vitaminas, suplementos, masajes, spa, cuidado personal',
    pg_temp.subs('maquillaje:Maquillaje|perfumes:Perfumes|cuidado_personal:Cuidado personal|salud:Salud y bienestar|otros:Otros'), 95, false),
  ('ropa', 'Ropa', '👕', 'ropa, camisa, camiseta, pantalon, jean, vestido, zapatos, tenis, calzado, chaqueta, bolso, uniforme',
    pg_temp.subs('hombre:Hombre|mujer:Mujer|ninos:Niños|calzado:Calzado|deportiva:Deportiva|accesorios_ropa:Accesorios|otros:Otros'), 100, false),
  ('juegos', 'Videojuegos y juguetes', '🎮', 'videojuego, videojuegos, consola, playstation, xbox, nintendo, juego, juguete, juguetes, lego, muñeca, carro de control, juego de mesa',
    pg_temp.subs('consolas:Consolas|juegos_video:Videojuegos|juguetes:Juguetes|juegos_mesa:Juegos de mesa|otros:Otros'), 105, true),
  ('musica', 'Música e instrumentos', '🎸', 'musica, guitarra, piano, teclado, bateria, violin, bajo, instrumento, parlante, microfono, amplificador, clases de musica, dj',
    pg_temp.subs('cuerdas:Guitarras y cuerdas|teclados:Pianos y teclados|percusion:Percusión|sonido:Sonido y DJ|otros:Otros'), 110, true),
  ('libros', 'Libros y educación', '📚', 'libro, libros, texto escolar, utiles escolares, cuadernos, novela, curso, clases, tutoria, idiomas, universidad, colegio',
    pg_temp.subs('libros_textos:Libros y textos|utiles:Útiles escolares|cursos_clases:Cursos y clases|otros:Otros'), 115, true),
  ('mascotas', 'Mascotas', '🐕', 'mascota, mascotas, perro, perros, gato, gatos, cachorro, concentrado, veterinaria, adopcion, collar, arena',
    pg_temp.subs('perros:Perros|gatos:Gatos|alimentos_mascotas:Alimentos|accesorios_mascotas:Accesorios|veterinaria:Veterinaria|adopcion:Adopción|otros:Otros'), 120, false),
  ('eventos', 'Eventos y fiestas', '🎉', 'evento, eventos, fiesta, fiestas, alquiler de sillas, mesas, carpa, decoracion de fiestas, globos, dj, sonido, catering, recreacion, payaso, fotografo',
    pg_temp.subs('alquiler:Alquiler de sillas y mesas|decoracion_fiestas:Decoración|sonido_dj:Sonido y DJ|recreacion:Recreación|comida_eventos:Comida para eventos|otros:Otros'), 125, false),
  ('agro', 'Agro y campo', '🌱', 'agro, campo, finca, ganado, vaca, caballo, gallinas, cerdos, semillas, abono, fertilizante, fumigadora, guadaña, motosierra, cafe pergamino',
    pg_temp.subs('animales:Animales|semillas_abonos:Semillas y abonos|herramientas_campo:Herramientas y maquinaria|productos_campo:Productos del campo|otros:Otros'), 130, false),
  ('empleos', 'Empleos', '💼', 'empleo, trabajo, vacante, oferta, busco trabajo, medio tiempo, por dias, contrato, auxiliar, vendedor, mesero, conductor',
    pg_temp.subs('ofertas:Ofertas de empleo|busco_empleo:Busco empleo|medio_tiempo:Medio tiempo|freelance:Independiente / por días|otros:Otros'), 135, false),
  ('regalo', 'Regalo o intercambio', '🎁', 'regalo, regalos, gratis, dono, donacion, cambio, intercambio, trueque, cambio por',
    pg_temp.subs('regalo:Lo regalo|intercambio:Lo cambio'), 140, false),
  ('otros', 'Otros', '📦', 'otros, varios', '[]'::jsonb, 999, true)
on conflict (id) do nothing;

-- Ahora la base acepta cualquier categoría de la tabla (en vez de la lista fija)
alter table public.anuncios drop constraint if exists anuncios_categoria_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'anuncios_categoria_fk') then
    alter table public.anuncios add constraint anuncios_categoria_fk
      foreign key (categoria) references public.categorias_anuncio(id) on update cascade;
  end if;
end $$;

-- Comprobación: debe mostrar 1 fila con categorias = 23 (o más) y con_llave = true.
select (select count(*) from public.categorias_anuncio) as categorias,
       exists (select 1 from pg_constraint where conname = 'anuncios_categoria_fk') as con_llave;
