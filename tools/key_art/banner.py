"""banner scene config = icon scene builder + extended village + warden with bow + elves on decks."""
import json, sys, math
sys.path[:0] = ['mods/lothlorien/tools/key_art', '.claude/skills/bedrock-art/scripts']  # run from the workspace root
import numpy as np
import layout as b

RPE = 'mods/lothlorien/lothlorien_rp/'


def make(tag, o):
    b.EYE = np.array(o['eye'], float); b.YAW, b.PITCH = o['dir']; b.FOV = o['fov']
    b.DEER_AT = tuple(o['deer_at']); b.ASPECT = o['aspect']; b.EXTRA_STRUCT = o['extra']
    b.GIANTS = [tuple(g) for g in o['giants']]; b.EDGE = [tuple(e) for e in o['edge']]
    b.VILLAGE_TRUNKS = [tuple(v) for v in o['vtrunks']]
    c = b.config(tag, o['size']); c['width'] = round(o['size'] * o['aspect'])
    if 'deer_dist' in o:
        dx, dz = b.ground_at(o['deer_at'][0], o['deer_dist'])
        c['entities'][0][3] = [dx * 16 + 8, 0, dz * 16 + 8]
        c['plants'] = [p for p in c['plants'] if math.hypot(p[2] - dx, p[4] - dz) > 1.5 or p[1] != 'tallgrass']
    keep = []
    for pl in c['plants']:
        sx, sy, d = b.project([pl[2] * 16 + 8, 0, pl[4] * 16 + 8])
        if d < o.get('clear_dist', 0) * 16 and 0.06 < sx < 0.94:
            continue
        keep.append(pl)
    c['plants'] = keep
    wx, wz = b.ground_at(*o['warden_at'])
    c['entities'].append([RPE + 'models/entity/elven_warden.geo.json', 'geometry.lothlorien.elven_warden',
                          RPE + 'textures/entity/elven_warden/elven_warden.png', [wx * 16 + 8, 0, wz * 16 + 8], o['warden_yaw'],
                          {'rightArm': [-18, 0, 3], 'leftArm': [0, 0, -3], 'head': o.get('warden_head', [0, 0, 0])},
                          {'tex': RPE + 'textures/items/galadhrim_bow.png', 'bone': 'rightItem', 'pos': [0, 0, 0],
                           'grip': [0, -1, -1], 'local_pivot': [6, 7, 0], 'rot': [0, 90, 45]}])
    for e in o['elves']:
        kind, (x, y, z), yaw = e[:3]
        c['entities'].append([RPE + 'models/entity/elf.geo.json', f'geometry.lothlorien.elf_{kind}',
                              RPE + f'textures/entity/elf/{kind}.png', [x * 16 + 8, y * 16, z * 16 + 8], yaw,
                              e[3] if len(e) > 3 else {}])
    # keep generated trees away from the warden
    c['trees'] = [t for t in c['trees'] if math.hypot(t[3] - wx, t[4] - wz) > 8]
    return c


if __name__ == '__main__':
    tag = sys.argv[1]
    o = {}
    o.update(json.loads(sys.argv[2]) if len(sys.argv) > 2 else {})
    json.dump(make(tag, o), open(f'temp/key_art/{tag}.json', 'w'))
