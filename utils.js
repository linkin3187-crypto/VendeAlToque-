// ===== MercaFree - Utilidades compartidas =====
// APRENDE: este archivo se carga PRIMERO en todas las páginas. Todo lo que
// antes estaba copiado en varios archivos (escapar HTML, toast, modo editor,
// modales) vive ahora aquí, una sola vez. Si algo cambia, lo cambias en un sitio.

// EDITOR = "esta persona es moderadora/admin". Antes se activaba con ?editar=1 (cualquiera
// podía usarlo). Ahora lo decide data.js según el ROL guardado en la base de datos, y
// además las reglas RLS de la base impiden borrar o editar lo ajeno aunque alguien
// manipule esta variable desde la consola del navegador.
let EDITOR = false;
const $ = id => document.getElementById(id);

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

function tieneCoords(a) {
  return Number.isFinite(a.lat) && Number.isFinite(a.lng);
}

// Mensaje prellenado: el vendedor sabe de qué anuncio le escriben.
function urlWhatsApp(numero, nombreAnuncio) {
  const n = String(numero || "").replace(/\D/g, "");
  const texto = nombreAnuncio
    ? `Hola, vi tu anuncio «${nombreAnuncio}» en MercaFree. ¿Sigue disponible?`
    : "Hola, vi tu anuncio en MercaFree.";
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
      mostrarToast("Inicia sesión para continuar", "error");
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
    attribution: "© OpenStreetMap"
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
// CÓMO LLEGAR (Fase 2C.6): menú con opciones de transporte
// =====================================================================
// POR QUÉ solo enlaces: no hay APIs, claves ni costos, y no prometemos nada que una app
// externa no pueda cumplir. Si una app cambia su enlace, se corrige aquí, en un solo lugar.
// Privacidad: si el anuncio es de zona aproximada, TODOS los enlaces llevan a la zona, nunca al punto real.
const LINEAS_TAXI = {
  // "Envigado": [{ nombre: "Taxi Libre", tel: "6044440000" }],   ← las agrega el administrador
};

function opcionesComoLlegar(lat, lng, nombre) {
  const destino = encodeURIComponent(lat + "," + lng);
  const gm = modo => `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=${modo}`;
  const uber = "https://m.uber.com/ul/?action=setPickup&pickup=my_location" +
    `&dropoff[latitude]=${encodeURIComponent(lat)}&dropoff[longitude]=${encodeURIComponent(lng)}` +
    `&dropoff[nickname]=${encodeURIComponent(nombre || "Destino")}`;
  return {
    llegar: [
      { icono: "🚇", texto: "Transporte público (metro y buses)", url: gm("transit") },
      { icono: "🚶", texto: "A pie", url: gm("walking") },
      { icono: "🚲", texto: "En bicicleta", url: gm("bicycling") },
      { icono: "🚗", texto: "En carro o moto (Google Maps)", url: gm("driving") },
      { icono: "🧭", texto: "Navegar con Waze", url: `https://waze.com/ul?ll=${destino}&navigate=yes` }
    ],
    pedir: [
      { icono: "🚕", texto: "Pedir Uber (destino ya puesto)", url: uber }
    ],
    // DiDi e inDrive no ofrecen un enlace público fiable que lleve el destino: copiamos el punto para pegarlo en la app.
    copiar: `https://www.google.com/maps/search/?api=1&query=${destino}`
  };
}

function mensajeEncuentro(nombreAnuncio) {
  return `Hola, vi tu anuncio «${nombreAnuncio}» en MercaFree. ¿Nos vemos en un lugar público y concurrido, como una estación del metro, un centro comercial o un CAI? ¿Cuál te queda mejor?`;
}

// datos: { lat, lng, nombre, aprox, ciudad, whatsapp (opcional: activa «punto de encuentro») }
function abrirComoLlegar(datos) {
  cerrarComoLlegar();
  const op = opcionesComoLlegar(datos.lat, datos.lng, datos.nombre);
  const fila = o => `<a href="${esc(o.url)}" target="_blank" rel="noopener" class="flex items-center gap-3 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-3 text-sm font-medium"><span class="text-xl">${o.icono}</span>${esc(o.texto)}</a>`;
  const taxis = (LINEAS_TAXI[datos.ciudad] || []).map(t =>
    `<a href="tel:${esc(String(t.tel).replace(/[^\d+]/g, ""))}" class="flex items-center gap-3 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-3 text-sm font-medium"><span class="text-xl">📞</span>Taxi: ${esc(t.nombre)}</a>`).join("");
  const q = tipo => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tipo + " cerca de " + datos.lat + "," + datos.lng)}`;
  const encuentro = datos.whatsapp ? `
      <h4 class="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">🛡️ Punto de encuentro seguro</h4>
      <p class="text-xs text-slate-500 mb-2">Para compras entre personas, reúnanse en un lugar público y concurrido.</p>
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
    <p class="text-xs text-slate-500 mb-3">${datos.aprox ? "Es una <b>zona aproximada</b>: el vendedor te dará el punto exacto cuando acuerden el encuentro." : esc(datos.nombre || "")}</p>
    <div class="space-y-2">${op.llegar.map(fila).join("")}</div>
    <h4 class="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">Pedir transporte</h4>
    <div class="space-y-2">${op.pedir.map(fila).join("")}${taxis}
      <button type="button" id="cl-copiar" class="w-full flex items-center gap-3 border border-slate-200 hover:border-indigo-400 rounded-xl px-3 py-3 text-sm font-medium text-left"><span class="text-xl">📋</span>Copiar destino para DiDi o inDrive</button>
    </div>${encuentro}
    <p class="text-[11px] text-slate-400 mt-4">MercaFree no presta servicios de transporte ni tiene alianza con estas aplicaciones; son enlaces de ayuda.</p>
  </div>`;
  v.addEventListener("click", async e => {
    if (e.target === v || e.target.closest("[data-cl-cerrar]")) { cerrarComoLlegar(); return; }
    if (e.target.closest("#cl-copiar")) {
      try { await navigator.clipboard.writeText(op.copiar); mostrarToast("📋 Destino copiado: pégalo en la app"); }
      catch (err) { window.prompt("Copia el destino:", op.copiar); }
    }
  });
  document.body.appendChild(v);
  document.body.style.overflow = "hidden";
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
  abrirComoLlegar({
    lat: Number(el.dataset.lat), lng: Number(el.dataset.lng), nombre: el.dataset.nombre || "",
    aprox: el.dataset.aprox === "1", ciudad: el.dataset.ciudad || "", whatsapp: el.dataset.whatsapp || ""
  });
}, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarComoLlegar(); });
