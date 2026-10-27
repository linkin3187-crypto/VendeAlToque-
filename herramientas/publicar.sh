#!/usr/bin/env bash
# Merkap · Fase CF-1 · Carpeta de publicación para Cloudflare Pages
# Cloudflare corre este comando en cada fusión a «main»:
#   Build command:          bash herramientas/publicar.sh
#   Build output directory: _sitio
# Copia SOLO lo que el navegador necesita (páginas, código, estilos, imágenes y el PDF de docs/).
# NO se publican: supabase/ (SQL), herramientas/, .github/, los .md (GUIA, README…) ni las pruebas.
set -euo pipefail
cd "$(dirname "$0")/.."
SALIDA="_sitio"
rm -rf "$SALIDA"
mkdir -p "$SALIDA"
cp ./*.html ./*.js ./*.css "$SALIDA"/
cp -r img "$SALIDA"/
[ -d docs ] && cp -r docs "$SALIDA"/
cp herramientas/cloudflare/_headers "$SALIDA"/_headers
# Comprobaciones: que esté lo esencial y que no se cuele nada privado
for f in index.html tienda.html utils.js data.js styles.css tw.css img/logo-merkap.png _headers; do
  [ -f "$SALIDA/$f" ] || { echo "❌ Falta $f en $SALIDA"; exit 1; }
done
if find "$SALIDA" \( -name '*.sql' -o -name '*.md' -o -name '*.py' -o -name '*.sh' \) | grep -q .; then
  echo "❌ Se iba a publicar un archivo privado:"; find "$SALIDA" \( -name '*.sql' -o -name '*.md' -o -name '*.py' -o -name '*.sh' \); exit 1
fi
echo "✅ Carpeta $SALIDA lista: $(find "$SALIDA" -type f | wc -l) archivos, $(du -sh "$SALIDA" | cut -f1)"
