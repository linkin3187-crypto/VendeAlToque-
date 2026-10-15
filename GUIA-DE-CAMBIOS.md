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
