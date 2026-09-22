# -*- coding: utf-8 -*-
"""Genera las figuras fig_*.png a partir de las capturas crudas.

Movil: capturas tomadas con `adb exec-out screencap -p` (720 x 1600).
Web:   capturas tomadas con Playwright (1098 x 675).

Los recortes quitan la barra de estado del telefono y, en la web, el menu
lateral y la cabecera donde se ve el usuario conectado.
"""
from pathlib import Path

from PIL import Image

A = Path(__file__).resolve().parent

# movil: quitar barra de estado (78 px arriba) y barra de gestos (30 px abajo)
MOVIL = [
    "mov_dev106_distribucion.png",
    "mov_dev107_calidad.png",
    "mov_sugerido_desglose.png",
    "mov_sugerido_desglose2.png",
]
for name in MOVIL:
    with Image.open(A / name) as im:
        w, h = im.size
        im.crop((0, 78, w, h - 30)).save(A / ("fig_" + name))

# movil: lista de inventarios recortada a las tres fichas de la prueba
with Image.open(A / "mov_inventarios_lista.png") as im:
    im.crop((0, 380, 720, 1160)).save(A / "fig_mov_inventarios_lista.png")

# web: solo el bloque de datos (sin menu lateral ni usuario conectado)
with Image.open(A / "web_inv48_detalle.png") as im:
    im.crop((240, 56, 1098, 320)).save(A / "fig_web_inv48_detalle.png")

# web: montos y lineas del pedido (sin el aviso de coordenadas ni el usuario)
with Image.open(A / "web_ped48_lineas.png") as im:
    im.crop((240, 160, 1045, 575)).save(A / "fig_web_ped48_lineas.png")

for p in sorted(A.glob("fig_*.png")):
    with Image.open(p) as im:
        print(p.name, im.size)
