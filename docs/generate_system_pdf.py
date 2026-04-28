#!/usr/bin/env python3
"""
Generate a combined system documentation PDF for XETA.
Outputs: docs/XETA_System_Documentation.pdf

This is a lightweight generator (no external deps). It concatenates key markdown docs
and lays them out as plain text in a simple PDF for printing.
"""
import os
import textwrap
import re
from datetime import date

PAGE_WIDTH = 595.276
PAGE_HEIGHT = 841.89
MARGIN = 72
FONT_SIZE = 12
LINE_HEIGHT = 14
MAX_CHARS = 95

FILES = [
    "docs/xeta-platform-spec.md",
    "docs/final-presentation.md",
    "docs/panelist-guide.md",
    "docs/demo-runbook.md",
    "docs/architecture.md",
    "docs/api-spec.md",
]

OUT_PATH = "docs/XETA_System_Documentation.pdf"


def read_and_flatten(files):
    lines = []
    # cover page
    lines.append("XETA — SYSTEM DOCUMENTATION")
    lines.append("=" * 28)
    lines.append("")
    lines.append(f"Generated: {date.today().isoformat()}")
    lines.append("")
    lines.append("Contents:")
    for fp in files:
        name = os.path.basename(fp)
        lines.append(f"- {name}")
    lines.append("")
    lines.append("---")
    lines.append("")

    for fp in files:
        if not os.path.exists(fp):
            lines.append(f"[Missing file: {fp}]")
            lines.append("")
            continue
        title = os.path.basename(fp)
        lines.append(title.upper())
        lines.append("=" * len(title))
        lines.append("")
        with open(fp, "r", encoding="utf-8") as f:
            content = f.read()
        inside_code = False
        for raw in content.splitlines():
            line = raw.rstrip()
            if line.strip().startswith("```"):
                inside_code = not inside_code
                # mark code block boundary with a blank line for readability
                lines.append("")
                continue
            if inside_code:
                lines.append(line)
                continue
            if line.startswith("#"):
                h = line.lstrip("#").strip()
                if h:
                    lines.append(h.upper())
                    lines.append("-" * len(h))
                    lines.append("")
                else:
                    lines.append("")
                continue
            # simple markdown -> plain text conversions
            line = re.sub(r"`([^`]*)`", r"\1", line)
            line = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", line)
            lines.append(line)
        lines.append("")
        lines.append("")
    return lines


def wrap_lines(lines, width=MAX_CHARS):
    wrapped = []
    for l in lines:
        if l.strip() == "":
            wrapped.append("")
        else:
            wrapped.extend(textwrap.wrap(l, width=width))
    return wrapped


def escape_pdf_text(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(pages_lines, out_path):
    # minimal PDF writer
    flat = []
    # Catalog
    flat.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    # Pages placeholder (will fill kids later)
    # We'll compute kid refs after content creation
    # 2: Pages
    # Font obj
    # content streams start at obj 4

    # Font object
    font_obj = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    # collect content streams
    content_objs = []
    for p_lines in pages_lines:
        content_lines = []
        content_lines.append("BT")
        content_lines.append(f"/F1 {FONT_SIZE} Tf")
        start_y = int(PAGE_HEIGHT - MARGIN - FONT_SIZE)
        content_lines.append(f"{MARGIN} {start_y} Td")
        for ln in p_lines:
            esc = escape_pdf_text(ln)
            content_lines.append(f"({esc}) Tj")
            content_lines.append(f"0 -{LINE_HEIGHT} Td")
        content_lines.append("ET")
        content_bytes = ("\n".join(content_lines)).encode("utf-8")
        stream = b"<< /Length %d >>\nstream\n" % len(content_bytes) + content_bytes + b"\nendstream"
        content_objs.append(stream)

    # Now assemble objects: 1 Catalog, 2 Pages, 3 Font, 4..(4+n-1) Contents, then Page objs
    objs = []
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    # placeholder for Pages; will fill children after building page objs
    # We'll create Pages obj later with kids
    # keep placeholder index 1 for Pages
    # We will insert Pages as second object later
    # Append font now as obj 3
    # But simpler: create sequence: 1 Catalog, 2 Pages, 3 Font, contents..., pages...

    # create Pages obj now with kids placeholders
    # We'll compute kids as we create page objs
    # Add font as obj 3
    objs.append(None)  # placeholder for Pages (obj 2)
    objs.append(font_obj)
    for stream in content_objs:
        objs.append(stream)
    # create page objs referencing corresponding content objs
    num_pages = len(content_objs)
    first_content_obj_num = 4
    page_objs = []
    for i in range(num_pages):
        content_num = first_content_obj_num + i
        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH:.3f} {PAGE_HEIGHT:.3f}] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_num} 0 R >>"
        )
        page_objs.append(page_obj.encode("utf-8"))
    objs.extend(page_objs)

    # Now build Pages object with kids list
    kids = " ".join([f"{i} 0 R" for i in range(4 + num_pages, 4 + num_pages + num_pages)])
    pages_obj = f"<< /Type /Pages /Kids [ {kids} ] /Count {num_pages} >>"
    objs[1] = pages_obj.encode("utf-8")

    # Now write PDF
    out_bytes = bytearray()
    out_bytes.extend(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
    offsets = []
    for i, obj in enumerate(objs):
        offsets.append(len(out_bytes))
        obj_num = i + 1
        out_bytes.extend(f"{obj_num} 0 obj\n".encode("utf-8"))
        out_bytes.extend(obj)
        out_bytes.extend(b"\nendobj\n")
    xref_start = len(out_bytes)
    out_bytes.extend(b"xref\n")
    out_bytes.extend(f"0 {len(objs)+1}\n".encode("utf-8"))
    out_bytes.extend(b"0000000000 65535 f \n")
    for off in offsets:
        out_bytes.extend(f"{off:010d} 00000 n \n".encode("utf-8"))
    trailer = f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%%%EOF\n"
    out_bytes.extend(trailer.encode("utf-8"))

    with open(out_path, "wb") as f:
        f.write(out_bytes)
    print("Wrote PDF:", out_path, "pages:", num_pages)


def main():
    lines = read_and_flatten(FILES)
    wrapped = wrap_lines(lines)
    lines_per_page = int((PAGE_HEIGHT - 2 * MARGIN) // LINE_HEIGHT)
    pages = []
    for i in range(0, len(wrapped), lines_per_page):
        pages.append(wrapped[i : i + lines_per_page])
    build_pdf(pages, OUT_PATH)


if __name__ == "__main__":
    main()
