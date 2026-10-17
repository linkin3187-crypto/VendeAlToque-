// ===== MercaFree · Recomendar un comercio (Fase 2X) =====
// recomendar.html[?nombre=…]  ·  La gente recomienda negocios que visita y no están en el mapa.
// Se guarda en `recomendaciones_comercio` (supabase/17_recomendaciones.sql); un moderador lo crea o lo descarta.

let gpsRc = null;      // {lat, lng, precision} si tocó «Estoy aquí»
let fotoRc = null;     // data:image/jpeg comprimida

const ESTADOS_RC = {
  pendiente:  { txt: "⏳ En revisión", cls: "bg-amber-100 text-amber-800" },
  creado:     { txt: "✅ Agregado al mapa", cls: "bg-green-100 text-green-800" },
  descartado: { txt: "No se agregó", cls: "bg-slate-100 text-slate-600" }
};

// Municipio más cercano a un punto (para elegirlo solo al usar el GPS)
function municipioCercano(p) {
  let mejor = null, dMin = Infinity;
  municipios.forEach(m => {
    if (m.lat == null || m.lng == null) return;
    const d = distanciaKm(p, { lat: Number(m.lat), lng: Number(m.lng) });
    if (d < dMin) { dMin = d; mejor = m; }
  });
  return dMin < 40 ? mejor : null;
}

async function usarGpsRc() {
  const b = $("rc-gps");
  b.disabled = true; b.textContent = "📡 Buscando tu ubicación…";
  try {
    const p = await obtenerGPS();
    gpsRc = p;
    const m = municipioCercano(p);
    if (m) $("rc-muni").value = String(m.id);
    $("rc-gps-ok").textContent = "✔ Ubicación guardada" + (m ? ` (cerca de ${m.nombre})` : "") + ". Si no estás en el comercio, mejor escribe la dirección.";
    $("rc-gps-ok").classList.remove("hidden");
    b.textContent = "📍 Ubicación lista · tocar para actualizar";
  } catch (e) {
    mostrarToast(textoErrorGPS(e) + " Escribe la dirección.", "error");
    b.textContent = "📍 Estoy aquí, en el comercio";
  } finally { b.disabled = false; }
}

function errorRc(m) {
  $("rc-error").textContent = m || "";
  $("rc-error").classList.toggle("hidden", !m);
  return !m;
}

async function enviarRc(e) {
  e.preventDefault();
  if ($("rc-web").value) return;                       // robot
  const nombre = $("rc-nombre").value.trim();
  const dir = $("rc-dir").value.trim();
  if (nombre.length < 2) { errorRc("Escribe el nombre del comercio"); $("rc-nombre").focus(); return; }
  if (!$("rc-muni").value) { errorRc("Elige el municipio"); return; }
  if (!gpsRc && dir.length < 5) { errorRc("Toca «Estoy aquí» o escribe la dirección o una referencia"); $("rc-dir").focus(); return; }
  // ¿Ya está en el directorio? (mismo nombre en el mismo municipio)
  const muniId = Number($("rc-muni").value);
  const ya = comercios.find(c => c.municipioId === muniId && normalizar(c.nombre) === normalizar(nombre));
  if (ya && !confirm(`Ya tenemos «${ya.nombre}» en ${ya.ciudad}. ¿Es otro comercio distinto?`)) {
    location.href = "tienda.html?id=" + ya.id; return;
  }
  errorRc("");
  const b = $("rc-enviar"); b.disabled = true; b.textContent = "Enviando…";
  try {
    await crearRecomendacion({
      nombre, tipo: $("rc-tipo").value, municipioId: muniId, direccion: dir,
      lat: gpsRc ? gpsRc.lat : null, lng: gpsRc ? gpsRc.lng : null,
      foto: fotoRc, comentario: $("rc-coment").value
    });
    mostrarToast("🙌 ¡Gracias! Lo revisamos y lo agregamos al mapa");
    $("form-recomendar").reset();
    gpsRc = null; fotoRc = null;
    $("rc-foto-prev").classList.add("hidden"); $("rc-gps-ok").classList.add("hidden");
    $("rc-gps").textContent = "📍 Estoy aquí, en el comercio";
    $("rc-tipo").value = "tienda";
    pintarMisRc();
  } catch (err) { errorRc(mensajeError(err)); }
  finally { b.disabled = false; b.textContent = "🤝 Enviar recomendación"; }
}

async function pintarMisRc() {
  try {
    const lista = await cargarMisRecomendaciones();
    $("rc-mis").classList.toggle("hidden", !lista.length);
    $("rc-mis-lista").innerHTML = lista.map(r => {
      const e = ESTADOS_RC[r.estado] || ESTADOS_RC.pendiente;
      const t = TIPOS_COMERCIO.find(x => x.id === r.tipo);
      const m = municipios.find(x => x.id === r.municipio_id);
      return `<div class="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2">
        <div class="min-w-0"><p class="font-bold text-sm text-slate-800">${esc(t ? t.icono : "🏪")} ${esc(r.nombre)}</p>
          <p class="text-xs text-slate-500">${esc(m ? m.nombre : "")} · ${esc(new Date(r.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "short" }))}</p></div>
        <div class="flex items-center gap-2"><span class="text-xs font-bold px-2 py-0.5 rounded-full ${e.cls}">${e.txt}</span>
          ${r.estado === "creado" && r.comercio_id ? `<a href="tienda.html?id=${r.comercio_id}" class="text-xs font-bold text-indigo-600 underline">Ver</a>` : ""}</div>
      </div>`;
    }).join("");
  } catch (e) { $("rc-mis").classList.add("hidden"); }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("rc-cargando").classList.add("hidden");
  if (!usuarioActual) {
    $("rc-sin-sesion").classList.remove("hidden");
    $("rc-login").addEventListener("click", () => {
      try { sessionStorage.setItem("mf_volver", "recomendar.html"); } catch (e) {}
      location.href = "index.html#login";
    });
    return;
  }
  $("rc-panel").classList.remove("hidden");
  await cargarComercios();               // también carga las categorías
  $("rc-tipo").innerHTML = opcionesCategoria("tienda");
  $("rc-tipo").value = "tienda";
  const munis = municipios.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  $("rc-muni").innerHTML = '<option value="">Elige el municipio…</option>' + munis.map(m => `<option value="${m.id}">${esc(m.nombre)} (${esc(m.departamento)})</option>`).join("");
  const nombre = new URLSearchParams(location.search).get("nombre");
  if (nombre) $("rc-nombre").value = nombre.slice(0, 100);
  $("rc-gps").addEventListener("click", usarGpsRc);
  ["rc-foto", "rc-foto-cam"].forEach(id => $(id).addEventListener("change", async ev => {
    const f = ev.target.files[0];
    if (!f) return;   // canceló: se conserva la foto que ya tenía
    try { fotoRc = await comprimir(f); $("rc-foto-prev").src = fotoRc; $("rc-foto-prev").classList.remove("hidden"); }
    catch (err) { fotoRc = null; mostrarToast("No se pudo leer la imagen", "error"); }
  }));
  $("form-recomendar").addEventListener("submit", enviarRc);
  pintarMisRc();
});
