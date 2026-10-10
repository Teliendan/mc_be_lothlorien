"""Lothlorien banner: repaints two rarely used vanilla banner patterns as a mallorn.

Bedrock has no data-driven banner patterns, so the mod overrides the vanilla Globe pattern
(golden crown with two elanor stars) and Snout pattern (silver trunk) in its resource pack.
The loom, shields and banner copying then work exactly like vanilla.
Suggested banner: base banner + Mallorn Trunk (white) + Mallorn Crown (yellow).
Writes RP/textures/entity/banner/banner_{globe,piglin}.png and shield_patterns/{globe,piglin}.png.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "lothlorien_rp" / "textures" / "entity"

# Banner face 20x40. '#' = pixel. Crown (with elanor stars) and trunk are separate patterns.
CROWN = """
..........
.......##.
....###.##
...######.
..###.###.
.#####.###
.###.#####
.#####.##.
.####.###.
..######.#
.###.###.#
.#####.##.
.####.###.
..######.#
.###.###..
..####.##.
...##..##.
........#.
..........
..........
..........
...#......
.#####....
..###.....
..#.#.....
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
"""

TRUNK = """
..........
..........
..........
...#......
....#.....
.....#....
......#..#
..#....#.#
...##...##
.....##..#
.......#.#
........##
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
.........#
........##
.......###
.....##.##
...##...#.
..........
..........
..........
..........
..........
..........
..........
"""

SHIELD_CROWN = """
.....
...##
.####
###.#
.####
##.##
.###.
..#..
.....
.....
.#...
.....
.....
.....
.....
.....
.....
.....
.....
.....
"""

SHIELD_TRUNK = """
.....
.....
....#
..#.#
...##
....#
....#
....#
....#
....#
....#
....#
....#
....#
...##
..#.#
.....
.....
.....
.....
"""

HI, MID, LO = 255, 236, 212  # pattern shades; the game multiplies them by the dye colour


def grid(text):
    rows = [r + r[::-1] for r in text.strip("\n").split("\n")]  # left half, mirrored
    return [[c == "#" for c in r] for r in rows]


def shaded(mask):
    h, w = len(mask), len(mask[0])
    out = {}
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            up = y > 0 and mask[y - 1][x]
            down = y < h - 1 and mask[y + 1][x]
            left = x > 0 and mask[y][x - 1]
            out[(x, y)] = HI if not up or not left else (LO if not down else MID)
    return out


def banner_texture(mask):
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = im.load()
    for (x, y), v in shaded(mask).items():
        px[1 + x, 1 + y] = (v, v, v, 255)
        px[22 + (19 - x), 1 + y] = (v, v, v, 255)  # back face is the mirrored front
    return im


def shield_texture(mask):
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = im.load()
    for (x, y), v in shaded(mask).items():
        px[2 + x, 2 + y] = (v, v, v, 255)
    return im


def main():
    crown, trunk = grid(CROWN), grid(TRUNK)
    # Branches show through the crown: carve the trunk out of it.
    crown = [[c and not t for c, t in zip(cr, tr)] for cr, tr in zip(crown, trunk)]
    assert len(crown) == 40 and all(len(r) == 20 for r in crown)
    s_crown, s_trunk = grid(SHIELD_CROWN), grid(SHIELD_TRUNK)
    s_crown = [[c and not t for c, t in zip(cr, tr)] for cr, tr in zip(s_crown, s_trunk)]
    assert len(s_crown) == 20 and all(len(r) == 10 for r in s_crown)
    (OUT / "banner").mkdir(parents=True, exist_ok=True)
    (OUT / "shield_patterns").mkdir(parents=True, exist_ok=True)
    banner_texture(crown).save(OUT / "banner" / "banner_globe.png")
    banner_texture(trunk).save(OUT / "banner" / "banner_piglin.png")
    shield_texture(s_crown).save(OUT / "shield_patterns" / "globe.png")
    shield_texture(s_trunk).save(OUT / "shield_patterns" / "piglin.png")


if __name__ == "__main__":
    main()
