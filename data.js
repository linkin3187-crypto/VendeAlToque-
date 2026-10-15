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
    estado: r.estado,
    departamento: m.departamento || "",
    ciudad: m.nombre || "",
    barrio: r.barrio,
    lat: r.lat,
    lng: r.lng,
    whatsapp: r.whatsapp,
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

async function cargarAnuncios() {
  // La regla RLS ya oculta a los demás los anuncios vencidos u ocultos, pero el
  // dueño y los moderadores SÍ los ven: por eso filtramos aquí también.
  const { data, error } = await sb.from("anuncios").select("*")
    .eq("estado_publicacion", "activo")
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false })
    .limit(1000);
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
  const muni = buscarMunicipio(d.departamento, d.ciudad);
  if (!muni) throw new Error("Elige tu ciudad de la lista");

  const previo = id ? baseDatosAnuncios.find(a => a.id === id) : null;
  const fotos = await subirFotos(d.fotos || []);
  const fila = {
    nombre: d.nombre,
    descripcion: d.desc,
    categoria: d.categoria,
    estado: d.estado,
    precio: d.precio,                 // número o null
    municipio_id: muni.id,
    barrio: d.barrio,
    whatsapp: d.whatsapp,             // "573001234567"
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
  const { data, error } = await consulta.select().single();
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
  const { data, error } = await sb.from("anuncios").select("*")
    .in("id", ids)
    .eq("estado_publicacion", "activo")
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false });
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
    let nombre = (u.user_metadata && u.user_metadata.nombre) || (u.email || "usuario").split("@")[0];
    let rol = "usuario";
    const { data } = await sb.from("perfiles").select("nombre, rol").eq("id", u.id).maybeSingle();
    if (data) { nombre = data.nombre; rol = data.rol; }
    usuarioActual = { id: u.id, nombre, email: u.email, rol };
    EDITOR = esModerador();   // EDITOR (utils.js) ya no viene de la URL: viene del ROL en la base de datos
    return usuarioActual;
  } catch (e) {
    console.error("sesión:", e);
    usuarioActual = null; EDITOR = false;
    return null;
  }
}

async function registrarUsuario(email, password, nombre) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname }
  });
  if (error) throw new Error(mensajeError(error));
  // Si el proyecto exige confirmar el correo, no hay sesión todavía.
  if (data.session) await refrescarUsuario(data.session);
  return { confirmar: !data.session };
}

async function iniciarSesion(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(mensajeError(error));
  await refrescarUsuario(data.session);
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
    municipioId: r.municipio_id, ciudad: m.nombre || "",
    direccion: r.direccion || "", telefono: r.telefono || "", horario: r.horario || "",
    foto: r.foto_url || "", lat: parseFloat(r.lat), lng: parseFloat(r.lng),
    verificado: !!r.verificado, activo: !!r.activo,
    nivel: Number(r.nivel_verificacion) || (r.verificado ? 2 : 1),          // 1 ubicado · 2 por teléfono · 3 en persona
    verificadoEn: r.verificado_en || null,
    ownerId: r.owner_id || null, descripcion: r.descripcion || "", whatsapp: r.whatsapp || "",
    recoge: !!r.recoge, domicilio: !!r.domicilio, domicilioInfo: r.domicilio_info || "",
    nProductos: Number(r.n_productos) || 0
  };
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
    .select("id, motivo, detalle, estado, creado_en, reportante:perfiles!reportante_id(nombre), anuncio:anuncios(id, nombre, estado_publicacion, fotos, barrio, whatsapp, owner_id)")
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
    .select("id, tipo, nombre_contacto, contacto, mensaje, estado, creado_en, solicitante_id, comercio:comercios(id, nombre, tipo, municipio_id, owner_id)")
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
