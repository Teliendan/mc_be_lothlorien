"""Generate the two 16x16 swan-meat icons, with a shared boneless breast cut.

python -B mods/lothlorien/tools/make_swan_meat.py
Deterministic shading, top-left light, no random noise or alternate variants.
"""
from pathlib import Path
from PIL import Image, ImageDraw

RP = Path(__file__).resolve().parents[1] / 'lothlorien_rp'
OUTLINE = [(3, 6), (6, 3), (10, 3), (12, 5), (13, 8), (12, 11),
           (10, 13), (6, 13), (3, 11), (2, 8)]
PALETTES = {
    'raw': ['#713d46', '#98505a', '#b56a70', '#d58c8b', '#edaaa0', '#f8c6b2'],
    'cooked': ['#61351e', '#874224', '#a65b2c', '#c37c3e', '#e3a55d', '#f2c57e'],
}


def icon(kind):
    mask = Image.new('1', (16, 16))
    ImageDraw.Draw(mask).polygon(OUTLINE, fill=1)
    img = Image.new('RGBA', (16, 16))
    palette = PALETTES[kind]
    for y in range(16):
        for x in range(16):
            if not mask.getpixel((x, y)):
                continue
            edge = any(not mask.getpixel((x + dx, y + dy))
                       for dx, dy in [(0, -1), (-1, 0), (0, 1), (1, 0)])
            shade = max(1, min(5, 6 - (x + y) // 4))
            if edge:
                shade = 2 if x + y < 13 else (1 if x >= 12 and y <= 10 else 0)
            img.putpixel((x, y), tuple(bytes.fromhex(palette[shade][1:])) + (255,))
    draw = ImageDraw.Draw(img)
    # Broad highlights and curved muscle/roast facets, never checkerboard noise.
    draw.line([(5, 5), (7, 4), (9, 4)], fill=palette[5])
    draw.line([(4, 6), (4, 8)], fill=palette[4])
    draw.line([(6, 9), (7, 10), (10, 10)], fill=palette[2])
    draw.line([(7, 8), (9, 8)], fill=palette[4])
    draw.line([(10, 6), (11, 7), (11, 9)], fill=palette[3])
    draw.line([(5, 8), (6, 7), (8, 6), (9, 5)],
              fill='#e39b94' if kind == 'raw' else '#d69450')
    draw.polygon([(7, 9), (9, 9), (10, 10), (9, 11), (7, 11), (6, 10)],
                 fill='#c17a7d' if kind == 'raw' else '#b76c37')
    if kind == 'raw':
        draw.line([(4, 10), (6, 12), (9, 12)], fill='#f1c6b1')
        draw.point((10, 11), fill='#e0ad99')
    else:
        draw.line([(5, 10), (7, 12), (9, 12)], fill=palette[1])
        draw.line([(8, 5), (9, 6)], fill=palette[3])
    assert img.size == (16, 16)
    assert img.getbbox() == (2, 3, 14, 14)
    return img


if __name__ == '__main__':
    for kind in PALETTES:
        path = RP / f'textures/items/swan_meat_{kind}.png'
        icon(kind).save(path)
        print(f'Generated textures/items/{path.name}')
