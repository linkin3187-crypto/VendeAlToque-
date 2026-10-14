// ===== MercaFree - Directorio de comercios verificados (comercios.html) =====
// POR QUÉ solo verificados: "verificado" significa que alguien del equipo visitó el local.
// Los no verificados se quedan en el mapa (con su etiqueta) pero no se listan aquí.

let verificados = [];
let tipoActivo = "todos";

function tarjetaComercio(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const foto = urlSegura(c.foto);
  const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
  return `<article class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
    <div class="h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative">
      <span class="text-5xl">${esc(t ? t.icono : "🏪")}</span>
      ${foto ? `<img src="${esc(foto)}" alt="Foto de ${esc(c.nombre)}" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      <span class="absolute top-2 left-2 bg-green-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">✔ Verificado</span>
    </div>
    <div class="p-4 flex-1 flex flex-col">
      <h2 class="font-bold text-lg leading-tight">${esc(c.nombre)}</h2>
      <p class="text-xs text-slate-500">${esc(t ? t.nombre.replace(/s$/, "") : "Comercio")} · ${esc(c.ciudad)}</p>
      ${c.direccion ? `<p class="text-sm text-slate-600 mt-2">📍 ${esc(c.direccion)}</p>` : ""}
      ${c.horario ? `<p class="text-sm text-slate-600">🕒 ${esc(c.horario)}</p>` : ""}
      ${c.telefono ? `<p class="text-sm text-slate-600">📞 ${esc(c.telefono)}</p>` : ""}
      <div class="flex flex-wrap gap-2 mt-auto pt-3">
        ${tel ? `<a href="tel:${esc(tel)}" class="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">📞 Llamar</a>` : ""}
        <a href="${esc(urlGoogleMaps(c.lat, c.lng))}" target="_blank" rel="noopener" class="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">🗺️ Cómo llegar</a>
      </div>
    </div>
  </article>`;
}

function pintar() {
  const muni = $("co-muni").value;
  const lista = verificados.filter(c => (tipoActivo === "todos" || c.tipo === tipoActivo) && (!muni || String(c.municipioId) === muni));
  $("co-lista").innerHTML = lista.map(tarjetaComercio).join("");
  $("co-contador").textContent = lista.length ? lista.length + (lista.length === 1 ? " comercio" : " comercios") : "";
  $("co-vacio").classList.toggle("hidden", lista.length > 0);
  $("co-vacio-txt").textContent = verificados.length
    ? "No hay comercios verificados con estos filtros todavía."
    : "Estamos visitando y verificando comercios de tu zona. ¡Vuelve pronto!";
  document.querySelectorAll("#co-tipos [data-tipo]").forEach(b => b.setAttribute("aria-selected", b.dataset.tipo === tipoActivo ? "true" : "false"));
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarComercios();
  verificados = comercios.filter(c => c.verificado);
  const chip = (id, txt) => `<button type="button" role="tab" data-tipo="${id}" class="co-chip px-3 py-1.5 rounded-full text-sm font-semibold border border-slate-300 bg-white text-slate-600">${txt}</button>`;
  $("co-tipos").innerHTML = chip("todos", "Todos") + TIPOS_COMERCIO.map(t => chip(t.id, `${t.icono} ${esc(t.nombre)}`)).join("");
  $("co-muni").innerHTML = '<option value="">Todos</option>' + municipios.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join("");
  $("co-tipos").addEventListener("click", e => {
    const b = e.target.closest("[data-tipo]");
    if (!b) return;
    tipoActivo = b.dataset.tipo; pintar();
  });
  $("co-muni").addEventListener("change", pintar);
  $("co-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  pintar();
});
