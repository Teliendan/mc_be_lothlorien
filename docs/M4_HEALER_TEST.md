# M4 healer: implementation and game checklist

2026-10-11; Bedrock 1.26.52 / stable Script API 2.8.0.
Implementation commit: `Implement M4 healer blessings for elves and Friends`.
Status: complete; owner accepted 2026-10-11 (bc1da69), after confirming the
injured-only rule. Offline checks pass. Individual in-game observations were
not supplied; acceptance does not establish every engine case below. Keep this
checklist for regressions.

Leave and re-enter the world after deployment. Existing healers gain healing;
no new world is needed. Villages made before M1 still have no civilian elves.

All values live in `lothlorien_bp/scripts/healer_rules.js`:

| Setting | Value |
|---|---|
| Loaded-healer check | Every 20 ticks (one second at 20 TPS) |
| Civilian elves, wardens, self | Regeneration II, 8-block sphere |
| Players | Harmony Friend (+10), Regeneration I, 6-block sphere; Renown irrelevant |
| Injury | Living, current health below effective maximum |
| Sight | Head-to-head block ray; solid obstacles block, liquids/passable plants do not |
| Effect duration | 60 ticks (3 seconds); reapply on the next check after expiry if still eligible |
| Existing regeneration | Equal/stronger effects finish untouched, including long/infinite effects; weaker effects are upgraded |
| Blessing | 0.8-second arm raise; native green happy-villager sparkles on patients and healer |

One blessing can help all eligible nearby patients. Two healers do not stack or
refresh a patient's effect during the same check. No cooldown, direct health
write, cure, item cost or patient-chasing AI. Day/night roaming, leads, shops
and requests retain their existing behavior. A granted effect naturally lasts
up to three seconds after leaving range, blocking sight or losing Friend.

For a controlled test away from village inhabitants:

```text
/summon lothlorien:elf ~ ~ ~ ~ ~ lothlorien:as_healer
/summon lothlorien:elf ~3 ~ ~ ~ ~ lothlorien:as_gardener
/scriptevent lothlorien:harmony 10
/damage @e[type=lothlorien:elf,c=1] 6 magic
```

Rotation placeholders before the spawn event are required. Use non-player
damage (for example the command's `magic` cause without an attacker) to injure
elves without the normal Harmony fight penalty. Fall damage is disabled for
elves, so falling is not a suitable way to injure them. For player healing,
use Survival, take damage, and temporarily disable natural regeneration in a
test world if hunger would mask the result; restore the original setting after.

| Check | Expected |
|---|---|
| Injured healer alone | Blesses self and gradually recovers; no other healer required. |
| Injured civilian or warden within 8 blocks | Regeneration II and sparkles; test both natural and persistent village wardens. |
| Injured Friend within 6 blocks | Regeneration I, slow gradual recovery; no Renown needed. |
| Guest/Uneasy/Shunned/Hated | No new player blessing. Existing granted regeneration expires normally. |
| Full health / outside radius / another dimension | No new blessing or idle casting. Vertical separation counts too. |
| Solid wall or deck between heads | No blessing through it. Remove the obstacle: blessing resumes within a second. |
| Stay hurt near healer for 15 seconds | Repeated healing with brief casts about every 3 seconds; verify actual health gains and no stalled cadence. |
| Leave range / lose Friend | No renewal, remaining effect lasts at most 3 seconds. Return with Friend: resumes without cooldown. |
| Drink Regeneration or Regeneration II | Equal/stronger potion remains at its original duration/potency; healer resumes after it ends. |
| Two healers together | No doubled player regeneration or repeated particle burst on the same patient. |
| Watch cast while walking/trading | Arms briefly lift and return; robe/accessories remain correct; native trading still works. |
| Lead healer elsewhere, including outside forest | New home/roaming and both kinds of healing work there. |
| Reload world or unload/reload village | Healing resumes without duplicate loops, stuck poses or Content Log errors. |

`tests/healer.mjs` exercises the production module with the shared API/scheduler
mock: eligibility, potency, timing, potion preservation, sight failures,
overlap, lazy Harmony reads, bounded query cadence, initial discovery,
profession changes, death/discovery races, unload/reload and cosmetic failures.
The finite generated animation and production Harmony injection are also checked.
The full suite is included in `tests/run.mjs` via `mods verify lothlorien`.
These checks do not establish engine regeneration cadence, pose blending,
particle appearance, ray/collision parity or performance in game.

No new UI text is introduced: existing localized healer names, shop and
Loremaster dialog are reused; the localization gate still covers all nine locales.
