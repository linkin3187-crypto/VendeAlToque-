// ===== Merkap · Carrusel de banners del inicio =====
// Desliza con el dedo (scroll-snap), flechas en pantallas grandes, puntos, y avance automático
// cada 6 s que se pausa al tocar, pasar el mouse, enfocar o cuando la pestaña no está visible.
// Si la persona pidió «reducir movimiento», no avanza solo.
// Fase 2Z.2: las diapositivas pueden venir de la base (banners_inicio). app.js las pinta y llama a
// window.carruselRefrescar(), que rehace los puntos sin duplicar eventos.
(function () {
  const pista = document.getElementById("car-pista");
  if (!pista) return;
  const slides = () => Array.from(pista.children);
  const puntos = document.getElementById("car-puntos");
  const marco = pista.parentElement;
  let actual = 0, pausado = false, temporizador = null;
  const sinMovimiento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pintarPuntos() {
    puntos.innerHTML = "";
    slides().forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "car-punto"; b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Diapositiva " + (i + 1));
      b.addEventListener("click", () => ir(i));
      puntos.appendChild(b);
    });
  }
  function marcar(i) {
    actual = i;
    Array.from(puntos.children).forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
  }
  function ir(i) {
    const n = slides().length;
    if (!n) return;
    i = (i + n) % n;
    pista.scrollTo({ left: slides()[i].offsetLeft, behavior: sinMovimiento ? "auto" : "smooth" });
    marcar(i);
  }
  // Al deslizar con el dedo, el punto activo sigue a la diapositiva más visible
  let espera = null;
  pista.addEventListener("scroll", () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const i = Math.round(pista.scrollLeft / pista.clientWidth);
      if (i !== actual && slides()[i]) marcar(i);
    }, 80);
  }, { passive: true });

  document.getElementById("car-ant").addEventListener("click", () => ir(actual - 1));
  document.getElementById("car-sig").addEventListener("click", () => ir(actual + 1));
  pista.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); ir(actual - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); ir(actual + 1); }
  });

  function arrancar() {
    detener();
    if (sinMovimiento) return;
    temporizador = setInterval(() => { if (!pausado && !document.hidden) ir(actual + 1); }, 6000);
  }
  function detener() { clearInterval(temporizador); temporizador = null; }
  ["mouseenter", "focusin", "touchstart"].forEach(ev => marco.addEventListener(ev, () => { pausado = true; }, { passive: true }));
  ["mouseleave", "focusout"].forEach(ev => marco.addEventListener(ev, () => { pausado = false; }));
  marco.addEventListener("touchend", () => { setTimeout(() => { pausado = false; }, 4000); }, { passive: true });
  window.addEventListener("resize", () => { const s = slides()[actual]; if (s) pista.scrollTo({ left: s.offsetLeft, behavior: "auto" }); });

  // Llamar después de cambiar las diapositivas
  window.carruselRefrescar = function () {
    pintarPuntos();
    pista.scrollTo({ left: 0, behavior: "auto" });
    marcar(0);
    arrancar();
  };

  pintarPuntos();
  marcar(0);
  arrancar();
})();
