# Hoja de ruta de MercaFree (actualizada)

**Principio:** un paso a la vez, y cada paso deja algo funcionando. Y **no se avanza de fase hasta que la actual esté publicada y probada con personas reales.**

**Enfoque:** clasificados hiperlocales de barrio (mapa + WhatsApp), empezando en Colombia por los municipios que ya están activos en la plataforma (se amplían por demanda: cuando una ciudad lo pide, se activa). El resto del país y otros países vienen después, con el mismo producto.

**Riesgo principal:** el arranque en frío. Un marketplace vacío no sirve, así que se siembra la oferta (vendedores y tiendas) *antes* de buscar compradores.

---

## Fase 1: Prototipo estático mejorado ✅ (hecha)
Escapado de HTML, hash de contraseñas, mapa con clusters, página de detalle, formulario por pasos, guardado seguro. Ver `GUIA-DE-CAMBIOS.md`.

## Fase 2A: Backend real (código listo; falta probar con el servidor real y publicar)
**Meta:** que lo que publica una persona lo vea todo el mundo.
**Herramienta:** Supabase (Postgres + Auth + Storage + PostGIS), enlazado con este repositorio de GitHub.

| # | Paso | Por qué |
|---|---|---|
| 1 ✅ | URL del proyecto y clave pública en `data.js` (nunca la `service_role`) | La `anon` es pública por diseño; su seguridad la dan las reglas RLS |
| 2 ✅ | Crear tablas: `perfiles`, `municipios`, `anuncios` (con columna geográfica y `expira_en`), `fotos_anuncio`, `reportes`, `temas_foro`, `comentarios_foro`, `lista_espera` | Todo el modelo de datos en un script SQL que ejecutas una vez |
| 3 ✅ | **RLS (seguridad por filas):** cualquiera lee anuncios activos; solo el dueño edita los suyos; solo el rol admin/moderador borra ajenos | Reemplaza el falso `?editar=1`: la regla vive en la base de datos, no en el navegador |
| 4 ✅ | Login real: correo y contraseña, con recuperar contraseña (Google queda pendiente: se activa en el panel de Supabase) | El teléfono con OTP necesita SMS de pago: se pospone |
| 5 ✅ | Fotos en Supabase Storage con límite de tamaño | Adiós al límite de 5 MB de `localStorage` |
| 6 ✅ | **Ciudad como lista cerrada** (tabla `municipios`) + "Mi ciudad no está" que se envía a revisión | Evita que "envigado" y "Envigado" cuenten como lugares distintos |
| 7 ✅ | Reescribir `data.js` para hablar con Supabase (el resto de la app casi no cambia) | Por eso en la Fase 1 aislamos todo el acceso a datos en un solo archivo |
| 8 ✅ | **Base limpia:** NO se migran los anuncios de ejemplo (sus números de WhatsApp son inventados y podrían ser de personas reales) | Mostrar anuncios falsos a usuarios reales es engañarlos |
| 9 | Vencimiento a 30 días (`expira_en`) y reglas básicas anti-spam (límite de publicaciones por usuario, palabras prohibidas) | Mantiene fresco el catálogo y frena el abuso desde el día uno |

## Fase 2B: Mínimo legal + beta cerrada (en curso)
**Hecho:** términos, política de datos (`terminos.html`, `privacidad.html`), botón reportar, panel de moderación (`moderacion.html`), visor de foto completa, comercios del mapa (`admin-comercios.html`, tabla `comercios`). importador de comercios con Overpass, editor de comercios con verificación y corrección manual de ubicación (pin, GPS y dirección), pin automático por barrio o dirección en el formulario de publicar, aviso «ver anuncio completo» y pines diferenciados. **Falta:** confirmar el NIT del responsable en los textos legales, revisión por abogado, verificar comercios en persona, dominio propio.
**Antes de abrir al público** (consúltalo con un abogado local):
- Términos y condiciones, política de tratamiento de datos (Ley 1581 de 2012, habeas data) y lista de contenido prohibido.
- Botón **"Reportar anuncio"** y un panel simple de moderación (rol moderador).
- **Lista de espera** para otras ciudades: "Aún no llegamos a tu ciudad, déjanos tu WhatsApp".
- **Filtros dinámicos:** departamento y ciudad aparecen solo si tienen anuncios.

**Beta cerrada** con 20-50 vendedores reales del barrio. El frontend puede seguir en GitHub Pages (con dominio propio y HTTPS gratis); recuerda que en el plan gratis el repositorio es público, así que nunca subas claves secretas.

## Fase 2C: Portada y ficha de anuncio (mejor experiencia, sin esperar tráfico)
**Meta:** que quien entre en el celular entienda en 5 segundos qué hacer (comprar, vender o buscar un comercio), que el anuncio genere confianza y que quede una razón para volver.
**Origen:** análisis de otros marketplaces colombianos (octubre 2026). Se toman las *ideas de funcionamiento*, nunca su diseño, textos, logos ni marca: MercaFree conserva su identidad propia y su diferencial (mapa + directorio de comercios).
**Lo que ya tenemos y no hay que rehacer:** compartir, anuncios similares, «Cómo llegar», mapa con pines, WhatsApp directo, foro, reportes, visor de fotos completo.

| Sub-fase | Qué se construye | Por qué (valor) | Esfuerzo |
|---|---|---|---|
| **2C.1 Privacidad y ficha** | **Ubicación aproximada** en anuncios de personas (el pin se muestra desplazado/redondeado ~300 m y se avisa «Zona aproximada»; los comercios sí muestran la dirección exacta). «Publicado hace X días». Etiquetas claras: estado (nuevo/usado), precio fijo o negociable. Contador de fotos «1/10» con puntos. **Barra fija inferior en móvil:** Compartir · Guardar · Escribir por WhatsApp. | Hoy el pin de un anuncio es exacto: puede revelar la casa de la persona (riesgo de seguridad y de habeas data). Se corrige **antes** de abrir al público. | Pequeño |
| **2C.2 Favoritos** | Tabla `favoritos` (usuario + anuncio, RLS: cada quien ve solo los suyos), corazón «Guardar» en tarjeta y ficha, página «Mis favoritos». | Primer motivo para registrarse y volver; base para avisos futuros (bajó de precio, vendido). | Pequeño |
| **2C.3 Portada** | **Navegación inferior en móvil:** Inicio · Buscar · Publicar · Comercios · Entrar. **Accesos rápidos** arriba: «Publicar», «Comercios cerca», «Mapa». **Selector de vista:** lista · cuadrícula · mapa. **Ordenar:** recientes · cercanos · precio. **«Selección del día»:** al inicio la eligen los moderadores (campo en `anuncios`) o se arma sola con los más recientes que tengan foto; sin dinero de por medio. | Es lo que más gusta de la referencia: portada ordenada, rápida de usar con el pulgar y con algo nuevo cada día. | Mediano |
| **2C.4 Similares mejorados** | «Anuncios similares» ordenados por categoría + cercanía, con distancia («a 2 km»). Texto corto que explica cómo se ordenan los resultados. | Más páginas vistas por visita; transparencia con el usuario. | Pequeño |
| **2C.5 Perfil público del vendedor** | Página `vendedor.html?id=…` con el nombre, «Miembro desde…», cantidad de anuncios activos y **todos sus anuncios** (con buscador y filtros). En cada ficha, el nombre del vendedor enlaza a su perfil. Los comercios del directorio ya tienen su propia ficha. **Privacidad:** la tabla `perfiles` hoy es privada (cada quien ve solo la suya); no se abre. Se crea una **vista pública** (o función segura) que expone únicamente `id`, nombre visible y fecha de registro, nunca correo ni rol. Opción de usar un nombre de tienda o apodo en vez del nombre real. | Quien ve un anuncio que le gusta quiere ver «qué más vende»: más páginas vistas, más ventas por vendedor y el vendedor siente que tiene una vitrina propia. Es la base del sello de confianza de la Fase 4. | Mediano |

**Criterio para pasar a la siguiente fase:** beta cerrada funcionando con 20-50 vendedores reales, sin errores graves en una semana y con respuestas de usuarios sobre la portada nueva.

## Plan de arranque comercial (en paralelo a 2A/2B)
1. **Programa Fundadores:** las primeras 100 tiendas del Valle reciben el plan destacado gratis; cada una trae su clientela.
2. **Presencia física:** QR en ferreterías, panaderías y tiendas.
3. **Compartir:** botón de compartir por WhatsApp (ya existe en cada anuncio) y un canal de "mejores anuncios del día".
4. **SEO local:** Google Business Profile y, en la Fase 3, páginas `/envigado/autos`.
5. **Métricas a vigilar:** anuncios por día, clics a WhatsApp por anuncio, vendedores que vuelven en 7 días, relación oferta/demanda.

## Fase 3: SEO y escala
**Meta:** que Google indexe los anuncios (tráfico orgánico = la fuente gratuita más importante de OLX y Revolico).
**Por qué:** hoy el HTML del anuncio se arma con JavaScript; los buscadores y las vistas previas de WhatsApp no lo ejecutan.
Pasos: migrar a Astro o Next.js con renderizado en servidor (Vercel o Cloudflare Pages, ya no GitHub Pages), URLs limpias (`/envigado/autos/mazda-3-2019-123`), `sitemap.xml`, datos estructurados, Tailwind compilado, PWA, campos por categoría (año/km en autos, m²/habitaciones en inmuebles) **según lo que se use de verdad**, búsqueda por cercanía con PostGIS.
*Se migra cuando haya tráfico y publicaciones reales, no por calendario.*

## Fase 4: Confianza y moderación con IA
Búsquedas guardadas con aviso, ocultar el número hasta pulsar el botón (el WhatsApp hoy se puede leer desde la API pública), vendedores verificados (teléfono) y chat interno.
- **Reputación del vendedor** (se muestra en el perfil público de la 2C.5 y en la ficha): sello simple calculado por reglas claras (antigüedad de la cuenta, anuncios activos, reportes resueltos, verificación): «Nuevo» → «En crecimiento» → «Confiable». Se muestra en la ficha junto al nombre.
- **Seguir a un vendedor y «Pedir algo»:** botón «+ Seguir» (aviso cuando publique algo nuevo) y una solicitud directa a la tienda («no veo lo que busco»: el comprador deja qué necesita y el vendedor recibe los datos organizados). Solo cuando haya vendedores con varios anuncios.
- **Preguntas públicas en el anuncio:** el comprador pregunta, el vendedor responde y todos lo ven (reduce preguntas repetidas por WhatsApp). Se enlaza con el foro existente.
- **Precio anterior e historial:** guardar los cambios de precio (tabla `precio_historial` con un trigger) para mostrar «bajó de precio», precio anterior tachado y un gráfico simple. Solo con datos reales, nunca inventados.
**IA:** moderación asistida con la API de Claude para detectar estafas y contenido prohibido, desde un backend (la clave nunca va en el navegador). Apoya a un moderador humano, no lo reemplaza, y se menciona en la política de privacidad.

## Fase 5: Ingresos y automatización
**Destacados («Reservar espacio»):** espacios pagados en la portada, en «Selección del día» y en anuncios similares. **No se activan hasta que haya tráfico real**: un espacio vacío que dice «Tu anuncio aquí» sin visitas resta credibilidad. Precios y duración se definen con los datos de la beta (visitas y clics a WhatsApp por anuncio), no antes.
Perfiles/catálogo de tienda, planes para negocios (cobro con Wompi, PSE o Nequi), autocompletado de título y categoría desde la foto, publicación automática de anuncios nuevos en Telegram/Instagram con n8n o Make, resumen semanal por correo. *Se automatiza cuando haya volumen que lo justifique.*

## Fase 6: Marketplace transaccional
Pagos protegidos, pedidos, domicilios para tiendas, calificaciones y disputas, WhatsApp Business API. Es lo más complejo y regulado: solo cuando haya usuarios que lo pidan.

## Fase 7: Expansión
Otras ciudades por demanda (cuando una llegue a ~30 anuncios se activa con su página, `/bogota`, `/cali`), otros países (código de país en WhatsApp, multimoneda, pagos locales) y versión liviana estilo Revolico. Traducción español/inglés de las descripciones y conversión a dólares: solo si se abre al turismo o a otros países (hoy no aportan).

---

## Ideas vistas y descartadas por ahora
- **Botón de pagos dentro de la ficha y chat propio con pagos:** corresponde a la Fase 6 (regulado y complejo); mientras tanto el contacto es directo y sin comisión.
- **Traducción ES/EN y precio en USD:** no aportan al público local de hoy.
- **Espacio publicitario visible sin anunciantes:** se pospone a la Fase 5.

## Notas de avance
- **Oct 2026:** el formulario de publicar ubica el pin solo al escribir barrio o dirección (OpenStreetMap/Nominatim). Si algún día falla mucho en direcciones exactas, el reemplazo previsto es Google Places (con clave y costo por uso).
