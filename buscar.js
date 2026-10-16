// ===== MercaFree · Página de resultados «Buscar en todo» (Fase 2W) =====
// buscar.html?q=postres[&ciudad=Envigado]
// Junta en una sola página: categorías sugeridas, publicaciones (anuncios), comercios y productos de vitrina.
// La relevancia la calcula buscador.js (sin tildes, plurales, errores de escritura e intenciones).

const POR_SECCION = { anuncios: 8, comercios: 6, productos: 8 };
let fuentesBusq = { anuncios: [], comercios: [], productos: [] };
let resultadoBusq = null;
const visibles = { ...POR_SECCION };

const qActual = () => (new URLSearchParams(location.search).get("q") || "").trim().slice(0, 80);
const ciudadActual = () => $("b-ciudad").value;

// ---------- Tarjetas compactas ----------
function tarjetaAnuncioBusq(a) {
  const foto = urlSegura(a.imagen);
  return `<a href="anuncio.html?id=${a.id}" class="b-tarjeta bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition overflow-hidden flex flex-col">
    <div class="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <span class="text-4xl">${iconosCategoria[a.categoria] || "📦"}</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      ${a.precio ? `<span class="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">${esc(a.precio)}</span>` : ""}
    </div>
    <div class="p-2.5">
      <h3 class="font-bold text-sm text-slate-900 line-clamp-2">${esc(a.nombre)}</h3>
      <p class="text-[11px] text-slate-500 mt-0.5">${esc(a.ciudad || a.barrio || "")}</p>
    </div>
  </a>`;
}

function tarjetaComercioBusq(c) {
  const sello = SELLOS[c.nivel] || SELLOS[1];
  const foto = urlSegura(c.foto);
  const abierto = estaAbierto(c.horario);
  return `<a href="tienda.html?id=${c.id}" class="b-tarjeta bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-3 flex gap-3 items-start">
    <div class="relative w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
      <span class="text-3xl">${esc(iconosComercio[c.tipo] || "🏪")}</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
    </div>
    <div class="min-w-0">
      <h3 class="font-bold text-slate-900 leading-tight">${esc(c.nombre)}</h3>
      <p class="text-xs text-slate-500">${esc(nombreCategorias(c))} · ${esc(c.ciudad)}</p>
      <p class="text-xs mt-0.5">${resumenCalifHTML(c)}</p>
      <div class="flex flex-wrap gap-1 mt-1">
        <span class="${sello.clase} text-[10px] font-semibold px-1.5 py-0.5 rounded-full">${c.nivel >= 2 ? "✔ " : ""}${esc(sello.corto)}</span>
        ${abierto === true ? '<span class="bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">🟢 Abierto</span>' : ""}
        ${c.nivel >= 2 && c.nProductos > 0 ? `<span class="bg-teal-50 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">🛍️ Vitrina (${c.nProductos})</span>` : ""}
      </div>
    </div>
  </a>`;
}

function tarjetaProductoBusq(p) {
  const c = fuentesBusq.comercios.find(x => x.id === p.comercioId);
  const foto = urlSegura(p.foto);
  return `<a href="tienda.html?id=${p.comercioId}&p=${p.id}#productos" class="b-tarjeta bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition overflow-hidden flex flex-col">
    <div class="relative aspect-square bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center">
      <span class="text-4xl">🛍️</span>
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
    </div>
    <div class="p-2.5">
      <h3 class="font-bold text-sm text-slate-900 line-clamp-2">${esc(p.nombre)}</h3>
      ${p.precio ? `<p class="text-sm font-black text-teal-700">${esc(formatearPrecio(p.precio))}</p>` : ""}
      ${c ? `<p class="text-[11px] text-slate-500 mt-0.5">🏪 ${esc(c.nombre)} · ${esc(c.ciudad)}</p>` : ""}
    </div>
  </a>`;
}

// ---------- Pintar ----------
function pintarSeccion(clave, lista, tarjeta, verTodo) {
  const sec = $("b-" + clave);
  sec.classList.toggle("hidden", !lista.length);
  if (!lista.length) return;
  sec.querySelector(".b-n").textContent = "(" + lista.length + ")";
  sec.querySelector(".b-lista").innerHTML = lista.slice(0, visibles[clave]).map(tarjeta).join("");
  const mas = sec.querySelector(".b-mas");
  const faltan = lista.length - visibles[clave];
  mas.classList.toggle("hidden", faltan <= 0);
  mas.textContent = `Ver ${Math.min(faltan, 24)} más`;
  const vt = sec.querySelector(".b-ver-todo");
  if (vt && verTodo) vt.href = verTodo;
}

function pintarResultados() {
  const q = qActual();
  $("buscador").value = q;
  document.title = (q ? q + " · " : "") + "Buscar | MercaFree";
  if (!q) {
    $("b-titulo").textContent = "Escribe arriba qué buscas: un producto, un comercio o un servicio.";
    ["anuncios", "comercios", "productos"].forEach(k => $("b-" + k).classList.add("hidden"));
    $("b-vacio").classList.add("hidden"); $("b-pestanas").classList.add("hidden"); $("b-intenciones").classList.add("hidden");
    return;
  }
  const ciudad = ciudadActual();
  const enCiudad = x => !ciudad || x.ciudad === ciudad;
  const comerciosCiudad = fuentesBusq.comercios.filter(enCiudad);
  const idsCom = new Set(comerciosCiudad.map(c => c.id));
  const r = buscarTodo(q, {
    anuncios: fuentesBusq.anuncios.filter(enCiudad),
    comercios: comerciosCiudad,
    productos: fuentesBusq.productos.filter(p => idsCom.has(p.comercioId))
  });
  resultadoBusq = r;

  // Chips de intención: a la categoría con los filtros del directorio o de anuncios
  const sufijoCiudad = ciudad ? "&ciudad=" + encodeURIComponent(ciudad) : "";
  const muni = ciudad ? (comerciosCiudad[0] || {}).municipioId : null;
  const chips = r.catsComercio.map(c => `<a class="b-chip" href="comercios.html?tipo=${encodeURIComponent(c.id)}${muni ? "&muni=" + muni : ""}">${esc(c.icono)} ${esc(c.nombre)}</a>`)
    .concat(r.catsAnuncio.map(c => `<a class="b-chip b-chip-anuncio" href="anuncios.html?cat=${encodeURIComponent(c.id)}${sufijoCiudad}">${esc(c.icono)} ${esc(c.nombre)} <small>anuncios</small></a>`));
  $("b-chips").innerHTML = chips.join("");
  $("b-intenciones").classList.toggle("hidden", !chips.length);

  const qs = encodeURIComponent(q);
  pintarSeccion("anuncios", r.anuncios, tarjetaAnuncioBusq, `anuncios.html?q=${qs}${sufijoCiudad}`);
  pintarSeccion("comercios", r.comercios, tarjetaComercioBusq, `comercios.html?q=${qs}${muni ? "&muni=" + muni : ""}`);
  pintarSeccion("productos", r.productos, tarjetaProductoBusq);

  const n = r.total;
  $("b-titulo").innerHTML = n
    ? `<b>${n}</b> ${n === 1 ? "resultado" : "resultados"} para «<b>${esc(q)}</b>»${ciudad ? " en " + esc(ciudad) : ""}`
    : `Sin resultados para «<b>${esc(q)}</b>»${ciudad ? " en " + esc(ciudad) : ""}`;
  const pest = [["anuncios", "📢 Publicaciones", r.anuncios.length], ["comercios", "🏪 Comercios", r.comercios.length], ["productos", "🛍️ Vitrinas", r.productos.length]]
    .filter(x => x[2]).map(([k, t, c]) => `<a href="#b-${k}" class="b-pestana">${t} <b>${c}</b></a>`);
  $("b-pestanas").innerHTML = pest.join("");
  $("b-pestanas").classList.toggle("hidden", pest.length < 2);
  $("b-vacio").classList.toggle("hidden", n > 0);
  $("b-vacio-q").textContent = q;
}

function llenarCiudades() {
  const cuenta = {};
  fuentesBusq.anuncios.concat(fuentesBusq.comercios).forEach(x => { if (x.ciudad) cuenta[x.ciudad] = (cuenta[x.ciudad] || 0) + 1; });
  const sel = $("b-ciudad");
  Object.keys(cuenta).sort((a, b) => a.localeCompare(b, "es")).forEach(c => sel.add(new Option(c, c)));
  const pedida = new URLSearchParams(location.search).get("ciudad");
  if (pedida && cuenta[pedida]) sel.value = pedida;
}

function actualizarEnlace() {
  const p = new URLSearchParams();
  if (qActual()) p.set("q", qActual());
  if (ciudadActual()) p.set("ciudad", ciudadActual());
  history.replaceState(null, "", "buscar.html" + (p.toString() ? "?" + p : ""));
}

document.addEventListener("DOMContentLoaded", async () => {
  conectarBuscadorGlobal(() => fuentesBusq);
  $("buscador").value = qActual();
  ["anuncios", "comercios", "productos"].forEach(k => {
    $("b-" + k).querySelector(".b-mas").addEventListener("click", () => { visibles[k] += 24; pintarResultados(); });
  });
  $("b-ciudad").addEventListener("change", () => { Object.assign(visibles, POR_SECCION); actualizarEnlace(); pintarResultados(); });

  try {
    await cargarMunicipios();
    const [, , productos] = await Promise.all([cargarAnuncios(), cargarComercios(), cargarProductosPublicos()]);
    // Solo productos de comercios visibles con vitrina activa (nivel 2+)
    const vitrinas = new Set(comercios.filter(c => c.nivel >= 2).map(c => c.id));
    fuentesBusq = { anuncios: baseDatosAnuncios, comercios, productos: productos.filter(p => vitrinas.has(p.comercioId)) };
  } catch (e) {
    console.error(e);
    mostrarToast("No pudimos cargar todo. Revisa tu conexión.", "error");
  }
  llenarCiudades();
  pintarResultados();
  if (qActual() && resultadoBusq) registrarBusqueda(qActual(), resultadoBusq.total);
});
