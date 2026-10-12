// ===== MercaFree - Utilidades compartidas =====
// APRENDE: este archivo se carga PRIMERO en todas las páginas. Todo lo que
// antes estaba copiado en varios archivos (escapar HTML, toast, modo editor,
// modales) vive ahora aquí, una sola vez. Si algo cambia, lo cambias en un sitio.

const EDITOR = /[?&]editar=1/.test(location.search);
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
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${color} text-white px-6 py-3 rounded-full shadow-lg z-[200] font-medium text-sm max-w-[90vw] text-center`;
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
  if (abrir) { abrirModal(abrir.dataset.abrir); return; }

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
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34]
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
