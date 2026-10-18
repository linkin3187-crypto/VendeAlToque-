# Merkap

Clasificados de barrio con mapa, contacto directo por WhatsApp y foro. Hecho con HTML, CSS y JavaScript puro, listo para GitHub Pages.

> Estado: **Fase 2A (backend real con Supabase) — código listo para probar.** Los anuncios, cuentas, fotos, foro y reportes viven en Supabase; ya no en `localStorage`. Mira `ROADMAP.md`.

## Archivos (todos en la raíz del repositorio, sin carpetas)

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página principal: buscador, filtros, mapa, lista y foro |
| `anuncio.html` + `anuncio.js` | Página de detalle de un anuncio (`anuncio.html?id=2`) |
| `post.html` | Tema del foro con sus comentarios |
| `utils.js` | Código compartido: escapar HTML, modales, avisos, helpers de mapa |
| `data.js` | **Único archivo que habla con Supabase**: cuentas, anuncios, fotos, foro, reportes, lista de espera |
| `app.js` | Lógica de `index.html` |
| `foro.js` | Lógica del foro |
| `styles.css` | Estilos que Tailwind no cubre |
| `.nojekyll` | Le dice a GitHub Pages que no procese los archivos con Jekyll |
| `README.md`, `GUIA-DE-CAMBIOS.md`, `ROADMAP.md` | Documentación |

## Cómo publicar en GitHub Pages

1. En tu repositorio, pulsa **Add file → Upload files** y arrastra TODOS los archivos de esta carpeta (reemplazan a los anteriores). Escribe un mensaje de commit y pulsa **Commit changes**.
2. **Settings → Pages → Deploy from a branch → `main` / `(root)`** (solo la primera vez).
3. Espera 1-2 minutos y abre la URL de Pages.
4. **Si no ves los cambios:** recarga forzada (en el celular: abre la página en una pestaña de incógnito) o sube el número `?v=2` → `?v=3` en los `<script>` y `<link>` de los HTML. Eso obliga al navegador a descargar los archivos nuevos.

## Supabase: lo que se configura en su panel (no en el código)

- **Authentication → URL Configuration:** pon como *Site URL* la dirección de tu GitHub Pages (y añádela a *Redirect URLs*). Sin esto, los correos de confirmar cuenta y recuperar contraseña apuntan a un sitio equivocado.
- **Authentication → Sign In / Providers → Email:** decide si exigir confirmar el correo (recomendado en producción).
- **Hacerte administrador:** regístrate en la web y luego ejecuta en el *SQL Editor* (cambia el correo):
  ```sql
  update public.perfiles set rol = 'admin'
  where id = (select id from auth.users where email = 'tu@correo.com');
  ```
  Con rol `moderador` o `admin` aparece la barra "Modo moderador" y puedes editar o borrar cualquier anuncio, tema o comentario. Ya **no existe** `?editar=1`.
- La clave de `data.js` (`sb_publishable_…`) es **pública por diseño**. La seguridad la dan las reglas RLS de la base de datos. **Nunca** pegues la clave `service_role` / `secret` en este repositorio.

## Límites conocidos (a propósito, se resuelven en fases siguientes)

- Para **publicar, comentar o reportar** hace falta cuenta. Ver y contactar es libre.
- El WhatsApp de cada anuncio es legible por cualquiera que consulte la API pública (es lo que hace funcionar el botón). Ocultarlo hasta pulsar el botón es de la Fase 4.
- Google y las vistas previas de WhatsApp no ejecutan JavaScript: el SEO por anuncio llega con la migración de la Fase 3.
- Faltan términos y condiciones, política de datos (Ley 1581) y panel de moderación (Fase 2B).
- Tailwind se carga por CDN (cómodo para aprender; en producción se compila).
