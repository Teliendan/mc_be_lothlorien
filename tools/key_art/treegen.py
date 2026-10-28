"""approximations of the engine tree features used by the mod's forest (features/mallorn_*_tree_feature.json):
simple (oak-like trunk + canopy), fancy (Java "big oak" style trunk, branches and foliage clusters), mega (2x2 trunk,
branches with small canopies, a mega canopy on top). Parameters come from the feature files; the shape algorithm is a
re-implementation, not the engine's code. Output: {(x, y, z): (block name, states)} like mcs.load()."""
import math
import random

LOG, LEAF = 'lothlorien:mallorn_log', 'lothlorien:mallorn_leaves'


def _leaf(bl, x, y, z):
    if (x, y, z) not in bl:
        bl[(x, y, z)] = (LEAF, {})


def _log(bl, x, y, z, face='up'):
    bl[(x, y, z)] = (LOG, {'minecraft:block_face': face})


def simple(rng):
    bl = {}
    h = rng.randint(6, 10)
    for y in range(h):
        _log(bl, 0, y, 0)
    for dy in range(-3, 1):  # oak canopy: two wide layers, two narrow ones, random corners
        y = h + dy
        r = 2 if dy < -1 else 1
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                corner = abs(dx) == r and abs(dz) == r
                if corner and (dy == 0 or rng.random() < 0.5):
                    continue
                if (dx, dz) != (0, 0) or dy == 0:
                    _leaf(bl, dx, y, dz)
    return bl


def _line(bl, a, b):
    d = [b[i] - a[i] for i in range(3)]
    n = int(max(abs(v) for v in d))
    main = max(range(3), key=lambda i: abs(d[i]))
    face = ('east', 'up', 'south')[main]
    for i in range(n + 1):
        t = i / n if n else 0
        _log(bl, round(a[0] + d[0] * t), round(a[1] + d[1] * t), round(a[2] + d[2] * t), face)


def _cluster(bl, cx, cy, cz, radii=(2, 3, 3, 2)):
    for i, r in enumerate(radii):
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                if math.hypot(dx, dz) <= r + 0.5:
                    _leaf(bl, cx + dx, cy + i, cz + dz)


def fancy(rng):
    """trunk_height base 7 variance 9 scale 0.618, canopy height 4 radius 3, foliage_altitude_factor 0.3."""
    bl = {}
    height = 7 + rng.randint(0, 9)
    trunk = max(3, int(height * 0.618))
    for y in range(trunk):
        _log(bl, 0, y, 0)
    clusters = max(1, int(1.382 + (height / 13.0) ** 2))
    y = height - 4
    while y >= int(height * 0.3):
        rel = y / height
        shape = 0.5 * math.sqrt(max(0.0, 0.25 - (rel - 0.5) ** 2)) * 2 * height * 0.5 if rel > 0.3 else -1
        for _ in range(clusters):
            dist = 1.0 * shape * (rng.random() + 0.328)
            ang = rng.random() * 2 * math.pi
            fx, fz = round(dist * math.sin(ang)), round(dist * math.cos(ang))
            by = min(trunk - 1, max(int(y - math.hypot(fx, fz) * 0.381), 1))
            _cluster(bl, fx, y, fz)
            if by < y and (fx or fz):
                _line(bl, (0, by, 0), (fx, y, fz))
        y -= 1 if rng.random() < 0.5 else 2
    _cluster(bl, 0, height - 3, 0)
    return bl


def mega(rng):
    """2x2 trunk, height 14 + 3..12, branches every 2-5 above half height (length 6, slope 0.5, canopy 2-4 high, r 2),
    top mega canopy (height 4, base radius 3)."""
    bl = {}
    h = 14 + rng.randint(3, 12)
    for y in range(h):
        for x, z in ((0, 0), (1, 0), (0, 1), (1, 1)):
            _log(bl, x, y, z)
    y = int(h * 0.5)
    while y < h - 3:
        ang = rng.random() * 2 * math.pi
        L = 6 * (0.6 + 0.4 * rng.random())
        ex, ez = 0.5 + L * math.cos(ang), 0.5 + L * math.sin(ang)
        ey = y + L * 0.5
        _line(bl, (round(0.5 + math.cos(ang)), y, round(0.5 + math.sin(ang))), (round(ex), round(ey), round(ez)))
        ch = rng.randint(2, 4)
        for i in range(ch):
            r = 2 if i < ch - 1 else 1
            for dx in range(-r, r + 1):
                for dz in range(-r, r + 1):
                    if math.hypot(dx, dz) <= r + 0.4:
                        _leaf(bl, round(ex) + dx, round(ey) + i, round(ez) + dz)
        y += rng.randint(2, 5)
    for i in range(5):  # mega canopy: wide base narrowing upward
        r = 3 + 2 - i if i < 3 else 2 - (i - 3)
        y = h - 2 + i
        for dx in range(-r - 1, r + 2):
            for dz in range(-r - 1, r + 2):
                if math.hypot(dx - 0.5, dz - 0.5) <= r + 0.6:
                    _leaf(bl, dx, y, dz)
    return bl


def pick(rng):
    k = rng.random()
    return simple(rng) if k < 0.25 else fancy(rng) if k < 0.85 else mega(rng)
