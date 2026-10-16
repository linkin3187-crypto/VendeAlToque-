-- =====================================================================
-- MercaFree · Fase 2V · Categorías de comercio administrables
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR de la 2V. Es seguro repetirlo.
-- Requiere haber ejecutado 01 a 14.
--
-- Qué hace:
--  1) `categorias_comercio`: la lista de categorías vive en la base (no en el código). Los moderadores
--     agregan, renombran, cambian el ícono o desactivan categorías desde «Comercios» → «Categorías».
--     Cada una tiene PALABRAS CLAVE (ej. postres, torta, ponqué…) que usa el buscador inteligente (2W).
--  2) Se cargan 33 categorías (las 12 de antes + 21 nuevas). Las que ya existen no se tocan al repetir.
--  3) `comercios.tipo` y `negocios_pendientes.tipo` dejan la lista fija y pasan a apuntar a esta tabla.
--  4) `comercios.tipos_extra`: hasta 2 categorías SECUNDARIAS (ej. Panadería + Cafetería, Pastelería).
--  5) El DUEÑO puede cambiar su categoría principal y las secundarias desde «Mi tienda»
--     (además de lo que ya podía: descripción, WhatsApp, teléfono, horario, foto y entrega).
--     El nombre y la ubicación siguen siendo de los moderadores (respaldan el sello de verificación).
-- =====================================================================

-- ---------- 1. Tabla de categorías ----------
create table if not exists public.categorias_comercio (
  id        text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  nombre    text not null check (char_length(btrim(nombre)) between 2 and 40),
  icono     text not null default '🏪' check (char_length(icono) between 1 and 8),
  palabras  text not null default '' check (char_length(palabras) <= 1500),   -- separadas por coma
  orden     integer not null default 100,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.categorias_comercio enable row level security;
grant select on public.categorias_comercio to anon, authenticated;
grant insert, update, delete on public.categorias_comercio to authenticated;

drop policy if exists categorias_leer on public.categorias_comercio;
create policy categorias_leer on public.categorias_comercio for select to anon, authenticated using (true);

drop policy if exists categorias_moderar on public.categorias_comercio;
create policy categorias_moderar on public.categorias_comercio for all to authenticated
  using (public.es_moderador()) with check (public.es_moderador());

-- ---------- 2. Categorías iniciales (no pisa las que ya existan) ----------
insert into public.categorias_comercio (id, nombre, icono, orden, palabras) values
  ('farmacia',      'Farmacias y droguerías',  '💊', 10, 'farmacia, drogueria, medicamento, medicina, remedio, pastillas, acetaminofen, ibuprofeno, dolor, gripa, jarabe, curas, vitaminas, preservativos, suero, botiquin, formula medica, inyeccion, tension, glucometro'),
  ('supermercado',  'Supermercados',           '🛒', 20, 'supermercado, mercado, viveres, abarrotes, granos, arroz, aceite, leche, huevos, aseo, detergente, jabon, papel higienico, mecato, gaseosa, enlatados, despensa'),
  ('tienda',        'Tiendas y misceláneas',   '🏪', 30, 'tienda, miscelanea, minimercado, granero, cacharreria, variedades, recargas, mecato, gaseosa, cerveza, cigarrillos, pan, huevos, leche, la tienda de la esquina'),
  ('panaderia',     'Panaderías',              '🥖', 40, 'panaderia, pan, pandebono, bunuelo, almojabana, croissant, roscon, pan de bono, mogolla, tostadas, desayuno, tinto, postres, torta, ponque, galletas, hojaldre, pasteles'),
  ('pasteleria',    'Pastelerías y repostería','🍰', 45, 'pasteleria, reposteria, postres, postre, torta, tortas, ponque, cumpleanos, cupcake, brownie, cheesecake, gelatina, merengue, tres leches, galletas, dulces, chocolates, mesa de postres, decoracion de tortas, bizcocho'),
  ('cafeteria',     'Cafeterías',              '☕', 50, 'cafeteria, cafe, tinto, capuchino, latte, expreso, aromatica, chocolate caliente, desayuno, onces, algo, postres, sandwich, malteada, jugos, wifi, reunion'),
  ('heladeria',     'Heladerías',              '🍦', 55, 'heladeria, helado, helados, paleta, cono, malteada, ensalada de frutas, postres, yogur, granizado, raspado, salpicon, fresas con crema, waffle'),
  ('restaurante',   'Restaurantes',            '🍽️', 60, 'restaurante, almuerzo, corrientazo, menu del dia, ejecutivo, comida, cena, bandeja paisa, sancocho, carne, pollo, pescado, mariscos, comida tipica, vegetariano, asados, parrilla, domicilio'),
  ('comida_rapida', 'Comida rápida',           '🍔', 65, 'comida rapida, hamburguesa, perro caliente, pizza, salchipapa, empanadas, arepa, pollo frito, alitas, papas fritas, sandwich, burrito, tacos, chuzo, picada, domicilio'),
  ('carniceria',    'Carnicerías y pescaderías','🥩', 70, 'carniceria, famas, carne, res, cerdo, pollo, pescado, mariscos, chorizo, morcilla, costilla, salchichas, embutidos, asado, pescaderia, avicola, huevos'),
  ('fruver',        'Frutas y verduras',       '🍎', 75, 'fruver, frutas, verduras, legumbres, hortalizas, fruteria, plaza de mercado, aguacate, platano, papa, tomate, cebolla, jugos, ensalada de frutas, organico'),
  ('licorera',      'Licoreras',               '🍺', 80, 'licorera, licor, cerveza, aguardiente, ron, vino, whisky, tequila, hielo, cigarrillos, fiesta, rumba, estanco, bebidas'),
  ('naturista',     'Tiendas naturistas',      '🌿', 85, 'naturista, natural, hierbas, organico, suplementos, vitaminas, proteina, sin gluten, keto, granola, miel, aceites esenciales, homeopatia, dieta'),
  ('ropa',          'Ropa y calzado',          '👕', 90, 'ropa, calzado, zapatos, tenis, camisa, pantalon, jean, vestido, blusa, ropa interior, pijama, uniforme, ropa de bebe, bolsos, accesorios, boutique, moda, almacen'),
  ('sastreria',     'Sastrerías y arreglos',   '🧵', 95, 'sastreria, modisteria, arreglos de ropa, costura, confeccion, bordado, remiendos, ajustar, dobladillo, cremallera, uniformes, disfraces'),
  ('belleza',       'Belleza y peluquerías',   '💈', 100, 'belleza, peluqueria, barberia, corte de pelo, corte, cabello, tinte, cepillado, unas, manicure, pedicure, cejas, pestanas, maquillaje, spa, depilacion, estetica, alisado'),
  ('ferreteria',    'Ferreterías',             '🔧', 110, 'ferreteria, herramientas, tornillos, puntillas, pintura, cemento, tubos, plomeria, electricos, bombillos, cables, candado, llaves, materiales de construccion, deposito'),
  ('cerrajeria',    'Cerrajerías',             '🔑', 115, 'cerrajeria, cerrajero, llaves, copia de llaves, chapa, candado, abrir puerta, cerradura, cajas fuertes, urgencias'),
  ('tecnologia',    'Celulares y tecnología',  '📱', 120, 'tecnologia, celulares, celular, telefono, accesorios, cargador, audifonos, forro, protector de pantalla, computador, portatil, reparacion de celulares, servicio tecnico, impresora, tinta, videojuegos'),
  ('papeleria',     'Papelerías',              '📚', 130, 'papeleria, utiles escolares, cuadernos, lapiceros, fotocopias, impresiones, internet, scanner, plastificar, regalos, piñatas, cartulina, libreria, miscelanea escolar'),
  ('veterinaria',   'Veterinarias y mascotas', '🐾', 140, 'veterinaria, veterinario, mascotas, perro, gato, concentrado, comida para perro, vacunas, desparasitar, peluqueria canina, accesorios para mascotas, pet shop, agropecuaria'),
  ('optica',        'Ópticas',                 '👓', 150, 'optica, gafas, lentes, anteojos, examen de la vista, optometra, lentes de contacto, monturas, gafas de sol'),
  ('salud',         'Salud y odontología',     '🩺', 160, 'salud, medico, consultorio, odontologia, odontologo, dentista, laboratorio, examenes, fisioterapia, psicologo, nutricionista, clinica, ips, vacunacion, terapia'),
  ('taller',        'Talleres y mecánica',     '🛠️', 170, 'taller, mecanico, mecanica, carro, moto, llantas, montallantas, cambio de aceite, lavadero de carros, latoneria, pintura de carros, frenos, bateria, electricista automotriz, repuestos'),
  ('motos',         'Motos y repuestos',       '🏍️', 175, 'motos, moto, repuestos de motos, casco, llantas de moto, taller de motos, accesorios para moto, soat, aceite de moto'),
  ('lavanderia',    'Lavanderías',             '🧺', 180, 'lavanderia, lavar ropa, lavado en seco, planchado, tintoreria, edredones, cobijas, tenis lavado'),
  ('gimnasio',      'Gimnasios y deporte',     '🏋️', 190, 'gimnasio, gym, entrenamiento, crossfit, yoga, pilates, baile, zumba, artes marciales, deporte, articulos deportivos, bicicletas, cancha'),
  ('floristeria',   'Floristerías y regalos',  '💐', 200, 'floristeria, flores, ramo, arreglos florales, regalos, detalles, desayuno sorpresa, globos, peluches, cumpleanos, aniversario, plantas, vivero'),
  ('hospedaje',     'Hoteles y hospedaje',     '🛏️', 210, 'hotel, hospedaje, hostal, alojamiento, posada, habitacion, residencias, motel, finca, cabanas, dormir'),
  ('hogar',         'Hogar y muebles',         '🛋️', 220, 'muebles, hogar, colchones, electrodomesticos, decoracion, cortinas, cocina, ollas, vajilla, ebanisteria, carpinteria, tapiceria, lamparas'),
  ('banco',         'Bancos',                  '🏦', 230, 'banco, consignar, consignacion, cuenta, prestamo, credito, corresponsal bancario, pagar recibos, giros, transferencia'),
  ('cajero',        'Cajeros',                 '🏧', 235, 'cajero, cajero automatico, sacar plata, retirar plata, efectivo, dinero, atm, retiro'),
  ('otro',          'Otros negocios',          '🛍️', 999, 'otros, servicios, negocio, emprendimiento')
on conflict (id) do nothing;

-- ---------- 3. Los comercios apuntan a la tabla (en vez de una lista fija) ----------
alter table public.comercios drop constraint if exists comercios_tipo_check;
alter table public.negocios_pendientes drop constraint if exists negocios_pendientes_tipo_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comercios_tipo_fk') then
    alter table public.comercios add constraint comercios_tipo_fk
      foreign key (tipo) references public.categorias_comercio(id) on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'negocios_pendientes_tipo_fk') then
    alter table public.negocios_pendientes add constraint negocios_pendientes_tipo_fk
      foreign key (tipo) references public.categorias_comercio(id) on update cascade;
  end if;
end $$;

-- ---------- 4. Categorías secundarias (hasta 2) ----------
alter table public.comercios
  add column if not exists tipos_extra text[] not null default '{}' check (cardinality(tipos_extra) <= 2);

-- Limpia las secundarias: sin repetir, sin la principal, solo categorías que existan, máximo 2
create or replace function public.comercios_tipos_extra_limpiar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.tipos_extra := coalesce((
    select array_agg(x order by pos) from (
      select distinct on (x) x, pos
        from unnest(coalesce(new.tipos_extra, '{}')) with ordinality as u(x, pos)
       where x is distinct from new.tipo
         and exists (select 1 from public.categorias_comercio c where c.id = x)
       order by x, pos
    ) s
  ), '{}');
  if cardinality(new.tipos_extra) > 2 then new.tipos_extra := new.tipos_extra[1:2]; end if;
  return new;
end $$;
revoke execute on function public.comercios_tipos_extra_limpiar() from public, anon, authenticated;

drop trigger if exists comercios_tipos_extra_limpiar on public.comercios;
create trigger comercios_tipos_extra_limpiar before insert or update on public.comercios
  for each row execute function public.comercios_tipos_extra_limpiar();

-- ---------- 5. El dueño también puede cambiar sus categorías ----------
-- (misma función de 07_vitrina.sql, con 'tipo' y 'tipos_extra' en la lista de columnas permitidas)
create or replace function public.comercios_limite_dueno()
returns trigger language plpgsql set search_path = public as $$
declare
  permitidas text[] := array['descripcion','whatsapp','telefono','horario','foto_url','recoge','domicilio','domicilio_info','actualizado_en','tipo','tipos_extra'];
begin
  -- pg_trigger_depth() > 1: cambios hechos por otros triggers (p. ej. el contador de productos)
  if tg_op <> 'UPDATE' or pg_trigger_depth() > 1 or auth.uid() is null or public.es_moderador() then
    return new;
  end if;
  if (to_jsonb(new) - permitidas) is distinct from (to_jsonb(old) - permitidas) then
    raise exception 'Solo puedes cambiar la descripción, el WhatsApp, el teléfono, el horario, la foto, la entrega y las categorías';
  end if;
  return new;
end $$;
revoke execute on function public.comercios_limite_dueno() from public, anon, authenticated;

-- ---------- 6. Comprobación ----------
-- Debe mostrar 1 fila con el número de categorías (33 o más).
select count(*) as categorias from public.categorias_comercio;
