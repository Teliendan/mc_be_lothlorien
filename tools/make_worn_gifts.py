"""Deterministic worn gifts: final item data, pixel icons and simple body-bound meshes.

Run python -B tools/make_worn_gifts.py. Balance comes from scripts/gift_rules.js.
"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / 'lothlorien_bp', ROOT / 'lothlorien_rp'
RULES = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {CLOAK,BELT} from './lothlorien_bp/scripts/gift_rules.js';console.log(JSON.stringify({CLOAK,BELT}));"
], cwd=ROOT, text=True))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def item(name, components):
    write(BP / f'items/{name}.json', {
        'format_version': '1.26.50', 'minecraft:item': {
            'description': {'identifier': f'lothlorien:{name}', 'menu_category': {'category': 'equipment'}},
            'components': {'minecraft:icon': f'lothlorien:{name}', 'minecraft:max_stack_size': 1, **components},
        },
    })


def icons():
    cloak = Image.new('RGBA', (16, 16))
    d = ImageDraw.Draw(cloak)
    d.polygon([(5, 2), (10, 2), (12, 5), (13, 13), (10, 14), (8, 13), (5, 14), (2, 13), (3, 5)], fill='#314c40')
    d.polygon([(5, 3), (10, 3), (10, 5), (8, 6), (5, 5)], fill='#7d9277')
    d.line([(5, 5), (4, 12), (5, 13)], fill='#8d9d7f')
    d.line([(8, 6), (7, 12)], fill='#58765b')
    d.line([(10, 5), (11, 12)], fill='#1d3931')
    d.line([(3, 12), (5, 13), (8, 12), (10, 13), (12, 12)], fill='#65856a')
    d.polygon([(7, 4), (9, 4), (8, 6)], fill='#d3e4ce')
    d.point((8, 4), fill='#f4fae8')
    belt = Image.new('RGBA', (16, 16))
    d = ImageDraw.Draw(belt)
    d.polygon([(3, 4), (11, 4), (13, 6), (13, 10), (10, 12), (4, 12), (2, 10), (2, 6)], fill='#465b69')
    d.line([(3, 5), (11, 5), (12, 6)], fill='#e5f1ed')
    d.line([(3, 6), (3, 10), (5, 11), (10, 11), (12, 9)], fill='#a9c3c5')
    d.line([(5, 7), (10, 7), (11, 8)], fill='#748f9a')
    d.rectangle((6, 8, 9, 12), fill='#d1dfd8')
    d.rectangle((7, 9, 8, 11), fill='#5d7c7c')
    d.point((6, 8), fill='#f8fff2')
    for name, image in [('elven_cloak', cloak), ('silver_belt', belt)]:
        target = RP / f'textures/items/{name}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target)


def textures():
    # Shared cube-unwrapped sheets, with woven green/silver material and restrained trim.
    for name, palette in [('elven_cloak', ['#47664e', '#58765b', '#698466', '#799171']),
                          ('silver_belt', ['#78929a', '#a6bdc0', '#d3e0db', '#eef5e9'])]:
        im = Image.new('RGBA', (64, 64))
        for y in range(64):
            for x in range(64):
                if name == 'elven_cloak':
                    shade = 0 if x % 7 == 0 else (1 if (x + y) % 4 else 2)
                    if y % 18 in (0, 17): shade = 3
                else:
                    shade = 3 if y % 4 == 0 else (1 if y % 4 == 3 else 2)
                    if x % 8 == 0: shade = 0
                im.putpixel((x, y), tuple(bytes.fromhex(palette[shade][1:])) + (255,))
        target = RP / f'textures/models/{name}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        im.save(target)


def mesh(name, cubes):
    bone = f'{name}_body'
    write(RP / f'models/entity/{name}.geo.json', {
        'format_version': '1.16.0', 'minecraft:geometry': [{
            'description': {'identifier': f'geometry.lothlorien.{name}', 'texture_width': 64, 'texture_height': 64,
                            'visible_bounds_width': 2, 'visible_bounds_height': 3, 'visible_bounds_offset': [0, 1, 0]},
            'bones': [{'name': bone, 'binding': "'body'", 'pivot': [0, 24, 0], 'cubes': cubes}],
        }],
    })
    hide = f'animation.lothlorien.{name}.hide_first_person'
    write(RP / f'animations/{name}.animation.json', {
        'format_version': '1.8.0', 'animations': {hide: {'loop': True, 'bones': {bone: {'scale': 0}}}},
    })
    write(RP / f'attachables/{name}.json', {
        'format_version': '1.10.0', 'minecraft:attachable': {'description': {
            'identifier': f'lothlorien:{name}',
            'materials': {'default': 'entity_alphatest', 'enchanted': 'entity_alphatest_glint'},
            'textures': {'default': f'textures/models/{name}', 'enchanted': 'textures/misc/enchanted_item_glint'},
            'geometry': {'default': f'geometry.lothlorien.{name}'},
            'animations': {'hide_first_person': hide},
            'scripts': {'animate': [{'hide_first_person': 'c.is_first_person || query.is_invisible' if name == 'elven_cloak' else 'c.is_first_person'}],
                        **({'parent_setup': 'variable.is_holding_left = 0.0;'} if name == 'silver_belt' else {})},
            'render_controllers': ['controller.render.item_default'],
        }},
    })


def main():
    item('elven_cloak', {
        'minecraft:wearable': {'slot': 'slot.armor.chest', 'protection': RULES['CLOAK']['armor']},
        'minecraft:durability': {'max_durability': RULES['CLOAK']['durability']},
    })
    item('silver_belt', {
        'minecraft:allow_off_hand': True,
        'minecraft:wearable': {'slot': 'slot.weapon.offhand'},
    })
    icons()
    textures()
    mesh('elven_cloak', [
        {'origin': [-4.5, 20.5, -2.5], 'size': [9, 3, 5], 'uv': [0, 0]},
        {'origin': [-4.5, 4, 2.3], 'size': [9, 18, 0.8], 'uv': [0, 16]},
        {'origin': [-4.8, 7, 2.4], 'size': [1, 14, 0.9], 'uv': [24, 16]},
        {'origin': [3.8, 7, 2.4], 'size': [1, 14, 0.9], 'uv': [28, 16]},
    ])
    mesh('silver_belt', [
        {'origin': [-4, 11.5, -2], 'size': [8, 2, 4], 'inflate': 1.1, 'uv': [16, 16]},
        {'origin': [-1.2, 10.7, -3.25], 'size': [2.4, 3.6, 0.5], 'uv': [0, 32]},
    ])
    print('Generated cloak and silver belt items, icons, textures and attachables.')


if __name__ == '__main__':
    main()
