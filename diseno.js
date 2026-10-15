// MercaFree · DISEÑO NUEVO (interruptor). Solo actúa si <html> tiene la clase "dn" (ver script del <head> en index.html).
// Sin esa clase este archivo no hace nada visible. Para quitar el diseño nuevo por completo: ver GUIA-DE-CAMBIOS.md.
(function () {
  "use strict";
  const html = document.documentElement;
  const activo = () => html.classList.contains("dn");
  const VISTAS = ["inicio", "clasificados", "comercios", "foro"];
  const HASH = { inicio: "", clasificados: "#clasificados", comercios: "#comercios", foro: "#foro" };

  // ---------- Navegación entre pantallas ----------
  function ir(vista, opc) {
    if (!VISTAS.includes(vista)) vista = "inicio";
    html.setAttribute("data-v", vista);
    document.querySelectorAll("#nav-inferior .di-tab[data-ir]").forEach(b => b.classList.toggle("on", b.dataset.ir === vista));
    if (vista !== "clasificados") html.setAttribute("data-lm", "lista");
    if (!(opc && opc.sinHash)) {
      try { history.replaceState(null, "", location.pathname + location.search + HASH[vista]); } catch (e) { /* sin historial */ }
    }
    window.scrollTo(0, 0);
    if (vista === "clasificados") refrescarMapa();
  }
  function refrescarMapa() {
    // Leaflet necesita recalcular su tamaño cuando el mapa estaba oculto
    setTimeout(() => { try { if (typeof mapa !== "undefined" && mapa) mapa.invalidateSize(); } catch (e) { /* aún sin mapa */ } }, 80);
  }
  function modoListaMapa(m) {
    html.setAttribute("data-lm", m);
    document.querySelectorAll("#lm-caja [data-lm]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.lm === m)));
    if (m === "mapa") refrescarMapa();
  }

  // ---------- Carruseles que van pasando solos ----------
  const timers = new Map();
  function autoAvanzar(pista) {
    clearInterval(timers.get(pista));
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let pausa = false;
    const parar = () => { pausa = true; clearTimeout(pista._reanuda); pista._reanuda = setTimeout(() => { pausa = false; }, 6000); };
    ["touchstart", "pointerdown", "wheel"].forEach(ev => pista.addEventListener(ev, parar, { passive: true }));
    timers.set(pista, setInterval(() => {
      if (pausa || document.hidden || !pista.offsetParent) return;
      const hijo = pista.firstElementChild;
      if (!hijo) return;
      const paso = hijo.getBoundingClientRect().width + 12;
      const fin = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 4;
      pista.scrollTo({ left: fin ? 0 : pista.scrollLeft + paso, behavior: "smooth" });
    }, 3500));
  }

  const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s));
  function tarjetaAnuncio(a) {
    const icono = (typeof iconosCategoria !== "undefined" && iconosCategoria[a.categoria]) || "📦";
    const foto = typeof urlSegura === "function" ? urlSegura(a.imagen) : "";
    return `<a class="di-card" href="anuncio.html?id=${E(a.id)}">
      <div class="di-foto">${icono}${foto ? `<img src="${E(foto)}" alt="" loading="lazy">` : ""}${a.precio ? `<span class="di-precio">${E(a.precio)}</span>` : ""}</div>
      <div class="di-txt"><b>${E(a.nombre)}</b><small>${E(a.ciudad || a.barrio || "")}</small></div></a>`;
  }
  function tarjetaComercio(c) {
    const t = typeof TIPOS_COMERCIO !== "undefined" ? TIPOS_COMERCIO.find(x => x.id === c.tipo) : null;
    const foto = typeof urlSegura === "function" ? urlSegura(c.foto) : "";
    return `<a class="di-card" href="tienda.html?id=${E(c.id)}">
      <div class="di-foto">${E(t ? t.icono : "🏪")}${foto ? `<img src="${E(foto)}" alt="" loading="lazy">` : ""}${c.nivel >= 2 ? '<span class="di-chip v">✔ Verificado</span>' : ""}</div>
      <div class="di-txt"><b>${E(c.nombre)}</b><small>${E(t ? t.nombre : "Comercio")} · ${E(c.ciudad)}</small></div></a>`;
  }
  function llenar(idSec, idPista, items, fn) {
    const sec = document.getElementById(idSec), pista = document.getElementById(idPista);
    if (!sec || !pista) return;
    sec.classList.toggle("hidden", !items.length);
    pista.innerHTML = items.map(fn).join("");
    if (items.length) autoAvanzar(pista);
  }
  // La llama app.js cada vez que cambian los anuncios o los comercios
  window.pintarInicioNuevo = function () {
    if (!activo()) return;
    const an = typeof baseDatosAnuncios !== "undefined" ? baseDatosAnuncios : [];
    const co = typeof comercios !== "undefined" ? comercios : [];
    llenar("inicio-recientes", "inicio-recientes-pista", an.slice(0, 10), tarjetaAnuncio);
    const orden = co.slice().sort((a, b) => (b.nivel || 0) - (a.nivel || 0)).slice(0, 10);
    llenar("inicio-comercios", "inicio-comercios-pista", orden, tarjetaComercio);
  };

  // ---------- Eventos ----------
  document.addEventListener("click", e => {
    if (!activo()) return;
    const b = e.target.closest("[data-ir]");
    if (b) { e.preventDefault(); ir(b.dataset.ir); return; }
    const lm = e.target.closest("#lm-caja [data-lm]");
    if (lm) modoListaMapa(lm.dataset.lm);
    // Enlaces internos de otras partes que apuntan a una sección
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      const id = a.getAttribute("href").slice(1);
      const dest = { "seccion-foro": "foro", foro: "foro", "seccion-comercios": "comercios", comercios: "comercios", contenido: "clasificados", clasificados: "clasificados" }[id];
      if (dest) { e.preventDefault(); ir(dest); }
    }
  });
  // Buscar o elegir categoría → nos quedamos en Clasificados
  document.addEventListener("DOMContentLoaded", () => {
    if (!activo()) return;
    const v0 = html.getAttribute("data-v") || "inicio";
    ir(v0, { sinHash: true });
    window.scrollTo(0, 0);
    // Chips del hero de Inicio llevan a Clasificados
    const car = document.getElementById("carrusel");
    if (car) car.addEventListener("click", e => { if (e.target.closest("a[href='#contenido'],a[href='#clasificados']")) ir("clasificados"); });
  });
  window.addEventListener("hashchange", () => {
    if (!activo()) return;
    const m = { "": "inicio", "#clasificados": "clasificados", "#contenido": "clasificados", "#comercios": "comercios", "#seccion-comercios": "comercios", "#foro": "foro", "#seccion-foro": "foro" }[location.hash];
    if (m) ir(m, { sinHash: true });
  });
})();
