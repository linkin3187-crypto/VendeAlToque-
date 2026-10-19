# -*- coding: utf-8 -*-
"""Genera docs/manual-marketing-merkap.pdf (fase 2AP).

Uso:  python3 herramientas/manual_marketing.py
Requiere: pip install reportlab   (y las fuentes DejaVu, que vienen en casi todo Linux)
Para cambiar el manual edita los textos de este archivo y vuelve a correrlo.
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether, Image, NextPageTemplate)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, "docs", "manual-marketing-merkap.pdf")
LOGO = os.path.join(RAIZ, "img", "logo-merkap-512.png")
FUENTES = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("Sans", FUENTES + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-B", FUENTES + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Sans-I", FUENTES + "DejaVuSans-Oblique.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Sans", normal="Sans", bold="Sans-B", italic="Sans-I", boldItalic="Sans-B")

MORADO = colors.HexColor("#4C1D95")
MORADO_OSC = colors.HexColor("#2E1065")
AMARILLO = colors.HexColor("#F6C51A")
LILA = colors.HexColor("#F5F3FF")
GRIS = colors.HexColor("#475569")
LINEA = colors.HexColor("#DDD6FE")
VERDE = colors.HexColor("#047857")

E = {
    "cuerpo": ParagraphStyle("cuerpo", fontName="Sans", fontSize=10, leading=14.5, textColor=colors.HexColor("#1E293B"), spaceAfter=6),
    "h1": ParagraphStyle("h1", fontName="Sans-B", fontSize=19, leading=23, textColor=MORADO_OSC, spaceBefore=4, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName="Sans-B", fontSize=13, leading=17, textColor=MORADO, spaceBefore=10, spaceAfter=4),
    "vineta": ParagraphStyle("vineta", fontName="Sans", bulletFontName="Sans", fontSize=10, leading=14, leftIndent=14, bulletIndent=2, spaceAfter=3, textColor=colors.HexColor("#1E293B")),
    "nota": ParagraphStyle("nota", fontName="Sans-I", fontSize=8.8, leading=12, textColor=GRIS, spaceAfter=6),
    "celda": ParagraphStyle("celda", fontName="Sans", fontSize=8.8, leading=11.5),
    "celdaB": ParagraphStyle("celdaB", fontName="Sans-B", fontSize=8.8, leading=11.5, textColor=colors.white),
    "caja": ParagraphStyle("caja", fontName="Sans", fontSize=9.6, leading=13.5, textColor=MORADO_OSC),
    "portada_t": ParagraphStyle("pt", fontName="Sans-B", fontSize=34, leading=40, textColor=colors.white, alignment=TA_CENTER),
    "portada_s": ParagraphStyle("ps", fontName="Sans", fontSize=14, leading=20, textColor=colors.HexColor("#EDE9FE"), alignment=TA_CENTER),
    "portada_n": ParagraphStyle("pn", fontName="Sans", fontSize=10, leading=14, textColor=colors.HexColor("#C4B5FD"), alignment=TA_CENTER),
}

# DejaVu no tiene emojis de color: se quitan los caracteres que la fuente no puede dibujar
_CMAP = TTFont("tmp", FUENTES + "DejaVuSans.ttf").face.charToGlyph
def limpiar(t):
    t = "".join(ch for ch in str(t) if ch in "\n" or ord(ch) in _CMAP)
    return t.replace("  ", " ")
def Paragraph(t, estilo, **kw):
    from reportlab.platypus import Paragraph as _P
    return _P(limpiar(t), estilo, **kw)
def P(t, e="cuerpo"): return Paragraph(t, E[e])
def vinetas(items): return [Paragraph(i, E["vineta"], bulletText="•") for i in items]
def numerados(items): return [Paragraph(i, E["vineta"], bulletText=f"{n}.") for n, i in enumerate(items, 1)]

def caja(contenido, fondo=LILA, borde=LINEA):
    t = Table([[contenido]], colWidths=[170 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), fondo), ("BOX", (0, 0), (-1, -1), 0.8, borde),
                           ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                           ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    return t

def tabla(filas, anchos, encabezado=True):
    datos = [[Paragraph(str(c), E["celdaB"] if (encabezado and i == 0) else E["celda"]) for c in f] for i, f in enumerate(filas)]
    t = Table(datos, colWidths=[a * mm for a in anchos], repeatRows=1 if encabezado else 0)
    estilo = [("GRID", (0, 0), (-1, -1), 0.5, LINEA), ("VALIGN", (0, 0), (-1, -1), "TOP"),
              ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
              ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if encabezado:
        estilo += [("BACKGROUND", (0, 0), (-1, 0), MORADO)]
        estilo += [("BACKGROUND", (0, i), (-1, i), LILA) for i in range(2, len(filas), 2)]
    t.setStyle(TableStyle(estilo))
    return t

def estrategia(n, titulo, que, pasos, medir):
    bloque = [P(f"{n}. {titulo}", "h2"), P(que)]
    bloque += numerados(pasos)
    bloque.append(caja(P(f"<b>Qué medir:</b> {medir}", "caja")))
    bloque.append(Spacer(1, 4))
    return KeepTogether(bloque)

# ---------- Páginas ----------
ANCHO, ALTO = letter

def portada(c, doc):
    c.saveState()
    c.setFillColor(MORADO_OSC); c.rect(0, 0, ANCHO, ALTO, fill=1, stroke=0)
    c.setFillColor(MORADO); c.circle(ANCHO * .92, ALTO * .9, 190, fill=1, stroke=0)
    c.setFillColor(AMARILLO); c.circle(ANCHO * .06, ALTO * .12, 120, fill=1, stroke=0)
    c.restoreState()

def interior(c, doc):
    c.saveState()
    c.setFillColor(MORADO); c.rect(0, ALTO - 14 * mm, ANCHO, 14 * mm, fill=1, stroke=0)
    c.setFillColor(AMARILLO); c.rect(0, ALTO - 15.2 * mm, ANCHO, 1.2 * mm, fill=1, stroke=0)
    c.drawImage(LOGO, 20 * mm, ALTO - 12 * mm, 10 * mm, 10 * mm, mask="auto")
    c.setFillColor(colors.white); c.setFont("Sans-B", 11); c.drawString(33 * mm, ALTO - 8.6 * mm, "Merkap · Manual de marketing")
    c.setFont("Sans", 8.5); c.drawRightString(ANCHO - 20 * mm, ALTO - 8.6 * mm, "Uso interno del administrador")
    c.setFillColor(GRIS); c.setFont("Sans", 8)
    c.drawString(20 * mm, 10 * mm, "Centro de marketing: Inicio → barra del administrador → 📣 Marketing".replace("📣 ", ""))
    c.drawRightString(ANCHO - 20 * mm, 10 * mm, f"Página {doc.page}")
    c.restoreState()

def construir():
    doc = BaseDocTemplate(SALIDA, pagesize=letter, title="Manual de marketing Merkap", author="Merkap",
                          subject="Cómo usar el Centro de marketing y sacarle el jugo",
                          leftMargin=20 * mm, rightMargin=20 * mm, topMargin=24 * mm, bottomMargin=18 * mm)
    marco_portada = Frame(20 * mm, 20 * mm, ANCHO - 40 * mm, ALTO - 40 * mm, id="p")
    marco = Frame(20 * mm, 18 * mm, ANCHO - 40 * mm, ALTO - 42 * mm, id="i")
    doc.addPageTemplates([PageTemplate(id="portada", frames=[marco_portada], onPage=portada),
                          PageTemplate(id="interior", frames=[marco], onPage=interior)])
    h = []

    # ---------- Portada ----------
    h += [Spacer(1, 45 * mm), Image(LOGO, 46 * mm, 46 * mm), Spacer(1, 12 * mm),
          P("Manual de marketing", "portada_t"), Spacer(1, 4 * mm),
          P("Cómo usar el Centro de marketing de Merkap<br/>y sacarle el jugo en WhatsApp, Facebook, Instagram y la calle", "portada_s"),
          Spacer(1, 30 * mm), P("Versión 1 · octubre de 2026 · Fase 2AP", "portada_n"),
          NextPageTemplate("interior"), PageBreak()]

    # ---------- 1. La meta ----------
    h += [P("1. Para qué sirve este manual", "h1"),
          P("Merkap gana cuando pasan tres cosas: <b>la gente entra</b>, <b>se queda</b> (crea cuenta, publica o registra su negocio) y <b>contacta</b> a un comercio o vendedor. "
            "Todo lo que publiques en redes debe empujar una de esas tres cosas, y cada enlace debe llevar su código para saber qué funcionó."),
          tabla([["Número", "Qué significa", "Dónde lo ves"],
                 ["Personas que entran", "Visitas reales, por canal (WhatsApp, Facebook, QR…)", "📊 Métricas → De dónde llegan"],
                 ["Cuentas nuevas por código", "Quién se registró después de tocar tu enlace (30 días)", "📣 Marketing → Cuentas nuevas por código"],
                 ["Anuncios y comercios nuevos", "Lo que esas cuentas publicaron o registraron", "📣 Marketing (columnas) y 📊 Métricas → Nuevos"],
                 ["Contactos", "Toques en WhatsApp, Llamar o Cómo llegar", "📊 Métricas → Contactos por día"]],
                [42, 70, 58]),
          Spacer(1, 6),
          caja(P("<b>Metas de ejemplo para los primeros 30 días del piloto</b> (ajústalas a tu realidad): 50 comercios en el mapa · 300 cuentas nuevas · 100 anuncios activos · "
                 "1 contacto por cada 10 visitas. Lo importante no es el número exacto sino ver <b>cada semana</b> si sube.", "caja")),
          ]

    # ---------- 2. Cómo usar el panel ----------
    h += [P("2. El Centro de marketing en 4 pasos", "h1"),
          P("Lo encuentras en la página de inicio, en la barra amarilla del administrador (<b>📣 Marketing</b>), en el menú de tu cuenta y en Moderación, Métricas y Editar inicio."),
          *numerados([
              "<b>Elige el destino:</b> Inicio, Regístrate gratis, Publica un anuncio gratis, Recomienda un negocio, Registra tu negocio, Directorio (por tipo), una categoría, la vitrina de un comercio, un anuncio o cualquier otra página de Merkap.",
              "<b>Elige dónde lo vas a compartir</b> (WhatsApp, estado, grupo de Facebook, Instagram, TikTok, sticker o volante). El panel arma el código solo; cámbialo si quieres (ej.: <i>fb-ventas-envigado</i>).",
              "<b>Copia el texto:</b> hay 3 versiones por destino (corto, con beneficios, con pregunta). Puedes editarlo y guardarlo como «tu versión».",
              "<b>Descarga la imagen:</b> cuadrada (grupos y posts), vertical (estados e historias) u horizontal (Facebook). Lleva logo, título, botón «Ingresa aquí», link y QR. Puedes cambiar colores, ícono y subir un fondo hecho con IA.",
          ]),
          P("En el celular, el botón <b>📤 Compartir imagen + texto</b> manda las dos cosas juntas a WhatsApp, Facebook o Instagram."),
          P("Imágenes con inteligencia artificial", "h2"),
          P("Toca <b>🤖 Copiar idea para la IA</b>: copia una instrucción lista para pegar en ChatGPT, Gemini, Canva o Bing Image Creator. Pide siempre la imagen <b>sin texto ni logos</b> "
            "(el texto lo pone Merkap encima) y en el mismo formato que vas a descargar. Sube la imagen con <b>⬆️ Subir imagen</b>."),
          KeepTogether([P("Cómo nombrar los códigos", "h2"),
          P("Usa siempre el mismo orden: <b>canal - destino o grupo - lugar - número</b>. Solo letras, números y guiones; máximo 30 caracteres."),
          tabla([["Código", "Para qué"],
                 ["fb-ventas-envigado-1", "Grupo de Facebook «Ventas Envigado», primera publicación"],
                 ["wa-vecinos-sabaneta", "Grupo de WhatsApp de vecinos de Sabaneta"],
                 ["estado-registro-oct", "Tu estado de WhatsApp de octubre invitando a registrarse"],
                 ["qr-panaderia-lacentral", "Sticker en la puerta de la Panadería La Central"],
                 ["volante-drogueria-sur", "Volantes que reparte la droguería aliada del sur"]],
                [55, 115])])]

    # ---------- 3. Estrategias ----------
    h += [P("3. Nueve estrategias para sacarle el jugo", "h1"),
          estrategia(1, "Un enlace por cada grupo",
                     "No uses el mismo enlace en todos lados. Si cada grupo tiene su código, en dos semanas sabes cuáles traen gente y cuáles no.",
                     ["Haz una lista de 10 a 20 grupos de Facebook y WhatsApp de tu zona (ventas, vecinos, emprendedores).",
                      "Crea un código por grupo en el panel y anótalo en la tabla de seguimiento (sección 9).",
                      "Publica una vez y espera 7 días antes de repetir."],
                     "visitas y cuentas por código. Deja de publicar en los grupos que en 2 semanas no traen nada."),
          estrategia(2, "Prueba A/B de textos",
                     "Dos textos distintos para el mismo destino, en semanas distintas, en el mismo grupo. Gana el que trae más cuentas.",
                     ["Semana 1: versión «Corto» con el código <i>fb-ventas-envigado-a</i>.",
                      "Semana 2: versión «Con pregunta» con el código <i>fb-ventas-envigado-b</i>.",
                      "Guarda la ganadora como «tu versión» y úsala en los demás grupos."],
                     "cuentas nuevas por código (A contra B)."),
          estrategia(3, "Sticker «Encuéntranos en Merkap»",
                     "Un QR en la puerta o la caja de cada comercio piloto. Es publicidad en la calle que trabaja todo el día.",
                     ["En Comercios, toca <b>🔳 QR del comercio</b>: llega al panel con el código del negocio.",
                      "Descarga la imagen con QR o «Solo el QR (SVG)» para la imprenta (stickers de 10×10 cm).",
                      "Pégalo a la altura de los ojos, cerca de la caja."],
                     "visitas con origen «Código QR» y contactos a ese comercio."),
          estrategia(4, "Estados de WhatsApp de los comercios",
                     "Cada comerciante tiene cientos de contactos. Si publica su vitrina en su estado, trae clientes para él y gente nueva para Merkap.",
                     ["Elige el destino «Vitrina de un comercio», canal «Estado de WhatsApp» y formato vertical.",
                      "Envíale la imagen y el texto al dueño por WhatsApp.",
                      "Pídele que lo publique una vez por semana (ej.: los viernes)."],
                     "visitas con origen «Estados de WhatsApp» y contactos a la tienda."),
          estrategia(5, "Calendario semanal fijo",
                     "Publicar con un orden fijo evita improvisar y hace que la gente reconozca la marca. Ver la tabla de la sección 4.",
                     ["Lunes: «Regístrate gratis».", "Miércoles: «Publica un anuncio gratis».", "Viernes: «Recomienda un negocio» o el comercio de la semana."],
                     "qué día trae más visitas (Métricas → Personas distintas por día)."),
          estrategia(6, "Programa Fundadores (propuesta)",
                     "Los primeros 50 comercios reciben la insignia 🏅 Fundador y prioridad cuando existan los «Destacados» (fase 2AO).",
                     ["Antes de anunciarlo, define las reglas por escrito (quién entra, hasta cuándo, qué recibe).",
                      "Anúncialo solo cuando la insignia exista en la página: la publicidad debe ser veraz.",
                      "Usa el destino «Registra tu negocio» con el código <i>fundadores-…</i>."],
                     "comercios registrados por el código de fundadores."),
          estrategia(7, "Reto «Recomienda 3 negocios de tu barrio»",
                     "La comunidad llena el directorio por ti. Funciona muy bien en grupos de vecinos.",
                     ["Destino «Recomienda un negocio», versión «Con pregunta».",
                      "Publica el reto en grupos de barrio y agradece públicamente a quienes participen.",
                      "Si algún día das premios, publica antes las reglas (fechas, cómo se elige, qué se gana)."],
                     "recomendaciones recibidas (Comercios → Recomendados por la comunidad)."),
          estrategia(8, "Volantes con QR en aliados",
                     "Tiendas, droguerías y veterinarias aliadas entregan un volante con cada compra.",
                     ["Un código distinto por aliado (<i>volante-drogueria-sur</i>).",
                      "Imagen vertical u horizontal con QR grande y una sola frase.",
                      "Imprime pocos (100) y repite solo en los aliados que funcionen."],
                     "visitas con origen «Volante o afiche» por código."),
          estrategia(9, "Cero spam",
                     "Un grupo que te saca por spam es un canal perdido para siempre.",
                     ["Máximo una publicación por grupo a la semana.", "Lee las reglas del grupo; si piden permiso, pídelo al administrador.",
                      "Responde los comentarios: una respuesta vale más que otra publicación."],
                     "que no te bloqueen o saquen de ningún grupo."),
          Spacer(1, 6)]

    # ---------- 4. Calendario y plan ----------
    h += [KeepTogether([P("4. Calendario semanal", "h1"),
          tabla([["Día", "Destino", "Canal", "Formato"],
                 ["Lunes", "🆓 Regístrate gratis".replace("🆓 ", ""), "Grupos de Facebook + tu estado", "Cuadrada + vertical"],
                 ["Martes", "Vitrina de un comercio piloto", "Estado de WhatsApp del comercio", "Vertical"],
                 ["Miércoles", "Publica un anuncio gratis", "Grupos de WhatsApp de ventas", "Cuadrada"],
                 ["Jueves", "Una categoría (Empleos, Mascotas, Vehículos…)", "Grupos temáticos", "Cuadrada"],
                 ["Viernes", "Recomienda un negocio / comercio de la semana", "Grupos de barrio", "Cuadrada"],
                 ["Sábado", "Directorio: «abiertos ahora»", "Estados e Instagram", "Vertical"],
                 ["Domingo", "Descanso: revisa los números y planea", "—", "—"]],
                [24, 62, 52, 32])]),
          P("Mejores horas para publicar en Colombia: 6:30 a 8:30 a. m., 12 a 2 p. m. y 7 a 9 p. m.", "nota"),
          P("5. Plan de los primeros 30 días", "h1"),
          tabla([["Semana", "Foco", "Tareas"],
                 ["1", "Llenar el mapa", "Visitar 20 comercios del municipio piloto, registrarlos, pegar sticker con QR y pedirles un estado de WhatsApp."],
                 ["2", "Traer gente", "10 grupos de Facebook/WhatsApp con su código. Textos «Regístrate» y «Publica gratis». Primera prueba A/B."],
                 ["3", "Comunidad", "Reto «Recomienda 3 negocios». Comercio de la semana. Responder todos los comentarios."],
                 ["4", "Medir y decidir", "Revisar códigos: dejar los 5 mejores grupos, repetir el texto ganador, imprimir volantes solo para aliados que funcionaron."]],
                [18, 32, 120]),
          Spacer(1, 6),
          KeepTogether([P("6. Kit para comercios", "h1"),
          P("Lo que le entregas a cada comercio piloto para que te ayude a promocionar (y se promocione él):"),
          *vinetas(["<b>Sticker con QR</b> de su vitrina («Encuéntranos en Merkap»).",
                    "<b>Imagen vertical</b> para su estado de WhatsApp, con su nombre.",
                    "<b>Mensaje para sus clientes:</b> «Ahora nos encuentras en Merkap: mira nuestros productos y horario 👉 [link]».",
                    "<b>Cómo actualizar su vitrina</b> desde Mi tienda (fotos, precios, horario)."]),
          P("Muy pronto (fase 2AP-3) cada comercio tendrá su propio botón «Comparte tu tienda» en Mi tienda.", "nota")]),
          PageBreak()]

    # ---------- 7. Textos ----------
    h += [P("7. Cómo escribir textos que funcionan", "h1"),
          *vinetas(["<b>Empieza con el beneficio</b>, no con la marca: «Vende lo que ya no usas» antes que «Conoce Merkap».",
                    "<b>Di «gratis» cuando sea verdad</b>: hoy registrarse, publicar y aparecer en el mapa es gratis.",
                    "<b>Una sola acción por mensaje</b>: o regístrate, o publica, o recomienda. No las tres.",
                    "<b>Pregunta</b>: «¿Cuál es el negocio que siempre recomiendas?» genera comentarios y el grupo lo muestra más.",
                    "<b>Habla local</b>: escribe el municipio o barrio en el campo «Municipio o barrio». Lo cercano genera confianza.",
                    "<b>Pocos emojis</b> (3 a 5) y frases cortas. En WhatsApp, *asteriscos* = negrita.",
                    "<b>Termina con el link</b> y una flecha que lo señale."]),
          P("8. Reglas para cuidar la marca (y cumplir la ley)", "h1"),
          *vinetas(["<b>Datos personales (Ley 1581 de 2012):</b> no agregues personas a grupos o listas sin su permiso, no compres bases de datos y no publiques teléfonos de otros.",
                    "<b>Publicidad veraz (Ley 1480 de 2011, Estatuto del Consumidor):</b> no prometas lo que no existe (premios, descuentos, insignias). Lo pagado se marca como «Patrocinado».",
                    "<b>Imágenes:</b> usa fotos propias, de los comercios (con su permiso) o hechas con IA. No uses logos, personajes ni fotos de otras marcas.",
                    "<b>Nada +18</b> ni productos restringidos en la publicidad (alcohol, tabaco, íntimo): esas categorías no se promocionan en redes.",
                    "<b>Respeta las reglas de cada grupo</b> y de cada red social."]),
          P("Esto es una guía práctica, no asesoría legal. Revisa los puntos legales con el abogado (pendiente P6 del ROADMAP).", "nota"),
          P("Lista rápida antes de publicar", "h2"),
          *[Paragraph(i, E["vineta"], bulletText="□") for i in [
              "¿El enlace tiene su propio código y lo anoté?", "¿Probé el link (botón ↗️ Probar)?", "¿El texto tiene una sola acción y el municipio?",
              "¿La imagen se lee bien en el celular?", "¿Respeto las reglas del grupo y no publiqué ahí esta semana?"]],
          PageBreak()]

    # ---------- 9. Seguimiento ----------
    filas = [["Código", "Fecha", "Visitas", "Cuentas", "Anuncios", "Comercios", "¿Sigue?"]] + [[""] * 7 for _ in range(16)]
    t = tabla(filas, [46, 20, 18, 18, 20, 22, 26])
    t.setStyle(TableStyle([("ROWHEIGHT", (0, 1), (-1, -1), 18)]))
    h += [P("9. Tabla de seguimiento semanal", "h1"),
          P("Imprime esta página o cópiala en una hoja de cálculo. Cada domingo llena una fila por código con los números de 📊 Métricas y 📣 Marketing.".replace("📊 ", "").replace("📣 ", "")),
          t, Spacer(1, 8),
          caja(P("<b>Regla de decisión:</b> si un código no trae ninguna cuenta en 2 semanas, cámbialo (otro texto, otra imagen u otro grupo). "
                 "Si trae cuentas, repítelo y busca grupos parecidos.", "caja"))]
    doc.build(h)

if __name__ == "__main__":
    construir()
    print("OK →", SALIDA)
