# Sindarin voice event mapping

**Not implemented.** Design and source audit for Bedrock 1.26.52 / Script API
2.8.0, written 2026-10-16; nothing is bound in the pack or tested in game. The
recorded lines are final (owner-accepted 2026-10-25):
[`SINDARIN_VOICE.md`](SINDARIN_VOICE.md). Language labels:
[`SINDARIN_VOICE_PHRASES.md`](SINDARIN_VOICE_PHRASES.md).

## Design

A few named pools, not one line per lesson, request, item, rank or button.
One shared voice actor for all elves (owner, 2026-10-16). All four traders share
the opening and trade-approval pools. Conversation and trade use the same
opening pools.

Greeting means an actual use/click, not walking into a radius. One opening
covers conversation or trading. Repeated use events, retries and menu navigation
do not add speech. The player accepting a task and an elf accepting its
completion are separate commits with their own hooks.

## Pools and trigger points

Nine pool rows; `explain` covers lessons and quest offers. Each pool is one
sound event whose files are random variants. Files are in
`tools/audio/sindarin_voice/final/` (`.ogg` for the pack); `ma_*` and `mae_*`
serve two pools.

| Pool | Who | Existing event/action | Files |
| --- | --- | --- | --- |
| `opening_neutral` | Any eligible elf, incl. all four traders | First handled conversation use or approved native-trade click; Guest or Uneasy band | mae_govannen, suilad, tolo |
| `opening_warm` | Same | Same opening event, Friend band | mae_govannen_mellon, suilad_mellon_1, suilad_mellon_2, tolo_mellon |
| `trade_positive` | All four traders | Native RP sound event `haggle.yes` for `lothlorien:elf`; firing conditions on a custom elf need an engine test | ma_1, ma_2, mae_1, mae_2 |
| `explain` | Loremaster | Entering `lessonScreen` for a selected lesson, or `kinOfferScreen` after a valid request offer resolves | lasto_1, lasto_2, lasto_beth_lammen, tolo_a_lasto |
| `task_taken` | Loremaster | Successful `takeLesson(...)` or `accept(...)`, after saving state | caro_mae, dandolo_1, dandolo_2 |
| `completion` | Receiving trader or loremaster | `handOver(...)` or `turnInLesson(...)` returns true; also successful `completeLore(...)` ("I understand") | ma_1, ma_2, mae_1, mae_2, mae_garnen |
| `refuse_speak` | Traders or loremaster | Existing Shunned refusal branch; Hated stays silent | avon_1, avon_2, avam |
| `combat_start` | Warden | `minecraft:on_target_acquired` -> `lothlorien:become_angry` (hostile targets, retaliation, joining combat) | daro, baw, avo_garo |
| `healing` | Healer | `blessNearby()` batch with `blessed === true` (blessing animation) | cuio_mae_1, cuio_mae_2, cuio_mae_3 |

`completion` is generic approval, so it also fits understanding a lore lesson.
No rank-up, chapter-opened, task-ready or item-specific pools; existing UI, chat
and sounds explain those. A request completion plus rank-up speaks once.

Variants are picked per file, so a text with two recordings would play twice as
often as one with a single file. When binding, give each file a `weight` in
`sound_definitions.json` so every text in a pool is equally likely (vanilla uses
per-file `weight`; not yet tested on these assets).

### Harmony selects the opening

Use `bandOf` in `scripts/harmony.js`, in this order:

1. Hated (-60..-30): civilian silence; wardens still speak on combat start.
2. Shunned (-29..-15): `refuse_speak` and return, no greeting. A calm, curt
   refusal, distinct from warden warnings and native `haggle.no`.
3. Friend (+10, the current maximum): `opening_warm`.
4. Guest (0..+9) or Uneasy (-14..-1): `opening_neutral`. Uneasy keeps its
   existing limited access.

Conversation and approved native-trade use both choose from these pools. Pass
granting and table-swap retries add no second opening; one opening spans a
delivery-form-to-trade transition. No new interaction type or proximity scan.
A later delivery-only "thank you" (*Annon allen*) would replace a completion
variant only where gratitude fits, never for merely reading a lesson.

## Event audit and limits

### Native trading

- `scripts/trade.js:onInteract` distinguishes `trade`, `form`, `swap` and
  `refuse`. Only `trade` is the approved native-use path. `grantPass` and
  `swap` can ask for another click; they do not prove the screen opened. Speech
  at the approved click is feasible, but it is not a screen-open callback.
- `reference/server-2.8.0.d.ts` has no trading or trade-screen-close callback.
  Do not infer purchases or closure from the 30-second table pin, distance,
  inventory diffs or a timer.
- Vanilla `sounds.json` binds `haggle`, `haggle.yes`, `haggle.no` for villagers
  and wandering traders (not `trade`/`yes`/`no`). Whether a custom elf emits
  `haggle.yes` only on completed exchanges or also on valid offer/payment states
  is untested.
- Do not bind `haggle` to an opening pool: browsing is not one screen-open
  event. Closing the window gets no farewell. If custom haggling does not fire,
  leave `trade_positive` inactive and report it; no synthetic transaction tracker.

### Forms, tasks and refusal

- `scripts/loremaster.js` owns `lessonScreen`, `kinOfferScreen`, `takeLesson`,
  `accept` and `completeLore`. `scripts/renown_game.js` owns `handOver` and
  `turnInLesson` and already receives the speaking elf as `at`.
- Explain once on entering a selected content screen, not on the chapter list,
  Back/Continue or a UserBusy retry. The form promise resolves on response, not
  on display, so this accompanies an admitted screen attempt with a
  once-per-transition guard. If busy-screen speech is frequent in tests, move it
  to successful selection rather than polling for display.
- `task_taken` only after successful acceptance, not on preview. Completion
  only after a successful commit, never on the button click. One owner per
  result; no caller sound plus a `celebrate` sound.
- `traderDialog` has a Farewell button, but ordinary closure cannot tell it from
  Escape, a busy form or walking away, so no farewell pool.
- Shunned text refusals speak. Hated loremaster and trader refusals stay silent.
  The Harmony reminder for Uneasy uses normal explain audio.

### Wardens and greetings

- Hook: `entities/elven_warden.json`, `minecraft:on_target_acquired` and
  `events.lothlorien:become_angry`. Subscribe to that event or add a guarded
  native sound response. Not arrow-shot or hurt events. Debounce target
  reacquisition and group combat.
- The warnings must fit any enemy: no "Run!" default and no Orc-specific
  *Gurth an Glamhoth* against every target.
- Wardens have no greeting branch. A minimal handler may use
  `playerInteractWithEntity` if the engine dispatches it for the custom warden;
  if not, omit warden greetings rather than add proximity sensors.
- Civilian greeting belongs at session admission; no second shop greeting.
  Skipped lead/name-tag interactions stay silent.

### Healing

- `scripts/healer.js:blessNearby` aggregates care into one `blessed` flag and
  one animation per batch. Speak there once, not per `care` call or effect
  refresh, with a long cooldown for sustained injuries.
- *Cuio mae* is a blessing while healing, not a claim of full health.

## Restraint rules (proposed)

- One line per accepted interaction. Completion or refusal replaces the greeting.
  No queues of obsolete lines.
- Keep existing repeated-use guards; add only small event-local cooldown maps,
  no world scans or recurring loops.
- Starting cooldowns (tuning values, not engine facts): 4 s per elf, 30 s for a
  repeat greeting to the same elf/player, 15 s combat, 30 s healing. Completion
  and combat may bypass the ordinary wait but drop lower-priority speech instead
  of layering. Recorded clips are 0.35-1.53 s.
- Native `haggle.yes` is outside script dispatch; script cooldowns cannot
  throttle it. Its clips (Ma, Mae) are 0.35-0.6 s. Test rapid trade clicks and
  delivery-to-trade transitions; no promise of global overlap prevention.
- Play world speech from the entity position; menu chatter quiet. One actor for
  all professions and pools; delivery varies, identity does not.

## Validation before rollout

1. Confirm native `haggle.yes` on a custom elf: browse, select an offer, insert
   insufficient/sufficient payment, complete one/many trades, close without
   buying. Record which actions emit `haggle`, `.yes` and `.no`.
2. Confirm the approved trade click and warden ordinary-use callbacks in game.
3. Check held use, UserBusy retries, Back navigation, delivery plus rank-up,
   depleted inventory at hand-in, multi-warden combat and sustained healing.
4. Bind the pools as sound events in the resource pack, run `.\mods verify` and
   deploy before owner testing.

Official review 2026-10-16: the
[26.50 changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound),
[26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
and the
[economy trade table reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_economy_trade_table?view=minecraft-bedrock-stable)
add no trade-result/close callbacks or custom haggling semantics. No engine bug
or workaround is asserted.
