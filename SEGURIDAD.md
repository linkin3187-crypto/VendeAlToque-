# Merkap · Informe de seguridad (Fase 2AK · G0)

**Fecha:** 19 de octubre de 2026 · **Alcance:** página (GitHub Pages) + base de datos, archivos y cuentas (Supabase `fhxglflgldwecyljphfx`).
**Cómo se revisó:** revisor automático de Supabase (Security Advisor), lectura de todas las reglas RLS que dependen del rol y de todas las funciones públicas, pruebas de ataque en una copia local de la base (Postgres 16) y 995 pruebas automáticas de la página (Playwright), incluida una prueba de inyección de código (XSS) en 10 páginas.

## 1. Lo que ya estaba bien
| Área | Estado |
|---|---|
| Clave del navegador | Solo la clave pública (`publishable`); la `service_role` nunca está en la página. |
| RLS (seguridad por filas) | Activa en **todas** las tablas. Cada quien edita solo lo suyo; lo privado (contactos, datos sanitarios, métricas) no se lee directamente. |
| Funciones del servidor | Las 14 que la página puede llamar verifican quién llama (sesión, dueño o rol) antes de hacer algo. |
| Fotos (Storage) | Solo JPG, PNG o WebP; máximo 1 MB; cada persona sube y borra solo en su carpeta. |
| Topes contra abuso | Ya existían en anuncios, opiniones, confirmaciones, recomendaciones, registros de negocios, reportes de comercios y de opiniones, contactos (60/día), métricas y búsquedas. |
| XSS | Todo texto de usuarios se escapa (`esc()`); la prueba con `<img onerror>` y `<script>` en nombres, descripciones, horarios, notas y perfiles no se ejecutó en ninguna página. |
| Roles | El rol no se podía cambiar desde el navegador (solo se permite editar el nombre). |

## 2. Lo que se arregló en esta fase (SQL 38 + PR de la 2AK)
| # | Hallazgo | Riesgo | Arreglo |
|---|---|---|---|
| 1 | Moderador y administrador tenían **los mismos poderes** | Un moderador podía cambiar logo, inicio, categorías, palabras prohibidas, cupos, dueños, métricas o borrar comercios | `es_admin()`; esas acciones quedan **solo para el administrador** en la base de datos (no solo en la pantalla). Probado con ataques directos. |
| 2 | Aprobar negocios y reclamos de fichas | Un moderador podía regalar una ficha a cualquiera | El moderador **propone** (👍/👎 + nota); solo el administrador aprueba. |
| 3 | Nombrar moderadores | Se hacía a mano por SQL | Panel **👥 Equipo** (solo administrador). El rol **admin** solo se cambia por SQL Editor; nadie puede cambiar su propio rol. Guardia extra en la tabla de perfiles. |
| 4 | 6 funciones sin `search_path` fijo (aviso del revisor) | Truco técnico para suplantar funciones | Fijado. |
| 5 | 7 tablas sin tope contra spam (reportes de anuncios y productos, solicitudes de comercio y de verificación, foro, comentarios, lista de espera) | Llenar la página o la cola de moderación con un programa | Topes por hora y por día (los moderadores no tienen tope). |
| 6 | Lista de espera (trae WhatsApp de personas) la leía cualquier moderador | Exposición de datos personales | Solo administrador. |
| 7 | Encabezado de Moderación se salía de la pantalla en celular | Usabilidad | Corregido. |

## 3. Avisos del revisor que se dejan a propósito
| Aviso | Por qué está bien |
|---|---|
| `contactos_anuncio`, `municipios_alta`, `metricas_eventos`, `campanas_escaneos` (SQL 41): «RLS sin reglas» | Son privadas a propósito: solo las usan funciones del servidor. Quedó anotado en cada tabla. |
| `es_moderador()`, `perfil_publico()`, `registrar_busqueda()`, `registrar_evento()`, `abrir_campana()` (SQL 41) llamables sin sesión | Las necesita la página pública; no devuelven datos privados y tienen topes. |
| Funciones `SECURITY DEFINER` llamables con sesión (asignar dueño, resolver negocio, métricas, equipo…) | Cada una revisa adentro el rol o el dueño antes de actuar. Revisadas una por una. |

## 4. Pendiente (cuando pases a Supabase Pro, antes del piloto G1)
1. **Protección de contraseñas filtradas** (HaveIBeenPwned): solo plan Pro. Authentication → Sign In / Providers → Email (o «Passwords») → *Prevent use of leaked passwords*.
2. **Copias de seguridad diarias** (Pro) y que el proyecto no se pause por inactividad.
3. **Dominio propio + hosting con cabeceras de seguridad** (Cloudflare Pages o Vercel, Fase 3): permite `Content-Security-Policy` y `HSTS`, que GitHub Pages no deja configurar.
4. Revisar estas reglas con el **abogado** (P6) junto con Términos y Privacidad.
5. Repetir esta revisión cada vez que se agregue una tabla o función nueva (correr el Security Advisor de Supabase).

## 5. Por hacer por el administrador (gratis, 1 minuto)
- Authentication → Sign In / Providers → Email → **Minimum password length: 8** y **Password requirements: letras y números**.
