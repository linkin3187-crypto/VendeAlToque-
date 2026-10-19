// ===== Merkap - Página de detalle de un anuncio (anuncio.html?id=...) =====
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
    img.className = "absolute inset-0 w-full h-full object-cover cursor-zoom-in";
    img.addEventListener("error", () => img.remove()); // si falla, queda el icono de fondo
    cont.appendChild(img);
  }
  document.querySelectorAll(".miniatura").forEach((m, idx) =>
    m.setAttribute("aria-current", idx === fotoActiva ? "true" : "false"));
  if ($("gal-contador")) {
    $("gal-contador").textContent = `📷 ${fotoActiva + 1}/${fotos.length}`;
    $("gal-puntos").querySelectorAll("i").forEach((p, idx) => p.classList.toggle("on", idx === fotoActiva));
  }
}

// ---------- Foto completa (visor) ----------
// POR QUÉ: la galería recorta la foto (object-cover) para que todas se vean parejas.
// Al tocarla se abre este visor con la foto ENTERA (object-contain); tocar de nuevo,
// la X o Escape lo contraen.
function abrirVisor() {
  const src = urlSegura(anuncioActual.fotos[fotoActiva]);
  if (!src) return;
  let v = $("visor-foto");
  if (!v) {
    v = document.createElement("div");
    v.id = "visor-foto";
    v.className = "fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-2 cursor-zoom-out";
    v.setAttribute("role", "dialog");
    v.setAttribute("aria-label", "Foto ampliada");
    v.innerHTML = '<button type="button" id="visor-cerrar" aria-label="Cerrar foto" class="absolute top-3 right-4 text-white text-4xl leading-none">&times;</button>' +
      '<button type="button" id="visor-ant" aria-label="Foto anterior" class="absolute left-2 top-1/2 -translate-y-1/2 text-white text-5xl px-2">&#8249;</button>' +
      '<button type="button" id="visor-sig" aria-label="Foto siguiente" class="absolute right-2 top-1/2 -translate-y-1/2 text-white text-5xl px-2">&#8250;</button>' +
      '<img id="visor-img" alt="" class="max-w-full max-h-full object-contain select-none">';
    v.addEventListener("click", e => {
      if (e.target.id === "visor-ant") { mostrarFoto(fotoActiva - 1); actualizarVisor(); return; }
      if (e.target.id === "visor-sig") { mostrarFoto(fotoActiva + 1); actualizarVisor(); return; }
      cerrarVisor();   // clic en la foto, el fondo o la X: contrae
    });
    document.body.appendChild(v);
  }
  v.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  const multiple = anuncioActual.fotos.length > 1;
  $("visor-ant").classList.toggle("hidden", !multiple);
  $("visor-sig").classList.toggle("hidden", !multiple);
  actualizarVisor();
}
function actualizarVisor() {
  const img = $("visor-img");
  if (!img) return;
  img.src = urlSegura(anuncioActual.fotos[fotoActiva]);
  img.alt = `${anuncioActual.nombre} - foto ${fotoActiva + 1}`;
}
function cerrarVisor() {
  const v = $("visor-foto");
  if (v) v.classList.add("hidden");
  document.body.style.overflow = "";
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
  if (a.fotos.length > 1) {   // fase 2AC: contador «1/5», puntos y flechas sobre la foto
    $("galeria-principal").insertAdjacentHTML("beforeend", `<button type="button" id="gal-ant" class="gal-flecha izq" aria-label="Foto anterior">‹</button>
      <button type="button" id="gal-sig" class="gal-flecha der" aria-label="Foto siguiente">›</button>
      <span id="gal-contador" class="gal-contador" aria-live="polite"></span>
      <span id="gal-puntos" class="gal-puntos" aria-hidden="true">${a.fotos.map(() => "<i></i>").join("")}</span>`);
    $("gal-ant").addEventListener("click", e => { e.stopPropagation(); mostrarFoto(fotoActiva - 1); });
    $("gal-sig").addEventListener("click", e => { e.stopPropagation(); mostrarFoto(fotoActiva + 1); });
    let x0 = null;   // deslizar con el dedo
    $("galeria-principal").addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    $("galeria-principal").addEventListener("touchend", e => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) mostrarFoto(fotoActiva + (dx < 0 ? 1 : -1));
    });
  }
  if (a.fotos.length) {
    mostrarFoto(0);
    $("galeria-principal").addEventListener("click", e => { if (e.target.tagName === "IMG") abrirVisor(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarVisor(); });
    // Flechas del teclado para cambiar de foto
    document.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { mostrarFoto(fotoActiva + 1); actualizarVisor(); }
      if (e.key === "ArrowLeft") { mostrarFoto(fotoActiva - 1); actualizarVisor(); }
    });
  }
}

async function compartir() {
  const datos = { title: anuncioActual.nombre, text: `${anuncioActual.nombre} en Merkap`, url: location.href };
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
  const orden = (x, y) => (origen && tieneCoords(x) && tieneCoords(y)) ? distanciaKm(origen, x) - distanciaKm(origen, y) : y.fecha - x.fecha;
  const mismos = baseDatosAnuncios.filter(x => x.id !== a.id && x.categoria === a.categoria).sort(orden).slice(0, 8);
  // Fase 2AC.1: si no completa 4, se rellena con otros anuncios cercanos de otras categorías
  const cerca = mismos.length >= 4 ? [] : baseDatosAnuncios.filter(x => x.id !== a.id && x.categoria !== a.categoria).sort(orden).slice(0, 4 - mismos.length);
  const similares = [...mismos.map(x => ({ ...x, otraCat: false })), ...cerca.map(x => ({ ...x, otraCat: true }))];
  if (!similares.length) return;
  $("similares-titulo").textContent = mismos.length ? (cerca.length ? "Anuncios similares y cerca" : "Anuncios similares") : "Más anuncios cerca";
  $("seccion-similares").classList.remove("hidden");
  $("lista-similares").innerHTML = similares.map(s => {
    const foto = urlSegura(s.imagen);
    return `<a href="anuncio.html?id=${s.id}" class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden block hover:shadow-md">
      <div class="relative h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <span class="text-3xl">${iconosCategoria[s.categoria] || "📦"}</span>
        ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      </div>
      <div class="p-3">
        ${s.otraCat ? `<p class="text-[10px] font-semibold text-slate-400 uppercase">${esc((CATEGORIAS.find(c => c.id === s.categoria) || {}).nombre || "")}</p>` : ""}
        <p class="text-sm font-semibold line-clamp-2">${esc(s.nombre)}</p>
        ${s.precio ? `<p class="text-sm text-indigo-600 font-bold">${esc(precioConSufijo(s))}</p>` : ""}
        ${origen && tieneCoords(s) ? `<p class="text-[11px] text-slate-500">📏 ${esc(distanciaCorta(distanciaKm(origen, s)))}${s.ubicacionAprox ? " (aprox.)" : ""}</p>` : ""}
      </div>
    </a>`;
  }).join("");
  $("similares-nota").textContent = (mismos.length ? "Primero los de la misma categoría" : "De otras categorías") + (cerca.length && mismos.length ? "; después, otros anuncios cerca" : "") + (origen ? ", del más cercano a este anuncio al más lejano." : ", los más recientes primero.");
  $("lista-similares").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
}

// «Publicado por …» (fase 2C.5). Si aún no se ejecutó el SQL 18, la caja simplemente no aparece.
async function pintarVendedor(ownerId) {
  try {
    const v = await cargarPerfilPublico(ownerId);
    if (!v) return;
    $("vendedor-caja").href = "vendedor.html?id=" + encodeURIComponent(v.id);
    $("vendedor-avatar").textContent = (v.nombre || "?").trim().charAt(0).toUpperCase();
    $("vendedor-nombre").textContent = v.nombre;
    $("vendedor-sub").textContent = `Miembro desde ${fechaMiembro(v.desde)} · ${v.activos} ${v.activos === 1 ? "anuncio" : "anuncios"}` + (v.comercioNombre ? ` · 🏪 ${v.comercioNombre}` : "");
    $("vendedor-caja").classList.remove("hidden");
  } catch (e) { /* sin perfil público: no se muestra */ }
}

function renderizarAnuncio(a) {
  anuncioActual = a;
  const cat = CATEGORIAS.find(c => c.id === a.categoria) || { icono: "📦", nombre: a.categoria };

  // Título de la pestaña y descripción: útiles al compartir y para el historial.
  // (Ojo: Google y WhatsApp leen el HTML SIN ejecutar JS, así que para que la vista
  //  previa muestre el anuncio hará falta renderizar en servidor: Fase 3.)
  document.title = `${a.nombre} | Merkap`;
  $("meta-desc").content = (a.desc || "").slice(0, 150);

  $("anuncio-titulo").textContent = a.nombre;
  if (a.owner) pintarVendedor(a.owner);
  // El dueño (o un moderador) ve «Editar mi publicación»: abre el formulario de edición del inicio
  const puedeEditar = !!(usuarioActual && a.owner && a.owner === usuarioActual.id);
  if (puedeEditar) { $("btn-editar-mio").href = "index.html?editar=" + a.id; $("btn-editar-mio").classList.remove("hidden"); }
  $("anuncio-precio").textContent = a.precio ? precioConSufijo(a) : "Precio a convenir";
  // Fase 2AC: precio fijo o negociable + «Publicado hace X»
  const tp = (a.detalles || {}).precio_tipo;
  if (a.precio && ETIQUETA_PRECIO[tp]) $("anuncio-precio").insertAdjacentHTML("beforeend", ` <span class="etq-precio ${tp}">${ETIQUETA_PRECIO[tp]}</span>`);
  $("anuncio-ubicacion").textContent = [a.barrio, a.ciudad, a.departamento].filter(Boolean).join(", ") + (a.fecha ? " · 🕒 Publicado " + haceCuanto(a.fecha) : "");
  // Moderadores: «⭐ Selección del día» (24 h)
  if (esModerador() && !$("btn-seleccion")) {
    $("anuncio-badges").insertAdjacentHTML("afterend", `<button type="button" id="btn-seleccion" class="mb-2 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900"></button>`);
    const pintarSel = () => { $("btn-seleccion").textContent = a.seleccionHasta > Date.now() ? "⭐ En Selección del día · Quitar" : "⭐ Poner en Selección del día (24 h)"; };
    pintarSel();
    $("btn-seleccion").addEventListener("click", async () => {
      try { await marcarSeleccionDia(a.id, a.seleccionHasta > Date.now() ? 0 : 24); pintarSel(); mostrarToast(a.seleccionHasta ? "⭐ Aparece en la Selección del día por 24 h" : "Quitado de la Selección del día"); }
      catch (err) { mostrarToast(mensajeError(err), "error"); }
    });
  }
  $("anuncio-desc").textContent = a.desc || "Sin descripción";

  const badgeEstado = a.estado === "nuevo"
    ? '<span class="badge-nuevo text-xs font-semibold px-2 py-0.5 rounded-full">Nuevo</span>'
    : a.estado === "usado" ? '<span class="badge-usado text-xs font-semibold px-2 py-0.5 rounded-full">Usado</span>' : "";
  $("anuncio-badges").innerHTML =
    `<span class="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">${cat.icono} ${esc(cat.nombre)}</span>${badgeEstado}`
    + ((a.detalles || {}).operacion ? `<span class="det-chip op">${esc(OPERACIONES[a.detalles.operacion] || "")}</span>` : "");

  const fecha = new Date(a.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const item = (t, v) => `<div><dt class="text-xs text-slate-400">${t}</dt><dd class="font-medium">${esc(v)}</dd></div>`;
  $("anuncio-detalles").innerHTML =
    item("Categoría", cat.nombre) + (nombreSubcategoria(a.categoria, a.subcategoria) ? item("Tipo", nombreSubcategoria(a.categoria, a.subcategoria)) : "") +
    item("Estado", a.estado || "—") + fichaDetalles(a).map(([t, v]) => item(t, v)).join("") +
    item("Barrio", a.barrio || "—") + item("Publicado", fecha);
  // Fase 2Z.7: aviso contra las estafas más comunes en inmuebles y vehículos
  const fraude = avisoFraude(a);
  if (fraude && !$("anuncio-fraude")) $("anuncio-detalles").insertAdjacentHTML("afterend", `<p id="anuncio-fraude" class="aviso-fraude text-sm rounded-xl p-3 mt-4">${fraude}</p>`);

  // El número NO llega a la página: al tocar el botón, data.js lo pide a la base de datos (solo con cuenta;
  // sin cuenta abre el registro rápido). Ver supabase/13_contacto_anuncios.sql.
  const tieneWa = a.tieneWhatsapp !== false, tieneTel = !!a.tieneTelefono;
  ["btn-whatsapp", "barra-whatsapp", "btn-llamar", "barra-llamar"].forEach(id => Object.assign($(id).dataset, { anuncio: a.id, nombre: a.nombre }));
  if (!tieneWa) { $("btn-whatsapp").style.display = "none"; $("barra-whatsapp").style.display = "none"; }
  if (tieneTel) {
    $("btn-llamar").style.display = ""; $("barra-llamar").style.display = "";
    if (!tieneWa) { $("barra-llamar").innerHTML = ICONO_TEL + " Llamar al vendedor"; $("barra-llamar").classList.add("flex-1"); }
  }
  $("btn-compartir").addEventListener("click", compartir);
  $("barra-compartir").addEventListener("click", compartir);
  $("barra-acciones").classList.remove("hidden");
  $("barra-acciones").classList.add("md:hidden");
  prepararGuardar(a);
  prepararReporte(a);

  renderizarGaleria(a);

  if (tieneCoords(a)) {
    $("ayuda-llegar").classList.remove("hidden");
    const bcl = $("btn-como-llegar");
    bcl.href = urlGoogleMaps(a.lat, a.lng);
    Object.assign(bcl.dataset, { comoLlegar: "", anuncio: a.id, lat: a.lat, lng: a.lng, nombre: a.nombre, aprox: a.ubicacionAprox ? "1" : "0", ciudad: a.ciudad || "" });
    const aprox = !!a.ubicacionAprox;
    if (aprox) {
      $("btn-como-llegar").textContent = "🗺️ Cómo llegar a la zona";
      $("nota-zona").classList.remove("hidden");
    }
    const mapa = crearMapaBase("map-anuncio", [a.lat, a.lng], aprox ? 15 : 16, { scrollWheelZoom: false });
    if (aprox) L.circle([a.lat, a.lng], { radius: RADIO_MAX_APROX_M + 100, color: "#4f46e5", weight: 2, fillOpacity: 0.12 }).addTo(mapa);
    else L.marker([a.lat, a.lng], { icon: iconoMarcador(a.categoria) }).addTo(mapa);
  } else {
    $("btn-como-llegar").classList.add("hidden");
    $("seccion-mapa").classList.add("hidden");
  }

  renderizarGuia(a);
  renderizarSimilares(a);
  $("anuncio-contenido").classList.remove("hidden");
}

// ---------- Guía rápida (para quien no es de tecnología) ----------
// Una persona ve los pasos para comprar; el dueño del anuncio ve los pasos para vender.
function renderizarGuia(a) {
  const esDueno = !!(usuarioActual && a.owner && a.owner === usuarioActual.id);
  const paso = (n, titulo, texto, boton) => `<li class="flex gap-3 mt-3">
      <span class="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">${n}</span>
      <div><p class="font-semibold text-slate-900">${titulo}</p><p class="text-slate-600">${texto}</p>${boton || ""}</div></li>`;
  const btn = (accion, texto) => `<button type="button" data-guia="${accion}" class="mt-1.5 text-xs font-semibold bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100 rounded-lg px-3 py-1.5">${texto}</button>`;
  const aprox = a.ubicacionAprox;
  $("guia-contenido").innerHTML = esDueno
    ? `<p class="text-xs text-slate-500">Este es tu anuncio. Así lo ven y así te contactan:</p><ol>
        ${paso(1, "Te contactan con tu número protegido", "Las personas interesadas te escriben o te llaman desde los botones. Tu número no se muestra en pantalla y solo lo obtienen personas con cuenta en Merkap.")}
        ${paso(2, "Acuerden precio y lugar", "Reúnete en un lugar público y concurrido (estación del metro, centro comercial, CAI). No des tu dirección de casa.")}
        ${paso(3, "Tu ubicación está protegida", aprox ? "El mapa muestra solo una zona cercana, no tu punto exacto. Tú le dices al comprador dónde encontrarse." : "Tu anuncio muestra el punto exacto. Si es tu casa, edítalo y activa «Mostrar solo la zona aproximada».")}
        ${paso(4, "Cuando se venda", "Entra a «Mis anuncios» y elimínalo o edítalo para no recibir más mensajes.")}
      </ol>`
    : `<p class="text-xs text-slate-500">Cuatro pasos sencillos para comprar con tranquilidad:</p><ol>
        ${a.tieneWhatsapp !== false
          ? paso(1, "Escríbele al vendedor", "Toca el botón verde de WhatsApp para preguntar si sigue disponible y el precio final." + (a.tieneTelefono ? " También puedes llamarlo con 📞." : ""), btn("whatsapp", "💬 Abrir WhatsApp"))
          : paso(1, "Llama al vendedor", "Este vendedor prefiere llamadas: toca 📞 para preguntar si sigue disponible y el precio final.", btn("llamar", "📞 Llamar"))}
        ${paso(2, "Acuerden dónde verse", "Propón un lugar público y concurrido. " + (aprox ? "El mapa muestra solo una zona aproximada; el vendedor te dirá el punto exacto." : ""), btn("llegar", "🗺️ Ver opciones para llegar"))}
        ${paso(3, "Elige cómo llegar", "Toca el botón azul <b>«Cómo llegar»</b>: verás metro y buses, a pie, bicicleta, carro, Uber y más. Si el vendedor te manda la ubicación, pégala ahí y las opciones se ajustan.")}
        ${paso(4, "Revisa antes de pagar", "Mira y prueba el producto. Paga solo cuando lo tengas en la mano y no adelantes dinero. Si algo no se ve bien, usa «Reportar este anuncio».")}
      </ol>`;
  $("guia-contenido").addEventListener("click", e => {
    const b = e.target.closest("[data-guia]");
    if (!b) return;
    if (b.dataset.guia === "whatsapp") $(window.matchMedia("(min-width: 768px)").matches ? "btn-whatsapp" : "barra-whatsapp").click();
    if (b.dataset.guia === "llamar") $(window.matchMedia("(min-width: 768px)").matches ? "btn-llamar" : "barra-llamar").click();
    if (b.dataset.guia === "llegar" && !$("btn-como-llegar").classList.contains("hidden")) $("btn-como-llegar").click();
  });
  $("guia-rapida").classList.remove("hidden");
  try { if (localStorage.getItem("mf_guia_cerrada") === "1") $("guia-rapida").open = false; } catch (e) { /* sin almacenamiento: queda abierta */ }
  $("guia-rapida").addEventListener("toggle", () => {
    try { localStorage.setItem("mf_guia_cerrada", $("guia-rapida").open ? "0" : "1"); } catch (e) { /* no pasa nada */ }
  });
}

// ---------- Guardar en favoritos ----------
function pintarGuardar(guardado) {
  const t = guardado ? "❤️" : "🤍";
  $("btn-guardar").textContent = t + (guardado ? " Guardado" : " Guardar");
  $("barra-guardar").textContent = t;
  [$("btn-guardar"), $("barra-guardar")].forEach(b => b.setAttribute("aria-pressed", String(guardado)));
  $("barra-guardar").setAttribute("aria-label", guardado ? "Quitar de favoritos" : "Guardar en favoritos");
}

function prepararGuardar(a) {
  pintarGuardar(favoritosIds.has(a.id));
  const accion = async () => {
    if (!usuarioActual) {
      mostrarToast("Inicia sesión para guardar favoritos", "error");
      setTimeout(() => { location.href = "index.html#login"; }, 1200);
      return;
    }
    const antes = favoritosIds.has(a.id);
    pintarGuardar(!antes);
    try {
      const ahora = await alternarFavorito(a.id);
      pintarGuardar(ahora);
      mostrarToast(ahora ? "❤️ Guardado en favoritos" : "Quitado de favoritos");
    } catch (err) {
      pintarGuardar(antes);
      mostrarToast(mensajeError(err), "error");
    }
  };
  $("btn-guardar").addEventListener("click", accion);
  $("barra-guardar").addEventListener("click", accion);
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
  if (usuarioActual) await cargarFavoritos();
  $("anuncio-cargando").classList.add("hidden");
  if (!a) { $("anuncio-error").classList.remove("hidden"); return; }
  renderizarAnuncio(a);
  revisarContactoPendiente(id => (id === a.id ? a : null));   // volvió del correo de confirmación
});
