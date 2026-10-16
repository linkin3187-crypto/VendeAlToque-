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
  TIPOS_IMPORTABLES.forEach(t => { c[t.id] = Math.max(0, Math.min(10, parseInt($("cuota-" + t.id).value, 10) || 0)); });
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
      <span class="text-xs ${(SELLOS[c.nivel] || SELLOS[1]).clase} px-2 py-0.5 rounded-full font-semibold">${c.nivel >= 2 ? "✔ " : ""}${esc((SELLOS[c.nivel] || SELLOS[1]).corto)}${c.verificadoEn ? " · " + esc(fechaSello(c)) : ""}</span>
      ${selloVencido(c) ? '<span class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-semibold">⚠ Vencida: repetir verificación</span>' : ""}
      ${c.activo ? "" : '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculto</span>'}
      <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${ORIGENES[origenComercio(c)].icono} ${esc(ORIGENES[origenComercio(c)].corto)}</span>
      <button type="button" data-acc="verificar" class="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg font-semibold">✅ Verificar</button>
      <button type="button" data-acc="ubicacion" class=" text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-semibold">📍 Corregir ubicación</button>
      <a href="${esc(urlMapa(c))}" target="_blank" rel="noopener" class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg font-semibold">🗺️ Ver pin</a>
      <a href="${esc(urlMapaNombre(c))}" target="_blank" rel="noopener" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-1.5 rounded-lg font-semibold">🔎 Buscar en Google</a>
      <a href="referidos.html?destino=tienda&id=${c.id}&codigo=${esc(encodeURIComponent(slugRef("tienda-" + c.nombre)))}" class="text-xs bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 py-1.5 rounded-lg font-semibold">🔳 QR del comercio</a>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      ${campo("nombre", "Nombre", c.nombre, "")}
      ${campo("direccion", "Dirección", c.direccion, "Cra 43A # 10-20")}
      ${campo("telefono", "Teléfono", c.telefono, "604 123 4567")}
      ${campo("horario", "Horario", c.horario, "Lun-Sáb 8:00-20:00")}
      <label class="text-xs font-bold text-slate-500">🏷️ Categoría principal
        <select data-k="tipo" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesCategoria(c.tipo)}</select></label>
      <label class="text-xs font-bold text-slate-500">Secundaria 1 (opcional)
        <select data-extra class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesCategoria((c.tiposExtra || [])[0] || "", "— Ninguna —")}</select></label>
      <label class="text-xs font-bold text-slate-500">Secundaria 2 (opcional)
        <select data-extra class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesCategoria((c.tiposExtra || [])[1] || "", "— Ninguna —")}</select></label>
      <label class="text-xs font-bold text-slate-500 sm:col-span-2">Foto del local
        <div class="flex items-center gap-2 mt-0.5">
          ${c.foto ? `<img src="${esc(urlSegura(c.foto))}" alt="" class="w-10 h-10 rounded object-cover">` : ""}
          <input type="file" data-foto accept="image/*" class="text-xs font-normal">
        </div></label>
    </div>
    <div class="flex flex-wrap items-center gap-2 mt-2 text-xs">
      <span class="font-bold text-slate-500">🙋 Dueño:</span>
      ${c.ownerId ? '<span class="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold">asignado</span>' : '<span class="text-slate-400">sin asignar</span>'}
      <input data-dueno placeholder="correo de su cuenta" class="border border-slate-300 p-1.5 rounded-lg w-44 sm:w-56">
      <button type="button" data-acc="dueno" class="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-2.5 py-1.5 rounded-lg">Asignar</button>
      ${c.ownerId ? '<button type="button" data-acc="quitar-dueno" class="text-red-600 hover:underline">Quitar</button>' : ""}
      ${c.nProductos ? `<a href="tienda.html?id=${c.id}" class="ml-auto text-indigo-600 underline">🛍️ ${c.nProductos} producto(s)</a>` : ""}
    </div>
    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm">
      <label class="flex items-center gap-1.5"><input type="checkbox" data-k="activo" ${c.activo ? "checked" : ""}> Visible en el mapa</label>
      <button type="button" data-acc="guardar" class="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm disabled:opacity-60">Guardar</button>
      <button type="button" data-acc="borrar" class="text-red-600 hover:underline text-xs">Borrar</button>
    </div>
  </article>`;
}

let soloId = null;   // ?editar=<id>: muestra solo ese comercio (viene de «✏️ Editar» en el inicio)
let origenAct = "todos", limiteLista = 40;

// Estado de verificación de un comercio (el filtro principal)
function pasaEstado(c, v) {
  if (v === "no") return c.nivel === 1;
  if (v === "tel") return c.nivel === 2;
  if (v === "persona") return c.nivel === 3;
  if (v === "vencida") return selloVencido(c);
  if (v === "oculto") return !c.activo;
  return true;
}

function pintarLista() {
  $("ac-solo-uno").classList.toggle("hidden", soloId === null);
  const m = $("ac-filtro-muni").value, v = $("ac-filtro-ver").value, q = normalizar($("ac-buscar-nombre").value.trim());
  // Base: estado + municipio + texto. Los contadores de origen se calculan sobre esta base.
  const base = listaAdmin.filter(c => (!m || String(c.municipioId) === m) && pasaEstado(c, v)
    && (!q || normalizar(c.nombre + " " + c.direccion).includes(q)));
  const cuenta = { todos: base.length, osm: 0, equipo: 0, dueno: 0, reclamado: 0, comunidad: 0 };
  base.forEach(c => { cuenta[origenComercio(c)]++; });
  $("ac-origenes").innerHTML = [["todos", "Todos"]].concat(Object.entries(ORIGENES).map(([k, o]) => [k, o.icono + " " + o.corto]))
    .map(([k, txt]) => `<button type="button" role="tab" data-origen="${k}" class="text-xs font-semibold px-3 py-1.5 rounded-full border ${origenAct === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"}">${txt} <b>${cuenta[k]}</b></button>`).join("");
  const lista = soloId !== null ? listaAdmin.filter(c => c.id === soloId)
    : base.filter(c => origenAct === "todos" || origenComercio(c) === origenAct);
  const visibles = soloId !== null ? lista : lista.slice(0, limiteLista);
  $("ac-lista").innerHTML = lista.length
    ? (origenAct !== "todos" && soloId === null ? `<p class="text-xs text-slate-500">${esc(ORIGENES[origenAct].nombre)}</p>` : "") + visibles.map(filaEditor).join("")
      + (lista.length > visibles.length ? `<div class="text-center"><button type="button" id="ac-mas" class="bg-white border border-slate-300 hover:border-indigo-400 font-semibold px-5 py-2 rounded-xl text-sm">Ver ${Math.min(40, lista.length - visibles.length)} más (${lista.length - visibles.length} restantes)</button></div>` : "")
    : `<p class="text-sm text-slate-400 text-center py-8">${listaAdmin.length ? "No hay comercios con estos filtros 🎉" : "Aún no hay comercios. Importa algunos arriba o usa «Agregar comercio»."}</p>`;
  pintarPendientes();
}

// ---------- Resumen de pendientes ----------
let otrosPend = { negocios: null, solicitudes: null, reportes: null, comercios: null, recomendados: null };

function tarjetaPend(icono, n, texto, atributos, href) {
  const cls = "text-left border rounded-xl p-3 " + (n > 0 ? "border-indigo-200 bg-indigo-50 hover:border-indigo-400" : "border-slate-200 bg-slate-50 text-slate-400");
  const cuerpo = `<span class="text-xl">${icono}</span><span class="block text-2xl font-black ${n > 0 ? "text-indigo-900" : ""}">${n === null ? "…" : n}</span><span class="block text-xs font-semibold">${texto}</span>`;
  return href ? `<a href="${href}" class="${cls} no-underline text-inherit">${cuerpo}</a>` : `<button type="button" ${atributos} class="${cls}">${cuerpo}</button>`;
}

function pintarPendientes() {
  const sinVer = o => listaAdmin.filter(c => c.nivel === 1 && c.activo && origenComercio(c) === o).length;
  $("ac-pend-grid").innerHTML = [
    tarjetaPend("➕", otrosPend.negocios, "Negocios nuevos por aprobar", "", "moderacion.html#negocios"),
    tarjetaPend("🤝", otrosPend.recomendados, "Recomendados por la gente, por revisar", "", "moderacion.html#recomendados"),
    tarjetaPend("🙋", sinVer("dueno"), "Aprobados por ti, sin verificar", 'data-ir="dueno"'),
    tarjetaPend("🔑", sinVer("reclamado"), "Reclamados, sin verificar", 'data-ir="reclamado"'),
    tarjetaPend("🛠️", sinVer("equipo"), "Agregados por el equipo, sin verificar", 'data-ir="equipo"'),
    tarjetaPend("🤝", sinVer("comunidad"), "Recomendados ya creados, sin verificar", 'data-ir="comunidad"'),
    tarjetaPend("📥", sinVer("osm"), "Importados, sin verificar", 'data-ir="osm"'),
    tarjetaPend("📨", otrosPend.solicitudes, "Solicitudes de comercios", "", "moderacion.html#solicitudes"),
    tarjetaPend("⚠️", otrosPend.comercios, "Comercios reportados", "", "moderacion.html#reportes-comercios"),
    tarjetaPend("🛍️", otrosPend.reportes, "Productos reportados", "", "moderacion.html#productos"),
    tarjetaPend("⏰", listaAdmin.filter(selloVencido).length, "Verificaciones vencidas", 'data-ir-estado="vencida"')
  ].join("");
}

async function cargarOtrosPendientes() {
  const leer = async (k, f) => { try { otrosPend[k] = (await f()).length; } catch (e) { otrosPend[k] = null; } };
  await Promise.all([
    leer("negocios", () => cargarNegociosPendientes("pendiente", false)),
    leer("solicitudes", () => cargarSolicitudesComercio("pendiente")),
    leer("reportes", () => cargarReportesProducto("pendiente")),
    leer("comercios", () => cargarReportesComercio("pendiente")),
    leer("recomendados", () => cargarRecomendaciones("pendiente"))
  ]);
  pintarPendientes();
}

async function refrescarLista() {
  try { listaAdmin = await cargarComerciosAdmin(); limiteLista = 40; pintarLista(); if ($("cat-lista")) pintarCategorias(); }
  catch (e) { mostrarToast(mensajeError(e), "error"); }
}

// ---------- Agregar un comercio a mano ----------
let mapaNu = null, marcadorNu = null, coordsNu = null;

function fijarCoordsNu(lat, lng, mover) {
  coordsNu = { lat, lng };
  if (mover && marcadorNu) marcadorNu.setLatLng([lat, lng]);
  $("nu-coords").textContent = lat.toFixed(5) + ", " + lng.toFixed(5);
}

function centroNu() {
  const m = municipios.find(x => x.id === Number($("nu-muni").value));
  return m && m.lat != null ? [m.lat, m.lng] : [6.2442, -75.5812];
}

function abrirNuevo() {
  coordsNu = null; recomendacionNu = null; $("nu-error").classList.add("hidden");
  if ($("nu-rec-aviso")) $("nu-rec-aviso").classList.add("hidden");
  ["nu-nombre", "nu-dir", "nu-tel", "nu-wa", "nu-hor", "nu-desc"].forEach(id => { $(id).value = ""; });
  $("nu-foto").value = "";
  $("nu-coords").textContent = "Toca el mapa o arrastra el pin hasta la puerta del local";
  abrirModal("modal-nuevo");
  const centro = centroNu();
  if (!mapaNu) {
    mapaNu = crearMapaBase("map-nuevo", centro, 16);
    marcadorNu = L.marker(centro, { draggable: true }).addTo(mapaNu);
    marcadorNu.on("dragend", () => { const p = marcadorNu.getLatLng(); fijarCoordsNu(p.lat, p.lng, false); });
    mapaNu.on("click", e => fijarCoordsNu(e.latlng.lat, e.latlng.lng, true));
  } else { mapaNu.setView(centro, 16); marcadorNu.setLatLng(centro); }
  setTimeout(() => mapaNu.invalidateSize(), 60);
}

async function buscarDireccionNu() {
  const dir = $("nu-dir").value.trim();
  if (dir.length < 4) { mostrarToast("Escribe primero la dirección", "error"); return; }
  const m = municipios.find(x => x.id === Number($("nu-muni").value));
  const b = $("nu-buscar"); b.disabled = true;
  try {
    const r = await consultarNominatim(`${dir}, ${m ? m.nombre : ""}, Colombia`, m && m.lat != null ? { lat: m.lat, lng: m.lng } : null);
    if (r) { fijarCoordsNu(r.lat, r.lng, true); mapaNu.setView([r.lat, r.lng], 18); mostrarToast("Revisa que el pin quede sobre la puerta"); }
    else mostrarToast("No encontramos esa dirección. Ubica el pin a mano", "error");
  } catch (e) { mostrarToast("No pudimos buscar ahora. Ubica el pin a mano", "error"); }
  finally { b.disabled = false; }
}

function gpsNu() {
  if (!navigator.geolocation) { mostrarToast("Tu navegador no permite usar el GPS", "error"); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    fijarCoordsNu(pos.coords.latitude, pos.coords.longitude, true);
    mapaNu.setView([pos.coords.latitude, pos.coords.longitude], 18);
  }, () => mostrarToast("No pudimos obtener tu ubicación. Mueve el pin a mano.", "error"),
  { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

// ---------- Crear desde una recomendación (fase 2X): admin-comercios.html?recomendacion=ID ----------
let recomendacionNu = null;   // la recomendación que se está convirtiendo en comercio
async function abrirDesdeRecomendacion(id) {
  try {
    const r = await cargarRecomendacion(id);
    if (!r) { mostrarToast("No encontramos esa recomendación", "error"); return; }
    if (r.estado !== "pendiente") { mostrarToast("Esa recomendación ya fue revisada", "error"); return; }
    $("nu-muni").value = String(r.municipio_id);
    abrirNuevo();
    recomendacionNu = r;
    $("nu-nombre").value = r.nombre || "";
    if (TIPOS_COMERCIO.some(t => t.id === r.tipo)) $("nu-tipo").value = r.tipo;
    $("nu-dir").value = r.direccion || "";
    $("nu-desc").value = r.comentario ? r.comentario.slice(0, 300) : "";
    if (r.lat != null && r.lng != null) { fijarCoordsNu(Number(r.lat), Number(r.lng), true); setTimeout(() => mapaNu.setView([Number(r.lat), Number(r.lng)], 18), 80); }
    $("nu-rec-aviso").classList.remove("hidden");
    $("nu-rec-aviso").innerHTML = `🤝 <b>Recomendado por la comunidad.</b> Revisa los datos, ubica bien el pin y guarda. ${r.foto_url ? `Si no subes otra foto se usa la que enviaron: <a href="${esc(urlSegura(r.foto_url))}" target="_blank" rel="noopener" class="underline">ver foto</a>.` : ""}`;
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
}

async function guardarNuevo() {
  const err = m => { $("nu-error").textContent = m; $("nu-error").classList.toggle("hidden", !m); return !m; };
  const nombre = $("nu-nombre").value.trim();
  const wa = $("nu-wa").value.replace(/\D/g, "");
  if (nombre.length < 2) { err("Escribe el nombre del comercio"); return; }
  if (!coordsNu) { err("Marca el pin en el mapa (toca el mapa, busca la dirección o usa el GPS)"); return; }
  if (wa && wa.length !== 10) { err("El WhatsApp debe tener 10 dígitos"); return; }
  err("");
  const muniId = Number($("nu-muni").value);
  const parecido = listaAdmin.find(c => c.municipioId === muniId && normalizar(c.nombre) === normalizar(nombre) && distanciaKm(c, coordsNu) < 0.15);
  if (parecido && !confirm(`Ya existe «${parecido.nombre}» a menos de 150 m. ¿Crear otro de todas formas?`)) return;
  const b = $("nu-guardar"); b.disabled = true;
  try {
    const fila = {
      nombre, tipo: $("nu-tipo").value, municipio_id: muniId,
      direccion: $("nu-dir").value.trim() || null, telefono: $("nu-tel").value.trim() || null,
      whatsapp: wa ? "57" + wa : null, horario: $("nu-hor").value.trim() || null,
      descripcion: $("nu-desc").value.trim() || null,
      lat: +coordsNu.lat.toFixed(6), lng: +coordsNu.lng.toFixed(6), activo: true,
      fuente: recomendacionNu ? "Recomendado por la comunidad" : "Agregado por el equipo"
    };
    const archivo = $("nu-foto").files[0];
    if (archivo) fila.foto_url = await subirFotoComercio(await comprimir(archivo));
    else if (recomendacionNu && recomendacionNu.foto_url) fila.foto_url = recomendacionNu.foto_url;
    const c = await crearComercioDB(fila);
    if (recomendacionNu) {
      try { await resolverRecomendacion(recomendacionNu.id, "creado", c.id); }
      catch (e) { console.warn("recomendación:", e); }
      recomendacionNu = null;
    }
    cerrarModal("modal-nuevo");
    mostrarToast("✅ Comercio creado. Verifícalo cuando lo confirmes");
    soloId = c.id;           // lo dejamos a la vista para verificarlo de una vez
    await refrescarLista();
  } catch (e) { console.error(e); err(mensajeError(e)); }
  finally { b.disabled = false; }
}

// ---------- Corregir la ubicación de un comercio ----------
// Un solo mapa (en una ventana) que se reutiliza para cualquier comercio de la lista.
let mapaUb = null, marcadorUb = null, comercioUb = null, coordsUb = null, geoSeqUb = 0;

const AVISOS_UB = {
  buscando: ["⏳ Buscando en el mapa…", "bg-slate-100 text-slate-600"],
  exacta:   ["📍 Encontramos la dirección. Revisa que el pin quede sobre el local; si no, arrástralo.", "bg-emerald-50 text-emerald-800"],
  nombre:   ["📍 Encontramos un lugar por el nombre. Confirma que sea el local correcto.", "bg-amber-50 text-amber-800"],
  nada:     ["No encontramos esa dirección. Pruébala de otra forma o mueve el pin tú.", "bg-rose-50 text-rose-700"],
  error:    ["No pudimos buscar ahora. Mueve el pin a mano o usa el GPS.", "bg-rose-50 text-rose-700"],
  manual:   ["✅ Pin movido por ti. Pulsa «Guardar ubicación» para dejarlo así.", "bg-indigo-50 text-indigo-700"],
  gps:      ["✅ Usamos tu ubicación GPS. Úsala solo si estás en el local.", "bg-indigo-50 text-indigo-700"]
};

function avisoUb(tipo) {
  const el = $("ub-estado");
  if (!tipo) { el.className = "hidden"; el.textContent = ""; return; }
  el.className = "text-xs font-semibold rounded-lg px-3 py-2 mb-2 " + AVISOS_UB[tipo][1];
  el.textContent = AVISOS_UB[tipo][0];
}

function fijarCoordsUb(lat, lng, mover) {
  coordsUb = { lat, lng };
  if (mover) marcadorUb.setLatLng([lat, lng]);
  let txt = lat.toFixed(5) + ", " + lng.toFixed(5);
  if (comercioUb && Number.isFinite(comercioUb.lat)) {
    const m = Math.round(distanciaKm(comercioUb, coordsUb) * 1000);
    txt += m >= 5 ? ` · a ${m} m de la ubicación actual` : " · sin cambios";
  }
  $("ub-coords").textContent = txt;
  $("ub-google").href = urlMapa({ lat, lng });
}

function iconoPinUb(tipo) {
  const t = TIPOS_COMERCIO.find(x => x.id === tipo);
  return L.divIcon({ className: "marcador-cat", html: `<div class="pin-mapa"><span>${t ? t.icono : "📍"}</span></div>`,
    iconSize: [44, 44], iconAnchor: [22, 44] });
}

function abrirUbicacion(id) {
  const c = listaAdmin.find(x => x.id === id);
  if (!c) return;
  comercioUb = c; geoSeqUb++;
  $("ub-nombre").textContent = c.nombre;
  $("ub-direccion").value = c.direccion || "";
  avisoUb(null);
  abrirModal("modal-ubicacion");
  const centro = [c.lat, c.lng];
  if (!mapaUb) {
    mapaUb = crearMapaBase("map-ubicacion", centro, 18);
    marcadorUb = L.marker(centro, { draggable: true, icon: iconoPinUb(c.tipo) }).addTo(mapaUb);
    marcadorUb.on("dragend", () => { const p = marcadorUb.getLatLng(); fijarCoordsUb(p.lat, p.lng, false); avisoUb("manual"); });
    mapaUb.on("click", e => { fijarCoordsUb(e.latlng.lat, e.latlng.lng, true); avisoUb("manual"); });
  } else {
    marcadorUb.setIcon(iconoPinUb(c.tipo));
    mapaUb.setView(centro, 18);
  }
  marcadorUb.setLatLng(centro);
  fijarCoordsUb(c.lat, c.lng, false);
  setTimeout(() => mapaUb.invalidateSize(), 60);   // el mapa se creó con la ventana recién abierta
}

async function buscarDireccionUb() {
  const c = comercioUb;
  const dir = $("ub-direccion").value.trim();
  if (!dir) { mostrarToast("Escribe una dirección", "error"); return; }
  const miSeq = ++geoSeqUb;
  const muni = municipios.find(m => m.id === c.municipioId);
  const centro = muni && muni.lat != null ? { lat: muni.lat, lng: muni.lng } : null;
  const lugar = [c.ciudad, muni ? muni.departamento : "", "Colombia"].filter(Boolean).join(", ");
  const calle = dir.split(/#|\bno\.?\s|\bnro\.?\s/i)[0].trim();
  const intentos = [[[dir.replace(/#/g, " "), lugar].join(", "), "exacta"]];
  if (calle && calle !== dir) intentos.push([[calle, lugar].join(", "), "exacta"]);
  intentos.push([[c.nombre, lugar].join(", "), "nombre"]);
  avisoUb("buscando");
  const ctrl = new AbortController(), corte = setTimeout(() => ctrl.abort(), 8000);
  try {
    for (const [q, nivel] of intentos) {
      const r = await consultarNominatim(q, centro, ctrl.signal);
      if (miSeq !== geoSeqUb) return;
      if (r) {
        fijarCoordsUb(r.lat, r.lng, true);
        mapaUb.setView([r.lat, r.lng], 18);
        avisoUb(nivel);
        return;
      }
    }
    if (miSeq === geoSeqUb) avisoUb("nada");
  } catch (err) {
    if (miSeq === geoSeqUb) avisoUb("error");
  } finally { clearTimeout(corte); }
}

function gpsUb() {
  if (!navigator.geolocation) { mostrarToast("Tu navegador no permite usar el GPS", "error"); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    fijarCoordsUb(lat, lng, true);
    mapaUb.setView([lat, lng], 18);
    avisoUb("gps");
  }, err => mostrarToast(err && err.code === 1
      ? "Permiso de ubicación denegado. Actívalo en el navegador."
      : "No pudimos obtener tu ubicación. Mueve el pin a mano.", "error"),
  { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

async function guardarUbicacion() {
  if (!comercioUb || !coordsUb) return;
  const b = $("ub-guardar");
  b.disabled = true;
  try {
    await guardarComercioDB(comercioUb.id, { lat: +coordsUb.lat.toFixed(6), lng: +coordsUb.lng.toFixed(6) });
    cerrarModal("modal-ubicacion");
    mostrarToast("✅ Ubicación guardada");
    await refrescarLista();
  } catch (err) {
    console.error(err);
    mostrarToast(mensajeError(err), "error");
  } finally { b.disabled = false; }
}

// ---------- Modo visita / verificación (Fase 2D.1) ----------
// Protocolo: existe y atiende · quien atiende es dueño o administrador (SIN guardar copia de la cédula) ·
// teléfono del negocio · pin sobre la puerta (GPS) · el dueño acepta los términos y autoriza publicar.
const LISTA_VERIF = {
  telefono: [
    ["nombre_dir", "Confirmé el nombre y la dirección con quien contestó"],
    ["telefono_negocio", "El número publicado es del negocio"]
  ],
  visita: [
    ["existe", "El local existe y atiende en esta dirección"],
    ["responsable", "Quien atiende es el dueño o administrador (prueba simple, p. ej. registro mercantil; no guardes copia de la cédula)"],
    ["telefono_negocio", "El teléfono publicado es del negocio"],
    ["pin_puerta", "El pin quedó sobre la puerta (captura el GPS en la puerta o confirma el pin actual)"],
    ["terminos", "El dueño acepta los términos y autoriza publicar los datos del negocio"]
  ]
};
let comercioVi = null, gpsVi = null;

const metodoVi = () => document.querySelector('input[name="vi-metodo"]:checked').value;

function pintarListaVi() {
  const m = metodoVi();
  $("vi-lista").innerHTML = LISTA_VERIF[m].map(([k, t]) =>
    `<label class="flex items-start gap-2"><input type="checkbox" data-v="${k}" class="mt-1 shrink-0"> <span>${esc(t)}</span></label>`).join("");
  $("vi-visita").classList.toggle("hidden", m !== "visita");
}

function errorVi(msg) {
  const e = $("vi-error");
  e.textContent = msg || "";
  e.classList.toggle("hidden", !msg);
}

async function abrirVisita(id) {
  comercioVi = listaAdmin.find(c => c.id === id);
  if (!comercioVi) return;
  gpsVi = null;
  $("vi-nombre").textContent = comercioVi.nombre;
  $("vi-actual").textContent = "Sello actual: " + (SELLOS[comercioVi.nivel] || SELLOS[1]).corto + (comercioVi.verificadoEn ? " · " + fechaSello(comercioVi) : "");
  document.querySelector('input[name="vi-metodo"][value="visita"]').checked = true;
  $("vi-foto").value = ""; $("vi-notas").value = ""; $("vi-gps-txt").textContent = "Sin capturar: se conserva el pin actual";
  errorVi("");
  pintarListaVi();
  $("vi-historial").innerHTML = '<li class="text-slate-400">Cargando…</li>';
  abrirModal("modal-visita");
  try {
    const h = await cargarVerificaciones(id);
    $("vi-historial").innerHTML = h.length ? h.map(v => {
      const f = new Date(v.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
      return `<li>${v.resultado === "aprobada" ? "✅" : "❌"} ${f} · ${v.metodo === "visita" ? "En persona" : "Por teléfono"}${v.verificador_id === (usuarioActual && usuarioActual.id) ? " · tú" : ""}${v.notas ? " · " + esc(v.notas) : ""}</li>`;
    }).join("") : '<li class="text-slate-400">Sin verificaciones registradas.</li>';
  } catch (err) {
    $("vi-historial").innerHTML = '<li class="text-slate-400">No se pudo cargar el historial.</li>';
  }
}

function gpsVisita() {
  if (!navigator.geolocation) { errorVi("Tu navegador no permite usar el GPS"); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    gpsVi = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    $("vi-gps-txt").textContent = `GPS capturado (±${Math.round(pos.coords.accuracy)} m): ${gpsVi.lat.toFixed(5)}, ${gpsVi.lng.toFixed(5)}`;
    errorVi("");
  }, err => errorVi(err && err.code === 1 ? "Permiso de ubicación denegado. Actívalo en el navegador." : "No pudimos obtener el GPS. Puedes confirmar el pin actual."),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

async function enviarVerificacion(resultado) {
  if (!comercioVi) return;
  const m = metodoVi();
  const lista = {};
  document.querySelectorAll("#vi-lista [data-v]").forEach(i => { lista[i.dataset.v] = i.checked; });
  const notas = $("vi-notas").value.trim();
  const archivo = $("vi-foto").files[0];
  if (resultado === "aprobada") {
    if (Object.values(lista).some(v => !v)) { errorVi("Marca todos los puntos de la lista para aprobar. Si algo no se cumple, usa «No se pudo verificar»."); return; }
    if (m === "visita" && !archivo) { errorVi("Falta la foto de la fachada."); return; }
  } else if (notas.length < 5) { errorVi("Explica en las notas por qué no se pudo verificar."); return; }
  errorVi("");
  const botones = [$("vi-aprobar"), $("vi-rechazar")];
  botones.forEach(b => { b.disabled = true; });
  try {
    await crearVerificacion({
      comercioId: comercioVi.id, metodo: m, resultado, lista, notas,
      foto: (m === "visita" && archivo) ? await comprimir(archivo) : null,
      lat: resultado === "aprobada" && m === "visita" && gpsVi ? gpsVi.lat : null,
      lng: resultado === "aprobada" && m === "visita" && gpsVi ? gpsVi.lng : null
    });
    cerrarModal("modal-visita");
    mostrarToast(resultado === "aprobada" ? "✅ Verificación registrada" : "Registrado: el comercio vuelve a «Ubicado»");
    await refrescarLista();
  } catch (err) {
    console.error(err);
    errorVi(mensajeError(err));
  } finally { botones.forEach(b => { b.disabled = false; }); }
}

async function accionEditor(e) {
  const b = e.target.closest("[data-acc]");
  const fila = e.target.closest("[data-id]");
  if (!b || !fila) return;
  const id = Number(fila.dataset.id);
  if (b.dataset.acc === "ubicacion") { abrirUbicacion(id); return; }
  if (b.dataset.acc === "verificar") { abrirVisita(id); return; }
  if (b.dataset.acc === "dueno" || b.dataset.acc === "quitar-dueno") {
    const correo = fila.querySelector("[data-dueno]").value.trim();
    if (b.dataset.acc === "dueno" && !correo) { mostrarToast("Escribe el correo de la cuenta del dueño", "error"); return; }
    b.disabled = true;
    try {
      await asignarDuenoComercio(id, b.dataset.acc === "dueno" ? { email: correo } : {});
      mostrarToast(b.dataset.acc === "dueno" ? "✅ Dueño asignado" : "Dueño quitado");
      await refrescarLista();
    } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
    return;
  }
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
      const tipo = val("tipo").value;
      const cambios = {
        nombre, direccion: texto("direccion"), telefono: texto("telefono"), horario: texto("horario"),
        activo: val("activo").checked, tipo,
        tipos_extra: [...new Set([...fila.querySelectorAll("[data-extra]")].map(s => s.value).filter(v => v && v !== tipo))]
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

// ---------- Categorías de comercio (solo moderadores) ----------
function filaCategoria(t) {
  const usos = listaAdmin.filter(c => comercioEsTipo(c, t.id)).length;
  return `<div class="border border-slate-200 rounded-xl p-2.5 ${t.activo === false ? "opacity-60" : ""}" data-cat="${esc(t.id)}">
    <div class="grid grid-cols-[3.5rem_1fr] sm:grid-cols-[3.5rem_1fr_2fr_4.5rem_auto] gap-2 items-end">
      <label class="text-[11px] font-bold text-slate-500">Ícono<input data-c="icono" maxlength="8" value="${esc(t.icono)}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg text-center text-lg"></label>
      <label class="text-[11px] font-bold text-slate-500">Nombre <span class="font-normal text-slate-400">(${esc(t.id)} · ${usos} comercio${usos === 1 ? "" : "s"})</span><input data-c="nombre" maxlength="40" value="${esc(t.nombre)}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <label class="text-[11px] font-bold text-slate-500 col-span-2 sm:col-span-1">Palabras clave<textarea data-c="palabras" rows="1" maxlength="1500" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-xs">${esc(t.palabras || "")}</textarea></label>
      <label class="text-[11px] font-bold text-slate-500">Orden<input data-c="orden" type="number" value="${Number(t.orden) || 100}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <div class="flex items-center gap-2 col-span-2 sm:col-span-1">
        <label class="text-xs flex items-center gap-1"><input type="checkbox" data-c="activo" ${t.activo === false ? "" : "checked"}> Activa</label>
        <button type="button" data-cat-guardar class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">Guardar</button>
      </div>
    </div>
  </div>`;
}
function pintarCategorias() {
  $("cat-n").textContent = "(" + TIPOS_COMERCIO.length + ")";
  $("cat-lista").innerHTML = TIPOS_COMERCIO.map(filaCategoria).join("");
}
async function accionCategoria(e) {
  const b = e.target.closest("[data-cat-guardar]");
  if (!b) return;
  const f = b.closest("[data-cat]");
  const v = k => f.querySelector(`[data-c="${k}"]`);
  const nombre = v("nombre").value.trim();
  if (nombre.length < 2) { mostrarToast("Escribe el nombre de la categoría", "error"); return; }
  b.disabled = true;
  try {
    await guardarCategoriaDB({ id: f.dataset.cat, nombre, icono: v("icono").value.trim() || "🏪",
      palabras: v("palabras").value.trim(), orden: parseInt(v("orden").value, 10) || 100, activo: v("activo").checked });
    mostrarToast("✅ Categoría guardada");
    pintarCategorias(); pintarLista();
  } catch (err) { mostrarToast(mensajeError(err), "error"); b.disabled = false; }
}
async function crearCategoria() {
  const nombre = $("cat-nuevo-nombre").value.trim();
  const id = slugRef(nombre).replace(/-/g, "_");
  if (nombre.length < 2 || id.length < 2) { mostrarToast("Escribe el nombre de la nueva categoría", "error"); return; }
  if (TIPOS_COMERCIO.some(t => t.id === id)) { mostrarToast("Ya existe una categoría con ese nombre", "error"); return; }
  const b = $("cat-crear"); b.disabled = true;
  try {
    await guardarCategoriaDB({ id, nombre, icono: $("cat-nuevo-icono").value.trim() || "🏪", palabras: $("cat-nuevo-palabras").value.trim(),
      orden: 500, activo: true });
    $("cat-nuevo-nombre").value = ""; $("cat-nuevo-palabras").value = "";
    mostrarToast("✅ Categoría creada: ya aparece al registrar y editar comercios");
    pintarCategorias(); pintarLista();
    $("nu-tipo").innerHTML = opcionesCategoria($("nu-tipo").value);
  } catch (err) {
    mostrarToast(/categorias_comercio|does not exist/i.test(err.message || "") ? "Primero ejecuta supabase/15_categorias_comercio.sql" : mensajeError(err), "error");
  } finally { b.disabled = false; }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("ac-cargando").classList.add("hidden");
  if (!esModerador()) { $("ac-sin-permiso").classList.remove("hidden"); return; }
  $("ac-panel").classList.remove("hidden");

  $("ac-cuotas").innerHTML = TIPOS_IMPORTABLES.map(t => `<label class="text-xs font-bold text-slate-500">${t.icono} ${esc(t.nombre)}
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
  $("ub-buscar").addEventListener("click", buscarDireccionUb);
  $("ub-direccion").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); buscarDireccionUb(); } });
  $("ub-gps").addEventListener("click", gpsUb);
  $("ub-guardar").addEventListener("click", guardarUbicacion);
  document.querySelectorAll('input[name="vi-metodo"]').forEach(r => r.addEventListener("change", pintarListaVi));
  $("vi-gps").addEventListener("click", gpsVisita);
  $("vi-aprobar").addEventListener("click", () => enviarVerificacion("aprobada"));
  $("vi-rechazar").addEventListener("click", () => enviarVerificacion("rechazada"));
  ["ac-filtro-muni", "ac-filtro-ver"].forEach(id => $(id).addEventListener("change", () => { soloId = null; limiteLista = 40; pintarLista(); }));
  $("ac-buscar-nombre").addEventListener("input", () => { soloId = null; limiteLista = 40; pintarLista(); });
  $("ac-origenes").addEventListener("click", e => { const b = e.target.closest("[data-origen]"); if (b) { origenAct = b.dataset.origen; soloId = null; limiteLista = 40; pintarLista(); } });
  $("ac-lista").addEventListener("click", e => { if (e.target.closest("#ac-mas")) { limiteLista += 40; pintarLista(); } });
  $("ac-pend-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-ir], [data-ir-estado]");
    if (!b) return;
    soloId = null; limiteLista = 40; $("ac-buscar-nombre").value = ""; $("ac-filtro-muni").value = "";
    if (b.dataset.irEstado) { $("ac-filtro-ver").value = b.dataset.irEstado; origenAct = "todos"; }
    else { $("ac-filtro-ver").value = "no"; origenAct = b.dataset.ir; }
    pintarLista(); $("ac-origenes").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("ac-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  await cargarCategoriasComercio();
  $("nu-tipo").innerHTML = opcionesCategoria("tienda");
  pintarCategorias();
  $("cat-lista").addEventListener("click", accionCategoria);
  $("cat-crear").addEventListener("click", crearCategoria);
  $("nu-muni").innerHTML = opciones;
  $("ac-nuevo").addEventListener("click", abrirNuevo);
  $("nu-buscar").addEventListener("click", buscarDireccionNu);
  $("nu-gps").addEventListener("click", gpsNu);
  $("nu-guardar").addEventListener("click", guardarNuevo);
  $("nu-muni").addEventListener("change", () => { if (!coordsNu && mapaNu) { mapaNu.setView(centroNu(), 16); marcadorNu.setLatLng(centroNu()); } });
  $("ac-ver-todos").addEventListener("click", () => { soloId = null; pintarLista(); });
  const qs = new URLSearchParams(location.search);
  if (qs.get("editar")) soloId = Number(qs.get("editar")) || null;
  await refrescarLista();
  cargarOtrosPendientes();
  if (qs.get("verificar") && soloId !== null) abrirVisita(soloId);
  if (qs.get("nuevo")) abrirNuevo();
  if (qs.get("recomendacion")) abrirDesdeRecomendacion(Number(qs.get("recomendacion")));
});
