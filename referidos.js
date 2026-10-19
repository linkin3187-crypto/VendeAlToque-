// ===== Merkap · Enlaces con código y QR (solo moderadores) =====
const PAGINAS_REF = { inicio: "index.html", registrar: "registrar-negocio.html", directorio: "comercios.html", tienda: "tienda.html" };
let svgActual = "";

// Carpeta donde vive la página (sirve igual en GitHub Pages o en un dominio propio)
function baseSitio() { return location.origin + location.pathname.replace(/[^/]*$/, ""); }

function codigoActual() { return limpiarRef(slugRef($("rf-codigo").value)); }

function construirEnlace() {
  const codigo = codigoActual();
  if (!codigo) return "";
  const destino = $("rf-destino").value;
  const url = baseSitio() + PAGINAS_REF[destino];
  const params = [];
  if (destino === "tienda") {
    const id = $("rf-id").value.replace(/\D/g, "");
    if (!id) return "";
    params.push("id=" + id);
  }
  params.push("ref=" + codigo);
  return url + "?" + params.join("&");
}

function pintarEnlace() {
  const entrada = $("rf-codigo");
  // Mientras escribe: espacios → guiones, y se deja el guion final para poder seguir escribiendo «grupo-»
  const crudo = entrada.value.replace(/ /g, "-");
  const base = slugRef(crudo);
  const limpio = base && base.length < 30 && /[-_]$/.test(crudo) ? base + "-" : base;
  if (entrada.value !== limpio) entrada.value = limpio;
  $("rf-id-caja").classList.toggle("hidden", $("rf-destino").value !== "tienda");
  const url = construirEnlace();
  $("rf-vacio").classList.toggle("hidden", !!url);
  $("rf-resultado").classList.toggle("hidden", !url);
  if (!url) { svgActual = ""; return; }
  svgActual = qrSvg(url, { px: 8, margen: 4 });
  $("rf-qr").innerHTML = svgActual;
  const svg = $("rf-qr").querySelector("svg");
  svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("class", "w-full h-full");
  $("rf-enlace").value = url;
  $("rf-codigo-visto").textContent = "Código: " + codigoActual();
}

function descargar(nombre, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function bajarPng() {
  if (!svgActual) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(img, 0, 0, 1024, 1024);
    c.toBlob(b => descargar("qr-" + codigoActual() + ".png", b), "image/png");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgActual);
}

async function pintarTabla() {
  const caja = $("rf-tabla");
  caja.innerHTML = '<p class="p-4 text-sm text-slate-500">Cargando…</p>';
  try {
    const filas = await cargarResumenReferidos();
    if (!filas.length) { caja.innerHTML = '<p class="p-4 text-sm text-slate-500">Todavía no hay cuentas.</p>'; return; }
    caja.innerHTML = `<table class="w-full text-sm">
      <thead class="bg-slate-50 text-xs text-slate-500"><tr>
        <th class="text-left p-3">Código</th><th class="p-3">Cuentas</th><th class="p-3">Últimos 7 días</th><th class="p-3">Ya publicaron</th><th class="p-3">Enviaron negocio</th></tr></thead>
      <tbody>${filas.map(f => `<tr class="border-t border-slate-100">
        <td class="p-3 font-semibold ${f.ref === "(directo)" ? "text-slate-500" : "text-indigo-700"}">${esc(f.ref)}</td>
        <td class="p-3 text-center font-bold">${f.registros}</td>
        <td class="p-3 text-center">${f.ultimos7}</td>
        <td class="p-3 text-center">${f.conAnuncio}</td>
        <td class="p-3 text-center">${f.conNegocio}</td></tr>`).join("")}</tbody></table>`;
  } catch (e) {
    caja.innerHTML = `<p class="p-4 text-sm text-red-600">${esc(e.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarSesion();
  $("rf-cargando").classList.add("hidden");
  if (!esAdmin()) {   // fase 2AK: solo administrador
    $("rf-sin-permiso-txt").textContent = usuarioActual
      ? "Tu cuenta no tiene rol de moderador."
      : "Inicia sesión con tu cuenta de administrador.";
    $("rf-sin-permiso").classList.remove("hidden");
    return;
  }
  $("rf-panel").classList.remove("hidden");
  const q = new URLSearchParams(location.search);
  if (PAGINAS_REF[q.get("destino")]) $("rf-destino").value = q.get("destino");
  if (q.get("id")) $("rf-id").value = q.get("id").replace(/\D/g, "").slice(0, 9);
  if (q.get("codigo")) $("rf-codigo").value = slugRef(q.get("codigo"));
  ["rf-codigo", "rf-destino", "rf-id"].forEach(id => $(id).addEventListener("input", pintarEnlace));
  $("rf-copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("rf-enlace").value); mostrarToast("📋 Enlace copiado"); }
    catch (e) { $("rf-enlace").select(); mostrarToast("Selecciona el enlace y cópialo (Ctrl+C)", "error"); }
  });
  $("rf-png").addEventListener("click", bajarPng);
  $("rf-svg").addEventListener("click", () => { if (svgActual) descargar("qr-" + codigoActual() + ".svg", new Blob([svgActual], { type: "image/svg+xml" })); });
  $("rf-imprimir").addEventListener("click", () => window.print());
  $("rf-recargar").addEventListener("click", pintarTabla);
  pintarEnlace();
  pintarTabla();
});
