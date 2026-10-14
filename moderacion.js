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
  pintarReportes();
});
