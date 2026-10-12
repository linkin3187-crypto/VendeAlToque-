# Hoja de ruta de MercaFree

Principio: **un paso a la vez, y cada paso deja algo funcionando.** No se copia todo de Marketplace, OLX, Mercado Libre, Revolico, eBay y Amazon a la vez: son modelos distintos. La ventaja de MercaFree es el **clasificado hiperlocal de barrio** (mapa + WhatsApp). Se empieza ahí, en Colombia.

## Fase 1: Prototipo estático mejorado ✅ (hecha)
Seguridad básica, mapa con clusters, detalle de anuncio, formulario por pasos. Ver `GUIA-DE-CAMBIOS.md`.

## Fase 2: Backend real (siguiente)
**Meta:** que lo que publica una persona lo vea todo el mundo.
**Herramienta recomendada:** Supabase (Postgres + Auth + Storage + PostGIS, capa gratuita).
**Por qué:** es el salto más barato desde el código actual: casi todo el acceso a datos ya está aislado en `data.js`.

Pasos:
1. Crear el proyecto en Supabase (lo haces tú; te guío en cada clic).
2. Diseñar tablas: `perfiles`, `anuncios` (con columna geográfica), `fotos_anuncio`, `temas_foro`, `comentarios_foro`.
3. **Row Level Security (RLS):** reglas en la base de datos ("solo el dueño edita su anuncio", "cualquiera lee"). Es lo que reemplaza al falso "modo editor".
4. Autenticación real (correo y contraseña, recuperar contraseña) en lugar de la cuenta de prueba.
5. Fotos en Supabase Storage con miniaturas, no en base64.
6. Reescribir `data.js` para hablar con Supabase; consultas por zona del mapa con PostGIS.
7. Migrar los datos de ejemplo y probar con dos navegadores distintos.

Lo que necesito de ti: crear la cuenta de Supabase y pegarme la URL del proyecto y la clave `anon` (es pública por diseño; **nunca** pegues la clave `service_role`).

## Fase 3: SEO y escala
**Meta:** que Google indexe tus anuncios (en clasificados, el tráfico orgánico es la clave).
**Por qué:** hoy el HTML de cada anuncio se arma con JavaScript, y los buscadores y las vistas previas de WhatsApp no lo ejecutan.
Pasos: migrar a Astro o Next.js (renderizado en servidor), URLs limpias por ciudad/categoría/anuncio (`/envigado/autos/mazda-3-2019-123`), `sitemap.xml`, datos estructurados `schema.org/Product`, Tailwind compilado, imágenes optimizadas.

## Fase 4: Confianza y seguridad
Favoritos, búsquedas guardadas, **reportar anuncio**, moderación, vendedores verificados, caducidad de anuncios, chat interno, anti-spam (límite de publicaciones por usuario, captcha), ocultar el número de WhatsApp hasta pulsar el botón.
**Legal:** consulta con un abogado local la política de tratamiento de datos (Ley 1581 de 2012, habeas data) y los términos de uso antes de lanzar públicamente.

## Fase 5: Ingresos
Anuncios destacados, perfiles de tienda/comercio, planes para negocios. Antes: medir qué categorías y barrios tienen más actividad.

## Fase 6: Marketplace transaccional
Pagos (Wompi, Mercado Pago, PSE), envíos (Servientrega, Coordinadora), calificaciones, disputas. **Es lo más complejo y regulado**: se hace cuando ya hay usuarios que lo pidan.

## Fase 7: Expansión
Otros países: código de país en WhatsApp, multimoneda, idiomas, pagos locales. Para el estilo Revolico (poca conexión) conviene una versión liviana. Los pagos y envíos cambian mucho por país.

---
**Regla para avanzar de fase:** no se empieza la siguiente hasta que la actual esté publicada y probada por personas reales.
