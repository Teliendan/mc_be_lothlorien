"""Generate the two 16x16 swan-meat icons as an angled bone-in poultry leg.

python -B mods/lothlorien/tools/make_swan_meat.py
Deterministic shading, top-left light, no random noise or alternate variants.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

RP = Path(__file__).resolve().parents[1] / 'lothlorien_rp'
MEAT_OUTLINE = [(8, 2), (11, 2), (13, 3), (14, 5), (14, 7), (12, 9),
                (9, 10), (7, 10), (5, 12), (3, 11), (4, 9), (6, 7), (6, 4)]
BONE_OUTLINE = [(2, 11), (4, 11), (5, 12), (4, 13), (3, 13),
                (3, 14), (1, 14), (1, 12)]
PALETTES = {
    'raw': ['#713d46', '#98505a', '#b56a70', '#d58c8b', '#edaaa0', '#f8c6b2'],
    'cooked': ['#61351e', '#874224', '#a65b2c', '#c37c3e', '#e3a55d', '#f2c57e'],
}


def icon(kind):
    mask = Image.new('1', (16, 16))
    ImageDraw.Draw(mask).polygon(MEAT_OUTLINE, fill=1)
    bone = Image.new('1', (16, 16))
    ImageDraw.Draw(bone).polygon(BONE_OUTLINE, fill=1)
    img = Image.new('RGBA', (16, 16))
    palette = PALETTES[kind]
    for y in range(16):
        for x in range(16):
            if bone.getpixel((x, y)):
                shade = '#f6e7c9' if not bone.getpixel((x, y - 1)) else '#d7bd8b'
                if not bone.getpixel((x, y + 1)):
                    shade = '#998064'
                img.putpixel((x, y), tuple(bytes.fromhex(shade[1:])) + (255,))
            if not mask.getpixel((x, y)):
                continue
            shade = max(1, min(5, 6 - (x + y - 5) // 4))
            if not mask.getpixel((x + 1, y)) or not mask.getpixel((x, y + 1)):
                shade = 0 if x + y > 15 else 2
            elif not mask.getpixel((x - 1, y)) or not mask.getpixel((x, y - 1)):
                shade = 3
            img.putpixel((x, y), tuple(bytes.fromhex(palette[shade][1:])) + (255,))
    draw = ImageDraw.Draw(img)
    # Curved highlights follow the broad end, then narrow toward the bone.
    draw.line([(7, 4), (9, 3), (11, 3)], fill=palette[5])
    draw.polygon([(7, 5), (9, 4), (11, 5), (10, 6), (8, 6)], fill=palette[4])
    draw.line([(8, 7), (10, 6), (12, 5)],
              fill='#e39b94' if kind == 'raw' else '#d69450')
    draw.polygon([(10, 7), (12, 6), (13, 7), (11, 8), (9, 8)],
                 fill='#c17a7d' if kind == 'raw' else '#b76c37')
    draw.line([(6, 8), (7, 9), (9, 9)], fill=palette[2])
    draw.line([(4, 10), (5, 9), (6, 9)], fill=palette[3])
    if kind == 'raw':
        draw.line([(7, 3), (6, 4), (6, 6), (5, 8), (4, 9)], fill='#f1c6b1')
        draw.point((6, 7), fill='#e0ad99')
    else:
        draw.line([(7, 3), (6, 4), (6, 6), (5, 8), (4, 9)], fill=palette[4])
        draw.line([(10, 4), (11, 5), (11, 6)], fill=palette[2])
    # Clip surface highlights to the authored meat/bone silhouette.
    img.putalpha(ImageChops.lighter(mask.convert('L'), bone.convert('L')))
    assert img.size == (16, 16)
    assert img.getbbox() == (1, 2, 15, 15)
    assert all(not img.getpixel((x, y))[3] or mask.getpixel((x, y)) or bone.getpixel((x, y))
               for y in range(16) for x in range(16)), 'shading must stay inside the silhouette'
    return img


if __name__ == '__main__':
    for kind in PALETTES:
        path = RP / f'textures/items/swan_meat_{kind}.png'
        icon(kind).save(path)
        print(f'Generated textures/items/{path.name}')
