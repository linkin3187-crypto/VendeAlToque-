// ===== MercaFree - Panel de moderación (moderacion.html) =====
// POR QUÉ aquí no hay lógica de seguridad: aunque alguien abra esta página sin ser
// moderador, la base de datos (RLS) no le devuelve ningún reporte ni le deja ocultar nada.
// El chequeo de rol de abajo solo evita mostrar una pantalla vacía.

let estadoVista = "pendiente";
let reportesVista = [];

const MOTIVOS = { estafa: "🚨 Estafa", prohibido: "⛔ Prohibido", duplicado: "📑 Duplicado", vendido: "✅ Ya se vendió", otro: "💬 Otro" };

function fechaCorta(iso) {
  return new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Agrupa los reportes por anuncio: un anuncio con 3 reportes es 1 tarjeta con 3 filas.
function agruparPorAnuncio(lista) {
  const grupos = new Map();
  lista.forEach(r => {
    const a = r.anuncio;
    const clave = a ? a.id : "borrado-" + r.id;
    if (!grupos.has(clave)) grupos.set(clave, { anuncio: a, reportes: [] });
    grupos.get(clave).reportes.push(r);
  });
  return [...grupos.values()];
}

function tarjetaReporte(g) {
  const a = g.anuncio;
  const foto = a && a.fotos && a.fotos[0] ? urlSegura(a.fotos[0]) : "";
  const oculto = a && a.estado_publicacion !== "activo";
  const filas = g.reportes.map(r => `
    <li class="text-sm border-t border-slate-100 pt-2 mt-2">
      <span class="font-semibold">${esc(MOTIVOS[r.motivo] || r.motivo)}</span>
      <span class="text-slate-400"> · ${esc(r.reportante && r.reportante.nombre || "Anónimo")} · ${esc(fechaCorta(r.creado_en))}</span>
      ${r.detalle ? `<p class="text-slate-600 mt-0.5">“${esc(r.detalle)}”</p>` : ""}
    </li>`).join("");
  const ids = g.reportes.map(r => r.id).join(",");
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-anuncio="${a ? a.id : ""}" data-reportes="${esc(ids)}">
    <div class="flex gap-3">
      <div class="w-20 h-20 shrink-0 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-2xl">
        ${foto ? `<img src="${esc(foto)}" alt="" class="w-full h-full object-cover">` : "📦"}
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-bold truncate">${a ? esc(a.nombre) : "(anuncio ya eliminado)"}</h3>
        <p class="text-xs text-slate-500">${a ? esc(a.barrio || "") : ""}
          ${oculto ? '<span class="ml-1 bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculto</span>' : ""}
          <span class="ml-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">${g.reportes.length} reporte${g.reportes.length > 1 ? "s" : ""}</span>
        </p>
      </div>
    </div>
    <ul>${filas}</ul>
    <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      ${a ? `<a href="anuncio.html?id=${a.id}" target="_blank" rel="noopener" class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-semibold">👁️ Ver</a>` : ""}
      ${a && !oculto ? `<button type="button" data-acc="ocultar" class="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1.5 rounded-lg font-semibold">🙈 Ocultar anuncio</button>` : ""}
      ${a && oculto ? `<button type="button" data-acc="reactivar" class="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded-lg font-semibold">↩️ Reactivar</button>` : ""}
      ${a ? `<button type="button" data-acc="eliminar" class="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded-lg font-semibold">🗑️ Eliminar anuncio</button>` : ""}
      ${estadoVista === "pendiente" ? `
        <button type="button" data-acc="revisado" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✔ Marcar revisado</button>
        <button type="button" data-acc="descartar" class="text-xs bg-white border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg font-semibold">Descartar reporte</button>` : ""}
    </div>
  </article>`;
}

async function pintarReportes() {
  const cont = $("mod-lista");
  cont.innerHTML = '<div class="skeleton h-28 rounded-2xl"></div><div class="skeleton h-28 rounded-2xl"></div>';
  document.querySelectorAll(".mod-tab").forEach(b => b.setAttribute("aria-selected", b.dataset.estado === estadoVista ? "true" : "false"));
  try {
    reportesVista = await cargarReportes(estadoVista);
  } catch (e) {
    cont.innerHTML = "";
    mostrarToast(mensajeError(e), "error");
    return;
  }
  const grupos = agruparPorAnuncio(reportesVista);
  cont.innerHTML = grupos.length
    ? grupos.map(tarjetaReporte).join("")
    : `<div class="text-center py-12 text-slate-400"><div class="text-4xl mb-2">🎉</div>No hay reportes ${estadoVista === "pendiente" ? "pendientes" : estadoVista === "revisado" ? "revisados" : "descartados"}.</div>`;
  if (estadoVista === "pendiente") $("n-pendiente").textContent = grupos.length ? "(" + grupos.length + ")" : "";
}

async function accionReporte(e) {
  const b = e.target.closest("[data-acc]");
  const tarjeta = e.target.closest("[data-anuncio]");
  if (!b || !tarjeta) return;
  const anuncioId = Number(tarjeta.dataset.anuncio) || null;
  const idsReporte = tarjeta.dataset.reportes.split(",").map(Number);
  const acc = b.dataset.acc;
  b.disabled = true;
  try {
    if (acc === "ocultar") {
      await cambiarVisibilidadAnuncio(anuncioId, "oculto");
      await resolverReportesDeAnuncio(anuncioId, "revisado");
      mostrarToast("🙈 Anuncio oculto y reportes marcados como revisados");
    } else if (acc === "reactivar") {
      await cambiarVisibilidadAnuncio(anuncioId, "activo");
      mostrarToast("↩️ Anuncio reactivado");
    } else if (acc === "eliminar") {
      if (!confirm("¿Eliminar este anuncio para siempre? No se puede deshacer.")) { b.disabled = false; return; }
      await eliminarAnuncioDB(anuncioId);
      mostrarToast("🗑️ Anuncio eliminado");
    } else if (acc === "revisado" || acc === "descartar") {
      const estado = acc === "revisado" ? "revisado" : "descartado";
      for (const id of idsReporte) await resolverReporte(id, estado);
      mostrarToast("✔ Hecho");
    }
    await pintarReportes();
  } catch (err) {
    b.disabled = false;
    mostrarToast(mensajeError(err), "error");
  }
}

// ---------- Solicitudes de comercios ----------
const TIPOS_SOLICITUD = { actualizar: "✏️ Actualizar datos", retirar: "🗑️ Retirar del directorio", reclamar: "🙋 Reclama la ficha (es el dueño)" };

function tarjetaSolicitud(s) {
  const c = s.comercio;
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-sol="${s.id}">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-bold">${esc(c ? c.nombre : "(comercio eliminado)")}</h3>
      <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">${esc(TIPOS_SOLICITUD[s.tipo] || s.tipo)}</span>
      <span class="text-xs text-slate-400">${esc(fechaCorta(s.creado_en))}</span>
    </div>
    <p class="text-sm mt-2"><b>${esc(s.nombre_contacto)}</b> · <span class="select-all">${esc(s.contacto)}</span></p>
    ${s.mensaje ? `<p class="text-sm text-slate-600 mt-1">“${esc(s.mensaje)}”</p>` : ""}
    <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      ${s.tipo === "reclamar" && s.solicitante_id && c && !c.owner_id ? `<button type="button" data-sdueno="${esc(s.solicitante_id)}" data-scom="${c.id}" class="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-semibold">👤 Asignar como dueño</button>` : ""}
      ${s.tipo === "reclamar" && c && c.owner_id ? '<span class="text-xs text-teal-700 font-semibold self-center">✔ Ya tiene dueño</span>' : ""}
      <button type="button" data-sacc="atendida" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✔ Marcar atendida</button>
      <button type="button" data-sacc="descartada" class="text-xs bg-white border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg font-semibold">Descartar</button>
    </div>
  </article>`;
}

async function pintarSolicitudes() {
  try {
    const lista = await cargarSolicitudesComercio("pendiente");
    $("n-solicitudes").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("sol-lista").innerHTML = lista.length ? lista.map(tarjetaSolicitud).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">No hay solicitudes pendientes.</p>';
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
}

async function accionSolicitud(e) {
  const d = e.target.closest("[data-sdueno]");
  if (d) {
    if (!confirm("¿Asignar a esta persona como dueña del comercio? Confirma antes que realmente representa el negocio (protocolo de verificación).")) return;
    d.disabled = true;
    try {
      await asignarDuenoComercio(Number(d.dataset.scom), { usuarioId: d.dataset.sdueno });
      await resolverSolicitudComercio(Number(e.target.closest("[data-sol]").dataset.sol), "atendida");
      mostrarToast("✅ Dueño asignado y solicitud atendida");
      await pintarSolicitudes();
    } catch (err) { d.disabled = false; mostrarToast(mensajeError(err), "error"); }
    return;
  }
  const b = e.target.closest("[data-sacc]");
  const t = e.target.closest("[data-sol]");
  if (!b || !t) return;
  b.disabled = true;
  try {
    await resolverSolicitudComercio(Number(t.dataset.sol), b.dataset.sacc);
    mostrarToast("✔ Hecho");
    await pintarSolicitudes();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

// ---------- Reportes de productos de las vitrinas ----------
const MOTIVOS_PRODUCTO = { prohibido: "Producto prohibido o regulado", precio: "Precio o información no coincide", no_existe: "No existe o no está disponible", otro: "Otro motivo" };

function tarjetaReporteProducto(r) {
  const p = r.producto;
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-rp="${r.id}" data-prod="${p ? p.id : ""}">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-bold">${esc(p ? p.nombre : "(producto eliminado)")}</h3>
      <span class="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">${esc(MOTIVOS_PRODUCTO[r.motivo] || r.motivo)}</span>
      ${p && p.oculto ? '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculto</span>' : ""}
      <span class="text-xs text-slate-400">${esc(fechaCorta(r.creado_en))}</span>
    </div>
    ${r.detalle ? `<p class="text-sm text-slate-600 mt-1">“${esc(r.detalle)}”</p>` : ""}
    <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      ${p ? `<a href="tienda.html?id=${p.comercio_id}" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">Ver tienda</a>` : ""}
      ${p && !p.oculto ? '<button type="button" data-racc="ocultar" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🚫 Ocultar producto</button>' : ""}
      <button type="button" data-racc="revisado" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✔ Revisado</button>
      <button type="button" data-racc="descartado" class="text-xs bg-white border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg font-semibold">Descartar</button>
    </div>
  </article>`;
}

async function pintarReportesProducto() {
  try {
    const lista = await cargarReportesProducto("pendiente");
    $("n-rprod").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("rprod-lista").innerHTML = lista.length ? lista.map(tarjetaReporteProducto).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">No hay reportes de productos pendientes.</p>';
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
}

async function accionReporteProducto(e) {
  const b = e.target.closest("[data-racc]");
  const t = e.target.closest("[data-rp]");
  if (!b || !t) return;
  b.disabled = true;
  try {
    if (b.dataset.racc === "ocultar") {
      await ocultarProducto(Number(t.dataset.prod), true);
      await resolverReporteProducto(Number(t.dataset.rp), "revisado");
      mostrarToast("🚫 Producto ocultado");
    } else {
      await resolverReporteProducto(Number(t.dataset.rp), b.dataset.racc);
      mostrarToast("✔ Hecho");
    }
    await pintarReportesProducto();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarSesion();
  $("mod-cargando").classList.add("hidden");
  if (!esModerador()) {
    $("mod-sin-permiso-txt").textContent = usuarioActual
      ? "Tu cuenta no tiene rol de moderador."
      : "Inicia sesión con tu cuenta de administrador para ver los reportes.";
    $("mod-sin-permiso").classList.remove("hidden");
    return;
  }
  $("mod-panel").classList.remove("hidden");
  $("mod-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-estado]");
    if (!b) return;
    estadoVista = b.dataset.estado;
    pintarReportes();
  });
  $("mod-lista").addEventListener("click", accionReporte);
  $("mod-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("sol-lista").addEventListener("click", accionSolicitud);
  $("rprod-lista").addEventListener("click", accionReporteProducto);
  pintarReportesProducto();
  pintarReportes();
  pintarSolicitudes();
});
