#!/usr/bin/env python3
# Simple PDF generator for printable packet (no external dependencies)
# Produces docs/XETA_Panelist_Packet.pdf by reading the markdown files in docs/

import os
import textwrap
import re

PAGE_WIDTH = 595.276  # A4 points
PAGE_HEIGHT = 841.89
MARGIN = 72
FONT_SIZE = 12
LINE_HEIGHT = 14
MAX_CHARS = 95

FILES = [
    "docs/panelist-guide.md",
    "docs/demo-runbook.md",
    "docs/final-presentation.md",
    "docs/architecture.md",
    "docs/api-spec.md",
]


def read_and_flatten(files):
    lines = []
    for fp in files:
        if not os.path.exists(fp):
            print("Skipping missing:", fp)
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
    num_pages = len(pages_lines)
    font_obj_num = 3
    content_obj_start = 4
    content_obj_nums = list(range(content_obj_start, content_obj_start + num_pages))
    page_obj_start = content_obj_start + num_pages
    page_obj_nums = list(range(page_obj_start, page_obj_start + num_pages))

    # Prepare objects as bytes
    flat = []
    # 1: Catalog
    flat.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    # 2: Pages (kids)
    kids = " ".join([f"{n} 0 R" for n in page_obj_nums])
    pages_obj = f"<< /Type /Pages /Kids [ {kids} ] /Count {num_pages} >>"
    flat.append(pages_obj.encode("utf-8"))
    # 3: Font
    font_obj = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    flat.append(font_obj)

    # content streams (one per page)
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
        flat.append(stream)

    # page objects
    for content_num in content_obj_nums:
        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH:.3f} {PAGE_HEIGHT:.3f}] "
            f"/Resources << /Font << /F1 {font_obj_num} 0 R >> >> /Contents {content_num} 0 R >>"
        )
        flat.append(page_obj.encode("utf-8"))

    # Build PDF file bytes with offsets
    out_bytes = bytearray()
    out_bytes.extend(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
    offsets = []
    for i, obj in enumerate(flat):
        offsets.append(len(out_bytes))
        obj_num = i + 1
        out_bytes.extend(f"{obj_num} 0 obj\n".encode("utf-8"))
        out_bytes.extend(obj)
        out_bytes.extend(b"\nendobj\n")
    xref_start = len(out_bytes)
    out_bytes.extend(b"xref\n")
    out_bytes.extend(f"0 {len(flat)+1}\n".encode("utf-8"))
    out_bytes.extend(b"0000000000 65535 f \n")
    for off in offsets:
        out_bytes.extend(f"{off:010d} 00000 n \n".encode("utf-8"))
    trailer = f"trailer\n<< /Size {len(flat)+1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%%%EOF\n"
    out_bytes.extend(trailer.encode("utf-8"))

    # write
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
    out_path = "docs/XETA_Panelist_Packet.pdf"
    build_pdf(pages, out_path)


if __name__ == "__main__":
    main()
