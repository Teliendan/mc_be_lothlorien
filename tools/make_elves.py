"""Generates the civilian Elves ("villagers") RP art: one geometry + texture per profession, animations, render controller, client entity.

    python -B mods/lothlorien/tools/make_elves.py [--sheet]

Output (overwritten every run): lothlorien_rp/models/entity/elf.geo.json (one geometry per profession),
lothlorien_rp/textures/entity/elf/<profession>.png, lothlorien_rp/animations/elf.animation.json,
lothlorien_rp/render_controllers/elf.render_controllers.json, lothlorien_rp/entity/elf.entity.json.
--sheet also writes review sheets to temp/elves/ (software preview from the bedrock-mobs skill, not the game renderer).

Data-driven: a profession = palette (colour ramps) + cube list (body, robe/coat, accessories) + a few paint functions.
Hair/face/gender variants can be added later as more data (a `hair` ramp and cap/back-hair cubes per profession).
Same people as the Elven Warden (make_elven_warden.py: same head, skin, proportions, ramps with hue shift, light from top-left);
helpers are imported from there, the warden output is not touched. Vanilla humanoid bone names so animation.humanoid.* drives them.
`query.variant`: 0 gardener, 1 healer, 2 woodwright, 3 lamplighter, 4 loremaster.
Not seen in game yet. Box-UV side faces: east (+x) has the front on its right, west on its left (client.md).
"""
import json
import random
import subprocess
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_elven_warden as W  # noqa: E402  (helpers only; importing does not write anything)

R, ramp, fill, faces, mottle, seed_for = W.R, W.ramp, W.fill, W.faces, W.mottle, W.seed_for
FL, CLEAR, SKIN, SILVER, LEATHER = W.FACE_LIGHT, W.CLEAR, W.SKIN, W.SILVER, W.LEATHER
MOD, RP, WS = W.MOD, W.RP, W.WS
TEX_W = 64
ID = "lothlorien:elf"
PROFESSIONS = ["gardener", "healer", "woodwright", "lamplighter", "loremaster"]  # index = query.variant


def geo_id(p):
    return f"geometry.lothlorien.elf_{p}"


# ---------------------------------------------------------------- shared bones
BONES = {
    "waist": (None, [0, 12, 0], None, {}),
    "body": ("waist", [0, 24, 0], None, {}),
    "head": ("body", [0, 24, 0], None, {}),
    "hat": ("head", [0, 24, 0], None, {}),
    "ear_r": ("head", [-4.5, 26, 0], [0, 0, -28], {}),
    "ear_l": ("head", [4.5, 26, 0], [0, 0, 28], {}),
    "rightArm": ("body", [-5.5, 22, 0], None, {}),
    "rightItem": ("rightArm", [-6, 15, 1], None, {"neverRender": True}),
    "leftArm": ("body", [5.5, 22, 0], None, {}),
    "leftItem": ("leftArm", [6, 15, 1], None, {"neverRender": True}),
    "rightLeg": ("body", [-2, 12, 0], None, {}),
    "leftLeg": ("body", [2, 12, 0], None, {}),
    "strap": ("body", [0, 18, 0], [0, 0, -30], {}),   # satchel strap, diagonal across the chest
    "robe": ("body", [0, 12, 0], None, {}),        # skirt / coat tails: sways with the stride
    "hair": ("body", [0, 24, 3], None, {}),        # long hair, braid: sways
    "lantern": ("body", [6.5, 11, 0], None, {}),   # swings from the belt
}


def K(name, bone, o, s, role, **kw):
    return dict(name=name, bone=bone, o=o, s=s, role=role, **kw)


def common_cubes():
    return [
        K("head", "head", [-4, 24, -4], [8, 8, 8], "head"),
        K("cap", "hat", [-4.5, 24, -4.5], [9, 9, 9], "cap"),
        K("ear_r", "ear_r", [-5, 26, -1], [1, 3, 2], "ear", side=-1),
        K("ear_l", "ear_l", [4, 26, -1], [1, 3, 2], "ear", side=1, uv_from="ear_r"),
        K("body", "body", [-4, 12, -2], [8, 12, 4], "body"),
        K("rightArm", "rightArm", [-7, 12, -1.5], [3, 12, 3], "arm"),
        K("leftArm", "leftArm", [4, 12, -1.5], [3, 12, 3], "arm", uv_from="rightArm"),
        K("rightLeg", "rightLeg", [-3.5, 0, -1.5], [3, 12, 3], "leg"),
        K("leftLeg", "leftLeg", [0.5, 0, -1.5], [3, 12, 3], "leg", uv_from="rightLeg"),
    ]


# ---------------------------------------------------------------- texture packing
def box_extent(size):
    w, h, d = (int(s) for s in size)
    return 2 * (w + d), h + d


def pack(cubes, name):
    """Shelf-pack all boxes (cubes with uv_from share another's rectangle). Returns ({cube: (u, v)}, texture height)."""
    for c in cubes:
        assert all(float(s) == int(s) for s in c["s"]), f"{name}/{c['name']}: box sizes must be whole numbers"
    items = [c for c in cubes if "uv_from" not in c]
    rng = random.Random(11)
    for height in (64, 96, 128):
        for attempt in range(4000):
            order = sorted(items, key=lambda c: (-box_extent(c["s"])[1], c["name"])) if attempt == 0 else rng.sample(items, len(items))
            x = y = shelf = 0
            out = {}
            for c in order:
                bw, bh = box_extent(c["s"])
                if x + bw > TEX_W:
                    x, y, shelf = 0, y + shelf, 0
                out[c["name"]] = (x, y)
                x += bw
                shelf = max(shelf, bh)
            if y + shelf <= height:
                for c in cubes:
                    if "uv_from" in c:
                        out[c["name"]] = out[c["uv_from"]]
                return out, height
    raise SystemExit(f"{name}: texture overflow")


def geometry_entry(p, cubes, uvs, height, extra_bones):
    bones = {}
    for bname, (parent, pivot, rot, extra) in BONES.items():
        bones[bname] = {"name": bname, "pivot": pivot}
        if parent:
            bones[bname]["parent"] = parent
        if rot:
            bones[bname]["rotation"] = rot
        bones[bname].update(extra)
    for c in cubes:
        cube = {"origin": c["o"], "size": c["s"], "uv": list(uvs[c["name"]])}
        if "uv_from" in c:
            cube["mirror"] = True
        if "inflate" in c:
            cube["inflate"] = c["inflate"]  # accessory cubes sharing a face plane with the body would z-fight
        bones[c["bone"]].setdefault("cubes", []).append(cube)
    used = {c["bone"] for c in cubes}
    keep = [b for n, b in bones.items() if n in used or n in ("waist", "body", "head", "hat", "rightItem", "leftItem")
            or any(bones[u].get("parent") == n or _is_ancestor(n, u) for u in used)]
    return {
        "description": {"identifier": geo_id(p), "texture_width": TEX_W, "texture_height": height,
                        "visible_bounds_width": 3, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.2, 0]},
        "bones": keep,
    }


def _is_ancestor(anc, name):
    while name:
        name = BONES[name][0]
        if name == anc:
            return True
    return False


# ---------------------------------------------------------------- painting
class Canvas:
    def __init__(self, h):
        self.h = h
        self.img = Image.new("RGBA", (TEX_W, h), CLEAR)
        self.px = self.img.load()
        self.painted = {}

    def set(self, x, y, c, owner):
        assert (x, y) not in self.painted or self.painted[(x, y)] == owner, f"UV overlap {owner} / {self.painted[(x, y)]} at {x},{y}"
        self.px[x, y] = c
        self.painted[(x, y)] = owner


def front_dist(face, i, w):
    """Columns from the front edge of a side face (east has the front on its right, west on its left)."""
    return w - 1 - i if face == "east" else i


def blk(cv, f, r, base=2, detail=None, owner=""):
    """Generic box painter: ramp r, shade by face, top row lighter, bottom row darker, optional detail(face,i,j,w,h) -> colour|None."""
    for face, rect in f.items():
        def px(i, j, w, h, face=face):
            if detail:
                d = detail(face, i, j, w, h)
                if d is not None:
                    return d
            k = base + FL[face]
            if face in ("north", "south", "east", "west"):
                if j == 0 and h > 2:
                    k += 1
                if j == h - 1 and h > 2:
                    k -= 1
            return ramp(r, k)
        fill_owned(cv, rect, px, owner)


def fill_owned(cv, rect, fn, owner):
    x0, y0, w, h = rect
    for j in range(h):
        for i in range(w):
            c = fn(i, j, w, h)
            cv.set(x0 + i, y0 + j, CLEAR if c is None else c, owner)


def folds(r, face, i, j, w, h, base=2, phase=0):
    """Cloth with meandering vertical folds: shadow and light columns that drift one column every few rows."""
    k = base + FL[face]
    if face in ("north", "south"):
        col = (i + j // 9 + phase) % 5
        k += {0: 0, 1: 1 if j < h * 0.6 else 0, 2: 0, 3: -1, 4: 0}[col]
    elif face in ("east", "west"):
        col = (i + phase) % 4
        k += {0: 0, 1: -1, 2: 0, 3: 0}[col]
    if j < 2 and face != "top":
        k += 1
    return ramp(r, k)


def neckline(i, j, w, skin_r, trim_r=None):
    """V neckline on the front of the body (8 wide): skin triangle + optional trim line."""
    if j == 0 and 2 <= i <= 5:
        return ramp(skin_r, 2)
    if j == 1 and 3 <= i <= 4:
        return ramp(skin_r, 1)
    if trim_r:
        if (j == 0 and i in (1, 6)) or (j == 1 and i in (2, 5)) or (j == 2 and i in (3, 4)):
            return ramp(trim_r, 2 if i < 4 else 1)
    return None


def strands(h, face, i, j, jh, base=2):
    """Hair: vertical strands, lighter at the crown, deterministic."""
    k = base + (1 if (i + (j // 3)) % 3 == 0 else 0)
    if j <= 1:
        k += 1
    if face == "south":
        k -= 0
    return ramp(h, min(3, k) if k > 3 else k)


def paint_head(cv, f, P, c):
    h, eye = P["hair"], P["eye"]
    brow = ramp(h, 1)

    def north(i, j, w, hh):
        if j == 0:
            return ramp(h, 2)
        if j in (1, 2):
            return ramp(SKIN, 2)
        if j == 3:
            return brow if i in (1, 2, 5, 6) else ramp(SKIN, 1)
        if j == 4:
            return eye if i in (2, 5) else ramp(SKIN, 2)
        if j == 5:
            return ramp(SKIN, 1) if i in (3, 4) else ramp(SKIN, 2)
        if j == 6:
            return W.MOUTH if i in (3, 4) else ramp(SKIN, 2)
        return ramp(SKIN, 1 if 2 <= i <= 5 else 2)
    fill_owned(cv, f["north"], north, c["name"])

    def side(face):
        def fn(i, j, w, hh):
            d = front_dist(face, i, w)
            if j <= 1 or d >= 6:
                return ramp(h, 1)
            if j >= 6:
                return ramp(SKIN, 1)
            return ramp(SKIN, 2)
        return fn
    fill_owned(cv, f["east"], side("east"), c["name"])
    fill_owned(cv, f["west"], side("west"), c["name"])
    fill_owned(cv, f["top"], lambda i, j, w, hh: ramp(h, 2), c["name"])
    fill_owned(cv, f["bottom"], lambda i, j, w, hh: ramp(SKIN, 0), c["name"])
    fill_owned(cv, f["south"], lambda i, j, w, hh: ramp(h, 1), c["name"])


def paint_cap(cv, f, P, c):
    """Hair volume over the head (hat bone, 9x9x9): fringe parted in the middle, side locks, a window onto the face and ears.
    P['band'] (ramp or None): a circlet painted across the brow, row 3."""
    h, band = P["hair"], P.get("band")
    band_row = 3

    def north(i, j, w, hh):
        if j <= 1:
            return strands(h, "north", i, j, hh, 2)
        if j == 2:
            if i == 4:
                return None  # the parting
            return ramp(h, 1 if i in (3, 5) else 2 + (1 if i in (1, 7) else 0))
        if band and j == band_row:
            return ramp(band, 3 if i % 4 == 0 else 2) if 1 <= i <= 7 else ramp(band, 1)
        if i in (0, 8) and j <= 6:
            return ramp(h, 2 if j % 2 else 1)  # locks framing the face
        if i in (0, 8):
            return None
        return None  # window onto the face

    fill_owned(cv, f["north"], north, c["name"])

    def side(face):
        def fn(i, j, w, hh):
            d = front_dist(face, i, w)
            if j <= 2:
                return strands(h, face, d, j, hh, 2)
            if band and j == band_row:
                return ramp(band, 3 if d % 4 == 0 else 2)
            if d >= 6 and not P.get("hair_up"):
                return strands(h, face, d, j, hh, 1)
            if d == 0 and j <= 6:
                return ramp(h, 2 if j % 2 else 1)
            return None
        return fn
    fill_owned(cv, f["east"], side("east"), c["name"])
    fill_owned(cv, f["west"], side("west"), c["name"])
    fill_owned(cv, f["top"], lambda i, j, w, hh: ramp(h, 1 if i == 4 else 3 if i % 3 == 0 else 2), c["name"])
    fill_owned(cv, f["bottom"], lambda i, j, w, hh: None, c["name"])

    def south(i, j, w, hh):
        if band and j == band_row:
            return ramp(band, 3 if i % 4 == 0 else 2)
        k = 2 + (1 if (i + j // 3) % 3 == 0 else 0) - (1 if j >= 6 else 0)
        return ramp(h, k)
    fill_owned(cv, f["south"], south, c["name"])


def paint_ear(cv, f, P, c):
    def side(face):
        def fn(i, j, w, hh):
            d = front_dist(face, i, w)
            if j == 0 and d != 1:
                return None  # pointed tip, slightly back
            return ramp(SKIN, 3 if j == 0 else 2 if j == 1 else 1)
        return fn
    for face in ("east", "west"):
        fill_owned(cv, f[face], side(face), c["name"])
    fill_owned(cv, f["north"], lambda i, j, w, hh: ramp(SKIN, 2 if j else 3), c["name"])
    fill_owned(cv, f["south"], lambda i, j, w, hh: ramp(SKIN, 1), c["name"])
    fill_owned(cv, f["top"], lambda i, j, w, hh: ramp(SKIN, 3), c["name"])
    fill_owned(cv, f["bottom"], lambda i, j, w, hh: ramp(SKIN, 0), c["name"])


def paint_body(cv, f, P, c):
    fn = P["body_fn"]
    for face, rect in f.items():
        fill_owned(cv, rect, lambda i, j, w, h, face=face: fn(face, i, j, w, h), c["name"])


def paint_arm(cv, f, P, c):
    fn = P["arm_fn"]
    for face, rect in f.items():
        fill_owned(cv, rect, lambda i, j, w, h, face=face: fn(face, i, j, w, h), c["name"])


def paint_leg(cv, f, P, c):
    fn = P["leg_fn"]
    for face, rect in f.items():
        fill_owned(cv, rect, lambda i, j, w, h, face=face: fn(face, i, j, w, h), c["name"])


def paint_solid(cv, f, P, c):
    detail = P["details"].get(c.get("detail"))
    det = (lambda face, i, j, w, h: detail(face, i, j, w, h)) if detail else None
    blk(cv, f, P["r"][c["r"]], c.get("base", 2), det, c["name"])


def paint_hair_long(cv, f, P, c):
    h, style = P["hair"], c.get("style", "plain")
    tie = P["r"].get(c.get("tie", "leather"), LEATHER)

    def panel(face, i, j, w, hh):
        if style == "braid":
            if j >= hh - 3 and j <= hh - 3:
                return ramp(tie, 2)
            if j >= hh - 2:
                return None if (i == 0 and j == hh - 1) or (face in ("east", "west") and j == hh - 1) else ramp(h, 1)
            k = 2 + (1 if (j + (i % 2)) % 4 < 2 else -1) + (0 if face in ("north", "south") else -1)
            if j < 1:
                k += 1
            return ramp(h, k)
        taper = min(3, c.get("taper", 3))
        if j >= hh - taper and face in ("north", "south"):
            row = hh - 1 - j  # 0 = last row
            margin = taper - row  # columns cut from each side
            if i < margin - 1 or i > w - margin:
                return None
            return ramp(h, 1 if row < 2 else 2)
        k = 2 + (1 if (i * 2 + j // 4) % 4 == 0 else 0) + (1 if j < 2 else 0)
        if face in ("east", "west"):
            k -= 1
        if face == "north":
            k -= 1
        return ramp(h, k)
    for face, rect in f.items():
        if face == "top":
            fill_owned(cv, rect, lambda i, j, w, hh: ramp(h, 2), c["name"])
        elif face == "bottom":
            fill_owned(cv, rect, lambda i, j, w, hh: ramp(h, 0), c["name"])
        else:
            fill_owned(cv, rect, lambda i, j, w, hh, face=face: panel(face, i, j, w, hh), c["name"])


def paint_flower(cv, f, P, c):
    pal = P["r"][c.get("r", "flower")]
    for face, rect in f.items():
        fill_owned(cv, rect, lambda i, j, w, h, face=face: ramp(pal, 3 if face in ("north", "top") else 2 if face in ("east", "west") else 1), c["name"])


PAINT = {"head": paint_head, "cap": paint_cap, "ear": paint_ear, "body": paint_body, "arm": paint_arm, "leg": paint_leg,
         "solid": paint_solid, "hair_long": paint_hair_long, "flower": paint_flower}


def paint_texture(P, cubes, uvs, height):
    cv = Canvas(height)
    for c in cubes:
        if "uv_from" in c:
            continue
        PAINT[c["role"]](cv, faces(*uvs[c["name"]], c["s"]), P, c)
    for c in cubes:  # self-check: every face texel of every box is painted (transparent ones on purpose)
        for (x, y, w, h) in faces(*uvs[c["name"]], c["s"]).values():
            for j in range(h):
                for i in range(w):
                    assert (x + i, y + j) in cv.painted, f"unpainted texel in {P['id']}/{c['name']}"
    return cv.img


# ---------------------------------------------------------------- professions (data)
def robe_cubes(P, hem_r="robe", hip_r="robe", hair_len=None, hair_style="plain"):
    """Long garment over the legs (evoker-style): stepped skirt in the swaying `robe` bone."""
    return [
        K("hip", "robe", [-4.5, 7, -2.5], [9, 5, 5], "solid", r=hip_r, detail="skirt_hip"),
        K("hem", "robe", [-5, 1, -3], [10, 6, 6], "solid", r=hem_r, detail="skirt_hem"),
    ]


def build_gardener():
    M = R("#2f3b22 #44562f #5f7640 #7d9654 #a2b66f")            # moss tunic, warmer and yellower than the warden's cloak
    LE = R("#3b2a1c #5a4129 #7c5b38 #a07c4c")                   # tan apron leather
    HAIR = R("#1f1510 #33231a #4d3626 #6b4e37")                 # Silvan dark brown
    FL = R("#a8903f #e0cb78 #f6efc5 #ffffff")                   # elanor / niphredil, white-gold
    LEAF = R("#2c4a2a #3f6b38 #5f8f4c #86b46a")
    TR = R("#3a352c #504a3c #6a6250 #857c66")                   # trousers, earthy grey-brown
    ST = R("#2d2e29 #46463e #6a6a5e #8a8a7c")                   # trowel steel (dull)
    P = dict(id="gardener", variant=0, hair=HAIR, eye=W.hexc("#5b7a4a"), band=LEAF, egg=("#5f7640", "#f0e6a8"))
    P["r"] = dict(moss=M, leather=LE, flower=FL, leaf=LEAF, steel=ST, wood=LE, silver=SILVER)
    dabs = {k: mottle(seed_for("gtunic", k), 8, 12) for k in ("north", "south", "east", "west")}

    def body(face, i, j, w, h):
        if face == "north":
            n = neckline(i, j, w, SKIN)
            if n:
                return n
        if face in ("top", "bottom"):
            return ramp(M, 2 if face == "top" else 0)
        if j in (9, 10) and face != "north":
            return ramp(LE, 1 if j == 9 else 0)  # rope belt
        k = 2 + FL_[face] + (1 if j < 4 else 0) + dabs[face].get((i, j), 0) if face in dabs else 2
        if face == "north" and j in (9, 10):
            return ramp(LE, 1)
        return ramp(M, k)
    FL_ = W.FACE_LIGHT
    P["body_fn"] = body

    def arm(face, i, j, w, h):
        if face == "top":
            return ramp(M, 2)
        if face == "bottom":
            return ramp(SKIN, 1)
        sh = FL_[face]
        if j <= 4:
            return ramp(M, 2 + sh + (1 if j == 0 else 0))
        if j in (5, 6):
            return ramp(M, 3 if j == 5 else 2)  # rolled cuff
        if j == 7:
            return ramp(SKIN, 0 if sh < 0 else 1)  # shadow under the cuff
        return ramp(SKIN, 2 + min(0, sh) + (0 if j < 11 else -1))
    P["arm_fn"] = arm

    def leg(face, i, j, w, h):
        if face == "top":
            return ramp(TR, 2)
        if face == "bottom":
            return ramp(LEATHER, 0)
        sh = -1 if face == "south" else 0
        if j >= 8:
            if j == 8:
                return ramp(LE, 3)
            return ramp(LEATHER, 0) if j == h - 1 else ramp(LEATHER, 2 + sh if j == 9 else 1)
        return ramp(TR, (2 if j < 3 else 1) + sh + (1 if face == "north" and i == 1 and j < 6 else 0))
    P["leg_fn"] = leg

    def skirt(face, i, j, w, h):
        if face == "bottom":
            return ramp(M, 0)
        if face == "top":
            return ramp(M, 2)
        if j == h - 1:
            return ramp(M, 1) if (i + (face == "south")) % 2 else ramp(M, 0)  # scalloped hem
        return folds(M, face, i, j, w, h, 2)
    P["details"] = dict(skirt=skirt)

    def apron(face, i, j, w, h):
        if face == "north":
            if j == 0:
                return ramp(LE, 1)
            if j == h - 1:
                return ramp(LE, 0)
            if i in (0, w - 1):
                return ramp(LE, 1)
            if j == 1 and i in (1, w - 2):
                return ramp(LE, 3)
            return ramp(LE, 2 + (1 if (i + j) % 7 == 0 else 0) - (1 if j > 5 and i == 2 else 0))
        return ramp(LE, 1 if face != "top" else 2)

    def pouch(face, i, j, w, h):
        if face == "north":
            if j == 0:
                return ramp(LE, 3)
            if j == 1:
                return ramp(LE, 1)
            if i == 0 and j == 2:
                return ramp(M, 3)  # a seed spills out
            return ramp(LE, 2 if i == 0 else 1)
        return ramp(LE, 1)

    def trowel(face, i, j, w, h):
        if j <= 1:
            return ramp(LE, 3 if j == 0 else 2)  # wooden handle
        return ramp(ST, 3 if j == 2 else 2) if face in ("north", "east") else ramp(ST, 1)
    P["details"].update(apron=apron, pouch=pouch, trowel=trowel)

    def wreath_flower(*a):
        return None
    cubes = common_cubes() + [
        K("tunic_hem", "body", [-4.5, 7, -2.5], [9, 5, 5], "solid", r="moss", detail="skirt"),
        K("apron", "body", [-3, 6, -3], [6, 9, 1], "solid", r="leather", detail="apron"),
        K("pouch", "body", [0.5, 7, -4], [2, 2, 1], "solid", r="leather", detail="pouch"),
        K("trowel", "body", [4.5, 7, -0.5], [1, 4, 1], "solid", r="steel", detail="trowel"),
        K("braid", "hair", [-1, 11, 2], [2, 13, 2], "hair_long", style="braid", tie="flower"),
        K("fl_a", "hat", [-0.5, 29, -5.5], [1, 1, 1], "flower", r="flower"),
        K("fl_b", "hat", [-3.5, 29, -5.5], [1, 1, 1], "flower", r="flower", uv_from="fl_a"),
        K("fl_c", "hat", [2.5, 29, -5.5], [1, 1, 1], "flower", r="flower", uv_from="fl_a"),
        K("fl_d", "hat", [-5.5, 29, -2.5], [1, 1, 1], "flower", r="flower", uv_from="fl_a"),
        K("fl_e", "hat", [4.5, 29, -2.5], [1, 1, 1], "flower", r="flower", uv_from="fl_a"),
        K("fl_f", "hat", [-5.5, 29, 1.5], [1, 1, 1], "flower", r="flower", uv_from="fl_a"),
        K("fl_g", "hat", [4.5, 29, 1.5], [1, 1, 1], "flower", r="flower", uv_from="fl_a"),
    ]
    return P, cubes


def build_healer():
    S = R("#6f827c #94a8a1 #bccfc7 #dbe8e2 #f2f8f5")           # pale silver-white robe, a breath of green
    SA = R("#3f5566 #587489 #7692a5 #9db6c4")                 # blue-grey sash
    G = R("#2f5a33 #4c8a46 #7bb865 #b0dc8c")                  # athelas
    LE = R("#3a2a1f #57412c #77593a #977450")
    HAIR = R("#66737f #8d9bab #b7c4d2 #e2eaf1")               # long silver, cooler than the robe
    P = dict(id="healer", variant=1, hair=HAIR, eye=W.hexc("#5a7f93"), band=None, egg=("#cfd9dc", "#4c8a46"))
    P["r"] = dict(robe=S, sash=SA, athelas=G, leather=LE, silver=SILVER)
    FL_ = W.FACE_LIGHT

    def body(face, i, j, w, h):
        if face == "north":
            n = neckline(i, j, w, SKIN, SA)
            if n:
                return n
            if j >= 10:
                return None if False else ramp(SA, 2)  # under the sash (covered by it)
        if face in ("top", "bottom"):
            return ramp(S, 3 if face == "top" else 1)
        return folds(S, face, i, j, w, h, 2, phase=1)
    P["body_fn"] = body

    def arm(face, i, j, w, h):
        if face == "top":
            return ramp(S, 3)
        if face == "bottom":
            return ramp(SKIN, 1)
        if j <= 8:
            return folds(S, face, i, j, w, h, 2, phase=2)
        return ramp(SKIN, 2 + min(0, FL_[face]) + (0 if j < 11 else -1))
    P["arm_fn"] = arm

    def leg(face, i, j, w, h):
        if face == "bottom":
            return ramp(LEATHER, 0)
        return ramp(LE, 1 if j > 7 else 0) if face != "top" else ramp(LE, 1)
    P["leg_fn"] = leg

    def hip(face, i, j, w, h):
        if face == "bottom":
            return ramp(S, 1)
        if face == "top":
            return ramp(S, 3)
        return folds(S, face, i, j, w, h, 2, phase=1)

    def hem(face, i, j, w, h):
        if face == "bottom":
            return ramp(S, 1)
        if face == "top":
            return ramp(S, 3)
        if j >= h - 2:  # blue-grey embroidered hem; a small leaf motif on the front
            if face == "north" and j == h - 2 and i % 3 == 1:
                return ramp(G, 2)
            return ramp(SA, 1 if j == h - 1 else 2)
        return folds(S, face, i, j, w, h, 2)

    def cuff(face, i, j, w, h):
        if face == "top":
            return ramp(S, 3)
        if face == "bottom":
            return ramp(S, 1)
        if j == h - 1:
            return ramp(SA, 1)
        if j == 0:
            return ramp(SA, 2)
        return folds(S, face, i, j, w, h, 2, phase=0)

    def sash(face, i, j, w, h):
        base = ramp(SA, 2 + (1 if j == 0 else 0) + FL_[face] if face != "top" else 3)
        if face == "north" and 3 <= i <= 5 and 0 <= j <= 1:
            return ramp(SA, 3 if i == 3 else 1)  # knot
        if face == "bottom":
            return ramp(SA, 0)
        return base

    def tail(face, i, j, w, h):
        if face in ("top", "bottom"):
            return ramp(SA, 2)
        if j == h - 1:
            return ramp(SA, 3)
        return ramp(SA, 2 + (1 if face == "north" else 0) - (1 if i == w - 1 else 0))

    def strap(face, i, j, w, h):
        if face in ("north", "south"):
            return ramp(LE, 2 if i == 0 else 1)
        return ramp(LE, 1)

    def bag(face, i, j, w, h):
        if face == "north":
            if j == 0:
                return ramp(LE, 3)
            if j == 1:
                return ramp(LE, 0)  # flap shadow
            return ramp(LE, 2 if i == 0 else 1)
        if face in ("east", "west"):
            return ramp(LE, 2 if j == 0 else 1) if face == "east" else ramp(LE, 2 if j < 2 else 1)
        return ramp(LE, 2 if face == "top" else 0)

    def leaf(face, i, j, w, h):
        return ramp(G, 3 if j < 1 else 2 if j < 3 else 1) if face != "bottom" else ramp(G, 0)
    P["details"] = dict(skirt_hip=hip, skirt_hem=hem, cuff=cuff, sash=sash, tail=tail, strap=strap, bag=bag, leaf=leaf)
    cubes = common_cubes() + robe_cubes(P) + [
        K("cuff_r", "rightArm", [-7.5, 15, -2], [4, 4, 4], "solid", r="robe", detail="cuff", inflate=0.25),
        K("cuff_l", "leftArm", [3.5, 15, -2], [4, 4, 4], "solid", r="robe", detail="cuff", uv_from="cuff_r", inflate=0.25),
        K("sash", "robe", [-5, 10, -3], [10, 2, 6], "solid", r="sash", detail="sash", inflate=0.25),
        K("tail", "robe", [0, 3, -3.5], [2, 7, 1], "solid", r="sash", detail="tail"),
        K("strap", "strap", [-1, 12, -2.5], [2, 12, 5], "solid", r="leather", detail="strap"),
        K("bag", "body", [5, 4, -2], [3, 5, 4], "solid", r="leather", detail="bag"),
        K("leaf_a", "body", [5.5, 9, -1.5], [1, 3, 1], "solid", r="athelas", detail="leaf"),
        K("leaf_b", "body", [6.5, 9, 0], [1, 3, 1], "solid", r="athelas", detail="leaf", uv_from="leaf_a"),
        K("hair_long", "hair", [-4, 7, 2], [8, 17, 2], "hair_long"),
    ]
    return P, cubes


def build_woodwright():
    B = R("#33261a #4a3624 #664a2f #856240 #a07c52")           # forest-brown tunic
    LE = R("#1f160f #33241a #4a3524 #654a31")                 # heavy leather
    HAIR = R("#4a1f12 #73321b #9a4a26 #bf6a38")               # auburn
    WD = R("#6a4a2a #8f6a3c #b88c52 #d8b078")                 # fresh wood
    ST = R("#4b535a #7a858c #aab4b9 #d6dde0")                 # tool steel
    TR = R("#2c2a24 #3e3b32 #54503f #6d6852")
    GR = R("#2f3b22 #44562f #5f7640 #7d9654")                 # a moss-green neckerchief: the one accent
    P = dict(id="woodwright", variant=2, hair=HAIR, eye=W.hexc("#7a6a3a"), band=None, egg=("#56402a", "#bf6a38"))
    P["r"] = dict(brown=B, leather=LE, wood=WD, steel=ST, tie=GR, moss=GR)
    FL_ = W.FACE_LIGHT
    dabs = {k: mottle(seed_for("wtunic", k), 8, 12, 40, 70) for k in ("north", "south", "east", "west")}

    def body(face, i, j, w, h):
        if face == "north":
            if j == 0 and 2 <= i <= 5:
                return ramp(GR, 2)  # neckerchief
            if j == 1 and 3 <= i <= 4:
                return ramp(GR, 1)
            if j == 1 and i in (2, 5):
                return ramp(GR, 3)
        if face in ("top", "bottom"):
            return ramp(B, 2 if face == "top" else 0)
        if j in (9, 10):
            return ramp(LE, 2 if j == 9 else 1)
        return ramp(B, 2 + FL_[face] + (1 if j < 4 else 0) + dabs[face].get((i, j), 0))
    P["body_fn"] = body

    def arm(face, i, j, w, h):
        if face == "top":
            return ramp(B, 2)
        if face == "bottom":
            return ramp(SKIN, 1)
        sh = FL_[face]
        if j <= 5:
            return ramp(B, 2 + sh + (1 if j == 0 else 0) + dabs.get(face, {}).get((i, j), 0))
        if j <= 9:  # leather bracer with lacing
            if j == 6:
                return ramp(LE, 3)
            if j == 9:
                return ramp(LE, 0)
            return ramp(LE, 3 if (face == "north" and i == 1 and j == 8) else 2 if sh >= 0 else 1)
        return ramp(SKIN, 2 + min(0, sh) + (0 if j < 11 else -1))
    P["arm_fn"] = arm

    def leg(face, i, j, w, h):
        if face == "top":
            return ramp(TR, 2)
        if face == "bottom":
            return ramp(LEATHER, 0)
        sh = -1 if face == "south" else 0
        if j >= 7:  # tall work boots
            if j == 7:
                return ramp(LE, 3)
            return ramp(LEATHER, 0) if j == h - 1 else ramp(LE, 2 + sh if j == 8 else 1)
        return ramp(TR, (2 if j < 3 else 1) + sh)
    P["leg_fn"] = leg

    def skirt(face, i, j, w, h):
        if face == "bottom":
            return ramp(B, 0)
        if face == "top":
            return ramp(B, 2)
        if j == h - 1:
            return ramp(B, 0)
        return ramp(B, 2 + FL_[face] + (1 if j == 0 else 0) + dabs[face].get((i % 8, j % 12), 0))

    def apron(face, i, j, w, h):
        if face in ("top", "bottom"):
            return ramp(LE, 2 if face == "top" else 0)
        if face == "north":
            if j == 0:
                return ramp(LE, 3)
            if j == h - 1:
                return ramp(LE, 0)
            if i in (0, w - 1):
                return ramp(LE, 1)
            if j == 5 and i in (1, w - 2):
                return ramp(ST, 3)  # rivets
            if h > 6 and j in (4,) and 1 <= i <= w - 2:
                return ramp(LE, 3)  # tool pocket seam
            return ramp(LE, 2 - (1 if i == w - 2 else 0))
        return ramp(LE, 1)

    def strapc(face, i, j, w, h):
        if face == "north" and j == 1:
            return ramp(ST, 3)
        return ramp(LE, 2 if face in ("north", "top") else 1)

    def belt(face, i, j, w, h):
        if face == "north" and 4 <= i <= 5:
            return ramp(ST, 3 if j == 0 else 1)  # buckle
        if face in ("top", "bottom"):
            return ramp(LE, 2 if face == "top" else 0)
        return ramp(LE, 3 if j == 0 else 1)

    def mhead(face, i, j, w, h):
        if face in ("north", "east"):
            return ramp(ST, 3 if j == 0 else 2) if i < w - 1 else ramp(ST, 1)
        return ramp(ST, 1 if face != "top" else 3)

    def handle(face, i, j, w, h):
        return ramp(WD, 3 if j == 0 else 2 if face in ("north", "east") else 1)

    def chisel(face, i, j, w, h):
        if j >= 2:
            return ramp(ST, 3 if j == 2 else 2) if face in ("north", "east") else ramp(ST, 1)
        return ramp(WD, 2 if face in ("north", "east") else 1)

    def tie(face, i, j, w, h):
        return ramp(GR, 2) if j in (1, 2) else ramp(HAIR, 1 + (1 if (i + j) % 3 == 0 else 0))
    P["details"] = dict(skirt=skirt, apron=apron, strapc=strapc, belt=belt, mhead=mhead, handle=handle, chisel=chisel)

    def pony(face, i, j, w, h):
        if j == 1:
            return ramp(LE, 2)  # leather tie
        if j >= h - 1:
            return None if (i + (face == "south")) % 2 else ramp(HAIR, 1)
        k = 2 + (1 if (i + j // 2) % 2 == 0 else 0) - (1 if face in ("east", "west", "north") else 0)
        return ramp(HAIR, k)
    P["details"]["pony"] = pony
    cubes = common_cubes() + [
        K("tunic_hem", "body", [-4.5, 7, -2.5], [9, 5, 5], "solid", r="brown", detail="skirt"),
        K("apron_low", "body", [-3, 6, -3], [6, 10, 1], "solid", r="leather", detail="apron"),
        K("apron_bib", "body", [-2, 16, -3], [4, 5, 1], "solid", r="leather", detail="apron"),
        K("strap_r", "body", [-3, 21, -2.5], [1, 3, 5], "solid", r="leather", detail="strapc"),
        K("strap_l", "body", [2, 21, -2.5], [1, 3, 5], "solid", r="leather", detail="strapc", uv_from="strap_r"),
        K("belt", "body", [-5, 10, -3], [10, 2, 6], "solid", r="leather", detail="belt", inflate=0.25),
        K("mallet_h", "body", [-5.5, 5, -0.5], [1, 5, 1], "solid", r="wood", detail="handle"),
        K("mallet_head", "body", [-6.5, 9, -1], [3, 2, 2], "solid", r="steel", detail="mhead"),
        K("chisel", "body", [5, 6, -0.5], [1, 5, 1], "solid", r="steel", detail="chisel"),
        K("pony", "head", [-1, 22, 4.5], [2, 7, 2], "solid", r="leather", detail="pony"),
    ]
    return P, cubes


def build_lamplighter():
    C = R("#1d2a47 #2c3f66 #3f5a8a #5878ad #7b98c8")           # twilight-blue coat
    TR = R("#232b3d #2f394f #404c66 #55637f")
    GL = R("#8a6a2a #c9a24a #f0d27a #fff0b0")                 # lantern glass, pale gold
    HAIR = W.HAIR                                             # fair, pale gold (same ramp as the warden)
    P = dict(id="lamplighter", variant=3, hair=HAIR, eye=W.hexc("#4a6f86"), band=SILVER, egg=("#3f5a8a", "#bdc8ce"))
    P["r"] = dict(coat=C, silver=SILVER, glass=GL, leather=LEATHER)
    FL_ = W.FACE_LIGHT

    def body(face, i, j, w, h):
        if face == "north":
            n = neckline(i, j, w, SKIN, SILVER)
            if n:
                return n
            if i in (3, 4) and j >= 2:  # silver trim down the closed front, buttons
                return ramp(SILVER, 3 if (j % 3 == 0 and i == 3) else 2 if i == 3 else 1)
            if j in (9, 10):
                return ramp(SILVER, 2 if j == 9 else 1)  # belt trim
        if face in ("top", "bottom"):
            return ramp(C, 2 if face == "top" else 0)
        if j in (9, 10):
            return ramp(SILVER, 1 if j == 9 else 0)
        return folds(C, face, i, j, w, h, 2)
    P["body_fn"] = body

    def arm(face, i, j, w, h):
        if face == "top":
            return ramp(C, 2)
        if face == "bottom":
            return ramp(SKIN, 1)
        sh = FL_[face]
        if j <= 8:
            if j == 8:
                return ramp(SILVER, 2 + min(0, sh))  # silver cuff band
            return folds(C, face, i, j, w, h, 2)
        return ramp(SKIN, 2 + min(0, sh) + (0 if j < 11 else -1))
    P["arm_fn"] = arm

    def leg(face, i, j, w, h):
        if face == "top":
            return ramp(TR, 2)
        if face == "bottom":
            return ramp(LEATHER, 0)
        sh = -1 if face == "south" else 0
        if j >= 8:
            if j == 8:
                return ramp(LEATHER, 3)
            return ramp(LEATHER, 0) if j == h - 1 else ramp(LEATHER, 2 + sh if j == 9 else 1)
        return ramp(TR, (2 if j < 3 else 1) + sh)
    P["leg_fn"] = leg

    def hip(face, i, j, w, h):
        if face == "bottom":
            return ramp(C, 0)
        if face == "top":
            return ramp(C, 2)
        if face == "north" and i in (4,):
            return ramp(SILVER, 2)
        return folds(C, face, i, j, w, h, 2)

    def coat(face, i, j, w, h):
        if face == "bottom":
            return ramp(C, 0)
        if face == "top":
            return ramp(C, 2)
        if j >= h - 1:
            return ramp(SILVER, 2 if face == "north" else 1)  # silver hem
        if face == "north":
            if i in (4, 5):
                return ramp(SILVER, 3 if i == 4 else 1)  # front opening, silver edges
            if i in (3, 6):
                return ramp(C, 0)
        return folds(C, face, i, j, w, h, 2)

    def epaulet(face, i, j, w, h):
        if face == "bottom":
            return ramp(C, 0)
        if j == h - 1 or face == "top" and (i in (0, w - 1) or j in (0, h - 1)):
            return ramp(SILVER, 2)
        return ramp(C, 3 if face == "top" else 2 + FL_[face])

    def collar(face, i, j, w, h):
        if face == "top" or face == "bottom":
            return ramp(C, 2)
        return ramp(SILVER, 2 if j == 0 else 1) if face != "north" else ramp(C, 2 + (1 if j == 0 else 0))

    def chain(face, i, j, w, h):
        return ramp(SILVER, 3 if j == 0 else 1)

    def lcap(face, i, j, w, h):
        return ramp(SILVER, 3 if face == "top" else 2 if face in ("north", "east") else 1)

    def lbody(face, i, j, w, h):
        if face in ("top", "bottom"):
            return ramp(SILVER, 1)
        edge = i in (0, w - 1) or j in (0, h - 1)
        if edge:
            return ramp(SILVER, 2 if (face in ("north", "east") and (i == 0 or j == 0)) else 1)
        return ramp(GL, 3 if (i, j) == (1, 1) else 2 if face in ("north", "east") else 1)

    def lbase(face, i, j, w, h):
        return ramp(SILVER, 1 if face != "top" else 2)
    P["details"] = dict(skirt_hip=hip, coat=coat, epaulet=epaulet, collar=collar, chain=chain, lcap=lcap, lbody=lbody, lbase=lbase)
    cubes = common_cubes() + [
        K("coat_hip", "robe", [-4.5, 9, -2.5], [9, 3, 5], "solid", r="coat", detail="skirt_hip"),
        K("coat_low", "robe", [-5, 4, -3], [10, 5, 6], "solid", r="coat", detail="coat"),
        K("epaulet_r", "rightArm", [-7.5, 22, -2], [4, 2, 4], "solid", r="coat", detail="epaulet", inflate=0.25),
        K("epaulet_l", "leftArm", [3.5, 22, -2], [4, 2, 4], "solid", r="coat", detail="epaulet", uv_from="epaulet_r", inflate=0.25),
        K("collar", "body", [-4.5, 23, -2.5], [9, 2, 5], "solid", r="coat", detail="collar", inflate=0.25),
        K("chain", "lantern", [6, 9, -0.5], [1, 3, 1], "solid", r="silver", detail="chain"),
        K("lcap", "lantern", [5.5, 8, -1], [2, 1, 2], "solid", r="silver", detail="lcap"),
        K("lbody", "lantern", [5, 4, -1.5], [3, 4, 3], "solid", r="glass", detail="lbody"),
        K("lbase", "lantern", [5.5, 3, -1], [2, 1, 2], "solid", r="silver", detail="lbase"),
        K("star", "hat", [-0.5, 30, -5], [1, 1, 1], "flower", r="silver"),
        K("hair_long", "hair", [-4, 16, 2], [8, 8, 2], "hair_long", taper=2),
    ]
    return P, cubes


def build_loremaster():
    S = R("#5f6a72 #838f97 #a9b5bb #cbd4d8 #e6ebed")           # grey-white robe, darker and cooler than the healer's
    MA = R("#17281f #223a2d #2f5240 #416b52")                 # dark-green mantle
    GO = R("#7d6531 #b3924a #dcc27a #f3e4a8")                 # pale-gold trim
    HAIR = R("#7c8890 #a4b0b8 #cfd8dd #eef2f4")               # very long silver
    BK = R("#2a1c16 #43301f #5f4429 #7f5c37")                 # scroll-case leather
    GEM = R("#2f5a50 #4c8f7c #86c9b0 #d8fff0")                # pale green star-gem
    P = dict(id="loremaster", variant=4, hair=HAIR, eye=W.hexc("#6a7f8a"), band=SILVER, egg=("#8f999f", "#2f5240"))
    P["r"] = dict(robe=S, mantle=MA, gold=GO, leather=BK, silver=SILVER)
    FL_ = W.FACE_LIGHT

    def body(face, i, j, w, h):
        if face == "north":
            n = neckline(i, j, w, SKIN, GO)
            if n:
                return n
        if face in ("top", "bottom"):
            return ramp(S, 3 if face == "top" else 1)
        if j in (10, 11) and face != "south":
            return ramp(GO, 2 if j == 10 else 1)
        return folds(S, face, i, j, w, h, 2, phase=3)
    P["body_fn"] = body

    def arm(face, i, j, w, h):
        if face == "top":
            return ramp(S, 3)
        if face == "bottom":
            return ramp(SKIN, 1)
        if j <= 8:
            if j == 8:
                return ramp(GO, 2 + min(0, FL_[face]))
            return folds(S, face, i, j, w, h, 2, phase=1)
        return ramp(SKIN, 2 + min(0, FL_[face]) + (0 if j < 11 else -1))
    P["arm_fn"] = arm

    def leg(face, i, j, w, h):
        if face == "bottom":
            return ramp(LEATHER, 0)
        return ramp(BK, 1)
    P["leg_fn"] = leg

    def hip(face, i, j, w, h):
        if face == "bottom":
            return ramp(S, 1)
        if face == "top":
            return ramp(S, 3)
        return folds(S, face, i, j, w, h, 2, phase=3)

    def hem(face, i, j, w, h):
        if face == "bottom":
            return ramp(S, 1)
        if face == "top":
            return ramp(S, 3)
        if j >= h - 2:
            return ramp(GO, 2 if j == h - 2 else 1)  # pale-gold hem band
        return folds(S, face, i, j, w, h, 2, phase=2)

    def mantle(face, i, j, w, h):
        if face == "bottom":
            return ramp(MA, 0)
        if face == "top":
            return ramp(MA, 3 if 3 <= i <= 6 else 2)
        if j == h - 1:
            return ramp(GO, 2 if face == "north" else 1)  # gold hem
        if face == "north" and j == 1 and i in (4, 5):
            return ramp(SILVER, 3)  # clasp
        if face == "north" and j == 2 and i in (4, 5):
            return ramp(SILVER, 1)
        return folds(MA, face, i, j, w, h, 2, phase=1)

    def stole(face, i, j, w, h):
        if face in ("top", "bottom"):
            return ramp(MA, 2)
        if j == h - 1:
            return ramp(GO, 2)
        if face == "north" and i == 0 and j % 6 == 3:
            return ramp(GO, 3)  # leaf embroidery
        return ramp(MA, 2 + (1 if j < 2 else 0) - (1 if face != "north" else 0) - (1 if i == w - 1 and face == "north" else 0))

    def cord(face, i, j, w, h):
        if face == "north" and 4 <= i <= 5:
            return ramp(GO, 3)  # knot
        return ramp(GO, 2 if face in ("north", "top") else 1)

    def scroll(face, i, j, w, h):
        if face == "bottom":
            return ramp(SILVER, 1)
        if face == "top":
            return ramp(SILVER, 3)
        if j in (0, 1) or j >= h - 2:
            return ramp(SILVER, 3 if (j in (0, h - 2)) else 1) if face in ("north", "east") else ramp(SILVER, 1)
        if j == 3:
            return ramp(GO, 3)  # clasp band
        return ramp(BK, 2 if face in ("north", "east") else 1)

    def brooch(face, i, j, w, h):
        m = [[-1, 3, -1], [3, 2, 1], [-1, 1, -1]][j][i] if face == "north" else 1
        if m < 0:
            return None
        return ramp(GEM, {3: 3, 2: 3, 1: 1}[m]) if (face == "north" and (i, j) == (1, 1)) else ramp(SILVER, m)
    P["details"] = dict(skirt_hip=hip, skirt_hem=hem, mantle=mantle, stole=stole, cord=cord, scroll=scroll, brooch=brooch)
    cubes = common_cubes() + robe_cubes(P) + [
        K("cuff_r", "rightArm", [-7.5, 15, -2], [4, 4, 4], "solid", r="robe", detail="skirt_hem", inflate=0.25),
        K("cuff_l", "leftArm", [3.5, 15, -2], [4, 4, 4], "solid", r="robe", detail="skirt_hem", uv_from="cuff_r", inflate=0.25),
        K("mantle", "body", [-5, 18, -3], [10, 6, 6], "solid", r="mantle", detail="mantle", inflate=0.25),
        K("stole_r", "robe", [-3.5, 2, -3.5], [2, 22, 1], "solid", r="mantle", detail="stole"),
        K("stole_l", "robe", [1.5, 2, -3.5], [2, 22, 1], "solid", r="mantle", detail="stole", uv_from="stole_r"),
        K("cord", "robe", [-5, 11, -3], [10, 1, 6], "solid", r="gold", detail="cord", inflate=0.25),
        K("scroll", "body", [5, 4, -1], [2, 7, 2], "solid", r="leather", detail="scroll"),
        K("brooch", "hat", [-1.5, 29, -5], [3, 3, 1], "solid", r="silver", detail="brooch"),
        K("hair_long", "hair", [-4, 5, 2], [8, 19, 2], "hair_long", taper=3),
    ]
    return P, cubes


BUILDERS = {"gardener": build_gardener, "healer": build_healer, "woodwright": build_woodwright,
            "lamplighter": build_lamplighter, "loremaster": build_loremaster}


# ---------------------------------------------------------------- animations, render controller, client entity
def animations():
    # Keep M4 pose values with the runtime healing rules; no duplicate tunables in this generator.
    blessing = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import { BLESSING } from './lothlorien_bp/scripts/healer_rules.js'; console.log(JSON.stringify(BLESSING));",
    ], cwd=MOD, text=True))
    raise_arm = f"math.sin(math.clamp(query.anim_time / {blessing['seconds']}, 0.0, 1.0) * 180.0)"
    p = "animation.lothlorien.elf"
    mv = "math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed"
    return {
        "format_version": "1.8.0",
        "animations": {
            # Procedural one-shot pose, layered after the native humanoid walk (same -this recipe as vanilla evoker).
            blessing["animation"]: {
                "loop": False,
                "animation_length": blessing["seconds"],
                "bones": {
                    "rightArm": {"rotation": [f"-{raise_arm} * {blessing['armDegrees']} - this", "-this",
                                               f"{raise_arm} * {blessing['spreadDegrees']} - this"]},
                    "leftArm": {"rotation": [f"-{raise_arm} * {blessing['armDegrees']} - this", "-this",
                                              f"-{raise_arm} * {blessing['spreadDegrees']} - this"]},
                },
            },
            # skirt / coat tails, long hair and the lantern trail and swing with the stride
            f"{p}.walk_sway": {
                "loop": True,
                "bones": {
                    "robe": {"rotation": [f"math.min(query.modified_move_speed, 1.0) * 5.0 + {mv} * 1.5", 0.0,
                                          "math.sin(query.modified_distance_moved * 38.17) * 0.8 * query.modified_move_speed"]},
                    "hair": {"rotation": [f"math.min(query.modified_move_speed, 1.0) * 6.0 + {mv} * 2.0", 0.0,
                                          "math.sin(query.modified_distance_moved * 38.17) * 1.5 * query.modified_move_speed"]},
                    "lantern": {"rotation": [f"{mv} * -6.0", 0.0, "math.sin(query.modified_distance_moved * 38.17) * 10.0 * query.modified_move_speed"]},
                },
            },
            f"{p}.idle_sway": {
                "loop": True,
                "bones": {
                    "robe": {"rotation": ["math.sin(query.life_time * 90.0) * 0.5", 0.0, 0.0]},
                    "hair": {"rotation": ["math.sin(query.life_time * 80.0) * 0.8", 0.0, 0.0]},
                    "lantern": {"rotation": [0.0, 0.0, "math.sin(query.life_time * 110.0) * 3.0"]},
                },
            },
        },
    }


def render_controller():
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.lothlorien.elf": {
                "arrays": {
                    "geometries": {"Array.geos": [f"Geometry.{p}" for p in PROFESSIONS]},
                    "textures": {"Array.skins": [f"Texture.{p}" for p in PROFESSIONS]},
                },
                "geometry": "Array.geos[query.variant]",
                "materials": [{"*": "Material.default"}],
                "textures": ["Array.skins[query.variant]"],
            }
        },
    }


def client_entity(eggs):
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": ID,
            "materials": {"default": "entity_alphatest"},
            "textures": {p: f"textures/entity/elf/{p}" for p in PROFESSIONS},
            "geometry": {p: geo_id(p) for p in PROFESSIONS},
            "animations": {
                "look_at_target": "animation.humanoid.look_at_target.default",
                "move": "animation.humanoid.move",
                "walk_sway": "animation.lothlorien.elf.walk_sway",
                "idle_sway": "animation.lothlorien.elf.idle_sway",
                "bless": "animation.lothlorien.elf.bless",
            },
            "scripts": {
                "pre_animation": ["variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 57.3;"],
                "animate": ["look_at_target", "move", "walk_sway", "idle_sway"],
            },
            "render_controllers": ["controller.render.lothlorien.elf"],
            "enable_attachables": True,
            "spawn_egg": {"base_color": eggs[0], "overlay_color": eggs[1]},
        }},
    }


def review_sheet(geos, out_dir):
    sys.path.insert(0, str(WS / ".claude" / "skills" / "bedrock-mobs" / "scripts"))
    import preview_entity as pe
    out_dir.mkdir(parents=True, exist_ok=True)
    bg = (150, 190, 220, 255)
    for p in PROFESSIONS:
        tex = Image.open(RP / f"textures/entity/elf/{p}.png").convert("RGBA")
        sheet = Image.new("RGBA", (420 * 4, 420), bg)
        for n, yaw in enumerate((180, 90, 0, 145)):
            sheet.alpha_composite(pe.render(geos[p], tex, yaw, pitch=8, scale=11), (420 * n, 0))
        sheet.convert("RGB").save(out_dir / f"sheet_{p}.png")


def main():
    geos, eggs = {}, {}
    tex_dir = RP / "textures/entity/elf"
    tex_dir.mkdir(parents=True, exist_ok=True)
    for p in PROFESSIONS:
        P, cubes = BUILDERS[p]()
        names = [c["name"] for c in cubes]
        assert len(names) == len(set(names)), f"{p}: duplicate cube names"
        uvs, height = pack(cubes, p)
        geos[p] = geometry_entry(p, cubes, uvs, height, None)
        img = paint_texture(P, cubes, uvs, height)
        img.save(tex_dir / f"{p}.png")
        eggs[p] = P["egg"]
        used = sum(1 for v in img.getchannel("A").tobytes() if v)
        print(f"{p}: {len(cubes)} cubes, texture 64x{height}, opaque texels {used}")
    W.write(RP / "models/entity/elf.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [geos[p] for p in PROFESSIONS]})
    W.write(RP / "animations/elf.animation.json", animations())
    W.write(RP / "render_controllers/elf.render_controllers.json", render_controller())
    W.write(RP / "entity/elf.entity.json", client_entity(eggs["gardener"]))
    if "--sheet" in sys.argv:
        review_sheet(geos, WS / "temp" / "elves")


if __name__ == "__main__":
    main()
