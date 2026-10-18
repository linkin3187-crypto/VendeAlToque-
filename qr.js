// Merkap · Generador de códigos QR (sin librerías externas).
// Modo byte (UTF-8), corrección de errores nivel M, versiones 1 a 10 (hasta ~210 caracteres).
// Uso: qrMatriz("https://...") → matriz de booleanos · qrSvg("https://...", { px: 8, margen: 4 }) → texto SVG
(function () {
  "use strict";

  // Palabras de corrección por bloque y número de bloques (nivel M), índice = versión
  const ECC_POR_BLOQUE = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const NUM_BLOQUES    = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const MAX_VERSION = 10;

  function modulosDeDatos(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const n = Math.floor(v / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }
  const palabrasDeDatos = v => Math.floor(modulosDeDatos(v) / 8) - ECC_POR_BLOQUE[v] * NUM_BLOQUES[v];

  // ---- Reed-Solomon sobre GF(256) ----
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function divisor(grado) {
    const r = new Array(grado).fill(0);
    r[grado - 1] = 1;
    let raiz = 1;
    for (let i = 0; i < grado; i++) {
      for (let j = 0; j < grado; j++) {
        r[j] = gfMul(r[j], raiz);
        if (j + 1 < grado) r[j] ^= r[j + 1];
      }
      raiz = gfMul(raiz, 0x02);
    }
    return r;
  }
  function resto(datos, div) {
    const r = new Array(div.length).fill(0);
    for (const b of datos) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
    }
    return r;
  }

  function utf8(texto) {
    const out = [];
    const bytes = unescape(encodeURIComponent(texto));
    for (let i = 0; i < bytes.length; i++) out.push(bytes.charCodeAt(i));
    return out;
  }
  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function codificar(bytes) {
    let version = 1;
    for (; version <= MAX_VERSION; version++) {
      const bitsCuenta = version < 10 ? 8 : 16;
      if (4 + bitsCuenta + bytes.length * 8 <= palabrasDeDatos(version) * 8) break;
    }
    if (version > MAX_VERSION) throw new Error("El texto es demasiado largo para el QR");
    const bits = [];
    const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poner(0x4, 4);
    poner(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach(b => poner(b, 8));
    const capacidad = palabrasDeDatos(version) * 8;
    poner(0, Math.min(4, capacidad - bits.length));
    poner(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capacidad; pad ^= 0xEC ^ 0x11) poner(pad, 8);
    const datos = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      datos.push(b);
    }
    return { version, datos };
  }

  function intercalar(version, datos) {
    const nb = NUM_BLOQUES[version], ecc = ECC_POR_BLOQUE[version];
    const total = Math.floor(modulosDeDatos(version) / 8);
    const cortos = nb - total % nb;
    const largoCorto = Math.floor(total / nb);
    const div = divisor(ecc);
    const bloques = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = datos.slice(k, k + largoCorto - ecc + (i < cortos ? 0 : 1));
      k += dat.length;
      const e = resto(dat, div);
      if (i < cortos) dat.push(0);
      bloques.push(dat.concat(e));
    }
    const out = [];
    for (let i = 0; i < bloques[0].length; i++) {
      bloques.forEach((b, j) => {
        if (i !== largoCorto - ecc || j >= cortos) out.push(b[i]);
      });
    }
    return out;
  }

  function posicionesAlineacion(v, size) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const paso = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const r = [6];
    for (let pos = size - 7; r.length < n; pos -= paso) r.splice(1, 0, pos);
    return r;
  }

  function construir(version, palabras) {
    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const poner = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { poner(6, i, i % 2 === 0); poner(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) poner(x, y, d !== 2 && d !== 4);
      }
    });
    const al = posicionesAlineacion(version, size);
    al.forEach((cy, i) => al.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        poner(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }));
    function formato(mascara) {
      const datos = (0 << 3) | mascara;           // nivel M = 0
      let r = datos;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const bits = ((datos << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) poner(8, i, bit(bits, i));
      poner(8, 7, bit(bits, 6)); poner(8, 8, bit(bits, 7)); poner(7, 8, bit(bits, 8));
      for (let i = 9; i < 15; i++) poner(14 - i, 8, bit(bits, i));
      for (let i = 0; i < 8; i++) poner(size - 1 - i, 8, bit(bits, i));
      for (let i = 8; i < 15; i++) poner(8, size - 15 + i, bit(bits, i));
      poner(8, size - 8, true);
    }
    formato(0);                                    // reserva el espacio (se reescribe con la máscara elegida)
    if (version >= 7) {
      let r = version;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const bits = (version << 12) | r;
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + i % 3, b = Math.floor(i / 3);
        poner(a, b, bit(bits, i)); poner(b, a, bit(bits, i));
      }
    }
    // Colocar los datos en zigzag
    let k = 0;
    for (let der = size - 1; der >= 1; der -= 2) {
      if (der === 6) der = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = der - j, arriba = ((der + 1) & 2) === 0, y = arriba ? size - 1 - v : v;
        if (!fn[y][x] && k < palabras.length * 8) { m[y][x] = bit(palabras[k >>> 3], 7 - (k & 7)); k++; }
      }
    }
    // Probar las 8 máscaras y quedarse con la de menor penalización
    const mascaras = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
    ];
    const aplicar = i => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && mascaras[i](x, y)) m[y][x] = !m[y][x]; };
    function penalizacion() {
      let p = 0;
      for (let t = 0; t < 2; t++) for (let a = 0; a < size; a++) {
        let racha = 1;
        for (let b = 1; b < size; b++) {
          const igual = (t ? m[b][a] : m[a][b]) === (t ? m[b - 1][a] : m[a][b - 1]);
          if (igual) { racha++; if (racha === 5) p += 3; else if (racha > 5) p++; } else racha = 1;
        }
      }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
      let oscuros = 0; m.forEach(f => f.forEach(c => { if (c) oscuros++; }));
      p += Math.floor(Math.abs(oscuros * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    let mejor = 0, mejorP = Infinity;
    for (let i = 0; i < 8; i++) {
      aplicar(i); formato(i);
      const p = penalizacion();
      if (p < mejorP) { mejor = i; mejorP = p; }
      aplicar(i);                                  // deshace la máscara
    }
    aplicar(mejor); formato(mejor);
    return m;
  }

  window.qrMatriz = function (texto) {
    const { version, datos } = codificar(utf8(String(texto)));
    return construir(version, intercalar(version, datos));
  };

  // SVG listo para mostrar o descargar. px = tamaño de cada cuadrito, margen = cuadritos blancos alrededor (mínimo 4).
  window.qrSvg = function (texto, opc) {
    const o = Object.assign({ px: 8, margen: 4 }, opc || {});
    const m = window.qrMatriz(texto), n = m.length + o.margen * 2, lado = n * o.px;
    let d = "";
    m.forEach((fila, y) => fila.forEach((c, x) => {
      if (c) d += `M${(x + o.margen) * o.px},${(y + o.margen) * o.px}h${o.px}v${o.px}h-${o.px}z`;
    }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}" shape-rendering="crispEdges">` +
      `<rect width="${lado}" height="${lado}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  };
})();
