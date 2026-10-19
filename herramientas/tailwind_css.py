# -*- coding: utf-8 -*-
"""Genera tw.css (Tailwind ya compilado) para que las páginas no carguen el Tailwind de 400 KB
ni lo compilen en el celular en cada visita (fase 2AP-3b: ~1 s menos por página en celulares).

Uso:  python3 herramientas/tailwind_css.py        (requiere: pip install playwright + Chromium)
CUÁNDO: cada vez que agregues clases de Tailwind nuevas en un .html o .js.
Cómo funciona: junta todas las palabras de los .html y .js, se las da al mismo Tailwind que usaba
la página (tailwind-play-3.4.js, copia del cdn.tailwindcss.com) y guarda el CSS que genera.
"""
import re, glob, os, sys
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TW = open(os.path.join(RAIZ, "herramientas", "tailwind-play-3.4.js"), encoding="utf-8").read()
# Clases que se arman con ${...} en el código y no aparecen escritas completas
EXTRA = {"items-start", "items-center", "bg-indigo-50", "bg-amber-50", "border-indigo-200", "border-amber-200"}

def palabras():
    toks = set(EXTRA)
    for f in glob.glob(os.path.join(RAIZ, "*.html")) + glob.glob(os.path.join(RAIZ, "*.js")):
        s = open(f, encoding="utf-8").read()
        for t in re.split(r"""[\s"'`<>{}]+|\$\{""", s):
            t = t.strip(",;")
            if 1 < len(t) < 80 and re.match(r"^[!-]?[a-z0-9@\[]", t) and not re.search(r"[()]{2}|=>|\\", t):
                toks.add(t)
    return sorted(toks)

def generar():
    html = "<!doctype html><html><head><script src='http://tw.local/tw.js'></script></head><body><div id=x></div></body></html>"
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        pg = b.new_page()
        pg.route("http://tw.local/**", lambda r: r.fulfill(body=TW, content_type="application/javascript") if r.request.url.endswith("tw.js")
                 else r.fulfill(body=html, content_type="text/html"))
        pg.goto("http://tw.local/")
        pg.evaluate("t => { document.getElementById('x').className = t.join(' '); }", palabras())
        pg.wait_for_timeout(2500)
        css = pg.evaluate("[...document.querySelectorAll('style')].map(s => s.textContent).join('\\n')")
        b.close()
    return "/* Merkap · Tailwind 3.4 ya compilado. NO editar a mano: python3 herramientas/tailwind_css.py */\n" + css + "\n"

if __name__ == "__main__":
    css = generar()
    destino = os.path.join(RAIZ, "tw.css")
    if "--revisar" in sys.argv:   # para las pruebas: ¿tw.css está al día?
        ok = os.path.exists(destino) and open(destino, encoding="utf-8").read() == css
        print("tw.css al día" if ok else "tw.css DESACTUALIZADO: corre python3 herramientas/tailwind_css.py"); sys.exit(0 if ok else 1)
    open(destino, "w", encoding="utf-8").write(css)
    print("OK →", destino, len(css) // 1024, "KB")
