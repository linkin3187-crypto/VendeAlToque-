// ===== Merkap - Panel 📊 Métricas del piloto (metricas.html · fase 2AJ) =====
// Lee todo con metricas_resumen(desde, hasta) (supabase/37_metricas.sql), que solo responde a moderadores.

let diasRango = 7;
let datosMe = null;

const NOMBRE_PAGINA = {
  index: "Inicio", anuncio: "Ficha de anuncio", anuncios: "Todos los anuncios", comercios: "Directorio de comercios",
  tienda: "Ficha de tienda", buscar: "Búsqueda", post: "Publicar", favoritos: "Favoritos", vendedor: "Perfil de vendedor",
  "mi-tienda": "Mi tienda", "registrar-negocio": "Registrar negocio", recomendar: "Recomendar comercio", referidos: "Referidos", marketing: "Marketing", otra: "Otras"
};
const NOMBRE_ORIGEN = { directo: "Directo (escribió la dirección o app)", whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram",
  google: "Google", tiktok: "TikTok", qr: "Código QR", referido: "Enlace de referido",
  estado: "Estados de WhatsApp", volante: "Volante o afiche" };
const num = n => Number(n || 0).toLocaleString("es-CO");
const fechaCorta = iso => { const [a, m, d] = String(iso).split("-").map(Number); return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]}`; };
function hoyCo(offset) {
  const d = new Date(Date.now() - (offset || 0) * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);   // AAAA-MM-DD
}

async function cargarMetricas() {
  const desde = hoyCo(diasRango - 1), hasta = hoyCo(0);
  const { data, error } = await sb.rpc("metricas_resumen", { p_desde: desde, p_hasta: hasta });
  if (error) throw error;
  return data;
}

function kpi(titulo, valor, nota, clase) {
  return `<div class="me-kpi ${clase || ""}"><p class="me-kpi-t">${titulo}</p><p class="me-kpi-v">${valor}</p>${nota ? `<p class="me-kpi-n">${nota}</p>` : ""}</div>`;
}

function pintarKpis(t) {
  const contactos = (t.whatsapp || 0) + (t.llamar || 0) + (t.como_llegar || 0);
  const tasa = t.visitantes ? Math.round(contactos * 100 / t.visitantes) : 0;
  const vuelven = t.visitantes ? Math.round((t.volvieron || 0) * 100 / t.visitantes) : 0;
  $("me-kpis").innerHTML = [
    kpi("👥 Personas distintas", num(t.visitantes), `${num(t.visitas)} páginas vistas`),
    kpi("💬 Contactos", num(contactos), `💬 ${num(t.whatsapp)} · 📞 ${num(t.llamar)} · 🗺️ ${num(t.como_llegar)}`, "destacado"),
    kpi("🎯 Contactos por cada 100 personas", num(tasa), "de cada 100 que entran, cuántos contactan"),
    kpi("🔁 Volvieron", vuelven + " %", `${num(t.volvieron)} entraron 2 días o más`)
  ].join("");
}

// Gráfico de barras de una sola serie (sin doble eje), con tooltip al pasar el dedo o el mouse
function grafBarras(cont, filas, campo, color, unidad) {
  const n = filas.length;
  if (!n) { cont.innerHTML = '<p class="me-vacio">Sin datos todavía.</p>'; return; }
  const W = 600, H = 190, pl = 34, pr = 6, pt = 10, pb = 26;
  const max = Math.max(1, ...filas.map(f => f[campo] || 0));
  const crudo = max / 4, mag = 10 ** Math.floor(Math.log10(crudo)), k = crudo / mag;
  const paso = max <= 5 ? 1 : Math.max(1, Math.round((k <= 1 ? 1 : k <= 2 ? 2 : k <= 5 ? 5 : 10) * mag));
  const tope = Math.ceil(max / paso) * paso;
  const y = v => pt + (H - pt - pb) * (1 - v / tope);
  const ancho = (W - pl - pr) / n, barra = Math.max(2, Math.min(34, ancho - 2));
  let g = "";
  for (let v = 0; v <= tope; v += paso) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="me-grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="me-eje" text-anchor="end">${num(v)}</text>`;
  const cadaCuanto = Math.ceil(n / 8);
  const barras = filas.map((f, i) => {
    const v = f[campo] || 0, x = pl + i * ancho + (ancho - barra) / 2, yy = y(v), alto = Math.max(0, H - pb - yy);
    const r = Math.min(4, barra / 2, alto);
    const forma = alto > 0 ? `<path d="M${x},${H - pb} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + barra - r} Q${x + barra},${yy} ${x + barra},${yy + r} V${H - pb} Z" fill="${color}"/>` : "";
    const etq = (i % cadaCuanto === 0 || (i === n - 1 && i % cadaCuanto >= cadaCuanto * 0.6)) ? `<text x="${x + barra / 2}" y="${H - 8}" class="me-eje" text-anchor="middle">${fechaCorta(f.dia)}</text>` : "";
    return `<g class="me-barra" data-tip="${fechaCorta(f.dia)}: ${num(v)} ${unidad}">${forma}<rect x="${pl + i * ancho}" y="${pt}" width="${ancho}" height="${H - pt - pb}" fill="transparent"/>${etq}</g>`;
  }).join("");
  cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Gráfico por día">${g}<line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" class="me-base"/>${barras}</svg>`;
}

function tabla(cols, filas, vacio) {
  if (!filas.length) return `<p class="me-vacio">${vacio || "Sin datos todavía."}</p>`;
  return `<div class="overflow-x-auto"><table class="me-tabla"><thead><tr>${cols.map(c => `<th class="${c.num ? "n" : ""}">${c.t}</th>`).join("")}</tr></thead>
    <tbody>${filas.map(f => `<tr>${cols.map(c => `<td class="${c.num ? "n" : ""}">${c.f(f)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
// Barra horizontal dentro de una lista (proporción, no exactitud)
function listaBarras(filas, etiqueta, valor) {
  if (!filas.length) return '<p class="me-vacio">Sin datos todavía.</p>';
  const max = Math.max(1, ...filas.map(valor));
  return `<ul class="me-lista">${filas.map(f => `<li><span class="me-lista-t">${etiqueta(f)}</span><span class="me-lista-v">${num(valor(f))}</span>
    <span class="me-lista-b" style="width:${Math.max(3, valor(f) * 100 / max)}%"></span></li>`).join("")}</ul>`;
}

function pintar() {
  const d = datosMe, t = d.totales || {};
  $("me-periodo").textContent = d.desde === d.hasta ? `Hoy, ${fechaCorta(d.hasta)}` : `Del ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)}`;
  pintarKpis(t);
  grafBarras($("me-graf-visitantes"), d.por_dia || [], "visitantes", "#4f46e5", "personas");
  grafBarras($("me-graf-contactos"), d.por_dia || [], "contactos", "#16a34a", "contactos");
  $("me-top-comercios").innerHTML = tabla([
    { t: "Comercio", f: c => `<a href="tienda.html?id=${c.id}" class="font-semibold text-indigo-700 hover:underline">${esc(c.nombre)}</a> <span class="text-slate-400 text-xs">${esc(c.municipio)}</span>` },
    { t: "💬", num: 1, f: c => num(c.whatsapp) }, { t: "📞", num: 1, f: c => num(c.llamar) }, { t: "🗺️", num: 1, f: c => num(c.como_llegar) },
    { t: "Total", num: 1, f: c => `<b>${num(c.contactos)}</b>` }
  ], d.top_comercios || [], "Todavía nadie ha contactado un comercio en este periodo.");
  $("me-top-anuncios").innerHTML = tabla([
    { t: "Anuncio", f: a => `<a href="anuncio.html?id=${a.id}" class="font-semibold text-indigo-700 hover:underline">${esc(a.nombre)}</a> <span class="text-slate-400 text-xs">${esc(a.municipio)}</span>` },
    { t: "Contactos", num: 1, f: a => `<b>${num(a.contactos)}</b>` }
  ], d.top_anuncios || [], "Todavía nadie ha contactado un anuncio en este periodo.");
  $("me-municipios").innerHTML = listaBarras(d.por_municipio || [], m => esc(m.municipio), m => m.contactos);
  $("me-origenes").innerHTML = listaBarras(d.origenes || [], o => esc(NOMBRE_ORIGEN[o.origen] || o.origen), o => o.visitantes);
  $("me-paginas").innerHTML = listaBarras(d.paginas || [], p => esc(NOMBRE_PAGINA[p.pagina] || p.pagina), p => p.visitas);
  $("me-sin-resultados").innerHTML = listaBarras(d.sin_resultados || [], b => "«" + esc(b.termino) + "»", b => b.veces);
  $("me-nuevos").innerHTML = `<ul class="me-lista">
    <li><span class="me-lista-t">📢 Anuncios publicados</span><span class="me-lista-v">${num(t.anuncios)}</span></li>
    <li><span class="me-lista-t">🙋 Cuentas nuevas</span><span class="me-lista-v">${num(t.usuarios)}</span></li>
    <li><span class="me-lista-t">🏪 Negocios registrados</span><span class="me-lista-v">${num(t.negocios)}</span></li>
    <li><span class="me-lista-t">🔑 Fichas reclamadas</span><span class="me-lista-v">${num(t.reclamos)}</span></li>
    <li><span class="me-lista-t">🔗 Veces que compartieron</span><span class="me-lista-v">${num(t.compartir)}</span></li></ul>
    <p class="text-[11px] text-slate-400 mt-2">Hoy hay ${num(t.anuncios_activos)} anuncios activos y ${num(t.comercios_activos)} comercios (${num(t.comercios_con_dueno)} con dueño).</p>`;
}

function textoResumen() {
  const d = datosMe, t = d.totales || {};
  const contactos = (t.whatsapp || 0) + (t.llamar || 0) + (t.como_llegar || 0);
  const top = (d.top_comercios || []).slice(0, 3).map((c, i) => `${i + 1}. ${c.nombre} (${c.contactos})`).join("\n");
  return [`📊 Merkap · ${$("me-periodo").textContent}`,
    `👥 ${num(t.visitantes)} personas · ${num(t.visitas)} páginas vistas`,
    `💬 ${num(contactos)} contactos (WhatsApp ${num(t.whatsapp)}, llamadas ${num(t.llamar)}, cómo llegar ${num(t.como_llegar)})`,
    `🔁 ${num(t.volvieron)} volvieron`,
    `🆕 ${num(t.anuncios)} anuncios · ${num(t.usuarios)} cuentas · ${num(t.negocios)} negocios · ${num(t.reclamos)} reclamos`,
    top ? "🏆 Comercios más contactados:\n" + top : ""].filter(Boolean).join("\n");
}

async function recargar() {
  try { datosMe = await cargarMetricas(); pintar(); }
  catch (err) {
    if (/metricas_resumen|function|does not exist|schema cache/i.test(err.message || "")) {
      $("me-panel").classList.add("hidden"); $("me-sin-sql").classList.remove("hidden"); return;
    }
    mostrarToast(mensajeError(err), "error");
  }
}

// Tooltip de las barras (mouse y dedo)
function tooltip(e) {
  const g = e.target.closest && e.target.closest(".me-barra"), tip = $("me-tip");
  if (!g) { tip.hidden = true; return; }
  tip.textContent = g.dataset.tip; tip.hidden = false;
  const p = e.touches ? e.touches[0] : e;
  tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, p.clientX - tip.offsetWidth / 2)) + "px";
  tip.style.top = (p.clientY - tip.offsetHeight - 12) + "px";
}

document.addEventListener("DOMContentLoaded", async () => {
  await cargarSesion();
  $("me-cargando").classList.add("hidden");
  if (!esAdmin()) { $("me-sin-permiso").classList.remove("hidden"); return; }   // fase 2AK: solo administrador
  $("me-panel").classList.remove("hidden");
  $("me-rangos").addEventListener("click", e => {
    const b = e.target.closest("[data-dias]"); if (!b) return;
    diasRango = Number(b.dataset.dias);
    $("me-rangos").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    recargar();
  });
  $("me-copiar").addEventListener("click", async () => {
    if (!datosMe) return;
    try { await navigator.clipboard.writeText(textoResumen()); mostrarToast("📋 Resumen copiado: pégalo en WhatsApp"); }
    catch (e) { prompt("Copia el resumen:", textoResumen()); }
  });
  ["mousemove", "touchstart"].forEach(ev => document.addEventListener(ev, tooltip, { passive: true }));
  document.addEventListener("scroll", () => { $("me-tip").hidden = true; }, { passive: true });
  await recargar();
});
