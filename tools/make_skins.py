"""Generates the Lothlorien player skins (64x64, slim arms, classic two-layer skins).

    python -B mods/lothlorien/tools/make_skins.py [--out DIR --suffix _vN] [--only NAME]

Default output: lothlorien_skins/ (textures, skins.json). Names: localization/catalog.json. Manifest: hand-kept.

Each skin is data: per-part pixel grids (one character per texel) plus a legend that maps a character to
(material, shade step). Materials are hue-shifted colour ramps (dark -> light); the shade of a texel is the
material's base step + the legend step + a rule: the top texel of every vertical run of one material is lit (+1),
the bottom one shaded (-1); top faces +1, bottom faces -1.
A material can opt out of the run rule with a large "run" (skin does: on a face it painted a fake nose). '.' = transparent (overlay layers only).

Grid layout per part (box UV of the slim player model, `geometry.humanoid.customSlim`):
  strip  = the four side faces in a row, h rows: char-right side | front | char-left side | back
           (right side: column 0 = back edge; front: column 0 = character's right = viewer's left;
            left side: column 0 = front edge; back: column 0 = character's left). '|' separators are ignored.
  top    = d rows of w, last row touches the front face.
  bottom = d rows of w.
"""
import argparse
import json
import sys
from pathlib import Path
from PIL import Image

MOD = Path(__file__).resolve().parents[1]
WS = MOD.parents[1]
PACK = MOD / "lothlorien_skins"

# (u, v, w, h, d) of every box in the slim model
PARTS = {
    "head": (0, 0, 8, 8, 8), "hat": (32, 0, 8, 8, 8),
    "body": (16, 16, 8, 12, 4), "jacket": (16, 32, 8, 12, 4),
    "rarm": (40, 16, 3, 12, 4), "rsleeve": (40, 32, 3, 12, 4),
    "larm": (32, 48, 3, 12, 4), "lsleeve": (48, 48, 3, 12, 4),
    "rleg": (0, 16, 4, 12, 4), "rpants": (0, 32, 4, 12, 4),
    "lleg": (16, 48, 4, 12, 4), "lpants": (0, 48, 4, 12, 4),
}
BASE_PARTS = ("head", "body", "rarm", "larm", "rleg", "lleg")


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def ramp(s):
    return [hexc(c) for c in s.split()]


def mirror(rows):
    return [r[::-1] for r in rows]


def side_rows(right_side, front, back):
    """Strip rows from the right-side face; the left side is its mirror."""
    return [r + "|" + f + "|" + r[::-1] + "|" + b for r, f, b in zip(right_side, front, back)]


def clean(rows):
    return [r.replace("|", "").replace(" ", "") for r in rows]


# ---------------------------------------------------------------- painter

def paint(skin):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    mats, legend = skin["materials"], skin["legend"]
    for part, faces in skin["parts"].items():
        u, v, w, h, d = PARTS[part]
        for kind, rows in faces.items():
            rows = clean(rows)
            if kind == "strip":
                ox, oy, ew, eh, face_step = u, v + d, 2 * (w + d), h, 0
            elif kind == "top":
                ox, oy, ew, eh, face_step = u + d, v, w, d, 1
            elif kind == "bottom":
                ox, oy, ew, eh, face_step = u + d + w, v, w, d, -1
            else:
                sys.exit("unknown face kind {}".format(kind))
            if len(rows) != eh or any(len(r) != ew for r in rows):
                sys.exit("{} {} {}: want {}x{}, got {} rows {}".format(
                    skin["name"], part, kind, ew, eh, len(rows), sorted({len(r) for r in rows})))
            mat_of = [[legend[c][0] if c != "." else None for c in r] for r in rows]
            for y, r in enumerate(rows):
                for x, c in enumerate(r):
                    if c == ".":
                        continue
                    if c not in legend:
                        sys.exit("{} {}: no legend entry for {!r}".format(skin["name"], part, c))
                    mat, step = legend[c]
                    m = mats[mat]
                    if m.get("flat"):
                        col = m["ramp"][step]
                    else:
                        s = m["base"] + step + face_step
                        if kind == "strip":
                            top = y
                            while top > 0 and mat_of[top - 1][x] == mat:
                                top -= 1
                            bot = y
                            while bot < eh - 1 and mat_of[bot + 1][x] == mat:
                                bot += 1
                            if bot - top + 1 >= m.get("run", 4):
                                if y == top:
                                    s += 1
                                elif y == bot:
                                    s -= 1
                        col = m["ramp"][max(0, min(len(m["ramp"]) - 1, s))]
                    img.putpixel((ox + x, oy + y), col)
    # self-check: every base-layer texel painted
    for part in BASE_PARTS:
        u, v, w, h, d = PARTS[part]
        boxes = [(u, v + d, 2 * (w + d), h), (u + d, v, 2 * w, d)]
        for bx, by, bw, bh in boxes:
            for y in range(by, by + bh):
                for x in range(bx, bx + bw):
                    if img.getpixel((x, y))[3] != 255:
                        sys.exit("{}: base texel ({}, {}) of {} is not opaque".format(skin["name"], x, y, part))
    return img


# ---------------------------------------------------------------- skins

def warden_woman():
    materials = {
        # dark -> light, shadows lean violet/blue, lights lean warm
        "skin": {"ramp": ramp("#6e4a52 #9a6a6a #c39084 #deb09e #eecab6 #f8e2d0"), "base": 3, "run": 99},
        "hair": {"ramp": ramp("#4a3a46 #7a6060 #a88a6e #d0b484 #ead2a0 #fbeec6"), "base": 3},
        "tunic": {"ramp": ramp("#10222a #1a3438 #254a48 #346256 #4a7c66 #66977a"), "base": 2},
        "plate": {"ramp": ramp("#1e2834 #34424e #52646e #768a8e #a2b4b0 #d2e0d8"), "base": 2},
        "gold": {"ramp": ramp("#4a2a12 #7a4a16 #a8761e #d2a22e #ecc84e #fff3a0"), "base": 3},
        "leather": {"ramp": ramp("#26161a #40241e #5e3a28 #7e5232 #a26e44 #c48e5c"), "base": 2},
        "cloak": {"ramp": ramp("#1e2232 #2e3548 #46506a #66728a #8e9aac #b8c2c8"), "base": 2},
        "legs": {"ramp": ramp("#1a1c22 #262c2e #363f3a #4a5648 #627058 #7e8c6e"), "base": 2},
        "boot": {"ramp": ramp("#1e1216 #33201e #4c3024 #684430 #885c40 #a87a56"), "base": 2},
        "eye": {"ramp": ramp("#f4f1ea #c9c3c8 #2a4f74 #4a8cb4 #7cc0dc #c7887e #3a2630 #eebfae"), "flat": True},
    }
    legend = {
        "S": ("skin", 0), "s": ("skin", -1), "z": ("skin", -2), "Z": ("skin", 1),
        "H": ("hair", 0), "h": ("hair", -1), "k": ("hair", -2), "j": ("hair", 1), "J": ("hair", 2),
        "T": ("tunic", 0), "t": ("tunic", -1), "y": ("tunic", 1),
        "P": ("plate", 0), "p": ("plate", -1), "o": ("plate", -2), "q": ("plate", 1), "Q": ("plate", 2),
        "G": ("gold", 0), "g": ("gold", -1), "Y": ("gold", 1),
        "L": ("leather", 0), "l": ("leather", -1), "A": ("leather", 1),
        "C": ("cloak", 0), "c": ("cloak", -1), "d": ("cloak", -2), "D": ("cloak", 1),
        "N": ("legs", 0), "n": ("legs", -1), "V": ("legs", 1),
        "B": ("boot", 0), "b": ("boot", -1), "E": ("boot", 1),
        "W": ("eye", 0), "w": ("eye", 1), "I": ("eye", 3), "i": ("eye", 2), "m": ("eye", 5),
        "K": ("eye", 6), "r": ("eye", 7),
    }

    # ---- head
    head_side = [            # character's right side, column 0 = back, 7 = front; the ear leans back
        "HhhHHjHH",
        "hZhHHHHj",
        "hZShHHjH",
        "HhZZShHH",
        "HhSzsSSH",
        "HHhSsSSH",
        "HHHhsSSH",
        "HHHHhssH",
    ]
    head_front = [
        "HjHhhHjH",
        "jHHhhHHj",
        "HhsSSshH",
        "HKiSSiKH",          # 2x2 eyes (owner's pick): lash + dark iris top, white + iris below
        "HWISSIWH",
        "HrSSSSrH",
        "HSSmmSSH",
        "HsSSSSsH",
    ]
    head_back = [
        "HHHHHHHH",
        "jjJJjjJj",
        "HjHjjHjH",
        "HjhHjhjH",
        "HHhHjhHH",
        "HhHHHHhH",
        "HhHjHHhH",
        "hHHhHHHh",
    ]
    hat_side = [
        "HhhHHjHH",
        "hZhHHHHj",
        "hZShHHjH",
        "HhZZShHH",
        "HhSzsS.H",
        "HHhSsS.H",
        "HHHhsS.H",
        "HHHHh..H",
    ]
    hat_front = [
        "HjHhhHjH",
        "jH....Hj",
        "H......H",
        "H......H",
        "H......H",
        "H......H",
        "H......H",
        "h......h",
    ]
    head_top = [
        "HjHHHHjH",
        "HjHHHHjH",
        "HjHHHHjH",
        "HjHHHHjH",
        "HjHHhHjH",
        "HjHHhHjH",
        "HjHHhHjH",
        "HjHHhHjH",
    ]
    head_bottom = ["HHHHHHHH"] + ["HsSSSSsH"] * 6 + ["HHHHHHHH"]

    # ---- body (cuirass, belt, tunic skirt; cloak on the back half)
    body_side = [            # right side, column 0 = back
        "DCqP", "CcPq", "CcqP", "CcPP", "CcPp", "cdpo", "CcPP", "Ccgg", "CclL", "CcTT", "CcTt", "ccTt",
    ]
    body_front = [
        "qPGSSGPq",
        "PqPGGPqP",
        "PQPqpPQP",
        "PqPqpPqP",
        "pPPqpPPp",
        "oppppppo",
        "PqPqpPqP",
        "ggGGGGgg",
        "lLLGYLLl",
        "TTtTTtTT",
        "TTtTTtTT",
        "TTtTTtTT",
    ]
    cloak_back = [
        "DDDDDDDD",
        "CcCCcCcC",
        "CcCCcCcC",
        "CcCCcCcC",
        "CcCCcCcC",
        "CcCQcCcC",
        "CcCqQCcC",
        "CcqQqpcC",
        "CcCqpCcC",
        "CcCCcCcC",
        "CcCCcCcC",
        "CcCCcCcC",
        "DDDDDDDD",
    ]
    body_top = ["DDDDDDDD", "DDTTTTDD", "qqTSSTqq", "qqGSSGqq"]
    body_bottom = ["TTtTTtTT"] * 4

    jacket_side = [          # cloak on the back half, braid edge at the front of the right side
        "DC.j", "Cc.H", "Cc.h", "Cc.H", "Cc.h", "Cc.H", "Cc.h", "Cc.G", "Cc.H", "Cc..", "Cc..", "cc..",
    ]
    jacket_side_left = [r[:2] + ".." for r in jacket_side]   # no braid on the left
    jacket_front = [         # braid over the right shoulder, gold tie, tuft
        "jH......", "Hh......", "hj......", "jH......", "Hh......", "hj......", "jH......",
        "YG......", "Hj......", "h.......", "........", "........",
    ]
    hair_fall = ["jHjJjjHj", "HjHHjHjH", ".HjHHjH.", "..HjhH..", "...hh..."]
    jacket_back = [hair_fall[i] if i < len(hair_fall) else cloak_back[i] for i in range(12)]
    jacket_back = ["".join(c if c != "." else cb for c, cb in zip(r, cloak_back[i])) for i, r in enumerate(jacket_back)]
    jacket_rows = [a + "|" + f + "|" + b[::-1] + "|" + c
                   for a, f, b, c in zip(jacket_side, jacket_front, jacket_side_left, jacket_back)]
    jacket_top = ["DDDDDDDD", "DD....DD", "D......D", "jH.....D"]

    # ---- arms (slim, strip = outer/inner 4 | front 3 | 4 | back 3)
    def arm_rows(outer_first):
        sleeve = ["TTTT|TTT|TTTT|TTT", "TtTT|TyT|TTtT|TtT", "TtTT|TTT|TTtT|TtT",
                  "TTTT|TTT|TTTT|TTT", "TTTT|TTT|TTTT|TTT", "yyyy|yyy|yyyy|yyy"]
        bracer = ["AAAA|AAA|AAAA|AAA", "LlLL|LGL|LLlL|LlL", "LLLL|LYL|LLLL|LLL",
                  "LlLL|LGL|LLlL|LlL", "llll|lll|llll|lll"]
        hand = ["SSSs|SSs|sSSS|sss"]
        return sleeve + bracer + hand
    arm_top = ["TTT"] * 4
    arm_bottom = ["SSS"] * 4
    bracer_overlay = (["....|...|....|..."] * 6 +
                      ["AAAA|AAA|AAAA|AAA", "LlLL|LGL|LLlL|LlL", "LLLL|LYL|LLLL|LLL",
                       "LlLL|LGL|LLlL|LlL", "llll|lll|llll|lll", "....|...|....|..."])
    pauldron = ["qqqq|QqQ|....|qqq", "PPPP|PqP|....|PPP", "gggg|GGG|....|ggg"]
    lsleeve = pauldron + bracer_overlay[3:]
    # left arm: the first segment (character's right side) is the inner side -> pauldron on the last 3 segments
    lsleeve = ["....|" + r.split("|")[1] + "|" + r.split("|")[0] + "|" + r.split("|")[3] if i < 3 else r
               for i, r in enumerate(lsleeve)]

    # ---- legs
    leg = (["NNNN|NnNN|NNNN|NNNN"] * 3 + ["NNNN|VVNN|NNNN|NNNN", "NNNN|NNnN|NNNN|NNNN"] +
           ["NNNN|NnNN|NNNN|NNNN"] * 2 + ["EEEE|EEEE|EEEE|EEEE", "BBBB|BbBB|BBBB|BBBB",
           "BBBB|BBBB|BBBB|BBBB", "BBBB|BBbB|BBBB|BBBB", "bbbb|bbbb|bbbb|bbbb"])
    pants = (["TTTT|TTTT|TTTT|TTTT", "TtTT|TTtT|TtTT|TTtT", "gGGg|GGGG|gGGg|GGGG"] +
             ["....|....|....|...."] * 4 + ["EEEE|EEEE|EEEE|EEEE"] + ["....|....|....|...."] * 4)
    leg_top = ["NNNN"] * 4
    leg_bottom = ["bbbb"] * 4
    transparent = lambda w, d: ["." * w] * d

    parts = {
        "head": {"strip": side_rows(head_side, head_front, head_back), "top": head_top, "bottom": head_bottom},
        "hat": {"strip": side_rows(hat_side, hat_front, head_back), "top": head_top, "bottom": transparent(8, 8)},
        "body": {"strip": side_rows(body_side, body_front, cloak_back), "top": body_top, "bottom": body_bottom},
        "jacket": {"strip": jacket_rows, "top": jacket_top, "bottom": transparent(8, 4)},
        "rarm": {"strip": arm_rows(True), "top": arm_top, "bottom": arm_bottom},
        "larm": {"strip": arm_rows(False), "top": arm_top, "bottom": arm_bottom},
        "rsleeve": {"strip": bracer_overlay, "top": transparent(3, 4), "bottom": transparent(3, 4)},
        "lsleeve": {"strip": lsleeve, "top": ["qqq", "qQq", "qqq", "qqq"], "bottom": transparent(3, 4)},
        "rleg": {"strip": leg, "top": leg_top, "bottom": leg_bottom},
        "lleg": {"strip": leg, "top": leg_top, "bottom": leg_bottom},
        "rpants": {"strip": pants, "top": transparent(4, 4), "bottom": transparent(4, 4)},
        "lpants": {"strip": pants, "top": transparent(4, 4), "bottom": transparent(4, 4)},
    }
    return {"name": "warden_woman", "materials": materials, "legend": legend,
            "parts": parts}


# ---------------------------------------------------------------- shared pieces for the other five

LEGEND = dict(warden_woman()["legend"])
LEGEND.update({
    "M": ("linen", 0), "u": ("linen", -1), "O": ("linen", 1),          # shirt, chemise, under-tunic
    "X": ("accent", 0), "x": ("accent", 1), "U": ("accent", 2),        # flowers, gems (flat)
    "F": ("tunic", 2), "R": ("gold", 2), "e": ("hair", -3),
})
EAR_SIDE = warden_woman()["parts"]["head"]["strip"]
EAR_SIDE = [r.split("|")[0] for r in EAR_SIDE]                         # right side with the painted ear
EAR_HAT_SIDE = [r.split("|")[0] for r in warden_woman()["parts"]["hat"]["strip"]]
HAIR_BACK = [r.split("|")[3] for r in warden_woman()["parts"]["head"]["strip"]]
TOP_CENTRE_PART = warden_woman()["parts"]["head"]["top"]
TOP_SIDE_PART = ["HHjHHHjH"] * 4 + ["HHkHHHjH"] * 4
FACE_WOMAN = ["HhsSSshH", "HKiSSiKH", "HWISSIWH", "HrSSSSrH", "HSSmmSSH", "HsSSSSsH"]   # 2x2 eyes, lash
FACE_MAN = ["HhsSSshH", "HkkSSkkH", "HWISSIWH", "HSSSSSSH", "HSSmmSSH", "HsSSSSsH"]     # brows, 1-row eyes
FRINGE_CENTRE = ["HjHhhHjH", "jHHhhHHj"]
FRINGE_SIDE = ["HHjHHhjH", "hHHjhHHh"]
EMPTY_ARM = "....|...|....|..."
EMPTY_LEG = "....|....|....|...."


def over(base, top):
    """Lay `top` rows over `base` rows; '_' keeps the base character."""
    return ["".join(b if t == "_" else t for b, t in zip(br, tr)) for br, tr in zip(base, top)]


def mirror_limb(rows):
    """Right arm/leg strip -> left one (the whole limb mirrored)."""
    out = []
    for r in rows:
        a, f, b, c = r.split("|")
        out.append("|".join([b[::-1], f[::-1], a[::-1], c[::-1]]))
    return out


def blank(w, d):
    return ["." * w] * d


def head(face, fringe, top, back=HAIR_BACK, hat_front_extra=None, hat_side_extra=None, hat_back_extra=None,
         hat_top=None):
    front = fringe + face
    hat_front = fringe + ["H......H"] * 5 + ["h......h"]
    hat_side, hat_back = EAR_HAT_SIDE, back
    if hat_front_extra:
        hat_front = over(hat_front, hat_front_extra)
    if hat_side_extra:
        hat_side = over(hat_side, hat_side_extra)
    if hat_back_extra:
        hat_back = over(hat_back, hat_back_extra)
    bottom = ["HHHHHHHH"] + ["HsSSSSsH"] * 6 + ["HHHHHHHH"]
    return {
        "head": {"strip": side_rows(EAR_SIDE, front, back), "top": top, "bottom": bottom},
        "hat": {"strip": side_rows(hat_side, hat_front, hat_back), "top": hat_top or top, "bottom": blank(8, 8)},
    }


def limbs(arm, sleeve, leg, pants, arm_top="TTT", arm_bottom="SSS", leg_top="NNNN", leg_bottom="bbbb",
          lsleeve=None, lleg=None, lpants=None, sleeve_top=None):
    """Right-limb strips; the left ones are mirrored unless given."""
    return {
        "rarm": {"strip": arm, "top": [arm_top] * 4, "bottom": [arm_bottom] * 4},
        "larm": {"strip": mirror_limb(arm), "top": [arm_top] * 4, "bottom": [arm_bottom] * 4},
        "rsleeve": {"strip": sleeve, "top": sleeve_top or blank(3, 4), "bottom": blank(3, 4)},
        "lsleeve": {"strip": lsleeve or mirror_limb(sleeve), "top": blank(3, 4), "bottom": blank(3, 4)},
        "rleg": {"strip": leg, "top": [leg_top] * 4, "bottom": [leg_bottom] * 4},
        "lleg": {"strip": lleg or mirror_limb(leg), "top": [leg_top] * 4, "bottom": [leg_bottom] * 4},
        "rpants": {"strip": pants, "top": blank(4, 4), "bottom": blank(4, 4)},
        "lpants": {"strip": lpants or mirror_limb(pants), "top": blank(4, 4), "bottom": blank(4, 4)},
    }


def eyes(iris_dark, iris_mid, iris_light, mouth, lash, blush):
    return {"ramp": ramp("#f4f1ea #c9c3c8 {} {} {} {} {} {}".format(iris_dark, iris_mid, iris_light, mouth, lash,
                                                                  blush)), "flat": True}


WARDEN_KIT = {k: v for k, v in warden_woman()["materials"].items() if k not in ("skin", "hair", "eye")}


# ---------------------------------------------------------------- warden man ("Sentinel")

def warden_man():
    m = dict(WARDEN_KIT)
    m.update({
        "skin": {"ramp": ramp("#64464c #946666 #bc8a7c #d8a892 #eac4ae #f6dcc8"), "base": 3, "run": 99},
        "hair": {"ramp": ramp("#1a1218 #2c1e1e #442c26 #5e3e30 #7a5440 #987056"), "base": 3},
        "eye": eyes("#2e3c4a", "#5c7486", "#8ea6b4", "#b47c74", "#2a2230", "#e0a898"),
    })
    h = head(FACE_MAN, FRINGE_SIDE, TOP_SIDE_PART)
    side = ["DCqP", "CcPq", "CcqP", "CcPP", "CcPp", "cdpo", "CcPP", "Ccgg", "CclL", "CcTT", "CcTt", "ccTt"]
    front = ["qPGSSGPq", "PqPGGPqP", "PQPqpPQP", "PqPqpPqP", "pPPqpPPp", "oppppppo", "PqPqpPqP",
             "ggGGGGgg", "lLLGYLLl", "TTtTTtTT", "TTtTTtTT", "tTtTTtTt"]
    back = ["DDDDDDDD"] + ["CcCCcCcC"] * 10 + ["ccCCcCcc"]
    # baldric from the right shoulder to the left hip, over the cuirass; hair falls over the cloak
    j_front = ["AL......", "LA......", ".lL.....", "..LG....", "...LA...", "....lL..", ".....LA.", "......lL",
               "........", "........", "........", "........"]
    hair_fall = ["jHjJjjHj", "HjHHjHjH", "HhHjHHhH", ".HjHHjH.", "..HhhH..", "...hh..."]
    j_back = ["jHjJjjHj", "HjHHjHjH", "HhHjHHhH", ".HjHHjH.", "..HhhH..", "..Lhh...", ".Ll.....", "Ll......",
              "l.......", "........", "........", "........"]
    j_side = ["DC.A", "Cc.L", "Cc..", "Cc..", "Cc..", "Cc..", "Cc..", "Cc..", "Cc..", "Cc..", "Cc..", "cc.."]
    j_left = ["DC..", "Cc..", "Cc..", "Cc..", "Cc..", "Cc..", "Cc.L", "Cc.l", "Cc..", "Cc..", "Cc..", "cc.."]
    j_rows = [a + "|" + f + "|" + b[::-1] + "|" + c for a, f, b, c in zip(j_side, j_front, j_left, j_back)]
    # arms: tunic sleeve, steel vambrace with gold inlay, leather glove; pauldron on the right shoulder
    arm = (["TTTT|TTT|TTTT|TTT", "TtTT|TyT|TTtT|TtT", "TtTT|TTT|TTtT|TtT", "TTTT|TTT|TTTT|TTT",
            "TTTT|TTT|TTTT|TTT", "yyyy|yyy|yyyy|yyy"] +
           ["qqqq|qQq|qqqq|qqq", "PpPP|PGP|PPpP|PpP", "PPPP|PYP|PPPP|PPP", "PpPP|PGP|PPpP|PpP",
            "pppp|ppp|pppp|ppp", "LLLl|LLl|lLLL|lll"])
    vamb = [EMPTY_ARM] * 6 + ["qqqq|qQq|qqqq|qqq", "PpPP|PGP|PPpP|PpP", "PPPP|PYP|PPPP|PPP",
                              "PpPP|PGP|PPpP|PpP", "pppp|ppp|pppp|ppp", EMPTY_ARM]
    pauldron = ["qQqq|QqQ|....|qqq", "PPqP|PqP|....|PPP", "gggg|GGG|....|ggg"]
    rsleeve = pauldron + vamb[3:]
    leg = (["NNNN|NnNN|NNNN|NNNN"] * 3 + ["NNNN|VVNN|NNNN|NNNN", "NNNN|NNnN|NNNN|NNNN"] +
           ["NNNN|NnNN|NNNN|NNNN"] * 2 + ["EEEE|EEEE|EEEE|EEEE", "BBBB|BbBB|BBBB|BBBB",
           "BBBB|BBBB|BBBB|BBBB", "BBBB|BBbB|BBBB|BBBB", "bbbb|bbbb|bbbb|bbbb"])
    pants = (["TTTT|TTTT|TTTT|TTTT", "TtTT|TTtT|TtTT|TTtT", "gGGg|GGGG|gGGg|GGGG", EMPTY_LEG,
              EMPTY_LEG, EMPTY_LEG, EMPTY_LEG, "EEEE|EEEE|EEEE|EEEE"] + [EMPTY_LEG] * 4)
    parts = dict(h)
    parts.update({
        "body": {"strip": side_rows(side, front, back), "top": ["DDDDDDDD", "DDTTTTDD", "qqTSSTqq", "qqGSSGqq"],
                 "bottom": ["TTtTTtTT"] * 4},
        "jacket": {"strip": j_rows, "top": ["LAHHHHDD", "LL....DD", "AL.....D", "LA.....D"], "bottom": blank(8, 4)},
    })
    parts.update(limbs(arm, rsleeve, leg, pants, lsleeve=mirror_limb(vamb)))
    parts["rsleeve"]["top"] = ["qqq", "qQq", "qqq", "qqq"]
    return {"name": "warden_man", "materials": m, "legend": LEGEND, "parts": parts}


# ---------------------------------------------------------------- woodland woman ("Forester")

def woodland_woman():
    m = {
        "skin": {"ramp": ramp("#6a4448 #985e5e #c4867a #dea690 #eec2aa #f8dcc6"), "base": 3, "run": 99},
        "hair": {"ramp": ramp("#3a1a1c #5e2820 #8a3e28 #b05c32 #cc7e44 #e4a262"), "base": 3},
        "eye": eyes("#24482c", "#3e7a44", "#6aa860", "#c07c6a", "#3a2026", "#eab4a0"),
        "tunic": {"ramp": ramp("#16241a #243a24 #365430 #4c6e3a #66894a #88a65e"), "base": 2},
        "linen": {"ramp": ramp("#5a4a3e #847060 #ae9a80 #cebc9c #e6d8b8 #f6eed6"), "base": 3},
        "gold": {"ramp": ramp("#4a2a12 #7a4a16 #a8761e #d2a22e #ecc84e #fff3a0"), "base": 3},
        "leather": {"ramp": ramp("#26161a #40241e #5e3a28 #7e5232 #a26e44 #c48e5c"), "base": 2},
        "legs": {"ramp": ramp("#221a1a #36281e #4e3a28 #6a5034 #866a44 #a4865a"), "base": 2},
        "boot": {"ramp": ramp("#1e1216 #33201e #4c3024 #684430 #885c40 #a87a56"), "base": 2},
        "accent": {"ramp": ramp("#fbf8ee #e8b8c8 #f4d24a"), "flat": True},     # white petals, pink, yellow
    }
    # flower crown (hat layer, top row all round) over long copper hair
    crown_f = ["yXyyUyyX"] + ["________"] * 7
    crown_s = ["yyXyyUyy"] + ["________"] * 7
    crown_b = ["yUyyXyyx"] + ["________"] * 7
    h = head(FACE_WOMAN, FRINGE_CENTRE, TOP_CENTRE_PART, hat_front_extra=crown_f, hat_side_extra=crown_s,
             hat_back_extra=crown_b,
             hat_top=over(TOP_CENTRE_PART, ["yXyyUyyX", "y______y", "U______y", "y______X",
                                            "y______y", "X______U", "y______y", "yXyyUyyX"]))
    side = ["TTTT", "TTTT", "TtTT", "TtTT", "TtTT", "TTTT", "TTTT", "GGGG", "TTTT", "TtTT", "TtTT", "tttt"]
    front = ["TMSSSSMT", "TTMSSMTT", "TtTGgTtT", "TtTgGTtT", "TtTGgTtT", "TtTgGTtT", "TTTTTTTT",
             "gGGGYGGg", "TTTTGTTT", "TTtTGtTT", "TtTTgTTt", "tTtTTTtt"]
    back = ["TTTTTTTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTTTTTTT",
            "gGGGGGGg", "TTtTTtTT", "TTtTTtTT", "TtTTTTtT", "tttttttt"]
    locks = ["Hj....jH", "jH....Hj", "Hh....hH", "jH....Hj", ".h....h.", "........"] + ["........"] * 6
    hair_fall = ["jHjJjjHj", "HjHHjHjH", "HhHjHHhH", "HjHHjHjH", ".HjHhjH.", "..HjhH..", "...hh...",
                 "........", "........", "........", "........", "........"]
    j_side = ["H..j", "h..H", "...h", "...H"] + ["...."] * 8
    j_rows = side_rows(j_side, locks, hair_fall)
    arm = (["TTTT|TTT|TTTT|TTT", "TtTT|TFT|TTtT|TtT", "MMMM|MMM|MMMM|MMM", "MuMM|MMM|MMuM|MuM",
            "MuMM|MMM|MMuM|MuM", "MuMM|MMM|MMuM|MuM", "MuMM|MMM|MMuM|MuM", "MMMM|MMM|MMMM|MMM",
            "uuuu|uuu|uuuu|uuu", "TTTT|TGT|TTTT|TTT", "SSSS|SSS|SSSS|SSS", "SSSs|SSs|sSSS|sss"])
    sleeve = ["TTTT|TFT|TTTT|TTT", "TtTT|TTT|TTtT|TtT", "GGGG|GGG|GGGG|GGG"] + [EMPTY_ARM] * 6 + \
             ["TTTT|TGT|TTTT|TTT"] + [EMPTY_ARM] * 2
    leg = (["TtTT|TTtT|TtTT|TTtT"] * 6 + [
           "GGGG|GGGG|GGGG|GGGG", "NNNN|NNnN|NNNN|NNNN", "EEEE|EEEE|EEEE|EEEE", "BBBB|BbBB|BBBB|BBBB",
           "BBBB|BBBB|BBBB|BBBB", "bbbb|bbbb|bbbb|bbbb"])
    pants = (["TtTT|TTtT|TtTT|TTtT"] * 6 + ["GYGG|GGYG|GYGG|GGYG"] + [EMPTY_LEG] * 5)
    parts = dict(h)
    parts.update({
        "body": {"strip": side_rows(side, front, back), "top": ["TTTTTTTT", "TTMMMMTT", "TMSSSSMT", "TMSSSSMT"],
                 "bottom": ["TTtTTtTT"] * 4},
        "jacket": {"strip": j_rows, "top": ["jHjHHjHj", "H......H", "j......j", "H......H"], "bottom": blank(8, 4)},
    })
    parts.update(limbs(arm, sleeve, leg, pants, arm_top="TTT", leg_top="TTTT"))
    return {"name": "woodland_woman", "materials": m, "legend": LEGEND, "parts": parts}


# ---------------------------------------------------------------- woodland man ("Pathfinder")

def woodland_man():
    m = {
        "skin": {"ramp": ramp("#5a3630 #845040 #b0745a #c88e6e #dcaa86 #ecc6a2"), "base": 3, "run": 99},
        "hair": {"ramp": ramp("#2c2226 #463634 #644e44 #806856 #9c846c #b8a286"), "base": 3},
        "eye": eyes("#3a2c1c", "#6a5030", "#8e7444", "#9c5e50", "#2a1e1c", "#c88e74"),
        "tunic": {"ramp": ramp("#1a2026 #283238 #3a4a50 #52666a #6e8484 #92a6a2"), "base": 2},
        "linen": {"ramp": ramp("#5a4a3e #847060 #ae9a80 #cebc9c #e6d8b8 #f6eed6"), "base": 3},
        "gold": {"ramp": ramp("#4a2a12 #7a4a16 #a8761e #d2a22e #ecc84e #fff3a0"), "base": 3},
        "leather": {"ramp": ramp("#26161a #40241e #5e3a28 #7e5232 #a26e44 #c48e5c"), "base": 2},
        "legs": {"ramp": ramp("#1e1618 #30241e #46342a #5e4634 #785c44 #947658"), "base": 2},
        "boot": {"ramp": ramp("#16100e #281c18 #3c2a22 #54392c #6c4c3a #88644c"), "base": 2},
    }
    h = head(FACE_MAN, FRINGE_SIDE, TOP_SIDE_PART)
    side = ["TTTT", "TTTT", "TtTT", "TtTT", "TtTT", "TtTT", "TTTT", "LLLL", "TTTT", "TtTT", "TtTT", "tttt"]
    front = ["TTMSSMTT", "TYtMMtTT", "TTTtTTTT", "TTTlTTTT", "TTTtTTTT", "TTTlTTTT", "TTTtTTTT",
             "lLLGYLLl", "TTTtTTTT", "TtTtTTtT", "TtTtTTtT", "tttttttt"]
    back = ["TTTTTTTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTTTTTTT",
            "lLLLLLLl", "TTtTTtTT", "TTtTTtTT", "TtTTTTtT", "tttttttt"]
    # strap from the left shoulder to a satchel on the right hip; short tied tail on the back
    j_front = ["......LA", ".....AL.", "....Ll..", "...lL...", "..LA....", ".AL.....", "LL......",
               "l.......", "........", "........", "........", "........"]
    j_back = ["...LL...", "Al.hH...", ".lLjH...", "..lhh...", "...lL...", "....lL..", ".....lL.",
              "......lL", ".......l", "........", "........", "........"]
    j_side = ["....", "....", "....", "....", "....", "....", "AAAA", "LLLL", "LGLL", "LLLL", "llll", "...."]
    j_left = ["L...", "....", "....", "....", "....", "....", "....", "....", "....", "....", "....", "...."]
    j_rows = [a + "|" + f + "|" + b[::-1] + "|" + c for a, f, b, c in zip(j_side, j_front, j_left, j_back)]
    arm = (["TTTT|TTT|TTTT|TTT", "MMMM|MMM|MMMM|MMM", "MuMM|MOM|MMuM|MuM", "MMMM|MMM|MMMM|MMM",
            "OOOO|OOO|OOOO|OOO", "uuuu|uuu|uuuu|uuu", "SSSS|SSS|SSSS|SSS", "SSSS|SSS|SSSS|SSS",
            "SSSs|SSS|sSSS|sSs", "LlLL|LAL|LLlL|LlL", "lLlL|LlL|lLlL|lLl", "SSSs|SSs|sSSS|sss"])
    sleeve = ["TTTT|TTT|TTTT|TTT", "tttt|ttt|tttt|ttt", EMPTY_ARM, EMPTY_ARM, "OOOO|OOO|OOOO|OOO"] + \
             [EMPTY_ARM] * 7
    leg = (["NNNN|NnNN|NNNN|NNNN"] * 2 + ["NNNN|NNnN|NNNN|NNNN", "NNNN|VVNN|NNNN|NNNN", "NNNN|NnNN|NNNN|NNNN",
           "NNNN|NnNN|NNNN|NNNN", "EEEE|EEEE|EEEE|EEEE", "BlBB|BlBB|BlBB|BBlB", "BBlB|BBlB|BBlB|BlBB",
           "BlBB|BlBB|BlBB|BBlB", "BBBB|BBBB|BBBB|BBBB", "bbbb|bbbb|bbbb|bbbb"])
    pants = ["TTTT|TtTT|TTTT|TTTT", "tttt|tttt|tttt|tttt"] + [EMPTY_LEG] * 4 + ["EEEE|EEEE|EEEE|EEEE"] + \
            [EMPTY_LEG] * 5
    parts = dict(h)
    parts.update({
        "body": {"strip": side_rows(side, front, back), "top": ["TTTTTTTT", "TTMMMMTT", "TMSSSSMT", "TTMSSMTT"],
                 "bottom": ["tttttttt"] * 4},
        "jacket": {"strip": j_rows, "top": ["......AL","......LA", "......AL", "......LA"], "bottom": blank(8, 4)},
    })
    parts.update(limbs(arm, sleeve, leg, pants))
    return {"name": "woodland_man", "materials": m, "legend": LEGEND, "parts": parts}


# ---------------------------------------------------------------- lady ("Highborn Lady")

def lady():
    m = {
        "skin": {"ramp": ramp("#6a4a58 #957080 #c49aa0 #e2bcb8 #f2d8d0 #fcefe8"), "base": 3, "run": 99},
        "hair": {"ramp": ramp("#0a0a12 #14141e #22222e #33354a #4a4e66 #6a7088"), "base": 2},
        "eye": eyes("#34404e", "#66788a", "#9aaab8", "#c48a8a", "#120e18", "#eebcbc"),
        "tunic": {"ramp": ramp("#4a4c62 #72768a #9ea2b0 #c4c8cc #e2e4e2 #fafaf4"), "base": 3},
        "plate": {"ramp": ramp("#3a4250 #5e6876 #8a96a0 #b4c0c4 #dae2e0 #fafcf8"), "base": 3},
        "gold": {"ramp": ramp("#4a2a12 #7a4a16 #a8761e #d2a22e #ecc84e #fff3a0"), "base": 3},
        "boot": {"ramp": ramp("#3a4250 #5e6876 #8a96a0 #b4c0c4 #dae2e0 #fafcf8"), "base": 2},
        "accent": {"ramp": ramp("#e4f6ff #9cc8e8 #5a8cb8"), "flat": True},
    }
    face = FACE_WOMAN
    circlet_f = ["________", "qq____qq", "__qXxq__"] + ["________"] * 5      # dips to a gem on the forehead
    circlet_s = ["________", "_____pqq"] + ["________"] * 6
    circlet_b = ["________", "pppppppp"] + ["________"] * 6
    h = head(face, FRINGE_CENTRE, TOP_CENTRE_PART, hat_front_extra=circlet_f, hat_side_extra=circlet_s,
             hat_back_extra=circlet_b)
    side = ["TTTT", "TTTT", "TtTT", "TtTT", "TtTT", "TTTT", "GGGG", "TTTT", "TtTT", "TtTT", "TtTT", "tttt"]
    front = ["TGSSSSGT", "TTGSSGTT", "TTTGGTTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "gGGYYGGg",
             "TTTGGTTT", "TTtGGtTT", "TtTYRTtT", "TtTTTTtT", "tTtTTtTt"]
    back = ["TTTTTTTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "gGGGGGGg",
            "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "TTtTTtTT", "tttttttt"]
    locks = ["Hj....jH", "jH....Hj", "Hh....hH", "jH....Hj", "Hh....hH", "jH....Hj", ".h....h.", ".e....e."] + \
            ["........"] * 4
    hair_fall = ["HjHJjHjH", "HjHHjHjH", "HhHjHHhH", "HjHhjHjH", "HhHjHHhH", "HjHHjHjH", "HhHjHhhH",
                 ".HjHHjH.", ".HhHjhH.", "..HjhH..", "...hh...", "........"]
    j_side = ["H..j", "h..H", "...h", "...H", "...h", "...H", "....", "...."] + ["...."] * 4
    j_rows = side_rows(j_side, locks, hair_fall)
    arm = (["TTTT|TTT|TTTT|TTT"] + ["TtTT|TTT|TTtT|TtT"] * 8 +
           ["GGGG|GYG|GGGG|GGG", "SSSS|SSS|SSSS|SSS", "SSSs|SSs|sSSS|sss"])
    sleeve = ["GGGG|GYG|....|GGG"] + [EMPTY_ARM] * 6 + ["TtTT|TTT|TTtT|TtT"] * 3 +              ["gGgG|GYG|GgGg|gGg", EMPTY_ARM]
    leg = ["TTtT|TtTT|TTtT|TTtT"] * 11 + ["GGGG|GYGG|GGGG|GGYG"]
    pants = [EMPTY_LEG] * 3 + ["TtTT|TTtT|TtTT|TtTT"] * 8 + ["gGgG|GYGg|GgGg|gGYG"]
    parts = dict(h)
    parts.update({
        "body": {"strip": side_rows(side, front, back), "top": ["TTTTTTTT", "TTTTTTTT", "TGSSSSGT", "TGSSSSGT"],
                 "bottom": ["TTtTTtTT"] * 4},
        "jacket": {"strip": j_rows, "top": ["HjHJjHjH", "H......H", "j......j", "H......H"], "bottom": blank(8, 4)},
    })
    parts.update(limbs(arm, sleeve, leg, pants, leg_top="TTTT", leg_bottom="pppp"))
    return {"name": "lady", "materials": m, "legend": LEGEND, "parts": parts}


# ---------------------------------------------------------------- lord ("Highborn Lord")

def lord():
    m = {
        "skin": {"ramp": ramp("#64464c #946666 #bc8a7c #d8a892 #eac4ae #f6dcc8"), "base": 3, "run": 99},
        "hair": {"ramp": ramp("#3a3a4c #5c5e70 #868a98 #b2b6bc #d6d8d6 #f4f4ee"), "base": 3},
        "eye": eyes("#2c3a52", "#4c6688", "#7c98b6", "#b47c74", "#2a2230", "#e0a898"),
        "tunic": {"ramp": ramp("#0c1814 #142620 #1e382a #2c4e38 #3e6646 #568058"), "base": 2},
        "plate": {"ramp": ramp("#3a4250 #5e6876 #8a96a0 #b4c0c4 #dae2e0 #fafcf8"), "base": 2},
        "cloak": {"ramp": ramp("#262a34 #3c4250 #5a6270 #7e8890 #a4aeb0 #cad2ce"), "base": 2},
        "gold": {"ramp": ramp("#4a2a12 #7a4a16 #a8761e #d2a22e #ecc84e #fff3a0"), "base": 3},
        "legs": {"ramp": ramp("#1c1e24 #2c3036 #40464c #565e62 #70787a #8e9694"), "base": 2},
        "boot": {"ramp": ramp("#16100e #281c18 #3c2a22 #54392c #6c4c3a #88644c"), "base": 2},
        "accent": {"ramp": ramp("#a8f0b8 #4ab070 #1e6a44"), "flat": True},
    }
    circlet_f = ["________", "gG____Gg", "__GXxG__"] + ["________"] * 5
    circlet_s = ["________", "_____gGG"] + ["________"] * 6
    circlet_b = ["________", "gggggggg"] + ["________"] * 6
    face = FACE_MAN
    h = head(face, FRINGE_CENTRE, TOP_CENTRE_PART, hat_front_extra=circlet_f, hat_side_extra=circlet_s,
             hat_back_extra=circlet_b)
    side = ["DCTT", "CcTT", "CcTt", "CcTT", "CcTt", "CcTT", "CcTT", "CcGG", "CcTT", "CcTt", "CcTT", "ccTt"]
    front = ["TGPPPPGT", "TGPqqPGT", "TtGPPGtT", "TtGPPGtT", "TtGPPGtT", "TtGPPGtT", "TtGPPGtT",
             "gGGYYGGg", "TtGPPGtT", "TtGPPGtT", "TtGPPGtT", "ttGppGtt"]
    back = ["DDDDDDDD", "CcCCcCcC", "CcCCcCcC", "CcCCcCcC", "CcCCcCcC", "CcCCcCcC", "CcCCcCcC",
            "CcCCcCcC", "CcCCcCcC", "CcCCcCcC", "GgGYGgGG", "gggggggg"]
    locks = ["Hj....jH", "jH....Hj", "Hh....hH", ".j....j.", "........"] + ["........"] * 7
    hair_fall = ["jHjJjjHj", "HjHHjHjH", "HhHjHHhH", ".HjHHjH.", "..HhhH..", "...hh..."] + ["........"] * 6
    j_side = ["Y..j", "...H", "...h"] + ["...."] * 9
    j_rows = side_rows(j_side, locks, hair_fall)
    arm = (["TTTT|TTT|TTTT|TTT"] + ["TtTT|TTT|TTtT|TtT"] * 7 +
           ["GGGG|GYG|GGGG|GGG", "PPPP|PPP|PPPP|PPP", "SSSS|SSS|SSSS|SSS", "SSSs|SSs|sSSS|sss"])
    sleeve = [EMPTY_ARM] * 6 + ["TtTT|TTT|TTtT|TtT"] * 2 + ["GgGG|GYG|GGgG|GgG", EMPTY_ARM, EMPTY_ARM, EMPTY_ARM]
    # long robe to mid-calf, opening between the legs (inner columns), boots below
    leg = (["TtTT|TtGP|PPPP|TTtT"] * 7 + ["gGgG|GGGG|GgGg|gGgG",
            "EEEE|EGEE|EEEE|EEEE", "BBBB|BbBB|BBBB|BBBB", "BBBB|BBBB|BBBB|BBBB", "bbbb|bbbb|bbbb|bbbb"])
    pants = [EMPTY_LEG] * 3 + ["TtTT|TtG.|....|TTtT"] * 4 + ["gGgG|GYG.|....|gGYG"] + [EMPTY_LEG] * 4
    parts = dict(h)
    parts.update({
        "body": {"strip": side_rows(side, front, back), "top": ["DDDDDDDD", "DDTTTTDD", "TGSSSSGT", "TGPPPPGT"],
                 "bottom": ["TTtPPtTT"] * 4},
        "jacket": {"strip": j_rows, "top": ["jHHHHHHj", "H......H", "D......D", "Y......Y"], "bottom": blank(8, 4)},
    })
    parts.update(limbs(arm, sleeve, leg, pants, leg_top="TTTT"))
    return {"name": "lord", "materials": m, "legend": LEGEND, "parts": parts}


SKINS = [warden_woman, warden_man, woodland_woman, woodland_man, lady, lord]
SERIALIZE = "Lothlorien"          # skin pack id; localization keys skinpack.<id> and skin.<id>.<name>


def write_pack_files(skins):
    """skins.json only. Names live in localization/catalog.json (keys skinpack.<id>, skin.<id>.<name>);
    `mods localize build lothlorien` writes texts/. The manifest is hand-kept (fixed UUIDs)."""
    entries = [{"localization_name": s["name"], "geometry": "geometry.humanoid.customSlim",
                "texture": s["name"] + ".png", "type": "free"} for s in skins]
    data = {"skins": entries, "serialize_name": SERIALIZE, "localization_name": SERIALIZE}
    write(PACK / "skins.json", json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def write(path, text):
    path.write_text(text, encoding="utf-8", newline="\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(PACK))
    ap.add_argument("--only")
    ap.add_argument("--suffix", default="")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    skins = [make() for make in SKINS]
    for skin in skins:
        if args.only and skin["name"] != args.only:
            continue
        img = paint(skin)
        path = out / "{}{}.png".format(skin["name"], args.suffix)
        img.save(path)
        print(path)
    if out.resolve() == PACK.resolve() and not args.suffix:
        write_pack_files(skins)


if __name__ == "__main__":
    main()
