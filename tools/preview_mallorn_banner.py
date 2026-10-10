"""Preview sheet for the mallorn banner: tints pattern layers by dye like the game (texture * dye).

Usage: python -B tools/preview_mallorn_banner.py [textures/entity dir] [out.png]
"""
import sys
from pathlib import Path
from PIL import Image

V = Path("C:/mcmods/reference/vanilla/current/resource_packs/vanilla_1.21.90/textures/entity")
DYE = {"white": (240, 240, 240), "yellow": (254, 216, 61), "green": (94, 124, 22), "lime": (128, 199, 31),
       "silver": (157, 157, 151), "light_blue": (58, 179, 218), "cyan": (22, 156, 156), "blue": (60, 68, 170),
       "brown": (131, 84, 50), "black": (29, 29, 33), "gray": (71, 79, 82), "orange": (249, 128, 29)}


def tint(im, rgb):
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            px[x, y] = (r * rgb[0] // 255, g * rgb[1] // 255, b * rgb[2] // 255, a)
    return im


def render(base, layers, out_dir):
    ban = tint(Image.open(V / "banner/banner_base.tga"), DYE[base])
    sh = Image.open(V / "shield.png").convert("RGBA")
    sh.alpha_composite(tint(Image.open(V / "shield_patterns/base.png"), DYE[base]))
    for name, dye in layers:
        ban.alpha_composite(tint(Image.open(out_dir / "banner" / f"banner_{name}.png"), DYE[dye]))
        sh.alpha_composite(tint(Image.open(out_dir / "shield_patterns" / f"{name}.png"), DYE[dye]))
    b = ban.crop((1, 1, 21, 41)).resize((160, 320), Image.NEAREST)
    s = sh.crop((2, 2, 12, 22)).resize((80, 160), Image.NEAREST)
    return b, s


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "lothlorien_rp/textures/entity"
    out_png = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("C:/mcmods/temp/mallorn_banner_preview.png")
    combos = [("cyan", [("piglin", "white"), ("globe", "lime")]),
              ("blue", [("piglin", "white"), ("globe", "lime")]),
              ("green", [("piglin", "white"), ("globe", "lime")]),
              ("silver", [("piglin", "white"), ("globe", "lime")]),
              ("cyan", [("piglin", "white"), ("globe", "yellow")]),
              ("green", [("piglin", "white"), ("globe", "yellow")])]
    sheet = Image.new("RGBA", (len(combos) * 180, 520), (70, 70, 70, 255))
    for i, (base, layers) in enumerate(combos):
        b, s = render(base, layers, out_dir)
        sheet.alpha_composite(b, (i * 180 + 10, 10))
        sheet.alpha_composite(s, (i * 180 + 50, 345))
    sheet.save(out_png)


if __name__ == "__main__":
    main()
