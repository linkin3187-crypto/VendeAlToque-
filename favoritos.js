// ===== Merkap - Mis favoritos (favoritos.html) =====
// Solo muestra anuncios activos y vigentes; si uno venció o se eliminó, simplemente no aparece.

function tarjetaFavorito(a) {
  const foto = urlSegura(a.imagen);
  return `<article data-id="${a.id}" class="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
    <button type="button" data-quitar="${a.id}" aria-label="Quitar de favoritos" class="absolute top-2 left-2 z-10 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-lg">❤️</button>
    <a href="anuncio.html?id=${a.id}" class="block">
      <div class="relative h-28 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <span class="text-3xl">${iconosCategoria[a.categoria] || "📦"}</span>
        ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      </div>
      <div class="p-3">
        <p class="text-sm font-semibold line-clamp-2">${esc(a.nombre)}</p>
        ${a.precio ? `<p class="text-sm text-indigo-600 font-bold">${esc(precioConSufijo(a))}</p>` : ""}
        <p class="text-xs text-slate-400">${esc([a.barrio, a.ciudad].filter(Boolean).join(", "))}${a.fecha ? " · " + esc(haceCuanto(a.fecha)) : ""}</p>
      </div>
    </a>
  </article>`;
}

// Fase V-2b: comercios guardados
function tarjetaFavComercio(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const foto = imagenCuadroComercio(c);   // fase V-2c
  return `<article data-com="${c.id}" class="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex gap-3 items-center">
    <a href="tienda.html?id=${c.id}" class="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 to-pink-50 flex items-center justify-center text-3xl">
      <span>${esc(t ? t.icono : "🏪")}</span>${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}</a>
    <a href="tienda.html?id=${c.id}" class="min-w-0 flex-1"><p class="font-bold text-sm leading-tight line-clamp-2">${esc(c.nombre)}</p>
      <p class="text-xs text-slate-500 mt-0.5">${esc(nombreCategorias(c))} · ${esc(c.ciudad || "")}</p><p class="text-xs mt-0.5">${resumenCalifHTML(c)}</p></a>
    <button type="button" data-quitar-com="${c.id}" aria-label="Quitar de favoritos" class="w-9 h-9 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg">❤️</button>
  </article>`;
}
async function pintarFavComercios() {
  await cargarFavoritosComercio();
  if (!favoritosComercioIds.size) { $("favc-caja").classList.add("hidden"); return; }
  await cargarComercios();
  const lista = comercios.filter(c => favoritosComercioIds.has(c.id));
  $("favc-lista").innerHTML = lista.map(tarjetaFavComercio).join("");
  $("favc-caja").classList.toggle("hidden", !lista.length);
  $("fav-titulo-anuncios").classList.toggle("hidden", !lista.length);
}

async function pintarFavoritos() {
  const lista = await cargarAnunciosPorIds([...favoritosIds]);
  $("fav-lista").innerHTML = lista.map(tarjetaFavorito).join("");
  $("fav-vacio").classList.toggle("hidden", lista.length > 0);
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("fav-cargando").classList.add("hidden");
  if (!usuarioActual) { $("fav-sinsesion").classList.remove("hidden"); return; }
  try {
    await cargarFavoritos();
    await pintarFavoritos();
    await pintarFavComercios();
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
  }
  $("favc-lista").addEventListener("click", async e => {
    const b = e.target.closest("[data-quitar-com]");
    if (!b) return;
    b.disabled = true;
    try {
      await alternarFavoritoComercio(Number(b.dataset.quitarCom));
      b.closest("article").remove();
      if (!$("favc-lista").children.length) { $("favc-caja").classList.add("hidden"); $("fav-titulo-anuncios").classList.add("hidden"); }
      mostrarToast("Quitado de favoritos");
    } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
  });
  $("fav-lista").addEventListener("click", async e => {
    const b = e.target.closest("[data-quitar]");
    if (!b) return;
    b.disabled = true;
    try {
      await alternarFavorito(Number(b.dataset.quitar));
      b.closest("article").remove();
      if (!$("fav-lista").children.length) $("fav-vacio").classList.remove("hidden");
      mostrarToast("Quitado de favoritos");
    } catch (err) {
      b.disabled = false;
      mostrarToast(mensajeError(err), "error");
    }
  });
});
