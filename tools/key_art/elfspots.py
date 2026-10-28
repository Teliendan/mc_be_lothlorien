"""standing spots strictly INSIDE the railing (a fence between the spot and the camera, which looks along -x)."""
import sys, json
sys.path[:0] = ['mods/lothlorien/tools/key_art', '.claude/skills/bedrock-art/scripts']  # run from the workspace root
import mcs
S = 'mods/lothlorien/lothlorien_bp/structures/lothlorien/village/'
PIECES = [('central_mallorn_01.mcstructure', (0, -17, 0), 0), ('combo_tower_a_south_bridge_11.mcstructure', (-1, -17, 23), 0),
          ('combo_node_a_north_bridge_7.mcstructure', (-2, -9, 51), 0), ('combo_tower_c_north_bridge_9.mcstructure', (2, -17, -22), 180)]
out = []
for pi, (name, off, rot) in enumerate(PIECES):
    size, b = mcs.load(S + name)
    if rot == 180:
        b = mcs.rot180(size, b)
    b = {k: v for k, v in b.items() if 'light_block' not in v[0]}
    is_ = lambda p, s: b.get(p, ('',))[0].endswith(s)
    for (x, y, z), (n, st) in b.items():
        if not (n.endswith('planks') or n.endswith('slab')) or (x, y + 1, z) in b or (x, y + 2, z) in b:
            continue
        for depth in (1, 2):  # railing right in front, or one free cell then the railing
            if all((x + d, y + 1, z) not in b and (x + d, y + 2, z) not in b and (is_((x + d, y, z), 'planks') or is_((x + d, y, z), 'slab'))
                   for d in range(1, depth)) and is_((x + depth, y + 1, z), 'fence'):
                bridge = is_((x - 1, y + 1, z), 'fence')  # fences on both sides: a bridge walkway
                out.append({'p': [x + off[0], y + 1 + off[1], z + off[2]], 'depth': depth, 'bridge': bridge, 'piece': pi})
                break
print(json.dumps(out)); print(len(out), sum(o['bridge'] for o in out), file=sys.stderr)
