"""M5 native custom bow/arrow definitions and original pixel assets.

Run python -B mods/lothlorien/tools/make_galadhrim_archery.py. Balance comes from
gift_rules.js; the vanilla arrow definition is the M0 owner-tested starting point.
The bow reuses vanilla texture meshes; pull frames and a grip animation are local.
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
arrow = json.loads((ROOT / "temp/elven_inhabitants/spike_files/lothlorien_bp/entities/spike_arrow.json").read_text())
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
write(RP, "animations/bow.animation.json", {"format_version": "1.10.0", "animations": {"animation.lothlorien.bow.grip": {
    "loop": True, "bones": {"rightitem": {"position": [0, "c.is_first_person ? 0.0 : -3.0", 0]}}}}})

# Warm mallorn wood, silver leaf tips, dark green grip and pale hithlain string.
for i, name in enumerate(textures):
    im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im)
    ends = [(12, 2), (9, 2), (7, 3), (5, 5), (3, 7), (2, 10), (2, 13)]
    if i:
        ends = [(12, 2), (10, 3), (8, 4), (6, 6), (4, 8), (3, 10), (2, 13)]
    d.line(ends, fill="#554d38", width=3)
    d.line(ends, fill="#c5ab69", width=1)
    pull = 7 + i
    d.line([ends[0], (pull, pull), ends[-1]], fill="#d7dfd0", width=1)
    d.line([(5 + bool(i), 5 + bool(i)), (3 + bool(i), 7 + bool(i))], fill="#2e5040", width=3)
    d.point([(5 + bool(i), 5 + bool(i)), (4 + bool(i), 6 + bool(i)), (3 + bool(i), 7 + bool(i))], fill="#78917b")
    for x, y in (ends[0], ends[-1]):
        d.point((x, y), fill="#f1f0d3")
        d.point((x + 1, y), fill="#a6b7aa")
    path = RP / f"textures/items/{name}.png"; path.parent.mkdir(parents=True, exist_ok=True); im.save(path)
im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im)
d.line([(3, 12), (12, 3)], fill="#574e38", width=2)
d.line([(3, 12), (12, 3)], fill="#c5b17a")
d.polygon([(10, 2), (14, 1), (13, 5)], fill="#dce4db")
d.line([(11, 3), (14, 1)], fill="#8faaa1")
d.polygon([(1, 11), (4, 10), (5, 13), (2, 14)], fill="#e1e5cc")
d.line([(2, 14), (4, 12)], fill="#78917b")
im.save(RP / "textures/items/galadhrim_arrow.png")
print("Generated Galadhrim bow, pull frames and arrow (balance: gift_rules.js).")
