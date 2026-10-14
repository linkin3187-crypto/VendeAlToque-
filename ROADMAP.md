# Hoja de ruta de MercaFree (actualizada)

**Principio:** un paso a la vez, y cada paso deja algo funcionando. Y **no se avanza de fase hasta que la actual esté publicada y probada con personas reales.**

**Enfoque:** clasificados hiperlocales de barrio (mapa + WhatsApp), empezando en Colombia por el **Valle de Aburrá**: Medellín, Bello, Itagüí, Envigado, Sabaneta, La Estrella, Caldas, Copacabana, Girardota y Barbosa. Rionegro (Oriente) y el resto del país se abren por demanda.

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
**Hecho:** términos, política de datos (`terminos.html`, `privacidad.html`), botón reportar, panel de moderación (`moderacion.html`), visor de foto completa, comercios del mapa (`admin-comercios.html`, tabla `comercios`). **Falta:** completar datos del responsable en los textos legales, revisión por abogado, verificar comercios en persona, dominio propio.
**Antes de abrir al público** (consúltalo con un abogado local):
- Términos y condiciones, política de tratamiento de datos (Ley 1581 de 2012, habeas data) y lista de contenido prohibido.
- Botón **"Reportar anuncio"** y un panel simple de moderación (rol moderador).
- **Lista de espera** para otras ciudades: "Aún no llegamos a tu ciudad, déjanos tu WhatsApp".
- **Filtros dinámicos:** departamento y ciudad aparecen solo si tienen anuncios.

**Beta cerrada** con 20-50 vendedores reales del barrio. El frontend puede seguir en GitHub Pages (con dominio propio y HTTPS gratis); recuerda que en el plan gratis el repositorio es público, así que nunca subas claves secretas.

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
Favoritos, búsquedas guardadas, vendedores verificados, chat interno, ocultar el número hasta pulsar el botón.
**IA:** moderación asistida con la API de Claude para detectar estafas y contenido prohibido, desde un backend (la clave nunca va en el navegador). Apoya a un moderador humano, no lo reemplaza, y se menciona en la política de privacidad.

## Fase 5: Ingresos y automatización
Anuncios destacados, perfiles/catálogo de tienda, planes para negocios (cobro con Wompi, PSE o Nequi), autocompletado de título y categoría desde la foto, publicación automática de anuncios nuevos en Telegram/Instagram con n8n o Make, resumen semanal por correo. *Se automatiza cuando haya volumen que lo justifique.*

## Fase 6: Marketplace transaccional
Pagos protegidos, pedidos, domicilios para tiendas, calificaciones y disputas, WhatsApp Business API. Es lo más complejo y regulado: solo cuando haya usuarios que lo pidan.

## Fase 7: Expansión
Otras ciudades por demanda (cuando una llegue a ~30 anuncios se activa con su página, `/bogota`, `/cali`), otros países (código de país en WhatsApp, multimoneda, pagos locales) y versión liviana estilo Revolico.
