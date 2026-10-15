// ===== MercaFree - Vitrina pública de un comercio (tienda.html?id=...) =====
// El público solo ve tiendas ACTIVAS y VERIFICADAS (nivel 2 o 3); la base de datos lo exige (RLS).
// El dueño y los moderadores pueden ver su tienda antes de que sea pública (con un aviso).

let tienda = null;
let productos = [];
const carrito = new Map();   // productoId → cantidad
let modoPedido = "";

const peso = n => "$" + Number(n).toLocaleString("es-CO");

function haceDias(fechaIso) {
  const d = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : "hace " + d + " días";
}

function tarjetaProducto(p) {
  const foto = urlSegura(p.foto);
  const enCarro = carrito.get(p.id) || 0;
  const control = !p.disponible ? '<span class="text-xs font-semibold text-slate-400">Agotado</span>'
    : !tienda.whatsapp ? ""
    : enCarro
      ? `<div class="flex items-center gap-2"><button type="button" data-menos="${p.id}" aria-label="Quitar uno" class="w-8 h-8 rounded-full border border-slate-300 font-bold">−</button><b>${enCarro}</b><button type="button" data-mas="${p.id}" aria-label="Agregar uno" class="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold">+</button></div>`
      : `<button type="button" data-mas="${p.id}" class="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1.5">+ Agregar</button>`;
  return `<article class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${p.disponible ? "" : "opacity-70"}" data-prod="${p.id}">
    <div class="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <span class="text-3xl">🛍️</span>
      ${foto ? `<img src="${esc(foto)}" alt="${esc(p.nombre)}" loading="lazy" class="absolute inset-0 w-full h-full object-cover">` : ""}
      ${p.disponible ? "" : '<span class="absolute top-2 left-2 bg-slate-700 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">Agotado</span>'}
    </div>
    <div class="p-3 flex-1 flex flex-col">
      <p class="text-sm font-semibold line-clamp-2">${esc(p.nombre)}</p>
      ${p.descripcion ? `<p class="text-xs text-slate-500 line-clamp-2 mt-0.5">${esc(p.descripcion)}</p>` : ""}
      <p class="text-sm text-indigo-600 font-bold mt-1">${p.precio != null ? peso(p.precio) : "Consultar precio"}</p>
      <div class="mt-auto pt-2 flex items-center justify-between gap-2">${control}
        <button type="button" data-reportar="${p.id}" class="text-[11px] text-slate-400 hover:text-red-600 underline">Reportar</button></div>
    </div>
  </article>`;
}

function pintarProductos() {
  $("t-lista").innerHTML = productos.map(tarjetaProducto).join("");
  $("t-sin-productos").classList.toggle("hidden", productos.length > 0);
  pintarBarra();
}

function itemsPedido() {
  return productos.filter(p => carrito.get(p.id)).map(p => ({ nombre: p.nombre, precio: p.precio, cantidad: carrito.get(p.id) }));
}

function pintarBarra() {
  const items = itemsPedido();
  const n = items.reduce((s, i) => s + i.cantidad, 0);
  $("t-barra").classList.toggle("hidden", n === 0);
  if (!n) return;
  $("t-barra-n").textContent = n + (n === 1 ? " producto" : " productos");
  const total = items.reduce((s, i) => s + (i.precio != null ? i.precio * i.cantidad : 0), 0);
  $("t-barra-total").textContent = items.every(i => i.precio != null) ? "Total aproximado " + peso(total) : "Algunos precios por consultar";
  $("t-pedir").href = urlWhatsAppTexto(tienda.whatsapp, mensajePedido(tienda, items, modoPedido));
}

function renderizarTienda(c, ps) {
  tienda = c; productos = ps;
  const t = TIPOS_COMERCIO.find(x => x.id === c.tipo);
  document.title = `${c.nombre} | MercaFree`;
  $("t-nombre").textContent = c.nombre;
  $("t-icono").textContent = t ? t.icono : "🏪";
  $("t-sub").textContent = [t ? t.nombre.replace(/s$/, "") : "Comercio", c.ciudad].filter(Boolean).join(" · ");
  const sello = SELLOS[c.nivel] || SELLOS[1];
  $("t-sello").className = "text-xs font-semibold px-2 py-0.5 rounded-full " + sello.clase;
  $("t-sello").textContent = (c.nivel >= 2 ? "✔ " : "") + sello.corto + (c.verificadoEn ? " · " + fechaSello(c) : "");
  const foto = urlSegura(c.foto);
  if (foto) {
    const img = document.createElement("img");
    img.src = foto; img.alt = "Foto de " + c.nombre; img.className = "absolute inset-0 w-full h-full object-cover";
    img.addEventListener("error", () => img.remove());
    $("t-portada").appendChild(img);
  }
  if (c.descripcion) { $("t-desc").textContent = c.descripcion; $("t-desc").classList.remove("hidden"); }
  const fila = (id, txt) => { if (txt) { $(id).querySelector("span").textContent = txt; $(id).classList.remove("hidden"); } };
  fila("t-dir", c.direccion); fila("t-hor", c.horario);
  const entrega = [c.recoge ? "Recoger en el local" : "", c.domicilio ? "Domicilio" + (c.domicilioInfo ? " (" + c.domicilioInfo + ")" : "") : ""].filter(Boolean).join(" · ");
  fila("t-ent", entrega);

  const ab = estaAbierto(c.horario);
  if (ab !== null) {
    const b = $("t-abierto");
    b.textContent = ab ? "🟢 Abierto ahora" : "🔴 Cerrado ahora";
    b.className = "text-xs font-semibold px-2 py-0.5 rounded-full " + (ab ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700");
  }

  if (c.whatsapp) {
    $("t-wa").href = urlWhatsAppTexto(c.whatsapp, `Hola, vi tu tienda «${c.nombre}» en MercaFree.`);
    $("t-wa").classList.remove("hidden");
  }
  const tel = String(c.telefono || "").replace(/[^\d+]/g, "");
  if (tel) { $("t-llamar").href = "tel:" + tel; $("t-llamar").classList.remove("hidden"); }
  const ll = $("t-llegar");
  ll.href = urlGoogleMaps(c.lat, c.lng);
  Object.assign(ll.dataset, { comoLlegar: "", lat: c.lat, lng: c.lng, nombre: c.nombre, ciudad: c.ciudad || "" });
  $("t-es-tuyo").href = "comercios.html?solicitar=" + c.id;
  $("t-reportar").addEventListener("click", () => abrirReporteComercio(c));
  $("t-compartir").addEventListener("click", async () => {
    const datos = { title: c.nombre, text: `${c.nombre} en MercaFree`, url: location.href };
    if (navigator.share) { try { await navigator.share(datos); } catch (e) { /* canceló */ } return; }
    try { await navigator.clipboard.writeText(location.href); mostrarToast("🔗 Enlace copiado"); } catch (e) { window.prompt("Copia el enlace:", location.href); }
  });

  // Frescura de la vitrina
  if (ps.length) {
    const ultima = ps.reduce((m, p) => p.actualizado > m ? p.actualizado : m, ps[0].actualizado);
    $("t-actualizado").textContent = "Actualizado " + haceDias(ultima);
    $("t-desactualizado").classList.toggle("hidden", (Date.now() - new Date(ultima).getTime()) / 86400000 <= 30);
  }

  // Recoger / domicilio: si ofrece ambos, la persona elige
  if (c.recoge && c.domicilio && c.whatsapp) {
    $("t-modo").classList.remove("hidden");
    $("t-modo").addEventListener("change", e => { modoPedido = e.target.value; pintarBarra(); });
  } else modoPedido = c.domicilio && !c.recoge ? "domicilio" : c.recoge && !c.domicilio ? "recoger" : "";

  // Aviso si la tienda aún no es pública (solo la ven el dueño o un moderador)
  const publica = c.activo && c.nivel >= 2;
  if (!publica) {
    const av = $("t-aviso-privado");
    av.textContent = "👀 Solo tú ves esta tienda: se publicará cuando el comercio esté activo y verificado por MercaFree.";
    av.classList.remove("hidden");
  }
  pintarProductos();
  $("t-contenido").classList.remove("hidden");
}

function manejarClicks(e) {
  const mas = e.target.closest("[data-mas]"), menos = e.target.closest("[data-menos]"), rep = e.target.closest("[data-reportar]");
  if (mas) { const id = Number(mas.dataset.mas); carrito.set(id, Math.min(20, (carrito.get(id) || 0) + 1)); pintarProductos(); }
  else if (menos) { const id = Number(menos.dataset.menos); const n = (carrito.get(id) || 0) - 1; n > 0 ? carrito.set(id, n) : carrito.delete(id); pintarProductos(); }
  else if (rep) {
    if (!usuarioActual) {
      mostrarToast("Inicia sesión para reportar un producto", "error");
      setTimeout(() => { location.href = "index.html#login"; }, 1200);
      return;
    }
    productoReportado = Number(rep.dataset.reportar);
    abrirModal("modal-rep-prod");
  }
}
let productoReportado = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarMunicipios();
  await cargarSesion();
  const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
  let c = null, ps = [];
  try {
    c = Number.isFinite(id) ? await cargarComercioPorId(id) : null;
    if (c) ps = await cargarProductos(c.id);
  } catch (err) { console.error(err); }
  $("t-cargando").classList.add("hidden");
  if (!c) { $("t-error").classList.remove("hidden"); return; }
  renderizarTienda(c, ps);
  $("t-lista").addEventListener("click", manejarClicks);
  $("t-lista").addEventListener("error", e => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  $("form-rep-prod").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await crearReporteProducto(productoReportado, $("rp-motivo").value, $("rp-detalle").value.trim());
      e.target.reset(); cerrarModal("modal-rep-prod");
      mostrarToast("✅ Gracias. Revisaremos este producto");
    } catch (err) { mostrarToast(mensajeError(err), "error"); }
    finally { btn.disabled = false; }
  });
});
