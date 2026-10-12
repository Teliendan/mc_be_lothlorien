"""Deterministic worn gifts: integer cubes and exactly one face texel per model unit.

Run python -B tools/make_worn_gifts.py. Balance comes from scripts/gift_rules.js.
Final owner selection: B4-v2 broad-clasp belt, C2-v2 Silver River cloak mesh,
with the separately accepted C4 Golden Mallorn inventory icon preserved.
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
    # Owner-selected C4 Golden Mallorn icon, reproduced pixel-for-pixel without
    # reading any iteration scratch. C2 Silver River is the selected worn mesh.
    cloak = Image.new('RGBA', (16, 16))
    d = ImageDraw.Draw(cloak)
    d.polygon([(5, 2), (10, 2), (13, 5), (14, 13), (10, 14), (8, 13), (5, 14), (1, 13), (2, 5)], fill='#52735b')
    d.line([(2, 5), (1, 13), (5, 14), (8, 13), (10, 14), (14, 13), (13, 5)], fill='#b6aa76')
    d.line([(5, 5), (4, 12)], fill='#789477')
    d.line([(10, 5), (11, 12)], fill='#b6aa76')
    d.polygon([(7, 4), (9, 4), (8, 7)], fill='#f1e5bd')
    d.line([(5, 3), (7, 4), (9, 4), (10, 3)], fill='#b6aa76')
    belt = belt_icon()
    for name, image in [('elven_cloak', cloak), ('silver_belt', belt)]:
        target = RP / f'textures/items/{name}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target)


TEAL = ['#203e43', '#355c60', '#527b80', '#91aeaa']
SILVER = ['#465e69', '#78929a', '#a6bdc0', '#e3eee8']


def belt_icon():
    im = Image.new('RGBA', (16, 16))
    d = ImageDraw.Draw(im)
    ramp = SILVER
    d.rectangle((2, 6, 13, 10), fill=ramp[1])
    d.line([(2, 6), (13, 6)], fill=ramp[3])
    d.line([(2, 7), (13, 7)], fill=ramp[2])
    d.line([(2, 10), (13, 10)], fill=ramp[0])
    clasp = SILVER
    d.rectangle((6, 5, 9, 11), fill=clasp[2])
    d.line([(6, 5), (9, 5)], fill=clasp[3])
    d.rectangle((7, 7, 8, 9), fill=TEAL[1])
    d.line([(6, 11), (9, 11)], fill=clasp[0])
    d.line([(7, 4), (8, 4)], fill=SILVER[3])
    d.line([(5, 8), (10, 8)], fill=SILVER[3])
    d.line([(7, 12), (8, 12)], fill=SILVER[2])
    return im


def paint_face(w, h, role, face, kind):
    """Broad shade clusters and whole-texel ornament; no noise or swatch scaling."""
    ramp = TEAL if kind == 'cloak' else SILVER
    trim = SILVER
    im = Image.new('RGBA', (w, h))
    for y in range(h):
        for x in range(w):
            shade = 2 if y < max(1, h//3) else 1
            if face == 'up': shade = 3
            elif face == 'down': shade = 0
            elif face in ('east', 'south'): shade = max(0, shade-1)
            if role == 'cape' and x in (2, w-3): shade = min(3, shade+1)
            if role == 'cape' and x == w//2 and y > 4: shade = max(0, shade-1)
            im.putpixel((x, y), tuple(bytes.fromhex(ramp[shade][1:]))+(255,))
    d = ImageDraw.Draw(im)
    if role in ('cape', 'lapel') and face in ('north', 'south'):
        d.line([(0, 0), (0, h-1)], fill=trim[2])
        d.line([(w-1, 0), (w-1, h-1)], fill=trim[1])
        if role == 'cape': d.line([(0, h-1), (w-1, h-1)], fill=trim[1])
    if role == 'clasp':
        d.rectangle((0, 0, w-1, h-1), fill=trim[2])
        d.line([(0, 0), (w-1, 0)], fill=trim[3])
        d.line([(0, h-1), (w-1, h-1)], fill=trim[0])
        if w >= 3 and h >= 3: d.point((w//2, h//2), fill=TEAL[1])
        elif face in ('north', 'south') and h >= 3:
            d.line([(0, h//2), (w-1, h//2)], fill=TEAL[1])
    if role == 'band' and face in ('north', 'south'):
        d.line([(0, 0), (w-1, 0)], fill=ramp[3])
    return im


class SurfaceSheet:
    """Pack actual face-sized patches. 64px is atlas capacity, not detail density."""
    def __init__(self):
        self.image = Image.new('RGBA', (64, 64))
        self.x = self.y = self.row = 0

    def face(self, size, role, face, kind):
        w, h = size
        assert all(isinstance(v, int) and v > 0 for v in size)
        if self.x + w > 64:
            self.x = 0; self.y += self.row + 1; self.row = 0
        assert self.y + h <= 64, 'material sheet too small'
        tile = paint_face(w, h, role, face, kind)
        assert tile.getchannel('A').getextrema() == (255, 255), 'unpainted face texel'
        uv = {'uv': [self.x, self.y], 'uv_size': [w, h]}
        self.image.paste(tile, (self.x, self.y))
        self.x += w + 1; self.row = max(self.row, h)
        return uv

    def cube(self, origin, size, role, kind):
        w, h, depth = size
        assert all(isinstance(v, int) and v > 0 for v in size)
        dimensions = {'north': (w, h), 'south': (w, h), 'east': (depth, h),
                      'west': (depth, h), 'up': (w, depth), 'down': (w, depth)}
        return {'origin': origin, 'size': size,
                'uv': {f: self.face(dim, role, f, kind) for f, dim in dimensions.items()}}


def validate_density(cubes, image):
    for c in cubes:
        assert all(isinstance(v, int) and v > 0 for v in c['size'])
        assert not c.get('inflate', 0) and 'scale' not in c
        w, h, depth = c['size']
        sizes = {'north': [w, h], 'south': [w, h], 'east': [depth, h],
                 'west': [depth, h], 'up': [w, depth], 'down': [w, depth]}
        for face, dimensions in sizes.items():
            uv = c['uv'][face]
            assert uv['uv_size'] == dimensions, f'{face}: must be one texel per unit'
            x, y = uv['uv']; a, b = dimensions
            assert image.crop((x, y, x+a, y+b)).getchannel('A').getextrema() == (255, 255)


def design(kind):
    sheet = SurfaceSheet()
    make = lambda origin, size, role: sheet.cube(origin, size, role, kind)
    if kind == 'cloak':
        cubes = [make([-4.5, 20.5, -2.5], [9, 3, 5], 'shoulder'),
                 make([-4.5, 2, 2.5], [9, 20, 1], 'cape'),
                 make([-4.5, 17, -3.5], [3, 5, 1], 'lapel'),
                 make([1.5, 17, -3.5], [3, 5, 1], 'lapel'),
                 make([-1, 19, -3.5], [2, 3, 1], 'clasp')]
    else:
        # Hollow band; center x=0, band/buckle center y=14.5. No inflated UVs.
        cubes = [make([-4.5, 13.5, -3], [9, 2, 1], 'band'),
                 make([-1.5, 13, -4], [3, 3, 1], 'clasp'),
                 make([-4.5, 13.5, 2], [9, 2, 1], 'band'),
                 make([-4.5, 13.5, -2], [1, 2, 4], 'band'),
                 make([3.5, 13.5, -2], [1, 2, 4], 'band')]
    validate_density(cubes, sheet.image)
    return cubes, sheet.image


def mesh(name, cubes):
    anchor, bone = f'{name}_anchor', f'{name}_mesh'
    write(RP / f'models/entity/{name}.geo.json', {
        'format_version': '1.16.0', 'minecraft:geometry': [{
            'description': {'identifier': f'geometry.lothlorien.{name}', 'texture_width': 64, 'texture_height': 64,
                            'visible_bounds_width': 2, 'visible_bounds_height': 3, 'visible_bounds_offset': [0, 1, 0]},
            # Scale only the visible child, never the owner-bound anchor. Each
            # attachable has its own names so independent hide gates stay local.
            'bones': [
                {'name': anchor, 'binding': "'body'", 'pivot': [0, 24, 0]},
                {'name': bone, 'parent': anchor, 'pivot': [0, 24, 0], 'cubes': cubes},
            ],
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
    for name, kind in [('elven_cloak', 'cloak'), ('silver_belt', 'belt')]:
        cubes, texture = design(kind)
        mesh(name, cubes)
        target = RP / f'textures/models/{name}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        texture.save(target)
    print('Generated selected B4-v2 belt and C2-v2 cloak at 1 texel/unit; accepted C4 icon preserved.')


if __name__ == '__main__':
    main()
