# Elf shops, healer and watch camps

Final records of three accepted milestones, Bedrock 1.26.52 / Script API 2.8.0 / server-ui 2.1.0. Design and economy:
`design/elven_inhabitants.md` (sections 4, 7, 9). Gifts sold by the shops: `GIFTS.md`. Milestone commits: shops `7f86c87`
(owner: "It all works") plus the Trade hover guidance `9cdd1a0` ("It works"), healer `bc1da69` (accepted after confirming the
injured-only rule), watch camps `0630cdf` ("Perfect, this is done"). Acceptance is overall; the single engine cases below were
not reported one by one and stay as regression checks. Leave and re-enter the world after deployment; existing elves gain the
new behaviour. Villages made before the civilian elves existed have none.

## Shops

Four professions have generated tables (`tools/build_trades.mjs`, rules in `scripts/trade_rules.js`): Uneasy (starting stock,
higher prices), Guest 0-3 and Friend 0-3 by Renown points; Shunned and Hated refuse (chat only). A table is swapped by script
(a six-block player query every ten ticks) for the nearest player; a click on a stale table is cancelled and asks for another use. The native trade
screen opens only after the elf's request form: pick Trade, then click within 10 seconds (a one-use pass; closing the screen
or waiting spends it). Leads and name tags work normally; the Loremaster and the wardens do not trade. No price drift,
restocking, XP, levelling or Hero of the Village effect. Nectar bloom production paying for itself is intended production,
not an arbitrage loop. With two players, the nearest sets the prices and a trading player pins his prices while within six
blocks (released after 30 seconds or when he leaves).

Checks: Guest gardener at points 0 (acorns 1 emerald -> 2, flowers 1 -> 3, golden fern 1 -> 4, Athelas 2 -> 1; buys bone meal
and seeds 32 -> 1, flowers 8 -> 1); blossom and corn seed unlock at 3 points, nectar bloom at 8; woodwright rope at 3; Friend
healer at 15 points (Healing 2 emeralds, Regeneration 4, Slow Falling 3, Miruvor 8) with the right potion effects; Uneasy
prices; refusal at Shunned and Hated; a band change between click and the next swap; a matching request without items shows the
request form with Trade and Farewell but no Hand over; a request with 16 bone meal completes; the elf stops and faces the
trading player; led-away elves still trade; a reload keeps no stale pass; Czech locale. Useful commands (test worlds only):
`/scriptevent lothlorien:harmony 10|5|-5|-20|-40`, `/scriptevent lothlorien:renown points 0|3|8|15`, and for a gardener request
`renown chapter 3` then `renown offer g_bonemeal`.

Open engine questions kept from the design: whether `persist_trades: false` rebuilds stock after a component-group change, and
whether `set_potion` yields the right potion (otherwise item data suffixes 21/28/40).

### Implementation (M3, accepted in game 2026-10-11; moved from the technical notes 2026-11-12)

Design and prices: `design/elven_inhabitants.md` section 4; regression checks: above. Reusable evidence: `.claude/skills/bedrock-modding/references/08-trading.md`.

- **Single source:** `scripts/trade_rules.js` (four traders, stock and prices, nine keys `uneasy`, `guest_0..3`, `friend_0..3`, click decisions, nearest/pinned player selection, the final-gift hook). Uneasy always has starting stock.
- **Generator:** `node tools/build_trades.mjs` writes 36 `trading/lothlorien/*.json` and only the generated trade property, groups and events in `entities/elf.json`; `--check` detects drift. One tier, one deterministic trade per group,
  9,999,999 uses, zero trader XP, explicit zero price multipliers (the documented omitted default is 0.05).
- **Entity:** enum `lothlorien:trade` (default `none`, persisted, not client synced); ten events swap the group by profession; the Loremaster has no table; `persist_trades: false` requests rebuilding offers; `trade_with_player` stops
  navigation and a separate `look_at_trading_player` faces the customer; delivery interactions exclude `lothlorien_trade_pass` as well as lead and name tag.
- **Runtime** (`scripts/trade.js`): one bounded six-block query per player every ten ticks, lazy band/rank reads, swaps only when the property changes; a trading player's pin lasts at most 600 ticks while within range, another
  player's mismatch click overrides it. **Click flow:** Shunned/Hated refuse first; a matching request without a pass opens `openTraderForm` (`loremaster.js`); a stale table cancels, swaps and asks for another click; otherwise native
  trading. The Trade button grants that player's next use on that elf for 200 ticks; used passes cover repeat events for ten ticks; pass tokens protect replacements from stale timers; leave/join clear state and tags. Before-handlers only
  read, cancel and touch JS maps; tags, swaps, chat and forms are deferred. The trade debug report was removed 2026-10-29. Hover guidance on the Trade button (grey second line) owner-confirmed (9cdd1a0 on 405d482).
- **Tests:** `tests/trade.mjs` (prices, stock, no cross-band arbitrage, request separation, ids, generation, bindings) and `tests/trade_glue.mjs` (callbacks, timers, form mapping, payment, stale-answer guards; awaited after
  static imports so the fake clock is not shared with the village glue tests).

## Healer

All values are in `scripts/healer_rules.js`; `tests/healer.mjs` runs the production module on the shared mock.

| Setting | Value |
|---|---|
| Check | every 20 ticks over loaded healers |
| Elves, wardens, the healer himself | Regeneration II, 8-block sphere |
| Players | Harmony Friend (+10) only, Regeneration I, 6-block sphere; Renown irrelevant |
| Patient | living, current health below effective maximum |
| Sight | head-to-head block ray; solid blocks stop it, liquids and passable plants do not |
| Grant | 60 ticks, renewed on the next check; equal or stronger effects are left alone, weaker ones upgraded |
| Blessing | 0.8 s arm raise with green happy-villager sparkles on the patients and the healer |

One blessing serves all eligible patients; two healers do not stack. No cooldown, direct health write, cure, item cost or
chasing. Fall damage is disabled for elves, so use `/damage @e[type=lothlorien:elf,c=1] 6 magic` to injure them without a Harmony
penalty. Test spawn: `/summon lothlorien:elf ~ ~ ~ ~ ~ lothlorien:as_healer`. Checks: alone, within 8 and 6 blocks, other
bands, walls, leaving range or losing Friend (at most three more seconds), potion interplay, two healers, walking and trading
while casting, leading the healer away, reload.

## Great Mallorn watch camps

Both lookout templates (round 5 and 7) have two persistent bow wardens, four rim lanterns, two native straw beds with heads
against the west trunk face, a small green rug, two native cushions and the silver banner of `design/banner.png`
(indented edges via NBT `bts`/`tts`). Owner's loot: arrow weight 6 in stacks of 4-8, rope 1-4, shield 50 %, no Elanor,
Niphredil, morning dew or bottled fireflies. Furnishing and loot live in `tools/watch_camp_rules.mjs` (arrow values share
`gift_rules.js`); `node tools/build_structures.mjs` reproduces the owner's loot exactly and leaves plain giants and village
pieces byte-identical. `tests/watch_camp.mjs` checks bed pairs against wood, cushion colours, persistent guards, six banner
layers, modeled deck light, rope access, exact generated bytes and the loot. Newly grown Great Mallorn nuts also place the
furnished templates in existing worlds. Reusable furnishing knowledge: skill `bedrock-worldgen`,
`references/15-native-camp-furnishings.md`.
