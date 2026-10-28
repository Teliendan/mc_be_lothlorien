"""diorama built from the mod's REAL worldgen structures (.mcstructure) and block textures/geometries.
World coordinates throughout (x east, z south); cube origins are written as Bedrock geometry coords (x mirrored),
which soft3d mirrors back, so world east stays east."""
import json
from pathlib import Path
from PIL import Image
import sys, glob
sys.path[:0] = ['.claude/skills/bedrock-art/scripts']
import mcs
import numpy as np
import soft3d

RP = Path('mods/lothlorien/lothlorien_rp')
VAN = Path('reference/vanilla/current/resource_packs/vanilla/textures/blocks')
W = Path('temp/key_art')


def T(n):
    return RP / f'textures/blocks/{n}.png'


TILES = {'log_side': T('mallorn_log_side'), 'log_top': T('mallorn_log_top'), 'leaves_side': T('mallorn_leaves_side'),
         'leaves_top': T('mallorn_leaves_top'), 'leaves_bottom': T('mallorn_leaves_bottom'), 'planks': T('mallorn_planks'),
         'hplanks': T('mallorn_heartwood_planks'), 'slog_side': T('mallorn_stripped_log_side'), 'slog_top': T('mallorn_stripped_log_top'),
         'grass_side': VAN / 'grass_side_carried.png', 'grass_top': VAN / 'grass_carried.png', 'dirt': VAN / 'dirt.png',
         'fence': T('mallorn_fence_post'), 'lamp': T('elven_lamp'), 'glow': T('elven_lantern_glow'), 'lwood': T('elven_lantern_wood'),
         'rope': T('elven_rope'), 'carpet': VAN / 'wool_colored_green.png',
         'gold': T('mallorn_golden_leaves'), 'trapdoor': T('mallorn_trapdoor'), 'moss': None, 'moss_tip': None,
         'vine_b': None, 'vine_h': None, 'elanor': T('elanor'), 'niphredil': T('niphredil'), 'jar_glass': T('elven_jar_glass'),
         'jar_inner': T('elven_jar_inner'), 'lamp_h': T('elven_lamp_heartwood'), 'lwood_h': T('elven_lantern_wood_heartwood'),
         'tallgrass': VAN / 'tallgrass_carried.tga', 'fern': VAN / 'fern_carried.tga'}


def newest(name):
    c = sorted(glob.glob(f'reference/vanilla/current/resource_packs/vanilla*/textures/blocks/{name}.png'),
               key=lambda q: [int(v) if v.isdigit() else 0 for v in q.split('vanilla_')[-1].split('/')[0].split('.')])
    return Path(c[-1])


TILES['moss'], TILES['moss_tip'] = newest('pale_hanging_moss_middle'), newest('pale_hanging_moss_tip')
TILES['vine_b'], TILES['vine_h'] = newest('cave_vines_body_berries'), newest('cave_vines_head_berries')
GLOW = ('glow', 'vine_b', 'vine_h', 'jar_inner')
NAMES = list(TILES)
LAYERS = ['far', 'tree', 'ground', 'lamp', 'tree2']
FACES = ('north', 'south', 'east', 'west', 'up', 'down')
NB = {'north': (0, 0, -1), 'south': (0, 0, 1), 'east': (1, 0, 0), 'west': (-1, 0, 0), 'up': (0, 1, 0), 'down': (0, -1, 0)}
SOLID = {'lothlorien:mallorn_log', 'lothlorien:mallorn_planks', 'lothlorien:mallorn_wood', 'lothlorien:mallorn_heartwood_planks',
         'lothlorien:mallorn_stripped_log', 'lothlorien:mallorn_stripped_wood'}
cubes = {l: [] for l in LAYERS}
skipped = {}
lights = []
EMIT = {'elven_lantern': 14, 'elven_lantern_heartwood': 14, 'firefly_jar': 11, 'elven_chandelier': 15,
        'verdant_froglight': 15, 'pearlescent_froglight': 15, 'cave_vines_body_with_berries': 14,
        'cave_vines_head_with_berries': 14, 'white_candle': 3, 'sea_pickle': 6}


def reset():
    lights.clear()
    for l in LAYERS:
        cubes[l] = []


def uvt(layer, tile, u=0, v=0, w=16, h=16):
    return {'uv': [NAMES.index(tile) * 16 + u, LAYERS.index(layer) * 16 + v], 'uv_size': [w, h]}


def cube(layer, x, y, z, faces, h=16):
    """Full block at world block x,y,z; faces maps face -> tile (missing faces are not drawn)."""
    cubes[layer].append({'origin': [-(x * 16 + 16), y * 16, z * 16], 'size': [16, h, 16],
                         'uv': {f: uvt(layer, t, h=16 if f in ('up', 'down') else h) for f, t in faces.items()}})


def stamp(layer, geo, x, y, z, mats, default, bones=None, yrot=0, xf=None):
    g = json.loads((RP / 'models/blocks' / geo).read_text(encoding='utf-8'))['minecraft:geometry'][0]
    ox, oz = -(x * 16 + 8), z * 16 + 8
    for bo in g['bones']:
        if bones is not None and bo['name'] not in bones:
            continue
        for c in bo.get('cubes', []):
            n = {'origin': [c['origin'][0] + ox, c['origin'][1] + y * 16, c['origin'][2] + oz], 'size': c['size'], 'uv': {}}
            if 'rotation' in c:
                p = c.get('pivot', bo.get('pivot', [0, 0, 0]))
                n['rotation'] = c['rotation']
                n['pivot'] = [p[0] + ox, p[1] + y * 16, p[2] + oz]
            elif yrot:
                n['rotation'] = [0, yrot, 0]
                n['pivot'] = [ox, y * 16, oz]
            for f, fu in c['uv'].items():
                t = mats.get(fu.get('material_instance', '*'), default)
                n['uv'][f] = {'uv': [NAMES.index(t) * 16 + fu['uv'][0], LAYERS.index(layer) * 16 + fu['uv'][1]],
                              'uv_size': fu['uv_size']}
            if xf:
                n['xf'] = (soft3d.world_rot(xf), np.array([x * 16 + 8, y * 16 + 8, z * 16 + 8], float))
            cubes[layer].append(n)


def cross(layer, x, y, z, tile):
    for r in (45, -45):
        cubes[layer].append({'origin': [-(x * 16 + 16), y * 16, z * 16 + 8], 'size': [16, 16, 0], 'rotation': [0, r, 0],
                             'pivot': [-(x * 16 + 8), y * 16, z * 16 + 8],
                             'uv': {'north': uvt(layer, tile), 'south': uvt(layer, tile)}})


YROT = {'north': 0, 'west': 90, 'south': 180, 'east': 270}
TRAP = {(0, 'north'): [0, 0, 0], (0, 'south'): [0, 180, 0], (0, 'west'): [0, 90, 0], (0, 'east'): [0, -90, 0],
        (1, 'north'): [-90, 0, 180], (1, 'south'): [90, 0, 0], (1, 'west'): [0, -90, 90], (1, 'east'): [180, 90, 90]}


def structure(layer, path, wx, wy, wz, lamp_layer='lamp', rot=0):
    size, bl = mcs.load(path)
    if rot == 180:
        bl = mcs.rot180(size, bl)
    add_blocks(layer, bl, wx, wy, wz, lamp_layer)
    return size, bl


def add_blocks(layer, bl, wx, wy, wz, lamp_layer='lamp'):
    for (x, y, z), (name, st) in bl.items():
        if wy + y < 0 and layer != 'ground':
            continue  # below the ground surface (sunk structures)
        X, Y, Z = wx + x, wy + y, wz + z

        def nb(f):
            d = NB[f]
            return bl.get((x + d[0], y + d[1], z + d[2]), ('',))[0]

        def vis(faces):
            return {f: t for f, t in faces.items() if nb(f) not in SOLID}

        short = name.split(':')[1]
        lv = int(short[12:]) if short.startswith('light_block_') else EMIT.get(short, 0)
        if lv:
            lights.append((X, Y, Z, lv))
        if short in ('mallorn_log', 'mallorn_stripped_log'):
            s, t = ('log_side', 'log_top') if short == 'mallorn_log' else ('slog_side', 'slog_top')
            ax = st.get('minecraft:block_face', 'up')
            f = {k: s for k in FACES}
            for e in {'up': ('up', 'down'), 'down': ('up', 'down'), 'east': ('east', 'west'), 'west': ('east', 'west'),
                      'south': ('north', 'south'), 'north': ('north', 'south')}[ax]:
                f[e] = t
            cube(layer, X, Y, Z, vis(f))
        elif short in ('mallorn_wood', 'mallorn_stripped_wood'):
            cube(layer, X, Y, Z, vis({k: 'log_side' if short == 'mallorn_wood' else 'slog_side' for k in FACES}))
        elif short in ('mallorn_planks', 'mallorn_heartwood_planks'):
            cube(layer, X, Y, Z, vis({k: 'planks' if short == 'mallorn_planks' else 'hplanks' for k in FACES}))
        elif short == 'mallorn_leaves':
            f = {k: 'leaves_side' for k in FACES[:4]}
            f['up'], f['down'] = 'leaves_top', 'leaves_bottom'
            cube(layer, X, Y, Z, {k: v for k, v in f.items() if nb(k) != 'lothlorien:mallorn_leaves'})
        elif short == 'mallorn_fence':
            rails = [d + '_rails' for d in ('north', 'south', 'east', 'west') if st.get('minecraft:connection_' + d)]
            stamp(layer, 'mallorn_fence.geo.json', X, Y, Z, {}, 'fence', ['post'] + rails)
        elif short in ('elven_lantern', 'elven_lantern_heartwood'):
            h = short.endswith('heartwood')
            stamp(lamp_layer, 'elven_lantern.geo.json', X, Y, Z, {'glow': 'glow', 'wood': 'lwood_h' if h else 'lwood'}, 'lamp_h' if h else 'lamp')
        elif short == 'elven_rope_hanging':
            yr = {'north': 0, 'west': 90, 'south': 180, 'east': 270}[st.get('minecraft:cardinal_direction', 'north')]
            stamp(layer, 'elven_rope.geo.json', X, Y, Z, {}, 'rope', yrot=yr)
        elif short == 'mallorn_golden_leaves':
            cube(layer, X, Y, Z, {k: 'gold' for k in FACES})
        elif short == 'mallorn_slab':
            top = st.get('minecraft:vertical_half') == 'top'
            cubes[layer].append({'origin': [-(X * 16 + 16), Y * 16 + (8 if top else 0), Z * 16], 'size': [16, 8, 16],
                                 'uv': {f: uvt(layer, 'planks', h=16 if f in ('up', 'down') else 8) for f in FACES}})
        elif short in ('mallorn_stairs', 'mallorn_heartwood_stairs'):
            half = st.get('minecraft:vertical_half', 'bottom')
            stamp(layer, f'mallorn_stairs_straight_{half}.geo.json', X, Y, Z, {}, 'planks' if short == 'mallorn_stairs' else 'hplanks',
                  xf=[0, YROT[st.get('minecraft:cardinal_direction', 'north')], 0])
        elif short == 'mallorn_trapdoor':
            stamp(layer, 'mallorn_trapdoor.geo.json', X, Y, Z, {}, 'trapdoor',
                  xf=TRAP[(st.get('lothlorien:open', 0), st.get('minecraft:cardinal_direction', 'north'))])
        elif short == 'pale_hanging_moss':
            cross(layer, X, Y, Z, 'moss_tip' if st.get('tip') else 'moss')
        elif short in ('cave_vines_body_with_berries', 'cave_vines_head_with_berries'):
            cross(lamp_layer, X, Y, Z, 'vine_b' if 'body' in short else 'vine_h')
        elif short in ('elanor', 'niphredil'):
            cross(layer, X, Y, Z, short)
        elif short == 'firefly_jar':
            stamp(lamp_layer, 'firefly_jar.geo.json', X, Y, Z, {'glass': 'jar_glass', 'inner': 'jar_inner'}, 'lamp')
        elif short == 'green_carpet':
            cube(layer, X, Y, Z, {k: 'carpet' for k in FACES}, h=1)
        else:
            skipped[name] = skipped.get(name, 0) + 1


def ground(x0, x1, z0, z1, hfun, layer='ground'):
    for x in range(x0, x1):
        for z in range(z0, z1):
            h = hfun(x, z)
            cube(layer, x, h, z, {'north': 'grass_side', 'south': 'grass_side', 'east': 'grass_side',
                                  'west': 'grass_side', 'up': 'grass_top'})
            cube(layer, x, h - 1, z, {'north': 'dirt', 'south': 'dirt', 'east': 'dirt', 'west': 'dirt'})


def write():
    bones = [{'name': l, 'pivot': [0, 0, 0], 'cubes': cubes[l]} for l in LAYERS if cubes[l]]
    real = Image.new('RGBA', (16 * len(NAMES), 16 * len(LAYERS)))
    for i, n in enumerate(NAMES):
        t = Image.open(TILES[n]).convert('RGBA')
        t = t.resize((16, 16), Image.NEAREST) if t.width != 16 else t.crop((0, 0, 16, 16))
        for j in range(len(LAYERS)):
            real.paste(t, (i * 16, j * 16))
    real.save(W / 'atlas2.png')
    return {'description': {'identifier': 'geometry.scene', 'texture_width': 16 * len(NAMES),
                            'texture_height': 16 * len(LAYERS)}, 'bones': bones}
