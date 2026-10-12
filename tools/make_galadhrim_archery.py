"""M5 native custom bow/arrow definitions and original pixel assets.

Run python -B mods/lothlorien/tools/make_galadhrim_archery.py. Balance comes from
gift_rules.js; the vanilla arrow definition is the M0 owner-tested starting point.
The bow reuses vanilla texture meshes; pull frames and a grip animation are local.
The nocked arrow is painted into all three pull textures, as in the vanilla bow.
"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

MOD = Path(__file__).resolve().parents[1]
ROOT = MOD.parents[1]
BP, RP = MOD / "lothlorien_bp", MOD / "lothlorien_rp"
RULES = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import {BOW_ID,ARROW_ID,BOW,ARROW} from './lothlorien_bp/scripts/gift_rules.js'; console.log(JSON.stringify({BOW_ID,ARROW_ID,BOW,ARROW}));"
], cwd=MOD, text=True))
BOW, BOW_ID, ARROW_ID = RULES["BOW"], RULES["BOW_ID"], RULES["ARROW_ID"]


def write(pack, name, value):
    path = pack / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def item(identifier, components, group=None):
    return {"format_version": "1.26.50", "minecraft:item": {
        "description": {"identifier": identifier, "menu_category": {"category": "equipment", **({"group": group} if group else {})}},
        "components": components}}


write(BP, "items/bow.json", item(BOW_ID, {
    "minecraft:icon": BOW_ID, "minecraft:max_stack_size": 1, "minecraft:hand_equipped": True,
    "minecraft:durability": {"max_durability": BOW["durability"]},
    "minecraft:enchantable": {"slot": "bow", "value": BOW["enchantability"]},
    "minecraft:use_modifiers": {"use_duration": BOW["useSeconds"], "movement_modifier": 0.2, "start_using": "if_first"},
    "minecraft:shooter": {"ammunition": [
        {"item": identifier, "use_offhand": True, "search_inventory": True, "use_in_creative": True}
        for identifier in [ARROW_ID, "minecraft:arrow"]],
        "max_draw_duration": BOW["drawSeconds"], "scale_power_by_draw_duration": True, "charge_on_draw": False}}))
write(BP, "items/galadhrim_arrow.json", item(ARROW_ID, {
    "minecraft:icon": ARROW_ID, "minecraft:max_stack_size": 64,
    "minecraft:projectile": {"projectile_entity": ARROW_ID, "minimum_critical_power": BOW["drawSeconds"]}}, "minecraft:itemGroup.name.arrow"))
arrow = json.loads((MOD / "tools/reference/native_arrow_base.json").read_text())
arrow["minecraft:entity"]["description"]["identifier"] = ARROW_ID
write(BP, "entities/galadhrim_arrow.json", arrow)
client = json.loads((ROOT / "reference/vanilla/current/resource_packs/vanilla/entity/arrow.entity.json").read_text())
client["minecraft:client_entity"]["description"]["identifier"] = ARROW_ID
write(RP, "entity/galadhrim_arrow.entity.json", client)

frames = ["default", "bow_pulling_0", "bow_pulling_1", "bow_pulling_2"]
textures = ["galadhrim_bow", "galadhrim_bow_pulling_0", "galadhrim_bow_pulling_1", "galadhrim_bow_pulling_2"]
geos = ["geometry.bow_standby", "geometry.bow_pulling_0", "geometry.bow_pulling_1", "geometry.bow_pulling_2"]
write(RP, "attachables/bow.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
    "identifier": BOW_ID,
    "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
    "textures": {**dict(zip(frames, [f"textures/items/{t}" for t in textures])), "enchanted": "textures/misc/enchanted_item_glint"},
    "geometry": dict(zip(frames, geos)),
    "animations": {"wield": "animation.bow.wield", "wield_first_person_pull": "animation.bow.wield_first_person_pull", "grip": "animation.lothlorien.bow.grip"},
    "scripts": {"pre_animation": [
        f"variable.charge_amount = math.clamp((query.main_hand_item_max_duration - (query.main_hand_item_use_duration - query.frame_alpha + 1.0)) / {BOW['drawSeconds'] * 20:.1f}, 0.0, 1.0);",
        "variable.bow_tex_idx = query.main_hand_item_use_duration <= 0.0 ? 0 : (variable.charge_amount < 0.65 ? 1 : (variable.charge_amount < 0.9 ? 2 : 3));"],
        "animate": ["wield", {"wield_first_person_pull": "query.main_hand_item_use_duration > 0.0 && c.is_first_person"}, "grip"]},
    "render_controllers": ["controller.render.lothlorien.bow"]}}})
write(RP, "render_controllers/bow.render_controllers.json", {"format_version": "1.10.0", "render_controllers": {"controller.render.lothlorien.bow": {
    "arrays": {"textures": {"array.bow_textures": [f"texture.{x}" for x in frames]}, "geometries": {"array.bow_geometries": [f"geometry.{x}" for x in frames]}},
    "geometry": "array.bow_geometries[variable.bow_tex_idx]",
    "materials": [{"*": "variable.is_enchanted ? material.enchanted : material.default"}],
    "textures": ["array.bow_textures[variable.bow_tex_idx]", "texture.enchanted"]}}})
# Keep vanilla first-person pose, lower the third-person grip from the M0 spike.
# 15-pixel limbs at 1.12 scale make this a modestly longer bow than vanilla.
write(RP, "animations/bow.animation.json", {"format_version": "1.10.0", "animations": {"animation.lothlorien.bow.grip": {
    "loop": True, "bones": {"rightitem": {"position": [0, "c.is_first_person ? 0.0 : -3.0", 0], "scale": 1.12}}}}})

WOOD = {"shadow": "#645239", "mid": "#b18d4d", "light": "#ddbe76"}
STRING = "#a9b5ad"
SILVER = "#e2ead7"


def bow_frame(frame):
    """Original slender mallorn longbow; frame 0 is idle, 1..3 are drawing."""
    im = Image.new("RGBA", (16, 16))
    d = ImageDraw.Draw(im)
    top, bottom = (14, 1 + max(0, frame - 1)), (1 + max(0, frame - 1), 14)
    limbs = [top, (11, 2 + bool(frame)), (8, 3), (6, 4),
             (4, 6), (3, 8), (2 + bool(frame), 11), bottom]
    # Two-pixel limbs, with single-pixel silver caps and a narrow green grip.
    d.line(limbs, fill=WOOD["shadow"], width=2)
    d.line(limbs, fill=WOOD["mid"], width=1)
    d.point([(11, 2 + bool(frame)), (8, 3), (3, 8)], fill=WOOD["light"])
    d.line([(6, 4), (4, 6)], fill="#294c3b", width=2)
    d.point([(6, 4), (4, 6)], fill="#789176")
    nock = (9 + frame, 9 + frame)
    d.line([top, nock, bottom] if frame else [top, bottom], fill=STRING)
    d.point([top, bottom], fill=SILVER)
    if frame:
        # Vanilla meshes extrude the texture: an explicit arrow is essential.
        # Keep the shaft diagonal through the grip and the nock on the string.
        tip = (nock[0] - 9, nock[1] - 9)
        d.line([tip, nock], fill="#d6c590")
        d.point((tip[0] + 1, tip[1]), fill="#8faaa1")
        d.point(tip, fill="#eef1e0")
        d.point((tip[0], tip[1] + 1), fill="#b9ccbd")
    # Full-draw tip is unambiguously present and idle carries no loaded arrow.
    assert im.getbbox() is not None
    if frame:
        assert im.getpixel(tip)[3] == 255
        assert im.getpixel(nock)[3] == 255
    return im


for i, name in enumerate(textures):
    path = RP / f"textures/items/{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    bow_frame(i).save(path)
im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im)
d.line([(3, 12), (12, 3)], fill="#574e38", width=2)
d.line([(3, 12), (12, 3)], fill="#c5b17a")
# Owner-selected arrow 3 (2026-10-11): broad silver point, green feathers.
d.polygon([(10, 3), (14, 1), (12, 5), (12, 3)], fill="#dce4db")
d.point([(12, 2), (13, 2)], fill="#8faaa1")
d.polygon([(1, 11), (4, 10), (5, 12), (2, 14)], fill="#60866b")
d.line([(2, 13), (4, 11)], fill="#b1c5a6")
im.save(RP / "textures/items/galadhrim_arrow.png")
print("Generated Galadhrim bow, pull frames and arrow (balance: gift_rules.js).")
