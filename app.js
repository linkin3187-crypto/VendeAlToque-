// ===== MercaFree - Lógica principal =====

let mapa = null;
let grupoMarcadores = null;
let categoriaFiltroActiva = "todos";
let imagenActualBase64 = null;
let modoAuth = "login";
let anuncioExpandido = null;
const EDITOR = /[?&]editar=1/.test(location.search);
let marcadorUsuario = null;
let mapaFormulario = null;
let marcadorFormulario = null;

// ---------- Utilidades ----------
function $(id) { return document.getElementById(id); }

function toggleModal(id) {
  $(id).classList.toggle("hidden");
}

function mostrarToast(msg) {
  const t = document.createElement("div");
  t.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-[200] font-medium";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function extraerPrecio(t) {
  if (!t) return null;
  const n = String(t).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : null;
}

// ---------- Mapa ----------
function iconoMarcador(categoria) {
  const emoji = (typeof iconosCategoria !== "undefined" && iconosCategoria[categoria]) ? iconosCategoria[categoria] : "📍";
  return L.divIcon({
    className: "marcador-cat",
    html: `<div class="pin-mapa"><span>${emoji}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34]
  });
}

function iconoUsuario() {
  return L.divIcon({
    className: "marcador-user",
    html: `<div class="pin-usuario"><span>📍</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function urlGoogleMaps(lat, lng, nombre) {
  const dest = lat + "," + lng;
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dest) + (nombre ? "&destination_place_id=" : "");
}

function iniciarMapa() {
  const mapDiv = $("map");
  if (!mapDiv) return;

  mapa = L.map("map", { center: [6.1759, -75.5917], zoom: 13 });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(mapa);

  grupoMarcadores = L.layerGroup().addTo(mapa);

  setTimeout(() => mapa.invalidateSize(true), 150);
  setTimeout(() => mapa.invalidateSize(true), 500);

  // Ubicación del usuario que está viendo la página
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        $("form-lat").value = lat;
        $("form-lng").value = lng;
        if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
        marcadorUsuario = L.marker([lat, lng], { icon: iconoUsuario(), zIndexOffset: 1000 })
          .bindPopup("<b>📍 Estás aquí</b>")
          .addTo(mapa);
        mapa.setView([lat, lng], 14);
        mapa.invalidateSize(true);
        const btn = $("btn-mi-ubicacion");
        if (btn) btn.classList.add("ring-2", "ring-yellow-300");
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }
}

function centrarEnMiUbicacion() {
  if (!navigator.geolocation) {
    alert("Tu navegador no permite geolocalización");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
      marcadorUsuario = L.marker([lat, lng], { icon: iconoUsuario(), zIndexOffset: 1000 })
        .bindPopup("<b>📍 Estás aquí</b>")
        .addTo(mapa);
      mapa.setView([lat, lng], 15);
      $("form-lat").value = lat;
      $("form-lng").value = lng;
      mostrarToast("Ubicación actualizada");
    },
    () => alert("No se pudo obtener tu ubicación. Revisa los permisos del navegador."),
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

// ---------- Auth ----------
function cambiarModoAuth() {
  modoAuth = modoAuth === "login" ? "registro" : "login";
  if (modoAuth === "registro") {
    $("auth-titulo").textContent = "Crear cuenta";
    $("auth-subtitulo").textContent = "Regístrate para gestionar tus anuncios";
    $("campo-nombre").classList.remove("hidden");
    $("auth-switch-text").textContent = "¿Ya tienes cuenta?";
    $("auth-switch-btn").textContent = "Inicia sesión";
  } else {
    $("auth-titulo").textContent = "Iniciar sesión";
    $("auth-subtitulo").textContent = "Accede para gestionar tus anuncios";
    $("campo-nombre").classList.add("hidden");
    $("auth-switch-text").textContent = "¿No tienes cuenta?";
    $("auth-switch-btn").textContent = "Regístrate";
  }
}

function manejarAuth(e) {
  e.preventDefault();
  const email = $("auth-email").value.trim().toLowerCase();
  const password = $("auth-password").value;
  const nombre = $("auth-nombre").value.trim();
  let usuarios = JSON.parse(localStorage.getItem("mercafree_usuarios") || "[]");

  if (modoAuth === "registro") {
    if (usuarios.find(u => u.email === email)) {
      alert("Este correo ya está registrado");
      return;
    }
    const nuevo = { id: Date.now(), nombre: nombre || email.split("@")[0], email, password };
    usuarios.push(nuevo);
    localStorage.setItem("mercafree_usuarios", JSON.stringify(usuarios));
    guardarUsuario(nuevo);
    mostrarToast("✅ Cuenta creada");
  } else {
    const user = usuarios.find(u => u.email === email && u.password === password);
    if (!user) {
      alert("Correo o contraseña incorrectos");
      return;
    }
    guardarUsuario(user);
    mostrarToast("✅ Bienvenido");
  }
  toggleModal("modal-auth");
  actualizarUIAuth();
  aplicarFiltros();
}

function cerrarSesion() {
  guardarUsuario(null);
  actualizarUIAuth();
  aplicarFiltros();
  mostrarToast("Sesión cerrada");
}

function actualizarUIAuth() {
  const btn = $("btn-auth");
  const seccion = $("seccion-mis-anuncios");
  if (usuarioActual) {
    btn.textContent = usuarioActual.nombre.split(" ")[0];
    seccion.classList.remove("hidden");
    renderizarMisAnuncios();
  } else {
    btn.textContent = "Iniciar sesión";
    seccion.classList.add("hidden");
  }
}

function renderizarMisAnuncios() {
  const cont = $("lista-mis-anuncios");
  const mis = baseDatosAnuncios.filter(a => a.owner === usuarioActual.id);
  if (mis.length === 0) {
    cont.innerHTML = '<p class="text-sm text-slate-500">Aún no tienes anuncios.</p>';
    return;
  }
  cont.innerHTML = mis.map(a =>
    `<div class="flex justify-between items-center bg-white rounded-lg px-3 py-2 border">
      <span class="text-sm font-medium truncate">${a.nombre}</span>
      <div class="flex gap-2">
        <button onclick="editarAnuncio(${a.id})" class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Editar</button>
        <button onclick="eliminarAnuncio(${a.id})" class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Eliminar</button>
      </div>
    </div>`
  ).join("");
}

// ---------- Filtros ----------
function toggleFiltrosAvanzados() {
  $("panel-filtros").classList.toggle("hidden");
}

function filtrarCategoria(cat) {
  categoriaFiltroActiva = cat;
  document.querySelectorAll(".categoria-btn").forEach(btn => {
    btn.classList.remove("bg-white", "text-indigo-700", "shadow-sm");
    btn.classList.add("bg-white/15");
  });
  if (typeof event !== "undefined" && event.currentTarget) {
    event.currentTarget.classList.remove("bg-white/15");
    event.currentTarget.classList.add("bg-white", "text-indigo-700", "shadow-sm");
  }
  aplicarFiltros();
}

function actualizarCiudades() {
  const depto = $("filtro-departamento").value;
  const selectCiudad = $("filtro-ciudad");
  selectCiudad.innerHTML = '<option value="">Todas las ciudades</option>';
  if (depto && DEPARTAMENTOS[depto]) {
    DEPARTAMENTOS[depto].forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selectCiudad.appendChild(opt);
    });
  }
  aplicarFiltros();
}

function aplicarFiltros() {
  if (!grupoMarcadores) return;

  const texto = $("buscador").value.toLowerCase().trim();
  const pMin = parseInt($("filtro-precio-min").value) || 0;
  const pMax = parseInt($("filtro-precio-max").value) || Infinity;
  const soloFoto = $("filtro-con-foto").checked;
  const soloPrecio = $("filtro-con-precio").checked;
  const estado = $("filtro-estado").value;
  const departamento = $("filtro-departamento").value;
  const ciudad = $("filtro-ciudad").value;
  const orden = $("ordenar-por").value;

  let lista = baseDatosAnuncios.filter(a => {
    const catOk = categoriaFiltroActiva === "todos" || a.categoria === categoriaFiltroActiva;
    const txtOk = a.nombre.toLowerCase().includes(texto) ||
                  (a.desc || "").toLowerCase().includes(texto) ||
                  (a.barrio || "").toLowerCase().includes(texto) ||
                  (a.ciudad || "").toLowerCase().includes(texto);
    const precioNum = extraerPrecio(a.precio);
    const precioOk = (!precioNum && pMin === 0 && pMax === Infinity) ||
                     (precioNum && precioNum >= pMin && precioNum <= pMax);
    const fotoOk = !soloFoto || (a.imagen && a.imagen.length > 5);
    const precioSoloOk = !soloPrecio || (a.precio && a.precio.length > 0);
    const estadoOk = !estado || a.estado === estado;
    const deptoOk = !departamento || a.departamento === departamento;
    const ciudadOk = !ciudad || a.ciudad === ciudad;
    return catOk && txtOk && precioOk && fotoOk && precioSoloOk && estadoOk && deptoOk && ciudadOk;
  });

  if (orden === "recientes") lista.sort((a, b) => (b.fecha || b.id) - (a.fecha || a.id));
  else if (orden === "precio-asc") lista.sort((a, b) => (extraerPrecio(a.precio) || Infinity) - (extraerPrecio(b.precio) || Infinity));
  else if (orden === "precio-desc") lista.sort((a, b) => (extraerPrecio(b.precio) || 0) - (extraerPrecio(a.precio) || 0));
  else if (orden === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre));

  renderizarAnuncios(lista);
  if (usuarioActual) renderizarMisAnuncios();
}

// ---------- Render ----------
function toggleDetalle(id) {
  const el = document.getElementById("detalle-" + id);
  if (!el) return;
  const estabaAbierto = el.classList.contains("abierto");
  document.querySelectorAll(".detalle-anuncio").forEach(d => d.classList.remove("abierto"));
  if (!estabaAbierto) el.classList.add("abierto");
}

function renderizarAnuncios(lista) {
  const cont = $("contenedor-anuncios");
  const vacio = $("estado-vacio");
  const contador = $("contador-resultados");

  if (grupoMarcadores) grupoMarcadores.clearLayers();

  contador.textContent = lista.length + (lista.length === 1 ? " resultado" : " resultados");

  if (lista.length === 0) {
    cont.innerHTML = "";
    vacio.classList.remove("hidden");
    return;
  }
  vacio.classList.add("hidden");

  cont.innerHTML = lista.map(a => {
    const tieneImg = a.imagen && a.imagen.length > 5;
    const icono = iconosCategoria[a.categoria] || "📦";
    const badgeEstado = a.estado === "nuevo"
      ? '<span class="badge-nuevo text-xs font-semibold px-2 py-0.5 rounded-full">Nuevo</span>'
      : a.estado === "usado"
        ? '<span class="badge-usado text-xs font-semibold px-2 py-0.5 rounded-full">Usado</span>'
        : "";

    let imgHtml = "";
    if (tieneImg) {
      imgHtml = `<div class="relative h-40 overflow-hidden bg-slate-100">
        <img src="${a.imagen}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'">
        ${a.precio ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg">${a.precio}</div>` : ""}
      </div>`;
    } else {
      imgHtml = `<div class="h-24 bg-slate-100 flex items-center justify-center relative">
        <span class="text-4xl">${icono}</span>
        ${a.precio ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-lg">${a.precio}</div>` : ""}
      </div>`;
    }

    return `<article class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      ${imgHtml}
      <div class="p-4 flex flex-col flex-1">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${a.ciudad || a.barrio || ""}</span>
          ${badgeEstado}
        </div>
        <h3 class="font-bold text-slate-900 mb-1 line-clamp-2">${a.nombre}</h3>
        <p class="text-sm text-slate-600 line-clamp-2 mb-3 flex-1">${a.desc || ""}</p>
        
        <button onclick="toggleDetalle(${a.id})" class="text-sm text-indigo-600 font-medium mb-2 text-left hover:underline">
          Ver más detalles ▾
        </button>
        
        <div id="detalle-${a.id}" class="detalle-anuncio text-sm text-slate-600 space-y-1 mb-3">
          <p><strong>📍 Ubicación:</strong> ${a.barrio || ""}${a.ciudad ? ", " + a.ciudad : ""}${a.departamento ? " (" + a.departamento + ")" : ""}</p>
          ${a.precio ? `<p><strong>💰 Precio:</strong> ${a.precio}</p>` : ""}
          <p><strong>📱 WhatsApp:</strong> ${a.whatsapp ? a.whatsapp.replace(/^57/, "") : "No disponible"}</p>
          <p><strong>📝 Descripción:</strong> ${a.desc || "Sin descripción"}</p>
          <p><strong>🏷️ Categoría:</strong> ${a.categoria || ""} · <strong>Estado:</strong> ${a.estado || "—"}</p>
          ${a.lat && a.lng ? `<a href="${urlGoogleMaps(a.lat, a.lng, a.nombre)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-blue-600 hover:underline">🗺️ Cómo llegar (Google Maps)</a>` : ""}
        </div>
        
        <div class="flex gap-2">
          <a href="https://wa.me/${a.whatsapp}" target="_blank" class="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl text-center">WhatsApp</a>
          ${a.lat && a.lng ? `<a href="${urlGoogleMaps(a.lat, a.lng, a.nombre)}" target="_blank" rel="noopener" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl text-center">🗺️ Cómo llegar</a>` : ""}
        </div>
        ${EDITOR ? `<div class="flex gap-2 mt-2">
          <button onclick="editarAnuncio(${a.id})" class="flex-1 text-xs bg-indigo-100 text-indigo-700 font-semibold py-2 rounded-lg">✏️ Editar</button>
          <button onclick="eliminarAnuncioAdmin(${a.id})" class="flex-1 text-xs bg-red-100 text-red-600 font-semibold py-2 rounded-lg">🗑️ Eliminar</button>
        </div>` : ""}
      </div>
    </article>`;
  }).join("");

  // Marcadores con iconos por categoría
  if (grupoMarcadores) {
    lista.forEach(a => {
      if (!a.lat || !a.lng) return;
      let popup = `<div style="min-width:200px;font-family:sans-serif">`;
      if (a.imagen) popup += `<img src="${a.imagen}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px" onerror="this.style.display='none'">`;
      popup += `<strong>${a.nombre}</strong><br>`;
      popup += `<small style="color:#666">${a.ciudad || a.barrio || ""}</small><br>`;
      if (a.precio) popup += `<span style="color:#4f46e5;font-weight:600">${a.precio}</span><br>`;
      if (a.estado) popup += `<span style="font-size:12px">${a.estado === "nuevo" ? "🆕 Nuevo" : "Usado"}</span><br>`;
      popup += `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">`;
      popup += `<a href="https://wa.me/${a.whatsapp}" target="_blank" style="background:#22c55e;color:white;padding:5px 10px;border-radius:6px;font-size:12px;text-decoration:none">WhatsApp</a>`;
      popup += `<a href="${urlGoogleMaps(a.lat, a.lng, a.nombre)}" target="_blank" rel="noopener" style="background:#3b82f6;color:white;padding:5px 10px;border-radius:6px;font-size:12px;text-decoration:none">🗺️ Cómo llegar</a>`;
      popup += `</div></div>`;
      L.marker([a.lat, a.lng], { icon: iconoMarcador(a.categoria) }).bindPopup(popup).addTo(grupoMarcadores);
    });
  }
}

// ---------- Publicar / Editar ----------
function registrarAnuncio(e) {
  e.preventDefault();
  const idEdit = $("form-edit-id").value;

  const anuncio = {
    id: idEdit ? parseInt(idEdit) : Date.now(),
    nombre: $("form-nombre").value.trim(),
    categoria: $("form-categoria").value,
    estado: $("form-estado").value,
    departamento: $("form-departamento").value,
    ciudad: $("form-ciudad").value.trim(),
    barrio: $("form-barrio").value.trim(),
    lat: parseFloat($("form-lat").value) || 6.1759,
    lng: parseFloat($("form-lng").value) || -75.5917,
    whatsapp: "57" + $("form-whatsapp").value.replace(/\D/g, ""),
    precio: $("form-precio").value.trim(),
    desc: $("form-descripcion").value.trim(),
    imagen: imagenActualBase64 || $("form-imagen-base64").value || "",
    owner: usuarioActual ? usuarioActual.id : null,
    fecha: Date.now()
  };

  if (idEdit) {
    const idx = baseDatosAnuncios.findIndex(a => a.id === parseInt(idEdit));
    if (idx !== -1) baseDatosAnuncios[idx] = anuncio;
    mostrarToast("✅ Anuncio actualizado");
  } else {
    baseDatosAnuncios.unshift(anuncio);
    mostrarToast("✅ ¡Anuncio publicado!");
  }

  guardarAnuncios();
  $("formulario-registro").reset();
  $("form-edit-id").value = "";
  $("form-lat").value = "6.1759";
  $("form-lng").value = "-75.5917";
  quitarFoto();
  $("btn-submit-anuncio").innerHTML = "⚡ Publicar Enseguida";
  toggleModal("modal-publicar");
  aplicarFiltros();
}

function editarAnuncio(id) {
  const a = baseDatosAnuncios.find(x => x.id === id);
  if (!a) return;
  $("form-nombre").value = a.nombre;
  $("form-categoria").value = a.categoria;
  $("form-estado").value = a.estado || "usado";
  $("form-departamento").value = a.departamento || "Antioquia";
  actualizarCiudadesForm();
  $("form-ciudad").value = a.ciudad || "";
  $("form-barrio").value = a.barrio || "";
  $("form-whatsapp").value = (a.whatsapp || "").replace(/^57/, "");
  $("form-precio").value = a.precio || "";
  $("form-descripcion").value = a.desc || "";
  $("form-edit-id").value = a.id;
  if (a.imagen) {
    imagenActualBase64 = a.imagen;
    $("form-imagen-base64").value = a.imagen;
    $("preview-imagen").src = a.imagen;
    $("preview-imagen").classList.remove("hidden");
    $("placeholder-foto").classList.add("hidden");
    $("btn-quitar-foto").classList.remove("hidden");
  }
  $("btn-submit-anuncio").innerHTML = "💾 Guardar cambios";
  toggleModal("modal-publicar");
}

function eliminarAnuncio(id) {
  if (!confirm("¿Eliminar este anuncio?")) return;
  baseDatosAnuncios = baseDatosAnuncios.filter(a => a.id !== id);
  guardarAnuncios();
  aplicarFiltros();
  mostrarToast("Anuncio eliminado");
}

function actualizarCiudadesForm() {
  const depto = $("form-departamento").value;
  const select = $("form-ciudad");
  // Para el formulario usamos un input de texto libre + datalist opcional
  // Aquí solo actualizamos el valor por defecto si es necesario
}

// ---------- Foto ----------
function comprimirImagen(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > 800) { h = Math.round(h * 800 / w); w = 800; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function previsualizarFoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const base64 = await comprimirImagen(file);
    imagenActualBase64 = base64;
    $("form-imagen-base64").value = base64;
    $("preview-imagen").src = base64;
    $("preview-imagen").classList.remove("hidden");
    $("placeholder-foto").classList.add("hidden");
    $("btn-quitar-foto").classList.remove("hidden");
  } catch (err) {
    alert("Error al procesar la imagen");
  }
}

function quitarFoto() {
  imagenActualBase64 = null;
  $("form-imagen-base64").value = "";
  $("form-foto").value = "";
  $("preview-imagen").classList.add("hidden");
  $("preview-imagen").src = "";
  $("placeholder-foto").classList.remove("hidden");
  $("btn-quitar-foto").classList.add("hidden");
}

// ---------- Inicio ----------
window.addEventListener("load", () => {
  cargarDatos();
  iniciarMapa();
  actualizarUIAuth();

  // Llenar select de departamentos
  const selDepto = $("filtro-departamento");
  const selFormDepto = $("form-departamento");
  Object.keys(DEPARTAMENTOS).forEach(d => {
    const o1 = document.createElement("option");
    o1.value = d; o1.textContent = d;
    selDepto.appendChild(o1);
    const o2 = document.createElement("option");
    o2.value = d; o2.textContent = d;
    selFormDepto.appendChild(o2);
  });

  setTimeout(() => aplicarFiltros(), 300);
});


// ---------- Mapa del formulario (elegir ubicación) ----------
function iniciarMapaFormulario() {
  const div = $("map-formulario");
  if (!div) return;
  const lat = parseFloat($("form-lat").value) || 6.1759;
  const lng = parseFloat($("form-lng").value) || -75.5917;

  if (mapaFormulario) {
    mapaFormulario.remove();
    mapaFormulario = null;
    marcadorFormulario = null;
  }

  mapaFormulario = L.map("map-formulario").setView([lat, lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapaFormulario);

  marcadorFormulario = L.marker([lat, lng], { draggable: true, icon: iconoMarcador($("form-categoria").value) }).addTo(mapaFormulario);
  marcadorFormulario.on("dragend", function() {
    const p = marcadorFormulario.getLatLng();
    $("form-lat").value = p.lat.toFixed(6);
    $("form-lng").value = p.lng.toFixed(6);
    $("form-coords-label").textContent = p.lat.toFixed(5) + ", " + p.lng.toFixed(5);
  });

  mapaFormulario.on("click", function(e) {
    marcadorFormulario.setLatLng(e.latlng);
    $("form-lat").value = e.latlng.lat.toFixed(6);
    $("form-lng").value = e.latlng.lng.toFixed(6);
    $("form-coords-label").textContent = e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5);
  });

  setTimeout(function() { mapaFormulario.invalidateSize(true); }, 200);
  setTimeout(function() { mapaFormulario.invalidateSize(true); }, 500);
}

function usarMiUbicacionFormulario() {
  if (!navigator.geolocation) {
    alert("Geolocalización no disponible");
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    $("form-lat").value = lat.toFixed(6);
    $("form-lng").value = lng.toFixed(6);
    $("form-coords-label").textContent = lat.toFixed(5) + ", " + lng.toFixed(5);
    if (mapaFormulario && marcadorFormulario) {
      marcadorFormulario.setLatLng([lat, lng]);
      mapaFormulario.setView([lat, lng], 16);
    }
    mostrarToast("Ubicación tomada");
  }, function() {
    alert("No se pudo obtener tu ubicación");
  }, { enableHighAccuracy: true, timeout: 12000 });
}

// Sobrescribir toggleModal para inicializar mapa del form al abrir publicar
const _toggleModalOriginal = toggleModal;
toggleModal = function(id) {
  _toggleModalOriginal(id);
  if (id === "modal-publicar") {
    const modal = $(id);
    if (modal && !modal.classList.contains("hidden")) {
      setTimeout(iniciarMapaFormulario, 250);
    }
  }
};

function eliminarAnuncioAdmin(id) {
  if (!EDITOR) return;
  if (!confirm("¿Eliminar este anuncio de forma permanente?")) return;
  baseDatosAnuncios = baseDatosAnuncios.filter(a => a.id !== id);
  guardarAnuncios();
  aplicarFiltros();
  mostrarToast("Anuncio eliminado");
}

function activarModoEditor() {
  if (!EDITOR) return;
  const bar = $("ebar");
  if (bar) {
    bar.classList.remove("hidden");
    const n = baseDatosAnuncios.length;
    const c = $("ecount");
    if (c) c.textContent = " · " + n + " anuncios en total";
  }
  // Mostrar enlace para salir
  const link = $("elink");
  if (link) {
    link.href = location.pathname;
    link.textContent = "Salir del modo editor";
  }
  const wrap = $("elinkw");
  if (wrap) wrap.classList.remove("hidden");
}

// Hook al load existente
const _loadOriginal = window.onload;
window.addEventListener("load", () => {
  setTimeout(activarModoEditor, 400);
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    $("modal-publicar").classList.add("hidden");
    $("modal-auth").classList.add("hidden");
  }
});
