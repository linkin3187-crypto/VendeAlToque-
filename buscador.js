// ===== Merkap · Buscador inteligente (Fase 2W) =====
// Entiende lo que la gente escribe aunque no ponga el nombre exacto:
//  · sin tildes ni mayúsculas, plurales y prefijos («postre», «postres», «post…» dan lo mismo);
//  · errores de escritura (1 letra en palabras de 5+ letras, 2 en palabras de 8+);
//  · INTENCIONES: «postres» → Pastelerías, Panaderías, Cafeterías (comercios) y Comida (anuncios),
//    usando las PALABRAS CLAVE de cada categoría (las de comercios se editan en «Categorías», sin código).
// Va después de data.js. No usa servicios externos ni IA de pago: todo corre en el navegador.

// Palabras clave de las categorías de ANUNCIOS (estas sí viven en el código; agregar = añadir palabras aquí)
const PALABRAS_ANUNCIOS = {
  tienda: "tienda, viveres, abarrotes, mercado, granos, frutas, verduras, licores, cerveza, papeleria, utiles, drogueria",
  comida: "comida, almuerzo, postres, postre, torta, ponque, pan, empanadas, arepas, tamales, hamburguesa, pizza, galletas, dulces, chocolates, helado, jugos, bebidas, cafe, casero, mecato, desayuno, cena, domicilio, buñuelos, natilla, pasteles",
  autos: "carro, carros, auto, moto, motos, camioneta, campero, bicicleta, patineta, llantas, repuestos, casco, vehiculo",
  inmuebles: "apartamento, apartaestudio, casa, arriendo, alquiler, venta, lote, finca, local, oficina, bodega, habitacion, pieza, inmueble",
  tecnologia: "celular, telefono, iphone, samsung, xiaomi, computador, portatil, laptop, tablet, televisor, tv, audifonos, parlante, consola, playstation, xbox, nintendo, camara, cargador, smartwatch",
  servicios: "servicio, oficios, plomero, electricista, mecanico, carpintero, pintor, albañil, cerrajero, belleza, peluqueria, manicure, aseo, limpieza, mudanza, acarreo, trasteo, clases, profesor, tutor, tecnico, reparacion, instalacion, jardineria, niñera, cuidador",
  ferreteria: "ferreteria, herramienta, herramientas, taladro, pintura, cemento, tornillos, tubos, cables, materiales, construccion",
  hogar: "hogar, mueble, muebles, sofa, cama, colchon, comedor, nevera, lavadora, estufa, horno, microondas, licuadora, decoracion, cortinas, plantas, cocina, ollas, bebe, coche, cuna",
  mascotas: "mascota, mascotas, perro, perros, gato, gatos, cachorro, concentrado, veterinaria, adopcion, collar, arena",
  empleos: "empleo, trabajo, vacante, oferta, busco trabajo, medio tiempo, por dias, contrato, auxiliar, vendedor, mesero, conductor",
  ropa: "ropa, camisa, camiseta, pantalon, jean, vestido, zapatos, tenis, calzado, chaqueta, bolso, uniforme, ropa de bebe",
  otros: "otros, varios"
};

// Respaldo para comercios si aún no existe la tabla de categorías (SQL 15): las 12 de siempre
const PALABRAS_COMERCIO_RESPALDO = {
  farmacia: "farmacia, drogueria, medicamento, medicina, pastillas, acetaminofen, remedio",
  cajero: "cajero, sacar plata, retirar plata, efectivo, dinero", banco: "banco, consignar, cuenta, credito, giros",
  comida_rapida: "comida rapida, hamburguesa, pizza, perro caliente, salchipapa, empanadas",
  panaderia: "panaderia, pan, pandebono, postres, torta, ponque, desayuno",
  supermercado: "supermercado, mercado, viveres, abarrotes, aseo", tienda: "tienda, miscelanea, minimercado, granero",
  restaurante: "restaurante, almuerzo, corrientazo, comida, cafe", belleza: "belleza, peluqueria, barberia, unas, corte",
  ferreteria: "ferreteria, herramientas, pintura, tornillos", ropa: "ropa, zapatos, calzado, tenis", otro: ""
};

// ---------- Texto ----------
function normBusq(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/ñ/g, "n").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
const PALABRAS_VACIAS = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "y", "o", "para", "por", "con", "en", "a", "al", "mi", "me", "que", "busco", "necesito", "quiero", "venta", "vendo", "compro", "cerca", "barato", "barata", "buen", "buena"]);
function tokensBusq(t) { return normBusq(t).split(" ").filter(w => (w.length >= 2 || /\d/.test(w)) && !PALABRAS_VACIAS.has(w)); }   // los números cuentan («iphone 8»)

// Distancia de edición con tope (rápida: corta en cuanto supera el máximo)
function distanciaMax(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < minFila) minFila = cur[j];
    }
    if (minFila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// ¿La palabra buscada «q» coincide con la palabra «w» del texto?
// Devuelve 0 (no), 1 (parecida: error de escritura), 2 (empieza igual: «post» → «postres») o 3 (igual o plural)
function coincidePalabra(q, w) {
  if (q === w) return 3;
  if (q.length >= 4) {                                                                         // plurales: «postre» = «postres», «panes» = «pan»
    const fq = [q, q.replace(/s$/, ""), q.replace(/es$/, "")], fw = [w, w.replace(/s$/, ""), w.replace(/es$/, "")];
    if (fq.some(x => x.length >= 3 && fw.includes(x))) return 3;
  }
  if (w.length >= 4 && q.startsWith(w) && q.length - w.length <= 2) return 3;                  // «tortas» → «torta»
  if (q.length >= 3 && w.startsWith(q)) return 2;                                               // «post» → «postres»
  if (q.length >= 5) {
    const max = q.length >= 8 ? 2 : 1;
    if (distanciaMax(q, w, max) <= max) return 1;                                              // «pasteleria» ≈ «pateleria»
  }
  return 0;
}

// Puntaje de un texto para las palabras buscadas: suma lo que coincide (frase completa vale extra)
function puntajeTexto(texto, tokens, frase) {
  if (!tokens.length) return 0;
  const n = normBusq(texto);
  if (!n) return 0;
  const palabras = n.split(" ");
  let total = 0, todas = true;
  for (const q of tokens) {
    let mejor = 0;
    for (const w of palabras) { const c = coincidePalabra(q, w); if (c > mejor) { mejor = c; if (c === 3) break; } }
    total += mejor;
    if (!mejor) todas = false;
  }
  if (frase && frase.length >= 3 && n.includes(frase)) total += 2;
  return todas ? total * 1.5 : total;   // premio si aparecen TODAS las palabras buscadas
}

// ---------- Intenciones (categorías que la búsqueda sugiere) ----------
function frasesClave(texto) { return String(texto || "").split(",").map(normBusq).filter(Boolean); }

// Puntaje de una categoría: 4 = frase clave exacta («sacar plata»), 3 = palabra igual o plural,
// 2 = empieza igual (mientras se escribe), 1 = parecida (error de escritura)
function puntajeIntencion(frases, tokens, frase) {
  let mejor = 0;
  for (const f of frases) {
    if (f.includes(" ")) {                                                   // frase clave de varias palabras
      if (frase.includes(f)) mejor = Math.max(mejor, 4);
      else if (frase.length >= 4 && f.startsWith(frase)) mejor = Math.max(mejor, 2);
      else {
        const pf = f.split(" ").filter(w => w.length >= 2 && !PALABRAS_VACIAS.has(w));
        if (pf.length && tokens.length && pf.every(w => tokens.some(q => coincidePalabra(q, w) === 3))) mejor = Math.max(mejor, 3);
      }
    } else {
      for (const q of tokens) {
        let c = coincidePalabra(q, f);
        if (c === 2 && q.length < 4) c = 0;                                  // «bar» no es «barbería», «pan» no es «pantalón»
        if (c > mejor) mejor = c;
      }
    }
    if (mejor >= 4) break;
  }
  return mejor;
}
// Se quedan solo las categorías que responden casi tan bien como la mejor
const recortarIntenciones = l => { const max = Math.max(0, ...l.map(x => x.puntaje)); return l.filter(x => x.puntaje >= max - 1); };

// Analiza lo que se escribió: palabras + categorías de comercio y de anuncios que sugiere
function analizarBusqueda(q) {
  const frase = normBusq(q);
  const tokens = tokensBusq(q);
  const catsComercio = [], catsAnuncio = [];
  if (tokens.length || frase.length >= 3) {
    TIPOS_COMERCIO.filter(t => t.activo !== false).forEach(t => {
      const frases = frasesClave([t.nombre, t.palabras || PALABRAS_COMERCIO_RESPALDO[t.id] || ""].join(","));
      const p = puntajeIntencion(frases, tokens, frase);
      if (p) catsComercio.push({ id: t.id, nombre: t.nombre, icono: t.icono, puntaje: p });
    });
    CATEGORIAS.filter(c => c.id !== "todos" && c.activo !== false).forEach(c => {
      const subs = (SUBCATEGORIAS[c.id] || []).map(s => s[1]).join(",");
      const frases = frasesClave([c.nombre, c.palabras || PALABRAS_ANUNCIOS[c.id] || "", subs].join(","));
      const p = puntajeIntencion(frases, tokens, frase);
      if (p) catsAnuncio.push({ id: c.id, nombre: c.nombre, icono: c.icono, puntaje: p });
    });
  }
  const orden = (a, b) => b.puntaje - a.puntaje;
  return { frase, tokens, catsComercio: recortarIntenciones(catsComercio).sort(orden).slice(0, 4), catsAnuncio: recortarIntenciones(catsAnuncio).sort(orden).slice(0, 3) };
}

// ---------- Buscar en todo ----------
// fuentes: { anuncios, comercios, productos } (arreglos ya cargados). Devuelve listas ordenadas por relevancia.
function buscarTodo(q, fuentes) {
  const a = analizarBusqueda(q);
  const { tokens, frase } = a;
  const intC = {}; a.catsComercio.forEach(c => { intC[c.id] = c.puntaje; });
  const intA = {}; a.catsAnuncio.forEach(c => { intA[c.id] = c.puntaje; });
  const con = (lista, fn) => (lista || []).map(x => ({ x, p: fn(x) })).filter(r => r.p > 0).sort((r1, r2) => r2.p - r1.p).map(r => r.x);

  // Publicaciones: si hay anuncios que DICEN lo buscado, solo esos («iphone» no trae un televisor solo por ser
  // tecnología). Si ninguno lo dice, entran los de la categoría que responde («postres» → anuncios de Comida).
  const textoAnuncio = x => puntajeTexto([x.nombre, x.nombre, x.desc, x.barrio, x.ciudad, nombreSubcategoria(x.categoria, x.subcategoria)].join(" "), tokens, frase);
  const hayTextuales = (fuentes.anuncios || []).some(x => textoAnuncio(x) > 0);
  const anuncios = con(fuentes.anuncios, x => {
    const texto = textoAnuncio(x);
    if (hayTextuales) return texto ? texto * 2 + (intA[x.categoria] || 0) : 0;
    return (intA[x.categoria] || 0) * 0.6;
  });
  const nombreCat = id => { const t = TIPOS_COMERCIO.find(z => z.id === id); return t ? t.nombre : ""; };
  const comercios = con(fuentes.comercios, x => {
    const cats = [x.tipo].concat(x.tiposExtra || []);
    const texto = puntajeTexto([x.nombre, x.nombre, x.descripcion, x.direccion, x.ciudad].concat(cats.map(nombreCat)).join(" "), tokens, frase);
    const intencion = Math.max(0, ...cats.map(id => intC[id] || 0));
    return texto * 2 + intencion * 1.5 + (texto || intencion ? (x.nivel || 1) * 0.1 : 0);
  });
  const porId = {}; (fuentes.comercios || []).forEach(c => { porId[c.id] = c; });
  const productos = con(fuentes.productos, x => {
    const texto = puntajeTexto([x.nombre, x.nombre, x.descripcion].join(" "), tokens, frase);
    const c = porId[x.comercioId];
    const intencion = c ? Math.max(0, ...[c.tipo].concat(c.tiposExtra || []).map(id => intC[id] || 0)) : 0;
    return texto ? texto * 2 + intencion * 0.5 : 0;
  });
  return { ...a, anuncios, comercios, productos, total: anuncios.length + comercios.length + productos.length };
}

// ¿Este anuncio coincide con el texto? (para el filtro del inicio y de «Todos los anuncios»: más estricto,
// solo por sus palabras, sin intenciones, para no llenar la lista de cosas parecidas)
function todasLasPalabras(texto, tokens) {
  const palabras = normBusq(texto).split(" ");
  return tokens.every(q => palabras.some(w => coincidePalabra(q, w)));
}
function anuncioCoincide(a, texto) {
  const d = a.detalles || {};   // fase 2Z.7: también la marca, el modelo y «venta/arriendo»
  const campos = [a.nombre, a.desc, a.barrio, a.ciudad, nombreSubcategoria(a.categoria, a.subcategoria),
                  d.marca, d.modelo, d.operacion ? (typeof OPERACIONES !== "undefined" ? OPERACIONES[d.operacion] : d.operacion) : ""].join(" ");
  const tokens = tokensBusq(texto);
  if (!tokens.length) return normBusq(campos).includes(normBusq(texto));   // solo palabras cortas o vacías («venta»)
  return todasLasPalabras(campos, tokens);
}

// ¿Este comercio coincide? Por sus palabras O porque su categoría responde a lo buscado
// («postres» → pastelerías y panaderías aunque su nombre no diga «postres»).
let ultimoAnalisis = { q: null, ids: null };
function comercioCoincide(c, texto) {
  const nombreCat = id => { const t = TIPOS_COMERCIO.find(z => z.id === id); return t ? t.nombre : ""; };
  const cats = [c.tipo].concat(c.tiposExtra || []);
  const modo = typeof MODOS_ATENCION !== "undefined" && c.modoAtencion && c.modoAtencion !== "local" ? MODOS_ATENCION[c.modoAtencion].nombre + " " + MODOS_ATENCION[c.modoAtencion].corto : "";   // «desde casa», «domicilios»
  const campos = [c.nombre, c.direccion, c.ciudad, c.descripcion, modo].concat(cats.map(nombreCat)).join(" ");
  const tokens = tokensBusq(texto);
  if (!tokens.length) return normBusq(campos).includes(normBusq(texto));
  if (todasLasPalabras(campos, tokens)) return true;
  if (ultimoAnalisis.q !== texto) {
    ultimoAnalisis = { q: texto, ids: new Set(analizarBusqueda(texto).catsComercio.map(x => x.id)) };
  }
  return cats.some(id => ultimoAnalisis.ids.has(id));
}

// ---------- Registro de búsquedas (para «lo que la gente busca y no encuentra») ----------
// Solo se guarda el texto buscado y cuántos resultados hubo: nada de la persona (ver supabase/16_busquedas.sql).
function registrarBusqueda(q, resultados) {
  const t = normBusq(q).slice(0, 60);
  if (t.length < 2) return;
  try {
    const clave = "mf_busq_" + t;
    if (sessionStorage.getItem(clave)) return;      // la misma búsqueda una sola vez por visita
    sessionStorage.setItem(clave, "1");
  } catch (e) { /* sin almacenamiento: igual se registra */ }
  sb.rpc("registrar_busqueda", { p_termino: t, p_resultados: Math.min(9999, resultados | 0) }).then(() => {}, () => {});
}

// ---------- Sugerencias al escribir (lista desplegable bajo un buscador) ----------
// input: el <input>; fuentes(): devuelve { anuncios, comercios, productos } actuales.
function activarSugerencias(input, fuentes, opciones = {}) {
  const caja = document.createElement("div");
  caja.className = "sugerencias-busq hidden";
  caja.setAttribute("role", "listbox");
  input.parentElement.appendChild(caja);
  input.setAttribute("aria-autocomplete", "list");
  let activo = -1;
  // En «Buscar en todo» se busca ahí mismo (sin recargar); en las demás páginas se va a buscar.html
  const ir = q => { caja.classList.add("hidden"); input.blur(); if (opciones.alBuscar) opciones.alBuscar(q.trim()); else location.href = "buscar.html?q=" + encodeURIComponent(q.trim()); };
  const pintar = () => {
    const q = input.value.trim();
    // Sin foco (ya se buscó con Enter o 🔍) no se vuelve a abrir la lista
    if (q.length < 2 || document.activeElement !== input) { caja.classList.add("hidden"); return; }
    const r = buscarTodo(q, fuentes());
    const filas = [];
    r.catsComercio.slice(0, 3).forEach(c => {
      const n = (fuentes().comercios || []).filter(x => comercioEsTipo(x, c.id)).length;
      filas.push({ href: "comercios.html?tipo=" + encodeURIComponent(c.id), txt: `${c.icono} <b>${esc(c.nombre)}</b>`, sub: n ? n + (n === 1 ? " comercio" : " comercios") : "comercios" });
    });
    r.catsAnuncio.slice(0, 2).forEach(c => {
      const n = (fuentes().anuncios || []).filter(x => x.categoria === c.id).length;
      filas.push({ href: "anuncios.html?cat=" + encodeURIComponent(c.id), txt: `${c.icono} <b>${esc(c.nombre)}</b>`, sub: n ? n + (n === 1 ? " anuncio" : " anuncios") : "anuncios" });
    });
    r.comercios.slice(0, 2).forEach(c => filas.push({ href: "tienda.html?id=" + c.id, txt: `🏪 ${esc(c.nombre)}`, sub: c.ciudad || "" }));
    filas.push({ href: "buscar.html?q=" + encodeURIComponent(q), txt: `🔍 Ver todos los resultados de «<b>${esc(q)}</b>»`, sub: "", todo: true });
    activo = -1;
    caja.innerHTML = filas.map((f, i) => `<a href="${esc(f.href)}" role="option" data-i="${i}" class="sug-fila ${f.todo ? "sug-todo" : ""}"><span class="sug-txt">${f.txt}</span>${f.sub ? `<span class="sug-sub">${esc(f.sub)}</span>` : ""}</a>`).join("");
    caja.classList.remove("hidden");
  };
  const conRetraso = debounce(pintar, 180);
  input.addEventListener("input", conRetraso);
  input.addEventListener("focus", () => { if (input.value.trim().length >= 2) pintar(); });
  input.addEventListener("keydown", e => {
    const filas = [...caja.querySelectorAll(".sug-fila")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (caja.classList.contains("hidden") || !filas.length) return;
      e.preventDefault();
      activo = (activo + (e.key === "ArrowDown" ? 1 : -1) + filas.length) % filas.length;
      filas.forEach((f, i) => f.classList.toggle("sug-activa", i === activo));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activo >= 0 && filas[activo]) location.href = filas[activo].getAttribute("href");
      else if (input.value.trim()) ir(input.value);
    } else if (e.key === "Escape") caja.classList.add("hidden");
  });
  document.addEventListener("click", e => { if (!caja.contains(e.target) && e.target !== input) caja.classList.add("hidden"); });
  return { cerrar: () => caja.classList.add("hidden"), buscar: () => { if (input.value.trim()) ir(input.value); } };
}

// Conecta el buscador de arriba (#buscador) con el botón 🔍 (#btn-buscar) y las sugerencias.
// El texto sigue filtrando la lista de la página como siempre; Enter o 🔍 llevan a «buscar.html» (todo junto).
function conectarBuscadorGlobal(fuentes, opciones = {}) {
  const input = document.getElementById("buscador");
  if (!input) return;
  const s = activarSugerencias(input, fuentes, opciones);
  animarLetrero(input);   // «¿Qué buscas hoy? restaurantes…» (fase 2Y)
  const btn = document.getElementById("btn-buscar");
  if (btn) btn.addEventListener("click", () => {
    if (input.value.trim()) s.buscar();
    else { input.focus(); mostrarToast("Escribe qué buscas: un producto, un comercio o un servicio"); }
  });
}

// ---------- Letrero que va cambiando dentro del buscador (fase 2Y) ----------
// «¿Qué buscas hoy? restaurantes|» … se escribe y se borra solo. Las palabras salen de las categorías
// (las de comercios se editan en el panel, así crecen solas). Se detiene al tocar el buscador, si ya hay
// texto o si la persona pidió «reducir movimiento» (entonces queda un ejemplo fijo).
const PALABRAS_LETRERO_BASE = ["restaurantes", "comida rápida", "farmacias", "supermercados", "usados", "un carpintero", "panaderías", "celulares", "arriendos", "postres"];
function palabrasLetrero() {
  const extra = [];
  (typeof TIPOS_COMERCIO !== "undefined" ? TIPOS_COMERCIO : []).forEach(t => {
    if (t.activo !== false && t.id !== "otro" && t.nombre) extra.push(t.nombre.split(" y ")[0].toLowerCase());
  });
  (typeof CATEGORIAS !== "undefined" ? CATEGORIAS : []).forEach(c => { if (c.id !== "todos" && c.id !== "otros") extra.push(c.nombre.toLowerCase()); });
  const vistas = new Set();
  return PALABRAS_LETRERO_BASE.concat(extra.sort(() => Math.random() - 0.5)).filter(p => !vistas.has(p) && vistas.add(p)).slice(0, 18);
}

function animarLetrero(input, prefijo = "¿Qué buscas hoy? ") {
  if (!input) return;
  const fijo = prefijo + "restaurantes, farmacias, usados…";
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { input.placeholder = fijo; return; }
  let palabras = PALABRAS_LETRERO_BASE.slice(), i = 0, letras = 0, borrando = false, t = null;
  const pausado = () => document.activeElement === input || input.value || document.hidden;
  function paso() {
    if (pausado()) { input.placeholder = fijo; t = setTimeout(paso, 600); return; }
    const p = palabras[i % palabras.length];
    if (!borrando) {
      letras++;
      input.placeholder = prefijo + p.slice(0, letras);
      if (letras >= p.length) { borrando = true; t = setTimeout(paso, 1500); return; }
      t = setTimeout(paso, 75);
    } else {
      letras--;
      input.placeholder = prefijo + p.slice(0, Math.max(0, letras));
      if (letras <= 0) {
        borrando = false; i++;
        if (i % palabras.length === 0) palabras = palabrasLetrero();   // en cada vuelta toma las categorías ya cargadas
        t = setTimeout(paso, 300); return;
      }
      t = setTimeout(paso, 35);
    }
  }
  setTimeout(() => { palabras = palabrasLetrero(); paso(); }, 800);
  return () => clearTimeout(t);
}
