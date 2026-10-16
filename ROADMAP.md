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
| **2C.1 Privacidad y ficha** ✅ *(ubicación aproximada y barra inferior hechas; faltan «Publicado hace X días», etiquetas de precio y contador de fotos)* | **Ubicación aproximada** en anuncios de personas (el pin se muestra desplazado/redondeado ~300 m y se avisa «Zona aproximada»; los comercios sí muestran la dirección exacta). «Publicado hace X días». Etiquetas claras: estado (nuevo/usado), precio fijo o negociable. Contador de fotos «1/10» con puntos. **Consejos de seguridad en la ficha** (ver el artículo en persona, no adelantar dinero, encontrarse en un lugar público). **Barra fija inferior en móvil:** Compartir · Guardar · Escribir por WhatsApp. | Hoy el pin de un anuncio es exacto: puede revelar la casa de la persona (riesgo de seguridad y de habeas data). Se corrige **antes** de abrir al público. | Pequeño |
| **2C.2 Favoritos** ✅ *(hecho: SQL 05, corazón en tarjeta y ficha, página «Mis favoritos»)* | Tabla `favoritos` (usuario + anuncio, RLS: cada quien ve solo los suyos), corazón «Guardar» en tarjeta y ficha, página «Mis favoritos». | Primer motivo para registrarse y volver; base para avisos futuros (bajó de precio, vendido). | Pequeño |
| **2C.3 Portada** | **Navegación inferior en móvil:** Inicio · Buscar · Publicar · Comercios · Entrar. **Accesos rápidos** arriba: «Publicar», «Comercios cerca», «Mapa». **Selector de vista:** lista · cuadrícula · mapa. **Ordenar:** recientes · cercanos · precio. **«Selección del día»:** al inicio la eligen los moderadores (campo en `anuncios`) o se arma sola con los más recientes que tengan foto; sin dinero de por medio. | Es lo que más gusta de la referencia: portada ordenada, rápida de usar con el pulgar y con algo nuevo cada día. | Mediano |
| **2C.4 Similares mejorados** | «Anuncios similares» ordenados por categoría + cercanía, con distancia («a 2 km»). Texto corto que explica cómo se ordenan los resultados. | Más páginas vistas por visita; transparencia con el usuario. | Pequeño |
| **2C.5 Perfil público del vendedor** | Página `vendedor.html?id=…` con el nombre, «Miembro desde…», cantidad de anuncios activos y **todos sus anuncios** (con buscador y filtros). En cada ficha, el nombre del vendedor enlaza a su perfil. Los comercios del directorio ya tienen su propia ficha. **Privacidad:** la tabla `perfiles` hoy es privada (cada quien ve solo la suya); no se abre. Se crea una **vista pública** (o función segura) que expone únicamente `id`, nombre visible y fecha de registro, nunca correo ni rol. Opción de usar un nombre de tienda o apodo en vez del nombre real. | Quien ve un anuncio que le gusta quiere ver «qué más vende»: más páginas vistas, más ventas por vendedor y el vendedor siente que tiene una vitrina propia. Es la base del sello de confianza de la Fase 4. | Mediano |
| **2C.6 Cómo llegar** ✅ *(hecho)* | Botón «Cómo llegar» con menú: transporte público (metro y buses), a pie, bicicleta, carro, Waze, **Uber** con el destino ya puesto y «copiar destino» para DiDi/inDrive (no hay enlace público fiable). Si el anuncio es de zona aproximada, todo apunta a la zona, nunca al punto real. **Punto de encuentro seguro:** atajos a estaciones, centros comerciales y CAI cercanos + mensaje de WhatsApp listo. Líneas de taxi por ciudad (lista que carga el administrador; pendiente el panel). Solo enlaces: sin APIs, claves ni costo, y sin afirmar alianzas con las apps. | Facilita el encuentro y refuerza la seguridad entre personas. Casi nadie lo ofrece. | Pequeño |
| **2C.7 Guía rápida y punto acordado** ✅ *(hecho)* | **Guía rápida** en la ficha, en lenguaje sencillo: 4 pasos para comprar (escribir, acordar lugar, elegir cómo llegar, revisar antes de pagar) o para vender si el anuncio es tuyo; se puede cerrar y recuerda la elección. **Punto acordado:** en «Cómo llegar» el comprador pega la dirección o la ubicación que le mandó el vendedor y todas las opciones (Google Maps, Waze, Uber, copiar para DiDi/inDrive) se ajustan a ese punto. Los atajos a centros comerciales, estaciones y CAI buscan centrados en el anuncio. El formulario recomienda poner el pin en un lugar público y desmarcar «zona aproximada». **Decisión:** la zona aproximada se mantiene en 150–350 m; reducirla a ~20 m equivale a mostrar el edificio. | Quien no es de tecnología sabe qué hacer en cada paso, y se conserva la privacidad del vendedor. | Pequeño |
| **2C.8 Ajustes de móvil y claridad** ✅ *(hecho)* | Encabezado de la portada en dos filas en celular (nombre arriba, acciones abajo; «Publicar» sin «Gratis» en pantallas chicas) para que nada tape el logo ni ensanche la página. Frase destacada en la ficha: «¿Para qué sirve Cómo llegar?». Foto de la tarjeta en proporción 4:3 (antes una franja de 160 px) para reconocer el artículo sin entrar. | Se vio en el celular real: el encabezado se salía de la pantalla y la foto recortaba el producto. | Pequeño |

**Criterio para pasar a la siguiente fase:** beta cerrada funcionando con 20-50 vendedores reales, sin errores graves en una semana y con respuestas de usuarios sobre la portada nueva.

## Fase 2D: Verificación y vitrina del comercio (antes de salir a buscar tiendas)
**Meta:** que lo que se le ofrece a un comercio **exista de verdad** el día que lo visitemos, y que el sello «verificado» signifique algo concreto. La ficha actual solo tiene nombre, dirección, teléfono, horario y una foto.
**Idea central:** el comercio verificado recibe **gratis una vitrina propia** (su página con un mini-inventario de hasta 20 productos), algo que un usuario normal no tiene. Es la razón para dejarse visitar y para volver a actualizar.
**Alcance:** vitrina + contacto por WhatsApp. **No** hay carrito con pago, domicilios ni pedidos dentro de la plataforma (eso es la Fase 6): el pedido se arma y se envía por WhatsApp.

| Sub-fase | Qué se construye | Esfuerzo |
|---|---|---|
| **2D.1 Verificación** ✅ *(hecho: SQL 06, sellos por nivel, modo visita en el editor, historial y vencimiento a 12 meses; el sello solo cambia dejando un registro)* | Tabla `verificaciones_comercio` (comercio, quién verificó, fecha, método, foto de la fachada, notas). Niveles de sello (ver abajo). **Modo visita** en el editor: desde el celular, foto de la fachada, GPS del pin en la puerta y lista de comprobación; al terminar se marca el comercio. Repetir la verificación cada 12 meses o si hay reportes. | Mediano |
| **2D.2 Reclamar mi negocio** ✅ *(hecho: SQL 07, `owner_id`; el moderador asigna al dueño por correo o desde la solicitud «reclamar»; el dueño solo edita descripción, contacto, horario, foto y entrega, nunca el sello)* | El dueño entra con su cuenta, acepta los términos y autoriza publicar los datos del negocio; un moderador aprueba tras verificarlo. Se agrega `owner_id` a `comercios`. | Pequeño |
| **2D.3 Vitrina** ✅ *(hecho: `tienda.html`, `mi-tienda.html`, tope de 20 productos, reportes de productos y ocultar desde moderación)* | Página `tienda.html?id=…`: foto de portada, «abierto ahora» según el horario, botón de WhatsApp y los productos (nombre, precio, foto, «disponible»/«agotado»). Tabla `productos_comercio` con tope de 20 por comercio y RLS (lectura pública solo de comercios activos; escritura del dueño o moderadores). Botón «Reportar producto». Aviso «actualizado hace X días»; si pasan 30 días sin tocarlo, se marca «desactualizado». | Grande |
| **2D.4 Pedir por WhatsApp, recoger o domicilio** ✅ *(hecho: carrito, mensaje armado, recoger/domicilio propio)* | El visitante marca productos y se abre WhatsApp con el mensaje armado («Hola, quiero: 2 × …, 1 × …»). Cada comercio indica si ofrece **recoger en local**, **domicilio con sus propios domiciliarios** (zona, costo y tiempo) y su horario; el visitante elige al pedir. Sin pago. Es la versión realista de «pedir» antes de la Fase 6. | Pequeño |
| **2D.5 Extras** ✅ *(hecho, SQL 10: `?ref=código` en cualquier enlace se guarda 30 días y se anota solo si la persona crea cuenta; página `referidos.html` para moderadores con enlace, QR (PNG, SVG, imprimir) y tabla de cuentas por código; botón «🔳 QR del comercio» en el editor; atribución «colaboradores de OpenStreetMap (ODbL)» en inicio, directorio, ficha, vitrina y mapas)* | QR con código por comercio o por grupo para medir registros. **Pendiente:** confirmar con el abogado el texto de la atribución ODbL; medir *visitas* (no solo cuentas) requeriría una herramienta de analítica y avisarlo en la política de privacidad. | Pequeño |
| **2D.6 Registrar mi negocio** ✅ *(hecho: SQL 08, `registrar-negocio.html` en 3 pasos con foto de la fachada, GPS y aceptación de términos; en moderación, puntaje de confianza con señales, WhatsApp prellenado y aprobar / aprobar y verificar por teléfono / rechazar con motivo)* | Para negocios que no están en el directorio. Nada se publica sin que un moderador lo apruebe y el sello 2/3 solo se da con una verificación registrada. **Pendiente (después del piloto):** aprobación automática a nivel «Ubicado» cuando el puntaje sea muy alto, y código por WhatsApp automático (requiere un proveedor de mensajería). | Mediano |
| **2E Comercios en el inicio y alta manual** ✅ *(hecho, sin SQL nuevo: sección «Comercios» bajo los anuncios con tarjetas que abren la vitrina; se quitó el botón del encabezado; en el admin, «➕ Agregar comercio» con mapa y edición del nombre)* **2F:** el admin ordena los comercios por estado y origen (importados, equipo, registrados, reclamados) con panel de pendientes; el inicio filtra por categoría y municipio y ordena por cercanía. | El feed muestra todos los comercios activos (verificados o no, con su sello honesto); el moderador tiene «✏️ Editar» en cada tarjeta. | Pequeño |
| **2G Reportar comercio y retirar** ✅ *(hecho, SQL 09: las tarjetas del directorio se abren al tocarlas; «⚠️ Reportar este negocio» en el directorio y en la vitrina; «Retirar mi negocio» más claro dentro de «¿Es tu negocio?»; en moderación, sección «Reportes de comercios» y botón «🙈 Ocultar comercio» en las solicitudes de retiro)* | Tabla `reportes_comercio` (cerrado, datos, ubicación, falso, otro), un reporte pendiente por persona y comercio, máximo 10 por día. | Pequeño |
| **2H Dominio y marca** | (0) **Ojo:** existe una tienda en línea llamada «mercafree» (mercafree.com, tecnología). Decidir el nombre **antes de imprimir stickers o QR**. (1) Elegir el nombre y comprobar que esté libre (`.com`, `.co` o `.com.co`) y que no choque con una marca registrada (consulta en la SIC). (2) Comprar el dominio en un registrador reconocido (confirmar precio vigente). (3) Conectarlo a GitHub Pages (Settings → Pages → Custom domain, HTTPS gratis) y actualizar los enlaces. (4) Registrarlo en Google Search Console. (5) *(la atribución de OpenStreetMap ya se muestra desde la 2D.5)*. **Hosting:** no se paga todavía; GitHub Pages y Supabase en plan gratis bastan para la beta. El gasto real llega con la Fase 3 (Vercel o Cloudflare Pages). | **Antes** de la primera publicación grande (G2/G3). Un cambio de enlace después rompe lo ya compartido. | Pequeño |
| **2H.1 Inicio con banners** ✅ *(hecho, sin SQL: botón amarillo «Regístrate y publica gratis» con parpadeo suave que abre «Crear cuenta»; carrusel de 4 banners con texto propio y arte en CSS, sin imágenes externas ni el nombre de la marca, así que no hay que rehacerlos si cambia el nombre)* | Banners: publicar gratis, registrar negocio, directorio y mapa, compra con cuidado. Se pueden cambiar textos y enlaces en `index.html` (sección `#carrusel`). | Pequeño |
| **2J Publicaciones en carrusel + atajos de cuenta** ✅ *(hecho, sin SQL: los anuncios van en carrusel horizontal con tarjetas más pequeñas y todos sus botones; flechas en escritorio, dedo en celular; botón rojo «Cerrar sesión» visible en el encabezado; «Mi tienda» como botón 3D en su mismo lugar)* | ✅ |
| **2K Subcategorías + expansión + pin del mapa** ✅ *(hecho, **SQL 11**: subcategorías por categoría (obligatorias al publicar, chips para filtrar, etiqueta en la tarjeta; la lista se edita en `SUBCATEGORIAS` de data.js sin SQL); publicar en cualquier municipio de Colombia con «➕ Mi municipio no está»: se crea activo al instante, sin duplicados, máx. 3 nuevos por persona al día (un moderador puede desactivar uno falso con `update municipios set activo=false`); corregido el popup del pin que se cerraba al repintar el mapa; el carrusel de publicaciones carga más solo al llegar al final)* | ✅ |
| **2L Filtros visibles + «Cerca de mí» + barra ordenada** ✅ *(hecho, sin SQL: departamento y ciudad siempre visibles junto a «Ordenar por»; botones «📡 Cerca de mí» (clasificados) y «📡 Comercios cerca de mí» (inicio y directorio) con GPS solo al tocar; «⚙️ Más filtros» con nota de lo que contiene; barra superior con menú «👤 Nombre ▾» que incluye Mis anuncios, Mi tienda y Cerrar sesión)* | ✅ |
| **2M Filtros independientes (clasificados ≠ comercios)** ✅ *(hecho, sin SQL: los comercios tienen su propio buscador, departamento y municipio, y su «Comercios cerca de mí» con distancia en cada tarjeta; ya no los vacían los filtros de ciudad de clasificados; corregido el orden por cercanía en el directorio)* | ✅ |
| **2N Página «Todos los anuncios»** ✅ *(hecho, sin SQL: `anuncios.html` en cuadrícula con los mismos filtros del inicio, filtros en el enlace para compartir la búsqueda, «Ver todos los anuncios (N)» desde el inicio llevando los filtros; código de filtros compartido en `anuncios-comun.js`)* | ✅ |
| **2O Directorio completo de comercios** ✅ *(hecho, sin SQL: verificados y sin verificar con su sello; buscador, categorías con conteo, departamento, municipio, cerca de mí con distancia, verificación, abierto ahora, con vitrina, orden; filtros en el enlace para compartir; filtro y orden por estrellas listos y desactivados hasta la 2P)* | ✅ |
| **2P Calificación por estrellas + opinión (comercios)** ✅ *(hecho, **SQL 12**: estilo Google en la ficha del comercio (promedio, barras, lista, editar/borrar la propia); «⭐ Calificar» en tarjetas, inicio y mapa; lectura libre, escribir con cuenta (1 por persona, editable); el dueño no se califica pero responde en público; reportes de opiniones en moderación; promedio siempre visible y orden ponderado; filtro y orden por estrellas activos en el directorio)* | ✅ |
| **2R Reclamar comercio + Editar mi publicación** ✅ *(hecho, sin SQL: etiqueta «🔑 ¿Es tu negocio? Reclámalo» que titila en comercios sin dueño (tarjetas, mapa y burbuja flotante cerrable en la ficha); botón «✏️ Editar mi publicación» para el dueño en tarjetas y en el anuncio)* | ✅ |
| **2S Contacto con registro rápido + 📞 Llamar en anuncios** ✅ *(hecho, **SQL 13 + 13b**: los botones WhatsApp/Llamar/Cómo llegar abren la ventana de registro rápido si no hay cuenta y, al terminar, el botón para contactar; el número solo lo entrega `contacto_anuncio` con cuenta (60/día); teléfono opcional al publicar (al menos uno); comercios libres)* | ✅ |
| **2T Entrar con Google** ✅ *(hecho, **SQL 14**: «Continuar con Google» en iniciar sesión y en el registro rápido (vuelve al anuncio con el contacto listo); nombre desde Google; el código ?ref= también se guarda para cuentas de Google. Requiere configurar Google Cloud + Supabase, ver GUIA)* | ✅ |
| **2U Mapa en la ficha del comercio** ✅ *(hecho, sin SQL: «📍 Ubicación» con pin, dirección y «Cómo llegar», proporción fija para que la vitrina se vea debajo)* | ✅ |
| **2Q Calificación de vendedores (anuncios)** ⏳ *(después: solo cuando el vendedor marque «vendido a…», para evitar reseñas falsas)* | ⏳ |

**Niveles de sello (cada uno dice exactamente qué significa y la fecha):**
1. **Ubicado:** viene de OpenStreetMap, sin comprobar.
2. **Verificado por teléfono:** se llamó al número publicado y se confirmó nombre y dirección.
3. **Verificado en persona:** un moderador visitó el local y comprobó que existe, que atiende y que quien responde es dueño o administrador.

**Protocolo de visita (comprobar siempre):** (1) el local existe y atiende en esa dirección, con foto de la fachada y el número visible, sin clientes en la foto; (2) quien atiende es el dueño o administrador, según una prueba simple (por ejemplo, el registro mercantil si lo tiene); **no se guarda copia de la cédula**; (3) el teléfono publicado es del negocio; (4) el pin queda sobre la puerta, usando el GPS del editor; (5) el dueño acepta los términos y autoriza publicar. Se guarda el registro de la visita.

**Reglas de contenido de la vitrina (a revisar con el abogado):** no se publican medicamentos de venta con fórmula médica ni productos regulados (la venta de medicamentos por internet tiene normas propias). Los licores y el tabaco son solo para mayores de edad, con aviso.

**Palanca futura:** el tope gratuito de 20 productos y la vitrina básica son la base de los planes de la Fase 5; **no se anuncian precios** hasta tener datos de la beta.

## Estrategia de crecimiento (arranque en frío)
**Principio:** **densidad antes que alcance.** Un mapa con poca vida hace que la gente no vuelva. Se concentra el esfuerzo en 1 o 2 municipios hasta que se vea movimiento, y solo entonces se abre el siguiente. Umbral inicial (**hipótesis que se corrige con la beta**): ~30 anuncios activos y ~15 comercios verificados por municipio.
**Lo que ya controlamos:** una audiencia propia en grupos de Facebook (cifras a confirmar con datos reales de cada grupo), el directorio de comercios importado y el mapa hiperlocal. No competimos en presupuesto: competimos en cercanía y confianza.

| Etapa | Qué se hace | Condición para empezar |
|---|---|---|
| **G0 Preparación** | Ubicación aproximada (2C.1), términos revisados por abogado y NIT confirmado, moderación probada, atribución de OpenStreetMap, comercios verificados en persona, métricas básicas | Nada se promociona antes de esto |
| **G1 Comercios** | **Piloto de 15-20 tiendas en un solo municipio**, visita en persona con el protocolo de la 2D; reclamar ficha; vitrina gratis con hasta 20 productos; sticker QR con código propio; «Programa Fundadores» | 2D.1 a 2D.3 publicadas y probadas |
| **G2 Vendedores** | Beta cerrada con 20-50 vendedores invitados uno a uno (de los grupos de Facebook y del barrio) | G0 completa |
| **G3 Grupos de Facebook** | **Gradual:** (1) publicación fijada que presenta MercaFree; (2) formato «publica en MercaFree y comparte aquí el enlace»; (3) solo después, regla del grupo que pida el enlace. **No** se prohíbe publicar de golpe. Los grupos siguen vivos: son el canal de distribución. | G2 con vendedores activos |
| **G4 Confianza como mensaje** | Se promete solo lo **verificable**: «comercio verificado en persona», «teléfono verificado», «miembro desde…». Consejos de seguridad en cada ficha y puntos de encuentro seguros (supermercados, bancos, farmacias del directorio). | Cuando esos sellos existan de verdad (Fase 4) |
| **G5 Retención** | Aviso a los 25 días para renovar, «marcar como vendido», favoritos con aviso, canal de WhatsApp con los mejores anuncios del día | Después de G2 |
| **G6 Publicidad pagada y fijados** | Solo **después del piloto** y con densidad mínima (~30 anuncios y ~15 comercios verificados por municipio). Empezar con **un solo grupo y pocos días**; pedir antes al administrador las cifras reales (miembros activos, alcance). Anuncios pequeños en Meta Ads segmentados por municipio. Todo se mide con `?ref=` por grupo o campaña y se compara costo por registro. No se promete nada que la web aún no haga. | Dominio (2H), 2D.5 (`?ref=`) y piloto G1 hechos |

**Canales propios:** además de Facebook, cada persona que llega se invita a un canal que MercaFree controla (canal de WhatsApp y lista de correo). Si un grupo se suspende, la audiencia no se pierde.

**Métricas a vigilar:** anuncios nuevos por día, clics a WhatsApp por anuncio, vendedores que vuelven en 7 días, relación oferta/demanda, registros por QR (según el código de cada comercio) y registros por grupo de Facebook.

### Riesgos y límites (revisar con abogado local)
| Idea | Riesgo | Cómo lo hacemos |
|---|---|---|
| Mensajes automáticos masivos a comercios | WhatsApp prohíbe el envío masivo no solicitado; la Ley 1581 y la Ley 2300 de 2023 regulan el contacto comercial | Visita o mensaje **individual**, con opción de no volver a escribir |
| Datos de OpenStreetMap | Licencia ODbL: exige atribución y puede exigir compartir la base derivada | Mostrar la atribución; consultarlo antes de abrir al público |
| Extraer datos de Google Maps, Facebook o Mercado Libre | Va contra sus términos de uso | Solo enlaces a Google Maps; nada de extracción |
| Pedir cédula para «verificar» | Dato personal delicado: obliga a custodiarlo y a justificar su uso | No se recolecta por ahora; verificación por teléfono y por visita |
| «Sin estafas», «vecinos 100% reales» | Promesa que no podemos garantizar (publicidad engañosa) | Prometer solo verificaciones concretas y explicar qué significa cada sello |
| Ofrecer a las tiendas algo que aún no existe | Quema la confianza de las primeras tiendas | Ofrecer solo lo ya publicado de la 2D (vitrina y pedido por WhatsApp), nunca pagos ni domicilios |
| Depender de Facebook | Una suspensión deja sin audiencia | Canales propios (WhatsApp y correo) |

## Fase 3: SEO y escala
**Meta:** que Google indexe los anuncios (tráfico orgánico = la fuente gratuita más importante de OLX y Revolico).
**Por qué:** hoy el HTML del anuncio se arma con JavaScript; los buscadores y las vistas previas de WhatsApp no lo ejecutan.
Pasos: migrar a Astro o Next.js con renderizado en servidor (Vercel o Cloudflare Pages, ya no GitHub Pages), URLs limpias (`/envigado/autos/mazda-3-2019-123`), `sitemap.xml`, datos estructurados, Tailwind compilado, PWA, campos por categoría (año/km en autos, m²/habitaciones en inmuebles) **según lo que se use de verdad**, búsqueda por cercanía con PostGIS.
*Se migra cuando haya tráfico y publicaciones reales, no por calendario.*

## Fase 4: Confianza y moderación con IA
Búsquedas guardadas con aviso, ocultar el número hasta pulsar el botón (el WhatsApp hoy se puede leer desde la API pública), vendedores verificados (teléfono) y chat interno.
- **Puntos de encuentro seguros:** al coordinar la entrega, sugerir comercios verificados del directorio (supermercados, bancos, farmacias) cercanos a ambas partes. Une el directorio de comercios con la seguridad.
- **Reputación del vendedor** (se muestra en el perfil público de la 2C.5 y en la ficha): sello simple calculado por reglas claras (antigüedad de la cuenta, anuncios activos, reportes resueltos, verificación): «Nuevo» → «En crecimiento» → «Confiable». Se muestra en la ficha junto al nombre.
- **Seguir a un vendedor y «Pedir algo»:** botón «+ Seguir» (aviso cuando publique algo nuevo) y una solicitud directa a la tienda («no veo lo que busco»: el comprador deja qué necesita y el vendedor recibe los datos organizados). Solo cuando haya vendedores con varios anuncios.
- **Preguntas públicas en el anuncio:** el comprador pregunta, el vendedor responde y todos lo ven (reduce preguntas repetidas por WhatsApp). Se enlaza con el foro existente.
- **Precio anterior e historial:** guardar los cambios de precio (tabla `precio_historial` con un trigger) para mostrar «bajó de precio», precio anterior tachado y un gráfico simple. Solo con datos reales, nunca inventados.
**IA:** moderación asistida con la API de Claude para detectar estafas y contenido prohibido, desde un backend (la clave nunca va en el navegador). Apoya a un moderador humano, no lo reemplaza, y se menciona en la política de privacidad.

## Fase 5: Ingresos y automatización
**Destacados («Reservar espacio»):** espacios pagados en la portada, en «Selección del día» y en anuncios similares. **No se activan hasta que haya tráfico real**: un espacio vacío que dice «Tu anuncio aquí» sin visitas resta credibilidad. Precios y duración se definen con los datos de la beta (visitas y clics a WhatsApp por anuncio), no antes.
Perfiles/catálogo de tienda, planes para negocios (cobro con Wompi, PSE o Nequi), autocompletado de título y categoría desde la foto, publicación automática de anuncios nuevos en Telegram/Instagram con n8n o Make, resumen semanal por correo. *Se automatiza cuando haya volumen que lo justifique.*

**Transporte y mensajería:** alianzas con mensajerías y servicios de transporte **ya habilitados** (comisión o enlace de referido), cuando haya tráfico. **No** se crea una empresa propia de transporte: en Colombia el transporte de pasajeros exige habilitación del Ministerio de Transporte, y los domicilios traen temas laborales, de seguros y de responsabilidad. Antes se consulta con un abogado.

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
