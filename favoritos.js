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
        <p class="text-xs text-slate-400">${esc([a.barrio, a.ciudad].filter(Boolean).join(", "))}</p>
      </div>
    </a>
  </article>`;
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
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
  }
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
