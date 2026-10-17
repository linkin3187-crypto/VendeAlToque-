// ===== MercaFree · Editar inicio y buscador (Fase 2Z.2) =====
// Solo moderadores. Tres paneles: 🎠 carrusel (banners_inicio), 🧩 cuadros de acceso (accesos_inicio)
// y 🧠 entrenar el buscador (palabras clave de las categorías). Ver supabase/20 y 21.

// ---------- «A dónde lleva»: menú en vez de escribir enlaces ----------
const TIPOS_DESTINO = [
  ["ccat", "Categoría de comercios"], ["acat", "Categoría de anuncios"], ["comercio", "Un comercio específico"],
  ["busqueda", "Una búsqueda"], ["publicar", "📢 Publicar un anuncio"], ["contenido", "⬇️ Bajar a los anuncios"],
  ["recomendar", "🤝 Recomendar un comercio"], ["registrar", "🏪 Registrar mi negocio"],
  ["directorio", "Directorio de comercios"], ["anuncios", "Todos los anuncios"], ["otra", "Otra página del sitio"]
];
const DESTINO_FIJO = { publicar: "#publicar", contenido: "#contenido", recomendar: "recomendar.html", registrar: "registrar-negocio.html", directorio: "comercios.html", anuncios: "anuncios.html" };

function analizarDestino(d) {
  d = String(d || "");
  for (const [k, v] of Object.entries(DESTINO_FIJO)) if (d === v) return { tipo: k };
  let m;
  if ((m = /^comercios\.html\?tipo=([a-z0-9_]+)$/.exec(d))) return { tipo: "ccat", valor: m[1] };
  if ((m = /^anuncios\.html\?cat=([a-z0-9_]+)$/.exec(d))) return { tipo: "acat", valor: m[1] };
  if ((m = /^tienda\.html\?id=(\d+)$/.exec(d))) return { tipo: "comercio", valor: m[1] };
  if ((m = /^buscar\.html\?q=(.+)$/.exec(d))) { try { return { tipo: "busqueda", valor: decodeURIComponent(m[1].replace(/\+/g, " ")) }; } catch (e) { /* sigue */ } }
  return { tipo: d ? "otra" : "ccat", valor: d };
}

const etiquetaComercio = c => `${c.nombre} · ${c.ciudad || ""} (#${c.id})`;

function selectorDestinoHTML(destino) {
  const a = analizarDestino(destino);
  // Si el destino guardado usa una categoría que no está en la lista (desactivada o borrada), se conserva igual
  const opt = (lista, actual) => (actual && !lista.some(([v]) => v === actual) ? [[actual, "⚠️ " + actual]] : []).concat(lista)
    .map(([v, t]) => `<option value="${esc(v)}" ${v === actual ? "selected" : ""}>${t}</option>`).join("");
  const comercio = a.tipo === "comercio" ? comercios.find(c => String(c.id) === String(a.valor)) : null;
  return `<div class="dest grid gap-1.5" data-dest>
    <select data-d="tipo" class="w-full border border-slate-300 p-1.5 rounded-lg text-sm bg-white">${opt(TIPOS_DESTINO, a.tipo)}</select>
    <select data-d="ccat" class="w-full border border-slate-300 p-1.5 rounded-lg text-sm bg-white">${opt(TIPOS_COMERCIO.map(t => [t.id, t.icono + " " + t.nombre]), a.tipo === "ccat" ? a.valor : "")}</select>
    <select data-d="acat" class="w-full border border-slate-300 p-1.5 rounded-lg text-sm bg-white">${opt(CATEGORIAS.filter(c => c.id !== "todos").map(c => [c.id, c.icono + " " + c.nombre]), a.tipo === "acat" ? a.valor : "")}</select>
    <input data-d="comercio" list="dl-comercios" placeholder="Escribe el nombre del comercio…" value="${esc(comercio ? etiquetaComercio(comercio) : (a.tipo === "comercio" ? "#" + a.valor : ""))}" class="w-full border border-slate-300 p-1.5 rounded-lg text-sm">
    <input data-d="busqueda" maxlength="60" placeholder="Ej. empanadas" value="${esc(a.tipo === "busqueda" ? a.valor : "")}" class="w-full border border-slate-300 p-1.5 rounded-lg text-sm">
    <input data-d="otra" maxlength="160" placeholder="pagina.html?algo=valor" value="${esc(a.tipo === "otra" ? a.valor : "")}" class="w-full border border-slate-300 p-1.5 rounded-lg text-xs">
    <p data-d="vista" class="text-[11px] text-slate-400 break-all"></p>
  </div>`;
}

function leerDestino(cont) {
  const v = k => cont.querySelector(`[data-d="${k}"]`).value.trim();
  const tipo = v("tipo");
  if (DESTINO_FIJO[tipo]) return DESTINO_FIJO[tipo];
  if (tipo === "ccat") return v("ccat") ? "comercios.html?tipo=" + v("ccat") : "";
  if (tipo === "acat") return v("acat") ? "anuncios.html?cat=" + v("acat") : "";
  if (tipo === "comercio") { const m = /#(\d+)\)?\s*$/.exec(v("comercio")); return m ? "tienda.html?id=" + m[1] : ""; }
  if (tipo === "busqueda") return v("busqueda") ? "buscar.html?q=" + encodeURIComponent(v("busqueda")) : "";
  return v("otra");
}

function refrescarDestino(cont) {
  const tipo = cont.querySelector('[data-d="tipo"]').value;
  ["ccat", "acat", "comercio", "busqueda", "otra"].forEach(k => cont.querySelector(`[data-d="${k}"]`).classList.toggle("hidden", k !== tipo));
  const d = leerDestino(cont);
  const vista = cont.querySelector('[data-d="vista"]');
  vista.textContent = d ? "→ " + d + (destinoAccesoValido(d) ? "" : "  ⚠️ no válido") : "→ (elige el destino)";
  vista.classList.toggle("text-red-600", !!d && !destinoAccesoValido(d));
}

// ---------- 1) Carrusel ----------
let bannersAdmin = [];
const imagenesPendientes = new Map();   // fila (elemento) → data:image… por subir al guardar

function filaBanner(b) {
  const pal = PALETAS_BANNER[b.paleta] ? b.paleta : "indigo";
  const opcPal = Object.entries(PALETAS_BANNER).map(([k, p]) => `<option value="${k}" ${k === pal ? "selected" : ""}>${esc(p.nombre)}</option>`).join("");
  const campo = (etq, html, extra = "") => `<label class="text-[11px] font-bold text-slate-500 ${extra}">${etq}${html}</label>`;
  const inp = (k, v, max, ph = "") => `<input data-c="${k}" maxlength="${max}" value="${esc(v || "")}" placeholder="${esc(ph)}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm">`;
  return `<div class="border border-slate-200 rounded-2xl p-3 ${b.activo === false ? "opacity-60" : ""}" data-ban="${b.id || ""}">
    <div class="car-marco ban-vista mb-3"><div class="car-pista" data-vista></div></div>
    <div class="grid sm:grid-cols-2 gap-2">
      ${campo("Etiqueta (arriba, pequeña)", inp("etiqueta", b.etiqueta, 40, "Ej. Publica en 1 minuto"))}
      ${campo("Título *", inp("titulo", b.titulo, 60, "Ej. Tu anuncio, gratis"))}
      ${campo("Texto", `<textarea data-c="texto" maxlength="160" rows="2" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm">${esc(b.texto || "")}</textarea>`, "sm:col-span-2")}
      ${campo("Texto del botón *", inp("boton", b.boton, 30, "Ej. Ver ofertas"))}
      ${campo("El botón lleva a", selectorDestinoHTML(b.destino))}
      ${campo("Colores", `<select data-c="paleta" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm bg-white">${opcPal}</select>
        <span data-colores class="${pal === "personal" ? "" : "hidden"} mt-1 flex items-center gap-2 text-[11px] font-normal">De <input type="color" data-c="color1" value="${esColorHex(b.color1) ? b.color1 : "#4338ca"}"> a <input type="color" data-c="color2" value="${esColorHex(b.color2) ? b.color2 : "#db2777"}"></span>`)}
      <div class="grid grid-cols-2 gap-2">${campo("Ícono grande", inp("icono1", b.icono1 || "⭐", 8))}${campo("Ícono pequeño", inp("icono2", b.icono2, 8))}</div>
      ${campo("Imagen (opcional)", `<input type="file" data-c="archivo" accept="image/png,image/webp,image/jpeg" class="mt-1 block w-full text-xs font-normal">
        <span class="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-normal">
          <label class="flex items-center gap-1"><input type="radio" name="modo-${b.id || "n" + Math.random().toString(36).slice(2)}" data-c="modo" value="lado" ${b.imagen_modo !== "fondo" ? "checked" : ""}> Al lado</label>
          <label class="flex items-center gap-1"><input type="radio" name="modo-${b.id || "m" + Math.random().toString(36).slice(2)}" data-c="modo" value="fondo" ${b.imagen_modo === "fondo" ? "checked" : ""}> De fondo</label>
          <button type="button" data-ban-quitar-img class="${b.imagen_url ? "" : "hidden"} underline text-red-600">Quitar imagen</button>
        </span><input type="hidden" data-c="imagen_url" value="${esc(b.imagen_url || "")}">`, "sm:col-span-2")}
      <div class="flex flex-wrap items-end gap-3 sm:col-span-2">
        ${campo("Orden", `<input data-c="orden" type="number" value="${Number(b.orden) || 100}" class="mt-0.5 w-20 border border-slate-300 p-1.5 rounded-lg font-normal text-sm">`)}
        <label class="text-xs flex items-center gap-1 pb-2"><input type="checkbox" data-c="activo" ${b.activo === false ? "" : "checked"}> Visible</label>
        <button type="button" data-ban-guardar class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm">Guardar</button>
        ${b.id ? '<button type="button" data-ban-borrar class="text-sm text-slate-400 hover:text-red-600 pb-2">🗑️ Borrar</button>' : ""}
      </div>
    </div>
  </div>`;
}

function leerBanner(f) {
  const v = k => f.querySelector(`[data-c="${k}"]`);
  const modo = f.querySelector('[data-c="modo"]:checked');
  return {
    id: Number(f.dataset.ban) || null,
    etiqueta: v("etiqueta").value.trim(), titulo: v("titulo").value.trim(), texto: v("texto").value.trim(),
    boton: v("boton").value.trim(), destino: leerDestino(f.querySelector("[data-dest]")),
    paleta: v("paleta").value, color1: v("color1").value, color2: v("color2").value,
    icono1: v("icono1").value.trim() || "⭐", icono2: v("icono2").value.trim(),
    imagen_url: imagenesPendientes.get(f) || v("imagen_url").value || null, imagen_modo: modo ? modo.value : "lado",
    orden: parseInt(v("orden").value, 10) || 100, activo: v("activo").checked
  };
}

function vistaBanner(f) {
  const b = leerBanner(f);
  // En la vista previa la imagen pendiente es un data: (urlSegura solo deja https), así que la mostramos aparte
  const pendiente = imagenesPendientes.get(f);
  const cont = f.querySelector("[data-vista]");
  cont.innerHTML = bannerHTML({ ...b, titulo: b.titulo || "Título", boton: b.boton || "Botón", destino: "#contenido", imagen_url: pendiente ? null : b.imagen_url }, 0, 1);
  if (pendiente) {           // imagen aún sin subir: se muestra desde el celular/PC
    const slide = cont.querySelector(".car-slide");
    if (b.imagen_modo === "fondo") {
      slide.classList.add("car-con-fondo");
      slide.style.backgroundImage = `linear-gradient(90deg, rgba(15,23,42,.82), rgba(15,23,42,.35)), url('${pendiente}')`;
      slide.style.backgroundSize = "cover"; slide.style.backgroundPosition = "center";
      const arte = slide.querySelector(".car-arte"); if (arte) arte.remove();
    } else {
      const arte = slide.querySelector(".car-arte");
      if (arte) { arte.innerHTML = '<img alt="" class="car-img">'; arte.querySelector("img").src = pendiente; }
    }
  }
  f.querySelector("[data-colores]").classList.toggle("hidden", b.paleta !== "personal");
  refrescarDestino(f.querySelector("[data-dest]"));
}

async function pintarBannersAdmin() {
  try {
    bannersAdmin = await cargarBannersAdmin();
    $("ban-n").textContent = "(" + bannersAdmin.length + ")";
    $("ban-lista").innerHTML = bannersAdmin.length ? bannersAdmin.map(filaBanner).join("")
      : '<p class="text-sm text-slate-400 text-center py-4">No hay diapositivas en la base: el inicio muestra las de siempre. Crea una con «➕ Nueva diapositiva».</p>';
    $("ban-lista").querySelectorAll("[data-ban]").forEach(vistaBanner);
  } catch (e) {
    $("ban-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Se activa al ejecutar supabase/21_editor_inicio.sql.</p>';
  }
}

async function accionBanner(e) {
  const f = e.target.closest("[data-ban]");
  if (!f) return;
  if (e.target.closest("[data-ban-quitar-img]")) {
    imagenesPendientes.delete(f);
    f.querySelector('[data-c="imagen_url"]').value = "";
    f.querySelector('[data-c="archivo"]').value = "";
    e.target.closest("[data-ban-quitar-img]").classList.add("hidden");
    vistaBanner(f); return;
  }
  if (e.target.closest("[data-ban-borrar]")) {
    if (!confirm("¿Borrar esta diapositiva? (Para esconderla sin borrar, quita «Visible»)")) return;
    try { await borrarBannerDB(Number(f.dataset.ban)); mostrarToast("🗑️ Diapositiva borrada"); await pintarBannersAdmin(); } catch (err) { mostrarToast(mensajeError(err), "error"); }
    return;
  }
  const b = e.target.closest("[data-ban-guardar]");
  if (!b) return;
  const fila = leerBanner(f);
  if (fila.titulo.length < 2) { mostrarToast("Escribe el título", "error"); return; }
  if (fila.boton.length < 2) { mostrarToast("Escribe el texto del botón", "error"); return; }
  if (!destinoAccesoValido(fila.destino)) { mostrarToast("Elige a dónde lleva el botón", "error"); return; }
  if (fila.paleta !== "personal") { fila.color1 = null; fila.color2 = null; }
  b.disabled = true; b.textContent = "Guardando…";
  try {
    const pendiente = imagenesPendientes.get(f);
    if (pendiente) fila.imagen_url = await subirFotoComercio(pendiente);
    await guardarBannerDB(fila);
    imagenesPendientes.delete(f);
    mostrarToast("✅ Diapositiva guardada: ya se ve en el inicio");
    await pintarBannersAdmin();
  } catch (err) { mostrarToast(mensajeError(err), "error"); b.disabled = false; b.textContent = "Guardar"; }
}

async function elegirImagen(e, maxFondo, maxLado = 700) {
  const inp = e.target.closest('[data-c="archivo"]');
  if (!inp || !inp.files[0]) return null;
  const f = inp.closest("[data-ban], [data-acc]");
  const modo = f.querySelector('[data-c="modo"]:checked');
  const deFondo = modo && modo.value === "fondo";
  try {
    const data = await comprimir(inp.files[0], deFondo ? { max: maxFondo } : { max: maxLado, transparencia: true });
    if (data.length * 0.75 > 1000000) { mostrarToast("La imagen pesa más de 1 MB aun comprimida. Prueba con una más pequeña", "error"); inp.value = ""; return null; }
    imagenesPendientes.set(f, data);
    const q = f.querySelector("[data-ban-quitar-img], [data-acc-quitar-img]");
    if (q) q.classList.remove("hidden");
    return f;
  } catch (err) { mostrarToast("No se pudo leer la imagen", "error"); return null; }
}

// ---------- 2) Cuadros de acceso ----------
let accesosAdmin = [];
function filaAcceso(x) {
  const img = urlSegura(x.imagen_url || "");
  return `<div class="border border-slate-200 rounded-xl p-2.5 ${x.activo === false ? "opacity-60" : ""}" data-acc="${x.id || ""}">
    <div class="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[4.5rem_1fr_8rem_1.4fr_4rem_auto] gap-2 items-start">
      <div class="flex flex-col items-center gap-1">
        <span class="acceso-cuadro acc-${COLORES_ACCESO.includes(x.color) ? x.color : "morado"} ${img ? "con-imagen" : ""}" data-acc-mini>${img ? `<img src="${esc(img)}" alt="">` : `<span class="acceso-ico">${esc(x.icono || "⭐")}</span>`}</span>
      </div>
      <div class="grid gap-1.5">
        <label class="text-[11px] font-bold text-slate-500">Título<input data-c="titulo" maxlength="24" value="${esc(x.titulo || "")}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
        <label class="text-[11px] font-bold text-slate-500">Ícono<input data-c="icono" maxlength="8" value="${esc(x.icono || "⭐")}" class="mt-0.5 w-20 border border-slate-300 p-1.5 rounded-lg text-center text-lg"></label>
      </div>
      <label class="text-[11px] font-bold text-slate-500 col-span-2 sm:col-span-1">Color<select data-c="color" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm bg-white">${COLORES_ACCESO.map(c => `<option value="${c}" ${c === x.color ? "selected" : ""}>${c}</option>`).join("")}</select>
        <span class="block mt-2">Imagen (opcional)</span><input type="file" data-c="archivo" accept="image/png,image/webp,image/jpeg" class="mt-0.5 block w-full text-[11px] font-normal">
        <button type="button" data-acc-quitar-img class="${img ? "" : "hidden"} mt-1 underline text-red-600 font-normal">Quitar imagen</button>
        <input type="hidden" data-c="imagen_url" value="${esc(x.imagen_url || "")}"></label>
      <label class="text-[11px] font-bold text-slate-500 col-span-2 sm:col-span-1">Lleva a${selectorDestinoHTML(x.destino)}</label>
      <label class="text-[11px] font-bold text-slate-500">Orden<input data-c="orden" type="number" value="${Number(x.orden) || 100}" class="mt-0.5 w-full border border-slate-300 p-1.5 rounded-lg font-normal text-sm"></label>
      <div class="flex flex-wrap items-center gap-2 sm:pt-4">
        <label class="text-xs flex items-center gap-1"><input type="checkbox" data-c="activo" ${x.activo === false ? "" : "checked"}> Visible</label>
        <button type="button" data-acc-guardar class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">Guardar</button>
        ${x.id ? '<button type="button" data-acc-borrar class="text-slate-400 hover:text-red-600 text-sm" aria-label="Borrar cuadro">🗑️</button>' : ""}
      </div>
    </div>
  </div>`;
}
function vistaAccesos() {
  const visibles = accesosAdmin.filter(x => x.activo !== false && destinoAccesoValido(x.destino));
  $("acc-vista").classList.toggle("hidden", !visibles.length);
  $("acc-vista").innerHTML = visibles.map(x => {
    const img = urlSegura(x.imagen_url || "");
    return `<span class="acceso"><span class="acceso-cuadro acc-${COLORES_ACCESO.includes(x.color) ? x.color : "morado"} ${img ? "con-imagen" : ""}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="acceso-ico">${esc(x.icono)}</span>`}</span><span class="acceso-txt">${esc(x.titulo)}</span></span>`;
  }).join("");
}
function miniAcceso(f) {
  const v = k => f.querySelector(`[data-c="${k}"]`).value;
  const mini = f.querySelector("[data-acc-mini]");
  const img = imagenesPendientes.get(f) || urlSegura(v("imagen_url") || "");
  mini.className = `acceso-cuadro acc-${v("color")} ${img ? "con-imagen" : ""}`;
  mini.innerHTML = img ? `<img src="${esc(img)}" alt="">` : `<span class="acceso-ico">${esc(v("icono") || "⭐")}</span>`;
  refrescarDestino(f.querySelector("[data-dest]"));
}
async function pintarAccesosAdmin() {
  try {
    accesosAdmin = await cargarAccesosAdmin();
    $("ac-n").textContent = "(" + accesosAdmin.length + ")";
    $("acc-lista").innerHTML = accesosAdmin.map(filaAcceso).join("");
    $("acc-lista").querySelectorAll("[data-acc]").forEach(miniAcceso);
    vistaAccesos();
  } catch (e) {
    $("acc-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Se activa al ejecutar supabase/20_accesos_inicio.sql.</p>';
  }
}
async function accionAcceso(e) {
  const f = e.target.closest("[data-acc]");
  if (!f) return;
  const id = Number(f.dataset.acc) || null;
  if (e.target.closest("[data-acc-quitar-img]")) {
    imagenesPendientes.delete(f); f.querySelector('[data-c="imagen_url"]').value = ""; f.querySelector('[data-c="archivo"]').value = "";
    e.target.closest("[data-acc-quitar-img]").classList.add("hidden"); miniAcceso(f); return;
  }
  if (e.target.closest("[data-acc-borrar]")) {
    if (!confirm("¿Borrar este cuadro? (Si solo quieres esconderlo, quita «Visible»)")) return;
    try { await borrarAccesoDB(id); mostrarToast("🗑️ Cuadro borrado"); await pintarAccesosAdmin(); } catch (err) { mostrarToast(mensajeError(err), "error"); }
    return;
  }
  const b = e.target.closest("[data-acc-guardar]");
  if (!b) return;
  const v = k => f.querySelector(`[data-c="${k}"]`);
  const titulo = v("titulo").value.trim();
  const destino = leerDestino(f.querySelector("[data-dest]"));
  if (titulo.length < 2) { mostrarToast("Escribe un título corto", "error"); return; }
  if (!destinoAccesoValido(destino)) { mostrarToast("Elige a dónde lleva el cuadro", "error"); return; }
  b.disabled = true;
  try {
    const fila = { id, titulo, icono: v("icono").value.trim() || "⭐", color: v("color").value, destino,
      orden: parseInt(v("orden").value, 10) || 100, activo: v("activo").checked };
    // imagen_url solo se envía si hay o hubo imagen (así funciona aunque aún no exista la columna del SQL 21)
    const pendiente = imagenesPendientes.get(f);
    const teniaImagen = accesosAdmin.some(a => a.id === id && a.imagen_url);
    if (pendiente) fila.imagen_url = await subirFotoComercio(pendiente);
    else if (v("imagen_url").value || teniaImagen) fila.imagen_url = v("imagen_url").value || null;
    await guardarAccesoDB(fila);
    imagenesPendientes.delete(f);
    mostrarToast("✅ Cuadro guardado: ya se ve en el inicio");
    await pintarAccesosAdmin();
  } catch (err) {
    mostrarToast(/imagen_url/.test(err.message || "") ? "Para usar imágenes, ejecuta supabase/21_editor_inicio.sql" : mensajeError(err), "error");
    b.disabled = false;
  }
}

// ---------- 3) Entrenar el buscador ----------
function pintarCatsEntrenar() {
  const fila = (tipo, c) => `<label class="flex items-center gap-2 text-sm px-1.5 py-1 rounded hover:bg-indigo-50" data-nombre="${esc(normalizar(c.nombre))}"><input type="checkbox" value="${tipo}:${esc(c.id)}"> ${esc(c.icono)} ${esc(c.nombre)}</label>`;
  $("en-cats-c").innerHTML = TIPOS_COMERCIO.filter(t => t.activo !== false).map(t => fila("c", t)).join("");
  $("en-cats-a").innerHTML = CATEGORIAS.filter(c => c.id !== "todos" && c.activo !== false).map(c => fila("a", c)).join("");
}
function filtrarCatsEntrenar() {
  const q = normalizar($("en-filtro").value.trim());
  document.querySelectorAll("#en-cats-c label, #en-cats-a label").forEach(l => l.classList.toggle("hidden", !!q && !l.dataset.nombre.includes(q)));
}
async function ensenarBuscador() {
  const palabras = $("en-palabras").value.split(",").map(x => x.trim()).filter(x => x.length >= 2);
  const marcadas = [...document.querySelectorAll("#en-cats-c input:checked, #en-cats-a input:checked")].map(i => i.value);
  if (!palabras.length) { mostrarToast("Escribe al menos una palabra", "error"); return; }
  if (!marcadas.length) { mostrarToast("Marca al menos una categoría", "error"); return; }
  const b = $("en-ensenar"); b.disabled = true;
  let total = 0;
  try {
    for (const m of marcadas) { const [tipo, id] = m.split(":"); total += await agregarPalabrasCategoria(tipo, id, palabras); }
    mostrarToast(total ? `🧠 Aprendido: ${palabras.join(", ")} → ${marcadas.length} ${marcadas.length === 1 ? "categoría" : "categorías"}` : "Esas palabras ya estaban enseñadas");
    $("en-probar").value = palabras[0]; probarBuscador();
    $("en-palabras").value = "";
    document.querySelectorAll("#en-cats-c input:checked, #en-cats-a input:checked").forEach(i => { i.checked = false; });
  } catch (err) {
    mostrarToast(/categorias_(anuncio|comercio)|does not exist/i.test(err.message || "") ? "Primero ejecuta el SQL de categorías (15 y 19)" : mensajeError(err), "error");
  } finally { b.disabled = false; }
}
function probarBuscador() {
  const q = $("en-probar").value.trim();
  if (q.length < 2) { $("en-resultado").innerHTML = ""; return; }
  const r = analizarBusqueda(q);
  const chip = (c, t) => `<span class="inline-flex items-center gap-1 bg-${t === "c" ? "indigo" : "amber"}-50 border border-${t === "c" ? "indigo" : "amber"}-200 rounded-full px-2.5 py-0.5 text-xs font-semibold mr-1 mb-1">${esc(c.icono)} ${esc(c.nombre)}</span>`;
  const cs = r.catsComercio.map(c => chip(c, "c")).join(""), as = r.catsAnuncio.map(c => chip(c, "a")).join("");
  $("en-resultado").innerHTML = (cs || as)
    ? `${cs ? `<p class="mb-1"><b>🏪 Comercios:</b> ${cs}</p>` : ""}${as ? `<p><b>📢 Anuncios:</b> ${as}</p>` : ""}`
    : `<p class="text-slate-400">Todavía no entiende «${esc(q)}». Enséñale arriba a qué categorías corresponde.</p>`;
}

// ---------- Arranque ----------
document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("ei-cargando").classList.add("hidden");
  if (!esModerador()) { $("ei-sin-permiso").classList.remove("hidden"); return; }
  $("ei-panel").classList.remove("hidden");
  await Promise.all([cargarComercios(), cargarCategoriasAnuncio()]);
  $("dl-comercios").innerHTML = comercios.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(c => `<option value="${esc(etiquetaComercio(c))}"></option>`).join("");

  // Carrusel
  pintarBannersAdmin();
  $("ban-lista").addEventListener("click", accionBanner);
  $("ban-lista").addEventListener("input", e => { const f = e.target.closest("[data-ban]"); if (f && !e.target.matches('[data-c="archivo"]')) vistaBanner(f); });
  $("ban-lista").addEventListener("change", async e => {
    const f = e.target.closest("[data-ban]");
    if (!f) return;
    if (e.target.matches('[data-c="archivo"]')) await elegirImagen(e, 1600);
    vistaBanner(f);
  });
  $("ban-nuevo").addEventListener("click", () => {
    const vacio = $("ban-lista").querySelector("p");
    if (vacio) vacio.remove();
    $("ban-lista").insertAdjacentHTML("beforeend", filaBanner({ titulo: "", boton: "", destino: "#publicar", paleta: "indigo", icono1: "⭐", icono2: "", orden: 500, activo: true }));
    const f = $("ban-lista").lastElementChild; vistaBanner(f); f.querySelector('[data-c="titulo"]').focus();
  });

  // Cuadros
  pintarAccesosAdmin();
  $("acc-lista").addEventListener("click", accionAcceso);
  $("acc-lista").addEventListener("input", e => { const f = e.target.closest("[data-acc]"); if (f && !e.target.matches('[data-c="archivo"]')) miniAcceso(f); });
  $("acc-lista").addEventListener("change", async e => {
    const f = e.target.closest("[data-acc]");
    if (!f) return;
    if (e.target.matches('[data-c="archivo"]')) await elegirImagen(e, 400, 300);
    miniAcceso(f);
  });
  $("acc-nuevo").addEventListener("click", () => {
    $("acc-lista").insertAdjacentHTML("beforeend", filaAcceso({ titulo: "", icono: "⭐", color: "morado", destino: "", orden: 500, activo: true }));
    const f = $("acc-lista").lastElementChild; miniAcceso(f); f.querySelector('[data-c="titulo"]').focus();
  });

  // Entrenar
  pintarCatsEntrenar();
  $("en-filtro").addEventListener("input", filtrarCatsEntrenar);
  $("en-ensenar").addEventListener("click", ensenarBuscador);
  $("en-probar").addEventListener("input", debounce(probarBuscador, 200));
});
