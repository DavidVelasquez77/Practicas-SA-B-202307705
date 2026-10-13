"""Render the two-page P10 operation report from its Markdown source.

Requires reportlab and pypdf. Run from the repository root with:
python P10/tools/render-operation-report.py
"""

from __future__ import annotations

import html
import re
from pathlib import Path
from urllib.parse import quote

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "informe-operacion.md"
OUTPUT = ROOT / "informe-operacion.pdf"
REPO = "https://github.com/DavidVelasquez77/Practicas-SA-B-202307705"
REF = "feature/p10-instrumentation"


def register_fonts() -> None:
    fonts = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("ArialP10", str(fonts / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("ArialP10-Bold", str(fonts / "arialbd.ttf")))
    pdfmetrics.registerFontFamily("ArialP10", normal="ArialP10", bold="ArialP10-Bold")


def inline_markup(value: str) -> str:
    value = html.escape(value)

    def replace_link(match: re.Match[str]) -> str:
        label, target = match.groups()
        if not target.startswith("https://"):
            target = f"{REPO}/blob/{REF}/P10/{target}"
        return f'<link href="{html.escape(target, quote=True)}" color="#175bb8">{label}</link>'

    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace_link, value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    return value


def footer(canvas, document) -> None:
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.line(42, 40, width - 42, 40)
    canvas.setFont("ArialP10", 8)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawString(42, 27, "ComicRent | Práctica 10 | 12 de octubre de 2026")
    canvas.drawRightString(width - 42, 27, f"Página {document.page}")
    canvas.restoreState()


def main() -> None:
    register_fonts()
    title_style = ParagraphStyle(
        "TitleP10", fontName="ArialP10-Bold", fontSize=15, leading=18,
        textColor=colors.HexColor("#0f172a"), spaceAfter=9, alignment=TA_CENTER,
    )
    heading_style = ParagraphStyle(
        "HeadingP10", fontName="ArialP10-Bold", fontSize=10.4, leading=13,
        textColor=colors.HexColor("#1e40af"), spaceBefore=9, spaceAfter=3,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "BodyP10", fontName="ArialP10", fontSize=9.25, leading=12.6,
        textColor=colors.HexColor("#1f2937"), spaceAfter=5,
    )

    paragraphs = re.split(r"\n\s*\n", SOURCE.read_text(encoding="utf-8").strip())
    story = []
    for block in paragraphs:
        block = " ".join(part.strip() for part in block.splitlines())
        if block.startswith("# "):
            story.append(Paragraph(inline_markup(block[2:]), title_style))
        elif block.startswith("## "):
            story.append(Paragraph(inline_markup(block[3:]), heading_style))
        else:
            story.append(Paragraph(inline_markup(block), body_style))

    story.append(Spacer(1, 3))
    document = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=42, leftMargin=42,
        topMargin=38, bottomMargin=54, title="Informe de operación | ComicRent P10",
        author="ComicRent",
    )
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    pages = len(PdfReader(str(OUTPUT)).pages)
    print(f"{OUTPUT} | páginas: {pages}")
    if pages > 2:
        raise SystemExit("El informe excede las dos páginas permitidas")


if __name__ == "__main__":
    main()
