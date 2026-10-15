// ===== MercaFree · código compartido de anuncios =====
// Lo usan el inicio (index.html → app.js) y «Todos los anuncios» (anuncios.html → anuncios.js).
// Ambas páginas tienen los MISMOS id en los filtros (buscador, filtro-departamento, filtro-ciudad,
// ordenar-por, panel de «Más filtros»…), así que estas funciones sirven para las dos.
// Va después de utils.js y data.js, y antes de app.js / anuncios.js.

let ubicacionUsuario = null;              // {lat,lng}; solo si el usuario la autorizó
let categoriaActiva = "todos";
let subcategoriaActiva = "";               // "" = todas las de la categoría

function chipsCategoriasHTML() {
  return CATEGORIAS.map(c =>
    `<button type="button" data-cat="${esc(c.id)}" class="categoria-btn px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap">${c.icono} ${esc(c.nombre)}</button>`
  ).join("");
}

// Subcategorías: chips bajo las categorías (solo si la categoría elegida tiene) y lista del formulario
function pintarSubcategorias() {
  const cont = $("chips-subcategorias");
  const subs = SUBCATEGORIAS[categoriaActiva] || [];
  cont.classList.toggle("hidden", !subs.length);
  if (!subs.length) { cont.innerHTML = ""; return; }
  const chip = (id, texto, activa) => `<button type="button" data-subcat="${esc(id)}" aria-pressed="${activa}" class="subcat-btn px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${activa ? "bg-yellow-300 text-indigo-900" : "bg-white/15 text-white hover:bg-white/25"}">${esc(texto)}</button>`;
  cont.innerHTML = chip("", "Todas", subcategoriaActiva === "") + subs.map(([id, n]) => chip(id, n, subcategoriaActiva === id)).join("");
}

function marcarCategoriaActiva() {
  pintarSubcategorias();
  document.querySelectorAll(".categoria-btn").forEach(btn => {
    const activa = btn.dataset.cat === categoriaActiva;
    btn.classList.toggle("bg-white", activa);
    btn.classList.toggle("text-indigo-700", activa);
    btn.classList.toggle("shadow-sm", activa);
    btn.classList.toggle("bg-white/15", !activa);
    btn.classList.toggle("hover:bg-white/25", !activa);
    btn.setAttribute("aria-pressed", activa ? "true" : "false");
  });
}

// ---------- Filtros dinámicos ----------
// POR QUÉ: antes el filtro mostraba TODOS los municipios, aunque no tuvieran anuncios, y
// el usuario elegía "Barbosa" para ver una lista vacía. Ahora solo aparecen los
// departamentos y ciudades que SÍ tienen anuncios, con su cantidad: "Envigado (3)".
function ubicacionesConAnuncios() {
  const mapa = {};                                   // { depto: { ciudad: cantidad } }
  baseDatosAnuncios.forEach(a => {
    if (!a.departamento || !a.ciudad) return;
    const d = (mapa[a.departamento] = mapa[a.departamento] || {});
    d[a.ciudad] = (d[a.ciudad] || 0) + 1;
  });
  return mapa;
}

// Reconstruye las opciones de departamento (se llama al cargar y cuando cambian los anuncios).
function refrescarOpcionesUbicacion() {
  const ub = ubicacionesConAnuncios();
  const selD = $("filtro-departamento");
  const actual = selD.value;
  selD.innerHTML = '<option value="">Todos</option>';
  Object.keys(ub).sort().forEach(d => {
    const total = Object.values(ub[d]).reduce((x, y) => x + y, 0);
    const o = new Option(`${d} (${total})`, d);
    selD.add(o);
  });
  selD.value = ub[actual] ? actual : "";            // si ese departamento ya no tiene anuncios, se limpia
  const ciudadActual = $("filtro-ciudad").value;
  llenarCiudadesFiltro();
  if ([...$("filtro-ciudad").options].some(o => o.value === ciudadActual)) $("filtro-ciudad").value = ciudadActual;
}

function llenarCiudadesFiltro() {
  const ub = ubicacionesConAnuncios();
  const depto = $("filtro-departamento").value;
  const sel = $("filtro-ciudad");
  sel.innerHTML = '<option value="">Todas las ciudades</option>';
  const ciudades = {};
  (depto ? [depto] : Object.keys(ub)).forEach(d => {
    Object.entries(ub[d] || {}).forEach(([c, n]) => { ciudades[c] = (ciudades[c] || 0) + n; });
  });
  Object.keys(ciudades).sort((x, y) => x.localeCompare(y, "es")).forEach(c => sel.add(new Option(`${c} (${ciudades[c]})`, c)));
}

// Lee de la pantalla todos los filtros de anuncios
function leerCriterios() {
  const pMin = parseInt($("filtro-precio-min").value, 10) || 0;
  const pMax = parseInt($("filtro-precio-max").value, 10) || Infinity;
  return {
    texto: normalizar($("buscador").value.trim()),
    categoria: categoriaActiva, subcategoria: subcategoriaActiva,
    pMin, pMax, hayFiltroPrecio: pMin > 0 || pMax !== Infinity,
    soloFoto: $("filtro-con-foto").checked,
    soloPrecio: $("filtro-con-precio").checked,
    estado: $("filtro-estado").value,
    departamento: $("filtro-departamento").value,
    ciudad: $("filtro-ciudad").value,
    radio: parseFloat($("filtro-radio").value) || 0,
    orden: $("ordenar-por").value
  };
}

// Filtra y ordena los anuncios cargados según los criterios (limites = zona del mapa, opcional)
function filtrarAnuncios(c, limites) {
  const lista = baseDatosAnuncios.filter(a => {
    if (c.categoria !== "todos" && a.categoria !== c.categoria) return false;
    if (c.subcategoria && a.subcategoria !== c.subcategoria) return false;
    if (c.texto) {
      const pajar = normalizar([a.nombre, a.desc, a.barrio, a.ciudad].join(" "));
      if (!pajar.includes(c.texto)) return false;
    }
    const precioNum = extraerPrecio(a.precio);
    if (c.hayFiltroPrecio && !(precioNum !== null && precioNum >= c.pMin && precioNum <= c.pMax)) return false;
    if (c.soloFoto && !a.imagen) return false;
    if (c.soloPrecio && !precioNum) return false;
    if (c.estado && a.estado !== c.estado) return false;
    if (c.departamento && a.departamento !== c.departamento) return false;
    if (c.ciudad && a.ciudad !== c.ciudad) return false;
    if (c.radio && ubicacionUsuario && !(tieneCoords(a) && distanciaKm(ubicacionUsuario, a) <= c.radio)) return false;
    if (limites && !(tieneCoords(a) && limites.contains([a.lat, a.lng]))) return false;
    return true;
  });
  const dist = a => (ubicacionUsuario && tieneCoords(a)) ? distanciaKm(ubicacionUsuario, a) : Infinity;
  if (c.orden === "recientes") lista.sort((a, b) => b.fecha - a.fecha);
  else if (c.orden === "cercanos") lista.sort((a, b) => dist(a) - dist(b));
  else if (c.orden === "precio-asc") lista.sort((a, b) => (extraerPrecio(a.precio) ?? Infinity) - (extraerPrecio(b.precio) ?? Infinity));
  else if (c.orden === "precio-desc") lista.sort((a, b) => (extraerPrecio(b.precio) ?? 0) - (extraerPrecio(a.precio) ?? 0));
  else if (c.orden === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return lista;
}

// ---------- Filtros en el enlace (para compartir una búsqueda: anuncios.html?ciudad=Envigado&cat=vehiculos) ----------
// No se guarda la ubicación GPS ni «más cercanos»: quien abra el enlace está en otro lugar.
function criteriosAQuery() {
  const c = leerCriterios();
  const p = new URLSearchParams();
  const q = $("buscador").value.trim();
  if (q) p.set("q", q);
  if (c.categoria !== "todos") p.set("cat", c.categoria);
  if (c.subcategoria) p.set("sub", c.subcategoria);
  if (c.departamento) p.set("depto", c.departamento);
  if (c.ciudad) p.set("ciudad", c.ciudad);
  if (c.orden && c.orden !== "recientes" && c.orden !== "cercanos") p.set("orden", c.orden);
  if (c.estado) p.set("estado", c.estado);
  if (c.pMin) p.set("pmin", c.pMin);
  if (c.pMax !== Infinity) p.set("pmax", c.pMax);
  if (c.soloFoto) p.set("foto", "1");
  if (c.soloPrecio) p.set("precio", "1");
  return p.toString();
}

// Pone en pantalla los filtros que vienen en el enlace. Llamar DESPUÉS de cargar los anuncios
// (las listas de departamento y ciudad se arman con lo que hay publicado).
function aplicarQueryAUI(qs) {
  const p = new URLSearchParams(qs);
  if (p.get("q")) $("buscador").value = p.get("q").slice(0, 80);
  const cat = p.get("cat");
  if (cat && CATEGORIAS.some(x => x.id === cat)) {
    categoriaActiva = cat;
    const sub = p.get("sub");
    subcategoriaActiva = sub && (SUBCATEGORIAS[cat] || []).some(s => s[0] === sub) ? sub : "";
  }
  const elegir = (id, v) => { if (v && [...$(id).options].some(o => o.value === v)) $(id).value = v; };
  elegir("filtro-departamento", p.get("depto"));
  llenarCiudadesFiltro();
  elegir("filtro-ciudad", p.get("ciudad"));
  elegir("ordenar-por", p.get("orden"));
  elegir("filtro-estado", p.get("estado"));
  const num = v => { const n = parseInt(v, 10); return n > 0 ? String(n) : ""; };
  $("filtro-precio-min").value = num(p.get("pmin"));
  $("filtro-precio-max").value = num(p.get("pmax"));
  $("filtro-con-foto").checked = p.get("foto") === "1";
  $("filtro-con-precio").checked = p.get("precio") === "1";
  marcarCategoriaActiva();
  // Si llegó con filtros de «Más filtros», el panel se abre para que se vean
  const hayAvanzados = ["estado", "pmin", "pmax", "foto", "precio"].some(k => p.get(k));
  if (hayAvanzados && $("panel-filtros").classList.contains("hidden")) $("btn-filtros").click();
}

// ---------- Tarjeta de anuncio (igual en el inicio y en «Todos los anuncios») ----------
function tarjetaHTML(a) {
  const icono = iconosCategoria[a.categoria] || "📦";
  const foto = urlSegura(a.imagen);
  const km = (ubicacionUsuario && tieneCoords(a)) ? distanciaKm(ubicacionUsuario, a) : null;
  const badgeEstado = a.estado === "nuevo"
    ? '<span class="badge-nuevo text-xs font-semibold px-2 py-0.5 rounded-full">Nuevo</span>'
    : a.estado === "usado"
      ? '<span class="badge-usado text-xs font-semibold px-2 py-0.5 rounded-full">Usado</span>'
      : "";
  // Siempre dibujamos el icono de la categoría de fondo; la <img> va ENCIMA.
  // Si la foto falla al cargar, se quita la <img> y queda el icono (sin código extra por tarjeta).
  const guardado = favoritosIds.has(a.id);
  return `<article id="tarjeta-${a.id}" data-id="${a.id}" class="tarjeta-anuncio relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
    <button type="button" data-accion="favorito" aria-pressed="${guardado}" aria-label="${guardado ? "Quitar de favoritos" : "Guardar en favoritos"}" class="btn-fav absolute top-2 left-2 z-10 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-lg">${guardado ? "❤️" : "🤍"}</button>
    <a href="anuncio.html?id=${a.id}" class="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center" aria-label="Ver ${esc(a.nombre)}">
      <span class="text-5xl">${icono}</span>
      ${foto ? `<img src="${esc(foto)}" alt="${esc(a.nombre)}" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover">` : ""}
      ${a.precio ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow">${esc(a.precio)}</div>` : ""}
      <span class="cinta-ver absolute bottom-0 inset-x-0 text-center text-xs font-bold text-white py-1.5">👆 Toca para ver el anuncio completo</span>
    </a>
    <div class="p-4 flex flex-col flex-1">
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${esc(a.ciudad || a.barrio || "")}</span>
        ${nombreSubcategoria(a.categoria, a.subcategoria) ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">${esc(nombreSubcategoria(a.categoria, a.subcategoria))}</span>` : ""}
        ${badgeEstado}
        ${km !== null ? `<span class="text-xs text-slate-400">${km < 1 ? "a " + Math.round(km * 1000) + " m" : "a " + km.toFixed(1) + " km"}</span>` : ""}
      </div>
      <h3 class="font-bold text-slate-900 mb-1 line-clamp-2"><a href="anuncio.html?id=${a.id}" class="hover:text-indigo-600">${esc(a.nombre)}</a></h3>
      <p class="text-sm text-slate-600 line-clamp-2 mb-3 flex-1">${esc(a.desc || "")}</p>
      <a href="anuncio.html?id=${a.id}" class="btn-ver-anuncio block text-center text-sm font-bold py-2.5 rounded-xl mb-2">Ver anuncio completo →</a>
      <div class="flex gap-2">
        <a href="${esc(urlWhatsApp(a.whatsapp, a.nombre))}" target="_blank" rel="noopener" class="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl text-center">WhatsApp</a>
        ${tieneCoords(a) ? `<button type="button" data-accion="ver-mapa" class="px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold py-2.5 rounded-xl" title="Ver en el mapa">📍 Mapa</button>` : ""}
      </div>
      ${EDITOR ? `<div class="flex gap-2 mt-2">
        <button type="button" data-accion="editar" class="flex-1 text-xs bg-indigo-100 text-indigo-700 font-semibold py-2 rounded-lg">✏️ Editar</button>
        <button type="button" data-accion="eliminar-admin" class="flex-1 text-xs bg-red-100 text-red-600 font-semibold py-2 rounded-lg">🗑️ Eliminar</button>
      </div>` : ""}
    </div>
  </article>`;
}

