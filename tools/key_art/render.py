"""render real structures + entities with soft3d into raw buffers (npz + preview png)."""
import json, math, sys, time
sys.path[:0] = ['mods/lothlorien/tools/key_art', '.claude/skills/bedrock-art/scripts']  # run from the workspace root
import numpy as np, soft3d
import scene as scene2
from PIL import Image

S = 'mods/lothlorien/lothlorien_bp/structures/lothlorien/'
W = 'temp/key_art'


def entity(path, gid):
    gs = json.load(open(path))
    if 'minecraft:geometry' in gs:
        return [g for g in gs['minecraft:geometry'] if g['description']['identifier'] == gid][0]
    g = gs[gid]
    return {'description': {'identifier': gid, 'texture_width': g.get('texturewidth', 64),
                            'texture_height': g.get('textureheight', 64)}, 'bones': g['bones']}


def eye_of(look, yaw, pitch, d):
    ry, rp = math.radians(yaw), math.radians(pitch)
    return [look[0] + d * math.cos(rp) * math.sin(ry), look[1] + d * math.sin(rp), look[2] - d * math.cos(rp) * math.cos(ry)]


def shoot(cfg):
    scene2.reset()
    for st in cfg['structures']:
        scene2.structure(st[0], S + st[1], st[2], st[3], st[4], rot=st[5] if len(st) > 5 else 0)
    import treegen, random
    for layer, kind, seed, x, z in cfg.get('trees', []):
        rng = random.Random(seed)
        scene2.add_blocks(layer, getattr(treegen, kind)(rng), x, 0, z)
    g = cfg.get('ground')
    if g:
        scene2.ground(g[0], g[1], g[2], g[3], lambda x, z: -1 + (1 if z > g[4] + (x % 3 == 0) else 0))
    for layer, kind, x, y, z in cfg.get('plants', []):
        scene2.cross(layer, x, y, z, kind)
    geo = scene2.write()
    atlas = soft3d.load(f'{W}/atlas2.png')
    glows = [(scene2.NAMES.index(n) * 16, scene2.NAMES.index(n) * 16 + 16) for n in scene2.GLOW]
    faces, texs = [], {}
    for b in geo['bones']:
        li = scene2.LAYERS.index(b['name'])
        faces += soft3d.geo_faces({'description': geo['description'], 'bones': [b]}, atlas, layer=li, glow_tiles=glows)
        texs[li] = atlas
    for k, ent in enumerate(cfg.get('entities', [])):
        path, gid, tpath, off, yaw = ent[:5]
        pose = ent[5] if len(ent) > 5 else {}
        li = 10 + k
        texs[li] = soft3d.load(tpath)
        g = json.loads(json.dumps(entity(path, gid)))
        for bone in g['bones']:
            if bone['name'] in pose:
                bone['rotation'] = pose[bone['name']]
        faces += soft3d.geo_faces(g, texs[li], offset=off, yaw=yaw, layer=li)
        held = ent[6] if len(ent) > 6 else None
        if held:  # held item as an extruded texture mesh on the holder's item bone (vanilla texture_meshes)
            hi = 100 + k
            texs[hi] = soft3d.load(held['tex'])
            th, tw = texs[hi].shape[:2]
            hb = [dict(bb, cubes=[]) for bb in g['bones']]
            ib = next(bb for bb in g['bones'] if bb['name'] == held['bone'])
            P0 = [ib['pivot'][i] + held['pos'][i] + held.get('grip', [0, 0, 0])[i] for i in range(3)]
            lp = held['local_pivot']
            cubes = []
            for v in range(th):
                for u in range(tw):
                    if texs[hi][v, u, 3] > 0.5:
                        o = [P0[0] + (u - lp[0]), P0[1] - (v - lp[1]) - 1, P0[2] - 0.5]  # sprite upright in the XY plane
                        cubes.append({'origin': o, 'size': [1, 1, 1], 'uv': {f: {'uv': [u, v], 'uv_size': [1, 1]} for f in
                                      ('north', 'south', 'east', 'west', 'up', 'down')}})
            hb.append({'name': 'held_mesh', 'parent': held['bone'], 'pivot': P0, 'rotation': held['rot'], 'cubes': cubes})
            hg = {'description': dict(g['description'], texture_width=tw, texture_height=th), 'bones': hb}
            faces += soft3d.geo_faces(hg, texs[hi], offset=off, yaw=yaw, layer=li if False else hi)
    if 'eye' in cfg:  # explicit camera: eye + yaw/pitch (yaw 0 looks +z)
        eye = np.array(cfg['eye'], float)
        ry, rp = math.radians(cfg['dir'][0]), math.radians(cfg['dir'][1])
        look = list(eye + 100 * np.array([math.cos(rp) * math.sin(ry), math.sin(rp), math.cos(rp) * math.cos(ry)]))
    else:
        look = cfg['look']
        eye = eye_of(look, *cfg['cam'])
    t0 = time.time()
    rgb, zb, lid, glw = soft3d.render(faces, texs, eye, look, cfg['fov'], cfg['size'], cfg.get('width'))
    print('render', len(faces), 'faces', round(time.time() - t0, 1), 's', 'skipped', scene2.skipped)
    np.savez_compressed(f"{W}/{cfg['tag']}.npz", rgb=rgb, zb=zb, lid=lid, glw=glw, lights=np.array(scene2.lights, float).reshape(-1, 4))
    a = np.isfinite(zb)
    Image.fromarray((np.dstack([rgb, a]).clip(0, 1) * 255).astype(np.uint8)).save(f"{W}/{cfg['tag']}_raw.png")


if __name__ == '__main__':
    shoot(json.loads(open(sys.argv[1]).read()))
