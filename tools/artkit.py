"""Shared helpers of the Python art generators. A new generator starts from `json_io` (writers) and `artkit` (this file).

Shared here: `hexc` only, the one helper that had ten identical copies (byte-neutral to share).

Deliberately NOT shared (they look alike, they are not; sharing them would change pixels or hide per-file choices):
  Canvas        six different APIs across the generators (Starstone's is a list grid), so there is no common surface
  ramp          five different bodies (stops, steps and clamping differ)
  faces         three variants of the box UV layout
  box_extent    four variants (what counts as the box differs)
  pad_colour    four variants; the number of dilation passes differs per generator
  check_rooted  three variants (what "rooted" means depends on the sprite)
  blank         four variants that depend on the module's own size constant
  client_entity four variants of the client entity JSON
  dump, write_json  three deliberate per-file JSON layouts (json_io.write_json is the committed layout)
  key_art/grade.py hexc  returns a numpy float array, a different contract
"""


def hexc(h):
    """'#rrggbb' or 'rrggbb' -> (r, g, b, 255)."""
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
