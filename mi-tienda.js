// ===== MercaFree - Panel del dueño del comercio (mi-tienda.html) =====
// El dueño solo puede cambiar descripción, WhatsApp, teléfono, horario, foto y entrega, y gestionar hasta 20 productos.
// Las reglas las impone la base de datos (RLS y triggers); esta pantalla solo las hace cómodas.

let misComercios = [];
let actual = null;
let productosMios = [];
const MAX_PRODUCTOS = 20;

const soloDigitos = s => String(s || "").replace(/\D/g, "");

function pintarCabecera() {
  $("mt-nombre").textContent = actual.nombre;
  const s = SELLOS[actual.nivel] || SELLOS[1];
  $("mt-sello").className = "text-xs font-semibold px-2 py-0.5 rounded-full " + s.clase;
  $("mt-sello").textContent = (actual.nivel >= 2 ? "✔ " : "") + s.corto;
  const e = $("mt-estado");
  const publica = actual.activo && actual.nivel >= 2;
  e.className = "text-sm rounded-lg px-3 py-2 mt-2 " + (publica ? "bg-green-50 text-green-900 border border-green-200" : "bg-amber-50 text-amber-900 border border-amber-200");
  e.textContent = publica ? "✅ Tu tienda es pública. Los clientes pueden verla y pedirte por WhatsApp."
    : "⏳ Tu tienda aún no es pública: se publica cuando MercaFree verifique tu negocio. Mientras tanto puedes preparar tus productos.";
  $("mt-ver").href = "tienda.html?id=" + actual.id;
}

function pintarDatos() {
  $("mt-desc").value = actual.descripcion;
  $("mt-wa").value = actual.whatsapp.replace(/^57/, "");
  $("mt-tel").value = actual.telefono;
  $("mt-hor").value = actual.horario;
  $("mt-recoge").checked = actual.recoge;
  $("mt-dom").checked = actual.domicilio;
  $("mt-dom-info").value = actual.domicilioInfo;
  $("mt-foto").value = "";
  const f = urlSegura(actual.foto);
  $("mt-foto-prev").classList.toggle("hidden", !f);
  if (f) $("mt-foto-prev").src = f;
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
    const archivo = $("mt-foto").files[0];
    if (archivo) cambios.foto_url = await subirFotoComercio(await comprimir(archivo));
    actual = await guardarMiComercio(actual.id, cambios);
    misComercios = misComercios.map(c => c.id === actual.id ? actual : c);
    pintarDatos();
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
  const f = urlSegura(p.foto);
  return `<article class="border border-slate-200 rounded-xl p-3 ${p.oculto ? "bg-red-50" : ""}" data-pid="${p.id}">
    ${p.oculto ? '<p class="text-xs text-red-700 font-semibold mb-2">🚫 Un moderador ocultó este producto. Revisa las reglas o escríbenos.</p>' : ""}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <label class="text-xs font-bold text-slate-500 sm:col-span-2">Nombre
        <input data-k="nombre" maxlength="80" value="${esc(p.nombre)}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>
      <label class="text-xs font-bold text-slate-500">Precio (COP, opcional)
        <input data-k="precio" inputmode="numeric" value="${p.precio != null ? p.precio : ""}" placeholder="8500" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>
      <label class="text-xs font-bold text-slate-500 sm:col-span-3">Descripción (opcional)
        <input data-k="descripcion" maxlength="200" value="${esc(p.descripcion)}" class="mt-0.5 w-full border border-slate-300 p-2 rounded-lg font-normal text-sm text-slate-800"></label>
      <label class="text-xs font-bold text-slate-500 sm:col-span-3">Foto
        <div class="flex items-center gap-2 mt-0.5">${f ? `<img src="${esc(f)}" alt="" class="w-12 h-12 rounded object-cover">` : ""}<input type="file" data-foto accept="image/*" class="text-xs font-normal"></div></label>
    </div>
    <div class="flex flex-wrap items-center gap-3 mt-2 text-sm">
      <label class="flex items-center gap-1.5"><input type="checkbox" data-k="disponible" ${p.disponible ? "checked" : ""}> Disponible</label>
      <button type="button" data-acc="guardar" class="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-sm disabled:opacity-60">${nuevo ? "Agregar" : "Guardar"}</button>
      ${nuevo ? '<button type="button" data-acc="cancelar" class="text-xs text-slate-500 hover:underline">Cancelar</button>'
              : '<button type="button" data-acc="borrar" class="text-red-600 hover:underline text-xs">Borrar</button>'}
    </div>
  </article>`;
}

function pintarProductosMios() {
  $("mt-productos").innerHTML = productosMios.map(filaProducto).join("");
  $("mt-vacio").classList.toggle("hidden", productosMios.length > 0);
  $("mt-cuenta").textContent = `(${productosMios.length} de ${MAX_PRODUCTOS})`;
  $("mt-agregar").disabled = productosMios.length >= MAX_PRODUCTOS;
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
      const archivo = fila.querySelector("[data-foto]").files[0];
      await guardarProducto(actual.id, {
        nombre, descripcion: v("descripcion").value, precio, disponible: v("disponible").checked,
        foto: archivo ? await comprimir(archivo) : null
      }, pid);
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

async function elegirComercio(id) {
  actual = misComercios.find(c => c.id === id) || misComercios[0];
  pintarCabecera(); pintarDatos();
  await refrescarProductos();
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  $("mt-cargando").classList.add("hidden");
  if (!usuarioActual) { $("mt-sin-sesion").classList.remove("hidden"); return; }
  misComercios = await cargarMisComercios();
  if (!misComercios.length) { $("mt-sin-tienda").classList.remove("hidden"); return; }
  $("mt-panel").classList.remove("hidden");
  if (misComercios.length > 1) {
    $("mt-selector").innerHTML = misComercios.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
    $("mt-selector").addEventListener("change", e => elegirComercio(Number(e.target.value)));
    $("mt-selector-caja").classList.remove("hidden");
  }
  $("form-negocio").addEventListener("submit", guardarNegocio);
  $("mt-productos").addEventListener("click", accionProducto);
  $("mt-productos").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("mt-agregar").addEventListener("click", () => {
    if ($("mt-productos").querySelector('[data-pid=""]')) return;
    $("mt-productos").insertAdjacentHTML("afterbegin", filaProducto(null));
    $("mt-productos").querySelector('[data-pid=""] [data-k="nombre"]').focus();
  });
  await elegirComercio(misComercios[0].id);
});
