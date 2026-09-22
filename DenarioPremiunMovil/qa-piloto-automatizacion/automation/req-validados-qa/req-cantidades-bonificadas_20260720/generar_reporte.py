# -*- coding: utf-8 -*-
"""Genera PDF de documentación QA — REQ Cantidades Bonificadas (Nutrina)."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ASSETS = Path(__file__).resolve().parent / "evidencias"
OUT_DIR = Path(__file__).resolve().parent
OUT_PDF = OUT_DIR / "Reporte_QA_REQ_Cantidades_Bonificadas_Nutrina.pdf"

# índice de archivos por fragmento del nombre
INDEX: dict[str, Path] = {}
for p in ASSETS.iterdir():
    if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
        INDEX[p.name] = p


def find_img(*fragments: str) -> Path | None:
    for name, path in INDEX.items():
        if all(f in name for f in fragments):
            return path
    return None


def make_styles():
    base = getSampleStyleSheet()
    styles = {
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            spaceAfter=12,
            textColor=colors.HexColor("#1B4332"),
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontSize=12,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#333333"),
            spaceAfter=6,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontSize=14,
            leading=18,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#1B4332"),
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontSize=11,
            leading=14,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#2D6A4F"),
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            alignment=TA_JUSTIFY,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#444444"),
            spaceAfter=3,
        ),
        "caption": ParagraphStyle(
            "caption",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#555555"),
            spaceBefore=2,
            spaceAfter=8,
        ),
        "pass": ParagraphStyle(
            "pass",
            parent=base["Normal"],
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#1B7A3D"),
            spaceAfter=4,
        ),
        "note": ParagraphStyle(
            "note",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            backColor=colors.HexColor("#FFF8E7"),
            borderPadding=4,
            spaceAfter=6,
        ),
    }
    return styles


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(1.5 * cm, 1.0 * cm, "QA · REQ Cantidades Bonificadas · Nutrina · Confidencial")
    canvas.drawRightString(A4[0] - 1.5 * cm, 1.0 * cm, f"Pág. {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#95D5B2"))
    canvas.setLineWidth(0.5)
    canvas.line(1.5 * cm, 1.35 * cm, A4[0] - 1.5 * cm, 1.35 * cm)
    canvas.restoreState()


def evidence_block(styles, fragments: list[str], caption: str, max_w=15.5 * cm, max_h=9.5 * cm):
    path = find_img(*fragments)
    if not path:
        return [
            Paragraph(
                f"<i>[Evidencia no encontrada en assets: {' + '.join(fragments)}]</i>",
                styles["caption"],
            )
        ]
    try:
        with PILImage.open(path) as im:
            w, h = im.size
        ratio = w / h if h else 1
        width = max_w
        height = width / ratio
        if height > max_h:
            height = max_h
            width = height * ratio
        img = Image(str(path), width=width, height=height)
        return [img, Paragraph(caption, styles["caption"])]
    except Exception as exc:  # noqa: BLE001
        return [Paragraph(f"<i>Error al cargar imagen: {exc}</i>", styles["caption"])]


def result_table(styles, rows: list[tuple[str, str, str]]):
    data = [[Paragraph("<b>Caso</b>", styles["small"]),
             Paragraph("<b>Resultado</b>", styles["small"]),
             Paragraph("<b>Resumen</b>", styles["small"])]]
    for caso, res, resumen in rows:
        hex_c = "#1B7A3D" if res == "PASS" else (
            "#B08900" if res in {"N/A", "A CONFIRMAR"} else "#9B2226"
        )
        data.append([
            Paragraph(caso, styles["small"]),
            Paragraph(f'<font color="{hex_c}"><b>{res}</b></font>', styles["small"]),
            Paragraph(resumen, styles["small"]),
        ])
    t = Table(data, colWidths=[4.2 * cm, 2.3 * cm, 10.0 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D8F3DC")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#95D5B2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def calc_table(styles, title: str, headers: list[str], rows: list[list[str]], col_widths: list | None = None):
    """Tabla de desglose numérico (origen de cada valor)."""
    head = [Paragraph(f"<b>{h}</b>", styles["small"]) for h in headers]
    data = [head]
    for row in rows:
        data.append([Paragraph(c, styles["small"]) for c in row])
    if col_widths is None:
        n = len(headers)
        avail = 16.5 * cm
        col_widths = [avail / n] * n
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E9F5EE")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#95D5B2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBF8")]),
    ]))
    return [Paragraph(title, styles["h2"]), t, Spacer(1, 6)]


def section_case(styles, title: str, body_paras: list[str], evidencias: list[tuple[list[str], str]]):
    story = [Paragraph(title, styles["h2"])]
    for p in body_paras:
        story.append(Paragraph(p, styles["body"]))
    for frags, cap in evidencias:
        story.extend(evidence_block(styles, frags, cap))
    story.append(Spacer(1, 4))
    return story


def build():
    styles = make_styles()
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.8 * cm,
        title="Reporte QA — REQ Cantidades Bonificadas (Nutrina)",
        author="QA Denario Premium",
    )
    story: list = []

    # Portada
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("Reporte de pruebas QA", styles["cover_title"]))
    story.append(Paragraph("REQ: Cantidades Bonificadas en Pedidos", styles["cover_title"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("Cliente: <b>Nutrina</b> (y empresas del grupo)", styles["cover_sub"]))
    story.append(Paragraph("Plataforma principal: <b>App móvil Denario Premium</b>", styles["cover_sub"]))
    story.append(Paragraph("Validación cruzada: Web (detalle / PDF) · Pedido web (alcance)", styles["cover_sub"]))
    story.append(Paragraph("Fechas de ejecución: 17/07/2026 – 20/07/2026", styles["cover_sub"]))
    story.append(Paragraph("Documento de ciclo completo de testeo", styles["cover_sub"]))
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph(
        "<b>Veredicto funcional del REQ (móvil):</b> las cantidades bonificadas "
        "operan correctamente en la app (cálculo, reglas por empresa, mezcla con "
        "descuentos, persistencia, PDF y eco en web de pedidos enviados desde móvil).",
        styles["body"],
    ))
    story.append(Paragraph(
        "Quedan puntos menores <b>a confirmar con el equipo</b> (última sección). "
        "Un hallazgo de <b>descuento global en pedidos creados por Web</b> se separó "
        "en otra tarjeta y no forma parte de este REQ.",
        styles["body"],
    ))
    story.append(PageBreak())

    # 1. Qué es el REQ
    story.append(Paragraph("1. ¿De qué trata este requerimiento?", styles["h1"]))
    story.append(Paragraph(
        "Se desea poder agregar al pedido <b>cantidades de producto que no se cobran</b>, "
        "pero que <b>sí salen del inventario</b> (incentivo de compra).",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Regla:</b> por cada <b>X</b> productos comprados (a pagar), se pueden bonificar "
        "hasta <b>Y</b> adicionales de regalo. Ejemplo de la tarjeta: marcar 12, de los cuales "
        "2 bonificados → se cobran 10; del inventario se contemplan 12.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Cómo funciona en la app (comportamiento observado):</b>",
        styles["body"],
    ))
    story.append(Paragraph(
        "• El campo <b>Cantidad</b> = unidades <b>a pagar</b>.<br/>"
        "• Al activar <b>Bonificar</b>, el sistema suma el regalo según la regla (máximo fijo).<br/>"
        "• La UI muestra algo como: <i>14 · 2 bonificados · 12 a pagar</i>.<br/>"
        "• El vendedor puede <b>activar o no</b> el bono (checkbox). El campo Bonif. "
        "<b>no es editable</b>: aplica el máximo de la regla o cero.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Cascada de cálculos validada:</b> "
        "bruto físico → − valor bonificado → base cobrada → − % descuento por producto "
        "→ − % descuento global → IVA (si aplica) → total.",
        styles["body"],
    ))

    # 2. Ambiente
    story.append(Paragraph("2. Ambiente y datos de prueba", styles["h1"]))
    story.append(Paragraph(
        "<b>Usuarios:</b> 203 (Nutrina / Nutriservi) · luis (El Veinte) · 201 (Nutribasic, no ejecutado en este ciclo).",
        styles["body"],
    ))
    story.append(Paragraph("<b>Reglas de bonificación configuradas en Web:</b>", styles["body"]))
    story.append(Paragraph(
        "• NUTRISERVI — 0201012 · Compra 6 / Regalo 1 · Activa<br/>"
        "• NUTRINA — 1104016 · 3/1 · Activa · y 1104015 · 4/2 · Activa<br/>"
        "• NUTRIBASICOS — 1601004 · 7/2 · Activa (no ejecutada en móvil en este ciclo)<br/>"
        "• EL VEINTE — 1104028 · 10/2 Activa + 4/3 Inactiva · 1104029 · 12/2 Inactiva (sola)",
        styles["small"],
    ))
    story.append(Paragraph(
        "<b>Descuentos globales por empresa (para pruebas mixtas):</b> "
        "Nutriservi 5% / 7% · Nutrina 10% · Nutribasic 15% · El Veinte 20%.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Descuento por producto:</b> solo en El Veinte (ej. 2%, 5%, …) y Nutrina (0% / 5%), "
        "y depende de la <b>lista de precios del cliente</b> (no del cliente en abstracto).",
        styles["body"],
    ))
    story.extend(evidence_block(
        styles, ["image-ae8366e2"],
        "Fig. 1 — Reglas El Veinte: activa + inactiva en 1104028; 1104029 solo inactiva.",
        max_h=7.5 * cm,
    ))

    # 3. Resumen de resultados
    story.append(Paragraph("3. Resumen de resultados", styles["h1"]))
    story.append(result_table(styles, [
        ("C1 Regla base / proporcional / mínimo", "PASS", "Nutriservi 0201012 (6+1)"),
        ("C2 Sin bono / desactivar + recálculo cant.", "PASS", "OFF desde el inicio, ON→OFF, y máx. al cambiar cant."),
        ("C3 Producto sin regla", "PASS", "0201026 sin UI de bonificar"),
        ("C4 Bono + descuento global", "PASS", "Cálculos OK (con y sin global)"),
        ("C5 Bono + dcto producto + global", "PASS", "Nutrina 1104016 · total 77,64"),
        ("B1/B2/B3 Reglas inactivas", "PASS", "El Veinte 1104028 / 1104029"),
        ("F4 Mix El Veinte + global 20%", "PASS", "Pedido enviado #45 · 285,38"),
        ("F2 Guardar / reabrir", "PASS", "Persisten cant. bonificadas y totales"),
        ("B7 Cambio de empresa", "PASS", "Reinicia pedido; no mezcla empresas"),
        ("PDF cotización", "PASS", "Muestra X·Y bonif·a pagar y totales"),
        ("F3 Eco web pedidos móviles", "PASS", "#43 #44 #45 — bonif. OK en detalle"),
        ("Alta pedido por Web", "N/A", "Web no maneja cantidades bonificadas"),
        ("Inventario maestro / vivo X+Y", "A CONFIRMAR", "Ver sección 6"),
    ]))
    story.append(Paragraph(
        "<b>Pedidos enviados como material:</b> "
        "#43 Nutriservi · #44 Nutrina (77,64) · #45 El Veinte (285,38) · "
        "#50 pedido Web sin bonif. (control de alcance).",
        styles["body"],
    ))
    story.append(PageBreak())

    # 4. Detalle de casos
    story.append(Paragraph("4. Detalle de las pruebas realizadas", styles["h1"]))

    story.extend(section_case(
        styles,
        "4.1 Caso C1 — Regla básica (Nutriservi · 0201012 · 6+1)",
        [
            "<b>Objetivo:</b> verificar que la regla Compra X / Regalo Y se aplica, "
            "es proporcional y no bonifica bajo el mínimo.",
            "<b>Resultado:</b> PASS. Con cantidad 6 + bono → 7·1·6 a pagar · total 106,68. "
            "Con 12 + bono → 14·2·12 · total 213,36. Con 5 → bonif. 0.",
        ],
        [
            (["image-cb33c030"], "Fig. 2 — Cant. 6 + Bonificar ON (máx. 1)."),
            (["image-2f4538d5"], "Fig. 3 — Cant. 12 + Bonificar ON (máx. 2) · total 213,36."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.2 Caso C2 — No dar el bono, desactivarlo y recálculo dinámico",
        [
            "<b>Objetivo:</b> el vendedor puede no aplicar el bono (checkbox OFF), "
            "o desmarcarlo después de activarlo; al cambiar la cantidad con bono ON, "
            "el máximo se recalcula solo.",
            "<b>Resultado:</b> PASS. "
            "(1) Cant. 12 sin bonificar → cobra 12. "
            "(2) Con bono ON, bajar de 12 a 6 → máx. pasa a 1 automáticamente. "
            "(3) Activar y luego desmarcar Bonificar → Bonif.=0, bruto = a cobrar, "
            "sin líneas de bonificación en TOTAL. "
            "El campo Bonif. no es editable (todo o nada).",
        ],
        [
            (["image-c1bde924"], "Fig. 4 — Cant. 12 sin bonificar."),
            (["image-b154ef4c"], "Fig. 5 — Tras bajar a 6 con bono ON (máx. 1)."),
            (["image-bdc9d7f6"], "Fig. 6 — Bonificar ON (antes de desactivar)."),
            (["image-0f1b24b3"], "Fig. 7 — Bonificar OFF (mismo producto/cantidad)."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.3 Caso C3 — Producto sin regla de bonificación",
        [
            "<b>Objetivo:</b> un producto sin regla no debe mostrar UI de bonificar.",
            "<b>Resultado:</b> PASS. Producto 0201026 sin checkbox Bonificar; en el mismo "
            "pedido 0201012 sí muestra bonificación.",
        ],
        [
            (["image-d925d255"], "Fig. 8 — Producto 0201026 sin bonificación."),
            (["image-524350f4"], "Fig. 9 — TOTAL: ítem con bono vs ítem sin bono."),
        ],
    ))
    story.append(PageBreak())

    story.extend(section_case(
        styles,
        "4.4 Caso C4 — Bonificación + descuento global (cálculos)",
        [
            "<b>Objetivo:</b> validar la cascada con y sin descuento global 7% Nutriservi.",
            "<b>Resultado:</b> PASS. Sin global: total 738,55. Con global 7%: total 686,85. "
            "El % global aplica sobre la base ya sin bonificados.",
        ],
        [
            (["image-9b837f21"], "Fig. 10 — TOTAL sin descuento global (738,55)."),
            (["image-e593d970"], "Fig. 11 — TOTAL con DESC 7 NUTRISERVI (686,85)."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.5 Caso C5 — Bonificación + dcto producto + global (Nutrina)",
        [
            "<b>Objetivo:</b> combinar los tres mecanismos en Nutrina (producto 1104016 · 3+1 · "
            "precio 30,27 · dcto 5% · global 10%).",
            "<b>Resultado:</b> PASS en toda la matriz. Solo bono: 90,81. +5%: 86,27. "
            "+global 10% sin dcto prod: 81,73. +5% +10%: <b>77,64</b>. Enviado como pedido <b>#44</b>.",
            "<b>Nota UX:</b> en el carrito, “Total a cobrar” puede seguir en 90,81 aunque se "
            "elija 5%; el descuento producto se ve claramente en Tab TOTAL (punto a confirmar).",
        ],
        [
            (["image-b7c34c87"], "Fig. 12 — Carrito: bono ON + descuento producto 5%."),
            (["image-a5ea6161"], "Fig. 13 — TOTAL con 5% + global 10% = 77,64."),
            (["image-4a0be8aa"], "Fig. 14 — Pedido #44 enviado exitosamente."),
        ],
    ))
    story.append(PageBreak())

    story.extend(section_case(
        styles,
        "4.6 Casos borde B1 / B2 / B3 — Reglas inactivas (El Veinte)",
        [
            "<b>Objetivo:</b> una regla apagada no debe aplicarse; si hay activa+inactiva "
            "en el mismo producto, solo cuenta la activa; un producto con única regla "
            "inactiva se comporta como producto normal.",
            "<b>Resultado:</b> PASS. 1104029 (sola inactiva) sin Bonificar. "
            "1104028 cant. 4 no usa la 4+3 inactiva. Cant. 10 aplica solo 10+2 (máx. 2).",
        ],
        [
            (["image-8fb66152"], "Fig. 15 — B2: 1104029 sin bonificación (solo dcto 2%)."),
            (["image-52566e39"], "Fig. 16 — B1: 1104028 cant. 4 · Bonif. 0."),
            (["image-fec743cb"], "Fig. 17 — B3: 1104028 cant. 10 · máx. 2 (regla activa)."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.7 Caso F4 — Mix El Veinte + global 20% · Pedido #45",
        [
            "<b>Objetivo:</b> bono + dcto producto 2% + global 20% en el mismo pedido.",
            "<b>Resultado:</b> PASS. Total 285,38 (bruto 396 − bonif 32 − dcto prod 7,28 − global 71,34). "
            "Enviado como pedido <b>#45</b>.",
        ],
        [
            (["image-dce06909"], "Fig. 18 — TOTAL El Veinte con DESC 20% = 285,38."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.8 Caso F2 — Persistencia al guardar / reabrir",
        [
            "<b>Resultado:</b> PASS. Pedido guardado con bono + dcto 2% (total 156,80) "
            "conserva cantidades bonificadas y totales al reabrir.",
        ],
        [
            (["image-1ca06fb6"], "Fig. 19 — TOTAL persistido: 2 bonificados · 10 a pagar · 156,80."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.9 Caso B7 — Cambio de empresa (usuario 203)",
        [
            "<b>Resultado:</b> PASS. En Nutrina solo globales/reglas de Nutrina. "
            "Al cambiar a Nutriservi la app exige reiniciar el pedido (evita mezcla). "
            "Luego solo globales/reglas Nutriservi.",
        ],
        [
            (["image-8ff8f87e"], "Fig. 20 — TOTAL Nutrina · DESC 10 NUTRINA."),
            (["image-d9e8dc17"], "Fig. 21 — Aviso al cambiar de empresa (reiniciar pedido)."),
            (["image-4db66de5"], "Fig. 22 — TOTAL Nutriservi · DESC 7 NUTRISERVI."),
        ],
    ))

    story.extend(section_case(
        styles,
        "4.10 PDF de cotización / pedido",
        [
            "<b>Resultado:</b> PASS. El PDF muestra la cantidad como "
            "<i>12 · 2 bonificados · 10 a pagar</i> y desglosa bruto, descuento bonif., "
            "base, descuento productos y (si aplica) global.",
        ],
        [
            (["image-f719312c"], "Fig. 23 — PDF pedido guardado (ref. 0) con bonificación."),
            (["image-03fbe286"], "Fig. 24 — PDF pedido enviado #45 con bono + global."),
        ],
    ))
    story.append(PageBreak())

    story.extend(section_case(
        styles,
        "4.11 Caso F3 — Eco en Web de pedidos enviados desde móvil",
        [
            "<b>Objetivo:</b> validación menos exhaustiva pero necesaria: que lo enviado "
            "desde la app llegue a Web con bonificadas visibles y totales coherentes.",
            "<b>#43 Nutriservi:</b> PASS — 1 bonificados 6 a pagar · total 738,55 "
            "(pedido cerrado sin descuento global; móvil y web coinciden).",
            "<b>#44 Nutrina:</b> PASS — bono + total 77,64 · global y dcto producto presentes.",
            "<b>#45 El Veinte:</b> PASS en total final (285,38). Abajo se detalla la cascada "
            "y la incongruencia de display del Descuento Global (71,34 en móvil vs 72,80 en web). "
            "Hallazgo reportado a desarrollo; no invalida el REQ de bonificadas.",
        ],
        [
            (["web43-detalle"],
             "Fig. 25 — Web #43: unidades con 1 bonificados 6 a pagar."),
            (["image-d4a92bdc"], "Fig. 26 — Web #44: bono + total 77,64."),
            (["image-f04dd557"], "Fig. 27 — Web #45: bono en línea + totales."),
        ],
    ))

    # Desglose numérico pedido #45 (clave para reunión)
    story.append(PageBreak())
    story.append(Paragraph(
        "4.11.1 Ejemplo detallado — Pedido #45 (móvil → web): de dónde sale cada valor",
        styles["h1"],
    ))
    story.append(Paragraph(
        "Mismo pedido visto en app y en Web. Sirve para explicar en reunión la cascada "
        "y por qué el campo “Descuento Global” de la web no coincide con el de la app, "
        "aunque el <b>Monto Total sí es el mismo (285,38)</b>.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Datos del pedido:</b> El Veinte · `1104028` (10 a pagar + 2 bonif., precio 16,00) · "
        "`1104029` (12 sin bono, precio 17,00) · dcto producto 2% · global 20%.",
        styles["body"],
    ))

    story.extend(calc_table(
        styles,
        "A) Cómo se arman bruto, bono y base",
        ["Concepto", "Cálculo", "Resultado"],
        [
            ["Bruto línea 1104028", "12 × 16,00 (físicos)", "192,00"],
            ["Bruto línea 1104029", "12 × 17,00", "204,00"],
            ["<b>Subtotal bruto</b>", "192 + 204", "<b>396,00</b>"],
            ["Descuento bonif.", "2 × 16,00 (regalo)", "32,00"],
            ["<b>Total / Monto Base</b>", "396 − 32", "<b>364,00</b>"],
        ],
        [4.5 * cm, 8.0 * cm, 4.0 * cm],
    ))

    story.extend(calc_table(
        styles,
        "B) De dónde sale el descuento por producto (7,28)",
        ["Línea", "Base cobrada (sin regalo)", "2%", "Dcto"],
        [
            ["1104028", "10 × 16,00 = 160,00", "160 × 0,02", "3,20"],
            ["1104029", "12 × 17,00 = 204,00", "204 × 0,02", "4,08"],
            ["<b>Total dcto productos</b>", "160 + 204 = 364", "", "<b>7,28</b>"],
        ],
        [3.8 * cm, 6.2 * cm, 3.5 * cm, 3.0 * cm],
    ))
    story.append(Paragraph(
        "El 2% se aplica solo sobre lo <b>a pagar</b>, no sobre las unidades bonificadas.",
        styles["small"],
    ))

    story.extend(calc_table(
        styles,
        "C) Cascada hasta el total (lo que usa la app — correcto)",
        ["Paso", "Operación", "Monto"],
        [
            ["1. Base tras bono", "364,00", "364,00"],
            ["2. − Dcto productos 2%", "364,00 − 7,28", "356,72"],
            ["3. − Global 20% (efectivo)", "356,72 × 0,20 = <b>71,34</b>", "285,38"],
            ["<b>Total Pedido</b>", "356,72 − 71,34", "<b>285,38</b>"],
        ],
        [5.0 * cm, 7.5 * cm, 4.0 * cm],
    ))

    story.extend(calc_table(
        styles,
        "D) Qué muestra cada pantalla (misma orden)",
        ["Campo", "Móvil", "Web", "¿Cuadra?"],
        [
            ["Subtotal bruto", "396,00", "396,00", "Sí"],
            ["Descuento bonif.", "32,00", "32,00", "Sí"],
            ["Base", "364,00", "364,00", "Sí"],
            ["Dcto productos", "7,28", "(dentro de “Descuento”)", "Sí*"],
            ["Descuento Global", "<b>71,34</b>", "<b>72,80</b>", "<font color='#9B2226'><b>NO</b></font>"],
            ["Descuento (agregado web)", "—", "78,62 (= 7,28+71,34)", "Sí"],
            ["Total Pedido", "285,38", "285,38", "Sí"],
        ],
        [4.2 * cm, 3.5 * cm, 5.3 * cm, 3.5 * cm],
    ))
    story.append(Paragraph(
        "* En web no hay línea separada “Descuento productos”; va sumado en el campo genérico "
        "<b>Descuento = 78,62</b> (7,28 producto + 71,34 global efectivo).",
        styles["small"],
    ))
    story.append(Paragraph(
        "<b>Incongruencia reportada a desarrollo:</b> Web pinta Descuento Global = "
        "<b>72,80</b> (20% de 364, <i>antes</i> del 2%). Si se restara ese 72,80 el total "
        "sería 283,92, no 285,38. El global real de la cascada es el de la app (<b>71,34</b>). "
        "Conclusión: el total está bien; la etiqueta de Descuento Global en web está mal / engaña.",
        styles["body"],
    ))
    story.extend(evidence_block(
        styles, ["comparativa-movil-web-45"],
        "Fig. 27b — Mismo pedido #45: Web muestra Global 72,80 · Móvil muestra Global 71,34 · Total idéntico 285,38.",
        max_h=10 * cm,
    ))

    story.extend(section_case(
        styles,
        "4.12 Pedido creado por Web — alcance",
        [
            "<b>Resultado:</b> N/A para cantidades bonificadas. En Nuevo Pedido Web "
            "no existe UI de Bonificar. Pedido #50 (Denario Web): Descuento bonif. = 0,00 · "
            "solo cantidad 10. Sirve para delimitar alcance del REQ (móvil + eco web).",
            "Durante esta prueba se observó un problema de <b>descuento global en pedidos Web</b> "
            "(se muestra pero no rebaja el total). Se levantó incidencia aparte y "
            "<b>no se mezcla</b> con este REQ. Distinto del hallazgo 4.11.1: allí el total "
            "móvil→web sí rebaja; aquí el pedido <i>creado</i> en web no aplica el global al total.",
        ],
        [
            (["image-2d09e99c"], "Fig. 28 — Alta Web: producto sin opción de bonificar."),
            (["image-f1e79305"], "Fig. 29 — Detalle Web #50: Descuento bonif. 0,00."),
        ],
    ))
    story.append(PageBreak())

    # 5. Conclusión
    story.append(Paragraph("5. Conclusión del ciclo", styles["h1"]))
    story.append(Paragraph(
        "El REQ de <b>Cantidades Bonificadas</b> se considera <b>validado funcionalmente "
        "en app móvil</b> para el cliente Nutrina y sus empresas de prueba: reglas por "
        "producto/empresa, activación opcional del vendedor, cálculos solos y combinados "
        "con descuento por producto y descuento global, bordes de reglas inactivas, "
        "cambio de empresa, persistencia, PDF y llegada a Web desde móvil.",
        styles["body"],
    ))
    story.append(Paragraph(
        "<b>Recomendación QA:</b> se puede dar por cumplido el objetivo del REQ en móvil, "
        "dejando abiertos los puntos de la sección 6 para alineación con producto/desarrollo "
        "(ninguno bloquea el happy path observado). La creación de pedidos con bonificadas "
        "por Web queda fuera de alcance actual (N/A).",
        styles["body"],
    ))

    # 6. Consulta con el equipo
    story.append(Paragraph("6. Puntos a consultar con el equipo", styles["h1"]))
    story.append(Paragraph(
        "Esta sección reúne observaciones de QA que no se marcan como FAIL del REQ, "
        "pero conviene confirmar criterio de negocio / UX.",
        styles["body"],
    ))

    story.append(Paragraph("6.1 Carrito: “Total a cobrar” no refleja el % de descuento por producto", styles["h2"]))
    story.append(Paragraph(
        "Con bono activo y descuento producto 5% seleccionado, el carrito sigue mostrando "
        "Total a cobrar = base sin el 5%. El Tab TOTAL sí muestra Descuento productos y el "
        "total final correcto. ¿Es intencional o el carrito debería anticipar el total?",
        styles["body"],
    ))
    story.extend(evidence_block(
        styles, ["image-b7c34c87"],
        "Fig. 30 — Carrito con dcto 5% seleccionado pero Total a cobrar aún en 90,81.",
        max_h=8 * cm,
    ))

    story.append(Paragraph("6.2 Bonif. no editable — alcance vs texto del REQ", styles["h2"]))
    story.append(Paragraph(
        "El REQ mencionaba que el vendedor podía “dar menos” del máximo. En la app el campo "
        "Bonif. está inhabilitado: solo ON (máximo de la regla) u OFF (0). "
        "¿Se confirma que el alcance oficial es todo-o-nada?",
        styles["body"],
    ))

    story.append(Paragraph("6.3 Inventario en vivo vs físicos X+Y · inventario maestro", styles["h2"]))
    story.append(Paragraph(
        "Con bono ON (10 a pagar + 2 regalo), el inventario mostrado en el pedido baja solo "
        "las 10 de Cantidad, no 12. Además, el inventario del módulo Productos / Web no se "
        "actualiza tras pedidos (defecto conocido/histórico según desarrollo). "
        "QA lo reporta para dejar el criterio explícito; se asume baja probabilidad de cambio "
        "en el descuento “en vivo”, pero debe quedar en acta.",
        styles["body"],
    ))
    story.extend(evidence_block(
        styles, ["image-5420c9bb"],
        "Fig. 31 — Módulo Productos: inventario 758 (no refleja pedidos enviados).",
        max_h=7.5 * cm,
    ))

    story.append(Paragraph("6.4 Web — sin conversión BS del Descuento bonif.", styles["h2"]))
    story.append(Paragraph(
        "En el detalle Web de pedidos con bonificación (#44, #45) el Descuento bonif. "
        "aparece en USD pero no tiene línea de conversión a BS (ni en cabecera ni en el "
        "detalle de línea). ¿Deben mostrarla?",
        styles["body"],
    ))
    story.extend(evidence_block(
        styles, ["image-f04dd557"],
        "Fig. 32 — Web #45: Descuento bonif. en USD sin par de conversión BS en la línea.",
        max_h=8 * cm,
    ))

    story.append(Paragraph("6.5 Web — etiqueta “Descuento Global” vs cascada real (reportado)", styles["h2"]))
    story.append(Paragraph(
        "Mismo pedido #45: móvil muestra Descuento Global <b>71,34</b>; web muestra <b>72,80</b>; "
        "total idéntico <b>285,38</b>. Ver tablas de la sección <b>4.11.1</b> (origen de cada valor). "
        "Ya reportado a desarrollo con captura comparativa. Pedido: alinear el display web "
        "con el valor efectivo de la cascada.",
        styles["body"],
    ))
    story.extend(evidence_block(
        styles, ["comparativa-movil-web-45"],
        "Fig. 33 — Comparativa móvil vs web (Global 71,34 vs 72,80).",
        max_h=7.5 * cm,
    ))

    story.append(Paragraph("6.6 Fuera de este REQ (solo referencia)", styles["h2"]))
    story.append(Paragraph(
        "Bug de descuento global en <b>creación de pedidos por Web</b> "
        "(se muestra pero no rebaja el total): incidencia levantada por separado "
        "(tarjeta Nutrina-Transacciones-…). No condiciona el cierre del REQ de bonificaciones.",
        styles["body"],
    ))

    story.append(Spacer(1, 1.2 * cm))
    story.append(Paragraph(
        "— Fin del reporte —",
        styles["cover_sub"],
    ))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"OK: {OUT_PDF}")
    return OUT_PDF


if __name__ == "__main__":
    build()
