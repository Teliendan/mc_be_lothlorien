"""Author/export the swan's one-shot shake through the running Blockbench MCP.

Run from the workspace: python -B mods/lothlorien/tools/make_swan_shedding.py
The original model and all other animations are preserved. Preview frames and
the editable Blockbench project go to temp/swan-shedding for owner review.
"""
import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MOD = ROOT / 'mods/lothlorien'
RP = MOD / 'lothlorien_rp'
OUT = ROOT / 'temp/swan-shedding'
sys.path.insert(0, str(ROOT / '.claude/skills/bedrock-art/scripts'))
from bb_render import js, tool


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    geo = json.loads((RP / 'models/entity/swan.geo.json').read_text())
    geo['minecraft:geometry'][0]['description']['identifier'] = 'geometry.lothlorien.swan_shake_author'
    texture = base64.b64encode((RP / 'textures/entity/swan/swan.png').read_bytes()).decode()
    project = js('(() => { const before = Project ? Project.uuid : null; '
                 'loadModelFile({path:"C:/mcmods/temp/swan-shedding/swan_shake_author.geo.json",content:' +
                 json.dumps(json.dumps(geo)) + '}); '
                 'const t = new Texture({name:"swan.png"}).fromDataURL(' +
                 json.dumps('data:image/png;base64,' + texture) + ').add(false); '
                 'Undo.initEdit({elements:Cube.all}); '
                 'Cube.all.forEach(c=>Object.values(c.faces).forEach(f=>f.texture=t.uuid)); '
                 'Undo.finishEdit("Apply swan preview texture"); Canvas.updateAll(); '
                 'return {uuid:Project.uuid,before}; })()')
    view = 'swan_shedding'
    try:
        tool('set_mode', {'mode_id': 'animate'})
        times = [0, .16, .28, .40, .52, .64, .76, .90, 1.10, 1.35]
        rolls = [0, 6, -8, 8, -7, 6, -4, 2, 0, 0]
        lifts = [0, 12, 19, 16, 18, 13, 10, 5, 0, 0]
        bones = {name: [] for name in ['body', 'neck', 'neck_up', 'tail', 'wing_l', 'wing_r']}
        for t, roll, lift in zip(times, rolls, lifts):
            poses = {
                'body': [0, roll * .25, roll],
                'neck': [-lift * .15, -roll * .35, -roll * .55],
                'neck_up': [lift * .10, roll * .50, -roll * .20],
                'tail': [lift * .20, -roll * .6, roll * .35],
                'wing_l': [-lift * .15, 0, lift],
                'wing_r': [-lift * .15, 0, -lift],
            }
            for name, rotation in poses.items():
                bones[name].append({'time': t, 'rotation': rotation})
        tool('create_animation', {'name': 'animation.lothlorien.swan.shake',
                                 'loop': False, 'animation_length': 1.35, 'bones': bones})
        for name in bones:
            tool('animation_graph_editor', {'bone_name': name, 'channel': 'rotation', 'action': 'smooth'})
        compiled = js('Animation.selected.compileBedrockAnimation()')
        assert compiled['animation_length'] == 1.35
        assert compiled.get('loop', False) is False
        assert set(compiled['bones']) == set(bones)
        path = RP / 'animations/swan.animation.json'
        newline = '\r\n' if b'\r\n' in path.read_bytes() else '\n'
        content = json.loads(path.read_text())
        content['animations']['animation.lothlorien.swan.shake'] = compiled
        path.write_text(json.dumps(content, indent=2) + '\n', encoding='utf-8', newline=newline)
        editable = js('Codecs.project.compile()')
        (OUT / 'swan_shake.bbmodel').write_text(
            editable if isinstance(editable, str) else json.dumps(editable), encoding='utf-8')
        tool('create_offscreen_view', {'id': view, 'width': 512, 'height': 512,
                                      'antialias': False, 'copy_view': 'none'})
        tool('set_camera_angle', {'view': view, 'position': [27, 20, -34],
                                  'target': [0, 9, -2], 'projection': 'orthographic'})
        frames = []
        for i, time in enumerate([0, .16, .28, .40, .52, .64, .76, .90, 1.1, 1.35]):
            tool('animation_timeline', {'action': 'set_time', 'time': time})
            result = tool('capture_screenshot', {'view': view})
            frame = next(c for c in result['content'] if c['type'] == 'image')
            path = OUT / f'shake_{i:02}.png'
            path.write_bytes(base64.b64decode(frame['data']))
            frames.append(path)
        from PIL import Image, ImageDraw
        sheet = Image.new('RGB', (512 * 5, 540 * 2), '#555b65')
        draw = ImageDraw.Draw(sheet)
        for i, path in enumerate(frames):
            with Image.open(path) as frame:
                sheet.paste(frame, ((i % 5) * 512, (i // 5) * 540))
            draw.text(((i % 5) * 512 + 12, (i // 5) * 540 + 518),
                      f'{[0, .16, .28, .40, .52, .64, .76, .90, 1.1, 1.35][i]:.2f}s', fill='white')
        sheet.save(OUT / 'shake_sheet.png')
        print('Exported Blockbench shake; preview: temp/swan-shedding/shake_sheet.png')
    finally:
        try:
            tool('delete_offscreen_view', {'view': view})
        except SystemExit:
            pass  # creation may have failed; preserve the original error
        finally:
            js('(() => { const p=ModelProject.all.find(p=>p.uuid===' + json.dumps(project['uuid']) +
               '); if(p)p.close(true); const before=ModelProject.all.find(p=>p.uuid===' +
               json.dumps(project['before']) + '); if(before)before.select(); return true; })()')


if __name__ == '__main__':
    main()
