# Galadriel's gifts and Galadhrim arrows

Final design, Bedrock 1.26.52 / Script API 2.8.0. Accepted by the owner in game 2026-10-11/12: belt mechanics, phial
("working perfectly") and the corrected cloak invisibility; final art chosen from previews ("Much better"). Individual fluid,
piston and multiplayer cases were not reported separately. Implementation commits: `03cc808` (final art, faster draw) and
`Finalize selected Galadriel worn gifts`. Balance source of truth: `lothlorien_bp/scripts/gift_rules.js`. The wider design
(Harmony, Renown, shops) is `design/elven_inhabitants.md` sections 5 and 6; archery detail is `ARCHERY.md`.

**Owner decision: all four final gifts cost 32 emeralds** and need both Harmony Friend (+10) and Renown Elf-friend (15 points).
No gift recipes; the gifts are renewable through the shops.

Final art: bow C (slender longbow, nocked arrows in every pull frame), arrow 3 (broad silver point, green feathers), phial D/P4
(faceted moon crystal), belt B4-v2 (broad clasp, stays off-hand), cloak C2-v2 (silver river worn model) with the C4 Golden
Mallorn inventory icon. Generators: `tools/make_galadhrim_archery.py`, `tools/make_worn_gifts.py`, `tools/make_phial.py`,
then `node tools/build_trades.mjs` and `node tools/build_gift_loot.mjs`.

## Mechanics

| Item | Behaviour |
|---|---|
| Bow of the Galadhrim | Main hand; 0.6 s (12 tick) draw, 384 durability, native damage, flight and bow enchantments. Zoom FOV 60 while drawing with a 0.6 s linear ease. Shooter, custom critical threshold, pull-frame charge and zoom share the 0.6 s. Fires vanilla arrows too |
| Galadhrim arrows | Native vanilla trajectory; 100 % item recovery after a destroyed entity hit, native ground pickup; no trail, no crafting. Fired from the Galadhrim bow and a native dispenser; the vanilla bow and crossbow keep their custom-ammo restriction. Shops: unlock at Trusted, 8 per emerald for Guests and 10 for Friends; Great Mallorn chests add stacks of 4-8 at weight 2 |
| Elven cloak | Chest slot, armour 3, durability 80. Sneak without moving for 20 ticks grants Invisibility I; movement, unsneak or unequip stops renewal. The cloak mesh hides through `query.is_invisible`, other gear follows native invisibility |
| Silver belt | Off-hand, worn at the waist (raised two model units after owner feedback). Regeneration I while living health is strictly below half the effective maximum |
| Phial of Galadriel | Off-hand. One hidden light-14 helper block in free head, feet or overhead air (never replaces plants, solids, liquids or a real light block). Repels spiders and cave spiders within 8 blocks with one native horizontal impulse per pass, at most 24 inspected per holder every 5 ticks; no damage, no upward force, contact attacks remain possible |

Cloak and belt never call `removeEffect` and never clear a potion on exit: equal or stronger external effects finish untouched
and weaker ones are upgraded. Grants of 60 ticks (belt) or 10 ticks (cloak) are renewed before expiry to avoid render and AI
gaps; leaving the gate lets the cloak fade within 0.5 s and the belt within 3 s. Stillness state is dropped on death, leave,
respawn and dimension change; the timer sleeps with no players, and there are no entity scans, tags or block changes.

Cloak repair and enchanting (added 2026-10-18, engine acceptance pending): `minecraft:enchantable` `armor_torso`, enchantability
15 (a balance choice): Protection variants, Thorns, Unbreaking, Mending and applicable curses under native chestplate rules.
Anvil: string restores 20 durability per piece (capped at 80); a second cloak adds its remaining durability. Mending repairs the
equipped cloak. Belt and phial have no durability or enchanting. Dyeing and trims are left out to keep the chosen art. Full
freezing protection has no straightforward verified path; the owner chose (2026-10-18) to leave it pending rather than add a
partial cold-damage replacement. `wearable.dispensable` was rejected by the engine log and removed 2026-10-21; native dispenser
equipping needs a game check. Component evidence: skill `bedrock-items`, `references/armor-enchanting-repair.md`.

## Phial helper block

`gift_rules.js` owns the item and helper ids, light level, candidate offsets, five-tick cadence, the 8-block radius, 0.8
horizontal impulse, the 24-spider query cap, 64 cleanup reads per pass and the 256-light persisted limit; `make_phial.py`
syncs the helper's emission from it.

- A world dynamic property holds a compact coordinate ledger, written before the light is placed so a world stop cannot leave an
  untracked helper. Movement, unequip, death, departure, Spectator and dimension changes remove unused loaded lights on the next
  pass. Unloaded lights stay recorded and cleanup rotates through at most 64 entries per pass without loading chunks; at the cap
  new lights pause. Failed ledger writes keep a dirty flag and retry. Several holders share a desired-cell set, and cleanup
  removes only exact `lothlorien:phial_light` blocks, never a foreign replacement.
- The helper has no collision, selection or drops, can be built over, accepts no fence/wall/pane connections, never obstructs
  chests, ignores precipitation, is non-flammable and non-conducting, pops under pistons (so it cannot leave the ledger), and
  breaks without an item when water arrives. It is hidden from Creative menus (verifier exception in `VERIFIER_WARNINGS.md`).
  Material bookkeeping reuses the flower profile for zero destruction resistance; the functional analogue is the vanilla
  light block. Nothing scans the world for helpers placed by hand, and removing the add-on stops the cleanup service.
- Spider queries run only around living, equipped, non-Spectator holders; each candidate is re-validated (validity, health,
  finite position, dimension, radius) before the impulse, and the direction uses the nearest eligible holder. The type priority
  alternates so ordinary spiders cannot starve cave spiders. Declaration check: `applyKnockback({ x, z }, verticalStrength)`
  in `reference/server-2.8.0.d.ts` (the example in the declaration comments is stale).

## Tests and regeneration

Offline suites run production callbacks on the shared mock: `tests/archery.mjs`, `tests/worn_gifts.mjs`, `tests/phial.mjs`
(28 runtime scenarios plus the helper declaration contract) and the trade/loot regressions. They do not establish native
durability, healing cadence, worn rendering, lighting or balance. For cloak or belt changes run
`mods deploy lothlorien --tests tests/worn_gifts.mjs`, then confirm `mods status`. Reusable archery template:
`.claude/skills/bedrock-items/templates/custom_archery/`.

Test commands (these change saved progression; test worlds only, Survival for ammunition and durability):
`/scriptevent lothlorien:harmony 10`, `/scriptevent lothlorien:renown points 15`, `/give @s lothlorien:elven_cloak`
(also `bow`, `silver_belt`, `phial_of_galadriel`, `galadhrim_arrow 32`).

## Engine checks still open

- Bow first and third person (grip, two-arm pose, all pull frames), release, cancel, slot swap, death, portal and
  logout: zoom restores the normal FOV, multiplayer players clean up independently.
- Arrows at 0.6 s and 1 s against vanilla (flight, crit timing); mob hit, bounce, ground pickup and destroyed-arrow return
  once; Infinity and Creative with custom ammo (recovery is deliberately 100 %).
- Same-bow anvil, crafting and grindstone repair, 10-second fuel, off-hand ammo, dispenser launch, shields, immune targets,
  fluids, kill credit (`parity/BLOCKS_ITEMS.md`); mallorn buttons remain an open controls gap; elven-bow dispenser crafting is
  intentionally excluded.
- Cloak and belt fit while walking and crouching (Steve and Alex), first-person suppression, mesh hiding, chest protection and
  durability, native dispenser equipping, stand and mob display, repair, curses, death, external clearing.
- Phial indoors and outdoors, piston at the helper, water or lava arrival, two holders in one cell, an unloaded old cell,
  Vibrant Visuals; spiders against walls, elevation and several holders.
- Nine languages and the Content Log.
