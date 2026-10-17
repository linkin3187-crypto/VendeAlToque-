// ===== MercaFree - Vitrina pública de un comercio (tienda.html?id=...) =====
// El público solo ve tiendas ACTIVAS y VERIFICADAS (nivel 2 o 3); la base de datos lo exige (RLS).
// El dueño y los moderadores pueden ver su tienda antes de que sea pública (con un aviso).

let tienda = null;
let productos = [];
const carrito = new Map();   // productoId → cantidad
let modoPedido = "";

const peso = n => "$" + Number(n).toLocaleString("es-CO");

function haceDias(fechaIso) {
  const d = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : "hace " + d + " días";
}

function tarjetaProducto(p) {
  const foto = urlSegura(p.foto);
  const enCarro = carrito.get(p.id) || 0;
  const control = !p.disponible ? '<span class="text-xs font-semibold text-slate-400">Agotado</span>'
    : !tienda.whatsapp ? ""
    : enCarro
      ? `<div class="flex items-center gap-2"><button type="button" data-menos="${p.id}" aria-label="Quitar uno" class="w-8 h-8 rounded-full border border-slate-300 font-bold">−</button><b>${enCarro}</b><button type="button" data-mas="${p.id}" aria-label="Agregar uno" class="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold">+</button></div>`
      : `<button type="button" data-mas="${p.id}" class="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1.5">+ Agregar</button>`;
  return `<article class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${p.disponible ? "" : "opacity-70"}" data-prod="${p.id}">
    <div class="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <span class="text-3xl">🛍️</span>
      ${foto ? `<img src="${esc(foto)}" alt="${esc(p.nombre)}" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      ${p.disponible ? "" : '<span class="absolute top-2 left-2 bg-slate-700 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">Agotado</span>'}
    </div>
    <div class="p-3 flex-1 flex flex-col">
      <p class="text-sm font-semibold line-clamp-2">${esc(p.nombre)}</p>
      ${p.descripcion ? `<p class="text-xs text-slate-500 line-clamp-2 mt-0.5">${esc(p.descripcion)}</p>` : ""}
      <p class="text-sm text-indigo-600 font-bold mt-1">${p.precio != null ? peso(p.precio) : "Consultar precio"}</p>
      <div class="mt-auto pt-2 flex items-center justify-between gap-2">${control}
        <button type="button" data-reportar="${p.id}" class="text-[11px] text-slate-400 hover:text-red-600 underline">Reportar</button></div>
    </div>
  </article>`;
}

function pintarProductos() {
  $("t-lista").innerHTML = productos.map(tarjetaProducto).join("");
  $("t-sin-productos").classList.toggle("hidden", productos.length > 0);
  pintarBarra();
  resaltarProductoBuscado();
}

// Llegó desde el buscador (tienda.html?id=X&p=ID#productos): muestra y resalta ese producto una vez
let productoResaltado = false;
function resaltarProductoBuscado() {
  const pid = new URLSearchParams(location.search).get("p");
  if (productoResaltado || !pid) return;
  const el = document.querySelector(`#t-lista [data-prod="${CSS.escape(pid)}"]`);
  if (!el) return;
  productoResaltado = true;
  el.classList.add("prod-resaltado");
  el.scrollIntoView({ block: "center" });
}

function itemsPedido() {
  return productos.filter(p => carrito.get(p.id)).map(p => ({ nombre: p.nombre, precio: p.precio, cantidad: carrito.get(p.id) }));
}

function pintarBarra() {
  const items = itemsPedido();
  const n = items.reduce((s, i) => s + i.cantidad, 0);
  $("t-barra").classList.toggle("hidden", n === 0);
  if (!n) return;
  $("t-barra-n").textContent = n + (n === 1 ? " producto" : " productos");
  const total = items.reduce((s, i) => s + (i.precio != null ? i.precio * i.cantidad : 0), 0);
  $("t-barra-total").textContent = items.every(i => i.precio != null) ? "Total aproximado " + peso(total) : "Algunos precios por consultar";
  $("t-pedir").href = urlWhatsAppTexto(tienda.whatsapp, mensajePedido(tienda, items, modoPedido));
}

function renderizarTienda(c, ps) {
  tienda = c; productos = ps;
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  document.title = `${c.nombre} | MercaFree`;
  $("t-nombre").textContent = c.nombre;
  $("t-icono").textContent = t ? t.icono : "🏪";
  $("t-sub").textContent = [nombreCategorias(c), c.ciudad].filter(Boolean).join(" · ");
  const sello = SELLOS[c.nivel] || SELLOS[1];
  $("t-sello").className = "text-xs font-semibold px-2 py-0.5 rounded-full " + sello.clase;
  $("t-sello").textContent = (c.nivel >= 2 ? "✔ " : "") + sello.corto + (c.verificadoEn ? " · " + fechaSello(c) : "");
  const foto = urlSegura(c.foto);
  if (foto) {
    const img = document.createElement("img");
    img.src = foto; img.alt = "Foto de " + c.nombre; img.className = "absolute inset-0 w-full h-full object-cover";
    img.addEventListener("error", () => img.remove());
    $("t-portada").appendChild(img);
  }
  if (c.descripcion) { $("t-desc").textContent = c.descripcion; $("t-desc").classList.remove("hidden"); }
  const fila = (id, txt) => { if (txt) { $(id).querySelector("span").textContent = txt; $(id).classList.remove("hidden"); } };
  const aprox = esUbicacionAprox(c);   // fase 2Z.8: atiende desde casa o solo a domicilio
  if (aprox) {
    const m = MODOS_ATENCION[c.modoAtencion];
    $("t-sello").insertAdjacentHTML("afterend", ` <span class="badge-modo ${c.modoAtencion}">${m.icono} ${esc(m.corto)}</span>`);
  }
  fila("t-dir", aprox ? (c.modoAtencion === "casa" ? "Atiende desde casa: en el mapa se ve solo la zona. Pide la dirección o el punto de entrega por WhatsApp." : "Solo domicilios: escribe por WhatsApp para pedir.") : c.direccion);
  fila("t-hor", c.horario);
  const entrega = [c.recoge ? (aprox ? "Recoger en un punto acordado por WhatsApp" : "Recoger en el local") : "", c.domicilio ? "Domicilio" + (c.domicilioInfo ? " (" + c.domicilioInfo + ")" : "") : ""].filter(Boolean).join(" · ");
  fila("t-ent", entrega);

  const ab = estaAbierto(c.horario);
  if (ab !== null) {
    const b = $("t-abierto");
    b.textContent = ab ? "🟢 Abierto ahora" : "🔴 Cerrado ahora";
    b.className = "text-xs font-semibold px-2 py-0.5 rounded-full " + (ab ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700");
  }

  if (c.whatsapp) {
    $("t-wa").href = urlWhatsAppTexto(c.whatsapp, `Hola, vi tu tienda «${c.nombre}» en MercaFree.`);
    $("t-wa").classList.remove("hidden");
  }
  const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
  if (tel) { $("t-llamar").href = "tel:" + tel; $("t-llamar").classList.remove("hidden"); }
  const ll = $("t-llegar");
  ll.href = urlGoogleMaps(c.lat, c.lng);
  Object.assign(ll.dataset, { comoLlegar: "", lat: c.lat, lng: c.lng, nombre: c.nombre, ciudad: c.ciudad || "" });
  if (aprox) ll.classList.add("hidden");   // no hay a dónde «llegar»: el punto es aproximado
  pintarMapaComercio(c, t);
  $("t-es-tuyo").href = "comercios.html?solicitar=" + c.id + (c.ownerId ? "" : "&tipo=reclamar");
  if (!c.ownerId) { $("t-es-tuyo").textContent = "🔑 ¿Es tu negocio? Reclámalo gratis"; mostrarBurbujaReclamar(c); }
  $("t-reportar").addEventListener("click", () => abrirReporteComercio(c));
  $("t-compartir").addEventListener("click", async () => {
    const datos = { title: c.nombre, text: `${c.nombre} en MercaFree`, url: location.href };
    if (navigator.share) { try { await navigator.share(datos); } catch (e) { /* canceló */ } return; }
    try { await navigator.clipboard.writeText(location.href); mostrarToast("🔗 Enlace copiado"); } catch (e) { window.prompt("Copia el enlace:", location.href); }
  });

  // Frescura de la vitrina
  if (ps.length) {
    const ultima = ps.reduce((m, p) => p.actualizado > m ? p.actualizado : m, ps[0].actualizado);
    $("t-actualizado").textContent = "Actualizado " + haceDias(ultima);
    $("t-desactualizado").classList.toggle("hidden", (Date.now() - new Date(ultima).getTime()) / 86400000 <= 30);
  }

  // Recoger / domicilio: si ofrece ambos, la persona elige
  if (c.recoge && c.domicilio && c.whatsapp) {
    $("t-modo").classList.remove("hidden");
    $("t-modo").addEventListener("change", e => { modoPedido = e.target.value; pintarBarra(); });
  } else modoPedido = c.domicilio && !c.recoge ? "domicilio" : c.recoge && !c.domicilio ? "recoger" : "";

  // Aviso si la tienda aún no es pública (solo la ven el dueño o un moderador)
  const publica = c.activo && c.nivel >= 2;
  const gestiona = !!usuarioActual && (c.ownerId === usuarioActual.id || esModerador());
  if (!publica) {
    const av = $("t-aviso-privado");
    av.textContent = gestiona
      ? "👀 Solo tú ves la vitrina de esta tienda: se publicará cuando el comercio esté activo y verificado por MercaFree."
      : "ℹ️ Dato de mapa: MercaFree aún no ha verificado este comercio. Confirma horario y dirección antes de ir. Si lo conoces, tu opinión ayuda a otros.";
    av.classList.remove("hidden");
  }
  pintarProductos();
  $("t-contenido").classList.remove("hidden");
}

// Mapa de ubicación del comercio: compacto, con proporción fija (ver .mapa-comercio en styles.css).
// En el celular no se arrastra con un dedo (así no «atrapa» el desplazamiento de la página): se usan los botones + / −.
function pintarMapaComercio(c, t) {
  if (!tieneCoords(c) || typeof L === "undefined") return;
  $("t-mapa-caja").classList.remove("hidden");
  const aprox = esUbicacionAprox(c);
  $("t-mapa-dir").textContent = aprox ? "📍 Zona aproximada · " + (c.ciudad || "") : [c.direccion, c.ciudad].filter(Boolean).join(" · ");
  const movil = !!(L.Browser && L.Browser.mobile);
  try {
    const mapa = crearMapaBase("t-mapa", [c.lat, c.lng], aprox ? 15 : 17, { scrollWheelZoom: false, dragging: !movil, tap: false });
    if (aprox) {   // zona, no punto: un círculo suave y sin «Cómo llegar»
      L.circle([c.lat, c.lng], { radius: 400, color: "#059669", weight: 2, fillColor: "#10b981", fillOpacity: 0.15 }).addTo(mapa);
      $("t-mapa-llegar").classList.add("hidden");
      return;
    }
    const icono = L.divIcon({ className: "marcador-cat", html: `<div class="pin-comercio pin-comercio-grande"><span>${esc(t ? t.icono : "🏪")}</span></div>`,
                             iconSize: [40, 40], iconAnchor: [20, 40] });
    L.marker([c.lat, c.lng], { icon: icono, title: c.nombre, keyboard: false }).addTo(mapa)
      .on("click", () => $("t-llegar").click());
  } catch (e) { console.warn("mapa:", e); $("t-mapa-caja").classList.add("hidden"); return; }
  $("t-mapa-llegar").addEventListener("click", () => $("t-llegar").click());
}

// Burbuja flotante «¿Es tu negocio? Reclámalo» (solo comercios SIN dueño). Pequeña y se puede cerrar:
// al cerrarla no vuelve a salir en esta sesión para ese comercio.
function mostrarBurbujaReclamar(c) {
  const clave = "mf_burbuja_" + c.id;
  try { if (sessionStorage.getItem(clave)) return; } catch (e) {}
  if ($("burbuja-reclamar")) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="burbuja-reclamar" role="complementary" aria-label="Reclamar este negocio">
      <a href="comercios.html?solicitar=${c.id}&tipo=reclamar" class="badge-reclamar">🔑 ¿Es tu negocio? Reclámalo gratis</a>
      <button type="button" data-cerrar-burbuja aria-label="Cerrar aviso">✕</button></div>`);
  document.querySelector("[data-cerrar-burbuja]").addEventListener("click", () => {
    $("burbuja-reclamar").remove();
    try { sessionStorage.setItem(clave, "1"); } catch (e) {}
  });
}

function manejarClicks(e) {
  const mas = e.target.closest("[data-mas]"), menos = e.target.closest("[data-menos]"), rep = e.target.closest("[data-reportar]");
  if (mas) { const id = Number(mas.dataset.mas); carrito.set(id, Math.min(20, (carrito.get(id) || 0) + 1)); pintarProductos(); }
  else if (menos) { const id = Number(menos.dataset.menos); const n = (carrito.get(id) || 0) - 1; n > 0 ? carrito.set(id, n) : carrito.delete(id); pintarProductos(); }
  else if (rep) {
    if (!usuarioActual) {
      mostrarToast("Inicia sesión para reportar un producto", "error");
      setTimeout(() => { location.href = "index.html#login"; }, 1200);
      return;
    }
    productoReportado = Number(rep.dataset.reportar);
    abrirModal("modal-rep-prod");
  }
}
let productoReportado = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
  let c = null, ps = [];
  try {
    c = Number.isFinite(id) ? await cargarComercioPorId(id) : null;
    if (c) ps = await cargarProductos(c.id);
  } catch (err) { console.error(err); }
  $("t-cargando").classList.add("hidden");
  if (!c) { $("t-error").classList.remove("hidden"); return; }
  renderizarTienda(c, ps);
  iniciarOpiniones();
  $("t-lista").addEventListener("click", manejarClicks);
  $("t-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("form-rep-prod").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await crearReporteProducto(productoReportado, $("rp-motivo").value, $("rp-detalle").value.trim());
      e.target.reset(); cerrarModal("modal-rep-prod");
      mostrarToast("✅ Gracias. Revisaremos este producto");
    } catch (err) { mostrarToast(mensajeError(err), "error"); }
    finally { btn.disabled = false; }
  });
});

// =====================================================================
// OPINIONES (estrellas + comentario, estilo Google) · supabase/12_calificaciones.sql
// =====================================================================
const POR_PAGINA_OP = 10;
let opiniones = [];
let opVisibles = POR_PAGINA_OP;
let miOpinion = null;        // la mía (si ya califiqué)
let estrellasElegidas = 0;
let opinionesActivas = true; // false si aún no se ejecutó el SQL 12
const TEXTO_ESTRELLAS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

const esDuenoTienda = () => !!(usuarioActual && tienda && tienda.ownerId === usuarioActual.id);
const numero1 = n => n.toFixed(1).replace(".", ",");

function pintarResumenOpiniones() {
  const vis = opiniones.filter(o => !o.oculto);
  const n = vis.length;
  const prom = n ? vis.reduce((s, o) => s + o.estrellas, 0) / n : 0;
  $("op-promedio").textContent = n ? numero1(prom) : "–";
  $("op-estrellas").textContent = estrellasTexto(prom);
  $("op-total").textContent = n ? `${n} ${n === 1 ? "opinión" : "opiniones"}` : "Sin opiniones aún";
  const cuenta = [0, 0, 0, 0, 0, 0];
  vis.forEach(o => { cuenta[o.estrellas]++; });
  $("op-barras").innerHTML = [5, 4, 3, 2, 1].map(e => `<div class="flex items-center gap-2 text-xs">
      <span class="w-3 text-slate-600 font-semibold">${e}</span>
      <div class="op-barra flex-1"><i style="width:${n ? Math.round(cuenta[e] * 100 / n) : 0}%"></i></div>
      <span class="w-6 text-right text-slate-400">${cuenta[e]}</span></div>`).join("");
  // Resumen corto bajo el nombre del comercio
  $("t-calif-corto").innerHTML = n
    ? `<span class="text-amber-500">${estrellasTexto(prom)}</span> <b>${numero1(prom)}</b> <span class="text-slate-500">(${n} ${n === 1 ? "opinión" : "opiniones"})</span>`
    : '<span class="text-indigo-600 font-semibold">⭐ Sé el primero en calificar</span>';
}

function tarjetaOpinion(o) {
  const mia = usuarioActual && o.usuarioId === usuarioActual.id;
  const editada = o.actualizado && o.creado && (new Date(o.actualizado) - new Date(o.creado)) > 60000;
  const inicial = (o.autor || "U").trim().charAt(0).toUpperCase();
  const puedeResponder = esDuenoTienda() || esModerador();
  return `<article class="py-4" data-op="${o.id}">
    <div class="flex items-start gap-3">
      <div class="w-9 h-9 shrink-0 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center" aria-hidden="true">${esc(inicial)}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-slate-800">${esc(o.autor)} ${mia ? '<span class="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Tu opinión</span>' : ""}</p>
        <p class="text-xs text-slate-500"><span class="text-amber-500 text-sm" aria-label="${o.estrellas} de 5 estrellas">${estrellasTexto(o.estrellas)}</span> · ${esc(haceDias(o.creado))}${editada ? " · editada" : ""}</p>
        ${o.oculto ? '<p class="text-xs bg-slate-100 text-slate-600 rounded-lg px-2 py-1 mt-1">🙈 Un moderador ocultó esta opinión (no cuenta en el promedio). Solo tú y los moderadores la ven.</p>' : ""}
        ${o.comentario ? `<p class="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap break-words">${esc(o.comentario)}</p>` : ""}
        ${o.respuesta ? `<div class="mt-2 bg-slate-50 border-l-4 border-indigo-300 rounded-r-lg px-3 py-2">
            <p class="text-xs font-bold text-indigo-900">🏪 Respuesta del negocio <span class="font-normal text-slate-400">· ${esc(haceDias(o.respuestaEn))}</span></p>
            <p class="text-sm text-slate-700 whitespace-pre-wrap break-words">${esc(o.respuesta)}</p></div>` : ""}
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
          ${mia ? '<button type="button" data-opacc="editar" class="text-indigo-600 font-semibold hover:underline">✏️ Editar</button>' : ""}
          ${puedeResponder ? `<button type="button" data-opacc="responder" class="text-indigo-600 font-semibold hover:underline">💬 ${o.respuesta ? "Editar respuesta" : "Responder"}</button>` : ""}
          ${!mia ? '<button type="button" data-opacc="reportar" class="text-slate-500 hover:text-red-600 underline">🚩 Reportar</button>' : ""}
          ${esModerador() ? `<button type="button" data-opacc="${o.oculto ? "mostrar" : "ocultar"}" class="text-amber-700 font-semibold hover:underline">${o.oculto ? "👁️ Mostrar" : "🙈 Ocultar"}</button>` : ""}
        </div>
        <form data-resp-form class="hidden mt-2 space-y-2">
          <textarea maxlength="500" rows="2" class="w-full border border-slate-300 rounded-lg p-2 text-sm" placeholder="Responde con amabilidad: agradece o explica qué vas a mejorar">${esc(o.respuesta)}</textarea>
          <div class="flex gap-2"><button type="submit" class="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Publicar respuesta</button>
          <button type="button" data-opacc="cancelar-resp" class="text-xs border border-slate-300 px-3 py-1.5 rounded-lg">Cancelar</button></div>
        </form>
      </div>
    </div>
  </article>`;
}

function pintarListaOpiniones() {
  const orden = $("op-orden").value;
  const lista = opiniones.slice();
  if (orden === "altas") lista.sort((a, b) => b.estrellas - a.estrellas || new Date(b.creado) - new Date(a.creado));
  else if (orden === "bajas") lista.sort((a, b) => a.estrellas - b.estrellas || new Date(b.creado) - new Date(a.creado));
  // La mía siempre arriba (como en Google)
  if (miOpinion) { lista.splice(lista.findIndex(o => o.id === miOpinion.id), 1); lista.unshift(miOpinion); }
  $("op-lista").innerHTML = lista.slice(0, opVisibles).map(tarjetaOpinion).join("");
  $("op-vacio").classList.toggle("hidden", lista.length > 0);
  const faltan = lista.length - opVisibles;
  $("op-mas").classList.toggle("hidden", faltan <= 0);
  if (faltan > 0) $("op-mas").textContent = `Ver más opiniones (${faltan})`;
}

function pintarBotonEscribir() {
  const dueno = esDuenoTienda();
  $("op-escribir").classList.toggle("hidden", dueno || !opinionesActivas);
  $("op-es-dueno").classList.toggle("hidden", !dueno);
  $("op-escribir").textContent = miOpinion ? "✏️ Editar mi opinión" : "✍️ Escribir una opinión";
}

function marcarEstrellas(n) {
  estrellasElegidas = n;
  document.querySelectorAll("#op-picker .op-star").forEach(b => {
    const v = Number(b.dataset.est);
    b.classList.toggle("encendida", v <= n);
    b.setAttribute("aria-checked", v === n ? "true" : "false");
  });
  $("op-picker-txt").textContent = n ? `${n} ${n === 1 ? "estrella" : "estrellas"} · ${TEXTO_ESTRELLAS[n]}` : "Toca las estrellas";
}

function abrirFormOpinion() {
  if (!usuarioActual) {
    mostrarToast("Crea tu cuenta gratis (o inicia sesión) para calificar", "ok");
    try { sessionStorage.setItem("mf_volver", "tienda.html?id=" + tienda.id + "#opinar"); } catch (e) {}
    setTimeout(() => { location.href = "index.html#login"; }, 1000);
    return;
  }
  if (esDuenoTienda()) { mostrarToast("No puedes calificar tu propio negocio", "error"); return; }
  $("op-form-titulo").textContent = miOpinion ? "Edita tu opinión" : "Tu opinión";
  $("op-nombre").textContent = usuarioActual.nombre || "Usuario";
  marcarEstrellas(miOpinion ? miOpinion.estrellas : 0);
  $("op-comentario").value = miOpinion ? miOpinion.comentario : "";
  $("op-cuenta").textContent = $("op-comentario").value.length;
  $("op-borrar").classList.toggle("hidden", !miOpinion);
  $("op-form").classList.remove("hidden");
  $("op-escribir").classList.add("hidden");
  $("op-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cerrarFormOpinion() {
  $("op-form").classList.add("hidden");
  pintarBotonEscribir();
}

async function recargarOpiniones() {
  try {
    opiniones = await cargarCalificaciones(tienda.id);
    opinionesActivas = true;
  } catch (err) {
    console.warn("opiniones:", err);
    opiniones = []; opinionesActivas = false;   // p. ej. aún no existe la tabla (SQL 12 sin ejecutar)
  }
  miOpinion = usuarioActual ? opiniones.find(o => o.usuarioId === usuarioActual.id) || null : null;
  pintarResumenOpiniones();
  pintarListaOpiniones();
  pintarBotonEscribir();
}

async function publicarOpinion(e) {
  e.preventDefault();
  if (!estrellasElegidas) { mostrarToast("Elige de 1 a 5 estrellas", "error"); return; }
  const btn = $("op-publicar"); btn.disabled = true;
  try {
    await guardarCalificacion(tienda.id, estrellasElegidas, $("op-comentario").value, miOpinion ? miOpinion.id : null);
    mostrarToast(miOpinion ? "✅ Opinión actualizada" : "✅ ¡Gracias! Tu opinión ya está publicada");
    cerrarFormOpinion();
    await recargarOpiniones();
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
  finally { btn.disabled = false; }
}

async function borrarMiOpinion() {
  if (!miOpinion || !confirm("¿Borrar tu opinión? Podrás escribir otra cuando quieras.")) return;
  try {
    await borrarCalificacion(miOpinion.id);
    mostrarToast("Opinión borrada");
    cerrarFormOpinion();
    await recargarOpiniones();
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
}

// Reportar una opinión (ventana que se crea sola la primera vez)
function abrirReporteOpinion(id) {
  if (!usuarioActual) {
    mostrarToast("Inicia sesión para reportar", "error");
    try { sessionStorage.setItem("mf_volver", "tienda.html?id=" + tienda.id + "#opiniones"); } catch (e) {}
    setTimeout(() => { location.href = "index.html#login"; }, 1200);
    return;
  }
  if (!$("modal-rep-op")) {
    document.body.insertAdjacentHTML("beforeend", `<div id="modal-rep-op" class="modal-fondo hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" role="dialog" aria-modal="true" aria-labelledby="ro-titulo">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[92vh] overflow-auto">
        <button type="button" data-cerrar aria-label="Cerrar" class="absolute top-4 right-4 text-2xl text-slate-400 hover:text-slate-700">&times;</button>
        <h3 id="ro-titulo" class="text-xl font-black text-indigo-900 mb-1">🚩 Reportar opinión</h3>
        <p class="text-sm text-slate-500 mb-4">Un moderador la revisará. Las opiniones negativas pero honestas no se ocultan.</p>
        <form id="form-rep-op" class="space-y-3">
          <select id="ro-motivo" class="w-full border border-slate-300 p-3 rounded-xl bg-white">${Object.entries(MOTIVOS_REPORTE_CALIFICACION).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
          <textarea id="ro-detalle" rows="2" maxlength="300" placeholder="Detalles (opcional)" class="w-full border border-slate-300 p-3 rounded-xl"></textarea>
          <button type="submit" id="ro-enviar" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-60">Enviar reporte</button>
        </form>
      </div></div>`);
    $("form-rep-op").addEventListener("submit", async ev => {
      ev.preventDefault();
      const b = $("ro-enviar"); b.disabled = true;
      try {
        await crearReporteCalificacion(Number($("modal-rep-op").dataset.id), $("ro-motivo").value, $("ro-detalle").value.trim());
        cerrarModal("modal-rep-op");
        mostrarToast("✅ Gracias, un moderador la revisará");
      } catch (err) { mostrarToast(mensajeError(err), "error"); }
      finally { b.disabled = false; }
    });
  }
  $("modal-rep-op").dataset.id = id;
  $("ro-motivo").value = "ofensivo"; $("ro-detalle").value = "";
  abrirModal("modal-rep-op");
}

async function accionOpinion(e) {
  const b = e.target.closest("[data-opacc]");
  const art = e.target.closest("[data-op]");
  if (!b || !art) return;
  const id = Number(art.dataset.op);
  const acc = b.dataset.opacc;
  const form = art.querySelector("[data-resp-form]");
  if (acc === "editar") abrirFormOpinion();
  else if (acc === "responder") { form.classList.remove("hidden"); form.querySelector("textarea").focus(); }
  else if (acc === "cancelar-resp") form.classList.add("hidden");
  else if (acc === "reportar") abrirReporteOpinion(id);
  else if (acc === "ocultar" || acc === "mostrar") {
    b.disabled = true;
    try { await ocultarCalificacion(id, acc === "ocultar"); mostrarToast(acc === "ocultar" ? "🙈 Opinión ocultada" : "👁️ Opinión visible otra vez"); await recargarOpiniones(); }
    catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
  }
}

async function enviarRespuesta(e) {
  const form = e.target.closest("[data-resp-form]");
  if (!form) return;
  e.preventDefault();
  const id = Number(form.closest("[data-op]").dataset.op);
  const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await responderCalificacion(id, form.querySelector("textarea").value.trim());
    mostrarToast("✅ Respuesta publicada");
    await recargarOpiniones();
  } catch (err) { btn.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

async function iniciarOpiniones() {
  $("op-escribir").addEventListener("click", abrirFormOpinion);
  $("op-cancelar").addEventListener("click", cerrarFormOpinion);
  $("op-borrar").addEventListener("click", borrarMiOpinion);
  $("op-form").addEventListener("submit", publicarOpinion);
  $("op-picker").addEventListener("click", ev => { const s = ev.target.closest("[data-est]"); if (s) marcarEstrellas(Number(s.dataset.est)); });
  $("op-picker").addEventListener("keydown", ev => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { ev.preventDefault(); marcarEstrellas(Math.min(5, estrellasElegidas + 1)); }
    if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { ev.preventDefault(); marcarEstrellas(Math.max(1, estrellasElegidas - 1)); }
  });
  $("op-comentario").addEventListener("input", () => { $("op-cuenta").textContent = $("op-comentario").value.length; });
  $("op-orden").addEventListener("change", () => { opVisibles = POR_PAGINA_OP; pintarListaOpiniones(); });
  $("op-mas").addEventListener("click", () => { opVisibles += POR_PAGINA_OP; pintarListaOpiniones(); });
  $("op-lista").addEventListener("click", accionOpinion);
  $("op-lista").addEventListener("submit", enviarRespuesta);
  await recargarOpiniones();
  // Llegó desde «⭐ Calificar» (tienda.html?id=X#opinar): abre el formulario directamente
  if (location.hash === "#opinar") {
    history.replaceState(null, "", location.pathname + location.search + "#opiniones");
    if (opinionesActivas && !esDuenoTienda()) abrirFormOpinion();
    else $("opiniones").scrollIntoView();
  } else if (location.hash === "#opiniones") $("opiniones").scrollIntoView();
}
