// ===== MercaFree · Selector de íconos «Elegir 😀» (fase 2Z.3 / 2Z.5) =====
// Compartido por «Editar inicio», Moderación y Comercios. Uso: poner junto al campo del ícono
//   <div class="flex items-center"><input data-emoji …>${BOTON_EMOJI}</div>
// El botón abre una ventana con íconos que se buscan por palabra en español («auto» → 🚗).
// Al elegir, llena el <input data-emoji> que está junto al botón y avisa con el evento «input».
const BOTON_EMOJI = '<button type="button" data-elegir-emoji class="ml-1 shrink-0 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5">Elegir 😀</button>';

const EMOJIS = [
  ["🚗", "auto carro coche vehiculo"], ["🏍️", "moto motocicleta"], ["🛵", "scooter moto domicilio"], ["🚲", "bicicleta bici"], ["🚕", "taxi"], ["🚚", "camion trasteo mudanza acarreo"], ["🛞", "llanta rueda"], ["⛽", "gasolina estacion bomba"], ["🔧", "taller mecanico herramienta llave"],
  ["🏪", "tienda negocio comercio barrio"], ["🛒", "mercado supermercado compras carrito"], ["🛍️", "compras vitrina bolsa"], ["🏬", "centro comercial almacen"], ["🏦", "banco"], ["🏧", "cajero plata dinero"], ["💵", "dinero efectivo plata precio"], ["💳", "tarjeta pago"], ["🏷️", "oferta precio etiqueta descuento"], ["🎁", "regalo promo"],
  ["💊", "farmacia drogueria medicina pastillas"], ["🩺", "salud medico doctor"], ["🦷", "dentista odontologia"], ["👓", "optica gafas"], ["💉", "vacuna inyeccion"], ["🧴", "cuidado personal crema"], ["💄", "belleza maquillaje"], ["💇", "peluqueria corte cabello"], ["💅", "unas manicure"], ["💈", "barberia"],
  ["🍔", "hamburguesa comida rapida"], ["🍕", "pizza"], ["🌭", "perro caliente salchicha puesto"], ["🍟", "papas fritas"], ["🌮", "taco"], ["🥟", "empanada"], ["🫓", "arepa"], ["🍗", "pollo asado"], ["🥩", "carne carniceria"], ["🍖", "asado"], ["🍲", "sopa almuerzo restaurante"], ["🍽️", "restaurante comida plato"], ["🍳", "desayuno huevo"],
  ["🥖", "pan panaderia"], ["🍰", "postre torta pasteleria"], ["🎂", "torta cumpleaños"], ["🧁", "cupcake ponque"], ["🍩", "dona"], ["🍦", "helado heladeria"], ["🍫", "chocolate dulces"], ["🍬", "dulce mecato"], ["☕", "cafe cafeteria tinto"], ["🧃", "jugo"], ["🥤", "gaseosa bebida"], ["🍺", "cerveza"], ["🍻", "bar cerveza rumba"], ["🍷", "vino licor"], ["🍸", "coctel bar"], ["🥃", "licor trago"],
  ["🍎", "fruta manzana fruver"], ["🥕", "verdura zanahoria fruver"], ["🥑", "aguacate"], ["🍌", "banano platano"], ["🍅", "tomate"], ["🥬", "lechuga verdura"], ["🧀", "queso lacteos"], ["🥛", "leche lacteos"], ["🥚", "huevos"], ["🌽", "mazorca maiz"],
  ["📱", "celular telefono tecnologia"], ["💻", "computador portatil laptop"], ["🖥️", "computador pantalla"], ["📺", "televisor tv"], ["🎧", "audifonos"], ["📷", "camara foto"], ["🎮", "videojuego consola juego"], ["🔌", "electrodomestico enchufe"], ["🔋", "bateria"], ["🖨️", "impresora papeleria"],
  ["🏠", "casa hogar inicio"], ["🏡", "casa inmueble arriendo"], ["🏢", "apartamento edificio oficina"], ["🔑", "llave arriendo cerrajero"], ["🛋️", "mueble sofa hogar"], ["🛏️", "cama colchon"], ["🪑", "silla mueble"], ["🧹", "aseo limpieza"], ["🧺", "lavanderia ropa"], ["🪴", "planta jardin"], ["🌻", "flores floristeria"],
  ["🛠️", "oficios herramientas arreglos"], ["🔨", "martillo ferreteria construccion"], ["🔩", "ferreteria tornillo"], ["🪚", "carpinteria sierra"], ["🧱", "construccion ladrillo"], ["🎨", "pintura arte"], ["⚡", "electricista luz"], ["🚰", "plomero agua"], ["🧰", "caja herramientas tecnico"],
  ["👕", "ropa camiseta"], ["👗", "vestido ropa mujer"], ["👖", "jean pantalon"], ["👟", "tenis zapatos calzado"], ["👠", "tacones zapatos"], ["👜", "bolso cartera"], ["🧵", "costura sastreria"], ["⌚", "reloj"], ["💍", "joyeria anillo"],
  ["🐕", "perro mascota"], ["🐈", "gato mascota"], ["🦴", "mascotas veterinaria"], ["🐾", "mascotas huellas"], ["🐄", "vaca ganado campo"], ["🐔", "gallina campo"], ["🌱", "agro campo semillas"], ["🚜", "tractor finca agro"],
  ["👶", "bebe ninos"], ["🧸", "juguete oso ninos"], ["⚽", "futbol deporte balon"], ["🏋️", "gimnasio pesas"], ["🎸", "guitarra musica"], ["🎹", "piano teclado musica"], ["🎤", "microfono karaoke"], ["📚", "libros educacion"], ["✏️", "papeleria utiles"], ["🎓", "clases estudio"], ["🎉", "fiesta evento"], ["🎈", "globos fiesta"], ["🏨", "hotel hospedaje"], ["⛺", "camping"],
  ["💼", "empleo trabajo"], ["📢", "publicar anuncio"], ["🤝", "recomendar acuerdo"], ["📍", "ubicacion mapa"], ["🗺️", "mapa directorio"], ["🔍", "buscar"], ["⭐", "estrella destacado"], ["🔥", "oferta caliente"], ["✨", "nuevo brillo"], ["❤️", "favorito"], ["✅", "verificado"], ["🆕", "nuevo"], ["💯", "calidad"], ["🛡️", "seguridad confianza"], ["📦", "otros paquete envio"]
];
function emojisConCategorias() {
  const extra = TIPOS_COMERCIO.map(t => [t.icono, normalizar(t.nombre + " " + [].concat(t.palabras || []).join(" ")).replace(/[^a-z0-9ñ ]+/g, " ")])
    .concat(CATEGORIAS.filter(c => c.id !== "todos").map(c => [c.icono, normalizar(c.nombre + " " + [].concat(c.palabras || []).join(" ")).replace(/[^a-z0-9ñ ]+/g, " ")]));
  const mapa = new Map();
  EMOJIS.concat(extra).forEach(([e, k]) => { if (e) mapa.set(e, ((mapa.get(e) || "") + " " + k).trim()); });
  return [...mapa.entries()];
}
let inputEmoji = null;
function abrirSelectorEmoji(btn) {
  inputEmoji = btn.parentElement.querySelector("[data-emoji]");
  if (!inputEmoji) return;
  $("emoji-buscar").value = "";
  pintarEmojis("");
  $("emoji-pop").classList.remove("hidden");
  $("emoji-buscar").focus();
}
function pintarEmojis(q) {
  const n = normalizar(q.trim());
  const lista = emojisConCategorias().filter(([e, k]) => !n || k.split(" ").some(p => p.startsWith(n)) || normalizar(k).includes(n));
  $("emoji-grid").innerHTML = lista.length
    ? lista.map(([e, k]) => `<button type="button" data-emoji-valor="${esc(e)}" title="${esc(k)}" class="emoji-opcion">${esc(e)}</button>`).join("")
    : '<p class="col-span-full text-sm text-slate-400 text-center py-4">Sin resultados. Prueba otra palabra, o escribe el emoji con el teclado del celular.</p>';
}
function elegirEmoji(e) {
  const b = e.target.closest("[data-emoji-valor]");
  if (!b || !inputEmoji) return;
  inputEmoji.value = b.dataset.emojiValor;
  inputEmoji.dispatchEvent(new Event("input", { bubbles: true }));
  $("emoji-pop").classList.add("hidden");
}

(function () {
  function crearVentana() {
    if (document.getElementById("emoji-pop")) return;
    document.body.insertAdjacentHTML("beforeend", `<div id="emoji-pop" class="hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="emoji-titulo">
    <div class="absolute inset-0 bg-slate-900/50" data-emoji-cerrar></div>
    <div class="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between mb-2">
        <h3 id="emoji-titulo" class="font-black text-indigo-900">Elige un ícono</h3>
        <button type="button" data-emoji-cerrar class="text-2xl text-slate-400 hover:text-slate-700" aria-label="Cerrar">&times;</button>
      </div>
      <input id="emoji-buscar" type="search" placeholder="Busca por palabra: auto, comida, farmacia…" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2">
      <div id="emoji-grid" class="grid grid-cols-7 sm:grid-cols-8 gap-1 overflow-auto"></div>
      <p class="text-[11px] text-slate-400 mt-2">También puedes escribir cualquier emoji con el teclado del celular (😀).</p>
    </div>
  </div>`);
    $("emoji-buscar").addEventListener("input", e => pintarEmojis(e.target.value));
    $("emoji-grid").addEventListener("click", elegirEmoji);
    $("emoji-pop").addEventListener("click", e => { if (e.target.closest("[data-emoji-cerrar]")) $("emoji-pop").classList.add("hidden"); });
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-elegir-emoji]"); if (b) { crearVentana(); abrirSelectorEmoji(b); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("emoji-pop")) $("emoji-pop").classList.add("hidden"); });
})();
