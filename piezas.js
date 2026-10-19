// ===== Merkap · Piezas gráficas (fase 2AP-3) =====
// Dibuja en un <canvas> la tarjeta para compartir: logo, ícono, título, frase, botón, link y QR.
// La usan el 📣 Centro de marketing (administrador) y «📣 Comparte tu tienda / mi anuncio» (dueños).
// Todo se hace en el navegador: gratis y la foto que se sube no sale del equipo.
// Requiere qr.js (qrSvg).
const FORMATOS = { cuadrado: [1080, 1080], historia: [1080, 1920], horizontal: [1200, 630], sticker: [1080, 1080] };
const PLANTILLAS = { morado: { fondo: "#4c1d95", cta: "#f6c51a" }, amarillo: { fondo: "#f6c51a", cta: "#4c1d95" }, claro: { fondo: "#ffffff", cta: "#4c1d95" } };
// Lo que dice el botón de la imagen según dónde se comparte (la imagen NO es un link: en el celular se toca el link del texto)
const CTA_POR_CANAL = { qr: "📷 Escanea y entra", volante: "📷 Escanea y entra", whatsapp: "👇 Toca el link de abajo", estado: "👇 Toca el link de abajo",
                        facebook: "👇 Toca el link de abajo", instagram: "🔗 Link en mi perfil", tiktok: "🔗 Link en mi perfil", "": "👉 Ingresa aquí" };
function ctaPorCanal(canal) { return CTA_POR_CANAL[canal] || CTA_POR_CANAL[""]; }
const logoPieza = new Image();
logoPieza.src = "img/logo-merkap-512.png";
const _alLogo = [];
logoPieza.onload = () => _alLogo.splice(0).forEach(f => f());
// Siempre «después» (nunca en el mismo instante): si el logo ya estaba guardado en el celular, llamar
// enseguida rompía marketing.js («Cannot access 'dibujoPendiente' before initialization»)
function alCargarLogo(f) { if (logoPieza.complete && logoPieza.naturalWidth) setTimeout(f, 0); else _alLogo.push(f); }

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

async function dibujarPieza(cv, o) {
  o = o || {};
  const formato = FORMATOS[o.formato] ? o.formato : "cuadrado";
  const [W, H] = FORMATOS[formato];
  const url = o.url || "";
  const verQr = o.verQr !== false && !!url;
  const qrImg = verQr ? await imagenQr(url) : null;
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  const ctx = cv.getContext("2d");
  const fondo = o.fondo || "#4c1d95", cta = o.cta || "#f6c51a";
  const fotoFondo = o.foto && o.foto.naturalWidth ? o.foto : null;
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
  if (o.verLogo !== false) {
    const L = horizontal ? 76 : (formato === "historia" ? 130 : 110);
    if (logoPieza.complete && logoPieza.naturalWidth) ctx.drawImage(logoPieza, pad, y, L, L);
    ctx.fillStyle = colTexto; ctx.font = `900 ${Math.round(L * .58)}px ${FUENTE}`; ctx.textAlign = "left";
    ctx.fillText("Merkap", pad + L + L * .22, y + L * .7);
    y += L;
  }

  const textoCta = o.verCta !== false ? (String(o.ctaTexto || "").trim() || "👉 Ingresa aquí") : "";
  const textoLink = o.verLink !== false && url ? linkVisible(url) : "";
  const icono = o.icono || "";
  const titulo = String(o.titulo || "").trim();
  const sub = String(o.sub || "").trim();

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
    if (verQr && formato === "sticker") {   // sticker para la puerta: QR grande en el centro
      const lado = 430, hTxt = alturaBotonYLink(W - pad * 2);
      abajoAlto = lado + 28 + hTxt;
      const yq = H - pad - abajoAlto;
      cajaQr((W - lado) / 2, yq, lado);
      botonYLink(pad, yq + lado + 28, W - pad * 2, true);
    } else if (verQr) {
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
