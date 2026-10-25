// Fase 2AD: la primera vez que alguien abre Merkap el logo hace una entrada más vistosa (ver styles.css)
(function () {
  try {
    if (!localStorage.getItem("mf_logo_visto")) {
      document.documentElement.classList.add("marca-primera");
      localStorage.setItem("mf_logo_visto", "1");
    }
  } catch (e) { /* sin almacenamiento: solo el saludo corto */ }
})();
// ===== Fase 2AP-3b · Versión del sitio y rescate si la página no carga =====
// Cada publicación sube VERSION_SITIO y el ?v= de todas las páginas (mismo número).
// Si el celular guardó una página VIEJA (pide utils.js?v=73) pero el servidor ya entrega el
// código NUEVO (74), se mezclan versiones y la página puede quedarse «Cargando…».
// Aquí se detecta y se recarga UNA vez la página pidiendo la versión nueva.
const VERSION_SITIO = 108;
(function revisarVersion() {
  try {
    const src = (document.currentScript && document.currentScript.src) || "";
    const pedida = Number((/[?&]v=(\d+)/.exec(src) || [])[1] || 0);
    const u = new URL(location.href);
    if (u.searchParams.has("_v")) {   // ya recargó: se limpia la dirección
      u.searchParams.delete("_v");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
      return;
    }
    if (pedida && pedida < VERSION_SITIO && sessionStorage.getItem("mf_recarga_v") !== String(VERSION_SITIO)) {
      sessionStorage.setItem("mf_recarga_v", String(VERSION_SITIO));
      u.searchParams.set("_v", String(VERSION_SITIO));
      location.replace(u.toString());
    }
  } catch (e) { /* sin sessionStorage o URL: sigue normal */ }
})();
// Si algo falla al cargar, en vez de quedarse «Cargando…» para siempre se muestra un aviso con
// el error (para poder enviarlo en una captura) y un botón para recargar.
(function rescateDeCarga() {
  const errores = [];
  function aviso(motivo) {
    if (document.getElementById("aviso-carga")) return;
    const d = document.createElement("div");
    d.id = "aviso-carga";
    d.setAttribute("role", "alert");
    d.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99998;background:#1e1b4b;color:#fff;border-radius:14px;padding:12px 14px;font:600 14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;flex-wrap:wrap";
    d.innerHTML = '<span style="flex:1;min-width:200px">⚠️ ' + motivo + '<small style="display:block;font-weight:400;opacity:.75;margin-top:2px;word-break:break-word"></small></span>'
      + '<button type="button" style="background:#f6c51a;color:#1e1b4b;border:0;border-radius:10px;padding:8px 12px;font-weight:800">🔄 Recargar</button>';
    d.querySelector("small").textContent = errores.slice(0, 2).join(" · ");
    d.querySelector("button").onclick = () => {
      try { sessionStorage.removeItem("mf_recarga_v"); const u = new URL(location.href); u.searchParams.set("_v", Date.now()); location.replace(u.toString()); }
      catch (e) { location.reload(); }
    };
    (document.body || document.documentElement).appendChild(d);
  }
  function cargandoVisible() {
    return [...document.querySelectorAll('[id$="-cargando"]')].some(el => !el.classList.contains("hidden") && el.offsetParent !== null);
  }
  window.addEventListener("error", e => {
    const t = e && e.target;
    if (t && t !== window && t.tagName === "SCRIPT") errores.push("No cargó " + String(t.src || "").split("/").pop().split("?")[0]);   // archivo que no llegó
    else if (t && t !== window && t.tagName) return;   // una imagen rota no es un problema de carga
    else errores.push(String((e && e.message) || "error") + (e && e.filename ? " (" + e.filename.split("/").pop().split("?")[0] + ":" + e.lineno + ")" : ""));
    setTimeout(() => { if (cargandoVisible()) aviso("La página no terminó de cargar."); }, 1500);
  }, true);
  window.addEventListener("load", () => setTimeout(() => {
    if (cargandoVisible()) aviso("Está tardando más de lo normal. Revisa tu conexión o recarga.");
  }, 12000));
})();

// ===== Merkap - Utilidades compartidas =====
// APRENDE: este archivo se carga PRIMERO en todas las páginas. Todo lo que
// antes estaba copiado en varios archivos (escapar HTML, toast, modo editor,
// modales) vive ahora aquí, una sola vez. Si algo cambia, lo cambias en un sitio.

// EDITOR = "esta persona es moderadora/admin". Antes se activaba con ?editar=1 (cualquiera
// podía usarlo). Ahora lo decide data.js según el ROL guardado en la base de datos, y
// además las reglas RLS de la base impiden borrar o editar lo ajeno aunque alguien
// manipule esta variable desde la consola del navegador.
let EDITOR = false;
const $ = id => document.getElementById(id);

// ---------- Código de origen (?ref=) ----------
// Si alguien llega por un enlace o QR con ?ref=grupo-envigado-1, guardamos ese código en el
// navegador (30 días, gana el primero) para anotarlo SOLO si esa persona crea una cuenta.
// No se sigue a quien solo visita: no hay cookies de seguimiento ni analítica.
const REF_VALIDO = /^[a-z0-9_-]{1,30}$/;
function limpiarRef(v) { v = String(v || "").trim().toLowerCase(); return REF_VALIDO.test(v) ? v : ""; }
// Convierte un texto libre («Grupo Envigado #1») en un código válido («grupo-envigado-1»)
function slugRef(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 30).replace(/[-_]+$/g, "");
}
function guardarRefDeLaURL() {
  try {
    const r = limpiarRef(new URLSearchParams(location.search).get("ref"));
    if (!r) return;
    const previo = JSON.parse(localStorage.getItem("mf_ref") || "null");
    if (previo && previo.r && Date.now() - previo.t < 30 * 86400000) return;
    localStorage.setItem("mf_ref", JSON.stringify({ r, t: Date.now() }));
  } catch (e) { /* sin almacenamiento: no pasa nada */ }
}
// Ícono de teléfono (blanco sobre azul cielo: se distingue del verde de WhatsApp y del morado de la marca)
const ICONO_TEL = '<svg class="icono-tel" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

function refGuardado() {
  try {
    const p = JSON.parse(localStorage.getItem("mf_ref") || "null");
    return p && limpiarRef(p.r) && Date.now() - p.t < 30 * 86400000 ? p.r : "";
  } catch (e) { return ""; }
}
guardarRefDeLaURL();

// ---------- Seguridad ----------
// POR QUÉ: si alguien publica un título como  <img src=x onerror=alert(1)>  y lo
// pegamos con innerHTML, el navegador EJECUTA ese código (ataque XSS).
// Esta función convierte < > & " ' en texto inofensivo. Úsala SIEMPRE que metas
// datos de usuarios dentro de una plantilla HTML (`...${esc(dato)}...`).
// OJO: la versión anterior (div.textContent → innerHTML) NO escapaba comillas,
// así que era insegura dentro de atributos como src="...".
function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
const escaparHTML = esc; // alias por compatibilidad con código viejo

// Solo dejamos pasar imágenes https o data:image (nada de javascript:...)
function urlSegura(u) {
  u = String(u || "");
  return /^(https:\/\/|data:image\/)/i.test(u) ? u : "";
}

// ---------- Texto y números ----------
// "Itagüí" y "itagui" deben encontrarse entre sí: quitamos tildes y mayúsculas.
function normalizar(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function extraerPrecio(t) {
  if (!t) return null;
  const n = String(t).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : null;
}

function formatearPrecio(n) {
  return n ? "$" + n.toLocaleString("es-CO") : "";
}

// Debounce: espera a que el usuario deje de escribir antes de ejecutar.
// POR QUÉ: sin esto, cada tecla recalcula todo (lista + marcadores del mapa).
function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Geografía y enlaces ----------
// Distancia en km entre dos puntos {lat,lng} (fórmula de Haversine).
function distanciaKm(a, b) {
  const R = 6371, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Pide la ubicación (GPS) y devuelve {lat,lng}. Solo se llama al TOCAR un botón «Cerca de mí» (nunca al cargar la página).
function obtenerGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("no-soportado")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
function textoErrorGPS(err) {
  if (err && err.code === 1) return "Permiso de ubicación denegado. Actívalo en los ajustes del navegador.";
  if (err && err.message === "no-soportado") return "Tu navegador no permite geolocalización.";
  return "No se pudo obtener tu ubicación.";
}

function tieneCoords(a) {
  return Number.isFinite(a.lat) && Number.isFinite(a.lng);
}

// Mensaje prellenado: el vendedor sabe de qué anuncio le escriben.
function urlWhatsApp(numero, nombreAnuncio) {
  const n = String(numero || "").replace(/\D/g, "");
  const texto = nombreAnuncio
    ? `Hola, vi tu anuncio «${nombreAnuncio}» en Merkap. ¿Sigue disponible?`
    : "Hola, vi tu anuncio en Merkap.";
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

// (Antes añadía un "&destination_place_id=" vacío que no servía para nada.)
function urlGoogleMaps(lat, lng) {
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(lat + "," + lng);
}

// ---------- Avisos (toast) ----------
function mostrarToast(msg, tipo = "ok") {
  const t = document.createElement("div");
  const color = tipo === "error" ? "bg-red-600" : "bg-green-600";
  t.className = `fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 ${color} text-white px-6 py-3 rounded-full shadow-lg z-[200] font-medium text-sm max-w-[90vw] text-center`;
  t.setAttribute("role", "status");
  t.textContent = msg; // textContent: nunca interpreta HTML
  document.body.appendChild(t);
  setTimeout(() => t.remove(), tipo === "error" ? 4000 : 2500);
}

// ---------- Modales ----------
// Un solo sistema para todos. Se controlan con atributos en el HTML:
//   data-abrir="id-del-modal"   → botón que abre
//   data-cerrar                 → botón que cierra (la X)
//   class="modal-fondo"         → el fondo oscuro; clic fuera cierra
//   data-protegido              → clic fuera NO cierra (formularios largos)
// Además: tecla Escape cierra el de arriba y el fondo de la página no hace scroll.
function abrirModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.remove("hidden");
  actualizarBloqueoScroll();
  document.dispatchEvent(new CustomEvent("modal:abierto", { detail: { id } }));
}

function cerrarModal(id) {
  const m = $(id);
  if (!m || m.classList.contains("hidden")) return;
  m.classList.add("hidden");
  actualizarBloqueoScroll();
  document.dispatchEvent(new CustomEvent("modal:cerrado", { detail: { id } }));
}

function actualizarBloqueoScroll() {
  const hayAbierto = document.querySelector(".modal-fondo:not(.hidden)");
  document.body.style.overflow = hayAbierto ? "hidden" : "";
}

document.addEventListener("click", e => {
  const abrir = e.target.closest("[data-abrir]");
  if (abrir) {
    // data-requiere-login: publicar, escribir en el foro, etc. exigen cuenta (lo exige también la base de datos)
    if (abrir.hasAttribute("data-requiere-login") && typeof usuarioActual !== "undefined" && !usuarioActual) {
      const registro = abrir.dataset.authModo === "registro";
      mostrarToast(registro ? "Crea tu cuenta gratis para publicar" : "Inicia sesión para continuar", registro ? "ok" : "error");
      document.dispatchEvent(new CustomEvent("auth:pedir", { detail: { modo: abrir.dataset.authModo || "login" } }));
      abrirModal("modal-auth");
      return;
    }
    abrirModal(abrir.dataset.abrir);
    return;
  }

  const cerrar = e.target.closest("[data-cerrar]");
  if (cerrar) {
    cerrarModal(cerrar.dataset.cerrar || cerrar.closest(".modal-fondo")?.id);
    return;
  }
  // clic directamente sobre el fondo oscuro (no sobre la tarjeta blanca)
  if (e.target.classList.contains("modal-fondo") && !e.target.hasAttribute("data-protegido")) {
    cerrarModal(e.target.id);
  }
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const abiertos = document.querySelectorAll(".modal-fondo:not(.hidden)");
  if (abiertos.length) cerrarModal(abiertos[abiertos.length - 1].id);
});

// ---------- Mapas (Leaflet) ----------
// Se definen aquí porque los usan index.html y anuncio.html.
function iconoMarcador(categoria) {
  const emoji = (typeof iconosCategoria !== "undefined" && iconosCategoria[categoria]) || "📍";
  return L.divIcon({
    className: "marcador-cat",
    html: `<div class="pin-mapa"><span>${emoji}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -42]
  });
}

function iconoUsuario() {
  return L.divIcon({
    className: "marcador-user",
    html: `<div class="pin-usuario"><span>📍</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

// Crea un mapa con el fondo de OpenStreetMap.
// ResizeObserver: si el contenedor cambia de tamaño (porque Tailwind terminó de
// cargar, o el modal se abrió) Leaflet se recalcula solo. Reemplaza los
// setTimeout(invalidateSize) "a ciegas" que había antes.
function crearMapaBase(idElemento, centro, zoom, opciones) {
  const mapa = L.map(idElemento, Object.assign({ center: centro, zoom }, opciones || {}));
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>'
  }).addTo(mapa);
  if (window.ResizeObserver) {
    new ResizeObserver(() => mapa.invalidateSize()).observe(mapa.getContainer());
  }
  return mapa;
}

// ---------- Buscar una dirección en el mapa (Nominatim / OpenStreetMap) ----------
// Gratis y sin clave. Respetar: máx. 1 consulta por segundo. `centro` limita la búsqueda
// a ~13 km alrededor de la ciudad para no caer en otra.
async function consultarNominatim(q, centro, signal) {
  const p = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "co", q, "accept-language": "es" });
  if (centro) {   // caja de ~13 km alrededor de la ciudad
    p.set("viewbox", [centro.lng - 0.12, centro.lat + 0.12, centro.lng + 0.12, centro.lat - 0.12].join(","));
    p.set("bounded", "1");
  }
  const r = await fetch("https://nominatim.openstreetmap.org/search?" + p, { signal, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("nominatim " + r.status);
  const j = await r.json();
  return j[0] ? { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), tipo: j[0].addresstype || j[0].type } : null;
}

// ---------- Ubicación aproximada (privacidad) ----------
// El punto que ven los demás se desplaza entre 150 y 350 m en una dirección al azar.
// El punto real se guarda aparte (tabla `anuncios_ubicacion`), visible solo para su dueño.
const RADIO_MAX_APROX_M = 350;
function desplazarCoords(lat, lng) {
  const r = crypto.getRandomValues(new Uint32Array(2));
  const metros = 150 + 200 * (r[0] / 4294967296);
  const angulo = 2 * Math.PI * (r[1] / 4294967296);
  return {
    lat: +(lat + (metros * Math.cos(angulo)) / 111320).toFixed(6),
    lng: +(lng + (metros * Math.sin(angulo)) / (111320 * Math.cos(lat * Math.PI / 180))).toFixed(6)
  };
}

// =====================================================================
// CÓMO LLEGAR (Fase 2C.6/2C.7): menú con opciones de transporte
// =====================================================================
// POR QUÉ solo enlaces: no hay APIs, claves ni costos, y no prometemos nada que una app
// externa no pueda cumplir. Si una app cambia su enlace, se corrige aquí, en un solo lugar.
// Privacidad: si el anuncio es de zona aproximada, los enlaces llevan a la zona, nunca al punto real;
// el comprador puede pegar el punto que el vendedor le dé por WhatsApp y los enlaces se actualizan.
const LINEAS_TAXI = {
  // "Envigado": [{ nombre: "Taxi Libre", tel: "6044440000" }],   ← las agrega el administrador
};

// Convierte lo que pegó la persona en un destino. Acepta coordenadas («6.17,-75.59»), un enlace de Google Maps
// o de «ubicación» de WhatsApp (traen las coordenadas dentro) o una dirección escrita.
function interpretarDestino(texto, ciudad) {
  const t = String(texto || "").trim().slice(0, 300);
  if (!t) return null;
  const m = t.match(/(-?\d{1,2}\.\d{3,})\s*(?:,|%2C)\s*(-?\d{1,3}\.\d{3,})/i);
  if (m) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, nombre: "Punto acordado" };
  }
  if (/^https?:\/\//i.test(t)) return null;   // un enlace sin coordenadas legibles (p. ej. enlace corto) no lo podemos usar
  return { texto: ciudad && !t.toLowerCase().includes(ciudad.toLowerCase()) ? `${t}, ${ciudad}, Colombia` : `${t}, Colombia`, nombre: t };
}

function opcionesComoLlegar(dest) {
  const conCoords = dest.lat !== undefined;
  const destino = encodeURIComponent(conCoords ? dest.lat + "," + dest.lng : dest.texto);
  const gm = modo => `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=${modo}`;
  const drop = conCoords
    ? `&dropoff[latitude]=${encodeURIComponent(dest.lat)}&dropoff[longitude]=${encodeURIComponent(dest.lng)}`
    : `&dropoff[formatted_address]=${destino}`;
  const uber = "https://m.uber.com/ul/?action=setPickup&pickup=my_location" + drop +
    `&dropoff[nickname]=${encodeURIComponent(dest.nombre || "Destino")}`;
  return {
    llegar: [
      { icono: "🚇", texto: "Transporte público (metro y buses)", url: gm("transit") },
      { icono: "🚶", texto: "A pie", url: gm("walking") },
      { icono: "🚲", texto: "En bicicleta", url: gm("bicycling") },
      { icono: "🚗", texto: "En carro o moto (Google Maps)", url: gm("driving") },
      { icono: "🧭", texto: "Navegar con Waze", url: conCoords ? `https://waze.com/ul?ll=${destino}&navigate=yes` : `https://waze.com/ul?q=${destino}&navigate=yes` }
    ],
    pedir: [{ icono: "🚕", texto: "Pedir Uber (destino ya puesto)", url: uber }],
    // DiDi e inDrive no ofrecen un enlace público fiable que lleve el destino: copiamos el punto para pegarlo en la app.
    copiar: conCoords ? `https://www.google.com/maps/search/?api=1&query=${destino}` : dest.texto
  };
}

// Lugares públicos cerca de un punto. La búsqueda se centra en el mapa con «@lat,lng,zoom»
// (poner las coordenadas dentro del texto de búsqueda no funciona).
function urlBuscarCerca(tipo, lat, lng) {
  return `https://www.google.com/maps/search/${encodeURIComponent(tipo)}/@${lat},${lng},15z`;
}

function mensajeEncuentro(nombreAnuncio) {
  return `Hola, vi tu anuncio «${nombreAnuncio}» en Merkap. ¿Nos vemos en un lugar público y concurrido, como una estación del metro, un centro comercial o un CAI? ¿Cuál te queda mejor? Cuando lo definas, mándame la ubicación por WhatsApp.`;
}

// datos: { lat, lng, nombre, aprox, ciudad, whatsapp (opcional: activa «punto de encuentro») }
function abrirComoLlegar(datos) {
  cerrarComoLlegar();
  const filaH = o => `<a href="${esc(o.url)}" target="_blank" rel="noopener" class="flex items-center gap-3 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-3 text-sm font-medium"><span class="text-xl">${o.icono}</span>${esc(o.texto)}</a>`;
  const taxis = (LINEAS_TAXI[datos.ciudad] || []).map(t =>
    `<a href="tel:${esc(String(t.tel).replace(/[^\d+]/g, ""))}" class="flex items-center gap-3 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-3 text-sm font-medium"><span class="text-xl">📞</span>Taxi: ${esc(t.nombre)}</a>`).join("");
  const q = tipo => urlBuscarCerca(tipo, datos.lat, datos.lng);
  const encuentro = datos.whatsapp ? `
      <h4 class="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">🛡️ Punto de encuentro seguro</h4>
      <p class="text-xs text-slate-500 mb-2">Para compras entre personas, reúnanse en un lugar público y concurrido. Estos atajos buscan cerca de ${datos.aprox ? "la zona del anuncio" : "el anuncio"}.</p>
      <div class="flex flex-wrap gap-2 mb-2">
        <a href="${esc(q("estación de metro"))}" target="_blank" rel="noopener" class="text-xs bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5">🚇 Estaciones</a>
        <a href="${esc(q("centro comercial"))}" target="_blank" rel="noopener" class="text-xs bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5">🏬 Centros comerciales</a>
        <a href="${esc(q("CAI policía"))}" target="_blank" rel="noopener" class="text-xs bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5">👮 CAI</a>
      </div>
      <a id="cl-encuentro" href="https://wa.me/${esc(String(datos.whatsapp).replace(/\D/g, ""))}?text=${encodeURIComponent(mensajeEncuentro(datos.nombre))}" target="_blank" rel="noopener" class="block text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm">💬 Proponer punto de encuentro por WhatsApp</a>` : "";
  const v = document.createElement("div");
  v.id = "modal-como-llegar";
  v.className = "fixed inset-0 z-[250] bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4";
  v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", "Cómo llegar");
  v.innerHTML = `<div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[92vh] overflow-auto relative">
    <button type="button" data-cl-cerrar aria-label="Cerrar" class="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-700">&times;</button>
    <h3 class="text-lg font-black text-indigo-900">🗺️ ¿Cómo quieres llegar?</h3>
    <p id="cl-destino-txt" class="text-xs text-slate-500 mb-3"></p>
    <div id="cl-opciones"></div>
    <div class="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
      <label for="cl-punto" class="block text-xs font-bold text-indigo-900 mb-1">📍 ¿Ya acordaron el punto de encuentro?</label>
      <p class="text-xs text-slate-500 mb-2">Pega aquí la dirección o la ubicación que te envió el vendedor por WhatsApp y las opciones de arriba se actualizan.</p>
      <div class="flex gap-2">
        <input id="cl-punto" type="text" maxlength="300" placeholder="Ej: Estación Envigado, o pega la ubicación" class="flex-1 min-w-0 border border-slate-300 rounded-lg p-2 text-sm">
        <button type="button" id="cl-usar" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 rounded-lg">Usar</button>
      </div>
      <p id="cl-punto-msg" class="hidden text-xs text-red-600 mt-1"></p>
      <button type="button" id="cl-volver" class="hidden text-xs text-indigo-700 underline mt-1">↩ Volver al destino del anuncio</button>
    </div>${encuentro}
    <p class="text-[11px] text-slate-400 mt-4">Merkap no presta servicios de transporte ni tiene alianza con estas aplicaciones; son enlaces de ayuda.</p>
  </div>`;
  let op = null;
  const pintar = (dest, esPunto) => {
    op = opcionesComoLlegar(dest);
    $("cl-opciones").innerHTML = `<div class="space-y-2">${op.llegar.map(filaH).join("")}</div>
      <h4 class="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">Pedir transporte</h4>
      <div class="space-y-2">${op.pedir.map(filaH).join("")}${taxis}
        <button type="button" id="cl-copiar" class="w-full flex items-center gap-3 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-3 text-sm font-medium text-left"><span class="text-xl">📋</span>Copiar destino para DiDi o inDrive</button>
      </div>`;
    $("cl-destino-txt").innerHTML = esPunto
      ? `Destino: <b>${esc(dest.nombre)}</b> (el punto que acordaron)`
      : (datos.aprox ? "Es una <b>zona aproximada</b>: el vendedor te dará el punto exacto cuando acuerden el encuentro. Cuando lo tengas, pégalo abajo." : esc(datos.nombre || ""));
    $("cl-volver").classList.toggle("hidden", !esPunto);
  };
  v.addEventListener("click", async e => {
    if (e.target === v || e.target.closest("[data-cl-cerrar]")) { cerrarComoLlegar(); return; }
    if (e.target.closest("#cl-copiar")) {
      try { await navigator.clipboard.writeText(op.copiar); mostrarToast("📋 Destino copiado: pégalo en la app"); }
      catch (err) { window.prompt("Copia el destino:", op.copiar); }
    }
    if (e.target.closest("#cl-usar")) {
      const d = interpretarDestino($("cl-punto").value, datos.ciudad);
      const msg = $("cl-punto-msg");
      if (!d) { msg.textContent = "No pudimos leer ese punto. Escribe la dirección o pega la ubicación completa."; msg.classList.remove("hidden"); return; }
      msg.classList.add("hidden");
      pintar(d, true);
    }
    if (e.target.closest("#cl-volver")) { $("cl-punto").value = ""; pintar({ lat: datos.lat, lng: datos.lng, nombre: datos.nombre }, false); }
  });
  document.body.appendChild(v);
  document.body.style.overflow = "hidden";
  pintar({ lat: datos.lat, lng: datos.lng, nombre: datos.nombre }, false);
}

function cerrarComoLlegar() {
  const v = document.getElementById("modal-como-llegar");
  if (v) v.remove();
  document.body.style.overflow = "";
}

// Cualquier enlace con data-como-llegar abre el menú. Sin JavaScript sigue funcionando como enlace a Google Maps.
// Fase de captura: los popups de Leaflet detienen la propagación de los clics y no llegarían a un listener normal.
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("[data-como-llegar]");
  if (!el) return;
  e.preventDefault();
  // Anuncios (data-anuncio): exige cuenta → registro rápido (ver data.js · contactarAnuncio). Comercios: libre.
  if (el.dataset.anuncio && typeof contactarAnuncio === "function") {
    e.stopPropagation();
    contactarAnuncio("llegar", { ...el.dataset });
    return;
  }
  abrirComoLlegar({
    lat: Number(el.dataset.lat), lng: Number(el.dataset.lng), nombre: el.dataset.nombre || "",
    aprox: el.dataset.aprox === "1", ciudad: el.dataset.ciudad || "", whatsapp: el.dataset.whatsapp || ""
  });
}, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarComoLlegar(); });

// ---------- Fotos ----------
// Reduce la foto a 800 px de ancho (JPEG) antes de subirla: ahorra espacio y datos.
// opciones (fase 2Z.2): { max: ancho máximo en px (800 por defecto), transparencia: true → webp/png (conserva el fondo transparente) }
function comprimir(file, opciones = {}) {
  const max = opciones.max || 800;
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onerror = () => mal(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => mal(new Error("Imagen no válida"));
      img.onload = () => {
        const esc_ = Math.min(1, max / img.width);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * esc_); cv.height = Math.round(img.height * esc_);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        if (opciones.transparencia) {
          const w = cv.toDataURL("image/webp", 0.85);
          ok(w.startsWith("data:image/webp") ? w : cv.toDataURL("image/png"));
        } else ok(cv.toDataURL("image/jpeg", 0.8));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

// =====================================================================
// HORARIO («abierto ahora») y PEDIDO por WhatsApp (Fase 2D.3/2D.4)
// =====================================================================
// El horario es texto libre que escribe el comercio. Entendemos los formatos comunes
// («Lun-Sáb 8:00-20:00, Dom 9-14», «24 horas», «Todos los días 7am-9pm»); si no se entiende,
// devolvemos null y simplemente NO mostramos «abierto/cerrado» (mejor callar que equivocarse).
const DIAS_ES = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
const sinTildes = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function ahoraColombia(fecha) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(fecha || new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  const dia = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(p.weekday.toLowerCase().slice(0, 3));
  return { dia, minutos: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) };
}

function aMinutos(h, m, ampm) {
  let hh = parseInt(h, 10);
  if (ampm === "pm" && hh < 12) hh += 12;
  if (ampm === "am" && hh === 12) hh = 0;
  return hh * 60 + (m ? parseInt(m, 10) : 0);
}

// Días en español («lun-sáb») o en el formato de OpenStreetMap («Mo-Fr», «Sa», «Su») que traen los importados
const DIAS_OSM = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
function diasDeTexto(t) {
  if (/todos los dias|diario|lunes a domingo|l-d/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  let nombres = [...t.matchAll(/\b(dom|lun|mar|mie|jue|vie|sab)[a-z]*/g)].map(m => DIAS_ES.indexOf(m[1]));
  if (!nombres.length) nombres = [...t.matchAll(/\b(mo|tu|we|th|fr|sa|su)\b/g)].map(m => DIAS_OSM[m[1]]);
  if (!nombres.length) return null;
  if (nombres.length >= 2 && /[-–]|\ba\b/.test(t.replace(/\d.*/, ""))) {      // rango «lun-sab» (da la vuelta si hace falta)
    const out = []; let d = nombres[0];
    for (let k = 0; k < 7; k++) { out.push(d); if (d === nombres[1]) break; d = (d + 1) % 7; }
    return out;
  }
  return [...new Set(nombres)];
}

// Convierte el horario en tramos {dias, ini, fin} (minutos del día). «24 horas» → "siempre"; si no se entiende → null.
function tramosHorario(horario) {
  // V-4b: arreglos de escritura comunes: «730 am» → «7:30 am», «don» → «dom»
  const txt = sinTildes(horario)
    .replace(/\b(\d{1,2})([0-5]\d)\s*(am|pm|a\.\s?m\.|p\.\s?m\.)/g, "$1:$2 $3")
    .replace(/\bdon\b/g, "dom");
  if (!txt.trim()) return null;
  if (/24 ?(h|horas)|24\/7/.test(txt)) return "siempre";
  const tramos = [];
  let diasPrevios = null;   // «Lun-Vie 8-12, 2-6»: el segundo tramo hereda los días del primero
  for (const seg of txt.split(/[;,/\n|]+|\by\b/)) {
    const hm = seg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.\s?m\.|p\.\s?m\.)?\s*(?:[-–]|\ba\b|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.\s?m\.|p\.\s?m\.)?/)
      // V-4b: «8:30 am 7:30 pm» (sin «a» ni guion): se entiende si las dos horas dicen am/pm
      || seg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.\s?m\.|p\.\s?m\.)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.\s?m\.|p\.\s?m\.)/);
    if (!hm) continue;
    const ap = x => x ? (x[0] === "p" ? "pm" : "am") : undefined;
    const dias = diasDeTexto(seg.slice(0, hm.index)) || diasPrevios || [0, 1, 2, 3, 4, 5, 6];
    diasPrevios = dias;
    let ini = aMinutos(hm[1], hm[2], ap(hm[3]));
    let fin = aMinutos(hm[4], hm[5], ap(hm[6]));
    if (!hm[3] && !hm[6] && fin < ini && ini <= 12 * 60 && fin <= 12 * 60) fin += 12 * 60;   // «8-6» = 8:00-18:00
    if (!hm[3] && !hm[6] && ini < 7 * 60 && fin <= 12 * 60 && fin > ini && tramos.length) { ini += 12 * 60; fin += 12 * 60; }  // «…, 2-6» = 2 p. m.-6 p. m.
    tramos.push({ dias, ini, fin });
  }
  return tramos.length ? tramos : null;
}

// Devuelve true/false (abierto/cerrado ahora) o null si no se puede saber.
function estaAbierto(horario, fecha) {
  const e = estadoHorario(horario, fecha);
  return e ? e.abierto : null;
}

// «8 a. m.», «8:30 p. m.», «12 m.» (mediodía)
function horaCorta(min) {
  min = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 12 && m === 0) return "12 m.";
  if (h === 0 && m === 0) return "12 de la noche";
  const h12 = h % 12 || 12;
  return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? " a. m." : " p. m.");
}
const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MIN_AVISO_HORARIO = 60;   // «Cierra pronto» / «Abre pronto» cuando falta 1 hora o menos

// Fase 2AH: estado completo del horario para las tarjetas.
// → { abierto, estado: "abierto"|"cierra"|"cerrado"|"abre", corto, detalle } o null (si no se entiende: no se muestra nada)
function estadoHorario(horario, fecha) {
  const tramos = tramosHorario(horario);
  if (!tramos) return null;
  if (tramos === "siempre") return { abierto: true, estado: "abierto", corto: "Abierto 24 h", detalle: "Abierto las 24 horas" };
  const { dia, minutos } = ahoraColombia(fecha);
  // ¿Abierto? → cuántos minutos faltan para cerrar
  let cierraEn = null;
  for (const t of tramos) {
    const hoy = t.dias.includes(dia), ayer = t.dias.includes((dia + 6) % 7);
    let falta = null;
    if (t.fin > t.ini) { if (hoy && minutos >= t.ini && minutos < t.fin) falta = t.fin - minutos; }
    else {                                                                    // cruza medianoche (p. ej. 6 p. m. - 2 a. m.)
      if (hoy && minutos >= t.ini) falta = 1440 - minutos + t.fin;
      if (ayer && minutos < t.fin) falta = t.fin - minutos;
    }
    if (falta !== null && (cierraEn === null || falta > cierraEn)) cierraEn = falta;
  }
  if (cierraEn !== null) {
    const a = horaCorta(minutos + cierraEn);
    return cierraEn <= MIN_AVISO_HORARIO
      ? { abierto: true, estado: "cierra", corto: "Cierra pronto", detalle: `Cierra a las ${a} (en ${cierraEn} min)` }
      : { abierto: true, estado: "abierto", corto: "Abierto ahora", detalle: `Abierto · cierra a las ${a}` };
  }
  // Cerrado → cuándo abre
  let abreEn = null;
  for (let k = 0; k <= 7 && abreEn === null; k++) {
    const d = (dia + k) % 7;
    for (const t of tramos) if (t.dias.includes(d) && (k > 0 || t.ini > minutos)) {
      const en = k * 1440 + t.ini - minutos;
      if (abreEn === null || en < abreEn) abreEn = en;
    }
  }
  if (abreEn === null) return { abierto: false, estado: "cerrado", corto: "Cerrado", detalle: "Cerrado ahora" };
  const k = Math.floor((minutos + abreEn) / 1440), a = horaCorta(minutos + abreEn);
  if (abreEn <= MIN_AVISO_HORARIO) return { abierto: false, estado: "abre", corto: "Abre pronto", detalle: `Abre a las ${a} (en ${abreEn} min)` };
  const cuando = k === 0 ? `hoy a las ${a}` : k === 1 ? `mañana a las ${a}` : `el ${NOMBRE_DIA[(dia + k) % 7]} a las ${a}`;
  return { abierto: false, estado: "cerrado", corto: "Cerrado", detalle: `Cerrado · abre ${cuando}` };
}

// Fase 2AI: grupo para «Abiertos primero»: 0 abiertos (y «cierra pronto»), 1 abren en ≤ 1 h, 2 sin horario (o no entendible), 3 cerrados
function grupoHorario(c, fecha) {
  const e = estadoHorario(c && c.horario, fecha);
  if (!e) return 2;
  return e.abierto ? 0 : e.estado === "abre" ? 1 : 3;
}
const GRUPOS_HORARIO = [
  { titulo: "🟢 Abiertos ahora", clase: "hz-abierto" },
  { titulo: "🟡 Abren en menos de 1 hora", clase: "hz-abre" },
  { titulo: "🕒 Sin horario publicado · llama antes de ir", clase: "hz-sin" },
  { titulo: "🌙 Cerrados ahora", clase: "hz-cerrado" }
];

// Distintivos listos para las tarjetas (mismos colores en todo el sitio)
const ESTILO_HORARIO = {
  abierto: { icono: "🟢", clase: "hz-abierto" },
  cierra: { icono: "🟠", clase: "hz-cierra" },
  abre: { icono: "🟡", clase: "hz-abre" },
  cerrado: { icono: "🔴", clase: "hz-cerrado" }
};
function badgeHorarioHTML(e, extra) {
  if (!e) return "";
  const s = ESTILO_HORARIO[e.estado];
  return `<span class="badge-horario ${s.clase} ${extra || ""}" title="${esc(e.detalle)}">${s.icono} ${esc(e.corto)}</span>`;
}
function lineaHorarioHTML(e, clase) {
  if (!e) return "";
  const s = ESTILO_HORARIO[e.estado];
  return `<p class="linea-horario ${s.clase} ${clase || ""}">${s.icono} ${esc(e.detalle)}</p>`;
}

// Mensaje de pedido por WhatsApp. items: [{nombre, precio, cantidad}]; modo: "recoger" | "domicilio" | ""
function mensajePedido(comercio, items, modo) {
  const peso = n => "$" + Number(n).toLocaleString("es-CO");
  const lineas = items.map(i => `• ${i.cantidad} × ${i.nombre}${i.precio != null ? " (" + peso(i.precio * i.cantidad) + ")" : ""}`);
  const total = items.reduce((s, i) => s + (i.precio != null ? i.precio * i.cantidad : 0), 0);
  const conPrecio = items.every(i => i.precio != null);
  return [`Hola, vi tu tienda «${comercio.nombre}» en Merkap y quiero pedir:`, ...lineas,
    total && conPrecio ? `Total aproximado: ${peso(total)}` : "",
    modo === "domicilio" ? "Lo quiero a domicilio." : modo === "recoger" ? "Lo recojo en el local." : "",
    "¿Lo tienen disponible?"].filter(Boolean).join("\n");
}

function urlWhatsAppTexto(numero, texto) {
  return `https://wa.me/${String(numero || "").replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

// «hace 5 min», «hace 3 h», «ayer», «hace 3 días», «hace 2 semanas», «hace 1 mes» (fase 2AC; minutos y horas desde la 2AH)
// largo = true → «hace 3 horas», «hace 5 minutos» (para la página del anuncio)
function haceCuanto(ms, largo) {
  if (!ms || !Number.isFinite(ms)) return "";
  const min = Math.floor((Date.now() - ms) / 6e4);
  if (min < 2) return "hace un momento";
  if (min < 60) return largo ? `hace ${min} minutos` : `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return largo ? `hace ${h} ${h === 1 ? "hora" : "horas"}` : `hace ${h} h`;
  const dias = Math.floor(min / 1440);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) { const s = Math.floor(dias / 7); return `hace ${s} ${s === 1 ? "semana" : "semanas"}`; }
  const m = Math.floor(dias / 30); return `hace ${m} ${m === 1 ? "mes" : "meses"}`;
}
// Publicado en las últimas 24 horas (se resalta en verde)
const esReciente = ms => !!ms && Date.now() - ms < 864e5;
// «18 oct. 2026, 9:15 p. m.» en hora de Colombia
function fechaPublicacion(ms) {
  if (!ms || !Number.isFinite(ms)) return "";
  const p = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
    .formatToParts(new Date(ms)).reduce((o, x) => (o[x.type] = x.value, o), {});
  return `${p.day} ${String(p.month).replace(".", "")} ${p.year}, ${p.hour}:${p.minute} ${/p/i.test(p.dayPeriod || "") ? "p. m." : "a. m."}`;
}
// «a 350 m» / «a 2,4 km»
const distanciaCorta = km => km < 1 ? "a " + Math.round(km * 1000) + " m" : "a " + km.toFixed(1).replace(".", ",") + " km";
// Etiqueta de precio guardada en detalles.precio_tipo
const ETIQUETA_PRECIO = { fijo: "Precio fijo", negociable: "🤝 Negociable" };

// ---------- Logo de la página (fase 2AF) ----------
// El encabezado trae el logo oficial (img/logo-merkap.png). Si hay uno de temporada vigente, data.js lo
// pide a la base y lo recuerda aquí, para que al abrir la siguiente página aparezca sin parpadeo.
function aplicarLogoPagina(l) {
  if (!l || !l.imagen_url) return;
  const url = String(l.imagen_url);
  if (!/^(https:\/\/|img\/)/.test(url)) return;
  document.querySelectorAll("img.marca-ico").forEach(im => {
    if (im.getAttribute("src") !== url) im.src = url;
    im.classList.toggle("recortar", !!l.recortar);
    im.classList.toggle("sin-anim", l.animar === false);
    im.alt = "";
  });
}
(function () {
  try { const l = JSON.parse(localStorage.getItem("mf_logo") || "null"); if (l) aplicarLogoPagina(l); } catch (e) { /* sin memoria: queda el oficial */ }
})();

// =====================================================================
// FASE 2BA · Filtros compactos (propuesta B): cada botón [data-fb="id"] despliega su lista (.fb-hoja) debajo.
// Uno a la vez; se cierran con ✕ o al elegir. Sirve para Anuncios y Comercios (el mismo modelo).
// =====================================================================
function conectarBotonesFiltro(caja) {
  if (!caja) return;
  const flecha = (b, abierto) => { const i = b.querySelector("i") || document.getElementById("flecha-filtros"); if (i && b.contains(i)) i.textContent = abierto ? "▴" : "▾"; };
  const cerrar = h => {
    if (!h || h.classList.contains("hidden")) return;
    h.classList.add("hidden");
    const b = caja.querySelector(`[data-fb="${h.id}"], [aria-controls="${h.id}"]`);
    if (b) { b.setAttribute("aria-expanded", "false"); flecha(b, false); b.classList.remove("fb-abierto"); }
  };
  caja.__cerrarHojas = excepto => caja.querySelectorAll(".fb-hoja").forEach(h => { if (h.id !== excepto) cerrar(h); });
  caja.addEventListener("click", e => {
    const x = e.target.closest("[data-fb-cerrar]");
    if (x) { cerrar(x.closest(".fb-hoja")); return; }
    const b = e.target.closest("[data-fb], [aria-controls].fb-mas");
    if (!b || !caja.contains(b)) return;
    const id = b.dataset.fb || b.getAttribute("aria-controls");
    caja.__cerrarHojas(id);
    if (!b.dataset.fb) { b.classList.toggle("fb-abierto", b.getAttribute("aria-expanded") === "true"); return; }   // «⚙️ Más» de anuncios: lo abre su propio código
    const h = document.getElementById(id);
    if (!h) return;
    const abrir = h.classList.contains("hidden");
    if (abrir) {
      h.classList.remove("hidden"); b.setAttribute("aria-expanded", "true"); flecha(b, true); b.classList.add("fb-abierto");
      const s = h.querySelector("select:not(.hidden), input[type=search]");
      if (s && window.matchMedia && matchMedia("(min-width: 1024px)").matches) s.focus();
    } else cerrar(h);
  });
  // Al elegir en una lista, se cierra sola (salvo cuando falta elegir algo más: subcategoría o municipio)
  caja.addEventListener("change", e => {
    const h = e.target.closest(".fb-hoja");
    if (!h || h.classList.contains("fb-hoja-mas") || h.dataset.fbQueda === "1") return;
    if (e.target.dataset.fbSigue === "1") return;
    if (e.target.id === "filtro-categoria" && !document.getElementById("filtro-subcategoria").classList.contains("hidden")) return;
    setTimeout(() => cerrar(h), 120);
  });
}
