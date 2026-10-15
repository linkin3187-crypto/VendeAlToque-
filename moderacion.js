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
      ${s.tipo === "retirar" && c && c.activo ? `<button type="button" data-socultar="${c.id}" class="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold">🙈 Ocultar comercio</button>` : ""}
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

// ---------- Negocios nuevos por revisar (registrar-negocio.html) ----------
const meterNegocios = {};   // señales ya cargadas por solicitud

function etiquetaTipo(id) { const t = TIPOS_COMERCIO.find(x => x.id === id); return t ? `${t.icono} ${t.nombre}` : id; }

function tarjetaNegocio(n) {
  const mun = municipios.find(x => x.id === n.municipio_id);
  const foto = urlSegura(n.foto_fachada_url);
  const wa = n.whatsapp ? urlWhatsAppTexto(n.whatsapp, `Hola, te escribe MercaFree. Recibimos el registro de «${n.nombre}» (${n.direccion}). ¿Nos confirmas que eres el dueño o administrador del negocio?`) : "";
  const tel = String(n.telefono || "").replace(/[^\d+]/g, "");
  return `<article class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm" data-neg="${n.id}">
    <div class="flex gap-3">
      ${foto ? `<a href="${esc(foto)}" target="_blank" rel="noopener" class="shrink-0"><img src="${esc(foto)}" alt="Fachada de ${esc(n.nombre)}" loading="lazy" class="w-24 h-24 object-cover rounded-xl border border-slate-200"></a>` : ""}
      <div class="min-w-0">
        <h3 class="font-bold leading-tight">${esc(n.nombre)}</h3>
        <p class="text-xs text-slate-500">${esc(etiquetaTipo(n.tipo))} · ${esc(mun ? mun.nombre : "")}</p>
        <p class="text-sm text-slate-600 mt-1">📍 ${esc(n.direccion)}</p>
        ${n.horario ? `<p class="text-xs text-slate-500">🕒 ${esc(n.horario)}</p>` : ""}
        <p class="text-xs text-slate-400 mt-0.5">Enviado por ${esc(n.solicitante ? n.solicitante.nombre : "—")} · ${esc(fechaCorta(n.creado_en))}</p>
      </div>
    </div>
    ${n.descripcion ? `<p class="text-sm text-slate-600 mt-2">“${esc(n.descripcion)}”</p>` : ""}
    <div data-senales class="mt-3 text-xs text-slate-400">Calculando señales de confianza…</div>
    <div class="flex flex-wrap gap-2 mt-3">
      ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener" class="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold">💬 Escribir por WhatsApp</a>` : ""}
      ${tel ? `<a href="tel:${esc(tel)}" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">📞 Llamar</a>` : ""}
      <a href="${esc(urlGoogleMaps(n.lat, n.lng))}" target="_blank" rel="noopener" class="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg font-semibold">🗺️ Ver pin</a>
    </div>
    <div class="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
      <p class="font-bold text-slate-500">Si ya hablaste con el responsable:</p>
      <label class="flex items-start gap-1.5"><input type="checkbox" data-v="nombre_dir" class="mt-0.5"> Confirmó el nombre y la dirección del negocio</label>
      <label class="flex items-start gap-1.5"><input type="checkbox" data-v="telefono_negocio" class="mt-0.5"> El número de contacto es del negocio</label>
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      <button type="button" data-nacc="verificar" disabled class="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed">✅ Aprobar y verificar por teléfono</button>
      <button type="button" data-nacc="aprobar" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold">Aprobar (sin verificar aún)</button>
      <button type="button" data-nacc="rechazar" class="text-xs bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold">✖ Rechazar</button>
    </div>
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
  $("rcom-lista").addEventListener("click", accionReporteComercio);
  pintarReportesComercio();
  $("neg-lista").addEventListener("click", accionNegocio);
  $("neg-lista").addEventListener("change", accionNegocio);
  pintarNegocios();
  pintarAprobadosSinVerificar();
  pintarReportesProducto();
  pintarReportes();
  pintarSolicitudes();
});
