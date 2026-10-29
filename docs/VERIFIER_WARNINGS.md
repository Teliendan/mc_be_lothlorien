# Documented verifier exceptions

Reviewed 2026-10-13, Bedrock 1.26.52 / stable API 2.8.0. Shared verifier:
**0 errors, 0 warnings, 15 documented exceptions**. Exact matches and reasons
are in [verification_exceptions.json](../lothlorien_bp/verification_exceptions.json).
Invalid/stale records fail; new diagnostics remain visible. No errors are excused.

| Count | Case | Reason and evidence |
| --- | --- | --- |
| 6 | Face-only filters: elven_chandelier, elven_lantern, elven_lantern_heartwood, firefly_jar, mallorn_pressure_plate, mallorn_heartwood_pressure_plate | Native filters restrict mounting faces; root `lothlorien:motion_support`, generated support policies and shared support-motion service implement survival after support edits/piston departure. The exception requires that custom component to remain present. [Support design and test limits](PISTON_SUPPORT.md). |
| 1 | phial_light has no Creative category | Hidden temporary script-owned airlike light, not a player inventory block. [Phial notes](GIFTS.md), [water policy](WATER.md), [materials](BLOCK_MATERIALS.md). |
| 1 | great_mallorn_nut is not compostable | Owner explicitly confirmed 2026-10-13: must not compost. Preserve rare gift/planting lifecycle; no compostable component. [White deer design](mobs/white_deer.md). |
| 3 | No entity names for elf_post, loop_marker, rail_mender | Deliberate non-spawn-egg helper omissions. elf_post records village role/location and is assigned/replaced by elves; loop_marker queues village planning and is removed on completion; rail_mender repairs missing structure rail connections once and removes itself. BP/client definitions and scripts/elf_village.js, loop_marker.js, rail_mender.js are the source evidence. |
| 4 | geometry.bow_standby, geometry.bow_pulling_0/1/2 outside local RP | All four exact IDs verified in installed `reference/vanilla/current/resource_packs/vanilla/models/entity/bow.geo.json`. Reuse the resting and three drawn native bow meshes with local Galadhrim textures/native controller; no need to duplicate models. The checker only resolves this RP. [Archery](ARCHERY.md). |

Starstone comparison: mounted Starstone devices declare no native
`minecraft:placement_filter`; `minecraft:placement_position` supplies mount state,
scripts/support.js checks placement/face eligibility, and starstone:piston_support
with the shared motion service handles original-support loss. Thus this specific
face-only native-filter warning does not apply. Both mods use scripted survival;
removing Lothlorien's filter would discard placement restrictions merely to silence
the diagnostic. Keep the design and record its exception.

Mallorn sapling uses explicit `menu_category: {"category":"none"}`, expressing
intentional hiding (planting is through the nut/acorn item); the checker accepts
that declaration. Phial omits the field entirely, hence its reviewed exception.

Entities do not *have* to remain unnamed. A display name could help command/debug
output, but it adds no projectile, village or repair behavior. Player-facing mobs
and inventory items keep localized names; invisible scaffolding and a grenade's
short-lived flight entity can intentionally omit a display label. This does not
prevent exact-ID targeting or script queries.

Evidence is source/static review, plus previously recorded support engine probes
and their limits. No new game tests. Production support edge cases and separate
bow behavior/rendering acceptance remain as listed in their design notes.
Shared mechanism: [verification exceptions](../../../.claude/skills/bedrock-lookup/references/verification-exceptions.md).
