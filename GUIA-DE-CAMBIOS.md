# Guía de cambios de la Fase 1: qué se hizo y por qué

Pensada para aprender: cada cambio dice **qué**, **por qué** y **dónde** verlo en el código.

## 1. Una sola fuente de verdad (menos código repetido)

**Qué:** nuevo `utils.js` con todo lo que se copiaba en varios archivos: `esc()`, `mostrarToast()`, `EDITOR`, modales, helpers de mapa. Las categorías viven solo en `CATEGORIAS` (`data.js`); `index.html`, el formulario y el foro se dibujan desde ahí.

**Por qué:** antes, para añadir una categoría había que tocar 4 sitios y olvidarse de uno era un bug. Regla de oro: *si copias y pegas código, probablemente debe ser una función o un dato compartido.*

**Dónde:** `utils.js`, `data.js` (`CATEGORIAS`, `CATEGORIAS_FORO`), `app.js` (`renderizarCategorias`).

## 2. Seguridad

| Problema | Solución | Por qué |
|---|---|---|
| Títulos y descripciones se pegaban con `innerHTML` sin escapar | `esc()` en toda plantilla | Un anuncio con `<img src=x onerror=...>` ejecutaba código en el navegador de quien lo viera (XSS). Lo comprobé con una prueba automática. |
| El `escaparHTML` viejo no escapaba comillas | `esc()` convierte `& < > " '` | Dentro de `src="..."` una comilla permitía "salirse" del atributo. |
| Contraseñas en texto plano | Hash SHA-256 con sal (`hashPassword`) | Si alguien lee `localStorage`, no ve la contraseña. **Sigue siendo provisional**: la seguridad real es de servidor (Fase 2). |
| URLs de imagen sin validar | `urlSegura()` solo deja `https:` y `data:image/` | Evita `javascript:` en atributos. |
| Número de WhatsApp visible en la página de detalle | Solo el botón, nunca el número | Dificulta que robots lo recojan (más medidas en Fase 4). |

## 3. Mapa

- **Clusters** (`leaflet.markercluster`): pines cercanos se agrupan en un círculo con número.
- **Lista ↔ mapa:** "📍 Mapa" en una tarjeta vuela al pin y abre su ventana; tocar un pin resalta su tarjeta (`verEnMapa`, `resaltarTarjeta`). En celular no se hace scroll automático para no sacarte del mapa.
- **`fitBounds`:** el mapa se encuadra solo sobre los resultados filtrados.
- **Buscar en esta zona** y filtro de **distancia** + orden "más cercanos" (fórmula de Haversine en `utils.js`).
- **GPS solo al tocar un botón**, nunca al cargar: los navegadores penalizan pedirlo sin acción del usuario y asusta.
- **Mapa fijo** (`sticky`) en escritorio mientras haces scroll en la lista.
- `ResizeObserver` reemplaza los `setTimeout(invalidateSize)` "a ciegas".
- El mapa del formulario se crea una vez y se reutiliza (antes se destruía y recreaba cada vez).
- Se usa `tile.openstreetmap.org` (sin subdominios `{s}`, como recomienda OSM). Con mucho tráfico habrá que cambiar a un proveedor de teselas con plan propio (MapTiler, Stadia).

## 4. Ventanas y despliegue de clasificados

- **Página propia por anuncio** (`anuncio.html?id=…`): galería con miniaturas y flechas del teclado, mapa, WhatsApp con mensaje prellenado, "Cómo llegar", compartir (menú nativo del celular o copia el enlace) y anuncios similares. *Por qué:* un acordeón de 600 px dentro de una cuadrícula desalineaba tarjetas y no se podía compartir por enlace.
- **Formulario por pasos** (qué vendes → dónde → contacto), a pantalla completa en celular. Valida cada paso con las reglas nativas del HTML (`required`, `pattern`). Hasta 3 fotos.
- **Modales unificados** (`utils.js`): clic fuera cierra (excepto el formulario largo, para no perder lo escrito), `Escape` cierra, el fondo no hace scroll.
- **Paginación** ("Mostrar más (N restantes)") y **esqueletos de carga**.
- **Foto que falla:** queda el icono de la categoría (la `<img>` va encima de un fondo con el icono; si falla se quita).

## 5. Eficiencia y buenas prácticas de código

- **Debounce** del buscador (250 ms): antes cada tecla recreaba todos los marcadores.
- **`addLayers` en lote** para los marcadores.
- **Delegación de eventos:** un solo listener en el contenedor atiende todas las tarjetas, incluso las futuras. Se acabaron los `onclick="..."` en el HTML y la variable global `event`.
- **Búsqueda sin tildes** (`normalizar`): "itagui" encuentra "Itagüí".
- **Guardado seguro** (`guardarAnuncios` devuelve `true/false`): si `localStorage` se llena (~5 MB) se avisa y se deshace en vez de fingir que guardó.
- **Migración de datos** (`VERSION_DATOS`, `normalizarAnuncio`): los anuncios viejos (con `imagen`) se convierten a `fotos[]`; los de ejemplo se actualizan sin borrar los tuyos.
- **Precio normalizado** al publicar (`$1.200.000` siempre, aunque escribas `1200000`).
- **Cache busting** (`?v=2`): explica por qué en tu captura salía una versión vieja.

## 6. Bugs corregidos

- Selector de departamento del formulario duplicaba "Antioquia".
- `urlGoogleMaps` agregaba `&destination_place_id=` vacío.
- Editar un anuncio cambiaba su dueño y su fecha.
- Fotos del iPhone (salía una moto) y de las empanadas (samosas): se dejaron vacías. **Tarea para ti:** sube fotos reales con "Editar" o cambia las URLs en `data.js`.
- Código muerto eliminado: `modal-foro-ver`, `enviarRespuesta`, `anuncioExpandido`, `_loadOriginal`, `actualizarCiudadesForm` vacía (ahora llena una lista de sugerencias de ciudad).

### Fase 2AQ · El sello dice exactamente qué se comprobó
- `tienda.html` / `tienda.js`: nuevo aviso `#t-aviso-sello` (clase `aviso-verificado` en `styles.css`) para comercios verificados; distingue «en persona» y «por teléfono», avisa si el sello pasó los 12 meses y enlaza a `terminos.html#sellos`. El aviso «Ubicado» no cambia (solo gana el enlace).
- `terminos.html`: sección **4A.1 Sellos de verificación** (qué es y qué NO es el sello) y referencias a ella.
- `registrar-negocio.html`: línea de responsabilidad del dueño. Versión de caché 78.
- Por qué: un sello sin explicación se puede leer como «negocio legal y confiable»; el aviso claro y visible protege al usuario y a Merkap (sin reemplazar la revisión del abogado).

### Fase 2AQ.1 · El sello en persona solo promete la ubicación
- `data.js` (`SELLOS[3]`), `tienda.js`, `terminos.html`, `comercios.html/js`, `admin-comercios.html`: «Verificado en persona» → «Ubicación confirmada en persona»; sin «y atendiendo». Pruebas actualizadas. Caché v79.
- Por qué: el sello debe afirmar solo lo mínimo que siempre se comprueba en la visita.

### Fase 2AQ.2 · El 🧾 de droguerías dice «declarados» y no contradice al sello
- `data.js`: `BADGE_SALUD` con el nombre nuevo, `saludVencido`, `muestraSelloSalud` (salud + datos + nivel ≥ 2 + menos de 12 meses) y `AVISO_SALUD`.
- `tienda.js`, `comercios.js`, `mi-tienda.js`: usan `muestraSelloSalud`; el dueño ve por qué no aparece (falta verificar o venció). `comercios.html` y `terminos.html` con el texto nuevo. Pruebas nuevas. Caché v80.
- Por qué: un distintivo «sanitario» al lado de «Ubicado» se contradecía y prometía una revisión que Merkap no hace.

### Fase 2AQ.3 · Avisos plegables con ⓘ
- `tienda.js`: `avisoPlegable(resumen, detalle)` usa `<details>`/`<summary>` (accesible, sin JavaScript extra); `styles.css`: `.aviso-plegable` y el botón `ico-info` (ⓘ cerrado, ✕ abierto). Caché v81.
- Por qué: el aviso completo ocupaba media pantalla en el celular; lo esencial (sello, fecha y «Llama o escribe antes de ir») sigue siempre visible.

### Fase 2AP-4b · Promociones en el inicio y en campañas
- `index.html` + `app.js` (`pintarPromosInicio`): carrusel `#promos-inicio` con `promosVigentes` de comercios con `vitrinaPublica`; reusa el estilo `sel-*` de la Selección del día (`pi-*` en `styles.css`).
- `comercios.html/js`: filtro `co-promo` y parámetro `?promo=1`.
- `tienda.js`: `#promo-ID` resalta esa promo; `#promos` sin promos vigentes avisa y deja la vitrina.
- `marketing.html/js`: destino `promo` (`CON_ID`, `promosObjetivo`, `llenarPromos`, `precioPieza`); `piezas.js` dibuja `o.precio` (antes tachado · ahora · −%). Caché v82.

### Fase 2AR · Avisos y novedades editables (SQL 44)
- `supabase/44_avisos_inicio.sql`: tabla `avisos_inicio` (RLS: el público ve los visibles y vigentes; solo `es_admin()` escribe), `aviso_contar()` para vistas y clics, `version` que sube al cambiar el texto, y `desde/hasta/patrocinado` en `banners_inicio`.
- `data.js`: `ESTILOS_AVISO`, `UBICACIONES_AVISO`, `PUBLICOS_AVISO`, `avisoHTML`, `cargarAvisos`, `guardarAvisoDB`, `fechaVigente`, `estadoFechas`; el carrusel filtra por fechas y muestra «Patrocinado».
- `app.js`: `pintarAvisosInicio` (1 aviso por lugar; sin la tabla vuelve `pintarNovedad`). `index.html`: 4 lugares `#avisos-*` y el bloque de promos antes de los anuncios.
- `editar-inicio.html/js`: sección «📣 Avisos y novedades» y fechas/«Patrocinado» en el carrusel. Caché v83.

### Fase 2AP-4c · Números de cada promo (SQL 45)
- `supabase/45_numeros_promos.sql`: `promo_eventos` (cerrada, 1 por persona/tipo/día), `registrar_promo_evento()` (no cuenta al dueño ni al administrador) y `promo_resumen()` (solo dueño o administrador).
- `data.js`: `registrarPromoEvento`, `cargarNumerosPromos`, `numerosPromoHTML`; «Pedir esta promo» lleva `data-promo-wa`.
- `tienda.js` anota vista / inicio / whatsapp; `mi-tienda.js` muestra números, resultado y el aviso de fin; `app.js` `pintarFinPromoInicio`. Caché v84.

### Fase 2AS · Categorías en la barra de filtros
- `index.html` y `anuncios.html`: `#filtro-categoria`, `#filtro-subcategoria` y `#filtros-detalle` dentro de la caja de filtros; «Ordenar por» visible (`.ordenar-caja`).
- `anuncios-comun.js`: `chipsCategoriasHTML` ahora da `<option>`s, `pintarCategoriasSelect`, `conectarSelectCategorias`; `app.js` y `anuncios.js` usan los desplegables. Caché v85.

## 7. Lo que NO se cambió y por qué

- **Tailwind por CDN:** se mantiene para que sigas subiendo archivos desde el navegador de GitHub sin herramientas. Pasar a Vite + Tailwind compilado tiene sentido junto con la Fase 2/3, cuando haya `npm` y un proceso de despliegue.
- **Estructura plana (sin carpetas):** se mantiene por la misma razón.
- **Todo sigue en `localStorage`:** el límite real de este prototipo. Se resuelve en la Fase 2.

## Conceptos para estudiar (en este orden)

1. XSS y por qué se escapa la salida.
2. Delegación de eventos (`addEventListener` + `closest`).
3. Promesas y `async/await` (`pedirUbicacion`).
4. `localStorage`: límites, errores y migraciones.
5. Debounce.
6. Caché del navegador y cache busting.

## Fase 2J · Publicaciones en carrusel, «Cerrar sesión» visible y «Mi tienda» 3D

- **Carrusel:** `#contenedor-anuncios` pasó de cuadrícula a fila con scroll horizontal (`.carrusel-anuncios` en `styles.css`, `scroll-snap`). Las tarjetas son las mismas (`tarjetaHTML`), solo con ancho fijo de 15.5rem. Flechas `‹ ›` en pantallas ≥640 px.
- **Cerrar sesión:** botón `#btn-cerrar-sesion-header` en el encabezado; `actualizarUIAuth()` lo muestra solo con sesión.
- **Mi tienda:** el enlace `#link-mi-tienda` usa las clases `btn-3d btn-3d-comercios` (mismo sitio).
- **Revertir:** en GitHub, PR de esta fase → **Revert** → Merge → check verde → Ctrl+F5. No hay SQL.

## Fase 2K · Subcategorías, expansión de municipios y popup del pin

**SQL:** `supabase/11_subcategorias_y_expansion.sql` (copiar → SQL Editor → Run → «Success», ANTES de fusionar el PR). Es repetible.

- **Subcategorías:** columna `anuncios.subcategoria` (solo guarda un id corto, ej. `motos`). La lista vive en `SUBCATEGORIAS` (data.js): para agregar una opción nueva se añade una línea ahí, sin SQL. En el formulario es obligatoria si la categoría tiene subcategorías; en el inicio salen chips bajo las categorías para filtrar. Los anuncios viejos quedan sin subcategoría y se ven igual.
- **Expansión:** el formulario lista los 33 departamentos y, en la ciudad, «➕ Mi municipio no está en la lista…». Al publicar se llama a la función `crear_municipio` (security definer): valida el nombre, ignora tildes/mayúsculas para no duplicar, exige ubicación dentro de Colombia, permite máx. 3 municipios nuevos por persona cada 24 h y lo deja **activo**. Para quitar uno falso: `update public.municipios set activo = false where id = <id>;`
- **Popup del pin:** Leaflet cierra la ventanita de un pin cuando su capa se repinta (cambio de sesión, filtros, datos que llegan tarde). Ahora `renderizarMarcadores` y `pintarComercios` recuerdan el pin abierto y lo reabren, y al tocar un pin ya no se desplaza la página.
- **Carrusel:** al llegar casi al final carga más anuncios solo; al buscar o filtrar vuelve al inicio.
- **Revertir:** PR de esta fase → **Revert**. El SQL puede quedarse (la columna y la función no estorban); para quitarlos: `alter table public.anuncios drop column subcategoria; drop function public.crear_municipio(text,text,double precision,double precision);`

## Fase 2L · Filtros visibles, «Cerca de mí» y barra superior ordenada

**No hay SQL.** Solo cambian `index.html`, `app.js`, `utils.js`, `styles.css`, `comercios.html` y `comercios.js`.

- **Clasificados:** 📍 Departamento y 🏘️ Municipio/ciudad salen del panel avanzado y quedan siempre visibles, junto a «Ordenar por». Nuevo botón **📡 Cerca de mí** (`#btn-cerca-anuncios`, función `cercaDeMiAnuncios` en app.js): pide el GPS solo al tocarlo, ordena por cercanía y centra el mapa; al tocar otra vez se apaga. «⚙️ Más filtros ▾» ahora es un botón con una nota (*Precio, estado, distancia, solo con foto…*).
- **Comercios:** **📡 Comercios cerca de mí** (`#btn-cerca-comercios`, `cercaDeMiComercios`) en la sección de comercios del inicio y en `comercios.html` (`#co-cerca`). El GPS compartido está en `utils.js` (`obtenerGPS`, `textoErrorGPS`).
- **Barra superior:** con sesión, el botón de usuario pasa a «👤 Nombre ▾» y abre un menú (`#menu-cuenta`) con **Mis anuncios, Mi tienda y Cerrar sesión**. Se cierra con clic fuera o Escape. Ya no existe `#btn-cerrar-sesion-header`. Favoritos y «Publicar gratis» (parpadeante) siguen en la barra.
- **Revertir:** PR de esta fase → **Revert** → Merge → check verde → Ctrl+F5. No hay nada que deshacer en Supabase.

## Fase 2M · Filtros independientes: clasificados y comercios

**No hay SQL.** Cambian `index.html`, `app.js` y `comercios.js`.

- **Causa del problema:** la sección de comercios del inicio reutilizaba el departamento, la ciudad y el buscador de clasificados. Si en clasificados quedaba elegida una ciudad sin comercios (p. ej. San Pedro de los Milagros), «Comercios cerca de mí» mostraba 0.
- **Ahora cada sección tiene los suyos:**
  - *Clasificados:* buscador del inicio, departamento, municipio/ciudad, «Ordenar por», «📡 Cerca de mí» y «Más filtros». Solo afectan a los anuncios y al mapa de anuncios.
  - *Comercios:* 🔎 «Buscar comercio…» propio, departamento (aparece si hay comercios en más de uno), municipio, categorías y «📡 Comercios cerca de mí». Solo afectan a la lista de comercios.
- **«Comercios cerca de mí»:** usa su propia ubicación (`ubicacionComercios`), quita el filtro de municipio/departamento de comercios para ver los más cercanos de toda la zona, y cada tarjeta muestra «📏 A 350 m de ti». No activa ni apaga el «Cerca de mí» de clasificados.
- Si no hay resultados aparece el botón «Ver todos los comercios» que limpia los filtros de comercios.
- **Corregido:** en `comercios.html` («Comercios cerca de mí») la distancia se calculaba con los argumentos mal puestos y no ordenaba bien.
- **Revertir:** PR de esta fase → **Revert** → Merge → check verde → Ctrl+F5.

## Fase 2N · Página «Todos los anuncios» (`anuncios.html`)

**No hay SQL.** Archivos nuevos: `anuncios.html`, `anuncios.js`, `anuncios-comun.js`. Cambian `index.html` y `app.js`.

- **En el inicio:** bajo el carrusel de publicaciones hay un botón **«📋 Ver todos los anuncios (N) →»** y, junto al título «📢 Publicaciones», un enlace **«Ver todos →»**. Los dos llevan los filtros que tengas puestos (ciudad, categoría, búsqueda…).
- **La página nueva** (`anuncios.html`): cuadrícula (1 columna en celulares pequeños, 2 en celular, 3 en tablet, 4 en PC), los mismos filtros del inicio (buscador, categorías y subcategorías, departamento, municipio, 📡 Cerca de mí, Ordenar por, Más filtros), carga 24 anuncios y trae más solos al bajar.
- **Filtros en el enlace:** por ejemplo `anuncios.html?ciudad=Envigado&cat=autos&pmax=20000000`. El botón **«🔗 Compartir esta búsqueda»** abre el menú de compartir del celular (o copia el enlace). No se guarda tu ubicación GPS en el enlace.
- **Código compartido:** `anuncios-comun.js` tiene la tarjeta del anuncio, el filtrado, las listas de departamento/ciudad y las subcategorías. Lo usan el inicio y la página nueva: si cambias un filtro ahí, cambia en las dos.
- **«+ Publicar gratis»** de la página nueva va a `index.html#publicar`, que abre el formulario (o el registro si no hay sesión).
- **Revertir:** PR de esta fase → **Revert** → Merge → check verde → Ctrl+F5.

## Fase 2O · Directorio completo de comercios (`comercios.html`)

**No hay SQL.** Cambian `comercios.html`, `comercios.js`, `data.js`, `index.html` y `app.js`.

- **Antes** el directorio mostraba solo los verificados. **Ahora** muestra todos los comercios activos con su sello honesto: «Ubicado» (dato de mapa, sin verificar), «Verificado por teléfono» o «Verificado en persona». Los ocultos no salen. Orden por defecto «Recomendados»: verificados primero, luego los que tienen vitrina, luego por nombre.
- **Filtros:** 🔎 buscador; categorías con conteo (solo las que tienen comercios); 📍 departamento y 🏘️ municipio con conteo; 📡 Comercios cerca de mí (con la distancia en cada tarjeta); Ordenar por (Recomendados, Más cercanos, ⭐ Mejor calificados, Nombre). En **⚙️ Más filtros:** verificación (todos / solo verificados / solo en persona / solo sin verificar), ⭐ calificación, 🟢 Abierto ahora y 🛍️ Con vitrina.
- **Calificación:** el filtro y el orden por estrellas ya están programados, pero aparecen desactivados con la nota «Muy pronto» hasta la fase 2P (SQL 12). `data.js` ya lee `calif_promedio` y `calif_total`; si esas columnas no existen valen 0.
- **Enlace para compartir:** los filtros quedan en el enlace (ej. `comercios.html?tipo=farmacia&muni=4&abierto=1`) y el botón «🔗 Compartir esta búsqueda» lo envía. «Ver directorio completo →» del inicio lleva la categoría, búsqueda y ubicación elegidas en la sección de comercios.
- **Revertir:** PR de esta fase → **Revert** → Merge → check verde → Ctrl+F5.

## Fase 2P · Calificaciones con estrellas y opiniones (estilo Google)

**SQL:** `supabase/12_calificaciones.sql` — copiar → Supabase → SQL Editor → Run → debe terminar mostrando 2 filas (`calificaciones_comercio` y `reportes_calificacion`). **Ejecutarlo ANTES de fusionar el PR.** Es repetible.

- **Dónde se califica:** en la ficha del comercio (`tienda.html`), sección **⭐ Opiniones**: promedio grande, estrellas, barras por estrella (5★…1★), botón **«✍️ Escribir una opinión»**, lista ordenable (recientes, mejor, peor). Cada tarjeta del directorio, del inicio y la ventanita del mapa tienen **«⭐ Calificar»** (abre la ficha con el formulario: `tienda.html?id=N#opinar`).
- **Reglas (las impone la base de datos, no solo la página):**
  - Leer: todos, sin cuenta. Escribir: con cuenta gratis. Sin cuenta, «Calificar» lleva al registro y, al entrar, vuelve sola a la ficha.
  - 1 opinión por persona y comercio; se puede editar o borrar. Máximo 20 opiniones nuevas por persona al día.
  - El dueño **no** puede calificar su negocio, pero **sí responder** en público cada opinión (función `responder_calificacion`).
  - El nombre visible sale del perfil (nadie puede firmar con otro nombre).
  - `comercios.calif_promedio` y `calif_total` se recalculan solos; nadie los edita a mano.
  - Cualquiera con cuenta puede **reportar** una opinión. En `moderacion.html` → «⭐ Opiniones reportadas»: **Ocultar** (deja de contar en el promedio; el autor la sigue viendo con aviso), Revisado o Descartar. **Las negativas honestas no se ocultan.**
- **Transparencia:** el promedio se muestra siempre (aunque haya 1 opinión). Solo al ordenar «Mejor calificados» se usa un promedio ponderado (4,8 con 40 opiniones va antes que 5,0 con 1).
- **También:** en un comercio «Ubicado» (sin verificar) el público ya no ve «Solo tú ves esta tienda»; ve un aviso honesto de que aún no está verificado.
- **Revertir:** PR de esta fase → **Revert**. El SQL puede quedarse (no estorba). Para quitarlo: `drop table public.reportes_calificacion; drop table public.calificaciones_comercio; drop function public.responder_calificacion(bigint, text); alter table public.comercios drop column calif_promedio, drop column calif_total;`

## Fase 2R · «Reclamar comercio» y «Editar mi publicación»

**No hay SQL.** Cambian `styles.css`, `comercios.js`, `tienda.js`, `app.js`, `anuncios-comun.js`, `anuncios.js`, `anuncio.html` y `anuncio.js`.

- **🔑 Reclamar comercio:** en los comercios **sin dueño** (`owner_id` vacío) aparece una etiqueta amarilla pequeña que titila suave, «🔑 ¿Es tu negocio? Reclámalo», en la foto de la tarjeta (directorio e inicio) y en la ventanita del mapa. Abre el formulario de solicitud ya en «Soy el dueño: quiero administrar mi ficha» (`comercios.html?solicitar=ID&tipo=reclamar`). En la ficha del comercio sale como burbuja flotante abajo a la izquierda; se cierra con ✕ y no vuelve a salir en esa sesión. Los comercios con dueño no la muestran. Con «reducir movimiento» activado no titila. Clases: `.badge-reclamar`, `#burbuja-reclamar`.
- **✏️ Editar mi publicación:** el dueño de un anuncio ve el botón amarillo en sus tarjetas (inicio y «Todos los anuncios») y arriba del título al abrir su anuncio. Abre el formulario de edición del inicio con `index.html?editar=ID`. Si otra persona usa ese enlace, ve «Solo el dueño puede editar esta publicación».
- **Revertir:** PR de esta fase → **Revert** → Merge → check verde → Ctrl+F5.

## Fase 2S · Contacto con registro rápido + 📞 Llamar en anuncios

**SQL en 2 partes (el orden importa):**
1. `supabase/13_contacto_anuncios.sql` → **ANTES** de fusionar el PR. Agrega `telefono`, hace el WhatsApp opcional (al menos uno de los dos), crea `tiene_whatsapp`/`tiene_telefono`, la función `contacto_anuncio(id)` y el registro privado `contactos_anuncio`. No quita nada: la página actual sigue igual. Al final debe mostrar 3 filas.
2. Fusionar el PR → esperar el check verde → Ctrl+F5.
3. `supabase/13b_proteger_contacto.sql` → **DESPUÉS**. Cierra la lectura directa de `whatsapp` y `telefono` en la tabla `anuncios`. Al final debe mostrar 2 filas con `false`. (Si lo ejecutas antes de fusionar, la página vieja deja de cargar anuncios hasta que fusiones.) Si algún día agregas una columna nueva a `anuncios`, vuelve a ejecutar este archivo.

**Cómo funciona:**
- Todos ven los anuncios, el mapa (zona aproximada) y **Compartir**. Los botones 💬 WhatsApp, 📞 Llamar y 🗺️ Cómo llegar se ven igual que siempre.
- Sin cuenta, al tocarlos sale la **ventana de registro rápido** (`#modal-rapido`, en `data.js`): nombre, correo y contraseña (o «Ya tengo cuenta»). Al terminar dice «¡Listo, Nombre!» con un botón grande para abrir el WhatsApp, llamar o ver cómo llegar.
- El número **nunca viaja en la página**: al tocar el botón, `contacto_anuncio(id)` lo entrega solo a personas con cuenta, con límite de 60 anuncios distintos por día (contra robots). El dueño y los moderadores no tienen límite.
- **Confirmación de correo:** si en Supabase está activado *Confirm email*, la ventana dice «Revisa tu correo»; el enlace del correo vuelve al mismo anuncio (`?contactar=whatsapp&anuncio=ID`) y muestra el botón para continuar. Para eso, en *Authentication → URL Configuration → Redirect URLs* agrega `https://linkin3187-crypto.github.io/VendeAlToque-/**`.
- **Publicar:** «¿Cómo te contactan?» → 💬 WhatsApp y/o 📞 Teléfono (celular o fijo 60X), al menos uno. Botón «Usar el mismo número del WhatsApp».
- Los **comercios siguen libres** (sin cuenta).
- **Revertir:** primero, en el SQL Editor, deshacer la parte 2: `grant select on public.anuncios to anon, authenticated;` Luego el PR → **Revert**. La parte 1 puede quedarse.

## Fase 2T · Entrar con Google

**Archivos:** `data.js` (`entrarConGoogle`, `BOTON_GOOGLE_HTML`, `enviarRefSiFalta`), `app.js` (botón en «Iniciar sesión»), registro rápido (botón arriba). **SQL:** `supabase/14_login_google.sql` (nombre desde Google y código `?ref=` para cuentas de Google).

**Orden:** (1) configurar Google (abajo) → (2) ejecutar el SQL 14 (debe mostrar 1 fila `asignar_ref_inicial`) → (3) fusionar el PR → check verde → Ctrl+F5. Si fusionas sin configurar Google, el botón solo dice «Entrar con Google aún no está activo. Usa tu correo» (no rompe nada).

**Configurar Google (una vez):**
1. Supabase → **Authentication → Sign In / Providers → Google**: copia la **Callback URL** que muestra (será parecida a `https://fhxglflgldwecyljphfx.supabase.co/auth/v1/callback`).
2. [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto (ej. «MercaFree») → **Google Auth Platform**:
   - **Branding:** nombre de la app, correo de soporte y logo (el nombre que verá la gente al entrar).
   - **Audience:** *External* (cualquier cuenta de Google) y publícala («Publish app»).
   - **Data Access:** deja `email` y `profile` y agrega `openid`.
   - **Clients → Create client → Web application:** en *Authorized JavaScript origins* pon `https://linkin3187-crypto.github.io`; en *Authorized redirect URIs* pega la Callback URL del paso 1 → **Create** → copia el **Client ID** y el **Client secret**.
3. Vuelve a Supabase → Google → actívalo, pega el Client ID y el Client secret → **Save**.
4. Supabase → **Authentication → URL Configuration → Redirect URLs**: agrega `https://linkin3187-crypto.github.io/VendeAlToque-/**` (si ya lo hiciste en la 2S, no hace falta repetir).
5. Cuando tengas dominio propio (2H), agrega también ese dominio en los pasos 2 (origins) y 4.

**Cómo funciona:** en la ventana de «Iniciar sesión» y en el registro rápido aparece **«Continuar con Google»** arriba. Desde un anuncio, vuelve al mismo anuncio con el botón para contactar listo. El nombre se toma de Google. El código `?ref=` (QR de tiendas, grupos) se guarda una sola vez justo después de entrar.

**Revertir:** PR → **Revert**. Para apagar Google sin tocar código: Supabase → Providers → Google → desactivar.

## Fase 2T.1 · Botón «Llamar» más visible

**No hay SQL.** El botón de llamar pasa de morado con 📞 (se perdía) a **teléfono blanco sobre azul cielo** (`.btn-llamar` en `styles.css`, ícono `ICONO_TEL` en `utils.js`), en tarjetas, mapa, anuncio y barra del celular. **Revertir:** PR → Revert.

## Fase 2U · Mapa de ubicación en la ficha del comercio

**No hay SQL.** En `tienda.html` (ficha del comercio) aparece la sección **«📍 Ubicación»** debajo de los botones de contacto: mapa con el pin del comercio, la dirección y «🗺️ Cómo llegar →». Proporción fija (`.mapa-comercio` en `styles.css`): 16:9 en celular (≈200 px de alto) y franja panorámica en PC (máx. 320 px), así la vitrina de productos se ve justo debajo. En celular el mapa no se arrastra con un dedo (no «atrapa» el desplazamiento); se usan los botones + / −. Tocar el pin abre «Cómo llegar». Si el comercio no tiene coordenadas, la sección no aparece. Código: `pintarMapaComercio()` en `tienda.js`.
**Revertir:** PR → Revert.

## Fase 2V · Categorías de comercio administrables

**SQL:** `supabase/15_categorias_comercio.sql` — **ANTES** de fusionar. Debe terminar mostrando 1 fila con `categorias` = 33 (o más). Es repetible y no pisa categorías que ya hayas editado.

- **Tabla `categorias_comercio`:** la lista vive en la base. 33 categorías iniciales (las 12 de antes + pastelería, cafetería, heladería, carnicería, frutas y verduras, licorera, naturista, sastrería, cerrajería, celulares y tecnología, papelería, veterinaria, óptica, salud y odontología, talleres, motos, lavandería, gimnasio, floristería, hospedaje, hogar y muebles). Cada una tiene **palabras clave** (las usará el buscador inteligente de la 2W).
- **Administrar sin SQL:** `admin-comercios.html` → **«🏷️ Categorías de comercio»**: crear (ícono, nombre, palabras clave), renombrar, ordenar y activar/desactivar. Una categoría desactivada no se ofrece al elegir, pero los comercios que la tienen la conservan. Una categoría en uso no se puede borrar (la base lo impide).
- **Categorías secundarias:** cada comercio tiene 1 principal y hasta 2 secundarias (`comercios.tipos_extra`). Un comercio aparece al filtrar por cualquiera de ellas y la tarjeta dice «Panadería · Cafetería · Envigado».
- **Quién cambia qué:**
  - *Moderador (modo editor):* todo, incluida la categoría principal y las secundarias.
  - *Dueño (Mi tienda):* descripción, WhatsApp, teléfono, horario, foto, entrega **y sus categorías**. Para **nombre, dirección o retirar** hay dos botones visibles al final de «Datos de tu negocio» que abren la solicitud ya llena (`comercios.html?solicitar=ID&tipo=actualizar|retirar`).
  - *Registro de negocio nuevo:* elige la categoría principal (solo las activas).
- Si el SQL 15 aún no se ejecutó, la página usa la lista anterior de 12 y todo sigue funcionando.
- **Revertir:** PR → **Revert**. La tabla puede quedarse. Para volver a la lista fija: `alter table public.comercios drop constraint comercios_tipo_fk; alter table public.negocios_pendientes drop constraint negocios_pendientes_tipo_fk;`

## Fase 2W · Buscador inteligente («Buscar en todo»)

**SQL:** `supabase/16_busquedas.sql` — se puede ejecutar antes o después de fusionar (sin él la página funciona igual, solo que no guarda las búsquedas). Debe terminar mostrando 1 fila: `registrar_busqueda | true`.

**Archivos nuevos:** `buscador.js` (el «cerebro» del buscador), `buscar.html` + `buscar.js` (página de resultados). **Cambian:** `index.html`, `anuncios.html`, `comercios.html` (cargan `buscador.js`), `anuncios-comun.js`, `comercios.js`, `app.js` (filtros más inteligentes), `tienda.html`/`tienda.js` (resalta el producto buscado), `moderacion.html`/`moderacion.js` (panel nuevo), `data.js` (productos públicos y búsquedas), `styles.css`.

**Cómo funciona:**
- **Botón 🔍** amarillo dentro del buscador del inicio y de «Todos los anuncios». Al escribir salen **sugerencias**: categorías de comercio (🍰 Pastelerías · 3 comercios), categorías de anuncios y comercios por nombre, y al final «🔍 Ver todos los resultados». **Enter** o 🔍 abren `buscar.html?q=…`. El texto sigue filtrando la lista de la página como antes.
- **Página «Buscar en todo»:** chips de categorías sugeridas, saltos a cada sección y tres secciones ordenadas por relevancia: **📢 Publicaciones**, **🏪 Comercios** y **🛍️ En vitrinas** (productos de comercios verificados; al tocar uno abre la tienda y lo resalta). Filtro por ciudad. El enlace se puede compartir (`buscar.html?q=postres&ciudad=Envigado`).
- **Qué entiende:** sin tildes ni mayúsculas, plurales («postre» = «postres»), palabras a medio escribir («post…»), errores de una o dos letras («pateleria», «drogeria») e **intenciones**: usa las *palabras clave* de cada categoría de comercio (las editas en Comercios → 🏷️ Categorías) y las de anuncios (`PALABRAS_ANUNCIOS` en `buscador.js`). El directorio de comercios (`comercios.html?q=postres`) también entiende intenciones.
- **Aprende contigo:** cada búsqueda en «Buscar en todo» se guarda (solo el texto y cuántos resultados hubo, nunca quién). En **Moderación → 🔍 Lo que la gente busca y no encuentra** ves las búsquedas sin resultados; eliges la categoría y tocas **🧠 Enseñar**: la palabra se agrega a esa categoría y desde ese momento encuentra esos comercios. «✔ Ya está» la marca resuelta (ej. si agregaste el comercio) y 🗑️ borra spam. Abajo, «📈 Lo más buscado» sirve para decidir qué comercios invitar primero.
- Todo corre en el navegador: no usa servicios externos ni IA de pago.
- **Revertir:** PR → **Revert**. La tabla `busquedas` puede quedarse (o `drop table public.busquedas; drop function public.registrar_busqueda(text, integer);`).

## Fase 2W.1 · Inicio más compacto: publicaciones antes del mapa

**No hay SQL.** Cambian `index.html`, `anuncios.html`, `anuncios-comun.js`, `app.js`, `anuncios.js` y `styles.css`. Caché `?v=34`.

- **Filtros compactos** (inicio y «Todos los anuncios»), con los mismos controles de antes:
  - Celular: fila 1 = 📍 Departamento · 🏘️ Ciudad; fila 2 = 📡 Cerca de mí · ↕️ Orden · ⚙️ Filtros. En computador todo va en una sola fila.
  - Los títulos de cada lista quedan dentro de la primera opción («📍 Departamento», «🏘️ Ciudad», «↕️ Recientes»). Para lectores de pantalla siguen existiendo las etiquetas ocultas (`sr-only`).
- **Filtros activos con ✕** (`#chips-activos`, función `pintarChipsActivos()` en `anuncios-comun.js`): «📍 Cerca de mí», estado, distancia, precio, con foto y con precio se ven aunque el panel ⚙️ esté cerrado; tocar ✕ quita ese filtro. Reemplaza la nota «Mostrando primero lo más cercano…».
- **Orden de la página:** en el HTML la lista de publicaciones va antes que el mapa. En celular: filtros → 📢 Publicaciones → 🗺️ Mapa → Comercios. En computador: publicaciones a la izquierda y mapa fijo a la derecha.
- **Mapa en celular/tablet:** 240 px de alto (antes 320) con botón **«⤢ Ampliar»** (70 % de la pantalla) / «⤡ Reducir».
- **Revertir:** PR → **Revert**.

## Fase 2W.2 · «🔄 Ver todas las publicaciones» sin volver al inicio

**No hay SQL.** Cambian `buscar.html`, `buscar.js`, `buscador.js`, `anuncios-comun.js` y `styles.css`. Caché `?v=36`.

**En «Buscar en todo» (`buscar.html`):**
- **✕ dentro del buscador**: borra la búsqueda y muestra **todo** ahí mismo (publicaciones, comercios y vitrinas), sin volver al inicio.
- **Categorías**: tocar un chip (ej. «📱 Tecnología anuncios») filtra en la misma página; se pone amarillo con ✕. Tocarlo otra vez, o la ✕ de la etiqueta, lo quita. Sin búsqueda, los chips muestran las categorías que tienen algo publicado.
- **Ubicación**: 📍 Departamento, 🏘️ Ciudad y **📡 Cerca de mí** (ordena todo por cercanía). Se conservan al borrar la búsqueda o la categoría.
- **🔄 Ver todo**: quita búsqueda y categoría; deja la ubicación.
- **Enter / 🔍** busca de nuevo sin recargar la página. El enlace se actualiza para compartir (`buscar.html?q=…&cat=a:tecnologia&ciudad=…`).
- **Más precisión en publicaciones**: si hay anuncios que dicen lo buscado, solo salen esos («iphone» ya no trae un televisor por ser tecnología). Si ninguno lo dice, entran los de la categoría relacionada («postres» → Comida).

**En «Todos los anuncios» y el inicio:**

- En «Todos los anuncios» (y en el inicio), además de los filtros activos, ahora salen como etiquetas con ✕ **lo que se busca** («🔍 «iphone»»), **la categoría** («📱 Tecnología») y **la subcategoría**. Ejemplo: llegas desde «Buscar en todo» a `anuncios.html?cat=tecnologia` y tocas la ✕ de «Tecnología» para ver todas las categorías.
- Botón **«🔄 Ver todas las publicaciones»**: quita de una vez la búsqueda, la categoría, la subcategoría y los filtros de ⚙️ (estado, distancia, precio, con foto, con precio). **Conserva** departamento, ciudad, «Cerca de mí» y el orden. Solo aparece cuando hay algo que quitar.
- Código: `pintarChipsActivos()`, `verTodasLasPublicaciones()` y `refiltrarAnuncios()` en `anuncios-comun.js`.
- **Revertir:** PR → **Revert**.

## Fase 2X · Recomienda un comercio

**SQL:** `supabase/17_recomendaciones.sql` — **ANTES** de fusionar. Debe terminar mostrando 1 fila: `categorias_nuevas = 2 | tabla_con_rls = true`. Es repetible.

**Archivos nuevos:** `recomendar.html` + `recomendar.js`. **Cambian:** `index.html` (diapositiva nueva), `comercios.html` y `buscar.html` (invitación a recomendar), `moderacion.html`/`moderacion.js` (sección nueva), `admin-comercios.html`/`admin-comercios.js` (crear desde una recomendación), `data.js`, `styles.css`. Caché `?v=37`.

**Cómo funciona:**
- **Quién:** cualquier persona con cuenta (no tiene que ser el dueño). Sin cuenta, la página pide entrar y luego vuelve sola. Límite: 10 por día y 15 en revisión por persona.
- **Formulario (1 minuto):** nombre, ¿qué es? (categoría), municipio, **«📍 Estoy aquí, en el comercio»** (guarda el GPS y elige el municipio más cercano) o la dirección/referencia, foto de la fachada (opcional) y por qué lo recomienda. Si ya hay un comercio con ese nombre en el municipio, pregunta antes de enviar.
- **Tus recomendaciones:** debajo del formulario, cada una con su estado: ⏳ En revisión, ✅ Agregado al mapa (con enlace) o «No se agregó».
- **Dónde se invita:** diapositiva rosada del carrusel del inicio («Recomienda los comercios que visitas»), barra en el directorio de comercios y botón en «Buscar en todo» cuando no hay resultados.
- **Moderación → 🤝 Comercios recomendados por la gente:** foto, categoría, municipio, dirección, enlace al punto GPS, comentario y quién lo recomendó. Avisa «⚠️ Puede que ya exista» si hay un comercio con el mismo nombre en el municipio o a menos de 60 m.
  - **➕ Crear comercio:** abre «Agregar comercio» ya lleno (`admin-comercios.html?recomendacion=ID`); revisas, ubicas bien el pin y guardas. Queda como «Ubicado» (sin verificar), con fuente «Recomendado por la comunidad», y la recomendación pasa a «creado». Si no subes otra foto, usa la de la recomendación.
  - **Descartar:** si ya existe, no es real o está repetida.
  - En Comercios hay un contador nuevo «🤝 Recomendados» y el filtro de origen «Recomendados».
- **Categorías nuevas:** 🍻 Bares y discotecas, 🌭 Puestos de comida (editables en Comercios → 🏷️ Categorías).
- **Revertir:** PR → **Revert**. La tabla puede quedarse.

## Fase 2C.5 · Perfil público del vendedor

**SQL:** `supabase/18_perfil_vendedor.sql` — **ANTES** de fusionar. Debe terminar mostrando 1 fila: `perfil_publico | nombre_publico`. Es repetible.

**Archivos nuevos:** `vendedor.html` + `vendedor.js`. **Cambian:** `anuncio.html`/`anuncio.js` (caja «Publicado por»), `index.html`/`app.js` (menú «👤 Mi perfil público»), `data.js`, `styles.css`. Caché `?v=38`.

**Cómo funciona:**
- **En cada anuncio** aparece la caja **«Publicado por José · Miembro desde septiembre de 2026 · 3 anuncios»** (y su tienda, si tiene) con «Ver sus anuncios →».
- **Perfil del vendedor** (`vendedor.html?id=…`): nombre visible, «miembro desde», cuántos anuncios activos tiene, enlace a su tienda si es dueño de un comercio, botón «🔗 Compartir perfil», y **todos sus anuncios** con buscador y categorías. Los botones de contacto funcionan igual que siempre (piden cuenta).
- **Privacidad:** la tabla `perfiles` sigue cerrada. La función `perfil_publico(id)` entrega solo el nombre visible, la fecha, el número de anuncios y su comercio; **nunca** correo, teléfono, apellido ni rol. Solo responde para personas con anuncios activos o un comercio, para que no sirva para averiguar quién tiene cuenta.
- **Nombre visible:** por defecto, solo el **primer nombre** («Ana María Gómez» → «Ana»). Cada quien puede poner un **apodo o el nombre de su tienda** desde **menú de la cuenta → 👤 Mi perfil público** (2 a 40 letras; vacío = primer nombre).
- **Revertir:** PR → **Revert**. La columna `nombre_publico` puede quedarse.

## Fase 2Y · Navegación tipo app (encabezado fijo con buscador + barra inferior)

**No hay SQL.** Archivo nuevo: `navegacion.js`. Cambian `index.html`, `app.js`, `buscador.js`, `styles.css` y las páginas con barra inferior (`anuncios.html`, `comercios.html`, `buscar.html`, `favoritos.html`, `vendedor.html`, `recomendar.html`). Caché `?v=39`.

**Encabezado del inicio (fijo arriba al bajar):**
- Fila 1: marca + botones. **Sin cuenta:** «Entrar» (en computador «Iniciar sesión») + **«Regístrate gratis»** amarillo titilando (en computador «Regístrate y publica gratis»). **Con cuenta:** «👤 Nombre ▾» (menú) + «+ Publicar» (sin titilar).
- Fila 2: el **buscador inteligente** (mismas sugerencias, 🔍 y «Buscar en todo»). En computador todo va en una sola fila: marca · buscador · botones.
- Al bajar se encoge un poco para dejar más espacio.
- **Letrero animado:** «¿Qué buscas hoy? restaurantes… comida rápida… farmacias… supermercados… usados…». Las palabras salen de las categorías (las de comercios se editan en el panel, así que crecen solas). Se detiene al tocar el buscador; con «reducir movimiento» queda un ejemplo fijo. Función `animarLetrero()` en `buscador.js` (también en «Todos los anuncios» y «Buscar en todo»).

**Debajo, en pequeño:** «Compra, vende y encuentra comercios cerca de ti · Clasificados de barrio + Directorio de comercios de tu ciudad · Anuncia gratis, contacta por WhatsApp…». Los 3 botones grandes pasan a ser accesos pequeños (Ver clasificados · Directorio · Registrar mi negocio · Recomendar un comercio) y siguen las categorías.

**Barra inferior (solo celular y tablet, `navegacion.js`):** 🏠 Inicio · 🏪 Comercios · **( ＋ )** · ❤️ Favoritos · 👤 Yo/Entrar.
- **＋** sube un menú: 📢 Publicar un anuncio · 🤝 Recomendar un comercio · 🏪 Registrar mi negocio · 🛍️ Mi tienda (con cuenta).
- **👤 Yo** (con cuenta): Mis anuncios · Mi perfil público · Mis favoritos · Mi tienda · Cerrar sesión. Sin cuenta dice **«Entrar»** y abre el inicio de sesión.
- Marca la página actual en morado; se esconde con el teclado abierto; deja espacio abajo para que no tape nada; respeta la «rayita» de los iPhone.
- **No aparece** en la ficha de un anuncio (tiene su barra de WhatsApp/Llamar), en la tienda (barra de pedido) ni en las páginas de administración. En computador no se muestra.
- Para ponerla en otra página: `<body data-nav="nombre">` y `<script src="navegacion.js">` después de `data.js`.
- **Revertir:** PR → **Revert**.

## Fase 2Z · «Anuncios y clasificados» + categorías de anuncios administrables

**SQL:** `supabase/19_categorias_anuncio.sql` — **ANTES** de fusionar. Debe terminar mostrando 1 fila: `categorias = 23 | con_llave = true`. Es repetible y no pisa lo que edites en el panel.

**Cambian:** `index.html`, `anuncios.html`, `buscar.html`/`buscar.js`, `data.js`, `anuncios-comun.js`, `app.js`, `anuncios.js`, `buscador.js`, `moderacion.html`/`moderacion.js`, `styles.css`. Caché `?v=40`.

**Qué cambia:**
- La sección «📢 Publicaciones» ahora se llama **«📢 Anuncios y clasificados»** (inicio, «Todos los anuncios» y «Buscar en todo»).
- En el inicio, la sección queda **debajo del carrusel**: título → **categorías** (bajaron de la franja morada) → filtros → anuncios y mapa.
- **Categorías de anuncios en la base** (tabla `categorias_anuncio`): las 12 de siempre + 11 nuevas (🏍️ Motos, 🔌 Electrodomésticos, 👶 Bebés y niños, ⚽ Deportes y bicicletas, 💄 Belleza y salud, 🎮 Videojuegos y juguetes, 🎸 Música e instrumentos, 📚 Libros y educación, 🎉 Eventos y fiestas, 🌱 Agro y campo, 🎁 Regalo o intercambio), cada una con subcategorías y palabras clave para el buscador. Las subcategorías de siempre se conservan.
- La base ya no tiene la lista fija: acepta cualquier categoría de la tabla (llave `anuncios_categoria_fk`).
- **Moderación → 🏷️ Categorías de anuncios:** crear (ícono, nombre, subcategorías separadas por coma), renombrar, editar subcategorías y palabras clave, ordenar y activar/desactivar. Muestra cuántos anuncios activos tiene cada una. Una desactivada no se ofrece al publicar ni en los filtros, pero los anuncios que la tienen la conservan.
- Si el SQL 19 no se ha ejecutado, la página usa la lista anterior de 12 y todo sigue funcionando.
- **Revertir:** PR → **Revert**. Para volver a la lista fija: `alter table public.anuncios drop constraint anuncios_categoria_fk;` (la tabla puede quedarse).

## Fase 2Z.1 · Accesos en cuadros + carrusel más bajo

**SQL:** `supabase/20_accesos_inicio.sql` — antes o después de fusionar (sin la tabla, el inicio muestra los 10 cuadros de respaldo). Debe terminar mostrando 1 fila: `cuadros = 10`. Es repetible.

**Cambian:** `index.html`, `app.js`, `data.js`, `moderacion.html`/`moderacion.js`, `styles.css`. Caché `?v=41`.

- **Cuadros de acceso** (franja morada de arriba, en lugar de los accesos pequeños): fila deslizable de cuadros redondeados de color con el ícono en relieve y una «burbuja» de luz (identidad propia, sin imágenes ni logos de terceros). Iniciales: 💊 Farmacias · 🛒 Mercado · 🍔 Comida · 🍻 Bares · 📱 Tecnología · 🏍️ Motos · 🏡 Arriendos · 📢 Publica gratis · 🤝 Recomienda · 🏪 Tu negocio.
- **Administrables** en **Moderación → 🧩 Accesos del inicio**: ícono, título (máx. 24), color (morado, menta, amarillo, rosa, azul, naranja), **a dónde lleva** (solo páginas del sitio, ej. `comercios.html?tipo=farmacia`, `anuncios.html?cat=motos`, `buscar.html?q=empanadas`, o `#publicar`), orden y visible. Vista previa en vivo. La base rechaza enlaces a otros sitios.
- **Carrusel ~20 % más bajo** (celular ≈ 258 px de alto en vez de ≈ 320; computador ≈ 218 px en vez de ≈ 272), con textos un poco más pequeños.
- Más adelante un cuadro podrá ser un **comercio patrocinado** (Fase 5).
- **Revertir:** PR → **Revert**. La tabla puede quedarse.

## Fase 2Z.2 · Editor del inicio (carrusel, cuadros y entrenar el buscador)

**SQL:** `supabase/21_editor_inicio.sql` — antes o después de fusionar (sin él, el inicio se ve igual que hoy). Debe terminar mostrando 1 fila: `diapositivas = 5 | cuadros_con_imagen = true`. Es repetible. Requiere el 20.

**Archivos nuevos:** `editar-inicio.html` + `editar-inicio.js`. **Cambian:** `carrusel.js` (se puede refrescar con diapositivas nuevas), `app.js`, `data.js`, `utils.js` (`comprimir` con tamaño y transparencia), `index.html` (enlace en la barra de moderador), `moderacion.html`/`moderacion.js` (los cuadros pasan al editor; «Enseñar» también a categorías de anuncios), `styles.css`. Caché `?v=42`.

**Dónde:** barra de moderador del inicio → **🎨 Editar inicio**, o Moderación → «🎨 Editar inicio y buscador». Solo moderadores.

**1. 🎠 Carrusel** (tabla `banners_inicio`; se cargan las 5 diapositivas de hoy): por diapositiva, vista previa en vivo con el mismo diseño de siempre y estos campos: etiqueta, título, texto, texto del botón, **a dónde lleva el botón** (menú), **colores** (8 paletas: Índigo y violeta, Verde azulado, Azul cielo, Atardecer, Rosa y coral, Noche elegante, Dorado, Menta fresca; o «Mis dos colores» con selector), ícono grande y pequeño, **imagen opcional** (al lado, ideal PNG/WebP con fondo transparente hecho con IA; o de fondo, se oscurece para que el texto se lea), orden y visible. ➕ Nueva diapositiva, 🗑️ Borrar. Si la tabla está vacía, el inicio muestra el carrusel de siempre.

**2. 🧩 Cuadros de acceso:** lo de la 2Z.1 + **imagen propia** (reemplaza el emoji) y **«Lleva a» con menú**: Categoría de comercios · Categoría de anuncios · **Un comercio específico** (lo eliges escribiendo su nombre) · Una búsqueda · Publicar · Bajar a los anuncios · Recomendar · Registrar negocio · Directorio · Todos los anuncios · Otra página del sitio. Nunca enlaces a otros sitios.

**Menú de destinos → enlace que se guarda:** categoría de comercios `comercios.html?tipo=…` · categoría de anuncios `anuncios.html?cat=…` · comercio `tienda.html?id=…` · búsqueda `buscar.html?q=…` · publicar `#publicar` · bajar a los anuncios `#contenido`.

**3. 🧠 Entrenar el buscador:** escribes palabras («arepas, salchichas, aguacate»), marcas categorías de **comercios y de anuncios** (con filtro) y tocas **Enseñar**: se agregan a sus palabras clave (sin repetir; máx. 1500 letras por categoría). **Probar** muestra qué categorías entiende el buscador para una palabra. En Moderación, «Lo que la gente busca y no encuentra» ahora deja enseñar también a categorías de anuncios.

**Imágenes:** se comprimen en el navegador (carrusel de fondo hasta 1600 px, al lado 700 px, cuadros 300 px) y se suben a Storage (máx. 1 MB).

**Revertir:** PR → **Revert**. Las tablas pueden quedarse.

## Fase 2Z.3 · Selector de íconos y ordenar los cuadros arrastrando

**SQL:** ninguno. **Cambian:** `editar-inicio.html`, `editar-inicio.js`, `styles.css`. Caché `?v=43` en todas las páginas. Nueva librería: SortableJS 1.15.2 desde cdnjs (solo en `editar-inicio.html`).

**Por qué antes no salía el ícono:** el campo «Ícono» espera un **emoji** (un dibujito como 🚗), no una palabra. Si escribías «auto» quedaban las letras.

**1. Botón «Elegir 😀»** al lado de cada ícono (cuadros de acceso y los dos íconos de cada diapositiva del carrusel): abre una ventana con ~170 íconos más los de todas tus categorías. Escribes una palabra en español (auto, comida, farmacia, celular, perro, ropa…) y tocas el que quieras: queda puesto y la miniatura cambia. Luego **Guardar**.

**2. Ícono automático:** al elegir en «Lleva a» una categoría o un comercio, el cuadro toma su ícono, **solo si no habías elegido uno** (si el ícono es ⭐ o lo había puesto el sistema).

**3. Ordenar:** en la franja morada de vista previa, **arrastra** un cuadro a su nuevo lugar (computador: clic y arrastrar; celular: mantener presionado medio segundo y arrastrar). También hay botones **◀ ▶** debajo de cada cuadro. El orden se **guarda solo** (10, 20, 30…) y sale un aviso verde; no se pierde lo que estés editando. La vista previa muestra lo **guardado**: un ícono nuevo aparece ahí después de tocar Guardar.

**Revertir:** PR → **Revert**.

## Fase 2Z.4 · Movimiento sutil en los cuadros de acceso

**SQL:** ninguno. **Cambia:** `styles.css` (al final). Caché `?v=44` en todas las páginas.

- El ícono de cada cuadro **flota e inclina despacio en 3D**, igual que el ícono del carrusel. Cada cuadro va a su propio ritmo para que no se muevan todos a la vez.
- Los cuadros con **imagen propia** hacen un acercamiento muy leve.
- Al pasar el mouse el ícono se queda quieto; si el celular tiene activado «reducir movimiento», no se mueve nada.
- Solo usa CSS (no gasta batería ni hace más lenta la página).

**Ajustar:** en `styles.css`, `acc-flota` (4.6s = velocidad; `-4px` = cuánto sube). **Revertir:** PR → **Revert**.

## Fase 2Z.5 · Categorías de comercios en Moderación + «Elegir 😀» en todas las categorías

**SQL:** ninguno (usa la tabla de `supabase/15_categorias_comercio.sql`, que ya está ejecutado). **Archivo nuevo:** `iconos.js` (el selector de íconos, ahora compartido). **Cambian:** `moderacion.html`, `moderacion.js`, `admin-comercios.html`, `admin-comercios.js`, `editar-inicio.html`, `editar-inicio.js`. Caché `?v=45`.

- **Dónde:** Moderación → **🏪 Categorías de comercios**, justo encima de «🏷️ Categorías de anuncios» (toca el título para abrirla). Sigue también en Comercios (admin-comercios), al final.
- **➕ Nueva categoría de comercio:** ícono (con **Elegir 😀**), nombre y palabras clave → **Crear**. El nombre se agrega solo a las palabras clave. Aparece de una vez al registrar/editar comercios, en los filtros del directorio, en «Lleva a» de los cuadros y en «Entrenar el buscador».
- **Editar:** ícono, nombre, palabras clave, orden y **Activa**, luego **Guardar** en esa fila. Desactivar no borra: los comercios que ya la tienen la conservan.
- No deja crear una con el mismo nombre que otra.
- **Elegir 😀** ahora también está en las categorías de anuncios (crear y editar) y en las de Comercios.

**Revertir:** PR → **Revert**.

## Fase 2Z.6 · Categorías nuevas y buscador entrenado

**SQL:** `supabase/22_categorias_nuevas.sql` — se puede ejecutar antes o después de fusionar. Debe terminar mostrando 1 fila: `comercios_nuevos = 3 | vehiculos = Vehículos | motos_activa = false | subs_vehiculos = 8 | anuncios_en_motos = 0`. Es repetible: no crea duplicados, no repite palabras y **suma** (no borra) lo que ya editaste en los paneles.

**Cambia:** `data.js` (el respaldo sin base de datos también dice «Vehículos»). Caché `?v=46`.

| Dónde | Cambio |
|---|---|
| Comercios | **Nuevas:** Minimercados 🧺 · Inmobiliarias 🏢 · Concesionarios y compraventas 🚘 |
| Comercios | «Tiendas y misceláneas» → **Tiendas de barrio y misceláneas** |
| Comercios | Más palabras clave: Licoreras (licorería, estanco, guaro…), Tiendas, Frutas y verduras, **Supermercados** (grandes superficies, Éxito, Olímpica, D1, Ara, mayoristas, plaza de mercado…), Motos |
| Comercios | Clínicas y hospitales: ícono 🏥 |
| Anuncios | «Autos» → **Vehículos** 🚗 con: Carros · Motos · Camionetas y camperos · Camiones y buses · Repuestos de carro · Repuestos y accesorios de moto · Bicicletas y patinetas · Otros |
| Anuncios | La categoría «Motos» se **une** a Vehículos: sus anuncios pasan con su subcategoría y «Motos» queda desactivada (no se borra) |
| Anuncios | Inmuebles: + Apartaestudios, Bodegas y palabras (arriendo, apto, estrato, inmobiliaria…) |
| Anuncios | Tiendas: + tienda de barrio, minimercado, fruver, licorería… |

**Subcategorías en comercios:** decidido no hacerlas por ahora (opción A). Un comercio puede marcar hasta 3 categorías (ej. Tienda de barrio + Frutas y verduras + Licoreras).

**Revertir:** PR → **Revert** (el SQL no hace falta deshacerlo; si quieres, reactiva «Motos» en Moderación).

## Fase 2Z.7 · Formulario de Inmuebles y Vehículos

**SQL:** `supabase/23_detalles_anuncio.sql` — antes o después de fusionar (sin él todo funciona como hoy, solo que sin los campos nuevos). Debe terminar mostrando 1 fila: `columna_detalles = true | se_puede_leer = true`. Es repetible.

**Orden:** fusiona primero el PR de la 2Z.6 (categorías) y después este.

**Cambian:** `index.html` (caja de datos en el paso 1), `app.js` (formulario), `data.js` (qué campos pide cada tipo, cómo se guardan y se muestran), `anuncios-comun.js` (tarjetas y filtros), `anuncio.js` (ficha y aviso antifraude), `buscador.js` (busca por marca y «venta/arriendo»), `buscar.js` y `favoritos.js` (precio con «/mes»), `styles.css`. Caché `?v=47`.

**Al publicar, según lo que elijas:**

| Tipo | Obligatorio | Opcional |
|---|---|---|
| 🏡 Apartamento / casa / apartaestudio | ¿Venta, arriendo o arriendo por días? · Habitaciones · Baños | Área m², estrato, parqueadero, piso, administración, amoblado, ascensor; en arriendo: requisitos, acepta mascotas, servicios incluidos |
| 🏡 Local, oficina o bodega | Operación | Baños, área, estrato, parqueadero… (sin habitaciones) |
| 🏡 Lote o finca | Operación · Área | Habitaciones, parqueadero |
| 🚗 Carro / camioneta / camión | Venta o arriendo · Marca · Modelo (año) · Kilometraje (si es usado) | Transmisión, combustible, último dígito de placa (pico y placa), ciudad de matrícula, color, SOAT, tecnomecánica, único dueño |
| 🏍️ Moto | Venta o arriendo · Marca · Modelo · **Cilindraje** · Kilometraje (si es usada) | Placa, matrícula, SOAT, tecnomecánica |
| 🔧 Repuestos | — | ¿Para qué vehículo sirve? |

- Si marcas **Nuevo**, no pide kilometraje ni placa. Marca con sugerencias (Mazda, Renault, Yamaha, AKT…).
- El precio dice **«/mes»** en arriendo de inmuebles, **«/día»** en vehículos y **«/noche»** en arriendo por días.
- **Tarjetas:** chips con lo clave («Arriendo · 3 hab · 2 baños · 72 m² · Estrato 4» o «Venta · Mazda · 2019 · 45.000 km»).
- **Ficha:** todos los datos + **aviso antifraude** (inmuebles: no consignar antes de visitar; vehículos: sin anticipos, revisar en el RUNT).
- **Filtros** (al elegir Inmuebles o Vehículos, bajo las subcategorías): venta/arriendo, habitaciones mínimas y estrato; o modelo desde y kilometraje máximo. Salen como chips con ✕ y van en el enlace de «Compartir esta búsqueda».
- **Buscador:** encuentra por marca («mazda») y por «arriendo».

**Revertir:** PR → **Revert**. La columna `detalles` puede quedarse.

## Fase 2Z.8 · ¿Cómo atiendes? (local · desde casa · solo domicilios)

**SQL:** `supabase/24_modo_atencion.sql` — antes o después de fusionar (sin él todo sigue como hoy; solo no se pueden registrar negocios «desde casa»). Debe terminar mostrando 1 fila: `modo_en_comercios = true | modo_en_solicitudes = true | privacidad = true`. Es repetible.

**Cambian:** `registrar-negocio.html/.js`, `mi-tienda.html/.js`, `admin-comercios.js`, `moderacion.js`, `tienda.js`, `comercios.js`, `app.js` (ventanita del mapa), `data.js`, `buscador.js`, `styles.css`. Caché `?v=48`.

| Opción | Qué se ve en público |
|---|---|
| 🏬 **Local abierto al público** (por defecto) | Punto exacto, dirección y «Cómo llegar», como siempre |
| 🏠 **Atiendo desde mi casa** | Etiqueta «Desde casa», **zona aproximada** (círculo en el mapa), **sin dirección** ni «Cómo llegar»; botón «💬 Pedir por WhatsApp» |
| 🛵 **Solo domicilios** | Igual: solo la zona donde trabaja, sin dirección |

- **La privacidad la hace el servidor** (no se puede saltar): al crear el comercio, al cambiar a «casa/domicilio» o si alguien mueve el pin, el punto público se corre **al azar entre 150 y 350 m** y la dirección pública se borra. La dirección exacta queda solo en la solicitud, que ven los moderadores.
- **Registro:** nuevo paso «¿Cómo atiendes?». Si es desde casa: la dirección dice «privada, solo para el moderador», el botón dice «Estoy en mi casa» y la foto pedida es **de los productos o el logo** (nunca de la casa).
- **Moderación:** la solicitud muestra la etiqueta y recuerda que la dirección es privada. Al aprobar, el comercio hereda su forma de atender.
- **Mi tienda:** el dueño puede cambiarla (avisa que el punto se correrá). Si vuelve a «Local», un moderador debe ubicar otra vez su puerta.
- **Comercios (admin):** selector «¿Cómo atiende?» en cada comercio y etiqueta «zona aproximada».
- **Buscador:** «desde casa» o «domicilios» encuentra estos negocios.

**Revertir:** PR → **Revert**. Las columnas pueden quedarse.

## Fase 2Z.9 · «Ubicado» bien explicado y foto con cámara o galería

**SQL:** ninguno. **Cambian:** `tienda.js`, `mi-tienda.js`, `comercios.js`, `registrar-negocio.html/.js`, `recomendar.html/.js`, `styles.css`. Caché `?v=49`.

**¿Qué pasa al aprobar «sin verificar»?** El negocio queda **«Ubicado»** y **SÍ aparece en el mapa y en el directorio**, igual que los importados. Lo único que espera la verificación (WhatsApp o llamada) son **sus productos** (la vitrina): así nadie puede usar una tienda falsa para vender. Antes el mensaje decía «Solo tú ves…» y parecía que el negocio entero estaba escondido.

- **Dueño** (Mi tienda y su ficha): «📍 Tu negocio YA aparece en el mapa y en el directorio con la etiqueta «Ubicado». Lo que aún no ven los clientes son tus productos…».
- **Visitantes** (ficha de cualquier comercio «Ubicado», importado o nuevo): aviso arriba «⚠️ Comercio «Ubicado», aún sin verificar… Llama o escribe antes de ir».
- **Directorio:** «⚠️ Aún sin verificar que exista aquí: confirma antes de ir».
- **Foto:** al registrar un negocio y al recomendar uno hay dos botones: **📷 Tomar foto** (abre la cámara) y **🖼️ Elegir de la galería** (para fotos profesionales). Si cancela uno, no se borra la foto ya elegida.

**Revertir:** PR → **Revert**.

## Fase 2Z.10 · La comunidad confirma comercios + «⚡ Acelerar mi verificación»

**SQL:** `supabase/25_confirmaciones_comercio.sql` — antes o después de fusionar (sin él la página funciona igual, solo sin los botones nuevos). Debe terminar mostrando 1 fila: `tabla_votos = true | totales = true | tabla_llamadas = true`. Es repetible.

**Cambian:** `tienda.js`, `mi-tienda.html/.js`, `comercios.js`, `app.js` (ventanita del mapa), `moderacion.html/.js`, `admin-comercios.js`, `data.js`, `styles.css`. Caché `?v=50`.

**1. «¿Conoces este negocio?»** (ficha de cada comercio «Ubicado», y de los verificados hace más de 6 meses como «¿Sigue abierto?»):
- Tarjeta con **✅ Sí, existe y atiende aquí** / **❌ No está o cerró**, que se puede **cerrar con ✕** (no vuelve a salir).
- Si la persona tocó «Cómo llegar», WhatsApp o Llamar y **vuelve más tarde**, pregunta **«🧭 ¿Lo encontraste?»** aunque la hubiera cerrado.
- En la **ventanita del mapa**: «¿Existe aquí? 👍 👎».
- Reglas (las hace cumplir la base de datos): **con cuenta**, **un voto por persona y comercio** (se puede cambiar a los 30 días), **el dueño no vota** por su negocio, máx. 40 votos al día. Si el celular está a menos de 150 m (450 m en negocios «desde casa») el voto cuenta **«en el lugar»**.
- **Los votos nunca verifican.** Con **3+ «sí»** (al menos 1 en el lugar) sale **«👥 Confirmado por N vecinos»** y sube en tu lista; con **2+ «no»** sale «🚩 N personas dicen que ya no está aquí» y te llega para revisar. **Nada se oculta solo.**

**2. «⚡ Acelerar mi verificación»** (dueño de un comercio «Ubicado», en Mi tienda y en su ficha): **«📞 Que me llamen»** eligiendo mañana, tarde o noche y el número (viene puesto el del negocio). Una vez al día. **No muestra ningún número de MercaFree.**

**3. Moderación:** nuevas secciones **«⚡ Piden verificación»** (franja, botón 📞 Llamar, ir a verificar y ✔ Atendida) y **«👥 Señales de la comunidad»** (confirmados y dudosos). En «Editar comercios» cada ficha muestra «👥 N sí · M no».

**Revertir:** PR → **Revert**. Las tablas pueden quedarse.

## Fase 2Z.10b · «¿Existe aquí?» y «¿Lo encontraste?» más visibles

**SQL:** ninguno. **Cambian:** `app.js`, `comercios.js`, `tienda.js`, `data.js`, `styles.css`. Caché `?v=51`.

- **Ventanita del mapa (inicio):** «👥 ¿Existe aquí? 👍 Sí · 👎 No» ahora va **arriba, justo debajo del nombre**, en una franja de color (antes quedaba abajo y pasaba desapercibida). Sale en los comercios **«Ubicado»** (y en los verificados hace más de 6 meses); en los verificados recientes no se pregunta. También se arregló el botón «⭐ Calificar» de la ventanita, que salía con letra blanca casi invisible.
- **«🧭 ¿Lo encontraste?» en cualquier página:** antes solo salía en la ficha del comercio y 10 minutos después. Ahora se anota la visita al tocar **Cómo llegar, Llamar o WhatsApp** en el **directorio, la ventanita del mapa, el inicio o la ficha**, y **2 minutos después**, al volver a la página (por ejemplo, regresando de Google Maps) o al abrir otra, aparece una **tarjeta flotante** abajo: «¿Encontraste «X»? ✅ Sí, existe / ❌ No estaba» con ✕ para cerrarla (no vuelve a preguntar por ese comercio). Al dueño nunca se le pregunta por su propio negocio.

**Cómo probarlo:** en Comercios toca «Cómo llegar» de un comercio «Ubicado», espera 2 minutos y vuelve a la página (o recárgala).

**Revertir:** PR → **Revert**.

## Fase 2AA.1 · Panel de comercios: arreglos urgentes + verificación con tu criterio

**SQL:** `supabase/26_verificacion_flexible.sql` — antes o después de fusionar. Debe terminar mostrando 1 fila: `foto_opcional = true | minimo = true`. Es repetible. (Sin él, el panel funciona, pero la base de datos seguirá pidiendo foto en la visita.)

**Cambian:** `admin-comercios.html/.js`, `comercios.js`, `app.js`, `tienda.js`, `data.js`, `styles.css`. Caché `?v=52`.

- **Arreglado: «Corregir ubicación» ya no borra lo que estabas escribiendo.** Al guardar la ubicación (o verificar, o guardar otra ficha) la lista se recarga, pero ahora se guarda un borrador de lo que habías cambiado en cada ficha y se vuelve a poner, con el aviso «✏️ Tienes cambios sin guardar en esta ficha». Tampoco se cierran las fichas que ya habías abierto con «Ver más».
- **WhatsApp en el editor:** nuevo campo «💬 WhatsApp (10 dígitos)» (se guarda con 57). El botón **💬 WhatsApp** ahora sale para **todos** los comercios que tengan número: tarjeta del directorio, ventanita del mapa, comercios del inicio y ficha completa (antes solo los «desde casa»).
- **Foto con cámara o galería** al **editar**, **crear** y **verificar** un comercio: «📷 Tomar foto» / «🖼️ Galería».
- **Verificación con tu criterio:**
  - **En persona:** basta marcar **«El local existe y atiende en esta dirección»** (dice «obligatorio»). Los demás puntos son opcionales.
  - **Por teléfono:** basta **«Confirmé el nombre y la dirección»**.
  - **Foto opcional:** si no subes foto te pregunta «¿Guardar así?» y tú decides.
  - El **historial** muestra qué comprobaste: «✅ 18 oct · En persona · comprobado: existe · sin foto».
- **«¿Lo encontraste?»** ahora sale **arriba** (en celular arriba de todo; en computador arriba a la derecha), en una **franja pequeña**, a **1 minuto y medio**, y **se va sola a los 25 segundos** si no la tocas. Si se ignora 2 veces, no vuelve a preguntar por ese comercio.

**Revertir:** PR → **Revert**. La regla del SQL se puede dejar.

## Fase 2AA.2 · Editor completo de comercios

**SQL:** ninguno. **Cambian:** `admin-comercios.html/.js`, `index.html` (texto), `styles.css`. Caché `?v=53`.

- En cada ficha de «Editar comercios» hay un botón **✏️ Editor completo** que abre una ventana con **5 pestañas** y **todos los campos** del registro de negocio y de «Mi tienda»:
  - **📝 Datos:** nombre, categoría principal + 2 secundarias, cómo atiende, descripción (300), horario.
  - **📞 Contacto y entrega:** WhatsApp (10 dígitos), teléfono, «se recoge en el local», domicilio y sus condiciones.
  - **📍 Ubicación:** municipio (para moverlo de ciudad), dirección y **«Mover el pin en el mapa»** (abre el mismo mapa de siempre; el botón dice «✅ Usar este punto» y el pin vuelve al editor sin guardarse solo).
  - **📷 Foto:** ver la actual, «Tomar foto» / «Galería», o «Quitar la foto actual».
  - **🙋 Dueño y visibilidad:** visible sí/no, asignar o quitar dueño (esto se aplica al momento).
- Un solo **💾 Guardar todo**. Si cierras con ✕, «Cancelar» o la tecla Esc teniendo **cambios sin guardar**, pregunta antes.
- La edición rápida de la ficha sigue igual, por si solo quieres cambiar un dato.
- **Texto de «Anuncios y clasificados»:** «Lo que vende y ofrece la gente de tu barrio o ciudad: productos, servicios, empleos, inmuebles y más».

**Revertir:** PR → **Revert**.

## Fase 2AA.3 · Clasificar comercios por municipio y categoría

**SQL:** ninguno. **Cambian:** `admin-comercios.html/.js`, `styles.css`. Caché `?v=54`.

En **Editar comercios → 2 · Verificar y completar datos**, debajo de los filtros:

- **🏷️ Por categoría:** chips con **cuántos comercios hay de cada categoría** en el municipio y filtros elegidos (estado, origen, búsqueda), de mayor a menor, y cuántos están **verificados** (✔2) o ninguno (⏳). Cuentan también los que tienen la categoría como **secundaria**. Tocar un chip **filtra la lista**; «Todas» lo quita.
- Al cambiar de **municipio**, los conteos se recalculan solos (ej. Medellín: 💊 Farmacias 3 ✔1 · 🥖 Panaderías 1).
- **📋 Lista / 🗂️ Agrupada:** la vista agrupada muestra **una sección por categoría principal** (nadie sale repetido) con **barra de avance** («✔ 2 verificados · ⏳ 1 por verificar · 🙈 ocultos»). Cada sección se abre y muestra hasta 10 fichas; «Ver los N de …» lleva a la lista de esa categoría. La vista elegida se recuerda.
- Las tarjetas de «Pendientes» de arriba quitan también el filtro de categoría.

**Revertir:** PR → **Revert**.

## Fase 2AA.4 · Galería de hasta 5 fotos por comercio + ver fotos en grande

**SQL:** `supabase/27_fotos_comercio.sql` — antes o después de fusionar (sin él cada comercio sigue con 1 foto). Debe terminar mostrando 1 fila: `columna_fotos = true | sin_desfase = 0`. Es repetible. Los comercios que ya tenían foto la conservan como la primera de su galería.

**Cambian:** `tienda.js` (ficha), `admin-comercios.html/.js` (editor), `mi-tienda.html/.js`, `data.js` (visor y gestor de fotos), `styles.css`. Caché `?v=55`.

- **Ficha del comercio:** portada grande con botón **«🔍 Ampliar · 1/3»** y **miniaturas** debajo. Tocar la foto o «Ampliar» abre el **visor a pantalla completa** con la foto **entera, sin recortar**; ‹ › (o deslizar con el dedo, o las flechas del teclado) para pasar de foto; tocar, ✕ o Esc para cerrar.
- **Fotos de los productos** de la vitrina: también se tocan y se ven en grande.
- **Editor completo → 📷 Fotos** y **Mi tienda (dueño):** hasta **5 fotos** (fachada, interior, productos…). La **primera es la portada**: ★ la vuelve portada, ◀ ▶ ordenan, ✕ quita. «📷 Tomar foto» o «🖼️ Galería» (desde la galería se pueden elegir **varias a la vez**). Tocar una miniatura la abre en grande. Se guarda con «Guardar todo» / «Guardar datos».
- En la edición rápida de la ficha, la miniatura se toca para ver todas las fotos; cambiar la foto ahí reemplaza solo la portada.
- La **portada** (la que sale en el directorio y el mapa) siempre es la primera foto: lo mantiene el servidor.

**Revertir:** PR → **Revert**. La columna `fotos` puede quedarse.

## Fase 2AA.5 · Fotos de los productos de la vitrina (dueño y administrador)

**SQL:** `supabase/28_fotos_producto.sql` — antes o después de fusionar (sin él cada producto sigue con 1 foto). Debe terminar mostrando 1 fila: `columna_fotos = true | sin_desfase = 0`. Es repetible. Requiere el 27.

**Cambian:** `mi-tienda.js`, `tienda.js`, `admin-comercios.js`, `data.js`. Caché `?v=56`.

- **Dueño, en «Mi tienda» → Mis productos:** cada producto tiene su galería de **hasta 3 fotos** con el mismo manejo que la del comercio: «📷 Tomar foto» / «🖼️ Galería» (varias a la vez), ★ principal, ◀ ▶ ordenar, ✕ quitar, tocar para ver en grande. Se guarda con «Guardar» / «Agregar» del producto.
- **Vitrina pública:** si un producto tiene varias fotos sale «📷 2»; al tocar la foto se abre el **visor a pantalla completa** con todas sus fotos.
- **Límites del dueño (no cambian):** solo edita **sus** productos (máx. 20 por comercio), no puede mostrar un producto que un moderador ocultó, y siguen las reglas de los Términos (sin medicamentos con fórmula ni productos regulados; licor y tabaco solo para mayores).
- **Administrador (tú):** en «Editar comercios» cada ficha tiene **«🛍️ Editar vitrina»**, que abre la tienda de **cualquier** comercio en **modo administrador** (agregar, editar, borrar productos y fotos, datos del negocio), con aviso arriba y enlace para volver.

**Revertir:** PR → **Revert**. La columna puede quedarse.


## Fase 2AB.1 · Droguerías y productos de salud: la norma queda instalada (sin vender medicamentos)

**SQL:** `supabase/29_productos_salud.sql` — **antes** de fusionar (el registro de droguerías y la cola de revisión lo necesitan). Debe terminar con 1 fila: `tabla_privada = true | cola = true | en_registro = true | subcat_renombrada = true`. Es repetible.

**Cambian:** `terminos.html`, `privacidad.html`, **nuevo** `politica-productos-salud.html`, `registrar-negocio.*`, `mi-tienda.*`, `admin-comercios.*`, `moderacion.*`, `app.js`, `data.js`. Caché `?v=57`.

- **Legal:** Términos **4B** (hoy no se publican medicamentos; las personas nunca; MercaFree es intermediario tecnológico; siempre prohibidos control especial, magistrales, muestras, sin INVIMA) y en **4A** la identificación de quien ofrece (Ley 1480, art. 53). Privacidad: datos sanitarios privados y **no recibimos fórmulas médicas**. Página nueva con las reglas futuras de venta libre y con fórmula (Res. 1896 de 2023).
- **Dónde quedan los datos sanitarios:** tabla privada `datos_sanitarios` (una fila por comercio). Solo la leen y cambian el **dueño** y los **moderadores** (RLS). En la solicitud de registro viajan en `negocios_pendientes.datos_sanitarios` y al aprobar pasan solos a la tabla.
- **Botones:** dueño → **Mi tienda → 🧾 Datos sanitarios** (ver, editar, estado y tu nota). Tú → **Editar comercios → ✏️ Editor completo → 🧾 Sanitario** (ver, editar, «✅ Marcar revisado», nota) y **Moderación → 💊 Salud → 🧾 Datos sanitarios por revisar**. La solicitud de una droguería nueva los muestra en **➕ Negocios nuevos**.
- **Reglas del servidor:** droguería o naturista sin datos sanitarios no puede agregar productos; si el dueño cambia sus datos, se quita tu visto bueno; un anuncio o producto con palabras de medicamento entra a la cola **💊 Posibles medicamentos** (no se oculta solo: decides «Ocultar» o «Está permitido»).
- **Avisos al usuario:** al publicar un anuncio o guardar un producto que parece medicamento, se pide confirmar que **no** lo es.
- **Nombres:** Anuncios → Tiendas «Droguería y salud» → «Cuidado personal y aseo»; Belleza y salud «Salud y bienestar» → «Bienestar (sin medicamentos)»; cuadro del inicio «Farmacias» → «Droguerías».

**Revertir:** PR → **Revert**. Las tablas pueden quedarse; si quieres quitar la regla de productos: `drop trigger productos_salud_requisito on public.productos_comercio;`.

## Fase 2AB.2 · La marca ahora es Merkap

**SQL:** `supabase/30_marca_merkap.sql` — antes o después de fusionar. Arregla el cuadro «Motos» y cambia «MercaFree» por «Merkap» si aparece en el carrusel o los cuadros. Debe mostrar `motos_viejo = 0 | textos_viejos = 0`.

**Cambian:** todas las páginas (`*.html`), los textos en los `*.js`, `styles.css` (regla `.marca`), `privacidad.html`, `terminos.html`, `anuncios-comun.js`, `data.js`. Caché `?v=58`.

- **Letrero nuevo:** ícono «M» amarillo con punto índigo + palabra «Merk**ap**» (blanco y amarillo, los colores de la página). Es código (SVG), no una imagen: se ve nítido en cualquier pantalla. Para cambiar el logo después basta con tocar la regla `.marca` y el ícono.
- **Ícono de la pestaña** del navegador: la misma «M» en todas las páginas.
- **Privacidad:** el responsable es **Skalezinc** (filial), con razón social y NIT **en trámite**. Se quitó el NIT anterior. Ver pendiente P1 del roadmap.
- **Motos:** el cuadro lleva a Vehículos › Motos; los enlaces viejos `anuncios.html?cat=motos` (ya compartidos) también llevan ahí.
- Lo que **no** cambió: el correo mercafree7@gmail.com (pendiente P2) y los nombres internos (`mf_…`), que no se ven.

**Revertir:** PR → **Revert**.

## Fase 2AB.2b · Sello sanitario aparte del sello de verificación

**SQL:** `supabase/31_sello_sanitario.sql` — **antes** de fusionar. Debe mostrar `sello_publico = true | en_reclamo = true | regla_vitrina = true`. Es repetible.

**Cambian:** `data.js`, `tienda.js`, `comercios.*`, `app.js`, `buscar.js`, `mi-tienda.js`, `moderacion.js`, `styles.css`. Caché `?v=59`.

- **Dos cosas distintas:** el **sello de verificación** (Ubicado / Verificado por teléfono / en persona) dice que el negocio existe y quién es el dueño. El **visto bueno sanitario** dice que Merkap revisó razón social, NIT y director técnico.
- **Distintivo público** «🧾 Datos sanitarios revisados» en la ficha y el directorio, solo cuando tú das el visto bueno (Editor → 🧾 Sanitario → «✅ Marcar revisado»). Los datos siguen privados.
- **Vitrina de droguerías y naturistas:** pública solo si está verificada **y** con visto bueno sanitario. El dueño ve el aviso en Mi tienda y en su ficha.
- **Reclamar una droguería** («¿Es tu negocio? → Soy el dueño») pide los datos sanitarios; en Moderación se ven en la solicitud y al tocar «👤 Asignar como dueño» pasan solos a 🧾 Sanitario (por revisar).
- Si el dueño cambia sus datos, el distintivo se apaga hasta que vuelvas a revisarlos. Nadie más puede encenderlo.

**Revertir:** PR → **Revert**. Para quitar la regla de la vitrina, vuelve a ejecutar la política de productos del `07_vitrina.sql`.

## Fase 2AC · Palabras prohibidas, Selección del día, opción B y restos chicos

**SQL:** `supabase/32_palabras_y_seleccion.sql` — **antes** de fusionar. Debe mostrar `palabras = 37 (o más) | cola_con_motivo = true | seleccion = true | vitrina_opcion_b = true`. Es repetible.

**Cambian:** `data.js`, `utils.js`, `app.js`, `anuncio.*`, `anuncios-comun.js`, `index.html`, `moderacion.*`, `mi-tienda.js`, `tienda.js`, `styles.css`. Caché `?v=60`.

- **Opción B (droguerías):** su vitrina solo necesita estar verificada, como cualquier comercio. Tu visto bueno sanitario enciende el distintivo 🧾 y será requisito para vender medicamentos de venta libre (2AB.3). Siguen obligatorios los datos sanitarios para cargar productos.
- **🚫 Palabras prohibidas** (Moderación): 👀 *revisar* → se publica y cae en la cola para que decidas; ⛔ *bloquear* → no deja publicar y le dice a la persona por qué. ⇄ cambia la acción, ⏸ la apaga, ✕ la borra. Ignora mayúsculas, tildes y signos. Solo los moderadores ven la lista. Aplica a anuncios y productos de vitrina.
- **⭐ Selección del día** (inicio): primero los que elijas tú (botón «⭐ Poner en Selección del día» en la ficha, dura 24 h) y se completa sola con anuncios recientes con foto, uno por vendedor, que cambian cada día. Con menos de 3 anuncios no se muestra.
- **Ficha y tarjetas:** «🕒 Publicado hace X», «📷 N» fotos, contador 1/N con puntos, flechas y deslizar con el dedo; **precio fijo / 🤝 negociable** (se elige al publicar); similares con distancia y la explicación de cómo se ordenan.

**Revertir:** PR → **Revert**. Las tablas pueden quedarse.

## Fase 2AC.1 · Datos sanitarios opcionales, Selección del día con pocos anuncios y similares cercanos

**SQL:** `supabase/33_salud_opcional.sql` — **antes** de fusionar. Debe mostrar `sin_requisito = true`. Es repetible.

**Cambian:** `data.js`, `app.js`, `anuncio.*`, `comercios.*`, `registrar-negocio.*`, `mi-tienda.*`. Caché `?v=61`.

- **Datos sanitarios opcionales** para droguerías, naturistas y tiendas que marquen farmacia como secundaria: registran, reclaman y cargan productos sin llenarlos. Si empiezan a llenarlos, se validan completos.
- **Medicamentos:** siguen prohibidos para todos (nada de esto los habilita).
- **Mensaje en Mi tienda:** «Puedes vender todo lo que no sea medicamento… tu ficha aún no tiene el distintivo 🧾… (opcional)».
- **Incentivos para llenarlos:** distintivo 🧾 (con tu visto bueno), aparecer **primero** entre las droguerías del directorio, filtro «🧾 Droguerías con datos sanitarios revisados» y tener hecho el primer paso para la venta libre (2AB.3).
- **Selección del día:** se muestra desde 2 anuncios; primero uno por vendedor con foto, si no alcanza repite vendedor y luego usa anuncios sin foto.
- **Anuncios similares:** si no hay 4 de la misma categoría, completa con «Más anuncios cerca» (dice la categoría y la distancia).

**Revertir:** PR → **Revert**.

## Fase 2AD · Logo oficial y panel de la Selección del día

**SQL:** `supabase/34_seleccion_panel.sql` — antes o después de fusionar (sin él no se puede «sacar» anuncios, lo demás funciona). Debe mostrar `excluir = true`.

**Cambian:** todas las páginas (`*.html`, logo y pestaña), **nuevo** `img/` (logo SVG, íconos PNG y el original), `styles.css`, `utils.js`, `data.js`, `app.js`, `anuncio.js`, `editar-inicio.*`, `index.html`. Caché `?v=62`.

- **Logo oficial** redibujado en vector (nítido en cualquier tamaño) en el encabezado de todas las páginas, la pestaña del navegador y el ícono al guardar la página en el celular. El archivo original queda guardado en `img/logo-merkap-original.jpg`.
- **Saludo del logo:** la primera vez que alguien entra a Merkap, entrada vistosa (1,8 s); al abrir cada página, un saludo corto (0,9 s) y queda quieto. Si el celular tiene «reducir movimiento», no se mueve.
- **Editar inicio → ⭐ Selección del día:** cómo se ve ahora y a qué hora cambia; lista de anuncios con buscador y filtros (en la franja, fijados, sacados); **⭐ Fijar** (24 h, 3 días o 7 días), **Quitar ⭐**, **🚫 Sacar** y **✅ Permitir**.
- En el inicio, los moderadores ven una **✕** en cada tarjeta de la franja para sacarla al momento; en la ficha, «⭐ Fijar» y «🚫 Sacar de la Selección».
- El sorteo cambia **cada 4 horas** (6 veces al día): otros anuncios y otro orden. Los fijados salen primero, también en orden variable.

**Revertir:** PR → **Revert**.

## Fase 2AF · Logo editable: oficial y de temporada

**SQL:** `supabase/35_logos_pagina.sql` — antes o después de fusionar (sin él se ve el logo oficial). Debe mostrar `logos = 1 | oficial = true`.

**Cambian:** todas las páginas (`*.html`), `img/` (logo oficial recortado y los íconos de celular desde tu imagen), `styles.css`, `utils.js`, `data.js`, `editar-inicio.*`. Caché `?v=63`.

- **Logo oficial = tu imagen** (`img/logo-merkap.png`), recortada en su cuadro redondeado y con fondo transparente. Si alguna vez no carga, aparece el logo vectorial de respaldo.
- **Editar inicio → 🎨 Logo de la página:** agrega logos (nombre, imagen, fechas), «Usar ahora», recortar, movimiento, encender/apagar, cambiar imagen y borrar. El oficial no se puede borrar, pero sí cambiar su imagen.
- **Cuál se ve:** 1) el marcado «Usar ahora»; 2) uno de temporada dentro de sus fechas; 3) el oficial. Al terminar las fechas vuelve solo.
- **Movimientos:** la entrada de la primera visita y el saludo en cada página funcionan con cualquier logo; se pueden apagar por logo.
- La página **recuerda** el logo vigente: al abrir otra página aparece directo, sin parpadeo.
- La pestaña del navegador y el ícono del celular siguen con el oficial.

**Revertir:** PR → **Revert**.

## Fase 2AG · Vitrina gratis de 10 productos + logos sin fondo blanco

**SQL:** `supabase/36_vitrina_10.sql` — **antes** de fusionar. Debe mostrar `cupo = true | tope_10 = true | tiendas_sobre_10 = 0`.

**Cambian:** `data.js`, `mi-tienda.*`, `index.html`, `editar-inicio.*`, todas las páginas (caché `?v=64`).

- **Vitrina = 10 productos gratis** (antes 20). Lo hace cumplir el **servidor** (trigger `productos_limite`), no la pantalla: aunque alguien lo intente desde la consola, el producto 11 se rechaza.
- **Cupo por tienda:** columna `comercios.limite_productos` (10). Solo tú la cambias. Para darle 20 a una tienda (plan futuro), en el SQL Editor: `update comercios set limite_productos = 20 where id = <id>;`
- Tiendas con más de 10 ya cargados (hoy ninguna) conservan lo suyo; no pueden agregar más.
- Textos: inicio «muestra hasta 10 productos gratis» y Mi tienda «Hasta 10 productos gratis» + contador «N de 10».
- **Logos con fondo blanco:** al subir (Agregar o 🖼️ Cambiar imagen) se quita el fondo claro que toca los bordes, se recorta y se centra. El blanco interno (ej. el ✔) se conserva. «Recortar» viene desmarcado y se apaga solo si se quitó el fondo. La vista previa se ve sobre el color de la barra.
- **Logos ya subidos con fondo blanco:** vuelve a subirlos con **🖼️ Cambiar imagen** (la imagen guardada no se modifica sola).

**Revertir:** PR → **Revert**. El SQL puede quedarse (10 es solo el número; para volver a 20: `alter table comercios alter column limite_productos set default 20; update comercios set limite_productos = 20;`).

## Fase 2AH · Horario en vivo y «publicado hace…»

**SQL:** ninguno. **Cambian:** `utils.js`, `styles.css`, `comercios.js`, `app.js`, `buscar.js`, `tienda.js`, `anuncios-comun.js`, `anuncio.js`, `favoritos.js`; caché `?v=65`.

- **Comercios con horario:** 🟢 Abierto ahora (+ «cierra a las 8 p. m.»), 🟠 Cierra pronto (falta 1 hora o menos), 🟡 Abre pronto, 🔴 Cerrado (+ «abre mañana a las 8 a. m.»). Arriba a la derecha de la foto y en una línea bajo el horario. Siempre en hora de Colombia.
- Si el horario está escrito de forma que no se entiende, **no se muestra** estado (mejor callar que equivocarse). Para que salga, el horario debe tener días y horas, ej. «Lun-Sáb 8:00-20:00, Dom 9-14».
- **Anuncios:** «🕒 hace X» sobre la foto (verde las primeras 24 h); dentro: «Publicado hace 3 horas · fecha y hora exacta».

**Revertir:** PR → **Revert**.

## Fase 2AI · «Abiertos primero»

**SQL:** ninguno. **Cambian:** `utils.js`, `styles.css`, `comercios.*`, `app.js`, `mi-tienda.*`; caché `?v=66`.

- **Directorio:** orden por defecto «🟢 Abiertos primero», con títulos: Abiertos ahora (incluye «cierra pronto») → Abren en menos de 1 hora → Sin horario publicado → Cerrados ahora (tarjetas más tenues). Dentro de cada grupo, el orden recomendado (verificados, con vitrina, nombre).
- Los otros órdenes («Recomendados», «Más cercanos», «Mejor calificados», «Nombre») funcionan igual que antes, sin títulos.
- **Inicio:** los comercios abiertos salen primero (sin títulos).
- **Mi tienda:** bajo «Horario» el dueño ve al instante «✓ Entendido. Así se ve ahora: …», «⚠️ No entendemos este horario…» o una invitación a ponerlo.

**Revertir:** PR → **Revert**.

## Fase 2AJ · Métricas del piloto (G0)

**SQL:** `supabase/37_metricas.sql` — antes o después de fusionar (sin él la página funciona igual, solo no cuenta). Debe mostrar `tabla = true | registrar = true | resumen = true`.

**Cambian:** `data.js` (contador), `metricas.html` + `metricas.js` (nuevo panel), `index.html` y `moderacion.html` (enlace 📊 Métricas), `privacidad.html`, `styles.css`; caché `?v=67`.

- **Qué se cuenta:** cada página abierta y cada toque en WhatsApp, Llamar, Cómo llegar y Compartir (con el comercio o anuncio). De dónde llegó: WhatsApp, Facebook, Instagram, Google, TikTok o lo que diga `?o=` en el enlace (ej. `?o=qr`, `?o=volante`).
- **Qué NO se guarda:** nombre, correo, teléfono, IP ni ubicación. Solo un código al azar por navegador. Tus visitas de moderador no cuentan. Se borra a los 13 meses.
- **Dónde se ve:** `metricas.html` → botón **📊 Métricas** en la barra amarilla de moderador del inicio, o en el menú de **Moderación**.
- **Copiar resumen:** arma un texto corto para pegar en WhatsApp (socios, comercios, inversionistas).

**Revertir:** PR → **Revert**. Para dejar de contar sin revertir: `revoke execute on function registrar_evento(text,text,text,bigint,text,text) from anon, authenticated;`

## Fase 2AK · Administrador ≠ moderador + revisión de seguridad

**SQL:** `supabase/38_admin_seguridad.sql` — **antes** de fusionar. Debe mostrar `es_admin_existe = true | administradores = 1 | funciones_admin = 4 | topes = 7 | equipo = true`.

**Cambian:** `data.js`, `styles.css`, `index.html`, `post.html`, `moderacion.*`, `admin-comercios.*`, `editar-inicio.*`, `metricas.*`, `referidos.*`, `app.js`, `anuncio.js`; nuevo `SEGURIDAD.md` (informe); caché `?v=68`.

| Acción | 👑 Administrador | 🛡️ Moderador |
|---|:-:|:-:|
| Reportes, ocultar contenido, foro, opiniones, verificar comercios | ✅ | ✅ |
| Negocios nuevos y reclamos de fichas | ✅ aprueba | 👍/👎 propone |
| Editar inicio, logo, Selección del día, categorías, palabras prohibidas, entrenar buscador | ✅ | ❌ |
| Métricas, referidos, lista de espera, cupo de productos, dueños, visto bueno sanitario, borrar comercios | ✅ | ❌ |
| Nombrar o quitar moderadores (👥 Equipo, en Moderación) | ✅ | ❌ |

- **Nombrar un moderador:** la persona crea su cuenta → Moderación → 👥 Equipo → buscar por nombre o correo → «🛡️ Nombrar moderador». Lo verá al recargar.
- **El rol de administrador** solo se cambia en el SQL Editor: `update perfiles set rol = 'admin' where id = '<id>';`
- **Topes nuevos:** reportes 10/hora, solicitudes 5/hora, foro 5 temas y 20 comentarios por hora, lista de espera 100/hora en total.

**Revertir:** PR → **Revert**. (Si se revierte la página pero no el SQL, lo único distinto es que un moderador ve botones que la base le rechaza.)

## Fase 2AL · Reglas, artículos prohibidos, Mascotas y +18

**SQL:** `supabase/39_reglas_prohibidos.sql` — **antes** de fusionar. Debe mostrar `prohibidas ≥ 170 | permitidas ≥ 65 | sanciones = true | mascotas = 11 | adultos = true`. Al correrlo revisa lo ya publicado (hoy no hay nada que ocultar).

**Cambian:** `terminos.html` (§4 y §5), nuevo `prohibidos.html` (enlazado en los pies de página), `data.js`, `app.js`, `anuncios-comun.js`, `anuncio.js`, `tienda.js`, `moderacion.*`, `styles.css`, `registrar-negocio.html`; nuevo `PRUEBAS-FILTRO.md`; caché `?v=69`.

- **Filtro:** «bloquear» solo lo inequívoco; lo dudoso se publica y va a «🚫 Palabras prohibidas». Entiende trucos y plurales. **Frases permitidas** (Moderación → ✅ Frases permitidas) tachan falsos positivos («pistola de silicona», «huevos pericos», «periquito australiano»…); pueden ser solo para una categoría.
- **Pedir revisión:** si el filtro bloquea a alguien, puede pedir revisión; tú la ves en «🙋 Piden revisión» y con un toque permites la frase.
- **Lo ya publicado:** cada vez que cambias la lista se revisa todo: lo que choca con «bloquear» se oculta solo y queda en la cola.
- **3 reportes** de personas distintas (prohibido o estafa) ocultan el anuncio o producto hasta que lo revises.
- **Sanciones** (solo administrador): en 👥 Equipo o en un reporte → ⚠️ Aviso · ⏸ Suspender 30 días · 🚫 Vetar (oculta sus anuncios, le quita sus comercios y bloquea su WhatsApp, teléfono y correo) · ↩️ Levantar.
- **Mascotas:** subcategorías nuevas y declaración obligatoria. **🔞 Íntimo +18:** fotos difuminadas hasta confirmar la edad; no sale en «Todos» ni en el inicio. **Licores:** leyenda legal. **Tabaco y vapeadores:** solo en vitrinas de comercios, con advertencia.

**Revertir:** PR → **Revert**. El SQL puede quedarse; para aflojar el filtro basta apagar palabras o agregar frases permitidas desde Moderación.

## Fase 2AN · El filtro aplica a todos + clave de seguridad del administrador

**SQL:** `supabase/40_filtro_todos_clave.sql` — **antes** de fusionar. Debe mostrar `clave = true | filtro_todos = true | cola_todos = true`. Al correrlo oculta el anuncio de prueba «Cocaina» y lo deja en la cola.

**Cambian:** `data.js`, `app.js`, `index.html` (aviso en la barra), `moderacion.*` (🔐 Tu seguridad); caché `?v=70`.

- **Moderadores:** el filtro les aplica siempre. Para quitar algo prohibido de un anuncio ajeno, lo ocultan o lo eliminan.
- **Administrador:** también le aplica. Para publicar algo que el filtro bloquea: Moderación → **🔐 Tu seguridad** → clave → «🔓 Desbloquear filtro» (15, 30 o 60 min). Se bloquea solo o con «Volver a bloquear ahora».
- **Clave de seguridad:** distinta de la contraseña de la cuenta, guardada cifrada (nadie la puede leer, ni desde la base). 5 intentos fallidos la bloquean 1 hora. Para cambiarla hay que saber la actual. **Si la olvidas:** en el SQL Editor `delete from seguridad_admin;` y la creas de nuevo.
- **Aviso de sesión:** la barra muestra si el filtro está activo y cuántas sesiones tiene abierta tu cuenta; en «Tu seguridad» ves cada dispositivo con su IP y puedes cerrar todas las demás.

**Revertir:** PR → **Revert** (si se revierte solo la página, el filtro sigue aplicando a todos; el desbloqueo se haría por SQL).


## Fase 2AP-1 · Centro de marketing (antes «Enlaces y QR»)

**SQL:** ninguno. **Cambian:** nuevo `marketing.html` + `marketing.js` (reemplaza `referidos.js`; `referidos.html` solo redirige), `index.html` (botón 📣 Marketing en la barra del administrador y en el menú de la cuenta), `app.js` (enlace `#registro` abre «Crear cuenta»), `moderacion.html`, `admin-comercios.*`, `metricas.*`, `editar-inicio.html`, `styles.css`; nuevos `docs/manual-marketing-merkap.pdf` y `herramientas/manual_marketing.py`; caché `?v=71`.

- **Cómo se usa:** 1) destino y canal → el código se sugiere solo (cámbialo por grupo) · 2) texto (3 versiones, se adapta al canal) · 3) imagen (formato, plantilla, colores, ícono, fondo propio o de IA) · 4) descargar o compartir.
- **Medición:** el enlace lleva `?ref=código` (cuentas nuevas, tabla de abajo) y `?o=canal` (visitas en 📊 Métricas → De dónde llegan).
- **Por qué la imagen se hace en el navegador (canvas):** gratis, sin servidores ni servicios externos, y la foto que subes no sale de tu equipo.
- **Por qué la página libre solo acepta páginas `.html` de Merkap:** evita usar el panel para mandar gente a otros sitios con la marca Merkap.
- **«Mi versión» del texto** se guarda en este navegador (en otro celular no aparece). En 2AP-2 pasará a la base.
- **Manual:** para cambiarlo, edita `herramientas/manual_marketing.py` y corre `python3 herramientas/manual_marketing.py`.

**Revertir:** PR → **Revert** (no hay SQL).

## Fase 2AP-2 · Campañas con enlace corto redirigible

**SQL:** `supabase/41_campanas.sql` — **antes** de fusionar. Debe mostrar `tablas = 4 | abrir = true | resumen = true | seguras = true`.

**Cambian:** `marketing.html` / `marketing.js` (📋 Mis campañas, enlace corto, destino «Producto o promoción», textos en la base), `data.js` (abre `?c=` y redirige), `index.html` (tapa la página mientras redirige), `metricas.js`, `styles.css`, `SEGURIDAD.md`; caché `?v=72`.

- **Cómo funciona:** el QR lleva `…/?c=panaderia-lacentral`. Al escanearlo, la página pregunta a la base «¿a dónde va hoy?» (`abrir_campana`), suma el escaneo y redirige agregando `?ref=` y `?o=`.
- **Por qué el código no se puede cambiar:** es lo que está impreso. Para otro código se crea otra campaña.
- **Pausada o borrada:** quien escanee llega al inicio (en Métricas sale como origen «Campaña pausada o borrada»).
- **Privacidad:** solo se guarda el código al azar del navegador que ya usan las métricas. Sin nombre, IP ni ubicación.
- **Prueba real:** tus escaneos (administrador) no cuentan. Para probar, escanea con otro celular o en una ventana de incógnito sin sesión.

**Revertir:** PR → **Revert**. Las tablas pueden quedarse; sin el código nuevo, `?c=` simplemente abre el inicio.

## Fase 2AP-3 · Compartir para dueños + buscador rápido

**SQL:** ninguno. **Cambian:** nuevos `piezas.js` (el dibujo de las imágenes, sacado de `marketing.js`) y `compartir.js` (ventana «📣 Comparte…»), `mi-tienda.*`, `anuncio.*`, `app.js` (Mis anuncios), `index.html`, `tienda.js`, `marketing.*`, `styles.css`; caché `?v=73`.

- **Dueños:** Mi tienda → **📣 Comparte tu tienda**; en su anuncio → **📣 Compartir mi anuncio** (también en «📋 Mis anuncios»). Eligen el canal (WhatsApp, Estado, Facebook, Instagram, Sticker), el texto y el color; descargan o comparten.
- **Por qué el link lleva `ref=tienda-ID`:** así sabes qué tienda trae cuentas nuevas (sale con su nombre en «Cuentas nuevas por código»).
- **La imagen no es un link:** el botón de la imagen ahora dice qué hacer según el canal, y la ventana recuerda mandar imagen + texto.
- **Administrador:** en 📣 Marketing, con destino Vitrina, Producto o Anuncio, escribe el nombre en **🔎 Busca…** y elige. En la ficha de cualquier tienda o anuncio tienes **📣 Pieza de marketing**.
- **+18:** se comparte sin foto de fondo.

**Revertir:** PR → **Revert** (no hay SQL).

## Fase 2AP-3b · Rapidez y rescate de carga

**SQL:** ninguno. **Cambian:** todas las páginas (`tw.css` en vez de `cdn.tailwindcss.com`), nuevos `tw.css`, `herramientas/tailwind_css.py` y `herramientas/tailwind-play-3.4.js`, `utils.js` (versión + rescate), `marketing.js`, `tienda.*`, `admin-comercios.js`; caché `?v=74`.

- **Por qué era lento:** cada página bajaba el Tailwind «de prueba» (400 KB) y el celular armaba los estilos al abrir. Ahora los estilos ya vienen hechos en `tw.css` (43 KB, queda guardado en el celular).
- **Regla nueva al cambiar el diseño:** si agregas clases de Tailwind nuevas, corre `python3 herramientas/tailwind_css.py` (las pruebas avisan si se olvidó).
- **Regla nueva al publicar:** subir a la vez el `?v=` de las páginas y `VERSION_SITIO` en `utils.js` (mismo número).
- **Por qué el Centro de marketing se quedaba «Cargando…»:** la página guardada en el celular era la anterior y pedía archivos con otro número de versión; al mezclarse, faltaba `piezas.js`. Ahora (a) el panel abre aunque falte ese archivo y (b) la página detecta la mezcla y se recarga sola.

**Revertir:** PR → **Revert**.

## Fase 2AP-3c · Arreglo del «Cargando…» del Centro de marketing

**SQL:** ninguno. **Cambian:** `piezas.js` (`alCargarLogo` siempre espera un instante), `marketing.js` (el aviso de logo se registra después de declarar lo que usa), caché `?v=75` y `VERSION_SITIO = 75`.

- **Qué pasaba:** si el logo ya estaba en la memoria del celular, `alCargarLogo` llamaba enseguida a `programarDibujo()`, que usa una variable (`let dibujoPendiente`) declarada más abajo en el archivo. En JavaScript, usar un `let` antes de su línea da error y el resto del archivo no corre → «Cargando…».
- **Lección:** el aviso «⚠️ La página no terminó de cargar» con el error escrito permitió encontrarlo en minutos. Si vuelve a salir en otra página, una captura basta.

## Fase 2AP-4a · Promociones de las tiendas + rebajas en anuncios

**SQL:** `supabase/42_promociones_rebajas.sql` — **antes** de fusionar. Debe mostrar `rebajas = true | promociones = true | seguras = true | filtro = true`.

**Cambian:** `data.js` (rebajas, promos, ventana «Rebajar»), `mi-tienda.*` (🔥 Mis promociones), `tienda.*` (sección de promos), `app.js` (Mis anuncios, Novedades, compartir al publicar, aviso al bajar el precio), `anuncio.*`, `anuncios-comun.js`, `comercios.js`, `buscar.js`, `compartir.js` (tipo «promo»), `index.html`, `styles.css`, `tw.css`; caché `?v=76`.

- **Reglas en la base (no se pueden saltar desde el navegador):** 2 promos activas o programadas por tienda, 15 días máximo, precio de promo menor que el normal, solo el dueño o el administrador, filtro de palabras. El público solo ve las vigentes de tiendas activas.
- **Rebaja honesta:** el precio anterior lo guarda el servidor al bajar el precio; no se puede escribir a mano. Se muestra 15 días.
- **Descubrimiento:** «💡 ¿Para qué sirve?» abierta la primera vez, tarjeta de Novedades una sola vez por persona (se cierra con «Ahora no»), pista en Mis anuncios y oferta de compartir al publicar.

**Revertir:** PR → **Revert**. El SQL puede quedarse (sin la página nueva, nadie ve promociones; los anuncios rebajados se ven con su precio nuevo).

## Fase 2AP-4a.1 · Un solo «Compartir» para el dueño

**SQL:** ninguno. **Cambian:** `anuncio.js`, `tienda.js`; caché `?v=77`.

- **Dueño** (de su anuncio o su tienda): solo el botón morado «📣 Compartir…». El blanco se oculta y, en el celular, la barra de abajo (📣) abre el morado.
- **Visitante:** el «🔗 Compartir» blanco de siempre (comparte el enlace con el menú del celular).
- **Por qué:** dos botones «Compartir» confundían al dueño; el morado es el que le sirve (imagen, texto y QR con su código).

## Fase 2AP-4a.2 · Arreglo: anuncios que no cargaban después del SQL 42

**SQL:** `supabase/43_permiso_rebajas.sql` (una línea: `grant select (precio_anterior, rebajado_en) on anuncios`). Debe mostrar `lectura = true`.

- **Qué pasó:** desde el SQL 13b la lectura de `anuncios` se da **columna por columna** (para que nadie lea el WhatsApp o el teléfono directo). Las columnas nuevas nacen **sin** permiso de lectura. La página las pedía → «permission denied» → lista vacía y publicar fallaba al devolver el anuncio guardado.
- **Lección para próximas fases:** cada columna nueva en `anuncios` necesita su `grant select (...)`. Las pruebas locales no lo vieron porque la base de prueba no tiene esos permisos por columna.
- **Red de seguridad:** si una columna nueva no se puede leer, `data.js` repite la consulta sin ella (la página se ve, solo sin la etiqueta de rebaja).
