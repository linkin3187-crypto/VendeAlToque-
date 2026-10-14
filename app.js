// ===== MercaFree - Lógica principal (index.html) =====
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
let ubicacionUsuario = null;              // {lat,lng}; solo si el usuario la autorizó
let limitesZona = null;                   // bounds del botón "Buscar en esta zona"

let categoriaActiva = "todos";
let listaFiltrada = [];
let paginaActual = 1;

let modoAuth = "login";
let modoEdicionId = null;                 // id del anuncio que se está editando (o null)
let pasoActual = 1;
let fotosForm = [];                       // fotos del formulario (base64)
let coordsForm = { ...CENTRO_DEFECTO };
let ubicacionExactaCargada = null;   // punto REAL del anuncio que se edita (solo dueño); null al crear
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
      <a href="${esc(urlWhatsApp(a.whatsapp, a.nombre))}" target="_blank" rel="noopener" class="bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">WhatsApp</a>
      <a href="${esc(urlGoogleMaps(a.lat, a.lng))}" data-como-llegar data-lat="${a.lat}" data-lng="${a.lng}" data-nombre="${esc(a.nombre)}" data-aprox="${a.ubicacionAprox ? 1 : 0}" data-ciudad="${esc(a.ciudad || "")}" data-whatsapp="${esc(a.whatsapp || "")}" target="_blank" rel="noopener" class="bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">${a.ubicacionAprox ? "Cómo llegar a la zona" : "Cómo llegar"}</a>
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
    <small class="text-slate-500">${esc(t ? t.nombre.replace(/s$/, "") : "Comercio")} · ${esc(c.ciudad)}</small>
    ${c.direccion ? `<div class="text-xs text-slate-600 mt-1">📍 ${esc(c.direccion)}</div>` : ""}
    ${c.horario ? `<div class="text-xs text-slate-600">🕒 ${esc(c.horario)}</div>` : ""}
    <div class="text-[11px] mt-1 ${c.verificado ? "text-green-700 font-semibold" : "text-slate-400"}">${esc((SELLOS[c.nivel] || SELLOS[1]).largo)}${c.verificado && c.verificadoEn ? " · " + esc(fechaSello(c)) : ""}</div>
    <div class="flex flex-wrap gap-1.5 mt-2">
      ${tel ? `<a href="tel:${esc(tel)}" class="bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">📞 Llamar</a>` : ""}
      <a href="${esc(urlGoogleMaps(c.lat, c.lng))}" data-como-llegar data-lat="${c.lat}" data-lng="${c.lng}" data-nombre="${esc(c.nombre)}" data-ciudad="${esc(c.ciudad || "")}" target="_blank" rel="noopener" class="bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">Cómo llegar</a>
    </div>
    <a href="comercios.html?solicitar=${c.id}" class="block mt-2 text-[11px] underline" style="color:#64748b!important">✏️ ¿Es tu negocio? Solicitar actualización</a>
  </div>`;
}

function pintarComercios() {
  if (!capaComercios) return;
  capaComercios.clearLayers();
  if (!$("chk-comercios").checked) return;
  comercios.forEach(c => {
    if (!tieneCoords(c)) return;
    L.marker([c.lat, c.lng], { icon: iconoComercio(c.tipo), title: c.nombre, zIndexOffset: -500 })
      .bindPopup(popupComercioHTML(c), { maxWidth: 240 }).addTo(capaComercios);
  });
}

function renderizarMarcadores(ajustarVista) {
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
  if (desplazar && window.matchMedia("(min-width: 1024px)").matches) {
    tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
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
  $("chips-categorias").innerHTML = CATEGORIAS.map(c =>
    `<button type="button" data-cat="${esc(c.id)}" class="categoria-btn px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap">${c.icono} ${esc(c.nombre)}</button>`
  ).join("");

  $("form-categoria").innerHTML = CATEGORIAS.filter(c => c.id !== "todos").map(c =>
    `<option value="${esc(c.id)}">${c.icono} ${esc(c.nombre)}</option>`
  ).join("");
  marcarCategoriaActiva();
}

function marcarCategoriaActiva() {
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

// =====================================================================
// FILTROS
// =====================================================================
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

function actualizarCiudadesFiltro() {
  llenarCiudadesFiltro();
  aplicarFiltros();
}

function aplicarFiltros({ ajustarMapa = true } = {}) {
  if (!capaMarcadores) return;

  const texto = normalizar($("buscador").value.trim());
  const pMin = parseInt($("filtro-precio-min").value, 10) || 0;
  const pMax = parseInt($("filtro-precio-max").value, 10) || Infinity;
  const hayFiltroPrecio = pMin > 0 || pMax !== Infinity;
  const soloFoto = $("filtro-con-foto").checked;
  const soloPrecio = $("filtro-con-precio").checked;
  const estado = $("filtro-estado").value;
  const departamento = $("filtro-departamento").value;
  const ciudad = $("filtro-ciudad").value;
  const radio = parseFloat($("filtro-radio").value) || 0;
  const orden = $("ordenar-por").value;

  let lista = baseDatosAnuncios.filter(a => {
    if (categoriaActiva !== "todos" && a.categoria !== categoriaActiva) return false;
    if (texto) {
      const pajar = normalizar([a.nombre, a.desc, a.barrio, a.ciudad].join(" "));
      if (!pajar.includes(texto)) return false;
    }
    const precioNum = extraerPrecio(a.precio);
    if (hayFiltroPrecio && !(precioNum !== null && precioNum >= pMin && precioNum <= pMax)) return false;
    if (soloFoto && !a.imagen) return false;
    if (soloPrecio && !precioNum) return false;
    if (estado && a.estado !== estado) return false;
    if (departamento && a.departamento !== departamento) return false;
    if (ciudad && a.ciudad !== ciudad) return false;
    if (radio && ubicacionUsuario && !(tieneCoords(a) && distanciaKm(ubicacionUsuario, a) <= radio)) return false;
    if (limitesZona && !(tieneCoords(a) && limitesZona.contains([a.lat, a.lng]))) return false;
    return true;
  });

  const dist = a => (ubicacionUsuario && tieneCoords(a)) ? distanciaKm(ubicacionUsuario, a) : Infinity;
  if (orden === "recientes") lista.sort((a, b) => b.fecha - a.fecha);
  else if (orden === "cercanos") lista.sort((a, b) => dist(a) - dist(b));
  else if (orden === "precio-asc") lista.sort((a, b) => (extraerPrecio(a.precio) ?? Infinity) - (extraerPrecio(b.precio) ?? Infinity));
  else if (orden === "precio-desc") lista.sort((a, b) => (extraerPrecio(b.precio) ?? 0) - (extraerPrecio(a.precio) ?? 0));
  else if (orden === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  listaFiltrada = lista;
  paginaActual = 1;
  renderizarLista();
  renderizarMarcadores(ajustarMapa && !limitesZona);
  if (usuarioActual) renderizarMisAnuncios();
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
  limitesZona = null;
  $("btn-quitar-zona").classList.add("hidden");
  marcarCategoriaActiva();
  actualizarCiudadesFiltro();
}

// =====================================================================
// LISTA DE TARJETAS (con paginación)
// =====================================================================
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

// Se llama cada vez que alguien entra o sale: repinta todo lo que depende de la sesión.
function alCambiarSesion() {
  actualizarUIAuth();
  refrescarCorazones();
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

function actualizarUIAuth() {
  const btn = $("btn-auth");
  if (usuarioActual) {
    btn.textContent = usuarioActual.nombre.split(" ")[0];
    btn.removeAttribute("data-abrir");            // con sesión, el botón lleva a "Mis anuncios"
    $("seccion-mis-anuncios").classList.remove("hidden");
    $("link-favoritos").classList.remove("hidden");
    renderizarMisAnuncios();
  } else {
    btn.textContent = "Iniciar sesión";
    btn.setAttribute("data-abrir", "modal-auth");
    $("seccion-mis-anuncios").classList.add("hidden");
    $("link-favoritos").classList.add("hidden");
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
  return true;
}

function resetFormulario() {
  $("formulario-registro").reset();
  pinManual = false; geoSeq++; avisoGeo(null);
  ubicacionExactaCargada = null;
  $("form-aprox").disabled = false; $("form-aprox-nota").classList.add("hidden");
  fotosForm = [];
  renderizarFotosForm();
  coordsForm = ubicacionUsuario ? { ...ubicacionUsuario }
    : (mapa ? { lat: mapa.getCenter().lat, lng: mapa.getCenter().lng } : { ...CENTRO_DEFECTO });
  $("publicar-titulo").textContent = "🚀 Publica tu anuncio";
  $("btn-submit-anuncio").textContent = "⚡ Publicar";
  actualizarCiudadesForm();
}

// La ciudad es una LISTA CERRADA (tabla `municipios`): así "envigado" y "Envigado"
// nunca cuentan como lugares distintos. Si la suya no está, "Mi ciudad no está" la
// manda a la lista de espera para saber a dónde expandirse.
function actualizarCiudadesForm() {
  const depto = $("form-departamento").value;
  $("form-ciudad").innerHTML =
    '<option value="">Elige tu ciudad…</option>' +
    (DEPARTAMENTOS[depto] || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("") +
    '<option value="__otra">Mi ciudad no está en la lista…</option>';
}

function alElegirCiudadForm(e) {
  if (e.target.value === "__otra") {
    e.target.value = "";
    abrirModal("modal-espera");
    return;
  }
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
  const ciudad = $("form-ciudad").value;
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
        pinManual = false;
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
  const precio = extraerPrecio($("form-precio").value);
  if (precio !== null && precio > 99999999999) { mostrarToast("El precio es demasiado alto", "error"); irAPaso(1); return; }

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
      estado: $("form-estado").value,
      departamento: $("form-departamento").value,
      ciudad: $("form-ciudad").value,
      barrio: $("form-barrio").value.trim(),
      lat: coordsForm.lat,
      lng: coordsForm.lng,
      aprox: $("form-aprox").checked,
      exactaOriginal: ubicacionExactaCargada,
      whatsapp: "57" + $("form-whatsapp").value.replace(/\D/g, ""),
      precio,                                   // número o null; se muestra siempre como "$1.200.000"
      desc: $("form-descripcion").value.trim(),
      fotos: [...fotosForm]
    }, previo ? previo.id : null);
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
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
  marcarCategoriaActiva();
  refrescarOpcionesUbicacion();
  aplicarFiltros();
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
  $("form-precio").value = extraerPrecio(a.precio) || "";
  $("form-departamento").value = a.departamento || Object.keys(DEPARTAMENTOS)[0];
  actualizarCiudadesForm();
  $("form-ciudad").value = a.ciudad || "";
  $("form-barrio").value = a.barrio || "";
  $("form-whatsapp").value = (a.whatsapp || "").replace(/^57/, "");
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
function activarModoEditor() {
  $("ebar").classList.toggle("hidden", !EDITOR);
  if (EDITOR) $("ecount").textContent = " · " + baseDatosAnuncios.length + " anuncios activos";
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
    marcarCategoriaActiva();
    aplicarFiltros();
  });

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
  $("btn-zona").addEventListener("click", buscarEnZona);
  $("chk-comercios").addEventListener("change", pintarComercios);
  $("btn-quitar-zona").addEventListener("click", quitarZona);

  // Auth
  $("form-auth").addEventListener("submit", manejarAuth);
  $("auth-switch-btn").addEventListener("click", cambiarModoAuth);
  $("auth-olvido").addEventListener("click", olvidePassword);
  $("btn-cerrar-sesion").addEventListener("click", cerrarSesion);
  $("form-nueva-password").addEventListener("submit", guardarNuevaPassword);
  $("btn-auth").addEventListener("click", () => {
    if (usuarioActual) $("seccion-mis-anuncios").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.addEventListener("sesion:cambio", alCambiarSesion);          // sesión cambió en otra pestaña
  document.addEventListener("sesion:recuperar", () => abrirModal("modal-nueva-password")); // llegó por el enlace del correo

  // Lista de espera ("Mi ciudad no está")
  $("form-espera").addEventListener("submit", enviarListaEspera);
  $("form-ciudad").addEventListener("change", alElegirCiudadForm);

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
  $("form-whatsapp").addEventListener("input", e => {
    let d = e.target.value.replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("57")) d = d.slice(2);
    e.target.value = d.slice(0, 10);
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
  renderizarCategorias();
  iniciarMapa();
  iniciarEventos();

  // 2) Datos reales desde Supabase
  await cargarDatos();

  // El formulario de publicar ofrece TODOS los municipios; el filtro solo los que tienen anuncios.
  Object.keys(DEPARTAMENTOS).forEach(d => $("form-departamento").add(new Option(d, d)));
  refrescarOpcionesUbicacion();
  actualizarCiudadesForm();
  actualizarUIAuth();
  await cargarFavoritos();           // si falla (p. ej. aún no existe la tabla) la lista sigue funcionando
  aplicarFiltros();
  activarModoEditor();
  // Los comercios cargan aparte: si fallan, los anuncios siguen funcionando.
  cargarComercios().then(pintarComercios);

  // Enlace "#login" (lo usan las otras páginas para pedir que inicies sesión)
  if (location.hash === "#login" && !usuarioActual) abrirModal("modal-auth");
});
