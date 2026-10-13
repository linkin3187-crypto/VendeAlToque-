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
  if (/Límite de \d+ anuncios/i.test(m)) return m;
  if (/duplicate key|23505|unique constraint/i.test(m)) return "Ya reportaste este anuncio. ¡Gracias, lo revisaremos!";
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
    lat: d.lat,
    lng: d.lng,
    whatsapp: d.whatsapp,             // "573001234567"
    fotos
  };

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
  return filaAAnuncio(data);
}

async function eliminarAnuncioDB(id) {
  const previo = baseDatosAnuncios.find(a => a.id === id);
  const { error } = await sb.from("anuncios").delete().eq("id", id);
  if (error) throw error;
  if (previo) await borrarFotosStorage(previo.fotos);
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
