"""Generates the dewy ground cover textures: the leaf litter and blossom textures with droplet glints.

    python -B mods/lothlorien/tools/make_dew_textures.py

Needs textures/blocks/mallorn_leaf_carpet.png and mallorn_blossom.png (tools/make_mallorn_leaves.py,
tools/make_mallorn_blossoms.py). Output (overwritten every run): <name>_dew.png, and <name>_dew.texture_set.json (inline MERS colour copied from the dry
sheet) next to them. Glints sit on a fixed spaced pattern of the opaque pixels.
"""
import json
from pathlib import Path
from PIL import Image
from json_io import write_text

BLOCKS = Path(__file__).resolve().parents[1] / "lothlorien_rp/textures/blocks"
GLINT = (226, 246, 255, 255)
GLINT_EDGE = (160, 208, 232, 255)
# (name, glint positions on the 16x16 sheet); each must land on an opaque pixel of the dry texture
SPOTS = {
    "mallorn_leaf_carpet": [(2, 1), (6, 3), (11, 2), (14, 5), (3, 6), (9, 7), (1, 10), (5, 13), (10, 11), (13, 14), (14, 9), (7, 15)],
    "mallorn_blossom": [(3, 2), (11, 1), (5, 7), (13, 4), (2, 10), (9, 12), (12, 11), (6, 14)],
}


def main():
    for name, spots in SPOTS.items():
        img = Image.open(BLOCKS / f"{name}.png").convert("RGBA")
        placed = 0
        for x, y in spots:
            if img.getpixel((x, y))[3] == 0:
                continue  # no cover pixel here (blossoms are cut out)
            img.putpixel((x, y), GLINT)
            placed += 1
            if y + 1 < 16 and img.getpixel((x, y + 1))[3]:
                img.putpixel((x, y + 1), GLINT_EDGE)
        img.save(BLOCKS / f"{name}_dew.png")
        # the dew sheet has the dry sheet's MERS layer (an inline colour, so there is no TGA to copy)
        dry = json.loads((BLOCKS / f"{name}.texture_set.json").read_text(encoding="utf8"))["minecraft:texture_set"]
        mers = dry["metalness_emissive_roughness_subsurface"]
        assert isinstance(mers, list), f"{name}: dry MERS must be an inline colour"
        write_text(BLOCKS / f"{name}_dew.texture_set.json", json.dumps(
            {"format_version": "1.21.30", "minecraft:texture_set": {
                "color": f"{name}_dew", "metalness_emissive_roughness_subsurface": mers}}) + "\n")
        print(name, "glints", placed)


if __name__ == "__main__":
    main()
