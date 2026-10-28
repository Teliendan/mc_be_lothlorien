"""compose config for the icon scene (positions solved from screen targets)."""
import json, math, sys
import numpy as np
sys.path[:0] = ['mods/lothlorien/tools/key_art', '.claude/skills/bedrock-art/scripts']  # run from the workspace root
import mcs
S = 'mods/lothlorien/lothlorien_bp/structures/lothlorien/'
B = 16
FRAME = None
GIANTS = [("mallorn_roundplain_02.mcstructure", 0.05, 120), ("mallorn_roundplain_06.mcstructure", 0.45, 150),
          ("mallorn_roundplain_03.mcstructure", 0.95, 105), ("mallorn_round_07.mcstructure", 0.30, 170)]
VILLAGE_TRUNKS = [(11, 11), (7, 42), (5, 63)]
EDGE = [("fancy", -0.12, 16), ("mega", 1.10, 24)]


def project(p):
    fwd, right, up = basis(); f = 0.5 / math.tan(math.radians(FOV) / 2)
    v = np.array(p, float) - EYE; z = v @ fwd
    return 0.5 + f * (v @ right) / z / ASPECT, 0.5 - f * (v @ up) / z, z


def forest(n=170, seed=4):
    import random
    rng = random.Random(seed); out = []
    kinds = ['simple'] * 25 + ['fancy'] * 60 + ['mega'] * 15
    for kind, sx, dist in EDGE:  # framing trees near the camera at the frame edges
        x, z = ground_at(sx, dist)
        out.append(["tree2", kind, rng.randrange(10**6), x, z])
    vd = project([11 * B, 0, 11 * B])[2]
    tries = 0
    while len(out) < n and tries < 20000:
        tries += 1
        x, z = rng.randint(-90, 70), rng.randint(-80, 120)
        if any(math.hypot(x - a, z - b) < 10 for a, b in VILLAGE_TRUNKS):
            continue
        if any(math.hypot(x - t[3], z - t[4]) < 6 for t in out):
            continue
        sx, sy, d = project([x * B, 0, z * B])
        if d < 26 * B or not (-0.3 < sx < 1.3):
            continue
        if d < vd * 1.15 and 0.12 < sx < 0.88:   # keep the view to the deer and the village clear
            continue
        out.append(["far" if d > vd else "tree2", rng.choice(kinds), rng.randrange(10**6), x, z])
    return out
DEER_AT = (0.30, 0.93)
ASPECT = 1.0
EXTRA_STRUCT = []
EYE = np.array([1568, 20, 32.]); YAW, PITCH, FOV = 288, 10, 50


def basis():
    ry, rp = math.radians(YAW), math.radians(PITCH)
    fwd = np.array([math.cos(rp)*math.sin(ry), math.sin(rp), math.cos(rp)*math.cos(ry)])
    right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right)
    return fwd, right, np.cross(right, fwd)


def ground_at(sx, dist):
    """world block (x, z) on the ground plane at screen column sx and horizontal distance dist (blocks)."""
    fwd, right, up = basis()
    f = 0.5 / math.tan(math.radians(FOV) / 2)
    d = fwd + (sx - 0.5) * ASPECT / f * right
    d[1] = 0; d /= np.linalg.norm(d)
    p = EYE + d * dist * B
    return int(round(p[0] / B)), int(round(p[2] / B))


def trunk(name):
    _, bl = mcs.load(S + name)
    pts = [k for k, v in bl.items() if v[0].endswith('mallorn_log') and k[1] == 0]
    return (sum(p[0] for p in pts) / len(pts), sum(p[2] for p in pts) / len(pts))


def tree_at(layer, name, bx, bz, y=-5):  # giant_mallorn start_height: absolute -5
    cx, cz = trunk(name)
    return [layer, name, int(bx - cx), y, int(bz - cz)]


def config(tag, size=512, extra=None):
    V = -17  # elven_village start_height: absolute -17 below the surface
    st = [["tree", "village/central_mallorn_01.mcstructure", 0, V, 0], ["tree", "village/crown_central_a.mcstructure", -5, V + 48, -5],
          ["far", "village/combo_tower_a_south_bridge_11.mcstructure", -1, V, 23], ["far", "village/crown_large.mcstructure", -3, V + 48, 32],
          ["far", "village/combo_node_a_north_bridge_7.mcstructure", -2, V + 8, 51], ["far", "village/crown_medium.mcstructure", -3, V + 48, 55]]
    st += EXTRA_STRUCT
    for name, sx, dist in GIANTS:
        st.append(tree_at("far", name, *ground_at(sx, dist)))
    trees = forest()
    # near framing tree at the right edge
    if FRAME:
        st.append(tree_at("tree2", "mallorn_roundplain_08.mcstructure", *ground_at(*FRAME)))
    fwd, right, up = basis(); f = 0.5 / math.tan(math.radians(FOV) / 2)
    r = fwd + (DEER_AT[0] - 0.5) * ASPECT / f * right - (DEER_AT[1] - 0.5) / f * up
    hp = EYE + r * (-EYE[1] / r[1])
    deer = [round(hp[0]), 0, round(hp[2])]
    plants = []
    import random
    rng = random.Random(7)
    dx, dz = deer[0] // B, deer[2] // B
    for i in range(140):
        x, z = dx + rng.randint(-16, 2), dz + rng.randint(-10, 14)
        if math.hypot(x * B - EYE[0], z * B - EYE[2]) < 5 * B:
            continue
        k = rng.random()
        kind = 'elanor' if k < 0.12 else 'niphredil' if k < 0.2 else 'fern' if k < 0.35 else 'tallgrass'
        plants.append(["ground", kind, x, 0, z])
    cfg = {"tag": tag, "eye": list(EYE), "dir": [YAW, PITCH], "fov": FOV, "size": size, "structures": st, "trees": trees,
           "ground": [-40, 130, -60, 110, 999], "plants": plants,
           "entities": [["mods/lothlorien/lothlorien_rp/models/entity/deer.geo.json", "geometry.lothlorien.deer_buck",
                         "mods/lothlorien/lothlorien_rp/textures/entity/deer/deer_white.png", deer, 0]]}
    if extra:
        cfg.update(extra)
    return cfg


if __name__ == '__main__':
    tag = sys.argv[1]
    if len(sys.argv) > 2:
        o = json.loads(sys.argv[2])
        EYE = np.array(o.get('eye', EYE), float); YAW, PITCH = o.get('dir', [YAW, PITCH]); FOV = o.get('fov', FOV)
        DEER_AT = tuple(o.get('deer_at', DEER_AT)); FRAME = o.get('frame')
        ASPECT = o.get('aspect', 1.0); EXTRA_STRUCT = o.get('extra', [])
        if 'giants' in o: GIANTS = [tuple(g) for g in o['giants']]
        if 'edge' in o: EDGE = [tuple(e) for e in o['edge']]
        if 'vtrunks' in o: VILLAGE_TRUNKS = [tuple(v) for v in o['vtrunks']]
        c = config(tag, o.get('size', 512))
        if ASPECT != 1.0: c['width'] = round(c['size'] * ASPECT)
        if 'n_trees' in o: pass
        if 'deer_yaw' in o: c['entities'][0][4] = o['deer_yaw']
        if 'pose' in o: c['entities'][0].append(o['pose'])
        fwd, right, up = basis(); f = 0.5 / math.tan(math.radians(FOV) / 2)
        RPE = 'mods/lothlorien/lothlorien_rp/'
        for kind, tex, sx, sy, dist, yaw, pose in o.get('critters', []):
            r = fwd + (sx - 0.5) * ASPECT / f * right - (sy - 0.5) / f * up
            p = EYE + r / np.linalg.norm(r) * dist * B
            c['entities'].append([RPE + f'models/entity/{kind}.geo.json', f'geometry.lothlorien.{kind}',
                                  RPE + f'textures/entity/{kind}/{kind}_{tex}.png', [round(v, 1) for v in p], yaw, pose])
        print(json.dumps(c))
    else:
        print(json.dumps(config(tag)))
