// ===== MercaFree - Foro de Ventas (mejorado) =====

let postsForo = [];
let categoriaForoActiva = "todos";
const EDITOR_FORO = /[?&]editar=1/.test(location.search);

const CATEGORIAS_FORO = [
  { id: "todos", nombre: "Todos", icono: "💬" },
  { id: "autos", nombre: "Autos", icono: "🚗" },
  { id: "inmuebles", nombre: "Inmuebles", icono: "🏡" },
  { id: "tecnologia", nombre: "Tecnología", icono: "📱" },
  { id: "servicios", nombre: "Oficios", icono: "🛠️" },
  { id: "hogar", nombre: "Hogar", icono: "🛋️" },
  { id: "otros", nombre: "Otros", icono: "📦" }
];

function cargarForo() {
  try {
    const guardados = localStorage.getItem("mercafree_foro");
    if (guardados) {
      postsForo = JSON.parse(guardados);
    } else {
      postsForo = [
        {
          id: 1,
          titulo: "¿Alguien vende llantas 195/65 R15?",
          contenido: "Busco un juego de llantas en buen estado para un Mazda 3. Preferiblemente en Envigado o Sabaneta.",
          categoria: "autos",
          autor: "Carlos M.",
          fecha: Date.now() - 86400000 * 2,
          respuestas: [
            { autor: "Andrés", texto: "Yo tengo un juego casi nuevo, te escribo al WhatsApp.", fecha: Date.now() - 86400000 }
          ]
        },
        {
          id: 2,
          titulo: "Recomiendo carpintero en La Paz",
          contenido: "Necesitaba un clóset y me lo hicieron muy bien. Si alguien necesita el contacto me avisa.",
          categoria: "servicios",
          autor: "Laura G.",
          fecha: Date.now() - 86400000 * 5,
          respuestas: []
        },
        {
          id: 3,
          titulo: "iPhone 13 en buen estado",
          contenido: "Vendo iPhone 13 de 128GB, batería al 89%. Precio negociable. Zona El Poblado.",
          categoria: "tecnologia",
          autor: "Anónimo",
          fecha: Date.now() - 3600000 * 8,
          respuestas: []
        }
      ];
      guardarForo();
    }
  } catch (e) {
    console.error("Error cargando foro:", e);
    postsForo = [];
  }
}

function guardarForo() {
  localStorage.setItem("mercafree_foro", JSON.stringify(postsForo));
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

function renderizarForo() {
  const cont = document.getElementById("foro-posts");
  const contador = document.getElementById("foro-contador");
  if (!cont) return;

  let lista = postsForo;
  if (categoriaForoActiva !== "todos") {
    lista = postsForo.filter(p => p.categoria === categoriaForoActiva);
  }
  lista = [...lista].sort((a, b) => b.fecha - a.fecha);

  if (contador) {
    contador.textContent = lista.length + (lista.length === 1 ? " publicación" : " publicaciones");
  }

  if (lista.length === 0) {
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
    const previewId = "preview-" + p.id;

    return `
      <article class="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition">
        <div class="p-4 cursor-pointer" onclick="togglePreviewForo(${p.id})">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">${cat.icono} ${cat.nombre}</span>
            <span class="text-xs text-slate-400">${fecha}</span>
          </div>
          <h3 class="font-bold text-slate-900 mb-1">${escaparHTML(p.titulo)}</h3>
          <p class="text-sm text-slate-600 line-clamp-2">${escaparHTML(p.contenido)}</p>
          <div class="flex items-center gap-3 text-xs text-slate-500 mt-2">
            <span>👤 ${escaparHTML(p.autor || "Anónimo")}</span>
            <span>💬 ${numResp} comentario${numResp === 1 ? "" : "s"}</span>
            <span class="text-indigo-500 font-medium ml-auto">Desplegar ▾</span>
          </div>
        </div>

        <!-- Vista desplegable rápida -->
        <div id="${previewId}" class="detalle-anuncio border-t border-slate-100 bg-slate-50 px-4 pb-4">
          <p class="text-sm text-slate-700 whitespace-pre-wrap pt-3 mb-3">${escaparHTML(p.contenido)}</p>
          <div class="flex flex-wrap gap-2">
            <a href="post.html?id=${p.id}${EDITOR_FORO ? '&editar=1' : ''}" class="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
              Ver tema y comentarios →
            </a>
            <button type="button" onclick="event.stopPropagation(); togglePreviewForo(${p.id})" class="text-sm text-slate-500 px-3 py-2 hover:text-slate-700">
              Cerrar
            </button>
            ${EDITOR_FORO ? `<button type="button" onclick="event.stopPropagation(); eliminarPostForo(${p.id})" class="text-sm bg-red-100 text-red-600 font-semibold px-3 py-2 rounded-lg">🗑️ Borrar tema</button>` : ""}
          </div>
        </div>
      </article>`;
  }).join("");
}

function togglePreviewForo(id) {
  const el = document.getElementById("preview-" + id);
  if (!el) return;
  const abierto = el.classList.contains("abierto");
  document.querySelectorAll("#foro-posts .detalle-anuncio").forEach(d => d.classList.remove("abierto"));
  if (!abierto) el.classList.add("abierto");
}

function filtrarForo(cat) {
  categoriaForoActiva = cat;
  document.querySelectorAll(".foro-cat-btn").forEach(btn => {
    btn.classList.remove("bg-indigo-600", "text-white");
    btn.classList.add("bg-slate-100", "text-slate-700");
  });
  if (typeof event !== "undefined" && event.currentTarget) {
    event.currentTarget.classList.remove("bg-slate-100", "text-slate-700");
    event.currentTarget.classList.add("bg-indigo-600", "text-white");
  }
  renderizarForo();
}

function abrirModalNuevoPost() {
  const modal = document.getElementById("modal-foro-post");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.getElementById("foro-titulo").value = "";
  document.getElementById("foro-contenido").value = "";
  const checkAnon = document.getElementById("foro-anonimo");
  const inputAutor = document.getElementById("foro-autor");
  if (checkAnon) checkAnon.checked = false;
  if (inputAutor) {
    inputAutor.disabled = false;
    inputAutor.placeholder = "Tu nombre";
    inputAutor.value = (typeof usuarioActual !== "undefined" && usuarioActual && usuarioActual.nombre)
      ? usuarioActual.nombre
      : "";
  }
}

function cerrarModalForo() {
  const m1 = document.getElementById("modal-foro-post");
  const m2 = document.getElementById("modal-foro-ver");
  if (m1) m1.classList.add("hidden");
  if (m2) m2.classList.add("hidden");
}

function toggleAnonimoPost() {
  const check = document.getElementById("foro-anonimo");
  const input = document.getElementById("foro-autor");
  if (!check || !input) return;
  if (check.checked) {
    input.value = "";
    input.disabled = true;
    input.placeholder = "Anónimo";
  } else {
    input.disabled = false;
    input.placeholder = "Tu nombre";
    if (typeof usuarioActual !== "undefined" && usuarioActual && usuarioActual.nombre) {
      input.value = usuarioActual.nombre;
    }
  }
}

function publicarEnForo(e) {
  e.preventDefault();
  const titulo = document.getElementById("foro-titulo").value.trim();
  const contenido = document.getElementById("foro-contenido").value.trim();
  const categoria = document.getElementById("foro-categoria").value;
  const anonimo = document.getElementById("foro-anonimo") && document.getElementById("foro-anonimo").checked;
  let autor = document.getElementById("foro-autor").value.trim();

  if (anonimo || !autor) autor = "Anónimo";

  if (!titulo || !contenido) {
    alert("Escribe un título y el contenido");
    return;
  }

  const nuevo = {
    id: Date.now(),
    titulo,
    contenido,
    categoria,
    autor,
    fecha: Date.now(),
    respuestas: []
  };

  postsForo.unshift(nuevo);
  guardarForo();
  cerrarModalForo();
  renderizarForo();

  if (typeof mostrarToast === "function") {
    mostrarToast("✅ Publicado en el foro");
  }

  // Opcional: ir directo al tema
  // location.href = "post.html?id=" + nuevo.id;
}

// Compatibilidad: si algo aún llama verPostForo, redirigir a la página
function verPostForo(id) {
  location.href = "post.html?id=" + id;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarForo();
});


function eliminarPostForo(id) {
  if (!EDITOR_FORO) return;
  if (!confirm("¿Borrar este tema del foro y todos sus comentarios?")) return;
  postsForo = postsForo.filter(p => p.id !== id);
  guardarForo();
  renderizarForo();
  if (typeof mostrarToast === "function") mostrarToast("Tema eliminado del foro");
}
