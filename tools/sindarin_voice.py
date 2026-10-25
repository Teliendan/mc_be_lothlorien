"""Generate Sindarin voice takes with the approved actor, cut them and build an audition page.

Run with the existing Chatterbox environment (cached weights, offline, no downloads):

    E:/AI/audio/venvs/chatterbox/Scripts/python.exe -B mods/lothlorien/tools/sindarin_voice.py JOBS.json temp/<feature>/

JOBS.json:
    {"title": "Sindarin Voice Retakes", "intro": "What to judge on this page.",
     "lines": [{"id": "suilad", "sindarin": "Suilad.", "english": "Greetings.",
                "pool": "opening_neutral", "text": "Súilad.", "language": "es",
                "guide": "gentle", "preset": "gentle", "seeds": [19102026, 19102027],
                "listen": "SUI as one falling sound, then -lad."}]}

"guide" names a recording in GUIDES, "preset" a setting in PRESETS; "params" may
override single settings. Writes <id>_<n>_raw.wav (untouched), <id>_<n>.wav (cut and
levelled), results.json and listen.html. Publish listen.html as an artifact with the
db capability; verdicts land in its "verdicts" collection. Workflow, respelling rules
and the approved set: docs/SINDARIN_VOICE.md.
"""
from pathlib import Path
import base64
import html
import io
import json
import os
import random
import sys
import time

MOD = Path(__file__).absolute().parents[1]
VOICE = MOD / "tools/audio/sindarin_voice"
CHECKPOINT = ("E:/AI/hf_cache/hub/models--ResembleAI--chatterbox/snapshots/"
              "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18")
GUIDES = {
    "gentle": VOICE / "actor_reference.wav",            # approved voice F
    "command2": VOICE / "guides/command_ref_2.wav",     # firm clone, curt refusals
    "shout_vg_1": VOICE / "guides/shout_vg_1.wav",      # shouted warden guide
    "shout_vg_2": VOICE / "guides/shout_vg_2.wav",
}
GENTLE = dict(exaggeration=0.4, cfg_weight=0.3, temperature=0.65,
              repetition_penalty=2.0, min_p=0.05, top_p=1.0)
PRESETS = {
    "gentle": GENTLE,
    "firm": dict(GENTLE, exaggeration=0.7),              # with guide gentle or command2
    "shout": dict(GENTLE, exaggeration=1.0, cfg_weight=0.5),  # with a shout_vg guide
}
BARS = 56


def setup_environment(out):
    for folder in ("numba_cache", "tmp"):
        (out / folder).mkdir(parents=True, exist_ok=True)
    # Numba's cache probe stalls Chatterbox imports unless these point at writable scratch.
    os.environ.update(HF_HOME="E:/AI/hf_cache", HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
                      HF_HUB_DISABLE_PROGRESS_BARS="1", TQDM_DISABLE="1", TORCHDYNAMO_DISABLE="1",
                      NUMBA_CACHE_DIR=str(out / "numba_cache"), TMP=str(out / "tmp"),
                      TEMP=str(out / "tmp"), PYTHONDONTWRITEBYTECODE="1")
    sys.stdout.reconfigure(encoding="utf-8")


def generate(jobs, out):
    import numpy as np
    import soundfile as sf
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from sindarin_voice_post import cut_utterance, level

    print("Loading cached Chatterbox multilingual", flush=True)
    model = ChatterboxMultilingualTTS.from_local(CHECKPOINT, device="cuda")
    results = []
    for line in jobs["lines"]:
        params = dict(PRESETS[line.get("preset", "gentle")], **line.get("params", {}))
        for n, seed in enumerate(line["seeds"], 1):
            name = f"{line['id']}_{n}"
            random.seed(seed)
            np.random.seed(seed)
            torch.manual_seed(seed)
            start = time.perf_counter()
            with torch.inference_mode():
                wav = model.generate(text=line["text"], language_id=line.get("language", "es"),
                                     audio_prompt_path=str(GUIDES[line.get("guide", "gentle")]), **params)
            raw = wav.detach().float().cpu().numpy().reshape(-1)
            assert np.isfinite(raw).all() and np.max(np.abs(raw)) > 1e-5
            sf.write(out / f"{name}_raw.wav", raw, model.sr, subtype="FLOAT")
            clip, cut = cut_utterance(raw, model.sr)
            sf.write(out / f"{name}.wav", level(clip), model.sr, subtype="PCM_16")
            results.append(dict(name=name, line=line["id"], seed=seed, params=params,
                                raw_seconds=round(len(raw) / model.sr, 2),
                                seconds=round(len(clip) / model.sr, 2), cut=cut,
                                generation_seconds=round(time.perf_counter() - start, 2)))
            (out / "results.json").write_text(json.dumps(dict(jobs=jobs, takes=results), ensure_ascii=False,
                                                         indent=2) + "\n", encoding="utf-8")
            print(name, results[-1]["raw_seconds"], results[-1]["seconds"], flush=True)
    return results


def pack(path):
    import numpy as np
    import soundfile as sf
    audio, rate = sf.read(path)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    buf = io.BytesIO()
    sf.write(buf, audio, rate, format="WAV", subtype="PCM_16")
    peaks = np.array([c.max() if len(c) else 0 for c in np.array_split(np.abs(audio), BARS)])
    peaks = peaks / max(peaks.max(), 1e-9)
    return dict(src="data:audio/wav;base64," + base64.b64encode(buf.getvalue()).decode(),
                peaks=[round(float(p), 3) for p in peaks], seconds=round(len(audio) / rate, 2))


def flag(take, others):
    import numpy as np
    median = np.median(others)
    if take["raw_seconds"] > 4:
        return f"model ran on to {take['raw_seconds']} s before the cut"
    if take["seconds"] > 1.8 * median:
        return "long for this line, may contain extra sounds"
    if take["seconds"] < 0.65 * median:
        return "short for this line, may be missing a sound"
    if " " in take["text"].strip() and take["cut"]["dropped_peak_db"] is not None \
            and take["cut"]["dropped_peak_db"] > -20:
        return "loud audio after the cut; check that the last word is there"
    return None


def build_page(jobs, results, out):
    by_line = {}
    for take in results:
        by_line.setdefault(take["line"], []).append(take)
    lines = []
    for line in jobs["lines"]:
        takes = by_line.get(line["id"], [])
        lengths = [t["seconds"] for t in takes]
        entry = dict(stem=line["id"], pool=line.get("pool", ""), sindarin=line["sindarin"],
                     english=line["english"], text=line["text"], listen=line.get("listen", ""),
                     group=dict(title=line.get("group", "Takes"), text=""), takes=[])
        for take in takes:
            label = f"{line.get('guide', 'gentle')} · {line.get('preset', 'gentle')}"
            entry["takes"].append(dict(id=take["name"], label=label, seed=take["seed"],
                                       flag=flag(dict(take, text=line["text"]), lengths),
                                       **pack(out / f"{take['name']}.wav")))
        lines.append(entry)
    refs = [dict(id="accepted", label="Accepted audition", **pack(VOICE / "accepted_audition.wav"))]
    data = json.dumps(dict(lines=lines, references=refs), ensure_ascii=False).replace("</", "<\\/")
    page = (VOICE / "audition_template.html").read_text(encoding="utf-8")
    page = page.replace("{{TITLE}}", html.escape(jobs.get("title", "Sindarin Voice Audition")))
    page = page.replace("{{INTRO}}", html.escape(jobs.get("intro", "")))
    page = page.replace("/*DATA*/null", data)
    (out / "listen.html").write_text(page, encoding="utf-8")
    print(f"listen.html: {sum(len(l['takes']) for l in lines)} takes, {len(page) / 1e6:.2f} MB")


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    setup_environment(out)
    sys.path.insert(0, str(Path(__file__).absolute().parent))
    results = generate(jobs, out)
    build_page(jobs, results, out)


if __name__ == "__main__":
    main()
