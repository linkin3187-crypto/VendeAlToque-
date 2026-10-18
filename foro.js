// ===== Merkap - Foro de Ventas =====
// Requiere utils.js y data.js (de ahí vienen esc, EDITOR, CATEGORIAS_FORO...).
// Se usa en index.html (lista de temas) y en post.html (reutiliza renderizado y datos).

let postsForo = [];
let categoriaForoActiva = "todos";

// Los temas viven en Supabase (tabla temas_foro + comentarios_foro). data.js los trae.
async function cargarForo() {
  postsForo = await cargarTemasForo();
}

// ¿Puede esta persona borrar el tema? Su autor o un moderador (la base de datos lo exige igual).
function puedeBorrarTema(p) {
  return EDITOR || (!!usuarioActual && !!p.autorId && p.autorId === usuarioActual.id);
}

function renderizarChipsForo() {
  const cont = $("foro-chips");
  if (!cont) return;
  cont.innerHTML = CATEGORIAS_FORO.map(c => {
    const activa = c.id === categoriaForoActiva;
    return `<button type="button" data-foro-cat="${esc(c.id)}" class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${activa ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}">${c.icono} ${esc(c.nombre)}</button>`;
  }).join("");
}

function renderizarForo() {
  const cont = $("foro-posts");
  const contador = $("foro-contador");
  if (!cont) return;

  let lista = categoriaForoActiva === "todos" ? postsForo : postsForo.filter(p => p.categoria === categoriaForoActiva);
  lista = [...lista].sort((a, b) => b.fecha - a.fecha);

  if (contador) contador.textContent = lista.length + (lista.length === 1 ? " publicación" : " publicaciones");

  if (!lista.length) {
    cont.innerHTML = `
      <div class="text-center py-10 text-slate-500">
        <div class="text-4xl mb-3">💬</div>
        <p class="font-medium">No hay publicaciones en esta categoría</p>
        <p class="text-sm mt-1">Sé el primero en publicar algo</p>
      </div>`;
    return;
  }

  cont.innerHTML = lista.map(p => {
    const cat = CATEGORIAS_FORO.find(c => c.id === p.categoria) || { icono: "📦", nombre: p.categoria };
    const fecha = new Date(p.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
    const numResp = (p.respuestas || []).length;

    return `
      <article data-post="${Number(p.id)}" class="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition">
        <div data-toggle class="p-4 cursor-pointer">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">${cat.icono} ${esc(cat.nombre)}</span>
            <span class="text-xs text-slate-400">${fecha}</span>
          </div>
          <h3 class="font-bold text-slate-900 mb-1">${esc(p.titulo)}</h3>
          <p class="text-sm text-slate-600 line-clamp-2">${esc(p.contenido)}</p>
          <div class="flex items-center gap-3 text-xs text-slate-500 mt-2">
            <span>👤 ${esc(p.autor || "Anónimo")}</span>
            <span>💬 ${numResp} comentario${numResp === 1 ? "" : "s"}</span>
            <span class="text-indigo-500 font-medium ml-auto">Desplegar ▾</span>
          </div>
        </div>
        <div class="detalle-anuncio border-t border-slate-100 bg-slate-50 px-4 pb-4">
          <p class="text-sm text-slate-700 whitespace-pre-wrap pt-3 mb-3">${esc(p.contenido)}</p>
          <div class="flex flex-wrap gap-2">
            <a href="post.html?id=${Number(p.id)}" class="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">Ver tema y comentarios →</a>
            <button type="button" data-toggle class="text-sm text-slate-500 px-3 py-2 hover:text-slate-700">Cerrar</button>
            ${puedeBorrarTema(p) ? `<button type="button" data-borrar class="text-sm bg-red-100 text-red-600 font-semibold px-3 py-2 rounded-lg">🗑️ Borrar tema</button>` : ""}
          </div>
        </div>
      </article>`;
  }).join("");
}

function togglePreviewForo(articulo) {
  const panel = articulo.querySelector(".detalle-anuncio");
  const abierto = panel.classList.contains("abierto");
  document.querySelectorAll("#foro-posts .detalle-anuncio").forEach(d => d.classList.remove("abierto"));
  if (!abierto) panel.classList.add("abierto");
}

async function eliminarPostForo(id) {
  const post = postsForo.find(p => p.id === id);
  if (!post || !puedeBorrarTema(post)) return;   // (solo visual: la base de datos lo exige también)
  if (!confirm("¿Borrar este tema del foro y todos sus comentarios?")) return;
  try {
    await borrarTemaForo(id);
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
    return;
  }
  postsForo = postsForo.filter(p => p.id !== id);
  renderizarForo();
  mostrarToast("Tema eliminado del foro");
}

function prepararModalNuevoPost() {
  $("foro-titulo").value = "";
  $("foro-contenido").value = "";
  $("foro-anonimo").checked = false;
  const inputAutor = $("foro-autor");
  inputAutor.disabled = false;
  inputAutor.placeholder = "Tu nombre";
  inputAutor.value = (usuarioActual && usuarioActual.nombre) || "";
}

function toggleAnonimoPost() {
  const anonimo = $("foro-anonimo").checked;
  const input = $("foro-autor");
  input.disabled = anonimo;
  input.placeholder = anonimo ? "Anónimo" : "Tu nombre";
  input.value = anonimo ? "" : ((usuarioActual && usuarioActual.nombre) || "");
}

async function publicarEnForo(e) {
  e.preventDefault();
  const titulo = $("foro-titulo").value.trim();
  const contenido = $("foro-contenido").value.trim();
  if (!titulo || !contenido) { mostrarToast("Escribe un título y el contenido", "error"); return; }

  // "Anónimo" solo oculta tu nombre a los demás; la cuenta que publicó queda registrada para moderación.
  let autor = $("foro-autor").value.trim();
  if ($("foro-anonimo").checked || !autor) autor = "Anónimo";

  const btn = $("form-foro-post").querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const nuevo = await crearTemaForo({ titulo, contenido, categoria: $("foro-categoria").value, autor });
    postsForo = [nuevo, ...postsForo];
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
    return;
  } finally {
    btn.disabled = false;
  }
  cerrarModal("modal-foro-post");
  renderizarForo();
  mostrarToast("✅ Publicado en el foro");
}

// Solo corre en index.html (donde existe #foro-posts)
function iniciarForo() {
  if (!$("foro-posts")) return;
  renderizarChipsForo();
  $("foro-posts").innerHTML = '<div class="skeleton h-24 rounded-xl"></div><div class="skeleton h-24 rounded-xl"></div>';

  $("foro-categoria").innerHTML = CATEGORIAS_FORO.filter(c => c.id !== "todos")
    .map(c => `<option value="${esc(c.id)}">${c.icono} ${esc(c.nombre)}</option>`).join("");

  $("foro-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-foro-cat]");
    if (!b) return;
    categoriaForoActiva = b.dataset.foroCat;
    renderizarChipsForo();
    renderizarForo();
  });

  // Delegación: un solo listener para todos los temas
  $("foro-posts").addEventListener("click", e => {
    const art = e.target.closest("[data-post]");
    if (!art) return;
    if (e.target.closest("[data-borrar]")) { eliminarPostForo(Number(art.dataset.post)); return; }
    if (e.target.closest("[data-toggle]")) togglePreviewForo(art);
  });

  $("foro-anonimo").addEventListener("change", toggleAnonimoPost);
  $("form-foro-post").addEventListener("submit", publicarEnForo);
  document.addEventListener("modal:abierto", e => {
    if (e.detail.id === "modal-foro-post") prepararModalNuevoPost();
  });
  // Al entrar o salir, el botón "Borrar tema" aparece/desaparece
  document.addEventListener("sesion:cambio", renderizarForo);
}

// Solo carga los temas en index.html (post.html carga uno solo, por su cuenta).
document.addEventListener("DOMContentLoaded", async () => {
  if (!$("foro-posts")) return;
  iniciarForo();
  await cargarSesion();
  await cargarForo();
  renderizarForo();
});
