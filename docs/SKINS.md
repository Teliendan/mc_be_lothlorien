# Player skins

Pack `lothlorien_skins/` (skin pack, ships in the `.mcaddon`; added in 6d3600d), generator `tools/make_skins.py`, names in
`localization/catalog.json` (pack kind `skin`). Format and lessons: skill `bedrock-art`, `references/player-skins.md`.

## Owner decisions (2026-11-08)

- 3 roles x 2 genders = 6 skins: woodland (everyday forest elf), warden (warrior), noble (lord / lady).
- Goal: attractive to players (Marketplace-level detail), and the player must feel distinct, not a copy of an NPC.
- Slim (3 px) arms for all six (a skin pack fixes the arm width per skin).
- Generic names only, no Tolkien character names; short enough for the Dressing Room (no place name).
- Standard player geometry only ("stay safe"): elf ears are painted, on the base and hat layers.
- Faces: women get the 2x2 "big eyes" (lash + dark iris on top, white + iris below); owner picked them over the
  1-row lash-flick eye. Men use the vanilla pattern (brows, then white + iris on one row).

## Status

| Skin | Name (en_US) | Status |
|---|---|---|
| `warden_woman` | Warden | accepted by the owner, works in game (2026-11-08) |
| `warden_man` | Sentinel | owner: "awesome" (2026-11-08) |
| `woodland_woman` | Forester | owner: "awesome" (2026-11-08) |
| `woodland_man` | Pathfinder | owner: "awesome" (2026-11-08) |
| `lady` | Highborn Lady | owner: "awesome" (2026-11-08) |
| `lord` | Highborn Lord | owner: "awesome" (2026-11-08) |

Names: no place name in any locale (owner, 2026-11-08). "Lothlórien Forester" and "Lothlórien Pathfinder" were cut
off in the Dressing Room while "Lothlórien Sentinel" fitted; the pack title "Elves of Lothlórien" carries the place.
Shortened names checked in game by the owner (2026-11-08).

## Designs

Shared: painted pointed ears, no nose, mouth one step darker than skin, every hair colour a different value from the
clothes behind it. None wears a hood, bow or quiver (the Elven Warden NPC does), and no outfit repeats an elf NPC's
colours (gardener brown/green, healer white/pale blue, lamplighter blue, loremaster grey, woodwright red/brown).

- **Warden** (woman): warm blond hair, braid over the right shoulder; dark steel cuirass with gold trim, teal tunic,
  leather bracers, steel pauldron on the left shoulder, blue-grey cloak with a silver mallorn leaf.
- **Sentinel** (man): same order of wardens, dark chestnut hair; leather baldric across the cuirass, steel vambraces,
  leather gloves, pauldron on the right shoulder.
- **Forester** (woman): copper hair over both shoulders, a crown of white and yellow flowers; moss-green laced dress
  with a gold sash, cream linen sleeves.
- **Pathfinder** (man): ash-brown hair tied back; slate-grey jerkin over a cream shirt with rolled sleeves, strap to a
  satchel on the right hip, leather wrist wraps, cross-laced boots; warmer skin tone.
- **Highborn Lady**: raven hair to the waist, silver circlet dipping to a pale-blue gem; white gown with gold
  neckline, girdle and hems, floor length.
- **Highborn Lord**: long silver hair, gold circlet with a green gem; deep green robe open over a silver under-tunic,
  gold-edged, mid-calf; blue-grey mantle on the back.

Not done (owner closed the feature on 2026-11-08):
- Wiki: the producer contract (`tools/wiki/contract.py`) has no record shape for skins or skin packs; adding them
  needs an adapter and fixtures there first.
- Loose PNGs for importing a single skin (consoles cannot import sideloaded packs).
