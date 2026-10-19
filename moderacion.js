// ===== Merkap - Panel de moderación (moderacion.html) =====
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
      ${a && a.owner_id ? botonesSancionHTML(a.owner_id) : ""}
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
// ---------- Fase 2AK: propuestas del moderador (el administrador decide) ----------
function propuestaHTML(x) {
  if (!x.propuesta) return "";
  const quien = x.proponente && x.proponente.nombre ? x.proponente.nombre : "Un moderador";
  return `<p class="propuesta-badge ${x.propuesta === "rechazar" ? "rechazar" : ""}">🛡️ <b>${esc(quien)}</b> propone <b>${x.propuesta === "aprobar" ? "👍 aprobar" : "👎 rechazar"}</b>${x.propuesta_nota ? `: «${esc(x.propuesta_nota)}»` : ""} <span class="opacity-70">· ${esc(fechaCorta(x.propuesta_en))}</span></p>`;
}
function controlesPropuestaHTML(tipo, id) {
  return `<div class="solo-mod mt-3 pt-3 border-t border-slate-100" data-prop-caja data-ptipo="${tipo}" data-pid="${id}">
    <p class="text-xs font-bold text-slate-500 mb-1.5">Tu propuesta para el administrador:</p>
    <input data-prop-nota maxlength="300" placeholder="Nota (obligatoria para rechazar): ej. Hablé con el dueño, existe" class="w-full border border-slate-300 p-2 rounded-lg text-sm">
    <div class="flex flex-wrap gap-2 mt-2">
      <button type="button" data-prop="aprobar" class="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold">👍 Proponer aprobar</button>
      <button type="button" data-prop="rechazar" class="text-xs bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold">👎 Proponer rechazar</button>
    </div></div>`;
}
async function accionPropuesta(e, repintar) {
  const b = e.target.closest("[data-prop]");
  if (!b) return false;
  const caja = b.closest("[data-prop-caja]");
  b.disabled = true;
  try {
    await proponerResolucion(caja.dataset.ptipo, Number(caja.dataset.pid), b.dataset.prop, caja.querySelector("[data-prop-nota]").value);
    mostrarToast("✅ Propuesta enviada al administrador");
    await repintar();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
  return true;
}

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
    ${s.datos_sanitarios ? (d => `<div class="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900">
      <b>🧾 Datos sanitarios (privados):</b> ${esc(TIPOS_ESTABLECIMIENTO_SALUD[d.tipo_establecimiento] || d.tipo_establecimiento || "")}<br>
      ${esc(d.razon_social || "")} · NIT <b>${esc(d.nit || "")}</b> · Director técnico: ${esc(d.director_tecnico || "")}
      ${d.acta_numero || d.acta_fecha ? `<br>Acta/concepto: ${esc(d.acta_numero || "—")} ${d.acta_fecha ? "(" + esc(d.acta_fecha) + ")" : ""}` : ""}
      <br><span class="text-emerald-700">Al asignarlo como dueño, estos datos pasan solos a «🧾 Sanitario» del comercio (por revisar).</span></div>`)(s.datos_sanitarios) : ""}
    ${s.tipo === "reclamar" ? propuestaHTML(s) : ""}
    <div class="${s.tipo === "reclamar" ? "solo-admin " : ""}flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      ${s.tipo === "reclamar" && s.solicitante_id && c && !c.owner_id ? `<button type="button" data-sdueno="${esc(s.solicitante_id)}" data-scom="${c.id}" class="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-semibold">👤 Asignar como dueño</button>` : ""}
      ${s.tipo === "retirar" && c && c.activo ? `<button type="button" data-socultar="${c.id}" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🙈 Ocultar comercio</button>` : ""}
      ${s.tipo === "reclamar" && c && c.owner_id ? '<span class="text-xs text-teal-700 font-semibold self-center">✔ Ya tiene dueño</span>' : ""}
      <button type="button" data-sacc="atendida" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✔ Marcar atendida</button>
      <button type="button" data-sacc="descartada" class="text-xs bg-white border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg font-semibold">Descartar</button>
    </div>
    ${s.tipo === "reclamar" ? controlesPropuestaHTML("reclamo", s.id) : ""}
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
  if (await accionPropuesta(e, pintarSolicitudes)) return;
  const o = e.target.closest("[data-socultar]");
  if (o) {
    if (!confirm("¿Ocultar este comercio? Confirma antes que quien lo pide realmente lo representa (llámalo o escríbele). Podrás volver a mostrarlo desde Comercios.")) return;
    o.disabled = true;
    try {
      await guardarComercioDB(Number(o.dataset.socultar), { activo: false });
      await resolverSolicitudComercio(Number(e.target.closest("[data-sol]").dataset.sol), "atendida");
      mostrarToast("🙈 Comercio oculto y solicitud atendida");
      await pintarSolicitudes();
    } catch (err) { o.disabled = false; mostrarToast(mensajeError(err), "error"); }
    return;
  }
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

// ---------- Reportes de comercios ----------
function tarjetaReporteComercio(r) {
  const c = r.comercio;
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-rc="${r.id}" data-com="${c ? c.id : ""}">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-bold">${esc(c ? c.nombre : "(comercio eliminado)")}</h3>
      <span class="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">${esc(MOTIVOS_REPORTE_COMERCIO[r.motivo] || r.motivo)}</span>
      ${c && !c.activo ? '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculto</span>' : ""}
      <span class="text-xs text-slate-400">${esc(fechaCorta(r.creado_en))}</span>
    </div>
    ${r.detalle ? `<p class="text-sm text-slate-600 mt-1">“${esc(r.detalle)}”</p>` : ""}
    <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      ${c ? `<a href="tienda.html?id=${c.id}" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">Ver comercio</a>
      <a href="admin-comercios.html?editar=${c.id}" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">✏️ Editar</a>` : ""}
      ${c && c.activo ? '<button type="button" data-cacc="ocultar" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🙈 Ocultar comercio</button>' : ""}
      <button type="button" data-cacc="revisado" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✔ Revisado</button>
      <button type="button" data-cacc="descartado" class="text-xs bg-white border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg font-semibold">Descartar</button>
    </div>
  </article>`;
}

async function pintarReportesComercio() {
  try {
    const lista = await cargarReportesComercio("pendiente");
    $("n-rcom").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("rcom-lista").innerHTML = lista.length ? lista.map(tarjetaReporteComercio).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">No hay reportes de comercios pendientes.</p>';
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
}

async function accionReporteComercio(e) {
  const b = e.target.closest("[data-cacc]"), t = e.target.closest("[data-rc]");
  if (!b || !t) return;
  b.disabled = true;
  try {
    if (b.dataset.cacc === "ocultar") {
      if (!confirm("¿Ocultar este comercio del mapa, del directorio y del inicio? Podrás volver a mostrarlo desde Comercios.")) { b.disabled = false; return; }
      await guardarComercioDB(Number(t.dataset.com), { activo: false });
      await resolverReporteComercio(Number(t.dataset.rc), "revisado");
      mostrarToast("🙈 Comercio oculto");
    } else {
      await resolverReporteComercio(Number(t.dataset.rc), b.dataset.cacc);
      mostrarToast("✔ Hecho");
    }
    await pintarReportesComercio();
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

// ---------- 💊 Salud (fase 2AB.1) ----------
async function pintarSalud() {
  let lista = [], ds = [];
  try { lista = await cargarRevisionSalud(); } catch (e) {
    $("salud-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Se activa al ejecutar supabase/29_productos_salud.sql.</p>';
    return;
  }
  try { ds = await cargarDatosSanitariosPorRevisar(); } catch (e) { /* sin el SQL 29 */ }
  $("n-salud").textContent = lista.length ? "(" + lista.length + ")" : "";
  $("salud-lista").innerHTML = lista.length ? lista.map(r => {
    const ver = r.tipo === "anuncio" ? `anuncio.html?id=${r.ref_id}` : `tienda.html?id=${r.comercio_id}`;
    return `<article class="bg-white border border-slate-200 rounded-xl p-3 text-sm" data-salud="${r.id}" data-tipo="${esc(r.tipo)}" data-ref="${r.ref_id}">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${r.tipo === "anuncio" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}">${r.tipo === "anuncio" ? "📢 Anuncio" : "🛍️ Producto de vitrina"}</span>
        <span class="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">💊 «${esc(r.coincide)}»</span>
        <span class="text-xs text-slate-400">${esc(fechaCorta(r.creado_en))}</span>
      </div>
      <p class="mt-1 text-slate-700">${esc(r.texto)}</p>
      <div class="flex flex-wrap gap-2 mt-2">
        <a href="${ver}" target="_blank" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">👁️ Ver</a>
        <button type="button" data-sacc="ocultado" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🚫 Ocultar</button>
        <button type="button" data-sacc="permitido" class="text-xs bg-white border border-green-300 text-green-800 hover:bg-green-50 px-3 py-1.5 rounded-lg font-semibold">✅ Está permitido</button>
      </div>
    </article>`;
  }).join("") : '<p class="text-sm text-slate-400 text-center py-4">Nada que parezca medicamento. ✨</p>';
  $("n-dsan").textContent = ds.length ? "(" + ds.length + ")" : "";
  $("dsan-lista").innerHTML = ds.length ? ds.map(d => {
    const c = d.comercio || {};
    return `<div class="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
      <b>${esc(c.nombre || "Comercio #" + d.comercio_id)}</b>
      <span class="text-xs text-slate-500">${esc(d.razon_social)} · NIT ${esc(d.nit)}</span>
      <span class="text-xs text-slate-400">${esc(fechaCorta(d.actualizado_en))}</span>
      <a href="admin-comercios.html?editar=${d.comercio_id}" class="ml-auto text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold">🧾 Revisar →</a>
    </div>`;
  }).join("") : '<p class="text-sm text-slate-400 text-center py-3">No hay datos sanitarios por revisar.</p>';
}
// ---------- 🚫 Palabras prohibidas (fase 2AC) ----------
function tarjetaRevision(r, etiqueta) {
  const ver = r.tipo === "anuncio" ? `anuncio.html?id=${r.ref_id}` : `tienda.html?id=${r.comercio_id}`;
  return `<article class="bg-white border border-slate-200 rounded-xl p-3 text-sm" data-salud="${r.id}" data-tipo="${esc(r.tipo)}" data-ref="${r.ref_id}">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${r.tipo === "anuncio" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}">${r.tipo === "anuncio" ? "📢 Anuncio" : "🛍️ Producto de vitrina"}</span>
      <span class="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">${etiqueta} «${esc(r.coincide)}»</span>
      <span class="text-xs text-slate-400">${esc(fechaCorta(r.creado_en))}</span>
    </div>
    <p class="mt-1 text-slate-700">${esc(r.texto)}</p>
    <div class="flex flex-wrap gap-2 mt-2">
      <a href="${ver}" target="_blank" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">👁️ Ver</a>
      <button type="button" data-sacc="ocultado" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🚫 Ocultar</button>
      <button type="button" data-sacc="permitido" class="text-xs bg-white border border-green-300 text-green-800 hover:bg-green-50 px-3 py-1.5 rounded-lg font-semibold">✅ Está permitido</button>
    </div>
  </article>`;
}
async function pintarPalabras() {
  let cola = [], lista = [];
  try { [cola, lista] = await Promise.all([cargarRevisionSalud("palabra"), cargarPalabrasProhibidas()]); }
  catch (e) { $("palabras-cola").innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Se activa al ejecutar supabase/32_palabras_y_seleccion.sql.</p>'; return; }
  $("n-palabras-cola").textContent = cola.length ? "(" + cola.length + ")" : "";
  $("palabras-cola").innerHTML = cola.length ? cola.map(r => tarjetaRevision(r, "🚫")).join("") : '<p class="text-sm text-slate-400 text-center py-4">Nada con palabras de la lista. ✨</p>';
  $("n-palabras").textContent = "(" + lista.length + ")";
  $("pp-lista").innerHTML = lista.map(p => `<span class="pp-chip ${p.accion}${p.activo ? "" : " apagada"}" data-pp="${p.id}" title="${esc(p.nota || "")}">
      ${p.accion === "bloquear" ? "⛔" : "👀"} ${esc(p.palabra)}
      <button type="button" data-ppacc="accion" title="Cambiar a ${p.accion === "bloquear" ? "revisar" : "bloquear"}" aria-label="Cambiar acción">⇄</button>
      <button type="button" data-ppacc="activo" title="${p.activo ? "Apagar" : "Encender"}" aria-label="${p.activo ? "Apagar" : "Encender"}">${p.activo ? "⏸" : "▶"}</button>
      <button type="button" data-ppacc="borrar" title="Borrar" aria-label="Borrar">✕</button>
    </span>`).join("");
  palabrasCache = lista;
}
let palabrasCache = [];
async function accionPalabra(e) {
  const b = e.target.closest("[data-ppacc]"); const chip = e.target.closest("[data-pp]");
  if (!b || !chip) return;
  const p = palabrasCache.find(x => x.id === Number(chip.dataset.pp)); if (!p) return;
  try {
    if (b.dataset.ppacc === "borrar") { if (!confirm(`¿Borrar «${p.palabra}» de la lista?`)) return; await borrarPalabraProhibida(p.id); }
    else if (b.dataset.ppacc === "accion") await guardarPalabraProhibida({ id: p.id, accion: p.accion === "bloquear" ? "revisar" : "bloquear" });
    else await guardarPalabraProhibida({ id: p.id, activo: !p.activo });
    await pintarPalabras();
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
}
async function agregarPalabra() {
  const palabra = $("pp-palabra").value.trim();
  if (palabra.length < 2) { mostrarToast("Escribe la palabra o frase", "error"); return; }
  try {
    await guardarPalabraProhibida({ palabra, accion: $("pp-accion").value, nota: $("pp-nota").value.trim() || null });
    $("pp-palabra").value = ""; $("pp-nota").value = "";
    mostrarToast("✅ Agregada. Aplica a lo que se publique o edite desde ahora");
    await pintarPalabras();
  } catch (err) { mostrarToast(/duplicate|unique/i.test(err.message || "") ? "Esa palabra ya está en la lista" : mensajeError(err), "error"); }
}

// ---------- Fase 2AL: frases permitidas y pedidos de revisión ----------
let permitidasCache = [];
async function pintarPermitidas() {
  if (!esAdmin()) return;
  try {
    permitidasCache = await cargarPalabrasPermitidas();
    $("n-permitidas").textContent = "(" + permitidasCache.filter(p => p.activo).length + ")";
    $("pf-lista").innerHTML = permitidasCache.map(p => `<span class="pp-chip revisar${p.activo ? "" : " apagada"}" data-pf="${p.id}" title="${esc(p.nota || "")}">✅ ${esc(p.frase)}${p.categoria ? ` <small class="opacity-70">(${esc(p.categoria)})</small>` : ""}
        <button type="button" data-pfacc="borrar" title="Borrar" aria-label="Borrar">✕</button></span>`).join("");
    if ($("pf-cat").options.length < 2) $("pf-cat").insertAdjacentHTML("beforeend", CATEGORIAS.filter(c => c.id !== "todos").map(c => `<option value="${c.id}">${esc(c.icono + " " + c.nombre)}</option>`).join(""));
  } catch (e) { $("pf-lista").innerHTML = '<p class="text-sm text-slate-400">Se activa al ejecutar supabase/39_reglas_prohibidos.sql.</p>'; }
  try {
    const sr = await cargarSolicitudesRevision();
    $("n-solrev").textContent = sr.length ? "(" + sr.length + ")" : "";
    $("solrev-lista").innerHTML = sr.length ? sr.map(r => `<div class="bg-white border border-slate-200 rounded-xl p-3 text-sm" data-solrev="${r.id}">
        <p><b>${esc((r.usuario && r.usuario.nombre) || "Alguien")}</b> · <span class="text-xs text-slate-400">${esc(fechaCorta(r.creado_en))}</span> · bloqueado por «<b>${esc(r.palabra || "?")}</b>»</p>
        <p class="text-slate-600 mt-1">“${esc(r.texto)}”</p>
        <div class="flex flex-wrap gap-2 mt-2"><input data-sr-frase maxlength="60" value="${esc(r.palabra || "")}" class="flex-1 min-w-[10rem] border border-slate-300 p-1.5 rounded-lg text-xs" aria-label="Frase a permitir">
          <button type="button" data-sracc="permitir" class="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold">✅ Permitir esta frase</button>
          <button type="button" data-sracc="rechazar" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">Rechazar</button></div>
      </div>`).join("") : '<p class="text-sm text-slate-400">Nadie ha pedido revisión. ✨</p>';
  } catch (e) { $("solrev-lista").innerHTML = ""; }
}
async function accionPermitidas(e) {
  const b = e.target.closest("[data-pfacc]"), chip = e.target.closest("[data-pf]");
  if (b && chip) {
    const p = permitidasCache.find(x => x.id === Number(chip.dataset.pf));
    if (!p || !confirm(`¿Quitar «${p.frase}» de las frases permitidas?`)) return;
    try { await borrarPalabraPermitida(p.id); await pintarPermitidas(); } catch (err) { mostrarToast(mensajeError(err), "error"); }
  }
}
async function agregarPermitida(frase, categoria) {
  frase = (frase || "").trim();
  if (frase.length < 2) { mostrarToast("Escribe la frase", "error"); return false; }
  try {
    await guardarPalabraPermitida({ frase, categoria: categoria || null });
    mostrarToast("✅ Permitida. Lo publicado se volvió a revisar"); await pintarPermitidas(); await pintarPalabras(); return true;
  } catch (err) { mostrarToast(/duplicate|unique/i.test(err.message || "") ? "Esa frase ya está permitida" : mensajeError(err), "error"); return false; }
}
async function accionSolicitudRevision(e) {
  const b = e.target.closest("[data-sracc]"), fila = e.target.closest("[data-solrev]");
  if (!b || !fila) return;
  b.disabled = true;
  try {
    if (b.dataset.sracc === "permitir") {
      const frase = fila.querySelector("[data-sr-frase]").value;
      if (!confirm(`¿Permitir «${frase}»? Escribe la frase completa (ej. «pistola de pegamento»), no solo la palabra, para no abrir la puerta a lo prohibido.`)) { b.disabled = false; return; }
      if (!(await agregarPermitida(frase, null))) { b.disabled = false; return; }
    }
    await resolverSolicitudRevision(Number(fila.dataset.solrev), b.dataset.sracc === "permitir" ? "permitida" : "rechazada");
    await pintarPermitidas();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}
// ---------- Fase 2AL: sanciones (solo administrador) ----------
async function sancionarDesdeBoton(b) {
  const tipo = b.dataset.sancion, usuario = b.dataset.usuario;
  const etiqueta = { aviso: "un AVISO", suspension: "una SUSPENSIÓN de 30 días", veto: "el BLOQUEO DEFINITIVO (veto)", levantar: "levantar la sanción" }[tipo];
  const motivo = prompt(`Vas a aplicar ${etiqueta}. Escribe el motivo (la persona lo verá):`, tipo === "veto" ? "Publicó contenido prohibido (tolerancia cero)" : tipo === "levantar" ? "Revisado: se levanta la sanción" : "Incumplió los Términos de Merkap");
  if (motivo === null) return false;
  if (tipo === "veto" && !confirm("El veto oculta todos sus anuncios, le quita sus comercios y bloquea su WhatsApp, teléfono y correo. ¿Continuar?")) return false;
  b.disabled = true;
  try { await sancionarUsuario(usuario, tipo, motivo); mostrarToast("⚖️ Listo: " + etiqueta); return true; }
  catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); return false; }
}
const botonesSancionHTML = (usuarioId, p) => `<span class="solo-admin inline-flex flex-wrap gap-1.5">
  ${p && (p.vetado || p.suspendido_hasta && Date.parse(p.suspendido_hasta) > Date.now())
    ? `<button type="button" data-sancion="levantar" data-usuario="${esc(usuarioId)}" class="text-xs bg-white border border-green-300 text-green-800 px-2.5 py-1.5 rounded-lg font-semibold">↩️ Levantar sanción</button>`
    : `<button type="button" data-sancion="aviso" data-usuario="${esc(usuarioId)}" class="text-xs bg-white border border-amber-300 text-amber-800 px-2.5 py-1.5 rounded-lg font-semibold">⚠️ Aviso</button>
       <button type="button" data-sancion="suspension" data-usuario="${esc(usuarioId)}" class="text-xs bg-white border border-orange-300 text-orange-800 px-2.5 py-1.5 rounded-lg font-semibold">⏸ Suspender 30 días</button>
       <button type="button" data-sancion="veto" data-usuario="${esc(usuarioId)}" class="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-semibold">🚫 Vetar</button>`}</span>`;

async function accionSalud(e) {
  const b = e.target.closest("[data-sacc]");
  const art = e.target.closest("[data-salud]");
  if (!b || !art) return;
  art.querySelectorAll("button").forEach(x => { x.disabled = true; });
  try {
    if (b.dataset.sacc === "ocultado") {
      const ref = Number(art.dataset.ref);
      if (art.dataset.tipo === "anuncio") await cambiarVisibilidadAnuncio(ref, "oculto");
      else await ocultarProducto(ref, true);
    }
    await resolverRevisionSalud(Number(art.dataset.salud), b.dataset.sacc);
    mostrarToast(b.dataset.sacc === "ocultado" ? "🚫 Ocultado" : "✅ Marcado como permitido");
    await (art.closest("#palabras-cola") ? pintarPalabras() : pintarSalud());
  } catch (err) { art.querySelectorAll("button").forEach(x => { x.disabled = false; }); mostrarToast(mensajeError(err), "error"); }
}

// ---------- Opiniones (calificaciones) reportadas ----------
function tarjetaReporteCalificacion(r) {
  const q = r.calificacion;
  const com = q && q.comercio;
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-rcal="${r.id}" data-cal="${q ? q.id : ""}">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-bold">${q ? `<span class="text-amber-500">${estrellasTexto(q.estrellas)}</span> ${esc(q.autor_nombre || "Usuario")}` : "(opinión eliminada)"}</h3>
      <span class="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">${esc(MOTIVOS_REPORTE_CALIFICACION[r.motivo] || r.motivo)}</span>
      ${q && q.oculto ? '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Oculta</span>' : ""}
      <span class="text-xs text-slate-400">${esc(fechaCorta(r.creado_en))}</span>
    </div>
    ${com ? `<p class="text-xs text-slate-500 mt-0.5">Comercio: ${esc(com.nombre)}</p>` : ""}
    ${q && q.comentario ? `<p class="text-sm text-slate-700 mt-2 bg-slate-50 rounded-lg p-2">“${esc(q.comentario)}”</p>` : ""}
    ${r.detalle ? `<p class="text-xs text-slate-500 mt-1">Quien reporta dice: “${esc(r.detalle)}”</p>` : ""}
    <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      ${q ? `<a href="tienda.html?id=${q.comercio_id}#opiniones" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">Ver en la ficha</a>` : ""}
      ${q && !q.oculto ? '<button type="button" data-qacc="ocultar" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🙈 Ocultar opinión</button>' : ""}
      <button type="button" data-qacc="revisado" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✔ Revisado</button>
      <button type="button" data-qacc="descartado" class="text-xs bg-white border border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg font-semibold">Descartar (está bien)</button>
    </div>
  </article>`;
}

async function pintarReportesCalificacion() {
  try {
    const lista = await cargarReportesCalificacion("pendiente");
    $("n-rcal").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("rcal-lista").innerHTML = lista.length ? lista.map(tarjetaReporteCalificacion).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">No hay opiniones reportadas pendientes.</p>';
  } catch (e) {
    // Si aún no se ejecutó el SQL 12, la sección queda vacía sin romper el resto
    $("rcal-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Las calificaciones se activan al ejecutar supabase/12_calificaciones.sql.</p>';
  }
}

async function accionReporteCalificacion(e) {
  const b = e.target.closest("[data-qacc]");
  const t = e.target.closest("[data-rcal]");
  if (!b || !t) return;
  b.disabled = true;
  try {
    if (b.dataset.qacc === "ocultar") {
      await ocultarCalificacion(Number(t.dataset.cal), true);
      await resolverReporteCalificacion(Number(t.dataset.rcal), "revisado");
      mostrarToast("🙈 Opinión ocultada (ya no cuenta en el promedio)");
    } else {
      await resolverReporteCalificacion(Number(t.dataset.rcal), b.dataset.qacc);
      mostrarToast("✔ Hecho");
    }
    await pintarReportesCalificacion();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

// ---------- Categorías de anuncios (fase 2Z, supabase/19_categorias_anuncio.sql) ----------
let catsAnuncioAdmin = [];
let usosCatAnuncio = {};
const idDesdeNombre = n => slugRef(n).replace(/-/g, "_").slice(0, 30);

// «Pinturas, Tejidos» → [{id, nombre}] conservando el id de las que ya existían (por nombre)
function subcategoriasDesdeTexto(texto, actuales) {
  const usados = new Set();
  return String(texto || "").split(",").map(x => x.trim()).filter(x => x.length >= 2).slice(0, 20).map(nombre => {
    const previa = (actuales || []).find(s => normalizar(s.nombre) === normalizar(nombre));
    let id = previa ? previa.id : idDesdeNombre(nombre);
    if (id.length < 2) id = "sub_" + (usados.size + 1);
    while (usados.has(id)) id = (id + "_2").slice(0, 30);
    usados.add(id);
    return { id, nombre: nombre.slice(0, 40) };
  });
}

function filaCatAnuncio(c) {
  const subs = Array.isArray(c.subcategorias) ? c.subcategorias : [];
  const n = usosCatAnuncio[c.id] || 0;
  return `<div class="border border-slate-200 rounded-xl p-2.5 ${c.activo === false ? "opacity-60" : ""}" data-cat-a="${esc(c.id)}">
    <div class="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_1.4fr_1.4fr_4.5rem_auto] gap-2 items-end">
      <div class="text-[11px] font-bold text-slate-500">Ícono<div class="mt-0.5 flex items-center"><input data-c="icono" data-emoji maxlength="8" aria-label="Ícono" value="${esc(c.icono)}" class="w-12 border border-slate-300 p-1.5 rounded-lg text-center text-lg">${BOTON_EMOJI}</div></div>
      <label class="text-[11px] font-bold text-slate-500">Nombre <span class="font-normal text-slate-400">(${esc(c.id)} · ${n} activo${n === 1 ? "" : "s"})</span><input data-c="nombre" maxlength="40" value="${esc(c.nombre)}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <label class="text-[11px] font-bold text-slate-500 col-span-2 sm:col-span-1">Subcategorías<textarea data-c="subs" rows="1" maxlength="600" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-xs">${esc(subs.map(s => s.nombre).join(", "))}</textarea></label>
      <label class="text-[11px] font-bold text-slate-500 col-span-2 sm:col-span-1">Palabras clave<textarea data-c="palabras" rows="1" maxlength="1500" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-xs">${esc(c.palabras || "")}</textarea></label>
      <label class="text-[11px] font-bold text-slate-500">Orden<input data-c="orden" type="number" value="${Number(c.orden) || 100}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <div class="flex items-center gap-2">
        <label class="text-xs flex items-center gap-1"><input type="checkbox" data-c="activo" ${c.activo === false ? "" : "checked"}> Activa</label>
        <button type="button" data-ca-guardar class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">Guardar</button>
      </div>
    </div>
  </div>`;
}

async function pintarCatsAnuncio() {
  try {
    catsAnuncioAdmin = await cargarCategoriasAnuncioAdmin();
    if (!catsAnuncioAdmin.length) throw new Error("vacía");
    usosCatAnuncio = {};
    baseDatosAnuncios.forEach(a => { usosCatAnuncio[a.categoria] = (usosCatAnuncio[a.categoria] || 0) + 1; });
    $("ca-n").textContent = "(" + catsAnuncioAdmin.length + ")";
    $("ca-lista").innerHTML = catsAnuncioAdmin.map(filaCatAnuncio).join("");
  } catch (e) {
    $("ca-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Se activa al ejecutar supabase/19_categorias_anuncio.sql.</p>';
  }
}

async function accionCatAnuncio(e) {
  const b = e.target.closest("[data-ca-guardar]");
  if (!b) return;
  const f = b.closest("[data-cat-a]");
  const v = k => f.querySelector(`[data-c="${k}"]`);
  const actual = catsAnuncioAdmin.find(c => c.id === f.dataset.catA) || {};
  const nombre = v("nombre").value.trim();
  if (nombre.length < 2) { mostrarToast("Escribe el nombre de la categoría", "error"); return; }
  b.disabled = true;
  try {
    await guardarCategoriaAnuncioDB({ id: f.dataset.catA, nombre, icono: v("icono").value.trim() || "📦",
      palabras: v("palabras").value.trim(), subcategorias: subcategoriasDesdeTexto(v("subs").value, actual.subcategorias),
      orden: parseInt(v("orden").value, 10) || 100, activo: v("activo").checked });
    mostrarToast("✅ Categoría guardada");
    await pintarCatsAnuncio();
  } catch (err) { mostrarToast(mensajeError(err), "error"); b.disabled = false; }
}

async function crearCatAnuncio() {
  const nombre = $("ca-nuevo-nombre").value.trim();
  const id = idDesdeNombre(nombre);
  if (nombre.length < 2 || id.length < 2) { mostrarToast("Escribe el nombre de la nueva categoría", "error"); return; }
  if (id === "todos" || catsAnuncioAdmin.some(c => c.id === id)) { mostrarToast("Ya existe una categoría con ese nombre", "error"); return; }
  const b = $("ca-crear"); b.disabled = true;
  try {
    await guardarCategoriaAnuncioDB({ id, nombre, icono: $("ca-nuevo-icono").value.trim() || "📦", palabras: nombre.toLowerCase(),
      subcategorias: subcategoriasDesdeTexto($("ca-nuevo-subs").value, []), orden: 500, activo: true });
    $("ca-nuevo-nombre").value = ""; $("ca-nuevo-subs").value = "";
    mostrarToast("✅ Categoría creada: ya aparece al publicar y en los filtros");
    await pintarCatsAnuncio();
  } catch (err) {
    mostrarToast(/categorias_anuncio|does not exist/i.test(err.message || "") ? "Primero ejecuta supabase/19_categorias_anuncio.sql" : mensajeError(err), "error");
  } finally { b.disabled = false; }
}

// ---------- Categorías de comercios (fase 2Z.5; tabla de supabase/15_categorias_comercio.sql) ----------
// Igual que las de anuncios pero sin subcategorías. TIPOS_COMERCIO se recarga al guardar (guardarCategoriaDB).
function filaCatComercio(t) {
  return `<div class="border border-slate-200 rounded-xl p-2.5 ${t.activo === false ? "opacity-60" : ""}" data-cat-c="${esc(t.id)}">
    <div class="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_2fr_4.5rem_auto] gap-2 items-end">
      <div class="text-[11px] font-bold text-slate-500">Ícono<div class="mt-0.5 flex items-center"><input data-c="icono" data-emoji maxlength="8" aria-label="Ícono" value="${esc(t.icono)}" class="w-12 border border-slate-300 p-1.5 rounded-lg text-center text-lg">${BOTON_EMOJI}</div></div>
      <label class="text-[11px] font-bold text-slate-500">Nombre <span class="font-normal text-slate-400">(${esc(t.id)})</span><input data-c="nombre" maxlength="40" value="${esc(t.nombre)}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <label class="text-[11px] font-bold text-slate-500 col-span-2 sm:col-span-1">Palabras clave<textarea data-c="palabras" rows="1" maxlength="1500" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-xs">${esc(t.palabras || "")}</textarea></label>
      <label class="text-[11px] font-bold text-slate-500">Orden<input data-c="orden" type="number" value="${Number(t.orden) || 100}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <div class="flex items-center gap-2">
        <label class="text-xs flex items-center gap-1"><input type="checkbox" data-c="activo" ${t.activo === false ? "" : "checked"}> Activa</label>
        <button type="button" data-cc-guardar class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">Guardar</button>
      </div>
    </div>
  </div>`;
}
async function pintarCatsComercio() {
  await cargarCategoriasComercio();
  $("cc-n").textContent = "(" + TIPOS_COMERCIO.length + ")";
  $("cc-lista").innerHTML = TIPOS_COMERCIO.map(filaCatComercio).join("");
}
const avisoTablaComercio = err => /categorias_comercio|does not exist/i.test((err && err.message) || "") ? "Primero ejecuta supabase/15_categorias_comercio.sql" : mensajeError(err);
async function accionCatComercio(e) {
  const b = e.target.closest("[data-cc-guardar]");
  if (!b) return;
  const f = b.closest("[data-cat-c]");
  const v = k => f.querySelector(`[data-c="${k}"]`);
  const nombre = v("nombre").value.trim();
  if (nombre.length < 2) { mostrarToast("Escribe el nombre de la categoría", "error"); return; }
  b.disabled = true;
  try {
    await guardarCategoriaDB({ id: f.dataset.catC, nombre, icono: v("icono").value.trim() || "🏪",
      palabras: v("palabras").value.trim(), orden: parseInt(v("orden").value, 10) || 100, activo: v("activo").checked });
    mostrarToast("✅ Categoría guardada");
    await pintarCatsComercio();
  } catch (err) { mostrarToast(avisoTablaComercio(err), "error"); b.disabled = false; }
}
async function crearCatComercio() {
  const nombre = $("cc-nuevo-nombre").value.trim();
  const id = idDesdeNombre(nombre);
  if (nombre.length < 2 || id.length < 2) { mostrarToast("Escribe el nombre de la nueva categoría", "error"); return; }
  if (TIPOS_COMERCIO.some(t => t.id === id || normalizar(t.nombre) === normalizar(nombre))) { mostrarToast("Ya existe una categoría con ese nombre", "error"); return; }
  const b = $("cc-crear"); b.disabled = true;
  try {
    const extra = $("cc-nuevo-palabras").value.trim();
    await guardarCategoriaDB({ id, nombre, icono: $("cc-nuevo-icono").value.trim() || "🏪",
      palabras: [nombre.toLowerCase(), extra].filter(Boolean).join(", ").slice(0, 1500), orden: 500, activo: true });
    $("cc-nuevo-nombre").value = ""; $("cc-nuevo-palabras").value = ""; $("cc-nuevo-icono").value = "🏪";
    mostrarToast("✅ Categoría creada: ya aparece al registrar comercios y en el directorio");
    await pintarCatsComercio();
  } catch (err) { mostrarToast(avisoTablaComercio(err), "error"); }
  finally { b.disabled = false; }
}

// ---------- Comercios recomendados por la gente (fase 2X, supabase/17_recomendaciones.sql) ----------
function tarjetaRecomendacion(r) {
  const t = TIPOS_COMERCIO.find(x => x.id === r.tipo);
  const m = municipios.find(x => x.id === r.municipio_id);
  const foto = urlSegura(r.foto_url);
  const conPunto = r.lat != null && r.lng != null;
  // ¿Ya existe algo parecido? Mismo nombre en el municipio, o cualquier comercio a menos de 60 m
  const parecidos = comercios.filter(c => c.municipioId === r.municipio_id && (normalizar(c.nombre) === normalizar(r.nombre)
    || (conPunto && tieneCoords(c) && distanciaKm(c, { lat: Number(r.lat), lng: Number(r.lng) }) < 0.06))).slice(0, 3);
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex gap-3" data-recom="${r.id}">
    ${foto ? `<a href="${esc(foto)}" target="_blank" rel="noopener" class="shrink-0"><img src="${esc(foto)}" alt="Fachada" class="w-20 h-20 object-cover rounded-lg border border-slate-200"></a>` : `<div class="shrink-0 w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-3xl">${esc(t ? t.icono : "🏪")}</div>`}
    <div class="min-w-0 flex-1">
      <p class="font-black text-slate-900">${esc(r.nombre)}</p>
      <p class="text-xs text-slate-500">${esc(t ? t.icono + " " + t.nombre : r.tipo)} · ${esc(m ? m.nombre + ", " + m.departamento : "")}</p>
      ${r.direccion ? `<p class="text-sm text-slate-700 mt-1">📍 ${esc(r.direccion)}</p>` : ""}
      ${conPunto ? `<a href="${esc(urlGoogleMaps(Number(r.lat), Number(r.lng)))}" target="_blank" rel="noopener" class="text-xs text-indigo-600 underline">🗺️ Ver el punto GPS en el mapa</a>` : ""}
      ${r.comentario ? `<p class="text-sm text-slate-600 italic mt-1">«${esc(r.comentario)}»</p>` : ""}
      <p class="text-[11px] text-slate-400 mt-1">Recomendado por ${esc((r.autor && r.autor.nombre) || "alguien")} · ${esc(fechaCorta(r.creado_en))}</p>
      ${parecidos.length ? `<p class="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-2 py-1 mt-2">⚠️ Puede que ya exista: ${parecidos.map(c => `<a href="tienda.html?id=${c.id}" target="_blank" rel="noopener" class="underline">${esc(c.nombre)}</a>`).join(", ")}</p>` : ""}
      <div class="flex flex-wrap gap-2 mt-3">
        <a href="admin-comercios.html?recomendacion=${r.id}" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg">➕ Crear comercio</a>
        <button type="button" data-racc="descartado" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-3 py-1.5 rounded-lg">Descartar</button>
      </div>
    </div>
  </article>`;
}

async function pintarRecomendaciones() {
  try {
    if (!comercios.length) await cargarComercios();
    const lista = await cargarRecomendaciones("pendiente");
    $("n-recom").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("recom-lista").innerHTML = lista.length ? lista.map(tarjetaRecomendacion).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">No hay recomendaciones pendientes.</p>';
  } catch (e) {
    $("recom-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Se activa al ejecutar supabase/17_recomendaciones.sql.</p>';
  }
}

async function accionRecomendacion(e) {
  const b = e.target.closest("[data-racc]");
  const t = e.target.closest("[data-recom]");
  if (!b || !t) return;
  if (!confirm("¿Descartar esta recomendación? (ya existe, no es real o está repetida)")) return;
  b.disabled = true;
  try {
    await resolverRecomendacion(Number(t.dataset.recom), b.dataset.racc);
    mostrarToast("✔ Descartada");
    await pintarRecomendaciones();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

// Categorías para «Enseñar»: de comercios y de anuncios (fase 2Z.2), valor "c:id" / "a:id"
function opcionesEnsenar() {
  const c = TIPOS_COMERCIO.filter(t => t.activo !== false).map(t => `<option value="c:${esc(t.id)}">${t.icono} ${esc(t.nombre)}</option>`).join("");
  const a = CATEGORIAS.filter(x => x.id !== "todos" && x.activo !== false).map(x => `<option value="a:${esc(x.id)}">${x.icono} ${esc(x.nombre)}</option>`).join("");
  return `<option value="">Elige la categoría…</option><optgroup label="🏪 Comercios">${c}</optgroup><optgroup label="📢 Anuncios">${a}</optgroup>`;
}

// ---------- Lo que la gente busca y no encuentra (fase 2W, supabase/16_busquedas.sql) ----------
function filaBusqueda(b) {
  return `<article class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2" data-busq="${esc(b.termino)}">
    <div class="min-w-0 basis-full sm:basis-0 sm:flex-1">
      <p class="font-bold text-slate-900">«${esc(b.termino)}»
        <a href="buscar.html?q=${encodeURIComponent(b.termino)}" target="_blank" rel="noopener" class="text-xs font-semibold text-indigo-600 underline ml-1">probar</a></p>
      <p class="text-xs text-slate-500">${b.veces_sin_result} ${b.veces_sin_result === 1 ? "vez" : "veces"} sin resultados · buscada ${b.veces} en total · última: ${esc(fechaCorta(b.ultima_vez))}</p>
    </div>
    <select data-busq-cat aria-label="Categoría a la que corresponde" class="solo-admin basis-full sm:basis-auto min-w-0 border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white sm:max-w-[13rem]">${opcionesEnsenar()}</select>
    <button type="button" data-bacc="ensenar" class="solo-admin bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg">🧠 Enseñar</button>
    <button type="button" data-bacc="resuelta" class="solo-admin bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-3 py-1.5 rounded-lg" title="Ya se resolvió (ej. agregaste el comercio)">✔ Ya está</button>
    <button type="button" data-bacc="borrar" class="solo-admin text-sm text-slate-400 hover:text-red-600 px-2" title="Borrar (spam o sin sentido)" aria-label="Borrar">🗑️</button>
  </article>`;
}

async function pintarBusquedas() {
  try {
    await cargarCategoriasComercio();
    const todas = await cargarBusquedas();
    const sin = todas.filter(b => b.veces_sin_result > 0 && b.ultimos_resultados === 0);
    $("n-busq").textContent = sin.length ? "(" + sin.length + ")" : "";
    $("busq-lista").innerHTML = sin.length ? sin.slice(0, 60).map(filaBusqueda).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">Nada pendiente: todo lo que se busca tiene resultados. 🎉</p>';
    const top = todas.filter(b => b.ultimos_resultados > 0).sort((a, b) => b.veces - a.veces).slice(0, 15);
    $("busq-top").innerHTML = top.map(b => `<li><b>${esc(b.termino)}</b> · ${b.veces} ${b.veces === 1 ? "vez" : "veces"}</li>`).join("");
    $("busq-top-caja").classList.toggle("hidden", !top.length);
  } catch (e) {
    $("busq-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Se activa al ejecutar supabase/16_busquedas.sql.</p>';
  }
}

async function accionBusqueda(e) {
  const b = e.target.closest("[data-bacc]");
  const fila = e.target.closest("[data-busq]");
  if (!b || !fila) return;
  const termino = fila.dataset.busq;
  try {
    if (b.dataset.bacc === "ensenar") {
      const cat = fila.querySelector("[data-busq-cat]").value;
      if (!cat) { mostrarToast("Primero elige la categoría a la que corresponde", "error"); return; }
      b.disabled = true;
      await ensenarPalabraCategoria(cat, termino);
      const [tipo, id] = cat.split(":");
      const t = (tipo === "a" ? CATEGORIAS : TIPOS_COMERCIO).find(x => x.id === id);
      mostrarToast(`🧠 Aprendido: «${termino}» ahora encuentra ${t ? t.nombre : id}`);
    } else if (b.dataset.bacc === "resuelta") {
      b.disabled = true; await marcarBusquedaResuelta(termino); mostrarToast("✔ Marcada como resuelta");
    } else if (b.dataset.bacc === "borrar") {
      if (!confirm(`¿Borrar «${termino}» de la lista?`)) return;
      b.disabled = true; await borrarBusqueda(termino); mostrarToast("🗑️ Borrada");
    }
    await pintarBusquedas();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

// ---------- Negocios nuevos por revisar (registrar-negocio.html) ----------
const meterNegocios = {};   // señales ya cargadas por solicitud

function etiquetaTipo(id) { const t = TIPOS_COMERCIO.find(x => x.id === id); return t ? `${t.icono} ${t.nombre}` : id; }

function tarjetaNegocio(n) {
  const mun = municipios.find(x => x.id === n.municipio_id);
  const foto = urlSegura(n.foto_fachada_url);
  const wa = n.whatsapp ? urlWhatsAppTexto(n.whatsapp, `Hola, te escribe Merkap. Recibimos el registro de «${n.nombre}» (${n.direccion}). ¿Nos confirmas que eres el dueño o administrador del negocio?`) : "";
  const tel = String(n.telefono || "").replace(/[^\d+]/g, "");
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-neg="${n.id}">
    <div class="flex gap-3">
      ${foto ? `<a href="${esc(foto)}" target="_blank" rel="noopener" class="shrink-0"><img src="${esc(foto)}" alt="Fachada de ${esc(n.nombre)}" loading="lazy" class="w-24 h-24 object-cover rounded-xl border border-slate-200"></a>` : ""}
      <div class="min-w-0">
        <h3 class="font-bold leading-tight">${esc(n.nombre)}</h3>
        <p class="text-xs text-slate-500">${esc(etiquetaTipo(n.tipo))} · ${esc(mun ? mun.nombre : "")}</p>
        ${n.modo_atencion && n.modo_atencion !== "local" ? `<p class="mt-1"><span class="badge-modo ${n.modo_atencion}">${MODOS_ATENCION[n.modo_atencion].icono} ${MODOS_ATENCION[n.modo_atencion].nombre}</span> <span class="text-[11px] text-slate-500">La dirección es privada: en el mapa saldrá solo la zona. La foto puede ser de sus productos.</span></p>` : ""}
        <p class="text-sm text-slate-600 mt-1">📍 ${esc(n.direccion)}</p>
        ${n.horario ? `<p class="text-xs text-slate-500">🕒 ${esc(n.horario)}</p>` : ""}
        <p class="text-xs text-slate-400 mt-0.5">Enviado por ${esc(n.solicitante ? n.solicitante.nombre : "—")} · ${esc(fechaCorta(n.creado_en))}</p>
      </div>
    </div>
    ${n.descripcion ? `<p class="text-sm text-slate-600 mt-2">“${esc(n.descripcion)}”</p>` : ""}
    ${n.datos_sanitarios ? (d => `<div class="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900">
      <b>🧾 Datos sanitarios (privados):</b> ${esc(TIPOS_ESTABLECIMIENTO_SALUD[d.tipo_establecimiento] || d.tipo_establecimiento || "")}<br>
      ${esc(d.razon_social || "")} · NIT <b>${esc(d.nit || "")}</b> · Director técnico: ${esc(d.director_tecnico || "")}
      ${d.acta_numero || d.acta_fecha ? `<br>Acta/concepto: ${esc(d.acta_numero || "—")} ${d.acta_fecha ? "(" + esc(d.acta_fecha) + ")" : ""}` : ""}
      <br><span class="text-emerald-700">Revisa el NIT en RUES antes de aprobar. Al aprobar, estos datos pasan solos al comercio.</span></div>`)(n.datos_sanitarios) : ""}
    <div data-senales class="mt-3 text-xs text-slate-400">Calculando señales de confianza…</div>
    <div class="flex flex-wrap gap-2 mt-3">
      ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener" class="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold">💬 Escribir por WhatsApp</a>` : ""}
      ${tel ? `<a href="tel:${esc(tel)}" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">📞 Llamar</a>` : ""}
      <a href="${esc(urlGoogleMaps(n.lat, n.lng))}" target="_blank" rel="noopener" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">🗺️ Ver pin</a>
    </div>
    ${propuestaHTML(n)}
    <div class="solo-admin mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
      <p class="font-bold text-slate-500">Si ya hablaste con el responsable:</p>
      <label class="flex items-start gap-1.5"><input type="checkbox" data-v="nombre_dir" class="mt-0.5"> Confirmó el nombre y la dirección del negocio</label>
      <label class="flex items-start gap-1.5"><input type="checkbox" data-v="telefono_negocio" class="mt-0.5"> El número de contacto es del negocio</label>
    </div>
    <div class="solo-admin flex flex-wrap gap-2 mt-3">
      <button type="button" data-nacc="verificar" disabled class="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed">✅ Aprobar y verificar por teléfono</button>
      <button type="button" data-nacc="aprobar" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">Aprobar (sin verificar aún)</button>
      <button type="button" data-nacc="rechazar" class="text-xs bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold">✖ Rechazar</button>
    </div>
    ${controlesPropuestaHTML("negocio", n.id)}
  </article>`;
}

function pintarSenales(art, n, s) {
  const p = puntajeNegocio(n, s);
  const color = p.total >= 80 ? "bg-green-100 text-green-800" : p.total >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700";
  const cerca = (s.cerca || []).map(c => `${esc(c.nombre)} (${c.metros} m)`).join(", ");
  art.querySelector("[data-senales]").innerHTML = `<div class="flex flex-wrap items-center gap-2 mb-1.5">
      <span class="font-black px-2.5 py-1 rounded-full text-xs ${color}">Confianza ${p.total}/100</span>
      <span class="text-[11px] text-slate-400">Orienta, no reemplaza la llamada</span></div>
    <ul class="grid sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">${p.detalle.map(d => `<li class="${d.ok ? "text-green-700" : "text-red-600"}">${d.ok ? "✔" : "⚠"} ${esc(d.texto)}</li>`).join("")}</ul>
    ${cerca ? `<p class="text-[11px] text-red-600 mt-1">Parecido cerca: ${cerca}</p>` : ""}`;
}

// ---------- ⚡ Piden verificación + 👥 señales de la comunidad (fase 2Z.10) ----------
async function pintarAcelerar() {
  let lista = [], senales = [];
  try { lista = await cargarSolicitudesVerificacion(); } catch (e) {
    $("acel-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Se activa al ejecutar supabase/25_confirmaciones_comercio.sql.</p>';
  }
  try { senales = await cargarSenalesComunidad(); } catch (e) { /* sin el SQL 25 */ }
  $("n-acelerar").textContent = lista.length ? "(" + lista.length + ")" : "";
  if (lista.length || !$("acel-lista").innerHTML) $("acel-lista").innerHTML = lista.length ? lista.map(s => {
    const c = s.comercio || {};
    const mun = municipios.find(x => x.id === c.municipio_id);
    const tel = String(s.telefono || "").replace(/[^\d+]/g, "");
    return `<article class="bg-white border-2 border-amber-300 rounded-2xl p-4 shadow-sm" data-acel="${s.id}">
      <div class="flex flex-wrap items-center gap-2"><b>${esc(c.nombre || "Comercio #" + s.comercio_id)}</b>
        <span class="text-xs text-slate-500">${esc(mun ? mun.nombre : "")}</span>
        <span class="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">⚡ Llamar ${esc(FRANJAS[s.franja] || "")}</span>
        ${c.confirma_si ? `<span class="badge-vecinos">👥 ${c.confirma_si} sí${c.confirma_lugar ? " (" + c.confirma_lugar + " en el lugar)" : ""}</span>` : ""}
        ${c.confirma_no ? `<span class="text-xs text-red-700 font-semibold">🚩 ${c.confirma_no} no</span>` : ""}
      </div>
      <p class="text-xs text-slate-400 mt-0.5">Pedido ${esc(fechaCorta(s.creado_en))}</p>
      <div class="flex flex-wrap gap-2 mt-2">
        ${tel ? `<a href="tel:${esc(tel)}" class="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold">📞 Llamar ${esc(s.telefono)}</a>` : ""}
        <a href="admin-comercios.html?editar=${s.comercio_id}" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">✅ Verificar en «Editar comercios»</a>
        <button type="button" data-acel-hecho class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">✔ Atendida</button>
      </div>
    </article>`;
  }).join("") : '<p class="text-sm text-slate-400 text-center py-4">Nadie ha pedido acelerar su verificación. ✨</p>';
  $("n-senales").textContent = senales.length ? "(" + senales.length + ")" : "";
  $("senales-lista").innerHTML = senales.length ? senales.map(c => `<div class="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
      <a href="tienda.html?id=${c.id}" class="font-semibold text-indigo-700 underline">${esc(c.nombre)}</a><span class="text-xs text-slate-500">${esc(c.ciudad)}</span>
      ${confirmadoPorVecinos(c) ? `<span class="badge-vecinos">👥 ${c.confirmaSi} sí · ${c.confirmaLugar} en el lugar</span>` : c.confirmaSi ? `<span class="text-xs text-slate-600">👍 ${c.confirmaSi}</span>` : ""}
      ${c.confirmaNo ? `<span class="text-xs font-semibold ${comercioDudoso(c) ? "text-red-700" : "text-slate-500"}">🚩 ${c.confirmaNo} dicen que no está</span>` : ""}
      <a href="admin-comercios.html?editar=${c.id}" class="ml-auto text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-semibold">Revisar →</a>
    </div>`).join("") : '<p class="text-sm text-slate-400 text-center py-3">Aún no hay comercios con suficientes votos.</p>';
}
async function accionAcelerar(e) {
  const b = e.target.closest("[data-acel-hecho]");
  if (!b) return;
  b.disabled = true;
  try { await atenderSolicitudVerificacion(Number(b.closest("[data-acel]").dataset.acel)); mostrarToast("✔ Marcada como atendida"); await pintarAcelerar(); }
  catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

async function pintarNegocios() {
  try {
    if (!municipios.length) await cargarMunicipios();
    const lista = await cargarNegociosPendientes("pendiente", false);
    $("n-negocios").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("neg-lista").innerHTML = lista.length ? lista.map(tarjetaNegocio).join("")
      : '<p class="text-sm text-slate-400 text-center py-6">No hay negocios nuevos por revisar.</p>';
    lista.forEach(async n => {
      const art = $("neg-lista").querySelector(`[data-neg="${n.id}"]`);
      try { pintarSenales(art, n, await senalesNegocio(n.id)); }
      catch (e) { art.querySelector("[data-senales]").textContent = "No se pudieron calcular las señales."; }
    });
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
}

// Aprobados sin verificar: que no se pierdan después de aprobarlos
async function pintarAprobadosSinVerificar() {
  try {
    const aprobados = (await cargarNegociosPendientes("aprobado", false)).filter(n => n.comercio_id);
    const niveles = await cargarNivelesComercios(aprobados.map(n => n.comercio_id));
    const lista = aprobados.filter(n => (niveles[n.comercio_id] || 1) === 1);
    $("aprob-caja").classList.toggle("hidden", !lista.length);
    $("n-aprob").textContent = lista.length ? "(" + lista.length + ")" : "";
    $("aprob-lista").innerHTML = lista.map(n => `<div class="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2 text-sm">
      <b>${esc(n.nombre)}</b><span class="text-xs text-slate-500">${esc(etiquetaTipo(n.tipo))}</span>
      <span class="text-xs text-slate-400">${esc(n.direccion)}</span>
      <a href="admin-comercios.html?editar=${n.comercio_id}&verificar=1" class="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold no-underline">✅ Verificar ahora</a>
    </div>`).join("");
  } catch (e) { console.error(e); }
}

async function accionNegocio(e) {
  if (e.type === "click" && await accionPropuesta(e, pintarNegocios)) return;
  const chk = e.target.closest("[data-v]");
  const art = e.target.closest("[data-neg]");
  if (!art) return;
  if (chk) {   // «verificar por teléfono» solo se habilita con las dos comprobaciones
    art.querySelector('[data-nacc="verificar"]').disabled = art.querySelectorAll("[data-v]:checked").length < 2;
    return;
  }
  const b = e.target.closest("[data-nacc]");
  if (!b) return;
  const id = Number(art.dataset.neg), acc = b.dataset.nacc;
  let motivo = null;
  if (acc === "rechazar") {
    motivo = prompt("Motivo del rechazo (lo verá la persona; mínimo 5 letras):", "No pudimos confirmar el negocio");
    if (motivo === null) return;
  }
  art.querySelectorAll("button").forEach(x => { x.disabled = true; });
  try {
    const comercioId = await resolverNegocio(id, acc !== "rechazar", motivo);
    if (acc === "verificar") {
      try {
        await crearVerificacion({ comercioId, metodo: "telefono", resultado: "aprobada", lista: { nombre_dir: true, telefono_negocio: true } });
        mostrarToast("✅ Aprobado y verificado por teléfono");
      } catch (err) { mostrarToast("Aprobado, pero falló la verificación: hazla desde Comercios. " + mensajeError(err), "error"); }
    } else mostrarToast(acc === "aprobar" ? "✅ Aprobado. Recuerda verificarlo por teléfono desde Comercios" : "Solicitud rechazada");
    await pintarNegocios();
    pintarAprobadosSinVerificar();
  } catch (err) {
    art.querySelectorAll("button").forEach(x => { x.disabled = false; });
    art.querySelector('[data-nacc="verificar"]').disabled = art.querySelectorAll("[data-v]:checked").length < 2;
    mostrarToast(mensajeError(err), "error");
  }
}

// ---------- 🔐 Tu seguridad (fase 2AN; solo administrador) ----------
const ACCION_SEG = { clave_creada: "🔑 Clave creada", clave_cambiada: "🔑 Clave cambiada", desbloquear: "🔓 Filtro desbloqueado", bloquear: "🔐 Filtro bloqueado", clave_fallida: "⚠️ Clave equivocada", clave_bloqueada: "⛔ Clave bloqueada 1 hora (5 intentos)" };
async function pintarSeguridad() {
  if (!esAdmin()) return;
  let e;
  try { e = await estadoSeguridad(); }
  catch (err) { $("seg-estado").textContent = "Se activa al ejecutar supabase/40_filtro_todos_clave.sql"; return; }
  const libre = !!e.desbloqueado_hasta;
  $("seg-estado").className = "text-xs font-bold px-2 py-0.5 rounded-full " + (libre ? "bg-red-600 text-white" : "bg-green-100 text-green-800");
  $("seg-estado").textContent = e.bloqueada_hasta ? "⛔ Clave bloqueada hasta " + horaCo(e.bloqueada_hasta) : libre ? "🔓 Filtro desbloqueado hasta " + horaCo(e.desbloqueado_hasta) : "🔐 Filtro activo";
  $("seg-crear").classList.toggle("hidden", e.tiene_clave);
  $("seg-usar").classList.toggle("hidden", !e.tiene_clave);
  $("seg-desbloquear").classList.toggle("hidden", libre);
  $("seg-bloquear-btn").classList.toggle("hidden", !libre);
  $("seg-sesiones").innerHTML = (e.sesiones || []).map(s => `<p class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"><b>${esc(dispositivoActual(s.dispositivo))}</b> · IP ${esc(s.ip || "—")}<br><span class="text-slate-500">Inició ${esc(fechaCorta(s.inicio))} · última actividad ${esc(fechaCorta(s.ultima))}</span></p>`).join("") || '<p class="text-slate-400">—</p>';
  $("seg-historial").innerHTML = (e.historial || []).map(h => `<p class="${h.accion === "clave_fallida" || h.accion === "clave_bloqueada" ? "text-red-700 font-semibold" : "text-slate-600"}">${esc(ACCION_SEG[h.accion] || h.accion)} · ${esc(fechaCorta(h.creado_en))}${h.dispositivo ? " · " + esc(h.dispositivo) : ""}</p>`).join("") || '<p class="text-slate-400">Sin movimientos.</p>';
  if (e.intentos_fallidos) $("seg-historial").insertAdjacentHTML("afterbegin", `<p class="text-red-700 font-bold">⚠️ ${e.intentos_fallidos} intento(s) fallido(s) seguidos</p>`);
}
async function accionSeguridad(e) {
  const id = e.target.id;
  try {
    if (id === "seg-crear-btn") {
      const a = $("seg-nueva").value, b = $("seg-repetir").value;
      if (a.length < 6) { mostrarToast("La clave debe tener al menos 6 caracteres", "error"); return; }
      if (a !== b) { mostrarToast("Las dos claves no coinciden", "error"); return; }
      await guardarClaveSeguridad(a); $("seg-nueva").value = $("seg-repetir").value = "";
      mostrarToast("🔑 Clave guardada. Guárdala en un lugar seguro: no se puede recuperar desde la página");
    } else if (id === "seg-desbloquear-btn") {
      const hasta = await desbloquearFiltro($("seg-clave").value, Number($("seg-minutos").value));
      $("seg-clave").value = "";
      if (!hasta) mostrarToast("Clave incorrecta", "error");
      else mostrarToast("🔓 Filtro desbloqueado hasta " + horaCo(hasta) + ". Se bloquea solo");
    } else if (id === "seg-bloquear-btn") {
      await bloquearFiltro(); mostrarToast("🔐 Filtro bloqueado");
    } else if (id === "seg-cambiar-btn") {
      if ($("seg-cambio").value.length < 6) { mostrarToast("La clave nueva debe tener al menos 6 caracteres", "error"); return; }
      await guardarClaveSeguridad($("seg-cambio").value, $("seg-actual").value);
      $("seg-actual").value = $("seg-cambio").value = ""; mostrarToast("🔑 Clave cambiada");
    } else if (id === "seg-cerrar-otras") {
      if (!confirm("¿Cerrar tu sesión en todos los demás celulares y computadores? Aquí sigues dentro.")) return;
      const { error } = await sb.auth.signOut({ scope: "others" }); if (error) throw error;
      mostrarToast("✅ Sesiones cerradas en los demás dispositivos");
    } else return;
    await pintarSeguridad();
  } catch (err) { mostrarToast(mensajeError(err), "error"); await pintarSeguridad(); }
}

// ---------- 👥 Equipo (fase 2AK; solo administrador) ----------
const NOMBRE_ROL = { admin: "👑 Administrador", moderador: "🛡️ Moderador", usuario: "Usuario" };
function filaPersona(p) {
  const yo = usuarioActual && p.id === usuarioActual.id;
  return `<div class="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" data-persona="${esc(p.id)}">
    <b>${esc(p.nombre)}</b><span class="text-xs text-slate-500">${esc(p.correo || "")}</span>
    <span class="text-xs font-bold px-2 py-0.5 rounded-full ${p.rol === "admin" ? "bg-amber-100 text-amber-900" : p.rol === "moderador" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"}">${NOMBRE_ROL[p.rol] || p.rol}${yo ? " (tú)" : ""}</span>
    ${p.vetado ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">🚫 Vetado</span>' : p.suspendido_hasta && Date.parse(p.suspendido_hasta) > Date.now() ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">⏸ Suspendido hasta ${esc(fechaCorta(p.suspendido_hasta))}</span>` : ""}
    ${p.sanciones ? `<span class="text-[11px] text-slate-500">${p.sanciones} sanción(es)</span>` : ""}
    ${p.rol !== "admin" ? botonesSancionHTML(p.id, p) : ""}
    ${p.rol === "usuario" ? `<button type="button" data-rol="moderador" class="ml-auto text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">🛡️ Nombrar moderador</button>` : ""}
    ${p.rol === "moderador" ? `<button type="button" data-rol="usuario" class="ml-auto text-xs bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold">Quitar moderador</button>` : ""}
  </div>`;
}
async function pintarEquipo() {
  if (!esAdmin()) return;
  try {
    const equipo = await buscarPersona("");
    $("eq-lista").innerHTML = equipo.map(filaPersona).join("") || '<p class="text-sm text-slate-400">Solo estás tú.</p>';
  } catch (e) { $("eq-lista").innerHTML = '<p class="text-sm text-slate-400">Se activa al ejecutar supabase/38_admin_seguridad.sql.</p>'; }
}
async function buscarEquipo() {
  const t = $("eq-buscar").value.trim();
  if (t.length < 2) { mostrarToast("Escribe al menos 2 letras del nombre o correo", "error"); return; }
  try {
    const r = await buscarPersona(t);
    $("eq-resultados").innerHTML = r.map(filaPersona).join("") || '<p class="text-sm text-slate-400">Nadie con ese nombre o correo. La persona debe crear su cuenta primero.</p>';
  } catch (e) { mostrarToast(mensajeError(e), "error"); }
}
async function accionEquipo(e) {
  const s = e.target.closest("[data-sancion]");
  if (s) { if (await sancionarDesdeBoton(s)) { await pintarEquipo(); if ($("eq-buscar").value.trim().length >= 2) await buscarEquipo(); } return; }
  const b = e.target.closest("[data-rol]");
  if (!b) return;
  const fila = b.closest("[data-persona]"), nombre = fila.querySelector("b").textContent;
  const msg = b.dataset.rol === "moderador"
    ? `¿Nombrar a ${nombre} moderador? Podrá revisar reportes, ocultar contenido, verificar comercios y proponer aprobaciones.`
    : `¿Quitarle el rol de moderador a ${nombre}?`;
  if (!confirm(msg)) return;
  b.disabled = true;
  try {
    await cambiarRol(fila.dataset.persona, b.dataset.rol);
    mostrarToast(b.dataset.rol === "moderador" ? "🛡️ Ahora es moderador (lo verá al recargar)" : "Rol de moderador quitado");
    await pintarEquipo();
    if ($("eq-buscar").value.trim().length >= 2) await buscarEquipo();
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
  // Equipo y seguridad (solo administrador)
  if (esAdmin()) {
    pintarSeguridad();
    $("seguridad").addEventListener("click", accionSeguridad);
    pintarEquipo();
    $("eq-btn").addEventListener("click", buscarEquipo);
    $("eq-buscar").addEventListener("keydown", e => { if (e.key === "Enter") buscarEquipo(); });
    ["eq-lista", "eq-resultados"].forEach(id => $(id).addEventListener("click", accionEquipo));
  }
  $("mod-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-estado]");
    if (!b) return;
    estadoVista = b.dataset.estado;
    pintarReportes();
  });
  $("mod-lista").addEventListener("click", async e => { const s = e.target.closest("[data-sancion]"); if (s) { await sancionarDesdeBoton(s); return; } accionReporte(e); });
  $("mod-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("sol-lista").addEventListener("click", accionSolicitud);
  $("rprod-lista").addEventListener("click", accionReporteProducto);
  $("rcom-lista").addEventListener("click", accionReporteComercio);
  pintarReportesComercio();
  $("acel-lista").addEventListener("click", accionAcelerar);
  pintarAcelerar();
  $("neg-lista").addEventListener("click", accionNegocio);
  $("neg-lista").addEventListener("change", accionNegocio);
  pintarNegocios();
  pintarAprobadosSinVerificar();
  pintarReportesProducto();
  $("salud-lista").addEventListener("click", accionSalud);
  pintarSalud();
  $("palabras-cola").addEventListener("click", accionSalud);
  $("pp-lista").addEventListener("click", accionPalabra);
  $("pp-agregar").addEventListener("click", agregarPalabra);
  pintarPalabras();
  if (esAdmin()) {   // fase 2AL
    pintarPermitidas();
    $("pf-lista").addEventListener("click", accionPermitidas);
    $("pf-agregar").addEventListener("click", async () => { if (await agregarPermitida($("pf-frase").value, $("pf-cat").value)) $("pf-frase").value = ""; });
    $("solrev-lista").addEventListener("click", accionSolicitudRevision);
  }
  $("rcal-lista").addEventListener("click", accionReporteCalificacion);
  pintarReportesCalificacion();
  $("cc-lista").addEventListener("click", accionCatComercio);
  $("cc-crear").addEventListener("click", crearCatComercio);
  pintarCatsComercio();
  $("ca-lista").addEventListener("click", accionCatAnuncio);
  $("ca-crear").addEventListener("click", crearCatAnuncio);
  cargarAnuncios().finally(pintarCatsAnuncio);
  $("recom-lista").addEventListener("click", accionRecomendacion);
  $("recom-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  pintarRecomendaciones();
  $("busq-lista").addEventListener("click", accionBusqueda);
  pintarBusquedas();
  pintarReportes();
  pintarSolicitudes();
});
