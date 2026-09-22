# -*- coding: utf-8 -*-
"""Genera el reporte PDF del segundo ciclo QA de cantidades bonificadas."""
from __future__ import annotations

from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPORT_DIR = Path(__file__).resolve().parent
ASSET_DIR = Path(
    r"C:\Users\Personal\.cursor\projects"
    r"\c-Users-Personal-OneDrive-Documentos-kiberno-DenarioPremium\assets"
)
OUT_PDF = REPORT_DIR / "Reporte_QA_Segundo_Ciclo_Cantidades_Bonificadas_Nutrina.pdf"

IMAGES = {
    "mobile_base": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-6d731f35-4bf1-44b5-aff6-70a762e1a3a3.png",
    "mobile_43": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-dee39735-ef6a-443a-be94-e70c7d058754.png",
    "mobile_43_global": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-22622f8d-d9cb-4f67-a38d-1b3258bcf595.png",
    "mobile_persisted": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-c3ac1ba3-be42-4522-adc7-0665b589c37c.png",
    "pdf_ref51_detail": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-5f981e19-933a-49ed-b703-4ec005f9abfb.png",
    "pdf_ref51_totals": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-6a8c1116-c9a3-47a4-92de-7665c7626a73.png",
    "web_ref51": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-9f4044fe-4daa-4b95-a6d9-1907ffc323fe.png",
    "web_bonus": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-1fca714d-3e58-4dd0-a68c-c14dc72a4e51.png",
    "web_both": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-001bf5a8-16df-4837-98d4-8a4dc655491f.png",
    "web_global": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-c564db2c-aefb-4c2b-8c95-4ccaccfc730a.png",
    "web_ref52_header": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-17f1e4c8-f739-4fb2-b59e-e517abcfec38.png",
    "web_ref52_detail": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-1fa43ccc-5aae-4904-bdd2-3d0038b8a17f.png",
    "web_fix_three_products": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-068599c0-8cf5-405e-8856-341bfe602677.png",
    "web_fix_ref53": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-94a4d166-d4d8-4e90-ad22-60df85d491c6.png",
    "mobile_fix_all": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-4eb6faf5-4941-4adc-ac81-49ddce50ed5e.png",
    "pdf_fix_saved": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-28bcd5ff-ef0d-4366-8edd-1303ddb20ad7.png",
    "pdf_fix_saved_totals": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-c21820d3-4e9d-4566-98fc-10363c6289a4.png",
    "pdf_fix_sent": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-eb86d1c6-29db-4425-998f-df5067e8f74d.png",
    "pdf_fix_sent_totals": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-d0af6045-e3a2-4b24-8f2c-a02804bcd982.png",
    "web_fix_ref54_header": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-2b5eceef-c65f-4894-8980-533e7702cd64.png",
    "web_fix_ref54_detail": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-c208e23f-e99f-42ab-8a79-c9f64602a443.png",
    "pdf_visual_improvements": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-8129666a-1f6a-49ca-a7df-efa228d52263.png",
    "web_bonus_text_clipped": "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_7ff150d624358dcc20f8571163e54913_images_image-c73423b9-995c-488d-828a-c0f7aff1a58b.png",
}


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontSize=21,
            leading=27,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1B4332"),
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#3F3F3F"),
            spaceAfter=5,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1B4332"),
            spaceBefore=12,
            spaceAfter=7,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#2D6A4F"),
            spaceBefore=9,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontSize=7.8,
            leading=9.5,
            spaceAfter=2,
        ),
        "caption": ParagraphStyle(
            "caption",
            parent=base["Normal"],
            fontSize=7.3,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#555555"),
            spaceBefore=2,
            spaceAfter=8,
        ),
        "note": ParagraphStyle(
            "note",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            backColor=colors.HexColor("#FFF8E7"),
            borderPadding=5,
            spaceAfter=7,
        ),
    }


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(
        1.5 * cm,
        1.0 * cm,
        "QA · Segundo ciclo · Cantidades Bonificadas · Nutrina · Confidencial",
    )
    canvas.drawRightString(A4[0] - 1.5 * cm, 1.0 * cm, f"Pág. {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#95D5B2"))
    canvas.line(1.5 * cm, 1.35 * cm, A4[0] - 1.5 * cm, 1.35 * cm)
    canvas.restoreState()


def evidence(styles, key: str, caption: str, max_h: float = 9.5 * cm) -> list:
    path = ASSET_DIR / IMAGES[key]
    if not path.exists():
        return [Paragraph(f"<i>Evidencia no encontrada: {path.name}</i>", styles["caption"])]
    with PILImage.open(path) as source:
        width_px, height_px = source.size
    ratio = width_px / height_px
    width = 16.0 * cm
    height = width / ratio
    if height > max_h:
        height = max_h
        width = height * ratio
    return [
        Image(str(path), width=width, height=height),
        Paragraph(caption, styles["caption"]),
    ]


def qa_table(styles, headers: list[str], rows: list[list[str]], widths: list[float]) -> Table:
    data = [[Paragraph(f"<b>{cell}</b>", styles["small"]) for cell in headers]]
    data.extend(
        [[Paragraph(cell, styles["small"]) for cell in row] for row in rows]
    )
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D8F3DC")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#95D5B2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBF8")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def status(value: str) -> str:
    color = "#1B7A3D" if value == "PASS" else "#9B2226"
    return f'<font color="{color}"><b>{value}</b></font>'


def build() -> Path:
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.8 * cm,
        title="Segundo ciclo QA — Cantidades Bonificadas — Nutrina",
        author="QA Denario Premium",
    )
    story: list = []

    story.extend([
        Spacer(1, 2.6 * cm),
        Paragraph("Reporte de pruebas QA", styles["title"]),
        Paragraph("Segundo ciclo — REQ Cantidades Bonificadas", styles["title"]),
        Spacer(1, 0.5 * cm),
        Paragraph("Cliente / empresa: <b>Nutrina, C.A.</b>", styles["subtitle"]),
        Paragraph("Plataformas: <b>Denario móvil y Denario Web</b>", styles["subtitle"]),
        Paragraph("Fecha de ejecución: <b>21/07/2026</b>", styles["subtitle"]),
        Paragraph("Pedidos de evidencia: <b>Ref. 51 (móvil) y Ref. 52 (Web)</b>", styles["subtitle"]),
        Spacer(1, 1.2 * cm),
        Paragraph(
            "<b>Resultado general:</b> la regla 10+2, los descuentos por producto, "
            "el descuento global, la persistencia y las conversiones fueron validados. "
            "Los dos hallazgos reportados durante la ejecución fueron corregidos y "
            "revalidados: el SKU 1104019 ya está disponible en pedidos Web y los pedidos "
            "móviles nuevos muestran correctamente la etiqueta de descuento global en Web. "
            "Solo se documentan tres mejoras visuales menores: dos en el PDF y una en el alta Web.",
            styles["body"],
        ),
        PageBreak(),
    ])

    story.extend([
        Paragraph("1. Objetivo y alcance", styles["h1"]),
        Paragraph(
            "Este ciclo reproduce el escenario de negocio del Excel de Nutrina con productos "
            "Nexgard Spectra, regla <b>Compra 10 / Regala 2</b>, descuento por producto de "
            "<b>43%</b> y descuento global de <b>5%</b>. También verifica las correcciones "
            "reportadas para el cálculo de descuentos en pedidos Web y la conversión monetaria "
            "de las cantidades bonificadas.",
            styles["body"],
        ),
        Paragraph("Datos utilizados", styles["h2"]),
        qa_table(
            styles,
            ["Dato", "Valor"],
            [
                ["Usuario / cliente", "203 · AGROPECUARIA DISALIRPO, C.A."],
                ["Empresa / lista", "NUTRINA, C.A. · DIST1 - DISTRIBUIDOR 1"],
                ["Regla", "10 unidades pagadas + 2 bonificadas"],
                ["Productos", "1104017 · 1104018 · 1104019"],
                ["Descuentos", "43% por producto · 5% global"],
                ["IVA", "0%"],
            ],
            [5.0 * cm, 11.5 * cm],
        ),
        Paragraph("2. Resumen ejecutivo", styles["h1"]),
        qa_table(
            styles,
            ["Validación", "Resultado", "Conclusión"],
            [
                ["Regla 10+2 en móvil", status("PASS"), "1.400 pagadas + 280 bonificadas = 1.680 físicas."],
                ["Cálculo sin descuentos", status("PASS"), "Bruto 72.214,44; bono 12.035,74; base 60.178,70."],
                ["Descuento producto 43%", status("PASS"), "Descuento 25.876,84; neto 34.301,86."],
                ["Global 5% sobre neto", status("PASS"), "1.715,09; total 32.586,77."],
                ["Guardar, reabrir y enviar", status("PASS"), "Datos conservados; pedido móvil Ref. 51."],
                ["Conversión de bonificación", status("PASS"), "Visible por línea en detalle Web."],
                ["Global en pedido creado Web", status("PASS"), "Aplicado y persistido en Ref. 52."],
                ["SKU 1104019 en alta Web", status("PASS"), "Disponible, bonifica y persiste en pedido Web Ref. 53."],
                ["Etiqueta global móvil→Web", status("PASS"), "Ref. 54 nueva muestra global efectivo 1.715,09."],
            ],
            [5.3 * cm, 2.2 * cm, 9.0 * cm],
        ),
        PageBreak(),
    ])

    story.extend([
        Paragraph("3. Validación móvil del escenario Excel", styles["h1"]),
        Paragraph("3.1 Cantidades y bonificación 10+2", styles["h2"]),
        qa_table(
            styles,
            ["Producto", "A pagar", "Bonificadas", "Físicas", "Precio USD"],
            [
                ["1104017", "380", "76", "456", "38,17"],
                ["1104018", "830", "166", "996", "43,70"],
                ["1104019", "190", "38", "228", "49,49"],
                ["Total", "1.400", "280", "1.680", "—"],
            ],
            [3.2 * cm, 3.0 * cm, 3.3 * cm, 3.0 * cm, 4.0 * cm],
        ),
        Spacer(1, 6),
        qa_table(
            styles,
            ["Concepto", "Cálculo", "Resultado USD"],
            [
                ["Subtotal bruto", "Valor de 1.680 unidades físicas", "72.214,44"],
                ["Descuento bonificado", "280 unidades de regalo", "12.035,74"],
                ["Base cobrada", "72.214,44 − 12.035,74", "60.178,70"],
            ],
            [5.2 * cm, 6.8 * cm, 4.5 * cm],
        ),
    ])
    story.extend(evidence(
        styles,
        "mobile_base",
        "Fig. 1 — Escenario móvil con los tres productos y bonificación, antes de descuentos.",
        8.5 * cm,
    ))

    story.extend([
        Paragraph("3.2 Descuento por producto 43%", styles["h2"]),
        qa_table(
            styles,
            ["Producto", "Base cobrada", "43%", "Neto 57%"],
            [
                ["1104017", "14.504,60", "6.236,98", "8.267,62"],
                ["1104018", "36.271,00", "15.596,53", "20.674,47"],
                ["1104019", "9.403,10", "4.043,33", "5.359,77"],
                ["Total", "60.178,70", "25.876,84", "34.301,86"],
            ],
            [4.1 * cm, 4.1 * cm, 4.1 * cm, 4.2 * cm],
        ),
    ])
    story.extend(evidence(
        styles,
        "mobile_43",
        "Fig. 2 — Móvil con 43% por producto y sin descuento global.",
        8.0 * cm,
    ))

    story.extend([
        Paragraph("3.3 Cascada 43% + global 5%", styles["h2"]),
        qa_table(
            styles,
            ["Paso", "Operación", "Resultado USD"],
            [
                ["Base luego de bonificación", "72.214,44 − 12.035,74", "60.178,70"],
                ["Descuento productos", "43% por línea", "25.876,84"],
                ["Base para global", "60.178,70 − 25.876,84", "34.301,86"],
                ["Descuento global", "34.301,86 × 5%", "1.715,09"],
                ["Total pedido", "34.301,86 − 1.715,09", "32.586,77"],
            ],
            [4.8 * cm, 7.0 * cm, 4.7 * cm],
        ),
    ])
    story.extend(evidence(
        styles,
        "mobile_43_global",
        "Fig. 3 — Resultado móvil con descuento por producto 43% y global 5%.",
        8.5 * cm,
    ))

    story.extend([
        Paragraph("3.4 Persistencia, PDF y envío", styles["h2"]),
        Paragraph(
            "<b>Resultado: PASS.</b> Al guardar y reabrir se conservaron cantidades, "
            "bonificaciones, porcentajes y total. El pedido fue enviado como <b>Ref. 51</b>; "
            "el PDF guardado y el enviado mostraron los mismos datos.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "mobile_persisted",
        "Fig. 4 — Pedido móvil reabierto con total 32.586,77 USD.",
        8.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "pdf_ref51_detail",
        "Fig. 5 — PDF enviado Ref. 51: cabecera y detalle de los tres productos.",
        8.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "pdf_ref51_totals",
        "Fig. 6 — PDF enviado Ref. 51: totales, bonificación y descuentos.",
        7.0 * cm,
    ))

    story.extend([
        PageBreak(),
        Paragraph("4. Validación cruzada de Ref. 51 en Web", styles["h1"]),
        Paragraph(
            "Las cantidades físicas, bonificadas y a pagar llegaron separadas; el total Web "
            "coincide con móvil y PDF. La conversión del descuento bonificado ahora aparece "
            "por producto. Sin embargo, persiste una inconsistencia de presentación en la "
            "etiqueta <b>Descuento Global</b>.",
            styles["body"],
        ),
        qa_table(
            styles,
            ["Campo", "Valor correcto/efectivo", "Web", "Estado"],
            [
                ["Monto Base", "60.178,70", "60.178,70", status("PASS")],
                ["Descuento productos", "25.876,84", "Incluido", status("PASS")],
                ["Descuento global", "1.715,09", "3.008,94", status("FAIL")],
                ["Descuento agregado", "27.591,93", "27.591,93", status("PASS")],
                ["Monto Total", "32.586,77", "32.586,77", status("PASS")],
            ],
            [4.4 * cm, 4.2 * cm, 4.0 * cm, 3.9 * cm],
        ),
        Paragraph(
            "<b>Causa visible:</b> la etiqueta calcula 60.178,70 × 5% = 3.008,94, "
            "es decir, antes de restar el 43% por producto. El total sí utiliza el global "
            "efectivo correcto: 34.301,86 × 5% = 1.715,09.",
            styles["note"],
        ),
    ])
    story.extend(evidence(
        styles,
        "web_ref51",
        "Fig. 7 — Comparación Ref. 51: Web muestra 3.008,94 como global; móvil usa 1.715,09.",
        10.0 * cm,
    ))

    story.extend([
        PageBreak(),
        Paragraph("5. Creación del escenario desde Web", styles["h1"]),
        Paragraph("5.1 Bonificación 10+2", styles["h2"]),
        Paragraph(
            "<b>Resultado inicial:</b> para 1104017 y 1104018, Web mostró el checkbox "
            "Bonificar, calculó el máximo según la regla y separó unidades físicas, bonificadas "
            "y a pagar. El SKU 1104019 no apareció en el catálogo de alta Web, por lo que el "
            "escenario de tres productos no pudo reproducirse completo en este primer intento. "
            "El retest posterior al fix se documenta en la sección 6.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "web_bonus",
        "Fig. 8 — Web confirma 380 a pagar + 76 bonificadas = 456 físicas para 1104017.",
        8.7 * cm,
    ))

    story.extend([
        Paragraph("5.2 Global 5% y descuento por producto 43%", styles["h2"]),
        qa_table(
            styles,
            ["Escenario Web", "Base", "Dcto. producto", "Global", "Total"],
            [
                ["Solo global 5%", "50.775,60", "0,00", "2.538,78", "48.236,82"],
                ["43% + global 5%", "50.775,60", "21.833,51", "1.447,10", "27.494,99"],
            ],
            [4.8 * cm, 3.0 * cm, 3.3 * cm, 2.8 * cm, 2.8 * cm],
        ),
        Paragraph(
            "<b>Resultado: PASS.</b> La cascada Web aplica primero el 43% por producto y "
            "después el 5% global sobre el neto.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "web_both",
        "Fig. 9 — Cálculo Web en vivo con 43% por producto y global 5%.",
        7.8 * cm,
    ))
    story.extend(evidence(
        styles,
        "web_global",
        "Fig. 10 — Control Web con solo global 5%.",
        7.8 * cm,
    ))

    story.extend([
        Paragraph("5.3 Persistencia y envío Web — Ref. 52", styles["h2"]),
        Paragraph(
            "<b>Resultado: PASS / corrección confirmada.</b> El pedido Web fue guardado, "
            "enviado y reabierto como Ref. 52. Conservó base 50.775,60; global 2.538,78; "
            "total 48.236,82. La conversión también cuadra.",
            styles["body"],
        ),
        qa_table(
            styles,
            ["Conversión", "Valor BS"],
            [
                ["Monto Base", "29.078.170,61"],
                ["Descuento global", "1.453.908,53"],
                ["Monto Total", "27.624.262,08"],
                ["Bonificación 1104017", "1.661.298,87"],
                ["Bonificación 1104018", "4.154.335,26"],
            ],
            [8.0 * cm, 8.5 * cm],
        ),
    ])
    story.extend(evidence(
        styles,
        "web_ref52_header",
        "Fig. 11 — Pedido Web enviado Ref. 52.",
        7.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "web_ref52_detail",
        "Fig. 12 — Totales persistidos y conversión de bonificación por línea.",
        8.0 * cm,
    ))

    story.extend([
        PageBreak(),
        Paragraph("6. Revalidación de los fixes", styles["h1"]),
        qa_table(
            styles,
            ["ID", "Hallazgo original", "Revalidación", "Estado final"],
            [
                [
                    "P-01",
                    "El producto 1104019 no aparece al crear pedidos Web.",
                    "El SKU aparece, permite 190 pagadas + 38 bonificadas, descuento 43% "
                    "y global 5%. Pedido Web guardado/enviado como Ref. 53.",
                    "PASS",
                ],
                [
                    "P-02",
                    "Etiqueta engañosa de Descuento Global en pedido móvil visto en Web.",
                    "Pedido móvil nuevo Ref. 54 muestra global 1.715,09, agregado 27.591,93 "
                    "y total 32.586,77 en Web.",
                    "PASS",
                ],
            ],
            [1.4 * cm, 5.2 * cm, 7.0 * cm, 2.9 * cm],
        ),
        Spacer(1, 10),
        Paragraph(
            "<b>Alcance del fix P-02:</b> Desarrollo confirmó que la corrección no es "
            "retroactiva. Los registros históricos, como la Ref. 51, conservan la etiqueta "
            "anterior por diseño. El criterio de aceptación se verificó con la Ref. 54, "
            "creada después del despliegue.",
            styles["note"],
        ),
        Paragraph("6.1 Pedido Web completo — Ref. 53", styles["h2"]),
        Paragraph(
            "El escenario de tres productos quedó disponible en Web. Se verificaron las "
            "cantidades 380/830/190, bonificaciones 76/166/38, descuento por producto 43%, "
            "global 5%, guardado, reapertura y envío. El total persistido fue 32.586,77 USD.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "web_fix_three_products",
        "Fig. 13 — Web: tres productos, incluido 1104019, con 43% y global 5%.",
        8.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "web_fix_ref53",
        "Fig. 14 — Ref. 53 enviada desde Web con cantidades y conversiones conservadas.",
        8.0 * cm,
    ))

    story.extend([
        Paragraph("6.2 Pedido móvil nuevo y persistencia — Ref. 54", styles["h2"]),
        Paragraph(
            "En móvil se repitieron cuatro estados: sin bonificación ni descuentos; solo "
            "bonificación; bonificación + 43% por producto; y bonificación + 43% + global 5%. "
            "Todos cuadraron. Guardar/reabrir conservó los datos y el envío asignó la Ref. 54.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "mobile_fix_all",
        "Fig. 15 — Móvil después de guardar: bono + 43% + global 5%, total 32.586,77.",
        9.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "pdf_fix_saved",
        "Fig. 16 — PDF guardado: cabecera y detalle de los tres productos.",
        7.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "pdf_fix_saved_totals",
        "Fig. 17 — PDF guardado: totales del escenario completo.",
        5.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "pdf_fix_sent",
        "Fig. 18 — PDF enviado Ref. 54: cabecera y detalle.",
        7.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "pdf_fix_sent_totals",
        "Fig. 19 — PDF enviado Ref. 54: totales sin variación.",
        5.5 * cm,
    ))

    story.extend([
        Paragraph("6.3 Eco Web del pedido móvil — Ref. 54", styles["h2"]),
        qa_table(
            styles,
            ["Campo", "Esperado", "Web", "Estado"],
            [
                ["Subtotal bruto", "72.214,44", "72.214,44", "PASS"],
                ["Descuento bonificado", "12.035,74", "12.035,74", "PASS"],
                ["Monto Base", "60.178,70", "60.178,70", "PASS"],
                ["Descuento productos", "25.876,84", "Incluido en agregado", "PASS"],
                ["Descuento Global", "1.715,09", "1.715,09", "PASS"],
                ["Descuento agregado", "27.591,93", "27.591,93", "PASS"],
                ["Monto Total", "32.586,77", "32.586,77", "PASS"],
            ],
            [4.4 * cm, 4.0 * cm, 4.5 * cm, 3.6 * cm],
        ),
    ])
    story.extend(evidence(
        styles,
        "web_fix_ref54_header",
        "Fig. 20 — Ref. 54 móvil recibida en Web con estado Enviado.",
        7.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "web_fix_ref54_detail",
        "Fig. 21 — Ref. 54: global corregido, total y conversiones por línea.",
        8.0 * cm,
    ))

    story.extend([
        PageBreak(),
        Paragraph("7. Mejoras visuales identificadas", styles["h1"]),
        qa_table(
            styles,
            ["ID", "Mejora", "Comportamiento observado"],
            [
                [
                    "M-01",
                    "Ampliar o ajustar la columna Cantidad.",
                    "El texto físicas · bonificadas · a pagar se corta con puntos suspensivos.",
                ],
                [
                    "M-02",
                    "Mostrar IVA 0% explícitamente.",
                    "La columna IVA % aparece vacía cuando el producto tiene tasa 0%.",
                ],
                [
                    "M-03",
                    "Ajustar el detalle de bonificación en el alta Web.",
                    "El panel Resumen del pedido tapa parte del texto de la promoción. "
                    "Es necesario desplazar horizontalmente para leerlo y luego vuelve a quedar oculto.",
                ],
            ],
            [1.6 * cm, 6.0 * cm, 8.9 * cm],
        ),
        Paragraph(
            "Estas observaciones no afectan cálculos, persistencia ni envío y no bloquean "
            "el cierre funcional del requerimiento. Desarrollo indicó que M-03 puede "
            "evaluarse para una próxima versión por tratarse de una mejora no crítica.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "pdf_visual_improvements",
        "Fig. 22 — PDF: texto de Cantidad truncado y columna IVA % vacía para tasa 0%.",
        8.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "web_bonus_text_clipped",
        "Fig. 23 — Alta Web: el panel lateral oculta parcialmente el detalle de las bonificaciones.",
        8.0 * cm,
    ))
    story.extend([
        Paragraph("8. Conclusión", styles["h1"]),
        Paragraph(
            "El segundo ciclo y su ronda de revalidación confirman el funcionamiento del "
            "escenario principal en móvil y Web. Los dos defectos reportados quedaron "
            "<b>corregidos y validados</b> mediante las Ref. 53 y 54. No quedan defectos "
            "funcionales abiertos dentro del alcance; se conservan únicamente tres mejoras "
            "visuales no bloqueantes (dos del PDF y una del alta Web).",
            styles["body"],
        ),
        Spacer(1, 0.15 * cm),
        Paragraph("— Fin del reporte —", styles["subtitle"]),
    ])

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"OK: {OUT_PDF}")
    return OUT_PDF


if __name__ == "__main__":
    build()
