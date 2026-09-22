# -*- coding: utf-8 -*-
"""Reporte QA — REQ Pedido Sugerido (formula propia de HIDROPONIAS VENEZOLANAS C.A.)."""
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
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPORT_DIR = Path(__file__).resolve().parent
ASSET_DIR = REPORT_DIR / "assets"
OUT_PDF = REPORT_DIR / "Reporte_QA_REQ_Pedido_Sugerido_Hidroponias.pdf"

IMAGES = {
    "dev_distribucion": "fig_mov_dev106_distribucion.png",
    "dev_calidad": "fig_mov_dev107_calidad.png",
    "sugerido_a": "fig_mov_sugerido_desglose.png",
    "sugerido_b": "fig_mov_sugerido_desglose2.png",
    "inventarios": "fig_mov_inventarios_lista.png",
    "web_inventario": "fig_web_inv48_detalle.png",
    "web_pedido": "fig_web_ped48_lineas.png",
}


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontSize=20,
            leading=26,
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
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1B4332"),
            spaceBefore=12,
            spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#2D6A4F"),
            spaceBefore=8,
            spaceAfter=4,
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
        "formula": ParagraphStyle(
            "formula",
            parent=base["Normal"],
            fontSize=9.5,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1B4332"),
            backColor=colors.HexColor("#F1F8F3"),
            borderPadding=7,
            spaceAfter=8,
        ),
    }


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(
        1.5 * cm,
        1.0 * cm,
        "QA · REQ Pedido Sugerido · HIDROPONIAS VENEZOLANAS C.A. · Confidencial",
    )
    canvas.drawRightString(A4[0] - 1.5 * cm, 1.0 * cm, f"Pág. {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#95D5B2"))
    canvas.line(1.5 * cm, 1.35 * cm, A4[0] - 1.5 * cm, 1.35 * cm)
    canvas.restoreState()


def _sized(key: str, max_w: float, max_h: float):
    """Devuelve (path, width, height) respetando proporcion y topes."""
    path = ASSET_DIR / IMAGES[key]
    if not path.exists():
        return None
    with PILImage.open(path) as source:
        width_px, height_px = source.size
    ratio = width_px / height_px if height_px else 1
    width = max_w
    height = width / ratio
    if height > max_h:
        height = max_h
        width = height * ratio
    return path, width, height


def evidence(styles, key: str, caption: str, max_h: float = 8.5 * cm) -> list:
    sized = _sized(key, 16.0 * cm, max_h)
    if sized is None:
        return [Paragraph(
            f"<i>Evidencia no encontrada: {IMAGES[key]}</i>", styles["caption"])]
    path, width, height = sized
    return [
        Image(str(path), width=width, height=height),
        Paragraph(caption, styles["caption"]),
    ]


def evidence_pair(styles, left: tuple[str, str], right: tuple[str, str],
                  max_h: float = 9.5 * cm) -> list:
    """Dos capturas verticales lado a lado (ahorra paginas sin achicar el texto)."""
    cells, captions = [], []
    for key, caption in (left, right):
        sized = _sized(key, 7.5 * cm, max_h)
        if sized is None:
            cells.append(Paragraph(
                f"<i>Evidencia no encontrada: {IMAGES[key]}</i>", styles["caption"]))
        else:
            path, width, height = sized
            cells.append(Image(str(path), width=width, height=height))
        captions.append(Paragraph(caption, styles["caption"]))
    table = Table([cells, captions], colWidths=[8.5 * cm, 8.5 * cm])
    table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
    ]))
    # el pie no debe quedar huerfano en la pagina siguiente
    return [KeepTogether([table]), Spacer(1, 6)]


def qa_table(styles, headers: list[str], rows: list[list[str]], widths: list[float],
             pad: float = 4) -> Table:
    data = [[Paragraph(f"<b>{cell}</b>", styles["small"]) for cell in headers]]
    data.extend([[Paragraph(cell, styles["small"]) for cell in row] for row in rows])
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D8F3DC")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#95D5B2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBF8")]),
        ("LEFTPADDING", (0, 0), (-1, -1), pad),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def status(value: str) -> str:
    verde = ("PASS", "Correcto", "Coincide", "Enviado y confirmado")
    color = "#1B7A3D" if value in verde else "#B08900"
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
        title="Reporte QA — REQ Pedido Sugerido (HIDROPONIAS VENEZOLANAS C.A.)",
        author="QA Denario Premium",
    )
    story: list = []

    # ------------------------------------------------------------------ portada
    story.extend([
        Spacer(1, 2.2 * cm),
        Paragraph("Reporte de pruebas QA", styles["title"]),
        Paragraph("REQ: Pedido Sugerido", styles["title"]),
        Spacer(1, 0.3 * cm),
        Paragraph("Fórmula propia de HIDROPONIAS VENEZOLANAS C.A.", styles["subtitle"]),
        Spacer(1, 0.4 * cm),
        Paragraph("Empresa: <b>HIDROPONIAS VENEZOLANAS C.A.</b>", styles["subtitle"]),
        Paragraph("Servidor: <b>La Tortuga</b>", styles["subtitle"]),
        Paragraph("Fecha de ejecución: <b>11/08/2026</b>", styles["subtitle"]),
        Paragraph("Plataforma: <b>Denario Premium móvil + web</b>", styles["subtitle"]),
        Paragraph("Versión: <b>21</b>", styles["subtitle"]),
        Spacer(1, 1.0 * cm),
        Paragraph(
            "<b>Resultado general:</b> el requerimiento funciona. Se recompuso la fórmula "
            "del pedido sugerido <b>término por término</b> contra la base de datos en "
            "<b>15 productos de 4 clientes</b>, con <b>coincidencia exacta</b> en todos los "
            "casos. Se probaron además los casos borde de la fórmula y todos respondieron "
            "como se espera. <b>No se encontraron defectos.</b>",
            styles["body"],
        ),
        PageBreak(),
    ])

    # ------------------------------------------------- 1. de que trata el REQ
    story.extend([
        Paragraph("1. ¿De qué trata este requerimiento?", styles["h1"]),
        Paragraph(
            "Al cargar un inventario en el punto de venta, la aplicación calcula sola "
            "<b>cuánto conviene pedir</b> de cada producto. La sugerencia no es un número "
            "fijo: sale de reconstruir qué había, qué se entregó y qué se vendió desde el "
            "inventario anterior. La cadena de cálculo es esta:",
            styles["body"],
        ),
        Paragraph(
            "<b>Inventario Inicial</b> = Inventario Anterior + Despacho + Cambio x Cambio<br/>"
            "<b>Venta</b> = Inventario Inicial − Inventario Actual − Devolución por Distribución<br/>"
            "<b>Venta Diaria</b> = Venta ÷ Días desde el último inventario<br/>"
            "<b>Pedido Sugerido</b> = Venta Diaria × Días hasta el siguiente inventario",
            styles["formula"],
        ),
        qa_table(
            styles,
            ["Término", "De dónde sale"],
            [
                ["Inventario Anterior", "Lo que se contó en el inventario anterior de ese cliente y esa sucursal."],
                ["Despacho", "Lo facturado al cliente en su última factura."],
                ["Cambio x Cambio", "Los cambios de producto registrados desde el último inventario."],
                ["Inventario Actual", "Lo que el vendedor cuenta hoy en el punto de venta."],
                ["Devolución por Distribución", "Solo las devoluciones de tipo Distribución del período."],
                ["Días desde el último inventario", "Lo calcula el sistema según la fecha del inventario anterior."],
                ["Días hasta el siguiente inventario", "Lo indica el vendedor al cargar el inventario."],
            ],
            [4.2 * cm, 12.8 * cm],
        ),
        Spacer(1, 6),
        Paragraph(
            "<b>Distinción importante:</b> de las devoluciones, <b>solo restan las de "
            "Distribución</b>. Las de <b>Calidad no restan</b>, porque no representan "
            "mercancía que el cliente dejó de vender. Esta diferencia fue uno de los puntos "
            "centrales de la prueba.",
            styles["note"],
        ),
        Paragraph(
            "Además, el sugerido nunca pide de más: si el <b>Inventario Actual ya alcanza o "
            "supera</b> lo que se sugeriría, la sugerencia queda en <b>cero</b> y ese producto "
            "no entra en el pedido.",
            styles["body"],
        ),
    ])

    # ------------------------------------------------------- 2. como se probo
    story.extend([
        Paragraph("2. Cómo se probó", styles["h1"]),
        Paragraph(
            "Se ejecutó el ciclo completo en el orden real de trabajo del vendedor, tres "
            "veces, con clientes distintos:",
            styles["body"],
        ),
        Paragraph(
            "<b>1)</b> Se cargaron las <b>devoluciones</b> (una de Distribución y una de "
            "Calidad sobre el mismo cliente y la misma factura). &nbsp; "
            "<b>2)</b> Se cargó el <b>inventario</b> del punto de venta. &nbsp; "
            "<b>3)</b> Se abrió el <b>pedido sugerido</b> y se generó el <b>pedido</b>, que se "
            "envió al sistema.",
            styles["body"],
        ),
        Paragraph(
            "La verificación no se limitó a mirar si el número final parecía razonable. "
            "<b>Cada término de la fórmula se calculó por separado contra la base de datos "
            "antes de mirar la pantalla</b>, y recién después se comparó con lo que mostró la "
            "aplicación. Se midieron así <b>15 productos en 4 clientes</b>: los nueve valores "
            "de cada producto coincidieron <b>exactamente</b>, sin ninguna diferencia.",
            styles["body"],
        ),
        Paragraph(
            "Por último, se verificó en la <b>web administrativa</b> que todo lo creado desde "
            "el dispositivo llegó completo y con los mismos valores (sección 6).",
            styles["body"],
        ),
        PageBreak(),
    ])

    # --------------------------------------------------- 3. resultado formula
    story.extend([
        Paragraph("3. Resultado de la fórmula", styles["h1"]),
        Paragraph(
            "Ejemplo completo sobre el cliente <b>209 — EXCELSIOR GAMA SUPERMERCADOS, C.A. "
            "(sucursal MACARACUAY)</b>, con <b>15 días</b> desde el último inventario y "
            "<b>10 días</b> hasta el siguiente. Cada columna es un término de la fórmula, "
            "recompuesto contra la base de datos y comparado con la pantalla.",
            styles["body"],
        ),
        qa_table(
            styles,
            ["Producto", "Inv.<br/>Anterior", "Despacho", "Cambio x<br/>Cambio",
             "Inv.<br/>Inicial", "Inv.<br/>Actual", "Dev.<br/>Distrib.", "Venta",
             "Venta<br/>diaria", "Sugerido", "Estado"],
            [
                ["CAMPROLEC001BAN", "1", "5", "3", "9", "1", "2", "6", "0,40", "<b>4</b>", status("Coincide")],
                ["TOMPROMAN001BAN", "8", "5", "1", "14", "2", "0", "12", "0,80", "<b>8</b>", status("Coincide")],
                ["GERPROGCH002BOL", "2", "0", "4", "6", "1", "0", "5", "0,3333", "<b>3</b>", status("Coincide")],
                ["TOMPROCHE001CAJ", "10", "14", "0", "24", "12", "0", "12", "0,80", "<b>0</b>", status("Coincide")],
                ["CAMPROSDU002BOL", "3", "15", "0", "18", "7", "0", "11", "0,7333", "<b>0</b>", status("Coincide")],
                ["GERPROALF002CAJ", "20", "0", "10", "30", "3", "7", "20", "1,3333", "<b>13</b>", status("Coincide")],
            ],
            [2.3 * cm, 1.55 * cm, 1.55 * cm, 1.5 * cm, 1.4 * cm, 1.4 * cm,
             1.45 * cm, 1.15 * cm, 1.3 * cm, 1.55 * cm, 1.4 * cm],
            pad=2,
        ),
        Spacer(1, 5),
        Paragraph(
            "<b>Los 54 valores de la tabla (6 productos × 9 términos) coincidieron con el "
            "cálculo hecho contra la base de datos. Ninguna diferencia.</b> Los dos productos "
            "con sugerido <b>0</b> lo tienen porque el Inventario Actual ya alcanzaba lo "
            "sugerido; la aplicación los excluyó del pedido, como corresponde.",
            styles["body"],
        ),
        Paragraph(
            "El pedido que se generó desde esta pantalla trajo <b>exactamente</b> las cuatro "
            "líneas con sugerido mayor a cero, con las mismas cantidades: <b>4, 8, 3 y 13</b> "
            "unidades.",
            styles["body"],
        ),
    ])

    # --------------------------------------------------------- 4. casos borde
    story.extend([
        Paragraph("4. Casos borde probados", styles["h1"]),
        qa_table(
            styles,
            ["Situación", "Qué debe hacer el sistema", "Resultado"],
            [
                ["Dos facturas del cliente con la misma fecha",
                 "Tomar como despacho la última registrada de las dos.", status("Correcto")],
                ["Producto que no está en la última factura",
                 "Contar Despacho 0 para ese producto, sin buscar en facturas anteriores.", status("Correcto")],
                ["Inventario Actual mayor que el sugerido",
                 "No sugerir nada: la sugerencia queda en 0.", status("Correcto")],
                ["Inventario Actual exactamente igual al sugerido",
                 "También queda en 0 (se probó el caso justo: 7 contra 7).", status("Correcto")],
                ["Resultados terminados en “,5”",
                 "Redondear hacia arriba (2,5 → 3). Se probaron 6 casos y los 6 subieron.", status("Correcto")],
                ["Producto donde solo aporta el Cambio x Cambio",
                 "Calcular igual con los demás términos en cero.", status("Correcto")],
                ["Venta negativa (se contó más de lo que había)",
                 "Dejar la venta diaria en 0, sin error ni pantalla trabada.", status("Correcto")],
                ["Cliente sin facturas y sin inventario anterior",
                 "Abrir la pantalla normalmente y sugerir 0.", status("Correcto")],
                ["Devolución por <b>Calidad</b> dentro del período",
                 "<b>No</b> restar de la venta. Se comprobó dos veces, en clientes distintos.", status("Correcto")],
                ["Devolución por <b>Distribución</b> dentro del período",
                 "<b>Sí</b> restar de la venta (se verificó con 2 y con 7 unidades).", status("Correcto")],
            ],
            [5.0 * cm, 9.0 * cm, 3.0 * cm],
        ),
        PageBreak(),
    ])

    # ----------------------------------------------------------- 5. evidencia
    story.extend([
        Paragraph("5. Evidencia", styles["h1"]),
        Paragraph("5.1 El par de devoluciones que prueba el filtro", styles["h2"]),
        Paragraph(
            "Sobre el mismo cliente y la misma factura se cargaron dos devoluciones el mismo "
            "día: una de <b>Distribución</b> y otra de <b>Calidad</b>. La de Distribución "
            "restó de la venta; la de Calidad no.",
            styles["body"],
        ),
    ])
    story.extend(evidence_pair(
        styles,
        ("dev_distribucion", "Fig. 1 — Devolución <b>Ref. 106</b>, tipo <b>Distribución</b>. "
                             "Estas 2 unidades sí restan de la venta."),
        ("dev_calidad", "Fig. 2 — Devolución <b>Ref. 107</b>, tipo <b>Calidad</b>. "
                        "Estas 5 unidades no restan."),
        9.6 * cm,
    ))

    story.extend([
        Paragraph("5.2 La pantalla del pedido sugerido", styles["h2"]),
        Paragraph(
            "La aplicación muestra la cantidad sugerida por producto y, al desplegar el "
            "producto, el <b>detalle de cómo llegó a ese número</b>. Las dos imágenes "
            "siguientes son el mismo producto: la tabla se desplaza hacia el costado, así que "
            "se muestra primero la mitad izquierda y después la derecha. Los valores son los "
            "mismos de la primera fila de la tabla de la sección 3.",
            styles["body"],
        ),
    ])
    story.extend(evidence_pair(
        styles,
        ("sugerido_a", "Fig. 3 — <b>Sugerido: 4 unidades</b>. Días desde el último inventario "
                       "15, días hasta el siguiente 10. Inventario Inicial 9, Inventario "
                       "Anterior 1, Venta 6, Venta diaria 0,40."),
        ("sugerido_b", "Fig. 4 — Mismo producto, resto de las columnas: Despacho 5, Cambio por "
                       "cambio 3, Inventario Actual 1, Devolución por Distribución 2."),
        8.9 * cm,
    ))

    story.extend([
        Paragraph("5.3 Los inventarios cargados", styles["h2"]),
    ])
    story.extend(evidence(
        styles,
        "inventarios",
        "Fig. 5 — Los tres inventarios de la prueba (Ref. 48, 49 y 50) en el dispositivo, "
        "los tres en estado <b>Enviado</b>.",
        8.0 * cm,
    ))

    # ------------------------------------------------------ 6. cotejo con web
    story.extend([
        Paragraph("6. Cotejo con la web", styles["h1"]),
        Paragraph(
            "Todo lo que se creó desde el dispositivo se verificó después en la web "
            "administrativa, campo por campo, contra la información guardada en el sistema. "
            "Los <b>cinco registros</b> aparecen en sus listados dentro del rango de fechas "
            "por defecto (01/08/2026 – 11/08/2026), bajo la empresa "
            "<b>HIDROPONIAS VENEZOLANAS C.A.</b>",
            styles["body"],
        ),
        qa_table(
            styles,
            ["Registro", "Dato verificado", "Lo guardado en el sistema", "Lo que muestra la web", "Resultado"],
            [
                ["Inventario 48", "Cliente y sucursal", "209 — EXCELSIOR GAMA (MACARACUAY)", "209 — EXCELSIOR GAMA (MACARACUAY)", status("Coincide")],
                ["Inventario 48", "Fecha y vendedor", "11/08/2026 15:19:19 · Kevin Wilches", "11/08/2026 15:19:19 · Kevin Wilches", status("Coincide")],
                ["Inventario 48", "Líneas y cantidades", "6 líneas: 1 · 2 · 1 · 12 · 7 · 3", "6 líneas: 1 · 2 · 1 · 12 · 7 · 3", status("Coincide")],
                ["Inventario 48", "Pedido relacionado", "Pedido 48", "“Ver Pedido Relacionado: Ref.: 48”", status("Coincide")],
                ["Inventario 49", "Cliente, líneas y cantidades", "208 — VIZCAYA · 4 líneas: 2 · 3 · 5 · 2", "208 — VIZCAYA · 4 líneas: 2 · 3 · 5 · 2", status("Coincide")],
                ["Inventario 49", "Pedido relacionado", "Sin pedido asociado", "El enlace no aparece", status("Coincide")],
                ["Inventario 50", "Cliente, líneas y cantidades", "210 — CHUAO · 4 líneas: 2 · 5 · 1 · 1", "210 — CHUAO · 4 líneas: 2 · 5 · 1 · 1", status("Coincide")],
                ["Inventario 50", "Pedido relacionado", "Pedido 49", "“Ver Pedido Relacionado: Ref.: 49”", status("Coincide")],
                ["Pedido 48", "Cliente, fecha y vendedor", "209 (MACARACUAY) · 11/08/2026 15:27:10 · Kevin Wilches", "209 (MACARACUAY) · 11/08/2026 15:27:10 · Kevin Wilches", status("Coincide")],
                ["Pedido 48", "Líneas y unidades pedidas", "4 líneas: 4 · 13 · 3 · 8", "4 líneas: 4 · 13 · 3 · 8", status("Coincide")],
                ["Pedido 48", "Monto e inventario de origen", "63,49 USD · Inventario 48", "63,49 USD · “Inventario relacionado: Ref.: 48”", status("Coincide")],
                ["Pedido 49", "Cliente, líneas y unidades", "210 (CHUAO) · 4 líneas: 3 · 2 · 3 · 8", "210 (CHUAO) · 4 líneas: 3 · 2 · 3 · 8", status("Coincide")],
                ["Pedido 49", "Monto e inventario de origen", "46,80 USD · Inventario 50", "46,80 USD · “Inventario relacionado: Ref.: 50”", status("Coincide")],
            ],
            [2.3 * cm, 3.1 * cm, 4.9 * cm, 4.9 * cm, 1.8 * cm],
        ),
        Spacer(1, 5),
        Paragraph(
            "<b>Se cotejaron 73 campos entre el móvil, el sistema y la web: 0 diferencias.</b> "
            "Las cantidades que muestra la web son exactamente las que sugirió la aplicación, "
            "y el enlace entre el inventario y el pedido que nació de él funciona en los dos "
            "sentidos.",
            styles["body"],
        ),
        PageBreak(),
    ])

    story.extend(evidence(
        styles,
        "web_inventario",
        "Fig. 6 — Web: inventario <b>Ref. 48</b> del cliente 209, sucursal MACARACUAY, con el "
        "enlace al pedido que generó (<b>Ref.: 48</b>).",
        5.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "web_pedido",
        "Fig. 7 — Web: pedido <b>Ref. 48</b> con sus cuatro líneas y las unidades pedidas "
        "<b>4, 13, 3 y 8</b> — las mismas que sugirió la aplicación.",
        9.0 * cm,
    ))

    # -------------------------------------------------- 7. registros creados
    story.extend([
        Paragraph("7. Registros creados durante la prueba", styles["h1"]),
        qa_table(
            styles,
            ["Ref.", "Tipo", "Detalle", "Estado"],
            [
                ["106", "Devolución (Distribución)", "Cliente 209 · 2 unidades sobre la factura 20115667", status("Enviado y confirmado")],
                ["107", "Devolución (Calidad)", "Cliente 209 · 5 unidades sobre la factura 20115667", status("Enviado y confirmado")],
                ["48", "Inventario", "Cliente 209 (MACARACUAY) · 6 productos · 15 / 10 días", status("Enviado y confirmado")],
                ["49", "Inventario", "Cliente 208 (VIZCAYA) · 4 productos · 8 / 4 días", status("Enviado y confirmado")],
                ["50", "Inventario", "Cliente 210 (CHUAO) · 4 productos · 8 / 4 días", status("Enviado y confirmado")],
                ["48", "Pedido (desde el sugerido)", "Cliente 209 · 4 líneas · 63,49 USD", status("Enviado y confirmado")],
                ["49", "Pedido (desde el sugerido)", "Cliente 210 · 4 líneas · 46,80 USD", status("Enviado y confirmado")],
            ],
            [1.3 * cm, 4.0 * cm, 8.3 * cm, 3.4 * cm],
        ),
        Spacer(1, 5),
        Paragraph(
            "Los siete registros llegaron completos al sistema, sin quedar pendientes de "
            "envío, sin rechazos y sin duplicados.",
            styles["body"],
        ),
    ])

    # -------------------------------------------------- 8. alcance no cubierto
    story.extend([
        Paragraph("8. Alcance no cubierto", styles["h1"]),
        Paragraph(
            "<b>Clientes con más de una sucursal.</b> No se pudo probar en campo cómo se "
            "comporta el <b>Despacho</b> cuando un mismo cliente tiene más de una sucursal. "
            "El motivo es concreto: en el dispositivo de prueba <b>cada cliente baja con una "
            "sola dirección</b>, de modo que en el formulario no había una segunda sucursal "
            "que elegir. Se revisó la lógica del sistema y se confirmó que la búsqueda de la "
            "última factura considera <b>cliente y sucursal</b>, y no solo el cliente; pero "
            "eso es una revisión de la lógica, no una prueba de campo. "
            "<b>El escenario con más de una sucursal queda sin cobertura en esta corrida.</b>",
            styles["note"],
        ),
        Paragraph(
            "Para cubrirlo hace falta un cliente que descargue al dispositivo <b>dos "
            "sucursales</b>, con facturas en una y sin facturas en la otra. Con esos datos, la "
            "prueba es directa y se puede ejecutar en una corrida corta.",
            styles["body"],
        ),
    ])

    # ---------------------------------------------------------- 9. conclusion
    story.append(KeepTogether([
        Paragraph("9. Conclusión", styles["h1"]),
        Paragraph(
            "El <b>pedido sugerido con fórmula propia de HIDROPONIAS VENEZOLANAS C.A.</b> se "
            "considera <b>validado</b>. La fórmula se recompuso término por término contra el "
            "sistema en <b>15 productos de 4 clientes</b> y coincidió de forma exacta en todos "
            "los casos; los casos borde —el filtro de las devoluciones de Calidad, el "
            "redondeo, el tope por inventario disponible y los clientes sin historia— "
            "respondieron como se espera.",
            styles["body"],
        ),
        Paragraph(
            "<b>No se encontraron defectos. El pedido sugerido funciona correctamente en la "
            "versión 21.</b>",
            styles["body"],
        ),
        Spacer(1, 0.4 * cm),
        Paragraph("— Fin del reporte —", styles["subtitle"]),
    ]))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"OK: {OUT_PDF}")
    return OUT_PDF


if __name__ == "__main__":
    build()
