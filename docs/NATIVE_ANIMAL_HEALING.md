# Accepted animal healing and native unicorn care

Owner clarification2026-10-20; Bedrock1.26.52 / stable Script API2.8.0.
Implemented, verified and deployed; all3 packs confirmed in sync.
No new in-game result.

Once animal feeding/healing is accepted, later player status, hand, movement,
dimension or availability must not revoke that accepted heal. Initial food,
access and gameplay eligibility still apply. Prefer native healing+consumption
together rather than deferring a hand-dependent script action.

Bonded unicorns now declare `minecraft:healable` only in `lothlorien:bonded`:
Elanor restores2HP, `force_use:false` keeps it injured-only. Existing owner
before-event access remains unchanged: foreign players are cancelled, while
owners proceed to native healing/rideable processing. The injured-owner
cancel/system.run/repeatedUse food branch is removed. There is no later script
callback that can reject healing because the player moved, switched items,
changed status or left. Full-health food use is not forced; normal mounting is
the intended native path.

Wild unicorns have no native healable component. Their accepted three Elanor
trust offers still charge once, heal2HP synchronously, obey10-second spacing and
Creative consumption rules, then bond/persist with the existing owner. No
double native/script food consumer is introduced during trust offering. Entity
and make_unicorn.py behavior data agree; generator was not executed, RP and
swimming/bond/riding balance remain unchanged.

Source audit found no other deferred animal food healing to fix: deer food is
native; white-deer/squirrel accepted scripted food and unicorn trust healing
run synchronously; songbird/butterfly healing is native. The white-deer gift-spot
job precedes acceptance and its heal occurs synchronously when guidance starts.
Scheduled wariness/state restoration and cosmetic messaging do not defer food
healing. Shared animal_food.js remains unchanged. Healer-NPC ongoing blessings
are a separate proximity mechanic, not an accepted animal feeding action.

Newest installed1.26.50 horse has native healable beside rideable, with no extra
item filter for ordinary equine feeding. Official [healable documentation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_healable?view=minecraft-bedrock-stable)
confirms force_use defaults false and controls use at full health. This supports
the native route but does not establish custom owner/heal/mount precedence in
game. Native acceptance needs injured-owner single/stacked/Creative Elanor,
full-health normal mounting/no forced food charge, stranger rejection and
existing three-offer bonding/reload outcomes. Do not simulate native healing in
an offline fixture and then report native precedence confirmed.

Selected verification2026-10-20: unicorn, animal-home, performance, suite-layout:
4 runners passed. Production BP/RP0 errors/0 warnings/15 documented exceptions;
unchanged optional probe0 errors/1 warning. Tests check bonded-only data,
uncancelled injured/full-health owner handoff with no deferred script work,
unchanged stranger gate, no duplicate scripted healing/charge, and actual wild
trust/2HP/three-offer/Creative integration. An AST-only generator check confirms
the same bonded-only healing data without running art generation.

This follow-up implements accepted healing policy, not the remaining Group14
audit proposals. [Unicorn review](UNICORN_INTERACTIONS.md) still tracks those.

Root completion2026-10-20: reviewed production/data/generator/tests, deployed
the exact4 selected suites above with recorded passing verifier results.
Two BP files copied (unicorn.js and entities/unicorn.json),0 removed; RP/probe
unchanged. Subsequent mods status confirmed all3 packs in sync at main@be368ff,
243 uncommitted. No worldgen change. Leave/re-enter the world to load it.
Shared global healing policy/current handoff recorded separately in workspace
commit `cfb84b3`; no mod commit made. Native healing/mount acceptance remains open.
