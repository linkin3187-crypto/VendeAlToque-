# Merkap · Prueba del filtro de contenido (Fase 2AL)

**214 casos · 214 correctos (100 %)** — corridos contra la función real `buscar_palabra_prohibida()` del SQL 39 en una copia local de la base.

| Resultado esperado | Casos |
|---|---|
| ✅ Se publica | 145 |
| 👀 Se publica y va a revisión | 27 |
| ⛔ No deja publicar | 42 |

Además: los textos reales que hoy tiene la página (sus 4 anuncios, 2 productos, las descripciones de comercios y el tema del foro) pasan **sin ningún problema**.

**Truco no cubierto (conocido):** separar solo una parte de la palabra (ej. «Ma Gis TV»). Para eso quedan los reportes de la gente (3 reportes = se oculta) y la revisión con IA de la fase 2AM.

## Todos los casos

| # | Texto | Categoría | Dónde | Resultado | Palabra detectada |
|---|---|---|---|---|---|
| 1 | Huevos criollos de gallina, panal de 30 | tienda | anuncio | ✅ Se publica | — |
| 2 | Huevos de codorniz frescos por docena | comida | anuncio | ✅ Se publica | — |
| 3 | Huevos pericos con arepa y chocolate | comida | anuncio | ✅ Se publica | — |
| 4 | Desayuno: huevo perico, pan y café | comida | anuncio | ✅ Se publica | — |
| 5 | Perico de la casa (café con leche) a $2.000 | comida | anuncio | ✅ Se publica | — |
| 6 | Orquídea Phalaenopsis de vivero en matera | hogar | anuncio | ✅ Se publica | — |
| 7 | Orquídeas cultivadas, híbridas, varios colores | hogar | anuncio | ✅ Se publica | — |
| 8 | Bromelias y suculentas de vivero | hogar | anuncio | ✅ Se publica | — |
| 9 | Musgo artificial para pesebre | hogar | anuncio | ✅ Se publica | — |
| 10 | Musgo sphagnum para orquídeas, bolsa 500 g | hogar | anuncio | ✅ Se publica | — |
| 11 | Periquitos australianos, pareja con jaula | mascotas | anuncio | ✅ Se publica | — |
| 12 | Perico australiano azul, criado en casa | mascotas | anuncio | ✅ Se publica | — |
| 13 | Cacatúa ninfa (carolina) mansa | mascotas | anuncio | ✅ Se publica | — |
| 14 | Agapornis inseparables de criadero | mascotas | anuncio | ✅ Se publica | — |
| 15 | Canario belga cantor | mascotas | anuncio | ✅ Se publica | — |
| 16 | Gallinas ponedoras y pollos de engorde | mascotas | anuncio | ✅ Se publica | — |
| 17 | Conejos mini lop, hámster y curíes | mascotas | anuncio | ✅ Se publica | — |
| 18 | Peces betta y guppys para acuario | mascotas | anuncio | ✅ Se publica | — |
| 19 | Cachorros french poodle con vacunas | mascotas | anuncio | ✅ Se publica | — |
| 20 | Patos y codornices de granja | mascotas | anuncio | ✅ Se publica | — |
| 21 | Pistola de silicona caliente 40W | ferreteria | anuncio | ✅ Se publica | — |
| 22 | Pistola de calor para termoencogible | ferreteria | anuncio | ✅ Se publica | — |
| 23 | Pistola de pintura para compresor | ferreteria | anuncio | ✅ Se publica | — |
| 24 | Pistola de impacto inalámbrica DeWalt | ferreteria | anuncio | ✅ Se publica | — |
| 25 | Pistola de agua para niños, juguete de piscina | hogar | anuncio | ✅ Se publica | — |
| 26 | Pistola masajeadora muscular 6 cabezales | otros | anuncio | ✅ Se publica | — |
| 27 | Pistola de lavado para hidrolavadora | ferreteria | anuncio | ✅ Se publica | — |
| 28 | Pistola de temperatura infrarroja | tecnologia | anuncio | ✅ Se publica | — |
| 29 | Pistola Nerf con 20 dardos | hogar | anuncio | ✅ Se publica | — |
| 30 | Revolver la mezcla y hornear 30 minutos | comida | anuncio | ✅ Se publica | — |
| 31 | Batidora para revolver masas | hogar | anuncio | ✅ Se publica | — |
| 32 | Machete agrícola 18 pulgadas | ferreteria | anuncio | ✅ Se publica | — |
| 33 | Juego de cuchillos de cocina | hogar | anuncio | ✅ Se publica | — |
| 34 | Navaja multiusos Victorinox | otros | anuncio | ✅ Se publica | — |
| 35 | Coca-Cola 3 litros fría | tienda | anuncio | ✅ Se publica | — |
| 36 | Champiñones y orellanas frescos | comida | anuncio | ✅ Se publica | — |
| 37 | Ácido muriático galón para limpieza | ferreteria | anuncio | ✅ Se publica | — |
| 38 | Sérum de ácido hialurónico | tienda | anuncio | ✅ Se publica | — |
| 39 | Vasos de cristal y hielo para fiestas | hogar | anuncio | ✅ Se publica | — |
| 40 | Polvo de hornear y harina | tienda | anuncio | ✅ Se publica | — |
| 41 | Granadilla y granada fresca | comida | anuncio | ✅ Se publica | — |
| 42 | Casa en Granada, Antioquia | inmuebles | anuncio | ✅ Se publica | — |
| 43 | Silenciador para moto Pulsar 200 | autos | anuncio | ✅ Se publica | — |
| 44 | Ford Escort 1998 al día | autos | anuncio | ✅ Se publica | — |
| 45 | Encendedor de cigarrillo y cargador USB para carro | autos | anuncio | ✅ Se publica | — |
| 46 | Sabor explosivo: salsa picante artesanal | comida | anuncio | ✅ Se publica | — |
| 47 | Manopla de cocina para horno | hogar | anuncio | ✅ Se publica | — |
| 48 | Tortuga de peluche gigante | hogar | anuncio | ✅ Se publica | — |
| 49 | Tortugas ninja, colección completa | hogar | anuncio | ✅ Se publica | — |
| 50 | Iguana de peluche para niños | hogar | anuncio | ✅ Se publica | — |
| 51 | Disfraz de policía para niño talla 8 | ropa | anuncio | ✅ Se publica | — |
| 52 | Celular no reportado, con factura y caja | tecnologia | anuncio | ✅ Se publica | — |
| 53 | iPad solo wifi 64 GB | tecnologia | anuncio | ✅ Se publica | — |
| 54 | Curso de base de datos SQL y Excel | servicios | anuncio | ✅ Se publica | — |
| 55 | Pirámide de madera para decoración | hogar | anuncio | ✅ Se publica | — |
| 56 | Imitación oro, bisutería fina | ropa | anuncio | ✅ Se publica | — |
| 57 | Réplica de cuadro famoso en lienzo | hogar | anuncio | ✅ Se publica | — |
| 58 | Seguidores de línea para robótica Arduino | tecnologia | anuncio | ✅ Se publica | — |
| 59 | Aguardiente Antioqueño sellado 750 ml | tienda | anuncio | ✅ Se publica | — |
| 60 | Cerveza Club Colombia caja x24 | tienda | anuncio | ✅ Se publica | — |
| 61 | Viche artesanal del Pacífico con registro | tienda | anuncio | ✅ Se publica | — |
| 62 | Vino tinto chileno reserva | tienda | anuncio | ✅ Se publica | — |
| 63 | Lencería de encaje talla M | adultos | anuncio | ✅ Se publica | — |
| 64 | Lubricante a base de agua con registro INVIMA | adultos | anuncio | ✅ Se publica | — |
| 65 | Juguete íntimo recargable, discreto | adultos | anuncio | ✅ Se publica | — |
| 66 | Preservativos caja x12 | adultos | anuncio | ✅ Se publica | — |
| 67 | Juegos de mesa para parejas | adultos | anuncio | ✅ Se publica | — |
| 68 | Cigarrillos Marlboro cajetilla | tienda | vitrina | ✅ Se publica | — |
| 69 | Vapeador recargable sabores | tienda | vitrina | ✅ Se publica | — |
| 70 | Porro y cumbia: clases de baile | servicios | anuncio | ✅ Se publica | — |
| 71 | Se vende moto con papeles al día | autos | anuncio | ✅ Se publica | — |
| 72 | Envíos nacionales por Servientrega | otros | anuncio | ✅ Se publica | — |
| 73 | Colibrí en cerámica pintado a mano | hogar | anuncio | ✅ Se publica | — |
| 74 | Azulejos para baño, caja de 2 m² | ferreteria | anuncio | ✅ Se publica | — |
| 75 | Gorra Nike original con factura | ropa | anuncio | ✅ Se publica | — |
| 76 | Crema de caléndula y aloe vera | tienda | anuncio | ✅ Se publica | — |
| 77 | Helado sabor intenso de maracuyá | comida | anuncio | ✅ Se publica | — |
| 78 | Cuidamos tu mascota: guardería canina | servicios | anuncio | ✅ Se publica | — |
| 79 | Silla Rimax y mesa plástica | hogar | anuncio | ✅ Se publica | — |
| 80 | Juego PlayStation 5: Call of Duty | tecnologia | anuncio | ✅ Se publica | — |
| 81 | Tinto y perico en el parque | otros | anuncio | 👀 Se publica y va a revisión | perico |
| 82 | Loro real hablador, muy manso | mascotas | anuncio | 👀 Se publica y va a revisión | loro |
| 83 | Guacamaya roja con certificado de zoocriadero | mascotas | anuncio | 👀 Se publica y va a revisión | guacamaya |
| 84 | Mico titi bebé | mascotas | anuncio | 👀 Se publica y va a revisión | mico |
| 85 | Tortuga morrocoy pequeña | mascotas | anuncio | ⛔ No deja publicar | morrocoy |
| 86 | Iguana verde viva | mascotas | anuncio | 👀 Se publica y va a revisión | iguana |
| 87 | Musgo natural para el pesebre, bulto | hogar | anuncio | 👀 Se publica y va a revisión | musgo |
| 88 | Orquídea silvestre recién sacada | hogar | anuncio | 👀 Se publica y va a revisión | orquidea silvestre |
| 89 | Pistola 9mm con dos proveedores | otros | anuncio | 👀 Se publica y va a revisión | pistola |
| 90 | Escopeta de cacería | otros | anuncio | 👀 Se publica y va a revisión | escopeta |
| 91 | Revólver Smith & Wesson | otros | anuncio | 👀 Se publica y va a revisión | revolver |
| 92 | Pólvora para diciembre, voladores | otros | anuncio | 👀 Se publica y va a revisión | voladores |
| 93 | Uniforme militar original | ropa | anuncio | 👀 Se publica y va a revisión | uniforme militar |
| 94 | Lista IPTV con 5000 canales | tecnologia | anuncio | ⛔ No deja publicar | lista iptv |
| 95 | TV Box configurado con todos los canales | tecnologia | anuncio | 👀 Se publica y va a revisión | tv box configurado |
| 96 | Pague primero y le envío | otros | anuncio | 👀 Se publica y va a revisión | pague primero |
| 97 | Inversión garantizada, doble tu dinero | otros | anuncio | 👀 Se publica y va a revisión | inversion garantizada |
| 98 | Acompañantes VIP disponibles | servicios | anuncio | 👀 Se publica y va a revisión | acompanantes |
| 99 | Taser paralizador para defensa | otros | anuncio | 👀 Se publica y va a revisión | taser |
| 100 | Gallos de pelea finos | mascotas | anuncio | 👀 Se publica y va a revisión | gallos de pelea |
| 101 | Aceite de cannabis 1000 mg | tienda | anuncio | 👀 Se publica y va a revisión | cannabis |
| 102 | Venta de seguidores Instagram | servicios | anuncio | 👀 Se publica y va a revisión | venta de seguidores |
| 103 | Zapatos réplica AAA | ropa | anuncio | 👀 Se publica y va a revisión | replica aaa |
| 104 | Tabaco para pipa importado | tienda | anuncio | 👀 Se publica y va a revisión | tabaco |
| 105 | Moto sin papeles barata | autos | anuncio | 👀 Se publica y va a revisión | sin papeles |
| 106 | 🍁❄️ entregas a domicilio | otros | anuncio | 👀 Se publica y va a revisión | emojis en clave |
| 107 | 💊🍄 disponibles hoy | otros | anuncio | 👀 Se publica y va a revisión | emojis en clave |
| 108 | 🔫💥 consulta precio | otros | anuncio | 👀 Se publica y va a revisión | emojis en clave |
| 109 | Navaja mariposa de colección | otros | anuncio | 👀 Se publica y va a revisión | navaja mariposa |
| 110 | Vendo marihuana creepy de calidad | otros | anuncio | ⛔ No deja publicar | marihuana |
| 111 | Cocaína pura | otros | anuncio | ⛔ No deja publicar | cocaina |
| 112 | Tusi rosado | otros | anuncio | ⛔ No deja publicar | tusi |
| 113 | Hongos mágicos frescos | otros | anuncio | ⛔ No deja publicar | hongos magicos |
| 114 | Éxtasis MDMA pepas | otros | anuncio | ⛔ No deja publicar | mdma |
| 115 | Basuco al por mayor | otros | anuncio | ⛔ No deja publicar | basuco |
| 116 | Arma traumática con salvoconducto | otros | anuncio | ⛔ No deja publicar | arma traumatica |
| 117 | Pistola traumática Ekol | otros | anuncio | ⛔ No deja publicar | pistola traumatica |
| 118 | Munición calibre 38 | otros | anuncio | ⛔ No deja publicar | calibre 38 |
| 119 | Granada de mano de colección | otros | anuncio | ⛔ No deja publicar | granada de mano |
| 120 | Dinamita para minería | otros | anuncio | ⛔ No deja publicar | dinamita |
| 121 | Chaleco antibalas nivel III | ropa | anuncio | ⛔ No deja publicar | chaleco antibalas |
| 122 | Huevos de tortuga de río | comida | anuncio | ⛔ No deja publicar | huevos de tortuga |
| 123 | Huevos de iguana frescos | comida | anuncio | ⛔ No deja publicar | huevos de iguana |
| 124 | Carne de monte: guatín y boruga | comida | anuncio | ⛔ No deja publicar | carne de monte |
| 125 | Palma de cera para decoración | hogar | anuncio | ⛔ No deja publicar | palma de cera |
| 126 | Caracol africano vivo | mascotas | anuncio | ⛔ No deja publicar | caracol africano |
| 127 | Cédula falsa y documentos falsos | servicios | anuncio | ⛔ No deja publicar | documentos falsos |
| 128 | Billetes falsos de 50 mil | otros | anuncio | ⛔ No deja publicar | billetes falsos |
| 129 | Préstamos gota a gota sin papeleo | servicios | anuncio | ⛔ No deja publicar | gota a gota |
| 130 | Magis TV de por vida | tecnologia | anuncio | ⛔ No deja publicar | magis tv |
| 131 | Celular con IMEI cambiado | tecnologia | anuncio | ⛔ No deja publicar | imei cambiado |
| 132 | Prepago universitaria | servicios | anuncio | ⛔ No deja publicar | prepago |
| 133 | Masajes con final feliz | servicios | anuncio | ⛔ No deja publicar | masajes con final feliz |
| 134 | Vapeador desechable 5000 puffs | tienda | anuncio | ⛔ No deja publicar | vapeador |
| 135 | Cigarrillos de contrabando por caja | tienda | anuncio | ⛔ No deja publicar | cigarrillos |
| 136 | Elf Bar sabores | tienda | anuncio | ⛔ No deja publicar | elf bar |
| 137 | Vendo m4rihu4n4 buena | otros | anuncio | ⛔ No deja publicar | marihuana |
| 138 | c0c4ina disponible | otros | anuncio | ⛔ No deja publicar | cocaina |
| 139 | M.A.R.I.H.U.A.N.A a domicilio | otros | anuncio | ⛔ No deja publicar | marihuana |
| 140 | m a r i h u a n a | otros | anuncio | ⛔ No deja publicar | marihuana |
| 141 | cocaaaaina | otros | anuncio | ⛔ No deja publicar | cocaina |
| 142 | MARIHUANA EN OFERTA | otros | anuncio | ⛔ No deja publicar | marihuana |
| 143 | Mariguanas varias | otros | anuncio | ⛔ No deja publicar | mariguana |
| 144 | ar-ma de fue-go? no: arma de fuego | otros | anuncio | ⛔ No deja publicar | arma de fuego |
| 145 | t.u.s.i | otros | anuncio | ⛔ No deja publicar | tusi |
| 146 | Municiones 9mm | otros | anuncio | ⛔ No deja publicar | municiones |
| 147 | Ma Gis TV | tecnologia | anuncio | ✅ Se publica | — |
| 148 | Vendo LSD cartones | otros | anuncio | ⛔ No deja publicar | lsd |
| 149 | v4pe sabores | tienda | anuncio | ⛔ No deja publicar | vape |
| 150 | Vapeador recargable | tienda | vitrina | ✅ Se publica | — |
| 151 | Cigarrillos sueltos | tienda | vitrina | ✅ Se publica | — |
| 152 | Marihuana | tienda | vitrina | ⛔ No deja publicar | marihuana |
| 153 | Tabaco en rama | tienda | vitrina | ✅ Se publica | — |
| 154 | Hookah con mangueras | tienda | vitrina | ✅ Se publica | — |
| 155 | Nevera Haceb 250 litros, poco uso | hogar | anuncio | ✅ Se publica | — |
| 156 | Lavadora LG 17 kg con garantía | hogar | anuncio | ✅ Se publica | — |
| 157 | Arriendo apartamento 2 habitaciones Envigado | inmuebles | anuncio | ✅ Se publica | — |
| 158 | Casa lote en Sabaneta con parqueadero | inmuebles | anuncio | ✅ Se publica | — |
| 159 | Moto AKT 125 modelo 2021 papeles al día | autos | anuncio | ✅ Se publica | — |
| 160 | Bicicleta todoterreno rin 29 | autos | anuncio | ✅ Se publica | — |
| 161 | Llantas Michelin rin 15 usadas | autos | anuncio | ✅ Se publica | — |
| 162 | Camioneta Mazda BT-50 4x4 | autos | anuncio | ✅ Se publica | — |
| 163 | Repuestos para Chevrolet Spark | autos | anuncio | ✅ Se publica | — |
| 164 | iPhone 13 128 GB libre de operador | tecnologia | anuncio | ✅ Se publica | — |
| 165 | Portátil Lenovo i5 16 GB RAM | tecnologia | anuncio | ✅ Se publica | — |
| 166 | Televisor Samsung 55 pulgadas 4K | tecnologia | anuncio | ✅ Se publica | — |
| 167 | Audífonos Bluetooth JBL | tecnologia | anuncio | ✅ Se publica | — |
| 168 | Consola Xbox Series S con control | tecnologia | anuncio | ✅ Se publica | — |
| 169 | Cámara Canon EOS para fotografía | tecnologia | anuncio | ✅ Se publica | — |
| 170 | Sofá cama 3 puestos gris | hogar | anuncio | ✅ Se publica | — |
| 171 | Comedor de 6 puestos en madera | hogar | anuncio | ✅ Se publica | — |
| 172 | Colchón doble ortopédico | hogar | anuncio | ✅ Se publica | — |
| 173 | Licuadora Oster 10 velocidades | hogar | anuncio | ✅ Se publica | — |
| 174 | Cuna para bebé con colchón | hogar | anuncio | ✅ Se publica | — |
| 175 | Plantas ornamentales y materas | hogar | anuncio | ✅ Se publica | — |
| 176 | Empanadas por encargo, cien unidades | comida | anuncio | ✅ Se publica | — |
| 177 | Almuerzos ejecutivos a domicilio | comida | anuncio | ✅ Se publica | — |
| 178 | Tortas de cumpleaños personalizadas | comida | anuncio | ✅ Se publica | — |
| 179 | Arepas de chócolo congeladas | comida | anuncio | ✅ Se publica | — |
| 180 | Pan de bono y buñuelos calientes | comida | anuncio | ✅ Se publica | — |
| 181 | Salchipapas y perros calientes | comida | anuncio | ✅ Se publica | — |
| 182 | Frutas y verduras frescas de la plaza | tienda | anuncio | ✅ Se publica | — |
| 183 | Mercado completo a domicilio | tienda | anuncio | ✅ Se publica | — |
| 184 | Carne de res y cerdo por libra | tienda | anuncio | ✅ Se publica | — |
| 185 | Plomero 24 horas, destapes | servicios | anuncio | ✅ Se publica | — |
| 186 | Electricista certificado RETIE | servicios | anuncio | ✅ Se publica | — |
| 187 | Clases de inglés virtuales | servicios | anuncio | ✅ Se publica | — |
| 188 | Mudanzas y acarreos en camión | servicios | anuncio | ✅ Se publica | — |
| 189 | Peluquería a domicilio, corte y tinte | servicios | anuncio | ✅ Se publica | — |
| 190 | Arreglo de computadores y celulares | servicios | anuncio | ✅ Se publica | — |
| 191 | Pintura de casas y apartamentos | servicios | anuncio | ✅ Se publica | — |
| 192 | Mecánico de motos a domicilio | servicios | anuncio | ✅ Se publica | — |
| 193 | Niñera con experiencia y referencias | servicios | anuncio | ✅ Se publica | — |
| 194 | Se necesita mesero fin de semana | empleos | anuncio | ✅ Se publica | — |
| 195 | Busco empleo como conductor, licencia C2 | empleos | anuncio | ✅ Se publica | — |
| 196 | Vacante auxiliar contable | empleos | anuncio | ✅ Se publica | — |
| 197 | Taladro percutor Bosch | ferreteria | anuncio | ✅ Se publica | — |
| 198 | Cemento gris bulto 50 kg | ferreteria | anuncio | ✅ Se publica | — |
| 199 | Pintura Pintuco galón blanco | ferreteria | anuncio | ✅ Se publica | — |
| 200 | Escalera de aluminio 6 pasos | ferreteria | anuncio | ✅ Se publica | — |
| 201 | Tubería PVC y accesorios | ferreteria | anuncio | ✅ Se publica | — |
| 202 | Caja de herramientas completa | ferreteria | anuncio | ✅ Se publica | — |
| 203 | Tenis Adidas originales talla 40 | ropa | anuncio | ✅ Se publica | — |
| 204 | Vestido de fiesta largo | ropa | anuncio | ✅ Se publica | — |
| 205 | Uniformes escolares colegio San José | ropa | anuncio | ✅ Se publica | — |
| 206 | Chaqueta de cuero para moto | ropa | anuncio | ✅ Se publica | — |
| 207 | Ropa de bebé por paquete | ropa | anuncio | ✅ Se publica | — |
| 208 | Concentrado para perro 15 kg | mascotas | anuncio | ✅ Se publica | — |
| 209 | Arena para gato aglomerante | mascotas | anuncio | ✅ Se publica | — |
| 210 | Guacal para transporte de mascotas | mascotas | anuncio | ✅ Se publica | — |
| 211 | Peluquería canina y baño | mascotas | anuncio | ✅ Se publica | — |
| 212 | Acuario de 60 litros con filtro | mascotas | anuncio | ✅ Se publica | — |
| 213 | Jaula grande para aves | mascotas | anuncio | ✅ Se publica | — |
| 214 | Bulto de maíz para gallinas | mascotas | anuncio | ✅ Se publica | — |
