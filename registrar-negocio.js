// ===== MercaFree - Registrar un negocio nuevo (registrar-negocio.html) =====
// La persona deja sus datos + foto de la fachada + ubicación; un moderador revisa las señales y aprueba (ver moderacion.js).
// Nada se publica hasta esa aprobación, y el sello de verificación se da aparte (2D.1).

const soloDigitos = s => String(s || "").replace(/\D/g, "");
let paso = 1, mapa = null, pin = null, pinFijado = false, gpsPos = null, fotoData = null, enviando = false;

function pintarPasos() {
  document.querySelectorAll("#rn-pasos [data-p]").forEach(li => {
    const n = Number(li.dataset.p);
    li.className = "flex-1 text-center py-1.5 rounded-lg " + (n === paso ? "bg-indigo-600 text-white" : n < paso ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-400");
  });
  document.querySelectorAll("[data-paso]").forEach(s => s.classList.toggle("hidden", Number(s.dataset.paso) !== paso));
  $("rn-atras").classList.toggle("hidden", paso === 1);
  $("rn-sig").classList.toggle("hidden", paso === 3);
  $("rn-enviar").classList.toggle("hidden", paso !== 3);
  if (paso === 2) iniciarMapa();
}

function error(msg) {
  $("rn-error").textContent = msg || "";
  $("rn-error").classList.toggle("hidden", !msg);
}

function validarPaso(n) {
  if (n === 1) {
    if ($("rn-nombre").value.trim().length < 2) return "Escribe el nombre del negocio";
    const wa = soloDigitos($("rn-wa").value), tel = $("rn-tel").value.trim();
    if (wa && wa.length !== 10) return "El WhatsApp debe tener 10 dígitos (ej. 300 123 4567)";
    if (!wa && !tel) return "Déjanos al menos un WhatsApp o un teléfono para confirmar tu negocio";
  }
  if (n === 2) {
    if ($("rn-dir").value.trim().length < 5) return "Escribe la dirección del negocio";
    if (!pinFijado) return "Marca la puerta de tu negocio en el mapa (arrastra el pin o toca el mapa)";
  }
  if (n === 3) {
    if (!fotoData) return "Sube la foto de la fachada";
    if (!$("rn-acepto").checked) return "Debes confirmar que eres el dueño o administrador y aceptar los términos";
  }
  return "";
}

// ---------- Mapa ----------
function centroMunicipio() {
  const m = municipios.find(x => x.id === Number($("rn-muni").value));
  return m && m.lat != null ? [m.lat, m.lng] : [6.2442, -75.5812];
}

function iniciarMapa() {
  const centro = pin ? pin.getLatLng() : centroMunicipio();
  if (!mapa) {
    mapa = crearMapaBase("rn-mapa", centro, 16);
    pin = L.marker(centro, { draggable: true }).addTo(mapa);
    pin.on("dragend", () => { pinFijado = true; });
    mapa.on("click", e => { pin.setLatLng(e.latlng); pinFijado = true; });
  }
  setTimeout(() => mapa.invalidateSize(), 60);
}

function moverPin(lat, lng, zoom) {
  iniciarMapa();
  pin.setLatLng([lat, lng]); mapa.setView([lat, lng], zoom || 18); pinFijado = true;
}

function usarGps() {
  if (!navigator.geolocation) { mostrarToast("Tu navegador no permite ubicación", "error"); return; }
  const b = $("rn-gps"); b.disabled = true; b.textContent = "Ubicando…";
  navigator.geolocation.getCurrentPosition(p => {
    gpsPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    moverPin(gpsPos.lat, gpsPos.lng, 19);
    b.disabled = false; b.textContent = "📍 Estoy en mi negocio";
    mostrarToast("📍 Pin puesto donde estás. Muévelo si no quedó sobre la puerta");
  }, () => {
    b.disabled = false; b.textContent = "📍 Estoy en mi negocio";
    mostrarToast("No pudimos obtener tu ubicación. Marca el pin a mano", "error");
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

async function buscarDireccion() {
  const dir = $("rn-dir").value.trim();
  if (dir.length < 5) { mostrarToast("Escribe primero la dirección", "error"); return; }
  const m = municipios.find(x => x.id === Number($("rn-muni").value));
  const b = $("rn-buscar"); b.disabled = true;
  try {
    const r = await consultarNominatim(`${dir}, ${m ? m.nombre : ""}, Colombia`, m && m.lat != null ? { lat: m.lat, lng: m.lng } : null);
    if (r) { moverPin(r.lat, r.lng, 18); mostrarToast("Revisa que el pin quede sobre tu puerta"); }
    else mostrarToast("No encontramos esa dirección. Ubica el pin a mano en el mapa", "error");
  } catch (e) { mostrarToast("No pudimos buscar ahora. Ubica el pin a mano", "error"); }
  finally { b.disabled = false; }
}

// ---------- Mis solicitudes ----------
const ESTADOS_NEG = {
  pendiente: ["⏳ En revisión", "bg-amber-100 text-amber-800"],
  aprobado: ["✅ Aprobado", "bg-green-100 text-green-800"],
  rechazado: ["✖ No aprobado", "bg-red-100 text-red-700"]
};

async function pintarMias() {
  let lista = [];
  let misCom = [];
  try { lista = await cargarNegociosPendientes(null, true); misCom = await cargarMisComercios(); } catch (e) { console.error(e); return; }
  $("rn-mis").classList.toggle("hidden", !lista.length);
  $("rn-mis-lista").innerHTML = lista.map(n => {
    const [txt, cls] = ESTADOS_NEG[n.estado] || [n.estado, "bg-slate-100"];
    return `<div class="border border-slate-200 rounded-xl p-3 text-sm">
      <div class="flex flex-wrap items-center gap-2"><b>${esc(n.nombre)}</b><span class="text-xs px-2 py-0.5 rounded-full font-semibold ${cls}">${txt}</span></div>
      ${n.estado === "rechazado" ? `<p class="text-xs text-slate-600 mt-1">Motivo: ${esc(n.motivo_rechazo || "")}</p>` : ""}
      ${n.estado === "aprobado" ? `<p class="text-xs text-slate-600 mt-1">${(() => { const c = misCom.find(x => x.id === n.comercio_id); return c && c.nivel >= 2 ? "Tu negocio está publicado y verificado. Ya puedes abrir tu vitrina." : "Tu negocio ya aparece en el mapa. Falta verificarlo (te escribiremos); con el sello se activa tu vitrina pública."; })()}</p>
        <a href="mi-tienda.html" class="text-xs text-indigo-600 underline">Ir a Mi tienda →</a>` : ""}
    </div>`;
  }).join("");
}

// ---------- Envío ----------
async function enviar(e) {
  e.preventDefault();
  if (enviando) return;
  for (const n of [1, 2, 3]) { const m = validarPaso(n); if (m) { paso = n; pintarPasos(); error(m); return; } }
  if ($("rn-web").value) { $("rn-panel").querySelector("#rn-form-caja").classList.add("hidden"); $("rn-exito").classList.remove("hidden"); return; }  // robot: se finge éxito
  enviando = true; $("rn-enviar").disabled = true; error("");
  try {
    const p = pin.getLatLng();
    const wa = soloDigitos($("rn-wa").value);
    await crearNegocioPendiente({
      nombre: $("rn-nombre").value, tipo: $("rn-tipo").value, municipioId: Number($("rn-muni").value),
      direccion: $("rn-dir").value, lat: p.lat, lng: p.lng,
      telefono: $("rn-tel").value.trim(), whatsapp: wa ? "57" + wa : null,
      horario: $("rn-hor").value.trim(), descripcion: $("rn-desc").value.trim(),
      foto: fotoData, gpsCerca: !!gpsPos && distanciaKm(gpsPos, { lat: p.lat, lng: p.lng }) <= 0.15
    });
    $("rn-form-caja").classList.add("hidden");
    $("rn-exito").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    pintarMias();
  } catch (err) {
    console.error(err);
    error(mensajeError(err));
  } finally { enviando = false; $("rn-enviar").disabled = false; }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("rn-cargando").classList.add("hidden");
  if (!usuarioActual) {
    $("rn-sin-sesion").classList.remove("hidden");
    $("rn-login").addEventListener("click", () => {
      try { sessionStorage.setItem("mf_volver", "registrar-negocio.html"); } catch (e) {}
      location.href = "index.html#login";
    });
    return;
  }
  $("rn-panel").classList.remove("hidden");
  await cargarCategoriasComercio();
  $("rn-tipo").innerHTML = opcionesCategoria("tienda");
  $("rn-tipo").value = "tienda";
  $("rn-muni").innerHTML = municipios.map(m => `<option value="${m.id}">${esc(m.nombre)} (${esc(m.departamento)})</option>`).join("");
  $("rn-muni").addEventListener("change", () => { if (!pinFijado && mapa) mapa.setView(centroMunicipio(), 16), pin.setLatLng(centroMunicipio()); });
  $("rn-gps").addEventListener("click", usarGps);
  $("rn-buscar").addEventListener("click", buscarDireccion);
  $("rn-foto").addEventListener("change", async ev => {
    const f = ev.target.files[0];
    if (!f) { fotoData = null; $("rn-foto-prev").classList.add("hidden"); return; }
    try { fotoData = await comprimir(f); $("rn-foto-prev").src = fotoData; $("rn-foto-prev").classList.remove("hidden"); }
    catch (err) { fotoData = null; mostrarToast("No se pudo leer la imagen", "error"); }
  });
  $("rn-sig").addEventListener("click", () => { const m = validarPaso(paso); error(m); if (!m) { paso++; pintarPasos(); window.scrollTo({ top: 0 }); } });
  $("rn-atras").addEventListener("click", () => { error(""); paso--; pintarPasos(); });
  $("form-registro").addEventListener("submit", enviar);
  pintarPasos();
  pintarMias();
});
