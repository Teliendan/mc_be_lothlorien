# Bow of the Galadhrim and arrows (M5)

Implemented 2026-10-11 for Bedrock 1.26.52 / stable server API 2.8.0.
Owner feedback 2026-10-11: the bow draws without a visible nocked arrow and
without zoom; its limbs look too wide and held size too small. The previous FOV
implementation passed a lowercase command easing name to the Script API enum,
and the permissive camera mock hid that error. The enum fix and progressive zoom
are **offline tested only**; owner engine acceptance is pending. M0 native enchantment/flight/pickup observations
are recorded in `design/elven_inhabitants.md` section 8.

`gift_rules.js` owns balance: draw 0.6s (12 ticks), durability 384, enchantability 1,
zoom FOV 60 easing over the full 0.6s draw, active-draw cleanup every 2 ticks,
recovery 100%. This is a modest zoom at the default FOV 70; the stable API has no
normal-FOV getter, so the target cannot follow each player's personal FOV setting.
`python -B mods/lothlorien/tools/make_galadhrim_archery.py` regenerates item and
arrow JSON, attachable/render controller and original pixel icons/pull frames.
The pinned native-arrow input is tracked in `tools/reference/native_arrow_base.json`;
regeneration does not need the original M0 scratch files on another computer.
Vanilla native bow meshes are reused with all four exact texture keys; the local
animation lowers third-person grip by 3 model units while retaining first person.
The bow identifier stays `lothlorien:bow` to get the native two-arm pose.

Speed polish 2026-10-12: the owner reported that 0.8s did not feel noticeably
quicker and asked for a stronger improvement, with possible animation mismatch.
Charge is now 0.6s: 25% less time than the previous 0.8s and 40% less than the
documented vanilla 1s full charge. The native shooter maximum, custom-arrow
critical threshold, Molang charge denominator (12 ticks), texture frame changes
and FOV ease all share that timing. The installed native first-person pull
animation (`vanilla_1.18.10/animations/bow.animation.json`) uses a fixed drawn
pose and begins its shake when `variable.charge_amount >= 1`; it has no separate
hard-coded one-second draw that needs replacing. The same charge variable now
reaches one at 12 ticks. Native flight/damage/enchantment data remains unchanged.
Source and Node checks establish matching configured timing; the quicker feel,
client interpolation and full-charge damage/crit at 0.6s still need engine checks.

Visual polish 2026-10-11: the current default is the slender mallorn longbow.
Its limbs use two-pixel shading rather than the previous broad three-pixel strip,
with a muted grey hithlain string separated from the wood. The idle silhouette
spans 15 texels in height (previously 13), and the local grip animation scales
the native mesh to 1.12. This is a modest size increase over the vanilla bow;
first-person screen size still needs owner acceptance alongside the new zoom.
All three pull textures now contain the nocked shaft and silver arrowhead;
vanilla's arrow is painted into its pull textures rather than supplied by the mesh.
Icons and all draw frames were compared with vanilla, then actual native
texture-mesh extrusions were rendered and inspected in Blockbench. These checks
establish silhouette and visible arrow geometry, not the in-game hand placement.

Owner selections 2026-10-11: **bow C, slender mallorn longbow**, and **arrow 3,
broad silver point with green feathers**. Bow C textures and its 1.12 held scale
are unchanged by the selection. The selected arrow icon is reproduced directly
by the production generator, with no scratch dependency; its pixels match the
approved sheet exactly. Projectile flight and damage stay unchanged. These are
owner sheet selections; the corrected first-person bow still needs game acceptance.

Production retains only selected bow C and arrow 3. Review scratch is removed
after final art selection. Art implementation: `Apply selected gift art and faster
bow draw` (`03cc808`); final worn choices: `Finalize selected Galadriel worn gifts`.

Wrong-bow hint 2026-10-13 (owner request: players may get arrows before the bow).
A vanilla bow cannot draw with only Galadhrim arrows. When a player uses a vanilla bow,
no draw starts that tick and Galadhrim arrows are in the inventory or off-hand, chat
shows `archery.normal_bow` ("A normal bow cannot shoot Galadhrim arrows"), at most once per
10 s. Owner choices: keep it vague, without naming the elven bow; use chat, not the action
bar, because the action bar competes with the Harmony status. The trigger was probed in
game on 1.26.52: a refused draw fires `itemUse` but no `itemStartUse`. The probe has been
removed. The hint itself needs an in-game check.
A tooltip line on the arrows was considered as well; it was not built.

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

The camera call uses `EasingType.Linear` (API value `"Linear"`); `"linear"` is
command syntax and invalid here. Unexpected zoom/cleanup failures each produce
at most one Content Log warning per script load. A failed camera call retains
the ownership marker if cleanup also fails, then retries cleanup on spawn/reload.
Native `itemStartUse` / release / stop events remain the only draw triggers. The
stable 2.8 declarations contain no `Player.getItemUseDuration` API; no speculative
polling or scripted replacement of native shots was added. The enum mismatch is
a concrete source defect, not evidence of an engine event bug.

Run `node mods/lothlorien/tests/archery.mjs`: seven groups exercise production
callbacks/scheduler, native projectile parity and bindings. They establish event
glue and cleanup, not engine rendering, FOV, physics or enchantment results.
The camera fake now rejects lowercase easing, so reintroducing the original
argument fails the draw/ownership assertions. Tests also cover progressive ease,
bounded diagnostic logging and cleanup after camera failure. They evaluate the
generated charge/frame expressions at 6, 9 and 12 ticks, require full draw at
12 ticks and check that the custom-ammo critical threshold matches native charge.

Mandatory owner checks: two-arm pose and lower grip in third person, all pull
frames in first/third person, zoom and release/cancel/slot/death/portal/reload
cleanup, table/anvil Power/Punch/Flame/Infinity, identical aim/full-hit damage
against vanilla, custom-arrow entity recovery and ground pickup. Custom ammo can
crit at 0.6s; vanilla ammo retains its native threshold, so compare 0.6s and 1s.
M0 did not record Infinity's custom-arrow consumption: verify exactly one custom
arrow is consumed and returned, including creative, with no ammo duplication.
Infinity officially saves normal arrows only; custom consumption is an inference,
not an observed result. Recovery remains 100% per the explicit owner decision.

Reusable template and source audit: `C:/mcmods/.claude/skills/bedrock-items/templates/custom_archery/`.
The snapshot includes this polishing pass; shared reference
`.claude/skills/bedrock-items/references/custom-bow-polish.md` records evidence and limits.
