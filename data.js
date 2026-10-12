// ===== MercaFree - Datos y localStorage =====

const DEPARTAMENTOS = {
  "Antioquia": ["Medellín", "Envigado", "Sabaneta", "Itagüí", "Bello", "Rionegro", "La Estrella", "Caldas", "Copacabana"],
  "Cundinamarca": ["Bogotá", "Soacha", "Chía", "Zipaquirá", "Facatativá"],
  "Valle del Cauca": ["Cali", "Palmira", "Buenaventura", "Tuluá"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón"]
};

const CATEGORIAS = [
  { id: "todos", nombre: "🏠 Todos", icono: "🏠" },
  { id: "tienda", nombre: "🍎 Tiendas", icono: "🍎" },
  { id: "comida", nombre: "🍔 Comida", icono: "🍔" },
  { id: "autos", nombre: "🚗 Autos", icono: "🚗" },
  { id: "inmuebles", nombre: "🏡 Inmuebles", icono: "🏡" },
  { id: "tecnologia", nombre: "📱 Tecnología", icono: "📱" },
  { id: "servicios", nombre: "🛠️ Oficios", icono: "🛠️" },
  { id: "ferreteria", nombre: "🔩 Ferretería", icono: "🔩" },
  { id: "hogar", nombre: "🛋️ Hogar", icono: "🛋️" },
  { id: "mascotas", nombre: "🐕 Mascotas", icono: "🐕" },
  { id: "empleos", nombre: "💼 Empleos", icono: "💼" },
  { id: "ropa", nombre: "👕 Ropa", icono: "👕" },
  { id: "otros", nombre: "📦 Otros", icono: "📦" }
];

const iconosCategoria = {};
CATEGORIAS.forEach(c => { iconosCategoria[c.id] = c.icono; });

let baseDatosAnuncios = [];
let usuarioActual = null;

function cargarDatos() {
  try {
    const guardados = localStorage.getItem("mercafree_anuncios");
    if (guardados) {
      baseDatosAnuncios = JSON.parse(guardados);
    } else {
      baseDatosAnuncios = [
        {
          id: 1,
          nombre: "Ferretería El Martillo",
          categoria: "ferreteria",
          estado: "usado",
          departamento: "Antioquia",
          ciudad: "Envigado",
          barrio: "Envigado Centro",
          lat: 6.1759,
          lng: -75.5917,
          whatsapp: "573001234567",
          precio: "",
          desc: "Todo en tornillería, herramientas y pinturas para el hogar.",
          imagen: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400",
          owner: null,
          fecha: Date.now() - 100000
        },
        {
          id: 2,
          nombre: "Mazda 3 2019",
          categoria: "autos",
          estado: "usado",
          departamento: "Antioquia",
          ciudad: "Sabaneta",
          barrio: "Sabaneta",
          lat: 6.1517,
          lng: -75.6164,
          whatsapp: "573005551234",
          precio: "$68.500.000",
          desc: "Excelente estado, 45.000 km, único dueño. Papeles al día.",
          imagen: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400",
          owner: null,
          fecha: Date.now() - 90000
        },
        {
          id: 3,
          nombre: "Apartamento 3 habitaciones",
          categoria: "inmuebles",
          estado: "usado",
          departamento: "Antioquia",
          ciudad: "Envigado",
          barrio: "El Portal",
          lat: 6.1765,
          lng: -75.5900,
          whatsapp: "573001112222",
          precio: "$1.850.000",
          desc: "Amplio, con parqueadero y terraza. Disponible inmediato.",
          imagen: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400",
          owner: null,
          fecha: Date.now() - 80000
        },
        {
          id: 4,
          nombre: "iPhone 14 Pro 256GB",
          categoria: "tecnologia",
          estado: "usado",
          departamento: "Antioquia",
          ciudad: "Medellín",
          barrio: "El Poblado",
          lat: 6.2100,
          lng: -75.5700,
          whatsapp: "573003334444",
          precio: "$3.200.000",
          desc: "Como nuevo, batería 94%. Caja y accesorios originales.",
          imagen: "https://images.unsplash.com/photo-1678652197831-2d1807054202?w=400",
          owner: null,
          fecha: Date.now() - 70000
        },
        {
          id: 5,
          nombre: "Empanadas La Abuela",
          categoria: "comida",
          estado: "nuevo",
          departamento: "Antioquia",
          ciudad: "Envigado",
          barrio: "La Paz",
          lat: 6.1720,
          lng: -75.5850,
          whatsapp: "573004443333",
          precio: "$2.500",
          desc: "Las mejores empanadas del barrio. También hay jugos naturales.",
          imagen: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400",
          owner: null,
          fecha: Date.now() - 60000
        },
        {
          id: 6,
          nombre: "Sofá 3 puestos nuevo",
          categoria: "hogar",
          estado: "nuevo",
          departamento: "Antioquia",
          ciudad: "Itagüí",
          barrio: "Ditaires",
          lat: 6.1725,
          lng: -75.6100,
          whatsapp: "573006667777",
          precio: "$1.450.000",
          desc: "Sofá nuevo en caja, color gris. Entrega en el Valle de Aburrá.",
          imagen: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400",
          owner: null,
          fecha: Date.now() - 50000
        }
      ];
      guardarAnuncios();
    }

    const user = localStorage.getItem("mercafree_usuario");
    if (user) {
      usuarioActual = JSON.parse(user);
    }
  } catch (e) {
    console.error("Error cargando datos:", e);
  }
}

function guardarAnuncios() {
  localStorage.setItem("mercafree_anuncios", JSON.stringify(baseDatosAnuncios));
}

function guardarUsuario(user) {
  usuarioActual = user;
  if (user) {
    localStorage.setItem("mercafree_usuario", JSON.stringify(user));
  } else {
    localStorage.removeItem("mercafree_usuario");
  }
}
