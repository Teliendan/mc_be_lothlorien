"""night grading of a rendered buffer set (npz) -> icon candidate.
Layers: 0 far, 1 tree, 2 ground, 3 lamp, 4 tree2, 10+ entities."""
import sys, json, math
import numpy as np
from PIL import Image, ImageFilter

W = 'temp/key_art'


def hexc(h):
    return np.array([int(h[i:i+2], 16) for i in (1, 3, 5)], np.float32) / 255


def blur(a, r):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)) if a.ndim == 2 else Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGB')
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def grade(tag, P):
    d = np.load(f'{W}/{tag}.npz'); rgb, zb, lid, glw = d['rgb'], d['zb'], d['lid'], d['glw']
    H, Wd = rgb.shape[:2]; s = H / 512
    hit = np.isfinite(zb)
    yy = np.linspace(0, 1, H)[:, None, None]
    sky = hexc(P['sky_top']) * (1 - yy) + hexc(P['sky_low']) * yy
    out = np.broadcast_to(sky, rgb.shape).copy()
    # light per layer (moonlit night), entities brighter
    light = np.ones_like(zb)[..., None] * hexc(P['moon'])
    ent = lid >= 10
    light[ent] = hexc(P['moon_ent'])
    # block light (Minecraft-style): level = emitter - manhattan distance, brightness curve L/(4-3L) on L/15
    if P.get('blocklight') and 'lights' in d and len(d['lights']):
        cfg = json.load(open(f'temp/key_art/{tag}.json'))
        eye = np.array(cfg['eye'], float); ry, rp = math.radians(cfg['dir'][0]), math.radians(cfg['dir'][1])
        fwd = np.array([math.cos(rp)*math.sin(ry), math.sin(rp), math.cos(rp)*math.cos(ry)])
        right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right); up = np.cross(right, fwd)
        f = (H / 2) / math.tan(math.radians(cfg['fov']) / 2)
        gy, gx = np.mgrid[0:H, 0:Wd] + 0.5
        dirs = fwd + ((gx - Wd/2) / f)[..., None] * right - ((gy - H/2) / f)[..., None] * up
        wp = eye + dirs * np.where(hit, zb, 0)[..., None]       # depth is along fwd and dirs has fwd component 1
        bp = np.floor(wp / 16 - 0.001 * np.sign(dirs))         # block the surface belongs to (nudged back toward the eye)
        lvl = np.zeros(zb.shape, np.float32)
        for (lx, ly, lz, L) in d['lights']:
            m = np.abs(bp[..., 0] - lx) + np.abs(bp[..., 1] - ly) + np.abs(bp[..., 2] - lz)
            np.maximum(lvl, L - m, out=lvl)
        lvl = np.clip(lvl, 0, 15) / 15 * hit
        bright = lvl / (4 - 3 * lvl)
        light = light + bright[..., None] * hexc(P['warm_block']) * P['blocklight']
    col = rgb * light
    if P.get('sat', 1) != 1:  # keep the leaf greens (moonlight otherwise greys them)
        g_ = col.mean(-1, keepdims=True)
        col = np.clip(g_ + (col - g_) * P['sat'], 0, None)
    # fog by depth
    dep = np.where(hit, zb, 1e9)
    k = np.full(zb.shape, P['fog_k'], np.float32)
    k[lid == 1] = P['fog_k_hero']
    fog = 1 - np.exp(-np.maximum(dep - P['fog_start'], 0) / k)
    fog = np.clip(fog * P['fog_max'], 0, 1)[..., None]
    fogc = hexc(P['fog'])
    col = col * (1 - fog) + fogc * fog
    # glowing texels stay bright (lantern glass, glow berries)
    g = glw & hit
    col[g] = rgb[g] * P['glow_gain'] * (1 - fog[g] * 0.6) + fogc * fog[g] * 0.6
    out[hit] = col[hit]
    # stars on open sky (vanilla night sky: sparse small white squares)
    if P.get('stars'):
        import random
        rng = random.Random(P.get('star_seed', 1))
        for _ in range(P['stars']):
            x, y = rng.randrange(Wd), rng.randrange(int(H * 0.6))
            r = max(1, int(s * rng.choice((1, 1, 1, 2))))
            if not hit[y:y + r, x:x + r].any():
                out[y:y + r, x:x + r] = out[y:y + r, x:x + r] * 0.3 + 0.7 * (0.75 + 0.25 * rng.random())
    # vanilla full moon (moon_phases.png, phase 0) in the open sky, with a soft glow
    if P.get('moon_at'):
        mx, my, ms = P['moon_at']
        tile = Image.open('reference/vanilla/current/resource_packs/vanilla/textures/environment/moon_phases.png').convert('RGB').crop((0, 0, 32, 32))
        n = int(ms * H)
        mt = np.asarray(tile.resize((n, n), Image.NEAREST)).astype(np.float32) / 255
        x0, y0 = int(mx * Wd - n / 2), int(my * H - n / 2)
        gl = np.zeros(zb.shape, np.float32); gl[y0:y0 + n, x0:x0 + n] = mt.mean(-1)
        halo_m = blur(gl, n * 0.12) * 1.2 + blur(gl, n * 0.4) * 0.8
        sky_mask = (~hit).astype(np.float32)[..., None]
        out = out + halo_m[..., None] * hexc('#9fc7d6') * sky_mask
        sub = out[y0:y0 + n, x0:x0 + n]; free = ~hit[y0:y0 + n, x0:x0 + n]
        sub[free] = sub[free] + mt[free] * 1.2  # additive, like the game's sun/moon (black = transparent)
    # warm local light: blurred glow mask lights nearby surfaces
    gm = g.astype(np.float32) * (1 - fog[..., 0] * 0.7)
    warm = hexc(P['warm'])
    halo = blur(gm, 6 * s) * P['halo1'] + blur(gm, 18 * s) * P['halo2'] + blur(gm, P.get('halo3_r', 45) * s) * P['halo3']
    out = out + halo[..., None] * warm
    # fireflies: glowing dots (the entity's abdomen colours), size and fog from their depth
    core, hal = hexc('#f6ffaa'), hexc('#e2f66e')
    fl = np.zeros(zb.shape, np.float32); dots = []
    for (sx, sy, dz) in P.get('fireflies', []):
        r = min(P['ff_max'] * s, max(1.0 * s, P['ff_size'] * s * 900 / dz))
        x, y = sx * Wd, sy * H
        f = math.exp(-max(dz - P['fog_start'], 0) / P['fog_k'])
        x0, x1, y0, y1 = int(x - r), int(math.ceil(x + r)), int(y - r), int(math.ceil(y + r))
        m = int(r * 4) + 2
        near = lid[max(0, int(y) - m):int(y) + m, max(0, int(x) - m):int(x) + m]
        if P.get('ff_avoid') and ((near >= 10) & (near < 100)).any():
            continue  # never on (or touching) the deer, the warden or an elf
        if dz < zb[min(H-1, max(0, int(y))), min(Wd-1, max(0, int(x)))]:
            fl[y0:y1, x0:x1] = np.maximum(fl[y0:y1, x0:x1], 0.4 + 0.6 * f)
            dots.append((y0, y1, x0, x1, 0.4 + 0.6 * f))
    fh = blur(fl, 3 * s) * P['ffh1'] + blur(fl, 10 * s) * P['ffh2'] + blur(fl, 26 * s) * P['ffh3']
    out = out + fh[..., None] * hal
    for (y0, y1, x0, x1, a) in dots:
        out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - a) + core * a
    # vignette
    yv, xv = np.mgrid[0:H, 0:Wd].astype(np.float32); yv = yv / H - 0.5; xv = xv / Wd - 0.5
    vig = 1 - P['vig'] * np.clip((xv ** 2 + yv ** 2) * 2.2, 0, 1)
    out = out * vig[..., None]
    return np.clip(out, 0, 1)


DEFAULT = dict(sky_top='#0a1a26', sky_low='#1d4550', moon='#5f7a8c', moon_ent='#c8d4e0', fog='#1f4049', fog_start=200,
               fog_k=900, fog_max=0.85, glow_gain=1.25, warm='#ffc35a', halo1=0.9, halo2=0.6, halo3=0.35, vig=0.35, fog_k_hero=2600, ff_size=3.0, ff_max=2.5, warm_block='#ffcf8a', blocklight=0, ffh1=1.4, ffh2=0.8, ffh3=0.35)

def fireflies(cfg_path, n=14, seed=5, box=None):
    """Project random firefly positions (world volume near the deer) to (sx, sy, depth)."""
    import random
    cfg = json.load(open(cfg_path))
    eye = np.array(cfg['eye'], float); ry, rp = math.radians(cfg['dir'][0]), math.radians(cfg['dir'][1])
    fwd = np.array([math.cos(rp)*math.sin(ry), math.sin(rp), math.cos(rp)*math.cos(ry)])
    right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right); up = np.cross(right, fwd)
    f = 0.5 / math.tan(math.radians(cfg['fov']) / 2)
    rng = random.Random(seed); out = []
    x0, x1, y0, y1, z0, z1 = box
    tries = 0
    while len(out) < n and tries < 200000:
        tries += 1
        p = np.array([rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(z0, z1)]) * 16
        v = p - eye; z = v @ fwd
        if z < 320: continue
        asp = cfg.get('width', cfg['size']) / cfg['size']
        sx, sy = 0.5 + f * (v @ right) / z / asp, 0.5 - f * (v @ up) / z
        if 0.02 < sx < 0.98 and 0.05 < sy < 0.95:
            out.append((sx, sy, z))
    return out


if __name__ == '__main__':
    tag = sys.argv[1]
    P = dict(DEFAULT, **(json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}))
    if 'ff_box' in P:
        P['fireflies'] = fireflies(f'temp/key_art/{tag}.json', P.get('ff_n', 14), P.get('ff_seed', 5), P['ff_box'])
    img = grade(tag, P)
    if P.get('title'):
        sys.path[:0] = ['.claude/skills/bedrock-art/scripts']
        import mcfont
        t = P['title']; m = mcfont.text_mask(t['text'])
        k = max(1, int(t['height'] * img.shape[0] / 12))
        mk = np.kron(m, np.ones((k, k), bool))
        h_, w_ = mk.shape
        x0, y0 = int(t['at'][0] * img.shape[1] - w_ / 2), int(t['at'][1] * img.shape[0] - h_ / 2)
        sh = k  # Minecraft text shadow: one font pixel down-right, a quarter of the colour
        col = hexc(t.get('color', '#fff6dc')); shc = col * 0.25
        img[y0 + sh:y0 + sh + h_, x0 + sh:x0 + sh + w_][mk] = shc
        img[y0:y0 + h_, x0:x0 + w_][mk] = col
    if 'crop' in P:  # (x0, y0, size) as fractions
        H = img.shape[0]; x0, y0, c = (int(v * H) for v in P['crop'])
        img = img[y0:y0 + c, x0:x0 + c]
    Image.fromarray((img * 255).astype(np.uint8)).save(f'{W}/{tag}_graded.png')

