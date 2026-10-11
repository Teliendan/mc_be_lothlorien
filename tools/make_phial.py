"""Generate the final 16px silver/crystal star phial and invisible helper texture.

python -B mods/lothlorien/tools/make_phial.py
"""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageDraw

RP = Path(__file__).resolve().parents[1] / "lothlorien_rp"
ROOT = RP.parent


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
    image = Image.new("RGBA", (16, 16))
    draw = ImageDraw.Draw(image)
    # Crystal flask: narrow silver stopper, elliptical shoulders and pointed base.
    draw.rectangle((6, 1, 9, 2), fill="#637c92")
    draw.line((6, 1, 9, 1), fill="#f0f5ec")
    draw.rectangle((7, 3, 8, 4), fill="#d1e7ec")
    draw.polygon([(6, 5), (9, 5), (11, 7), (11, 12), (9, 14), (6, 14), (4, 12), (4, 7)], fill="#496e88")
    draw.polygon([(6, 6), (9, 6), (10, 8), (10, 12), (8, 13), (6, 13), (5, 11), (5, 8)], fill="#95cce1")
    draw.line((5, 8, 5, 11), fill="#e8ffff")
    draw.line((6, 12, 8, 13), fill="#d5edf3")
    # White starlight in pale blue water, silver-blue edge gives it shape in hand.
    draw.line((8, 7, 8, 11), fill="#ffffff")
    draw.line((6, 9, 10, 9), fill="#ffffff")
    draw.point((7, 8), fill="#e9ffff")
    draw.point((9, 10), fill="#e9ffff")
    image.save(RP / "textures/items/phial_of_galadriel.png")
    Image.new("RGBA", (16, 16)).save(RP / "textures/blocks/phial_light.png")


if __name__ == "__main__":
    main()
