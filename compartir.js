// ===== Merkap · «📣 Comparte tu tienda / tu anuncio» (fase 2AP-3) =====
// Para los dueños: texto listo, imagen con el logo de Merkap + QR, y sticker para la puerta.
// La imagen NO es un link: en WhatsApp/Facebook se manda junto al texto (el link del texto sí se toca).
// Requiere utils.js, data.js (registrarEvento), qr.js y piezas.js.
// Uso: abrirCompartir({ tipo: "tienda" | "anuncio", id, nombre, foto, precio, icono, ciudad })

const CANALES_COMPARTIR = [
  ["whatsapp", "🟢 WhatsApp"], ["estado", "⭕ Estado"], ["facebook", "📘 Facebook"], ["instagram", "📸 Instagram"], ["qr", "🖨️ Sticker para tu puerta"]
];
const TEXTOS_COMPARTIR = {
  tienda: [
    "🛍️ ¡Ya estamos en *Merkap*! Mira nuestros productos, horario y escríbenos por WhatsApp 👉 {link}",
    "📍 *{nombre}* ahora está en Merkap\n\n📦 Nuestros productos y precios\n🕒 Horario\n💬 Pedidos por WhatsApp\n🗺️ Cómo llegar\n\nEntra aquí 👇\n{link}",
    "¿Ya viste nuestra vitrina? 👀 Pídenos fácil por WhatsApp desde Merkap 👉 {link}"
  ],
  promo: [
    "🔥 *{nombre}* en {tienda}{precio}. {plazo}. Míralo aquí 👉 {link}",
    "🔥 *PROMO en {tienda}*\n\n🛍️ {nombre}{precio}\n⏳ {plazo}\n💬 Pídela por WhatsApp\n\n👇\n{link}",
    "¿Ya viste la promo de {tienda}? 👀 *{nombre}*{precio} · {plazo} → {link}"
  ],
  anuncio: [
    "📢 Vendo *{nombre}*{precio}. Mira fotos y detalles aquí 👉 {link}",
    "🔥 *{nombre}*{precio}\n\n📸 Fotos y detalles en Merkap\n💬 Escríbeme por WhatsApp desde el anuncio\n\n👇\n{link}",
    "¿A alguien le interesa? 👀 *{nombre}*{precio} → {link}"
  ]
};
const VERSIONES_COMPARTIR = ["✂️ Corto", "✅ Con detalles", "❓ Pregunta"];
const NOTA_COMPARTIR = {
  whatsapp: "💡 Manda la imagen <b>y</b> el texto: la imagen no se puede tocar, el link del texto sí.",
  estado: "💡 Sube la imagen vertical a tu estado y pega el texto como descripción.",
  facebook: "💡 Publica la imagen con el texto en tu perfil o en grupos (respeta las reglas del grupo).",
  instagram: "💡 Instagram no deja links en publicaciones: pon el link en tu perfil (bio) o en una historia con sticker de enlace.",
  qr: "🖨️ Imprímelo (10×10 cm o más) y pégalo en tu puerta o caja: tus clientes lo escanean con la cámara."
};

const cmp = { datos: null, canal: "whatsapp", version: 0, plantilla: "morado", foto: null, conFoto: true, conQr: true, editado: false };

function crearModalCompartir() {
  if ($("modal-compartir")) return;
  document.body.insertAdjacentHTML("beforeend", `
  <div id="modal-compartir" class="modal-fondo hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="cmp-titulo">
    <div class="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative modal-enter my-4">
      <button type="button" data-cerrar aria-label="Cerrar" class="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-700">&times;</button>
      <h3 id="cmp-titulo" class="text-xl font-black text-indigo-900 pr-8"></h3>
      <p id="cmp-intro" class="text-sm text-slate-600 mb-3"></p>
      <div id="cmp-canales" class="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Dónde lo vas a compartir"></div>
      <div class="grid md:grid-cols-2 gap-4 items-start">
        <div>
          <div id="cmp-versiones" class="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Versión del texto"></div>
          <textarea id="cmp-texto" rows="7" class="mk-campo text-sm leading-relaxed" aria-label="Texto para compartir"></textarea>
          <p id="cmp-nota" class="text-xs text-slate-600 mt-1.5"></p>
          <div class="flex flex-wrap gap-2 mt-3">
            <button id="cmp-compartir" type="button" class="hidden mk-btn bg-green-600 hover:bg-green-700 text-white">📤 Compartir imagen + texto</button>
            <a id="cmp-wa" target="_blank" rel="noopener" class="mk-btn bg-green-600 hover:bg-green-700 text-white">🟢 Enviar texto por WhatsApp</a>
            <button id="cmp-copiar" type="button" class="mk-btn bg-indigo-600 hover:bg-indigo-700 text-white">📋 Copiar texto + link</button>
            <button id="cmp-link" type="button" class="mk-btn bg-slate-100 hover:bg-slate-200 text-slate-700">🔗 Copiar solo el link</button>
          </div>
        </div>
        <div>
          <div class="mk-lienzo-caja"><canvas id="cmp-lienzo" width="1080" height="1080" aria-label="Vista previa de la imagen"></canvas></div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-sm">
            <span class="text-xs font-bold text-slate-500">Color:</span>
            <div id="cmp-plantillas" class="flex gap-1.5" role="group" aria-label="Color"></div>
            <label id="cmp-foto-caja" class="mk-check hidden"><input type="checkbox" id="cmp-con-foto" checked> Mi foto de fondo</label>
            <label class="mk-check"><input type="checkbox" id="cmp-con-qr" checked> QR</label>
          </div>
          <button id="cmp-bajar" type="button" class="mk-btn bg-indigo-600 hover:bg-indigo-700 text-white w-full mt-2">⬇️ Descargar imagen</button>
        </div>
      </div>
    </div>
  </div>`);
  $("cmp-canales").addEventListener("click", e => {
    const b = e.target.closest("[data-canal]"); if (!b) return;
    cmp.canal = b.dataset.canal; cmp.editado = false; pintarCompartir();
  });
  $("cmp-versiones").addEventListener("click", e => {
    const b = e.target.closest("[data-version]"); if (!b) return;
    cmp.version = Number(b.dataset.version); cmp.editado = false; pintarCompartir();
  });
  $("cmp-plantillas").addEventListener("click", e => {
    const b = e.target.closest("[data-plantilla]"); if (!b) return;
    cmp.plantilla = b.dataset.plantilla; pintarCompartir();
  });
  $("cmp-texto").addEventListener("input", () => { cmp.editado = true; $("cmp-wa").href = "https://wa.me/?text=" + encodeURIComponent($("cmp-texto").value); });
  $("cmp-con-foto").addEventListener("change", e => { cmp.conFoto = e.target.checked; dibujarCompartir(); });
  $("cmp-con-qr").addEventListener("change", e => { cmp.conQr = e.target.checked; dibujarCompartir(); });
  $("cmp-copiar").addEventListener("click", () => copiarCompartir($("cmp-texto").value, "📋 Texto copiado: pégalo junto a la imagen"));
  $("cmp-link").addEventListener("click", () => copiarCompartir(enlaceCompartir(), "🔗 Link copiado"));
  $("cmp-wa").addEventListener("click", () => anotarCompartido());
  $("cmp-bajar").addEventListener("click", async () => {
    const b = await imagenCompartir(); if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = archivoCompartir();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    anotarCompartido();
  });
  try {
    const prueba = new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [prueba] })) $("cmp-compartir").classList.remove("hidden");
  } catch (e) { /* sin compartir nativo */ }
  $("cmp-compartir").addEventListener("click", async () => {
    const b = await imagenCompartir(); if (!b) return;
    try {
      await navigator.share({ files: [new File([b], archivoCompartir(), { type: "image/png" })], text: $("cmp-texto").value });
      anotarCompartido();
    } catch (e) { if (e && e.name !== "AbortError") mostrarToast("No se pudo compartir: descarga la imagen", "error"); }
  });
}

function baseCompartir() { return location.origin + location.pathname.replace(/[^/]*$/, ""); }
// Enlace directo con código del comercio o del anuncio (así se ve en Métricas quién trae gente)
function enlaceCompartir() {
  const d = cmp.datos; if (!d) return "";
  const tienda = d.tipo === "tienda" || d.tipo === "promo";
  return baseCompartir() + (tienda ? "tienda.html" : "anuncio.html") + "?id=" + d.id + "&ref=" + (tienda ? "tienda-" : "anuncio-") + d.id + "&o=" + cmp.canal + (d.tipo === "promo" ? "#promos" : "");
}
function archivoCompartir() { return "merkap-" + slugRef(cmp.datos.nombre || cmp.datos.tipo).slice(0, 24) + "-" + (cmp.canal === "qr" ? "sticker" : cmp.canal) + ".png"; }
function anotarCompartido() {
  try { if (typeof registrarEvento === "function") registrarEvento("compartir", cmp.datos.tipo === "anuncio" ? "anuncio" : "comercio", cmp.datos.id); } catch (e) { /* nada */ }
}
async function copiarCompartir(texto, ok) {
  try { await navigator.clipboard.writeText(texto); mostrarToast(ok); anotarCompartido(); }
  catch (e) { mostrarToast("No se pudo copiar: selecciónalo y cópialo a mano", "error"); }
}

function textoCompartir() {
  const d = cmp.datos;
  let t = TEXTOS_COMPARTIR[d.tipo][cmp.version];
  const canal = cmp.canal;
  if (canal !== "whatsapp" && canal !== "estado") t = t.replace(/\*([^*\n]+)\*/g, "$1");
  if (canal === "instagram") t = t.replace(/\{link\}/g, "🔗 link en mi perfil") + "\n\n#Merkap #ComprasLocales" + (d.ciudad ? " #" + slugRef(d.ciudad).replace(/-/g, "") : "");
  if (canal === "facebook") t += "\n\n#Merkap #ComprasLocales";
  return t.replace(/\{nombre\}/g, d.nombre || "").replace(/\{tienda\}/g, d.tienda || "").replace(/\{plazo\}/g, d.plazo || "")
    .replace(/\{precio\}/g, d.precio ? " — " + d.precio : "")
    .replace(/\{link\}/g, enlaceCompartir());
}

function opcionesPieza() {
  const d = cmp.datos, p = PLANTILLAS[cmp.plantilla] || PLANTILLAS.morado;
  const sticker = cmp.canal === "qr";
  const formato = sticker ? "sticker" : cmp.canal === "estado" ? "historia" : "cuadrado";
  return {
    formato, url: enlaceCompartir(), verQr: sticker || cmp.conQr, fondo: p.fondo, cta: p.cta,
    foto: !sticker && cmp.conFoto ? cmp.foto : null, verLogo: true, verLink: !sticker, verCta: true,
    ctaTexto: sticker ? (d.tipo === "tienda" ? "📷 Escanea y mira nuestros productos" : "📷 Escanea y mira el anuncio") : ctaPorCanal(cmp.canal),
    icono: sticker ? "" : d.icono || (d.tipo === "tienda" ? "🛍️" : "📢"),
    titulo: sticker ? "Encuéntranos en Merkap" : d.nombre,
    sub: sticker ? d.nombre : d.tipo === "promo" ? [d.tienda, d.plazo].filter(Boolean).join(" · ") + (d.precio ? "\n" + d.precio.replace(/^ — /, "") : "")
      : d.tipo === "tienda" ? "Mira nuestros productos, horario y pídenos por WhatsApp."
      : [d.precio, d.ciudad].filter(Boolean).join(" · ") || "Mira fotos y detalles en Merkap."
  };
}
let _dibujoCmp = 0;
function dibujarCompartir() { cancelAnimationFrame(_dibujoCmp); _dibujoCmp = requestAnimationFrame(() => dibujarPieza($("cmp-lienzo"), opcionesPieza())); }

// La imagen final. Si la foto de la tienda viene de otro servidor sin permiso (CORS), se hace sin foto.
async function imagenCompartir() {
  const cv = $("cmp-lienzo");
  await dibujarPieza(cv, opcionesPieza());
  const aBlob = () => new Promise((res, rej) => { try { cv.toBlob(b => res(b), "image/png"); } catch (e) { rej(e); } });
  try { return await aBlob(); }
  catch (e) {
    cmp.foto = null; $("cmp-foto-caja").classList.add("hidden");
    await dibujarPieza(cv, opcionesPieza());
    mostrarToast("Tu foto no se pudo usar de fondo; la imagen va sin foto", "error");
    try { return await aBlob(); } catch (e2) { mostrarToast("No se pudo crear la imagen", "error"); return null; }
  }
}

function pintarCompartir() {
  const d = cmp.datos;
  $("cmp-titulo").textContent = d.tipo === "tienda" ? "📣 Comparte tu tienda" : d.tipo === "promo" ? "📣 Comparte tu promoción" : "📣 Comparte tu anuncio";
  $("cmp-intro").textContent = d.intro ? d.intro : d.tipo === "promo" ? "Una promo compartida en tus estados y grupos trae clientes esta misma semana. La imagen lleva tu oferta, el logo de Merkap y tu QR."
    : d.tipo === "tienda"
    ? "Mientras más la compartas, más clientes te encuentran. La imagen lleva tu nombre, el logo de Merkap y tu QR."
    : "Compártelo en tus grupos y estados para vender más rápido. La imagen lleva tu foto, el logo de Merkap y el QR del anuncio.";
  const canales = CANALES_COMPARTIR.filter(c => d.tipo === "tienda" || c[0] !== "qr");
  $("cmp-canales").innerHTML = canales.map(([k, t]) => `<button type="button" class="mk-version" data-canal="${k}" aria-pressed="${k === cmp.canal}">${t}</button>`).join("");
  $("cmp-versiones").innerHTML = VERSIONES_COMPARTIR.map((t, i) => `<button type="button" class="mk-version" data-version="${i}" aria-pressed="${i === cmp.version}">${t}</button>`).join("");
  $("cmp-plantillas").innerHTML = Object.entries(PLANTILLAS).map(([k, p]) =>
    `<button type="button" data-plantilla="${k}" aria-pressed="${k === cmp.plantilla}" title="${k}" class="cmp-color" style="background:${p.fondo};border-color:${k === cmp.plantilla ? "#4c1d95" : "#cbd5e1"}"><span style="background:${p.cta}"></span></button>`).join("");
  if (!cmp.editado) $("cmp-texto").value = textoCompartir();
  $("cmp-nota").innerHTML = NOTA_COMPARTIR[cmp.canal] || "";
  $("cmp-wa").href = "https://wa.me/?text=" + encodeURIComponent($("cmp-texto").value);
  $("cmp-foto-caja").classList.toggle("hidden", !cmp.foto || cmp.canal === "qr");
  dibujarCompartir();
}

function abrirCompartir(datos) {
  crearModalCompartir();
  cmp.datos = Object.assign({}, datos);
  cmp.canal = "whatsapp"; cmp.version = 0; cmp.editado = false; cmp.foto = null; cmp.conFoto = true; cmp.conQr = true;
  $("cmp-con-foto").checked = true; $("cmp-con-qr").checked = true;
  alCargarLogo(dibujarCompartir);
  if (datos.foto && /^https:\/\//.test(datos.foto)) {
    const img = new Image();
    img.crossOrigin = "anonymous";   // sin esto el navegador no deja descargar la imagen con la foto
    img.onload = () => { if (cmp.datos && cmp.datos.id === datos.id) { cmp.foto = img; pintarCompartir(); } };
    img.src = datos.foto;
  }
  pintarCompartir();
  abrirModal("modal-compartir");
}

// Datos de un anuncio para la pieza (lo usan anuncio.js y «📋 Mis anuncios» del inicio)
function datosCompartirAnuncio(a) {
  const cat = (typeof CATEGORIAS !== "undefined" && CATEGORIAS.find(c => c.id === a.categoria)) || {};
  let precio = a.precio ? (typeof precioConSufijo === "function" ? precioConSufijo(a) : "$" + Number(a.precio).toLocaleString("es-CO")) : "";
  const rb = typeof rebajaDe === "function" ? rebajaDe(a) : null;   // fase 2AP-4a: «📉 −20 % (antes $X)»
  if (rb) precio += ` 📉 −${rb.pct} % (antes ${formatearPrecio(rb.antes)})`;
  const adultos = a.categoria === "adultos";   // +18: nunca con foto en redes
  return { tipo: "anuncio", id: a.id, nombre: a.nombre, foto: adultos ? "" : a.imagen || (a.fotos || [])[0] || "", precio, icono: a.categoria === "adultos" ? "📢" : cat.icono || "📢", ciudad: a.ciudad || "" };
}
