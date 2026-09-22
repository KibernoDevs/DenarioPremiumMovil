# -*- coding: utf-8 -*-
"""Reporte QA — REQ Quiebre de inventario (cantidad 0). Validado en DIFRANCA C.A."""
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
ASSET_DIR = REPORT_DIR / "evidencias"
OUT_PDF = REPORT_DIR / "Reporte_QA_REQ_Quiebre_Inventario.pdf"

IMAGES = {
    "captura_cero": "fig_mov_captura_cero.png",
    "resumen": "fig_mov_resumen_ref20.png",
    "lista": "fig_mov_lista_ref20.png",
    "web_detalle": "fig_web_detalle_ref20.png",
}


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontSize=20, leading=26,
            alignment=TA_CENTER, textColor=colors.HexColor("#1B4332"), spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontSize=11, leading=15,
            alignment=TA_CENTER, textColor=colors.HexColor("#3F3F3F"), spaceAfter=5,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontSize=13, leading=17,
            textColor=colors.HexColor("#1B4332"), spaceBefore=12, spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=11, leading=14,
            textColor=colors.HexColor("#2D6A4F"), spaceBefore=8, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontSize=9, leading=12,
            alignment=TA_JUSTIFY, spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"], fontSize=7.8, leading=9.5, spaceAfter=2,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"], fontSize=7.3, leading=9,
            alignment=TA_CENTER, textColor=colors.HexColor("#555555"),
            spaceBefore=2, spaceAfter=8,
        ),
        "note": ParagraphStyle(
            "note", parent=base["Normal"], fontSize=8.5, leading=11,
            backColor=colors.HexColor("#FFF8E7"), borderPadding=5, spaceAfter=7,
        ),
        "formula": ParagraphStyle(
            "formula", parent=base["Normal"], fontSize=9.5, leading=15,
            alignment=TA_CENTER, textColor=colors.HexColor("#1B4332"),
            backColor=colors.HexColor("#F1F8F3"), borderPadding=7, spaceAfter=8,
        ),
    }


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(
        1.5 * cm, 1.0 * cm,
        "QA · REQ Quiebre de inventario · Validado en DIFRANCA C.A. · Confidencial",
    )
    canvas.drawRightString(A4[0] - 1.5 * cm, 1.0 * cm, f"Pág. {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#95D5B2"))
    canvas.line(1.5 * cm, 1.35 * cm, A4[0] - 1.5 * cm, 1.35 * cm)
    canvas.restoreState()


def _sized(key: str, max_w: float, max_h: float):
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
        return [Paragraph(f"<i>Evidencia no encontrada: {IMAGES[key]}</i>", styles["caption"])]
    path, width, height = sized
    return [Image(str(path), width=width, height=height),
            Paragraph(caption, styles["caption"])]


def evidence_pair(styles, left: tuple[str, str], right: tuple[str, str],
                  max_h: float = 9.5 * cm) -> list:
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
    verde = ("PASS", "Correcto", "Coincide", "Enviado y confirmado", "Se muestra")
    color = "#1B7A3D" if value in verde else "#B08900"
    return f'<font color="{color}"><b>{value}</b></font>'


def build() -> Path:
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUT_PDF), pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.6 * cm, bottomMargin=1.8 * cm,
        title="Reporte QA — REQ Quiebre de inventario (cantidad 0)",
        author="QA Denario Premium",
    )
    story: list = []

    # ------------------------------------------------------------------ portada
    story.extend([
        Spacer(1, 2.2 * cm),
        Paragraph("Reporte de pruebas QA", styles["title"]),
        Paragraph("REQ: Quiebre de inventario", styles["title"]),
        Spacer(1, 0.3 * cm),
        Paragraph("Registrar cantidad CERO en los productos codificados del cliente",
                  styles["subtitle"]),
        Spacer(1, 0.4 * cm),
        Paragraph("Validado en: <b>DIFRANCA C.A.</b> (empresa *DISTRIBUIDORA DIAZ HERNANDEZ*)",
                  styles["subtitle"]),
        Paragraph("Servidor: <b>El Yaque</b>", styles["subtitle"]),
        Paragraph("Fecha de ejecución: <b>13/08/2026</b>", styles["subtitle"]),
        Paragraph("Plataforma: <b>Denario Premium móvil + web</b>", styles["subtitle"]),
        Paragraph("Versión: <b>21</b>", styles["subtitle"]),
        Spacer(1, 0.6 * cm),
        Paragraph(
            "<b>Alcance del requerimiento:</b> lo solicitó <b>EL EDEN</b>, pero la funcionalidad "
            "queda <b>disponible para todos</b>. No es una fórmula ni una regla propia de "
            "DIFRANCA: aquí solo se usó su configuración y sus datos para validarla.",
            styles["note"],
        ),
        Spacer(1, 0.3 * cm),
        Paragraph(
            "<b>Resultado general:</b> el requerimiento funciona. El quiebre se puede registrar, "
            "<b>se conserva al guardar y volver a abrir el inventario</b>, llega completo al "
            "sistema y <b>se ve en la web</b>. Se probaron <b>13 casos</b> entre el dispositivo, "
            "la web y la información guardada, y todos pasaron. <b>No se encontraron defectos "
            "en la funcionalidad.</b>",
            styles["body"],
        ),
        PageBreak(),
    ])

    # ------------------------------------------------- 1. de que trata el REQ
    story.extend([
        Paragraph("1. ¿De qué trata este requerimiento?", styles["h1"]),
        Paragraph(
            "Cuando el vendedor levanta el inventario en el punto de venta, necesita poder dejar "
            "constancia de que un producto <b>se agotó</b>. Antes esto no se podía: la aplicación "
            "exigía una cantidad de <b>1 o más</b>, así que un producto agotado simplemente no se "
            "cargaba, y después no había manera de distinguir <b>“lo revisé y no había”</b> de "
            "<b>“no lo revisé”</b>.",
            styles["body"],
        ),
        Paragraph(
            "El cambio permite escribir <b>0</b> como cantidad válida. De esa forma el producto "
            "agotado <b>queda registrado en el inventario</b>, con su lote y su fecha, y ese cero "
            "viaja al sistema y se puede consultar después en la web.",
            styles["body"],
        ),
        Paragraph(
            "Cantidad mínima permitida: <b>de 1 → 0</b><br/>"
            "Un producto en <b>0</b> es un producto <b>inventariado</b>, no un producto ausente",
            styles["formula"],
        ),
        Paragraph(
            "<b>Lo que realmente había que probar.</b> Que el 0 se pueda escribir es la parte "
            "visible, pero no la más delicada. La aplicación tenía varios puntos internos donde "
            "las líneas con cantidad cero o menos se <b>descartaban</b> al volver a mostrar el "
            "inventario. Si esos puntos no se hubieran ajustado, el vendedor habría podido "
            "escribir el 0 y guardarlo, y el producto <b>habría desaparecido al reabrir</b> el "
            "inventario. Por eso el eje de esta prueba fue la <b>persistencia</b>: guardar, salir, "
            "volver a entrar y comprobar que el cero sigue ahí.",
            styles["note"],
        ),
        Paragraph(
            "El mismo riesgo existía del lado de la <b>web</b>: que el detalle no mostrara las "
            "líneas en cero. También se verificó.",
            styles["body"],
        ),
    ])

    # ------------------------------------------------------- 2. como se probo
    story.extend([
        Paragraph("2. Cómo se probó", styles["h1"]),
        Paragraph(
            "Se cargó un inventario real en el cliente <b>CAR755 — MULTIDISTRIBUIDORA JAKE, "
            "C.A.</b> con tres productos elegidos para que cada uno probara algo distinto:",
            styles["body"],
        ),
        qa_table(
            styles,
            ["Producto", "Cantidad", "Para qué sirve en la prueba"],
            [
                ["ACBA300U — Acondicionador BBK de Argan Therapy 300ml", "<b>0</b>",
                 "Quiebre de un producto <b>sin historial</b> de venta en ese cliente."],
                ["ACBBKRI300U — Acondicionador BBK Definición de Rizos 300ml", "7",
                 "Línea normal, para comprobar que el cero <b>convive</b> con cantidades comunes "
                 "y que no se pierde ninguna de las dos."],
                ["MABBKRI240U — Mascarilla BBK Definición de Rizos 240gr", "<b>0</b>",
                 "Quiebre de un producto que <b>sí tiene rotación</b> en ese cliente: es el caso "
                 "de negocio real y el que alimenta el pedido sugerido."],
            ],
            [6.6 * cm, 1.8 * cm, 8.6 * cm],
        ),
        Spacer(1, 5),
        Paragraph(
            "El ciclo se recorrió en el orden real de trabajo del vendedor: <b>1)</b> cargar los "
            "productos, <b>2)</b> guardar, <b>3)</b> salir del inventario y volver a abrirlo desde "
            "el listado, <b>4)</b> revisar el pedido sugerido y <b>5)</b> enviar. Después se "
            "verificó lo enviado en la <b>web administrativa</b> y contra la <b>información "
            "guardada en el sistema</b>, campo por campo.",
            styles["body"],
        ),
        Paragraph(
            "También se comprobó que la aplicación <b>siga rechazando</b> lo que no corresponde: "
            "una cantidad negativa. Bajar el mínimo a cero no debía abrir la puerta a valores "
            "por debajo de cero.",
            styles["body"],
        ),
        PageBreak(),
    ])

    # ------------------------------------------------------------- 3. casos
    story.extend([
        Paragraph("3. Casos probados", styles["h1"]),
        qa_table(
            styles,
            ["#", "Qué se probó", "Qué debe hacer el sistema", "Resultado"],
            [
                ["1", "Escribir cantidad <b>0</b> y aceptar",
                 "Aceptarla como cantidad válida y marcar el producto como inventariado.",
                 status("Correcto")],
                ["2", "Escribir cantidad <b>−1</b> y aceptar",
                 "Rechazarla y no dejar continuar.", status("Correcto")],
                ["3", "Resumen del inventario",
                 "Mostrar la línea en cero junto a las demás.", status("Correcto")],
                ["4", "Contador de productos inventariados",
                 "Contar el producto en cero como inventariado (marcó <b>2</b> con un producto "
                 "en 0 y otro en 7).", status("Correcto")],
                ["5", "Guardar el inventario",
                 "Guardar el cero, no descartarlo.", status("Correcto")],
                ["6", "<b>Salir y volver a abrir el inventario guardado</b>",
                 "Conservar la línea en cero con su lote y su fecha.", status("Correcto")],
                ["7", "Volver a abrir la ficha del producto en cero",
                 "Mostrar de nuevo el 0 y el lote cargados.", status("Correcto")],
                ["8", "Filtro “Inventariados”",
                 "Incluir el producto en cero.", status("Correcto")],
                ["9", "Enviar el inventario",
                 "Enviar el cero al sistema sin alterarlo.", status("Correcto")],
                ["10", "Información guardada en el sistema",
                 "Guardar la cantidad en cero en las tres líneas correspondientes.",
                 status("Correcto")],
                ["11", "<b>Web: detalle del inventario</b>",
                 "Mostrar la línea en cero con su ubicación, lote y fecha.", status("Correcto")],
                ["12", "Web: datos de la cabecera",
                 "Coincidir con el dispositivo (referencia, fecha, vendedor, cliente, sucursal, "
                 "empresa).", status("Coincide")],
                ["13", "Pedido sugerido sobre un producto agotado <b>con rotación</b>",
                 "Sugerir la reposición completa (0 en mano, promedio 12 → sugiere <b>12</b>).",
                 status("Correcto")],
            ],
            [0.8 * cm, 4.6 * cm, 9.1 * cm, 2.5 * cm],
        ),
        Spacer(1, 5),
        Paragraph(
            "<b>13 casos ejecutados, 13 correctos. Ninguna falla.</b> El caso 6 es el que "
            "confirma lo señalado en la sección 1: el cero <b>sobrevive</b> al ciclo de guardar y "
            "volver a abrir, que era el riesgo principal del cambio.",
            styles["body"],
        ),
    ])

    # --------------------------------------------------------- 4. evidencia
    story.extend([
        Paragraph("4. Evidencia", styles["h1"]),
        Paragraph("4.1 El registro del quiebre en el dispositivo", styles["h2"]),
        Paragraph(
            "A la izquierda, la carga de un producto agotado: <b>Cantidad 0</b>, con su lote y su "
            "fecha de vencimiento. A la derecha, el resumen del inventario ya enviado, donde "
            "conviven los dos productos en cero y el que tiene siete unidades.",
            styles["body"],
        ),
    ])
    story.extend(evidence_pair(
        styles,
        ("captura_cero", "Fig. 1 — Carga del quiebre: <b>Cantidad 0</b>, lote y fecha de "
                         "vencimiento. La aplicación acepta el cero y marca el producto "
                         "como inventariado."),
        ("resumen", "Fig. 2 — Resumen del inventario <b>Ref. 20</b>: <b>0 Unidad</b>, "
                    "<b>7 Unidad</b> y <b>0 Unidad</b> en Exhibición. Los ceros se muestran "
                    "como una línea más."),
        9.3 * cm,
    ))

    story.extend([
        Paragraph("4.2 El inventario en el listado del dispositivo", styles["h2"]),
    ])
    story.extend(evidence(
        styles, "lista",
        "Fig. 3 — El inventario <b>Ref. 20</b> del cliente CAR755 en estado <b>Enviado</b>.",
        7.0 * cm,
    ))

    story.extend([
        PageBreak(),
        Paragraph("4.3 El quiebre visto desde la web", styles["h2"]),
        Paragraph(
            "Este es el punto que más se quería confirmar del lado web: que las líneas en cero "
            "<b>no se filtraran</b>. El detalle las muestra completas, con su ubicación, su lote "
            "y su fecha de vencimiento, igual que cualquier otra línea.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles, "web_detalle",
        "Fig. 4 — Web, detalle del inventario <b>Ref. 20</b>: <b>0.00 Unidad</b> en las dos "
        "líneas de quiebre y <b>7.00 Unidad</b> en la línea normal, cada una con su lote.",
        4.0 * cm,
    ))

    # ------------------------------------------------------ 5. cotejo con web
    story.extend([
        Paragraph("5. Cotejo con la web", styles["h1"]),
        Paragraph(
            "Todo lo enviado desde el dispositivo se verificó después en la web administrativa "
            "contra la información guardada en el sistema. El registro aparece en el listado "
            "dentro del rango de fechas por defecto, bajo la empresa "
            "<b>*DISTRIBUIDORA DIAZ HERNANDEZ*</b>.",
            styles["body"],
        ),
        qa_table(
            styles,
            ["Dato verificado", "Lo guardado en el sistema", "Lo que muestra la web", "Resultado"],
            [
                ["Número de referencia", "20", "20", status("Coincide")],
                ["Código de inventario", "1786635291850.0", "1786635291850.0", status("Coincide")],
                ["Fecha y vendedor", "13/08/2026 11:34:51 · Jose Raad",
                 "13/08/2026 11:34:51 · Jose Raad", status("Coincide")],
                ["Cliente y sucursal", "CAR755 — MULTIDISTRIBUIDORA JAKE, C.A.",
                 "CAR755 — MULTIDISTRIBUIDORA JAKE, C.A.", status("Coincide")],
                ["Estado", "Enviado", "Enviado", status("Coincide")],
                ["Línea 1 — <b>quiebre</b>", "MABBKRI240U · <b>0</b> · lote QAQ0813B",
                 "<b>0.00 Unidad</b> en Exhibición · lote QAQ0813B", status("Coincide")],
                ["Línea 2 — normal", "ACBBKRI300U · 7 · lote QAN0813",
                 "7.00 Unidad en Exhibición · lote QAN0813", status("Coincide")],
                ["Línea 3 — <b>quiebre</b>", "ACBA300U · <b>0</b> · lote QAQ0813",
                 "<b>0.00 Unidad</b> en Exhibición · lote QAQ0813", status("Coincide")],
                ["Fechas de vencimiento", "13/08/2026 en las tres líneas",
                 "13/08/2026 en las tres líneas", status("Coincide")],
            ],
            [3.5 * cm, 5.6 * cm, 5.6 * cm, 2.3 * cm],
        ),
        Spacer(1, 5),
        Paragraph(
            "<b>Sin diferencias.</b> Las dos líneas en cero llegaron completas y se muestran en "
            "la web con la misma información que en el dispositivo.",
            styles["body"],
        ),
    ])

    # -------------------------------------------------- 6. registros creados
    story.extend([
        Paragraph("6. Registros creados durante la prueba", styles["h1"]),
        qa_table(
            styles,
            ["Ref.", "Tipo", "Detalle", "Estado"],
            [
                ["20", "Inventario",
                 "Cliente CAR755 (MULTIDISTRIBUIDORA JAKE) · 3 productos · dos de ellos en "
                 "<b>quiebre</b>", status("Enviado y confirmado")],
            ],
            [1.3 * cm, 3.0 * cm, 9.3 * cm, 3.4 * cm],
        ),
        Spacer(1, 5),
        Paragraph(
            "<b>No se generó ningún pedido.</b> La pantalla de pedido sugerido se abrió para "
            "revisar los números y se cerró sin confirmar, de modo que la prueba no dejara "
            "pedidos en el sistema. El inventario llegó completo, sin quedar pendiente de envío "
            "y sin duplicados.",
            styles["body"],
        ),
    ])

    # ---------------------------------------------------------- 7. conclusion
    story.append(KeepTogether([
        Paragraph("7. Conclusión", styles["h1"]),
        Paragraph(
            "El <b>quiebre de inventario</b> se considera <b>validado</b>. El vendedor puede "
            "registrar en cero un producto agotado; el cero se conserva al guardar y volver a "
            "abrir el inventario, se envía completo al sistema y se consulta en la web con su "
            "ubicación, su lote y su fecha. Las cantidades negativas se siguen rechazando, y un "
            "producto agotado con rotación genera la reposición esperada en el pedido sugerido.",
            styles["body"],
        ),
        Paragraph(
            "<b>No se encontraron defectos. La funcionalidad puede liberarse en la versión 21.</b>",
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
