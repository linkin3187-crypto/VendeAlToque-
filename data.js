// ===== MercaFree - Datos (Supabase) =====
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
  { id: "autos",      nombre: "Autos",       icono: "🚗", foro: true  },
  { id: "inmuebles",  nombre: "Inmuebles",   icono: "🏡", foro: true  },
  { id: "tecnologia", nombre: "Tecnología",  icono: "📱", foro: true  },
  { id: "servicios",  nombre: "Oficios",     icono: "🛠️", foro: true  },
  { id: "ferreteria", nombre: "Ferretería",  icono: "🔩", foro: false },
  { id: "hogar",      nombre: "Hogar",       icono: "🛋️", foro: true  },
  { id: "mascotas",   nombre: "Mascotas",    icono: "🐕", foro: false },
  { id: "empleos",    nombre: "Empleos",     icono: "💼", foro: false },
  { id: "ropa",       nombre: "Ropa",        icono: "👕", foro: false },
  { id: "otros",      nombre: "Otros",       icono: "📦", foro: true  }
];

// Subcategorías (opcionales por categoría). Se guarda solo el `id` (texto corto) en anuncios.subcategoria.
// Para agregar una: añádela aquí con un id en minúsculas (a-z, 0-9, _) de hasta 30 caracteres. No requiere SQL.
const SUBCATEGORIAS = {
  tienda:     [["abarrotes", "Abarrotes y víveres"], ["frutas_verduras", "Frutas y verduras"], ["carnes_lacteos", "Carnes y lácteos"], ["licores", "Licores"], ["drogueria", "Droguería y salud"], ["papeleria", "Papelería"], ["otros", "Otros"]],
  comida:     [["restaurantes", "Restaurantes"], ["comidas_rapidas", "Comidas rápidas"], ["panaderia_postres", "Panadería y postres"], ["productos_caseros", "Productos caseros"], ["bebidas", "Bebidas"], ["otros", "Otros"]],
  autos:      [["carros", "Carros"], ["motos", "Motos"], ["camionetas", "Camionetas y camperos"], ["repuestos", "Repuestos y accesorios"], ["bicicletas", "Bicicletas y patinetas"], ["otros", "Otros"]],
  inmuebles:  [["apartamentos", "Apartamentos"], ["casas", "Casas"], ["lotes_fincas", "Lotes y fincas"], ["locales_oficinas", "Locales y oficinas"], ["habitaciones", "Habitaciones"], ["otros", "Otros"]],
  tecnologia: [["celulares", "Celulares"], ["computadores", "Computadores y tablets"], ["tv_audio", "TV y audio"], ["consolas_juegos", "Consolas y videojuegos"], ["camaras", "Cámaras"], ["accesorios_tech", "Accesorios"], ["otros", "Otros"]],
  servicios:  [["plomeria", "Plomería"], ["electricidad", "Electricidad"], ["mecanica", "Mecánica"], ["belleza", "Belleza y peluquería"], ["aseo_hogar", "Aseo y hogar"], ["construccion", "Construcción y arreglos"], ["mudanzas_transporte", "Mudanzas y transporte"], ["clases", "Clases y tutorías"], ["tecnicos", "Técnicos (electrodomésticos, PC)"], ["otros", "Otros"]],
  ferreteria: [["herramientas", "Herramientas"], ["materiales", "Materiales de construcción"], ["pinturas", "Pinturas"], ["electricos_plomeria", "Eléctricos y plomería"], ["tornilleria", "Tornillería"], ["otros", "Otros"]],
  hogar:      [["muebles", "Muebles"], ["electrodomesticos", "Electrodomésticos"], ["decoracion", "Decoración"], ["jardin", "Jardín"], ["cocina", "Cocina y menaje"], ["bebes", "Bebés y niños"], ["otros", "Otros"]],
  mascotas:   [["perros", "Perros"], ["gatos", "Gatos"], ["alimentos_mascotas", "Alimentos"], ["accesorios_mascotas", "Accesorios"], ["veterinaria", "Veterinaria"], ["adopcion", "Adopción"], ["otros", "Otros"]],
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
CATEGORIAS.forEach(c => { iconosCategoria[c.id] = c.icono; });

// ---------- Estado compartido ----------
let baseDatosAnuncios = [];
let usuarioActual = null;          // { id, nombre, email, rol } o null
let municipios = [];               // filas de la tabla `municipios` (lista cerrada)
let DEPARTAMENTOS = {};            // { "Antioquia": ["Medellín", ...] } (se arma desde `municipios`)
let errorCargaAnuncios = false;

const esModerador = () => !!usuarioActual && (usuarioActual.rol === "moderador" || usuarioActual.rol === "admin");

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
  const { data, error } = await sb.from("municipios").select("id, departamento, nombre, lat, lng").order("nombre");
  if (error) { console.error("municipios:", error); mostrarToast(mensajeError(error), "error"); return; }
  municipios = data || [];
  DEPARTAMENTOS = {};
  municipios.forEach(m => {
    (DEPARTAMENTOS[m.departamento] = DEPARTAMENTOS[m.departamento] || []).push(m.nombre);
  });
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
    fecha: Date.parse(r.creado_en)
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
const COLS_ANUNCIO = "id, owner_id, nombre, descripcion, categoria, subcategoria, estado, precio, municipio_id, barrio, lat, lng, fotos, estado_publicacion, creado_en, expira_en, ubicacion_aprox, tiene_whatsapp, tiene_telefono";
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
  let { data, error } = await consulta(COLS_ANUNCIO);
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
      const ruta = `${usuarioActual.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from(BUCKET_FOTOS).upload(ruta, blob, {
        contentType: "image/jpeg", cacheControl: "31536000", upsert: false
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

  const consulta = id
    ? sb.from("anuncios").update(fila).eq("id", id)
    : sb.from("anuncios").insert(fila);
  let { data, error } = await consulta.select(COLS_ANUNCIO).single();
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
  let { data, error } = await consulta(COLS_ANUNCIO);
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
  { id: "otro",          nombre: "Otros negocios",        icono: "🛍️", osm: [] }
];
const TIPOS_IMPORTABLES = TIPOS_COMERCIO.filter(t => t.osm.length);
const iconosComercio = {};
TIPOS_COMERCIO.forEach(t => { iconosComercio[t.id] = t.icono; });

let comercios = [];   // lista pública de comercios activos

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
    // Calificaciones (fase 2P): promedio y cuántas. Si aún no existen las columnas, quedan en 0.
    calif: Number(r.calif_promedio) || 0, nCalif: Number(r.calif_total) || 0
  };
}

// De dónde salió un comercio (para ordenar el trabajo del administrador)
const ORIGENES = {
  osm:       { icono: "📥", corto: "Importados",           nombre: "Importados de OpenStreetMap" },
  equipo:    { icono: "🛠️", corto: "Agregados por el equipo", nombre: "Agregados por el equipo" },
  dueno:     { icono: "🙋", corto: "Registrados por su dueño", nombre: "Registrados por su dueño y aprobados" },
  reclamado: { icono: "🔑", corto: "Reclamados",           nombre: "Importados y reclamados por su dueño" }
};
function origenComercio(c) {
  if (c.fuente === "Registro del dueño") return "dueno";
  if (c.fuente === "Agregado por el equipo") return "equipo";
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
  const { data, error } = await sb.from("comercios").select("*").eq("activo", true).limit(2000);
  if (error) { console.error("comercios:", error); comercios = []; return comercios; }
  comercios = (data || []).map(filaAComercio);
  return comercios;
}

// Solo moderadores/admin: lista TODOS (incluye ocultos) para el editor.
async function cargarComerciosAdmin() {
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
    disponible: !!r.disponible, oculto: !!r.oculto, actualizado: r.actualizado_en
  };
}

// Un comercio por id (el público solo ve los activos; el dueño y los moderadores ven el suyo aunque esté oculto)
async function cargarComercioPorId(id) {
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

// Comercios de los que soy dueño (para «Mi tienda»)
async function cargarMisComercios() {
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
  if (id) {
    const { data, error } = await sb.from("productos_comercio").update(fila).eq("id", id).select().single();
    if (error) throw error;
    return filaAProducto(data);
  }
  fila.comercio_id = comercioId;
  const { data, error } = await sb.from("productos_comercio").insert(fila).select().single();
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

// ---------- Registro de negocios nuevos (Fase 2D.6) ----------
// d: { nombre, tipo, municipioId, direccion, lat, lng, telefono, whatsapp, horario, descripcion, foto (data:), gpsCerca }
async function crearNegocioPendiente(d) {
  if (!usuarioActual) throw new Error("Inicia sesión para registrar tu negocio");
  const foto = await subirFotoComercio(d.foto);
  const { error } = await sb.from("negocios_pendientes").insert({
    nombre: d.nombre.trim(), tipo: d.tipo, municipio_id: d.municipioId, direccion: d.direccion.trim(),
    lat: +d.lat.toFixed(6), lng: +d.lng.toFixed(6), telefono: d.telefono || null, whatsapp: d.whatsapp || null,
    horario: d.horario || null, descripcion: d.descripcion || null, foto_fachada_url: foto,
    gps_cerca: !!d.gpsCerca, acepta_terminos: true
  });
  if (error) throw error;
}

// Mis solicitudes (la persona) o todas las pendientes (moderadores; con estado)
async function cargarNegociosPendientes(estado, soloMias) {
  let q = sb.from("negocios_pendientes")
    .select("id, nombre, tipo, municipio_id, direccion, lat, lng, telefono, whatsapp, horario, descripcion, foto_fachada_url, gps_cerca, estado, motivo_rechazo, comercio_id, solicitante_id, creado_en, solicitante:perfiles!solicitante_id(nombre)")
    .order("creado_en", { ascending: false }).limit(100);
  if (estado) q = q.eq("estado", estado);
  if (soloMias && usuarioActual) q = q.eq("solicitante_id", usuarioActual.id);
  const { data, error } = await q;
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
    .select("id, metodo, resultado, nivel, notas, foto_fachada_url, creado_en, verificador_id")
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
async function crearSolicitudComercio(comercioId, { tipo, nombre, contacto, mensaje }) {
  if (!usuarioActual) throw new Error("Inicia sesión para enviar la solicitud");
  const { error } = await sb.from("solicitudes_comercio").insert({
    comercio_id: comercioId, tipo, nombre_contacto: nombre, contacto, mensaje: mensaje || null
  });
  if (error) throw error;
}

// Solo moderadores
async function cargarSolicitudesComercio(estado) {
  let q = sb.from("solicitudes_comercio")
    .select("id, tipo, nombre_contacto, contacto, mensaje, estado, creado_en, solicitante_id, comercio:comercios(id, nombre, tipo, municipio_id, owner_id, activo)")
    .order("creado_en", { ascending: false }).limit(200);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
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
