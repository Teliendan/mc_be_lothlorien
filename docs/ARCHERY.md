# Bow of the Galadhrim and arrows (M5)

Implemented 2026-10-11 for Bedrock 1.26.52 / stable server API 2.8.0.
Final pose, pull frames, FOV and 0.8s charge are **offline tested only**; owner
engine acceptance is pending. M0 native enchantment/flight/pickup observations
are recorded in `design/elven_inhabitants.md` section 8.

`gift_rules.js` owns balance: draw 0.8s, durability 384, enchantability 1,
zoom FOV 60 with 0.15s ease, active-draw cleanup every 2 ticks, recovery 100%.
`python -B mods/lothlorien/tools/make_galadhrim_archery.py` regenerates item and
arrow JSON, attachable/render controller and original pixel icons/pull frames.
Vanilla native bow meshes are reused with all four exact texture keys; the local
animation lowers third-person grip by 3 model units while retaining first person.
The bow identifier stays `lothlorien:bow` to get the native two-arm pose.

Damage, aim, native enchantments and ammunition selection stay native. Custom
arrow projectile values equal the current vanilla ordinary player/mob arrow
(crossbow branches are omitted). A hit recovers at the event location after the
custom projectile is destroyed; bounces yield no item and ground pickup stays
native. New arrows are woodwright stock (Trusted), and enter the existing Great
Mallorn chest pool in stacks of 4-8 (weight 2). The bow is the woodwright's final
Friend/Elf-friend gift, costing 32 emeralds.

FOV is owned only while drawing this bow. Release/stop, slot or hand changes,
death, dimension transfer, leave, spawn and reload clean it up. No idle timer or
world entity scan. Persistent owned marker retries cleanup after unavailable
cameras. Simultaneous camera add-ons need coordination because API 2.8.0 has no
getter for another add-on's FOV override.

Run `node mods/lothlorien/tests/archery.mjs`: six groups exercise production
callbacks/scheduler, native projectile parity and bindings. They establish event
glue and cleanup, not engine rendering, FOV, physics or enchantment results.

Mandatory owner checks: two-arm pose and lower grip in third person, all pull
frames in first/third person, zoom and release/cancel/slot/death/portal/reload
cleanup, table/anvil Power/Punch/Flame/Infinity, identical aim/full-hit damage
against vanilla, custom-arrow entity recovery and ground pickup. Custom ammo can
crit at 0.8s; vanilla ammo retains its native threshold, so compare 0.8s and 1s.
M0 did not record Infinity's custom-arrow consumption: verify exactly one custom
arrow is consumed and returned, including creative, with no ammo duplication.
Infinity officially saves normal arrows only; custom consumption is an inference,
not an observed result. Recovery remains 100% per the explicit owner decision.

Reusable template and source audit: `C:/mcmods/docs/templates/custom_archery/`.
It is staged outside `.claude/` because that directory is blocked for this agent;
an authorized maintainer can move it into bedrock-items after owner acceptance.
