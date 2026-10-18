// ===== Merkap · Barra inferior tipo app (Fase 2Y) =====
// Solo en celular y tablet (en computador se oculta con CSS). Se activa en las páginas cuyo <body>
// tiene data-nav="inicio|comercios|favoritos|…" y se carga después de utils.js y data.js.
// 🏠 Inicio · 🏪 Comercios · ( ＋ ) · ❤️ Favoritos · 👤 Yo/Entrar
// El ＋ abre un menú desde abajo: publicar, recomendar un comercio, registrar negocio, mi tienda.
// No se usa en la ficha de un anuncio ni en la tienda (esas páginas tienen su propia barra de contacto/pedido).
(function () {
  const pagina = document.body && document.body.dataset.nav;
  if (!pagina) return;
  const enInicio = !!document.getElementById("modal-publicar");   // el formulario de publicar vive en el inicio

  const ICONOS = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    comercios: '<path d="M4 9h16l-1.2-4.2A1 1 0 0 0 17.8 4H6.2a1 1 0 0 0-1 .8z"/><path d="M5 9v11h14V9"/><path d="M10 20v-5h4v5"/>',
    favoritos: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    yo: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  const svg = k => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[k]}</svg>`;
  const tab = (k, href, txt) => `<a href="${href}" class="ni-tab" data-tab="${k}"${pagina === k ? ' aria-current="page"' : ""}>${svg(k)}<span>${txt}</span></a>`;

  const nav = document.createElement("nav");
  nav.id = "nav-inferior";
  nav.className = "nav-inferior";
  nav.setAttribute("aria-label", "Navegación principal");
  nav.innerHTML =
    tab("inicio", "index.html", "Inicio") +
    tab("comercios", "comercios.html", "Comercios") +
    `<div class="ni-centro"><button type="button" id="ni-mas" class="ni-mas" aria-haspopup="dialog" aria-label="Publicar, recomendar o registrar">＋</button><span>Publicar</span></div>` +
    tab("favoritos", "favoritos.html", "Favoritos") +
    `<button type="button" id="ni-yo" class="ni-tab" data-tab="yo"${pagina === "yo" ? ' aria-current="page"' : ""}>${svg("yo")}<span id="ni-yo-txt">Entrar</span></button>`;
  document.body.appendChild(nav);
  document.body.classList.add("con-nav");

  // Menú que sube desde abajo (lo usan ＋ y 👤)
  const hoja = document.createElement("div");
  hoja.id = "ni-hoja";
  hoja.className = "ni-hoja hidden";
  hoja.setAttribute("role", "dialog");
  hoja.setAttribute("aria-modal", "true");
  hoja.setAttribute("aria-labelledby", "ni-hoja-titulo");
  hoja.innerHTML = '<div class="ni-fondo" data-ni-cerrar></div><div class="ni-panel"><div class="ni-agarre" aria-hidden="true"></div><p id="ni-hoja-titulo" class="ni-titulo"></p><div id="ni-opciones"></div><button type="button" class="ni-cerrar" data-ni-cerrar>Cerrar ✕</button></div>';
  document.body.appendChild(hoja);

  const conSesion = () => typeof usuarioActual !== "undefined" && !!usuarioActual;
  const opcion = (icono, txt, sub, attrs) => `<${attrs.href ? "a" : "button type=\"button\""} class="ni-opcion" ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(" ")}><span class="ni-op-ico">${icono}</span><span><b>${esc(txt)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></${attrs.href ? "a" : "button"}>`;

  function abrirHoja(tipo) {
    let titulo = "", html = "";
    if (tipo === "mas") {
      titulo = "¿Qué quieres hacer?";
      html += enInicio
        ? opcion("📢", "Publicar un anuncio", "Gratis, en 1 minuto", { "data-abrir": "modal-publicar", "data-requiere-login": "", "data-auth-modo": "registro" })
        : opcion("📢", "Publicar un anuncio", "Gratis, en 1 minuto", { href: "index.html#publicar" });
      html += opcion("🤝", "Recomendar un comercio", "Tiendas, restaurantes, bares, puestos de comida…", { href: "recomendar.html" });
      html += opcion("🏪", "Registrar mi negocio", "Aparece en el mapa y abre tu vitrina", { href: "registrar-negocio.html" });
      if (conSesion()) html += opcion("🛍️", "Mi tienda", "Datos y productos de tu negocio", { href: "mi-tienda.html" });
    } else {
      const u = usuarioActual;
      titulo = "👤 " + (u.nombre || "Mi cuenta");
      html += opcion("📋", "Mis anuncios", "Editar, renovar o borrar", enInicio ? { "data-ni-accion": "mis-anuncios" } : { href: "index.html#mis-anuncios" });
      html += opcion("🙋", "Mi perfil público", "Cómo te ven los compradores", { href: "vendedor.html?id=" + encodeURIComponent(u.id) });
      html += opcion("❤️", "Mis favoritos", "", { href: "favoritos.html" });
      html += opcion("🛍️", "Mi tienda", "Si tienes un negocio registrado", { href: "mi-tienda.html" });
      html += opcion("🚪", "Cerrar sesión", "", { "data-ni-accion": "salir" });
    }
    document.getElementById("ni-hoja-titulo").textContent = titulo;
    document.getElementById("ni-opciones").innerHTML = html;
    hoja.classList.remove("hidden");
    document.body.classList.add("ni-hoja-abierta");
    const primero = hoja.querySelector(".ni-opcion");
    if (primero) primero.focus();
  }
  function cerrarHoja() {
    hoja.classList.add("hidden");
    document.body.classList.remove("ni-hoja-abierta");
  }

  document.getElementById("ni-mas").addEventListener("click", () => abrirHoja("mas"));
  document.getElementById("ni-yo").addEventListener("click", () => {
    if (conSesion()) { abrirHoja("yo"); return; }
    if (enInicio && typeof abrirModal === "function") {
      document.dispatchEvent(new CustomEvent("auth:pedir", { detail: { modo: "login" } }));
      abrirModal("modal-auth");
      return;
    }
    try {
      const aqui = location.pathname.split("/").pop() || "index.html";
      if (/^[a-z-]+\.html$/.test(aqui) && aqui !== "index.html") sessionStorage.setItem("mf_volver", aqui);
    } catch (e) { /* sin almacenamiento */ }
    location.href = "index.html#login";
  });
  hoja.addEventListener("click", async e => {
    if (e.target.closest("[data-ni-cerrar]")) { cerrarHoja(); return; }
    const op = e.target.closest(".ni-opcion");
    if (!op) return;
    const accion = op.dataset.niAccion;
    if (accion === "salir") {
      cerrarHoja();
      try { await cerrarSesionDB(); } catch (err) { /* igual recargamos */ }
      location.href = "index.html";
      return;
    }
    if (accion === "mis-anuncios") {
      cerrarHoja();
      const s = document.getElementById("seccion-mis-anuncios");
      if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Enlaces y «Publicar» (data-abrir lo maneja utils.js): solo cerramos el menú
    setTimeout(cerrarHoja, 0);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !hoja.classList.contains("hidden")) cerrarHoja(); });

  // «Entrar» o «Yo» según la sesión (también cuando cambia en otra pestaña)
  const pintarYo = activa => { document.getElementById("ni-yo-txt").textContent = activa ? "Yo" : "Entrar"; };
  try { sb.auth.getSession().then(({ data }) => pintarYo(!!(data && data.session))).catch(() => {}); } catch (e) { /* sin Supabase */ }
  document.addEventListener("sesion:cambio", () => pintarYo(conSesion()));
  let intentos = 0;
  const vigilar = setInterval(() => { pintarYo(conSesion()); if (conSesion() || ++intentos > 20) clearInterval(vigilar); }, 500);

  // Con el teclado abierto la barra se esconde (deja ver lo que se escribe)
  const esCampo = el => el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !/checkbox|radio|button|submit|file|range/.test(el.type)));
  document.addEventListener("focusin", e => { if (esCampo(e.target)) document.body.classList.add("ni-teclado"); });
  document.addEventListener("focusout", () => setTimeout(() => { if (!esCampo(document.activeElement)) document.body.classList.remove("ni-teclado"); }, 120));
})();
