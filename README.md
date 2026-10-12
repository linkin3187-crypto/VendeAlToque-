# MercaFree – Clasificados de barrio

Versión multi-archivo con filtros avanzados.

## Estructura

```
mercafree/
├── index.html          ← Página principal
├── css/
│   └── styles.css      ← Estilos adicionales
├── js/
│   ├── data.js         ← Datos + localStorage
│   └── app.js          ← Lógica (mapa, filtros, formularios)
└── README.md
```

## Cómo usar

1. Descarga la carpeta completa.
2. Abre `index.html` con un servidor local (o súbelo a GitHub Pages / Netlify / Vercel).
3. Si abres el archivo directamente (`file://`) algunos navegadores bloquean módulos. Mejor usa:

```bash
# Con Python
python -m http.server 8000

# O con VS Code / Live Server
```

## Nuevas funciones de esta versión

- Filtros por **Departamento** y **Ciudad**
- Filtro **Nuevo / Usado**
- Vista expandida de cada anuncio (ubicación, precio, teléfono, descripción)
- Edición y eliminación desde la página
- Base para Foro de ventas
- Publicación gratis sin registro + registro opcional

## Próximos pasos sugeridos

- Foro de ventas funcional
- Favoritos
- Más departamentos y ciudades
