// ===== Merkap · Centro de marketing (fase 2AP · antes «Enlaces y QR») · solo administrador =====
// 1) Arma el enlace con código (?ref=) y canal (?o=) → 2) texto listo por destino y canal →
// 3) imagen (tarjeta) con logo, texto, QR y link, hecha en el navegador → 4) descargar o compartir.

// ---------- Destinos ----------
// pagina: archivo · hash: lo que abre al llegar (#registro abre «Crear cuenta», #publicar el formulario)
const DESTINOS = {
  inicio:     { pagina: "index.html", icono: "🛒", titulo: "Compra, vende y encuentra negocios cerca de ti", sub: "Anuncios de vecinos y comercios del barrio. Todo gratis.",
                escena: "un mercado de barrio colombiano lleno de vida, con tiendas coloridas y vecinos comprando" },
  registro:   { pagina: "index.html", hash: "#registro", icono: "📲", titulo: "Regístrate GRATIS en 1 minuto", sub: "Vende lo que ya no usas y te escriben directo a tu WhatsApp.",
                escena: "una persona joven sonriendo mientras usa su celular en una calle de un barrio colombiano" },
  publicar:   { pagina: "index.html", hash: "#publicar", icono: "📢", titulo: "Publica tu anuncio GRATIS", sub: "Sube fotos, aparece a la gente cerca y vende sin comisiones.",
                escena: "objetos de segunda mano en buen estado (bicicleta, celular, silla, ropa) bien iluminados sobre un fondo limpio" },
  recomendar: { pagina: "recomendar.html", icono: "🤝", titulo: "Recomienda un negocio de tu barrio", sub: "Ayúdalo a que más gente lo encuentre en el mapa.",
                escena: "la fachada colorida de una tienda de barrio en Colombia con el dueño sonriendo en la puerta" },
  registrar:  { pagina: "registrar-negocio.html", icono: "🏪", titulo: "¿Tienes un negocio? Ponlo en el mapa gratis", sub: "Tu WhatsApp, horario, vitrina y cómo llegar, en un solo lugar.",
                escena: "el dueño de una panadería o tienda de barrio en Colombia atendiendo con orgullo detrás del mostrador" },
  directorio: { pagina: "comercios.html", icono: "📍", titulo: "Negocios cerca de ti, abiertos ahora", sub: "Horario, WhatsApp y cómo llegar en un toque.",
                escena: "una calle comercial de un municipio colombiano al atardecer con locales abiertos e iluminados" },
  categoria:  { pagina: "anuncios.html", icono: "📂", titulo: "", sub: "Anuncios de gente cerca de ti. Contacto directo por WhatsApp.",
                escena: "productos de la categoría {nombre} bien presentados, estilo catálogo" },
  tienda:     { pagina: "tienda.html", icono: "🛍️", titulo: "", sub: "Mira sus productos, su horario y pide por WhatsApp.",
                escena: "productos de una tienda de barrio bien organizados en estantes, luz cálida" },
  producto:   { pagina: "tienda.html", hash: "#productos", icono: "🏷️", titulo: "", sub: "Míralo con foto y precio y pide por WhatsApp.",
                escena: "un producto de tienda de barrio bien presentado sobre una mesa, estilo catálogo, luz cálida" },
  anuncio:    { pagina: "anuncio.html", icono: "🔥", titulo: "", sub: "Míralo con fotos y escríbele directo al vendedor.",
                escena: "objetos de segunda mano en buen estado bien iluminados sobre un fondo limpio" },
  libre:      { pagina: "", icono: "👉", titulo: "Mira esto en Merkap", sub: "Compra, vende y encuentra negocios cerca de ti.",
                escena: "un mercado de barrio colombiano lleno de vida" }
};
const PAGINAS_REF = Object.fromEntries(Object.entries(DESTINOS).map(([k, d]) => [k, d.pagina]));   // compatibilidad

// ---------- Textos (3 versiones por destino) ----------
// {link} enlace · {zona} « en Envigado» o vacío · {nombre} categoría, tipo, comercio o anuncio · {icono}
// *negrita* se ve en negrita en WhatsApp; en los demás canales se quitan los asteriscos.
const VERSIONES = [["corto", "✂️ Corto"], ["beneficios", "✅ Con beneficios"], ["pregunta", "❓ Con pregunta"]];
const TEXTOS = {
  inicio: [
    "🛒 *Merkap*: compra, vende y encuentra negocios{zona} en un solo lugar. ¡Gratis! 👉 {link}",
    "¿Buscas algo cerca de ti? 🔎\n\nEn *Merkap* encuentras:\n✅ Anuncios de vecinos\n✅ Tiendas y negocios con horario y WhatsApp\n✅ Cómo llegar en un toque\n\nTodo GRATIS{zona} 👇\n{link}",
    "¿Sabías que ya hay un lugar para encontrar lo que se vende{zona} sin dar mil vueltas? 🤔 Míralo aquí 👉 {link}"
  ],
  registro: [
    "📲 Crea tu cuenta GRATIS en *Merkap* en 1 minuto y empieza a vender o comprar{zona} 👉 {link}",
    "📲 *Regístrate gratis en Merkap*\n\n✅ Publica lo que quieras vender\n✅ Te escriben directo a tu WhatsApp\n✅ Sin comisiones ni letra pequeña\n\nEntra aquí 👇\n{link}",
    "¿Tienes cosas guardadas que ya no usas? 👀 Conviértelas en plata. Regístrate gratis en *Merkap* 👉 {link}"
  ],
  publicar: [
    "📢 Publica tu anuncio GRATIS en *Merkap* y que te escriban directo a tu WhatsApp. Sin comisiones 👉 {link}",
    "🚀 *¿Vas a vender algo?*\n\nPublícalo gratis en Merkap:\n📸 Sube fotos\n📍 Lo ve la gente cerca{zona}\n💬 Te contactan por WhatsApp\n\nEmpieza aquí 👇\n{link}",
    "¿Moto, celular, mueble, arriendo o un servicio? 🤔 Lo que sea, publícalo GRATIS en *Merkap* 👉 {link}"
  ],
  recomendar: [
    "🤝 ¿Conoces un negocio bueno{zona}? Recomiéndalo en *Merkap* y ayúdalo a que más gente lo encuentre 💛 {link}",
    "💛 *Apoya a los negocios de tu barrio*\n\nLa panadería, el taller, la tienda de la esquina… Recomiéndalos en Merkap para que aparezcan en el mapa con su WhatsApp y horario.\n\nToma 1 minuto 👇\n{link}",
    "¿Cuál es el negocio{zona} que siempre le recomiendas a todo el mundo? 🏆 Ponlo en el mapa de *Merkap* 👉 {link}"
  ],
  registrar: [
    "🏪 ¿Tienes un negocio{zona}? Regístralo GRATIS en *Merkap* y que tus vecinos te encuentren 👉 {link}",
    "📍 *Tu negocio en el mapa, gratis*\n\n✅ Apareces cuando te buscan cerca\n✅ Tu WhatsApp, horario y cómo llegar\n✅ Vitrina con tus productos\n\nRegístralo aquí 👇\n{link}",
    "¿Tus clientes te encuentran fácil en internet? 🤔 Pon tu negocio en *Merkap* gratis 👉 {link}"
  ],
  directorio: [
    "📍 Encuentra {nombre}{zona} con horario, WhatsApp y cómo llegar en *Merkap* 👉 {link}",
    "🔎 *¿Qué está abierto ahora{zona}?*\n\nEn Merkap ves {nombre} cerca de ti:\n🟢 Abierto o cerrado\n💬 WhatsApp directo\n🗺️ Cómo llegar\n\nMíralo aquí 👇\n{link}",
    "¿No sabes qué está abierto{zona}? 😅 Mira {nombre} en el directorio de *Merkap* 👉 {link}"
  ],
  categoria: [
    "{icono} Mira lo que se está ofreciendo en *{nombre}*{zona} en Merkap 👉 {link}",
    "{icono} *{nombre} en Merkap*\n\n✅ Anuncios de gente cerca de ti\n✅ Contacto directo por WhatsApp\n✅ Publicar es gratis\n\nMira aquí 👇\n{link}",
    "¿Buscas algo en {nombre}? 🤔 Hay anuncios nuevos{zona} en *Merkap* 👉 {link}"
  ],
  tienda: [
    "🛍️ Visita la vitrina de *{nombre}* en Merkap: productos, horario y WhatsApp 👉 {link}",
    "🛍️ *{nombre}* ya está en Merkap\n\n📦 Mira sus productos\n🕒 Horario actualizado\n💬 Pide por WhatsApp\n\nEntra aquí 👇\n{link}",
    "¿Ya conoces *{nombre}*? 😉 Mira su vitrina en Merkap 👉 {link}"
  ],
  producto: [
    "🏷️ Mira *{nombre}* en Merkap: foto, precio y pide por WhatsApp 👉 {link}",
    "🔥 *{nombre}*\n\n📸 Míralo con foto y precio\n💬 Pide directo por WhatsApp\n📍 Cómo llegar en un toque\n\nAquí 👇\n{link}",
    "¿Ya viste *{nombre}*? 👀 Míralo aquí 👉 {link}"
  ],
  anuncio: [
    "📄 Mira este anuncio en Merkap: *{nombre}* 👉 {link}",
    "🔥 *{nombre}*\n\nMíralo con fotos y escríbele directo al vendedor por WhatsApp 👇\n{link}",
    "¿A alguien le sirve? 👀 *{nombre}* → {link}"
  ],
  libre: [
    "👉 Mira esto en *Merkap*: {link}",
    "📌 Te comparto esta página de *Merkap*:\n{link}",
    "Míralo aquí 👉 {link}"
  ]
};
const NOTA_CANAL = {
  whatsapp: "En WhatsApp las palabras entre *asteriscos* salen en negrita.",
  estado: "Para estados: usa la imagen vertical y pon este texto como descripción.",
  facebook: "En grupos: lee las reglas del grupo y publica máximo 1 vez por semana. Agrega la imagen cuadrada.",
  instagram: "Instagram no deja links en las publicaciones: pon el link en tu biografía (bio) o en una historia con sticker de enlace.",
  tiktok: "TikTok: pon el link en tu biografía y menciona «link en mi perfil» en el video.",
  qr: "En impresos lo importante es el QR: usa «Solo el QR» o la imagen con QR.",
  volante: "En volantes lo importante es el QR y una frase corta y grande.",
  "": ""
};
const ICONOS = ["🛒", "📲", "📢", "🤝", "🏪", "📍", "🛍️", "🔥", "💛", "🎉", "⭐", "💰", "🚀", "🐶", "🍔", "🚗", "🏡", "📱", "🛠️", "👕", "💼"];

let svgActual = "";
let version = 0;
let iconoElegido = "";
let codigoTocado = false;     // si la persona escribió el código, no se lo cambiamos solos
let textoEditado = false;     // si editó el texto a mano, solo se le cambia el link
let ultimoLink = "";
let nombreObjetivo = "";      // nombre del comercio o del anuncio (se busca por número)
let fotoFondo = null;
let ctaTocado = false;        // si escribió el texto del botón, no se cambia solo con el canal
// Fase 2AP-2 · campañas guardadas (SQL 41)
let campanas = [];            // lista de «📋 Mis campañas»
let campanaEditando = null;   // código de la campaña abierta (null = nueva)
let guardadoComo = null;      // {destino, canal, nombre} tal como quedó guardada (para avisar cambios sin guardar)
let sinSQL41 = false;         // falta correr supabase/41_campanas.sql
let textosBD = null;          // tus versiones de los textos guardadas en la base
let nombreTocado = false;     // si escribió el nombre de la campaña, no se lo cambiamos
let productoPendiente = "";   // producto a elegir cuando termine de cargar la lista
if (typeof alCargarLogo === "function") alCargarLogo(() => programarDibujo());
// Si piezas.js no llegó (celular con archivos mezclados), el panel igual funciona
const ctaCanal = c => (typeof ctaPorCanal === "function" ? ctaPorCanal(c) : "👉 Ingresa aquí");

// Carpeta donde vive la página (sirve igual en GitHub Pages o en un dominio propio)
function baseSitio() { return location.origin + location.pathname.replace(/[^/]*$/, ""); }
function codigoActual() { return limpiarRef(slugRef($("rf-codigo").value)); }
function destinoActual() { return DESTINOS[$("rf-destino").value] ? $("rf-destino").value : "inicio"; }
function canalActual() { return $("mk-canal").value; }

// Página libre: solo páginas de Merkap (nada de enlaces a otros sitios)
function paginaLibre() {
  const v = $("mk-libre").value.trim().replace(/^\/+/, "");
  return /^[a-z0-9-]+\.html([?#][^\s<>"']*)?$/i.test(v) ? v : "";
}

// Destino dentro de Merkap (página + datos), SIN ?ref ni ?o: es lo que se guarda en la campaña
function destinoPartes() {
  const destino = destinoActual();
  const d = DESTINOS[destino];
  let pagina = d.pagina, hash = d.hash || "";
  const params = [];
  if (destino === "tienda" || destino === "anuncio" || destino === "producto") {
    const id = $("rf-id").value.replace(/\D/g, "");
    if (!id) return null;
    params.push("id=" + id);
    if (destino === "producto") {
      const pr = $("mk-prod").value.replace(/\D/g, "");
      if (!pr) return null;
      params.push("p=" + pr);
    }
  } else if (destino === "categoria") {
    params.push("cat=" + encodeURIComponent($("mk-cat").value));
  } else if (destino === "directorio" && $("mk-tipo").value) {
    params.push("tipo=" + encodeURIComponent($("mk-tipo").value));
  } else if (destino === "libre") {
    const libre = paginaLibre();
    if (!libre) return null;
    const m = libre.match(/^([^?#]+)(\?[^#]*)?(#.*)?$/);
    pagina = m[1];
    if (m[2]) params.push(...m[2].slice(1).split("&").filter(x => x && !/^(ref|o|c)=/.test(x)));
    hash = m[3] || "";
  }
  return { pagina, params, hash };
}
function destinoRelativo() {
  const d = destinoPartes();
  return d ? d.pagina + (d.params.length ? "?" + d.params.join("&") : "") + d.hash : "";
}
function enlaceDirecto() {
  const codigo = codigoActual(), d = destinoPartes();
  if (!codigo || !d) return "";
  const params = d.params.concat("ref=" + codigo);
  if (canalActual()) params.push("o=" + canalActual());
  return baseSitio() + d.pagina + "?" + params.join("&") + d.hash;
}
function modoCorto() { return !sinSQL41 && $("mk-modo-corto").checked; }
function enlaceCorto() { const c = codigoActual(); return c ? baseSitio() + "?c=" + c : ""; }
function construirEnlace() {
  const directo = enlaceDirecto();
  if (!directo) return "";
  return modoCorto() ? enlaceCorto() : directo;
}

// Nombre que va en el texto según el destino
function nombreParaTexto() {
  const destino = destinoActual();
  if (destino === "categoria") { const c = CATEGORIAS.find(x => x.id === $("mk-cat").value); return c ? c.nombre : "Merkap"; }
  if (destino === "directorio") { const t = TIPOS_COMERCIO.find(x => x.id === $("mk-tipo").value); return t ? t.nombre.toLowerCase() : "negocios"; }
  if (destino === "tienda") return nombreObjetivo || "esta tienda";
  if (destino === "anuncio") return nombreObjetivo || "este anuncio";
  if (destino === "producto") {
    const o = $("mk-prod").selectedOptions[0];
    const prod = o && o.value ? o.dataset.nombre : "";
    return prod ? prod + (nombreObjetivo ? " en " + nombreObjetivo : "") : (nombreObjetivo ? "lo nuevo de " + nombreObjetivo : "este producto");
  }
  return "";
}
function iconoDestino() {
  const destino = destinoActual();
  if (destino === "categoria") { const c = CATEGORIAS.find(x => x.id === $("mk-cat").value); if (c) return c.icono; }
  if (destino === "directorio") { const t = TIPOS_COMERCIO.find(x => x.id === $("mk-tipo").value); if (t) return t.icono; }
  return DESTINOS[destino].icono;
}

// ---------- Texto ----------
function guardadosLocal() { try { return JSON.parse(localStorage.getItem("mk_textos") || "{}") || {}; } catch (e) { return {}; } }
function guardados() { return textosBD || guardadosLocal(); }
async function cargarTextosBD() {
  try {
    const { data, error } = await sb.from("marketing_textos").select("clave, texto");
    if (error) return;
    textosBD = {};
    (data || []).forEach(t => { textosBD[t.clave] = t.texto; });
    // Lo que tenías guardado en este navegador (fase 2AP-1) se sube a la base una sola vez
    const local = guardadosLocal();
    const subir = Object.keys(local).filter(k => !textosBD[k] && /^[a-z]{3,20}\|[0-9]$/.test(k)).map(k => ({ clave: k, texto: String(local[k]).slice(0, 1500) }));
    if (subir.length) {
      const { error: e2 } = await sb.from("marketing_textos").upsert(subir, { onConflict: "clave" });
      if (!e2) subir.forEach(x => { textosBD[x.clave] = x.texto; });
    }
  } catch (e) { textosBD = null; }
}
async function guardarTexto(clave, texto) {
  if (textosBD) {
    const { error } = await sb.from("marketing_textos").upsert({ clave, texto, actualizado_en: new Date().toISOString() }, { onConflict: "clave" });
    if (error) throw new Error(mensajeError(error));
    textosBD[clave] = texto;
  }
  const g = guardadosLocal(); g[clave] = texto;
  try { localStorage.setItem("mk_textos", JSON.stringify(g)); } catch (e) { if (!textosBD) throw new Error("Este navegador no deja guardar"); }
}
async function borrarTexto(clave) {
  if (textosBD) {
    const { error } = await sb.from("marketing_textos").delete().eq("clave", clave);
    if (error) throw new Error(mensajeError(error));
    delete textosBD[clave];
  }
  const g = guardadosLocal(); delete g[clave];
  try { localStorage.setItem("mk_textos", JSON.stringify(g)); } catch (e) { /* nada */ }
}
function claveTexto() { return destinoActual() + "|" + version; }

function aplicarCanal(t) {
  const canal = canalActual();
  const zona = $("mk-zona").value.trim();
  const tag = zona ? " #" + slugRef(zona).replace(/-/g, "") : "";
  if (canal !== "whatsapp" && canal !== "estado") t = t.replace(/\*([^*\n]+)\*/g, "$1");
  if (canal === "facebook") t += "\n\n#Merkap #ComprasLocales" + tag;
  if (canal === "instagram" || canal === "tiktok") {
    t = t.replace(/\{link\}/g, "🔗 link en mi perfil");
    t += "\n\n#Merkap #ComprasLocales #Colombia" + tag;
  }
  return t;
}

function textoBase() {
  const propio = guardados()[claveTexto()];
  return propio || TEXTOS[destinoActual()][version];
}

function pintarTexto() {
  const link = construirEnlace();
  const area = $("mk-texto");
  if (textoEditado && ultimoLink && link) {
    area.value = area.value.split(ultimoLink).join(link);
  } else if (!textoEditado) {
    const zona = $("mk-zona").value.trim();
    const t = aplicarCanal(textoBase())
      .replace(/\{zona\}/g, zona ? " en " + zona : "")
      .replace(/\{nombre\}/g, nombreParaTexto())
      .replace(/\{icono\}/g, iconoDestino())
      .replace(/\{link\}/g, link || "[escribe un código arriba]");
    area.value = t;
  }
  ultimoLink = link;
  const propio = !!guardados()[claveTexto()];
  $("mk-texto-nota").textContent = (propio ? "✏️ Estás usando tu versión guardada. " : "") + (NOTA_CANAL[canalActual()] || "");
  $("mk-restaurar-texto").classList.toggle("hidden", !propio && !textoEditado);
  $("mk-versiones").querySelectorAll("button").forEach((b, i) => {
    b.setAttribute("aria-pressed", i === version ? "true" : "false");
    b.textContent = VERSIONES[i][1] + (guardados()[destinoActual() + "|" + i] ? " · tuyo" : "");
  });
  const enc = encodeURIComponent(area.value);
  $("mk-wa").href = "https://wa.me/?text=" + enc;
  $("mk-fb").href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link || baseSitio());
}

// ---------- Tarjeta (canvas): el dibujo vive en piezas.js ----------
let dibujoPendiente = 0;
function programarDibujo() { cancelAnimationFrame(dibujoPendiente); dibujoPendiente = requestAnimationFrame(() => dibujar()); }
function dibujar() {
  if (typeof dibujarPieza !== "function") return Promise.resolve();   // piezas.js no cargó
  return dibujarPieza($("mk-lienzo"), {
    formato: $("mk-formato").value, url: construirEnlace(), verQr: $("mk-ver-qr").checked,
    fondo: $("mk-color-fondo").value, cta: $("mk-color-cta").value, foto: fotoFondo,
    verLogo: $("mk-ver-logo").checked, verCta: $("mk-ver-cta").checked, ctaTexto: $("mk-cta").value,
    verLink: $("mk-ver-link").checked, icono: iconoElegido || iconoDestino(),
    titulo: $("mk-titulo").value, sub: $("mk-sub").value
  });
}

// Los campos de la tarjeta toman los valores del destino (si no los cambió a mano)
function rellenarTarjeta() {
  const d = DESTINOS[destinoActual()];
  const destino = destinoActual();
  let titulo = d.titulo;
  if (destino === "categoria") titulo = "Mira lo nuevo en " + nombreParaTexto();
  if (destino === "tienda") titulo = nombreObjetivo ? nombreObjetivo + " ya está en Merkap" : "Visita nuestra tienda en Merkap";
  if (destino === "anuncio") titulo = nombreObjetivo || "Mira este anuncio";
  if (destino === "producto") {
    const o = $("mk-prod").selectedOptions[0];
    titulo = o && o.value ? o.dataset.nombre : (nombreObjetivo ? "Lo nuevo de " + nombreObjetivo : "Mira este producto");
  }
  if (destino === "directorio" && $("mk-tipo").value) titulo = nombreParaTexto().replace(/^./, c => c.toUpperCase()) + " cerca de ti";
  $("mk-titulo").value = titulo;
  $("mk-sub").value = destino === "producto" && nombreObjetivo ? "En " + nombreObjetivo + ". " + d.sub : d.sub;
  if (!ctaTocado) $("mk-cta").value = ctaCanal(canalActual());
  iconoElegido = "";
  pintarIconos();
}

function pintarIconos() {
  const actual = iconoElegido || iconoDestino();
  const lista = [...new Set([iconoDestino(), ...ICONOS])];
  $("mk-iconos").innerHTML = lista.map(i => `<button type="button" class="mk-icono" data-icono="${esc(i)}" aria-pressed="${i === actual}">${esc(i)}</button>`).join("")
    + `<input id="mk-icono-libre" class="mk-icono-libre" maxlength="4" placeholder="✏️" title="Pega aquí cualquier emoji" aria-label="Otro ícono" value="${lista.includes(actual) ? "" : esc(actual)}">`;
}

// ---------- QR solo (stickers) ----------
function pintarQrSolo(url) {
  $("rf-resultado").classList.toggle("hidden", !url);
  if (!url) { svgActual = ""; return; }
  svgActual = qrSvg(url, { px: 8, margen: 4 });
  $("rf-qr").innerHTML = svgActual;
  const svg = $("rf-qr").querySelector("svg");
  svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("class", "w-full h-full");
  $("rf-codigo-visto").textContent = "Código: " + codigoActual();
}

function descargar(nombre, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function bajarPng() {
  if (!svgActual) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(img, 0, 0, 1024, 1024);
    c.toBlob(b => descargar("qr-" + codigoActual() + ".png", b), "image/png");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgActual);
}

// ---------- Todo junto ----------
function codigoSugerido() {
  const canal = { whatsapp: "wa", estado: "estado", facebook: "fb", instagram: "ig", tiktok: "tt", qr: "qr", volante: "volante", "": "link" }[canalActual()] || "link";
  const zona = slugRef($("mk-zona").value).slice(0, 12);
  // nombre de la tienda o del anuncio, cortado en una palabra completa (máx. 20 letras)
  const objetivo = nombreObjetivo && ["tienda", "producto", "anuncio"].includes(destinoActual())
    ? (() => { let t = ""; for (const w of slugRef(nombreObjetivo).split("-")) { const n = t ? t + "-" + w : w; if (n.length > 20) break; t = n; } return t; })() : "";
  return slugRef([canal, objetivo || (destinoActual() === "libre" ? "pagina" : destinoActual()), objetivo ? "" : zona].filter(Boolean).join("-"));
}

function pintarEnlace() {
  const entrada = $("rf-codigo");
  // Mientras escribe: espacios → guiones, y se deja el guion final para poder seguir escribiendo «grupo-»
  const crudo = entrada.value.replace(/ /g, "-");
  const base = slugRef(crudo);
  const limpio = base && base.length < 30 && /[-_]$/.test(crudo) ? base + "-" : base;
  if (entrada.value !== limpio && !entrada.readOnly) entrada.value = limpio;
  const destino = destinoActual();
  $("rf-id-caja").classList.toggle("hidden", destino !== "tienda" && destino !== "anuncio" && destino !== "producto");
  $("mk-prod-caja").classList.toggle("hidden", destino !== "producto");
  $("rf-id-etq").textContent = destino === "anuncio" ? "Busca el anuncio" : "Busca el comercio";
  $("mk-buscar-obj").placeholder = destino === "anuncio" ? "🔎 Escribe el título (ej.: moto)" : "🔎 Escribe el nombre (ej.: panadería)";
  $("mk-cat-caja").classList.toggle("hidden", destino !== "categoria");
  $("mk-tipo-caja").classList.toggle("hidden", destino !== "directorio");
  $("mk-libre-caja").classList.toggle("hidden", destino !== "libre");
  const url = construirEnlace();
  $("rf-vacio").classList.toggle("hidden", !!url);
  $("rf-vacio").textContent = !codigoActual() ? "Escribe un código para ver el enlace."
    : destino === "libre" ? "Escribe una página de Merkap (termina en .html)."
    : destino === "producto" && $("rf-id").value ? "Elige el producto." : "Escribe el número.";
  $("mk-enlace-caja").classList.toggle("hidden", !url);
  $("rf-enlace").value = url;
  if (url) $("mk-probar").href = url;
  pintarQrSolo(url);
  pintarTexto();
  programarDibujo();
  pintarEstadoCampana();
}

// Lista de productos de la vitrina elegida
function llenarProductos(prods, vacio) {
  const sel = $("mk-prod");
  const antes = productoPendiente || sel.value;
  sel.innerHTML = `<option value="">${esc(vacio)}</option>` + prods.map(x => `<option value="${x.id}" data-nombre="${esc(x.nombre)}">${esc(x.nombre)}${x.precio != null ? " · $" + Number(x.precio).toLocaleString("es-CO") : ""}${x.disponible === false ? " (agotado)" : ""}</option>`).join("");
  if (antes && prods.some(x => String(x.id) === String(antes))) sel.value = String(antes);
  else if (prods.length === 1) sel.value = String(prods[0].id);
  productoPendiente = "";
}

// Busca el nombre del comercio o del anuncio para el texto y la tarjeta
let esperaNombre = 0;
function buscarNombre() {
  clearTimeout(esperaNombre);
  const destino = destinoActual();
  const id = parseInt($("rf-id").value.replace(/\D/g, ""), 10);
  $("rf-id-nombre").textContent = "";
  const conComercio = destino === "tienda" || destino === "producto";
  if ((!conComercio && destino !== "anuncio") || !id) {
    if (destino === "producto") llenarProductos([], "Primero escribe el número del comercio");
    if (nombreObjetivo) { nombreObjetivo = ""; rellenarTarjeta(); pintarEnlace(); }
    return;
  }
  esperaNombre = setTimeout(async () => {
    let nombre = "";
    try {
      const { data } = await sb.from(conComercio ? "comercios" : "anuncios").select("id, nombre").eq("id", id).limit(1);
      nombre = data && data[0] ? data[0].nombre : "";
    } catch (e) { nombre = ""; }
    if (destinoActual() !== destino) return;
    if (destino === "producto") {
      let prods = [];
      try {
        const { data } = await sb.from("productos_comercio").select("id, nombre, precio, disponible, oculto").eq("comercio_id", id).order("nombre");
        prods = (data || []).filter(x => !x.oculto);
      } catch (e) { prods = []; }
      if (destinoActual() !== destino) return;
      llenarProductos(prods, nombre ? (prods.length ? "Elige el producto…" : "Esta vitrina aún no tiene productos") : "—");
    }
    nombreObjetivo = nombre || "";
    if (!codigoTocado && !campanaEditando) $("rf-codigo").value = codigoSugerido();
    $("rf-id-nombre").textContent = nombre ? "✓ " + nombre : "No encontramos ese número (revisa que esté publicado).";
    $("rf-id-nombre").className = "block mt-1 text-[11px] font-semibold " + (nombre ? "text-emerald-700" : "text-amber-700");
    if (!textoEditado) rellenarTarjeta();
    pintarEnlace();
  }, 350);
}

async function pintarTabla() {
  const caja = $("rf-tabla");
  caja.innerHTML = '<p class="p-4 text-sm text-slate-500">Cargando…</p>';
  try {
    const filas = await cargarResumenReferidos();
    if (!filas.length) { caja.innerHTML = '<p class="p-4 text-sm text-slate-500">Todavía no hay cuentas.</p>'; return; }
    caja.innerHTML = `<table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs text-slate-500"><tr>
        <th class="text-left p-3">Código</th><th class="p-3">Cuentas</th><th class="p-3">Últimos 7 días</th><th class="p-3">Ya publicaron</th><th class="p-3">Enviaron negocio</th></tr></thead>
      <tbody>${filas.map(f => `<tr class="border-t border-slate-100">
        <td class="p-3 font-semibold whitespace-nowrap ${f.ref === "(directo)" ? "text-slate-500" : "text-indigo-700"}" data-ref="${esc(f.ref)}">${esc(f.ref)}</td>
        <td class="p-3 text-center font-bold">${f.registros}</td>
        <td class="p-3 text-center">${f.ultimos7}</td>
        <td class="p-3 text-center">${f.conAnuncio}</td>
        <td class="p-3 text-center">${f.conNegocio}</td></tr>`).join("")}</tbody></table>`;
    ponerNombresCodigos(filas);
  } catch (e) {
    caja.innerHTML = `<p class="p-4 text-sm text-red-600">${esc(e.message)}</p>`;
  }
}

// Fase 2AP-3: los códigos que traen los dueños al compartir («tienda-12», «anuncio-34») muestran el nombre
async function ponerNombresCodigos(filas) {
  const ids = { tienda: [], anuncio: [] };
  filas.forEach(f => { const m = /^(tienda|anuncio)-(\d{1,9})$/.exec(f.ref); if (m) ids[m[1]].push(Number(m[2])); });
  for (const [tipo, lista] of Object.entries(ids)) {
    if (!lista.length) continue;
    try {
      const { data } = await sb.from(tipo === "tienda" ? "comercios" : "anuncios").select("id, nombre").in("id", lista);
      (data || []).forEach(x => {
        const td = document.querySelector(`#rf-tabla td[data-ref="${tipo}-${x.id}"]`);
        if (td) td.innerHTML = `${esc(tipo + "-" + x.id)} <span class="block text-[11px] font-normal text-slate-500">${tipo === "tienda" ? "🏪" : "📄"} ${esc(x.nombre)} · lo compartió el dueño</span>`;
      });
    } catch (e) { /* sin nombres, queda el código */ }
  }
}

async function copiar(texto, ok) {
  try { await navigator.clipboard.writeText(texto); mostrarToast(ok); return true; }
  catch (e) { mostrarToast("No se pudo copiar: selecciónalo y cópialo a mano", "error"); return false; }
}


// =====================================================================
// Fase 2AP-2 · Campañas: enlace corto «…/?c=codigo» que se puede redirigir sin reimprimir el QR
// =====================================================================
const NOMBRE_CANAL = { whatsapp: "WhatsApp", estado: "Estado", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", qr: "QR", volante: "Volante", "": "Otro" };

function configActual() {
  const o = $("mk-prod").selectedOptions[0];
  return {
    destino: destinoActual(), id: $("rf-id").value.replace(/\D/g, "") || null, cat: $("mk-cat").value || null,
    tipo: $("mk-tipo").value || null, libre: paginaLibre() || null, p: $("mk-prod").value || null,
    zona: $("mk-zona").value.trim() || null, objetivo: nombreObjetivo || null,
    producto: o && o.value ? o.dataset.nombre : null
  };
}
// «🛍️ Vitrina · Casa Postres», «📂 Categoría · Mascotas»…
function etiquetaDestino(c) {
  const k = c.config || {};
  const opt = [...$("rf-destino").options].find(o => o.value === k.destino);
  let t = opt ? opt.textContent.replace(/\s*\(.*\)$/, "") : c.destino;
  if (k.destino === "tienda") t = "🛍️ Vitrina · " + (c.comercio || k.objetivo || "#" + k.id);
  if (k.destino === "producto") t = "🏷️ " + (k.producto || "Producto") + " · " + (c.comercio || k.objetivo || "#" + k.id);
  if (k.destino === "anuncio") t = "📄 Anuncio · " + (k.objetivo || "#" + k.id);
  if (k.destino === "categoria") { const x = CATEGORIAS.find(z => z.id === k.cat); t = "📂 Categoría · " + (x ? x.nombre : k.cat); }
  if (k.destino === "directorio" && k.tipo) { const x = TIPOS_COMERCIO.find(z => z.id === k.tipo); t = "📍 Directorio · " + (x ? x.nombre : k.tipo); }
  if (k.destino === "libre") t = "✏️ " + c.destino;
  return t;
}
function nombreSugerido() {
  const canal = canalActual();
  const pref = canal === "qr" ? "Sticker" : canal === "volante" ? "Volante" : NOMBRE_CANAL[canal] || "Enlace";
  const destino = destinoActual();
  const opt = $("rf-destino").selectedOptions[0];
  const que = ["tienda", "producto", "anuncio"].includes(destino) && nombreObjetivo ? nombreParaTexto()
    : (opt ? opt.textContent.replace(/^\S+\s/, "").replace(/\s*\(.*\)$/, "") : destino);
  const zona = $("mk-zona").value.trim();
  return (pref + " · " + que + (zona && !["tienda", "producto", "anuncio"].includes(destino) ? " · " + zona : "")).slice(0, 80);
}
function campanaPorCodigo(c) { return campanas.find(x => x.codigo === c); }
function sinGuardar() {
  if (!modoCorto()) return false;
  if (!campanaEditando) return true;
  return !guardadoComo || guardadoComo.destino !== destinoRelativo() || guardadoComo.canal !== (canalActual() || null);
}

function pintarEstadoCampana() {
  const caja = $("mk-camp-caja");
  if (!caja) return;
  const corto = modoCorto();
  $("mk-modo-corto").disabled = sinSQL41;
  $("mk-camp-campos").classList.toggle("hidden", !corto);
  if (corto && !nombreTocado && !campanaEditando) $("mk-nombre").value = nombreSugerido();
  const cod = codigoActual();
  const existente = !campanaEditando && cod && campanaPorCodigo(cod);
  const est = $("mk-camp-estado");
  $("mk-guardar-camp").disabled = !!existente;
  $("mk-guardar-camp").classList.toggle("opacity-50", !!existente);
  $("mk-guardar-camp").textContent = campanaEditando ? "💾 Guardar cambios" : "💾 Guardar campaña";
  if (sinSQL41) {
    est.innerHTML = "🧩 Para los enlaces cortos falta correr <code>supabase/41_campanas.sql</code>. Mientras tanto se usa el enlace directo.";
    est.className = "text-xs mt-2 text-amber-800";
  } else if (!corto) {
    est.textContent = "➡️ El enlace directo lleva siempre al mismo lugar: si lo imprimes, no se puede cambiar después.";
    est.className = "text-xs mt-2 text-slate-600";
  } else if (existente) {
    est.innerHTML = `⚠️ Ya tienes una campaña con el código <b>${esc(cod)}</b>. <button type="button" class="underline font-bold" data-camp-editar="${esc(cod)}">✏️ Abrirla</button> o escribe otro código.`;
    est.className = "text-xs mt-2 text-amber-800";
  } else if (!campanaEditando) {
    est.textContent = "⚠️ Sin guardar: guarda la campaña para que el enlace corto y su QR funcionen.";
    est.className = "text-xs mt-2 text-amber-800 font-semibold";
  } else if (sinGuardar()) {
    const c = campanaPorCodigo(campanaEditando);
    est.innerHTML = `⚠️ Cambios sin guardar: el QR sigue llevando a <b>${esc(c ? etiquetaDestino(c) : guardadoComo.destino)}</b> hasta que toques «💾 Guardar cambios».`;
    est.className = "text-xs mt-2 text-amber-800 font-semibold";
  } else {
    const c = campanaPorCodigo(campanaEditando);
    est.innerHTML = `✅ Guardada${c && c.activa === false ? " (⏸ pausada: quien escanee llega al inicio)" : ""}. Si cambias el destino y guardas, <b>el mismo QR</b> llevará al nuevo lugar al instante.`;
    est.className = "text-xs mt-2 " + (c && c.activa === false ? "text-slate-600" : "text-emerald-800");
  }
  $("mk-editando").classList.toggle("hidden", !campanaEditando);
  $("mk-editando").textContent = campanaEditando ? "✏️ Editando: " + campanaEditando : "";
  $("mk-cancelar-camp").classList.toggle("hidden", !campanaEditando);
  $("mk-paso1-titulo").textContent = campanaEditando ? "¿A dónde lleva esta campaña?" : "¿A dónde quieres llevar a la gente?";
  const ro = !!campanaEditando;
  $("rf-codigo").readOnly = ro;
  $("rf-codigo").classList.toggle("bg-slate-100", ro);
  $("mk-codigo-etq").textContent = ro ? "Código (fijo: puede estar impreso)" : "Código de la campaña";
  document.querySelectorAll(".mk-camp").forEach(el => el.classList.toggle("editando", el.dataset.codigo === campanaEditando));
}

// Si el enlace corto aún no está guardado, no dejamos copiarlo, imprimirlo ni compartirlo
function frenarSinGuardar(e) {
  if (!modoCorto() || !sinGuardar()) return false;
  if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
  mostrarToast(campanaEditando ? "Primero toca «💾 Guardar cambios»" : "Primero toca «💾 Guardar campaña»: sin guardar, el enlace corto no funciona", "error");
  $("mk-camp-caja").scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

async function cargarCampanas() {
  const caja = $("mk-camp-lista");
  try {
    const { data, error } = await sb.rpc("campanas_resumen", { p_dias: Number($("mk-camp-dias").value) || 30 });
    if (error) throw error;
    sinSQL41 = false;
    campanas = (data || []).map(c => Object.assign({}, c, { config: c.config || {} }));
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/campanas_resumen|does not exist|Could not find/i.test(msg)) {
      sinSQL41 = true;
      $("mk-modo-directo").checked = true;
      caja.innerHTML = '<p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 sm:col-span-2 xl:col-span-3">🧩 Falta activar las campañas: ejecuta <code>supabase/41_campanas.sql</code> en Supabase → SQL Editor. Mientras tanto puedes seguir usando enlaces directos.</p>';
      $("mk-camp-n").textContent = "";
      pintarEnlace();
      return;
    }
    caja.innerHTML = `<p class="text-sm text-red-600">${esc(mensajeError(e))}</p>`;
    return;
  }
  pintarCampanas();
  pintarEstadoCampana();
}

function pintarCampanas() {
  const caja = $("mk-camp-lista");
  const plano = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const q = plano($("mk-camp-buscar").value);
  const lista = campanas.filter(c => !q || plano([c.nombre, c.codigo, c.comercio, etiquetaDestino(c)].join(" ")).includes(q));
  const activas = campanas.filter(c => c.activa).length;
  $("mk-camp-n").textContent = campanas.length ? `(${activas} activa${activas === 1 ? "" : "s"} de ${campanas.length})` : "";
  if (!campanas.length) {
    caja.innerHTML = '<p class="text-sm text-slate-500 sm:col-span-2 xl:col-span-3">Todavía no tienes campañas guardadas. Arma una abajo con «🔁 Enlace corto» y toca «💾 Guardar campaña»: aparecerá aquí con sus escaneos.</p>';
    return;
  }
  if (!lista.length) { caja.innerHTML = '<p class="text-sm text-slate-500">Ninguna campaña coincide con la búsqueda.</p>'; return; }
  const dias = $("mk-camp-dias").selectedOptions[0].textContent.toLowerCase();
  caja.innerHTML = lista.map(c => {
    const contactos = c.comercio_id ? `${Number(c.contactos_tienda)}<small class="text-[10px] text-slate-400">/${Number(c.contactos)}</small>` : Number(c.contactos);
    return `<article class="mk-camp ${c.activa ? "" : "pausada"} ${c.codigo === campanaEditando ? "editando" : ""}" data-codigo="${esc(c.codigo)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0"><p class="mk-camp-nombre">${esc(c.nombre)}</p>
          <p class="text-[11px] text-slate-500 truncate"><code>${esc(c.codigo)}</code> · ${esc(NOMBRE_CANAL[c.canal || ""] || c.canal)}</p></div>
        <span class="mk-pill ${c.activa ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}">${c.activa ? "🟢 Activa" : "⏸ Pausada"}</span>
      </div>
      <p class="text-xs text-slate-700">➡️ Lleva a: <b>${esc(etiquetaDestino(c))}</b>${Number(c.cambios) ? ` <span class="text-slate-400" title="Veces que cambiaste el destino o la pausaste">· ${Number(c.cambios)} cambio${Number(c.cambios) === 1 ? "" : "s"}</span>` : ""}</p>
      <div class="mk-camp-num" title="${esc(dias)}">
        <div><b>${Number(c.escaneos)}</b><span>escaneos</span></div>
        <div><b>${Number(c.personas)}</b><span>personas</span></div>
        <div><b>${Number(c.cuentas)}</b><span>cuentas nuevas</span></div>
        <div><b>${contactos}</b><span>${c.comercio_id ? "contactos a la tienda" : "contactos"}</span></div>
      </div>
      <p class="text-[11px] text-slate-500">${c.ultimo_escaneo ? "Último escaneo: " + esc(haceCuanto(new Date(c.ultimo_escaneo).getTime(), true)) : "Aún nadie lo ha abierto"} · ${esc(dias)} · total ${Number(c.escaneos_total)}</p>
      <div class="mk-camp-acc">
        <button type="button" class="principal" data-camp-editar="${esc(c.codigo)}">✏️ Abrir / cambiar destino</button>
        <button type="button" data-camp-pausar="${esc(c.codigo)}">${c.activa ? "⏸ Pausar" : "▶️ Activar"}</button>
        <button type="button" data-camp-copiar="${esc(c.codigo)}">🔗 Copiar</button>
        <button type="button" data-camp-borrar="${esc(c.codigo)}" class="!text-red-700">🗑</button>
      </div>
    </article>`;
  }).join("");
}

function nuevaCampana() {
  campanaEditando = null; guardadoComo = null; nombreTocado = false; codigoTocado = false;
  $("mk-modo-corto").checked = !sinSQL41; $("mk-modo-directo").checked = sinSQL41;
  $("rf-codigo").readOnly = false;
  $("rf-codigo").value = codigoSugerido();
  $("mk-nombre").value = "";
  textoEditado = false;
  pintarEnlace();
}

function editarCampana(codigo) {
  const c = campanaPorCodigo(codigo);
  if (!c) return;
  const k = c.config || {};
  campanaEditando = c.codigo;
  nombreTocado = true; codigoTocado = true; textoEditado = false;
  $("mk-modo-corto").checked = true;
  $("rf-codigo").value = c.codigo;
  $("mk-nombre").value = c.nombre;
  $("mk-canal").value = [...$("mk-canal").options].some(o => o.value === (c.canal || "")) ? (c.canal || "") : "";
  $("rf-destino").value = DESTINOS[k.destino] ? k.destino : "inicio";
  $("rf-id").value = k.id || "";
  if (k.cat) $("mk-cat").value = k.cat;
  $("mk-tipo").value = k.tipo || "";
  $("mk-libre").value = k.libre || "";
  $("mk-zona").value = k.zona || "";
  productoPendiente = k.p || "";
  nombreObjetivo = k.objetivo || "";
  if (k.destino === "producto" && k.p) llenarProductos([{ id: k.p, nombre: k.producto || "Producto" }], "Elige el producto…");
  guardadoComo = { destino: c.destino, canal: c.canal || null, nombre: c.nombre };
  rellenarTarjeta();
  pintarEnlace();
  buscarNombre();
  $("rf-destino").closest(".mk-caja").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function guardarCampana() {
  if (sinSQL41) return;
  const codigo = codigoActual();
  const destino = destinoRelativo();
  if (!codigo) { mostrarToast("Escribe el código de la campaña", "error"); return; }
  if (!destino) { mostrarToast($("rf-vacio").textContent || "Completa el destino", "error"); return; }
  const nombre = ($("mk-nombre").value.trim() || nombreSugerido()).slice(0, 80);
  const conTienda = ["tienda", "producto"].includes(destinoActual());
  const fila = { nombre, destino, canal: canalActual() || null, config: configActual(),
                 comercio_id: conTienda ? Number($("rf-id").value.replace(/\D/g, "")) || null : null };
  const b = $("mk-guardar-camp"); b.disabled = true;
  try {
    const { error } = campanaEditando
      ? await sb.from("campanas").update(fila).eq("codigo", campanaEditando)
      : await sb.from("campanas").insert(Object.assign({ codigo }, fila));
    if (error) {
      if (/duplicate|23505|ya existe/i.test(error.message || "") || error.code === "23505") throw new Error("Ese código ya existe: abre esa campaña desde «📋 Mis campañas» o escribe otro código.");
      if (/campanas_destino_check/.test(error.message || "")) throw new Error("Ese destino no es una página de Merkap válida.");
      throw new Error(mensajeError(error));
    }
    const eraNueva = !campanaEditando;
    campanaEditando = codigo;
    guardadoComo = { destino, canal: fila.canal, nombre };
    mostrarToast(eraNueva ? "✅ Campaña guardada: ya puedes descargar el QR" : "✅ Listo: el mismo QR ahora lleva al nuevo destino");
    await cargarCampanas();
    pintarEnlace();
  } catch (e) {
    mostrarToast(e.message, "error");
  } finally { b.disabled = false; }
}

async function pausarCampana(codigo) {
  const c = campanaPorCodigo(codigo); if (!c) return;
  const { error } = await sb.from("campanas").update({ activa: !c.activa }).eq("codigo", codigo);
  if (error) { mostrarToast(mensajeError(error), "error"); return; }
  mostrarToast(c.activa ? "⏸ Pausada: quien escanee llegará al inicio de Merkap" : "▶️ Activa de nuevo");
  await cargarCampanas();
}

async function borrarCampana(codigo) {
  const c = campanaPorCodigo(codigo); if (!c) return;
  if (!confirm(`¿Borrar la campaña «${c.nombre}»?\n\nSi su QR ya está impreso, quien lo escanee llegará al inicio y se pierden sus números. Si solo quieres detenerla, mejor usa «⏸ Pausar».`)) return;
  const { error } = await sb.from("campanas").delete().eq("codigo", codigo);
  if (error) { mostrarToast(mensajeError(error), "error"); return; }
  if (campanaEditando === codigo) nuevaCampana();
  mostrarToast("🗑 Campaña borrada");
  await cargarCampanas();
}

function nombreArchivo() { return "merkap-" + (codigoActual() || "pieza") + "-" + $("mk-formato").value + ".png"; }

document.addEventListener("DOMContentLoaded", async () => {
  await cargarSesion();
  $("rf-cargando").classList.add("hidden");
  if (!esAdmin()) {   // fase 2AK: solo administrador
    $("rf-sin-permiso-txt").textContent = usuarioActual
      ? "Tu cuenta no tiene rol de administrador."
      : "Inicia sesión con tu cuenta de administrador.";
    $("rf-sin-permiso").classList.remove("hidden");
    return;
  }
  $("rf-panel").classList.remove("hidden");
  try { await cargarCategoriasComercio(); } catch (e) { /* queda la lista de respaldo */ }

  // Listas
  $("mk-cat").innerHTML = CATEGORIAS.filter(c => c.id !== "todos" && c.id !== "adultos")
    .map(c => `<option value="${esc(c.id)}">${esc(c.icono + " " + c.nombre)}</option>`).join("");
  $("mk-tipo").innerHTML = '<option value="">Todos los negocios</option>' + TIPOS_COMERCIO.filter(t => t.activo !== false && t.id !== "intimo")
    .map(t => `<option value="${esc(t.id)}">${esc(t.icono + " " + t.nombre)}</option>`).join("");
  $("mk-versiones").innerHTML = VERSIONES.map((v, i) => `<button type="button" class="mk-version" data-version="${i}" aria-pressed="${i === 0}">${v[1]}</button>`).join("");

  await cargarTextosBD();
  // Llega prellenado (desde «🔳 QR del comercio» o un enlace viejo de referidos.html)
  const q = new URLSearchParams(location.search);
  if (DESTINOS[q.get("destino")]) $("rf-destino").value = q.get("destino");
  if (q.get("id")) $("rf-id").value = q.get("id").replace(/\D/g, "").slice(0, 9);
  if (q.get("canal") !== null && [...$("mk-canal").options].some(o => o.value === q.get("canal"))) $("mk-canal").value = q.get("canal");
  if (q.get("codigo")) { $("rf-codigo").value = slugRef(q.get("codigo")); codigoTocado = true; }
  else $("rf-codigo").value = codigoSugerido();

  // Enlace
  $("rf-codigo").addEventListener("input", () => { if (!$("rf-codigo").readOnly) { codigoTocado = true; pintarEnlace(); } });
  $("mk-nombre").addEventListener("input", () => { nombreTocado = true; });
  $("mk-cta").addEventListener("input", () => { ctaTocado = !!$("mk-cta").value.trim(); });
  ["mk-modo-corto", "mk-modo-directo"].forEach(id => $(id).addEventListener("change", () => { textoEditado = false; pintarEnlace(); }));
  $("mk-prod").addEventListener("change", () => { textoEditado = false; rellenarTarjeta(); pintarEnlace(); });
  $("mk-guardar-camp").addEventListener("click", guardarCampana);
  $("mk-cancelar-camp").addEventListener("click", nuevaCampana);
  $("mk-camp-nueva").addEventListener("click", () => { nuevaCampana(); $("rf-destino").closest(".mk-caja").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("mk-camp-buscar").addEventListener("input", pintarCampanas);
  $("mk-camp-dias").addEventListener("change", cargarCampanas);
  document.addEventListener("click", e => {
    const ed = e.target.closest("[data-camp-editar]"); if (ed) { editarCampana(ed.dataset.campEditar); return; }
    const pa = e.target.closest("[data-camp-pausar]"); if (pa) { pausarCampana(pa.dataset.campPausar); return; }
    const co = e.target.closest("[data-camp-copiar]"); if (co) { copiar(baseSitio() + "?c=" + co.dataset.campCopiar, "🔗 Link de la campaña copiado"); return; }
    const bo = e.target.closest("[data-camp-borrar]"); if (bo) borrarCampana(bo.dataset.campBorrar);
  });
  // Sin guardar, el enlace corto no funciona: se frena copiar, compartir, descargar e imprimir
  ["rf-copiar", "mk-probar", "mk-copiar-texto", "mk-wa", "mk-fb", "mk-bajar", "mk-compartir", "rf-png", "rf-svg", "rf-imprimir"]
    .forEach(id => $(id).addEventListener("click", frenarSinGuardar, true));
  ["rf-destino", "mk-canal"].forEach(id => $(id).addEventListener("change", () => {
    if (!codigoTocado) $("rf-codigo").value = codigoSugerido();
    if (id === "rf-destino") { textoEditado = false; nombreObjetivo = ""; rellenarTarjeta(); buscarNombre(); }
    else { textoEditado = false; if (!ctaTocado) $("mk-cta").value = ctaCanal(canalActual()); }
    pintarEnlace();
  }));
  $("mk-zona").addEventListener("input", () => { if (!codigoTocado) $("rf-codigo").value = codigoSugerido(); textoEditado = false; pintarEnlace(); });
  ["mk-cat", "mk-tipo"].forEach(id => $(id).addEventListener("change", () => { textoEditado = false; rellenarTarjeta(); pintarEnlace(); }));
  $("rf-id").addEventListener("input", () => { pintarEnlace(); buscarNombre(); });
  $("mk-libre").addEventListener("input", pintarEnlace);
  $("rf-copiar").addEventListener("click", () => copiar($("rf-enlace").value, "🔗 Link copiado"));

  // Texto
  $("mk-versiones").addEventListener("click", e => {
    const b = e.target.closest("[data-version]"); if (!b) return;
    version = Number(b.dataset.version); textoEditado = false; pintarTexto();
  });
  $("mk-texto").addEventListener("input", () => { textoEditado = true; $("mk-restaurar-texto").classList.remove("hidden"); $("mk-wa").href = "https://wa.me/?text=" + encodeURIComponent($("mk-texto").value); });
  $("mk-copiar-texto").addEventListener("click", () => copiar($("mk-texto").value, "📋 Texto copiado: pégalo en el grupo"));
  $("mk-guardar-texto").addEventListener("click", () => {
    const link = construirEnlace();
    let t = $("mk-texto").value;
    if (link) t = t.split(link).join("{link}");
    if (!t.includes("{link}")) t += "\n{link}";
    guardarTexto(claveTexto(), t.slice(0, 1500))
      .then(() => { mostrarToast(textosBD ? "💾 Guardado (lo verás en todos tus equipos)" : "💾 Guardado en este navegador"); textoEditado = false; pintarTexto(); })
      .catch(err => mostrarToast(err.message, "error"));
  });
  $("mk-restaurar-texto").addEventListener("click", () => {
    borrarTexto(claveTexto()).then(() => { textoEditado = false; pintarTexto(); }).catch(err => mostrarToast(err.message, "error"));
  });

  // Tarjeta
  $("mk-plantilla").addEventListener("change", () => {
    const PL = typeof PLANTILLAS !== "undefined" ? PLANTILLAS : { morado: { fondo: "#4c1d95", cta: "#f6c51a" } };
    const p = PL[$("mk-plantilla").value] || PL.morado;
    $("mk-color-fondo").value = p.fondo; $("mk-color-cta").value = p.cta; programarDibujo();
  });
  ["mk-formato", "mk-titulo", "mk-sub", "mk-cta", "mk-color-fondo", "mk-color-cta", "mk-ver-logo", "mk-ver-qr", "mk-ver-link", "mk-ver-cta"]
    .forEach(id => $(id).addEventListener("input", programarDibujo));
  $("mk-iconos").addEventListener("click", e => {
    const b = e.target.closest("[data-icono]"); if (!b) return;
    iconoElegido = b.dataset.icono; pintarIconos(); programarDibujo();
  });
  $("mk-iconos").addEventListener("input", e => {
    if (e.target.id !== "mk-icono-libre") return;
    iconoElegido = e.target.value.trim();
    $("mk-iconos").querySelectorAll("[data-icono]").forEach(b => b.setAttribute("aria-pressed", "false"));
    programarDibujo();
  });
  $("mk-foto").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { mostrarToast("Eso no es una imagen", "error"); return; }
    const img = new Image();
    img.onload = () => { fotoFondo = img; $("mk-quitar-foto").classList.remove("hidden"); programarDibujo(); };
    img.onerror = () => mostrarToast("No se pudo abrir la imagen", "error");
    img.src = URL.createObjectURL(f);
    e.target.value = "";
  });
  $("mk-quitar-foto").addEventListener("click", () => { fotoFondo = null; $("mk-quitar-foto").classList.add("hidden"); programarDibujo(); });
  $("mk-prompt").addEventListener("click", () => {
    const formato = { cuadrado: "cuadrado (1:1)", historia: "vertical (9:16)", horizontal: "horizontal (1.91:1)" }[$("mk-formato").value];
    const escena = DESTINOS[destinoActual()].escena.replace("{nombre}", nombreParaTexto());
    const zona = $("mk-zona").value.trim();
    copiar(`Foto realista en formato ${formato} de ${escena}${zona ? ", ambiente de " + zona + " (Colombia)" : ""}. Colores cálidos y alegres, estilo publicitario, buena luz. SIN texto, SIN letras y SIN logos. Deja espacio libre arriba y abajo para poner un título y un código QR.`,
      "🤖 Idea copiada: pégala en ChatGPT, Gemini o Canva");
  });
  $("mk-bajar").addEventListener("click", async () => {
    await dibujar();
    $("mk-lienzo").toBlob(b => b && descargar(nombreArchivo(), b), "image/png");
  });
  try {
    const prueba = new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [prueba] })) $("mk-compartir").classList.remove("hidden");
  } catch (e) { /* sin compartir */ }
  $("mk-compartir").addEventListener("click", async () => {
    await dibujar();
    $("mk-lienzo").toBlob(async b => {
      if (!b) return;
      const archivo = new File([b], nombreArchivo(), { type: "image/png" });
      try { await navigator.share({ files: [archivo], text: $("mk-texto").value }); }
      catch (e) { if (e && e.name !== "AbortError") mostrarToast("No se pudo compartir: descarga la imagen", "error"); }
    }, "image/png");
  });

  // QR solo
  $("rf-png").addEventListener("click", bajarPng);
  $("rf-svg").addEventListener("click", () => { if (svgActual) descargar("qr-" + codigoActual() + ".svg", new Blob([svgActual], { type: "image/svg+xml" })); });
  $("rf-imprimir").addEventListener("click", () => { $("ref-sticker").closest("details").open = true; window.print(); });
  $("rf-recargar").addEventListener("click", pintarTabla);

  rellenarTarjeta();
  buscarNombre();
  pintarEnlace();
  pintarTabla();
  await cargarCampanas();
  // Si llega con un código que ya es campaña (ej.: «🔳 QR del comercio» por segunda vez), se abre esa
  if (q.get("codigo") && campanaPorCodigo(slugRef(q.get("codigo")))) editarCampana(slugRef(q.get("codigo")));
  else if (q.get("campana") && campanaPorCodigo(q.get("campana"))) editarCampana(q.get("campana"));
});

// =====================================================================
// Fase 2AP-3 · Buscador rápido: elegir el comercio o el anuncio por su nombre (sin buscar el número)
// =====================================================================
let listasObjetivo = null;   // { comercios: [...], anuncios: [...] } se cargan la primera vez que buscas
async function cargarObjetivos() {
  if (listasObjetivo) return listasObjetivo;
  listasObjetivo = (async () => {
    try { await cargarMunicipios(); } catch (e) { /* sin municipios igual sirve */ }
    let cs = [], as = [];
    try { cs = (await cargarComercios()) || comercios || []; } catch (e) { cs = []; }
    try { await cargarAnuncios(); as = baseDatosAnuncios || []; } catch (e) { as = []; }
    return { comercios: cs, anuncios: as };
  })();
  return listasObjetivo;
}
const planoBusq = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
async function buscarObjetivo() {
  const caja = $("mk-obj-res");
  const q = planoBusq($("mk-buscar-obj").value);
  if (q.length < 2) { caja.classList.add("hidden"); return; }
  caja.innerHTML = '<p class="p-3 text-xs text-slate-500">Buscando…</p>'; caja.classList.remove("hidden");
  const l = await cargarObjetivos();
  if (planoBusq($("mk-buscar-obj").value) !== q) return;   // ya escribió otra cosa
  const anuncio = destinoActual() === "anuncio";
  const palabras = q.split(" ");
  const fuente = anuncio ? l.anuncios : l.comercios;
  const res = fuente.filter(x => { const t = planoBusq([x.nombre, x.ciudad, x.barrio, "#" + x.id].join(" ")); return palabras.every(p => t.includes(p)); })
    .sort((a, b) => planoBusq(a.nombre).indexOf(palabras[0]) - planoBusq(b.nombre).indexOf(palabras[0]) || String(a.nombre).localeCompare(String(b.nombre), "es"))
    .slice(0, 10);
  if (!res.length) { caja.innerHTML = `<p class="p-3 text-xs text-slate-500">No encontramos ${anuncio ? "anuncios activos" : "comercios activos"} con «${esc($("mk-buscar-obj").value)}».</p>`; return; }
  caja.innerHTML = res.map(x => {
    const ico = anuncio ? ((CATEGORIAS.find(c => c.id === x.categoria) || {}).icono || "📄") : (iconosComercio[x.tipo] || "🏪");
    const extra = anuncio ? [x.precio ? "$" + Number(x.precio).toLocaleString("es-CO") : "", x.ciudad].filter(Boolean).join(" · ") : [x.ciudad, x.nProductos ? x.nProductos + " productos" : ""].filter(Boolean).join(" · ");
    return `<button type="button" role="option" class="w-full text-left px-3 py-2 hover:bg-violet-50 border-b border-slate-100 last:border-0 flex items-center gap-2" data-obj="${x.id}">
      <span class="text-lg">${esc(ico)}</span><span class="min-w-0 flex-1"><span class="block text-sm font-bold text-slate-800 truncate">${esc(x.nombre)}</span>
      <span class="block text-[11px] text-slate-500 truncate">${esc(extra)} · #${x.id}</span></span></button>`;
  }).join("");
}
document.addEventListener("DOMContentLoaded", () => {
  const ent = $("mk-buscar-obj"); if (!ent) return;
  let espera = 0;
  ent.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(buscarObjetivo, 200); });
  ent.addEventListener("focus", () => { if (ent.value.trim().length >= 2) buscarObjetivo(); });
  $("mk-obj-res").addEventListener("click", e => {
    const b = e.target.closest("[data-obj]"); if (!b) return;
    $("rf-id").value = b.dataset.obj;
    ent.value = "";
    $("mk-obj-res").classList.add("hidden");
    $("rf-id").dispatchEvent(new Event("input"));
  });
  document.addEventListener("click", e => { if (!e.target.closest("#rf-id-caja")) $("mk-obj-res").classList.add("hidden"); });
  ent.addEventListener("keydown", e => {
    if (e.key === "Escape") $("mk-obj-res").classList.add("hidden");
    if (e.key === "Enter") { e.preventDefault(); const b = $("mk-obj-res").querySelector("[data-obj]"); if (b) b.click(); }
  });
});
