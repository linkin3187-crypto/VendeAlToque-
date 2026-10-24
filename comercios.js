// ===== Merkap - Directorio de comercios (comercios.html) =====
// Muestra TODOS los comercios activos (verificados y sin verificar). Cada tarjeta lleva su sello honesto:
// «Ubicado» (dato de mapa sin verificar), «Verificado por teléfono» o «Ubicación confirmada en persona».
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

// Fase V-2d: misma tarjeta «tipo app» del inicio (data.js), con TODOS los avisos de confianza del directorio.
// Llamar, Cómo llegar, Calificar, «Actualizar o retirar» y «Reportar» siguen ahí, en el menú «⋯».
function tarjetaComercio(c) {
  const km = ubicacionCo && tieneCoords(c) ? distanciaKm(ubicacionCo, c) : null;
  return tarjetaComercioTC(c, { distancia: km !== null ? textoDistanciaCo(km) : null, completa: true, reportarAqui: true });
}

// ---------- Filtros ----------
function leerFiltrosCo() {
  return {
    texto: normalizar($("co-buscar").value.trim()),
    depto: $("co-depto").value, muni: $("co-muni").value,
    nivel: $("co-nivel").value, calif: parseFloat($("co-calif").value) || 0,
    abierto: $("co-abierto").checked, vitrina: $("co-vitrina").checked, salud: $("co-salud").checked, promo: $("co-promo").checked,
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
    if (f.vitrina && !(vitrinaPublica(c) && c.nProductos > 0)) return false;
    if (f.salud && !muestraSelloSalud(c)) return false;   // fase 2AC.1
    if (f.promo && !(c.promos || []).length) return false;   // fase 2AP-4b
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
  // Fase 2AO: «Relevantes» con rotación justa del día (antes «Recomendados», con desempate por nombre)
  const variedad = tipoActivo === "todos";
  if (orden === "cercanos" && ubicacionCo) return lista.sort((x, y) => dist(x) - dist(y));
  // Fase 2AI (por defecto): abiertos → abren pronto → sin horario → cerrados; dentro de cada grupo, el orden relevante
  if (orden === "abiertos") {
    const l = lista.map(c => [grupoHorario(c), c]).sort((a, b) => (a[0] - b[0]) || compararRelevantes(a[1], b[1])).map(x => x[1]);
    return variedad ? conVariedad(l, c => grupoHorario(c) * 2 + (fichaIncompleta(c) ? 1 : 0)) : l;
  }
  if (orden === "calificacion") return lista.sort((x, y) => (puntajeCalif(y) - puntajeCalif(x)) || compararRelevantes(x, y));
  if (orden === "nombre") return lista.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  const l = lista.sort(compararRelevantes);
  return variedad ? conVariedad(l, c => (fichaIncompleta(c) ? 1 : 0)) : l;
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
  if (f.salud) p.set("salud", "1");
  if (f.promo) p.set("promo", "1");
  if (f.orden && f.orden !== "abiertos" && f.orden !== "cercanos") p.set("orden", f.orden);
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
  elegir("co-orden", p.get("orden") === "recomendados" ? "relevantes" : p.get("orden"));   // fase 2AO: enlaces viejos
  $("co-abierto").checked = p.get("abierto") === "1";
  $("co-vitrina").checked = p.get("vitrina") === "1";
  $("co-salud").checked = p.get("salud") === "1";
  $("co-promo").checked = p.get("promo") === "1";
  if (["nivel", "calif", "abierto", "vitrina", "salud", "promo"].some(k => p.get(k)) && $("co-panel").classList.contains("hidden")) $("co-btn-filtros").click();
}

function pintarListaCo() {
  const visibles = listaCo.slice(0, paginaCo * POR_PAGINA_CO);
  if ($("co-orden").value === "abiertos" && listaCo.length) {
    // Fase 2AI: títulos por grupo («🟢 Abiertos ahora (3)»…) y los cerrados un poco más tenues
    const grupos = listaCo.map(c => grupoHorario(c));
    const cuenta = [0, 1, 2, 3].map(g => grupos.filter(x => x === g).length);
    let previo = -1;
    $("co-lista").innerHTML = visibles.map((c, i) => {
      const g = grupos[i];
      const titulo = g !== previo ? `<h2 class="titulo-grupo-horario ${GRUPOS_HORARIO[g].clase}" data-grupo="${g}"><span>${GRUPOS_HORARIO[g].titulo} <span class="cuenta">(${cuenta[g]})</span></span></h2>` : "";
      previo = g;
      const t = tarjetaComercio(c);
      return titulo + (g === 3 ? t.replace('<article class="', '<article class="tarjeta-cerrada ') : t);
    }).join("");
  } else $("co-lista").innerHTML = visibles.map(tarjetaComercio).join("");
  const restantes = listaCo.length - visibles.length;
  $("co-mas").classList.toggle("hidden", restantes <= 0);
  if (restantes > 0) $("co-btn-mas").textContent = `Ver ${Math.min(POR_PAGINA_CO, restantes)} comercios más (${restantes} restantes)`;
}

function pintar() {
  $("co-borrar").classList.toggle("hidden", !$("co-buscar").value);   // ✕ solo si hay texto (fase 2AV)
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
  actualizarPildoraCo();   // fase 2AW.2
}

function limpiarCo() {
  $("co-buscar").value = "";
  $("co-depto").value = ""; llenarMunisCo("");
  ["co-nivel", "co-calif"].forEach(id => { $(id).value = ""; });
  $("co-orden").value = "abiertos";
  $("co-abierto").checked = false; $("co-vitrina").checked = false; $("co-salud").checked = false; $("co-promo").checked = false;
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
    if ($("co-orden").value === "cercanos") $("co-orden").value = "abiertos";
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
    if (navigator.share) { await navigator.share({ title: "Merkap", text: "Mira estos comercios en Merkap", url }); return; }
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
  $("sol-salud-campos").innerHTML = esComercioSalud(c) ? htmlDatosSanitarios("sol-ds", { tipo_establecimiento: c.tipo === "naturista" ? "naturista" : "drogueria" }) : "";
  $("sol-salud-beneficios").innerHTML = BENEFICIOS_SALUD;
  aplicarSaludSolicitud();
  abrirModal("modal-solicitud");
}

// Fase 2AB.2b: el bloque sanitario solo aparece al reclamar una droguería o naturista
const pideSaludSolicitud = () => !!comercioSolicitud && esComercioSalud(comercioSolicitud) && $("sol-tipo").value === "reclamar";
function aplicarSaludSolicitud() { $("sol-salud").classList.toggle("hidden", !pideSaludSolicitud()); }

async function enviarSolicitud(e) {
  e.preventDefault();
  if (!comercioSolicitud) return;
  let datosSanitarios = null;
  if (pideSaludSolicitud()) {
    const r = leerDatosSanitariosOpcional("sol-ds");
    if (r.error) { mostrarToast(r.error, "error"); return; }
    datosSanitarios = r.datos;
  }
  const btn = $("sol-enviar");
  btn.disabled = true;
  try {
    await crearSolicitudComercio(comercioSolicitud.id, {
      tipo: $("sol-tipo").value, nombre: $("sol-nombre").value.trim(),
      contacto: $("sol-contacto").value.trim(), mensaje: $("sol-mensaje").value.trim(), datosSanitarios
    });
    cerrarModal("modal-solicitud");
    mostrarToast("✅ Solicitud enviada. Te contactaremos pronto");
  } catch (err) {
    mostrarToast(mensajeError(err), "error");
  } finally { btn.disabled = false; }
}

// ---------- Buscador del directorio (fase 2AV) ----------
// A: frase que se escribe sola con los tipos de negocio que hay · B: 🔍, ✕ y ejemplos tocables ·
// C: al bajar por la lista el buscador queda pegado arriba de la pantalla.
function palabrasDirectorio() {
  const cuenta = {};
  comercios.forEach(c => { cuenta[c.tipo] = (cuenta[c.tipo] || 0) + 1; });
  const corta = t => t.nombre.split(" y ")[0].toLowerCase();
  const conDatos = TIPOS_COMERCIO.filter(t => cuenta[t.id]).sort((a, b) => cuenta[b.id] - cuenta[a.id]).map(corta);
  const resto = TIPOS_COMERCIO.filter(t => !cuenta[t.id] && t.id !== "otro").map(corta);
  const vistas = new Set();
  return conDatos.concat(resto).filter(p => p.length <= 16 && !vistas.has(p) && vistas.add(p)).slice(0, 12);
}
// Ejemplos que rotan según la hora (fase 2AX): espacio 1 = de la hora, 2 = de siempre, 3 = descubrimiento.
// Solo palabras que den resultados en la ciudad elegida y nunca de +18. Cambia una palabra cada 4 s.
const ejCo = { listas: [[], [], []], vistas: [null, null, null], turno: 0, clave: "", t: null };
function palabraEjemploValida(p, base) {
  if (esPalabraMas18(p)) return false;   // fase 2AY: por la palabra, no por el nombre de la categoría
  const q = normalizar(p);
  return base.some(c => !TIPOS_SIN_EJEMPLO.includes(c.tipo)
    && (typeof comercioCoincide === "function" ? comercioCoincide(c, q) : normalizar(c.nombre).includes(q)));
}
function claveEjemplosCo() { const t = ahoraBogota(); return franjaEjemplos().id + (t.finde ? "+finde" : "") + "|" + $("co-depto").value + "|" + $("co-muni").value; }
function prepararEjemplosCo() {
  const depto = $("co-depto").value, muni = $("co-muni").value;
  const base = comercios.filter(c => (!depto || c.departamento === depto) && (!muni || String(c.municipioId) === muni));
  const cache = {};
  const sirve = p => { const k = p.toLowerCase(); if (!(k in cache)) cache[k] = palabraEjemploValida(p, base); return cache[k]; };
  const barajar = l => l.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  ejCo.listas = listasEjemplos().map(l => barajar([...new Set(l)].filter(sirve)));
  const usadas = new Set();
  ejCo.vistas = ejCo.listas.map(l => { const p = l.find(x => !usadas.has(x.toLowerCase())); if (p) usadas.add(p.toLowerCase()); return p || null; });
  // Si un espacio quedó vacío (pocas tiendas en esa ciudad), se llena con lo que sobre de los otros
  const resto = ejCo.listas.flat().filter(x => !usadas.has(x.toLowerCase()));
  ejCo.vistas = ejCo.vistas.map(p => { if (p) return p; const r = resto.find(x => !usadas.has(x.toLowerCase())); if (r) usadas.add(r.toLowerCase()); return r || null; });
  ejCo.clave = claveEjemplosCo();
  pintarEjemplosCo();
}
function pintarEjemplosCo() {
  const v = ejCo.vistas.map((p, i) => (p ? `<button type="button" data-ej="${esc(p)}" data-slot="${i}">${esc(p)}</button>` : "")).filter(Boolean);
  $("co-ejemplos").innerHTML = v.length ? `<span class="busca-ejemplos-tit">Prueba:</span> ${v.join(' <span aria-hidden="true">·</span> ')}` : "";
  $("co-ejemplos").classList.toggle("hidden", !v.length);
}
function rotarEjemploCo() {
  const input = $("co-buscar");
  if (document.hidden || document.activeElement === input || input.value || !EJEMPLOS_BUSCADOR.rotar) return;
  if (claveEjemplosCo() !== ejCo.clave) { prepararEjemplosCo(); return; }   // cambió la franja (o la ciudad)
  for (let k = 0; k < 3; k++) {
    const i = (ejCo.turno + k) % 3;
    const enUso = new Set(ejCo.vistas.filter(Boolean).map(x => x.toLowerCase()));
    const l = ejCo.listas[i], actual = ejCo.vistas[i];
    if (!actual || l.length < 2) continue;
    const desde = l.indexOf(actual);
    let nueva = null;
    for (let n = 1; n <= l.length && !nueva; n++) { const c = l[(desde + n + l.length) % l.length]; if (!enUso.has(c.toLowerCase())) nueva = c; }
    if (!nueva) continue;
    ejCo.turno = (i + 1) % 3;
    ejCo.vistas[i] = nueva;
    const b = $("co-ejemplos").querySelector(`[data-slot="${i}"]`);
    if (!b) { pintarEjemplosCo(); return; }
    b.classList.remove("ej-entra"); b.classList.add("ej-sale");
    setTimeout(() => { b.textContent = nueva; b.dataset.ej = nueva; b.classList.remove("ej-sale"); b.classList.add("ej-entra"); }, 260);
    return;
  }
}
function arrancarEjemplosCo() {
  prepararEjemplosCo();
  clearInterval(ejCo.t);
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!quieto) ejCo.t = setInterval(rotarEjemploCo, 4000);
}
// Lleva la vista al comienzo de los resultados (debajo del buscador pegado, si lo está)
// siempre = true al tocar 🔍, Enter o un ejemplo: la persona debe VER que hubo resultados (fase 2AW.1)
function irAResultadosCo(siempre) {
  const fija = $("co-busca").classList.contains("fija");
  // Al bajar, el buscador queda pegado arriba: se deja su alto libre para que no tape el «N comercios»
  const alto = $("co-busca").offsetHeight + (fija ? 0 : 17) + 12;   // pegado suma 8 + 8 de margen y 1 de borde
  let y = Math.max(0, $("co-contador").getBoundingClientRect().top + scrollY - alto);
  // Con pocos resultados la página no alcanza a bajar tanto: se baja solo hasta dejar el buscador
  // entero arriba (sin cortarlo) y los resultados quedan a la vista debajo
  const max = document.documentElement.scrollHeight - innerHeight;
  if (y > max) y = Math.max(0, Math.min(max, $("co-busca-sitio").getBoundingClientRect().top + scrollY - 8));
  if (!(siempre || fija || y < scrollY)) return;
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: y, behavior: quieto ? "auto" : "smooth" });
  if (siempre) {   // el conteo brilla un momento: «aquí están tus resultados»
    const c = $("co-contador");
    c.classList.remove("co-contador-brillo"); void c.offsetWidth; c.classList.add("co-contador-brillo");
  }
}
// Vuelve a la caja de filtros (el buscador deja de estar pegado y quedan a la vista categorías, ciudad y orden)
function volverArribaCo() {
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const y = Math.max(0, $("co-busca-sitio").getBoundingClientRect().top + scrollY - 12);
  window.scrollTo({ top: y, behavior: quieto ? "auto" : "smooth" });
  setTimeout(actualizarPildoraCo, quieto ? 50 : 700);
}
// Píldora flotante «⬇ Ver N comercios»: sale si hay una búsqueda y los resultados están más abajo
function actualizarPildoraCo() {
  const b = $("co-ver-resultados");
  if (!b) return;
  const hay = !!$("co-buscar").value.trim() || tipoActivo !== "todos";
  // «Abajo» = del primer resultado se ve menos de ~1/3 (sobre la barra de abajo del celular)
  const primero = $("co-lista").querySelector("article") || $("co-vacio");
  const abajo = (primero.offsetParent ? primero : $("co-contador")).getBoundingClientRect().top > innerHeight - 260;
  const mostrar = hay && abajo && !$("co-busca").classList.contains("fija");
  if (mostrar) {
    const n = listaCo.length;
    b.textContent = n ? `⬇ Ver ${n} ${n === 1 ? "comercio" : "comercios"}` : "⬇ Sin resultados · ver opciones";
  }
  b.classList.toggle("hidden", !mostrar);
}
function conectarBuscadorCo() {
  const input = $("co-buscar"), sitio = $("co-busca-sitio"), barra = $("co-busca");
  if (typeof animarLetrero === "function") animarLetrero(input, "Busca ", { fuente: palabrasDirectorio, fijo: "Nombre, dirección o tipo" });
  arrancarEjemplosCo();
  ["co-depto", "co-muni"].forEach(id => $(id).addEventListener("change", prepararEjemplosCo));   // ejemplos de esa ciudad
  // Desde arriba: baja a los resultados. Desde el buscador pegado (abajo): vuelve arriba, a los filtros,
  // y la píldora «⬇ Ver N comercios» avisa que los resultados están debajo (fase 2AW.2)
  const buscarYa = () => {
    const desdeAbajo = barra.classList.contains("fija");
    input.blur(); pintar();
    if (desdeAbajo) volverArribaCo(); else irAResultadosCo(true);
  };
  $("co-ir").addEventListener("click", () => { if (input.value.trim()) buscarYa(); else input.focus(); });
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); buscarYa(); } });
  $("co-borrar").addEventListener("click", () => { input.value = ""; pintar(); input.focus(); });
  $("co-ejemplos").addEventListener("click", e => {
    const b = e.target.closest("[data-ej]");
    if (b) { input.value = b.dataset.ej; buscarYa(); }
  });
  // Pegado arriba: cuando el lugar del buscador sale por arriba de la pantalla
  let fija = false;
  const revisar = () => {
    const debe = sitio.getBoundingClientRect().bottom < 0;
    if (debe === fija) return;
    fija = debe;
    sitio.style.height = fija ? sitio.offsetHeight + "px" : "";   // guarda el hueco para que la página no salte
    barra.classList.toggle("fija", fija);
  };
  let pend = false;
  window.addEventListener("scroll", () => { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; revisar(); }); } }, { passive: true });
  // Si se escribe con el buscador pegado, la lista se acorta: volver al comienzo de los resultados
  input.addEventListener("input", debounce(() => { if (fija) volverArribaCo(); }, 300));
  $("co-ver-resultados").addEventListener("click", () => irAResultadosCo(true));
  window.addEventListener("scroll", debounce(actualizarPildoraCo, 120), { passive: true });
  window.addEventListener("resize", debounce(actualizarPildoraCo, 200));
  revisar();
  actualizarPildoraCo();
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await Promise.all([cargarComercios(), cargarSesion()]);
  pintarUbicacionesCo();
  $("sol-tipo").addEventListener("change", aplicarSaludSolicitud);
  const conRetraso = debounce(pintar, 250);
  $("co-buscar").addEventListener("input", conRetraso);
  $("co-depto").addEventListener("change", () => { llenarMunisCo(""); pintar(); });
  ["co-muni", "co-nivel", "co-calif", "co-abierto", "co-vitrina", "co-salud", "co-promo"].forEach(id => $(id).addEventListener("change", pintar));
  $("co-orden").addEventListener("change", async () => {
    if ($("co-orden").value === "cercanos" && !ubicacionCo) { $("co-orden").value = "abiertos"; await cercaDeMiCo(); return; }
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
    const fav = e.target.closest("[data-fav-com]");   // fase V-2d: ❤️
    if (fav) { e.preventDefault(); alternarCorazonComercio(Number(fav.dataset.favCom), fav); return; }
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
  cargarFavoritosComercio().then(refrescarCorazonesComercio);   // fase V-2d
  conectarBuscadorCo();
  if (pedido) abrirSolicitud(pedido, qs.get("tipo"));
  if (aReportar && !pedido) abrirReporteComercio(aReportar);
});
