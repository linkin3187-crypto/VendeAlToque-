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
