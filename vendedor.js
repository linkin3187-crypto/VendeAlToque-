// ===== MercaFree · Perfil público del vendedor (Fase 2C.5) =====
// vendedor.html?id=UUID  ·  Nombre visible, «miembro desde», su comercio y TODOS sus anuncios activos
// (con buscador y categorías). Los datos vienen de perfil_publico() (supabase/18_perfil_vendedor.sql):
// nunca correo, teléfono ni rol. El contacto de cada anuncio sigue pidiendo cuenta (como siempre).

let vendedor = null;
let anunciosV = [];
let catV = "todos";

function pintarAnunciosV() {
  const q = $("v-buscar").value.trim();
  const lista = anunciosV.filter(a => (catV === "todos" || a.categoria === catV) && (!q || anuncioCoincide(a, q)));
  $("contenedor-anuncios").innerHTML = lista.map(tarjetaHTML).join("");
  $("v-vacio").classList.toggle("hidden", lista.length > 0);
  $("v-contador").textContent = lista.length + (lista.length === 1 ? " anuncio" : " anuncios");
  // Categorías con anuncios de este vendedor (con cuántos)
  const cuenta = {};
  anunciosV.forEach(a => { cuenta[a.categoria] = (cuenta[a.categoria] || 0) + 1; });
  const cats = CATEGORIAS.filter(c => c.id === "todos" || cuenta[c.id]);
  $("v-cats").classList.toggle("hidden", cats.length <= 2);
  $("v-cats").innerHTML = cats.map(c => {
    const n = c.id === "todos" ? anunciosV.length : cuenta[c.id];
    const on = catV === c.id;
    return `<button type="button" role="tab" data-vcat="${esc(c.id)}" aria-selected="${on}" class="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold border ${on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300"}">${c.icono} ${esc(c.nombre)} <span class="${on ? "text-indigo-200" : "text-slate-400"}">${n}</span></button>`;
  }).join("");
}

function pintarVendedorV() {
  const v = vendedor;
  document.title = `${v.nombre} · Vendedor | MercaFree`;
  $("v-avatar").textContent = (v.nombre || "?").trim().charAt(0).toUpperCase();
  $("v-nombre").textContent = v.nombre;
  $("v-desde").textContent = "Miembro desde " + fechaMiembro(v.desde);
  $("v-activos").textContent = `📢 ${v.activos} ${v.activos === 1 ? "anuncio activo" : "anuncios activos"}`;
  if (v.comercioId) {
    $("v-comercio").href = "tienda.html?id=" + v.comercioId;
    $("v-comercio").textContent = "🏪 Ver su tienda: " + v.comercioNombre;
    $("v-comercio").classList.remove("hidden");
  }
}

async function corazonV(id, btn) {
  if (!usuarioActual) { mostrarToast("Inicia sesión para guardar favoritos", "error"); return; }
  const antes = favoritosIds.has(id);
  btn.disabled = true;
  try {
    const ahora = await alternarFavorito(id);
    btn.textContent = ahora ? "❤️" : "🤍"; btn.setAttribute("aria-pressed", String(ahora));
    mostrarToast(ahora ? "❤️ Guardado en favoritos" : "Quitado de favoritos");
  } catch (err) { btn.textContent = antes ? "❤️" : "🤍"; mostrarToast(mensajeError(err), "error"); }
  finally { btn.disabled = false; }
}

async function compartirPerfil() {
  const url = location.href;
  const datos = { title: vendedor.nombre + " en MercaFree", text: `Mira los anuncios de ${vendedor.nombre} en MercaFree`, url };
  if (navigator.share) { try { await navigator.share(datos); } catch (e) { /* canceló */ } return; }
  try { await navigator.clipboard.writeText(url); mostrarToast("🔗 Enlace copiado: pégalo en WhatsApp"); } catch (e) { prompt("Copia este enlace:", url); }
}

document.addEventListener("DOMContentLoaded", async () => {
  const id = (new URLSearchParams(location.search).get("id") || "").trim();
  const mostrarNo = () => { $("v-cargando").classList.add("hidden"); $("v-no").classList.remove("hidden"); };
  if (!/^[0-9a-zA-Z-]{3,40}$/.test(id)) { mostrarNo(); return; }   // los id reales son UUID; si no es válido, la base responde error
  try {
    await cargarMunicipios();
    await cargarSesion();
    vendedor = await cargarPerfilPublico(id);
    if (!vendedor) { mostrarNo(); return; }
    anunciosV = await cargarAnunciosDeVendedor(id);
    if (usuarioActual) { try { await cargarFavoritos(); } catch (e) { /* sigue sin favoritos */ } }
  } catch (e) {
    console.error(e);
    mostrarNo();
    return;
  }
  $("v-cargando").classList.add("hidden");
  $("v-panel").classList.remove("hidden");
  pintarVendedorV();
  pintarAnunciosV();

  // Es mi propio perfil: puedo elegir cómo me ven
  if (usuarioActual && usuarioActual.id === id) {
    $("v-mio").classList.remove("hidden");
    try { $("v-nombre-pub").value = await cargarMiNombrePublico(); } catch (e) { /* sin SQL 18 */ }
    $("v-form-nombre").addEventListener("submit", async ev => {
      ev.preventDefault();
      try {
        await guardarNombrePublico($("v-nombre-pub").value);
        vendedor = await cargarPerfilPublico(id) || vendedor;
        pintarVendedorV();
        mostrarToast("✔ Listo: así te ven los compradores");
      } catch (err) { mostrarToast(mensajeError(err), "error"); }
    });
  }

  $("v-buscar").addEventListener("input", debounce(pintarAnunciosV, 200));
  $("v-cats").addEventListener("click", e => { const b = e.target.closest("[data-vcat]"); if (b) { catV = b.dataset.vcat; pintarAnunciosV(); } });
  $("v-compartir").addEventListener("click", compartirPerfil);
  $("contenedor-anuncios").addEventListener("click", e => {
    const b = e.target.closest("[data-accion]");
    const fila = e.target.closest("[data-id]");
    if (!b || !fila) return;
    const aid = Number(fila.dataset.id);
    if (b.dataset.accion === "favorito") corazonV(aid, b);
    else if (b.dataset.accion === "editar") location.href = "index.html?editar=" + aid;
    else location.href = "anuncio.html?id=" + aid;
  });
  $("contenedor-anuncios").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
});
