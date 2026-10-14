// ===== MercaFree - Importar y gestionar comercios (admin-comercios.html) =====
// POR QUÉ la importación corre en TU navegador: el servidor donde trabaja Claude no puede
// llamar a Overpass, pero tu navegador sí. La seguridad no depende de esta página: la base
// de datos solo deja escribir en `comercios` a cuentas con rol moderador/admin.

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const CUOTA_DEFECTO = { farmacia: 2, cajero: 2, comida_rapida: 2, panaderia: 2, supermercado: 1, banco: 1 };
let candidatos = [];      // vista previa: [{fila, marcado}]
let listaAdmin = [];

const dormir = ms => new Promise(r => setTimeout(r, ms));

// ---------- Overpass ----------
// Consulta ligera por municipio: solo nodos y áreas (sin relaciones) y máximo 400 elementos.
function consultaOverpass(m, radio) {
  const a = `(around:${radio},${m.lat},${m.lng})`;
  const am = '["amenity"~"^(pharmacy|atm|fast_food|bank)$"]', sh = '["shop"~"^(bakery|supermarket)$"]';
  return `[out:json][timeout:20][maxsize:8000000];(node${a}${am};way${a}${am};node${a}${sh};way${a}${sh};);out center tags qt 400;`;
}

let cancelar = false;
const controles = new Set();          // peticiones en vuelo (para poder abortarlas al cancelar)
const ESCALONADO_MS = 6000;           // si el servidor 1 no responde en 6 s, se lanza también el 2, y luego el 3
const TIEMPO_MAX_MS = 25000;          // tope por petición

// "Peticiones con relevo": lanza el servidor 1; si tarda o falla, suma el 2 y el 3 sin cancelar el anterior.
// Gana el primero que responda bien y se abortan los demás. Con servidores públicos saturados es lo que más ayuda.
function pedirOverpass(consulta) {
  return new Promise((ok, mal) => {
    let siguiente = 0, vivos = 0, terminado = false, temporizador = null;
    const mios = [], errores = [];
    const fin = (fn, valor) => {
      if (terminado) return;
      terminado = true; clearTimeout(temporizador);
      mios.forEach(c => { c.abort(); controles.delete(c); });
      fn(valor);
    };
    const programar = () => {
      clearTimeout(temporizador);
      if (!terminado && siguiente < OVERPASS.length) temporizador = setTimeout(() => { if (lanzar()) programar(); }, ESCALONADO_MS);
    };
    const lanzar = () => {
      if (terminado || cancelar || siguiente >= OVERPASS.length) return false;
      const url = OVERPASS[siguiente++];
      const ctl = new AbortController(); mios.push(ctl); controles.add(ctl); vivos++;
      const t = setTimeout(() => ctl.abort(), TIEMPO_MAX_MS);
      fetch(url, { method: "POST", body: "data=" + encodeURIComponent(consulta), signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } })
        .then(r => { if (!r.ok) throw new Error("respondió " + r.status); return r.json(); })
        .then(d => { if (!d || !Array.isArray(d.elements)) throw new Error("respuesta vacía"); fin(ok, d); })
        .catch(e => {
          errores.push(new URL(url).hostname + ": " + (e.name === "AbortError" ? (cancelar ? "cancelado" : "tardó demasiado") : (e.message || "sin conexión")));
        })
        .finally(() => {
          clearTimeout(t); vivos--;
          if (terminado) return;
          if (cancelar) { if (vivos === 0) fin(mal, new Error("Cancelado")); return; }
          if (lanzar()) programar();                                // falló uno: sube el siguiente ya
          else if (vivos === 0) fin(mal, new Error("Ningún servidor respondió (" + errores.join("; ") + ")"));
        });
      return true;
    };
    lanzar(); programar();
  });
}

function cancelarBusqueda() {
  cancelar = true;
  controles.forEach(c => c.abort());   // corta las peticiones que estén esperando
  $("ac-estado").textContent = "Cancelando…";
}

function tipoDeTags(t) {
  if (t.amenity === "pharmacy") return "farmacia";
  if (t.amenity === "atm") return "cajero";
  if (t.amenity === "fast_food") return "comida_rapida";
  if (t.shop === "bakery") return "panaderia";
  if (t.shop === "supermarket") return "supermercado";
  if (t.amenity === "bank") return "banco";
  return null;
}

function aFila(el, muni) {
  const t = el.tags || {};
  const tipo = tipoDeTags(t);
  if (!tipo) return null;
  const lat = el.lat ?? (el.center && el.center.lat), lng = el.lon ?? (el.center && el.center.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let nombre = (t.name || t.brand || t.operator || "").trim();
  if (!nombre && tipo === "cajero") nombre = "Cajero automático";
  if (nombre.length < 2) return null;                       // sin nombre no sirve en un directorio
  const dir = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ").trim();
  return {
    osm_id: el.type + "/" + el.id,
    nombre: nombre.slice(0, 100),
    tipo, municipio_id: muni.id,
    direccion: dir ? dir.slice(0, 160) : null,
    telefono: (t.phone || t["contact:phone"] || "").slice(0, 40) || null,
    horario: (t.opening_hours || "").slice(0, 120) || null,
    lat: +lat.toFixed(6), lng: +lng.toFixed(6),
    verificado: false, activo: true, fuente: "OpenStreetMap"
  };
}

// Elige los más cercanos al centro, sin repetir y sin pasarse de la cuota.
// `existentes` = lo que ya está guardado en ese municipio: sus osm_id se omiten (aunque estén ocultos)
// y lo que ya hay VISIBLE cuenta dentro de la cuota (así volver a importar no agrega más de lo pedido).
function elegir(filas, muni, cuota, existentes) {
  const centro = { lat: muni.lat, lng: muni.lng };
  const ids = new Set(existentes.map(e => e.osmId).filter(Boolean));
  const porTipo = {}, omitidos = { yaGuardado: 0, parecido: 0 };
  existentes.filter(e => e.activo).forEach(e => { (porTipo[e.tipo] = porTipo[e.tipo] || []).push(e); });
  const nuevos = [];
  filas.sort((a, b) => distanciaKm(centro, a) - distanciaKm(centro, b)).forEach(f => {
    if (ids.has(f.osm_id)) { omitidos.yaGuardado++; return; }
    const grupo = porTipo[f.tipo] = porTipo[f.tipo] || [];
    // misma marca y mismo tipo a menos de 60 m de uno guardado o ya elegido = es el mismo lugar
    const todos = existentes.filter(e => e.tipo === f.tipo).concat(grupo, nuevos.filter(n => n.tipo === f.tipo));
    if (todos.some(g => normalizar(g.nombre) === normalizar(f.nombre) && distanciaKm(g, f) < 0.06)) { omitidos.parecido++; return; }
    if (grupo.length >= (cuota[f.tipo] || 0)) return;
    grupo.push(f); nuevos.push(f);
  });
  return { nuevos, omitidos };
}

function leerCuotas() {
  const c = {};
  TIPOS_COMERCIO.forEach(t => { c[t.id] = Math.max(0, Math.min(10, parseInt($("cuota-" + t.id).value, 10) || 0)); });
  return c;
}

const estadoMuni = {};   // id municipio → "pend" | "buscando" | "ok" | "fallo"

function pintarProgreso(lista) {
  const icono = { pend: "⏳", buscando: "🔎", ok: "✔", fallo: "✖" };
  $("ac-progreso").innerHTML = lista.map(m =>
    `<li class="px-2 py-1 rounded-full border ${estadoMuni[m.id] === "fallo" ? "bg-red-50 border-red-200 text-red-700" : estadoMuni[m.id] === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-600"}">${icono[estadoMuni[m.id]] || "⏳"} ${esc(m.nombre)}</li>`).join("");
}

async function buscar(soloFallidos) {
  const btn = $("ac-buscar");
  btn.disabled = true; cancelar = false;
  $("ac-cancelar").classList.remove("hidden");
  $("ac-reintentar").classList.add("hidden");
  const cuota = leerCuotas();
  const radio = parseInt($("ac-radio").value, 10);
  const sel = $("ac-muni").value;
  let lista = municipios.filter(m => sel === "todos" || String(m.id) === sel);
  if (soloFallidos === true) lista = lista.filter(m => estadoMuni[m.id] === "fallo");
  else candidatos = [];
  lista.forEach(m => { estadoMuni[m.id] = "pend"; });
  const inicio = Date.now(), totales = { yaGuardado: 0, parecido: 0 };
  let existentes;
  try {
    pintarProgreso(lista);
    $("ac-estado").textContent = "Revisando lo que ya tienes guardado…";
    existentes = await cargarComerciosAdmin();
    for (let i = 0; i < lista.length && !cancelar; i++) {
      const m = lista[i];
      estadoMuni[m.id] = "buscando"; pintarProgreso(lista);
      const tick = setInterval(() => { $("ac-estado").textContent = `Buscando en ${m.nombre} (${i + 1}/${lista.length})… ${Math.round((Date.now() - inicio) / 1000)} s`; }, 500);
      try {
        const datos = await pedirOverpass(consultaOverpass(m, radio));
        const filas = (datos.elements || []).map(el => aFila(el, m)).filter(Boolean);
        const ya = existentes.filter(e => e.municipioId === m.id)
          .concat(candidatos.filter(c => c.fila.municipio_id === m.id).map(c => ({ ...c.fila, osmId: c.fila.osm_id, activo: true })));
        const { nuevos, omitidos } = elegir(filas, m, cuota, ya);
        totales.yaGuardado += omitidos.yaGuardado; totales.parecido += omitidos.parecido;
        nuevos.forEach(f => candidatos.push({ fila: f, marcado: true }));
        estadoMuni[m.id] = "ok";
        pintarPrevia();
      } catch (e) {
        console.warn(m.nombre, e.message);
        estadoMuni[m.id] = cancelar ? "pend" : "fallo";
      } finally { clearInterval(tick); }
      pintarProgreso(lista);
      if (i < lista.length - 1 && !cancelar) await dormir(800);
    }
    const fallaron = lista.filter(m => estadoMuni[m.id] === "fallo");
    let msg = cancelar ? "Búsqueda cancelada. " : "";
    if (totales.yaGuardado || totales.parecido) msg += `Se omitieron ${totales.yaGuardado + totales.parecido} que ya estaban guardados o eran el mismo lugar. `;
    if (fallaron.length) { msg += `⚠️ No respondieron: ${fallaron.map(m => m.nombre).join(", ")}.`; $("ac-reintentar").classList.remove("hidden"); }
    else if (!cancelar && !candidatos.length) msg += "No hay comercios nuevos para esos filtros (o ya tienes la cuota completa). Prueba subiendo la cuota o el radio.";
    $("ac-estado").textContent = msg;
  } catch (e) {
    console.error(e);
    $("ac-estado").textContent = "⚠️ " + (e.message || e);
  } finally {
    btn.disabled = false;
    $("ac-cancelar").classList.add("hidden");
  }
}

function nombreMuni(id) { return (municipios.find(m => m.id === id) || {}).nombre || ""; }

function pintarPrevia() {
  $("ac-previa").classList.toggle("hidden", !candidatos.length);
  $("ac-previa-lista").innerHTML = candidatos.map((c, i) => {
    const f = c.fila;
    return `<label class="flex items-start gap-2 p-2.5 hover:bg-slate-50 cursor-pointer">
      <input type="checkbox" data-i="${i}" ${c.marcado ? "checked" : ""} class="mt-1">
      <span class="min-w-0"><b>${esc(iconosComercio[f.tipo])} ${esc(f.nombre)}</b>
        <span class="text-slate-500"> · ${esc(nombreMuni(f.municipio_id))}${f.direccion ? " · " + esc(f.direccion) : ""}${f.telefono ? " · 📞 " + esc(f.telefono) : ""}</span></span>
    </label>`;
  }).join("");
  actualizarResumen();
}

function actualizarResumen() {
  const n = candidatos.filter(c => c.marcado).length;
  $("ac-resumen").textContent = `${n} de ${candidatos.length} seleccionados`;
}

async function guardarSeleccion() {
  const filas = candidatos.filter(c => c.marcado).map(c => c.fila);
  if (!filas.length) { mostrarToast("No hay comercios seleccionados", "error"); return; }
  const btn = $("ac-importar");
  btn.disabled = true;
  try {
    const nuevos = await importarComerciosDB(filas);
    mostrarToast(`✅ ${nuevos} comercios nuevos guardados (${filas.length - nuevos} ya existían)`);
    candidatos = [];
    pintarPrevia();
    await refrescarLista();
  } catch (e) {
    console.error(e);
    mostrarToast(mensajeError(e), "error");
  } finally { btn.disabled = false; }
}

// ---------- Editor / verificación ----------
function urlMapa(c) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.lat + "," + c.lng); }
function urlMapaNombre(c) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.nombre + " " + c.ciudad + " Antioquia"); }

function filaEditor(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const campo = (k, etq, v, ph) => `<label class="text-xs font-bold text-slate-500">${etq}
    <input data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>`;
  return `<article class="border border-slate-200 rounded-xl p-3" data-id="${c.id}">
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <b>${esc(t ? t.icono : "📍")} ${esc(c.nombre)}</b>
      <span class="text-xs text-slate-500">${esc(c.ciudad)}</span>
      ${c.verificado ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">✔ Verificado</span>' : '<span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Sin verificar</span>'}
      ${c.activo ? "" : '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculto</span>'}
      <a href="${esc(urlMapa(c))}" target="_blank" rel="noopener" class="ml-auto text-xs bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg font-semibold">🗺️ Ver pin</a>
      <a href="${esc(urlMapaNombre(c))}" target="_blank" rel="noopener" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-1.5 rounded-lg font-semibold">🔎 Buscar en Google</a>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      ${campo("nombre", "Nombre", c.nombre, "")}
      ${campo("direccion", "Dirección", c.direccion, "Cra 43A # 10-20")}
      ${campo("telefono", "Teléfono", c.telefono, "604 123 4567")}
      ${campo("horario", "Horario", c.horario, "Lun-Sáb 8:00-20:00")}
      <label class="text-xs font-bold text-slate-500 sm:col-span-2">Foto del local
        <div class="flex items-center gap-2 mt-0.5">
          ${c.foto ? `<img src="${esc(urlSegura(c.foto))}" alt="" class="w-10 h-10 rounded object-cover">` : ""}
          <input type="file" data-foto accept="image/*" class="text-xs font-normal">
        </div></label>
    </div>
    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm">
      <label class="flex items-center gap-1.5"><input type="checkbox" data-k="verificado" ${c.verificado ? "checked" : ""}> Verificado</label>
      <label class="flex items-center gap-1.5"><input type="checkbox" data-k="activo" ${c.activo ? "checked" : ""}> Visible en el mapa</label>
      <button type="button" data-acc="guardar" class="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm disabled:opacity-60">Guardar</button>
      <button type="button" data-acc="borrar" class="text-red-600 hover:underline text-xs">Borrar</button>
    </div>
  </article>`;
}

function pintarLista() {
  const m = $("ac-filtro-muni").value, v = $("ac-filtro-ver").value;
  const lista = listaAdmin.filter(c => (!m || String(c.municipioId) === m) && (!v || (v === "si") === c.verificado));
  $("ac-lista").innerHTML = lista.length ? lista.map(filaEditor).join("")
    : '<p class="text-sm text-slate-400 text-center py-8">Aún no hay comercios. Importa algunos arriba.</p>';
}

async function refrescarLista() {
  try { listaAdmin = await cargarComerciosAdmin(); pintarLista(); }
  catch (e) { mostrarToast(mensajeError(e), "error"); }
}

// Reduce la foto a 800 px de ancho (JPEG) antes de subirla: ahorra espacio y datos.
function comprimir(file) {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onerror = () => mal(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => mal(new Error("Imagen no válida"));
      img.onload = () => {
        const esc_ = Math.min(1, 800 / img.width);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * esc_); cv.height = Math.round(img.height * esc_);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        ok(cv.toDataURL("image/jpeg", 0.8));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

async function accionEditor(e) {
  const b = e.target.closest("[data-acc]");
  const fila = e.target.closest("[data-id]");
  if (!b || !fila) return;
  const id = Number(fila.dataset.id);
  b.disabled = true;
  try {
    if (b.dataset.acc === "borrar") {
      if (!confirm("¿Borrar este comercio? Si solo no existe, mejor desmarca “Visible”: así una nueva importación no lo vuelve a traer.")) { b.disabled = false; return; }
      await eliminarComercioDB(id);
      mostrarToast("🗑️ Comercio borrado");
    } else {
      const val = k => fila.querySelector(`[data-k="${k}"]`);
      const texto = k => { const v = val(k).value.trim(); return v || null; };
      const nombre = texto("nombre");
      if (!nombre || nombre.length < 2) throw new Error("El nombre es obligatorio");
      const cambios = {
        nombre, direccion: texto("direccion"), telefono: texto("telefono"), horario: texto("horario"),
        verificado: val("verificado").checked, activo: val("activo").checked
      };
      const archivo = fila.querySelector("[data-foto]").files[0];
      if (archivo) cambios.foto_url = await subirFotoComercio(await comprimir(archivo));
      await guardarComercioDB(id, cambios);
      mostrarToast("✅ Guardado");
    }
    await refrescarLista();
  } catch (err) {
    console.error(err);
    b.disabled = false;
    mostrarToast(mensajeError(err), "error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("ac-cargando").classList.add("hidden");
  if (!esModerador()) { $("ac-sin-permiso").classList.remove("hidden"); return; }
  $("ac-panel").classList.remove("hidden");

  $("ac-cuotas").innerHTML = TIPOS_COMERCIO.map(t => `<label class="text-xs font-bold text-slate-500">${t.icono} ${esc(t.nombre)}
    <input type="number" id="cuota-${t.id}" min="0" max="10" value="${CUOTA_DEFECTO[t.id]}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm"></label>`).join("");
  const opciones = municipios.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join("");
  $("ac-muni").innerHTML = '<option value="todos">Todos (10)</option>' + opciones;
  $("ac-filtro-muni").innerHTML = '<option value="">Todos los municipios</option>' + opciones;

  $("ac-buscar").addEventListener("click", () => buscar(false));
  $("ac-reintentar").addEventListener("click", () => buscar(true));
  $("ac-cancelar").addEventListener("click", cancelarBusqueda);
  $("ac-importar").addEventListener("click", guardarSeleccion);
  $("ac-previa-lista").addEventListener("change", e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    candidatos[Number(i)].marcado = e.target.checked;
    actualizarResumen();
  });
  $("ac-lista").addEventListener("click", accionEditor);
  ["ac-filtro-muni", "ac-filtro-ver"].forEach(id => $(id).addEventListener("change", pintarLista));
  $("ac-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  await refrescarLista();
});
