// ===== MercaFree - Foro de Ventas =====

let postsForo = [];
let categoriaForoActiva = "todos";

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
      // Posts de ejemplo
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
          autor: "Anonimo",
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

function renderizarForo() {
  const cont = document.getElementById("foro-posts");
  const contador = document.getElementById("foro-contador");
  if (!cont) return;

  let lista = postsForo;
  if (categoriaForoActiva !== "todos") {
    lista = postsForo.filter(p => p.categoria === categoriaForoActiva);
  }

  // Ordenar por más recientes
  lista = [...lista].sort((a, b) => b.fecha - a.fecha);

  contador.textContent = lista.length + (lista.length === 1 ? " publicación" : " publicaciones");

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

    return `
      <article class="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">${cat.icono} ${cat.nombre}</span>
              <span class="text-xs text-slate-400">${fecha}</span>
            </div>
            <h3 class="font-bold text-slate-900 mb-1">${escaparHTML(p.titulo)}</h3>
            <p class="text-sm text-slate-600 line-clamp-2 mb-2">${escaparHTML(p.contenido)}</p>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span>👤 ${escaparHTML(p.autor || "Anónimo")}</span>
              <span>💬 ${numResp} respuesta${numResp === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <button onclick="verPostForo(${p.id})" class="text-sm text-indigo-600 font-medium hover:underline">Ver y responder</button>
        </div>
      </article>`;
  }).join("");
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
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
  document.getElementById("modal-foro-post").classList.remove("hidden");
  document.getElementById("foro-titulo").value = "";
  document.getElementById("foro-contenido").value = "";
  document.getElementById("foro-autor").value = usuarioActual ? usuarioActual.nombre : "";
}

function cerrarModalForo() {
  document.getElementById("modal-foro-post").classList.add("hidden");
  document.getElementById("modal-foro-ver").classList.add("hidden");
}

function publicarEnForo(e) {
  e.preventDefault();
  const titulo = document.getElementById("foro-titulo").value.trim();
  const contenido = document.getElementById("foro-contenido").value.trim();
  const categoria = document.getElementById("foro-categoria").value;
  const autor = document.getElementById("foro-autor").value.trim() || "Anónimo";

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
  mostrarToast("✅ Publicado en el foro");
}

let postActualForo = null;

function verPostForo(id) {
  const post = postsForo.find(p => p.id === id);
  if (!post) return;
  postActualForo = post;

  const cat = CATEGORIAS_FORO.find(c => c.id === post.categoria) || { icono: "📦", nombre: post.categoria };
  const fecha = new Date(post.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  document.getElementById("foro-ver-titulo").textContent = post.titulo;
  document.getElementById("foro-ver-meta").innerHTML = `
    <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">${cat.icono} ${cat.nombre}</span>
    <span class="text-xs text-slate-500">por ${escaparHTML(post.autor)} · ${fecha}</span>
  `;
  document.getElementById("foro-ver-contenido").textContent = post.contenido;

  const contResp = document.getElementById("foro-respuestas");
  const respuestas = post.respuestas || [];
  if (respuestas.length === 0) {
    contResp.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Sé el primero en responder</p>';
  } else {
    contResp.innerHTML = respuestas.map(r => {
      const f = new Date(r.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
      return `
        <div class="bg-slate-50 rounded-lg p-3 mb-2">
          <div class="flex justify-between text-xs text-slate-500 mb-1">
            <span class="font-medium text-slate-700">${escaparHTML(r.autor)}</span>
            <span>${f}</span>
          </div>
          <p class="text-sm text-slate-700">${escaparHTML(r.texto)}</p>
        </div>`;
    }).join("");
  }

  document.getElementById("foro-respuesta-texto").value = "";
  document.getElementById("foro-respuesta-autor").value = usuarioActual ? usuarioActual.nombre : "";
  document.getElementById("modal-foro-ver").classList.remove("hidden");
}

function enviarRespuesta(e) {
  e.preventDefault();
  if (!postActualForo) return;

  const texto = document.getElementById("foro-respuesta-texto").value.trim();
  const autor = document.getElementById("foro-respuesta-autor").value.trim() || "Anónimo";

  if (!texto) {
    alert("Escribe una respuesta");
    return;
  }

  if (!postActualForo.respuestas) postActualForo.respuestas = [];
  postActualForo.respuestas.push({
    autor,
    texto,
    fecha: Date.now()
  });

  // Actualizar en el array
  const idx = postsForo.findIndex(p => p.id === postActualForo.id);
  if (idx !== -1) postsForo[idx] = postActualForo;

  guardarForo();
  verPostForo(postActualForo.id); // refrescar
  renderizarForo();
  mostrarToast("✅ Respuesta publicada");
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  cargarForo();
  // Se llama renderizarForo desde el load principal también
});
