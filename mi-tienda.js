// ===== Merkap - Panel del dueño del comercio (mi-tienda.html) =====
// El dueño solo puede cambiar descripción, WhatsApp, teléfono, horario, foto y entrega, y gestionar hasta 20 productos.
// Las reglas las impone la base de datos (RLS y triggers); esta pantalla solo las hace cómodas.

let misComercios = [];
let actual = null;
let productosMios = [];
const MAX_PRODUCTOS = 20;

let galeria = null;
let datosSalud = null;   // fase 2AB.1: datos sanitarios del comercio actual (o null)
const soloDigitos = s => String(s || "").replace(/\D/g, "");

function pintarCabecera() {
  $("mt-nombre").textContent = actual.nombre;
  const s = SELLOS[actual.nivel] || SELLOS[1];
  $("mt-sello").className = "text-xs font-semibold px-2 py-0.5 rounded-full " + s.clase;
  $("mt-sello").textContent = (actual.nivel >= 2 ? "✔ " : "") + s.corto;
  const bs = $("mt-badge-salud"); if (bs) bs.remove();
  if (esComercioSalud(actual) && actual.saludRevisado) $("mt-sello").insertAdjacentHTML("afterend", '<span id="mt-badge-salud"> ' + BADGE_SALUD + "</span>");
  const e = $("mt-estado");
  const publica = actual.activo && actual.nivel >= 2;
  e.className = "text-sm rounded-lg px-3 py-2 mt-2 " + (publica ? "bg-green-50 text-green-900 border border-green-200" : "bg-amber-50 text-amber-900 border border-amber-200");
  // Fase 2Z.9: «Ubicado» SÍ aparece en el mapa y el directorio (igual que los importados); lo que espera la verificación son los productos
  e.innerHTML = publica ? "✅ Tu tienda es pública. Los clientes pueden verla y pedirte por WhatsApp."
      + (saludPendiente(actual) ? " Cuando Merkap revise tus <b>datos sanitarios</b>, tu ficha mostrará el distintivo «🧾 Datos sanitarios revisados»." : "")
    : !actual.activo ? "🙈 Tu negocio está oculto en el mapa. Escríbenos si crees que es un error."
    : "📍 <b>Tu negocio YA aparece en el mapa y en el directorio</b>, con la etiqueta «Ubicado». Lo que aún no ven los clientes son <b>tus productos</b>: tu vitrina se publica cuando Merkap confirme tu negocio por WhatsApp o llamada (sello «Verificado»). Mientras tanto, prepara tus productos.";
  $("mt-ver").href = "tienda.html?id=" + actual.id;
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
  document.querySelectorAll('input[name="mt-modo"]').forEach(r => { r.checked = r.value === (actual.modoAtencion || "local"); });
  $("mt-modo-aviso").classList.add("hidden");
  $("mt-recoge").checked = actual.recoge;
  $("mt-dom").checked = actual.domicilio;
  $("mt-dom-info").value = actual.domicilioInfo;
  galeria = gestorFotos($("mt-galeria"), actual.fotos);   // fase 2AA.4
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
  $("mt-cuenta").textContent = `(${productosMios.length} de ${MAX_PRODUCTOS})`;
  $("mt-agregar").disabled = productosMios.length >= MAX_PRODUCTOS;   // fase 2AC.1: los datos sanitarios ya no frenan
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
    ? `💊 <b>${extra ? "Marcaste que también eres farmacia, droguería o naturista." : "Droguerías y naturistas:"}</b> Puedes vender en tu vitrina <b>todo lo que no sea medicamento</b> desde ya (aseo, cuidado personal, bebé, dermocosmética, botiquín…). <b>No se publican medicamentos</b>, ni de venta libre ni con fórmula. ${actual.saludRevisado ? "Tu ficha ya tiene el distintivo «🧾 Datos sanitarios revisados». ✔" : "Tu ficha aún no tiene el distintivo «🧾 Datos sanitarios revisados», que da más confianza: llena tus datos sanitarios abajo (3 minutos, opcional)."} <a href="politica-productos-salud.html" class="underline">Ver reglas</a>`
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
}

document.addEventListener("DOMContentLoaded", async () => {
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
