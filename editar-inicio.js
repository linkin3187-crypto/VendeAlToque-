// ===== Merkap · Editar inicio y buscador (Fase 2Z.2) =====
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

// Al elegir una categoría o un comercio como destino, el cuadro toma su ícono (se puede cambiar después)
function iconoDelDestino(d) {
  const a = analizarDestino(d);
  if (a.tipo === "ccat") { const t = TIPOS_COMERCIO.find(x => x.id === a.valor); return t && t.icono; }
  if (a.tipo === "acat") { const c = CATEGORIAS.find(x => x.id === a.valor); return c && c.icono; }
  if (a.tipo === "comercio") { const c = comercios.find(x => String(x.id) === String(a.valor)); return c && iconosComercio[c.tipo]; }
  return ({ publicar: "📢", recomendar: "🤝", registrar: "🏪", directorio: "🗺️", anuncios: "📢", busqueda: "🔍", contenido: "⬇️" })[a.tipo] || null;
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
      <div class="grid grid-cols-2 gap-2">
        <div class="text-[11px] font-bold text-slate-500">Ícono grande<div class="mt-0.5 flex items-center"><input data-c="icono1" data-emoji maxlength="8" aria-label="Ícono grande" value="${esc(b.icono1 || "⭐")}" class="w-14 border border-slate-300 p-1.5 rounded-lg text-center text-lg">${BOTON_EMOJI}</div></div>
        <div class="text-[11px] font-bold text-slate-500">Ícono pequeño<div class="mt-0.5 flex items-center"><input data-c="icono2" data-emoji maxlength="8" aria-label="Ícono pequeño" value="${esc(b.icono2 || "")}" class="w-14 border border-slate-300 p-1.5 rounded-lg text-center text-lg">${BOTON_EMOJI}</div></div>
      </div>
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
        <div class="text-[11px] font-bold text-slate-500">Ícono<div class="mt-0.5 flex items-center"><input data-c="icono" data-emoji maxlength="8" aria-label="Ícono" value="${esc(x.icono || "⭐")}" class="w-16 border border-slate-300 p-1.5 rounded-lg text-center text-lg">${BOTON_EMOJI}</div></div>
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
    return `<span class="acceso acceso-arrastrable" data-orden-id="${x.id}" title="Arrastra para cambiar el orden"><span class="acceso-cuadro acc-${COLORES_ACCESO.includes(x.color) ? x.color : "morado"} ${img ? "con-imagen" : ""}">${img ? `<img src="${esc(img)}" alt="" draggable="false">` : `<span class="acceso-ico">${esc(x.icono)}</span>`}</span><span class="acceso-txt">${esc(x.titulo)}</span>
      <span class="acceso-mover"><button type="button" data-mover="-1" aria-label="Mover ${esc(x.titulo)} a la izquierda">◀</button><button type="button" data-mover="1" aria-label="Mover ${esc(x.titulo)} a la derecha">▶</button></span></span>`;
  }).join("");
  activarArrastre();
}

// ---------- Ordenar los cuadros arrastrando (fase 2Z.3) ----------
// En computador: clic y arrastrar. En celular: mantener presionado un momento y arrastrar. También ◀ ▶.
let arrastreActivo = null;
function activarArrastre() {
  if (arrastreActivo) { arrastreActivo.destroy(); arrastreActivo = null; }
  if (typeof Sortable === "undefined") return;          // sin la librería quedan los botones ◀ ▶
  arrastreActivo = Sortable.create($("acc-vista"), {
    animation: 180, delay: 220, delayOnTouchOnly: true, ghostClass: "acceso-fantasma", chosenClass: "acceso-elegido",
    filter: "button", preventOnFilter: false,
    onEnd: () => guardarOrdenAccesos([...$("acc-vista").querySelectorAll("[data-orden-id]")].map(el => Number(el.dataset.ordenId)))
  });
}
// Guarda el nuevo orden: los visibles en el orden de la vista previa y luego los ocultos (orden 10, 20, 30…)
async function guardarOrdenAccesos(idsVisibles) {
  const ocultos = accesosAdmin.filter(a => !idsVisibles.includes(a.id)).map(a => a.id);
  const ids = idsVisibles.concat(ocultos);
  const cambios = ids.map((id, i) => ({ id, orden: (i + 1) * 10 })).filter(c => (accesosAdmin.find(a => a.id === c.id) || {}).orden !== c.orden);
  if (!cambios.length) return;
  try {
    for (const c of cambios) {
      const { error } = await sb.from("accesos_inicio").update({ orden: c.orden }).eq("id", c.id);
      if (error) throw error;
    }
    // Sin recargar la lista (no se pierde lo que estés editando): se actualiza el número de orden y se reacomodan las filas
    cambios.forEach(c => { const x = accesosAdmin.find(a => a.id === c.id); if (x) x.orden = c.orden; });
    accesosAdmin.sort((a, b) => a.orden - b.orden);
    ids.forEach(id => {
      const fila = $("acc-lista").querySelector(`[data-acc="${id}"]`);
      if (!fila) return;
      fila.querySelector('[data-c="orden"]').value = accesosAdmin.find(a => a.id === id).orden;
      $("acc-lista").insertBefore(fila, $("acc-lista").querySelector('[data-acc=""]'));
    });
    mostrarToast("✅ Orden guardado: así se ven en el inicio");
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
  vistaAccesos();
}
function moverAcceso(e) {
  const b = e.target.closest("[data-mover]");
  if (!b) return;
  const el = b.closest("[data-orden-id]");
  const ids = [...$("acc-vista").querySelectorAll("[data-orden-id]")].map(x => Number(x.dataset.ordenId));
  const i = ids.indexOf(Number(el.dataset.ordenId)), j = i + Number(b.dataset.mover);
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  guardarOrdenAccesos(ids);
}

// El selector de íconos («Elegir 😀») vive en iconos.js (compartido con Moderación y Comercios)
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
// ---------- 🎨 Logo de la página (fase 2AF) ----------
let logosAdmin = [], logoNuevo = null;
const fechaCorta2 = f => f ? new Date(f + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
function estadoLogo(l, vig) {
  if (vig && l.id === vig.id) return '<span class="sel-chip ahora">✅ En uso ahora</span>';
  if (l.activo === false) return '<span class="sel-chip">⏸ Apagado</span>';
  if (l.usar_ahora) return '<span class="sel-chip ahora">Usar ahora</span>';
  if (l.oficial) return '<span class="sel-chip">⭐ Oficial (cuando no hay otro)</span>';
  if (l.desde || l.hasta) return `<span class="sel-chip fijo">📅 ${fechaCorta2(l.desde) || "…"} → ${fechaCorta2(l.hasta) || "…"}</span>`;
  return '<span class="sel-chip">Sin fechas (usa «Usar ahora» o pon fechas)</span>';
}
async function pintarLogosAdmin() {
  try { logosAdmin = await cargarLogosPagina(); }
  catch (e) { $("logo-lista").innerHTML = '<p class="text-sm text-slate-400 text-center py-3">Se activa al ejecutar supabase/35_logos_pagina.sql. Mientras tanto se ve el logo oficial.</p>'; return; }
  const vig = logoVigente(logosAdmin);
  $("logo-vista-img").src = vig.imagen_url;
  $("logo-vista-img").classList.toggle("recortar", !!vig.recortar);
  $("logo-vista-txt").textContent = `Así se ve hoy: «${vig.nombre}»`;
  $("logo-lista").innerHTML = logosAdmin.map(l => `<div class="logo-fila" data-logo="${l.id}">
      <img src="${esc(urlSegura(l.imagen_url) || l.imagen_url)}" alt="" class="logo-mini ${l.recortar ? "recortar" : ""}">
      <div class="min-w-0 flex-1">
        <p class="font-bold text-sm">${esc(l.nombre)} ${estadoLogo(l, vig)}</p>
        <div class="flex flex-wrap items-center gap-2 mt-1 text-xs">
          ${l.oficial ? "" : `<label>Desde <input type="date" data-l="desde" value="${esc(l.desde || "")}" class="border border-slate-300 rounded px-1 py-0.5"></label>
          <label>Hasta <input type="date" data-l="hasta" value="${esc(l.hasta || "")}" class="border border-slate-300 rounded px-1 py-0.5"></label>`}
          <label class="flex items-center gap-1"><input type="checkbox" data-l="recortar" ${l.recortar ? "checked" : ""}> Recortar</label>
          <label class="flex items-center gap-1"><input type="checkbox" data-l="animar" ${l.animar !== false ? "checked" : ""}> Movimiento</label>
          ${l.oficial ? "" : `<label class="flex items-center gap-1"><input type="checkbox" data-l="activo" ${l.activo !== false ? "checked" : ""}> Encendido</label>`}
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5 justify-end w-full sm:w-auto">
        ${l.usar_ahora ? '<button type="button" data-lacc="no-ahora" class="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white">Dejar de usar</button>'
                       : (l.oficial ? "" : '<button type="button" data-lacc="ahora" class="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900">Usar ahora</button>')}
        <label class="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer">🖼️ Cambiar imagen<input type="file" accept="image/png,image/webp,image/jpeg" data-lacc-archivo class="sr-only"></label>
        <button type="button" data-lacc="guardar" class="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">💾 Guardar</button>
        ${l.oficial ? "" : '<button type="button" data-lacc="borrar" class="text-xs text-red-600 hover:underline px-1">Borrar</button>'}
      </div>
    </div>`).join("");
}
async function subirImagenLogo(archivo) {
  const r = await prepararImagenLogo(archivo);
  const [url] = await subirFotos([r.dataUrl]);
  return { url, sinFondo: r.sinFondo, cuadrada: Math.abs(r.ancho - r.alto) / Math.max(r.ancho, r.alto) < 0.1, chica: Math.max(r.ancho, r.alto) < 256 };
}
async function accionLogo(e) {
  const fila = e.target.closest("[data-logo]");
  if (!fila) return;
  const l = logosAdmin.find(x => x.id === Number(fila.dataset.logo));
  const b = e.target.closest("[data-lacc]");
  if (!l || !b) return;
  const v = k => fila.querySelector(`[data-l="${k}"]`);
  b.disabled = true;
  try {
    if (b.dataset.lacc === "borrar") { if (!confirm(`¿Borrar el logo «${l.nombre}»?`)) { b.disabled = false; return; } await borrarLogoPagina(l.id); mostrarToast("🗑️ Logo borrado"); }
    else if (b.dataset.lacc === "ahora" || b.dataset.lacc === "no-ahora") { await guardarLogoPagina({ id: l.id, usar_ahora: b.dataset.lacc === "ahora", activo: true }); mostrarToast(b.dataset.lacc === "ahora" ? "✅ Este logo se ve ahora en toda la página" : "Listo: vuelve el logo según las fechas o el oficial"); }
    else {
      const cambios = { id: l.id, recortar: v("recortar").checked, animar: v("animar").checked };
      if (!l.oficial) { cambios.desde = v("desde").value || null; cambios.hasta = v("hasta").value || null; cambios.activo = v("activo").checked; }
      if (cambios.desde && cambios.hasta && cambios.hasta < cambios.desde) throw new Error("La fecha «hasta» debe ser después de «desde»");
      await guardarLogoPagina(cambios); mostrarToast("💾 Guardado");
    }
    await pintarLogosAdmin(); await actualizarLogoPagina();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}
async function cambiarImagenLogo(e) {
  const inp = e.target.closest("[data-lacc-archivo]"); if (!inp || !inp.files[0]) return;
  const l = logosAdmin.find(x => x.id === Number(e.target.closest("[data-logo]").dataset.logo));
  try {
    mostrarToast("Subiendo imagen…");
    const r = await subirImagenLogo(inp.files[0]);
    // Si le quitamos el fondo blanco, no tiene sentido recortarla en cuadro (cortaría adornos de los bordes)
    await guardarLogoPagina(r.sinFondo ? { id: l.id, imagen_url: r.url, recortar: false } : { id: l.id, imagen_url: r.url });
    mostrarToast(r.sinFondo ? "🖼️ Imagen cambiada (le quitamos el fondo blanco)" : "🖼️ Imagen cambiada");
    await pintarLogosAdmin(); await actualizarLogoPagina();
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
}
async function agregarLogo() {
  const nombre = $("logo-nombre").value.trim(), archivo = $("logo-archivo").files[0];
  if (nombre.length < 2) { mostrarToast("Escribe un nombre (ej. Navidad 2026)", "error"); return; }
  if (!archivo) { mostrarToast("Elige la imagen del logo", "error"); return; }
  const desde = $("logo-desde").value || null, hasta = $("logo-hasta").value || null;
  if (desde && hasta && hasta < desde) { mostrarToast("La fecha «hasta» debe ser después de «desde»", "error"); return; }
  const b = $("logo-agregar"); b.disabled = true; b.textContent = "Subiendo…";
  try {
    const r = await subirImagenLogo(archivo);
    await guardarLogoPagina({ nombre, imagen_url: r.url, desde, hasta, recortar: $("logo-recortar").checked && !r.sinFondo, animar: $("logo-animar").checked, usar_ahora: $("logo-ahora").checked });
    mostrarToast("✅ Logo agregado" + (r.sinFondo ? " (le quitamos el fondo blanco)" : ""));
    ["logo-nombre", "logo-archivo", "logo-desde", "logo-hasta"].forEach(id => { $(id).value = ""; });
    $("logo-ahora").checked = false; $("logo-previa").classList.add("hidden"); $("logo-aviso").textContent = "";
    await pintarLogosAdmin(); await actualizarLogoPagina();
  } catch (err) { mostrarToast(mensajeError(err), "error"); }
  finally { b.disabled = false; b.textContent = "➕ Agregar"; }
}
async function previaLogoNuevo() {
  const f = $("logo-archivo").files[0];
  if (!f) { $("logo-previa").classList.add("hidden"); $("logo-aviso").textContent = ""; return; }
  try {
    // Mostramos la imagen YA procesada: así ves cómo quedará (sin fondo blanco, centrada)
    const r = await prepararImagenLogo(f);
    const avisos = [];
    if (r.sinFondo) avisos.push("✓ Le quitamos el fondo blanco.");
    if (Math.max(r.ancho, r.alto) < 256) avisos.push("Es pequeña: puede verse borrosa (mejor 512 px o más).");
    $("logo-aviso").textContent = avisos.join(" ");
    $("logo-previa").src = r.dataUrl; $("logo-previa").classList.remove("hidden");
    $("logo-previa").classList.toggle("rounded-[24%]", $("logo-recortar").checked && !r.sinFondo);
  } catch (err) { $("logo-aviso").textContent = mensajeError(err); }
}

// ---------- ⭐ Selección del día (fase 2AD) ----------
function pintarSeleccionAdmin() {
  const ahora = Date.now();
  const sel = seleccionDelDia(baseDatosAnuncios, 8);
  const enSel = new Set(sel.map(a => a.id));
  const fin = new Date(ahora); fin.setHours(Math.floor(fin.getHours() / HORAS_TURNO_SELECCION) * HORAS_TURNO_SELECCION + HORAS_TURNO_SELECCION, 0, 0, 0);
  $("sel-turno").textContent = `· cambia a las ${fin.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
  $("sel-vista").innerHTML = sel.length ? sel.map((a, i) => `<span class="text-xs bg-white border border-amber-200 rounded-full px-2 py-0.5">${i + 1}. ${a.elegidoMod ? "⭐ " : ""}${esc(a.nombre)}</span>`).join("")
    : '<span class="text-xs text-slate-500">Aún no hay anuncios suficientes (se muestra desde 2).</span>';
  const texto = normalizar($("sel-buscar").value || ""), filtro = $("sel-filtro").value;
  const lista = baseDatosAnuncios.filter(a => {
    if (texto && !normalizar(a.nombre + " " + (a.ciudad || "")).includes(texto)) return false;
    if (filtro === "ahora") return enSel.has(a.id);
    if (filtro === "fijados") return a.seleccionHasta > ahora;
    if (filtro === "sacados") return a.seleccionExcluido;
    return true;
  }).sort((x, y) => (enSel.has(y.id) - enSel.has(x.id)) || (y.fecha - x.fecha));
  $("sel-n").textContent = `(${sel.length} en la franja · ${baseDatosAnuncios.length} anuncios activos)`;
  $("sel-admin-lista").innerHTML = lista.length ? lista.map(a => {
    const foto = urlSegura(a.imagen), fijado = a.seleccionHasta > ahora;
    const chips = [enSel.has(a.id) ? '<span class="sel-chip ahora">👀 En la franja ahora</span>' : "",
      fijado ? `<span class="sel-chip fijo">⭐ Fijado hasta ${esc(new Date(a.seleccionHasta).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }))}</span>` : "",
      a.seleccionExcluido ? '<span class="sel-chip fuera">🚫 Sacado</span>' : "",
      !a.imagen ? '<span class="sel-chip">Sin foto</span>' : ""].join("");
    return `<div class="flex flex-wrap items-center gap-2 border border-slate-200 rounded-xl p-2" data-sel-id="${a.id}">
      <span class="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">${foto ? `<img src="${esc(foto)}" alt="" class="w-full h-full object-cover">` : (iconosCategoria[a.categoria] || "📦")}</span>
      <span class="min-w-0 flex-1"><a href="anuncio.html?id=${a.id}" target="_blank" class="block font-semibold text-sm line-clamp-2 hover:underline">${esc(a.nombre)}</a>
        <span class="text-[11px] text-slate-500">${esc(a.ciudad || a.barrio || "")} · ${esc(haceCuanto(a.fecha))}</span> <span class="inline-flex flex-wrap gap-1 align-middle">${chips}</span></span>
      <span class="flex flex-wrap gap-1.5 w-full sm:w-auto justify-end">
        ${fijado ? '<button type="button" data-sel-acc="desfijar" class="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900">Quitar ⭐</button>'
                 : '<button type="button" data-sel-acc="fijar" class="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900">⭐ Fijar</button>'}
        ${a.seleccionExcluido ? '<button type="button" data-sel-acc="permitir" class="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-green-300 bg-white text-green-800">✅ Permitir</button>'
                              : '<button type="button" data-sel-acc="sacar" class="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-700">🚫 Sacar</button>'}
      </span>
    </div>`;
  }).join("") : '<p class="text-sm text-slate-400 text-center py-4">No hay anuncios con ese filtro.</p>';
}
async function accionSeleccionAdmin(e) {
  const b = e.target.closest("[data-sel-acc]"); const fila = e.target.closest("[data-sel-id]");
  if (!b || !fila) return;
  const id = Number(fila.dataset.selId), acc = b.dataset.selAcc;
  b.disabled = true;
  try {
    if (acc === "fijar") await marcarSeleccionDia(id, Number($("sel-duracion").value) || 24);
    else if (acc === "desfijar") await marcarSeleccionDia(id, 0);
    else await excluirDeSeleccion(id, acc === "sacar");
    mostrarToast({ fijar: "⭐ Fijado: sale primero en la franja", desfijar: "Quitado: vuelve al sorteo", sacar: "🚫 Sacado de la Selección del día", permitir: "✅ Puede volver a salir" }[acc]);
    pintarSeleccionAdmin();
  } catch (err) { b.disabled = false; mostrarToast(mensajeError(err), "error"); }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("ei-cargando").classList.add("hidden");
  if (!esModerador()) { $("ei-sin-permiso").classList.remove("hidden"); return; }
  $("ei-panel").classList.remove("hidden");
  await Promise.all([cargarComercios(), cargarCategoriasAnuncio(), cargarAnuncios()]);
  // Logo de la página (fase 2AF)
  pintarLogosAdmin();
  $("logo-lista").addEventListener("click", accionLogo);
  $("logo-lista").addEventListener("change", cambiarImagenLogo);
  $("logo-agregar").addEventListener("click", agregarLogo);
  $("logo-archivo").addEventListener("change", previaLogoNuevo);
  // Selección del día (fase 2AD)
  pintarSeleccionAdmin();
  $("sel-admin-lista").addEventListener("click", accionSeleccionAdmin);
  $("sel-buscar").addEventListener("input", pintarSeleccionAdmin);
  $("sel-filtro").addEventListener("change", pintarSeleccionAdmin);
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
    if (e.target.closest("[data-dest]") && !imagenesPendientes.get(f)) {
      // Solo si el ícono no lo eligió la persona (vacío, ⭐ o el que se puso solo antes)
      const campo = f.querySelector('[data-c="icono"]'), ic = iconoDelDestino(leerDestino(f.querySelector("[data-dest]")));
      if (ic && (!campo.value.trim() || campo.value === "⭐" || campo.value === f.dataset.icoAuto)) { campo.value = ic; f.dataset.icoAuto = ic; miniAcceso(f); }
    }
    if (e.target.matches('[data-c="archivo"]')) await elegirImagen(e, 400, 300);
    miniAcceso(f);
  });
  $("acc-nuevo").addEventListener("click", () => {
    $("acc-lista").insertAdjacentHTML("beforeend", filaAcceso({ titulo: "", icono: "⭐", color: "morado", destino: "", orden: 500, activo: true }));
    const f = $("acc-lista").lastElementChild; miniAcceso(f); f.querySelector('[data-c="titulo"]').focus();
  });

  // Orden con ◀ ▶
  $("acc-vista").addEventListener("click", moverAcceso);

  // Entrenar
  pintarCatsEntrenar();
  $("en-filtro").addEventListener("input", filtrarCatsEntrenar);
  $("en-ensenar").addEventListener("click", ensenarBuscador);
  $("en-probar").addEventListener("input", debounce(probarBuscador, 200));
});
