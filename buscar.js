// ===== MercaFree · Página de resultados «Buscar en todo» (Fase 2W / 2W.2) =====
// buscar.html?q=postres[&depto=Antioquia][&ciudad=Envigado][&cat=a:tecnologia | c:pasteleria]
// Junta en una sola página: categorías, publicaciones (anuncios), comercios y productos de vitrina.
// La relevancia la calcula buscador.js (sin tildes, plurales, errores de escritura e intenciones).
// 2W.2: aquí mismo se puede borrar la búsqueda (✕), quitar la categoría y «🔄 Ver todo» sin volver al inicio;
// la ubicación (departamento, ciudad, «Cerca de mí») se conserva.

const POR_SECCION = { anuncios: 8, comercios: 6, productos: 8 };
let fuentesBusq = { anuncios: [], comercios: [], productos: [] };
let resultadoBusq = null;
const visibles = { ...POR_SECCION };

const paramsIniciales = new URLSearchParams(location.search);
let qBusq = (paramsIniciales.get("q") || "").trim().slice(0, 80);
let catSel = null;                 // { tipo: "a" (anuncios) | "c" (comercios), id }
let ubicBusq = null;               // {lat,lng} si se tocó «Cerca de mí»
(() => { const m = /^([ac]):([a-z0-9_]{1,30})$/.exec(paramsIniciales.get("cat") || ""); if (m) catSel = { tipo: m[1], id: m[2] }; })();

const qActual = () => qBusq;
const ciudadActual = () => $("b-ciudad").value;
const deptoActual = () => $("b-depto").value;

// ---------- Tarjetas compactas ----------
function tarjetaAnuncioBusq(a) {
  const foto = urlSegura(a.imagen);
  return `<a href="anuncio.html?id=${a.id}" class="b-tarjeta bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition overflow-hidden flex flex-col">
    <div class="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <span class="text-4xl">${iconosCategoria[a.categoria] || "📦"}</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      ${a.precio ? `<span class="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">${esc(a.precio)}</span>` : ""}
    </div>
    <div class="p-2.5">
      <h3 class="font-bold text-sm text-slate-900 line-clamp-2">${esc(a.nombre)}</h3>
      <p class="text-[11px] text-slate-500 mt-0.5">${esc(a.ciudad || a.barrio || "")}</p>
    </div>
  </a>`;
}

function tarjetaComercioBusq(c) {
  const sello = SELLOS[c.nivel] || SELLOS[1];
  const foto = urlSegura(c.foto);
  const abierto = estaAbierto(c.horario);
  return `<a href="tienda.html?id=${c.id}" class="b-tarjeta bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-3 flex gap-3 items-start">
    <div class="relative w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
      <span class="text-3xl">${esc(iconosComercio[c.tipo] || "🏪")}</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
    </div>
    <div class="min-w-0">
      <h3 class="font-bold text-slate-900 leading-tight">${esc(c.nombre)}</h3>
      <p class="text-xs text-slate-500">${esc(nombreCategorias(c))} · ${esc(c.ciudad)}</p>
      <p class="text-xs mt-0.5">${resumenCalifHTML(c)}</p>
      <div class="flex flex-wrap gap-1 mt-1">
        <span class="${sello.clase} text-[10px] font-semibold px-1.5 py-0.5 rounded-full">${c.nivel >= 2 ? "✔ " : ""}${esc(sello.corto)}</span>
        ${abierto === true ? '<span class="bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">🟢 Abierto</span>' : ""}
        ${c.nivel >= 2 && c.nProductos > 0 ? `<span class="bg-teal-50 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">🛍️ Vitrina (${c.nProductos})</span>` : ""}
      </div>
    </div>
  </a>`;
}

function tarjetaProductoBusq(p) {
  const c = fuentesBusq.comercios.find(x => x.id === p.comercioId);
  const foto = urlSegura(p.foto);
  return `<a href="tienda.html?id=${p.comercioId}&p=${p.id}#productos" class="b-tarjeta bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition overflow-hidden flex flex-col">
    <div class="relative aspect-square bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
      <span class="text-4xl">🛍️</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
    </div>
    <div class="p-2.5">
      <h3 class="font-bold text-sm text-slate-900 line-clamp-2">${esc(p.nombre)}</h3>
      ${p.precio ? `<p class="text-sm font-black text-teal-700">${esc(formatearPrecio(p.precio))}</p>` : ""}
      ${c ? `<p class="text-[11px] text-slate-500 mt-0.5">🏪 ${esc(c.nombre)} · ${esc(c.ciudad)}</p>` : ""}
    </div>
  </a>`;
}

// ---------- Pintar ----------
function pintarSeccion(clave, lista, tarjeta, verTodo) {
  const sec = $("b-" + clave);
  sec.classList.toggle("hidden", !lista.length);
  if (!lista.length) return;
  sec.querySelector(".b-n").textContent = "(" + lista.length + ")";
  sec.querySelector(".b-lista").innerHTML = lista.slice(0, visibles[clave]).map(tarjeta).join("");
  const mas = sec.querySelector(".b-mas");
  const faltan = lista.length - visibles[clave];
  mas.classList.toggle("hidden", faltan <= 0);
  mas.textContent = `Ver ${Math.min(faltan, 24)} más`;
  const vt = sec.querySelector(".b-ver-todo");
  if (vt && verTodo) vt.href = verTodo;
}

const nombreCatSel = () => {
  if (!catSel) return "";
  const l = catSel.tipo === "a" ? CATEGORIAS : TIPOS_COMERCIO;
  const c = l.find(x => x.id === catSel.id);
  return c ? `${c.icono} ${c.nombre}` : catSel.id;
};

// Sin búsqueda: todo, lo más nuevo y lo más confiable primero
function todoSinBuscar(f) {
  return {
    catsComercio: [], catsAnuncio: [],
    anuncios: f.anuncios.slice().sort((a, b) => b.fecha - a.fecha),
    comercios: f.comercios.slice().sort((a, b) => (b.nivel - a.nivel) || ((b.calif || 0) - (a.calif || 0)) || a.nombre.localeCompare(b.nombre, "es")),
    productos: f.productos.slice()
  };
}

function pintarResultados() {
  const q = qActual();
  $("buscador").value = q;
  $("b-limpiar").classList.toggle("hidden", !$("buscador").value);
  document.title = (q ? q + " · " : "") + "Buscar | MercaFree";

  const ciudad = ciudadActual(), depto = deptoActual();
  const enZona = x => (!depto || x.departamento === depto) && (!ciudad || x.ciudad === ciudad);
  const comerciosZona = fuentesBusq.comercios.filter(enZona);
  const idsCom = new Set(comerciosZona.map(c => c.id));
  const base = { anuncios: fuentesBusq.anuncios.filter(enZona), comercios: comerciosZona, productos: fuentesBusq.productos.filter(p => idsCom.has(p.comercioId)) };
  const r = q ? buscarTodo(q, base) : todoSinBuscar(base);

  // Categoría elegida aquí mismo: filtra la sección que corresponde y oculta las otras
  if (catSel && catSel.tipo === "a") { r.anuncios = r.anuncios.filter(a => a.categoria === catSel.id); r.comercios = []; r.productos = []; }
  if (catSel && catSel.tipo === "c") {
    r.anuncios = [];
    r.comercios = r.comercios.filter(c => comercioEsTipo(c, catSel.id));
    if (!q && !r.comercios.length) r.comercios = base.comercios.filter(c => comercioEsTipo(c, catSel.id));
    const ids = new Set(r.comercios.map(c => c.id));
    r.productos = r.productos.filter(p => ids.has(p.comercioId));
  }
  // «Cerca de mí»: lo más cercano primero en cada sección
  if (ubicBusq) {
    const km = x => tieneCoords(x) ? distanciaKm(ubicBusq, x) : Infinity;
    const porId = {}; fuentesBusq.comercios.forEach(c => { porId[c.id] = c; });
    r.anuncios.sort((a, b) => km(a) - km(b));
    r.comercios.sort((a, b) => km(a) - km(b));
    r.productos.sort((a, b) => km(porId[a.comercioId] || {}) - km(porId[b.comercioId] || {}));
  }
  r.total = r.anuncios.length + r.comercios.length + r.productos.length;
  resultadoBusq = r;

  // Chips de categorías: con búsqueda = las que sugiere; sin búsqueda = las que tienen algo publicado.
  // Tocar una filtra AQUÍ (se pone amarilla con ✕); tocarla otra vez la quita.
  let catsA = r.catsAnuncio, catsC = r.catsComercio;
  if (!q) {
    const cuentaA = {}; base.anuncios.forEach(a => { cuentaA[a.categoria] = (cuentaA[a.categoria] || 0) + 1; });
    const cuentaC = {}; base.comercios.forEach(c => { [c.tipo].concat(c.tiposExtra || []).forEach(id => { cuentaC[id] = (cuentaC[id] || 0) + 1; }); });
    catsA = CATEGORIAS.filter(c => cuentaA[c.id]).sort((a, b) => cuentaA[b.id] - cuentaA[a.id]).slice(0, 6);
    catsC = TIPOS_COMERCIO.filter(t => cuentaC[t.id]).sort((a, b) => cuentaC[b.id] - cuentaC[a.id]).slice(0, 6);
  }
  const on = (tipo, id) => catSel && catSel.tipo === tipo && catSel.id === id;
  // La categoría elegida siempre se ve (aunque la búsqueda nueva no la sugiera), para poder quitarla
  if (catSel && catSel.tipo === "a" && !catsA.some(c => c.id === catSel.id)) { const c = CATEGORIAS.find(x => x.id === catSel.id); if (c) catsA = [c].concat(catsA); }
  if (catSel && catSel.tipo === "c" && !catsC.some(c => c.id === catSel.id)) { const c = TIPOS_COMERCIO.find(x => x.id === catSel.id); if (c) catsC = [c].concat(catsC); }
  const chip = (tipo, c, extra) => `<button type="button" data-bcat="${tipo}:${esc(c.id)}" aria-pressed="${on(tipo, c.id)}" class="b-chip ${tipo === "a" ? "b-chip-anuncio" : ""} ${on(tipo, c.id) ? "b-chip-on" : ""}">${esc(c.icono)} ${esc(c.nombre)}${extra}${on(tipo, c.id) ? ' <span aria-hidden="true">✕</span>' : ""}</button>`;
  const chips = catsC.map(c => chip("c", c, "")).concat(catsA.map(c => chip("a", c, " <small>anuncios</small>")));
  $("b-chips").innerHTML = chips.join("");
  $("b-chips-titulo").textContent = q ? "También te puede servir (toca para filtrar aquí):" : "Filtra por categoría:";
  $("b-intenciones").classList.toggle("hidden", !chips.length);

  // Lo que estás filtrando (con ✕) y «🔄 Ver todo»
  const activos = [];
  if (q) activos.push(["q", "🔍 «" + (q.length > 24 ? q.slice(0, 24) + "…" : q) + "»"]);
  if (catSel) activos.push(["cat", nombreCatSel()]);
  if (ubicBusq) activos.push(["cerca", "📍 Cerca de mí"]);
  $("b-activos").innerHTML = activos.map(([k, t]) => `<button type="button" data-bquitar="${k}" class="chip-activo" aria-label="Quitar ${esc(t)}">${esc(t)} <span aria-hidden="true">✕</span></button>`).join("");
  $("b-activos").classList.toggle("hidden", !activos.length);
  $("b-ver-todo").classList.toggle("hidden", !q && !catSel);

  const qs = encodeURIComponent(q);
  const sufZona = (depto ? "&depto=" + encodeURIComponent(depto) : "") + (ciudad ? "&ciudad=" + encodeURIComponent(ciudad) : "");
  const muni = ciudad ? (comerciosZona[0] || {}).municipioId : null;
  pintarSeccion("anuncios", r.anuncios, tarjetaAnuncioBusq, "anuncios.html?" + (q ? "q=" + qs : "") + (catSel && catSel.tipo === "a" ? "&cat=" + catSel.id : "") + sufZona);
  pintarSeccion("comercios", r.comercios, tarjetaComercioBusq, "comercios.html?" + (q ? "q=" + qs : "") + (catSel && catSel.tipo === "c" ? "&tipo=" + catSel.id : "") + (muni ? "&muni=" + muni : ""));
  pintarSeccion("productos", r.productos, tarjetaProductoBusq);

  const n = r.total;
  const donde = ciudad ? " en " + esc(ciudad) : depto ? " en " + esc(depto) : "";
  const filtro = catSel ? " · " + esc(nombreCatSel()) : "";
  $("b-titulo").innerHTML = q
    ? (n ? `<b>${n}</b> ${n === 1 ? "resultado" : "resultados"} para «<b>${esc(q)}</b>»${donde}${filtro}` : `Sin resultados para «<b>${esc(q)}</b>»${donde}${filtro}`)
    : `Mostrando <b>todo</b>${donde}${filtro}: <b>${n}</b> ${n === 1 ? "resultado" : "resultados"}`;
  const pest = [["anuncios", "📢 Publicaciones", r.anuncios.length], ["comercios", "🏪 Comercios", r.comercios.length], ["productos", "🛍️ Vitrinas", r.productos.length]]
    .filter(x => x[2]).map(([k, t, c]) => `<a href="#b-${k}" class="b-pestana">${t} <b>${c}</b></a>`);
  $("b-pestanas").innerHTML = pest.join("");
  $("b-pestanas").classList.toggle("hidden", pest.length < 2);
  $("b-vacio").classList.toggle("hidden", n > 0);
  $("b-vacio-q").textContent = q || nombreCatSel() || "eso";
}

// ---------- Ubicación ----------
function llenarDeptos() {
  const cuenta = {};
  fuentesBusq.anuncios.concat(fuentesBusq.comercios).forEach(x => { if (x.departamento) cuenta[x.departamento] = (cuenta[x.departamento] || 0) + 1; });
  const sel = $("b-depto");
  Object.keys(cuenta).sort((a, b) => a.localeCompare(b, "es")).forEach(d => sel.add(new Option(`${d} (${cuenta[d]})`, d)));
  const pedido = paramsIniciales.get("depto");
  if (pedido && cuenta[pedido]) sel.value = pedido;
}
function llenarCiudades() {
  const depto = deptoActual();
  const cuenta = {};
  fuentesBusq.anuncios.concat(fuentesBusq.comercios).forEach(x => { if (x.ciudad && (!depto || x.departamento === depto)) cuenta[x.ciudad] = (cuenta[x.ciudad] || 0) + 1; });
  const sel = $("b-ciudad"), antes = sel.value;
  sel.innerHTML = '<option value="">🏘️ Ciudad</option>';
  Object.keys(cuenta).sort((a, b) => a.localeCompare(b, "es")).forEach(c => sel.add(new Option(`${c} (${cuenta[c]})`, c)));
  if (cuenta[antes]) sel.value = antes;
}

function actualizarEnlace() {
  const p = new URLSearchParams();
  if (qActual()) p.set("q", qActual());
  if (catSel) p.set("cat", catSel.tipo + ":" + catSel.id);
  if (deptoActual()) p.set("depto", deptoActual());
  if (ciudadActual()) p.set("ciudad", ciudadActual());
  history.replaceState(null, "", "buscar.html" + (p.toString() ? "?" + p : ""));
}

// Cada cambio: vuelve a mostrar desde arriba, deja el enlace al día y pinta
function refrescar() {
  Object.assign(visibles, POR_SECCION);
  actualizarEnlace();
  pintarResultados();
}

// Buscar aquí mismo (Enter, 🔍 o una sugerencia): la búsqueda nueva quita la categoría anterior
function buscarAqui(q) {
  qBusq = String(q || "").trim().slice(0, 80);
  catSel = null;
  refrescar();
  if (qBusq && resultadoBusq) registrarBusqueda(qBusq, resultadoBusq.total);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// «🔄 Ver todo»: sin búsqueda ni categoría; la ubicación y «Cerca de mí» se quedan
function verTodoBusq() { qBusq = ""; catSel = null; refrescar(); $("buscador").focus(); }

async function cercaBusq() {
  const b = $("b-cerca");
  if (ubicBusq) { ubicBusq = null; b.setAttribute("aria-pressed", "false"); refrescar(); return; }
  b.disabled = true; b.textContent = "📡 Buscando…";
  try {
    ubicBusq = await obtenerGPS();
    b.setAttribute("aria-pressed", "true");
    refrescar();
  } catch (e) { mostrarToast(textoErrorGPS(e), "error"); }
  finally { b.disabled = false; b.textContent = "📡 Cerca de mí"; }
}

document.addEventListener("DOMContentLoaded", async () => {
  conectarBuscadorGlobal(() => fuentesBusq, { alBuscar: buscarAqui });
  $("buscador").value = qActual();
  $("buscador").addEventListener("input", () => {
    $("b-limpiar").classList.toggle("hidden", !$("buscador").value);
    if (!$("buscador").value && qBusq) verTodoBusq();          // borró todo el texto (o la ✕ del teclado): ver todo
  });
  $("b-limpiar").addEventListener("click", verTodoBusq);
  $("b-ver-todo").addEventListener("click", verTodoBusq);
  $("b-cerca").addEventListener("click", cercaBusq);
  $("b-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-bcat]");
    if (!b) return;
    const [tipo, id] = b.dataset.bcat.split(":");
    catSel = (catSel && catSel.tipo === tipo && catSel.id === id) ? null : { tipo, id };
    refrescar();
  });
  $("b-activos").addEventListener("click", e => {
    const b = e.target.closest("[data-bquitar]");
    if (!b) return;
    if (b.dataset.bquitar === "q") { qBusq = ""; refrescar(); }
    else if (b.dataset.bquitar === "cat") { catSel = null; refrescar(); }
    else if (b.dataset.bquitar === "cerca") cercaBusq();
  });
  ["anuncios", "comercios", "productos"].forEach(k => {
    $("b-" + k).querySelector(".b-mas").addEventListener("click", () => { visibles[k] += 24; pintarResultados(); });
  });
  $("b-depto").addEventListener("change", () => { llenarCiudades(); refrescar(); });
  $("b-ciudad").addEventListener("change", refrescar);

  try {
    await cargarMunicipios();
    const [, , productos] = await Promise.all([cargarAnuncios(), cargarComercios(), cargarProductosPublicos()]);
    // Solo productos de comercios visibles con vitrina activa (nivel 2+)
    const vitrinas = new Set(comercios.filter(c => c.nivel >= 2).map(c => c.id));
    fuentesBusq = { anuncios: baseDatosAnuncios, comercios, productos: productos.filter(p => vitrinas.has(p.comercioId)) };
  } catch (e) {
    console.error(e);
    mostrarToast("No pudimos cargar todo. Revisa tu conexión.", "error");
  }
  llenarDeptos();
  llenarCiudades();
  const pedida = paramsIniciales.get("ciudad");
  if (pedida && [...$("b-ciudad").options].some(o => o.value === pedida)) $("b-ciudad").value = pedida;
  pintarResultados();
  if (qActual() && resultadoBusq) registrarBusqueda(qActual(), resultadoBusq.total);
});
