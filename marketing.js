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
const PLANTILLAS = { morado: { fondo: "#4c1d95", cta: "#f6c51a" }, amarillo: { fondo: "#f6c51a", cta: "#4c1d95" }, claro: { fondo: "#ffffff", cta: "#4c1d95" } };
const FORMATOS = { cuadrado: [1080, 1080], historia: [1080, 1920], horizontal: [1200, 630] };

let svgActual = "";
let version = 0;
let iconoElegido = "";
let codigoTocado = false;     // si la persona escribió el código, no se lo cambiamos solos
let textoEditado = false;     // si editó el texto a mano, solo se le cambia el link
let ultimoLink = "";
let nombreObjetivo = "";      // nombre del comercio o del anuncio (se busca por número)
let fotoFondo = null;
const logoImg = new Image();
logoImg.src = "img/logo-merkap-512.png";
logoImg.onload = () => programarDibujo();

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

function construirEnlace() {
  const codigo = codigoActual();
  if (!codigo) return "";
  const destino = destinoActual();
  const d = DESTINOS[destino];
  let pagina = d.pagina, hash = d.hash || "";
  const params = [];
  if (destino === "tienda" || destino === "anuncio") {
    const id = $("rf-id").value.replace(/\D/g, "");
    if (!id) return "";
    params.push("id=" + id);
  } else if (destino === "categoria") {
    params.push("cat=" + encodeURIComponent($("mk-cat").value));
  } else if (destino === "directorio" && $("mk-tipo").value) {
    params.push("tipo=" + encodeURIComponent($("mk-tipo").value));
  } else if (destino === "libre") {
    const libre = paginaLibre();
    if (!libre) return "";
    const m = libre.match(/^([^?#]+)(\?[^#]*)?(#.*)?$/);
    pagina = m[1];
    if (m[2]) params.push(...m[2].slice(1).split("&").filter(x => x && !/^(ref|o)=/.test(x)));
    hash = m[3] || "";
  }
  params.push("ref=" + codigo);
  if (canalActual()) params.push("o=" + canalActual());
  return baseSitio() + pagina + "?" + params.join("&") + hash;
}

// Nombre que va en el texto según el destino
function nombreParaTexto() {
  const destino = destinoActual();
  if (destino === "categoria") { const c = CATEGORIAS.find(x => x.id === $("mk-cat").value); return c ? c.nombre : "Merkap"; }
  if (destino === "directorio") { const t = TIPOS_COMERCIO.find(x => x.id === $("mk-tipo").value); return t ? t.nombre.toLowerCase() : "negocios"; }
  if (destino === "tienda") return nombreObjetivo || "esta tienda";
  if (destino === "anuncio") return nombreObjetivo || "este anuncio";
  return "";
}
function iconoDestino() {
  const destino = destinoActual();
  if (destino === "categoria") { const c = CATEGORIAS.find(x => x.id === $("mk-cat").value); if (c) return c.icono; }
  if (destino === "directorio") { const t = TIPOS_COMERCIO.find(x => x.id === $("mk-tipo").value); if (t) return t.icono; }
  return DESTINOS[destino].icono;
}

// ---------- Texto ----------
function guardados() { try { return JSON.parse(localStorage.getItem("mk_textos") || "{}") || {}; } catch (e) { return {}; } }
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

// ---------- Tarjeta (canvas) ----------
const FUENTE = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function luminancia(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function oscurecer(hex, f) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f)), g = Math.round(((n >> 8) & 255) * (1 - f)), b = Math.round((n & 255) * (1 - f));
  return `rgb(${r},${g},${b})`;
}
function partirLineas(ctx, texto, ancho) {
  const lineas = [];
  String(texto).split("\n").forEach(parrafo => {
    let linea = "";
    parrafo.split(/\s+/).filter(Boolean).forEach(p => {
      const prueba = linea ? linea + " " + p : p;
      if (ctx.measureText(prueba).width <= ancho || !linea) linea = prueba;
      else { lineas.push(linea); linea = p; }
    });
    if (linea) lineas.push(linea);
  });
  return lineas;
}
// Busca el tamaño de letra más grande que quepa en «maxLineas»
function ajustar(ctx, texto, ancho, maxLineas, grande, chico, peso) {
  for (let t = grande; t >= chico; t -= 4) {
    ctx.font = `${peso} ${t}px ${FUENTE}`;
    const l = partirLineas(ctx, texto, ancho);
    if (l.length <= maxLineas && l.every(x => ctx.measureText(x).width <= ancho)) return { lineas: l, t };
  }
  ctx.font = `${peso} ${chico}px ${FUENTE}`;
  return { lineas: partirLineas(ctx, texto, ancho).slice(0, maxLineas), t: chico };
}
// El link se parte en cualquier parte (no tiene espacios)
function partirLink(ctx, texto, ancho, max) {
  const lineas = [];
  let l = "";
  for (const ch of texto) {
    if (ctx.measureText(l + ch).width > ancho && l) { lineas.push(l); l = ""; }
    l += ch;
  }
  if (l) lineas.push(l);
  if (lineas.length > max) { lineas.length = max; lineas[max - 1] = lineas[max - 1].slice(0, -1) + "…"; }
  return lineas;
}
function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const cacheQr = {};
function imagenQr(url) {
  if (cacheQr[url]) return cacheQr[url];
  cacheQr[url] = new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg(url, { px: 8, margen: 1 }));
  });
  return cacheQr[url];
}
function linkVisible(url) { return url.replace(/^https?:\/\//, "").replace(/index\.html\?/, "?"); }

let dibujoPendiente = 0;
function programarDibujo() { cancelAnimationFrame(dibujoPendiente); dibujoPendiente = requestAnimationFrame(() => dibujar()); }

async function dibujar() {
  const formato = FORMATOS[$("mk-formato").value] ? $("mk-formato").value : "cuadrado";
  const [W, H] = FORMATOS[formato];
  const cv = $("mk-lienzo");
  const url = construirEnlace();
  const verQr = $("mk-ver-qr").checked && !!url;
  const qrImg = verQr ? await imagenQr(url) : null;
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  const ctx = cv.getContext("2d");
  const fondo = $("mk-color-fondo").value, cta = $("mk-color-cta").value;
  const conFoto = !!fotoFondo;
  const claro = !conFoto && luminancia(fondo) > .45;
  const colTexto = claro ? "#1e1b4b" : "#ffffff";
  const colSub = claro ? "#475569" : "rgba(255,255,255,.88)";
  const colCtaTxt = luminancia(cta) > .45 ? "#1e1b4b" : "#ffffff";

  // Fondo
  ctx.clearRect(0, 0, W, H);
  if (conFoto) {
    const k = Math.max(W / fotoFondo.width, H / fotoFondo.height);
    const fw = fotoFondo.width * k, fh = fotoFondo.height * k;
    ctx.drawImage(fotoFondo, (W - fw) / 2, (H - fh) / 2, fw, fh);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(15,10,40,.55)"); g.addColorStop(.35, "rgba(15,10,40,.25)"); g.addColorStop(1, "rgba(15,10,40,.85)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W * .4, H);
    g.addColorStop(0, fondo); g.addColorStop(1, oscurecer(fondo, claro ? .06 : .3));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Adorno: círculos suaves del color del botón
    ctx.save(); ctx.globalAlpha = claro ? .12 : .16; ctx.fillStyle = cta;
    ctx.beginPath(); ctx.arc(W * .92, H * .1, Math.min(W, H) * .32, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(W * .05, H * .78, Math.min(W, H) * .2, 0, 7); ctx.fill();
    ctx.restore();
  }

  const horizontal = formato === "horizontal";
  const pad = horizontal ? 56 : (formato === "historia" ? 84 : 72);
  ctx.textBaseline = "alphabetic";

  // Logo + nombre
  let y = formato === "historia" ? 130 : pad;
  if ($("mk-ver-logo").checked) {
    const L = horizontal ? 76 : (formato === "historia" ? 130 : 110);
    if (logoImg.complete && logoImg.naturalWidth) ctx.drawImage(logoImg, pad, y, L, L);
    ctx.fillStyle = colTexto; ctx.font = `900 ${Math.round(L * .58)}px ${FUENTE}`; ctx.textAlign = "left";
    ctx.fillText("Merkap", pad + L + L * .22, y + L * .7);
    y += L;
  }

  const textoCta = $("mk-ver-cta").checked ? ("👉 " + ($("mk-cta").value.trim() || "Ingresa aquí")) : "";
  const textoLink = $("mk-ver-link").checked && url ? linkVisible(url) : "";
  const icono = iconoElegido || iconoDestino();
  const titulo = $("mk-titulo").value.trim();
  const sub = $("mk-sub").value.trim();

  // Bloque de abajo (QR + botón + link)
  const qrLado = horizontal ? 300 : (formato === "historia" ? 400 : 300);
  const anchoTexto = horizontal ? W - pad * 2 - (verQr ? qrLado + 48 : 0) : W - pad * 2;

  function botonYLink(x, yTop, ancho, centrado) {
    let yy = yTop;
    if (textoCta) {
      const t = horizontal ? 40 : (formato === "historia" ? 60 : 52);
      ctx.font = `800 ${t}px ${FUENTE}`;
      let w = ctx.measureText(textoCta).width + t * 1.3;
      const s = Math.min(1, ancho / w);
      ctx.font = `800 ${Math.round(t * s)}px ${FUENTE}`;
      w = Math.min(w, ancho);
      const h = t * s * 1.9, bx = centrado ? x + (ancho - w) / 2 : x;
      ctx.fillStyle = cta; rectRedondo(ctx, bx, yy, w, h, h / 2); ctx.fill();
      ctx.fillStyle = colCtaTxt; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(textoCta, bx + w / 2, yy + h / 2 + 2);
      ctx.textBaseline = "alphabetic";
      yy += h + (horizontal ? 14 : 22);
    }
    if (textoLink) {
      const t = horizontal ? 24 : (formato === "historia" ? 34 : 30);
      ctx.font = `600 ${t}px ${FUENTE}`;
      ctx.fillStyle = conFoto ? "rgba(255,255,255,.92)" : colSub; ctx.textAlign = centrado ? "center" : "left";
      partirLink(ctx, textoLink, ancho, 3).forEach(l => { yy += t * 1.2; ctx.fillText(l, centrado ? x + ancho / 2 : x, yy); });
    }
    return yy;
  }
  function alturaBotonYLink(ancho) {
    let h = 0;
    if (textoCta) h += (horizontal ? 40 : (formato === "historia" ? 60 : 52)) * 1.9 + (horizontal ? 14 : 22);
    if (textoLink) {
      const t = horizontal ? 24 : (formato === "historia" ? 34 : 30);
      ctx.font = `600 ${t}px ${FUENTE}`;
      h += partirLink(ctx, textoLink, ancho, 3).length * t * 1.2;
    }
    return h;
  }
  function cajaQr(x, yq, lado) {
    ctx.fillStyle = "#ffffff"; rectRedondo(ctx, x, yq, lado, lado, lado * .08); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    if (qrImg) ctx.drawImage(qrImg, x + lado * .07, yq + lado * .07, lado * .86, lado * .86);
    ctx.imageSmoothingEnabled = true;
  }

  // Zona de abajo
  let abajoAlto = 0;
  if (!horizontal) {
    if (verQr) {
      const xTxt = pad + qrLado + 40, ancho = W - pad - xTxt;
      const hTxt = alturaBotonYLink(ancho);
      abajoAlto = Math.max(qrLado, hTxt);
      const yq = H - pad - abajoAlto;
      cajaQr(pad, yq + (abajoAlto - qrLado) / 2, qrLado);
      botonYLink(xTxt, yq + (abajoAlto - hTxt) / 2, ancho, false);
    } else {
      const hTxt = alturaBotonYLink(W - pad * 2);
      abajoAlto = hTxt;
      botonYLink(pad, H - pad - hTxt, W - pad * 2, true);
    }
  } else {
    if (verQr) cajaQr(W - pad - qrLado, (H - qrLado) / 2 + (y > pad ? 20 : 0), qrLado);
    const hTxt = alturaBotonYLink(anchoTexto);
    abajoAlto = hTxt;
    botonYLink(pad, H - pad - hTxt, anchoTexto, false);
  }

  // Centro: ícono, título y frase
  const arriba = y + (horizontal ? 18 : 40), limite = H - pad - abajoAlto - (horizontal ? 18 : 40);
  const espacio = limite - arriba;
  const tIcono = horizontal ? 0 : Math.min(formato === "historia" ? 220 : 150, espacio * .28);
  const tit = ajustar(ctx, horizontal && icono ? icono + " " + titulo : titulo, anchoTexto, horizontal ? 3 : 4, horizontal ? 64 : (formato === "historia" ? 112 : 92), horizontal ? 34 : 48, 900);
  const sb_ = sub ? ajustar(ctx, sub, anchoTexto, 3, horizontal ? 30 : (formato === "historia" ? 52 : 42), horizontal ? 20 : 28, 500) : { lineas: [], t: 0 };
  const altoTit = tit.lineas.length * tit.t * 1.1;
  const altoSub = sb_.lineas.length * sb_.t * 1.3;
  const altoIcono = tIcono ? tIcono * 1.15 : 0;
  let total = altoIcono + altoTit + (altoSub ? altoSub + 20 : 0);
  let k = total > espacio ? espacio / total : 1;     // si no cabe, todo un poco más chico
  let yy = arriba + Math.max(0, (espacio - total * k) / 2);
  ctx.textAlign = horizontal ? "left" : "center";
  const xc = horizontal ? pad : W / 2;
  if (tIcono && icono) {
    ctx.font = `${Math.round(tIcono * k)}px ${EMOJI}`; ctx.fillStyle = colTexto;
    yy += tIcono * k; ctx.fillText(icono, xc, yy); yy += tIcono * .15 * k;
  }
  ctx.fillStyle = colTexto;
  tit.lineas.forEach((l, i) => {
    ctx.font = `900 ${Math.round(tit.t * k)}px ${FUENTE}`;
    yy += tit.t * 1.1 * k;
    ctx.fillText(l, xc, yy);   // en horizontal el ícono ya va al comienzo del título
  });
  if (sb_.lineas.length) {
    yy += 20 * k;
    ctx.fillStyle = conFoto ? "rgba(255,255,255,.92)" : colSub;
    sb_.lineas.forEach(l => { ctx.font = `500 ${Math.round(sb_.t * k)}px ${FUENTE}`; yy += sb_.t * 1.3 * k; ctx.fillText(l, xc, yy); });
  }
}

// Los campos de la tarjeta toman los valores del destino (si no los cambió a mano)
function rellenarTarjeta() {
  const d = DESTINOS[destinoActual()];
  const destino = destinoActual();
  let titulo = d.titulo;
  if (destino === "categoria") titulo = "Mira lo nuevo en " + nombreParaTexto();
  if (destino === "tienda") titulo = nombreObjetivo ? nombreObjetivo + " ya está en Merkap" : "Visita nuestra tienda en Merkap";
  if (destino === "anuncio") titulo = nombreObjetivo || "Mira este anuncio";
  if (destino === "directorio" && $("mk-tipo").value) titulo = nombreParaTexto().replace(/^./, c => c.toUpperCase()) + " cerca de ti";
  $("mk-titulo").value = titulo;
  $("mk-sub").value = d.sub;
  if (!$("mk-cta").value) $("mk-cta").value = "Ingresa aquí";
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
  return slugRef([canal, destinoActual() === "libre" ? "pagina" : destinoActual(), zona].filter(Boolean).join("-"));
}

function pintarEnlace() {
  const entrada = $("rf-codigo");
  // Mientras escribe: espacios → guiones, y se deja el guion final para poder seguir escribiendo «grupo-»
  const crudo = entrada.value.replace(/ /g, "-");
  const base = slugRef(crudo);
  const limpio = base && base.length < 30 && /[-_]$/.test(crudo) ? base + "-" : base;
  if (entrada.value !== limpio) entrada.value = limpio;
  const destino = destinoActual();
  $("rf-id-caja").classList.toggle("hidden", destino !== "tienda" && destino !== "anuncio");
  $("rf-id-etq").textContent = destino === "anuncio" ? "Número del anuncio (aparece en el enlace: anuncio.html?id=número)" : "Número del comercio (aparece en «✏️ Editar» como ?editar=número)";
  $("mk-cat-caja").classList.toggle("hidden", destino !== "categoria");
  $("mk-tipo-caja").classList.toggle("hidden", destino !== "directorio");
  $("mk-libre-caja").classList.toggle("hidden", destino !== "libre");
  const url = construirEnlace();
  $("rf-vacio").classList.toggle("hidden", !!url);
  $("rf-vacio").textContent = !codigoActual() ? "Escribe un código para ver el enlace."
    : destino === "libre" ? "Escribe una página de Merkap (termina en .html)." : "Escribe el número.";
  $("mk-enlace-caja").classList.toggle("hidden", !url);
  $("rf-enlace").value = url;
  if (url) $("mk-probar").href = url;
  pintarQrSolo(url);
  pintarTexto();
  programarDibujo();
}

// Busca el nombre del comercio o del anuncio para el texto y la tarjeta
let esperaNombre = 0;
function buscarNombre() {
  clearTimeout(esperaNombre);
  const destino = destinoActual();
  const id = parseInt($("rf-id").value.replace(/\D/g, ""), 10);
  $("rf-id-nombre").textContent = "";
  if ((destino !== "tienda" && destino !== "anuncio") || !id) { if (nombreObjetivo) { nombreObjetivo = ""; rellenarTarjeta(); pintarEnlace(); } return; }
  esperaNombre = setTimeout(async () => {
    let nombre = "";
    try {
      const { data } = await sb.from(destino === "tienda" ? "comercios" : "anuncios").select("id, nombre").eq("id", id).limit(1);
      nombre = data && data[0] ? data[0].nombre : "";
    } catch (e) { nombre = ""; }
    if (destinoActual() !== destino) return;
    nombreObjetivo = nombre || "";
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
        <td class="p-3 font-semibold whitespace-nowrap ${f.ref === "(directo)" ? "text-slate-500" : "text-indigo-700"}">${esc(f.ref)}</td>
        <td class="p-3 text-center font-bold">${f.registros}</td>
        <td class="p-3 text-center">${f.ultimos7}</td>
        <td class="p-3 text-center">${f.conAnuncio}</td>
        <td class="p-3 text-center">${f.conNegocio}</td></tr>`).join("")}</tbody></table>`;
  } catch (e) {
    caja.innerHTML = `<p class="p-4 text-sm text-red-600">${esc(e.message)}</p>`;
  }
}

async function copiar(texto, ok) {
  try { await navigator.clipboard.writeText(texto); mostrarToast(ok); return true; }
  catch (e) { mostrarToast("No se pudo copiar: selecciónalo y cópialo a mano", "error"); return false; }
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

  // Llega prellenado (desde «🔳 QR del comercio» o un enlace viejo de referidos.html)
  const q = new URLSearchParams(location.search);
  if (DESTINOS[q.get("destino")]) $("rf-destino").value = q.get("destino");
  if (q.get("id")) $("rf-id").value = q.get("id").replace(/\D/g, "").slice(0, 9);
  if (q.get("canal") !== null && [...$("mk-canal").options].some(o => o.value === q.get("canal"))) $("mk-canal").value = q.get("canal");
  if (q.get("codigo")) { $("rf-codigo").value = slugRef(q.get("codigo")); codigoTocado = true; }
  else $("rf-codigo").value = codigoSugerido();

  // Enlace
  $("rf-codigo").addEventListener("input", () => { codigoTocado = true; pintarEnlace(); });
  ["rf-destino", "mk-canal"].forEach(id => $(id).addEventListener("change", () => {
    if (!codigoTocado) $("rf-codigo").value = codigoSugerido();
    if (id === "rf-destino") { textoEditado = false; nombreObjetivo = ""; rellenarTarjeta(); buscarNombre(); }
    else textoEditado = false;
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
    const g = guardados(); g[claveTexto()] = t;
    try { localStorage.setItem("mk_textos", JSON.stringify(g)); mostrarToast("💾 Guardado en este navegador"); }
    catch (e) { mostrarToast("Este navegador no deja guardar", "error"); }
    textoEditado = false; pintarTexto();
  });
  $("mk-restaurar-texto").addEventListener("click", () => {
    const g = guardados(); delete g[claveTexto()];
    try { localStorage.setItem("mk_textos", JSON.stringify(g)); } catch (e) { /* nada */ }
    textoEditado = false; pintarTexto();
  });

  // Tarjeta
  $("mk-plantilla").addEventListener("change", () => {
    const p = PLANTILLAS[$("mk-plantilla").value] || PLANTILLAS.morado;
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
});
