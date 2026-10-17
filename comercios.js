// ===== MercaFree - Directorio de comercios (comercios.html) =====
// Muestra TODOS los comercios activos (verificados y sin verificar). Cada tarjeta lleva su sello honesto:
// «Ubicado» (dato de mapa sin verificar), «Verificado por teléfono» o «Verificado en persona».
// Los filtros quedan en el enlace (comercios.html?tipo=farmacia&muni=4) para compartir la búsqueda.

const POR_PAGINA_CO = 24;
let tipoActivo = "todos";
let ubicacionCo = null;   // {lat,lng} solo si el usuario toca «Comercios cerca de mí»
let listaCo = [];
let paginaCo = 1;

// ---------- Calificaciones (fase 2P · supabase/12_calificaciones.sql) ----------
// El promedio se muestra SIEMPRE (transparencia, como Google). Solo para ORDENAR se usa un promedio
// ponderado, para que 5,0 con 1 opinión no quede por encima de 4,8 con 40.
const MIN_VOTOS_PROMEDIO = 3;
function puntajeCalif(c) {
  // Promedio ponderado (bayesiano): 4,8 con 40 votos vale más que 5,0 con 1 voto
  const n = c.nCalif || 0;
  if (!n) return 0;
  const PREVIO = 3.5;
  return (PREVIO * MIN_VOTOS_PROMEDIO + (c.calif || 0) * n) / (MIN_VOTOS_PROMEDIO + n);
}
function califHTML(c) {
  return `<p class="text-xs mt-1">${resumenCalifHTML(c)}</p>`;
}

function textoDistanciaCo(km) {
  return km < 1 ? Math.max(10, Math.round(km * 100) * 10) + " m" : km.toFixed(1).replace(".", ",") + " km";
}

function tarjetaComercio(c) {
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  const foto = urlSegura(c.foto);
  const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
  const sello = SELLOS[c.nivel] || SELLOS[1];
  const abierto = estaAbierto(c.horario);
  const km = ubicacionCo && tieneCoords(c) ? distanciaKm(ubicacionCo, c) : null;
  return `<article class="relative bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition rounded-2xl shadow-sm overflow-hidden flex flex-col" data-comercio="${c.id}">
    <div class="h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative">
      <span class="text-5xl">${esc(t ? t.icono : "🏪")}</span>
      ${foto ? `<img src="${esc(foto)}" alt="Foto de ${esc(c.nombre)}" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      <span class="absolute top-2 left-2 ${sello.clase} text-[11px] font-semibold px-2 py-0.5 rounded-full">${c.nivel >= 2 ? "✔ " : ""}${esc(sello.corto)}</span>
      ${abierto === true ? '<span class="absolute top-2 right-2 bg-white/95 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full">🟢 Abierto ahora</span>' : ""}
      ${!c.ownerId ? `<button type="button" data-reclamar="${c.id}" class="badge-reclamar absolute bottom-2 left-2 z-10" title="¿Eres el dueño? Reclama esta ficha gratis para administrarla">🔑 ¿Es tu negocio? Reclámalo</button>` : ""}
    </div>
    <div class="p-4 flex-1 flex flex-col">
      <h2 class="font-bold text-lg leading-tight"><a href="tienda.html?id=${c.id}" class="after:absolute after:inset-0 after:content-[''] hover:text-indigo-700">${esc(c.nombre)}</a></h2>
      <p class="text-xs text-slate-500">${esc(nombreCategorias(c))} · ${esc(c.ciudad)}</p>
      ${km !== null ? `<p class="text-xs font-bold text-indigo-700 mt-0.5">📏 A ${textoDistanciaCo(km)} de ti</p>` : ""}
      ${califHTML(c)}
      ${c.nivel >= 2 && c.verificadoEn ? `<p class="text-[11px] text-slate-400 mt-0.5">${esc(sello.corto)} el ${esc(fechaSello(c))}${selloVencido(c) ? " · en revisión" : ""}</p>` : ""}
      ${c.nivel < 2 ? '<p class="text-[11px] text-amber-700 mt-0.5">⚠️ Aún sin verificar que exista aquí: confirma antes de ir</p>' : ""}
      ${esUbicacionAprox(c) ? `<p class="mt-2"><span class="badge-modo ${c.modoAtencion}">${MODOS_ATENCION[c.modoAtencion].icono} ${esc(MODOS_ATENCION[c.modoAtencion].corto)}</span> <span class="text-[11px] text-slate-500">zona aproximada</span></p>` : c.direccion ? `<p class="text-sm text-slate-600 mt-2">📍 ${esc(c.direccion)}</p>` : ""}
      ${c.horario ? `<p class="text-sm text-slate-600">🕒 ${esc(c.horario)}</p>` : ""}
      ${c.telefono ? `<p class="text-sm text-slate-600">📞 ${esc(c.telefono)}</p>` : ""}
      <p class="text-[11px] text-indigo-600 font-semibold mt-2">👆 Toca para ver el comercio completo${c.nivel >= 2 && c.nProductos > 0 ? ", sus productos y promociones" : ""}</p>
      <div class="flex flex-wrap gap-2 mt-auto pt-3 relative z-10">
        ${tel ? `<a href="tel:${esc(tel)}" class="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">📞 Llamar</a>` : ""}
        ${c.nProductos > 0 && c.nivel >= 2 ? `<a href="tienda.html?id=${c.id}" class="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-3 py-2 rounded-lg">🛍️ Ver tienda (${c.nProductos})</a>` : ""}
        ${esUbicacionAprox(c) && c.whatsapp ? `<a href="${esc(urlWhatsAppTexto(c.whatsapp, `Hola, vi «${c.nombre}» en MercaFree.`))}" target="_blank" rel="noopener" class="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-lg">💬 Pedir por WhatsApp</a>` : ""}
        ${tieneCoords(c) && !esUbicacionAprox(c) ? `<a href="${esc(urlGoogleMaps(c.lat, c.lng))}" data-como-llegar data-lat="${c.lat}" data-lng="${c.lng}" data-nombre="${esc(c.nombre)}" data-ciudad="${esc(c.ciudad || "")}" target="_blank" rel="noopener" class="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">🗺️ Cómo llegar</a>` : ""}
      </div>
      <a href="tienda.html?id=${c.id}#opinar" class="relative z-10 mt-2 inline-flex w-fit items-center gap-1 text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg">⭐ Calificar</a>
      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 relative z-10">
        <button type="button" data-solicitar="${c.id}" class="text-xs text-slate-500 hover:text-indigo-600 underline text-left">✏️ ¿Es tu negocio? Actualizar o retirar</button>
        <button type="button" data-reportar-com="${c.id}" class="text-xs text-slate-500 hover:text-red-600 underline text-left">⚠️ Reportar este negocio</button>
      </div>
    </div>
  </article>`;
}

// ---------- Filtros ----------
function leerFiltrosCo() {
  return {
    texto: normalizar($("co-buscar").value.trim()),
    depto: $("co-depto").value, muni: $("co-muni").value,
    nivel: $("co-nivel").value, calif: parseFloat($("co-calif").value) || 0,
    abierto: $("co-abierto").checked, vitrina: $("co-vitrina").checked,
    orden: $("co-orden").value
  };
}

// Todo menos la categoría (para contar cuántos hay en cada categoría)
function baseCo(f) {
  return comercios.filter(c => {
    if (f.depto && c.departamento !== f.depto) return false;
    if (f.muni && String(c.municipioId) !== f.muni) return false;
    if (f.nivel === "1" && c.nivel !== 1) return false;
    if ((f.nivel === "2" || f.nivel === "3") && c.nivel < Number(f.nivel)) return false;
    if (f.calif && !((c.nCalif || 0) > 0 && (c.calif || 0) >= f.calif)) return false;
    if (f.abierto && estaAbierto(c.horario) !== true) return false;
    if (f.vitrina && !(c.nivel >= 2 && c.nProductos > 0)) return false;
    if (f.texto) {
      // Buscador inteligente (buscador.js): «postres» también encuentra pastelerías y panaderías
      if (typeof comercioCoincide === "function") { if (!comercioCoincide(c, f.texto)) return false; }
      else {
        const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
        if (!normalizar([c.nombre, c.direccion, c.ciudad, c.descripcion, t ? t.nombre : ""].join(" ")).includes(f.texto)) return false;
      }
    }
    return true;
  });
}

function ordenarCo(lista, orden) {
  const dist = c => (ubicacionCo && tieneCoords(c)) ? distanciaKm(ubicacionCo, c) : Infinity;
  const recomendados = (x, y) => (y.nivel - x.nivel) || (y.nProductos - x.nProductos) || x.nombre.localeCompare(y.nombre, "es");
  if (orden === "cercanos" && ubicacionCo) return lista.sort((x, y) => dist(x) - dist(y));
  if (orden === "calificacion") return lista.sort((x, y) => (puntajeCalif(y) - puntajeCalif(x)) || recomendados(x, y));
  if (orden === "nombre") return lista.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  return lista.sort(recomendados);
}

// Departamentos y municipios: solo los que tienen comercios, con cuántos hay
function pintarUbicacionesCo() {
  const selD = $("co-depto"), selM = $("co-muni");
  const deptoAct = selD.value, muniAct = selM.value;
  const deptos = {};
  comercios.forEach(c => { if (c.departamento) deptos[c.departamento] = (deptos[c.departamento] || 0) + 1; });
  selD.innerHTML = '<option value="">Todos</option>' + Object.keys(deptos).sort((x, y) => x.localeCompare(y, "es"))
    .map(d => `<option value="${esc(d)}">${esc(d)} (${deptos[d]})</option>`).join("");
  selD.value = deptos[deptoAct] ? deptoAct : "";
  llenarMunisCo(muniAct);
}
function llenarMunisCo(muniAct) {
  const depto = $("co-depto").value;
  const munis = {};
  comercios.forEach(c => {
    if (depto && c.departamento !== depto) return;
    const k = String(c.municipioId);
    munis[k] = munis[k] || { nombre: c.ciudad, n: 0 };
    munis[k].n++;
  });
  $("co-muni").innerHTML = '<option value="">Todas las ciudades</option>' + Object.keys(munis)
    .sort((x, y) => munis[x].nombre.localeCompare(munis[y].nombre, "es"))
    .map(id => `<option value="${esc(id)}">${esc(munis[id].nombre)} (${munis[id].n})</option>`).join("");
  $("co-muni").value = munis[muniAct] ? muniAct : "";
}

function pintarTiposCo(base) {
  const cuenta = {};
  base.forEach(c => { [c.tipo].concat(c.tiposExtra || []).forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; }); });
  if (tipoActivo !== "todos" && !TIPOS_COMERCIO.some(t => t.id === tipoActivo)) tipoActivo = "todos";
  const chip = (id, txt, n) => `<button type="button" role="tab" data-tipo="${id}" aria-selected="${tipoActivo === id}" class="co-chip shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold border ${tipoActivo === id ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 bg-white text-slate-600"}">${txt} <span class="${tipoActivo === id ? "text-indigo-200" : "text-slate-400"}">${n}</span></button>`;
  $("co-tipos").innerHTML = chip("todos", "Todos", base.length)
    + TIPOS_COMERCIO.filter(t => cuenta[t.id] || t.id === tipoActivo).map(t => chip(t.id, `${t.icono} ${esc(t.nombre)}`, cuenta[t.id] || 0)).join("");
}

function filtrosAQueryCo() {
  const f = leerFiltrosCo();
  const p = new URLSearchParams();
  const q = $("co-buscar").value.trim();
  if (q) p.set("q", q);
  if (tipoActivo !== "todos") p.set("tipo", tipoActivo);
  if (f.depto) p.set("depto", f.depto);
  if (f.muni) p.set("muni", f.muni);
  if (f.nivel) p.set("nivel", f.nivel);
  if (f.calif) p.set("calif", f.calif);
  if (f.abierto) p.set("abierto", "1");
  if (f.vitrina) p.set("vitrina", "1");
  if (f.orden && f.orden !== "recomendados" && f.orden !== "cercanos") p.set("orden", f.orden);
  return p.toString();
}

function aplicarQueryCo(qs) {
  const p = new URLSearchParams(qs);
  const elegir = (id, v) => { if (v && [...$(id).options].some(o => o.value === v && !o.disabled)) $(id).value = v; };
  if (p.get("q")) $("co-buscar").value = p.get("q").slice(0, 60);
  if (TIPOS_COMERCIO.some(t => t.id === p.get("tipo"))) tipoActivo = p.get("tipo");
  elegir("co-depto", p.get("depto"));
  llenarMunisCo("");
  elegir("co-muni", p.get("muni"));
  elegir("co-nivel", p.get("nivel"));
  elegir("co-calif", p.get("calif"));
  elegir("co-orden", p.get("orden"));
  $("co-abierto").checked = p.get("abierto") === "1";
  $("co-vitrina").checked = p.get("vitrina") === "1";
  if (["nivel", "calif", "abierto", "vitrina"].some(k => p.get(k)) && $("co-panel").classList.contains("hidden")) $("co-btn-filtros").click();
}

function pintarListaCo() {
  const visibles = listaCo.slice(0, paginaCo * POR_PAGINA_CO);
  $("co-lista").innerHTML = visibles.map(tarjetaComercio).join("");
  const restantes = listaCo.length - visibles.length;
  $("co-mas").classList.toggle("hidden", restantes <= 0);
  if (restantes > 0) $("co-btn-mas").textContent = `Ver ${Math.min(POR_PAGINA_CO, restantes)} comercios más (${restantes} restantes)`;
}

function pintar() {
  const f = leerFiltrosCo();
  const base = baseCo(f);
  pintarTiposCo(base);
  listaCo = ordenarCo(base.filter(c => tipoActivo === "todos" || comercioEsTipo(c, tipoActivo)), f.orden);
  paginaCo = 1;
  pintarListaCo();
  $("co-contador").textContent = listaCo.length + (listaCo.length === 1 ? " comercio" : " comercios");
  $("co-vacio").classList.toggle("hidden", listaCo.length > 0);
  $("co-vacio-txt").textContent = comercios.length
    ? "No hay comercios con estos filtros."
    : "Estamos agregando y verificando comercios de tu zona. ¡Vuelve pronto!";
  $("co-vacio-limpiar").classList.toggle("hidden", !comercios.length);
  const qs = filtrosAQueryCo();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

function limpiarCo() {
  $("co-buscar").value = "";
  $("co-depto").value = ""; llenarMunisCo("");
  ["co-nivel", "co-calif"].forEach(id => { $(id).value = ""; });
  $("co-orden").value = "recomendados";
  $("co-abierto").checked = false; $("co-vitrina").checked = false;
  tipoActivo = "todos";
  ubicacionCo = null;
  $("co-cerca").setAttribute("aria-pressed", "false");
  $("co-nota-cerca").classList.add("hidden");
  pintar();
}

async function cercaDeMiCo() {
  const b = $("co-cerca");
  if (b.getAttribute("aria-pressed") === "true") {
    ubicacionCo = null; b.setAttribute("aria-pressed", "false");
    if ($("co-orden").value === "cercanos") $("co-orden").value = "recomendados";
    $("co-nota-cerca").classList.add("hidden");
    pintar(); return;
  }
  b.disabled = true; b.textContent = "📡 Buscando tu ubicación…";
  try {
    ubicacionCo = await obtenerGPS();
    // Para ver los más cercanos de toda la zona se quita el filtro de departamento/municipio
    $("co-depto").value = ""; llenarMunisCo("");
    $("co-orden").value = "cercanos";
    b.setAttribute("aria-pressed", "true");
    $("co-nota-cerca").textContent = "📍 Mostrando primero los más cercanos a ti, con la distancia. Toca de nuevo para quitarlo.";
    $("co-nota-cerca").classList.remove("hidden");
    pintar();
  } catch (err) {
    mostrarToast(textoErrorGPS(err), "error");
  } finally {
    b.disabled = false; b.textContent = "📡 Comercios cerca de mí";
  }
}

async function compartirBusquedaCo() {
  const url = location.href;
  try {
    if (navigator.share) { await navigator.share({ title: "MercaFree", text: "Mira estos comercios en MercaFree", url }); return; }
    await navigator.clipboard.writeText(url);
    mostrarToast("🔗 Enlace copiado: pégalo en WhatsApp");
  } catch (err) {
    if (err && err.name === "AbortError") return;
    prompt("Copia este enlace:", url);
  }
}

// ---------- Solicitud del dueño ----------
let comercioSolicitud = null;

function abrirSolicitud(id, tipo) {
  const c = comercios.find(x => x.id === id);
  if (!c) return;
  if (!usuarioActual) {
    mostrarToast("Inicia sesión para enviar la solicitud", "error");
    setTimeout(() => { location.href = "index.html#login"; }, 1200);
    return;
  }
  comercioSolicitud = c;
  $("sol-comercio").textContent = c.nombre + " · " + c.ciudad;
  $("sol-nombre").value = usuarioActual.nombre || "";
  $("sol-contacto").value = ""; $("sol-mensaje").value = ""; $("sol-tipo").value = ["reclamar", "retirar"].includes(tipo) ? tipo : "actualizar";
  abrirModal("modal-solicitud");
}

async function enviarSolicitud(e) {
  e.preventDefault();
  if (!comercioSolicitud) return;
  const btn = $("sol-enviar");
  btn.disabled = true;
  try {
    await crearSolicitudComercio(comercioSolicitud.id, {
      tipo: $("sol-tipo").value, nombre: $("sol-nombre").value.trim(),
      contacto: $("sol-contacto").value.trim(), mensaje: $("sol-mensaje").value.trim()
    });
    cerrarModal("modal-solicitud");
    mostrarToast("✅ Solicitud enviada. Te contactaremos pronto");
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
  } finally { btn.disabled = false; }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await Promise.all([cargarComercios(), cargarSesion()]);
  pintarUbicacionesCo();
  const conRetraso = debounce(pintar, 250);
  $("co-buscar").addEventListener("input", conRetraso);
  $("co-depto").addEventListener("change", () => { llenarMunisCo(""); pintar(); });
  ["co-muni", "co-nivel", "co-calif", "co-abierto", "co-vitrina"].forEach(id => $(id).addEventListener("change", pintar));
  $("co-orden").addEventListener("change", async () => {
    if ($("co-orden").value === "cercanos" && !ubicacionCo) { $("co-orden").value = "recomendados"; await cercaDeMiCo(); return; }
    pintar();
  });
  $("co-tipos").addEventListener("click", e => {
    const b = e.target.closest("[data-tipo]");
    if (!b) return;
    tipoActivo = b.dataset.tipo; pintar();
  });
  $("co-btn-filtros").addEventListener("click", () => {
    const abierto = $("co-panel").classList.toggle("hidden") === false;
    $("co-flecha").textContent = abierto ? "▴" : "▾";
    $("co-btn-filtros").setAttribute("aria-expanded", abierto ? "true" : "false");
  });
  $("co-limpiar").addEventListener("click", limpiarCo);
  $("co-vacio-limpiar").addEventListener("click", limpiarCo);
  $("co-cerca").addEventListener("click", cercaDeMiCo);
  $("co-compartir").addEventListener("click", compartirBusquedaCo);
  const masUno = () => { if (paginaCo * POR_PAGINA_CO < listaCo.length) { paginaCo++; pintarListaCo(); } };
  $("co-btn-mas").addEventListener("click", masUno);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(ent => { if (ent.some(x => x.isIntersecting) && listaCo.length) masUno(); }, { rootMargin: "400px" }).observe($("co-centinela"));
  }
  $("co-lista").addEventListener("click", e => {
    const b = e.target.closest("[data-solicitar]");
    if (b) abrirSolicitud(Number(b.dataset.solicitar));
    const rc = e.target.closest("[data-reclamar]");
    if (rc) abrirSolicitud(Number(rc.dataset.reclamar), "reclamar");
    const r = e.target.closest("[data-reportar-com]");
    if (r) { const c = comercios.find(x => x.id === Number(r.dataset.reportarCom)); if (c) abrirReporteComercio(c); }
  });
  $("co-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("form-solicitud").addEventListener("submit", enviarSolicitud);
  // Enlaces desde el mapa: comercios.html?solicitar=ID o ?reportar=ID abren el formulario de ese comercio
  const qs = new URLSearchParams(location.search);
  aplicarQueryCo(location.search);   // filtros que vienen en el enlace (después de conectar los botones)
  const pedido = parseInt(qs.get("solicitar"), 10);
  const aReportar = comercios.find(x => x.id === parseInt(qs.get("reportar"), 10));
  pintar();
  if (pedido) abrirSolicitud(pedido, qs.get("tipo"));
  if (aReportar && !pedido) abrirReporteComercio(aReportar);
});
