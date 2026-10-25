# Bringing wildlife home

Owner decisions, 2026-10-11; target Bedrock 1.26.52 / server 2.8.0.
Shared verification and all project regressions passed (0 errors, 10 existing
warnings). Deployed on 2026-10-11. Owner accepted this feature as done on 2026-10-11.
Acceptance records completion; no new in-game test results were supplied.

Animal design principle: every new animal needs an explicit transport, food,
healing, persistence and breeding decision in its design sheet. Prefer a lead and
a matching food lure. Only animals that do not breed heal from accepted food:
2 HP (one heart), capped at maximum health. Breeders use food for breeding and
baby growth instead. Breeding is optional. Explicit exceptions are sacred white-deer guidance,
unicorn bonding and riding, and bottle-only fireflies. Use native entity behaviors
where possible; scripts handle biome-dependent gifts and bottle inventory changes.

Accepted-heal policy (2026-10-20): once feeding/healing is accepted, later player status, held item, movement or
dimension must not revoke it. Bonded unicorn care is the native Elanor `healable` (2 HP, `force_use:false`); other
animal food healing is synchronous or native. Details: [parity/CREATURES.md](../parity/CREATURES.md).

| Animal | Transport and food | Breeding / persistence |
| --- | --- | --- |
| Deer | Existing lead and Western Corn grain | Existing breeding and feeding persistence |
| White deer | Existing lead/acorn lure; outside Lothlorien, acorns are ordinary food | No breeding; outside feeding keeps it, without consuming its lifetime gift |
| Unicorn | Existing Elanor bonding and riding; accepted offers heal, bonded owner can heal with Elanor | No lead/breeding; bond keeps it |
| Squirrel | Lead; existing acorn lure; outside Lothlorien, acorns are ordinary food | No breeding; outside feeding keeps it; lead interrupts an errand |
| Swan | Lead; lure/feed with wheat or Western Corn grain | Breed anywhere; cygnets grow in 20 minutes, food speeds growth; 10% of natural spawns are cygnets, using existing near-Lothlorien river judging |
| Songbird | Lead plus native anchor; lure/feed with wheat or Western Corn grain | No breeding; feeding keeps it |
| Butterfly | Lead plus native anchor; lure/feed with vanilla flowers and Lothlorien flowers | No breeding; feeding keeps it |
| Firefly | Catch with empty bottle, preserving captured name/current health; use full bottle on a block face to release one and get plain empty glass back | Released firefly is persistent; wild ones retain normal despawn; no lead, lure, food or breeding |

Songbirds fly independently (no flocking); songbird/butterfly leads have native anchors. Firefly bottles keep max 16;
healthy unnamed captures are plain, captured name/current health use localized raw lore. Anvil bottle titles do not
rename the animal. See [parity/CREATURES.md](../parity/CREATURES.md).

Grain means harvested wheat / Western Corn grain, not seeds. Swan luring follows
existing calm/Friend wariness; alarms and negative Harmony still take precedence.
Flying lures work vertically. Swans use their existing surface-water navigation.
Cygnets use the existing swan model scaled to 45%, with no separate art pass.
Persistence prevents ordinary despawn; it does not stop wandering or damage.

Owner clarification2026-10-20: only domesticated squirrels stay. Preserve the
existing outside/leashed feeding paths that add kept persistence. Inside wild
healing and errand acceptance do not add it; already kept animals retain it.
Handlers use one ordinary food/eligibility decision, with no additional food consumer for native breeders. Decisions:
[parity/CREATURES.md](../parity/CREATURES.md).

Outside food is decided at the animal's location using the existing depth sampler
(including rivers that run through Lothlorien). Unknown/unloaded samples do not
silently count as outside. Ordinary food does not award a gift deed, spend the
white deer's lifetime gift, or start/advance a squirrel cooldown.

Verification covers the source and offline interactions. Rendering, native
pathfinding and persistence across real game reloads have not been independently
confirmed in this session.

Validation: `mods verify lothlorien` and the verified `mods deploy lothlorien`
passed with 0 errors / 10 existing warnings, including the full regression suite.
New regressions live in `tests/animal_home.mjs`; `tests/run.mjs` also checks that
an unreadable centre biome sample is incomplete rather than confirmed outside.
Existing world terrain is unchanged; cygnets are natural spawn behavior and can
appear on existing rivers. Reload the world to load the updated packs.
Shared knowledge commit: `d7b6f52` (workspace repository).

Feature commit: `Make Lothlorien wildlife transportable and feedable`.
