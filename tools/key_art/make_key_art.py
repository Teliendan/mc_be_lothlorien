"""Rebuild the Lothlorien key art: the pack icon (512x512) and the promo banner (1920x1080 + 1280x720).

    python -B mods/lothlorien/tools/key_art/make_key_art.py [icon] [banner]     (run from the workspace root)

Writes into temp/key_art/: pack_icon_512.png, promo_banner_1920.png, promo_banner_1280.png (plus the render
buffers). Installing is a copy: pack_icon_512.png -> lothlorien_bp/ and lothlorien_rp/ pack_icon.png; the banner
and logo live in docs/media/. Everything is the mod's real geometry and textures: the village is assembled from its
.mcstructure pieces by their jigsaws and sunk like worldgen (start_height -17; giant Mallorns -5); the ordinary
forest approximates the fancy/simple/mega tree features. Night grading, fog, glow, fireflies, stars and the moon
are post-processing (grade.py). Design and owner decisions: docs/GRAPHICS_TASKS.md ("Pack icon", "Promo banner").
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

KA = 'mods/lothlorien/tools/key_art'
W = Path('temp/key_art')

NIGHT = {"blocklight": 1.0, "sky_top": "#0b1f2c", "sky_low": "#2a6370", "fog": "#183a3a", "moon": "#8aa49a",
         "moon_ent": "#e6edf5", "sat": 1.45, "fog_start": 250, "fog_k": 1300, "fog_k_hero": 2600, "fog_max": 0.75,
         "glow_gain": 1.7, "halo1": 1.0, "halo2": 0.8, "halo3": 0.6, "halo3_r": 70, "ffh1": 2.0, "ffh2": 1.4, "ffh3": 0.6}

ICON = {"eye": [960, 28, 64], "dir": [290, 7], "fov": 56, "deer_at": [0.3, 0.93], "size": 1024}
ICON_GRADE = dict(NIGHT, ff_box=[34, 58, 0.5, 8, -18, 30], ff_n=24, ff_seed=8, stars=160)

BANNER = {"aspect": 1.7778, "size": 1080, "eye": [1260, 10, 330], "dir": [270, 17], "fov": 50, "deer_at": [0.24, 0.96],
          "deer_dist": 11, "clear_dist": 11, "warden_at": [0.67, 17], "warden_yaw": 235,
          # fourth village piece on the central Mallorn's north connector, turned 180 degrees as the jigsaw does
          "extra": [["far", "village/combo_tower_c_north_bridge_9.mcstructure", 2, -17, -22, 180],
                    ["far", "village/crown_medium.mcstructure", 2, 31, -24]],
          "giants": [["mallorn_roundplain_02.mcstructure", 0.04, 120], ["mallorn_roundplain_06.mcstructure", 0.4, 150],
                     ["mallorn_roundplain_03.mcstructure", 0.97, 110], ["mallorn_round_07.mcstructure", 0.75, 170]],
          "vtrunks": [[11, 11], [7, 42], [5, 63], [10, -15]], "edge": [["fancy", -0.06, 16], ["mega", 1.06, 20]],
          # elves inside the railings (elfspots.py), each doing something (owner: alive, not a school photo)
          "elves": [["healer", [21, 18, 9], 270, {"waist": [10, 0, 0], "rightArm": [-65, 0, 0], "leftArm": [-65, 0, 0], "head": [25, 35, 0]}],
                    ["gardener", [17, 18, -15], 330, {"rightArm": [-45, 0, 10], "head": [0, -15, 0]}],
                    ["loremaster", [17, 18, -17], 210, {"leftArm": [-15, 0, 0], "head": [-5, 10, 0]}],
                    ["lamplighter", [19, 26, 11], 300, {"rightArm": [-165, 0, 0], "head": [-35, 0, 0]}],
                    ["woodwright", [7, 20, 28], 0, {"rightLeg": [25, 0, 0], "leftLeg": [-25, 0, 0], "rightArm": [-20, 0, 0], "leftArm": [20, 0, 0]}],
                    ["loremaster", [14, 26, 45], 250, {"head": [-30, 0, 0], "rightArm": [0, 0, 5], "leftArm": [0, 0, -5]}],
                    ["gardener", [13, 18, 39], 180, {"waist": [25, 0, 0], "rightArm": [-50, 0, 0], "leftArm": [-45, 0, 0], "head": [20, 0, 0]}]]}
BANNER_GRADE = dict(NIGHT, ff_box=[34, 64, 0.5, 8, -15, 45], ff_n=28, ff_seed=8, stars=600, ff_avoid=True,
                    moon_at=[0.191, 0.086, 0.17])


def run(*args, out=None):
    r = subprocess.run([sys.executable, '-B', *args], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr)
    if out:
        Path(out).write_text(r.stdout, encoding='utf-8')
    return r.stdout


def main(which):
    W.mkdir(parents=True, exist_ok=True)
    if 'icon' in which:
        run(f'{KA}/layout.py', 'icon', json.dumps(ICON), out=W / 'icon.json')
        print(run(f'{KA}/render.py', str(W / 'icon.json')).strip()[:60])
        run(f'{KA}/grade.py', 'icon', json.dumps(ICON_GRADE))
        Image.open(W / 'icon_graded.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(W / 'pack_icon_512.png')
    if 'banner' in which:
        run(f'{KA}/banner.py', 'banner', json.dumps(BANNER))
        print(run(f'{KA}/render.py', str(W / 'banner.json')).strip()[:60])
        run(f'{KA}/grade.py', 'banner', json.dumps(BANNER_GRADE))
        im = Image.open(W / 'banner_graded.png').convert('RGB')
        im.save(W / 'promo_banner_1920.png')
        im.resize((1280, 720), Image.LANCZOS).save(W / 'promo_banner_1280.png')


if __name__ == '__main__':
    main(sys.argv[1:] or ['icon', 'banner'])
