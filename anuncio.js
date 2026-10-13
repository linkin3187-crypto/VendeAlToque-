// ===== MercaFree - Página de detalle de un anuncio (anuncio.html?id=...) =====
// POR QUÉ una página propia (y no un acordeón dentro de la lista):
//  1) Cada anuncio tiene un ENLACE que se puede compartir por WhatsApp.
//  2) Más espacio para galería, mapa y datos sin romper la cuadrícula.
//  3) Es la base para el SEO: Google indexa páginas, no acordeones.

let anuncioActual = null;
let fotoActiva = 0;

async function cargarAnuncioDesdeURL() {
  await cargarDatos();   // trae municipios, sesión y anuncios desde Supabase
  const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
  return baseDatosAnuncios.find(a => a.id === id) || null;
}

function mostrarFoto(i) {
  const fotos = anuncioActual.fotos;
  fotoActiva = (i + fotos.length) % fotos.length;
  const cont = $("galeria-principal");
  const src = urlSegura(fotos[fotoActiva]);
  cont.querySelectorAll("img").forEach(im => im.remove());
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${anuncioActual.nombre} - foto ${fotoActiva + 1}`;
    img.className = "absolute inset-0 w-full h-full object-cover";
    img.addEventListener("error", () => img.remove()); // si falla, queda el icono de fondo
    cont.appendChild(img);
  }
  document.querySelectorAll(".miniatura").forEach((m, idx) =>
    m.setAttribute("aria-current", idx === fotoActiva ? "true" : "false"));
}

function renderizarGaleria(a) {
  $("galeria-icono").textContent = iconosCategoria[a.categoria] || "📦";
  const cont = $("galeria-miniaturas");
  if (a.fotos.length > 1) {
    cont.innerHTML = a.fotos.map((src, i) =>
      `<button type="button" data-foto="${i}" aria-label="Ver foto ${i + 1}" class="miniatura w-20 h-16 rounded-lg overflow-hidden">
        <img src="${esc(urlSegura(src))}" alt="" class="w-full h-full object-cover">
      </button>`).join("");
    cont.addEventListener("click", e => {
      const b = e.target.closest("[data-foto]");
      if (b) mostrarFoto(Number(b.dataset.foto));
    });
  }
  if (a.fotos.length) {
    mostrarFoto(0);
    // Flechas del teclado para cambiar de foto
    document.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") mostrarFoto(fotoActiva + 1);
      if (e.key === "ArrowLeft") mostrarFoto(fotoActiva - 1);
    });
  }
}

async function compartir() {
  const datos = { title: anuncioActual.nombre, text: `${anuncioActual.nombre} en MercaFree`, url: location.href };
  if (navigator.share) {
    try { await navigator.share(datos); } catch (e) { /* el usuario canceló */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(location.href);
    mostrarToast("🔗 Enlace copiado");
  } catch (e) {
    window.prompt("Copia el enlace:", location.href);
  }
}

function renderizarSimilares(a) {
  const origen = tieneCoords(a) ? { lat: a.lat, lng: a.lng } : null;
  const similares = baseDatosAnuncios
    .filter(x => x.id !== a.id && x.categoria === a.categoria)
    .sort((x, y) => (origen && tieneCoords(x) && tieneCoords(y))
      ? distanciaKm(origen, x) - distanciaKm(origen, y) : y.fecha - x.fecha)
    .slice(0, 4);
  if (!similares.length) return;
  $("seccion-similares").classList.remove("hidden");
  $("lista-similares").innerHTML = similares.map(s => {
    const foto = urlSegura(s.imagen);
    return `<a href="anuncio.html?id=${s.id}" class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden block hover:shadow-md">
      <div class="relative h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <span class="text-3xl">${iconosCategoria[s.categoria] || "📦"}</span>
        ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      </div>
      <div class="p-3">
        <p class="text-sm font-semibold line-clamp-2">${esc(s.nombre)}</p>
        ${s.precio ? `<p class="text-sm text-indigo-600 font-bold">${esc(s.precio)}</p>` : ""}
      </div>
    </a>`;
  }).join("");
  $("lista-similares").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
}

function renderizarAnuncio(a) {
  anuncioActual = a;
  const cat = CATEGORIAS.find(c => c.id === a.categoria) || { icono: "📦", nombre: a.categoria };

  // Título de la pestaña y descripción: útiles al compartir y para el historial.
  // (Ojo: Google y WhatsApp leen el HTML SIN ejecutar JS, así que para que la vista
  //  previa muestre el anuncio hará falta renderizar en servidor: Fase 3.)
  document.title = `${a.nombre} | MercaFree`;
  $("meta-desc").content = (a.desc || "").slice(0, 150);

  $("anuncio-titulo").textContent = a.nombre;
  $("anuncio-precio").textContent = a.precio || "Precio a convenir";
  $("anuncio-ubicacion").textContent = [a.barrio, a.ciudad, a.departamento].filter(Boolean).join(", ");
  $("anuncio-desc").textContent = a.desc || "Sin descripción";

  const badgeEstado = a.estado === "nuevo"
    ? '<span class="badge-nuevo text-xs font-semibold px-2 py-0.5 rounded-full">Nuevo</span>'
    : a.estado === "usado" ? '<span class="badge-usado text-xs font-semibold px-2 py-0.5 rounded-full">Usado</span>' : "";
  $("anuncio-badges").innerHTML =
    `<span class="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">${cat.icono} ${esc(cat.nombre)}</span>${badgeEstado}`;

  const fecha = new Date(a.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const item = (t, v) => `<div><dt class="text-xs text-slate-400">${t}</dt><dd class="font-medium">${esc(v)}</dd></div>`;
  $("anuncio-detalles").innerHTML =
    item("Categoría", cat.nombre) + item("Estado", a.estado || "—") +
    item("Barrio", a.barrio || "—") + item("Publicado", fecha);

  // El número NO se muestra en pantalla (evita que lo copien robots); solo el botón.
  $("btn-whatsapp").href = urlWhatsApp(a.whatsapp, a.nombre);
  $("btn-compartir").addEventListener("click", compartir);
  prepararReporte(a);

  renderizarGaleria(a);

  if (tieneCoords(a)) {
    $("btn-como-llegar").href = urlGoogleMaps(a.lat, a.lng);
    const mapa = crearMapaBase("map-anuncio", [a.lat, a.lng], 16, { scrollWheelZoom: false });
    L.marker([a.lat, a.lng], { icon: iconoMarcador(a.categoria) }).addTo(mapa);
  } else {
    $("btn-como-llegar").classList.add("hidden");
    $("seccion-mapa").classList.add("hidden");
  }

  renderizarSimilares(a);
  $("anuncio-contenido").classList.remove("hidden");
}

// ---------- Reportar anuncio ----------
// Cualquier persona con cuenta puede reportar; solo los moderadores ven los reportes.
function prepararReporte(a) {
  $("btn-reportar").addEventListener("click", () => {
    if (!usuarioActual) {
      mostrarToast("Inicia sesión para reportar un anuncio", "error");
      setTimeout(() => { location.href = "index.html#login"; }, 1200);
      return;
    }
    abrirModal("modal-reportar");
  });
  $("form-reportar").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await crearReporte(a.id, $("reporte-motivo").value, $("reporte-detalle").value.trim());
      e.target.reset();
      cerrarModal("modal-reportar");
      mostrarToast("✅ Gracias. Revisaremos este anuncio");
    } catch (err) {
      mostrarToast(mensajeError(err), "error");
    } finally {
      btn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // "Volver": si venimos de nuestra propia página, regresa a donde estaba el usuario
  $("btn-volver").addEventListener("click", e => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });

  const a = await cargarAnuncioDesdeURL();
  $("anuncio-cargando").classList.add("hidden");
  if (!a) { $("anuncio-error").classList.remove("hidden"); return; }
  renderizarAnuncio(a);
});
