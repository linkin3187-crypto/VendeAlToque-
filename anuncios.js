// ===== Merkap · «Todos los anuncios» (anuncios.html) =====
// Página de búsqueda con calma: los mismos filtros del inicio, en cuadrícula y sin carrusel.
// La lógica de filtros y la tarjeta están en anuncios-comun.js (compartida con el inicio).
// Los filtros se guardan en el enlace (anuncios.html?ciudad=Envigado&cat=vehiculos) para poder compartirlos.

const POR_PAGINA_TODOS = 24;
let listaTodos = [];
let paginaTodos = 1;

function pintarTodos() {
  const cont = $("contenedor-anuncios");
  const total = listaTodos.length;
  const visibles = listaTodos.slice(0, paginaTodos * POR_PAGINA_TODOS);
  $("contador-resultados").textContent = total + (total === 1 ? " anuncio" : " anuncios");
  $("estado-vacio").classList.toggle("hidden", total > 0);
  const sinAnuncios = baseDatosAnuncios.length === 0;
  $("vacio-icono").textContent = sinAnuncios ? "🚀" : "🔍";
  $("vacio-titulo").textContent = sinAnuncios ? "Aún no hay anuncios" : "No encontramos resultados";
  $("vacio-texto").textContent = sinAnuncios ? "¡Sé el primero en publicar! Es gratis y toma un minuto." : "Prueba con otra búsqueda o quita filtros";
  $("vacio-limpiar").classList.toggle("hidden", sinAnuncios);
  cont.innerHTML = visibles.map(tarjetaHTML).join("");
  const restantes = total - visibles.length;
  $("contenedor-mas").classList.toggle("hidden", restantes <= 0);
  if (restantes > 0) $("btn-mas").textContent = `Mostrar más (${restantes} restantes)`;
}

// Filtra, pinta y deja los filtros en el enlace (sin recargar la página)
function aplicarTodos() {
  listaTodos = filtrarAnuncios(leerCriterios());
  paginaTodos = 1;
  pintarTodos();
  pintarChipsActivos();
  const qs = criteriosAQuery();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

function limpiarTodos() {
  $("buscador").value = "";
  ["filtro-precio-min", "filtro-precio-max"].forEach(id => { $(id).value = ""; });
  ["filtro-con-foto", "filtro-con-precio"].forEach(id => { $(id).checked = false; });
  $("filtro-estado").value = "";
  $("filtro-departamento").value = "";
  $("filtro-radio").value = "0";
  $("ordenar-por").value = "recientes";
  categoriaActiva = "todos";
  subcategoriaActiva = "";
  $("btn-cerca-anuncios").setAttribute("aria-pressed", "false");
  marcarCategoriaActiva();
  llenarCiudadesFiltro();
  aplicarTodos();
}

async function pedirGPSTodos() {
  ubicacionUsuario = await obtenerGPS();
  return ubicacionUsuario;
}

// «📡 Cerca de mí»: igual que en el inicio (ordena por cercanía; tocar otra vez lo apaga)
async function cercaDeMiTodos() {
  const btn = $("btn-cerca-anuncios");
  if (btn.getAttribute("aria-pressed") === "true") {
    btn.setAttribute("aria-pressed", "false");
    if ($("ordenar-por").value === "cercanos") $("ordenar-por").value = "recientes";
    aplicarTodos();
    return;
  }
  btn.disabled = true; btn.textContent = "📡 Buscando tu ubicación…";
  try {
    await pedirGPSTodos();
    $("ordenar-por").value = "cercanos";
    btn.setAttribute("aria-pressed", "true");
    aplicarTodos();
  } catch (err) {
    mostrarToast(textoErrorGPS(err), "error");
  } finally {
    btn.disabled = false; btn.textContent = "📡 Cerca de mí";
  }
}

async function corazonTodos(id, btn) {
  if (!usuarioActual) {
    mostrarToast("Inicia sesión para guardar favoritos", "error");
    setTimeout(() => { location.href = "index.html#login"; }, 900);
    return;
  }
  const antes = favoritosIds.has(id);
  const pintar = g => { btn.textContent = g ? "❤️" : "🤍"; btn.setAttribute("aria-pressed", String(g)); btn.setAttribute("aria-label", g ? "Quitar de favoritos" : "Guardar en favoritos"); };
  pintar(!antes);
  btn.disabled = true;
  try {
    const ahora = await alternarFavorito(id);
    pintar(ahora);
    mostrarToast(ahora ? "❤️ Guardado en favoritos" : "Quitado de favoritos");
  } catch (err) {
    pintar(antes);
    mostrarToast(mensajeError(err), "error");
  } finally {
    btn.disabled = false;
  }
}

async function compartirBusqueda() {
  const url = location.href;
  const texto = "Mira estos anuncios en Merkap";
  try {
    if (navigator.share) { await navigator.share({ title: "Merkap", text: texto, url }); return; }
    await navigator.clipboard.writeText(url);
    mostrarToast("🔗 Enlace copiado: pégalo en WhatsApp");
  } catch (err) {
    if (err && err.name === "AbortError") return;   // la persona cerró el menú de compartir
    prompt("Copia este enlace:", url);
  }
}

function iniciarEventosTodos() {
  const conRetraso = debounce(aplicarTodos, 250);
  $("buscador").addEventListener("input", conRetraso);
  ["filtro-precio-min", "filtro-precio-max"].forEach(id => $(id).addEventListener("input", conRetraso));
  ["filtro-estado", "filtro-ciudad", "filtro-con-foto", "filtro-con-precio"].forEach(id => $(id).addEventListener("change", aplicarTodos));
  $("filtro-departamento").addEventListener("change", () => { llenarCiudadesFiltro(); aplicarTodos(); });

  // «Distancia» y «Más cercanos» necesitan la ubicación: se pide al elegirlas
  const requiereUbicacion = async (sel, valorSinUbicacion, esActiva) => {
    if (esActiva(sel.value) && !ubicacionUsuario) {
      try { await pedirGPSTodos(); }
      catch (err) { mostrarToast(textoErrorGPS(err), "error"); sel.value = valorSinUbicacion; }
    }
    aplicarTodos();
  };
  $("filtro-radio").addEventListener("change", e => requiereUbicacion(e.target, "0", v => parseFloat(v) > 0));
  $("ordenar-por").addEventListener("change", e => requiereUbicacion(e.target, "recientes", v => v === "cercanos"));

  $("btn-filtros").addEventListener("click", () => {
    const abierto = $("panel-filtros").classList.toggle("hidden") === false;
    $("flecha-filtros").textContent = abierto ? "▴" : "▾";
    $("btn-filtros").setAttribute("aria-expanded", abierto ? "true" : "false");
  });
  $("btn-limpiar-filtros").addEventListener("click", limpiarTodos);
  $("vacio-limpiar").addEventListener("click", limpiarTodos);
  $("btn-cerca-anuncios").addEventListener("click", cercaDeMiTodos);
  $("btn-compartir-busqueda").addEventListener("click", compartirBusqueda);

  conectarSelectCategorias(() => aplicarTodos());   // fase 2AS

  // Botones de cada tarjeta (delegación de eventos)
  $("contenedor-anuncios").addEventListener("click", e => {
    const b = e.target.closest("[data-accion]");
    const fila = e.target.closest("[data-id]");
    if (!b || !fila) return;
    const id = Number(fila.dataset.id);
    if (b.dataset.accion === "favorito") corazonTodos(id, b);
    else if (b.dataset.accion === "editar") location.href = "index.html?editar=" + id;
    // El mapa y las herramientas de moderador están en la ficha del anuncio
    else location.href = "anuncio.html?id=" + id;
  });
  $("contenedor-anuncios").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);

  // «Mostrar más» y carga automática al llegar al final
  const masUno = () => { if (paginaTodos * POR_PAGINA_TODOS < listaTodos.length) { paginaTodos++; pintarTodos(); } };
  $("btn-mas").addEventListener("click", masUno);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(ent => { if (ent.some(x => x.isIntersecting) && listaTodos.length) masUno(); }, { rootMargin: "400px" })
      .observe($("centinela-mas"));
  }
}

// Llegaron las categorías de la base (fase 2Z): se repintan los chips
document.addEventListener("categorias:anuncio", () => {
  pintarCategoriasSelect();
  marcarCategoriaActiva();
});

document.addEventListener("DOMContentLoaded", async () => {
  pintarCategoriasSelect();
  marcarCategoriaActiva();
  iniciarEventosTodos();
  conectarBuscadorGlobal(() => ({ anuncios: baseDatosAnuncios, comercios: [] }));
  await cargarDatos();
  refrescarOpcionesUbicacion();
  aplicarQueryAUI(location.search);   // filtros que vienen en el enlace (p. ej. desde el inicio)
  if (usuarioActual) {
    $("link-favoritos").classList.remove("hidden");
    try { await cargarFavoritos(); } catch (e) { /* sin favoritos la lista sigue funcionando */ }
  }
  aplicarTodos();
  revisarContactoPendiente();   // volvió del correo de confirmación con un contacto pendiente
});
