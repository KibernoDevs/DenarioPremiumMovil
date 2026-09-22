# -*- coding: utf-8 -*-
"""Reporte QA — REQ Exportar catálogo / lista de precios (Productos)."""
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
OUT_PDF = REPORT_DIR / "Reporte_QA_REQ_Exportar_Catalogo_Productos.pdf"
PREFIX = (
    "c__Users_Personal_AppData_Roaming_Cursor_User_workspaceStorage_"
    "7ff150d624358dcc20f8571163e54913_images_"
)

IMAGES = {
    "filters_ui": f"{PREFIX}image-0480fb2c-8993-4aa8-bb12-b8577d396ff7.png",
    "catalog_category": f"{PREFIX}image-2de6dc6d-42b5-4701-9c88-84d30aa40980.png",
    "catalog_all": f"{PREFIX}image-25345aac-d820-43c9-989d-a0088f2a35c3.png",
    "structure_cut": f"{PREFIX}image-60f12ac6-a6f9-4630-9fae-8333414fa02b.png",
    "title_offset": f"{PREFIX}image-a97843f5-c796-4035-abb9-9cfc3ef97a4b.png",
    "brand_pdf": f"{PREFIX}image-6c7faf2b-d502-46ca-807d-99823a657fb6.png",
    "brand_excel": f"{PREFIX}image-bee064f4-ebda-44e8-a640-a5e16228a2f5.png",
    "tag_pdf": f"{PREFIX}image-86047c36-e478-4752-a56f-3b59f8bcaef0.png",
    "validation": f"{PREFIX}image-667f08fa-adc4-4552-8d25-3928afa9897f.png",
    "catalog_brand": f"{PREFIX}image-e79c9d2e-b64c-4e90-8035-83f8b0d97fb2.png",
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
    }


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(
        1.5 * cm,
        1.0 * cm,
        "QA · REQ Exportar catálogo / lista de precios · Confidencial",
    )
    canvas.drawRightString(A4[0] - 1.5 * cm, 1.0 * cm, f"Pág. {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#95D5B2"))
    canvas.line(1.5 * cm, 1.35 * cm, A4[0] - 1.5 * cm, 1.35 * cm)
    canvas.restoreState()


def evidence(styles, key: str, caption: str, max_h: float = 8.5 * cm) -> list:
    path = ASSET_DIR / IMAGES[key]
    if not path.exists():
        return [Paragraph(f"<i>Evidencia no encontrada: {path.name}</i>", styles["caption"])]
    with PILImage.open(path) as source:
        width_px, height_px = source.size
    ratio = width_px / height_px if height_px else 1
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
    data.extend([[Paragraph(cell, styles["small"]) for cell in row] for row in rows])
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
    color = "#1B7A3D" if value == "PASS" else "#B08900"
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
        title="Reporte QA — REQ Exportar catálogo / lista de precios",
        author="QA Denario Premium",
    )
    story: list = []

    story.extend([
        Spacer(1, 2.2 * cm),
        Paragraph("Reporte de pruebas QA", styles["title"]),
        Paragraph("REQ: Exportar catálogo y lista de precios", styles["title"]),
        Spacer(1, 0.4 * cm),
        Paragraph("Módulo: <b>Productos → Reportes</b>", styles["subtitle"]),
        Paragraph("Empresa de prueba: <b>EL EDEN IMPORT TCN, C.A.</b>", styles["subtitle"]),
        Paragraph("Fecha de ejecución: <b>22/07/2026</b>", styles["subtitle"]),
        Paragraph("Plataforma: <b>Denario Premium móvil</b>", styles["subtitle"]),
        Spacer(1, 1.0 * cm),
        Paragraph(
            "<b>Resultado general:</b> el requerimiento funciona. Se validaron ambos tipos "
            "de reporte, filtros, ordenamientos, exportación PDF/Excel y validaciones de UI. "
            "No hay defectos funcionales abiertos. Se reportaron dos ajustes visuales del PDF "
            "para priorizar en cola de atención.",
            styles["body"],
        ),
        PageBreak(),
    ])

    story.extend([
        Paragraph("1. ¿De qué trata este requerimiento?", styles["h1"]),
        Paragraph(
            "Se habilita en el módulo de <b>Productos</b> una pantalla de "
            "<b>Reportes de productos</b> para exportar información del surtido "
            "sin salir de la app. El usuario elige el tipo de reporte, aplica filtros "
            "opcionales y genera un archivo para compartir.",
            styles["body"],
        ),
        Paragraph(
            "Tipos disponibles:",
            styles["body"],
        ),
        Paragraph(
            "• <b>Catálogo de productos</b> — presentación del surtido (solo PDF).<br/>"
            "• <b>Lista de precios</b> — consulta/exportación de precios (PDF y Excel).",
            styles["body"],
        ),
        Paragraph(
            "Filtros disponibles: Todos los productos, Categoría, Marca y Etiqueta. "
            "En lista de precios también se puede ordenar por Código o Descripción.",
            styles["body"],
        ),
    ])
    story.extend(evidence(
        styles,
        "filters_ui",
        "Fig. 1 — Pantalla Reportes de productos con filtros.",
        7.5 * cm,
    ))

    story.extend([
        Paragraph("2. Diferencia entre Catálogo y Lista de precios", styles["h1"]),
        qa_table(
            styles,
            ["Aspecto", "Catálogo de productos", "Lista de precios"],
            [
                ["Enfoque", "Presentar el surtido al cliente", "Consultar / exportar precios"],
                ["Formato", "Solo PDF", "PDF y Excel"],
                ["Orden", "Fijo por nombre", "Código o Descripción"],
                [
                    "Columnas PDF",
                    "Código, Nombre, Precio, Unidad, Bulto, Min., Notas",
                    "Código, Nombre, Precio, Moneda, Unidad, Estructura",
                ],
                [
                    "Extra en Excel",
                    "No aplica",
                    "Embalaje, VentaMinima, Multiplo, Notas",
                ],
            ],
            [3.2 * cm, 6.6 * cm, 6.7 * cm],
        ),
        Spacer(1, 6),
        Paragraph(
            "Ambos reportes usan la misma base de productos y los mismos filtros. "
            "La diferencia está en columnas, formato de salida y opciones de orden.",
            styles["body"],
        ),
        PageBreak(),
    ])

    story.extend([
        Paragraph("3. Resumen de pruebas realizadas", styles["h1"]),
        qa_table(
            styles,
            ["Caso", "Resultado", "Detalle"],
            [
                ["Catálogo + Categoría CONDIMENTOS", status("PASS"), "6 productos filtrados correctamente."],
                ["Catálogo sin filtro", status("PASS"), "430 productos / 28 páginas."],
                ["Catálogo + Marca CHOCOLATE", status("PASS"), "10 productos; solo botón PDF."],
                ["Lista precios PDF · Orden Código", status("PASS"), "430 productos; columnas correctas."],
                ["Lista precios PDF · Orden Descripción", status("PASS"), "Orden alfabético por nombre."],
                ["Lista precios Excel", status("PASS"), "430 filas; mismas columnas + extras."],
                ["Filtro Marca ADOBO · PDF y Excel", status("PASS"), "1 producto en ambos formatos."],
                ["Filtro Etiqueta ACEITUNAS · PDF y Excel", status("PASS"), "8 productos en ambos formatos."],
                ["Filtro sin valor seleccionado", status("PASS"), "Mensaje: Seleccione un valor..."],
            ],
            [5.5 * cm, 2.0 * cm, 9.0 * cm],
        ),
        Paragraph("3.1 Evidencias principales", styles["h2"]),
    ])
    story.extend(evidence(
        styles,
        "catalog_category",
        "Fig. 2 — Catálogo filtrado por Categoría CONDIMENTOS (6 productos).",
        7.2 * cm,
    ))
    story.extend(evidence(
        styles,
        "catalog_all",
        "Fig. 3 — Catálogo sin filtro (430 productos).",
        7.2 * cm,
    ))
    story.extend(evidence(
        styles,
        "brand_pdf",
        "Fig. 4 — Lista de precios filtrada por Marca ADOBO (PDF).",
        7.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "brand_excel",
        "Fig. 5 — Mismo filtro Marca ADOBO en Excel.",
        5.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "tag_pdf",
        "Fig. 6 — Lista de precios filtrada por Etiqueta ACEITUNAS (8 productos).",
        7.0 * cm,
    ))
    story.extend(evidence(
        styles,
        "validation",
        "Fig. 7 — Validación al generar sin valor de filtro.",
        6.5 * cm,
    ))

    story.extend([
        PageBreak(),
        Paragraph("4. Observaciones reportadas a desarrollo", styles["h1"]),
        Paragraph(
            "Al tratarse de temas netamente visuales, se indicó que pueden discutirse "
            "en cuanto a prioridad dentro de la cola de atención. No bloquean el cierre "
            "funcional del REQ.",
            styles["note"],
        ),
        qa_table(
            styles,
            ["ID", "Observación", "Dónde"],
            [
                [
                    "V-01",
                    "Textos largos de Estructura se cortan en la celda del PDF.",
                    "Lista de precios · PDF",
                ],
                [
                    "V-02",
                    "El título del reporte no está centrado verticalmente en la franja verde.",
                    "Catálogo y Lista de precios · PDF",
                ],
            ],
            [1.5 * cm, 9.5 * cm, 5.5 * cm],
        ),
        Spacer(1, 6),
    ])
    story.extend(evidence(
        styles,
        "structure_cut",
        "Fig. 8 — V-01: columna Estructura truncada con texto largo.",
        7.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "title_offset",
        "Fig. 9 — V-02: título “Lista de precios” pegado arriba en la franja verde.",
        7.5 * cm,
    ))
    story.extend(evidence(
        styles,
        "catalog_brand",
        "Fig. 10 — V-02 también visible en “Catalogo de productos”.",
        7.0 * cm,
    ))

    story.extend([
        Paragraph("5. Conclusión", styles["h1"]),
        Paragraph(
            "El REQ de exportar catálogo y lista de precios se considera "
            "<b>validado funcionalmente</b>. La app genera correctamente PDF y Excel, "
            "aplica filtros por categoría/marca/etiqueta, respeta el orden seleccionado "
            "y bloquea la generación cuando falta el valor del filtro.",
            styles["body"],
        ),
        Paragraph(
            "Quedan abiertas únicamente las observaciones visuales <b>V-01</b> y "
            "<b>V-02</b>, ya reportadas al equipo para definir prioridad.",
            styles["body"],
        ),
        Spacer(1, 0.4 * cm),
        Paragraph("— Fin del reporte —", styles["subtitle"]),
    ])

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"OK: {OUT_PDF}")
    return OUT_PDF


if __name__ == "__main__":
    build()
