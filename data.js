// ===== Merkap - Datos (Supabase) =====
// Requiere: supabase-js (CDN) y utils.js cargados antes.
//
// APRENDE: TODO el acceso a la base de datos vive en este archivo. El resto de la
// app (app.js, foro.js, anuncio.js) solo llama a estas funciones y recibe objetos
// con la misma forma de siempre: { id, nombre, desc, precio:"$1.200.000", ciudad, ... }.
// La seguridad NO depende de este código: la imponen las reglas RLS de la base de
// datos (quién puede leer, crear, editar o borrar cada fila).

// Estas dos claves son PÚBLICAS por diseño (van en el navegador de todos).
// NUNCA pegues aquí la clave "service_role" / "secret": el repositorio es público.
const SUPABASE_URL = "https://fhxglflgldwecyljphfx.supabase.co";
const SUPABASE_KEY = "sb_publishable_70iuukXWV1DJoDE1CDIqTw_CWQ-gdQ4";
const BUCKET_FOTOS = "anuncios";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ÚNICA fuente de verdad de categorías (las mismas que valida la base de datos).
// `foro: true` = también sale en el foro.
const CATEGORIAS = [
  { id: "todos",      nombre: "Todos",       icono: "🏠", foro: true  },
  { id: "tienda",     nombre: "Tiendas",     icono: "🍎", foro: false },
  { id: "comida",     nombre: "Comida",      icono: "🍔", foro: false },
  { id: "autos",      nombre: "Vehículos",   icono: "🚗", foro: true  },
  { id: "inmuebles",  nombre: "Inmuebles",   icono: "🏡", foro: true  },
  { id: "tecnologia", nombre: "Tecnología",  icono: "📱", foro: true  },
  { id: "servicios",  nombre: "Oficios",     icono: "🛠️", foro: true  },
  { id: "ferreteria", nombre: "Ferretería",  icono: "🔩", foro: false },
  { id: "hogar",      nombre: "Hogar",       icono: "🛋️", foro: true  },
  { id: "mascotas",   nombre: "Mascotas",    icono: "🐕", foro: false },
  { id: "empleos",    nombre: "Empleos",     icono: "💼", foro: false },
  { id: "ropa",       nombre: "Ropa",        icono: "👕", foro: false },
  { id: "adultos",    nombre: "Íntimo +18",  icono: "🔞", foro: false },   // fase 2AL: solo se ve al entrar a la categoría
  { id: "otros",      nombre: "Otros",       icono: "📦", foro: true  }
];

// Subcategorías (opcionales por categoría). Se guarda solo el `id` (texto corto) en anuncios.subcategoria.
// Para agregar una: añádela aquí con un id en minúsculas (a-z, 0-9, _) de hasta 30 caracteres. No requiere SQL.
const SUBCATEGORIAS = {
  tienda:     [["abarrotes", "Abarrotes y víveres"], ["frutas_verduras", "Frutas y verduras"], ["carnes_lacteos", "Carnes y lácteos"], ["licores", "Licores"], ["drogueria", "Cuidado personal y aseo"], ["papeleria", "Papelería"], ["otros", "Otros"]],
  comida:     [["restaurantes", "Restaurantes"], ["comidas_rapidas", "Comidas rápidas"], ["panaderia_postres", "Panadería y postres"], ["productos_caseros", "Productos caseros"], ["bebidas", "Bebidas"], ["otros", "Otros"]],
  autos:      [["carros", "Carros"], ["motos", "Motos"], ["camionetas", "Camionetas y camperos"], ["camiones", "Camiones y buses"], ["repuestos", "Repuestos de carro"], ["repuestos_moto", "Repuestos y accesorios de moto"], ["bicicletas", "Bicicletas y patinetas"], ["otros", "Otros"]],
  inmuebles:  [["apartamentos", "Apartamentos"], ["casas", "Casas"], ["apartaestudios", "Apartaestudios"], ["lotes_fincas", "Lotes y fincas"], ["locales_oficinas", "Locales y oficinas"], ["bodegas", "Bodegas"], ["habitaciones", "Habitaciones"], ["otros", "Otros"]],
  tecnologia: [["celulares", "Celulares"], ["computadores", "Computadores y tablets"], ["tv_audio", "TV y audio"], ["consolas_juegos", "Consolas y videojuegos"], ["camaras", "Cámaras"], ["accesorios_tech", "Accesorios"], ["otros", "Otros"]],
  servicios:  [["plomeria", "Plomería"], ["electricidad", "Electricidad"], ["mecanica", "Mecánica"], ["belleza", "Belleza y peluquería"], ["aseo_hogar", "Aseo y hogar"], ["construccion", "Construcción y arreglos"], ["mudanzas_transporte", "Mudanzas y transporte"], ["clases", "Clases y tutorías"], ["tecnicos", "Técnicos (electrodomésticos, PC)"], ["otros", "Otros"]],
  ferreteria: [["herramientas", "Herramientas"], ["materiales", "Materiales de construcción"], ["pinturas", "Pinturas"], ["electricos_plomeria", "Eléctricos y plomería"], ["tornilleria", "Tornillería"], ["otros", "Otros"]],
  hogar:      [["muebles", "Muebles"], ["electrodomesticos", "Electrodomésticos"], ["decoracion", "Decoración"], ["jardin", "Jardín"], ["cocina", "Cocina y menaje"], ["bebes", "Bebés y niños"], ["otros", "Otros"]],
  // Fase 2AL: solo animales domésticos o de criadero (sin «Otros»: era la puerta a la fauna silvestre)
  mascotas:   [["perros", "Perros"], ["gatos", "Gatos"], ["conejos_roedores", "Conejos y roedores"], ["aves_ornato", "Aves de ornato"], ["peces", "Peces y acuarios"], ["aves_corral", "Aves de corral y granja"], ["animales_finca", "Animales de finca"], ["alimentos_mascotas", "Alimentos"], ["accesorios_mascotas", "Accesorios"], ["veterinaria", "Veterinaria"], ["adopcion", "Adopción"]],
  adultos:    [["juguetes_intimos", "Juguetes íntimos"], ["lenceria", "Lencería"], ["cuidado_intimo", "Cuidado íntimo y preservativos"], ["juegos_pareja", "Juegos para parejas"]],
  empleos:    [["ofertas", "Ofertas de empleo"], ["busco_empleo", "Busco empleo"], ["medio_tiempo", "Medio tiempo"], ["freelance", "Independiente / por días"], ["otros", "Otros"]],
  ropa:       [["hombre", "Hombre"], ["mujer", "Mujer"], ["ninos", "Niños"], ["calzado", "Calzado"], ["deportiva", "Deportiva"], ["accesorios_ropa", "Accesorios"], ["otros", "Otros"]]
};
const nombreSubcategoria = (cat, id) => { const s = (SUBCATEGORIAS[cat] || []).find(x => x[0] === id); return s ? s[1] : ""; };

// Todos los departamentos de Colombia: así se puede publicar en cualquier municipio (ver crear_municipio en SQL 11).
const TODOS_LOS_DEPARTAMENTOS = ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare",
  "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño",
  "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"];

// Las categorías del foro se DERIVAN de la lista de arriba (no se repiten).
const CATEGORIAS_FORO = CATEGORIAS
  .filter(c => c.foro)
  .map(c => (c.id === "todos" ? { ...c, icono: "💬" } : c));

const iconosCategoria = {};
CATEGORIAS.forEach(c => { iconosCategoria[c.id] = c.icono; c.activo = true; });

// Categorías de anuncios administrables (Fase 2Z · supabase/19_categorias_anuncio.sql). La lista de arriba es el
// respaldo si aún no existe la tabla. Se reemplaza EN EL MISMO arreglo y objeto (las páginas ya los tienen
// referenciados) y avisa con el evento «categorias:anuncio» para que cada página repinte sus chips y selects.
let categoriasAnuncioCargadas = null;
function cargarCategoriasAnuncio() {
  if (categoriasAnuncioCargadas) return categoriasAnuncioCargadas;
  categoriasAnuncioCargadas = (async () => {
    try {
      const { data, error } = await sb.from("categorias_anuncio")
        .select("id, nombre, icono, palabras, subcategorias, orden, activo, foro").order("orden").order("nombre");
      if (error || !data || !data.length) return CATEGORIAS;
      const todos = CATEGORIAS.find(c => c.id === "todos") || { id: "todos", nombre: "Todos", icono: "🏠", foro: true };
      CATEGORIAS.length = 0;
      CATEGORIAS.push(todos);
      Object.keys(SUBCATEGORIAS).forEach(k => delete SUBCATEGORIAS[k]);
      data.forEach(r => {
        CATEGORIAS.push({ id: r.id, nombre: r.nombre, icono: r.icono || "📦", palabras: r.palabras || "", orden: r.orden,
                          activo: r.activo !== false, foro: !!r.foro });
        const subs = (Array.isArray(r.subcategorias) ? r.subcategorias : []).filter(x => x && x.id && x.nombre);
        if (subs.length) SUBCATEGORIAS[r.id] = subs.map(x => [x.id, x.nombre]);
      });
      Object.keys(iconosCategoria).forEach(k => delete iconosCategoria[k]);
      CATEGORIAS.forEach(c => { iconosCategoria[c.id] = c.icono; });
      document.dispatchEvent(new CustomEvent("categorias:anuncio"));
    } catch (e) { console.warn("categorías de anuncios:", e); }
    return CATEGORIAS;
  })();
  return categoriasAnuncioCargadas;
}
// Para mostrar y filtrar: las activas (más «Todos»). Para publicar: las activas sin «Todos».
const categoriasAnuncioVisibles = () => CATEGORIAS.filter(c => c.activo !== false);

// Moderadores: crear o editar una categoría de anuncios (fila con id, nombre, icono, palabras, subcategorias, orden, activo)
async function guardarCategoriaAnuncioDB(fila) {
  const { error } = await sb.from("categorias_anuncio").upsert(fila, { onConflict: "id" });
  if (error) throw error;
  categoriasAnuncioCargadas = null;
  await cargarCategoriasAnuncio();
}
async function cargarCategoriasAnuncioAdmin() {
  const { data, error } = await sb.from("categorias_anuncio").select("*").order("orden").order("nombre");
  if (error) throw error;
  return data || [];
}

// ---------- Estado compartido ----------
let baseDatosAnuncios = [];
let usuarioActual = null;          // { id, nombre, email, rol } o null
let municipios = [];               // filas de la tabla `municipios` (lista cerrada)
let DEPARTAMENTOS = {};            // { "Antioquia": ["Medellín", ...] } (se arma desde `municipios`)
let errorCargaAnuncios = false;

const esModerador = () => !!usuarioActual && (usuarioActual.rol === "moderador" || usuarioActual.rol === "admin");
// Fase 2AK: el administrador (tú) tiene todo; el moderador solo modera contenido. La base de datos lo hace cumplir (SQL 38).
const esAdmin = () => !!usuarioActual && usuarioActual.rol === "admin";
// Marca la página con el rol: lo «solo-admin» se esconde para los demás (CSS) y la etiqueta dice 👑 o 🛡️
function aplicarRolPagina() {
  const rol = usuarioActual ? usuarioActual.rol : "";
  document.documentElement.dataset.rol = rol || "visitante";
  document.querySelectorAll(".etq-rol").forEach(e => { e.textContent = rol === "admin" ? "👑 Modo administrador" : "🛡️ Modo moderador"; });
}
document.addEventListener("DOMContentLoaded", aplicarRolPagina);

// ---------- Errores en español ----------
// Convierte los mensajes técnicos de Supabase en algo que un vecino entienda.
function mensajeError(e) {
  const m = String((e && e.message) || e || "");
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos";
  if (/Email not confirmed/i.test(m)) return "Confirma tu correo: te enviamos un enlace al registrarte";
  if (/User already registered/i.test(m)) return "Este correo ya está registrado";
  if (/Password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo";
  if (/Límite de \d+ (anuncios|favoritos|productos)/i.test(m)) return m;
  if (/Elige un departamento|Escribe el nombre del municipio|dentro de Colombia|municipios nuevos|no está disponible por ahora/i.test(m)) return m;
  if (/Solo puedes cambiar|Solo moderadores|No existe una cuenta|Esa persona no tiene perfil|Ya tienes \d+ solicitudes|Llegaste al máximo|Escribe el motivo|ya fue resuelta/i.test(m)) return m;
  if (/duplicate key|23505|unique constraint/i.test(m)) return "Ya enviaste esto antes. ¡Gracias, lo revisaremos!";
  if (/row-level security|violates row-level/i.test(m)) return "No tienes permiso para hacer esto. ¿Iniciaste sesión?";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión con el servidor. Revisa tu internet";
  if (/violates check constraint/i.test(m)) return "Algún dato no cumple las reglas (revisa título, WhatsApp, descripción y fotos)";
  return m || "Ocurrió un error inesperado";
}

// =====================================================================
// MUNICIPIOS (lista cerrada: evita "envigado" vs "Envigado")
// =====================================================================
async function cargarMunicipios() {
  cargarCategoriasComercio();   // en paralelo: todas las páginas pasan por aquí
  const catsAnuncio = cargarCategoriasAnuncio();
  const { data, error } = await sb.from("municipios").select("id, departamento, nombre, lat, lng").order("nombre");
  if (error) { console.error("municipios:", error); mostrarToast(mensajeError(error), "error"); return; }
  municipios = data || [];
  DEPARTAMENTOS = {};
  municipios.forEach(m => {
    (DEPARTAMENTOS[m.departamento] = DEPARTAMENTOS[m.departamento] || []).push(m.nombre);
  });
  await catsAnuncio;            // las categorías de anuncios quedan listas antes de pintar anuncios
}

// Crea el municipio (si no existe) y devuelve su fila. La base valida el nombre, evita duplicados y limita abusos.
async function crearMunicipioDB(departamento, nombre, lat, lng) {
  const { data, error } = await sb.rpc("crear_municipio", { p_departamento: departamento, p_nombre: nombre, p_lat: lat, p_lng: lng });
  if (error) throw new Error(mensajeError(error));
  await cargarMunicipios();                 // vuelve a leer la lista (ya incluye el nuevo)
  const m = municipios.find(x => x.id === data);
  if (!m) throw new Error("No se pudo crear el municipio. Inténtalo de nuevo");
  return m;
}

function buscarMunicipio(departamento, ciudad) {
  return municipios.find(m => m.nombre === ciudad && (!departamento || m.departamento === departamento)) || null;
}

// =====================================================================
// ANUNCIOS
// =====================================================================
// Convierte una fila de la base de datos en el objeto que usa toda la app.
function filaAAnuncio(r) {
  const m = municipios.find(x => x.id === r.municipio_id) || {};
  return normalizarAnuncio({
    id: r.id,
    nombre: r.nombre,
    categoria: r.categoria,
    subcategoria: r.subcategoria || "",
    estado: r.estado,
    departamento: m.departamento || "",
    ciudad: m.nombre || "",
    barrio: r.barrio,
    lat: r.lat,
    lng: r.lng,
    // El número no llega con el anuncio (se pide con contacto_anuncio); solo si hay WhatsApp / teléfono
    tieneWhatsapp: r.tiene_whatsapp != null ? !!r.tiene_whatsapp : !!r.whatsapp,
    tieneTelefono: r.tiene_telefono != null ? !!r.tiene_telefono : !!r.telefono,
    precio: formatearPrecio(r.precio),
    desc: r.descripcion,
    fotos: r.fotos || [],
    owner: r.owner_id,
    ubicacionAprox: !!r.ubicacion_aprox,   // true = lat/lng públicos están desplazados (ver anuncios_ubicacion)
    detalles: (r.detalles && typeof r.detalles === "object" && !Array.isArray(r.detalles)) ? r.detalles : {},
    fecha: Date.parse(r.creado_en),
    seleccionHasta: r.seleccion_hasta ? Date.parse(r.seleccion_hasta) : 0,   // fase 2AC: «⭐ Selección del día» (la eligen los moderadores)
    seleccionExcluido: !!r.seleccion_excluido                                // fase 2AD: el moderador lo sacó del sorteo
  });
}

// Deja cada anuncio con la forma esperada (fotos[] + portada `imagen`).
function normalizarAnuncio(a) {
  const fotos = (Array.isArray(a.fotos) ? a.fotos : []).filter(Boolean);
  return {
    ...a,
    id: Number(a.id),
    fotos,
    imagen: fotos[0] || "",              // portada (la usan las tarjetas)
    lat: parseFloat(a.lat),
    lng: parseFloat(a.lng),
    whatsapp: String(a.whatsapp || "").replace(/\D/g, ""),
    fecha: a.fecha || Date.now()
  };
}

// Columnas PÚBLICAS de un anuncio. El WhatsApp y el teléfono NO se leen de la tabla: solo con
// contacto_anuncio(id), que exige cuenta (ver supabase/13_contacto_anuncios.sql y 13b_proteger_contacto.sql).
// Fase 2Z.7: + detalles (inmuebles y vehículos). Si aún no se ejecutó el SQL 23, se quita sola (ver conDetalles).
let COLS_ANUNCIO = "id, owner_id, nombre, descripcion, categoria, subcategoria, estado, precio, municipio_id, barrio, lat, lng, fotos, estado_publicacion, creado_en, expira_en, ubicacion_aprox, tiene_whatsapp, tiene_telefono, detalles, seleccion_hasta, seleccion_excluido";
let hayColumnaDetalles = true;
const sinColumnaDetalles = e => /detalles/.test((e && e.message) || "");
// Ejecuta una consulta de anuncios; si falla porque falta la columna «detalles», la repite sin ella
async function conDetalles(hacer) {
  let r = await hacer(COLS_ANUNCIO);
  if (r.error && /seleccion_excluido/.test(r.error.message || "")) {   // fase 2AD: aún sin el SQL 34
    COLS_ANUNCIO = COLS_ANUNCIO.replace(", seleccion_excluido", "");
    r = await hacer(COLS_ANUNCIO);
  }
  if (r.error && /seleccion_hasta/.test(r.error.message || "")) {   // fase 2AC: aún sin el SQL 32
    COLS_ANUNCIO = COLS_ANUNCIO.replace(", seleccion_hasta", "");
    r = await hacer(COLS_ANUNCIO);
  }
  if (r.error && hayColumnaDetalles && sinColumnaDetalles(r.error)) {
    hayColumnaDetalles = false;
    COLS_ANUNCIO = COLS_ANUNCIO.replace(", detalles", "");
    console.warn("Falta ejecutar supabase/23_detalles_anuncio.sql: los anuncios se muestran sin detalles");
    r = await hacer(COLS_ANUNCIO);
  }
  return r;
}
// Si aún no se ejecutó el SQL 13 (no existen tiene_whatsapp/tiene_telefono), se usa la consulta anterior.
const sinColumnasContacto = e => /tiene_whatsapp|tiene_telefono/.test((e && e.message) || "");

async function cargarAnuncios() {
  // La regla RLS ya oculta a los demás los anuncios vencidos u ocultos, pero el
  // dueño y los moderadores SÍ los ven: por eso filtramos aquí también.
  const consulta = cols => sb.from("anuncios").select(cols)
    .eq("estado_publicacion", "activo")
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false })
    .limit(1000);
  let { data, error } = await conDetalles(consulta);
  if (error && sinColumnasContacto(error)) ({ data, error } = await consulta("*"));
  if (error) {
    console.error("anuncios:", error);
    errorCargaAnuncios = true;
    baseDatosAnuncios = [];
    mostrarToast(mensajeError(error), "error");
    return;
  }
  errorCargaAnuncios = false;
  baseDatosAnuncios = (data || []).map(filaAAnuncio);
}

// Carga todo lo necesario para pintar las páginas de anuncios.
async function cargarDatos() {
  await cargarMunicipios();          // primero: los anuncios necesitan los municipios
  await Promise.all([cargarSesion(), cargarAnuncios()]);
}

// ---------- Fotos (Supabase Storage) ----------
// Las fotos llegan del formulario como "data:image/jpeg;base64,..." (ya comprimidas
// a 800 px). Las subimos a Storage y guardamos solo su URL pública en el anuncio.
// Las que ya son https:// (al editar) se conservan tal cual.
async function subirFotos(fotos) {
  const subidas = [];
  const resultado = [];
  try {
    for (const f of fotos) {
      if (!String(f).startsWith("data:")) { resultado.push(f); continue; }
      const blob = await (await fetch(f)).blob();
      // jpg por defecto; png/webp cuando la imagen trae transparencia (ej. arte hecho con IA para el carrusel)
      const tipo = /^data:image\/(png|webp)/.exec(String(f));
      const ext = tipo ? tipo[1] : "jpg";
      const ruta = `${usuarioActual.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(BUCKET_FOTOS).upload(ruta, blob, {
        contentType: tipo ? "image/" + tipo[1] : "image/jpeg", cacheControl: "31536000", upsert: false
      });
      if (error) throw error;
      subidas.push(ruta);
      resultado.push(sb.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl);
    }
  } catch (e) {
    if (subidas.length) await sb.storage.from(BUCKET_FOTOS).remove(subidas); // no dejar fotos huérfanas
    throw e;
  }
  return resultado;
}

// Borra de Storage las fotos indicadas (por URL). Solo funciona con las TUYAS
// (la regla de Storage lo exige); si falla no pasa nada: es limpieza opcional.
async function borrarFotosStorage(urls) {
  const marca = `/object/public/${BUCKET_FOTOS}/`;
  const rutas = (urls || [])
    .map(u => { const i = String(u).indexOf(marca); return i >= 0 ? decodeURIComponent(String(u).slice(i + marca.length)) : null; })
    .filter(r => r && usuarioActual && r.startsWith(usuarioActual.id + "/"));
  if (rutas.length) { try { await sb.storage.from(BUCKET_FOTOS).remove(rutas); } catch (e) { /* limpieza opcional */ } }
}

// Crea (id = null) o actualiza un anuncio. Devuelve el anuncio ya normalizado.
// Lanza un Error con mensaje en español si algo falla.
async function guardarAnuncio(d, id) {
  if (!usuarioActual) throw new Error("Inicia sesión para publicar");
  let muni = buscarMunicipio(d.departamento, d.ciudad);
  // Expansión: si el municipio aún no existe, se crea (y queda activo) al publicar.
  if (!muni && d.ciudadNueva) muni = await crearMunicipioDB(d.departamento, d.ciudadNueva, d.lat, d.lng);
  if (!muni) throw new Error("Elige tu ciudad de la lista");

  const previo = id ? baseDatosAnuncios.find(a => a.id === id) : null;
  const fotos = await subirFotos(d.fotos || []);
  const fila = {
    nombre: d.nombre,
    descripcion: d.desc,
    categoria: d.categoria,
    subcategoria: d.subcategoria || null,
    estado: d.estado,
    precio: d.precio,                 // número o null
    municipio_id: muni.id,
    barrio: d.barrio,
    whatsapp: d.whatsapp || null,     // "573001234567" (opcional)
    telefono: d.telefono || null,     // "3001234567" o fijo "6041234567" (opcional; al menos uno de los dos)
    fotos
  };

  // --- Ubicación ---
  // d.lat/d.lng es el punto REAL que marcó la persona. Si pidió «zona aproximada» (lo normal),
  // al anuncio público va un punto desplazado y el real se guarda aparte, solo para ella.
  // Un moderador que edita un anuncio AJENO no cambia la ubicación (no conoce el punto real).
  const ajeno = !!(previo && previo.owner && usuarioActual && previo.owner !== usuarioActual.id);
  const aprox = d.aprox !== false;
  let puntoExacto = null;             // lo que hay que guardar en la tabla privada
  if (!ajeno) {
    const igual = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
    const referencia = d.exactaOriginal || (previo ? { lat: previo.lat, lng: previo.lng } : null);
    // Sin mover el pin no se vuelve a desplazar: si no, al editar varias veces se podría promediar el punto real.
    const sinCambio = !!previo && previo.ubicacionAprox && igual({ lat: d.lat, lng: d.lng }, referencia);
    if (aprox) {
      if (sinCambio) {
        fila.lat = previo.lat; fila.lng = previo.lng;
        if (d.exactaOriginal) puntoExacto = d.exactaOriginal;
      } else {
        const p = desplazarCoords(d.lat, d.lng);
        fila.lat = p.lat; fila.lng = p.lng;
        puntoExacto = { lat: d.lat, lng: d.lng };
      }
    } else {
      fila.lat = d.lat; fila.lng = d.lng;
    }
    fila.ubicacion_aprox = aprox;
  }

  if (hayColumnaDetalles) fila.detalles = limpiarDetalles(d.categoria, d.subcategoria, { ...(d.detalles || {}), _estado: d.estado });
  const consulta = cols => {
    if (!hayColumnaDetalles) delete fila.detalles;
    return (id ? sb.from("anuncios").update(fila).eq("id", id) : sb.from("anuncios").insert(fila)).select(cols).single();
  };
  let { data, error } = await conDetalles(consulta);
  if (error && sinColumnasContacto(error)) ({ data, error } = await (id ? sb.from("anuncios").update(fila).eq("id", id) : sb.from("anuncios").insert(fila)).select().single());
  if (error) {
    // el anuncio no se guardó: borramos las fotos nuevas que acabamos de subir
    await borrarFotosStorage(fotos.filter(f => !(d.fotos || []).includes(f)));
    throw error;
  }
  // al editar: borra de Storage las fotos que el usuario quitó
  if (previo) await borrarFotosStorage(previo.fotos.filter(f => !fotos.includes(f)));

  // Punto real en la tabla privada. Si falla, el anuncio YA quedó guardado: solo avisamos.
  let avisoUbicacion = false;
  if (!ajeno) {
    try {
      if (aprox && puntoExacto) {
        const { error: e2 } = await sb.from("anuncios_ubicacion").upsert({
          anuncio_id: data.id, lat: puntoExacto.lat, lng: puntoExacto.lng, actualizado_en: new Date().toISOString()
        }, { onConflict: "anuncio_id" });
        if (e2) throw e2;
      } else if (!aprox && previo) {
        await sb.from("anuncios_ubicacion").delete().eq("anuncio_id", data.id);   // ya no hace falta
      }
    } catch (e) {
      console.error("ubicación privada:", e);
      avisoUbicacion = true;
    }
  }
  const resultado = filaAAnuncio(data);
  resultado.avisoUbicacion = avisoUbicacion;
  contactosCache.delete(Number(data.id));   // el WhatsApp/teléfono pudo cambiar
  return resultado;
}

// Punto REAL de un anuncio tuyo (la regla RLS solo se lo entrega al dueño y a moderadores).
async function cargarUbicacionExacta(id) {
  const { data, error } = await sb.from("anuncios_ubicacion").select("lat, lng").eq("anuncio_id", id).maybeSingle();
  if (error || !data) return null;
  return { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
}

async function eliminarAnuncioDB(id) {
  const previo = baseDatosAnuncios.find(a => a.id === id);
  const { error } = await sb.from("anuncios").delete().eq("id", id);
  if (error) throw error;
  if (previo) await borrarFotosStorage(previo.fotos);
}

// =====================================================================
// FAVORITOS (corazón «Guardar»; cada persona ve solo los suyos)
// =====================================================================
let favoritosIds = new Set();

async function cargarFavoritos() {
  if (!usuarioActual) { favoritosIds = new Set(); return favoritosIds; }
  const { data, error } = await sb.from("favoritos").select("anuncio_id").limit(500);
  if (error) { console.error("favoritos:", error); return favoritosIds; }   // si falla, no borramos lo que ya sabíamos
  favoritosIds = new Set((data || []).map(r => Number(r.anuncio_id)));
  return favoritosIds;
}

// Guarda o quita un favorito. Devuelve true si quedó guardado.
async function alternarFavorito(anuncioId) {
  if (!usuarioActual) throw new Error("Inicia sesión para guardar favoritos");
  const id = Number(anuncioId);
  if (favoritosIds.has(id)) {
    const { error } = await sb.from("favoritos").delete().eq("anuncio_id", id).eq("usuario_id", usuarioActual.id);
    if (error) throw error;
    favoritosIds.delete(id);
    return false;
  }
  const { error } = await sb.from("favoritos").insert({ anuncio_id: id });
  if (error && !/duplicate key|23505/i.test(error.message || "")) throw error;   // «ya estaba guardado» no es un error
  favoritosIds.add(id);
  return true;
}

// Trae los anuncios (activos y vigentes) de una lista de ids, p. ej. para «Mis favoritos».
async function cargarAnunciosPorIds(ids) {
  if (!ids.length) return [];
  const consulta = cols => sb.from("anuncios").select(cols)
    .in("id", ids)
    .eq("estado_publicacion", "activo")
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false });
  let { data, error } = await conDetalles(consulta);
  if (error && sinColumnasContacto(error)) ({ data, error } = await consulta("*"));
  if (error) throw error;
  return (data || []).map(filaAAnuncio);
}

// =====================================================================
// SESIÓN Y CUENTAS (Supabase Auth)
// =====================================================================
let _sesionPromesa = null;

// Lee la sesión guardada y carga el perfil (nombre y rol). Es seguro llamarla
// varias veces: la primera hace el trabajo y las demás reutilizan el resultado.
function cargarSesion() {
  if (!_sesionPromesa) _sesionPromesa = refrescarUsuario();
  return _sesionPromesa;
}

async function refrescarUsuario(sesion) {
  try {
    const s = sesion !== undefined ? sesion : (await sb.auth.getSession()).data.session;
    if (!s) { usuarioActual = null; EDITOR = false; return null; }
    const u = s.user;
    const md = u.user_metadata || {};
    let nombre = md.nombre || md.full_name || md.name || (u.email || "usuario").split("@")[0];
    let rol = "usuario";
    const { data } = await sb.from("perfiles").select("nombre, rol").eq("id", u.id).maybeSingle();
    if (data) { nombre = data.nombre; rol = data.rol; }
    usuarioActual = { id: u.id, nombre, email: u.email, rol };
    EDITOR = esModerador();   // EDITOR (utils.js) ya no viene de la URL: viene del ROL en la base de datos
    aplicarRolPagina();
    enviarRefSiFalta();       // cuentas creadas con Google: guarda el código ?ref= (una sola vez)
    return usuarioActual;
  } catch (e) {
    console.error("sesión:", e);
    usuarioActual = null; EDITOR = false;
    return null;
  }
}

async function registrarUsuario(email, password, nombre, volverA) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    // volverA: página a la que regresa el enlace del correo de confirmación (p. ej. el anuncio que quería contactar)
    options: { data: refGuardado() ? { nombre, ref: refGuardado() } : { nombre }, emailRedirectTo: volverA || (location.origin + location.pathname) }
  });
  if (error) throw new Error(mensajeError(error));
  // Si el proyecto exige confirmar el correo, no hay sesión todavía.
  if (data.session) await refrescarUsuario(data.session);
  return { confirmar: !data.session };
}

// ---------- Entrar con Google (Fase 2T · supabase/14_login_google.sql) ----------
// Lleva a la pantalla de Google y vuelve a `volverA` (la misma página por defecto) ya con la sesión.
// Requiere activar Google en Supabase → Authentication → Sign In / Providers y la URL en Redirect URLs.
async function entrarConGoogle(volverA) {
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: volverA || location.href.split("#")[0] }
  });
  if (error) {
    if (/not enabled|unsupported provider/i.test(error.message || "")) throw new Error("Entrar con Google aún no está activo. Usa tu correo.");
    throw new Error(mensajeError(error));
  }
}
// Con Google no se puede mandar el código ?ref= al crear la cuenta: se envía justo después de entrar.
// La base solo lo acepta una vez y en perfiles recién creados (menos de 1 hora).
function enviarRefSiFalta() {
  try {
    const ref = refGuardado();
    if (!ref || localStorage.getItem("mf_ref_enviado") === ref) return;
    localStorage.setItem("mf_ref_enviado", ref);
    sb.rpc("asignar_ref_inicial", { p_ref: ref }).then(() => {}, () => {});
  } catch (e) { /* sin almacenamiento: no pasa nada */ }
}
// Botón «Continuar con Google» (mismo en todas las ventanas de cuenta)
const BOTON_GOOGLE_HTML = `<button type="button" data-google class="btn-google w-full flex items-center justify-center gap-2.5 bg-white border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
    Continuar con Google</button>
  <div class="flex items-center gap-3 text-xs text-slate-400 my-3" aria-hidden="true"><span class="flex-1 h-px bg-slate-200"></span>o con tu correo<span class="flex-1 h-px bg-slate-200"></span></div>`;

async function iniciarSesion(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(mensajeError(error));
  await refrescarUsuario(data.session);
}

// Resumen de registros por código de origen (solo moderadores)
async function cargarResumenReferidos() {
  const { data, error } = await sb.rpc("resumen_referidos");
  if (error) throw new Error(mensajeError(error));
  return (data || []).map(r => ({ ref: r.ref, registros: Number(r.registros), ultimos7: Number(r.registros_7d), conAnuncio: Number(r.con_anuncio), conNegocio: Number(r.con_negocio) }));
}

async function cerrarSesionDB() {
  await sb.auth.signOut();
  usuarioActual = null;
  EDITOR = false;
}

async function recuperarPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw new Error(mensajeError(error));
}

async function cambiarPassword(nueva) {
  const { error } = await sb.auth.updateUser({ password: nueva });
  if (error) throw new Error(mensajeError(error));
}

// Si la sesión cambia (otra pestaña, o el enlace de recuperar contraseña), avisamos
// a la página con eventos. OJO: dentro de este callback NO se debe esperar a otras
// llamadas de Supabase directamente (puede bloquearse), por eso el setTimeout.
sb.auth.onAuthStateChange((evento, sesion) => {
  if (evento === "INITIAL_SESSION" || evento === "TOKEN_REFRESHED") return;
  setTimeout(async () => {
    if (evento === "PASSWORD_RECOVERY") {
      await refrescarUsuario(sesion);
      document.dispatchEvent(new CustomEvent("sesion:recuperar"));
      return;
    }
    // Si el usuario ya está al día (p. ej. acaba de iniciar sesión desde el formulario) no hay nada que hacer.
    const uid = sesion ? sesion.user.id : null;
    if (uid === (usuarioActual ? usuarioActual.id : null)) return;
    await refrescarUsuario(sesion);
    document.dispatchEvent(new CustomEvent("sesion:cambio"));
  }, 0);
});

// =====================================================================
// FORO
// =====================================================================
function filaATema(t) {
  return {
    id: Number(t.id),
    titulo: t.titulo,
    contenido: t.contenido,
    categoria: t.categoria,
    autor: t.autor_nombre,
    autorId: t.autor_id,
    fecha: Date.parse(t.creado_en),
    respuestas: (t.comentarios_foro || [])
      .slice()
      .sort((a, b) => Date.parse(a.creado_en) - Date.parse(b.creado_en))
      .map(c => ({ id: Number(c.id), autor: c.autor_nombre, autorId: c.autor_id, texto: c.texto, fecha: Date.parse(c.creado_en) }))
  };
}

async function cargarTemasForo() {
  const { data, error } = await sb.from("temas_foro").select("*, comentarios_foro(*)")
    .order("creado_en", { ascending: false }).limit(200);
  if (error) { console.error("foro:", error); mostrarToast(mensajeError(error), "error"); return []; }
  return (data || []).map(filaATema);
}

async function cargarTemaForo(id) {
  const { data, error } = await sb.from("temas_foro").select("*, comentarios_foro(*)").eq("id", id).maybeSingle();
  if (error) { console.error("tema:", error); mostrarToast(mensajeError(error), "error"); return null; }
  return data ? filaATema(data) : null;
}

async function crearTemaForo({ titulo, contenido, categoria, autor }) {
  if (!usuarioActual) throw new Error("Inicia sesión para publicar en el foro");
  const { data, error } = await sb.from("temas_foro")
    .insert({ titulo, contenido, categoria, autor_nombre: autor || "Anónimo" }).select("*, comentarios_foro(*)").single();
  if (error) throw error;
  return filaATema(data);
}

async function borrarTemaForo(id) {
  const { error } = await sb.from("temas_foro").delete().eq("id", id);
  if (error) throw error;
}

async function crearComentarioForo(temaId, { texto, autor }) {
  if (!usuarioActual) throw new Error("Inicia sesión para comentar");
  const { data, error } = await sb.from("comentarios_foro")
    .insert({ tema_id: temaId, texto, autor_nombre: autor || "Anónimo" }).select().single();
  if (error) throw error;
  return { id: Number(data.id), autor: data.autor_nombre, autorId: data.autor_id, texto: data.texto, fecha: Date.parse(data.creado_en) };
}

async function borrarComentarioForo(id) {
  const { error } = await sb.from("comentarios_foro").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
// REPORTES Y LISTA DE ESPERA
// =====================================================================
async function crearReporte(anuncioId, motivo, detalle) {
  if (!usuarioActual) throw new Error("Inicia sesión para reportar un anuncio");
  const { error } = await sb.from("reportes").insert({ anuncio_id: anuncioId, motivo, detalle: detalle || null });
  if (error) throw error;
}

// "Aún no llegamos a tu ciudad": guarda la ciudad (y el WhatsApp, opcional) para
// saber a dónde expandirse. Cualquiera puede escribir, nadie puede leer salvo moderadores.
async function unirseListaEspera(ciudad, whatsapp10) {
  const digitos = String(whatsapp10 || "").replace(/\D/g, "");
  const { error } = await sb.from("lista_espera").insert({
    ciudad: String(ciudad || "").trim(),
    whatsapp: digitos ? "57" + digitos : null
  });
  if (error) throw error;
}

// =====================================================================
// COMERCIOS (farmacias, cajeros, etc. importados de OpenStreetMap)
// =====================================================================
const TIPOS_COMERCIO = [
  { id: "farmacia",      nombre: "Farmacias",         icono: "💊", osm: ['["amenity"="pharmacy"]'] },
  { id: "cajero",        nombre: "Cajeros",           icono: "🏧", osm: ['["amenity"="atm"]'] },
  { id: "comida_rapida", nombre: "Comida rápida",     icono: "🍔", osm: ['["amenity"="fast_food"]'] },
  { id: "panaderia",     nombre: "Panaderías",        icono: "🥖", osm: ['["shop"="bakery"]'] },
  { id: "supermercado",  nombre: "Supermercados",     icono: "🛒", osm: ['["shop"="supermarket"]'] },
  { id: "banco",         nombre: "Bancos",            icono: "🏦", osm: ['["amenity"="bank"]'] },
  // Tipos que solo entran por el registro de negocios (no se importan de OpenStreetMap)
  { id: "tienda",        nombre: "Tiendas y misceláneas", icono: "🏪", osm: [] },
  { id: "restaurante",   nombre: "Restaurantes y cafés",  icono: "🍽️", osm: [] },
  { id: "belleza",       nombre: "Belleza y peluquerías", icono: "💈", osm: [] },
  { id: "ferreteria",    nombre: "Ferreterías",           icono: "🔧", osm: [] },
  { id: "ropa",          nombre: "Ropa y calzado",        icono: "👕", osm: [] },
  { id: "intimo",        nombre: "Tienda íntima (+18)",   icono: "🔞", osm: [] },
  { id: "otro",          nombre: "Otros negocios",        icono: "🛍️", osm: [] }
];
const TIPOS_IMPORTABLES = TIPOS_COMERCIO.filter(t => t.osm.length);
const iconosComercio = {};
TIPOS_COMERCIO.forEach(t => { iconosComercio[t.id] = t.icono; t.activo = true; t.palabras = ""; });

// Categorías administrables (Fase 2V · supabase/15_categorias_comercio.sql). La lista de arriba es el
// respaldo si aún no existe la tabla. Se reemplaza EN EL MISMO arreglo (las páginas ya lo tienen referenciado).
let categoriasCargadas = null;
function cargarCategoriasComercio() {
  if (categoriasCargadas) return categoriasCargadas;
  categoriasCargadas = (async () => {
    try {
      const { data, error } = await sb.from("categorias_comercio").select("id, nombre, icono, palabras, orden, activo").order("orden").order("nombre");
      if (error || !data || !data.length) return TIPOS_COMERCIO;
      const osm = {};
      TIPOS_COMERCIO.forEach(t => { osm[t.id] = t.osm; });
      TIPOS_COMERCIO.length = 0;
      data.forEach(r => TIPOS_COMERCIO.push({ id: r.id, nombre: r.nombre, icono: r.icono || "🏪", palabras: r.palabras || "",
                                               orden: r.orden, activo: r.activo !== false, osm: osm[r.id] || [] }));
      Object.keys(iconosComercio).forEach(k => delete iconosComercio[k]);
      TIPOS_COMERCIO.forEach(t => { iconosComercio[t.id] = t.icono; });
    } catch (e) { console.warn("categorías:", e); }
    return TIPOS_COMERCIO;
  })();
  return categoriasCargadas;
}
const categoriasActivas = () => TIPOS_COMERCIO.filter(t => t.activo !== false);
// ¿El comercio es de esta categoría? (principal o secundaria)
const comercioEsTipo = (c, id) => c.tipo === id || (c.tiposExtra || []).includes(id);
// Las categorías de un comercio, principal primero
// «Panadería · Cafetería» (singular aproximado de cada categoría del comercio)
const nombreCategorias = c => { const l = categoriasDe(c); return l.length ? l.map(t => t.nombre.split(" y ")[0].replace(/s$/, "")).join(" · ") : "Comercio"; };
const categoriasDe = c => [c.tipo].concat(c.tiposExtra || []).map(id => TIPOS_COMERCIO.find(t => t.id === id)).filter(Boolean);
// <option>s para elegir categoría (solo activas, más la actual aunque esté desactivada)
function opcionesCategoria(actual, conVacia) {
  const lista = TIPOS_COMERCIO.filter(t => t.activo !== false || t.id === actual);
  return (conVacia ? `<option value="">${esc(conVacia)}</option>` : "")
    + lista.map(t => `<option value="${esc(t.id)}" ${t.id === actual ? "selected" : ""}>${t.icono} ${esc(t.nombre)}</option>`).join("");
}

// Moderadores: crear o editar una categoría
async function guardarCategoriaDB(fila) {
  const { error } = await sb.from("categorias_comercio").upsert(fila, { onConflict: "id" });
  if (error) throw error;
  categoriasCargadas = null;
  await cargarCategoriasComercio();
}

let comercios = [];   // lista pública de comercios activos

// ¿Cómo atiende? (fase 2Z.8 · supabase/24_modo_atencion.sql). «casa» y «domicilio» muestran solo una zona
// aproximada en el mapa y sin dirección: el servidor corre el punto 150–350 m y borra la dirección pública.
const MODOS_ATENCION = {
  local:     { icono: "🏬", corto: "Local abierto",     nombre: "Local abierto al público", ayuda: "Tienes un local o puesto donde la gente puede llegar. Se muestra el punto exacto en el mapa." },
  casa:      { icono: "🏠", corto: "Desde casa",        nombre: "Atiendo desde mi casa",     ayuda: "Vendes o atiendes desde tu casa. En el mapa solo se ve una zona aproximada (a unas cuadras) y nunca tu dirección: tú la das por WhatsApp a quien quieras." },
  domicilio: { icono: "🛵", corto: "Solo domicilios",   nombre: "Solo domicilios",           ayuda: "No recibes clientes: llevas los pedidos. Se muestra solo la zona donde trabajas, sin dirección." }
};
const esUbicacionAprox = c => c && (c.modoAtencion === "casa" || c.modoAtencion === "domicilio");

function filaAComercio(r) {
  const m = municipios.find(x => x.id === r.municipio_id) || {};
  return {
    id: Number(r.id), osmId: r.osm_id, nombre: r.nombre, tipo: r.tipo,
    municipioId: r.municipio_id, ciudad: m.nombre || "", departamento: m.departamento || "",
    direccion: r.direccion || "", telefono: r.telefono || "", horario: r.horario || "",
    foto: r.foto_url || "", lat: parseFloat(r.lat), lng: parseFloat(r.lng),
    verificado: !!r.verificado, activo: !!r.activo,
    nivel: Number(r.nivel_verificacion) || (r.verificado ? 2 : 1),          // 1 ubicado · 2 por teléfono · 3 en persona
    verificadoEn: r.verificado_en || null,
    ownerId: r.owner_id || null, descripcion: r.descripcion || "", whatsapp: r.whatsapp || "",
    recoge: !!r.recoge, domicilio: !!r.domicilio, domicilioInfo: r.domicilio_info || "",
    nProductos: Number(r.n_productos) || 0, fuente: r.fuente || "",
    tiposExtra: Array.isArray(r.tipos_extra) ? r.tipos_extra : [],
    // Fase 2AA.4: galería (máx. 5; la primera es la portada). Sin el SQL 27, la foto de siempre.
    fotos: (Array.isArray(r.fotos) && r.fotos.length ? r.fotos : (r.foto_url ? [r.foto_url] : [])).filter(Boolean).slice(0, 5),
    tieneColumnaFotos: Array.isArray(r.fotos),
    modoAtencion: MODOS_ATENCION[r.modo_atencion] ? r.modo_atencion : "local",   // fase 2Z.8
    // Fase 2Z.10: lo que dice la comunidad (los votos nunca dan el sello: eso lo hace un moderador)
    confirmaSi: Number(r.confirma_si) || 0, confirmaNo: Number(r.confirma_no) || 0, confirmaLugar: Number(r.confirma_lugar) || 0,
    // Calificaciones (fase 2P): promedio y cuántas. Si aún no existen las columnas, quedan en 0.
    calif: Number(r.calif_promedio) || 0, nCalif: Number(r.calif_total) || 0,
    // Fase 2AB.2b: visto bueno sanitario (droguerías y naturistas). Sin el SQL 31, la columna no existe.
    saludRevisado: r.salud_revisado_en || null, tieneSelloSalud: "salud_revisado_en" in r,
    limiteProductos: Number.isInteger(r.limite_productos) ? r.limite_productos : LIMITE_PRODUCTOS_GRATIS   // fase 2AG
  };
}

// De dónde salió un comercio (para ordenar el trabajo del administrador)
const ORIGENES = {
  osm:       { icono: "📥", corto: "Importados",           nombre: "Importados de OpenStreetMap" },
  equipo:    { icono: "🛠️", corto: "Agregados por el equipo", nombre: "Agregados por el equipo" },
  dueno:     { icono: "🙋", corto: "Registrados por su dueño", nombre: "Registrados por su dueño y aprobados" },
  reclamado: { icono: "🔑", corto: "Reclamados",           nombre: "Importados y reclamados por su dueño" },
  comunidad: { icono: "🤝", corto: "Recomendados",         nombre: "Recomendados por la comunidad (fase 2X)" }
};
function origenComercio(c) {
  if (c.fuente === "Registro del dueño") return "dueno";
  if (c.fuente === "Agregado por el equipo") return "equipo";
  if (c.fuente === "Recomendado por la comunidad") return c.ownerId ? "reclamado" : "comunidad";
  return c.ownerId ? "reclamado" : "osm";
}

// Niveles de sello de varios comercios (para saber cuáles aprobados siguen sin verificar)
async function cargarNivelesComercios(ids) {
  if (!ids.length) return {};
  const { data, error } = await sb.from("comercios").select("id, nivel_verificacion").in("id", ids);
  if (error) throw error;
  const r = {};
  (data || []).forEach(x => { r[x.id] = Number(x.nivel_verificacion) || 1; });
  return r;
}

async function cargarComercios() {
  await cargarCategoriasComercio();
  const { data, error } = await sb.from("comercios").select("*").eq("activo", true).limit(2000);
  if (error) { console.error("comercios:", error); comercios = []; return comercios; }
  comercios = (data || []).map(filaAComercio);
  return comercios;
}

// Solo moderadores/admin: lista TODOS (incluye ocultos) para el editor.
async function cargarComerciosAdmin() {
  await cargarCategoriasComercio();
  const { data, error } = await sb.from("comercios").select("*").order("municipio_id").order("tipo").order("nombre").limit(2000);
  if (error) throw error;
  return (data || []).map(filaAComercio);
}

async function guardarComercioDB(id, cambios) {
  const { data, error } = await sb.from("comercios").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return filaAComercio(data);
}

// Solo moderadores: agrega a mano un comercio que no salió del importador (barrio, recomendación, solicitud)
async function crearComercioDB(fila) {
  const { data, error } = await sb.from("comercios").insert(fila).select().single();
  if (error) throw error;
  return filaAComercio(data);
}

async function eliminarComercioDB(id) {
  const { error } = await sb.from("comercios").delete().eq("id", id);
  if (error) throw error;
}

// Inserta comercios nuevos; los que ya existen (mismo osm_id) se saltan.
async function importarComerciosDB(filas) {
  if (!filas.length) return 0;
  const { data, error } = await sb.from("comercios")
    .upsert(filas, { onConflict: "osm_id", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return (data || []).length;
}

// Sube una foto (data:image/jpeg;base64) a TU carpeta del bucket y devuelve la URL pública.
async function subirFotoComercio(dataUrl) {
  const [url] = await subirFotos([dataUrl]);
  return url;
}

// =====================================================================
// VITRINA DEL COMERCIO (Fase 2D.3): tienda pública, panel del dueño y reportes
// =====================================================================
function filaAProducto(r) {
  return {
    id: Number(r.id), comercioId: Number(r.comercio_id), nombre: r.nombre, descripcion: r.descripcion || "",
    precio: r.precio == null ? null : Number(r.precio), foto: r.foto_url || "",
    fotos: (Array.isArray(r.fotos) && r.fotos.length ? r.fotos : (r.foto_url ? [r.foto_url] : [])).filter(Boolean).slice(0, 3),   // fase 2AA.5
    tieneColumnaFotos: Array.isArray(r.fotos),
    disponible: !!r.disponible, oculto: !!r.oculto, actualizado: r.actualizado_en
  };
}

// Un comercio por id (el público solo ve los activos; el dueño y los moderadores ven el suyo aunque esté oculto)
async function cargarComercioPorId(id) {
  await cargarCategoriasComercio();
  const { data, error } = await sb.from("comercios").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? filaAComercio(data) : null;
}

async function cargarProductos(comercioId) {
  const { data, error } = await sb.from("productos_comercio").select("*")
    .eq("comercio_id", comercioId).order("creado_en", { ascending: true }).limit(50);
  if (error) throw error;
  return (data || []).map(filaAProducto);
}

// Productos de vitrina de TODOS los comercios (para el buscador). La regla RLS ya deja ver solo los
// productos visibles de comercios activos con vitrina; aquí además se quitan los agotados.
async function cargarProductosPublicos() {
  const { data, error } = await sb.from("productos_comercio")
    .select("id, comercio_id, nombre, descripcion, precio, foto_url, disponible, oculto, actualizado_en")
    .eq("disponible", true).eq("oculto", false).limit(2000);
  if (error) { console.warn("productos:", error); return []; }
  return (data || []).map(filaAProducto);
}

// ---------- Accesos en cuadros del inicio (fase 2Z.1, supabase/20_accesos_inicio.sql) ----------
// Respaldo si aún no existe la tabla (los mismos que siembra el SQL)
const ACCESOS_RESPALDO = [
  { titulo: "Droguerías", icono: "💊", color: "menta", destino: "comercios.html?tipo=farmacia" },
  { titulo: "Mercado", icono: "🛒", color: "amarillo", destino: "comercios.html?tipo=supermercado" },
  { titulo: "Comida", icono: "🍔", color: "naranja", destino: "buscar.html?q=comida" },
  { titulo: "Bares", icono: "🍻", color: "rosa", destino: "comercios.html?tipo=bar" },
  { titulo: "Tecnología", icono: "📱", color: "azul", destino: "anuncios.html?cat=tecnologia" },
  { titulo: "Motos", icono: "🏍️", color: "morado", destino: "anuncios.html?cat=autos&sub=motos" },
  { titulo: "Arriendos", icono: "🏡", color: "menta", destino: "anuncios.html?cat=inmuebles" },
  { titulo: "Publica gratis", icono: "📢", color: "amarillo", destino: "#publicar" },
  { titulo: "Recomienda", icono: "🤝", color: "rosa", destino: "recomendar.html" },
  { titulo: "Tu negocio", icono: "🏪", color: "azul", destino: "registrar-negocio.html" }
];
const COLORES_ACCESO = ["morado", "menta", "amarillo", "rosa", "azul", "naranja"];
// Solo páginas propias o «#publicar» (la base aplica la misma regla)
const destinoAccesoValido = d => d === "#publicar" || d === "#contenido" || /^[a-z0-9-]+\.html([?#][A-Za-z0-9=&%:_.#+-]*)?$/.test(String(d || ""));

async function cargarAccesosInicio() {
  try {
    let { data, error } = await sb.from("accesos_inicio").select("id, titulo, icono, color, destino, orden, activo, imagen_url")
      .eq("activo", true).order("orden").order("id");
    if (error && /imagen_url/.test(error.message || "")) {   // aún sin el SQL 21
      ({ data, error } = await sb.from("accesos_inicio").select("id, titulo, icono, color, destino, orden, activo")
        .eq("activo", true).order("orden").order("id"));
    }
    if (error || !data || !data.length) return ACCESOS_RESPALDO;
    return data.filter(a => destinoAccesoValido(a.destino));
  } catch (e) { return ACCESOS_RESPALDO; }
}
async function cargarAccesosAdmin() {
  const { data, error } = await sb.from("accesos_inicio").select("*").order("orden").order("id");
  if (error) throw error;
  return data || [];
}
async function guardarAccesoDB(fila) {
  if (!destinoAccesoValido(fila.destino)) throw new Error("El destino debe ser una página del sitio (ej. comercios.html?tipo=farmacia) o #publicar");
  const { id, ...resto } = fila;
  const q = id ? sb.from("accesos_inicio").update(resto).eq("id", id) : sb.from("accesos_inicio").insert(resto);
  const { error } = await q;
  if (error) throw error;
}
async function borrarAccesoDB(id) {
  const { error } = await sb.from("accesos_inicio").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Carrusel del inicio editable (fase 2Z.2, supabase/21_editor_inicio.sql) ----------
// Paletas profesionales (las mismas clases .c1… del carrusel de siempre + tres nuevas)
const PALETAS_BANNER = {
  indigo: { nombre: "Índigo y violeta", clase: "c1" }, verde: { nombre: "Verde azulado", clase: "c2" },
  azul: { nombre: "Azul cielo", clase: "c3" }, naranja: { nombre: "Atardecer", clase: "c4" },
  rosa: { nombre: "Rosa y coral", clase: "c5" }, oscuro: { nombre: "Noche elegante", clase: "c6" },
  dorado: { nombre: "Dorado", clase: "c7" }, menta: { nombre: "Menta fresca", clase: "c8" },
  personal: { nombre: "Mis dos colores", clase: "" }
};
const esColorHex = c => /^#[0-9a-fA-F]{6}$/.test(String(c || ""));

async function cargarBanners() {
  try {
    const { data, error } = await sb.from("banners_inicio").select("*").eq("activo", true).order("orden").order("id");
    if (error || !data || !data.length) return null;           // null = se queda el carrusel de siempre
    return data.filter(b => destinoAccesoValido(b.destino));
  } catch (e) { return null; }
}
async function cargarBannersAdmin() {
  const { data, error } = await sb.from("banners_inicio").select("*").order("orden").order("id");
  if (error) throw error;
  return data || [];
}
async function guardarBannerDB(fila) {
  if (!destinoAccesoValido(fila.destino)) throw new Error("El botón debe llevar a una página del sitio, a Publicar o a los anuncios");
  const { id, ...resto } = fila;
  const { error } = id ? await sb.from("banners_inicio").update(resto).eq("id", id) : await sb.from("banners_inicio").insert(resto);
  if (error) throw error;
}
async function borrarBannerDB(id) {
  const { error } = await sb.from("banners_inicio").delete().eq("id", id);
  if (error) throw error;
}

// Una diapositiva con el MISMO diseño del carrusel de siempre (sirve al inicio y a la vista previa del editor)
function bannerHTML(b, i, total) {
  const pal = PALETAS_BANNER[b.paleta] ? b.paleta : "indigo";
  const estilos = [];
  if (pal === "personal" && esColorHex(b.color1) && esColorHex(b.color2)) estilos.push(`background:linear-gradient(120deg, ${b.color1}, ${b.color2})`);
  const img = urlSegura(b.imagen_url || "");
  const fondo = img && b.imagen_modo === "fondo";
  if (fondo) estilos.push(`background-image:linear-gradient(90deg, rgba(15,23,42,.82), rgba(15,23,42,.35)), url('${img.replace(/'/g, "%27")}');background-size:cover;background-position:center`);
  const clase = pal === "personal" ? (estilos.length ? "" : "c1") : PALETAS_BANNER[pal].clase;
  const cta = b.destino === "#publicar"
    ? `<button type="button" data-abrir="modal-publicar" data-requiere-login data-auth-modo="registro" data-texto-fijo class="car-cta">${esc(b.boton)}</button>`
    : `<a href="${esc(b.destino)}" class="car-cta">${esc(b.boton)}</a>`;
  const arte = fondo ? "" : img
    ? `<div class="car-arte" aria-hidden="true"><img src="${esc(img)}" alt="" class="car-img" loading="lazy"></div>`
    : `<div class="car-arte" aria-hidden="true"><div class="car-tarjeta"><span class="car-e1">${esc(b.icono1 || "⭐")}</span>${b.icono2 ? `<span class="car-e2">${esc(b.icono2)}</span>` : ""}</div></div>`;
  return `<article class="car-slide ${clase} ${fondo ? "car-con-fondo" : ""}" ${estilos.length ? `style="${estilos.join(";")}"` : ""} role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${total}">
    <div class="car-texto">
      ${b.etiqueta ? `<p class="car-etiqueta">${esc(b.etiqueta)}</p>` : ""}
      <h3 class="car-titulo">${esc(b.titulo)}</h3>
      ${b.texto ? `<p class="car-sub">${esc(b.texto)}</p>` : ""}
      ${cta}
    </div>
    ${arte}
  </article>`;
}

// ---------- Entrenar el buscador a mano (fase 2Z.2) ----------
// Agrega palabras a las «palabras clave» de una categoría (tipo "c" = comercios, "a" = anuncios), sin repetir.
async function agregarPalabrasCategoria(tipo, id, palabras) {
  const tabla = tipo === "a" ? "categorias_anuncio" : "categorias_comercio";
  const lista = tipo === "a" ? CATEGORIAS : TIPOS_COMERCIO;
  const { data, error } = await sb.from(tabla).select("palabras").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Esa categoría no existe en la base (ejecuta el SQL de categorías)");
  const actuales = String(data.palabras || "").split(",").map(x => x.trim()).filter(Boolean);
  const nuevas = palabras.map(x => String(x).trim().toLowerCase()).filter(x => x.length >= 2 && !actuales.some(a => normalizar(a) === normalizar(x)));
  if (!nuevas.length) return 0;
  const texto = actuales.concat(nuevas).join(", ");
  if (texto.length > 1500) throw new Error("La categoría ya tiene demasiadas palabras clave (máx. 1500 letras). Quita algunas en su panel");
  const { error: e2 } = await sb.from(tabla).update({ palabras: texto }).eq("id", id);
  if (e2) throw e2;
  const t = lista.find(x => x.id === id);
  if (t) t.palabras = texto;
  return nuevas.length;
}

// ---------- Perfil público del vendedor (fase 2C.5, supabase/18_perfil_vendedor.sql) ----------
// Solo: id, nombre visible (apodo o primer nombre), miembro desde, anuncios activos y su comercio.
async function cargarPerfilPublico(id) {
  const { data, error } = await sb.rpc("perfil_publico", { p_id: id });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return r ? { id: r.id, nombre: r.nombre, desde: r.miembro_desde, activos: Number(r.anuncios_activos) || 0,
               comercioId: r.comercio_id ? Number(r.comercio_id) : null, comercioNombre: r.comercio_nombre || "" } : null;
}
// Anuncios activos de un vendedor
async function cargarAnunciosDeVendedor(id) {
  const consulta = cols => sb.from("anuncios").select(cols).eq("owner_id", id)
    .eq("estado_publicacion", "activo").gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false }).limit(200);
  let { data, error } = await conDetalles(consulta);
  if (error && sinColumnasContacto(error)) ({ data, error } = await consulta("*"));
  if (error) throw error;
  return (data || []).map(filaAAnuncio);
}
// Mi nombre público (cómo me ven los compradores). Vacío = mi primer nombre.
async function cargarMiNombrePublico() {
  const { data, error } = await sb.from("perfiles").select("nombre_publico").eq("id", usuarioActual.id).maybeSingle();
  if (error) throw error;
  return (data && data.nombre_publico) || "";
}
async function guardarNombrePublico(texto) {
  const v = String(texto || "").trim();
  if (v && (v.length < 2 || v.length > 40)) throw new Error("Usa entre 2 y 40 letras");
  const { error } = await sb.from("perfiles").update({ nombre_publico: v || null }).eq("id", usuarioActual.id);
  if (error) throw error;
}
const fechaMiembro = iso => new Date(iso).toLocaleDateString("es-CO", { month: "long", year: "numeric" });

// ---------- Recomendaciones de comercios (fase 2X, supabase/17_recomendaciones.sql) ----------
// d: { nombre, tipo, municipioId, direccion, lat, lng, foto (data: opcional), comentario }
async function crearRecomendacion(d) {
  if (!usuarioActual) throw new Error("Inicia sesión para recomendar un comercio");
  const foto = d.foto ? await subirFotoComercio(d.foto) : null;
  const { error } = await sb.from("recomendaciones_comercio").insert({
    nombre: d.nombre.trim(), tipo: d.tipo, municipio_id: d.municipioId,
    direccion: (d.direccion || "").trim() || null,
    lat: d.lat != null ? +d.lat.toFixed(6) : null, lng: d.lng != null ? +d.lng.toFixed(6) : null,
    foto_url: foto, comentario: (d.comentario || "").trim() || null
  });
  if (error) throw error;
}
async function cargarMisRecomendaciones() {
  const { data, error } = await sb.from("recomendaciones_comercio")
    .select("id, nombre, tipo, municipio_id, estado, comercio_id, creado_en")
    .eq("usuario_id", usuarioActual.id).order("creado_en", { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}
// Moderadores: las pendientes (con el nombre de quien recomienda)
async function cargarRecomendaciones(estado) {
  const { data, error } = await sb.from("recomendaciones_comercio")
    .select("*, autor:perfiles!usuario_id(nombre)").eq("estado", estado || "pendiente")
    .order("creado_en", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}
async function cargarRecomendacion(id) {
  const { data, error } = await sb.from("recomendaciones_comercio").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
async function resolverRecomendacion(id, estado, comercioId) {
  const fila = { estado };
  if (comercioId) fila.comercio_id = comercioId;
  const { error } = await sb.from("recomendaciones_comercio").update(fila).eq("id", id);
  if (error) throw error;
}

// ---------- Búsquedas (fase 2W, solo moderadores: supabase/16_busquedas.sql) ----------
async function cargarBusquedas() {
  const { data, error } = await sb.from("busquedas").select("*").eq("resuelta", false)
    .order("veces_sin_result", { ascending: false }).order("ultima_vez", { ascending: false }).limit(300);
  if (error) throw error;
  return data || [];
}
async function marcarBusquedaResuelta(termino) {
  const { error } = await sb.from("busquedas").update({ resuelta: true }).eq("termino", termino);
  if (error) throw error;
}
async function borrarBusqueda(termino) {
  const { error } = await sb.from("busquedas").delete().eq("termino", termino);
  if (error) throw error;
}
// «Enseñar»: agrega la palabra buscada a las palabras clave de una categoría de comercio
async function ensenarPalabraCategoria(catId, palabra) {
  // catId: "c:farmacia" (comercios), "a:musica" (anuncios) o solo "farmacia" (comercios, como antes)
  const [tipo, id] = String(catId).includes(":") ? String(catId).split(":") : ["c", catId];
  if (tipo === "c") await cargarCategoriasComercio(); else await cargarCategoriasAnuncio();
  await agregarPalabrasCategoria(tipo, id, [palabra]);
  await marcarBusquedaResuelta(palabra);
}

// Comercios de los que soy dueño (para «Mi tienda»)
async function cargarMisComercios() {
  await cargarCategoriasComercio();
  if (!usuarioActual) return [];
  const { data, error } = await sb.from("comercios").select("*").eq("owner_id", usuarioActual.id).order("nombre");
  if (error) { console.error("mis comercios:", error); return []; }
  return (data || []).map(filaAComercio);
}

// El dueño solo puede cambiar: descripcion, whatsapp, telefono, horario, foto_url, recoge, domicilio, domicilio_info
async function guardarMiComercio(id, cambios) {
  const { data, error } = await sb.from("comercios").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return filaAComercio(data);
}

async function guardarProducto(comercioId, d, id) {
  const fila = {
    nombre: d.nombre.trim(), descripcion: (d.descripcion || "").trim() || null,
    precio: d.precio == null ? null : Math.round(d.precio), disponible: d.disponible !== false
  };
  if (d.foto) fila.foto_url = d.foto.startsWith("data:") ? await subirFotoComercio(d.foto) : d.foto;
  if (d.quitarFoto) fila.foto_url = null;
  // Fase 2AA.5: lista de fotos (ya subidas). Con el SQL 28 se guarda la lista; sin él, solo la principal.
  if (Array.isArray(d.fotos)) { fila.fotos = d.fotos.slice(0, 3); fila.foto_url = fila.fotos[0] || null; }
  const sinColFotos = e => /fotos/.test((e && e.message) || "") && "fotos" in fila;   // aún sin el SQL 28: reintenta solo con la principal
  if (id) {
    let { data, error } = await sb.from("productos_comercio").update(fila).eq("id", id).select().single();
    if (error && sinColFotos(error)) { delete fila.fotos; ({ data, error } = await sb.from("productos_comercio").update(fila).eq("id", id).select().single()); }
    if (error) throw error;
    return filaAProducto(data);
  }
  fila.comercio_id = comercioId;
  let { data, error } = await sb.from("productos_comercio").insert(fila).select().single();
  if (error && sinColFotos(error)) { delete fila.fotos; ({ data, error } = await sb.from("productos_comercio").insert(fila).select().single()); }
  if (error) throw error;
  return filaAProducto(data);
}

async function eliminarProducto(id) {
  const { error } = await sb.from("productos_comercio").delete().eq("id", id);
  if (error) throw error;
}

async function crearReporteProducto(productoId, motivo, detalle) {
  if (!usuarioActual) throw new Error("Inicia sesión para reportar");
  const { error } = await sb.from("reportes_producto").insert({ producto_id: productoId, motivo, detalle: detalle || null });
  if (error) throw error;
}

// ---------- Reportar un comercio (Fase 2G) ----------
const MOTIVOS_REPORTE_COMERCIO = {
  cerrado: "Ya cerró o no existe",
  datos: "Datos incorrectos (teléfono, horario, dirección)",
  ubicacion: "Está en otro lugar en el mapa",
  falso: "No parece un negocio real o posible engaño",
  otro: "Otro motivo"
};

async function crearReporteComercio(comercioId, motivo, detalle) {
  if (!usuarioActual) throw new Error("Inicia sesión para reportar");
  const { error } = await sb.from("reportes_comercio").insert({ comercio_id: comercioId, motivo, detalle: detalle || null });
  if (error) throw error;
}

// Solo moderadores
async function cargarReportesComercio(estado) {
  let q = sb.from("reportes_comercio")
    .select("id, motivo, detalle, estado, creado_en, comercio:comercios(id, nombre, tipo, municipio_id, activo, owner_id)")
    .order("creado_en", { ascending: false }).limit(200);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function resolverReporteComercio(id, estado) {
  const { error } = await sb.from("reportes_comercio").update({ estado }).eq("id", id);
  if (error) throw error;
}

// Ventana para reportar un comercio (se crea sola; sirve en cualquier página que cargue data.js)
function abrirReporteComercio(c) {
  if (!usuarioActual) {
    mostrarToast("Inicia sesión para reportar", "error");
    setTimeout(() => { location.href = "index.html#login"; }, 1200);
    return;
  }
  if (!$("modal-rep-com")) {
    document.body.insertAdjacentHTML("beforeend", `<div id="modal-rep-com" class="modal-fondo hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" role="dialog" aria-modal="true" aria-labelledby="rc-titulo">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[92vh] overflow-auto">
        <button type="button" data-cerrar aria-label="Cerrar" class="absolute top-4 right-4 text-2xl text-slate-400 hover:text-slate-700">&times;</button>
        <h3 id="rc-titulo" class="text-xl font-black text-indigo-900 mb-1">⚠️ Reportar este negocio</h3>
        <p class="text-sm text-slate-500 mb-4">Comercio: <b id="rc-nombre"></b></p>
        <form id="form-rep-com" class="space-y-3">
          <div><label for="rc-motivo" class="block text-xs font-bold text-slate-500 mb-1">¿Qué pasa?</label>
            <select id="rc-motivo" class="w-full border border-slate-300 p-3 rounded-xl bg-white">${Object.entries(MOTIVOS_REPORTE_COMERCIO).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
          <div><label for="rc-detalle" class="block text-xs font-bold text-slate-500 mb-1">Cuéntanos más (opcional)</label>
            <textarea id="rc-detalle" rows="3" maxlength="500" class="w-full border border-slate-300 p-3 rounded-xl"></textarea></div>
          <button type="submit" id="rc-enviar" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-60">Enviar reporte</button>
          <p class="text-[11px] text-slate-400 text-center">Un moderador lo revisa. Tu nombre no se muestra al comercio.</p>
        </form>
      </div></div>`);
    $("form-rep-com").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = $("rc-enviar"); btn.disabled = true;
      try {
        await crearReporteComercio(Number($("modal-rep-com").dataset.id), $("rc-motivo").value, $("rc-detalle").value.trim());
        cerrarModal("modal-rep-com");
        mostrarToast("✅ Gracias, un moderador lo revisará");
      } catch (err) { mostrarToast(mensajeError(err), "error"); }
      finally { btn.disabled = false; }
    });
  }
  $("modal-rep-com").dataset.id = c.id;
  $("rc-nombre").textContent = c.nombre;
  $("rc-motivo").value = "datos"; $("rc-detalle").value = "";
  abrirModal("modal-rep-com");
}

// Solo moderadores
async function cargarReportesProducto(estado) {
  let q = sb.from("reportes_producto")
    .select("id, motivo, detalle, estado, creado_en, producto:productos_comercio(id, nombre, oculto, comercio_id)")
    .order("creado_en", { ascending: false }).limit(200);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function resolverReporteProducto(id, estado) {
  const { error } = await sb.from("reportes_producto").update({ estado }).eq("id", id);
  if (error) throw error;
}

async function ocultarProducto(id, oculto) {
  const { error } = await sb.from("productos_comercio").update({ oculto }).eq("id", id);
  if (error) throw error;
}

// Solo moderadores: aprueba el reclamo de un dueño (por id de usuario o por correo); sin datos, quita al dueño
async function asignarDuenoComercio(comercioId, { usuarioId, email } = {}) {
  const { error } = await sb.rpc("asignar_dueno_comercio", { p_comercio: comercioId, p_usuario: usuarioId || null, p_email: email || null });
  if (error) throw error;
}

// =====================================================================
// DROGUERÍAS Y PRODUCTOS DE SALUD (fase 2AB.1, supabase/29_productos_salud.sql)
// Hoy NO se venden medicamentos (Términos 4B). Las droguerías y naturistas dejan sus datos sanitarios
// (privados: solo el dueño y Merkap) y su vitrina muestra solo productos que no son medicamentos.
// =====================================================================
const TIPOS_SALUD = ["farmacia", "naturista"];
const esTipoSalud = t => TIPOS_SALUD.includes(t);
const esComercioSalud = c => !!c && (esTipoSalud(c.tipo) || (c.tiposExtra || []).some(esTipoSalud));
// Fase 2AB.2b: ¿la vitrina se ve en público? Verificado (teléfono o en persona) y, si es de salud, con visto bueno sanitario.
// Opción B (fase 2AC): la vitrina de una droguería solo necesita estar verificada, como cualquier comercio.
// El visto bueno sanitario enciende el distintivo 🧾 y será requisito para vender medicamentos de venta libre (2AB.3).
const saludPendiente = c => esComercioSalud(c) && c.tieneSelloSalud && !c.saludRevisado;
const vitrinaPublica = c => !!c && c.activo !== false && c.nivel >= 2;
const BADGE_SALUD = '<span class="badge-salud" title="Merkap revisó su razón social, NIT y director técnico. No significa que venda medicamentos por Merkap.">🧾 Datos sanitarios revisados</span>';
const TIPOS_ESTABLECIMIENTO_SALUD = {
  drogueria: "Droguería (director técnico o regente)",
  farmacia_drogueria: "Farmacia-droguería (químico farmacéutico)",
  naturista: "Tienda naturista"
};
// La misma lista que public.palabra_medicamento() del SQL 29: solo AVISA; la última palabra es del moderador
const RX_MEDICAMENTO = /\b(medicamentos?|acetaminofen|paracetamol|ibuprofeno|naproxeno|diclofenaco|aspirina|amoxicilina|ampicilina|azitromicina|ciprofloxacina|cefalexina|antibioticos?|losartan|enalapril|metformina|insulinas?|omeprazol|esomeprazol|loratadina|cetirizina|dexametasona|prednisolona|betametasona|clonazepam|alprazolam|diazepam|tramadol|codeina|morfina|sildenafil|viagra|misoprostol|cytotec|anticonceptiv[a-z]*|dolex|advil|noxpirin|apronax|buscapina|sin formula|sin receta|formula medica|ampollas?|inyectables?|jarabes?|tabletas?|capsulas?|pastillas?|grageas?|[0-9]+ ?mg)\b/;
function pareceMedicamento(texto) {
  const t = String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const m = t.match(RX_MEDICAMENTO);
  return m ? m[1] : "";
}
// Pregunta antes de guardar algo que parece un medicamento. true = sigue (la persona confirmó que NO lo es).
function confirmarNoMedicamento(texto, donde) {
  const p = pareceMedicamento(texto);
  if (!p) return true;
  return confirm(`«${p}» parece un medicamento.\n\nEn Merkap no se publican medicamentos (ni de venta libre ni con fórmula médica) ${donde || ""}. Si lo publicas, un moderador lo revisa y puede ocultarlo.\n\n¿Confirmas que NO es un medicamento?`);
}

// Formulario reutilizable (registro, Mi tienda y el editor del administrador). pre = prefijo de los id.
function htmlDatosSanitarios(pre, d) {
  d = d || {};
  const opt = Object.entries(TIPOS_ESTABLECIMIENTO_SALUD).map(([k, v]) => `<option value="${k}" ${d.tipo_establecimiento === k ? "selected" : ""}>${esc(v)}</option>`).join("");
  const inp = "mt-0.5 w-full border border-slate-300 p-2.5 rounded-lg font-normal text-sm text-slate-800";
  return `<div class="space-y-3">
    <p class="text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3">🔒 <b>Estos datos son privados.</b> Solo los ven tú y Merkap. No aparecen en tu ficha pública. Los pide la ley para identificar a quien ofrece productos (Ley 1480 de 2011, art. 53) y porque las droguerías son establecimientos vigilados por la Secretaría de Salud.</p>
    <label class="block text-xs font-bold text-slate-500">Tipo de establecimiento *
      <select id="${pre}-tipo-est" class="${inp} bg-white"><option value="">— Elige —</option>${opt}</select></label>
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="block text-xs font-bold text-slate-500">Razón social *
        <input id="${pre}-razon" maxlength="150" value="${esc(d.razon_social || "")}" class="${inp}" placeholder="Droguería El Sol S.A.S."></label>
      <label class="block text-xs font-bold text-slate-500">NIT (o cédula si es persona natural) *
        <input id="${pre}-nit" maxlength="14" inputmode="numeric" value="${esc(d.nit || "")}" class="${inp}" placeholder="900123456-7"></label>
    </div>
    <label class="block text-xs font-bold text-slate-500">Director técnico o regente de farmacia *
      <input id="${pre}-director" maxlength="120" value="${esc(d.director_tecnico || "")}" class="${inp}" placeholder="Nombre completo"></label>
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="block text-xs font-bold text-slate-500">N.º de acta o concepto sanitario <span class="font-normal">(opcional)</span>
        <input id="${pre}-acta" maxlength="60" value="${esc(d.acta_numero || "")}" class="${inp}" placeholder="Ej. 2026-0412"></label>
      <label class="block text-xs font-bold text-slate-500">Fecha de la última visita <span class="font-normal">(opcional)</span>
        <input id="${pre}-acta-fecha" type="date" value="${esc(d.acta_fecha || "")}" max="${new Date().toISOString().slice(0, 10)}" class="${inp}"></label>
    </div>
    <label class="flex items-start gap-2 text-sm"><input type="checkbox" id="${pre}-declara" class="mt-1" ${d.declara_autorizacion ? "checked" : ""}>
      <span>Declaro que este establecimiento cuenta con <b>autorización y concepto sanitario vigente</b> de la Secretaría de Salud, y que conozco la <a href="politica-productos-salud.html" target="_blank" class="underline text-indigo-600">Política de productos de salud</a> de Merkap: hoy <b>no publico medicamentos</b> en mi vitrina.</span></label>
  </div>`;
}
// Lee y valida. Devuelve { datos } o { error }.
function leerDatosSanitarios(pre) {
  const v = id => (document.getElementById(pre + "-" + id) || {}).value || "";
  const datos = {
    tipo_establecimiento: v("tipo-est"), razon_social: v("razon").trim(),
    nit: v("nit").replace(/[\s.]/g, ""), director_tecnico: v("director").trim(),
    acta_numero: v("acta").trim() || null, acta_fecha: v("acta-fecha") || null,
    declara_autorizacion: !!(document.getElementById(pre + "-declara") || {}).checked
  };
  if (!datos.tipo_establecimiento) return { error: "Elige el tipo de establecimiento" };
  if (datos.razon_social.length < 2) return { error: "Escribe la razón social" };
  if (!/^[0-9]{5,12}(-[0-9])?$/.test(datos.nit)) return { error: "El NIT debe tener solo números, con o sin dígito de verificación (ej. 900123456-7)" };
  if (datos.director_tecnico.length < 3) return { error: "Escribe el nombre del director técnico o regente" };
  if (datos.acta_fecha && datos.acta_fecha > new Date().toISOString().slice(0, 10)) return { error: "La fecha del acta no puede ser futura" };
  if (!datos.declara_autorizacion) return { error: "Debes declarar que cuentas con autorización de la Secretaría de Salud" };
  return { datos };
}
// Fase 2AC.1: los datos sanitarios son OPCIONALES. Si no escribió nada → { datos: null }; si empezó, se validan completos.
function leerDatosSanitariosOpcional(pre) {
  const v = id => ((document.getElementById(pre + "-" + id) || {}).value || "").trim();
  const vacio = !v("razon") && !v("nit") && !v("director") && !v("acta") && !v("acta-fecha") && !(document.getElementById(pre + "-declara") || {}).checked;
  return vacio ? { datos: null } : leerDatosSanitarios(pre);
}
// Lo que gana quien los llena (se muestra en registro, reclamo y Mi tienda)
const BENEFICIOS_SALUD = "Son <b>opcionales</b>. Si los llenas y Merkap los revisa, tu ficha muestra el distintivo <b>«🧾 Datos sanitarios revisados»</b> (más confianza), sales <b>primero</b> entre las droguerías de tu zona y tendrás hecho el <b>primer paso</b> para cuando Merkap abra la venta de medicamentos de venta libre.";

async function cargarDatosSanitarios(comercioId) {
  const { data, error } = await sb.from("datos_sanitarios").select("*").eq("comercio_id", comercioId).maybeSingle();
  if (error) throw error;
  return data || null;
}
async function guardarDatosSanitarios(comercioId, datos) {
  const { data, error } = await sb.from("datos_sanitarios").upsert({ comercio_id: comercioId, ...datos }, { onConflict: "comercio_id" }).select().single();
  if (error) throw error;
  return data;
}
// Solo moderadores: visto bueno (o quitarlo) con una nota opcional
async function revisarDatosSanitarios(comercioId, ok, nota) {
  const { data, error } = await sb.from("datos_sanitarios").update({
    revisado_en: ok ? new Date().toISOString() : null, revisado_por: ok ? usuarioActual.id : null, nota_moderador: (nota || "").trim() || null
  }).eq("comercio_id", comercioId).select().single();
  if (error) throw error;
  return data;
}
async function cargarDatosSanitariosPorRevisar() {
  const { data, error } = await sb.from("datos_sanitarios").select("*, comercio:comercios(id, nombre, tipo, municipio_id)")
    .is("revisado_en", null).order("actualizado_en", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}
// Cola «💊 Posibles medicamentos» (solo moderadores)
// motivo: 'salud' (medicamentos) o 'palabra' (palabras prohibidas, SQL 32). Sin el SQL 32 todo es 'salud'.
async function cargarRevisionSalud(motivo) {
  const consulta = conMotivo => {
    let q = sb.from("revision_salud").select("*").eq("estado", "pendiente").order("creado_en", { ascending: true }).limit(200);
    if (conMotivo) q = q.eq("motivo", motivo || "salud");
    return q;
  };
  let { data, error } = await consulta(true);
  if (error && /motivo/.test(error.message || "")) {
    if (motivo === "palabra") throw new Error("Se activa al ejecutar supabase/32_palabras_y_seleccion.sql");
    ({ data, error } = await consulta(false));
  }
  if (error) throw error;
  return (data || []).filter(r => !r.motivo || r.motivo === (motivo || "salud"));
}
// ---------- 🚫 Palabras prohibidas (fase 2AC, solo moderadores) ----------
async function cargarPalabrasProhibidas() {
  const { data, error } = await sb.from("palabras_prohibidas").select("*").order("accion").order("palabra");
  if (error) throw error;
  return data || [];
}
async function guardarPalabraProhibida(fila) {
  const { id, ...resto } = fila;
  const q = id ? sb.from("palabras_prohibidas").update(resto).eq("id", id) : sb.from("palabras_prohibidas").insert(resto);
  const { error } = await q;
  if (error) throw error;
}
async function borrarPalabraProhibida(id) {
  const { error } = await sb.from("palabras_prohibidas").delete().eq("id", id);
  if (error) throw error;
}
// ---------- ⭐ Selección del día (fases 2AC y 2AD) ----------
// Gratis y sin pago de por medio: primero los que fijó un moderador (⭐) y el resto lo sortea el sistema con reglas.
// El sorteo cambia cada TURNO de 4 horas (6 veces al día): aparecen otros anuncios y en otro orden; nunca queda fijo.
// Los que un moderador sacó (🚫 seleccion_excluido) nunca entran al sorteo.
const HORAS_TURNO_SELECCION = 4;
const turnoSeleccion = (ms = Date.now()) => {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10) + "#" + Math.floor(d.getHours() / HORAS_TURNO_SELECCION);
};
function seleccionDelDia(lista, max, ahoraMs) {
  max = max || 8;
  const ahora = ahoraMs || Date.now();
  const turno = turnoSeleccion(ahora);
  const semilla = id => { let h = 2166136261; for (const ch of turno + ":" + id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const porSemilla = (a, b) => semilla(a.id) - semilla(b.id);
  const validos = lista.filter(a => !a.seleccionExcluido && !esAdultos(a));   // fase 2AL: «Íntimo +18» nunca sale en el inicio
  const elegidos = validos.filter(a => a.seleccionHasta > ahora).sort(porSemilla);   // los fijados también rotan de orden
  const usados = new Set(elegidos.map(a => a.id));
  const resto = validos.filter(a => !usados.has(a.id)).sort(porSemilla);
  const out = [...elegidos.slice(0, max)];
  const vendedores = new Set(elegidos.map(a => a.owner)), cats = {};
  const meter = a => { out.push(a); usados.add(a.id); vendedores.add(a.owner); cats[a.categoria] = (cats[a.categoria] || 0) + 1; };
  // Se afloja por rondas para que se vea algo aunque haya pocos anuncios:
  // 1) recientes (14 días) con foto, uno por vendedor y máx. 2 por categoría · 2) con foto · 3) cualquiera
  const rondas = [
    a => a.imagen && ahora - a.fecha < 14 * 864e5 && !(a.owner && vendedores.has(a.owner)) && (cats[a.categoria] || 0) < 2,
    a => !!a.imagen,
    () => true
  ];
  for (const ok of rondas) for (const a of resto) {
    if (out.length >= max) break;
    if (!usados.has(a.id) && ok(a)) meter(a);
  }
  return out.slice(0, max).map(a => ({ ...a, elegidoMod: a.seleccionHasta > ahora }));
}
// Solo moderadores: sacar (o volver a permitir) un anuncio del sorteo
async function excluirDeSeleccion(id, excluir) {
  const cambios = { seleccion_excluido: !!excluir };
  if (excluir) cambios.seleccion_hasta = null;   // si estaba fijado, también se quita
  const { error } = await sb.from("anuncios").update(cambios).eq("id", id);
  if (error) throw error;
  const a = baseDatosAnuncios.find(x => x.id === id);
  if (a) { a.seleccionExcluido = !!excluir; if (excluir) a.seleccionHasta = 0; }
}
async function marcarSeleccionDia(id, horas) {
  const hasta = horas ? new Date(Date.now() + horas * 3600e3).toISOString() : null;
  const cambios = { seleccion_hasta: hasta };
  if (hasta) cambios.seleccion_excluido = false;   // fijarlo lo vuelve a permitir
  let { error } = await sb.from("anuncios").update(cambios).eq("id", id);
  if (error && /seleccion_excluido/.test(error.message || "")) { delete cambios.seleccion_excluido; ({ error } = await sb.from("anuncios").update(cambios).eq("id", id)); }   // sin el SQL 34
  if (error) throw error;
  const a = baseDatosAnuncios.find(x => x.id === id);
  if (a) { a.seleccionHasta = hasta ? Date.parse(hasta) : 0; if (hasta) a.seleccionExcluido = false; }
}
async function resolverRevisionSalud(id, estado) {
  const { error } = await sb.from("revision_salud").update({ estado }).eq("id", id);
  if (error) throw error;
}

// ---------- Registro de negocios nuevos (Fase 2D.6) ----------
// d: { nombre, tipo, municipioId, direccion, lat, lng, telefono, whatsapp, horario, descripcion, foto (data:), gpsCerca }
async function crearNegocioPendiente(d) {
  if (!usuarioActual) throw new Error("Inicia sesión para registrar tu negocio");
  const foto = await subirFotoComercio(d.foto);
  const fila = {
    nombre: d.nombre.trim(), tipo: d.tipo, municipio_id: d.municipioId, direccion: d.direccion.trim(),
    lat: +d.lat.toFixed(6), lng: +d.lng.toFixed(6), telefono: d.telefono || null, whatsapp: d.whatsapp || null,
    horario: d.horario || null, descripcion: d.descripcion || null, foto_fachada_url: foto,
    gps_cerca: !!d.gpsCerca, acepta_terminos: true
  };
  if (d.modo && d.modo !== "local") fila.modo_atencion = d.modo;   // «local» es el valor por defecto
  if (d.datosSanitarios) fila.datos_sanitarios = d.datosSanitarios;   // fase 2AB.1 (SQL 29)
  const { error } = await sb.from("negocios_pendientes").insert(fila);
  if (error && /datos_sanitarios/.test(error.message || "")) throw new Error("El registro de droguerías y tiendas naturistas se activa en unos días. Escríbenos a mercafree7@gmail.com y te registramos.");
  if (error && /modo_atencion/.test(error.message || "")) throw new Error("Para registrar un negocio que atiende desde casa o solo a domicilio falta un ajuste del sistema. Elige «Local abierto» o inténtalo más tarde.");
  if (error) throw error;
}

// Mis solicitudes (la persona) o todas las pendientes (moderadores; con estado)
async function cargarNegociosPendientes(estado, soloMias) {
  const consulta = extra => {
    let q = sb.from("negocios_pendientes")
      .select("id, nombre, tipo, municipio_id, direccion, lat, lng, telefono, whatsapp, horario, descripcion, foto_fachada_url, gps_cerca, estado, motivo_rechazo, comercio_id, solicitante_id, creado_en" + extra + ", solicitante:perfiles!solicitante_id(nombre)")
      .order("creado_en", { ascending: false }).limit(100);
    if (estado) q = q.eq("estado", estado);
    if (soloMias && usuarioActual) q = q.eq("solicitante_id", usuarioActual.id);
    return q;
  };
  let { data, error } = await consulta(", modo_atencion, datos_sanitarios, propuesta, propuesta_nota, propuesta_en, proponente:perfiles!propuesta_por(nombre)");
  if (error && /propuesta/.test(error.message || "")) ({ data, error } = await consulta(", modo_atencion, datos_sanitarios"));   // sin el SQL 38
  if (error && /datos_sanitarios/.test(error.message || "")) ({ data, error } = await consulta(", modo_atencion"));   // sin el SQL 29
  if (error && /modo_atencion/.test(error.message || "")) ({ data, error } = await consulta(""));   // sin el SQL 24
  if (error) throw error;
  return data || [];
}

async function senalesNegocio(id) {
  const { data, error } = await sb.rpc("senales_negocio", { p_id: id });
  if (error) throw error;
  return data || {};
}

// Devuelve el id del comercio creado al aprobar
async function resolverNegocio(id, aprobar, motivo) {
  const { data, error } = await sb.rpc("resolver_negocio", { p_id: id, p_aprobar: aprobar, p_motivo: motivo || null });
  if (error) throw error;
  return data;
}

// Puntaje de confianza 0-100 para decidir rápido. NO reemplaza la verificación: solo ordena el trabajo del moderador.
function puntajeNegocio(n, s) {
  const pts = [];
  const suma = (ok, p, bien, mal) => pts.push({ ok, p: ok ? p : 0, max: p, texto: ok ? bien : mal });
  suma(!!s.correo_confirmado, 15, "Correo confirmado", "Correo sin confirmar");
  suma((s.cuenta_dias || 0) >= 3, 10, `Cuenta de ${s.cuenta_dias} días`, "Cuenta recién creada");
  suma(!!n.gps_cerca, 20, "Envió desde el local (GPS del celular)", "No estaba en el local al enviar");
  suma(!!n.whatsapp, 15, "Dejó WhatsApp para confirmar", "Sin WhatsApp (solo teléfono)");
  suma(!(s.cerca || []).length, 15, "No hay negocios parecidos cerca", "Hay un negocio a menos de 120 m");
  suma(!s.whatsapp_repetido, 15, "WhatsApp no repetido", "Ese WhatsApp ya está en otro negocio");
  suma(!(s.rechazadas_previas > 0), 10, "Sin rechazos previos", "Tiene solicitudes rechazadas antes");
  return { total: pts.reduce((a, x) => a + x.p, 0), detalle: pts };
}

// ---------- Sello de verificación (Fase 2D.1) ----------
// Cada nivel dice exactamente qué significa; así el sello nunca promete más de lo comprobado.
const SELLOS = {
  1: { corto: "Ubicado", largo: "Dato de OpenStreetMap · sin verificar", clase: "bg-amber-100 text-amber-800" },
  2: { corto: "Verificado por teléfono", largo: "✔ Verificado por teléfono", clase: "bg-green-100 text-green-800" },
  3: { corto: "Verificado en persona", largo: "✔ Verificado en persona", clase: "bg-green-600 text-white" }
};
const MESES_VIGENCIA = 12;

function fechaSello(c) {
  if (!c.verificadoEn) return "";
  return new Date(c.verificadoEn).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
function selloVencido(c) {
  if (c.nivel < 2 || !c.verificadoEn) return false;
  const lim = new Date(c.verificadoEn); lim.setMonth(lim.getMonth() + MESES_VIGENCIA);
  return lim < new Date();
}

// Registra una verificación (solo moderadores). El trigger de la base aplica el resultado al comercio.
// datos: { comercioId, metodo: "telefono"|"visita", resultado: "aprobada"|"rechazada", lista, foto (data:), lat, lng, notas }
async function crearVerificacion(datos) {
  if (!usuarioActual) throw new Error("Inicia sesión");
  const fila = {
    comercio_id: datos.comercioId,
    metodo: datos.metodo,
    resultado: datos.resultado,
    nivel: datos.metodo === "visita" ? 3 : 2,
    lista: datos.lista || {},
    notas: (datos.notas || "").trim() || null,
    lat: datos.lat != null ? +datos.lat.toFixed(6) : null,
    lng: datos.lng != null ? +datos.lng.toFixed(6) : null
  };
  if (datos.foto) fila.foto_fachada_url = await subirFotoComercio(datos.foto);
  const { data, error } = await sb.from("verificaciones_comercio").insert(fila).select().single();
  if (error) throw error;
  return data;
}

async function cargarVerificaciones(comercioId) {
  const { data, error } = await sb.from("verificaciones_comercio")
    .select("id, metodo, resultado, nivel, lista, notas, foto_fachada_url, creado_en, verificador_id")
    .eq("comercio_id", comercioId).order("creado_en", { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

// =====================================================================
// REPORTES (solo moderadores)
// =====================================================================
async function cargarReportes(estado) {
  let q = sb.from("reportes")
    .select("id, motivo, detalle, estado, creado_en, reportante:perfiles!reportante_id(nombre), anuncio:anuncios(id, nombre, estado_publicacion, fotos, barrio, owner_id)")
    .order("creado_en", { ascending: false }).limit(300);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function resolverReporte(id, estado) {
  const { error } = await sb.from("reportes").update({ estado }).eq("id", id);
  if (error) throw error;
}

// Marca como resuelto TODOS los reportes pendientes de un anuncio.
async function resolverReportesDeAnuncio(anuncioId, estado) {
  const { error } = await sb.from("reportes").update({ estado }).eq("anuncio_id", anuncioId).eq("estado", "pendiente");
  if (error) throw error;
}

async function cambiarVisibilidadAnuncio(id, estadoPublicacion) {
  const { error } = await sb.from("anuncios").update({ estado_publicacion: estadoPublicacion }).eq("id", id);
  if (error) throw error;
}

// =====================================================================
// SOLICITUDES DE COMERCIOS (dueños que piden actualizar, retirar o reclamar su ficha)
// =====================================================================
async function crearSolicitudComercio(comercioId, { tipo, nombre, contacto, mensaje, datosSanitarios }) {
  if (!usuarioActual) throw new Error("Inicia sesión para enviar la solicitud");
  const fila = { comercio_id: comercioId, tipo, nombre_contacto: nombre, contacto, mensaje: mensaje || null };
  if (datosSanitarios) fila.datos_sanitarios = datosSanitarios;   // fase 2AB.2b (SQL 31)
  let { error } = await sb.from("solicitudes_comercio").insert(fila);
  if (error && /datos_sanitarios/.test(error.message || "")) {   // aún sin el SQL 31: se envía igual y los datos se piden después en Mi tienda
    delete fila.datos_sanitarios; ({ error } = await sb.from("solicitudes_comercio").insert(fila));
  }
  if (error) throw error;
}

// Solo moderadores
async function cargarSolicitudesComercio(estado) {
  const consulta = extra => {
    let q = sb.from("solicitudes_comercio")
      .select("id, tipo, nombre_contacto, contacto, mensaje, estado, creado_en, solicitante_id" + extra + ", comercio:comercios(id, nombre, tipo, municipio_id, owner_id, activo)")
      .order("creado_en", { ascending: false }).limit(200);
    if (estado) q = q.eq("estado", estado);
    return q;
  };
  let { data, error } = await consulta(", datos_sanitarios, propuesta, propuesta_nota, propuesta_en, proponente:perfiles!propuesta_por(nombre)");
  if (error && /propuesta/.test(error.message || "")) ({ data, error } = await consulta(", datos_sanitarios"));   // sin el SQL 38
  if (error && /datos_sanitarios/.test(error.message || "")) ({ data, error } = await consulta(""));   // sin el SQL 31
  if (error) throw error;
  return data || [];
}

async function resolverSolicitudComercio(id, estado) {
  const { error } = await sb.from("solicitudes_comercio").update({ estado }).eq("id", id);
  if (error) throw error;
}

// =====================================================================
// CALIFICACIONES DE COMERCIOS (estrellas + opinión, estilo Google) · SQL 12
// Cualquiera las lee; para escribir hace falta cuenta (1 opinión por persona y comercio, editable).
// El dueño no puede calificarse; sí responder en público. Ver supabase/12_calificaciones.sql.
// =====================================================================
const MOTIVOS_REPORTE_CALIFICACION = {
  ofensivo: "Insultos u ofensas",
  falso: "Parece falsa o del propio negocio / competencia",
  datos: "Tiene datos personales (teléfono, dirección…)",
  spam: "Publicidad o spam",
  otro: "Otro motivo"
};

function filaACalificacion(r) {
  return {
    id: Number(r.id), comercioId: Number(r.comercio_id), usuarioId: r.usuario_id,
    autor: r.autor_nombre || "Usuario", estrellas: Number(r.estrellas) || 0,
    comentario: r.comentario || "", respuesta: r.respuesta || "", respuestaEn: r.respuesta_en || null,
    oculto: !!r.oculto, creado: r.creado_en, actualizado: r.actualizado_en || r.creado_en
  };
}

// Todas las visibles de un comercio (más la propia si estuviera oculta; un moderador ve todas)
async function cargarCalificaciones(comercioId) {
  const { data, error } = await sb.from("calificaciones_comercio").select("*")
    .eq("comercio_id", comercioId).order("creado_en", { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).map(filaACalificacion);
}

// Crea o actualiza MI opinión (id = la que ya tengo, si existe)
async function guardarCalificacion(comercioId, estrellas, comentario, id) {
  if (!usuarioActual) throw new Error("Inicia sesión para calificar");
  const datos = { estrellas, comentario: (comentario || "").trim() || null };
  const q = id
    ? sb.from("calificaciones_comercio").update(datos).eq("id", id).select().single()
    : sb.from("calificaciones_comercio").insert({ comercio_id: comercioId, ...datos }).select().single();
  const { data, error } = await q;
  if (error) {
    if (/duplicate|unique/i.test(error.message || "")) throw new Error("Ya calificaste este negocio: recarga la página para editar tu opinión");
    throw error;
  }
  return filaACalificacion(data);
}

async function borrarCalificacion(id) {
  const { error } = await sb.from("calificaciones_comercio").delete().eq("id", id);
  if (error) throw error;
}

// Respuesta pública del dueño (texto vacío = borrar la respuesta)
async function responderCalificacion(id, texto) {
  const { error } = await sb.rpc("responder_calificacion", { p_id: id, p_texto: texto || "" });
  if (error) throw error;
}

async function crearReporteCalificacion(calificacionId, motivo, detalle) {
  if (!usuarioActual) throw new Error("Inicia sesión para reportar");
  const { error } = await sb.from("reportes_calificacion").insert({ calificacion_id: calificacionId, motivo, detalle: detalle || null });
  if (error) {
    if (/duplicate|unique/i.test(error.message || "")) throw new Error("Ya reportaste esta opinión. Un moderador la revisará");
    throw error;
  }
}

// Solo moderadores
async function cargarReportesCalificacion(estado) {
  let q = sb.from("reportes_calificacion")
    .select("id, motivo, detalle, estado, creado_en, calificacion:calificaciones_comercio(id, comercio_id, autor_nombre, estrellas, comentario, oculto, comercio:comercios(id, nombre))")
    .order("creado_en", { ascending: false }).limit(200);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function resolverReporteCalificacion(id, estado) {
  const { error } = await sb.from("reportes_calificacion").update({ estado }).eq("id", id);
  if (error) throw error;
}

async function ocultarCalificacion(id, oculto) {
  const { error } = await sb.from("calificaciones_comercio").update({ oculto }).eq("id", id);
  if (error) throw error;
}

// ---------- Estrellas para mostrar (★★★★☆) ----------
function estrellasTexto(n) {
  const llenas = Math.round(Math.max(0, Math.min(5, n)));
  return "★".repeat(llenas) + "☆".repeat(5 - llenas);
}
// «⭐ 4,6 (23)» para tarjetas. Siempre muestra el promedio (transparencia, como Google).
function resumenCalifHTML(c) {
  const n = c.nCalif || 0;
  if (!n) return '<span class="text-slate-400 font-normal">☆☆☆☆☆ Sin opiniones aún</span>';
  return `<span class="text-amber-500" aria-hidden="true">${estrellasTexto(c.calif)}</span> <b class="text-slate-800">${String((c.calif || 0).toFixed(1)).replace(".", ",")}</b> <span class="text-slate-500 font-normal">(${n} ${n === 1 ? "opinión" : "opiniones"})</span>`;
}

// =====================================================================
// CONTACTO DE ANUNCIOS CON REGISTRO RÁPIDO · Fase 2S (SQL 13)
// Todos ven los anuncios, el mapa y «Compartir». Al tocar 💬 WhatsApp, 📞 Llamar o 🗺️ Cómo llegar
// sin cuenta, aparece la ventana de registro rápido; al terminar vuelve al mismo anuncio y
// muestra el botón para contactar. El número lo entrega la base de datos solo a personas con cuenta.
// Botones: <button data-contacto="whatsapp|llamar" data-anuncio="ID" data-nombre="...">
//          Cómo llegar: enlace con data-como-llegar + data-anuncio="ID" (ver utils.js).
// =====================================================================
const contactosCache = new Map();   // id → { whatsapp, telefono }

async function obtenerContactoAnuncio(id) {
  if (contactosCache.has(id)) return contactosCache.get(id);
  const { data, error } = await sb.rpc("contacto_anuncio", { p_id: id });
  if (error) throw new Error(mensajeError(error));
  const fila = Array.isArray(data) ? data[0] : data;
  const c = { whatsapp: (fila && fila.whatsapp) || "", telefono: (fila && fila.telefono) || "" };
  contactosCache.set(id, c);
  return c;
}

const ACCIONES_CONTACTO = {
  whatsapp: { verbo: "escribirle por WhatsApp", boton: "💬 Abrir WhatsApp del vendedor", clase: "bg-green-500 hover:bg-green-600" },
  llamar:   { verbo: "llamar al vendedor",      boton: "📞 Llamar al vendedor",          clase: "bg-sky-600 hover:bg-sky-700" },
  llegar:   { verbo: "ver cómo llegar",          boton: "🗺️ Ver cómo llegar",             clase: "bg-blue-500 hover:bg-blue-600" }
};

// Ejecuta la acción con el contacto ya obtenido. `ventana`: pestaña abierta antes del await (para que
// el navegador no la bloquee como ventana emergente).
function ejecutarContacto(accion, c, ctx, ventana) {
  if (accion === "whatsapp") {
    if (!c.whatsapp) { if (ventana) ventana.close(); mostrarToast("Este vendedor no tiene WhatsApp: usa 📞 Llamar", "error"); return; }
    const url = urlWhatsApp(c.whatsapp, ctx.nombre || "tu anuncio");
    if (ventana) ventana.location.href = url;
    else if (!window.open(url, "_blank", "noopener")) location.href = url;
  } else if (accion === "llamar") {
    if (ventana) ventana.close();
    if (!c.telefono) { mostrarToast("Este vendedor no tiene teléfono: usa 💬 WhatsApp", "error"); return; }
    location.href = "tel:" + c.telefono;
  } else if (accion === "llegar") {
    if (ventana) ventana.close();
    abrirComoLlegar({ lat: Number(ctx.lat), lng: Number(ctx.lng), nombre: ctx.nombre || "", aprox: ctx.aprox === "1",
                      ciudad: ctx.ciudad || "", whatsapp: c.whatsapp || "" });
  }
}

// Punto de entrada de los botones de contacto de un anuncio
async function contactarAnuncio(accion, ctx) {
  const id = Number(ctx.anuncio);
  if (!usuarioActual) { abrirRegistroRapido(accion, ctx); return; }
  if (contactosCache.has(id)) { ejecutarContacto(accion, contactosCache.get(id), ctx); return; }
  const ventana = accion === "whatsapp" ? window.open("about:blank", "_blank") : null;
  try {
    const c = await obtenerContactoAnuncio(id);
    ejecutarContacto(accion, c, ctx, ventana);
  } catch (err) {
    if (ventana) ventana.close();
    mostrarToast(err.message || "No se pudo obtener el contacto", "error");
  }
}

// Clics en botones de contacto (fase de captura: también funciona dentro de los popups del mapa)
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-contacto][data-anuncio]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  contactarAnuncio(b.dataset.contacto, { ...b.dataset });
}, true);

// ---------- Ventana de registro rápido ----------
let registroRapidoCtx = null;

function crearRegistroRapido() {
  if ($("modal-rapido")) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="modal-rapido" class="modal-fondo hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[260]" role="dialog" aria-modal="true" aria-labelledby="rr-titulo">
    <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[94vh] overflow-auto modal-enter">
      <button type="button" data-cerrar aria-label="Cerrar" class="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-700">&times;</button>
      <div id="rr-paso-form">
        <div class="text-center">
          <div class="text-4xl" aria-hidden="true">🔓</div>
          <h3 id="rr-titulo" class="text-xl font-black text-indigo-900 mt-1">Contacta gratis al vendedor</h3>
          <p id="rr-sub" class="text-sm text-slate-600 mt-1"></p>
          <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-green-700 mt-2">
            <span>✅ 100% gratis</span><span>✅ 30 segundos</span><span>✅ Sin tarjeta</span>
          </div>
        </div>
        <div class="mt-4" id="rr-google">${BOTON_GOOGLE_HTML}</div>
        <div class="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1" role="tablist">
          <button type="button" data-rr-modo="registro" role="tab" class="rr-tab py-2 rounded-lg text-sm font-bold">Crear cuenta</button>
          <button type="button" data-rr-modo="login" role="tab" class="rr-tab py-2 rounded-lg text-sm font-bold">Ya tengo cuenta</button>
        </div>
        <form id="rr-form" class="space-y-3 mt-4" novalidate>
          <div id="rr-campo-nombre">
            <label for="rr-nombre" class="block text-xs font-bold text-slate-500 mb-1">Tu nombre</label>
            <input id="rr-nombre" maxlength="40" autocomplete="given-name" placeholder="Ej.: Ana" class="w-full border border-slate-300 p-3 rounded-xl">
          </div>
          <div>
            <label for="rr-email" class="block text-xs font-bold text-slate-500 mb-1">Correo</label>
            <input id="rr-email" type="email" autocomplete="email" inputmode="email" placeholder="tu@correo.com" class="w-full border border-slate-300 p-3 rounded-xl">
          </div>
          <div>
            <label for="rr-pass" class="block text-xs font-bold text-slate-500 mb-1">Contraseña <span class="font-normal">(mínimo 6)</span></label>
            <div class="relative">
              <input id="rr-pass" type="password" minlength="6" autocomplete="new-password" placeholder="••••••" class="w-full border border-slate-300 p-3 pr-12 rounded-xl">
              <button type="button" id="rr-ver" aria-label="Mostrar contraseña" class="absolute right-2 top-1/2 -translate-y-1/2 text-lg px-2">👁️</button>
            </div>
          </div>
          <p id="rr-error" class="hidden text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert"></p>
          <button type="submit" id="rr-enviar" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl disabled:opacity-60"></button>
          <button type="button" id="rr-olvido" class="hidden w-full text-xs text-slate-500 hover:text-indigo-600 underline">¿Olvidaste tu contraseña?</button>
          <p id="rr-legal" class="text-[11px] text-slate-500 text-center">Al crear tu cuenta aceptas los <a href="terminos.html" target="_blank" class="underline text-indigo-600">Términos</a> y la <a href="privacidad.html" target="_blank" class="underline text-indigo-600">Política de privacidad</a> (Ley 1581).</p>
        </form>
        <p class="text-[11px] text-slate-400 text-center mt-3">🛡️ Pedimos cuenta para proteger a los vendedores de robots y estafas. Ver anuncios y compartirlos siempre es libre.</p>
      </div>
      <div id="rr-paso-listo" class="hidden text-center py-2">
        <div class="text-5xl" aria-hidden="true">🎉</div>
        <h3 class="text-xl font-black text-indigo-900 mt-2" id="rr-listo-titulo">¡Listo!</h3>
        <p class="text-sm text-slate-600 mt-1">Ya puedes contactar al vendedor.</p>
        <button type="button" id="rr-accion" class="w-full mt-4 text-white font-black py-3.5 rounded-xl"></button>
        <p class="text-[11px] text-slate-500 mt-3">Consejo: acuerda la entrega en un lugar público y revisa el producto antes de pagar.</p>
      </div>
      <div id="rr-paso-correo" class="hidden text-center py-2">
        <div class="text-5xl" aria-hidden="true">📧</div>
        <h3 class="text-xl font-black text-indigo-900 mt-2">Revisa tu correo</h3>
        <p class="text-sm text-slate-600 mt-1">Te enviamos un enlace a <b id="rr-correo-txt"></b>. Ábrelo y toca <b>«Confirmar»</b>: volverás a este anuncio y podrás contactar al vendedor.</p>
        <p class="text-[11px] text-slate-500 mt-3">¿No llega? Revisa la carpeta de spam o «Promociones».</p>
      </div>
    </div></div>`);
  let modo = "registro";
  const pintarModo = m => {
    modo = m;
    document.querySelectorAll(".rr-tab").forEach(t => {
      const activo = t.dataset.rrModo === m;
      t.classList.toggle("bg-white", activo); t.classList.toggle("shadow", activo);
      t.classList.toggle("text-indigo-700", activo); t.classList.toggle("text-slate-500", !activo);
      t.setAttribute("aria-selected", activo ? "true" : "false");
    });
    $("rr-campo-nombre").classList.toggle("hidden", m !== "registro");
    $("rr-legal").classList.toggle("hidden", m !== "registro");
    $("rr-olvido").classList.toggle("hidden", m === "registro");
    $("rr-pass").autocomplete = m === "registro" ? "new-password" : "current-password";
    $("rr-enviar").textContent = m === "registro" ? "Crear cuenta y continuar" : "Entrar y continuar";
    $("rr-error").classList.add("hidden");
  };
  $("modal-rapido").pintarModo = pintarModo;
  document.querySelectorAll(".rr-tab").forEach(t => t.addEventListener("click", () => pintarModo(t.dataset.rrModo)));
  $("rr-ver").addEventListener("click", () => {
    const p = $("rr-pass"); p.type = p.type === "password" ? "text" : "password";
    $("rr-ver").setAttribute("aria-label", p.type === "password" ? "Mostrar contraseña" : "Ocultar contraseña");
  });
  $("rr-olvido").addEventListener("click", async () => {
    const email = $("rr-email").value.trim().toLowerCase();
    if (!email) { errorRapido("Escribe tu correo y vuelve a tocar «¿Olvidaste tu contraseña?»"); return; }
    try { await recuperarPassword(email); mostrarToast("📧 Te enviamos un enlace para cambiar la contraseña"); }
    catch (err) { errorRapido(err.message); }
  });
  $("rr-form").addEventListener("submit", async e => {
    e.preventDefault();
    const nombre = $("rr-nombre").value.trim(), email = $("rr-email").value.trim().toLowerCase(), pass = $("rr-pass").value;
    if (modo === "registro" && nombre.length < 2) { errorRapido("Escribe tu nombre"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errorRapido("Escribe un correo válido"); return; }
    if (pass.length < 6) { errorRapido("La contraseña debe tener mínimo 6 caracteres"); return; }
    const btn = $("rr-enviar"); btn.disabled = true;
    try {
      if (modo === "registro") {
        const ctx = registroRapidoCtx || {};
        const volver = urlContactoPendiente(ctx);
        const { confirmar } = await registrarUsuario(email, pass, nombre, volver);
        if (confirmar) {
          $("rr-correo-txt").textContent = email;
          mostrarPasoRapido("correo");
          return;
        }
      } else {
        await iniciarSesion(email, pass);
      }
      await alEntrarRapido();
    } catch (err) {
      errorRapido(err.message || "No se pudo continuar");
    } finally { btn.disabled = false; }
  });
  $("rr-google").addEventListener("click", async e => {
    const b = e.target.closest("[data-google]");
    if (!b) return;
    b.disabled = true;
    try { await entrarConGoogle(urlContactoPendiente(registroRapidoCtx || {})); }   // vuelve al anuncio con el contacto pendiente
    catch (err) { errorRapido(err.message); b.disabled = false; }
  });
  $("rr-accion").addEventListener("click", () => {
    const ctx = registroRapidoCtx || {};
    const c = contactosCache.get(Number(ctx.anuncio));
    cerrarModal("modal-rapido");
    if (c) ejecutarContacto(ctx.accion, c, ctx);
    else contactarAnuncio(ctx.accion, ctx);
  });
}

function errorRapido(msg) { const p = $("rr-error"); p.textContent = msg; p.classList.remove("hidden"); }
function mostrarPasoRapido(paso) {
  ["form", "listo", "correo"].forEach(p => $("rr-paso-" + p).classList.toggle("hidden", p !== paso));
}

// Enlace al que vuelve la persona tras confirmar su correo: esta misma página + qué quería hacer
function urlContactoPendiente(ctx) {
  const u = new URL(location.href);
  u.hash = "";
  u.searchParams.set("contactar", ctx.accion || "whatsapp");
  u.searchParams.set("anuncio", ctx.anuncio || "");
  return u.toString();
}

function abrirRegistroRapido(accion, ctx) {
  crearRegistroRapido();
  registroRapidoCtx = { ...ctx, accion };
  const a = ACCIONES_CONTACTO[accion] || ACCIONES_CONTACTO.whatsapp;
  $("rr-sub").textContent = `Para ${a.verbo}${ctx.nombre ? " de «" + ctx.nombre + "»" : ""}, crea tu cuenta gratis o entra con la que ya tienes.`;
  $("rr-form").reset();
  $("rr-pass").type = "password";
  $("modal-rapido").pintarModo("registro");
  mostrarPasoRapido("form");
  abrirModal("modal-rapido");
  setTimeout(() => { try { $("rr-nombre").focus(); } catch (e) {} }, 50);
}

// Ya con sesión: trae el contacto y muestra el botón grande (un toque = abre WhatsApp/llamada sin bloqueos)
async function alEntrarRapido() {
  const ctx = registroRapidoCtx || {};
  document.dispatchEvent(new CustomEvent("sesion:cambio"));
  try { await obtenerContactoAnuncio(Number(ctx.anuncio)); }
  catch (err) { cerrarModal("modal-rapido"); mostrarToast(err.message, "error"); return; }
  const a = ACCIONES_CONTACTO[ctx.accion] || ACCIONES_CONTACTO.whatsapp;
  $("rr-listo-titulo").textContent = "¡Listo" + (usuarioActual && usuarioActual.nombre ? ", " + usuarioActual.nombre.split(" ")[0] : "") + "!";
  const b = $("rr-accion");
  b.textContent = a.boton;
  b.className = "w-full mt-4 text-white font-black py-3.5 rounded-xl " + a.clase;
  mostrarPasoRapido("listo");
}

// Al volver del correo de confirmación (…?contactar=whatsapp&anuncio=ID): muestra el botón para continuar.
// Cada página la llama cuando ya cargó la sesión.
async function revisarContactoPendiente(buscarAnuncio) {
  const p = new URLSearchParams(location.search);
  const accion = p.get("contactar"), id = parseInt(p.get("anuncio"), 10);
  if (!accion || !id || !ACCIONES_CONTACTO[accion]) return;
  const u = new URL(location.href); u.searchParams.delete("contactar"); u.searchParams.delete("anuncio");
  history.replaceState(null, "", u.pathname + u.search + u.hash);
  if (!usuarioActual) return;
  const a = (typeof buscarAnuncio === "function" ? buscarAnuncio(id) : null) || baseDatosAnuncios.find(x => x.id === id) || {};
  crearRegistroRapido();
  registroRapidoCtx = { accion, anuncio: String(id), nombre: a.nombre || "", lat: a.lat, lng: a.lng,
                        aprox: a.ubicacionAprox ? "1" : "0", ciudad: a.ciudad || "" };
  abrirModal("modal-rapido");
  await alEntrarRapido();
}

// =====================================================================
// DETALLES DE INMUEBLES Y VEHÍCULOS (fase 2Z.7 · supabase/23_detalles_anuncio.sql)
// Cada tipo de anuncio pide sus propios datos: no es lo mismo un carro, una moto o un apartamento.
// El tipo sale de la categoría + subcategoría. Todo se guarda en anuncios.detalles (jsonb).
// =====================================================================
const OPERACIONES = { venta: "Venta", arriendo: "Arriendo", arriendo_dias: "Arriendo por días" };
const SUBS_CARRO = ["carros", "camionetas", "camiones"];
const SUBS_SIN_HAB = ["locales_oficinas", "bodegas"];
const SUBS_VIVIENDA = ["apartamentos", "casas", "apartaestudios"];
const SUBS_ANIMAL = ["perros", "gatos", "conejos_roedores", "aves_ornato", "peces", "aves_corral", "animales_finca", "otros", ""];
const MARCAS_CARRO = ["Chevrolet", "Renault", "Mazda", "Kia", "Toyota", "Nissan", "Hyundai", "Ford", "Volkswagen", "Suzuki", "BYD", "Mitsubishi", "Mercedes-Benz", "BMW", "Jeep", "Fiat", "Peugeot", "Citroën", "Dodge", "JAC", "Foton", "Hino", "Isuzu"];
const MARCAS_MOTO = ["Yamaha", "Honda", "Suzuki", "AKT", "Bajaj", "Kawasaki", "TVS", "Hero", "Victory", "KTM", "Royal Enfield", "Kymco", "Auteco", "Benelli", "Ducati", "BMW"];

// "inmueble" | "carro" | "moto" | "repuesto" | "vehiculo" (otros) | null (sin campos extra)
function tipoDetalle(cat, sub) {
  if (cat === "inmuebles") return "inmueble";
  if (cat === "mascotas" && SUBS_ANIMAL.includes(sub || "")) return "mascota";   // fase 2AL
  if (cat === "adultos") return "adultos";
  if (cat === "autos" || cat === "motos") {
    if (SUBS_CARRO.includes(sub)) return "carro";
    if (sub === "motos" || (cat === "motos" && (!sub || sub === "motos"))) return "moto";
    if (sub === "repuestos" || sub === "repuestos_moto" || sub === "cascos_accesorios") return "repuesto";
    if (sub === "otros") return "vehiculo";
  }
  return null;
}

// Campos por tipo. ver/req reciben el contexto {sub, op, estado}.
// tipo: sel (opciones [valor, texto]) · num (min/max) · txt (max, lista = sugerencias) · si (casilla)
const ANIO_MAX = new Date().getFullYear() + 1;
const CAMPOS_DETALLE = {
  // Fase 2AL: la base de datos exige la declaración (supabase/39_reglas_prohibidos.sql)
  mascota: [
    { k: "declara_domestico", t: "Declaro que es un animal doméstico o de criadero (no silvestre ni protegido)", tipo: "si", req: () => true },
    { k: "certificado", t: "Certificado de zoocriadero (solo loros, guacamayas o pericos nativos)", tipo: "txt", max: 40, ver: x => x.sub === "aves_ornato" }
  ],
  adultos: [
    { k: "mayor18", t: "Confirmo que es un producto legal y que lo vendo solo a mayores de 18 años", tipo: "si", req: () => true }
  ],
  inmueble: [
    { k: "operacion", t: "¿Venta o arriendo?", tipo: "sel", op: Object.entries(OPERACIONES), req: () => true },
    { k: "habitaciones", t: "Habitaciones", tipo: "num", min: 0, max: 30, ver: x => !SUBS_SIN_HAB.includes(x.sub) && x.sub !== "habitaciones", req: x => SUBS_VIVIENDA.includes(x.sub) || !x.sub },
    { k: "banos", t: "Baños", tipo: "num", min: 0, max: 20, ver: x => x.sub !== "lotes_fincas", req: x => SUBS_VIVIENDA.includes(x.sub) || !x.sub },
    { k: "area", t: "Área (m²)", tipo: "num", min: 1, max: 10000000, req: x => x.sub === "lotes_fincas" },
    { k: "estrato", t: "Estrato", tipo: "sel", op: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]], ver: x => x.sub !== "lotes_fincas" },
    { k: "parqueadero", t: "Parqueadero", tipo: "sel", op: [["no", "No tiene"], ["moto", "De moto"], ["carro", "De carro"], ["comunal", "Comunal"], ["2+", "2 o más"]] },
    { k: "piso", t: "Piso", tipo: "num", min: 0, max: 80, ver: x => ["apartamentos", "apartaestudios", "locales_oficinas", "habitaciones"].includes(x.sub) },
    { k: "administracion", t: "Administración ($/mes)", tipo: "num", min: 0, max: 50000000, ver: x => x.sub !== "lotes_fincas" && x.sub !== "habitaciones" },
    { k: "requisitos", t: "Requisitos para arrendar", tipo: "txt", max: 80, lista: ["Fiador con finca raíz", "Póliza de arrendamiento", "Depósito", "Sin fiador"], ver: x => x.op === "arriendo" },
    { k: "amoblado", t: "Amoblado", tipo: "si", ver: x => x.sub !== "lotes_fincas" && x.sub !== "bodegas" },
    { k: "ascensor", t: "Ascensor", tipo: "si", ver: x => ["apartamentos", "apartaestudios", "locales_oficinas"].includes(x.sub) },
    { k: "mascotas", t: "Acepta mascotas", tipo: "si", ver: x => x.op !== "venta" && !SUBS_SIN_HAB.includes(x.sub) },
    { k: "servicios", t: "Servicios incluidos", tipo: "si", ver: x => x.op !== "venta" }
  ],
  carro: [
    { k: "operacion", t: "¿Venta o arriendo?", tipo: "sel", op: [["venta", "Venta"], ["arriendo", "Arriendo / alquiler"]], req: () => true },
    { k: "marca", t: "Marca", tipo: "txt", max: 30, lista: MARCAS_CARRO, req: () => true },
    { k: "modelo", t: "Modelo (año)", tipo: "num", min: 1950, max: ANIO_MAX, req: () => true },
    { k: "km", t: "Kilometraje", tipo: "num", min: 0, max: 3000000, ver: x => x.estado !== "nuevo", req: x => x.estado !== "nuevo" },
    { k: "transmision", t: "Transmisión", tipo: "sel", op: [["mecanica", "Mecánica"], ["automatica", "Automática"]] },
    { k: "combustible", t: "Combustible", tipo: "sel", op: [["gasolina", "Gasolina"], ["diesel", "Diésel"], ["hibrido", "Híbrido"], ["electrico", "Eléctrico"], ["gas", "Gas"]] },
    { k: "placa", t: "Último dígito de la placa", tipo: "sel", op: [..."0123456789"].map(n => [n, n]), ver: x => x.estado !== "nuevo" },
    { k: "matricula", t: "Ciudad de matrícula", tipo: "txt", max: 30, ver: x => x.estado !== "nuevo" },
    { k: "color", t: "Color", tipo: "txt", max: 20 },
    { k: "soat", t: "SOAT al día", tipo: "si", ver: x => x.estado !== "nuevo" },
    { k: "tecno", t: "Tecnomecánica al día", tipo: "si", ver: x => x.estado !== "nuevo" },
    { k: "unico_dueno", t: "Único dueño", tipo: "si", ver: x => x.estado !== "nuevo" }
  ],
  moto: [
    { k: "operacion", t: "¿Venta o arriendo?", tipo: "sel", op: [["venta", "Venta"], ["arriendo", "Arriendo / alquiler"]], req: () => true },
    { k: "marca", t: "Marca", tipo: "txt", max: 30, lista: MARCAS_MOTO, req: () => true },
    { k: "modelo", t: "Modelo (año)", tipo: "num", min: 1950, max: ANIO_MAX, req: () => true },
    { k: "cilindraje", t: "Cilindraje (cc)", tipo: "num", min: 49, max: 2500, req: () => true },
    { k: "km", t: "Kilometraje", tipo: "num", min: 0, max: 1000000, ver: x => x.estado !== "nuevo", req: x => x.estado !== "nuevo" },
    { k: "placa", t: "Último dígito de la placa", tipo: "sel", op: [..."0123456789"].map(n => [n, n]), ver: x => x.estado !== "nuevo" },
    { k: "matricula", t: "Ciudad de matrícula", tipo: "txt", max: 30, ver: x => x.estado !== "nuevo" },
    { k: "soat", t: "SOAT al día", tipo: "si", ver: x => x.estado !== "nuevo" },
    { k: "tecno", t: "Tecnomecánica al día", tipo: "si", ver: x => x.estado !== "nuevo" }
  ],
  repuesto: [
    { k: "compatible", t: "¿Para qué vehículo sirve?", tipo: "txt", max: 60 }
  ],
  vehiculo: [
    { k: "operacion", t: "¿Venta o arriendo?", tipo: "sel", op: [["venta", "Venta"], ["arriendo", "Arriendo / alquiler"]], req: () => true },
    { k: "marca", t: "Marca", tipo: "txt", max: 30 },
    { k: "modelo", t: "Modelo (año)", tipo: "num", min: 1950, max: ANIO_MAX },
    { k: "km", t: "Kilometraje", tipo: "num", min: 0, max: 3000000, ver: x => x.estado !== "nuevo" }
  ]
};
// Campos visibles para un anuncio (con su obligatoriedad ya calculada)
function camposDetalle(cat, sub, ctx) {
  const tipo = tipoDetalle(cat, sub);
  const x = { sub: sub || "", op: "", estado: "usado", ...(ctx || {}) };
  return (CAMPOS_DETALLE[tipo] || []).filter(c => !c.ver || c.ver(x)).map(c => ({ ...c, obligatorio: !!(c.req && c.req(x)) }));
}
// Deja solo los campos que corresponden, con el tipo correcto (números como número, casillas solo si están marcadas)
function limpiarDetalles(cat, sub, d) {
  d = d || {};
  const out = {};
  camposDetalle(cat, sub, { op: d.operacion || "", estado: d._estado || "usado" }).forEach(c => {
    const v = d[c.k];
    if (c.tipo === "si") { if (v === true) out[c.k] = true; return; }
    if (v === undefined || v === null || v === "") return;
    if (c.tipo === "num") { const n = Number(v); if (Number.isFinite(n) && n >= c.min && n <= c.max) out[c.k] = Math.round(n); return; }
    if (c.tipo === "sel") { if (c.op.some(([val]) => val === String(v))) out[c.k] = String(v); return; }
    out[c.k] = String(v).trim().slice(0, c.max || 60);
  });
  if (d.precio_tipo === "fijo" || d.precio_tipo === "negociable") out.precio_tipo = d.precio_tipo;   // fase 2AC: cualquier categoría
  return out;
}

const fmtMiles = n => Number(n).toLocaleString("es-CO");
// «/mes», «/noche» o «/día» según la operación (solo para mostrar)
function sufijoPrecio(a) {
  const op = (a.detalles || {}).operacion;
  if (op === "arriendo") return tipoDetalle(a.categoria, a.subcategoria) === "inmueble" ? "/mes" : "/día";
  if (op === "arriendo_dias") return "/noche";
  return "";
}
const precioConSufijo = a => a.precio ? a.precio + sufijoPrecio(a) : "";
// Lo más importante en pocas palabras (tarjetas): ["Arriendo", "3 hab", "2 baños", "72 m²"]
function resumenDetalles(a) {
  const d = a.detalles || {}, tipo = tipoDetalle(a.categoria, a.subcategoria);
  const r = [];
  if (d.operacion && tipo !== "repuesto") r.push(OPERACIONES[d.operacion] || d.operacion);
  if (tipo === "inmueble") {
    if (d.habitaciones != null) r.push(d.habitaciones + " hab");
    if (d.banos != null) r.push(d.banos + (d.banos === 1 ? " baño" : " baños"));
    if (d.area) r.push(fmtMiles(d.area) + " m²");
    if (d.estrato) r.push("Estrato " + d.estrato);
  } else if (tipo === "mascota") {
    if (d.declara_domestico) r.push("Doméstico o de criadero");
    if (d.certificado) r.push("Con certificado");
  } else if (tipo === "adultos") {
    r.push("+18");
  } else if (tipo) {
    if (d.marca) r.push(d.marca);
    if (d.modelo) r.push(String(d.modelo));
    if (d.cilindraje) r.push(d.cilindraje + " cc");
    if (d.km != null) r.push(fmtMiles(d.km) + " km");
    if (d.compatible) r.push("Para " + d.compatible);
  }
  return r;
}
// Todos los datos para la ficha del anuncio: [[título, valor], …]
function fichaDetalles(a) {
  const d = a.detalles || {};
  const nombres = { mecanica: "Mecánica", automatica: "Automática", gasolina: "Gasolina", diesel: "Diésel", hibrido: "Híbrido", electrico: "Eléctrico", gas: "Gas",
                    no: "No tiene", moto: "De moto", carro: "De carro", comunal: "Comunal", "2+": "2 o más" };
  return camposDetalle(a.categoria, a.subcategoria, { op: d.operacion || "", estado: a.estado }).filter(c => d[c.k] !== undefined && d[c.k] !== "").map(c => {
    let v = d[c.k];
    if (c.tipo === "si") v = "Sí";
    else if (c.k === "operacion") v = OPERACIONES[v] || v;
    else if (c.k === "km") v = fmtMiles(v) + " km";
    else if (c.k === "area") v = fmtMiles(v) + " m²";
    else if (c.k === "administracion") v = "$" + fmtMiles(v);
    else if (c.k === "cilindraje") v = v + " cc";
    else if (nombres[v]) v = nombres[v];
    return [c.t.replace(/^¿Venta o arriendo\?$/, "Operación"), String(v)];
  });
}
// Aviso contra las estafas más comunes de cada tipo
function avisoFraude(a) {
  const tipo = tipoDetalle(a.categoria, a.subcategoria);
  if (tipo === "inmueble") return "🏠 <b>Nunca consignes dinero antes de visitar el inmueble</b> y de confirmar que quien lo ofrece es el dueño o una inmobiliaria real (pide el certificado de tradición y libertad). Desconfía de arriendos muy baratos con «mucha demanda».";
  if (tipo === "carro" || tipo === "moto" || tipo === "vehiculo") return "🚗 <b>No des anticipos para «separar» el vehículo.</b> Revísalo en persona, consulta la placa en el <b>RUNT</b> (multas, prendas, SOAT) y haz el traspaso en el tránsito antes de pagar el total.";
  return "";
}

// =====================================================================
// LA COMUNIDAD CONFIRMA COMERCIOS + «ACELERAR MI VERIFICACIÓN» (fase 2Z.10 · supabase/25_confirmaciones_comercio.sql)
// =====================================================================
const UMBRAL_CONFIRMADO = 3, UMBRAL_DUDOSO = 2;
// «👥 Confirmado por N vecinos»: 3+ dicen que existe y al menos 1 estaba en el lugar
const confirmadoPorVecinos = c => c && c.confirmaSi >= UMBRAL_CONFIRMADO && c.confirmaLugar >= 1;
// «algunos dicen que ya no está»: 2+ y más «no» que «sí» (nunca se oculta solo)
const comercioDudoso = c => c && c.confirmaNo >= UMBRAL_DUDOSO && c.confirmaNo >= c.confirmaSi;
// ¿Le preguntamos a la gente? Los «Ubicado» siempre; los verificados, si el sello tiene más de 6 meses
const pedirConfirmacion = c => c && c.activo && (c.nivel < 2 || (c.verificadoEn && Date.now() - new Date(c.verificadoEn).getTime() > 180 * 864e5));
const sinTablaConfirmaciones = e => /confirmaciones_comercio|solicitudes_verificacion|does not exist|schema cache/i.test((e && e.message) || "");

async function miConfirmacion(comercioId) {
  if (!usuarioActual) return null;
  const { data, error } = await sb.from("confirmaciones_comercio").select("id, voto, en_lugar, creado_en")
    .eq("comercio_id", comercioId).eq("usuario_id", usuarioActual.id).maybeSingle();
  if (error) { if (!sinTablaConfirmaciones(error)) console.warn("confirmación:", error); return null; }
  return data || null;
}
async function contarMisConfirmaciones() {
  if (!usuarioActual) return 0;
  const { count, error } = await sb.from("confirmaciones_comercio").select("id", { count: "exact", head: true }).eq("usuario_id", usuarioActual.id);
  return error ? 0 : (count || 0);
}
// Ubicación rápida (máx. 6 s) para saber si la persona está en el lugar; sin permiso → null
function posicionRapida() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    const t = setTimeout(() => res(null), 6500);
    navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(t); res(null); }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 });
  });
}
// Vota «existe» / «no_existe». Devuelve el comercio con los totales nuevos (si se pueden leer).
async function confirmarComercio(c, voto) {
  if (!usuarioActual) throw new Error("Inicia sesión para confirmar comercios");
  const pos = tieneCoords(c) ? await posicionRapida() : null;
  // Los que atienden desde casa tienen el punto corrido: el radio es más amplio
  const enLugar = !!(pos && distanciaKm(pos, c) <= (esUbicacionAprox(c) ? 0.45 : 0.15));
  const previo = await miConfirmacion(c.id);
  const fila = { comercio_id: c.id, voto, en_lugar: enLugar };
  const { error } = previo
    ? await sb.from("confirmaciones_comercio").update(fila).eq("id", previo.id)
    : await sb.from("confirmaciones_comercio").insert(fila);
  if (error) {
    if (sinTablaConfirmaciones(error)) throw new Error("Esta opción se activa pronto. ¡Gracias por querer ayudar!");
    throw error;
  }
  const { data } = await sb.from("comercios").select("*").eq("id", c.id).maybeSingle();
  return { comercio: data ? filaAComercio(data) : c, enLugar };
}

// ---- Dueño: «⚡ Acelerar mi verificación» → que me llamen ----
const FRANJAS = { manana: "en la mañana (8–12)", tarde: "en la tarde (12–6)", noche: "en la noche (6–8)" };
async function ultimaSolicitudVerificacion(comercioId) {
  const { data, error } = await sb.from("solicitudes_verificacion").select("id, franja, estado, creado_en")
    .eq("comercio_id", comercioId).order("creado_en", { ascending: false }).limit(1);
  if (error) return null;
  return (data || [])[0] || null;
}
async function pedirLlamadaVerificacion(comercioId, franja, telefono) {
  const { error } = await sb.from("solicitudes_verificacion").insert({ comercio_id: comercioId, franja, telefono: String(telefono).replace(/[^\d+ ]/g, "").trim() });
  if (error) {
    if (sinTablaConfirmaciones(error)) throw new Error("Esta opción se activa pronto. Mientras tanto te contactaremos al número de tu negocio.");
    throw error;
  }
}
// Caja del botón (Mi tienda y la ficha del dueño). cont = elemento donde se dibuja.
function pintarAcelerar(cont, c) {
  if (!cont || !c || c.nivel >= 2 || !c.activo) { if (cont) cont.innerHTML = ""; return; }
  const tel = (c.whatsapp || "").replace(/^57/, "") || String(c.telefono || "").replace(/[^\d]/g, "");
  cont.innerHTML = `<div class="acelerar mt-2">
    <button type="button" data-acel-abrir class="btn-acelerar">⚡ Acelerar mi verificación</button>
    <form data-acel-form class="hidden mt-2 space-y-2 text-sm">
      <p class="text-xs text-slate-600">Un moderador te llama para confirmar el nombre y la dirección (2 minutos). Tu pedido pasa al <b>primer lugar de la fila</b>.</p>
      <label class="block text-xs font-bold text-slate-600">¿Cuándo te llamamos?
        <select data-acel-franja class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg bg-white font-normal">${Object.entries(FRANJAS).map(([k, t]) => `<option value="${k}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></label>
      <label class="block text-xs font-bold text-slate-600">Número para llamarte
        <input data-acel-tel inputmode="tel" maxlength="20" required value="${esc(tel)}" placeholder="300 123 4567" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal"></label>
      <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg">📞 Que me llamen</button>
    </form>
    <p data-acel-estado class="hidden text-xs mt-2"></p>
  </div>`;
  const $$ = s => cont.querySelector(s);
  const mostrarEstado = sol => {
    if (!sol || sol.estado !== "pendiente") return false;
    $$("[data-acel-abrir]").classList.add("hidden"); $$("[data-acel-form]").classList.add("hidden");
    const e = $$("[data-acel-estado]");
    e.innerHTML = `✅ <b>Ya pediste que te llamemos</b> ${esc(FRANJAS[sol.franja] || "")}. Tu negocio está de primero en la fila.`;
    e.className = "text-xs mt-2 bg-green-50 border border-green-200 text-green-900 rounded-lg px-3 py-2";
    return true;
  };
  ultimaSolicitudVerificacion(c.id).then(mostrarEstado);
  $$("[data-acel-abrir]").addEventListener("click", () => $$("[data-acel-form]").classList.toggle("hidden"));
  $$("[data-acel-form]").addEventListener("submit", async ev => {
    ev.preventDefault();
    const tel2 = $$("[data-acel-tel]").value.replace(/\D/g, "");
    if (tel2.length < 7) { mostrarToast("Escribe un número para llamarte", "error"); return; }
    const b = ev.target.querySelector("button[type=submit]"); b.disabled = true;
    try {
      await pedirLlamadaVerificacion(c.id, $$("[data-acel-franja]").value, tel2);
      mostrarEstado({ estado: "pendiente", franja: $$("[data-acel-franja]").value });
      mostrarToast("⚡ ¡Listo! Te llamaremos " + FRANJAS[$$("[data-acel-franja]").value]);
    } catch (err) { mostrarToast(mensajeError(err), "error"); b.disabled = false; }
  });
}

// ---- Moderadores ----
async function cargarSolicitudesVerificacion() {
  const { data, error } = await sb.from("solicitudes_verificacion")
    .select("id, comercio_id, franja, telefono, estado, creado_en, comercio:comercios(id, nombre, municipio_id, nivel_verificacion, confirma_si, confirma_no, confirma_lugar)")
    .eq("estado", "pendiente").order("creado_en", { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}
async function atenderSolicitudVerificacion(id) {
  const { error } = await sb.from("solicitudes_verificacion").update({ estado: "atendida" }).eq("id", id);
  if (error) throw error;
}
// Comercios sin verificar con señales de la comunidad (los que más «sí» tienen primero; luego los dudosos)
async function cargarSenalesComunidad() {
  const { data, error } = await sb.from("comercios").select("*").lt("nivel_verificacion", 2)
    .or(`confirma_si.gte.${UMBRAL_CONFIRMADO},confirma_no.gte.${UMBRAL_DUDOSO}`).order("confirma_si", { ascending: false }).limit(60);
  if (error) throw error;
  return (data || []).map(filaAComercio);
}


// ---- «🧭 ¿Lo encontraste?» en cualquier página (fase 2Z.10b) ----
// Cuando alguien toca «Cómo llegar», WhatsApp o Llamar de un comercio (directorio, mapa, ficha o inicio),
// se anota la visita. Al volver a la página (o abrir otra) 1 minuto y medio después, sale arriba una franja pequeña:
// «¿Encontraste «X»? ✅ Sí, existe / ❌ No estaba». Se puede cerrar y no vuelve a preguntar por ese comercio.
const CLAVE_VISITAS = "mf_visitas_com";
function leerVisitas() { try { return JSON.parse(localStorage.getItem(CLAVE_VISITAS) || "[]"); } catch (e) { return []; } }
function guardarVisitas(l) { try { localStorage.setItem(CLAVE_VISITAS, JSON.stringify(l.slice(-15))); } catch (e) { /* sin almacenamiento */ } }
function registrarVisitaComercio(c) {
  if (!c || !c.id) return;
  const l = leerVisitas().filter(v => v.id !== c.id);
  l.push({ id: c.id, n: c.nombre, lat: c.lat, lng: c.lng, m: c.modoAtencion || "local", o: c.ownerId || null, t: Date.now() });
  guardarVisitas(l);
}
function olvidarVisita(id) { guardarVisitas(leerVisitas().filter(v => v.id !== id)); }
// Visita pendiente de preguntar: entre 2 minutos y 3 días, la más reciente
function visitaPorPreguntar(excluirId) {
  const ahora = Date.now();
  const l = leerVisitas().filter(v => ahora - v.t > 90000 && ahora - v.t < 3 * 864e5 && v.id !== excluirId && (v.pr || 0) < 2
    && !(usuarioActual && v.o && v.o === usuarioActual.id));
  return l.length ? l[l.length - 1] : null;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-fui]");
  if (!b) return;
  const id = Number(b.dataset.fui);
  const c = (typeof comercios !== "undefined" && comercios.find(x => x.id === id)) || (typeof tienda !== "undefined" && tienda && tienda.id === id ? tienda : null);
  if (c) registrarVisitaComercio(c);
}, true);

function preguntarLoEncontraste() {
  if (document.getElementById("lo-encontraste")) return;
  const excluir = (typeof tienda !== "undefined" && tienda) ? tienda.id : null;   // en su ficha pregunta la tarjeta de la ficha
  const v = visitaPorPreguntar(excluir);
  if (!v) return;
  try { if (sessionStorage.getItem("mf_le_" + v.id)) return; sessionStorage.setItem("mf_le_" + v.id, "1"); } catch (e) { /* nada */ }
  // Se cuenta cuántas veces se preguntó: si se ignora 2 veces, no se vuelve a preguntar
  guardarVisitas(leerVisitas().map(x => x.id === v.id ? Object.assign(x, { pr: (x.pr || 0) + 1 }) : x));
  document.body.insertAdjacentHTML("beforeend", `<div id="lo-encontraste" class="lo-encontraste" role="dialog" aria-label="¿Lo encontraste?">
    <p class="le-texto">🧭 ¿Encontraste <b>${esc(v.n)}</b>?</p>
    <div class="le-botones">
      <button type="button" data-le="existe" class="btn-conf si">✅ Sí</button>
      <button type="button" data-le="no_existe" class="btn-conf no">❌ No estaba</button>
      <button type="button" data-le="cerrar" class="le-cerrar" aria-label="Cerrar">✕</button>
    </div></div>`);
  const caja = document.getElementById("lo-encontraste");
  // No molesta: se va sola a los 25 segundos si no la tocas
  let tocada = false;
  caja.addEventListener("pointerdown", () => { tocada = true; });
  setTimeout(() => { if (!tocada && caja.isConnected) { caja.classList.add("saliendo"); setTimeout(() => caja.remove(), 400); } }, 25000);
  caja.addEventListener("click", async e => {
    const b = e.target.closest("[data-le]");
    if (!b) return;
    if (b.dataset.le === "cerrar") { olvidarVisita(v.id); caja.remove(); return; }
    if (!usuarioActual) {
      mostrarToast("Crea tu cuenta gratis (1 minuto) para ayudar a tus vecinos");
      if (document.getElementById("modal-auth") && typeof abrirModal === "function") { abrirModal("modal-auth"); return; }
      try { sessionStorage.setItem("mf_volver", location.pathname.split("/").pop() + location.search); } catch (er) { /* nada */ }
      setTimeout(() => { location.href = "index.html#login"; }, 1100);
      return;
    }
    caja.querySelectorAll("[data-le]").forEach(x => { x.disabled = true; });
    try {
      await confirmarComercio({ id: v.id, nombre: v.n, lat: v.lat, lng: v.lng, modoAtencion: v.m }, b.dataset.le);
      olvidarVisita(v.id);
      caja.innerHTML = '<p class="le-texto font-bold text-green-800">🙌 ¡Gracias por ayudar a tus vecinos!</p>';
      setTimeout(() => caja.remove(), 2500);
    } catch (err) {
      // Si ya había opinado, no se vuelve a preguntar
      if (/30 días|duplicate|ya diste/i.test(err.message || "")) { olvidarVisita(v.id); caja.remove(); mostrarToast("Ya habías dado tu opinión sobre este comercio. ¡Gracias!"); return; }
      mostrarToast(mensajeError(err), "error");
      caja.querySelectorAll("[data-le]").forEach(x => { x.disabled = false; });
    }
  });
}
// Al abrir la página y al volver a ella (por ejemplo, desde Google Maps o WhatsApp)
document.addEventListener("DOMContentLoaded", () => setTimeout(preguntarLoEncontraste, 2500));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(preguntarLoEncontraste, 800); });

// ---- Foto: «📷 Tomar foto» o «🖼️ Galería» (fase 2AA.1) ----
// Dos <input type=file> con el mismo data-grupo-foto; se usa el último que se eligió.
document.addEventListener("change", e => {
  const el = e.target;
  if (!el || el.type !== "file" || !el.dataset.grupoFoto) return;
  if (!el.files || !el.files[0]) return;                    // canceló: se conserva la que había
  el.dataset.t = String(Date.now());
  const raiz = el.closest("[data-id]") || document;
  const aviso = raiz.querySelector(`[data-foto-nombre="${el.dataset.grupoFoto}"]`);
  if (aviso) aviso.textContent = "✅ Foto lista: " + el.files[0].name;
}, true);
// El archivo elegido más recientemente en un grupo (dentro de «raiz»), o null
function fotoElegida(grupo, raiz) {
  const els = [...(raiz || document).querySelectorAll(`input[type=file][data-grupo-foto="${grupo}"]`)].filter(x => x.files && x.files[0]);
  els.sort((a, b) => (Number(b.dataset.t) || 0) - (Number(a.dataset.t) || 0));
  return els.length ? els[0].files[0] : null;
}
function limpiarFoto(grupo, raiz) {
  (raiz || document).querySelectorAll(`input[type=file][data-grupo-foto="${grupo}"]`).forEach(x => { x.value = ""; delete x.dataset.t; });
  const aviso = (raiz || document).querySelector(`[data-foto-nombre="${grupo}"]`);
  if (aviso) aviso.textContent = "";
}

// =====================================================================
// VISOR DE FOTOS A PANTALLA COMPLETA (fase 2AA.4) — comercios y productos
// Toca una foto → se ve ENTERA (sin recortar). ‹ › o deslizar para cambiar; tocar, ✕ o Esc para cerrar.
// =====================================================================
let visorFotos = { lista: [], i: 0, titulo: "" };
function abrirVisorFotos(lista, i, titulo) {
  const fotos = (lista || []).map(urlSegura).filter(Boolean);
  if (!fotos.length) return;
  visorFotos = { lista: fotos, i: Math.max(0, Math.min(i || 0, fotos.length - 1)), titulo: titulo || "" };
  let v = document.getElementById("visor-fotos");
  if (!v) {
    document.body.insertAdjacentHTML("beforeend", `<div id="visor-fotos" class="visor-fotos hidden" role="dialog" aria-modal="true" aria-label="Foto ampliada">
      <button type="button" data-vf="cerrar" class="vf-cerrar" aria-label="Cerrar foto">&times;</button>
      <button type="button" data-vf="ant" class="vf-flecha vf-ant" aria-label="Foto anterior">&#8249;</button>
      <img id="vf-img" alt="" draggable="false">
      <button type="button" data-vf="sig" class="vf-flecha vf-sig" aria-label="Foto siguiente">&#8250;</button>
      <p id="vf-pie" class="vf-pie"></p></div>`);
    v = document.getElementById("visor-fotos");
    v.addEventListener("click", e => {
      const b = e.target.closest("[data-vf]");
      if (b && b.dataset.vf === "ant") { moverVisor(-1); return; }
      if (b && b.dataset.vf === "sig") { moverVisor(1); return; }
      cerrarVisorFotos();
    });
    let x0 = null;   // deslizar con el dedo
    v.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    v.addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { e.preventDefault(); moverVisor(dx < 0 ? 1 : -1); }
    });
    document.addEventListener("keydown", e => {
      if (document.getElementById("visor-fotos").classList.contains("hidden")) return;
      if (e.key === "Escape") { e.stopImmediatePropagation(); cerrarVisorFotos(); }
      if (e.key === "ArrowRight") moverVisor(1);
      if (e.key === "ArrowLeft") moverVisor(-1);
    }, true);
  }
  v.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  pintarVisor();
}
function moverVisor(d) { const n = visorFotos.lista.length; visorFotos.i = (visorFotos.i + d + n) % n; pintarVisor(); }
function pintarVisor() {
  const { lista, i, titulo } = visorFotos;
  const img = document.getElementById("vf-img");
  img.src = lista[i]; img.alt = (titulo ? titulo + " - " : "") + "foto " + (i + 1);
  document.querySelectorAll("#visor-fotos .vf-flecha").forEach(b => b.classList.toggle("hidden", lista.length < 2));
  document.getElementById("vf-pie").textContent = (titulo ? titulo + " · " : "") + (lista.length > 1 ? (i + 1) + " de " + lista.length : "");
}
function cerrarVisorFotos() {
  const v = document.getElementById("visor-fotos");
  if (v) v.classList.add("hidden");
  if (!document.querySelector(".modal-fondo:not(.hidden)")) document.body.style.overflow = "";
}

// =====================================================================
// GESTOR DE FOTOS DE UN COMERCIO (fase 2AA.4): hasta 5, la primera es la portada
// Uso: const g = gestorFotos(contenedor, fotosActuales); … const urls = await g.subir();
// =====================================================================
const MAX_FOTOS_COMERCIO = 5;
function gestorFotos(cont, iniciales, alCambiar, max) {
  const MAX = max || MAX_FOTOS_COMERCIO;
  let items = (iniciales || []).filter(Boolean).slice(0, MAX).map(url => ({ url }));
  let cambiado = false;
  const grupo = "gf" + Math.random().toString(36).slice(2, 7);
  function pintar() {
    cont.innerHTML = `<div class="gf-grid">${items.map((it, i) => `<div class="gf-item" data-gf="${i}">
        <img src="${esc(it.data || urlSegura(it.url))}" alt="Foto ${i + 1}" data-gf-ver="${i}">
        ${i === 0 ? '<span class="gf-portada">Portada</span>' : ""}
        <div class="gf-acciones">
          ${i > 0 ? `<button type="button" data-gf-mover="-1" aria-label="Mover a la izquierda">◀</button>` : ""}
          ${i > 0 ? `<button type="button" data-gf-portada aria-label="Usar como portada" title="Usar como portada">★</button>` : ""}
          ${i < items.length - 1 ? `<button type="button" data-gf-mover="1" aria-label="Mover a la derecha">▶</button>` : ""}
          <button type="button" data-gf-quitar aria-label="Quitar foto" class="gf-quitar">✕</button>
        </div></div>`).join("")}</div>
      ${items.length < MAX ? `<span class="foto-botones mt-2">
        <label class="foto-btn"><input type="file" data-gf-nueva accept="image/*" capture="environment" class="sr-only">📷 Tomar foto</label>
        <label class="foto-btn"><input type="file" data-gf-nueva accept="image/*" multiple class="sr-only">🖼️ Galería</label>
      </span>` : ""}
      <p class="text-[11px] text-slate-500 mt-1">${items.length} de ${MAX} fotos. La primera es la <b>portada</b>; toca una foto para verla en grande.</p>`;
  }
  function cambio() { cambiado = true; pintar(); if (alCambiar) alCambiar(); }
  cont.addEventListener("click", e => {
    const ver = e.target.closest("[data-gf-ver]");
    if (ver) { abrirVisorFotos(items.map(it => it.data || it.url), Number(ver.dataset.gfVer)); return; }
    const box = e.target.closest("[data-gf]");
    if (!box) return;
    const i = Number(box.dataset.gf);
    if (e.target.closest("[data-gf-quitar]")) { items.splice(i, 1); cambio(); return; }
    if (e.target.closest("[data-gf-portada]")) { items.unshift(items.splice(i, 1)[0]); cambio(); return; }
    const m = e.target.closest("[data-gf-mover]");
    if (m) { const j = i + Number(m.dataset.gfMover); [items[i], items[j]] = [items[j], items[i]]; cambio(); }
  });
  cont.addEventListener("change", async e => {
    const inp = e.target.closest("[data-gf-nueva]");
    if (!inp || !inp.files || !inp.files.length) return;
    const archivos = [...inp.files].slice(0, MAX - items.length);
    for (const f of archivos) {
      try { items.push({ data: await comprimir(f) }); } catch (err) { mostrarToast("No se pudo leer una imagen", "error"); }
    }
    if ([...inp.files].length > archivos.length) mostrarToast("Máximo " + MAX + " fotos", "error");
    cambio();
  });
  pintar();
  return {
    get cambiado() { return cambiado; },
    get cantidad() { return items.length; },
    // Sube las nuevas (en orden) y devuelve la lista final de URLs
    async subir() {
      const nuevas = items.filter(it => it.data);
      const urls = nuevas.length ? await subirFotos(nuevas.map(it => it.data)) : [];
      nuevas.forEach((it, k) => { it.url = urls[k]; delete it.data; });
      return items.map(it => it.url).filter(Boolean);
    }
  };
}


// =====================================================================
// LOGO DE LA PÁGINA (fase 2AF, supabase/35_logos_pagina.sql)
// =====================================================================
const LOGO_RESPALDO = { nombre: "Oficial", imagen_url: "img/logo-merkap.png", oficial: true, recortar: false, animar: true, activo: true };
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
// ¿Cuál se ve hoy? 1) el marcado «usar ahora» · 2) uno de temporada vigente (el de rango más corto) · 3) el oficial
function logoVigente(lista, hoy) {
  hoy = hoy || hoyLocal();
  const act = (lista || []).filter(l => l.activo !== false && l.imagen_url);
  const ahora = act.find(l => l.usar_ahora);
  if (ahora) return ahora;
  const largo = l => (Date.parse(l.hasta || "2999-12-31") - Date.parse(l.desde || "2000-01-01"));
  const temporada = act.filter(l => !l.oficial && (l.desde || l.hasta) && (!l.desde || l.desde <= hoy) && (!l.hasta || l.hasta >= hoy))
    .sort((a, b) => largo(a) - largo(b))[0];
  return temporada || act.find(l => l.oficial) || LOGO_RESPALDO;
}
async function cargarLogosPagina() {
  const { data, error } = await sb.from("logos_pagina").select("*").order("oficial", { ascending: false }).order("desde", { ascending: true }).order("id");
  if (error) throw error;
  return data || [];
}
async function actualizarLogoPagina() {
  try {
    const l = logoVigente(await cargarLogosPagina());
    try { localStorage.setItem("mf_logo", JSON.stringify({ imagen_url: l.imagen_url, recortar: l.recortar, animar: l.animar })); } catch (e) {}
    aplicarLogoPagina(l);
    return l;
  } catch (e) { return null; }   // sin el SQL 35: queda el oficial
}
async function guardarLogoPagina(fila) {
  const { id, ...resto } = fila;
  const q = id ? sb.from("logos_pagina").update(resto).eq("id", id) : sb.from("logos_pagina").insert(resto);
  const { error } = await q;
  if (error) throw error;
}
async function borrarLogoPagina(id) {
  const { error } = await sb.from("logos_pagina").delete().eq("id", id);
  if (error) throw error;
}
// Fase 2AG: vitrina gratis = 10 productos (cada tienda trae su cupo en comercios.limite_productos; el servidor lo hace cumplir)
const LIMITE_PRODUCTOS_GRATIS = 10;
// Fase 2AG: si la imagen trae fondo blanco o gris claro (típico de logos hechos con IA), se vuelve transparente.
// Solo se borra el fondo que TOCA los bordes: el blanco de adentro (ej. el ✔ del logo) se conserva.
function quitarFondoClaro(ctx, w, h) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  const claro = i => d[i + 3] > 200 && Math.min(d[i], d[i + 1], d[i + 2]) > 205 && (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) < 28;
  const esquinas = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4].filter(claro).length;
  if (esquinas < 3) return false;                       // ya es transparente o el fondo no es claro: no se toca
  const fondo = new Uint8Array(w * h), cola = new Int32Array(w * h);
  let ini = 0, fin = 0;
  const meter = p => { if (!fondo[p] && claro(p * 4)) { fondo[p] = 1; cola[fin++] = p; } };
  for (let x = 0; x < w; x++) { meter(x); meter((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { meter(y * w); meter(y * w + w - 1); }
  while (ini < fin) {
    const p = cola[ini++], x = p % w, y = (p - x) / w;
    if (x > 0) meter(p - 1); if (x < w - 1) meter(p + 1); if (y > 0) meter(p - w); if (y < h - 1) meter(p + w);
  }
  for (let p = 0; p < w * h; p++) {
    if (fondo[p]) { d[p * 4 + 3] = 0; continue; }
    // borde suave: un píxel claro pegado al fondo queda semitransparente
    const x = p % w, y = (p - x) / w;
    const vecino = (x > 0 && fondo[p - 1]) || (x < w - 1 && fondo[p + 1]) || (y > 0 && fondo[p - w]) || (y < h - 1 && fondo[p + w]);
    if (vecino) { const m = Math.min(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); if (m > 170) d[p * 4 + 3] = Math.round(255 * (255 - m) / 85); }
  }
  ctx.putImageData(im, 0, 0);
  return true;
}
// Recorta lo transparente que sobra alrededor y deja la imagen cuadrada y centrada
function recortarTransparente(c) {
  const ctx = c.getContext("2d"), { width: w, height: h } = c, d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return c;
  const lado = Math.max(x1 - x0 + 1, y1 - y0 + 1), n = document.createElement("canvas");
  n.width = n.height = lado;
  n.getContext("2d").drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.round((lado - (x1 - x0 + 1)) / 2), Math.round((lado - (y1 - y0 + 1)) / 2), x1 - x0 + 1, y1 - y0 + 1);
  return n;
}
// Prepara la imagen subida: quita el fondo claro, recorta lo sobrante, máx. 512 px, conserva la transparencia (WebP o PNG)
function prepararImagenLogo(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechazar(new Error("Ese archivo no es una imagen válida"));
      img.onload = () => {
        const k = Math.min(1, 512 / Math.max(img.width, img.height));
        let c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const sinFondo = quitarFondoClaro(ctx, c.width, c.height);
        c = recortarTransparente(c);
        let url = c.toDataURL("image/webp", 0.92);
        if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
        resolver({ dataUrl: url, ancho: c.width, alto: c.height, sinFondo });
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
if (typeof sb !== "undefined" && sb) actualizarLogoPagina();

// =====================================================================
// +18, LEYENDAS LEGALES Y «PEDIR REVISIÓN» (fase 2AL)
// =====================================================================
const esAdultos = a => !!a && a.categoria === "adultos";
const esLicorAnuncio = a => !!a && ((a.categoria === "tienda" && a.subcategoria === "licores") || RX_LICOR.test(a.nombre || ""));   // solo el título: «vino» también es verbo
const RX_LICOR = /\b(aguardiente|ron|whisky|whiskey|vodka|tequila|cervezas?|vinos?|licor(es)?|ginebra|brandy|champa(n|ña)|viche|chirrinchi|sangr[ií]a|c[oó]cteles?|mezcal|guaro)\b/i;
const RX_TABACO = /\b(cigarrill\w*|tabacos?|vapes?|vapeador\w*|hookah|narguil\w*|elf ?bar|pods? desechables?|puffs)\b/i;
const LEYENDA_ALCOHOL = "🔞 Venta solo a mayores de 18 años. Prohíbese el expendio de bebidas embriagantes a menores de edad. El exceso de alcohol es perjudicial para la salud.";
const LEYENDA_TABACO = "🔞 Venta solo a mayores de 18 años. Fumar y vapear perjudican tu salud.";
const LEYENDA_ADULTOS = "🔞 Producto para mayores de 18 años. Merkap no permite servicios sexuales ni contenido con menores.";
const TIPOS_MAS18 = ["intimo", "licorera"];
function mayorConfirmado() { try { return localStorage.getItem("mf_18") === "1"; } catch (e) { return false; } }
function marcarMayor() {
  try { localStorage.setItem("mf_18", "1"); } catch (e) { /* nada */ }
  document.documentElement.dataset.mas18 = "1";
}
// Pregunta «¿Eres mayor de 18?» (como Rappi). Devuelve una promesa true/false.
function confirmarMayorDeEdad(texto) {
  if (mayorConfirmado()) { document.documentElement.dataset.mas18 = "1"; return Promise.resolve(true); }
  return new Promise(ok => {
    const v = document.createElement("div");
    v.id = "modal-18"; v.className = "modal-18"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true");
    v.innerHTML = `<div class="modal-18-caja"><p class="text-4xl">🔞</p><h2 class="text-lg font-black text-slate-900 mt-1">¿Eres mayor de 18 años?</h2>
      <p class="text-sm text-slate-600 mt-1">${esc(texto || "Este contenido es solo para mayores de edad.")}</p>
      <div class="flex gap-2 justify-center mt-4"><button type="button" data-18="si" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl">Sí, soy mayor de 18</button>
      <button type="button" data-18="no" class="bg-white border border-slate-300 font-semibold px-5 py-2.5 rounded-xl">No</button></div></div>`;
    document.body.appendChild(v);
    v.addEventListener("click", e => {
      const b = e.target.closest("[data-18]"); if (!b) return;
      v.remove();
      if (b.dataset["18"] === "si") { marcarMayor(); ok(true); } else ok(false);
    });
  });
}
document.addEventListener("DOMContentLoaded", () => { if (mayorConfirmado()) document.documentElement.dataset.mas18 = "1"; });
// En las tarjetas, las fotos de «Íntimo +18» van difuminadas hasta confirmar la edad
document.addEventListener("click", async e => {
  const f = e.target.closest && e.target.closest("[data-foto18]");
  if (!f || mayorConfirmado()) return;
  e.preventDefault(); e.stopPropagation();
  await confirmarMayorDeEdad("Las fotos de productos íntimos se muestran solo a mayores de edad.");
}, true);
function leyendaHTML(texto) { return `<p class="leyenda-legal">${esc(texto)}</p>`; }

// «Creo que es un error»: cuando el filtro bloquea, la persona puede pedir que el administrador lo revise
async function pedirRevisionBloqueo(texto, mensajeError) {
  const m = /«([^»]{1,60})»/.exec(mensajeError || "");
  const { error } = await sb.from("solicitudes_revision").insert({ texto: String(texto || "").slice(0, 400), palabra: m ? m[1] : null });
  if (error) throw error;
}
const esBloqueoFiltro = err => /no está permitido en Merkap/.test((err && err.message) || "");
async function ofrecerRevision(err, texto) {
  if (!esBloqueoFiltro(err)) return false;
  if (!confirm(mensajeError(err) + "\n\n¿Crees que es un error? Toca «Aceptar» para pedir que lo revisemos (te respondemos en tu correo). Mientras tanto, puedes cambiar esa palabra y publicar.")) return true;
  try { await pedirRevisionBloqueo(texto, err.message); mostrarToast("📨 Enviado a revisión. Gracias por avisarnos"); }
  catch (e) { mostrarToast(mensajeError(e), "error"); }
  return true;
}
// Sanciones (solo administrador; supabase/39)
async function sancionarUsuario(usuarioId, tipo, motivo) {
  const { error } = await sb.rpc("sancionar", { p_usuario: usuarioId, p_tipo: tipo, p_motivo: motivo });
  if (error) throw error;
}
// Frases permitidas y pedidos de revisión (Moderación)
async function cargarPalabrasPermitidas() {
  const { data, error } = await sb.from("palabras_permitidas").select("*").order("frase");
  if (error) throw error;
  return data || [];
}
async function guardarPalabraPermitida(fila) {
  const { id, ...resto } = fila;
  const q = id ? sb.from("palabras_permitidas").update(resto).eq("id", id) : sb.from("palabras_permitidas").insert(resto);
  const { error } = await q;
  if (error) throw error;
}
async function borrarPalabraPermitida(id) {
  const { error } = await sb.from("palabras_permitidas").delete().eq("id", id);
  if (error) throw error;
}
async function cargarSolicitudesRevision() {
  const { data, error } = await sb.from("solicitudes_revision").select("id, texto, palabra, estado, creado_en, usuario:perfiles!usuario_id(nombre)").eq("estado", "pendiente").order("creado_en", { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}
async function resolverSolicitudRevision(id, estado) {
  const { error } = await sb.from("solicitudes_revision").update({ estado }).eq("id", id);
  if (error) throw error;
}

// =====================================================================
// EQUIPO Y PROPUESTAS (fase 2AK · supabase/38_admin_seguridad.sql)
// =====================================================================
// El moderador propone 👍 aprobar / 👎 rechazar un negocio nuevo o un reclamo de ficha; el administrador decide.
async function proponerResolucion(tipo, id, decision, nota) {
  const { error } = await sb.rpc("proponer_resolucion", { p_tipo: tipo, p_id: id, p_decision: decision, p_nota: nota || null });
  if (error) throw error;
}
// Solo administrador: buscar personas (sin texto = el equipo actual) y nombrar o quitar moderadores
async function buscarPersona(texto) {
  const { data, error } = await sb.rpc("buscar_persona", { p_texto: texto || "" });
  if (error) throw error;
  return data || [];
}
async function cambiarRol(usuarioId, rol) {
  const { error } = await sb.rpc("cambiar_rol", { p_usuario: usuarioId, p_rol: rol });
  if (error) throw error;
}

// =====================================================================
// MÉTRICAS DEL PILOTO (fase 2AJ · supabase/37_metricas.sql)
// Cuenta visitas de página y toques en WhatsApp / Llamar / Cómo llegar / Compartir.
// Sin nombre, correo, IP ni ubicación: solo un código al azar guardado en este navegador
// (para saber cuántas personas distintas entran y cuántas vuelven). Lo ves en metricas.html.
// =====================================================================
function idVisitante() {
  try {
    let v = localStorage.getItem("mf_vid");
    if (!/^[a-z0-9]{16,40}$/.test(v || "")) {
      const a = new Uint8Array(12); crypto.getRandomValues(a);
      v = Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("mf_vid", v);
    }
    return v;
  } catch (e) { return null; }   // sin almacenamiento (modo privado estricto): no se cuenta
}
const paginaMetrica = () => (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "").toLowerCase() || "index";
// De dónde llegó (solo la primera página de la visita): ?o=qr / ?utm_source=… o el sitio anterior
function origenVisita() {
  const p = new URLSearchParams(location.search);
  const o = (p.get("o") || p.get("utm_source") || p.get("ref") && "referido" || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  if (o) return o;
  let r = "";
  try { r = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { r = ""; }
  if (!r || r === location.hostname) return null;
  if (/whatsapp|wa\.me/.test(r)) return "whatsapp";
  if (/facebook|fb\./.test(r)) return "facebook";
  if (/instagram/.test(r)) return "instagram";
  if (/google\./.test(r)) return "google";
  if (/tiktok/.test(r)) return "tiktok";
  return r.replace(/^www\./, "").replace(/[^a-z0-9._-]/g, "").slice(0, 40);
}
const _ultimoEvento = {};
function registrarEvento(tipo, refTipo, refId, extra) {
  const vid = idVisitante();
  if (!vid) return;
  const clave = tipo + ":" + (refId || "");
  if (tipo !== "visita" && Date.now() - (_ultimoEvento[clave] || 0) < 4000) return;   // doble toque = 1
  _ultimoEvento[clave] = Date.now();
  sb.rpc("registrar_evento", {
    p_tipo: tipo, p_pagina: paginaMetrica(), p_ref_tipo: refId ? refTipo : null, p_ref_id: refId || null,
    p_visitante: vid, p_origen: (extra && extra.origen) || null
  }).then(() => {}, () => {});   // si falla (o falta el SQL 37) no pasa nada
}
// ¿De qué comercio o anuncio es este botón?
function refDeElemento(el) {
  const fui = el.closest("[data-fui]"); if (fui) return ["comercio", Number(fui.dataset.fui)];
  const an = el.closest("[data-anuncio]"); if (an && Number(an.dataset.anuncio)) return ["anuncio", Number(an.dataset.anuncio)];
  const com = el.closest("[data-comercio]"); if (com && Number(com.dataset.comercio)) return ["comercio", Number(com.dataset.comercio)];
  const tar = el.closest(".tarjeta-anuncio[data-id]"); if (tar) return ["anuncio", Number(tar.dataset.id)];
  const id = Number(new URLSearchParams(location.search).get("id")) || null;
  const pag = paginaMetrica();
  if (id && pag === "anuncio") return ["anuncio", id];
  if (id && pag === "tienda") return ["comercio", id];
  return [null, null];
}
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("a, button");
  if (!el) return;
  const href = el.getAttribute("href") || "";
  let tipo = null;
  if (el.matches("[data-como-llegar], #btn-como-llegar")) tipo = "como_llegar";
  else if (el.dataset.contacto === "whatsapp" || /wa\.me\/\d|api\.whatsapp\.com\/send\?phone=\d/.test(href)) tipo = "whatsapp";
  else if (el.dataset.contacto === "llamar" || /^tel:/.test(href)) tipo = "llamar";
  else if (/compartir/.test(el.id || "")) tipo = "compartir";
  if (!tipo) return;
  const [rt, rid] = refDeElemento(el);
  registrarEvento(tipo, rt, rid);
}, true);
// Una visita por página abierta
document.addEventListener("DOMContentLoaded", () => {
  let origen = null;
  try { if (!sessionStorage.getItem("mf_ses")) { sessionStorage.setItem("mf_ses", "1"); origen = origenVisita(); } } catch (e) { /* nada */ }
  const [rt, rid] = refDeElemento(document.body);
  registrarEvento("visita", rt, rid, { origen });
});
