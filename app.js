// ===== Merkap - Lógica principal (index.html) =====
// Requiere (en este orden): leaflet, markercluster, utils.js, data.js

const POR_PAGINA = 12;
const CENTRO_DEFECTO = { lat: 6.1759, lng: -75.5917 };
const MAX_FOTOS = 3;
const NOMBRES_PASOS = ["Qué vendes", "Dónde está", "Contacto"];

// Estado de la pantalla. Todo en un sitio = más fácil de entender y depurar.
let mapa = null;
let capaMarcadores = null;                // grupo con clusters
const marcadoresPorId = new Map();        // id de anuncio → marcador (para sincronizar lista y mapa)
let capaComercios = null;                 // pines de comercios (farmacias, cajeros...)
let marcadorUsuario = null;
let limitesZona = null;                   // bounds del botón "Buscar en esta zona"

let listaFiltrada = [];
let paginaActual = 1;

let modoAuth = "login";
let modoEdicionId = null;                 // id del anuncio que se está editando (o null)
let pasoActual = 1;
let fotosForm = [];                       // fotos del formulario (base64)
let coordsForm = { ...CENTRO_DEFECTO };
let ubicacionExactaCargada = null;   // punto REAL del anuncio que se edita (solo dueño); null al crear
let pinConfirmado = false;   // true cuando el pin salió de una búsqueda exitosa (o la persona lo colocó)
let pinManual = false;   // true cuando la persona colocó el pin a mano (no lo movemos solos)
let geoTimer = null, geoSeq = 0;
let mapaFormulario = null;
let marcadorFormulario = null;

// =====================================================================
// MAPA
// =====================================================================
function iniciarMapa() {
  if (!$("map")) return;
  mapa = crearMapaBase("map", [CENTRO_DEFECTO.lat, CENTRO_DEFECTO.lng], 13);

  // Agrupa pines cercanos. POR QUÉ: con 500 anuncios, 500 pines superpuestos
  // son ilegibles y lentos. Los clusters muestran "12" y al tocar se abren.
  capaMarcadores = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45
  });
  mapa.addLayer(capaMarcadores);
  capaComercios = L.layerGroup().addTo(mapa);
  // IMPORTANTE: ya NO pedimos el GPS al cargar. Los navegadores lo penalizan y
  // asusta al usuario. Solo se pide cuando toca "Mi ubicación" (acción explícita).
}

// Pide la ubicación y devuelve una Promesa. Reutilizable desde varios botones.
function pedirUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("no-soportado")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        ubicacionUsuario = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mostrarMarcadorUsuario();
        resolve(ubicacionUsuario);
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

function mensajeErrorUbicacion(err) {
  if (err && err.code === 1) return "Permiso de ubicación denegado. Actívalo en los ajustes del navegador.";
  if (err && err.message === "no-soportado") return "Tu navegador no permite geolocalización.";
  return "No se pudo obtener tu ubicación.";
}

function mostrarMarcadorUsuario() {
  if (!mapa || !ubicacionUsuario) return;
  if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
  marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], {
    icon: iconoUsuario(), zIndexOffset: 1000
  }).bindPopup("<b>📍 Estás aquí</b>").addTo(mapa);
}

// «📡 Cerca de mí» (clasificados): pide el GPS al tocar, ordena por cercanía y centra el mapa. Tocar de nuevo lo apaga.
async function cercaDeMiAnuncios() {
  const btn = $("btn-cerca-anuncios");
  if (btn.getAttribute("aria-pressed") === "true") {
    btn.setAttribute("aria-pressed", "false");
    if ($("ordenar-por").value === "cercanos") $("ordenar-por").value = "recientes";
    aplicarFiltros({ ajustarMapa: false });
    return;
  }
  btn.disabled = true; btn.textContent = "📡 Buscando tu ubicación…";
  try {
    await pedirUbicacion();
    $("ordenar-por").value = "cercanos";
    if (mapa) mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 14);
    btn.setAttribute("aria-pressed", "true");
    aplicarFiltros({ ajustarMapa: false });
  } catch (err) {
    mostrarToast(mensajeErrorUbicacion(err), "error");
  } finally {
    btn.disabled = false; btn.textContent = "📡 Cerca de mí";
  }
}

// «📡 Comercios cerca de mí»: independiente de los clasificados. Pide el GPS al tocar, quita el filtro de
// municipio/departamento de comercios (para ver los más cercanos de toda la zona) y ordena por cercanía.
async function cercaDeMiComercios() {
  const btn = $("btn-cerca-comercios");
  if (btn.getAttribute("aria-pressed") === "true") {
    ubicacionComercios = null;
    btn.setAttribute("aria-pressed", "false");
    comerciosVisibles = POR_PAGINA_COMERCIOS;
    pintarComerciosFeed();
    return;
  }
  btn.disabled = true; btn.textContent = "📡 Buscando tu ubicación…";
  try {
    ubicacionComercios = await obtenerGPS();
    muniComercio = ""; deptoComercio = "";
    btn.setAttribute("aria-pressed", "true");
    comerciosVisibles = POR_PAGINA_COMERCIOS;
    pintarComerciosFeed();
  } catch (err) {
    mostrarToast(textoErrorGPS(err), "error");
  } finally {
    btn.disabled = false; btn.textContent = "📡 Comercios cerca de mí";
  }
}

async function centrarEnMiUbicacion() {
  try {
    await pedirUbicacion();
    mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 15);
    $("btn-mi-ubicacion").classList.add("ring-2", "ring-yellow-300");
    mostrarToast("Ubicación actualizada");
    // si estaba ordenando por cercanía o con radio, recalcula
    if ($("ordenar-por").value === "cercanos" || parseFloat($("filtro-radio").value) > 0) {
      aplicarFiltros({ ajustarMapa: false });
    }
  } catch (err) {
    mostrarToast(mensajeErrorUbicacion(err), "error");
  }
}

function popupHTML(a) {
  const foto = urlSegura(a.imagen);
  return `<div class="popup-anuncio">
    ${foto ? `<img src="${esc(foto)}" alt="" class="w-full h-20 object-cover rounded-lg mb-2">` : ""}
    <strong class="block">${esc(a.nombre)}</strong>
    <small class="text-slate-500">${esc(a.barrio || "")}${a.ciudad ? ", " + esc(a.ciudad) : ""}</small>
    ${a.ubicacionAprox ? '<small class="block text-slate-400">📍 Zona aproximada</small>' : ""}
    ${a.precio ? `<div class="font-semibold text-indigo-600">${esc(a.precio)}</div>` : ""}
    <div class="flex flex-wrap gap-1.5 mt-2">
      <a href="anuncio.html?id=${a.id}" class="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-md no-underline">Ver anuncio completo →</a>
      ${botonesContactoHTML(a, true)}
      <a href="${esc(urlGoogleMaps(a.lat, a.lng))}" data-como-llegar data-anuncio="${a.id}" data-lat="${a.lat}" data-lng="${a.lng}" data-nombre="${esc(a.nombre)}" data-aprox="${a.ubicacionAprox ? 1 : 0}" data-ciudad="${esc(a.ciudad || "")}" target="_blank" rel="noopener" class="bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">${a.ubicacionAprox ? "Cómo llegar a la zona" : "Cómo llegar"}</a>
    </div>
  </div>`;
}

// ---------- Comercios (datos de OpenStreetMap, verificados por el equipo) ----------
function iconoComercio(tipo) {
  const emoji = iconosComercio[tipo] || "🏪";
  return L.divIcon({
    className: "marcador-cat",
    html: `<div class="pin-comercio"><span>${emoji}</span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
  });
}

function popupComercioHTML(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const foto = urlSegura(c.foto);
  const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
  return `<div class="popup-anuncio">
    ${foto ? `<img src="${esc(foto)}" alt="" class="w-full h-20 object-cover rounded-lg mb-2">` : ""}
    <strong class="block">${esc(c.nombre)}</strong>
    <small class="text-slate-500">${esc(nombreCategorias(c))} · ${esc(c.ciudad)}</small>
    ${pedirConfirmacion(c) && !(usuarioActual && c.ownerId === usuarioActual.id) ? `<div class="conf-pop mt-1.5" data-conf-pop="${c.id}"><span>👥 ¿Existe aquí?</span>
      <button type="button" data-conf-voto="existe" aria-label="Sí, existe y atiende aquí" title="Sí, existe">👍 Sí</button>
      <button type="button" data-conf-voto="no_existe" aria-label="No está o cerró" title="No está o cerró">👎 No</button></div>` : ""}
    ${esUbicacionAprox(c) ? `<div class="text-xs mt-1"><span class="badge-modo ${c.modoAtencion}">${MODOS_ATENCION[c.modoAtencion].icono} ${esc(MODOS_ATENCION[c.modoAtencion].corto)}</span> zona aproximada</div>` : c.direccion ? `<div class="text-xs text-slate-600 mt-1">📍 ${esc(c.direccion)}</div>` : ""}
    ${c.horario ? `<div class="text-xs text-slate-600">🕒 ${esc(c.horario)}</div>` : ""}
    <div class="text-[11px] mt-1">${resumenCalifHTML(c)}</div>
    ${confirmadoPorVecinos(c) && c.nivel < 2 ? `<div class="mt-1"><span class="badge-vecinos">👥 Confirmado por ${c.confirmaSi} vecinos</span></div>` : ""}
    ${comercioDudoso(c) ? `<div class="text-[11px] font-semibold text-red-700 mt-1">🚩 ${c.confirmaNo} personas dicen que ya no está</div>` : ""}
    <div class="text-[11px] mt-1 ${c.verificado ? "text-green-700 font-semibold" : "text-slate-400"}">${esc((SELLOS[c.nivel] || SELLOS[1]).largo)}${c.verificado && c.verificadoEn ? " · " + esc(fechaSello(c)) : ""}</div>
    <div class="flex flex-wrap gap-1.5 mt-2">
      ${tel ? `<a href="tel:${esc(tel)}" data-fui="${c.id}" class="bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">📞 Llamar</a>` : ""}
      ${c.whatsapp ? `<a href="${esc(urlWhatsAppTexto(c.whatsapp, `Hola, vi «${c.nombre}» en Merkap.`))}" target="_blank" rel="noopener" data-fui="${c.id}" class="bg-green-600 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">💬 WhatsApp</a>` : ""}
      ${esUbicacionAprox(c) ? ""
        : `<a href="${esc(urlGoogleMaps(c.lat, c.lng))}" data-como-llegar data-fui="${c.id}" data-lat="${c.lat}" data-lng="${c.lng}" data-nombre="${esc(c.nombre)}" data-ciudad="${esc(c.ciudad || "")}" target="_blank" rel="noopener" class="bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">Cómo llegar</a>`}
    </div>
    ${vitrinaPublica(c) && c.nProductos > 0 ? `<a href="tienda.html?id=${c.id}" class="block mt-2 text-center bg-teal-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md no-underline">🛍️ Ver tienda (${c.nProductos})</a>` : ""}
    <a href="tienda.html?id=${c.id}#opinar" class="block mt-2 text-center bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1.5 rounded-md no-underline" style="color:#92400e!important">⭐ Calificar / ver opiniones</a>
    ${c.ownerId ? `<a href="comercios.html?solicitar=${c.id}" class="block mt-2 text-[11px] underline" style="color:#64748b!important">✏️ ¿Es tu negocio? Solicitar actualización</a>`
      : `<a href="comercios.html?solicitar=${c.id}&tipo=reclamar" class="badge-reclamar mt-2" style="color:#1e1b4b!important">🔑 ¿Es tu negocio? Reclámalo gratis</a>`}
  </div>`;
}

// ---------- Comercios en el feed (después de los anuncios) ----------
const POR_PAGINA_COMERCIOS = 12;
let comerciosVisibles = POR_PAGINA_COMERCIOS;

let catComercio = "todos", muniComercio = "", deptoComercio = "", textoComercio = "";
let ubicacionComercios = null;   // {lat,lng}: solo si tocaste «Comercios cerca de mí» (independiente de los clasificados)

// Base: SOLO los filtros propios de la sección de comercios (buscador, departamento y municipio de comercios).
// No dependen de los filtros de clasificados ni del buscador del inicio.
function comerciosBase() {
  if (!$("comercios-feed")) return [];
  const texto = normalizar(textoComercio.trim());
  return comercios.filter(c => {
    if (deptoComercio && c.departamento !== deptoComercio) return false;
    if (muniComercio && String(c.municipioId) !== muniComercio) return false;
    if (texto) {
      if (typeof comercioCoincide === "function") { if (!comercioCoincide(c, texto)) return false; }
      else {
        const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
        if (!normalizar([c.nombre, c.direccion, c.ciudad, t ? t.nombre : ""].join(" ")).includes(texto)) return false;
      }
    }
    return true;
  });
}

// ---------- ⭐ Selección del día (fase 2AC) ----------
function pintarSeleccionDia() {
  const lista = seleccionDelDia(baseDatosAnuncios, 8);
  $("seleccion-dia").classList.toggle("hidden", lista.length < 2);   // fase 2AC.1: desde 2 anuncios
  if (lista.length < 2) return;
  const mod = esAdmin();   // fase 2AK: la Selección del día la maneja el administrador
  $("sel-lista").innerHTML = lista.map(a => {
    const foto = urlSegura(a.imagen);
    return `<div class="sel-item" data-sel="${a.id}">
      <a href="anuncio.html?id=${a.id}" class="sel-card">
        <span class="sel-foto">${iconosCategoria[a.categoria] || "📦"}${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : ""}${a.elegidoMod ? '<b class="sel-estrella" title="Elegido por Merkap">⭐</b>' : ""}</span>
        <span class="sel-txt"><span class="sel-nombre">${esc(a.nombre)}</span>${a.precio ? `<span class="sel-precio">${esc(precioConSufijo(a))}</span>` : ""}<span class="sel-lugar">${esc(a.ciudad || a.barrio || "")}</span></span>
      </a>
      ${mod ? `<button type="button" class="sel-quitar" data-sel-quitar="${a.id}" title="Sacar de la Selección del día" aria-label="Sacar de la Selección del día">✕</button>` : ""}
    </div>`;
  }).join("");
}
// Fase 2AD: el moderador saca un anuncio de la franja con ✕ (se maneja todo en «Editar inicio»)
async function quitarDeSeleccion(e) {
  const b = e.target.closest("[data-sel-quitar]");
  if (!b) return;
  e.preventDefault();
  b.disabled = true;
  try { await excluirDeSeleccion(Number(b.dataset.selQuitar), true); mostrarToast("🚫 Sacado de la Selección del día. Puedes volver a permitirlo en «Editar inicio»"); pintarSeleccionDia(); }
  catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

function textoDistancia(km) {
  return km < 1 ? Math.max(10, Math.round(km * 100) * 10) + " m" : km.toFixed(1).replace(".", ",") + " km";
}
function distanciaComercio(c) {
  return (ubicacionComercios && tieneCoords(c)) ? distanciaKm(ubicacionComercios, c) : Infinity;
}

function comerciosFiltrados() {
  // Con «Comercios cerca de mí»: los más cercanos primero. Sin él: verificados, con productos y por nombre.
  return comerciosBase().filter(c => catComercio === "todos" || comercioEsTipo(c, catComercio))
    .sort((x, y) => ubicacionComercios ? distanciaComercio(x) - distanciaComercio(y)
      : (grupoHorario(x) - grupoHorario(y)) || (y.nivel - x.nivel) || (y.nProductos - x.nProductos) || x.nombre.localeCompare(y.nombre, "es"));   // fase 2AI: abiertos primero
}

// Categorías (con cuántos hay) y municipios de esta sección
function pintarFiltrosComercios() {
  const base = comerciosBase();
  const cuenta = {};
  base.forEach(c => { [c.tipo].concat(c.tiposExtra || []).forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; }); });
  if (catComercio !== "todos" && !cuenta[catComercio]) catComercio = "todos";
  const chip = (id, txt, n) => `<button type="button" data-cat-com="${id}" class="shrink-0 text-sm font-semibold px-3.5 py-1.5 rounded-full border whitespace-nowrap ${catComercio === id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"}">${txt} <span class="${catComercio === id ? "text-indigo-200" : "text-slate-400"}">${n}</span></button>`;
  $("comercios-cats").innerHTML = chip("todos", "Todos", base.length)
    + TIPOS_COMERCIO.filter(t => cuenta[t.id]).map(t => chip(t.id, `${t.icono} ${esc(t.nombre)}`, cuenta[t.id])).join("");
  // Departamentos con comercios (solo se muestra si hay más de uno)
  const deptos = [...new Set(comercios.map(c => c.departamento).filter(Boolean))].sort((x, y) => x.localeCompare(y, "es"));
  const selD = $("comercios-depto");
  const firmaD = deptos.join("|");
  if (selD.dataset.firma !== firmaD) {
    selD.innerHTML = '<option value="">Todos los departamentos</option>' + deptos.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
    selD.dataset.firma = firmaD;
  }
  selD.value = deptoComercio;
  selD.classList.toggle("hidden", deptos.length < 2);
  // Municipios con comercios (se arma con todos los comercios del departamento elegido, para poder cambiar de municipio)
  const munis = {};
  comercios.forEach(c => { if (!deptoComercio || c.departamento === deptoComercio) munis[c.municipioId] = c.ciudad; });
  const sel = $("comercios-muni");
  const ids = Object.keys(munis).sort((x, y) => munis[x].localeCompare(munis[y], "es"));
  const firma = ids.join(",");
  if (muniComercio && !munis[muniComercio]) muniComercio = "";
  if (sel.dataset.firma !== firma) {
    sel.innerHTML = '<option value="">Todos los municipios</option>' + ids.map(id => `<option value="${id}">${esc(munis[id])}</option>`).join("");
    sel.dataset.firma = firma;
  }
  sel.value = muniComercio;
  sel.classList.toggle("hidden", ids.length < 2);
  $("comercios-muni-etq").classList.toggle("hidden", ids.length < 2);
  $("comercios-orden").textContent = ubicacionComercios ? "📍 Ordenados por cercanía a ti (de toda la zona)"
    : "🟢 Abiertos primero, luego verificados · toca «Comercios cerca de mí» para ordenarlos por cercanía";
}

function tarjetaComercioFeed(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const foto = urlSegura(c.foto);
  const sello = SELLOS[c.nivel] || SELLOS[1];
  const hz = estadoHorario(c.horario);   // fase 2AH
  const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
  return `<article class="tarjeta-comercio relative bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition rounded-2xl shadow-sm overflow-hidden flex flex-col" data-comercio="${c.id}">
    <div class="h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative">
      <span class="text-5xl">${esc(t ? t.icono : "🏪")}</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      <span class="absolute top-2 left-2 ${c.nivel === 3 ? "bg-green-600 text-white" : c.nivel === 2 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"} text-[11px] font-semibold px-2 py-0.5 rounded-full">${c.nivel >= 2 ? "✔ " : ""}${esc(sello.corto)}</span>
      ${badgeHorarioHTML(hz, "absolute top-2 right-2")}
      ${!c.ownerId ? `<a href="comercios.html?solicitar=${c.id}&tipo=reclamar" class="badge-reclamar absolute bottom-2 left-2 z-10" title="¿Eres el dueño? Reclama esta ficha gratis">🔑 ¿Es tu negocio? Reclámalo</a>` : ""}
    </div>
    <div class="p-4 flex-1 flex flex-col">
      <h3 class="font-bold text-base leading-tight"><a href="tienda.html?id=${c.id}" class="after:absolute after:inset-0 after:content-[''] hover:text-indigo-700">${esc(c.nombre)}</a></h3>
      <p class="text-xs text-slate-500">${esc(nombreCategorias(c))} · ${esc(c.ciudad)}</p>
      ${ubicacionComercios && tieneCoords(c) ? `<p class="text-xs font-bold text-indigo-700 mt-0.5">📏 A ${textoDistancia(distanciaComercio(c))} de ti</p>` : ""}
      <p class="text-xs mt-1">${resumenCalifHTML(c)}</p>
      ${c.descripcion ? `<p class="text-sm text-slate-600 mt-1.5 line-clamp-2">${esc(c.descripcion)}</p>` : ""}
      ${c.direccion ? `<p class="text-xs text-slate-600 mt-1.5">📍 ${esc(c.direccion)}</p>` : ""}
      ${c.horario ? `<p class="text-xs text-slate-600">🕒 ${esc(c.horario)}</p>${lineaHorarioHTML(hz)}` : ""}
      ${vitrinaPublica(c) && c.nProductos > 0 ? `<p class="text-xs font-bold text-teal-700 mt-1.5">🛍️ ${c.nProductos} producto${c.nProductos === 1 ? "" : "s"} en su vitrina</p>` : ""}
      <p class="text-[11px] text-indigo-600 font-semibold mt-2">👆 Toca para ver el comercio completo${vitrinaPublica(c) && c.nProductos > 0 ? ", sus productos y promociones" : ""}</p>
      <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 relative z-10">
        ${c.whatsapp ? `<a href="${esc(urlWhatsAppTexto(c.whatsapp, `Hola, vi «${c.nombre}» en Merkap.`))}" target="_blank" rel="noopener" data-fui="${c.id}" class="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg">💬 WhatsApp</a>` : ""}
        ${tel ? `<a href="tel:${esc(tel)}" data-fui="${c.id}" class="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg">📞 Llamar</a>` : ""}
        ${esUbicacionAprox(c) ? "" : `<a href="${esc(urlGoogleMaps(c.lat, c.lng))}" data-como-llegar data-fui="${c.id}" data-lat="${c.lat}" data-lng="${c.lng}" data-nombre="${esc(c.nombre)}" data-ciudad="${esc(c.ciudad || "")}" target="_blank" rel="noopener" class="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg">🗺️ Cómo llegar</a>`}
        <a href="tienda.html?id=${c.id}#opinar" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-3 py-1.5 rounded-lg">⭐ Calificar</a>
        ${EDITOR ? `<a href="admin-comercios.html?editar=${c.id}" class="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold px-3 py-1.5 rounded-lg">✏️ Editar</a>` : ""}
      </div>
    </div>
  </article>`;
}

function pintarComerciosFeed() {
  const cont = $("comercios-feed");
  if (!cont) return;
  pintarFiltrosComercios();
  const lista = comerciosFiltrados();
  // «Ver directorio completo»: lleva la búsqueda, categoría y ubicación elegidas en esta sección
  const p = new URLSearchParams();
  if (textoComercio.trim()) p.set("q", textoComercio.trim());
  if (catComercio !== "todos") p.set("tipo", catComercio);
  if (deptoComercio) p.set("depto", deptoComercio);
  if (muniComercio) p.set("muni", muniComercio);
  $("link-directorio").href = "comercios.html" + (p.toString() ? "?" + p : "");
  $("seccion-comercios").classList.toggle("hidden", !comercios.length);
  if (!comercios.length) return;
  if (!lista.length) { cont.innerHTML = '<p class="text-sm text-slate-500 col-span-full text-center py-6">No hay comercios con estos filtros de comercios.' + ((muniComercio || deptoComercio || textoComercio) ? ' <button type="button" id="btn-limpiar-comercios" class="text-indigo-600 font-semibold underline">Ver todos los comercios</button>' : '') + '</p>'; $("comercios-mas").classList.add("hidden"); $("comercios-contador").textContent = "(0)"; return; }
  $("comercios-contador").textContent = "(" + lista.length + ")";
  cont.innerHTML = lista.slice(0, comerciosVisibles).map(tarjetaComercioFeed).join("");
  const faltan = lista.length - comerciosVisibles;
  $("comercios-mas").classList.toggle("hidden", faltan <= 0);
  if (faltan > 0) $("btn-mas-comercios").textContent = `Ver ${Math.min(POR_PAGINA_COMERCIOS, faltan)} comercios más (${faltan} restantes)`;
}

const marcadoresComercioPorId = new Map();
function pintarComercios() {
  if (!capaComercios) return;
  // Igual que con los anuncios: si un comercio tenía su ventanita abierta, se vuelve a abrir tras repintar.
  let reabrirCom = null;
  marcadoresComercioPorId.forEach((m, id) => { if (typeof m.isPopupOpen === "function" && m.isPopupOpen()) reabrirCom = id; });
  marcadoresComercioPorId.clear();
  capaComercios.clearLayers();
  if (!$("chk-comercios").checked) return;
  comercios.forEach(c => {
    if (!tieneCoords(c)) return;
    const mc = L.marker([c.lat, c.lng], { icon: iconoComercio(c.tipo), title: c.nombre, zIndexOffset: -500 })
      .bindPopup(popupComercioHTML(c), { maxWidth: 240 }).addTo(capaComercios);
    marcadoresComercioPorId.set(c.id, mc);
  });
  if (reabrirCom !== null && marcadoresComercioPorId.has(reabrirCom)) marcadoresComercioPorId.get(reabrirCom).openPopup();
}

function renderizarMarcadores(ajustarVista) {
  // Si había un pin con su ventanita abierta y solo se repinta (p. ej. cambió la sesión), la volvemos a abrir:
  // Leaflet cierra el popup de cualquier marcador que se quita de la capa.
  let reabrir = null;
  if (!ajustarVista) marcadoresPorId.forEach((m, id) => { if (typeof m.isPopupOpen === "function" && m.isPopupOpen()) reabrir = id; });
  capaMarcadores.clearLayers();
  marcadoresPorId.clear();
  const nuevos = [];
  listaFiltrada.forEach(a => {
    if (!tieneCoords(a)) return;
    const m = L.marker([a.lat, a.lng], { icon: iconoMarcador(a.categoria), title: a.nombre });
    m.bindPopup(popupHTML(a), { maxWidth: 240 });
    // Mapa → lista: al tocar un pin se resalta su tarjeta
    m.on("click", () => resaltarTarjeta(a.id, true));
    marcadoresPorId.set(a.id, m);
    nuevos.push(m);
  });
  capaMarcadores.addLayers(nuevos); // addLayers (en lote) es mucho más rápido que addLayer uno a uno
  if (reabrir !== null && marcadoresPorId.has(reabrir)) {
    const m = marcadoresPorId.get(reabrir);
    capaMarcadores.zoomToShowLayer(m, () => m.openPopup());
  }

  // fitBounds: el mapa se ajusta solo para mostrar los resultados filtrados
  if (ajustarVista && nuevos.length) {
    mapa.fitBounds(capaMarcadores.getBounds().pad(0.2), { maxZoom: 15 });
  }
}

// Lista → mapa: el botón "Ver en mapa" de una tarjeta vuela hasta su pin
function verEnMapa(id) {
  const m = marcadoresPorId.get(id);
  if (!m) { mostrarToast("Este anuncio no tiene ubicación en el mapa", "error"); return; }
  $("map").scrollIntoView({ behavior: "smooth", block: "center" });
  resaltarTarjeta(id, false);
  capaMarcadores.zoomToShowLayer(m, () => m.openPopup()); // desagrupa el cluster si hace falta
}

function resaltarTarjeta(id, desplazar) {
  // si la tarjeta está en una página aún no mostrada, la mostramos
  let idx = listaFiltrada.findIndex(a => a.id === id);
  if (idx === -1) return;
  while (idx >= paginaActual * POR_PAGINA) { paginaActual++; renderizarLista(); }

  document.querySelectorAll(".tarjeta-activa").forEach(el => el.classList.remove("tarjeta-activa"));
  const tarjeta = $("tarjeta-" + id);
  if (!tarjeta) return;
  tarjeta.classList.add("tarjeta-activa");
  // En celular el mapa está ARRIBA de la lista: moverse a la tarjeta sacaría al
  // usuario del mapa. Solo hacemos scroll cuando mapa y lista van lado a lado.
  if (desplazar) {
    const pista = $("contenedor-anuncios");
    // Solo movemos el carrusel hacia los lados; la página NO se desplaza, para no sacar a la persona del mapa ni cerrar el popup.
    pista.scrollTo({ left: tarjeta.offsetLeft - (pista.clientWidth - tarjeta.offsetWidth) / 2, behavior: "smooth" });
  }
}

// "Buscar en esta zona": limita los resultados a lo que se ve en el mapa
function buscarEnZona() {
  limitesZona = mapa.getBounds();
  $("btn-quitar-zona").classList.remove("hidden");
  aplicarFiltros({ ajustarMapa: false });
}
function quitarZona() {
  limitesZona = null;
  $("btn-quitar-zona").classList.add("hidden");
  aplicarFiltros();
}

// =====================================================================
// CATEGORÍAS (dibujadas desde CATEGORIAS de data.js)
// =====================================================================
function renderizarCategorias() {
  $("chips-categorias").innerHTML = chipsCategoriasHTML();

  const elegida = $("form-categoria").value;
  $("form-categoria").innerHTML = CATEGORIAS.filter(c => c.id !== "todos" && (c.activo !== false || c.id === elegida)).map(c =>
    `<option value="${esc(c.id)}">${c.icono} ${esc(c.nombre)}</option>`
  ).join("");
  if (elegida && CATEGORIAS.some(c => c.id === elegida)) $("form-categoria").value = elegida;
  marcarCategoriaActiva();
}
// ---------- Accesos en cuadros del inicio (fase 2Z.1) ----------
function accesoHTML(x) {
  const color = COLORES_ACCESO.includes(x.color) ? x.color : "morado";
  const img = urlSegura(x.imagen_url || "");
  const dentro = `<span class="acceso-cuadro acc-${color}${img ? " con-imagen" : ""}" aria-hidden="true">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="acceso-ico">${esc(x.icono || "⭐")}</span>`}</span><span class="acceso-txt">${esc(x.titulo)}</span>`;
  // «Publica gratis» abre el formulario aquí mismo (pide cuenta si hace falta)
  if (x.destino === "#publicar") return `<button type="button" class="acceso" data-abrir="modal-publicar" data-requiere-login data-auth-modo="registro">${dentro}</button>`;
  return `<a class="acceso" href="${esc(x.destino)}">${dentro}</a>`;
}
// Carrusel desde la base (fase 2Z.2). Sin filas, se queda el de siempre (está escrito en index.html).
function pintarBanners(lista) {
  if (!lista || !lista.length) return;
  $("car-pista").innerHTML = lista.map((b, i) => bannerHTML(b, i, lista.length)).join("");
  if (window.carruselRefrescar) window.carruselRefrescar();
  if (typeof actualizarUIAuth === "function") actualizarUIAuth();
}
function pintarAccesos(lista) { $("accesos").innerHTML = lista.filter(x => destinoAccesoValido(x.destino)).map(accesoHTML).join(""); }

// Llegaron las categorías de la base (fase 2Z): se repintan chips y el select del formulario
document.addEventListener("categorias:anuncio", () => {
  const sub = $("form-subcategoria") ? $("form-subcategoria").value : "";
  renderizarCategorias();
  actualizarSubcategoriasForm(sub);
});

function actualizarSubcategoriasForm(valor, detalles) {
  const subs = SUBCATEGORIAS[$("form-categoria").value] || [];
  $("caja-subcategoria").classList.toggle("hidden", !subs.length);
  const sel = $("form-subcategoria");
  sel.required = subs.length > 0;
  sel.innerHTML = subs.length ? '<option value="">Elige una subcategoría…</option>' + subs.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("") : "";
  if (valor) sel.value = valor;
  pintarCamposDetalle(detalles);
}

// ---------- Detalles de inmuebles y vehículos (fase 2Z.7) ----------
// Al elegir Inmuebles o Vehículos aparecen sus datos: no es lo mismo un carro, una moto o un apartamento.
// Los obligatorios llevan «required», así el paso no avanza sin ellos (validarPaso usa checkValidity).
function leerDetallesForm() {
  const d = {};
  document.querySelectorAll("#caja-detalles [data-det]").forEach(el => {
    d[el.dataset.det] = el.type === "checkbox" ? el.checked : el.value.trim();
  });
  return d;
}
let memoriaDetalles = {};   // lo escrito se recuerda aunque el campo se oculte un momento (ej. al cambiar de subcategoría)
function pintarCamposDetalle(valores) {
  const caja = $("caja-detalles");
  if (!caja) return;
  const v = valores ? { ...valores } : { ...memoriaDetalles, ...leerDetallesForm() };
  memoriaDetalles = v;
  const cat = $("form-categoria").value, sub = $("form-subcategoria").value;
  const tipo = tipoDetalle(cat, sub);
  const campos = camposDetalle(cat, sub, { op: v.operacion || "", estado: $("form-estado").value });
  const ayuda = $("form-precio-ayuda");
  if (ayuda) ayuda.textContent = v.operacion === "arriendo" ? (tipo === "inmueble" ? "· valor del arriendo mensual" : "· valor por día") : v.operacion === "arriendo_dias" ? "· valor por noche" : "";
  caja.classList.toggle("hidden", !campos.length);
  if (!campos.length) { caja.innerHTML = ""; return; }
  const titulo = { inmueble: "🏡 Datos del inmueble", carro: "🚗 Datos del vehículo", moto: "🏍️ Datos de la moto", repuesto: "🔧 Datos del repuesto", vehiculo: "🚜 Datos del vehículo",
    mascota: "🐾 Sobre el animal", adultos: "🔞 Producto para mayores de 18" }[tipo] || "Datos";
  const id = k => "det-" + k;
  const etiqueta = c => `<label for="${id(c.k)}" class="block text-xs font-bold text-slate-600 mb-1">${esc(c.t)}${c.obligatorio ? " *" : ""}</label>`;
  const control = c => {
    const val = v[c.k] === undefined || v[c.k] === null ? "" : String(v[c.k]);
    const req = c.obligatorio ? "required" : "";
    if (c.tipo === "sel") return etiqueta(c) + `<select id="${id(c.k)}" data-det="${c.k}" ${req} class="w-full border border-slate-300 p-2.5 rounded-xl bg-white"><option value="">${c.obligatorio ? "Elige…" : "—"}</option>${c.op.map(([o, t]) => `<option value="${esc(o)}" ${o === val ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    if (c.tipo === "num") return etiqueta(c) + `<input id="${id(c.k)}" data-det="${c.k}" type="number" inputmode="numeric" min="${c.min}" max="${c.max}" step="1" ${req} value="${esc(val)}" class="w-full border border-slate-300 p-2.5 rounded-xl bg-white">`;
    const lista = c.lista ? `<datalist id="dl-${c.k}">${c.lista.map(o => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
    return etiqueta(c) + `<input id="${id(c.k)}" data-det="${c.k}" maxlength="${c.max || 60}" ${c.lista ? `list="dl-${c.k}"` : ""} autocomplete="off" ${req} value="${esc(val)}" class="w-full border border-slate-300 p-2.5 rounded-xl bg-white">${lista}`;
  };
  const casillas = campos.filter(c => c.tipo === "si");
  caja.innerHTML = `<p class="text-sm font-black text-indigo-900 mb-2">${titulo}</p>
    <div class="grid grid-cols-2 gap-3">${campos.filter(c => c.tipo !== "si").map(c => `<div class="${c.k === "operacion" || c.k === "requisitos" || c.k === "compatible" ? "col-span-2" : ""}">${control(c)}</div>`).join("")}</div>
    ${casillas.length ? `<div class="flex flex-wrap gap-x-4 gap-y-2 mt-3">${casillas.map(c => `<label class="text-sm flex items-${c.obligatorio ? "start font-semibold" : "center"} gap-1.5"><input type="checkbox" id="${id(c.k)}" data-det="${c.k}" ${v[c.k] === true ? "checked" : ""} ${c.obligatorio ? "required" : ""} class="${c.obligatorio ? "mt-0.5" : ""}"> ${esc(c.t)}${c.obligatorio ? " *" : ""}</label>`).join("")}</div>` : ""}
    ${tipo === "mascota" ? `<p class="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-3">🌿 <b>Solo animales domésticos o de criadero.</b> No se permite fauna silvestre (loros, guacamayas, pericos nativos o tortugas sin certificado, micos, iguanas, babillas…). Quien la publique pierde su cuenta. <a href="prohibidos.html#mascotas" target="_blank" class="underline">Ver qué sí se puede</a></p>` : ""}
    ${tipo === "adultos" ? `<p class="text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-3">🔞 Solo productos (juguetes, lencería, cuidado íntimo). Fotos del producto o el empaque, <b>sin desnudos</b>. Prohibidos los servicios sexuales y cualquier cosa con menores: cuenta eliminada. <a href="prohibidos.html#adultos" target="_blank" class="underline">Reglas</a></p>` : ""}
    ${avisoFraude({ categoria: cat, subcategoria: sub }) ? `<p class="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">${avisoFraude({ categoria: cat, subcategoria: sub })}</p>` : ""}`;
}

// =====================================================================
// FILTROS
// =====================================================================
function actualizarCiudadesFiltro() {
  llenarCiudadesFiltro();
  aplicarFiltros();
}

function aplicarFiltros({ ajustarMapa = true } = {}) {
  if (!capaMarcadores) return;

  const lista = filtrarAnuncios(leerCriterios(), limitesZona);

  listaFiltrada = lista;
  paginaActual = 1;
  renderizarLista();
  renderizarMarcadores(ajustarMapa && !limitesZona);
  if (usuarioActual) renderizarMisAnuncios();
  pintarChipsActivos();
}

function limpiarFiltros() {
  $("buscador").value = "";
  ["filtro-precio-min", "filtro-precio-max"].forEach(id => { $(id).value = ""; });
  ["filtro-con-foto", "filtro-con-precio"].forEach(id => { $(id).checked = false; });
  $("filtro-estado").value = "";
  $("filtro-departamento").value = "";
  $("filtro-radio").value = "0";
  $("ordenar-por").value = "recientes";
  categoriaActiva = "todos";
  subcategoriaActiva = "";
  limitesZona = null;
  $("btn-quitar-zona").classList.add("hidden");
  marcarCategoriaActiva();
  actualizarCiudadesFiltro();
}

// =====================================================================
// LISTA DE TARJETAS (con paginación)
// =====================================================================
function renderizarLista() {
  const cont = $("contenedor-anuncios");
  const total = listaFiltrada.length;
  const visibles = listaFiltrada.slice(0, paginaActual * POR_PAGINA);

  $("contador-resultados").textContent = total + (total === 1 ? " resultado" : " resultados");
  $("estado-vacio").classList.toggle("hidden", total > 0);
  // Base de datos vacía (aún nadie publicó) vs. filtros que no encuentran nada
  const sinAnuncios = baseDatosAnuncios.length === 0;
  $("vacio-icono").textContent = sinAnuncios ? "🚀" : "🔍";
  $("vacio-titulo").textContent = sinAnuncios ? "Aún no hay anuncios en tu zona" : "No encontramos resultados";
  $("vacio-texto").textContent = sinAnuncios ? "¡Sé el primero en publicar! Es gratis y toma un minuto." : "Prueba con otra búsqueda o quita filtros";
  $("vacio-limpiar").classList.toggle("hidden", sinAnuncios);

  cont.innerHTML = visibles.map(tarjetaHTML).join("");
  // Si es una búsqueda/filtro nuevo (primera página), el carrusel vuelve al principio
  if (paginaActual === 1) cont.scrollTo({ left: 0, behavior: "instant" });

  // «Ver todos los anuncios»: lleva los filtros actuales a anuncios.html
  const qs = criteriosAQuery();
  $("btn-ver-todos").href = $("link-ver-todos").href = "anuncios.html" + (qs ? "?" + qs : "");
  $("btn-ver-todos").textContent = total ? `📋 Ver todos los anuncios (${total}) →` : "📋 Ver todos los anuncios →";

  const restantes = total - visibles.length;
  $("contenedor-mas").classList.toggle("hidden", restantes <= 0);
  if (restantes > 0) $("btn-mas").textContent = `Mostrar más (${restantes} restantes)`;
}

// =====================================================================
// AUTENTICACIÓN (Supabase Auth: cuentas reales)
// =====================================================================
// Las contraseñas NUNCA pasan por nuestro código ni se guardan en el navegador:
// Supabase las recibe por HTTPS y guarda solo un hash. La sesión (un token) la
// administra la librería. Las funciones reales están en data.js.
function cambiarModoAuth() {
  modoAuth = modoAuth === "login" ? "registro" : "login";
  const reg = modoAuth === "registro";
  $("auth-titulo").textContent = reg ? "Crear cuenta" : "Iniciar sesión";
  $("auth-subtitulo").textContent = reg ? "Regístrate para publicar y gestionar tus anuncios" : "Accede para publicar y gestionar tus anuncios";
  $("campo-nombre").classList.toggle("hidden", !reg);
  $("auth-olvido").classList.toggle("hidden", reg);
  $("auth-terminos").classList.toggle("hidden", !reg);
  $("auth-switch-text").textContent = reg ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
  $("auth-switch-btn").textContent = reg ? "Inicia sesión" : "Regístrate";
  $("auth-password").autocomplete = reg ? "new-password" : "current-password";
}

async function manejarAuth(e) {
  e.preventDefault();
  const email = $("auth-email").value.trim().toLowerCase();
  const password = $("auth-password").value;
  const nombre = $("auth-nombre").value.trim();
  const btn = $("form-auth").querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    if (modoAuth === "registro") {
      const { confirmar } = await registrarUsuario(email, password, nombre);
      if (confirmar) {
        $("form-auth").reset();
        cerrarModal("modal-auth");
        mostrarToast("📧 Revisa tu correo y confirma tu cuenta para entrar");
        return;
      }
      mostrarToast("✅ Cuenta creada");
    } else {
      await iniciarSesion(email, password);
      mostrarToast("✅ Bienvenido");
    }
  } catch (err) {
    mostrarToast(err.message || "No se pudo iniciar sesión", "error");
    return;
  } finally {
    btn.disabled = false;
  }
  $("form-auth").reset();
  cerrarModal("modal-auth");
  alCambiarSesion();
}

async function cerrarSesion() {
  await cerrarSesionDB();
  alCambiarSesion();
  mostrarToast("Sesión cerrada");
}

// Si la persona venía de «Registrar mi negocio» (o similar), la devolvemos allí al entrar
function volverSiCorresponde() {
  try {
    const volver = sessionStorage.getItem("mf_volver");
    if (volver && usuarioActual && /^[a-z-]+\.html(\?id=\d+)?(#[a-z]+)?$/.test(volver)) { sessionStorage.removeItem("mf_volver"); location.href = volver; return true; }
  } catch (e) {}
  return false;
}

// Se llama cada vez que alguien entra o sale: repinta todo lo que depende de la sesión.
function alCambiarSesion() {
  actualizarUIAuth();
  if (volverSiCorresponde()) return;
  refrescarCorazones();
  refrescarMiTienda();
  activarModoEditor();
  aplicarFiltros({ ajustarMapa: false });
}

async function olvidePassword() {
  const email = $("auth-email").value.trim().toLowerCase();
  if (!email) { mostrarToast("Escribe tu correo arriba y vuelve a pulsar", "error"); $("auth-email").focus(); return; }
  try {
    await recuperarPassword(email);
    mostrarToast("📧 Si ese correo tiene cuenta, te enviamos un enlace");
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

async function guardarNuevaPassword(e) {
  e.preventDefault();
  const nueva = $("nueva-password").value;
  try {
    await cambiarPassword(nueva);
    $("form-nueva-password").reset();
    cerrarModal("modal-nueva-password");
    mostrarToast("✅ Contraseña actualizada");
    alCambiarSesion();
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

// Pide el formulario de cuenta ya en el modo que corresponde (el botón amarillo abre «Crear cuenta»)
document.addEventListener("auth:pedir", e => {
  if (e.detail && e.detail.modo === "registro" && modoAuth !== "registro") cambiarModoAuth();
  else if (e.detail && e.detail.modo === "login" && modoAuth !== "login") cambiarModoAuth();
});

// Menú de la cuenta (👤 Nombre ▾): Mis anuncios, Mi tienda y Cerrar sesión
function cerrarMenuCuenta() {
  const m = $("menu-cuenta");
  if (!m || m.classList.contains("hidden")) return;
  m.classList.add("hidden");
  $("btn-auth").setAttribute("aria-expanded", "false");
}
function alternarMenuCuenta() {
  const abrir = $("menu-cuenta").classList.contains("hidden");
  $("menu-cuenta").classList.toggle("hidden", !abrir);
  $("btn-auth").setAttribute("aria-expanded", abrir ? "true" : "false");
}

function actualizarUIAuth() {
  const btn = $("btn-auth");
  $("btn-publicar-txt").textContent = usuarioActual ? "Publicar gratis" : "Regístrate y publica gratis";
  // Fase 2Y: en celular el texto corto; con cuenta deja de titilar (ya está adentro)
  $("btn-publicar-corto").innerHTML = usuarioActual ? "Publicar" : 'Regístrate<span class="enc-gratis"> gratis</span>';
  $("btn-publicar-header").classList.toggle("btn-parpadeo", !usuarioActual);
  document.querySelectorAll(".car-cta[data-auth-modo]:not([data-texto-fijo])").forEach(b => { b.textContent = usuarioActual ? "Publicar gratis" : "Regístrate y publica gratis"; });
  if (usuarioActual) {
    btn.textContent = "👤 " + usuarioActual.nombre.split(" ")[0] + " ▾";
    btn.title = usuarioActual.nombre;
    btn.removeAttribute("data-abrir");            // con sesión, el botón abre el menú de la cuenta
    $("menu-cuenta-nombre").textContent = usuarioActual.nombre + (usuarioActual.email ? " · " + usuarioActual.email : "");
    $("menu-mi-perfil").href = "vendedor.html?id=" + encodeURIComponent(usuarioActual.id);   // fase 2C.5
    $("encabezado").classList.add("con-sesion");
    $("seccion-mis-anuncios").classList.remove("hidden");
    $("link-favoritos").classList.remove("hidden");
    renderizarMisAnuncios();
  } else {
    btn.innerHTML = '<span class="sm:hidden">Entrar</span><span class="hidden sm:inline">Iniciar sesión</span>';   // corto en celular
    btn.setAttribute("data-abrir", "modal-auth");
    $("seccion-mis-anuncios").classList.add("hidden");
    $("link-favoritos").classList.add("hidden");
    $("encabezado").classList.remove("con-sesion");
    cerrarMenuCuenta();
  }
}

// ---------- Favoritos (corazón) ----------
function pintarCorazon(btn, guardado) {
  btn.textContent = guardado ? "❤️" : "🤍";
  btn.setAttribute("aria-pressed", String(guardado));
  btn.setAttribute("aria-label", guardado ? "Quitar de favoritos" : "Guardar en favoritos");
}

async function alternarCorazon(id, btn) {
  if (!usuarioActual) {
    mostrarToast("Inicia sesión para guardar favoritos", "error");
    abrirModal("modal-auth");
    return;
  }
  const antes = favoritosIds.has(id);
  pintarCorazon(btn, !antes);             // respuesta inmediata; si falla se revierte
  btn.disabled = true;
  try {
    const ahora = await alternarFavorito(id);
    pintarCorazon(btn, ahora);
    mostrarToast(ahora ? "❤️ Guardado en favoritos" : "Quitado de favoritos");
  } catch (err) {
    pintarCorazon(btn, antes);
    mostrarToast(mensajeError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

// Al entrar/salir alguien: pone cada corazón de la pantalla en su estado correcto (sin repintar la lista).
async function refrescarMiTienda() {
  const mis = usuarioActual ? await cargarMisComercios() : [];
  $("link-mi-tienda").classList.toggle("hidden", !mis.length);
  $("menu-mi-tienda").classList.toggle("hidden", !mis.length);
}

async function refrescarCorazones() {
  await cargarFavoritos();
  document.querySelectorAll('[data-accion="favorito"]').forEach(b => {
    const fila = b.closest("[data-id]");
    if (fila) pintarCorazon(b, favoritosIds.has(Number(fila.dataset.id)));
  });
}

function renderizarMisAnuncios() {
  const cont = $("lista-mis-anuncios");
  const mis = baseDatosAnuncios.filter(a => a.owner === usuarioActual.id);
  if (!mis.length) { cont.innerHTML = '<p class="text-sm text-slate-500">Aún no tienes anuncios.</p>'; return; }
  cont.innerHTML = mis.map(a =>
    `<div data-id="${a.id}" class="flex justify-between items-center bg-white rounded-lg px-3 py-2 border">
      <a href="anuncio.html?id=${a.id}" class="text-sm font-medium truncate hover:text-indigo-600">${esc(a.nombre)}</a>
      <div class="flex gap-2 shrink-0 ml-2">
        <button type="button" data-accion="editar" class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Editar</button>
        <button type="button" data-accion="eliminar" class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Eliminar</button>
      </div>
    </div>`
  ).join("");
}

// =====================================================================
// FORMULARIO PUBLICAR / EDITAR (por pasos)
// =====================================================================
function irAPaso(n) {
  pasoActual = n;
  document.querySelectorAll("#formulario-registro [data-paso]").forEach(f =>
    f.classList.toggle("hidden", Number(f.dataset.paso) !== n));
  document.querySelectorAll(".barra-paso").forEach((b, i) => {
    b.classList.toggle("bg-indigo-600", i < n);
    b.classList.toggle("bg-slate-200", i >= n);
  });
  const total = NOMBRES_PASOS.length;
  $("paso-label").textContent = `Paso ${n} de ${total} · ${NOMBRES_PASOS[n - 1]}`;
  $("btn-atras").classList.toggle("invisible", n === 1);
  $("btn-siguiente").classList.toggle("hidden", n === total);
  $("btn-submit-anuncio").classList.toggle("hidden", n !== total);
  $("formulario-registro").scrollTop = 0;
  if (n === 2) iniciarMapaFormulario(); // el mapa se crea cuando su paso ya es visible
}

// Valida solo los campos del paso actual con las reglas nativas del HTML
// (required, pattern, maxlength...). Así el usuario ve el error donde está.
function validarPaso(n) {
  const campos = document.querySelectorAll(
    `#formulario-registro [data-paso="${n}"] input, #formulario-registro [data-paso="${n}"] select, #formulario-registro [data-paso="${n}"] textarea`);
  for (const c of campos) {
    if (c.type === "file") continue;
    if (!c.checkValidity()) { c.reportValidity(); return false; }
  }
  // Paso de contacto: WhatsApp, teléfono o ambos (al menos uno)
  if (n === 3 && !$("form-whatsapp").value.trim() && !$("form-telefono").value.trim()) {
    $("form-contacto-error").classList.remove("hidden");
    $("form-whatsapp").focus();
    return false;
  }
  if (n === 3) $("form-contacto-error").classList.add("hidden");
  return true;
}

function resetFormulario() {
  $("formulario-registro").reset();
  pinManual = false; pinConfirmado = false; geoSeq++; avisoGeo(null);
  ubicacionExactaCargada = null;
  $("form-aprox").disabled = false; $("form-aprox-nota").classList.add("hidden");
  fotosForm = [];
  renderizarFotosForm();
  coordsForm = ubicacionUsuario ? { ...ubicacionUsuario }
    : (mapa ? { lat: mapa.getCenter().lat, lng: mapa.getCenter().lng } : { ...CENTRO_DEFECTO });
  $("publicar-titulo").textContent = "🚀 Publica tu anuncio";
  $("btn-submit-anuncio").textContent = "⚡ Publicar";
  actualizarCiudadesForm();
  actualizarSubcategoriasForm(undefined, {});   // {} = sin datos del anuncio anterior
}

// La ciudad es una LISTA CERRADA (tabla `municipios`): así "envigado" y "Envigado"
// nunca cuentan como lugares distintos. Si la suya no está, "Mi ciudad no está" la
// manda a la lista de espera para saber a dónde expandirse.
function actualizarCiudadesForm() {
  const depto = $("form-departamento").value;
  $("form-ciudad").innerHTML =
    '<option value="">Elige tu ciudad…</option>' +
    (DEPARTAMENTOS[depto] || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("") +
    '<option value="__otra">➕ Mi municipio no está en la lista…</option>';
  mostrarCiudadNueva(false);
}

// Expansión: si el municipio no está, se escribe aquí y se crea (activo) al publicar.
function mostrarCiudadNueva(si) {
  $("caja-ciudad-nueva").classList.toggle("hidden", !si);
  $("form-ciudad-nueva").required = si;
  if (!si) $("form-ciudad-nueva").value = "";
}
// Nombre del municipio elegido en el formulario (el de la lista o el que se escribió)
const ciudadForm = () => $("form-ciudad").value === "__otra" ? $("form-ciudad-nueva").value.trim() : $("form-ciudad").value;

function alElegirCiudadForm(e) {
  if (e.target.value === "__otra") {
    mostrarCiudadNueva(true);
    $("form-ciudad-nueva").focus();
    return;
  }
  mostrarCiudadNueva(false);
  // Al crear un anuncio, centramos el mapa del formulario en la ciudad elegida.
  const m = buscarMunicipio($("form-departamento").value, e.target.value);
  if (m && m.lat != null && m.lng != null && !modoEdicionId && mapaFormulario) {
    marcadorFormulario.setLatLng([m.lat, m.lng]);
    mapaFormulario.setView([m.lat, m.lng], 14);
    fijarCoordsForm({ lat: m.lat, lng: m.lng });
  }
  if (!pinManual && $("form-barrio").value.trim().length >= 3) programarGeocodificar(300);
}

async function enviarListaEspera(e) {
  e.preventDefault();
  try {
    await unirseListaEspera($("espera-ciudad").value, $("espera-whatsapp").value);
    $("form-espera").reset();
    cerrarModal("modal-espera");
    mostrarToast("✅ ¡Gracias! Te avisaremos cuando lleguemos a tu ciudad");
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
  }
}

function fijarCoordsForm(latlng) {
  coordsForm = { lat: latlng.lat, lng: latlng.lng };
  $("form-coords-label").textContent = latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5);
}

function iniciarMapaFormulario() {
  if (!mapaFormulario) {
    mapaFormulario = crearMapaBase("map-formulario", [coordsForm.lat, coordsForm.lng], 15);
    marcadorFormulario = L.marker([coordsForm.lat, coordsForm.lng], {
      draggable: true, icon: iconoMarcador($("form-categoria").value)
    }).addTo(mapaFormulario);
    marcadorFormulario.on("dragend", () => { pinManual = true; fijarCoordsForm(marcadorFormulario.getLatLng()); avisoGeo("manual"); });
    mapaFormulario.on("click", e => { pinManual = true; marcadorFormulario.setLatLng(e.latlng); fijarCoordsForm(e.latlng); avisoGeo("manual"); });
  } else {
    // El mapa se crea UNA vez y se reutiliza (antes se destruía y recreaba cada vez)
    mapaFormulario.setView([coordsForm.lat, coordsForm.lng], 15);
    marcadorFormulario.setLatLng([coordsForm.lat, coordsForm.lng]);
    marcadorFormulario.setIcon(iconoMarcador($("form-categoria").value));
  }
  mapaFormulario.invalidateSize();
  fijarCoordsForm(coordsForm);
}

async function usarMiUbicacionFormulario() {
  try {
    await pedirUbicacion();
    pinManual = true; avisoGeo("gps");
    fijarCoordsForm(ubicacionUsuario);
    if (mapaFormulario) {
      marcadorFormulario.setLatLng([ubicacionUsuario.lat, ubicacionUsuario.lng]);
      mapaFormulario.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 16);
    }
    mostrarToast("Ubicación tomada");
  } catch (err) {
    mostrarToast(mensajeErrorUbicacion(err), "error");
  }
}

// ---------- Ubicar el pin escribiendo barrio o dirección ----------
// Usa Nominatim (el buscador de direcciones de OpenStreetMap, gratis y sin clave).
// Reglas: máx. 1 consulta/seg (debounce), solo Colombia, y limitado a los alrededores
// de la ciudad elegida para que "Centro" no caiga en otra ciudad.
const AVISOS_GEO = {
  buscando: ["⏳ Buscando en el mapa…", "bg-slate-100 text-slate-600"],
  exacta:   ["📍 Encontramos la dirección. Confirma que el pin esté exacto; si no, arrástralo.", "bg-emerald-50 text-emerald-800"],
  barrio:   ["📍 Ubicación aproximada según el barrio. Mueve el pin hasta el lugar exacto.", "bg-amber-50 text-amber-800"],
  nada:     ["No encontramos ese lugar. Prueba con otra escritura o toca el mapa para marcarlo tú.", "bg-rose-50 text-rose-700"],
  error:    ["No pudimos buscar ahora. Toca el mapa o arrastra el pin para marcar el lugar.", "bg-rose-50 text-rose-700"],
  manual:   ["✅ Pin colocado por ti. Si cambias el barrio o la dirección, pulsa 🔍 Buscar para recolocarlo.", "bg-indigo-50 text-indigo-700"],
  gps:      ["✅ Usamos tu ubicación GPS. Revisa que el pin esté donde está el artículo.", "bg-indigo-50 text-indigo-700"]
};

function avisoGeo(tipo) {
  const el = $("form-geo-estado");
  if (!el) return;
  if (!tipo) { el.className = "hidden"; el.textContent = ""; return; }
  const [txt, clases] = AVISOS_GEO[tipo];
  el.className = "text-xs font-semibold rounded-lg px-3 py-2 mb-2 " + clases;
  el.textContent = txt;
}

function programarGeocodificar(ms) {
  clearTimeout(geoTimer);
  geoTimer = setTimeout(() => geocodificarFormulario(false), ms);
}

async function geocodificarFormulario(forzar) {
  const ciudad = ciudadForm();
  const barrio = $("form-barrio").value.trim();
  const dir = $("form-direccion").value.trim();
  if (!ciudad) { if (forzar) mostrarToast("Primero elige la ciudad", "error"); return; }
  if (!barrio && !dir) { if (forzar) mostrarToast("Escribe el barrio o la dirección", "error"); return; }
  if (pinManual && !forzar) return;          // nunca movemos un pin que la persona colocó
  const miSeq = ++geoSeq;
  const depto = $("form-departamento").value;
  const muni = buscarMunicipio(depto, ciudad);
  const centro = muni && muni.lat != null ? { lat: muni.lat, lng: muni.lng } : null;
  const lugar = [ciudad, depto, "Colombia"].join(", ");
  const calle = dir.split(/#|\bno\.?\s|\bnro\.?\s/i)[0].trim();   // "Calle 37 Sur # 43A-20" -> "Calle 37 Sur"
  // De lo más exacto a lo más general; nos quedamos con el primer acierto.
  const intentos = [];
  if (dir) intentos.push([[dir.replace(/#/g, " "), barrio, lugar].filter(Boolean).join(", "), "exacta"]);
  if (calle && calle !== dir) intentos.push([[calle, barrio, lugar].filter(Boolean).join(", "), "exacta"]);
  if (barrio) intentos.push([[barrio, lugar].join(", "), "barrio"]);
  avisoGeo("buscando");
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 8000);
  try {
    for (const [q, nivel] of intentos) {
      const hallado = await consultarNominatim(q, centro, ctrl.signal);
      if (miSeq !== geoSeq) return;            // llegó una búsqueda más nueva (o se cerró el formulario)
      if (hallado) {
        pinManual = false; pinConfirmado = true;
        fijarCoordsForm(hallado);
        if (mapaFormulario) {
          marcadorFormulario.setLatLng([hallado.lat, hallado.lng]);
          mapaFormulario.setView([hallado.lat, hallado.lng], nivel === "exacta" ? 17 : 16);
        }
        avisoGeo(nivel);
        return;
      }
    }
    if (miSeq === geoSeq) avisoGeo("nada");
  } catch (err) {
    if (miSeq === geoSeq) avisoGeo("error");
  } finally {
    clearTimeout(corte);
  }
}

// ---------- Fotos ----------
// Reduce la foto a máx. 800 px y la comprime a JPEG: una foto de celular de
// 4 MB queda en ~80 KB. El bucket de Storage solo admite archivos de hasta 1 MB.
function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lectura"));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagen"));
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > 800) { h = Math.round(h * 800 / w); w = 800; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function agregarFotos(files) {
  const libres = MAX_FOTOS - fotosForm.length;
  if (libres <= 0) { mostrarToast(`Máximo ${MAX_FOTOS} fotos`, "error"); return; }
  for (const f of Array.from(files).slice(0, libres)) {
    try { fotosForm.push(await comprimirImagen(f)); }
    catch (err) { mostrarToast("No se pudo procesar una de las imágenes", "error"); }
  }
  if (files.length > libres) mostrarToast(`Solo se agregaron ${libres} (máximo ${MAX_FOTOS})`, "error");
  renderizarFotosForm();
}

function renderizarFotosForm() {
  $("form-fotos-previews").innerHTML = fotosForm.map((src, i) =>
    `<div class="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
      <img src="${esc(src)}" alt="Foto ${i + 1}" class="w-full h-full object-cover">
      <button type="button" data-quitar-foto="${i}" aria-label="Quitar foto ${i + 1}" class="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-sm leading-none">×</button>
      ${i === 0 ? '<span class="absolute bottom-1 left-1 bg-indigo-600 text-white text-[10px] px-1.5 rounded">Portada</span>' : ""}
    </div>`).join("");
  $("zona-subir-foto").classList.toggle("hidden", fotosForm.length >= MAX_FOTOS);
}

// ---------- Guardar ----------
async function registrarAnuncio(e) {
  e.preventDefault();
  if (pasoActual < NOMBRES_PASOS.length) { // Enter en un paso intermedio = "Siguiente"
    if (validarPaso(pasoActual)) irAPaso(pasoActual + 1);
    return;
  }
  for (let p = 1; p <= NOMBRES_PASOS.length; p++) {
    if (!validarPaso(p)) { irAPaso(p); validarPaso(p); return; }
  }
  if (!usuarioActual) {
    mostrarToast("Inicia sesión para publicar", "error");
    cerrarModal("modal-publicar");
    abrirModal("modal-auth");
    return;
  }
  if ($("form-ciudad").value === "__otra" && !(pinManual || pinConfirmado)) {
    mostrarToast("Marca en el mapa dónde queda tu barrio (toca el mapa o usa «Buscar»): así ubicamos tu municipio", "error");
    irAPaso(2);
    return;
  }
  const precio = extraerPrecio($("form-precio").value);
  if (precio !== null && precio > 99999999999) { mostrarToast("El precio es demasiado alto", "error"); irAPaso(1); return; }

  // Fase 2AB.1: los particulares no publican medicamentos (Términos 4B). Avisa; si confirma, un moderador lo revisa.
  if (!confirmarNoMedicamento($("form-nombre").value + " " + (($("form-descripcion") || {}).value || ""), "en los clasificados")) return;
  const previo = modoEdicionId ? baseDatosAnuncios.find(a => a.id === modoEdicionId) : null;
  const btn = $("btn-submit-anuncio");
  const textoBtn = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Guardando…";   // subir fotos puede tardar unos segundos con datos móviles

  let anuncio;
  try {
    anuncio = await guardarAnuncio({
      nombre: $("form-nombre").value.trim(),
      categoria: $("form-categoria").value,
      subcategoria: $("form-subcategoria").value,
      estado: $("form-estado").value,
      detalles: { ...leerDetallesForm(), precio_tipo: extraerPrecio($("form-precio").value) ? ((document.querySelector('input[name="precio-tipo"]:checked') || {}).value || "fijo") : "" },
      departamento: $("form-departamento").value,
      ciudad: $("form-ciudad").value === "__otra" ? "" : $("form-ciudad").value,
      ciudadNueva: $("form-ciudad").value === "__otra" ? $("form-ciudad-nueva").value.trim() : "",
      barrio: $("form-barrio").value.trim(),
      lat: coordsForm.lat,
      lng: coordsForm.lng,
      aprox: $("form-aprox").checked,
      exactaOriginal: ubicacionExactaCargada,
      whatsapp: $("form-whatsapp").value.trim() ? "57" + $("form-whatsapp").value.replace(/\D/g, "") : null,
      telefono: $("form-telefono").value.replace(/\D/g, "") || null,
      precio,                                   // número o null; se muestra siempre como "$1.200.000"
      desc: $("form-descripcion").value.trim(),
      fotos: [...fotosForm]
    }, previo ? previo.id : null);
  } catch (err) {
    // Fase 2AL: si el filtro lo bloqueó, la persona puede pedir revisión (no se queda sin salida)
    if (!(await ofrecerRevision(err, $("form-nombre").value.trim() + " · " + $("form-descripcion").value.trim()))) mostrarToast(mensajeError(err), "error");
    return;
  } finally {
    btn.disabled = false;
    btn.textContent = textoBtn;
  }

  if (previo) baseDatosAnuncios = baseDatosAnuncios.map(a => (a.id === previo.id ? anuncio : a));
  else baseDatosAnuncios = [anuncio, ...baseDatosAnuncios];

  mostrarToast(previo ? "✅ Anuncio actualizado" : "✅ ¡Anuncio publicado!");
  if (anuncio.avisoUbicacion) mostrarToast("Se guardó el anuncio, pero no pudimos guardar tu punto exacto. Ábrelo con «Editar» y guarda de nuevo.", "error");
  cerrarModal("modal-publicar");
  // Quita filtros de categoría/búsqueda para que el usuario VEA su anuncio
  $("buscador").value = "";
  categoriaActiva = "todos";
  subcategoriaActiva = "";
  marcarCategoriaActiva();
  refrescarOpcionesUbicacion();
  aplicarFiltros();
  pintarSeleccionDia();
  activarModoEditor();
  setTimeout(() => resaltarTarjeta(anuncio.id, true), 100);
}

async function editarAnuncio(id) {
  const a = baseDatosAnuncios.find(x => x.id === id);
  if (!a) return;
  const ajeno = !!(a.owner && usuarioActual && a.owner !== usuarioActual.id);   // un moderador editando el anuncio de otra persona
  // Si la ubicación es aproximada, el pin público NO es el real: traemos el real (solo lo entrega el dueño).
  let exacta = null;
  if (a.ubicacionAprox && !ajeno) exacta = await cargarUbicacionExacta(id);
  modoEdicionId = id;
  resetFormulario();
  $("form-nombre").value = a.nombre;
  $("form-categoria").value = a.categoria;
  $("form-estado").value = a.estado || "usado";
  actualizarSubcategoriasForm(a.subcategoria, a.detalles || {});
  $("form-precio").value = extraerPrecio(a.precio) || "";
  document.querySelectorAll('input[name="precio-tipo"]').forEach(r => { r.checked = r.value === (((a.detalles || {}).precio_tipo) || "fijo"); });
  $("form-departamento").value = a.departamento || Object.keys(DEPARTAMENTOS)[0];
  actualizarCiudadesForm();
  $("form-ciudad").value = a.ciudad || "";
  $("form-barrio").value = a.barrio || "";
  // El WhatsApp y el teléfono no vienen con el anuncio: se piden a la base (el dueño y los moderadores pueden)
  let contacto = { whatsapp: "", telefono: "" };
  try { contacto = await obtenerContactoAnuncio(id); } catch (e) { console.warn("contacto:", e); }
  $("form-whatsapp").value = (contacto.whatsapp || "").replace(/^57/, "");
  $("form-telefono").value = contacto.telefono || "";
  $("form-descripcion").value = a.desc || "";
  fotosForm = [...a.fotos];
  renderizarFotosForm();
  ubicacionExactaCargada = exacta;
  if (exacta) coordsForm = { lat: exacta.lat, lng: exacta.lng };
  else if (tieneCoords(a)) coordsForm = { lat: a.lat, lng: a.lng };
  $("form-aprox").checked = !!a.ubicacionAprox;
  if (ajeno) { $("form-aprox").disabled = true; $("form-aprox-nota").classList.remove("hidden"); }
  pinManual = true; geoSeq++; avisoGeo(null);   // al editar respetamos el pin guardado
  $("publicar-titulo").textContent = "✏️ Editar anuncio";
  $("btn-submit-anuncio").textContent = "💾 Guardar cambios";
  abrirModal("modal-publicar");
}

async function eliminarAnuncio(id, esAdmin) {
  if (esAdmin && !EDITOR) return;   // (solo visual: la base de datos rechaza el borrado si no eres moderador)
  if (!confirm(esAdmin ? "¿Eliminar este anuncio de forma permanente?" : "¿Eliminar este anuncio?")) return;
  try {
    await eliminarAnuncioDB(id);
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
    return;
  }
  baseDatosAnuncios = baseDatosAnuncios.filter(a => a.id !== id);
  refrescarOpcionesUbicacion();
  aplicarFiltros({ ajustarMapa: false });
  activarModoEditor();
  mostrarToast("Anuncio eliminado");
}

// =====================================================================
// MODO MODERADOR (se activa por el ROL de tu cuenta, no por la URL)
// =====================================================================
// Fase 2AN: el administrador ve si el filtro está activo o desbloqueado, y cuántas sesiones tiene abiertas
async function pintarAvisoFiltro() {
  const el = $("ebar-filtro"); if (!el) return;
  try {
    const e = await estadoSeguridad();
    const ses = (e.sesiones || []).length;
    el.classList.remove("hidden");
    el.className = "solo-admin text-xs font-bold px-2 py-0.5 rounded-full no-underline " + (e.desbloqueado_hasta ? "bg-red-600 text-white" : "bg-green-100 text-green-800");
    el.textContent = (e.desbloqueado_hasta ? "🔓 Filtro desbloqueado hasta " + horaCo(e.desbloqueado_hasta) : !e.tiene_clave ? "🔐 Crea tu clave de seguridad" : "🔐 Filtro activo") + (ses > 1 ? " · 📱 " + ses + " sesiones abiertas" : "");
  } catch (err) { el.classList.add("hidden"); }   // sin el SQL 40
}
function activarModoEditor() {
  $("ebar").classList.toggle("hidden", !EDITOR);
  if (EDITOR) $("ecount").textContent = " · " + baseDatosAnuncios.length + " anuncios activos";
  if (esAdmin()) pintarAvisoFiltro();
  pintarComerciosFeed();   // el botón «Editar» de cada comercio solo lo ven los moderadores
}

// =====================================================================
// ARRANQUE: conectamos todos los eventos en un solo lugar
// =====================================================================
// POR QUÉ addEventListener y no onclick="..." en el HTML: el HTML queda limpio,
// no dependemos de funciones globales ni de la variable global `event`, y es
// más fácil ver de un vistazo qué hace cada control.
function iniciarEventos() {
  const filtrarConRetraso = debounce(() => aplicarFiltros(), 250);
  $("buscador").addEventListener("input", filtrarConRetraso);
  ["filtro-precio-min", "filtro-precio-max"].forEach(id => $(id).addEventListener("input", filtrarConRetraso));
  ["filtro-estado", "filtro-ciudad", "filtro-con-foto", "filtro-con-precio"].forEach(id =>
    $(id).addEventListener("change", () => aplicarFiltros()));
  $("filtro-departamento").addEventListener("change", actualizarCiudadesFiltro);

  // Radio y "más cercanos" necesitan ubicación: se pide aquí, al elegir la opción.
  const requiereUbicacion = async (selectId, valorSinUbicacion, esActiva) => {
    const sel = $(selectId);
    if (esActiva(sel.value) && !ubicacionUsuario) {
      try { await pedirUbicacion(); mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 14); }
      catch (err) { mostrarToast(mensajeErrorUbicacion(err), "error"); sel.value = valorSinUbicacion; }
    }
    aplicarFiltros({ ajustarMapa: false });
  };
  $("filtro-radio").addEventListener("change", () => requiereUbicacion("filtro-radio", "0", v => parseFloat(v) > 0));
  $("ordenar-por").addEventListener("change", () => requiereUbicacion("ordenar-por", "recientes", v => v === "cercanos"));

  $("btn-filtros").addEventListener("click", () => {
    const abierto = $("panel-filtros").classList.toggle("hidden") === false;
    $("flecha-filtros").textContent = abierto ? "▴" : "▾";
    $("btn-filtros").setAttribute("aria-expanded", abierto ? "true" : "false");
  });
  $("btn-limpiar-filtros").addEventListener("click", limpiarFiltros);
  document.querySelector('[data-accion-global="limpiar"]').addEventListener("click", limpiarFiltros);

  // Delegación de eventos: UN listener en el contenedor sirve para todas las
  // tarjetas, incluso las que se crean después.
  $("chips-categorias").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    categoriaActiva = b.dataset.cat;
    subcategoriaActiva = "";                  // al cambiar de categoría se vuelve a «Todas»
    marcarCategoriaActiva();
    aplicarFiltros();
  });
  $("chips-subcategorias").addEventListener("click", e => {
    const b = e.target.closest("[data-subcat]");
    if (!b) return;
    subcategoriaActiva = b.dataset.subcat;
    pintarSubcategorias();
    aplicarFiltros();
  });
  $("form-subcategoria").addEventListener("change", () => pintarCamposDetalle());
  $("form-estado").addEventListener("change", () => pintarCamposDetalle());
  $("caja-detalles").addEventListener("change", e => { if (e.target.dataset.det === "operacion") pintarCamposDetalle(); });
  $("form-categoria").addEventListener("change", () => { actualizarSubcategoriasForm(); if (marcadorFormulario) marcadorFormulario.setIcon(iconoMarcador($("form-categoria").value)); });

  const acciones = e => {
    const b = e.target.closest("[data-accion]");
    const fila = e.target.closest("[data-id]");
    if (!b || !fila) return;
    const id = Number(fila.dataset.id);
    if (b.dataset.accion === "ver-mapa") verEnMapa(id);
    else if (b.dataset.accion === "favorito") alternarCorazon(id, b);
    else if (b.dataset.accion === "editar") editarAnuncio(id);
    else if (b.dataset.accion === "eliminar") eliminarAnuncio(id, false);
    else if (b.dataset.accion === "eliminar-admin") eliminarAnuncio(id, true);
  };
  $("contenedor-anuncios").addEventListener("click", acciones);
  $("lista-mis-anuncios").addEventListener("click", acciones);
  // Las imágenes no "burbujean" el evento error; con capture=true lo atrapamos igual.
  $("contenedor-anuncios").addEventListener("error", e => {
    if (e.target.tagName === "IMG") e.target.remove();
  }, true);

  $("btn-mas").addEventListener("click", () => {
    paginaActual++;
    renderizarLista();
  });

  $("btn-mi-ubicacion").addEventListener("click", centrarEnMiUbicacion);
  // «⤢ Ampliar» (solo celular): el mapa pasa de bajito a casi toda la pantalla y viceversa
  $("btn-ampliar-mapa").addEventListener("click", () => {
    const grande = $("map").classList.toggle("map-grande");
    $("btn-ampliar-mapa").setAttribute("aria-pressed", String(grande));
    $("btn-ampliar-mapa").textContent = grande ? "⤡ Reducir" : "⤢ Ampliar";
    if (mapa) setTimeout(() => mapa.invalidateSize(), 50);
    $("seccion-mapa").scrollIntoView({ block: "start", behavior: "smooth" });
  });
  $("btn-zona").addEventListener("click", buscarEnZona);
  $("chk-comercios").addEventListener("change", pintarComercios);
  $("btn-quitar-zona").addEventListener("click", quitarZona);

  // Auth
  $("form-auth").addEventListener("submit", manejarAuth);
  // «Continuar con Google» (el botón está en data.js para que sea igual en todas las ventanas)
  $("form-auth").insertAdjacentHTML("beforebegin", `<div id="auth-google">${BOTON_GOOGLE_HTML}</div>`);
  $("auth-google").addEventListener("click", async e => {
    const b = e.target.closest("[data-google]");
    if (!b) return;
    b.disabled = true;
    try { await entrarConGoogle(location.origin + location.pathname); }   // vuelve al inicio (y de ahí a donde iba, si había algo pendiente)
    catch (err) { mostrarToast(err.message, "error"); b.disabled = false; }
  });
  $("auth-switch-btn").addEventListener("click", cambiarModoAuth);
  $("auth-olvido").addEventListener("click", olvidePassword);
  $("btn-cerrar-sesion").addEventListener("click", cerrarSesion);
  $("btn-cerrar-sesion-menu").addEventListener("click", () => { cerrarMenuCuenta(); cerrarSesion(); });
  $("menu-mis-anuncios").addEventListener("click", () => { cerrarMenuCuenta(); $("seccion-mis-anuncios").scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.addEventListener("click", e => { if (!e.target.closest("#menu-cuenta") && !e.target.closest("#btn-auth")) cerrarMenuCuenta(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarMenuCuenta(); });
  $("btn-cerca-anuncios").addEventListener("click", cercaDeMiAnuncios);
  $("btn-cerca-comercios").addEventListener("click", cercaDeMiComercios);
  // Flechas del carrusel de anuncios (en celular se desliza con el dedo)
  const pistaAnu = $("contenedor-anuncios");
  const pasoAnu = dir => pistaAnu.scrollBy({ left: dir * Math.max(240, pistaAnu.clientWidth * 0.8), behavior: "smooth" });
  // Al llegar casi al final del carrusel se cargan más anuncios solos (el botón «Mostrar más» sigue como respaldo)
  pistaAnu.addEventListener("scroll", () => {
    if (pistaAnu.scrollLeft + pistaAnu.clientWidth >= pistaAnu.scrollWidth - 240 && paginaActual * POR_PAGINA < listaFiltrada.length) {
      paginaActual++;
      renderizarLista();
    }
  }, { passive: true });
  $("anu-ant").addEventListener("click", () => pasoAnu(-1));
  $("anu-sig").addEventListener("click", () => pasoAnu(1));
  $("form-nueva-password").addEventListener("submit", guardarNuevaPassword);
  $("btn-auth").addEventListener("click", () => {
    if (usuarioActual) alternarMenuCuenta();
  });
  // Encabezado fijo: al bajar se encoge un poco (más espacio para el contenido)
  const enc = $("encabezado");
  const alDesplazar = () => enc.classList.toggle("encogido", window.scrollY > 40);
  window.addEventListener("scroll", alDesplazar, { passive: true });
  alDesplazar();
  document.addEventListener("sesion:cambio", alCambiarSesion);          // sesión cambió en otra pestaña
  document.addEventListener("sesion:recuperar", () => abrirModal("modal-nueva-password")); // llegó por el enlace del correo

  // Lista de espera ("Mi ciudad no está")
  $("form-espera").addEventListener("submit", enviarListaEspera);
  $("form-ciudad").addEventListener("change", alElegirCiudadForm);
  $("form-ciudad-nueva").addEventListener("input", () => { if (!pinManual && $("form-ciudad-nueva").value.trim().length >= 4) programarGeocodificar(1100); });

  // Formulario
  $("formulario-registro").addEventListener("submit", registrarAnuncio);
  $("btn-siguiente").addEventListener("click", () => { if (validarPaso(pasoActual)) irAPaso(pasoActual + 1); });
  $("btn-atras").addEventListener("click", () => irAPaso(Math.max(1, pasoActual - 1)));
  $("form-foto").addEventListener("change", async e => { await agregarFotos(e.target.files); e.target.value = ""; });
  $("form-fotos-previews").addEventListener("click", e => {
    const b = e.target.closest("[data-quitar-foto]");
    if (!b) return;
    fotosForm.splice(Number(b.dataset.quitarFoto), 1);
    renderizarFotosForm();
  });
  $("form-departamento").addEventListener("change", actualizarCiudadesForm);
  $("btn-gps-form").addEventListener("click", usarMiUbicacionFormulario);
  $("btn-buscar-dir").addEventListener("click", () => geocodificarFormulario(true));
  $("form-barrio").addEventListener("input", () => { if (!pinManual && $("form-barrio").value.trim().length >= 3) programarGeocodificar(1100); });
  $("form-direccion").addEventListener("input", () => { if (!pinManual && $("form-direccion").value.trim().length >= 5) programarGeocodificar(1100); });
  $("form-direccion").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); geocodificarFormulario(true); } });
  // Solo dígitos en el WhatsApp (y quita un "57" inicial si pegaron +57...)
  ["form-whatsapp", "form-telefono"].forEach(id => $(id).addEventListener("input", e => {
    let d = e.target.value.replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("57")) d = d.slice(2);
    e.target.value = d.slice(0, 10);
    if (e.target.value) $("form-contacto-error").classList.add("hidden");
  }));
  $("form-mismo-numero").addEventListener("click", () => {
    if (!$("form-whatsapp").value) { mostrarToast("Primero escribe tu WhatsApp", "error"); return; }
    $("form-telefono").value = $("form-whatsapp").value; $("form-contacto-error").classList.add("hidden");
  });

  // Modales (utils.js dispara estos eventos)
  document.addEventListener("modal:abierto", e => {
    if (e.detail.id !== "modal-publicar") return;
    if (!modoEdicionId) resetFormulario();
    irAPaso(1);
  });
  document.addEventListener("modal:cerrado", e => {
    if (e.detail.id === "modal-publicar") modoEdicionId = null;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1) La pantalla se arma ya (categorías, mapa, eventos); los esqueletos se ven mientras llegan los datos.
  pintarAccesos(ACCESOS_RESPALDO);                 // al instante; luego los de la base
  cargarAccesosInicio().then(pintarAccesos);
  cargarBanners().then(pintarBanners);
  renderizarCategorias();
  iniciarMapa();
  iniciarEventos();
  conectarBuscadorGlobal(() => ({ anuncios: baseDatosAnuncios, comercios }));

  // 2) Datos reales desde Supabase
  await cargarDatos();

  // El formulario de publicar ofrece TODOS los municipios; el filtro solo los que tienen anuncios.
  TODOS_LOS_DEPARTAMENTOS.forEach(d => $("form-departamento").add(new Option(d, d)));
  $("form-departamento").value = DEPARTAMENTOS.Antioquia ? "Antioquia" : TODOS_LOS_DEPARTAMENTOS[0];
  refrescarOpcionesUbicacion();
  actualizarCiudadesForm();
  actualizarUIAuth();
  if (volverSiCorresponde()) return;
  refrescarMiTienda();
  await cargarFavoritos();           // si falla (p. ej. aún no existe la tabla) la lista sigue funcionando
  aplicarFiltros();
  pintarSeleccionDia();
  $("sel-lista").addEventListener("click", quitarDeSeleccion);
  $("sel-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  activarModoEditor();
  // Los comercios cargan aparte: si fallan, los anuncios siguen funcionando.
  cargarComercios().then(() => { pintarComercios(); pintarComerciosFeed(); });
  $("comercios-cats").addEventListener("click", e => { const b = e.target.closest("[data-cat-com]"); if (b) { catComercio = b.dataset.catCom; comerciosVisibles = POR_PAGINA_COMERCIOS; pintarComerciosFeed(); } });
  $("comercios-buscar").addEventListener("input", e => { textoComercio = e.target.value; comerciosVisibles = POR_PAGINA_COMERCIOS; pintarComerciosFeed(); });
  $("comercios-depto").addEventListener("change", e => { deptoComercio = e.target.value; muniComercio = ""; comerciosVisibles = POR_PAGINA_COMERCIOS; pintarComerciosFeed(); });
  $("comercios-feed").addEventListener("click", e => {
    if (!e.target.closest("#btn-limpiar-comercios")) return;
    muniComercio = ""; deptoComercio = ""; textoComercio = ""; $("comercios-buscar").value = ""; catComercio = "todos"; pintarComerciosFeed();
  });
  $("comercios-muni").addEventListener("change", e => { muniComercio = e.target.value; comerciosVisibles = POR_PAGINA_COMERCIOS; pintarComerciosFeed(); });
  $("btn-mas-comercios").addEventListener("click", () => { comerciosVisibles += POR_PAGINA_COMERCIOS; pintarComerciosFeed(); });

  // Enlace "#login" (lo usan las otras páginas para pedir que inicies sesión)
  if (location.hash === "#login" && !usuarioActual) abrirModal("modal-auth");
  revisarContactoPendiente();   // volvió del correo de confirmación con un contacto pendiente
  // Enlace "?editar=ID" (lo usan anuncio.html y anuncios.html): abre el formulario de edición de ese anuncio
  const idEditar = parseInt(new URLSearchParams(location.search).get("editar"), 10);
  if (idEditar) {
    history.replaceState(null, "", location.pathname);
    const a = baseDatosAnuncios.find(x => x.id === idEditar);
    if (!usuarioActual) abrirModal("modal-auth");
    else if (a && (a.owner === usuarioActual.id || EDITOR)) editarAnuncio(idEditar);
    else mostrarToast("Solo el dueño puede editar esta publicación", "error");
  }
  // Enlace "#publicar" (lo usa «Publicar gratis» de anuncios.html): abre el formulario o pide la cuenta
  // Desde la barra inferior en otras páginas: «📋 Mis anuncios» → index.html#mis-anuncios
  if (location.hash === "#mis-anuncios" && usuarioActual) {
    history.replaceState(null, "", location.pathname + location.search);
    setTimeout(() => $("seccion-mis-anuncios").scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }
  if (location.hash === "#publicar") { history.replaceState(null, "", location.pathname + location.search); $("btn-publicar-header").click(); }
});

// Fase 2Z.10: 👍 / 👎 en la ventanita del mapa («¿Existe aquí?»)
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-conf-voto]");
  if (!b) return;
  const caja = b.closest("[data-conf-pop]");
  const c = comercios.find(x => x.id === Number(caja.dataset.confPop));
  if (!c) return;
  if (!usuarioActual) { mostrarToast("Crea tu cuenta gratis para ayudar a tus vecinos"); abrirModal("modal-auth"); return; }
  caja.querySelectorAll("button").forEach(x => { x.disabled = true; });
  try {
    const r = await confirmarComercio(c, b.dataset.confVoto);
    Object.assign(c, { confirmaSi: r.comercio.confirmaSi, confirmaNo: r.comercio.confirmaNo, confirmaLugar: r.comercio.confirmaLugar });
    caja.innerHTML = "🙌 ¡Gracias por ayudar a tus vecinos!";
  } catch (err) { mostrarToast(mensajeError(err), "error"); caja.querySelectorAll("button").forEach(x => { x.disabled = false; }); }
});
