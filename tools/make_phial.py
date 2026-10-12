"""Generate the selected 16px faceted moon crystal and invisible helper texture.

python -B mods/lothlorien/tools/make_phial.py
"""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
ROOT = RP.parent
SILVER = "#8ba3b5"
EDGE = "#496a83"
PALE = "#d3eef1"
BLUE = "#87bfd6"
WHITE = "#f2ffff"


def phial_icon():
    """Owner-selected P4/D, reproduced from the review study with no scratch input."""
    image = Image.new("RGBA", (16, 16))
    draw = ImageDraw.Draw(image)
    # Silver stopper above a narrow neck, with blue edges around clear facets.
    draw.rectangle((6, 0, 9, 1), fill=SILVER)
    draw.line((6, 0, 9, 0), fill=WHITE)
    draw.rectangle((7, 2, 8, 3), fill=PALE)
    draw.polygon([(7, 4), (8, 4), (11, 7), (11, 10), (8, 14), (7, 14), (4, 10), (4, 7)], fill=EDGE)
    draw.polygon([(7, 5), (8, 5), (10, 7), (10, 10), (8, 13), (7, 13), (5, 10), (5, 7)], fill=BLUE)
    draw.polygon([(7, 5), (7, 12), (5, 9), (5, 7)], fill=PALE)
    draw.line((7, 5, 8, 5), fill=WHITE)
    draw.line((5, 7, 5, 9), fill=WHITE)
    draw.line((8, 6, 9, 7), fill="#acdbe7")
    draw.line((9, 11, 8, 12), fill=PALE)
    # White starlight crosses the central facets, matching the accepted study.
    draw.line((8, 7, 8, 11), fill=WHITE)
    draw.line((6, 9, 10, 9), fill=WHITE)
    assert image.getbbox() == (4, 0, 12, 15)
    assert sum(image.getpixel((x, y))[3] > 0 for y in range(16) for x in range(16)) == 72
    return image


def main():
    # Read JavaScript's production tuning directly rather than maintaining a copy.
    rules = json.loads(subprocess.run([
        "node", "--input-type=module", "-e",
        "const r = await import(process.argv[1]); console.log(JSON.stringify({level:r.PHIAL_LIGHT_LEVEL}));",
        (ROOT / "lothlorien_bp/scripts/gift_rules.js").as_uri(),
    ], check=True, capture_output=True, text=True).stdout)
    block_path = ROOT / "lothlorien_bp/blocks/phial_light.json"
    block = json.loads(block_path.read_text(encoding="utf-8"))
    block["minecraft:block"]["components"]["minecraft:light_emission"] = rules["level"]
    block_path.write_text(json.dumps(block, indent=2) + "\n", encoding="utf-8")
    phial_icon().save(RP / "textures/items/phial_of_galadriel.png")
    Image.new("RGBA", (16, 16)).save(RP / "textures/blocks/phial_light.png")


if __name__ == "__main__":
    main()
