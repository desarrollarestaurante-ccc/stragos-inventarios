"""Arma un único HTML autocontenido con CSS, JS y fotos como data: URI."""
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
IMG_DIR = os.path.join(ROOT, "img")
CONFIG = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "stragos-inventarios-v6.html")


def jpeg_uri(path, size=None, width=None, q=80):
    im = Image.open(path).convert("RGB")
    if size:
        im = im.resize(size, Image.LANCZOS)
    elif width:
        im = im.resize((width, int(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def png_uri(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


files = {
    "P001": "P001_ron-cola.jpg", "P002": "P002_pisco-sour.jpg", "P003": "P003_whisky-rocas.jpg",
    "P004": "P004_cerveza-lager.jpg", "P005": "P005_gaseosa-cola.jpg", "P006": "P006_alitas-pollo.jpg",
    "P007": "P007_chilcano.jpg", "P008": "P008_copa-vino.jpg",
}
img = {k: jpeg_uri(os.path.join(IMG_DIR, v), size=(640, 480), q=80) for k, v in files.items()}
img["logo"] = png_uri(os.path.join(IMG_DIR, "stragos-logo-blanco.png"))
img["banner"] = jpeg_uri(os.path.join(IMG_DIR, "banner-ron-cola.jpg"), width=1000, q=72)

read = lambda p: open(os.path.join(SRC, p), encoding="utf-8").read()
js = "\n".join(read(os.path.join("js", f)) for f in sorted(os.listdir(os.path.join(SRC, "js"))))
open(os.path.join(ROOT, "app.check.js"), "w", encoding="utf-8").write(js)
pos_example = open(os.path.join(ROOT, "datos-prueba", "ventas-prueba-con-cortesias.csv"), encoding="utf-8").read().strip().replace("\r", "")

html = f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Inventarios Stragos Ucello</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{read("app.css")}
</style>
{read("shell.html")}
<script>window.STRAGOS_IMG = {json.dumps(img)};
window.STRAGOS_POS_EXAMPLE = {json.dumps(pos_example)};
window.STRAGOS_MAKE = {json.dumps(CONFIG.get("make_webhook_url", ""))};</script>
<script>
{js}
</script>
"""
open(OUT, "w", encoding="utf-8").write(html)
print(OUT, round(len(html.encode("utf-8")) / 1024), "KB")

# versión para Google Apps Script (documento completo; HtmlService no agrega el esqueleto)
gas_dir = os.path.join(ROOT, "apps-script")
os.makedirs(gas_dir, exist_ok=True)
gas = '<!DOCTYPE html>\n<html lang="es">\n<head>\n' + html.split("</style>", 1)[0] + "</style>\n</head>\n<body>\n" + html.split("</style>", 1)[1] + "</body>\n</html>\n"
open(os.path.join(gas_dir, "index.html"), "w", encoding="utf-8").write(gas)
print(os.path.join(gas_dir, "index.html"), round(len(gas.encode("utf-8")) / 1024), "KB")

# versión para GitHub Pages: misma página + URL del servicio de datos de Apps Script
api = CONFIG.get("api_url", "").strip()
pages = gas.replace("<script>window.STRAGOS_IMG", "<script>window.STRAGOS_API = " + json.dumps(api) + ";</script>\n<script>window.STRAGOS_IMG", 1)
docs = os.path.join(ROOT, "docs")
os.makedirs(docs, exist_ok=True)
open(os.path.join(docs, "index.html"), "w", encoding="utf-8").write(pages)
open(os.path.join(docs, ".nojekyll"), "w").close()
print(os.path.join(docs, "index.html"), "API:", api or "(sin URL: guarda solo en el navegador)")
