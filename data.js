// ===== MercaFree - Datos y almacenamiento (localStorage) =====
// Requiere utils.js cargado antes.
//
// APRENDE: hoy los datos viven en localStorage (solo en TU navegador).
// Todo el acceso a datos pasa por las funciones de este archivo
// (cargarDatos, guardarAnuncios, guardarUsuario). En la Fase 2 solo hay que
// reescribir ESTE archivo para hablar con Supabase; el resto de la app casi no cambia.

const VERSION_DATOS = 2; // súbela cuando cambies los datos de ejemplo

const DEPARTAMENTOS = {
  "Antioquia": ["Medellín", "Envigado", "Sabaneta", "Itagüí", "Bello", "Rionegro", "La Estrella", "Caldas", "Copacabana"],
  "Cundinamarca": ["Bogotá", "Soacha", "Chía", "Zipaquirá", "Facatativá"],
  "Valle del Cauca": ["Cali", "Palmira", "Buenaventura", "Tuluá"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón"]
};

// ÚNICA fuente de verdad de categorías (antes estaban copiadas en index.html,
// en el formulario, en el foro y aquí). `foro: true` = también sale en el foro.
const CATEGORIAS = [
  { id: "todos",      nombre: "Todos",       icono: "🏠", foro: true  },
  { id: "tienda",     nombre: "Tiendas",     icono: "🍎", foro: false },
  { id: "comida",     nombre: "Comida",      icono: "🍔", foro: false },
  { id: "autos",      nombre: "Autos",       icono: "🚗", foro: true  },
  { id: "inmuebles",  nombre: "Inmuebles",   icono: "🏡", foro: true  },
  { id: "tecnologia", nombre: "Tecnología",  icono: "📱", foro: true  },
  { id: "servicios",  nombre: "Oficios",     icono: "🛠️", foro: true  },
  { id: "ferreteria", nombre: "Ferretería",  icono: "🔩", foro: false },
  { id: "hogar",      nombre: "Hogar",       icono: "🛋️", foro: true  },
  { id: "mascotas",   nombre: "Mascotas",    icono: "🐕", foro: false },
  { id: "empleos",    nombre: "Empleos",     icono: "💼", foro: false },
  { id: "ropa",       nombre: "Ropa",        icono: "👕", foro: false },
  { id: "otros",      nombre: "Otros",       icono: "📦", foro: true  }
];

// Las categorías del foro se DERIVAN de la lista de arriba (no se repiten).
const CATEGORIAS_FORO = CATEGORIAS
  .filter(c => c.foro)
  .map(c => (c.id === "todos" ? { ...c, icono: "💬" } : c));

const iconosCategoria = {};
CATEGORIAS.forEach(c => { iconosCategoria[c.id] = c.icono; });

let baseDatosAnuncios = [];
let usuarioActual = null;

// ---------- Datos de ejemplo ----------
// Las fotos del iPhone y las empanadas estaban mal (salía una moto y samosas).
// Las dejo vacías: la tarjeta muestra el icono de la categoría. Sube una foto
// real tuya con "Editar" o cambia la URL aquí. (No puedo comprobar desde aquí
// que una URL de Unsplash muestre lo que dice: hazlo tú abriéndola.)
function anunciosSemilla() {
  const ahora = Date.now();
  return [
    { id: 1, nombre: "Ferretería El Martillo", categoria: "ferreteria", estado: "usado",
      departamento: "Antioquia", ciudad: "Envigado", barrio: "Envigado Centro",
      lat: 6.1759, lng: -75.5917, whatsapp: "573001234567", precio: "",
      desc: "Todo en tornillería, herramientas y pinturas para el hogar.",
      fotos: ["https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600"], owner: null, fecha: ahora - 100000 },
    { id: 2, nombre: "Mazda 3 2019", categoria: "autos", estado: "usado",
      departamento: "Antioquia", ciudad: "Sabaneta", barrio: "Sabaneta",
      lat: 6.1517, lng: -75.6164, whatsapp: "573005551234", precio: "$68.500.000",
      desc: "Excelente estado, 45.000 km, único dueño. Papeles al día.",
      fotos: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600"], owner: null, fecha: ahora - 90000 },
    { id: 3, nombre: "Apartamento 3 habitaciones", categoria: "inmuebles", estado: "usado",
      departamento: "Antioquia", ciudad: "Envigado", barrio: "El Portal",
      lat: 6.1765, lng: -75.5900, whatsapp: "573001112222", precio: "$1.850.000",
      desc: "Amplio, con parqueadero y terraza. Disponible inmediato.",
      fotos: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600"], owner: null, fecha: ahora - 80000 },
    { id: 4, nombre: "iPhone 14 Pro 256GB", categoria: "tecnologia", estado: "usado",
      departamento: "Antioquia", ciudad: "Medellín", barrio: "El Poblado",
      lat: 6.2100, lng: -75.5700, whatsapp: "573003334444", precio: "$3.200.000",
      desc: "Como nuevo, batería 94%. Caja y accesorios originales.",
      fotos: [], owner: null, fecha: ahora - 70000 },
    { id: 5, nombre: "Empanadas La Abuela", categoria: "comida", estado: "nuevo",
      departamento: "Antioquia", ciudad: "Envigado", barrio: "La Paz",
      lat: 6.1720, lng: -75.5850, whatsapp: "573004443333", precio: "$2.500",
      desc: "Las mejores empanadas del barrio. También hay jugos naturales.",
      fotos: [], owner: null, fecha: ahora - 60000 },
    { id: 6, nombre: "Sofá 3 puestos nuevo", categoria: "hogar", estado: "nuevo",
      departamento: "Antioquia", ciudad: "Itagüí", barrio: "Ditaires",
      lat: 6.1725, lng: -75.6100, whatsapp: "573006667777", precio: "$1.450.000",
      desc: "Sofá nuevo en caja, color gris. Entrega en el Valle de Aburrá.",
      fotos: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600"], owner: null, fecha: ahora - 50000 }
  ];
}

// Deja cada anuncio con la forma esperada. Así los anuncios viejos (con `imagen`
// y sin `fotos`) siguen funcionando: esto se llama "migración de datos".
function normalizarAnuncio(a) {
  const fotos = Array.isArray(a.fotos) ? a.fotos : (a.imagen ? [a.imagen] : []);
  return {
    ...a,
    id: Number(a.id),
    fotos: fotos.filter(Boolean),
    imagen: fotos.filter(Boolean)[0] || "",   // portada (la usan las tarjetas)
    lat: parseFloat(a.lat),
    lng: parseFloat(a.lng),
    whatsapp: String(a.whatsapp || "").replace(/\D/g, ""),
    fecha: a.fecha || a.id
  };
}

// ---------- Cargar / guardar ----------
function cargarDatos() {
  try {
    let lista = JSON.parse(localStorage.getItem("mercafree_anuncios") || "null");
    const version = parseInt(localStorage.getItem("mercafree_version"), 10) || 1;

    if (!Array.isArray(lista)) {
      lista = anunciosSemilla();
    } else if (version < VERSION_DATOS) {
      // Actualiza solo los anuncios de ejemplo (ids 1-6); respeta los del usuario.
      const semilla = anunciosSemilla();
      const idsSemilla = semilla.map(s => s.id);
      lista = [...lista.filter(a => !idsSemilla.includes(Number(a.id))), ...semilla];
    }
    baseDatosAnuncios = lista.map(normalizarAnuncio);
    localStorage.setItem("mercafree_version", String(VERSION_DATOS));
    guardarAnuncios();
  } catch (e) {
    console.error("Error cargando datos:", e);
    baseDatosAnuncios = anunciosSemilla().map(normalizarAnuncio);
  }
  cargarUsuario();
}

function cargarUsuario() {
  try {
    const u = localStorage.getItem("mercafree_usuario");
    usuarioActual = u ? JSON.parse(u) : null;
  } catch (e) {
    usuarioActual = null;
  }
}

// localStorage tiene ~5 MB. Las fotos en base64 lo llenan rápido; si se llena,
// setItem LANZA un error. Antes no se capturaba y la app "fingía" guardar.
// Ahora devolvemos true/false para que quien llama pueda avisar al usuario.
function guardarAnuncios() {
  try {
    localStorage.setItem("mercafree_anuncios", JSON.stringify(baseDatosAnuncios));
    return true;
  } catch (e) {
    console.error("No se pudo guardar:", e);
    mostrarToast("⚠️ No hay espacio para guardar. Usa menos fotos o borra anuncios.", "error");
    return false;
  }
}

function guardarUsuario(user) {
  usuarioActual = user;
  try {
    if (user) localStorage.setItem("mercafree_usuario", JSON.stringify(user));
    else localStorage.removeItem("mercafree_usuario");
  } catch (e) { /* modo privado: la sesión dura solo mientras la pestaña esté abierta */ }
}
