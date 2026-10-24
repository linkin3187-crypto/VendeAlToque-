// ===== Merkap - Panel del dueño del comercio (mi-tienda.html) =====
// El dueño solo puede cambiar descripción, WhatsApp, teléfono, horario, foto y entrega, y gestionar sus productos (10 gratis; fase 2AG).
// Las reglas las impone la base de datos (RLS y triggers); esta pantalla solo las hace cómodas.

let misComercios = [];
let actual = null;
let productosMios = [];
// Fase 2AG: el cupo es de cada tienda (10 gratis); lo hace cumplir el servidor (trigger productos_limite, SQL 36)
const maxProductos = () => (actual && actual.limiteProductos) || LIMITE_PRODUCTOS_GRATIS;

let galeria = null;
let logoGestor = null;   // fase V-2c
let datosSalud = null;   // fase 2AB.1: datos sanitarios del comercio actual (o null)
const soloDigitos = s => String(s || "").replace(/\D/g, "");

function pintarCabecera() {
  $("mt-nombre").textContent = actual.nombre;
  const s = SELLOS[actual.nivel] || SELLOS[1];
  $("mt-sello").className = "text-xs font-semibold px-2 py-0.5 rounded-full " + s.clase;
  $("mt-sello").textContent = (actual.nivel >= 2 ? "✔ " : "") + s.corto;
  const bs = $("mt-badge-salud"); if (bs) bs.remove();
  if (muestraSelloSalud(actual)) $("mt-sello").insertAdjacentHTML("afterend", '<span id="mt-badge-salud"> ' + BADGE_SALUD + "</span>");
  const e = $("mt-estado");
  const publica = actual.activo && actual.nivel >= 2;
  e.className = "text-sm rounded-lg px-3 py-2 mt-2 " + (publica ? "bg-green-50 text-green-900 border border-green-200" : "bg-amber-50 text-amber-900 border border-amber-200");
  // Fase 2Z.9: «Ubicado» SÍ aparece en el mapa y el directorio (igual que los importados); lo que espera la verificación son los productos
  e.innerHTML = publica ? "✅ Tu tienda es pública. Los clientes pueden verla y pedirte por WhatsApp."
      + (saludPendiente(actual) ? " Cuando Merkap revise tus <b>datos sanitarios</b>, tu ficha verificada mostrará el distintivo «🧾 NIT y director técnico declarados»." : "")
    : !actual.activo ? "🙈 Tu negocio está oculto en el mapa. Escríbenos si crees que es un error."
    : "📍 <b>Tu negocio YA aparece en el mapa y en el directorio</b>, con la etiqueta «Ubicado». Lo que aún no ven los clientes son <b>tus productos</b>: tu vitrina se publica cuando Merkap confirme tu negocio por WhatsApp o llamada (sello «Verificado»). Mientras tanto, prepara tus productos.";
  // Fase 2AO-E: qué le falta a la ficha para salir más arriba (sin pagar)
  let fi = $("mt-ficha");
  if (!fi) { e.insertAdjacentHTML("afterend", '<p id="mt-ficha" class="mt-ficha" role="status"></p>'); fi = $("mt-ficha"); }
  const falta = faltantesFicha(actual);
  fi.classList.toggle("completa", !falta.length);
  fi.innerHTML = !actual.activo ? "" : falta.length
    ? `📈 <b>Completa tu ficha para salir más arriba</b> en el directorio y el inicio: te falta ${esc(falta.length > 1 ? falta.slice(0, -1).join(", ") + " y " + falta[falta.length - 1] : falta[0])}.`
    : "⭐ <b>Tu ficha está completa.</b> Sales en el grupo de arriba; entre tiendas parecidas el orden cambia cada día para que todas tengan su turno.";
  fi.classList.toggle("hidden", !actual.activo);
  $("mt-ver").href = "tienda.html?id=" + actual.id;
  // Fase 2AP-3: «📣 Comparte tu tienda» (si está activa en el mapa)
  $("mt-compartir").classList.toggle("hidden", !actual.activo);
  $("mt-compartir-nota").classList.toggle("hidden", !actual.activo);
  pintarAcelerar($("mt-acelerar"), actual);   // fase 2Z.10: «⚡ Acelerar mi verificación» (solo si está «Ubicado»)
}

function pintarDatos() {
  $("mt-tipo").innerHTML = opcionesCategoria(actual.tipo);
  $("mt-extra1").innerHTML = opcionesCategoria((actual.tiposExtra || [])[0] || "", "— Ninguna —");
  $("mt-extra2").innerHTML = opcionesCategoria((actual.tiposExtra || [])[1] || "", "— Ninguna —");
  $("mt-sol-actualizar").href = "comercios.html?solicitar=" + actual.id + "&tipo=actualizar";
  $("mt-sol-retirar").href = "comercios.html?solicitar=" + actual.id + "&tipo=retirar";
  $("mt-desc").value = actual.descripcion;
  $("mt-wa").value = actual.whatsapp.replace(/^57/, "");
  $("mt-tel").value = actual.telefono;
  $("mt-hor").value = actual.horario;
  revisarHorario();
  document.querySelectorAll('input[name="mt-modo"]').forEach(r => { r.checked = r.value === (actual.modoAtencion || "local"); });
  $("mt-modo-aviso").classList.add("hidden");
  $("mt-recoge").checked = actual.recoge;
  $("mt-dom").checked = actual.domicilio;
  $("mt-dom-info").value = actual.domicilioInfo;
  galeria = gestorFotos($("mt-galeria"), actual.fotos);   // fase 2AA.4
  logoGestor = gestorFotos($("mt-logo"), actual.logo ? [actual.logo] : [], null, 1, { sinPortada: true, nota: NOTA_LOGO });   // fase V-2c
}

async function guardarNegocio(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const wa = soloDigitos($("mt-wa").value);
  if (wa && wa.length !== 10) { mostrarToast("El WhatsApp debe tener 10 dígitos (ej. 300 123 4567)", "error"); return; }
  const nul = v => v.trim() || null;
  btn.disabled = true;
  try {
    const cambios = {
      descripcion: nul($("mt-desc").value), whatsapp: wa ? "57" + wa : null, telefono: nul($("mt-tel").value),
      horario: nul($("mt-hor").value), recoge: $("mt-recoge").checked, domicilio: $("mt-dom").checked,
      domicilio_info: $("mt-dom").checked ? nul($("mt-dom-info").value) : null
    };
    // Cómo atiende (SQL 24): solo se envía si es distinto de «local» o si cambió
    const modo = (document.querySelector('input[name="mt-modo"]:checked') || {}).value || "local";
    if (modo !== (actual.modoAtencion || "local")) cambios.modo_atencion = modo;
    // Categorías: solo se envían si existe la tabla nueva (SQL 15); si no, el resto se guarda igual
    if (TIPOS_COMERCIO.some(t => t.palabras)) {
      cambios.tipo = $("mt-tipo").value;
      cambios.tipos_extra = [...new Set([$("mt-extra1").value, $("mt-extra2").value].filter(v => v && v !== cambios.tipo))];
    }
    if (galeria && galeria.cambiado) {
      const urls = await galeria.subir();
      if (actual.tieneColumnaFotos) cambios.fotos = urls; else cambios.foto_url = urls[0] || null;
    }
    if (logoGestor && logoGestor.cambiado) {   // fase V-2c (SQL 49)
      if (!actual.tieneColumnaLogo) throw new Error("Para guardar el logo falta ejecutar supabase/49_logo_comercio.sql");
      cambios.logo_url = (await logoGestor.subir())[0] || null;
    }
    actual = await guardarMiComercio(actual.id, cambios);
    misComercios = misComercios.map(c => c.id === actual.id ? actual : c);
    pintarDatos();
    await pintarSalud(); pintarProductosMios();
    mostrarToast("✅ Datos guardados");
  } catch (err) {
    console.error(err);
    mostrarToast(mensajeError(err), "error");
  } finally { btn.disabled = false; }
}

// ---------- Productos ----------
function filaProducto(p) {
  const nuevo = !p;
  p = p || { id: "", nombre: "", descripcion: "", precio: null, foto: "", disponible: true, oculto: false };
  return `<article class="border border-slate-200 rounded-xl p-3 ${p.oculto ? "bg-red-50" : ""}" data-pid="${p.id}">
    ${p.oculto ? '<p class="text-xs text-red-700 font-semibold mb-2">🚫 Un moderador ocultó este producto. Revisa las reglas o escríbenos.</p>' : ""}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <label class="text-xs font-bold text-slate-500 sm:col-span-2">Nombre
        <input data-k="nombre" maxlength="80" value="${esc(p.nombre)}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>
      <label class="text-xs font-bold text-slate-500">Precio (COP, opcional)
        <input data-k="precio" inputmode="numeric" value="${p.precio != null ? p.precio : ""}" placeholder="8500" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>
      <label class="text-xs font-bold text-slate-500 sm:col-span-3">Descripción (opcional)
        <input data-k="descripcion" maxlength="200" value="${esc(p.descripcion)}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>
      <div class="text-xs font-bold text-slate-500 sm:col-span-3">📷 Fotos del producto <span class="font-normal">(hasta 3; la primera es la principal)</span>
        <div data-gal-prod class="mt-1 font-normal"></div></div>
    </div>
    <div class="flex flex-wrap items-center gap-3 mt-2 text-sm">
      <label class="flex items-center gap-1.5"><input type="checkbox" data-k="disponible" ${p.disponible ? "checked" : ""}> Disponible</label>
      <button type="button" data-acc="guardar" class="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm disabled:opacity-60">${nuevo ? "Agregar" : "Guardar"}</button>
      ${nuevo ? '<button type="button" data-acc="cancelar" class="text-xs text-slate-500 hover:underline">Cancelar</button>'
              : '<button type="button" data-acc="borrar" class="text-red-600 hover:underline text-xs">Borrar</button>'}
    </div>
  </article>`;
}

// Fase 2AA.5: cada producto tiene su gestor de fotos (hasta 3)
const galeriasProd = new WeakMap();
function iniciarGaleriasProductos() {
  document.querySelectorAll("#mt-productos [data-pid]").forEach(fila => {
    if (galeriasProd.has(fila)) return;
    const p = productosMios.find(x => String(x.id) === fila.dataset.pid);
    galeriasProd.set(fila, gestorFotos(fila.querySelector("[data-gal-prod]"), p ? p.fotos : [], null, 3));
  });
}
function pintarProductosMios() {
  $("mt-productos").innerHTML = productosMios.map(filaProducto).join("");
  iniciarGaleriasProductos();
  $("mt-vacio").classList.toggle("hidden", productosMios.length > 0);
  $("mt-cuenta").textContent = `(${productosMios.length} de ${maxProductos()})`;
  $("mt-agregar").disabled = productosMios.length >= maxProductos();
  if ($("mt-cupo")) $("mt-cupo").textContent = maxProductos();   // fase 2AC.1: los datos sanitarios ya no frenan
}

async function accionProducto(e) {
  const b = e.target.closest("[data-acc]");
  const fila = e.target.closest("[data-pid]");
  if (!b || !fila) return;
  if (b.dataset.acc === "cancelar") { fila.remove(); return; }
  const pid = fila.dataset.pid ? Number(fila.dataset.pid) : null;
  b.disabled = true;
  try {
    if (b.dataset.acc === "borrar") {
      if (!confirm("¿Borrar este producto?")) { b.disabled = false; return; }
      await eliminarProducto(pid);
      mostrarToast("🗑️ Producto borrado");
    } else {
      const v = k => fila.querySelector(`[data-k="${k}"]`);
      const nombre = v("nombre").value.trim();
      if (nombre.length < 2) throw new Error("El nombre del producto es obligatorio");
      const crudo = v("precio").value.trim();
      const precio = crudo ? Number(soloDigitos(crudo)) : null;
      if (crudo && (!Number.isFinite(precio) || precio > 99999999999)) throw new Error("El precio no es válido");
      if (!confirmarNoMedicamento(nombre + " " + v("descripcion").value, "en las vitrinas")) { b.disabled = false; return; }
      const gal = galeriasProd.get(fila);
      const datos = { nombre, descripcion: v("descripcion").value, precio, disponible: v("disponible").checked };
      if (gal && (gal.cambiado || !pid)) datos.fotos = await gal.subir();
      await guardarProducto(actual.id, datos, pid);
      mostrarToast(pid ? "✅ Guardado" : "✅ Producto agregado");
    }
    await refrescarProductos();
  } catch (err) {
    console.error(err);
    b.disabled = false;
    mostrarToast(mensajeError(err), "error");
  }
}

async function refrescarProductos() {
  try { productosMios = await cargarProductos(actual.id); } catch (e) { mostrarToast(mensajeError(e), "error"); }
  pintarProductosMios();
}

// ---------- Datos sanitarios (fase 2AB.1) ----------
async function pintarSalud() {
  const salud = esComercioSalud(actual);
  $("mt-salud").classList.toggle("hidden", !salud);
  // Fase 2AC.1: mensaje amable, nada se bloquea por no llenar los datos sanitarios
  const extra = (actual.tiposExtra || []).some(esTipoSalud) && !esTipoSalud(actual.tipo);
  $("mt-reglas").innerHTML = salud
    ? `💊 <b>${extra ? "Marcaste que también eres farmacia, droguería o naturista." : "Droguerías y naturistas:"}</b> Puedes vender en tu vitrina <b>todo lo que no sea medicamento</b> desde ya (aseo, cuidado personal, bebé, dermocosmética, botiquín…). <b>No se publican medicamentos</b>, ni de venta libre ni con fórmula. ${actual.saludRevisado ? (muestraSelloSalud(actual) ? "Tu ficha ya tiene el distintivo «🧾 NIT y director técnico declarados». ✔" : actual.nivel >= 2 ? "Tus datos están revisados, pero tienen más de 12 meses: actualízalos abajo para recuperar el distintivo «🧾 NIT y director técnico declarados»." : "Tus datos están revisados; el distintivo «🧾 NIT y director técnico declarados» aparecerá cuando Merkap verifique tu negocio.") : "Tu ficha aún no tiene el distintivo «🧾 NIT y director técnico declarados», que da más confianza: llena tus datos sanitarios abajo (3 minutos, opcional)."} <a href="politica-productos-salud.html" class="underline">Ver reglas</a>`
    : "No se permiten medicamentos (ni de venta libre ni con fórmula médica) ni otros productos regulados. Licores y tabaco solo para mayores de edad. Un moderador puede ocultar productos que incumplan. <a href=\"politica-productos-salud.html\" class=\"underline\">Ver reglas</a>";
  $("mt-salud-intro").innerHTML = BENEFICIOS_SALUD + " Si cambias algo, Merkap los vuelve a revisar.";
  datosSalud = null;
  if (!salud) return;
  try { datosSalud = await cargarDatosSanitarios(actual.id); }
  catch (e) { console.warn("datos sanitarios:", e); $("mt-salud-estado").textContent = ""; $("mt-salud-campos").innerHTML = '<p class="text-sm text-slate-500">Esta sección se activa en unos días.</p>'; datosSalud = {}; return; }
  const est = $("mt-salud-estado");
  if (!datosSalud) { est.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"; est.textContent = "Sin llenar"; }
  else if (datosSalud.revisado_en) { est.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800"; est.textContent = "✔ Revisados por Merkap"; }
  else { est.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"; est.textContent = "⏳ En revisión"; }
  $("mt-salud-nota").classList.toggle("hidden", !(datosSalud && datosSalud.nota_moderador));
  $("mt-salud-nota").textContent = datosSalud && datosSalud.nota_moderador ? "💬 Merkap: " + datosSalud.nota_moderador : "";
  $("mt-salud-campos").innerHTML = htmlDatosSanitarios("mt-ds", datosSalud || { tipo_establecimiento: actual.tipo === "naturista" ? "naturista" : "" });
}
async function guardarSalud(e) {
  e.preventDefault();
  const r = leerDatosSanitarios("mt-ds");
  if (r.error) { mostrarToast(r.error, "error"); return; }
  const b = e.target.querySelector('button[type="submit"]'); b.disabled = true;
  try {
    await guardarDatosSanitarios(actual.id, r.datos);
    mostrarToast("✅ Datos sanitarios guardados. Merkap los revisará");
    const fresco = await cargarComercioPorId(actual.id).catch(() => null);   // el servidor quita el visto bueno si cambiaste algo
    if (fresco) { actual = fresco; misComercios = misComercios.map(c => c.id === actual.id ? actual : c); pintarCabecera(); }
    await pintarSalud();
    pintarProductosMios();
  } catch (err) { console.error(err); mostrarToast(mensajeError(err), "error"); }
  finally { b.disabled = false; }
}

async function elegirComercio(id) {
  actual = misComercios.find(c => c.id === id) || misComercios[0];
  pintarCabecera(); pintarDatos();
  await pintarSalud();
  await refrescarProductos();
  await refrescarPromos();   // fase 2AP-4a
  if (/^#promos?$/.test(location.hash)) $("promos").scrollIntoView({ block: "start" });
}

// Fase 2AI: el dueño ve al instante si entendimos su horario (sin horario no sale en «🟢 Abiertos ahora»)
function revisarHorario() {
  const v = $("mt-hor").value.trim(), e = estadoHorario(v), s = $("mt-hor-estado");
  if (!s) return;
  if (!v) { s.className = "block mt-1 font-semibold text-amber-700"; s.textContent = "💡 Pon tu horario para salir en el grupo «🟢 Abiertos ahora» del directorio (sale primero)."; return; }
  if (!e) { s.className = "block mt-1 font-semibold text-red-700"; s.textContent = "⚠️ No entendemos este horario: escribe días y horas, ej. «Lun-Sáb 8:00-20:00, Dom 9-14». Así no sale «Abierto ahora»."; return; }
  s.className = "block mt-1 font-semibold text-green-700";
  s.textContent = "✓ Entendido. Así se ve ahora: " + ESTILO_HORARIO[e.estado].icono + " " + e.detalle;
}

document.addEventListener("DOMContentLoaded", async () => {
  $("mt-compartir").addEventListener("click", () => {
    if (!actual) return;
    const t = (typeof TIPOS_COMERCIO !== "undefined" && TIPOS_COMERCIO.find(x => x.id === actual.tipo)) || {};
    abrirCompartir({ tipo: "tienda", id: actual.id, nombre: actual.nombre, foto: (actual.fotos || [])[0] || actual.foto || "", icono: t.icono || "🛍️", ciudad: actual.ciudad || "" });
  });
  await cargarMunicipios();
  await cargarSesion();
  $("mt-cargando").classList.add("hidden");
  if (!usuarioActual) { $("mt-sin-sesion").classList.remove("hidden"); return; }
  // Fase 2AA.5: un moderador puede abrir la tienda de cualquier comercio (mi-tienda.html?id=ID) con todo el control
  const idAdmin = Number(new URLSearchParams(location.search).get("id")) || 0;
  if (idAdmin && esModerador()) {
    const c = await cargarComercioPorId(idAdmin).catch(() => null);
    misComercios = c ? [c] : [];
    if (c) $("mt-panel").insertAdjacentHTML("afterbegin", `<p class="mb-4 text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl px-3 py-2">🛡️ <b>Modo administrador:</b> estás editando la tienda de «${esc(c.nombre)}» (dueño: ${c.ownerId ? "asignado" : "sin asignar"}). <a href="admin-comercios.html?editar=${c.id}" class="underline">Volver a Editar comercios</a></p>`);
  } else misComercios = await cargarMisComercios();
  if (!misComercios.length) { $("mt-sin-tienda").classList.remove("hidden"); return; }
  $("mt-panel").classList.remove("hidden");
  if (misComercios.length > 1) {
    $("mt-selector").innerHTML = misComercios.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
    $("mt-selector").addEventListener("change", e => elegirComercio(Number(e.target.value)));
    $("mt-selector-caja").classList.remove("hidden");
  }
  $("form-negocio").addEventListener("submit", guardarNegocio);
  $("mt-hor").addEventListener("input", revisarHorario);
  $("form-salud").addEventListener("submit", guardarSalud);
  $("mt-modo").addEventListener("change", () => {
    const modo = (document.querySelector('input[name="mt-modo"]:checked') || {}).value;
    $("mt-modo-aviso").classList.toggle("hidden", !(actual && modo !== (actual.modoAtencion || "local")));
  });
  $("mt-productos").addEventListener("click", accionProducto);
  $("mt-productos").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("mt-agregar").addEventListener("click", () => {
    if ($("mt-productos").querySelector('[data-pid=""]')) return;
    $("mt-productos").insertAdjacentHTML("afterbegin", filaProducto(null));
    iniciarGaleriasProductos();
    $("mt-productos").querySelector('[data-pid=""] [data-k="nombre"]').focus();
  });
  await elegirComercio(misComercios[0].id);
});

// =====================================================================
// Fase 2AP-4a · 🔥 Promociones de la tienda (SQL 42). Máximo 2 activas o programadas, 15 días cada una.
// Las reglas las impone la base de datos; aquí solo se hace cómodo.
// =====================================================================
let promosMias = [];
let promoEditando = null;
const fechaMas = (iso, dias) => { const d = new Date(iso + "T12:00:00-05:00"); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
const fechaPromoCorta = iso => new Date(iso + "T12:00:00-05:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
function estadoPromo(p) {
  if (p.oculta) return ["🙈 Oculta por Merkap", "bg-slate-200 text-slate-700"];
  if (p.hasta < hoyBogota()) return ["⏹ Terminada", "bg-slate-100 text-slate-500"];
  if (p.desde > hoyBogota()) return ["🗓️ Programada", "bg-indigo-100 text-indigo-800"];
  return ["🟢 Activa", "bg-emerald-100 text-emerald-800"];
}
const promoCuenta = p => !p.oculta && p.hasta >= hoyBogota();
let numerosPromos = null;   // fase 2AP-4c: {promoId: {vistas, inicio, whatsapp}} o null sin SQL 45

async function refrescarPromos() {
  if (!actual) return;
  const lista = await cargarPromosVigentes(actual.id);
  // las terminadas se muestran solo los últimos 30 días (historial)
  promosMias = lista.filter(p => p.hasta >= fechaMas(hoyBogota(), -30)).sort((a, b) => (promoCuenta(b) - promoCuenta(a)) || b.hasta.localeCompare(a.hasta));
  numerosPromos = promosMias.length ? await cargarNumerosPromos(actual.id) : null;   // fase 2AP-4c
  pintarPromos();
}

function pintarPromos() {
  const activas = promosMias.filter(promoCuenta).length;
  $("mt-promos-cuenta").textContent = `(${activas} de ${MAX_PROMOS})`;
  $("mt-promo-nueva").disabled = activas >= MAX_PROMOS;
  $("mt-promo-nueva").classList.toggle("opacity-50", activas >= MAX_PROMOS);
  $("mt-promo-nueva").title = activas >= MAX_PROMOS ? "Ya tienes 2 promociones: borra una o espera a que termine" : "";
  $("mt-promo-ayuda").open = !promosMias.length;   // la primera vez se ve la explicación abierta
  if (!actual.activo) { $("mt-promos").innerHTML = '<p class="text-sm text-amber-800">Tu tienda debe estar activa en el mapa para publicar promociones.</p>'; return; }
  // Fase 2AP-4c: aviso «tu promo termina hoy/mañana» con sus números, para que cree la siguiente a tiempo
  const fin = promosMias.find(p => promoCuenta(p) && p.desde <= hoyBogota() && p.hasta <= fechaMas(hoyBogota(), 1));
  const nFin = fin && numerosPromos ? numerosPromos[fin.id] : null;
  const avisoFin = fin ? `<div class="promo-fin" role="status">⏳ <b>Tu promo «${esc(fin.titulo)}» ${fin.hasta === hoyBogota() ? "termina hoy" : "termina mañana"}.</b>
    ${nFin ? `Hasta ahora: ${nFin.vistas} la vieron y ${nFin.whatsapp} pidieron por WhatsApp. ` : ""}Prepara la siguiente para no quedarte sin 🔥 en el inicio${activas >= MAX_PROMOS ? " (cuando esta termine se libera el cupo)" : ""}.</div>` : "";
  $("mt-promos").innerHTML = avisoFin + (promosMias.length ? promosMias.map(p => {
    const [txt, cls] = estadoPromo(p), pct = pctPromo(p), vive = promoCuenta(p);
    return `<div class="border border-slate-200 rounded-xl p-3 ${vive ? "" : "opacity-70"}" data-promo="${p.id}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <p class="font-bold text-slate-900">🔥 ${esc(p.titulo)} ${pct ? `<span class="rebaja-pct">−${pct} %</span>` : ""}</p>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}">${txt}</span>
      </div>
      <p class="text-xs text-slate-600 mt-0.5">${p.tipo === "precio" ? `<span class="rebaja-antes">${esc(formatearPrecio(p.precioAntes))}</span> <b>${esc(formatearPrecio(p.precioPromo))}</b> · ` : ""}${esc(fechaPromoCorta(p.desde))} → ${esc(fechaPromoCorta(p.hasta))}${vive ? " · " + esc(plazoPromo(p)) : ""}${p.cantidad ? ` · ${p.cantidad} und.` : ""}</p>
      ${numerosPromos && p.desde <= hoyBogota() ? numerosPromoHTML(numerosPromos[p.id] || { vistas: 0, inicio: 0, whatsapp: 0 }, !vive) : ""}
      <div class="flex flex-wrap gap-2 mt-2">
        ${vive && !p.oculta ? `<button type="button" data-promo-acc="compartir" class="btn-compartir-dueno text-xs font-bold px-3 py-1.5 rounded-lg">📣 Compartir promo</button>` : ""}
        ${vive ? `<button type="button" data-promo-acc="editar" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">✏️ Editar</button>` : ""}
        <button type="button" data-promo-acc="borrar" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700">🗑 Borrar</button>
      </div>
    </div>`;
  }).join("") : '<p class="text-sm text-slate-500">Aún no tienes promociones. Toca «➕ Nueva promoción»: en 1 minuto tu tienda sale con 🔥 en el directorio.</p>');
}

function tipoPromoForm() { return (document.querySelector('input[name="pr-tipo"]:checked') || {}).value || "precio"; }
function pintarFormPromo() {
  const t = tipoPromoForm();
  $("pr-antes-caja").classList.toggle("hidden", t !== "precio");
  $("pr-ahora-caja").classList.toggle("hidden", t !== "precio");
  $("pr-desc-caja").classList.toggle("hidden", t !== "porcentaje");
  const antes = Number(soloDigitos($("pr-antes").value)), ahora = Number(soloDigitos($("pr-ahora").value)), desc = Number(soloDigitos($("pr-desc").value));
  const pct = t === "precio" && antes && ahora && ahora < antes ? Math.round((1 - ahora / antes) * 100) : t === "porcentaje" ? desc : 0;
  $("pr-pct").textContent = t === "precio" && antes && ahora && ahora >= antes ? "⚠️ El precio de promo debe ser menor que el normal"
    : pct ? `Así se verá: 🔥 −${pct} %` : t === "combo" ? "Así se verá: 🔥 COMBO" : "";
  $("pr-hasta").min = $("pr-desde").value || hoyBogota();
  $("pr-hasta").max = fechaMas($("pr-desde").value || hoyBogota(), DIAS_PROMO - 1);
}
function abrirFormPromo(p) {
  promoEditando = p ? p.id : null;
  $("pr-producto").innerHTML = '<option value="">— Ninguno —</option>' + productosMios.map(x => `<option value="${x.id}" data-precio="${x.precio == null ? "" : x.precio}">${esc(x.nombre)}${x.precio != null ? " · " + esc(formatearPrecio(x.precio)) : ""}</option>`).join("");
  $("pr-titulo").value = p ? p.titulo : "";
  document.querySelectorAll('input[name="pr-tipo"]').forEach(r => { r.checked = r.value === (p ? p.tipo : "precio"); });
  $("pr-producto").value = p && p.productoId ? String(p.productoId) : "";
  $("pr-antes").value = p && p.precioAntes ? p.precioAntes : "";
  $("pr-ahora").value = p && p.precioPromo != null ? p.precioPromo : "";
  $("pr-desc").value = p && p.descuento ? p.descuento : "";
  $("pr-desde").value = p ? p.desde : hoyBogota();
  $("pr-desde").min = hoyBogota();
  $("pr-hasta").value = p ? p.hasta : fechaMas(hoyBogota(), 6);
  $("pr-cantidad").value = p && p.cantidad ? p.cantidad : "";
  $("pr-condiciones").value = p ? p.condiciones : "";
  $("pr-descripcion").value = p ? p.descripcion : "";
  $("mt-promo-form").querySelector('button[type="submit"]').textContent = p ? "💾 Guardar cambios" : "💾 Publicar promo";
  $("mt-promo-form").classList.remove("hidden");
  pintarFormPromo();
  $("pr-titulo").focus();
}
async function guardarPromo(e) {
  e.preventDefault();
  const t = tipoPromoForm();
  const num = id => { const v = soloDigitos($(id).value); return v ? Number(v) : null; };
  const fila = {
    comercio_id: actual.id, titulo: $("pr-titulo").value.trim(), tipo: t,
    precio_antes: t === "precio" ? num("pr-antes") : null, precio_promo: t === "precio" ? num("pr-ahora") : null,
    descuento: t === "porcentaje" ? num("pr-desc") : null, producto_id: $("pr-producto").value ? Number($("pr-producto").value) : null,
    desde: $("pr-desde").value, hasta: $("pr-hasta").value, cantidad: num("pr-cantidad"),
    condiciones: $("pr-condiciones").value.trim() || null, descripcion: $("pr-descripcion").value.trim() || null
  };
  if (t === "precio" && (!fila.precio_antes || fila.precio_promo == null || fila.precio_promo >= fila.precio_antes)) { mostrarToast("Escribe el precio normal y uno de promo más bajo", "error"); return; }
  if (t === "porcentaje" && !(fila.descuento >= 1 && fila.descuento <= 90)) { mostrarToast("El descuento va de 1 % a 90 %", "error"); return; }
  if (!fila.desde || !fila.hasta || fila.hasta < fila.desde || fila.hasta > fechaMas(fila.desde, DIAS_PROMO - 1)) { mostrarToast("Revisa las fechas: máximo 15 días", "error"); return; }
  const b = e.target.querySelector('button[type="submit"]'); b.disabled = true;
  try {
    await guardarPromoDB(promoEditando, promoEditando ? (({ comercio_id, ...resto }) => resto)(fila) : fila);
    mostrarToast(promoEditando ? "✅ Promoción actualizada" : "🔥 ¡Promoción publicada! Ahora compártela");
    $("mt-promo-form").classList.add("hidden");
    await refrescarPromos();
  } catch (err) {
    if (!(await ofrecerRevision(err, fila.titulo + " · " + (fila.descripcion || "")))) mostrarToast(err.message, "error");
  } finally { b.disabled = false; }
}
function compartirPromo(p) {
  const prod = productosMios.find(x => x.id === p.productoId);
  const pct = pctPromo(p);
  const precio = p.tipo === "precio" ? `${formatearPrecio(p.precioPromo)} (antes ${formatearPrecio(p.precioAntes)}${pct ? ", −" + pct + " %" : ""})` : pct ? `¡−${pct} %!` : "";
  abrirCompartir({ tipo: "promo", id: actual.id, nombre: p.titulo, tienda: actual.nombre, precio, plazo: plazoPromo(p),
    foto: (prod && (prod.fotos || [])[0]) || (actual.fotos || [])[0] || actual.foto || "", icono: "🔥", ciudad: actual.ciudad || "" });
}
document.addEventListener("DOMContentLoaded", () => {
  if (!$("mt-promo-form")) return;
  $("mt-promo-nueva").addEventListener("click", () => abrirFormPromo(null));
  $("pr-cancelar").addEventListener("click", () => $("mt-promo-form").classList.add("hidden"));
  $("mt-promo-form").addEventListener("submit", guardarPromo);
  $("mt-promo-form").addEventListener("input", pintarFormPromo);
  $("mt-promo-form").addEventListener("change", e => {
    if (e.target.id === "pr-producto") {   // al elegir un producto se sugiere su precio y su nombre
      const o = e.target.selectedOptions[0];
      if (o && o.dataset.precio && !$("pr-antes").value) $("pr-antes").value = o.dataset.precio;
      if (o && o.value && !$("pr-titulo").value.trim()) $("pr-titulo").value = o.textContent.split(" · ")[0];
    }
    if (e.target.id === "pr-desde" && $("pr-hasta").value > fechaMas($("pr-desde").value, DIAS_PROMO - 1)) $("pr-hasta").value = fechaMas($("pr-desde").value, DIAS_PROMO - 1);
    pintarFormPromo();
  });
  $("mt-promos").addEventListener("click", async e => {
    const b = e.target.closest("[data-promo-acc]"); if (!b) return;
    const p = promosMias.find(x => x.id === Number(b.closest("[data-promo]").dataset.promo)); if (!p) return;
    if (b.dataset.promoAcc === "editar") abrirFormPromo(p);
    if (b.dataset.promoAcc === "compartir") compartirPromo(p);
    if (b.dataset.promoAcc === "borrar") {
      if (!confirm(`¿Borrar la promoción «${p.titulo}»?`)) return;
      try { await borrarPromoDB(p.id); mostrarToast("🗑 Promoción borrada"); await refrescarPromos(); } catch (err) { mostrarToast(err.message, "error"); }
    }
  });
});
