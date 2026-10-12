// ===== MercaFree - Foro de Ventas =====
// Requiere utils.js y data.js (de ahí vienen esc, EDITOR, CATEGORIAS_FORO...).
// Se usa en index.html (lista) y en post.html (carga los datos).

let postsForo = [];
let categoriaForoActiva = "todos";

function cargarForo() {
  try {
    const guardados = localStorage.getItem("mercafree_foro");
    if (guardados) {
      postsForo = JSON.parse(guardados);
    } else {
      postsForo = [
        { id: 1, titulo: "¿Alguien vende llantas 195/65 R15?",
          contenido: "Busco un juego de llantas en buen estado para un Mazda 3. Preferiblemente en Envigado o Sabaneta.",
          categoria: "autos", autor: "Carlos M.", fecha: Date.now() - 86400000 * 2,
          respuestas: [{ autor: "Andrés", texto: "Yo tengo un juego casi nuevo, te escribo al WhatsApp.", fecha: Date.now() - 86400000 }] },
        { id: 2, titulo: "Recomiendo carpintero en La Paz",
          contenido: "Necesitaba un clóset y me lo hicieron muy bien. Si alguien necesita el contacto me avisa.",
          categoria: "servicios", autor: "Laura G.", fecha: Date.now() - 86400000 * 5, respuestas: [] },
        { id: 3, titulo: "iPhone 13 en buen estado",
          contenido: "Vendo iPhone 13 de 128GB, batería al 89%. Precio negociable. Zona El Poblado.",
          categoria: "tecnologia", autor: "Anónimo", fecha: Date.now() - 3600000 * 8, respuestas: [] }
      ];
      guardarForo();
    }
  } catch (e) {
    console.error("Error cargando foro:", e);
    postsForo = [];
  }
}

function guardarForo() {
  try {
    localStorage.setItem("mercafree_foro", JSON.stringify(postsForo));
    return true;
  } catch (e) {
    mostrarToast("⚠️ No se pudo guardar (almacenamiento lleno)", "error");
    return false;
  }
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
            <a href="post.html?id=${Number(p.id)}${EDITOR ? "&editar=1" : ""}" class="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">Ver tema y comentarios →</a>
            <button type="button" data-toggle class="text-sm text-slate-500 px-3 py-2 hover:text-slate-700">Cerrar</button>
            ${EDITOR ? `<button type="button" data-borrar class="text-sm bg-red-100 text-red-600 font-semibold px-3 py-2 rounded-lg">🗑️ Borrar tema</button>` : ""}
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

function eliminarPostForo(id) {
  if (!EDITOR) return;
  if (!confirm("¿Borrar este tema del foro y todos sus comentarios?")) return;
  const anterior = postsForo;
  postsForo = postsForo.filter(p => p.id !== id);
  if (!guardarForo()) { postsForo = anterior; return; }
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

function publicarEnForo(e) {
  e.preventDefault();
  const titulo = $("foro-titulo").value.trim();
  const contenido = $("foro-contenido").value.trim();
  if (!titulo || !contenido) { mostrarToast("Escribe un título y el contenido", "error"); return; }

  let autor = $("foro-autor").value.trim();
  if ($("foro-anonimo").checked || !autor) autor = "Anónimo";

  const nuevo = { id: Date.now(), titulo, contenido, categoria: $("foro-categoria").value, autor, fecha: Date.now(), respuestas: [] };
  const anterior = postsForo;
  postsForo = [nuevo, ...postsForo];
  if (!guardarForo()) { postsForo = anterior; return; }

  cerrarModal("modal-foro-post");
  renderizarForo();
  mostrarToast("✅ Publicado en el foro");
}

// Solo corre en index.html (donde existe #foro-posts)
function iniciarForo() {
  if (!$("foro-posts")) return;
  renderizarChipsForo();
  renderizarForo();

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
}

document.addEventListener("DOMContentLoaded", () => {
  cargarForo();
  iniciarForo();
});
