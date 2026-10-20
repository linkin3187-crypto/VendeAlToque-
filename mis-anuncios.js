// ===== Merkap · Mis anuncios (mis-anuncios.html) · fase 2AT =====
// Antes era una caja dentro del inicio. Ahora es una página propia, a la que se entra desde el menú
// de la cuenta (arriba) y desde «Yo» (barra de abajo). Cada anuncio trae sus herramientas a la vista:
// ver, compartir (imagen + QR), rebajar, editar y eliminar. Muestra también los vencidos u ocultos.

let misAnuncios = [];

function estadoMiAnuncio(a) {
  if (a.estadoPub && a.estadoPub !== "activo") return ["🙈 Oculto por moderación", "bg-red-100 text-red-800", false];
  if (a.expira && a.expira < Date.now()) return ["⌛ Vencido", "bg-slate-200 text-slate-700", false];
  const dias = a.expira ? Math.ceil((a.expira - Date.now()) / 864e5) : null;
  return [dias !== null && dias <= 5 ? `🟡 Vence en ${dias} ${dias === 1 ? "día" : "días"}` : "🟢 Publicado", dias !== null && dias <= 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800", true];
}

function tarjetaMiAnuncio(a) {
  const foto = urlSegura(a.imagen);
  const [estado, clase, vivo] = estadoMiAnuncio(a);
  const rb = rebajaDe(a);
  return `<article data-id="${a.id}" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${vivo ? "" : "opacity-80"}">
    <div class="flex gap-3 p-3">
      <a href="anuncio.html?id=${a.id}" class="relative w-24 h-24 shrink-0 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden" aria-label="Ver ${esc(a.nombre)}">
        <span class="text-3xl">${iconosCategoria[a.categoria] || "📦"}</span>
        ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      </a>
      <div class="min-w-0 flex-1">
        <span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${clase}">${estado}</span>
        <a href="anuncio.html?id=${a.id}" class="block mt-1 font-bold text-slate-900 leading-snug hover:text-indigo-700 line-clamp-2">${esc(a.nombre)}</a>
        ${a.precio ? `<p class="text-sm font-black text-indigo-700">${rb ? `<span class="rebaja-antes">${esc(formatearPrecio(rb.antes))}</span> ` : ""}${esc(precioConSufijo(a))}${rb ? ` <span class="rebaja-pct">📉 −${rb.pct} %</span>` : ""}</p>` : ""}
        <p class="text-xs text-slate-500 mt-0.5">${esc([a.barrio, a.ciudad].filter(Boolean).join(", "))}${a.fecha ? " · publicado " + esc(haceCuanto(a.fecha)) : ""}</p>
      </div>
    </div>
    <div class="ma-herr" role="group" aria-label="Herramientas del anuncio">
      ${vivo ? `<button type="button" data-ma="compartir" class="ma-b ma-b-violeta" title="Imagen, texto y QR para WhatsApp y estados">📣 Compartir</button>` : ""}
      ${vivo && a.precio ? `<button type="button" data-ma="rebajar" class="ma-b ma-b-rosa" title="Baja el precio: sale con el anterior tachado y −% durante 15 días">📉 Rebajar</button>` : ""}
      ${vivo ? `<a href="index.html?editar=${a.id}" data-ma-editar class="ma-b ma-b-indigo">✏️ Editar</a><a href="anuncio.html?id=${a.id}" class="ma-b ma-b-gris">👁️ Ver</a>`
        : `<span class="ma-nota">${a.estadoPub && a.estadoPub !== "activo" ? "Revisa los avisos de moderación o escríbenos." : "Ya no se ve en Merkap. Si aún lo vendes, publícalo de nuevo."}</span>`}
      <button type="button" data-ma="eliminar" class="ma-b ma-b-rojo">🗑️ Eliminar</button>
    </div>
  </article>`;
}

function pintarMisAnuncios() {
  $("ma-cuenta").textContent = misAnuncios.length ? "(" + misAnuncios.length + ")" : "";
  $("ma-lista").innerHTML = misAnuncios.map(tarjetaMiAnuncio).join("");
  $("ma-vacio").classList.toggle("hidden", misAnuncios.length > 0);
  // Una pista corta para descubrir las herramientas (la misma idea de la fase 2AP-4a)
  const vivos = misAnuncios.filter(a => estadoMiAnuncio(a)[2]);
  const viejo = vivos.find(a => a.precio && !rebajaDe(a) && Date.now() - a.fecha > 7 * 864e5);
  const vence = vivos.find(a => a.expira && a.expira - Date.now() < 5 * 864e5);
  const pista = vence ? `⏳ «${esc(vence.nombre)}» vence pronto. Compártelo hoy o, si ya lo vendiste, elimínalo.`
    : viejo ? `💡 ¿«${esc(viejo.nombre)}» aún no se vende? Toca <b>📉 Rebajar</b>: sale con el precio anterior tachado y llama más la atención.`
    : vivos.length ? "💡 Toca <b>📣 Compartir</b> para mandar tu anuncio con foto y QR a tus grupos y estados de WhatsApp: es la forma más rápida de vender." : "";
  $("ma-pista").innerHTML = pista;
  $("ma-pista").classList.toggle("hidden", !pista);
}

async function accionMiAnuncio(e) {
  const b = e.target.closest("[data-ma]");
  const fila = e.target.closest("[data-id]");
  if (!b || !fila) return;
  const id = Number(fila.dataset.id);
  const a = misAnuncios.find(x => x.id === id);
  if (!a) return;
  if (b.dataset.ma === "compartir") {
    if (typeof abrirCompartir === "function") abrirCompartir(datosCompartirAnuncio(a));
  } else if (b.dataset.ma === "rebajar") {
    abrirRebaja(a, nuevo => {
      misAnuncios = misAnuncios.map(x => (x.id === nuevo.id ? Object.assign(nuevo, { estadoPub: x.estadoPub, expira: x.expira }) : x));
      pintarMisAnuncios();
    });
  } else if (b.dataset.ma === "eliminar") {
    if (!confirm("¿Eliminar «" + a.nombre + "»? No se puede deshacer.")) return;
    b.disabled = true;
    try {
      baseDatosAnuncios = misAnuncios;            // así también se borran sus fotos
      await eliminarAnuncioDB(id);
      misAnuncios = misAnuncios.filter(x => x.id !== id);
      pintarMisAnuncios();
      mostrarToast("Anuncio eliminado");
    } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("ma-cargando").classList.add("hidden");
  if (!usuarioActual) { $("ma-sinsesion").classList.remove("hidden"); return; }
  $("ma-atajos").classList.remove("hidden");
  $("ma-atajo-perfil").href = "vendedor.html?id=" + encodeURIComponent(usuarioActual.id);
  $("ma-lista").addEventListener("click", accionMiAnuncio);
  // Al editar (se hace en el inicio) vuelve aquí al guardar
  $("ma-lista").addEventListener("click", e => { if (e.target.closest("[data-ma-editar]")) { try { sessionStorage.setItem("mf_tras_editar", "mis-anuncios"); } catch (err) { /* nada */ } } });
  $("ma-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  try {
    misAnuncios = await cargarMisAnunciosTodos();
    pintarMisAnuncios();
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
  }
  try {
    const tiendas = await cargarMisComercios();
    $("ma-mi-tienda").classList.toggle("hidden", !tiendas.length);
    $("ma-atajo-tienda").classList.toggle("hidden", !tiendas.length);
    $("ma-atajo-negocio").classList.toggle("hidden", tiendas.length > 0);
  } catch (e) { /* sin tienda */ }
});
