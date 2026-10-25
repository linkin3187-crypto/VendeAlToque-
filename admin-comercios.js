// ===== Merkap - Importar y gestionar comercios (admin-comercios.html) =====
// POR QUÉ la importación corre en TU navegador: el servidor donde trabaja Claude no puede
// llamar a Overpass, pero tu navegador sí. La seguridad no depende de esta página: la base
// de datos solo deja escribir en `comercios` a cuentas con rol moderador/admin.

// =====================================================================
// IMPORTADOR 2.0 (fase IMP-2)
// · Servidores: se pregunta a UNO a la vez (es la regla de los servidores públicos de Overpass desde
//   abril de 2026: nada de consultas en paralelo). Si uno pide pausa (429/406) se respeta 30 s y se pasa
//   al siguiente. El último que respondió bien se usa primero la próxima vez.
// · Dónde: municipio + radio (centro movible en el mapa), la zona visible del mapa o todo el municipio.
// · Qué: todas las categorías que tienen equivalente en OpenStreetMap (OSM_POR_TIPO).
// · Cuántos: cuota por tipo; por defecto cuenta solo los NUEVOS (antes contaba también los guardados
//   y por eso ya no salía nada en municipios con 1–2 comercios por tipo).
// =====================================================================
const SERVIDORES = [
  { url: "https://overpass-api.de/api/interpreter", nombre: "overpass-api.de (principal)" },
  { url: "https://overpass.private.coffee/api/interpreter", nombre: "overpass.private.coffee" },
  { url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter", nombre: "maps.mail.ru (VK Maps)" }
];
const OVERPASS = SERVIDORES.map(s => s.url);
let TIEMPO_MAX_MS = 30000;            // tope por servidor (luego se pasa al siguiente)
const PAUSA_MS = 30000;               // 429/406: el servidor pide esperar
const pausaHasta = {};                // url → hora hasta la que no se le pregunta
let servidorBueno = (() => { try { return localStorage.getItem("mf_ac_srv") || ""; } catch (e) { return ""; } })();
let vivos = 0, vivosMax = 0;          // peticiones en vuelo (las pruebas verifican que nunca haya 2)

// Etiquetas de OpenStreetMap de cada categoría de Merkap
const OSM_POR_TIPO = {
  farmacia: { amenity: ["pharmacy"] }, cajero: { amenity: ["atm"] }, comida_rapida: { amenity: ["fast_food"] },
  panaderia: { shop: ["bakery"] }, supermercado: { shop: ["supermarket"] }, banco: { amenity: ["bank"] },
  restaurante: { amenity: ["restaurant"] }, cafeteria: { amenity: ["cafe"] }, bar: { amenity: ["bar", "pub", "nightclub"] },
  heladeria: { amenity: ["ice_cream"], shop: ["ice_cream"] }, pasteleria: { shop: ["pastry", "confectionery"] },
  minimercado: { shop: ["convenience"] }, tienda: { shop: ["general", "variety_store", "kiosk"] },
  carniceria: { shop: ["butcher", "seafood"] }, fruver: { shop: ["greengrocer"] }, licorera: { shop: ["alcohol", "beverages"] },
  naturista: { shop: ["health_food", "herbalist"] }, ropa: { shop: ["clothes", "shoes", "boutique"] }, sastreria: { shop: ["tailor"] },
  belleza: { shop: ["hairdresser", "beauty", "cosmetics"] }, ferreteria: { shop: ["hardware", "doityourself"] },
  cerrajeria: { shop: ["locksmith"] }, tecnologia: { shop: ["mobile_phone", "electronics", "computer"] },
  papeleria: { shop: ["stationery", "copyshop"] }, veterinaria: { amenity: ["veterinary"], shop: ["pet"] },
  optica: { shop: ["optician"] }, salud: { amenity: ["dentist", "doctors", "clinic"] },
  clinicas_y_hospitales: { amenity: ["hospital"] }, taller: { shop: ["car_repair", "tyres"] }, concesionario: { shop: ["car"] },
  motos: { shop: ["motorcycle", "motorcycle_repair"] }, lavanderia: { shop: ["laundry", "dry_cleaning"] },
  gimnasio: { leisure: ["fitness_centre"] }, floristeria: { shop: ["florist", "gift"] },
  hospedaje: { tourism: ["hotel", "hostel", "guest_house"] }, inmobiliaria: { office: ["estate_agent"] },
  hogar: { shop: ["furniture", "houseware", "interior_decoration"] }
};
const TIPO_POR_TAG = {};
Object.entries(OSM_POR_TIPO).forEach(([tipo, m]) => Object.entries(m).forEach(([k, vs]) => vs.forEach(v => { TIPO_POR_TAG[k + "=" + v] = tipo; })));
const CLAVES_OSM = ["amenity", "shop", "tourism", "leisure", "office"];
const TIPOS_BASICOS = ["farmacia", "cajero", "comida_rapida", "panaderia", "supermercado", "banco"];
const PRESETS = { pocos: 5, normal: 15, muchos: 50 };
const CUOTA_MAX = 200;

// Categorías que se pueden importar = las de la base de datos que tienen etiqueta en OSM
const tiposImportables = () => TIPOS_COMERCIO.filter(t => OSM_POR_TIPO[t.id] && t.activo !== false);

let candidatos = [];      // vista previa: [{fila, marcado, estado: "nuevo"|"parecido"|"ya", web, parecidoA}]
let listaAdmin = [];
let conteos = null;       // lo que pasó en la última búsqueda
const dormir = ms => new Promise(r => setTimeout(r, ms));
let cancelar = false;
const controles = new Set();          // peticiones en vuelo (para poder abortarlas al cancelar)

// ---------- Preferencias del importador (solo en este navegador) ----------
let prefImp = (() => { try { return JSON.parse(localStorage.getItem("mf_ac_imp") || "null") || {}; } catch (e) { return {}; } })();
const guardarPrefImp = () => { try { localStorage.setItem("mf_ac_imp", JSON.stringify(prefImp)); } catch (e) { /* nada */ } };
let tiposElegidos = new Set();
let modoDonde = "radio";              // "radio" | "zona" | "todo"
let centroManual = null;              // centro tocado en el mapa (solo con un municipio elegido)

// ---------- Consulta ----------
// zona = { filtro: "(around:…)" | "(s,w,n,e)" | "(area.m)", antes: "" | "area[…]->.m;" }
function consultaOverpass(zona, tipos, limite) {
  const porClave = {};
  tipos.forEach(id => Object.entries(OSM_POR_TIPO[id] || {}).forEach(([k, vs]) => {
    porClave[k] = porClave[k] || new Set(); vs.forEach(v => porClave[k].add(v));
  }));
  const partes = [];
  Object.entries(porClave).forEach(([k, s]) => {
    const f = `["${k}"~"^(${[...s].join("|")})$"]`;
    partes.push(`node${zona.filtro}${f};`, `way${zona.filtro}${f};`);
  });
  return `[out:json][timeout:25][maxsize:33554432];${zona.antes || ""}(${partes.join("")});out center tags qt ${limite};`;
}
const zonaRadio = (c, radio) => ({ filtro: `(around:${radio},${c.lat},${c.lng})` });
const zonaCaja = b => ({ filtro: `(${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)})` });
// Colombia en OpenStreetMap: municipio = admin_level 6 (algunos quedaron en 8). Lo que caiga a más de
// 40 km del centro se descarta (por si hay otro municipio con el mismo nombre en otro departamento).
const zonaMunicipio = m => ({ antes: `area["name"="${m.nombre.replace(/"/g, "")}"]["boundary"="administrative"]["admin_level"~"^(6|8)$"]->.m;`, filtro: "(area.m)" });

// ---------- Servidores: uno a la vez ----------
const hostDe = url => new URL(url).hostname;
const nombreServidor = url => (SERVIDORES.find(s => s.url === url) || { nombre: hostDe(url) }).nombre;

function errorServidor(msg, pausa) { const e = new Error(msg); e.pausa = !!pausa; return e; }

async function pedirUno(url, consulta, tope) {
  const ctl = new AbortController(); controles.add(ctl);
  vivos++; vivosMax = Math.max(vivosMax, vivos);
  const t = setTimeout(() => ctl.abort(), tope);
  try {
    let r;
    try {
      r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(consulta), signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, referrerPolicy: "strict-origin-when-cross-origin" });
    } catch (e) {
      if (e.name === "AbortError") throw errorServidor(cancelar ? "cancelado" : `tardó más de ${Math.round(tope / 1000)} s`);
      throw errorServidor("sin conexión o el navegador lo bloqueó");
    }
    if (r.status === 429) throw errorServidor("pidió una pausa (429: demasiadas consultas)", true);
    if (r.status === 406) throw errorServidor("rechazó la consulta (406: saturado o te limitó)", true);
    if (r.status === 504) throw errorServidor("está saturado (504)");
    if (!r.ok) throw errorServidor("respondió " + r.status);
    let d;
    try { d = await r.json(); } catch (e) { throw errorServidor(e.name === "AbortError" ? `tardó más de ${Math.round(tope / 1000)} s` : "respuesta no válida"); }
    if (!d || !Array.isArray(d.elements)) throw errorServidor("respuesta vacía");
    if (d.remark && /runtime error|timed out|out of memory/i.test(d.remark) && !d.elements.length)
      throw errorServidor("la consulta fue muy grande (baja el radio o los tipos)");
    return d;
  } finally { clearTimeout(t); controles.delete(ctl); vivos--; }
}

async function esperarCancelable(ms, aviso) {
  const fin = Date.now() + ms;
  while (!cancelar && Date.now() < fin) {
    if (aviso) aviso(Math.ceil((fin - Date.now()) / 1000));
    await dormir(Math.min(250, Math.max(0, fin - Date.now())));
  }
}

function ordenServidores() {
  const sel = $("ac-servidor") ? $("ac-servidor").value : "auto";
  if (sel && sel !== "auto") return [sel];
  return OVERPASS.slice().sort((a, b) => (b === servidorBueno) - (a === servidorBueno));
}

// Pregunta a un servidor; si falla, al siguiente. Si todos fallaron y alguno pidió pausa, espera y reintenta una vez.
async function pedirOverpass(consulta, aviso) {
  const errores = [];
  let orden = ordenServidores();
  for (let vuelta = 0; vuelta < 2 && !cancelar; vuelta++) {
    for (const url of orden) {
      if (cancelar) break;
      const espera = (pausaHasta[url] || 0) - Date.now();
      if (espera > 0) {
        if (vuelta === 0) { errores.push(hostDe(url) + ": en pausa"); continue; }
        await esperarCancelable(espera, s => aviso && aviso(`⏸️ ${nombreServidor(url)} pidió una pausa: reintento en ${s} s…`));
        if (cancelar) break;
      }
      try {
        if (aviso) aviso(`Preguntando a ${nombreServidor(url)}…`);
        const d = await pedirUno(url, consulta, TIEMPO_MAX_MS);
        servidorBueno = url; try { localStorage.setItem("mf_ac_srv", url); } catch (e) { /* nada */ }
        return d;
      } catch (e) {
        if (cancelar) break;
        errores.push(hostDe(url) + ": " + e.message);
        if (e.pausa) pausaHasta[url] = Date.now() + PAUSA_MS;
      }
    }
    orden = orden.filter(u => (pausaHasta[u] || 0) > Date.now());   // 2ª vuelta: solo los que pidieron pausa
    if (!orden.length) break;
  }
  throw new Error(cancelar ? "Cancelado" : "Ningún servidor respondió (" + errores.join("; ") + ")");
}

function cancelarBusqueda() {
  cancelar = true;
  controles.forEach(c => c.abort());   // corta las peticiones que estén esperando
  $("ac-estado").textContent = "Cancelando…";
}

// 🩺 Probar servidores: una consulta mínima a cada uno, de a uno
async function probarServidores() {
  const b = $("ac-probar"); b.disabled = true;
  const m = municipios[0] || { lat: 6.2442, lng: -75.5812 };
  const consulta = `[out:json][timeout:10];node(around:300,${m.lat},${m.lng})["amenity"];out 1;`;
  const res = {};
  const pintar = () => {
    $("ac-servidores").innerHTML = SERVIDORES.map(s => {
      const r = res[s.url];
      const txt = !r ? '<span class="text-slate-400">⏳ en espera</span>'
        : r.prueba ? '<span class="text-slate-500">🔎 probando…</span>'
        : r.ok ? `<span class="text-green-700 font-bold">✔ ${(r.ms / 1000).toFixed(1).replace(".", ",")} s</span>`
        : `<span class="${r.pausa ? "text-amber-700" : "text-red-700"} font-bold">${r.pausa ? "⚠️" : "✖"} ${esc(r.error)}</span>`;
      return `<li class="flex justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50" data-srv="${esc(hostDe(s.url))}"><span>${esc(s.nombre)}${s.url === servidorBueno ? " ⭐" : ""}</span>${txt}</li>`;
    }).join("");
  };
  $("ac-servidores").classList.remove("hidden");
  cancelar = false;
  try {
    for (const s of SERVIDORES) {
      res[s.url] = { prueba: true }; pintar();
      const t0 = Date.now();
      try { await pedirUno(s.url, consulta, 15000); res[s.url] = { ok: true, ms: Date.now() - t0 }; }
      catch (e) { res[s.url] = { error: e.message, pausa: e.pausa }; if (e.pausa) pausaHasta[s.url] = Date.now() + PAUSA_MS; }
      pintar();
    }
    const buenos = SERVIDORES.filter(s => res[s.url].ok).sort((a, z) => res[a.url].ms - res[z.url].ms);
    if (buenos.length) { servidorBueno = buenos[0].url; try { localStorage.setItem("mf_ac_srv", servidorBueno); } catch (e) { /* nada */ } pintar(); }
    $("ac-estado").textContent = buenos.length ? `✔ ${buenos.length} de ${SERVIDORES.length} servidores responden. Se usará primero el más rápido (⭐).`
      : "⚠️ Ningún servidor responde ahora. Espera unos minutos y vuelve a probar.";
  } finally { b.disabled = false; }
}

// ---------- De OSM a fila de Merkap ----------
function tipoDeTags(t, permitidos) {
  for (const k of CLAVES_OSM) {
    if (!t[k]) continue;
    const tipo = TIPO_POR_TAG[k + "=" + t[k]];
    if (tipo && (!permitidos || permitidos.has(tipo))) return tipo;
  }
  return null;
}

// Devuelve { fila, web, marca } · { sinNombre: true } · null (no es de los tipos pedidos)
function aFila(el, muni, permitidos) {
  const t = el.tags || {};
  const tipo = tipoDeTags(t, permitidos);
  if (!tipo) return null;
  const lat = el.lat ?? (el.center && el.center.lat), lng = el.lon ?? (el.center && el.center.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let nombre = (t.name || t.brand || t.operator || "").trim();
  if (!nombre && tipo === "cajero") nombre = "Cajero automático";
  if (nombre.length < 2) return { sinNombre: true };          // sin nombre no sirve en un directorio
  const m = typeof muni === "function" ? muni(lat, lng) : muni;
  const dir = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ").trim();
  return {
    fila: {
      osm_id: el.type + "/" + el.id,
      nombre: nombre.slice(0, 100),
      tipo, municipio_id: m.id,
      direccion: dir ? dir.slice(0, 160) : null,
      telefono: (t.phone || t["contact:phone"] || t.mobile || t["contact:mobile"] || "").slice(0, 40) || null,
      horario: (t.opening_hours || "").slice(0, 120) || null,
      lat: +lat.toFixed(6), lng: +lng.toFixed(6),
      verificado: false, activo: true, fuente: "OpenStreetMap"
    },
    web: (t.website || t["contact:website"] || t.url || "").slice(0, 200),
    marca: !!(t.brand || t["brand:wikidata"])
  };
}

// Clasifica lo encontrado (más cercanos al centro primero):
// · «ya»: ese mismo punto de OSM ya está guardado (aunque esté oculto) → se muestra sin marcar y no se puede elegir
// · «parecido»: mismo tipo y mismo nombre a menos de 60 m de uno guardado → se muestra SIN marcar (tú decides)
// · «nuevo»: entra marcado mientras no se pase la cuota del tipo
// Con «la cuota cuenta solo los nuevos» apagado, los guardados VISIBLES dentro de la zona también cuentan.
function clasificar(items, centro, cuota, existentes, opc) {
  const ids = new Map(existentes.filter(e => e.osmId).map(e => [e.osmId, e]));
  const usados = opc.usados || new Set();
  const cuenta = {}, salida = [], c = { nuevo: 0, ya: 0, parecido: 0, fueraCuota: 0, repetido: 0 };
  if (!opc.soloNuevos) existentes.filter(e => e.activo && opc.dentro(e)).forEach(e => { cuenta[e.tipo] = (cuenta[e.tipo] || 0) + 1; });
  const elegidos = [];
  items.sort((a, b) => distanciaKm(centro, a.fila) - distanciaKm(centro, b.fila)).forEach(it => {
    const f = it.fila;
    if (usados.has(f.osm_id)) return;                       // ya está en esta vista previa (radios que se tocan)
    if (ids.has(f.osm_id)) { c.ya++; usados.add(f.osm_id); elegidos.push(f); salida.push({ ...it, estado: "ya", marcado: false }); return; }
    const mismo = g => g.tipo === f.tipo && normalizar(g.nombre) === normalizar(f.nombre) && distanciaKm(g, f) < 0.06;
    if (elegidos.some(mismo)) { c.repetido++; return; }    // dos puntos de OSM para el mismo local (o uno ya guardado al lado)
    const par = existentes.find(mismo);
    if (par) { c.parecido++; usados.add(f.osm_id); elegidos.push(f); salida.push({ ...it, estado: "parecido", marcado: false, parecidoA: par.nombre }); return; }
    if ((cuenta[f.tipo] || 0) >= (cuota[f.tipo] || 0)) { c.fueraCuota++; return; }
    cuenta[f.tipo] = (cuenta[f.tipo] || 0) + 1;
    c.nuevo++; usados.add(f.osm_id); elegidos.push(f); salida.push({ ...it, estado: "nuevo", marcado: true });
  });
  return { salida, c };
}

function leerCuotas() {
  const c = {};
  tiposImportables().forEach(t => {
    const inp = $("cuota-" + t.id);
    c[t.id] = tiposElegidos.has(t.id) && inp ? Math.max(0, Math.min(CUOTA_MAX, parseInt(inp.value, 10) || 0)) : 0;
  });
  return c;
}

// ---------- Interfaz: tipos, cuotas, dónde ----------
function pintarTiposImp() {
  const lista = tiposImportables();
  $("ac-tipos").innerHTML = lista.map(t => `<button type="button" data-tipo-imp="${esc(t.id)}" aria-pressed="${tiposElegidos.has(t.id)}"
      class="ac-chip">${t.icono} ${esc(t.nombre)}</button>`).join("");
  const cuotas = prefImp.cuotas || {};
  const base = PRESETS[prefImp.preset || "normal"] || 15;
  // Las cuotas que ya se escribieron no se pierden al repintar
  const actuales = {};
  document.querySelectorAll("#ac-cuotas input[id^='cuota-']").forEach(i => { actuales[i.id.slice(6)] = i.value; });
  $("ac-cuotas").innerHTML = lista.map(t => `<label class="text-xs font-bold text-slate-500 ${tiposElegidos.has(t.id) ? "" : "hidden"}" data-cuota-de="${esc(t.id)}">${t.icono} ${esc(t.nombre)}
    <input type="number" id="cuota-${esc(t.id)}" min="0" max="${CUOTA_MAX}" value="${esc(String(actuales[t.id] ?? cuotas[t.id] ?? base))}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>`).join("");
  $("ac-tipos-n").textContent = `${tiposElegidos.size} de ${lista.length}`;
  pintarPresets();
}

function pintarPresets() {
  document.querySelectorAll("[data-preset]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.preset === prefImp.preset)));
}

function aplicarPreset(p) {
  prefImp.preset = p; prefImp.cuotas = {};
  document.querySelectorAll("#ac-cuotas input[id^='cuota-']").forEach(i => { i.value = PRESETS[p]; });
  guardarPrefImp(); pintarPresets();
}

function elegirTipo(id, valor) {
  if (valor === undefined ? tiposElegidos.has(id) : !valor) tiposElegidos.delete(id); else tiposElegidos.add(id);
  prefImp.tipos = [...tiposElegidos]; guardarPrefImp();
  document.querySelectorAll(`[data-tipo-imp="${CSS.escape(id)}"]`).forEach(b => b.setAttribute("aria-pressed", String(tiposElegidos.has(id))));
  const l = document.querySelector(`[data-cuota-de="${CSS.escape(id)}"]`); if (l) l.classList.toggle("hidden", !tiposElegidos.has(id));
  $("ac-tipos-n").textContent = `${tiposElegidos.size} de ${tiposImportables().length}`;
}

function muniElegido() { const v = $("ac-muni").value; return v === "todos" ? null : municipios.find(m => String(m.id) === v) || null; }

function pintarDonde() {
  document.querySelectorAll("[data-donde]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.donde === modoDonde)));
  const m = muniElegido();
  $("ac-fila-radio").classList.toggle("hidden", modoDonde !== "radio");
  $("ac-muni-caja").classList.toggle("hidden", modoDonde === "zona");
  const ayuda = {
    radio: m ? (centroManual ? "📍 Centro movido: busca alrededor del punto que tocaste. " : "📍 Busca alrededor del centro del municipio. <b>Toca el mapa</b> para mover el centro (por ejemplo a un barrio). ")
             : "📍 Con «Todos» busca alrededor del centro de cada municipio, uno por uno.",
    zona: "🗺️ Busca en lo que se ve en el mapa. Acércate o aléjate y arrástralo hasta la zona que quieres (máx. unos 12 km de lado). Cada comercio queda en el municipio más cercano.",
    todo: "🏙️ Busca en todo el límite del municipio según OpenStreetMap. Es la consulta más pesada: en ciudades grandes (Medellín) puede tardar o fallar; ahí usa «Zona del mapa»."
  }[modoDonde];
  $("ac-donde-ayuda").innerHTML = ayuda + (modoDonde === "radio" && m && centroManual ? ' <button type="button" id="ac-centro-reset" class="text-indigo-600 font-bold underline">Volver al centro</button>' : "");
  pintarZonaMapa();
}

// ---------- Mapa del importador ----------
let mapaImp = null, circuloImp = null, capaImp = null;
function centroBusqueda() { const m = muniElegido(); return centroManual || (m ? { lat: m.lat, lng: m.lng } : (municipios[0] ? { lat: municipios[0].lat, lng: municipios[0].lng } : { lat: 6.2442, lng: -75.5812 })); }

function iniciarMapaImp() {
  if (mapaImp || typeof L === "undefined" || !$("ac-mapa")) return;
  const c = centroBusqueda();
  mapaImp = crearMapaBase("ac-mapa", [c.lat, c.lng], 14);
  capaImp = L.layerGroup().addTo(mapaImp);
  mapaImp.on("click", e => {
    if (modoDonde !== "radio" || !muniElegido()) return;
    centroManual = { lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) };
    pintarDonde();
  });
}

function pintarZonaMapa() {
  if (!mapaImp) return;
  if (circuloImp) { mapaImp.removeLayer(circuloImp); circuloImp = null; }
  const radio = parseInt($("ac-radio").value, 10);
  if (modoDonde === "radio" && muniElegido()) {
    const c = centroBusqueda();
    circuloImp = L.circle([c.lat, c.lng], { radius: radio, color: "#4f46e5", weight: 2, fillOpacity: 0.06, dashArray: "6 6" });
    mapaImp.addLayer(circuloImp);
  }
}

function moverMapaAMuni() {
  const m = muniElegido();
  if (mapaImp && m) mapaImp.setView([m.lat, m.lng], modoDonde === "todo" ? 13 : 14);
}

function cajaMapa() {
  const b = mapaImp && mapaImp.getBounds ? mapaImp.getBounds() : null;
  if (!b || !b.getSouth) return null;
  return { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() };
}

const COLOR_PIN = { nuevo: "#f97316", parecido: "#94a3b8", ya: "#16a34a" };
function pintarPinesImp() {
  if (!capaImp) return;
  capaImp.clearLayers();
  candidatos.forEach(c => {
    const f = c.fila;
    L.circleMarker([f.lat, f.lng], { radius: c.marcado ? 7 : 5, color: "#fff", weight: 2, fillColor: COLOR_PIN[c.estado], fillOpacity: 1 })
      .bindPopup(`<b>${esc(iconosComercio[f.tipo] || "🏪")} ${esc(f.nombre)}</b><br>${esc(ETIQUETA_ESTADO[c.estado])}${f.direccion ? "<br>" + esc(f.direccion) : ""}`)
      .addTo(capaImp);
  });
}

// ---------- Buscar ----------
const estadoMuni = {};   // id del trabajo → "pend" | "buscando" | "ok" | "fallo"
let trabajosUltimos = [];

function pintarProgreso(lista) {
  const icono = { pend: "⏳", buscando: "🔎", ok: "✔", fallo: "✖" };
  $("ac-progreso").innerHTML = lista.map(m =>
    `<li class="px-2 py-1 rounded-full border ${estadoMuni[m.id] === "fallo" ? "bg-red-50 border-red-200 text-red-700" : estadoMuni[m.id] === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-600"}">${icono[estadoMuni[m.id]] || "⏳"} ${esc(m.nombre)}</li>`).join("");
}

function muniMasCercano(lat, lng) {
  let mejor = municipios[0], d = Infinity;
  municipios.forEach(m => { const x = distanciaKm({ lat, lng }, m); if (x < d) { d = x; mejor = m; } });
  return mejor;
}

// Arma la lista de búsquedas según «Dónde»
function armarTrabajos() {
  const radio = parseInt($("ac-radio").value, 10);
  const m = muniElegido();
  if (modoDonde === "zona") {
    const b = cajaMapa();
    if (!b) throw new Error("El mapa aún no está listo");
    const lado = Math.max(distanciaKm({ lat: b.s, lng: b.w }, { lat: b.s, lng: b.e }), distanciaKm({ lat: b.s, lng: b.w }, { lat: b.n, lng: b.w }));
    if (lado > 12.5) throw new Error(`La zona del mapa es muy grande (${Math.round(lado)} km de lado). Acércate un poco más (máx. unos 12 km).`);
    const centro = { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 };
    return [{ id: "zona", nombre: "Zona del mapa", zona: zonaCaja(b), muni: muniMasCercano, centro, limite: 2000,
              dentro: e => e.lat >= b.s && e.lat <= b.n && e.lng >= b.w && e.lng <= b.e, muniId: null }];
  }
  const lista = m ? [m] : municipios.slice();
  return lista.map(x => {
    if (modoDonde === "todo") return { id: x.id, nombre: x.nombre, zona: zonaMunicipio(x), muni: x, centro: { lat: x.lat, lng: x.lng }, limite: 3000,
      lejos: 40, dentro: e => e.municipioId === x.id, muniId: x.id };
    const c = m && centroManual ? centroManual : { lat: x.lat, lng: x.lng };
    return { id: x.id, nombre: x.nombre, zona: zonaRadio(c, radio), muni: x, centro: c, limite: 1500,
      dentro: e => distanciaKm(c, e) <= radio / 1000, muniId: x.id };
  });
}

function leerFiltros() {
  return { tel: $("ac-f-tel").checked, horario: $("ac-f-horario").checked, sinCadenas: $("ac-f-cadenas").checked, soloNuevos: $("ac-solo-nuevos").checked };
}

async function buscar(soloFallidos) {
  const btn = $("ac-buscar");
  if (!tiposElegidos.size) { $("ac-estado").textContent = "⚠️ Elige al menos un tipo de comercio."; return; }
  let lista;
  try { lista = soloFallidos === true ? trabajosUltimos.filter(t => estadoMuni[t.id] === "fallo") : armarTrabajos(); }
  catch (e) { $("ac-estado").textContent = "⚠️ " + e.message; return; }
  if (soloFallidos !== true) { candidatos = []; trabajosUltimos = lista; conteos = { nuevo: 0, ya: 0, parecido: 0, sinNombre: 0, filtrados: 0, fueraCuota: 0, repetido: 0 }; }
  conteos = conteos || { nuevo: 0, ya: 0, parecido: 0, sinNombre: 0, filtrados: 0, fueraCuota: 0, repetido: 0 };
  btn.disabled = true; cancelar = false;
  $("ac-cancelar").classList.remove("hidden");
  $("ac-reintentar").classList.add("hidden");
  const cuota = leerCuotas(), filtros = leerFiltros(), permitidos = new Set(tiposElegidos);
  const tipos = [...tiposElegidos];
  lista.forEach(m => { estadoMuni[m.id] = "pend"; });
  const inicio = Date.now();
  try {
    pintarProgreso(lista);
    $("ac-estado").textContent = "Revisando lo que ya tienes guardado…";
    const existentes = await cargarComerciosAdmin();
    const usados = new Set(candidatos.map(c => c.fila.osm_id));
    for (let i = 0; i < lista.length && !cancelar; i++) {
      const tr = lista[i];
      estadoMuni[tr.id] = "buscando"; pintarProgreso(lista);
      let detalle = "";
      const tick = setInterval(() => { $("ac-estado").textContent = `Buscando en ${tr.nombre} (${i + 1}/${lista.length})… ${Math.round((Date.now() - inicio) / 1000)} s · ${detalle}`; }, 500);
      try {
        const datos = await pedirOverpass(consultaOverpass(tr.zona, tipos, tr.limite), t => { detalle = t; });
        const items = [];
        (datos.elements || []).forEach(el => {
          const r = aFila(el, tr.muni, permitidos);
          if (!r) return;
          if (r.sinNombre) { conteos.sinNombre++; return; }
          if (tr.lejos && distanciaKm(tr.centro, r.fila) > tr.lejos) return;
          const f = r.fila;
          if ((filtros.tel && !f.telefono) || (filtros.horario && !f.horario) || (filtros.sinCadenas && r.marca && f.tipo !== "cajero" && f.tipo !== "banco")) { conteos.filtrados++; return; }
          items.push(r);
        });
        const { salida, c } = clasificar(items, tr.centro, cuota, existentes, { soloNuevos: filtros.soloNuevos, dentro: tr.dentro, usados });
        Object.keys(c).forEach(k => { conteos[k] += c[k]; });
        candidatos.push(...salida);
        estadoMuni[tr.id] = "ok";
        pintarPrevia();
      } catch (e) {
        console.warn(tr.nombre, e.message);
        estadoMuni[tr.id] = cancelar ? "pend" : "fallo";
        tr.error = e.message;
      } finally { clearInterval(tick); }
      pintarProgreso(lista);
      if (i < lista.length - 1 && !cancelar) await dormir(1000);   // respiro entre consultas (reglas de Overpass)
    }
    const fallaron = lista.filter(m => estadoMuni[m.id] === "fallo");
    let msg = cancelar ? "Búsqueda cancelada. " : "";
    const elegibles = candidatos.filter(c => c.estado !== "ya").length;
    if (!cancelar && !fallaron.length && !elegibles)
      msg += conteos.ya ? `No hay comercios nuevos: los ${conteos.ya} que encontró ya los tienes guardados. Prueba otra zona, más radio o más tipos.`
        : "No hay comercios nuevos para esos filtros. Prueba con más radio, más tipos o quitando filtros.";
    else if (!cancelar && elegibles) msg += `✔ Listo: ${conteos.nuevo} nuevos para importar${conteos.parecido ? ` y ${conteos.parecido} parecidos a uno tuyo (sin marcar)` : ""}. Revisa la lista y el mapa.`;
    if (fallaron.length) {
      msg += ` ⚠️ No respondieron: ${fallaron.map(m => m.nombre).join(", ")}. (${fallaron[0].error || ""}) Toca «Reintentar» o «🩺 Probar servidores».`;
      $("ac-reintentar").classList.remove("hidden");
    }
    $("ac-estado").textContent = msg.trim();
    pintarPrevia();
  } catch (e) {
    console.error(e);
    $("ac-estado").textContent = "⚠️ " + (e.message || e);
  } finally {
    btn.disabled = false;
    $("ac-cancelar").classList.add("hidden");
  }
}

function nombreMuni(id) { return (municipios.find(m => m.id === id) || {}).nombre || ""; }

const ETIQUETA_ESTADO = { nuevo: "nuevo", parecido: "parecido a uno tuyo", ya: "ya lo tienes" };
const CHIP_ESTADO = { nuevo: "bg-green-100 text-green-800", parecido: "bg-amber-100 text-amber-800", ya: "bg-slate-200 text-slate-600" };

function pintarPrevia() {
  $("ac-previa").classList.toggle("hidden", !candidatos.length);
  const k = conteos || {};
  $("ac-conteos").innerHTML = [
    `<span title="Entran marcados">🟠 ${k.nuevo || 0} nuevos</span>`,
    `<span title="Ya están en Merkap: no se pueden volver a importar">🟢 ${k.ya || 0} ya los tienes</span>`,
    `<span title="Mismo nombre y tipo a menos de 60 m de uno tuyo: entran sin marcar">⚪ ${k.parecido || 0} parecidos</span>`,
    `<span title="En OpenStreetMap no tienen nombre">${k.sinNombre || 0} sin nombre (omitidos)</span>`,
    k.filtrados ? `<span title="No cumplen los filtros (teléfono, horario, cadenas)">${k.filtrados} por filtros</span>` : "",
    k.fueraCuota ? `<span title="Sobran por la cuota: sube la cuota para verlos">${k.fueraCuota} fuera de la cuota</span>` : ""
  ].join("");
  $("ac-previa-lista").innerHTML = candidatos.map((c, i) => {
    const f = c.fila, ya = c.estado === "ya";
    const extra = [nombreMuni(f.municipio_id), f.direccion, f.telefono ? "📞 " + f.telefono : "", f.horario ? "🕒 " + f.horario : "", c.web ? "🌐 " + c.web.replace(/^https?:\/\/(www\.)?/, "") : "",
      c.parecidoA ? `a menos de 60 m de «${c.parecidoA}» guardado` : ""].filter(Boolean).map(esc).join(" · ");
    return `<label class="flex items-start gap-2 p-2.5 ${ya ? "opacity-60" : "hover:bg-slate-50 cursor-pointer"}" data-estado-imp="${c.estado}">
      <input type="checkbox" data-i="${i}" ${c.marcado ? "checked" : ""} ${ya ? "disabled" : ""} class="mt-1">
      <span class="min-w-0 flex-1"><b>${esc(iconosComercio[f.tipo] || "🏪")} ${esc(f.nombre)}</b>
        <span class="ml-1 text-[11px] font-bold rounded-full px-1.5 py-0.5 ${CHIP_ESTADO[c.estado]}">${ETIQUETA_ESTADO[c.estado]}</span>
        <span class="block text-slate-500 text-xs break-words">${extra}</span></span>
    </label>`;
  }).join("");
  actualizarResumen();
  pintarPinesImp();
}

function actualizarResumen() {
  const n = candidatos.filter(c => c.marcado).length;
  const elegibles = candidatos.filter(c => c.estado !== "ya").length;
  $("ac-resumen").textContent = `${n} de ${elegibles} seleccionados`;
  $("ac-importar").textContent = `💾 Importar ${n} como «Ubicado»`;
  $("ac-importar").disabled = !n;
  $("ac-csv").textContent = `⬇ CSV para visitas (${n || candidatos.length})`;
}

function marcarTodos(valor) {
  candidatos.forEach(c => { if (c.estado !== "ya") c.marcado = valor && c.estado === "nuevo" ? true : valor ? c.marcado : false; });
  pintarPrevia();
}

// CSV para visitar los comercios (Excel en español: separado por «;» y con BOM para las tildes)
function descargarCSV() {
  const lista = candidatos.some(c => c.marcado) ? candidatos.filter(c => c.marcado) : candidatos;
  if (!lista.length) return;
  const cab = ["Nombre", "Categoría", "Municipio", "Dirección", "Teléfono", "Horario", "Sitio web", "Estado", "Latitud", "Longitud", "Google Maps", "OpenStreetMap"];
  const celda = v => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const filas = lista.map(c => {
    const f = c.fila, tipo = TIPOS_COMERCIO.find(t => t.id === f.tipo);
    return [f.nombre, tipo ? tipo.nombre : f.tipo, nombreMuni(f.municipio_id), f.direccion, f.telefono, f.horario, c.web, ETIQUETA_ESTADO[c.estado],
      f.lat, f.lng, urlMapa(f), "https://www.openstreetmap.org/" + f.osm_id].map(celda).join(";");
  });
  const csv = "﻿" + [cab.join(";")].concat(filas).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const zona = muniElegido() && modoDonde !== "zona" ? normalizar(muniElegido().nombre).replace(/\s+/g, "-") : "zona";
  a.download = `comercios-osm-${zona}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function guardarSeleccion() {
  const elegidos = candidatos.filter(c => c.marcado);
  const filas = elegidos.map(c => c.fila);
  if (!filas.length) { mostrarToast("No hay comercios seleccionados", "error"); return; }
  const btn = $("ac-importar");
  btn.disabled = true;
  try {
    const nuevos = await importarComerciosDB(filas);
    mostrarToast(`✅ ${nuevos} comercios guardados como «Ubicado» (${filas.length - nuevos} ya existían)`);
    elegidos.forEach(c => { c.estado = "ya"; c.marcado = false; });   // quedan en verde en el mapa
    if (conteos) { conteos.ya += elegidos.length; conteos.nuevo = candidatos.filter(c => c.estado === "nuevo").length; conteos.parecido = candidatos.filter(c => c.estado === "parecido").length; }
    pintarPrevia();
    await refrescarLista();
  } catch (e) {
    console.error(e);
    mostrarToast(mensajeError(e), "error");
  } finally { actualizarResumen(); }
}

function conectarImportador() {
  const lista = tiposImportables().map(t => t.id);
  const guardados = Array.isArray(prefImp.tipos) ? prefImp.tipos.filter(id => lista.includes(id)) : null;
  tiposElegidos = new Set(guardados && guardados.length ? guardados : TIPOS_BASICOS.filter(id => lista.includes(id)));
  if (!PRESETS[prefImp.preset]) prefImp.preset = "normal";
  pintarTiposImp();
  $("ac-servidor").innerHTML = '<option value="auto">Automático (uno a la vez)</option>' + SERVIDORES.map(s => `<option value="${esc(s.url)}">${esc(s.nombre)}</option>`).join("");
  $("ac-tipos").addEventListener("click", e => { const b = e.target.closest("[data-tipo-imp]"); if (b) elegirTipo(b.dataset.tipoImp); });
  $("ac-tipos-todos").addEventListener("click", () => { tiposImportables().forEach(t => elegirTipo(t.id, true)); });
  $("ac-tipos-ninguno").addEventListener("click", () => { [...tiposElegidos].forEach(id => elegirTipo(id, false)); });
  $("ac-tipos-basicos").addEventListener("click", () => { const l = tiposImportables().map(t => t.id); l.forEach(id => elegirTipo(id, TIPOS_BASICOS.includes(id))); });
  document.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => aplicarPreset(b.dataset.preset)));
  $("ac-cuotas").addEventListener("input", e => {
    const id = (e.target.id || "").replace(/^cuota-/, ""); if (!id) return;
    prefImp.cuotas = prefImp.cuotas || {}; prefImp.cuotas[id] = e.target.value; prefImp.preset = ""; guardarPrefImp(); pintarPresets();
  });
  document.querySelectorAll("[data-donde]").forEach(b => b.addEventListener("click", () => {
    modoDonde = b.dataset.donde;
    if (modoDonde === "zona" && mapaImp) mapaImp.setView(mapaImp.getCenter(), 15);
    pintarDonde(); if (modoDonde !== "zona") moverMapaAMuni();
  }));
  $("ac-muni").addEventListener("change", () => { centroManual = null; pintarDonde(); moverMapaAMuni(); });
  $("ac-radio").addEventListener("change", pintarZonaMapa);
  $("ac-donde-ayuda").addEventListener("click", e => { if (e.target.id === "ac-centro-reset") { centroManual = null; pintarDonde(); moverMapaAMuni(); } });
  $("ac-probar").addEventListener("click", probarServidores);
  $("ac-todos").addEventListener("click", () => marcarTodos(true));
  $("ac-ninguno").addEventListener("click", () => marcarTodos(false));
  $("ac-csv").addEventListener("click", descargarCSV);
  iniciarMapaImp();
  pintarDonde();
}

// ---------- Editor / verificación ----------
function urlMapa(c) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.lat + "," + c.lng); }
function urlMapaNombre(c) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.nombre + " " + c.ciudad + " Antioquia"); }

// Fase 2Z.8: «desde casa» y «solo domicilios» → el servidor corre el punto y borra la dirección pública
const opcionesModo = actual => Object.entries(MODOS_ATENCION).map(([k, m]) => `<option value="${k}" ${k === (actual || "local") ? "selected" : ""}>${m.icono} ${esc(m.nombre)}</option>`).join("");

function filaEditor(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const campo = (k, etq, v, ph) => `<label class="text-xs font-bold text-slate-500">${etq}
    <input data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>`;
  return `<article class="border border-slate-200 rounded-xl p-3" data-id="${c.id}">
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <b>${esc(t ? t.icono : "📍")} ${esc(c.nombre)}</b>
      ${c.confirmaSi || c.confirmaNo ? `<span class="text-xs ${comercioDudoso(c) ? "bg-red-100 text-red-800" : "bg-sky-100 text-sky-800"} px-2 py-0.5 rounded-full font-semibold">👥 ${c.confirmaSi} sí${c.confirmaLugar ? " (" + c.confirmaLugar + " en el lugar)" : ""} · ${c.confirmaNo} no</span>` : ""}
      ${esUbicacionAprox(c) ? `<span class="badge-modo ${c.modoAtencion}">${MODOS_ATENCION[c.modoAtencion].icono} ${MODOS_ATENCION[c.modoAtencion].corto} · zona aproximada</span>` : ""}
      <span class="text-xs text-slate-500">${esc(c.ciudad)}</span>
      <span class="text-xs ${(SELLOS[c.nivel] || SELLOS[1]).clase} px-2 py-0.5 rounded-full font-semibold">${c.nivel >= 2 ? "✔ " : ""}${esc((SELLOS[c.nivel] || SELLOS[1]).corto)}${c.verificadoEn ? " · " + esc(fechaSello(c)) : ""}</span>
      ${selloVencido(c) ? '<span class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-semibold">⚠ Vencida: repetir verificación</span>' : ""}
      ${c.activo ? "" : '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculto</span>'}
      <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${ORIGENES[origenComercio(c)].icono} ${esc(ORIGENES[origenComercio(c)].corto)}</span>
      <button type="button" data-acc="editor" class="ml-auto text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg font-semibold">✏️ Editor completo</button>
      <button type="button" data-acc="verificar" class="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg font-semibold">✅ Verificar</button>
      <button type="button" data-acc="ubicacion" class=" text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-semibold">📍 Corregir ubicación</button>
      <a href="${esc(urlMapa(c))}" target="_blank" rel="noopener" class="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg font-semibold">🗺️ Ver pin</a>
      <a href="${esc(urlMapaNombre(c))}" target="_blank" rel="noopener" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-1.5 rounded-lg font-semibold">🔎 Buscar en Google</a>
      <a href="marketing.html?destino=tienda&canal=qr&id=${c.id}&codigo=${esc(encodeURIComponent(slugRef("tienda-" + c.nombre)))}" class="text-xs bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 py-1.5 rounded-lg font-semibold">🔳 QR del comercio</a>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      ${campo("nombre", "Nombre", c.nombre, "")}
      ${campo("direccion", "Dirección", c.direccion, "Cra 43A # 10-20")}
      ${campo("telefono", "Teléfono", c.telefono, "604 123 4567")}
      ${campo("whatsapp", "💬 WhatsApp (10 dígitos)", (c.whatsapp || "").replace(/^57/, ""), "300 123 4567")}
      ${campo("horario", "Horario", c.horario, "Lun-Sáb 8:00-20:00")}
      <label class="text-xs font-bold text-slate-500">🏷️ Categoría principal
        <select data-k="tipo" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesCategoria(c.tipo)}</select></label>
      <label class="text-xs font-bold text-slate-500">Secundaria 1 (opcional)
        <select data-extra class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesCategoria((c.tiposExtra || [])[0] || "", "— Ninguna —")}</select></label>
      <label class="text-xs font-bold text-slate-500">Secundaria 2 (opcional)
        <select data-extra class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesCategoria((c.tiposExtra || [])[1] || "", "— Ninguna —")}</select></label>
      <label class="text-xs font-bold text-slate-500">¿Cómo atiende?
        <select data-k="modo_atencion" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm bg-white text-slate-800">${opcionesModo(c.modoAtencion)}</select></label>
      <div class="text-xs font-bold text-slate-500 sm:col-span-2">Foto del local
        <div class="flex flex-wrap items-center gap-2 mt-0.5">
          ${c.foto ? `<img src="${esc(urlSegura(c.foto))}" alt="Ver fotos" data-ver-fotos="${c.id}" class="w-10 h-10 rounded object-cover cursor-zoom-in">` : ""}
          ${c.fotos.length > 1 ? `<span class="font-normal text-slate-500">${c.fotos.length} fotos</span>` : ""}
          <span class="foto-botones">
            <label class="foto-btn"><input type="file" data-foto data-grupo-foto="ed" accept="image/*" capture="environment" class="sr-only">📷 Tomar foto</label>
            <label class="foto-btn"><input type="file" data-foto data-grupo-foto="ed" accept="image/*" class="sr-only">🖼️ Galería</label>
          </span>
          <span data-foto-nombre="ed" class="text-[11px] font-normal text-slate-500"></span>
        </div></div>
    </div>
    <div class="flex flex-wrap items-center gap-2 mt-2 text-xs">
      <span class="font-bold text-slate-500">🙋 Dueño:</span>
      ${c.ownerId ? '<span class="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-semibold">asignado</span>' : '<span class="text-slate-400">sin asignar</span>'}
      <input data-dueno placeholder="correo de su cuenta" class="solo-admin border border-slate-300 p-1.5 rounded-lg w-44 sm:w-56">
      <button type="button" data-acc="dueno" class="solo-admin bg-teal-600 hover:bg-teal-700 text-white font-semibold px-2.5 py-1.5 rounded-lg">Asignar</button>
      ${c.ownerId ? '<button type="button" data-acc="quitar-dueno" class="solo-admin text-red-600 hover:underline">Quitar</button>' : ""}
      <a href="mi-tienda.html?id=${c.id}" class="ml-auto text-indigo-600 underline">🛍️ ${c.nProductos ? c.nProductos + " producto(s) · editar vitrina" : "Editar vitrina"}</a>
    </div>
    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm">
      <label class="flex items-center gap-1.5"><input type="checkbox" data-k="activo" ${c.activo ? "checked" : ""}> Visible en el mapa</label>
      <button type="button" data-acc="guardar" class="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm disabled:opacity-60">Guardar</button>
      <button type="button" data-acc="borrar" class="solo-admin text-red-600 hover:underline text-xs">Borrar</button>
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
  // Arreglo 25 oct: el buscador entiende errores de escritura, plurales y categorías («farmacita» → farmacias),
  // con el mismo buscador inteligente del directorio (buscador.js). Los resultados salen por relevancia.
  let base = listaAdmin.filter(c => (!m || String(c.municipioId) === m) && pasaEstado(c, v));
  if (q) {
    const exactos = base.filter(c => normalizar(c.nombre + " " + c.direccion).includes(q));
    const texto = $("ac-buscar-nombre").value.trim();
    const inteligentes = typeof comercioCoincide === "function" ? base.filter(c => !exactos.includes(c) && comercioCoincide(c, texto)) : [];
    base = exactos.concat(inteligentes);   // primero los que dicen exactamente lo escrito
  }
  const cuenta = { todos: base.length, osm: 0, equipo: 0, dueno: 0, reclamado: 0, comunidad: 0 };
  base.forEach(c => { cuenta[origenComercio(c)]++; });
  $("ac-origenes").innerHTML = [["todos", "Todos"]].concat(Object.entries(ORIGENES).map(([k, o]) => [k, o.icono + " " + o.corto]))
    .map(([k, txt]) => `<button type="button" role="tab" data-origen="${k}" class="text-xs font-semibold px-3 py-1.5 rounded-full border ${origenAct === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"}">${txt} <b>${cuenta[k]}</b></button>`).join("");
  const porOrigen = base.filter(c => origenAct === "todos" || origenComercio(c) === origenAct);
  pintarCategoriasFiltro(porOrigen, m);
  const lista = soloId !== null ? listaAdmin.filter(c => c.id === soloId)
    : porOrigen.filter(c => !catAct || comercioEsTipo(c, catAct));
  if (soloId === null && vistaAct === "grupos") { pintarAgrupada(lista); pintarPendientes(); return; }
  const visibles = soloId !== null ? lista : lista.slice(0, limiteLista);
  $("ac-lista").innerHTML = lista.length
    ? (origenAct !== "todos" && soloId === null ? `<p class="text-xs text-slate-500">${esc(ORIGENES[origenAct].nombre)}</p>` : "") + visibles.map(filaEditor).join("")
      + (lista.length > visibles.length ? `<div class="text-center"><button type="button" id="ac-mas" class="bg-white border border-slate-300 hover:border-indigo-400 font-semibold px-5 py-2 rounded-xl text-sm">Ver ${Math.min(40, lista.length - visibles.length)} más (${lista.length - visibles.length} restantes)</button></div>` : "")
    : `<p class="text-sm text-slate-400 text-center py-8">${listaAdmin.length ? "No hay comercios con estos filtros 🎉" : "Aún no hay comercios. Importa algunos arriba o usa «Agregar comercio»."}</p>`;
  pintarPendientes();
}

// ---------- Clasificar por categoría (fase 2AA.3) ----------
// Chips con cuántos comercios hay de cada categoría en el municipio y filtros elegidos (principal o secundaria),
// y cuántos están verificados. «🗂️ Agrupada» muestra secciones por categoría con su avance de verificación.
let catAct = "", vistaAct = (() => { try { return localStorage.getItem("mf_ac_vista") || "lista"; } catch (e) { return "lista"; } })();
const nivelesDe = l => ({ total: l.length, ver: l.filter(c => c.nivel >= 2).length, ocultos: l.filter(c => !c.activo).length });
function pintarCategoriasFiltro(lista, muni) {
  const cuenta = TIPOS_COMERCIO.map(t => {
    const de = lista.filter(c => comercioEsTipo(c, t.id));
    return { t, ...nivelesDe(de) };
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total || a.t.nombre.localeCompare(b.t.nombre, "es"));
  if (catAct && !cuenta.some(x => x.t.id === catAct)) catAct = "";   // la categoría ya no tiene comercios aquí
  const mun = muni ? municipios.find(x => String(x.id) === String(muni)) : null;
  $("ac-cats-ctx").textContent = "· " + (mun ? mun.nombre : "todos los municipios") + " · " + cuenta.length + " categorías";
  const chip = (id, txt, n, ver, act) => `<button type="button" role="tab" aria-selected="${act}" data-cat-filtro="${esc(id)}" title="${ver} verificados de ${n}"
    class="ac-cat-chip ${act ? "activo" : ""}">${txt} <b>${n}</b>${n ? `<span class="ac-cat-ver">${ver ? "✔" + ver : "⏳"}</span>` : ""}</button>`;
  const todos = nivelesDe(lista);
  $("ac-cats").innerHTML = chip("", "Todas", todos.total, todos.ver, !catAct) + cuenta.map(x => chip(x.t.id, x.t.icono + " " + esc(x.t.nombre), x.total, x.ver, catAct === x.t.id)).join("");
  document.querySelectorAll(".ac-vista-btn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vista === vistaAct)));
}
// Vista agrupada: una sección por categoría PRINCIPAL (así nadie sale repetido), con barra de avance
function pintarAgrupada(lista) {
  const grupos = new Map();
  lista.forEach(c => { if (!grupos.has(c.tipo)) grupos.set(c.tipo, []); grupos.get(c.tipo).push(c); });
  const orden = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  if (!orden.length) { $("ac-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-8">No hay comercios con estos filtros 🎉</p>'; return; }
  $("ac-lista").innerHTML = orden.map(([tipo, cs]) => {
    const t = TIPOS_COMERCIO.find(x => x.id === tipo) || { icono: "🏪", nombre: tipo };
    const n = nivelesDe(cs), pct = Math.round(n.ver * 100 / n.total);
    const muestra = cs.slice(0, 10);
    return `<details class="ac-grupo" data-grupo="${esc(tipo)}" ${orden.length <= 3 ? "open" : ""}>
      <summary><span class="font-black text-indigo-900">${t.icono} ${esc(t.nombre)}</span> <b>${n.total}</b>
        <span class="ac-barra" aria-label="${pct}% verificados"><span style="width:${pct}%"></span></span>
        <span class="text-xs text-slate-500">✔ ${n.ver} verificados · ⏳ ${n.total - n.ver} por verificar${n.ocultos ? " · 🙈 " + n.ocultos + " ocultos" : ""}</span></summary>
      <div class="space-y-3 mt-3">${muestra.map(filaEditor).join("")}
        ${cs.length > muestra.length ? `<button type="button" data-cat-filtro="${esc(tipo)}" class="w-full bg-white border border-slate-300 hover:border-indigo-400 font-semibold py-2 rounded-xl text-sm">Ver los ${cs.length} de ${esc(t.nombre)} →</button>` : ""}
      </div></details>`;
  }).join("");
}

// ---------- Resumen de pendientes ----------
let otrosPend = { negocios: null, solicitudes: null, reportes: null, comercios: null, recomendados: null };

function tarjetaPend(icono, n, texto, atributos, href) {
  const cls = "text-left border rounded-xl p-3 " + (n > 0 ? "border-indigo-200 bg-indigo-50 hover:border-indigo-400" : "border-slate-200 bg-slate-50 text-slate-400");
  const cuerpo = `<span class="text-xl">${icono}</span><span class="block text-2xl font-black ${n > 0 ? "text-indigo-900" : ""}">${n === null ? "…" : n}</span><span class="block text-xs font-semibold">${texto}</span>`;
  return href ? `<a href="${href}" class="${cls} no-underline ${n > 0 ? "text-inherit" : ""}">${cuerpo}</a>` : `<button type="button" ${atributos} class="${cls}">${cuerpo}</button>`;
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

// Fase 2AA.1: al recargar la lista (p. ej. tras «Corregir ubicación» o verificar) NO se pierde lo que estabas
// escribiendo en otras fichas: se guarda un borrador de los campos cambiados y se vuelve a poner.
const SEL_CAMPOS = "[data-k], [data-extra], [data-dueno]";
function capturarBorradores(excepto) {
  const m = new Map();
  document.querySelectorAll("#ac-lista [data-id]").forEach(f => {
    if (String(f.dataset.id) === String(excepto)) return;
    const cambios = {};
    f.querySelectorAll(SEL_CAMPOS).forEach((el, i) => {
      const v = el.type === "checkbox" ? el.checked : el.value;
      const def = el.type === "checkbox" ? el.defaultChecked
        : el.tagName === "SELECT" ? (([...el.options].find(o => o.defaultSelected) || el.options[0] || {}).value) : el.defaultValue;
      if (v !== def) cambios[i] = v;
    });
    if (Object.keys(cambios).length) m.set(String(f.dataset.id), cambios);
  });
  return m;
}
function restaurarBorradores(m) {
  m.forEach((cambios, id) => {
    const f = document.querySelector(`#ac-lista [data-id="${id}"]`);
    if (!f) return;
    const els = f.querySelectorAll(SEL_CAMPOS);
    Object.entries(cambios).forEach(([i, v]) => { const el = els[i]; if (!el) return; if (el.type === "checkbox") el.checked = v; else el.value = v; });
    f.classList.add("ficha-borrador");
    f.insertAdjacentHTML("afterbegin", '<p class="text-xs font-semibold text-amber-700 mb-1">✏️ Tienes cambios sin guardar en esta ficha: toca «Guardar».</p>');
  });
}
async function refrescarLista(excepto) {
  const borradores = capturarBorradores(excepto);
  try {
    listaAdmin = await cargarComerciosAdmin();
    pintarLista();                        // se conserva cuántas fichas había abiertas (limiteLista)
    restaurarBorradores(borradores);
    if ($("cat-lista")) pintarCategorias();
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
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
  limpiarFoto("nu");
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
    const archivo = fotoElegida("nu");
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
  if (ubParaEditor) {   // fase 2AA.2: el pin vuelve al editor completo (se guarda con «Guardar todo»)
    edCoords = { lat: coordsUb.lat, lng: coordsUb.lng };
    if ($("ub-direccion").value.trim()) $("ed-dir").value = $("ub-direccion").value.trim();
    ubParaEditor = false; marcarEditorSucio(); pintarCoordsEditor();
    cerrarModal("modal-ubicacion");
    return;
  }
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
// Lo único obligatorio para aprobar (el resto es opcional y queda en el historial)
const MINIMO_VERIF = { telefono: "nombre_dir", visita: "existe" };
let comercioVi = null, gpsVi = null;

const metodoVi = () => document.querySelector('input[name="vi-metodo"]:checked').value;

function pintarListaVi() {
  const m = metodoVi();
  $("vi-lista").innerHTML = '<p class="text-xs text-slate-500">Marca lo que comprobaste. Solo el primero es obligatorio; lo demás queda anotado en el historial.</p>' + LISTA_VERIF[m].map(([k, t]) =>
    `<label class="flex items-start gap-2"><input type="checkbox" data-v="${k}" class="mt-1 shrink-0"> <span>${esc(t)}${k === MINIMO_VERIF[m] ? ' <b class="text-indigo-700">(obligatorio)</b>' : ""}</span></label>`).join("");
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
  limpiarFoto("vi"); $("vi-notas").value = ""; $("vi-gps-txt").textContent = "Sin capturar: se conserva el pin actual";
  errorVi("");
  pintarListaVi();
  $("vi-historial").innerHTML = '<li class="text-slate-400">Cargando…</li>';
  abrirModal("modal-visita");
  try {
    const h = await cargarVerificaciones(id);
    $("vi-historial").innerHTML = h.length ? h.map(v => {
      const f = new Date(v.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
      // Fase 2AA.1: qué se comprobó (los puntos marcados) y si hubo foto
      const corto = { nombre_dir: "nombre y dirección", telefono_negocio: "teléfono", existe: "existe", responsable: "responsable", pin_puerta: "pin", terminos: "términos" };
      const hechos = Object.entries(v.lista || {}).filter(([, x]) => x).map(([k]) => corto[k] || k);
      return `<li>${v.resultado === "aprobada" ? "✅" : "❌"} ${f} · ${v.metodo === "visita" ? "En persona" : "Por teléfono"}${v.verificador_id === (usuarioActual && usuarioActual.id) ? " · tú" : ""}${v.resultado === "aprobada" && hechos.length ? " · comprobado: " + esc(hechos.join(", ")) : ""}${v.resultado === "aprobada" && v.metodo === "visita" && !v.foto_fachada_url ? " · sin foto" : ""}${v.notas ? " · " + esc(v.notas) : ""}</li>`;
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
  const archivo = fotoElegida("vi");
  if (resultado === "aprobada") {
    // Fase 2AA.1: tú decides. Solo es obligatorio el punto principal; lo demás queda registrado tal cual.
    const minimo = MINIMO_VERIF[m];
    if (!lista[minimo]) { errorVi("Para aprobar, marca al menos: «" + LISTA_VERIF[m].find(x => x[0] === minimo)[1] + "». Si no se cumple, usa «No se pudo verificar»."); return; }
    const faltan = LISTA_VERIF[m].filter(([k]) => !lista[k]).length;
    if (m === "visita" && !archivo && !confirm("Vas a verificar sin foto de la fachada" + (faltan ? " y con " + faltan + " punto(s) sin marcar" : "") + ". ¿Guardar así?")) return;
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

// ---------- Editor completo de un comercio (fase 2AA.2) ----------
// Todo lo que tienen el registro de negocio y «Mi tienda», en pestañas y con un solo «Guardar todo».
// La ubicación se mueve con el mismo mapa de «Corregir ubicación», pero vuelve aquí sin guardarse sola.
let edC = null, edCoords = null, edSucio = false, ubParaEditor = false, edGaleria = null, edLogo = null;
function marcarEditorSucio() { edSucio = true; $("ed-sucio").classList.remove("hidden"); }
function pintarCoordsEditor() {
  const p = edCoords || edC;
  $("ed-coords").textContent = tieneCoords(p) ? p.lat.toFixed(5) + ", " + p.lng.toFixed(5) : "sin ubicar";
  $("ed-coords-cambio").classList.toggle("hidden", !edCoords);
  $("ed-ver-pin").href = tieneCoords(p) ? urlGoogleMaps(p.lat, p.lng) : "#";
}
function tabEditor(t) {
  document.querySelectorAll("#modal-editor [data-ed-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.edTab === t)));
  document.querySelectorAll("#modal-editor [data-ed-panel]").forEach(p => p.classList.toggle("hidden", p.dataset.edPanel !== t));
}
function abrirEditor(id) {
  const c = listaAdmin.find(x => x.id === id);
  if (!c) return;
  edC = c; edCoords = null; edSucio = false; ubParaEditor = false;
  $("ed-sucio").classList.add("hidden");
  $("ed-nombre-tit").textContent = c.nombre;
  $("ed-sub").textContent = [c.ciudad, (SELLOS[c.nivel] || SELLOS[1]).corto, ORIGENES[origenComercio(c)].corto].filter(Boolean).join(" · ");
  $("ed-nombre").value = c.nombre;
  $("ed-tipo").innerHTML = opcionesCategoria(c.tipo);
  $("ed-extra1").innerHTML = opcionesCategoria((c.tiposExtra || [])[0] || "", "— Ninguna —");
  $("ed-extra2").innerHTML = opcionesCategoria((c.tiposExtra || [])[1] || "", "— Ninguna —");
  $("ed-modo").innerHTML = opcionesModo(c.modoAtencion);
  $("ed-desc").value = c.descripcion || "";
  $("ed-hor").value = c.horario || "";
  $("ed-wa").value = (c.whatsapp || "").replace(/^57/, "");
  $("ed-tel").value = c.telefono || "";
  $("ed-recoge").checked = !!c.recoge; $("ed-dom").checked = !!c.domicilio; $("ed-dom-info").value = c.domicilioInfo || "";
  $("ed-muni").innerHTML = municipios.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map(m => `<option value="${m.id}" ${m.id === c.municipioId ? "selected" : ""}>${esc(m.nombre)} (${esc(m.departamento)})</option>`).join("");
  $("ed-dir").value = c.direccion || "";
  $("ed-aviso-aprox").classList.toggle("hidden", !esUbicacionAprox(c));
  pintarCoordsEditor();
  edGaleria = gestorFotos($("ed-galeria"), c.fotos, marcarEditorSucio);   // fase 2AA.4: hasta 5 fotos
  edLogo = gestorFotos($("ed-logo"), c.logo ? [c.logo] : [], marcarEditorSucio, 1, { sinPortada: true, nota: NOTA_LOGO });   // fase V-2c
  $("ed-activo").checked = !!c.activo;
  pintarDuenoEditor();
  pintarSaludEditor();
  tabEditor("datos");
  abrirModal("modal-editor");
}
// ---------- 🧾 Datos sanitarios (fase 2AB.1) ----------
let edDS = null;
async function pintarSaludEditor() {
  const salud = esComercioSalud(edC);
  document.querySelector('#modal-editor [data-ed-tab="salud"]').classList.toggle("hidden", !salud);
  if (!salud) return;
  const id = edC.id;
  $("ed-ds-estado").textContent = "Cargando…"; $("ed-ds-campos").innerHTML = ""; $("ed-ds-quien").textContent = "";
  try { edDS = await cargarDatosSanitarios(id); }
  catch (e) { $("ed-ds-estado").textContent = "Se activa al ejecutar supabase/29_productos_salud.sql"; return; }
  if (!edC || edC.id !== id) return;
  $("ed-ds-estado").textContent = !edDS ? "❌ Sin datos (el dueño no puede cargar productos)" : edDS.revisado_en ? "✔ Revisados el " + new Date(edDS.revisado_en).toLocaleDateString("es-CO") : "⏳ Por revisar";
  $("ed-ds-quien").textContent = edDS ? "Última actualización: " + new Date(edDS.actualizado_en).toLocaleString("es-CO") : "Puedes llenarlos tú si el dueño te los dio por WhatsApp o llamada.";
  $("ed-ds-campos").innerHTML = htmlDatosSanitarios("ed-ds", edDS || { tipo_establecimiento: edC.tipo === "naturista" ? "naturista" : "" });
  $("ed-ds-nota").value = (edDS && edDS.nota_moderador) || "";
  $("ed-ds-ok").classList.toggle("hidden", !edDS || !!edDS.revisado_en);
  $("ed-ds-quitar").classList.toggle("hidden", !(edDS && edDS.revisado_en));
}
async function accionSaludEditor(acc) {
  try {
    if (acc === "guardar") {
      const r = leerDatosSanitarios("ed-ds");
      if (r.error) { mostrarToast(r.error, "error"); return; }
      await guardarDatosSanitarios(edC.id, { ...r.datos, nota_moderador: $("ed-ds-nota").value.trim() || null });
      mostrarToast("✅ Datos sanitarios guardados");
    } else {
      await revisarDatosSanitarios(edC.id, acc === "ok", $("ed-ds-nota").value);
      mostrarToast(acc === "ok" ? "✅ Marcados como revisados" : "Visto bueno quitado");
    }
    await pintarSaludEditor();
  } catch (err) { console.error(err); mostrarToast(mensajeError(err), "error"); }
}
function pintarDuenoEditor() {
  $("ed-dueno-estado").textContent = edC.ownerId ? "asignado" : "sin asignar";
  $("ed-dueno-quitar").classList.toggle("hidden", !edC.ownerId);
  $("ed-dueno-correo").value = "";
  pintarCupoEditor();
}

// ---------- Fase DR-1b · Cupo de vitrina (solo administrador; columnas del SQL 36 y 50) ----------
let usoVitrina = null;   // { publicados, guardados, secciones } del comercio abierto
async function pintarCupoEditor() {
  const caja = $("ed-cupo");
  if (!caja) return;
  const visible = esAdmin() && edC.tieneCupoSecciones;
  caja.classList.toggle("hidden", !visible);
  if (!visible) return;
  $("ed-cupo-prod").value = edC.limiteProductos;
  $("ed-cupo-sec").value = edC.limiteSecciones;
  $("ed-cupo-uso").textContent = "Contando lo que usa hoy…";
  avisoCupoEditor();
  const id = edC.id;
  try {
    const [p, s] = await Promise.all([
      sb.from("productos_comercio").select("id, publicado, oculto, en_revision").eq("comercio_id", id),
      sb.from("secciones_vitrina").select("id").eq("comercio_id", id)
    ]);
    if (!edC || edC.id !== id) return;
    const ps = p.data || [];
    usoVitrina = { publicados: ps.filter(x => x.publicado !== false && !x.oculto && !x.en_revision).length, guardados: ps.length, secciones: (s.data || []).length };
    const pl = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
    $("ed-cupo-uso").textContent = `Hoy usa: ${pl(usoVitrina.publicados, "publicado", "publicados")} · ${pl(usoVitrina.guardados, "guardado", "guardados")} · ${pl(usoVitrina.secciones, "sección", "secciones")}.`;
  } catch (e) { usoVitrina = null; $("ed-cupo-uso").textContent = ""; }
  avisoCupoEditor();
}
function avisoCupoEditor() {
  const a = $("ed-cupo-aviso"); if (!a) return;
  const prod = Number($("ed-cupo-prod").value), sec = Number($("ed-cupo-sec").value);
  const avisos = [];
  if (usoVitrina && prod < usoVitrina.publicados) avisos.push(`Tiene ${usoVitrina.publicados} productos publicados: siguen publicados, pero no podrá publicar más hasta bajar de ${prod}.`);
  if (usoVitrina && sec < usoVitrina.secciones) avisos.push(`Tiene ${usoVitrina.secciones} secciones: las conserva, pero no podrá crear más.`);
  a.textContent = avisos.join(" ");
  a.classList.toggle("hidden", !avisos.length);
  document.querySelectorAll("#ed-cupo-atajos [data-cupo]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cupo === `${prod},${sec}`)));
}
function cerrarEditor() {
  if (edSucio && !confirm("Tienes cambios sin guardar en este comercio. ¿Cerrar sin guardar?")) return;
  edSucio = false;
  cerrarModal("modal-editor");
}
async function guardarEditor() {
  if (!edC) return;
  const nombre = $("ed-nombre").value.trim();
  if (nombre.length < 2) { tabEditor("datos"); mostrarToast("El nombre es obligatorio", "error"); $("ed-nombre").focus(); return; }
  const wa = $("ed-wa").value.replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "");
  if (wa && wa.length !== 10) { tabEditor("contacto"); mostrarToast("El WhatsApp debe tener 10 dígitos (ej. 300 123 4567)", "error"); $("ed-wa").focus(); return; }
  const nul = v => (v || "").trim() || null;
  const tipo = $("ed-tipo").value;
  const cambios = {
    nombre, tipo,
    tipos_extra: [...new Set([$("ed-extra1").value, $("ed-extra2").value].filter(v => v && v !== tipo))],
    descripcion: nul($("ed-desc").value), horario: nul($("ed-hor").value),
    whatsapp: wa ? "57" + wa : null, telefono: nul($("ed-tel").value),
    recoge: $("ed-recoge").checked, domicilio: $("ed-dom").checked,
    domicilio_info: $("ed-dom").checked ? nul($("ed-dom-info").value) : null,
    municipio_id: Number($("ed-muni").value) || edC.municipioId,
    direccion: nul($("ed-dir").value), activo: $("ed-activo").checked
  };
  const modo = $("ed-modo").value;
  if (modo !== "local" || edC.modoAtencion !== "local") cambios.modo_atencion = modo;
  if (edCoords) { cambios.lat = +edCoords.lat.toFixed(6); cambios.lng = +edCoords.lng.toFixed(6); }
  // Fase DR-1b: cupo de vitrina (solo el administrador; solo si cambió)
  if (esAdmin() && edC.tieneCupoSecciones && $("ed-cupo-prod")) {
    const prod = parseInt($("ed-cupo-prod").value, 10), sec = parseInt($("ed-cupo-sec").value, 10);
    if (!(prod >= 0 && prod <= 500) || !(sec >= 0 && sec <= 50)) { tabEditor("dueno"); mostrarToast("El cupo va de 0 a 500 productos y de 0 a 50 secciones", "error"); return; }
    if (prod !== edC.limiteProductos) cambios.limite_productos = prod;
    if (sec !== edC.limiteSecciones) cambios.limite_secciones = sec;
  }
  const b = $("ed-guardar"); b.disabled = true; b.textContent = "Guardando…";
  try {
    if (edGaleria && edGaleria.cambiado) {
      const urls = await edGaleria.subir();
      if (edC.tieneColumnaFotos) cambios.fotos = urls;   // el servidor pone la portada (la primera)
      else cambios.foto_url = urls[0] || null;           // sin el SQL 27: solo la portada
    }
    if (edLogo && edLogo.cambiado) {   // fase V-2c (SQL 49)
      if (!edC.tieneColumnaLogo) throw new Error("Para guardar el logo falta ejecutar supabase/49_logo_comercio.sql");
      cambios.logo_url = (await edLogo.subir())[0] || null;
    }
    await guardarComercioDB(edC.id, cambios);
    edSucio = false;
    cerrarModal("modal-editor");
    mostrarToast("✅ Comercio guardado");
    await refrescarLista(edC.id);
  } catch (err) { console.error(err); mostrarToast(mensajeError(err), "error"); }
  finally { b.disabled = false; b.textContent = "💾 Guardar todo"; }
}
async function duenoEditor(quitar) {
  const correo = $("ed-dueno-correo").value.trim();
  if (!quitar && !correo) { mostrarToast("Escribe el correo de la cuenta del dueño", "error"); return; }
  if (quitar && !confirm("¿Quitar el dueño de este comercio?")) return;
  try {
    await asignarDuenoComercio(edC.id, quitar ? {} : { email: correo });
    mostrarToast(quitar ? "Dueño quitado" : "✅ Dueño asignado");
    await refrescarLista(edC.id);
    edC = listaAdmin.find(x => x.id === edC.id) || edC;
    pintarDuenoEditor();
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
}
function conectarEditor() {
  $("modal-editor").addEventListener("click", e => {
    const t = e.target.closest("[data-ed-tab]");
    if (t) { tabEditor(t.dataset.edTab); return; }
    if (e.target.closest("[data-ed-cerrar]")) cerrarEditor();
  });
  $("form-editor").addEventListener("input", marcarEditorSucio);
  $("form-editor").addEventListener("change", e => {
    marcarEditorSucio();
    if (e.target.id === "ed-modo") $("ed-aviso-aprox").classList.toggle("hidden", e.target.value === "local");
  });
  $("form-editor").addEventListener("submit", e => { e.preventDefault(); guardarEditor(); });
  $("ed-guardar").addEventListener("click", guardarEditor);
  $("ed-mover-pin").addEventListener("click", () => {
    ubParaEditor = true;
    abrirUbicacion(edC.id);
    $("ub-direccion").value = $("ed-dir").value;
    if (edCoords) { marcadorUb.setLatLng([edCoords.lat, edCoords.lng]); mapaUb.setView([edCoords.lat, edCoords.lng], 18); fijarCoordsUb(edCoords.lat, edCoords.lng, false); }
    $("ub-guardar").textContent = "✅ Usar este punto";
  });
  document.addEventListener("modal:cerrado", e => {
    if (e.detail && e.detail.id === "modal-ubicacion") { ubParaEditor = false; $("ub-guardar").textContent = "💾 Guardar ubicación"; }
  });
  $("ed-ds-guardar").addEventListener("click", () => accionSaludEditor("guardar"));
  $("ed-ds-ok").addEventListener("click", () => accionSaludEditor("ok"));
  $("ed-ds-quitar").addEventListener("click", () => accionSaludEditor("quitar"));
  // lo de esta pestaña se guarda aparte: no cuenta como «cambios sin guardar» del comercio
  ["input", "change"].forEach(ev => document.querySelector('#modal-editor [data-ed-panel="salud"]').addEventListener(ev, e => e.stopPropagation()));
  $("ed-dueno-asignar").addEventListener("click", () => duenoEditor(false));
  $("ed-cupo-atajos").addEventListener("click", e => {
    const b = e.target.closest("[data-cupo]"); if (!b) return;
    const [p, s] = b.dataset.cupo.split(",");
    $("ed-cupo-prod").value = p; $("ed-cupo-sec").value = s; marcarEditorSucio(); avisoCupoEditor();
  });
  ["ed-cupo-prod", "ed-cupo-sec"].forEach(id => $(id).addEventListener("input", avisoCupoEditor));
  $("ed-dueno-quitar").addEventListener("click", () => duenoEditor(true));
  // Escape: si el editor está arriba y tiene cambios, pregunta antes de cerrar
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const abiertos = document.querySelectorAll(".modal-fondo:not(.hidden)");
    if (abiertos.length && abiertos[abiertos.length - 1].id === "modal-editor") { e.stopImmediatePropagation(); cerrarEditor(); }
  }, true);
}

async function accionEditor(e) {
  const vf = e.target.closest("[data-ver-fotos]");
  if (vf) { const c = listaAdmin.find(x => x.id === Number(vf.dataset.verFotos)); if (c) abrirVisorFotos(c.fotos, 0, c.nombre); return; }
  const b = e.target.closest("[data-acc]");
  const fila = e.target.closest("[data-id]");
  if (!b || !fila) return;
  const id = Number(fila.dataset.id);
  if (b.dataset.acc === "editor") { abrirEditor(id); return; }
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
      const c0 = listaAdmin.find(x => x.id === id) || {};
      const texto = k => { const v = val(k).value.trim(); return v || null; };
      const nombre = texto("nombre");
      if (!nombre || nombre.length < 2) throw new Error("El nombre es obligatorio");
      const tipo = val("tipo").value;
      const wa = (val("whatsapp").value || "").replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "");
      if (wa && wa.length !== 10) { mostrarToast("El WhatsApp debe tener 10 dígitos (ej. 300 123 4567)", "error"); b.disabled = false; return; }
      const cambios = {
        nombre, direccion: texto("direccion"), telefono: texto("telefono"), horario: texto("horario"),
        whatsapp: wa ? "57" + wa : null,
        activo: val("activo").checked, tipo,
        ...(val("modo_atencion") && (val("modo_atencion").value !== "local" || c0.modoAtencion !== "local") ? { modo_atencion: val("modo_atencion").value } : {}),
        tipos_extra: [...new Set([...fila.querySelectorAll("[data-extra]")].map(s => s.value).filter(v => v && v !== tipo))]
      };
      const archivo = fotoElegida("ed", fila);
      if (archivo) cambios.foto_url = await subirFotoComercio(await comprimir(archivo));
      await guardarComercioDB(id, cambios);
      mostrarToast("✅ Guardado");
    }
    await refrescarLista(id);   // esta ficha queda con lo guardado; las demás conservan lo que estabas escribiendo
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
    <div class="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_2fr_4.5rem_auto] gap-2 items-end">
      <div class="text-[11px] font-bold text-slate-500">Ícono<div class="mt-0.5 flex items-center"><input data-c="icono" data-emoji maxlength="8" aria-label="Ícono" value="${esc(t.icono)}" class="w-12 border border-slate-300 p-1.5 rounded-lg text-center text-lg">${BOTON_EMOJI}</div></div>
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

  const opciones = municipios.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join("");
  $("ac-muni").innerHTML = `<option value="todos">Todos (${municipios.length})</option>` + opciones;
  await cargarCategoriasComercio();
  conectarImportador();
  $("ac-filtro-muni").innerHTML = '<option value="">Todos los municipios</option>' + opciones;

  $("ac-buscar").addEventListener("click", () => buscar(false));
  $("ac-reintentar").addEventListener("click", () => buscar(true));
  $("ac-cancelar").addEventListener("click", cancelarBusqueda);
  $("ac-importar").addEventListener("click", guardarSeleccion);
  $("ac-previa-lista").addEventListener("change", e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    candidatos[Number(i)].marcado = e.target.checked;
    actualizarResumen(); pintarPinesImp();
  });
  $("ac-lista").addEventListener("click", accionEditor);
  $("ub-buscar").addEventListener("click", buscarDireccionUb);
  $("ub-direccion").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); buscarDireccionUb(); } });
  $("ub-gps").addEventListener("click", gpsUb);
  $("ub-guardar").addEventListener("click", guardarUbicacion);
  conectarEditor();
  document.querySelectorAll('input[name="vi-metodo"]').forEach(r => r.addEventListener("change", pintarListaVi));
  $("vi-gps").addEventListener("click", gpsVisita);
  $("vi-aprobar").addEventListener("click", () => enviarVerificacion("aprobada"));
  $("vi-rechazar").addEventListener("click", () => enviarVerificacion("rechazada"));
  ["ac-filtro-muni", "ac-filtro-ver"].forEach(id => $(id).addEventListener("change", () => { soloId = null; limiteLista = 40; pintarLista(); }));
  $("ac-buscar-nombre").addEventListener("input", () => { soloId = null; limiteLista = 40; pintarLista(); });
  $("ac-origenes").addEventListener("click", e => { const b = e.target.closest("[data-origen]"); if (b) { origenAct = b.dataset.origen; soloId = null; limiteLista = 40; pintarLista(); } });
  $("ac-lista").addEventListener("click", e => { if (e.target.closest("#ac-mas")) { limiteLista += 40; pintarLista(); } });
  // Fase 2AA.3: categoría y vista
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-cat-filtro]");
    if (c && (c.closest("#ac-cats") || c.closest("#ac-lista"))) {
      catAct = c.dataset.catFiltro; soloId = null; limiteLista = 40;
      if (c.closest("#ac-lista")) { vistaAct = "lista"; try { localStorage.setItem("mf_ac_vista", vistaAct); } catch (er) { /* nada */ } }
      pintarLista(); return;
    }
    const v = e.target.closest(".ac-vista-btn");
    if (v) { vistaAct = v.dataset.vista; try { localStorage.setItem("mf_ac_vista", vistaAct); } catch (er) { /* nada */ } soloId = null; pintarLista(); }
  });
  $("ac-pend-grid").addEventListener("click", e => {
    const b = e.target.closest("[data-ir], [data-ir-estado]");
    if (!b) return;
    soloId = null; limiteLista = 40; catAct = ""; $("ac-buscar-nombre").value = ""; $("ac-filtro-muni").value = "";
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
