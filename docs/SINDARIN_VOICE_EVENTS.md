# Sindarin voice event mapping proposal

2026-10-16. Owner liked the phrase candidates and requested a small systematic
mapping to existing game interactions. This is a source-audited proposal for
Bedrock 1.26.52 / Script API 2.8.0, not an implemented or in-game-tested feature.
Phrases and T/E/N language labels remain in
[`SINDARIN_VOICE_PHRASES.md`](SINDARIN_VOICE_PHRASES.md).

## Design

Use a few named pools, not individual lines for every lesson, request, item,
rank or menu button. Owner decision 2026-10-16: one shared voice actor is enough.
The selected actor/delivery is Spanish Chatterbox F, "Gentle, a little more
inflection"; use the preserved reference and settings in
[`SINDARIN_VOICE_SETUP.md`](SINDARIN_VOICE_SETUP.md).
All four traders get the same three neutral openings, three warm openings and
two native trade-approval lines. Conversation and trade use the same opening
pools; this replaces the earlier separate trade-opening pool.

Greeting means an actual use/click, not walking into a radius. One opening
covers either conversation or trading. Repeated use events, retries and menu navigation
do not create extra conversation. The player accepting a task and an elf
accepting its completion are different commits and both have explicit hooks.

## Pools and real trigger points

Counts are proposed recording slots. Nine pools cover the interactions below.
The lesson and quest-offer rows deliberately share one explanatory pool. Shared
phrases can reuse the same audio asset within a voice, giving 22 pool slots but
20 distinct texts. Wording remains subject to pronunciation and language review.
The one-voice pronunciation sheet is
[`SINDARIN_VOICE_PRONUNCIATION.md`](SINDARIN_VOICE_PRONUNCIATION.md).

| Pool | Who | Existing event/action | Slots | Suggested wording |
| --- | --- | --- | --- | --- |
| `opening_neutral` | Any eligible elf, including all four traders | First handled conversation use or approved native-trade click; Guest or Uneasy band | 3 each, shared | Mae govannen (T); Suilad (N); Tolo (T) |
| `opening_warm` | Any eligible elf, including all four traders | Same opening event, but Friend band | 3 each, shared | Mae govannen, mellon (N); Suilad, mellon (N); Tolo, mellon (N) |
| `trade_positive` | All four traders | Native RP sound event `haggle.yes`, mapped for `lothlorien:elf`; exact custom-elf firing conditions need an engine test | 2 each, shared | Ma! (T); Mae. (T) |
| `explain` | Loremaster | Entering `lessonScreen` for a selected lesson | 3, shared with quest offers | Lasto (T); Lasto beth lammen (E); Tolo a lasto (N) |
| `explain` | Loremaster | Entering `kinOfferScreen` after a valid request offer is resolved | Same 3 | Same explanatory openings; no per-request lines |
| `task_taken` | Loremaster | A successful `takeLesson(...)` or `accept(...)`, after saving the changed state | 2 | Caro mae (N); Dandolo (N) |
| `completion` | Receiving trader or loremaster | `handOver(...)` or `turnInLesson(...)` returns true after completing the task; also successful `completeLore(...)` for "I understand" | 3, shared | Ma! (T); Mae. (T); Mae garnen (N) |
| `refuse_speak` | Traders or loremaster | Existing Shunned refusal branch; Hated civilian silence remains | 2 | Avon (T, "I will not"); Avam (T, "We will not") |
| `combat_start` | Warden | Existing `minecraft:on_target_acquired` -> `lothlorien:become_angry`; fires for hostile targets, retaliation and joining combat, not only the player-hurts-warden script path | 3 | Daro! (T); Baw! (T); Avo garo! (T) |
| `healing` | Healer | Existing `blessNearby()` batch has `blessed === true` and plays the blessing animation | 1 | Cuio mae (N) |

`completion` uses generic approval, so it also fits understanding a lore lesson.
No separate rank-up, chapter-opened, task-ready-in-the-wilderness, or item-specific
voice pools. Existing UI/chat/sound feedback continues to explain those results.
If a request completion and a rank-up occur together, the elf speaks once.

### Harmony selects the opening

Use the existing `bandOf` in `scripts/harmony.js`, in this order:

1. Hated (-60..-30): civilian silence; wardens can still speak on combat start.
2. Shunned (-29..-15): `refuse_speak` and return, with no greeting or invitation.
   Calm, curt refusal is distinct from warden warnings and native `haggle.no`.
3. Friend (+10, the current maximum): `opening_warm`.
4. Guest (0..+9) or Uneasy (-14..-1): `opening_neutral`. Uneasy retains the
   existing limited access; negative Harmony does not always mean total refusal.

Both ordinary conversation and actual approved native-trade use choose from
these pools. Pass granting/table-swap retries do not add another opening.
Keep one opening across a delivery-form-to-trade transition. No new interaction
type or proximity scan is needed.

For a later quest-delivery-only "thank you", replace one completion slot only
where gratitude fits. Do not say "I thank you" when the player merely reads a
lesson. This is a reason to keep the initial shared pool generic.

## Event audit and important limits

### Native trading

- `scripts/trade.js:onInteract` distinguishes `trade`, `form`, `swap` and
  `refuse`. Only `trade` is the approved native-use path. `grantPass` and
  `decision.action === "swap"` can ask for another click; they are not evidence
  that the trade screen opened. A spoken invitation at the approved click is
  feasible, but this is not a confirmed screen-open callback.
- The pinned `reference/server-2.8.0.d.ts` has no trading callback/component or
  native trade-screen-close callback. Do not infer completed purchases or UI
  closure from the 30-second table pin, distance, inventory diffs or a timer.
- Installed vanilla `resource_packs/vanilla/sounds.json` binds `haggle`,
  `haggle.yes`, `haggle.no` for villagers and wandering traders. The sound
  vocabulary is not `trade` / `yes` / `no`.
- Bind native `haggle.yes` to short, neutral approval. The local reference proves
  the event names and vanilla bindings, not whether a custom elf emits them
  only on completed exchanges or also on valid offer/payment states. Test the
  existing economy-table custom elf before advertising exact semantics.
- Do not bind `haggle` to an opening pool: browsing/haggling is not a single
  screen-open event. Do not play greetings repeatedly through ambient sounds.
- "Finishing trade" therefore means native positive feedback around an exchange,
  subject to the above check. Closing the window gets no dedicated farewell.
  If custom native haggling does not fire, leave this pool inactive and report
  that limit; do not build a synthetic transaction tracker.

### Forms, tasks and refusal

- `scripts/loremaster.js` owns `lessonScreen`, `kinOfferScreen`, successful
  `takeLesson`, `accept` and `completeLore`. `scripts/renown_game.js` owns
  `handOver` and `turnInLesson` and already receives the speaking elf as `at`.
- Play explanations once on entering a selected content screen, not on the
  chapter list, every Back/Continue button, or a UserBusy retry. The existing
  form promise returns on response, not at confirmed display time. Explain audio
  can accompany an admitted screen attempt, with a once-per-transition guard;
  do not describe this as an exact rendered-form notification. If engine tests
  expose frequent busy-screen speech, defer content audio to successful user
  selection/acceptance rather than adding a polling display detector.
- `task_taken` fires only after successful acceptance, not while previewing an
  offer. Completion fires only after successful validation/commit, never because
  a hand-over button was clicked. Route success through one owner; do not add
  both a caller sound and a `celebrate` sound for the same result.
- `traderDialog` has an explicit Farewell button, but ordinary closure does not
  distinguish a polite departure from Escape, a busy form or walking away.
  A separate farewell family would give uneven coverage, so omit it initially.
- Existing Shunned text refusals can speak. Hated loremaster silence remains;
  treat hated trader refusals as silent too, rather than adding friendly openings.
  The always-available Harmony reminder for Uneasy uses normal explanation audio.

### Wardens and greetings

- Source hook: `entities/elven_warden.json`, `minecraft:on_target_acquired` and
  `events.lothlorien:become_angry`. Subscribe to the resulting data-driven event
  or add a guarded native sound response. Do not use arrow-shot/hurt events as
  fight-start substitutes. Debounce target reacquisition and group combat.
- The three warning lines must fit any enemy. Do not use "Run!" as the default
  attack cry, or the Orc-specific *Gurth an Glamhoth* against every target.
- Wardens currently have no greeting interaction branch. A minimal use handler
  can consume the same `playerInteractWithEntity` event if the engine dispatches
  it; verify this on the custom warden before including greeting coverage.
  If the guard's ordinary click does not arrive, omit its greeting in the first
  pass instead of adding proximity sensors or a new conversation mechanic.
- Civilian greeting belongs at session admission. Use the same Harmony-selected
  opening for ordinary trading; do not add a second shop greeting for that use.
  Existing skipped lead/name-tag interactions stay silent.

### Healing

- `scripts/healer.js:blessNearby` already aggregates successful care into one
  `blessed` flag and plays one animation per batch. Speak at that point once,
  not from each `care` call or every refreshed regeneration effect. Use a longer
  voice cooldown so sustained injuries do not produce speech every few seconds.
- *Cuio mae* is a blessing while healing is applied, not a claim the patient's
  health is full. No separate completed-healing detector is required.

## Proposed restraint rules

- One line per accepted interaction. Select the opening by Harmony;
  completion/refusal replaces any greeting for a ready turn-in
  or refused interaction. No queues of obsolete lines.
- Retain the existing repeated-use guards. Add only small event-local voice
  cooldown maps; no world scans or additional recurring discovery loop.
- Start with a 4-second ordinary per-elf speech cooldown, 30 seconds for repeat
  greetings to the same elf/player, 15 seconds for combat warnings and 30 seconds
  for healing. These are proposed tuning values, not engine facts. Completion
  and combat may bypass the ordinary waiting period but should drop or replace
  lower-priority pending speech rather than layering clips. Final timings must
  account for recorded clip length.
- Native `haggle.yes` happens outside script dispatch; script cooldowns cannot
  throttle or cancel it. Keep its two approval clips especially short. Test
  rapid trade clicks and immediate transition from delivery to native trading;
  do not promise global overlap prevention for engine-generated audio.
- Use the entity as the positional sound source for world speech. Menu chatter
  should be quiet. Use one fixed actor/reference across professions and pools;
  warm, neutral, curt and urgent delivery vary performance, not identity.

## Validation before audio rollout

1. Confirm native `haggle.yes` on a custom elf: browse, select an offer, insert
   insufficient/sufficient payment, complete one/many trades, then close without
   buying. Record exactly which actions emit `haggle`, `.yes` and `.no`.
2. Confirm approved trade click and warden ordinary use callbacks in game.
3. Check held use, UserBusy retries, Back navigation, delivery plus rank-up,
   depleted inventory at hand-in, multi-warden combat, and sustained healing.
4. Finalise wording and prepare pronunciation/voice takes only
   after these source/engine distinctions are accepted. Pack changes will require
   shared verification and deployment before owner testing.

Official review on 2026-10-16: the
[26.50 changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)
and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
do not establish new native trade-result/close callbacks or custom haggling
semantics. The current
[economy component reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_economy_trade_table?view=minecraft-bedrock-stable)
documents trading UI/table configuration, not those missing script callbacks.
No engine bug or workaround is asserted here.

Additional attested refusal form: *avam* "we won't", PE17/143 and WJ/371,
via [Eldamo: ava-](https://eldamo.org/content/words/word-3865426267.html).
