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
    ${a.precio ? `<div class="font-semibold text-indigo-600">${esc(a.precio)}</div>` : ""}
    <div class="flex flex-wrap gap-1.5 mt-2">
      <a href="anuncio.html?id=${a.id}" class="bg-indigo-600 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">Ver anuncio</a>
      <a href="${esc(urlWhatsApp(a.whatsapp, a.nombre))}" target="_blank" rel="noopener" class="bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">WhatsApp</a>
      <a href="${esc(urlGoogleMaps(a.lat, a.lng))}" target="_blank" rel="noopener" class="bg-blue-500 text-white text-xs px-2.5 py-1.5 rounded-md no-underline">Cómo llegar</a>
    </div>
  </div>`;
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
function actualizarCiudadesFiltro() {
  const depto = $("filtro-departamento").value;
  const sel = $("filtro-ciudad");
  sel.innerHTML = '<option value="">Todas las ciudades</option>';
  (DEPARTAMENTOS[depto] || []).forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
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
  return `<article id="tarjeta-${a.id}" data-id="${a.id}" class="tarjeta-anuncio bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
    <a href="anuncio.html?id=${a.id}" class="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center" aria-label="Ver ${esc(a.nombre)}">
      <span class="text-5xl">${icono}</span>
      ${foto ? `<img src="${esc(foto)}" alt="${esc(a.nombre)}" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover">` : ""}
      ${a.precio ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow">${esc(a.precio)}</div>` : ""}
    </a>
    <div class="p-4 flex flex-col flex-1">
      <div class="flex items-center gap-2 mb-1 flex-wrap">
        <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${esc(a.ciudad || a.barrio || "")}</span>
        ${badgeEstado}
        ${km !== null ? `<span class="text-xs text-slate-400">${km < 1 ? "a " + Math.round(km * 1000) + " m" : "a " + km.toFixed(1) + " km"}</span>` : ""}
      </div>
      <h3 class="font-bold text-slate-900 mb-1 line-clamp-2"><a href="anuncio.html?id=${a.id}" class="hover:text-indigo-600">${esc(a.nombre)}</a></h3>
      <p class="text-sm text-slate-600 line-clamp-2 mb-3 flex-1">${esc(a.desc || "")}</p>
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

  cont.innerHTML = visibles.map(tarjetaHTML).join("");

  const restantes = total - visibles.length;
  $("contenedor-mas").classList.toggle("hidden", restantes <= 0);
  if (restantes > 0) $("btn-mas").textContent = `Mostrar más (${restantes} restantes)`;
}

// =====================================================================
// AUTENTICACIÓN (provisional, solo en este navegador)
// =====================================================================
// HONESTIDAD: esto sigue siendo "de juguete". Cualquiera con las herramientas
// del navegador puede ver/editar localStorage. Lo que mejoramos: ya NO se
// guarda la contraseña en texto plano (se guarda un hash con sal). La
// autenticación de verdad (servidor, sesiones, recuperar contraseña) llega con Supabase.
async function hashPassword(password, salt) {
  if (!window.crypto || !crypto.subtle) throw new Error("Tu navegador necesita HTTPS para proteger la contraseña.");
  const datos = new TextEncoder().encode(salt + password);
  const buf = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function nuevaSal() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
}

function leerUsuarios() {
  try { return JSON.parse(localStorage.getItem("mercafree_usuarios") || "[]"); }
  catch (e) { return []; }
}

function cambiarModoAuth() {
  modoAuth = modoAuth === "login" ? "registro" : "login";
  const reg = modoAuth === "registro";
  $("auth-titulo").textContent = reg ? "Crear cuenta" : "Iniciar sesión";
  $("auth-subtitulo").textContent = reg ? "Regístrate para gestionar tus anuncios" : "Accede para gestionar tus anuncios";
  $("campo-nombre").classList.toggle("hidden", !reg);
  $("auth-switch-text").textContent = reg ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
  $("auth-switch-btn").textContent = reg ? "Inicia sesión" : "Regístrate";
  $("auth-password").autocomplete = reg ? "new-password" : "current-password";
}

async function manejarAuth(e) {
  e.preventDefault();
  const email = $("auth-email").value.trim().toLowerCase();
  const password = $("auth-password").value;
  const nombre = $("auth-nombre").value.trim();
  const usuarios = leerUsuarios();

  try {
    if (modoAuth === "registro") {
      if (usuarios.some(u => u.email === email)) { mostrarToast("Este correo ya está registrado", "error"); return; }
      const salt = nuevaSal();
      const nuevo = { id: Date.now(), nombre: nombre || email.split("@")[0], email, salt, hash: await hashPassword(password, salt) };
      usuarios.push(nuevo);
      localStorage.setItem("mercafree_usuarios", JSON.stringify(usuarios));
      guardarUsuario({ id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email }); // sin hash en la sesión
      mostrarToast("✅ Cuenta creada");
    } else {
      const u = usuarios.find(x => x.email === email);
      let ok = false;
      if (u && u.hash) {
        ok = (await hashPassword(password, u.salt)) === u.hash;
      } else if (u && u.password === password) {
        // cuenta vieja con contraseña en texto plano → la convertimos a hash ahora
        u.salt = nuevaSal(); u.hash = await hashPassword(password, u.salt); delete u.password;
        localStorage.setItem("mercafree_usuarios", JSON.stringify(usuarios));
        ok = true;
      }
      if (!ok) { mostrarToast("Correo o contraseña incorrectos", "error"); return; }
      guardarUsuario({ id: u.id, nombre: u.nombre, email: u.email });
      mostrarToast("✅ Bienvenido");
    }
  } catch (err) {
    mostrarToast(err.message || "No se pudo iniciar sesión", "error");
    return;
  }
  $("form-auth").reset();
  cerrarModal("modal-auth");
  actualizarUIAuth();
  aplicarFiltros({ ajustarMapa: false });
}

function cerrarSesion() {
  guardarUsuario(null);
  actualizarUIAuth();
  mostrarToast("Sesión cerrada");
}

function actualizarUIAuth() {
  if (usuarioActual) {
    $("btn-auth").textContent = usuarioActual.nombre.split(" ")[0];
    $("seccion-mis-anuncios").classList.remove("hidden");
    renderizarMisAnuncios();
  } else {
    $("btn-auth").textContent = "Iniciar sesión";
    $("seccion-mis-anuncios").classList.add("hidden");
  }
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
  fotosForm = [];
  renderizarFotosForm();
  coordsForm = ubicacionUsuario ? { ...ubicacionUsuario }
    : (mapa ? { lat: mapa.getCenter().lat, lng: mapa.getCenter().lng } : { ...CENTRO_DEFECTO });
  $("publicar-titulo").textContent = "🚀 Publica tu anuncio";
  $("btn-submit-anuncio").textContent = "⚡ Publicar";
  actualizarCiudadesForm();
}

function actualizarCiudadesForm() {
  const depto = $("form-departamento").value;
  $("lista-ciudades").innerHTML = (DEPARTAMENTOS[depto] || []).map(c => `<option value="${esc(c)}">`).join("");
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
    marcadorFormulario.on("dragend", () => fijarCoordsForm(marcadorFormulario.getLatLng()));
    mapaFormulario.on("click", e => { marcadorFormulario.setLatLng(e.latlng); fijarCoordsForm(e.latlng); });
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

// ---------- Fotos ----------
// Reduce la foto a máx. 800 px y la comprime a JPEG: una foto de celular de
// 4 MB queda en ~80 KB. Imprescindible mientras guardemos en localStorage.
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
function registrarAnuncio(e) {
  e.preventDefault();
  if (pasoActual < NOMBRES_PASOS.length) { // Enter en un paso intermedio = "Siguiente"
    if (validarPaso(pasoActual)) irAPaso(pasoActual + 1);
    return;
  }
  for (let p = 1; p <= NOMBRES_PASOS.length; p++) {
    if (!validarPaso(p)) { irAPaso(p); validarPaso(p); return; }
  }

  const previo = modoEdicionId ? baseDatosAnuncios.find(a => a.id === modoEdicionId) : null;
  const precioNum = extraerPrecio($("form-precio").value);
  const anuncio = normalizarAnuncio({
    id: previo ? previo.id : Date.now(),
    nombre: $("form-nombre").value.trim(),
    categoria: $("form-categoria").value,
    estado: $("form-estado").value,
    departamento: $("form-departamento").value,
    ciudad: $("form-ciudad").value.trim(),
    barrio: $("form-barrio").value.trim(),
    lat: coordsForm.lat,
    lng: coordsForm.lng,
    whatsapp: "57" + $("form-whatsapp").value.replace(/\D/g, ""),
    precio: formatearPrecio(precioNum),      // siempre "$1.200.000", sin importar cómo lo escribió
    desc: $("form-descripcion").value.trim(),
    fotos: [...fotosForm],
    owner: previo ? previo.owner : (usuarioActual ? usuarioActual.id : null), // editar NO cambia al dueño
    fecha: previo ? previo.fecha : Date.now()
  });

  // Guardamos sobre una copia: si localStorage está lleno, deshacemos y avisamos.
  const copia = [...baseDatosAnuncios];
  if (previo) copia[copia.findIndex(a => a.id === previo.id)] = anuncio;
  else copia.unshift(anuncio);
  const anterior = baseDatosAnuncios;
  baseDatosAnuncios = copia;
  if (!guardarAnuncios()) { baseDatosAnuncios = anterior; return; }

  mostrarToast(previo ? "✅ Anuncio actualizado" : "✅ ¡Anuncio publicado!");
  cerrarModal("modal-publicar");
  // Quita filtros de categoría/búsqueda para que el usuario VEA su anuncio
  $("buscador").value = "";
  categoriaActiva = "todos";
  marcarCategoriaActiva();
  aplicarFiltros();
  setTimeout(() => resaltarTarjeta(anuncio.id, true), 100);
}

function editarAnuncio(id) {
  const a = baseDatosAnuncios.find(x => x.id === id);
  if (!a) return;
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
  if (tieneCoords(a)) coordsForm = { lat: a.lat, lng: a.lng };
  $("publicar-titulo").textContent = "✏️ Editar anuncio";
  $("btn-submit-anuncio").textContent = "💾 Guardar cambios";
  abrirModal("modal-publicar");
}

function eliminarAnuncio(id, esAdmin) {
  if (esAdmin && !EDITOR) return;
  if (!confirm(esAdmin ? "¿Eliminar este anuncio de forma permanente?" : "¿Eliminar este anuncio?")) return;
  const anterior = baseDatosAnuncios;
  baseDatosAnuncios = baseDatosAnuncios.filter(a => a.id !== id);
  if (!guardarAnuncios()) { baseDatosAnuncios = anterior; return; }
  aplicarFiltros({ ajustarMapa: false });
  mostrarToast("Anuncio eliminado");
}

// =====================================================================
// MODO EDITOR (provisional)
// =====================================================================
function activarModoEditor() {
  if (!EDITOR) return;
  $("ebar").classList.remove("hidden");
  $("ecount").textContent = " · " + baseDatosAnuncios.length + " anuncios en total";
  $("elink").href = location.pathname;
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
  $("btn-quitar-zona").addEventListener("click", quitarZona);

  // Auth
  $("form-auth").addEventListener("submit", manejarAuth);
  $("auth-switch-btn").addEventListener("click", cambiarModoAuth);
  $("btn-cerrar-sesion").addEventListener("click", cerrarSesion);

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

document.addEventListener("DOMContentLoaded", () => {
  cargarDatos();
  renderizarCategorias();

  Object.keys(DEPARTAMENTOS).forEach(d => {
    $("filtro-departamento").add(new Option(d, d));
    $("form-departamento").add(new Option(d, d));
  });
  actualizarCiudadesForm();

  iniciarMapa();
  iniciarEventos();
  actualizarUIAuth();
  aplicarFiltros();
  activarModoEditor();
});
