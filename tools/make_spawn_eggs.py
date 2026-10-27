"""Generates the spawn egg icons in the current vanilla style (one drawn egg per mob, Bedrock 1.21.70+).

    python -B mods/lothlorien/tools/make_spawn_eggs.py [--sheet]

Output (overwritten every run): lothlorien_rp/textures/items/spawn_eggs/spawn_egg_<mob>.png and their
`lothlorien:spawn_egg_<mob>` entries in lothlorien_rp/textures/item_texture.json. The client entities bind them with
`"spawn_egg": {"texture": "lothlorien:spawn_egg_<mob>"}` (written by hand, or by make_elves.py, make_elven_warden.py and
make_unicorn.py). --sheet writes a review sheet with vanilla eggs to temp/spawn_eggs/.

Method, read off the vanilla eggs (reference/vanilla/current/resource_packs/vanilla_1.21.70/textures/items/spawn_eggs):
the same 12x14 egg outline for every mob, painted as the mob's head or body, with ears, horns or wings breaking the
outline. Here a shell is shaded by rule (ellipsoid normal, light from the top-left: highlight, light, mid, shadow; outline
lighter at the top-left than at the bottom-right) in the mob's own colour ramps (from its texture generator), and each mob
adds a 16x16 character grid of features. Grid characters: '.' keeps the shell (or stays clear outside it), '_' clears a
shell pixel, a key of the mob's `mats` paints that material with the shell's shading level, a key of `cols` paints a
fixed colour.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

MOD = Path(__file__).resolve().parents[1]
RP = MOD / "lothlorien_rp"
WS = MOD.parents[1]
OUT = RP / "textures/items/spawn_eggs"
CLEAR = (0, 0, 0, 0)

# the vanilla egg outline: row -> (first, last) column
EGG = {1: (6, 9), 2: (5, 10), 3: (4, 11), 4: (3, 12), 5: (3, 12), **{y: (2, 13) for y in range(6, 12)},
       12: (3, 12), 13: (4, 11), 14: (5, 10)}
LIGHT = (-0.55, -0.6, 0.58)  # towards the viewer's top-left


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def ramp(hexes):
    """Six shades, darkest first: outline (bottom-right), outline (top-left), shadow, mid, light, highlight."""
    out = [hexc(c) for c in hexes.split()]
    assert len(out) == 6, hexes
    return out


def in_egg(x, y):
    return y in EGG and EGG[y][0] <= x <= EGG[y][1]


def shade_level(x, y):
    """0-5 index into a ramp: the egg's outline and shading; outside the egg (ears, wings) the same light, no outline."""
    edge = in_egg(x, y) and any(not in_egg(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    nx, ny = (x - 7.5) / 6.4, (y - 8.0) / 7.4
    r = math.hypot(nx, ny)
    if r > 1:
        nx, ny = nx / r, ny / r
    nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
    lx, ly, lz = LIGHT
    d = (nx * lx + ny * ly + nz * lz) / math.sqrt(lx * lx + ly * ly + lz * lz)
    if edge:
        return 1 if d > 0.15 else 0
    return 5 if d > 0.86 else 4 if d > 0.62 else 3 if d > 0.3 else 2


def paint(egg):
    img = Image.new("RGBA", (16, 16), CLEAR)
    grid = egg["grid"]
    assert len(grid) == 16 and all(len(r) == 16 for r in grid), egg["name"]
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            lvl = shade_level(x, y)
            if ch == ".":
                if in_egg(x, y):
                    img.putpixel((x, y), egg["mats"]["."][lvl])
            elif ch == "_":
                pass
            elif ch in egg["mats"]:
                img.putpixel((x, y), egg["mats"][ch][lvl])
            elif ch in egg["cols"]:
                img.putpixel((x, y), egg["cols"][ch])
            else:
                raise ValueError(f"{egg['name']}: unknown grid character {ch!r} at {x},{y}")
    return img


# ---- palettes (ramps taken from the mobs' own generators, extended to six shades) ----
DEER = ramp("#3f2a26 #5e3d2c #80573a #a27446 #c79a5e #d9b274")          # make_deer.py COAT
DEER_PALE = ramp("#8a7458 #a8906f #c9b48f #e4d6b8 #f4ecd8 #fbf6ea")     # make_deer.py BELLY
WDEER = ramp("#7f8798 #a6adbb #c9cfd9 #e3e7ee #f7f8fb #ffffff")         # make_deer.py WHITE_PALETTE
WDEER_PALE = ramp("#a6adbb #c9cfd9 #e3e7ee #f2f4f8 #fbfbfd #ffffff")
PEARL = ramp("#8e8a9e #b4b0c4 #d8d4e4 #ece9f3 #f8f6fb #ffffff")         # unicorn coat, tinted pearl
MUZZLE = ramp("#8e7f8e #ad9cab #c9b8c6 #dccbd8 #e8dae4 #f2e8ef")       # unicorn muzzle, pink-grey
LILAC = ramp("#4e3a72 #6a5296 #8a72b8 #a890d2 #c6b2e6 #e2d6f6")         # unicorn mane
SWAN = ramp("#8a90a6 #aab0c4 #c8cddc #e2e6f0 #f4f6fa #ffffff")          # make_swan_squirrel.py WHITE
SQ = ramp("#2e1c12 #432a1c #5e3c26 #7c5232 #9a6c42 #b4844f")            # squirrel_brown back
SQ_TAIL = ramp("#432a1c #5e3c26 #7c5232 #9a6c42 #b88c58 #c8a070")    # squirrel_brown tail, a shade lighter than the back
SQ_BELLY = ramp("#8a7050 #b89870 #d2b98e #e6d3ac #f0e4c4 #f8f0dc")
SONG = ramp("#1f3a66 #2c4f86 #3f78b0 #5a9ad0 #7ab8e6 #a4d4f4")         # songbird blue back
SONG_CAP = ramp("#1a2e52 #22406e #2c4f86 #3a68a0 #4a7cb6 #5a9ad0")
SONG_BELLY = ramp("#8ea4ba #b8c8d8 #d4e2ee #e8f2f8 #f6fbfe #ffffff")
BFLY = ramp("#12246e #1a3490 #2c58c8 #3670f0 #5a8ef6 #86acfa")          # butterfly blue wings
FLY = ramp("#2a1c14 #3e2a1c #5a3e28 #765434 #906a42 #a88250")           # firefly brown body
GLOW = ramp("#8aa830 #b4d24a #c8e846 #e2f66e #f2ff9e #fbffd0")
HAIR_DARK = ramp("#140d0a #1f1510 #33231a #4d3626 #6b4e37 #7f5e44")      # make_elves.py gardener HAIR
MOSS = ramp("#1f2818 #2f3b22 #44562f #5f7640 #7d9654 #a2b66f")          # gardener tunic
SKIN = ramp("#8a6a58 #a98672 #c9a58f #e2c6ae #f1ddc9 #f8ecdf")           # make_elven_warden.py SKIN
CLOAK = ramp("#1c2820 #27352c #35483a #46604a #5d7857 #7a9370")          # make_elven_warden.py CLOAK
FAIR = ramp("#5e4c28 #7b6538 #a58c4f #cfb878 #ead9a2 #f6ecc8")           # make_elven_warden.py HAIR


def flat(c):
    return [c] * 6


def darker(r):
    """The same ramp one shade darker (for a stripe or a shaded patch on the shell)."""
    return [r[0]] + r[:-1]


DEER_GRID = [".t..t......t..t.",
             ".a..a......a..a.",
             "..aaA......Aaa..",
             "....Aa....aA....",
             ".oo....ff.....oo",
             "oii....ff....iio",
             ".o.....ff.....o.",
             "....s......s....",
             "...ws......sw...",
             "................",
             "......mmmm......",
             "......mmmm......",
             ".......nn.......",
             ".......NN.......",
             "................",
             "................"]

EGGS = [
    dict(name="deer", mats={".": DEER, "m": DEER_PALE, "f": darker(DEER)},
         cols={"a": hexc("#8a6444"), "A": hexc("#6e4a33"), "t": hexc("#e0cfa4"), "o": hexc("#4a342b"),
               "i": hexc("#b98870"), "s": hexc("#120b09"), "g": hexc("#4a342b"), "w": hexc("#e4d6b8"),
               "n": hexc("#1f1513"), "N": hexc("#4a342b")},
         grid=DEER_GRID),
    dict(name="white_deer", mats={".": WDEER, "m": WDEER_PALE, "f": darker(WDEER)},
         cols={"a": hexc("#c4ae80"), "A": hexc("#a8906a"), "t": hexc("#fbf5e4"), "o": hexc("#8a919f"),
               "i": hexc("#e8b8c3"), "s": hexc("#2a2430"), "g": hexc("#6a6070"), "w": hexc("#ffffff"),
               "n": hexc("#7a4e5c"), "N": hexc("#b0788a")},
         grid=DEER_GRID),
    dict(name="unicorn", mats={".": PEARL, "q": PEARL, "l": LILAC, "m": MUZZLE},
         cols={"H": hexc("#fff4d0"), "h": hexc("#d6bc80"), "k": hexc("#6e5a3e"), "i": hexc("#e2b4c8"),
               "e": hexc("#2a2238"), "n": hexc("#6e5e72")},
         grid=["..q.....H....q..",
               ".qiq...kHh..qiq.",
               ".qiq..khHk..qiq.",
               ".qq...kHhk...qq.",
               "......llll......",
               ".....llllll.....",
               "......l..l......",
               "...e........e...",
               "...e........e...",
               "................",
               ".....mmmmmm.....",
               "....mnmmmmnm....",
               "....mmmmmmmm....",
               ".....mmmmmm.....",
               "................",
               "................"]),
    dict(name="swan", mats={".": SWAN, "w": darker(darker(SWAN))},
         cols={"k": hexc("#2a2530"), "K": hexc("#14111a"), "b": hexc("#f08c3c"), "B": hexc("#d8642a"),
               "c": hexc("#f8b25a"), "e": hexc("#0b090c")},
         grid=["................",
               "................",
               "................",
               "................",
               "................",
               "..KK............",
               "cbbkke..........",
               ".bBk............",
               "..B.............",
               "................",
               "................",
               "........ww......",
               ".....ww...ww....",
               "......www..w....",
               "................",
               "................"]),
    dict(name="songbird", mats={".": SONG, "c": SONG_CAP, "w": SONG_BELLY, "v": darker(SONG_CAP)},
         cols={"b": hexc("#e69a3c"), "B": hexc("#c8782a"), "e": hexc("#0e0b0c"), "g": hexc("#e4f2fc"),
               "V": hexc("#2c4f86"), "F": hexc("#a4d4f4")},
         grid=["......cc........",
               "......cccc......",
               ".....cccccc.....",
               "....cccccccc....",
               "................",
               "................",
               "....ge....eg....",
               ".......bb.......",
               ".......B........",
               ".....wwwwww.....",
               "VV..wwwwwwww..VV",
               ".VVvwwwwwwwwvVV.",
               "..FVwwwwwwwwVF..",
               "....wwwwwwww....",
               ".....wwwwww.....",
               "................"]),
    dict(name="squirrel", mats={".": SQ, "m": SQ_BELLY, "T": SQ_TAIL, "c": darker(darker(darker(SQ_TAIL)))},
         cols={"o": hexc("#432a1c"), "i": hexc("#b87c74"), "e": hexc("#0a0708"), "g": hexc("#f0e4c4"),
               "n": hexc("#1c1214"), "t": hexc("#dcb888")},
         grid=["........tTTTTt..",
               "....oo.tTTTTTTt.",
               "...oio.TTcccTTTt",
               "....o..cc...cTTt",
               "............cTTt",
               "...ge.......cTTt",
               "...ee........cTt",
               ".mmm.........cTt",
               "nmmm........cTTt",
               ".mmmm.......cTTt",
               "..mmmm.....cTTt.",
               "..mmmmm...cTTTt.",
               "...mmmmm.cTTTt..",
               "....mmmmcTTTt...",
               ".....mm.........",
               "................"]),
    dict(name="butterfly", mats={".": ramp("#16111a #241c26 #342a36 #463a46 #5a4c58 #6e5e6a"), "W": BFLY},
         cols={"k": hexc("#181214"), "p": hexc("#3e302c"), "w": hexc("#e6f0ff"), "K": hexc("#12183a")},
         grid=["...p........p...",
               "KKKKk......kKKKK",
               "KwWWWK....KWWWwK",
               "KWWWWWK..KWWWWWK",
               ".KWWWWK..KWWWWK.",
               "..KWWWK..KWWWK..",
               "...KKK....KKK...",
               "................",
               "...KK......KK...",
               "..KWWK....KWWK..",
               "..KWWWK..KWWWK..",
               "..KWwWK..KWwWK..",
               "...KKKK..KKKK...",
               "................",
               "................",
               "................"]),
    dict(name="firefly", mats={".": FLY, "G": GLOW},
         cols={"k": hexc("#2a1e16"), "p": hexc("#4e3a2a"), "v": hexc("#dce6ea"), "W": (220, 235, 240, 140),
               "C": hexc("#fbffd0")},
         grid=["....p......p....",
               ".....k....k.....",
               "................",
               ".vv..........vv.",
               "vWWv........vWWv",
               "vWWv........vWWv",
               ".vv..........vv.",
               "................",
               "................",
               "................",
               "...GGGGGGGGGG...",
               "..GGGGGGGGGGGG..",
               "...GGGCCCCGGG...",
               "....GGCCCCGG....",
               ".....GGGGGG.....",
               "................"]),
    dict(name="elf", mats={".": HAIR_DARK, "f": SKIN, "M": MOSS, "L": ramp("#1f3a1e #2c4a2a #3f6b38 #5f8f4c #86b46a #a8d088")},
         cols={"E": hexc("#e2c6ae"), "Q": hexc("#c9a58f"), "e": hexc("#5b7a4a"), "W": hexc("#f6efe6"),
               "n": hexc("#c9a58f"), "m": hexc("#a98672"), "F": hexc("#f6efc5")},
         grid=["................",
               "................",
               "................",
               "....LLFLLLLL....",
               "................",
               ".....ffffff.....",
               ".E...ffffff...E.",
               ".QE..WeffeW..EQ.",
               "..QE.ffnnff.EQ..",
               ".....ffffff.....",
               ".....ffmmff.....",
               ".....ffffff.....",
               "...MMMMMMMMMM...",
               "....MMMMMMMM....",
               ".....MMMMMM.....",
               "................"]),
    dict(name="elven_warden", mats={".": CLOAK, "h": FAIR, "f": SKIN, "F": darker(darker(SKIN)), "R": darker(darker(CLOAK))},
         cols={"e": hexc("#4a6f86"), "W": hexc("#eef3f5"), "n": hexc("#c9a58f"), "m": hexc("#a98672"),
               "S": hexc("#bdc8ce"), "s": hexc("#5f6c75"), "T": hexc("#eef3f5")},
         grid=["................",
               "................",
               "................",
               "................",
               "....RRRRRRRR....",
               "...RhhhRRhhhR...",
               "...RhFFFFFFhR...",
               "...RhWefefWhR...",
               "...Rhffnnffh....",
               "....hffffffh....",
               "....hffmmffh....",
               ".....hffffh.....",
               "......hhhh......",
               ".......TS.......",
               ".......ss.......",
               "................"]),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tex_json = RP / "textures/item_texture.json"
    data = json.loads(tex_json.read_text(encoding="utf-8"))
    paths = []
    for egg in EGGS:
        img = paint(egg)
        path = OUT / f"spawn_egg_{egg['name']}.png"
        img.save(path)
        paths.append(path)
        data["texture_data"][f"lothlorien:spawn_egg_{egg['name']}"] = {"textures": f"textures/items/spawn_eggs/spawn_egg_{egg['name']}"}
    with open(tex_json, "w", encoding="utf-8", newline="\n") as f:  # LF, as stored (.gitattributes: -text)
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(EGGS)} eggs -> {OUT.relative_to(MOD)}")
    if "--sheet" in sys.argv:
        import subprocess
        van = WS / "reference/vanilla/current/resource_packs/vanilla_1.21.70/textures/items/spawn_eggs"
        refs = [str(van / f"spawn_egg_{n}.png") for n in ("goat", "horse", "fox", "rabbit", "chicken", "parrot", "bee",
                                                         "wandering_trader", "pillager")]
        out = WS / "temp/spawn_eggs/sheet.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-B", str(WS / ".claude/skills/bedrock-art/scripts/icon_sheet.py"), str(out),
                        *map(str, paths), "--ref", *refs], check=True)


if __name__ == "__main__":
    main()
