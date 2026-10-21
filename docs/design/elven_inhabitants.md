# Elven inhabitants: professions, Renown, trades, gifts (design)

Status: **M0-M4, M6 and M7 accepted; M5 final art selected and belt/phial/invisibility work; bow speed/zoom and broader engine checks pending** (milestones below). Target Bedrock 1.26.52 / Script API 2.8.0.
Supersedes the profession stock lists and trade-state details in `lothlorien_elven_settlements_plan.md` ("Initial professions",
"Harmony-aware trading", "Proposed reputation trade states") and the stock part of `harmony_rework_plan.md` section 5. The trade
**architecture** of that section 5 (native trade screen, per-band tables pre-swapped by script, refusal in `beforeEvents.playerInteractWithEntity`) stays.
Looks: `docs/mobs/elves.md` (`tools/make_elves.py`, review sheets in `temp/elves/`). Warden: `docs/mobs/elven_warden.md`.

## 0. Milestones

| M | Scope | State |
|---|---|---|
| M0 | Spikes: custom bow, arrows, belt (section 8) | done, owner-tested 2026-10-10. Spike files kept in `temp/elven_inhabitants/spike_files/` as the M5 starting point |
| M1 | Civilian elves placed in villages, Harmony, wardens defend, leads, healer roaming (sections 1, 7, 10) + village polish (rope foot, crowns fit their box, bare branches, living pillars with planner root flares) | done, accepted in game 2026-10-10 (commits 30e1eb1, 5631c22, 6f79109, 7b57536, 6b97311; the ivy start of 6b97311 not yet seen) |
| M2 | Renown + Loremaster dialog: lessons and requests (sections 2, 3) | done, accepted in game 2026-10-11 (commits 88dbbe2, 6019c88, f854117, ff61ae2, eb1cc5e dew, a10653f niphredil). Notes: `docs/TECHNICAL_NOTES.md` "Renown and the Loremaster (M2)" |
| M3 | Shops: trade-table generator (band x rank), table swapping by script, refusal (section 4) | complete, accepted in game 2026-10-11: shops 7f86c87 ("It all works"), Trade hover guidance 9cdd1a0 confirmed on deployed 405d482 ("It works"); [regression checklist](../M3_TRADES_TEST.md) |
| M4 | Healer heals elves and Friends (section 7) | complete, owner accepted 2026-10-11 (bc1da69); [regression checklist](../M4_HEALER_TEST.md) |
| M5 | Final items (Galadriel's gifts) + Galadhrim arrows (sections 5, 6); then the bow template for `bedrock-items` | implemented; final art selected/accepted from previews 2026-10-12: bow C, arrow 3, phial D/P4, belt B4-v2 with icon, worn cloak C2-v2 with Golden Mallorn icon. Belt/phial/corrected invisibility owner-confirmed; 0.6s bow feel/zoom and broader engine checks pending; [checklist](../M5_GIFTS_TEST.md). Shared template in `.claude/skills/bedrock-items/templates/custom_archery/` |
| M6 | Great Mallorn upgrade (section 9) | complete, owner accepted 2026-10-13 after bed/banner correction; final implementation `0630cdf`; owner's loot tuning retained; [record](../M6_WATCH_CAMPS_TEST.md) |
| M7 | Homes + village look (section 10; `lothlorien_jigsaw_settlement.md` section 6) | complete, owner accepted 2026-10-16: "I love it, villages done"; final commit **Finish accepted elven villages**, [record](../VILLAGE_POLISH_2026-10-16.md) |

**Working agreement (owner, 2026-10-10).** Stop after each milestone for the owner's in-game test. Before a milestone starts, show the owner one batch
of proposed values (table with reasons; all values in one tunable rules file); escalate design decisions as options with a recommendation. Commit per
milestone once verify and tests pass, before the in-game test; deploy before handing anything over.

## 1. Roster

| Elf | Role | Trades |
|---|---|---|
| Warden | guard (built) | **never** |
| Gardener | plants and seeds | yes |
| Woodwright | logs, rope, arrows, bow | yes |
| Healer | heals elves and Friends, buys herbs | yes (small shop) |
| Lamplighter | lanterns, light ingredients | yes |
| Loremaster | teacher and the **only quest giver** (proxy for the others) | **never** |

**Elves are not renewable** (owner: fits the lore). Village elves and village wardens are placed once; only the natural wardens at the
forest edge keep spawning. Healers exist to prevent accidental deaths. Killing a civilian elf costs **-6 Harmony** (as a warden).

## 2. Harmony and Renown

- **Harmony** (built, `harmony_rework_plan.md`): how the forest sees you now, volatile. Controls **access and prices**.
- **Renown** (new): what you did for the elves. **One value for the whole elven society** (owner: keep it simple; "word travels among
  the Galadhrim", so every village knows you), per player, stored on the player, **never lost**. Controls **stock depth**.
  Ranks: **Stranger (0) -> Welcome (1) -> Trusted (2) -> Elf-friend (3)**. Thresholds **3 / 8 / 15 points** (owner 2026-10-10; all values in `renown_rules.js`).
  Points: a deed lesson 1, a lore lesson 0, a request 2. (Optional "tales" for the white deer and unicorn were dropped, owner 2026-10-11: no deferred +1.) Uncapped, the rank stops at Elf-friend. Stored in the player dynamic property `lothlorien:renown` (JSON, `v: 2`).
- **Final trade of a shop** needs **Elf-friend and the Friend band**.
- Script cannot see trades (no trade event or trade component in 2.8.0, `.claude/skills/bedrock-modding/references/08-trading.md`), so
  Renown comes only from the Loremaster (section 3), never from trading. No engine trader levelling.
- Tables per profession: band (Friend, Guest, Uneasy) x rank (0-3), generated by a tool, deterministic stock (`persist_trades: false`).
  Final M3 prices are in section 4 below; Uneasy has Stranger stock only.

| Band (Harmony) | Trading | Loremaster |
|---|---|---|
| Friend +10 | all stock up to your rank, best prices, final trades | all lessons and requests |
| Guest 0...+9 | stock up to your rank, normal prices | all lessons and requests |
| Uneasy -1...-14 | Stranger stock, higher prices | **only the Harmony lesson**; no requests, no Renown |
| Shunned -15...-29 | refused | one hint: "Learn to live in peace with the forest, then return." |
| Hated -30 and below | refused | turns away silently (wardens shoot on sight) |

## 3. Loremaster: lessons and requests (M2 as built; owner decisions 2026-10-10 and 2026-10-11)

Use on the Loremaster opens a dialog (`loremaster.js`); he never trades. A lead or a name tag in hand still works on him. Texts name no ranks, depth stages or item counts.

**Lessons are chapters.** The unfinished lessons of the open chapter are listed; chapter N+1 opens when chapter N is complete. **Lore** lessons ("I understand") give 0 points and need no task slot. **Deed** lessons and the Harmony lesson give 1 point.
Each deed lesson has a one-sentence goal line.

**One task slot** is shared by deed lessons, the Harmony lesson and requests. "Take this task" fills it; while it is full, other deed lessons and kin offers are hidden. A deed only makes the task **ready** (chat line + soft sound); Renown is paid at
**turn-in** ("It is done") at the Loremaster, with no result screen: the chat shows the done line, the renown line, the progress line, a chapter-opened line and the rank-up line. Deeds done while their lesson is not the task are lost.
Harmony lesson: ready when Harmony >= +3 at talk time (a chat nudge fires once when it crosses). "Set this aside" pays nothing and puts a lesson back (its deed must be repeated). Uneasy: the task is kept and paused.

| Ch | Lesson | Kind | Completion |
|---|---|---|---|
| I | harmony | task | Harmony >= +3 when talking / turning in |
| I | elves, renown | lore | read |
| I | dew, nectar | deed | fill a Bottle of morning dew; bottle nectar |
| II | depth | lore | read |
| II | lembas, rope | deed | eat wrapped Lembas; hang an elven rope |
| II | fireflies | deed | catch a firefly (script-owned catch) |
| III | gifts | deed | send a squirrel off with an acorn (needs Friend) |
| III | white_animals, trades | lore | read |

Ranks at 3 / 8 / 15 points: chapter I gives 3 (Welcome), chapter II 6 in all (Trusted at 8 needs 1 request), chapter III deeds 7 (Elf-friend at 15 needs 4 requests). No deferred points for the white animals.

**Requests** open once chapters I and II are complete, for Friend and Guest only; one at a time, no cooldown, each completable **once ever**. Twelve requests: gardener (5 Mallorn saplings planted inside the forest, 2 morning dew, 16 bone meal),
healer (4 Athelas, 2 nectar, 4 Elanor + 4 Niphredil), woodwright (32 birch/cherry logs in any mix, 8 string + 8 feathers, 6 iron ingots), lamplighter (3 bottles of fireflies, 16 coal/charcoal in any mix, 16 glass).
The profession rotates in random permutations of the four; the offer is a random not-yet-done request of the next profession. "Not now" keeps the offer; setting a request aside does not complete it and the rotation moves on.
Items are taken all-or-nothing from the main inventory. Saplings are remembered cells that must still hold a sapling or a Mallorn log; a sapling set outside the forest does not count and says so in chat.

**Delivery.** The Loremaster only gives requests; they are handed over to an elf of that profession in any village (Renown is global). The offer and Task screen say where such an elf lives (8 compass words, north = -Z, "close by" under 8 blocks, search 96 blocks).
If none is found, the Loremaster takes the request himself and says so ("Our village has no gardener any more, so I ask in their place..."). At the trader a small form shows the request and progress, "Hand over" only when ready. The hover prompt "Hand over" shows only
while the player's current request is of that profession (player tag `lothlorien_deliver_<profession>`, kept by script). M3 adds Trade to that form and native trading for players with no matching request.

Bands: Friend and Guest get everything; Uneasy only the Harmony lesson (task kept, paused); Shunned one chat line; Hated silence. A village whose Loremaster died has no dialog (other villages work).

## 4. Shops

**Rule (owner):** elves sell what is rare, not renewable, or would otherwise be taken from the forest, **not what a crafting table makes**.
Exceptions agreed: the elven lanterns and the final items. Currency: **emeralds** (owner: elves love green stones).

| Elf | Buys (player earns emeralds) | Sells, by rank | Final (Elf-friend + Friend) |
|---|---|---|---|
| Gardener | bone meal, seeds, vanilla flowers | 0: acorns, Elanor, Niphredil, Athelas, golden fern; 1: blossoms, Western Corn seed; 2: **nectar blooms** (worldgen-only otherwise) | **Elven cloak** |
| Woodwright | other woods, string, feathers, iron | 0: **Mallorn logs** 1 emerald = 6 (Friend 8; a stack about 10 emeralds); 2: **Galadhrim arrows** about 1 emerald = 8; 1: **Elven rope** 6 emeralds (Friend 5; expensive on purpose: crafting needs a bottle of dew) | **Bow of the Galadhrim** |
| Healer | Athelas, Elanor, Niphredil, nectar, glistering melon | potions: Healing, Regeneration, Slow Falling (flets); 3: Miruvor | **Silver belt** |
| Lamplighter | glass, amethyst, glowstone | 0: **both elven lanterns** (silver, heartwood); 1: morning dew; 2: **deer antlers** (no killing deer for the chandelier); no loose fireflies | **Phial of Galadriel** |

No carved decor pieces (owner). No books from the Loremaster (owner). The Great Mallorn nut stays a white-deer-only gift.

### M3 values (owner 2026-10-11; all in `trade_rules.js`, tables generated)

M3 = the four shops with what exists today; final trades and Galadhrim arrows come with their items in M5 (so rank 3 adds only Miruvor in M3).
Prices are **Uneasy / Guest / Friend**, `a->b` = a emeralds for b items (a bare number = emeralds for one). Guest is the base; Friend about
20 % better, Uneasy about 50 % worse and Stranger stock only. Buys = items for **1 emerald**. No arbitrage between shops even at Friend.

| Elf | Sells (rank: item U / G / F) | Buys (U / G / F items -> 1 emerald) |
|---|---|---|
| Gardener | 0: acorn 1->1 / 1->2 / 2->5; Elanor, Niphredil 1->2 / 1->3 / 1->4; golden fern 1->3 / 1->4 / 1->5; Athelas 3->1 / 2->1 / 3->2. 1: blossom 1->4 / 1->5; Western Corn seeds 1->3 / 1->4. 2: nectar bloom 4 / 3 | bone meal, wheat seeds 48 / 32 / 24; lily of the valley, cornflower, oxeye daisy 12 / 8 / 6 |
| Woodwright | 0: Mallorn log 1->4 / 1->6 / 1->8. 1: Elven rope 6 / 5. (M5, 2: Galadhrim arrows 1->8 / 1->10) | oak, spruce, dark oak logs, string, feathers 24 / 16 / 12; iron ingot 6 / 4 / 3 |
| Healer | 0: Potion of Healing 5 / 3 / 2. 1: Regeneration 5 / 4. 2: Slow Falling 4 / 3. 3: Miruvor 10 / 8 | Athelas 4 / 3 / 2; Elanor, Niphredil 12 / 8 / 6; nectar 2 / 1 / (2 -> 3 emeralds); glistering melon slice 4 / 3 / 2 |
| Lamplighter | 0: elven lantern, heartwood lantern 4 / 3 / 2. 1: morning dew 2 / 3->2. 2: deer antler 6 / 5. **No loose bottles of fireflies** | glass 24 / 16 / 12; amethyst shard 12 / 8 / 6; glowstone dust 16 / 12 / 8 |

Owner decisions 2026-10-11:
- **Stock grows with every rank** (rope moved to 1; lamplighter spread over 0-2).
- **Unlimited uses** (`max_uses` very high): balance by price only; script cannot see trades and restock of a custom trader is unreliable.
- **No elf asks for what it sells itself.** Buying from one elf to hand over to another is allowed (it costs emeralds and a walk). This is why the
  lamplighter sells no loose bottles of fireflies (his request asks for 3). The gardener's acorns are fine: his request is planting 5 saplings.
- **Click flow at a trader:** while the player's current request is of that profession, every click opens the request form (progress, "Hand over"
  when ready, "Trade", close). "Trade" lets that player's next click on that elf through for about 10 s, so it opens the native trade screen.
  Otherwise a click opens the trade screen directly (Shunned / Hated: refused with a chat line).
- Table swap: every 10 ticks, to the band and rank of the nearest player within 6 blocks; on a mismatch at click time cancel, swap, click again.
- (2026-10-11, round 2) Elves **stand still and face** the player while trading (`behavior.trade_with_player`). **Refusal first**: a Shunned/Hated
  player with a request gets the refusal line, not the request form. **Pin**: a player whose click opened the trade screen keeps the elf's table
  for up to 30 s while within 6 blocks; another player's click still swaps and says "use again".

**M3 as built (2026-10-11).** Four professions each have nine generated tables: Uneasy (starting stock), Guest 0-3 and Friend 0-3; `none` removes trading. A six-block player query every ten ticks selects the nearest player's table, with property-guarded swaps and a thirty-second nearby-player pin. Refusal precedes the request form. Trade grants a one-use, ten-second pass on that elf; repeated events from the same use have a bounded half-second grace. Native goals stop the elf and face the customer. Fixed price multipliers, no trader/player XP, high use limits; final gifts/arrows wait for M5. Offline tests cover prices, no arbitrage, request-stock separation, generated bindings and click/timer glue. Owner accepted the shops in game on 2026-10-11 (7f86c87); see the [regression checklist](../M3_TRADES_TEST.md).

## 5. Final items (Galadriel's gifts)

Bedrock has no accessory slots, so each gift takes a real slot and costs something: a loadout choice, not a pure upgrade.

| Item | Slot | Final effect |
|---|---|---|
| Elven cloak | chest, replaces chestplate | armour 3, durability 80; invisibility after one second sneaking still |
| Bow of the Galadhrim | main hand | 0.6s draw, same native damage/flight, native bow enchantments and progressive zoom |
| Silver belt | offhand | Regeneration I strictly below half effective maximum health; raised worn waist band |
| Phial of Galadriel | offhand | level-14 light near holder and native spider repulsion within 8 blocks |

**M5 as built (2026-10-11).** Implementation commit: `Implement M5 Galadriel gifts and Galadhrim arrows`.
Owner approved the proposed mechanics and set **all four final gifts to 32 emeralds**.
All tunable values are in `scripts/gift_rules.js`: bow draw 0.6s (owner requested faster than the initial 0.8s), vanilla flight/damage,
384 durability, zoom FOV 60; cloak armour 3/durability 80, one second still crouch
before short invisibility; offhand belt Regeneration I strictly below half health;
offhand phial level-14 air-only light and 8-block native spider repulsion. Existing
longer/stronger potions stay untouched; same-strength invisibility hands over to
the cloak in its final polling window. Effects expire naturally after leaving
their gates (cloak at most 0.5s; belt at most 3s). Final gifts require Friend and
Elf-friend. Trusted woodwright arrows cost 1 emerald for 8 (Guest) or 10 (Friend);
Great Mallorn chests also gain 4-8 arrows, weight 2 in the existing resource pool.
Generated original assets and all nine locale names ship together. Runtime/mock
tests cover effect gates, native projectile parity, recovery, camera cleanup and
persistent shared light cleanup. Final art decisions (2026-10-12): bow C slender
mallorn longbow, arrow 3 broad silver point/green feathers, phial D/P4 faceted moon
crystal, B4-v2 Broad clasp belt including its icon, and C2-v2 Silver river worn
cloak retaining the separately selected C4 Golden Mallorn inventory icon.
The owner accepted revised wearable previews ("Much better"). Belt stays offhand,
raised two model units; whole-unit meshes use one texel per model unit.

Belt mechanics, phial gameplay and corrected cloak invisibility are owner-confirmed
in game. Cloak renews before expiry; bow zoom uses `EasingType.Linear`, pull frames
include an arrow, and native charge/custom critical/visual charge/zoom ease match
0.6s (12 ticks). The requested faster bow feel, zoom, final worn fit and broader
engine cases remain pending in [M5_GIFTS_TEST.md](../M5_GIFTS_TEST.md).
Finalization commit: `Finalize selected Galadriel worn gifts`. M6 is complete (section 9).

Dropped: Box of Lórien earth (not unique enough), Elessar (Aragorn's alone; became the belt), Mirror of Galadriel, Circlet of Elanor (cloak is better).

## 6. Galadhrim arrows

- **Same trajectory and flight as a vanilla arrow** (owner: players learn where to aim; a new trajectory would be a penalty, not a reward).
- **Survive the hit**: on hitting a mob they usually drop as an item to pick up again (chance tunable). Helpful, not overpowered.
- ~~Silver trail~~ **dropped** (owner 2026-10-10): invisible behind the vanilla arrow's own flight particles [V].
- **Recovery 100 %** (owner): the arrow item drops at the hit spot by script (`projectileHitEntity`, works [V]); ground-stuck arrows are picked up as the custom item [V].
- Fired from the **Bow of the Galadhrim**, with **dispensers also allowed where supported** (owner 2026-10-18). A vanilla bow in survival cannot draw with only custom arrows [V] (engine-side, accepted); vanilla bow/crossbow custom-ammo restriction remains. The Galadhrim bow fires both kinds; the earliest inventory slot is used first [V]. Native dispenser path and offhand permission: [interaction ledger](../ARCHERY_INTERACTIONS.md), engine acceptance pending.
- **Leads (owner 2026-10-10, built, not seen in game):** every elf is leashable; a released elf takes a new home where it was released, anywhere (`set_home_position` on the unleash event; the record `lothlorien:village_homes`
  stays as the planner's tree assignment, the elf's own `lothlorien:home` and `lothlorien:moved` track the move). While on a lead there is no home radius. Harmony: elf and warden deeds count everywhere, not only inside the forest.
- Flight: the custom arrow entity (copy of vanilla `arrow`) flies identically to a vanilla arrow [V].
- Not craftable: woodwright (Trusted) and **Great Mallorn loot chests** (section 9).

## 7. Healer

- **Owner decisions 2026-10-10 (built, not seen in game):** the healer's home is its own tree (nearest the Loremaster); it roams the whole village by day (home radius 64) and from dusk the radius is 10, so it walks back to its tree
  (`healer_day` / `healer_night` groups swapped by an `environment_sensor` on `is_daytime`). One entity has one home position, so the day roam is a large radius around the own tree, not a village-centre anchor. A healer moved by a lead
  also roams 64 by day wherever its new home is. Villages with 6+ outer trees (80 % in the sim) get a **second healer** on a spare roomy tree farthest from the first.
- Wanders the village. Injured elves and wardens within about 8 blocks (line of sight) get **Regeneration II**; the healer heals himself too.
- **Friend** players hurt within about 6 blocks get **Regeneration I** for a few seconds, renewed while they stay hurt and near. No cooldown
  (owner: regeneration instead of a 2-minute limit); slow enough not to trivialise a fight.
- Shown as a blessing (arm raise, particles). There is no stable "walk to that entity" script call in 2.8.0 as far as known, so v1 does not
  walk to the patient; an AI-goal trick is a later experiment.

**M4 as built (bc1da69, owner accepted 2026-10-11).** `healer_rules.js` owns all healing/blessing values. Loaded healers check once per second:
injured living elves/wardens (including self), Regeneration II within 8 blocks; injured Harmony Friends, Regeneration I within 6.
Head-to-head solid-block sight is required except for self. Effects last 3 seconds and finish before renewal, preserving equal/stronger potions
and avoiding repeated refreshes of their timing. No cooldown; no Renown gate. Each new grant has green sparkles and a finite arm raise authored
by `make_elves.py`. Event-based discovery/unload cleanup, one startup reconciliation, two local patient queries per healer/check; no timer when
no healer is loaded. Existing healers work after reload; no worldgen change. Implementation commit: `Implement M4 healer blessings for elves and Friends`.
Offline evidence and regression cases: [M4_HEALER_TEST.md](../M4_HEALER_TEST.md). Owner accepted M4 after confirming that only injured targets are blessed.
Individual in-game observations were not supplied; this records overall acceptance. M5 is next and starts on the owner's request.

## 8. Engine facts (M0 spike, owner-tested in game 2026-10-10, Bedrock 1.26.52, [V])

Details and recipes: `.claude/skills/bedrock-items/references/bows-and-arrows.md` and `attachables.md`. The spike files were removed from the mod; templates stay in `temp/elven_inhabitants/spike_files/`.

1. **Custom bow** (`minecraft:shooter` + `minecraft:enchantable` slot bow): enchanting table and anvil work; **Power, Punch, Flame, Infinity are applied natively** (no script fallback). Launch speed and charge scaling equal vanilla (full draw about 2.96 b/t, damage 8.6-10.6 with crits; tap 0.4-1.1 b/t, 1-3 damage).
   - Owner decisions: **bow edge = faster draw (final 0.6s / 12 ticks), same damage**; item id **`lothlorien:bow`** (display name "Bow of the Galadhrim") because the vanilla two-arm draw pose keys on the item name `bow`. Final assets lower its grip and include nocked arrows in pull frames. **Zoom** while drawing via `camera.setFov` in script (vanilla zooms, a custom shooter does not; API 2.8.0 `Camera.setFov(CameraFovOptions)`, untested).
2. **Belt on the waist**: off-hand attachable bound to the body bone (`"binding": "'body'"`) renders at the waist correctly.
3. **Arrow survival**: drop the arrow item on `projectileHitEntity` (projectile already invalid but `typeId` readable); works.
- **Follow-up (owner-approved 2026-10-10):** after M5 (final Bow of the Galadhrim: pose, pull frames, zoom), extract a clean reusable custom bow + custom arrow + arrow-return template into `.claude/skills/bedrock-items/` (references + template files) and record the then-verified pose fix and `setFov` zoom result in `bows-and-arrows.md`.
4. A vanilla bow in survival cannot draw with only custom arrows; arrow trail dropped (see section 6).
5. Known: civilian elves placed as structure template entities get engine default attributes (movement 0.7, etc.), like the village wardens
   ([V] 2026-10-08); reuse the `warden_replace.js` pattern.

## 9. Great Mallorn upgrade (complete, owner accepted 2026-10-13)

The flet giants (`lothlorien:giant_mallorn`, lookout variant `round`, loot `loot_tables/chests/mallorn_flet.json`; `TECHNICAL_NOTES.md` Phase 5):
- **Wardens:** two persistent bow guards per lookout, using the village component group and existing structure-attribute replacement.
- **Lights:** four silver elven lanterns on the cardinal rim posts. Offline conservative block-light check: every walkable deck cell has light >= 1; actual night rendering/spawning still needs the game test.
- **Camp furnishing:** two native straw beds across the west-side nook, heads east against the living trunk and feet west toward a small green rug. The north rope entry stays clear; sleepers shelter their heads rather than pointing them toward the approach (owner correction 2026-10-13). Two native cushions (green and light gray) overlook the south side. The 26.50 Wilderness Bound update added functional straw beds (sleep once without resetting spawn) and sit-on cushions.
- **Banner:** one native wall banner on the south trunk face, using the **silver** design in `banner.png` / `banners.txt`, all six layers in order. Both indented edges have three small triangles (`bts` / `tts` in NBT). Bedrock spells its light-gray dye `silver`.
- **Loot (owner tuned 2026-10-13):** existing provisions + 3-5 supply rolls, nectar, salve, herbs, corn, acorns, emeralds, antler, Galadhrim arrows (weight 6, stack 4-8) and rope (1-4). Owner removed Elanor, Niphredil, morning dew and bottled fireflies. Separate **50%** chance of one native shield carrying the same pattern (shield/empty weights 3/3). No Great Mallorn nuts or final Galadriel gifts. Generator now reproduces the owner's edited loot exactly; arrow values share `gift_rules.js`.
- **Scope:** both shipped `round` lookout trees (5 and 7), including future Great Mallorn nut-grown copies. Plain giants and village pieces retain their original bytes. Existing generated trees are not refurnished; unopened old chests use the updated loot table.
- **Implementation:** `tools/watch_camp_rules.mjs` owns all values; `tools/watch_camp.mjs` furnishes and generates loot during `node tools/build_structures.mjs`. No additional runtime script or recurring scan. One existing rail-mender marker per lookout repairs fence links after placement and removes itself.
- **Evidence:** Bedrock 1.26.52 / API 2.8.0, 2026-10-13: installed 26.50 templates, official references and passing regression checks. Owner accepted the completed feature after the bed/banner correction: "Perfect, this is done." Individual seating/drop/shield observations were not supplied. Final implementation: `0630cdf` (`Shelter watch-camp sleepers and correct indented banner edges`). Scratch removed on acceptance; permanent banner references and production generators retained.

## 10. Population (M1, accepted in game 2026-10-10)

Rule (owner decisions 2026-10-10, details `docs/mobs/elves.md`, implementation commit 30e1eb1): every new village gets all five professions. The Loremaster stands on the central tree
(post nearest the rope top, at least 2 cells from it); healer, gardener, woodwright and lamplighter each stand on an outer tree (`combo_*` piece, warden trees included) of their own.
- **Posts.** Tree pieces carry invisible `lothlorien:elf_post` entities: `central_mallorn_01` 1 `loremaster` + 4 `reserve`, each `combo_*` 1 `home` post inside the largest free deck square, 3 cells from wardens and other posts.
  A new tree piece without a `home` post is never a profession tree.
- **Assignment** (once per village, in the loop planner run, `scripts/elf_village.js` + pure `assignHomes` in `scripts/elf_rules.js`): home posts ordered by room first (free square >= 5x5), then straight-line distance to the Loremaster, then x, z;
  professions in the fixed order healer, gardener, woodwright, lamplighter. With fewer than 4 outer trees (6 % of villages) the leftover professions stand on the reserve posts (F1), nearest to the Loremaster first, so all five are always present.
  The posts are removed afterwards; a second run finds none.
- **Record for the home milestone.** World dynamic property `lothlorien:village_homes`: JSON list (64 max) of `{ rect: {x0,x1,z0,z1}, loremaster: [x,y,z] | null, homes: [{ p, x, y, z, site }] }`;
  `x,y,z` is the post's feet cell, `site` = `{ x0, z0, k }` is the free k x k deck square (corner x0, z0) containing the post cell, or `null` on a reserve. Each elf also keeps the entity property `lothlorien:home` = `"x,y,z"`.
  `homeSite(at, x, y, z)` (`elf_rules.js`) recomputes the square from live blocks (deck cell y = post y - 1; open deck = planks, 3 air above), so the home step never needs the generator.
  Sites are 3..7 wide (`HOME_MAX` 7); `node_e` has only a 3x3 square, `node_a`, `node_d`, `tower_c` 4x4, the rest 5x5 or more.
- **Numbers** (simulator, 300 seeds): all five professions in 300/300 villages; four on trees of their own in 94 %; reserves used 0.11 per village on average; 84 % of the assigned trees have a 5x5 square; a second healer in 241/300 villages (6+ outer trees, 2026-10-10 fix round).

- **M1 as built.** Loremaster on the central tree; healer, gardener, woodwright, lamplighter each on their own outer tree (warden trees allowed), assigned by the loop planner with a fixed ranking (free deck room, then distance to the Loremaster; healer nearest). Fewer than 4 outer trees: leftovers stand on the central tree. Elves are non-renewable; only villages generated after M1 get elves.
- **Homes and village look (later milestone M7, owner 2026-10-10: "I like the hybrid homes approach with planner picking professions and decorations from a pool").** M7 = homes + village look (buildings, lighting, furniture; the crown stubs and a lower fallback element where a tree's crown does not fit, details in `lothlorien_jigsaw_settlement.md` section 6 "Next: village look (M7)"). Homes are prefabricated jigsaw pieces (generic elven homes, each carrying one elf post). The planner assigns the professions to homes (it guarantees all five per village, which jigsaw alone cannot) and furnishes each home by placing a profession-specific decoration structure picked from a pool. Bare tree posts remain the fallback when a village has too few homes. Decks may change shape when buildings are added, so site and post selection must be derived from the actual pieces and re-checked by the simulator after any deck change. An elf with `lothlorien:moved` (led away) lives at its own `lothlorien:home`, not at the planner's tree. Healer: second healer from 6 outer trees.

## 11. Open

- A reward or purpose for requests after full Renown (all 12 requests done; Elf-friend reached). Not part of M2.
- Rank names are gender-marked in some locales (titles such as Přítel elfů, Amigo de los elfos); a neutral wording needs a native reviewer.
- Final-item values are now set for M5; native rendering and balance acceptance remain in [M5_GIFTS_TEST.md](../M5_GIFTS_TEST.md).
- What elves do at night (gathering, lamplighter at dusk); M1 decided: no change at night.
