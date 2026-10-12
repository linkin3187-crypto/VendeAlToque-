# MercaFree

Clasificados de barrio con mapa, contacto directo por WhatsApp y foro. Hecho con HTML, CSS y JavaScript puro, listo para GitHub Pages.

> Estado: **Fase 1 completada** (prototipo estático mejorado). Los datos aún viven en el navegador (`localStorage`); la base de datos real llega en la Fase 2. Mira `ROADMAP.md`.

## Archivos (todos en la raíz del repositorio, sin carpetas)

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página principal: buscador, filtros, mapa, lista y foro |
| `anuncio.html` + `anuncio.js` | Página de detalle de un anuncio (`anuncio.html?id=2`) |
| `post.html` | Tema del foro con sus comentarios |
| `utils.js` | Código compartido: escapar HTML, modales, avisos, helpers de mapa |
| `data.js` | Categorías, datos de ejemplo y lectura/escritura de datos |
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

## Probar el modo editor

Añade `?editar=1` a la URL (`.../index.html?editar=1`) para ver botones de editar/borrar en todos los anuncios. Es provisional: en la Fase 2 será un rol de administrador real con login.

## Límites conocidos (a propósito, se resuelven en fases siguientes)

- Cada visitante solo ve **sus** anuncios (no hay servidor todavía).
- Las cuentas son de prueba y viven solo en este navegador.
- Tailwind se carga por CDN (cómodo para aprender; en producción se compila).
