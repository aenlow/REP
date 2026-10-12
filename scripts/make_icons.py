"""Generate REP's app icons from the 3x3 grid mark. Run: python3 scripts/make_icons.py

Geometry: a 3x3 grid of squares (gap = 25% of cell). The last two cells are
outlined rather than filled. No gradients, no text, legible at 16 px.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
BG = (18, 18, 18, 255)
FG = (242, 242, 240, 255)


def draw_mark(img: Image.Image, extent: float) -> None:
    """Draw the mark centred, occupying `extent` (0–1) of the image width."""
    size = img.width
    d = ImageDraw.Draw(img)
    total = size * extent
    cell = total / (3 + 2 * 0.25)
    gap = cell * 0.25
    origin = (size - total) / 2
    stroke = max(2, round(cell * 0.14))
    for r in range(3):
        for c in range(3):
            i = r * 3 + c
            x0 = origin + c * (cell + gap)
            y0 = origin + r * (cell + gap)
            box = [round(x0), round(y0), round(x0 + cell) - 1, round(y0 + cell) - 1]
            if i >= 7:
                d.rectangle(box, outline=FG, width=stroke)
            else:
                d.rectangle(box, fill=FG)


def make(name: str, size: int, extent: float, bg=BG, scale: int = 4) -> None:
    big = Image.new("RGBA", (size * scale, size * scale), bg)
    draw_mark(big, extent)
    big.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)


make("apple-touch-icon.png", 180, 0.56)
make("icon-192.png", 192, 0.56)
make("icon-512.png", 512, 0.56)
make("icon-maskable-512.png", 512, 0.46)  # inside the 80% maskable safe zone
make("icon-monochrome-512.png", 512, 0.56, bg=(0, 0, 0, 0))
make("favicon-32.png", 32, 0.78)

# SVG source artwork
cells = []
cell, gap = 8, 2
for r in range(3):
    for c in range(3):
        i = r * 3 + c
        x, y = 2 + c * (cell + gap), 2 + r * (cell + gap)
        if i >= 7:
            cells.append(f'<rect x="{x + 0.6}" y="{y + 0.6}" width="{cell - 1.2}" height="{cell - 1.2}" fill="none" stroke="#F2F2F0" stroke-width="1.2"/>')
        else:
            cells.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="#F2F2F0"/>')
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 44 44">'
    '<rect x="-6" y="-6" width="44" height="44" fill="#121212"/>' + "".join(cells) + "</svg>\n"
)
(OUT / "rep-mark.svg").write_text(svg)
print("icons written to", OUT)
