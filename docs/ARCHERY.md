# Bow of the Galadhrim and arrows (M5)

Implemented 2026-10-11 for Bedrock 1.26.52 / stable server API 2.8.0.
Owner feedback 2026-10-11: the bow draws without a visible nocked arrow and
without zoom; its limbs look too wide and held size too small. The previous FOV
implementation passed a lowercase command easing name to the Script API enum,
and the permissive camera mock hid that error. The enum fix and progressive zoom
are **offline tested only**; owner engine acceptance is pending. M0 native enchantment/flight/pickup observations
are recorded in `design/elven_inhabitants.md` section 8.

`gift_rules.js` owns balance: draw 0.8s, durability 384, enchantability 1,
zoom FOV 60 easing over the full 0.8s draw, active-draw cleanup every 2 ticks,
recovery 100%. This is a modest zoom at the default FOV 70; the stable API has no
normal-FOV getter, so the target cannot follow each player's personal FOV setting.
`python -B mods/lothlorien/tools/make_galadhrim_archery.py` regenerates item and
arrow JSON, attachable/render controller and original pixel icons/pull frames.
Vanilla native bow meshes are reused with all four exact texture keys; the local
animation lowers third-person grip by 3 model units while retaining first person.
The bow identifier stays `lothlorien:bow` to get the native two-arm pose.

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

Owner review alternatives stay in workspace scratch while the owner chooses:
`temp/elven_inhabitants/m5_polish/archery/bow_variants.png` compares A carved
mallorn (silver inlay), B recurve (turned tips), C slender longbow (current
default), and D silverleaf (cool wood/leaf details), beside vanilla. The same
folder's `bow_models.png` shows actual Blockbench mesh extrusions at idle/full
draw, and `arrow_variants.png` compares three cosmetic arrow treatments. Arrow
production art and flight behavior are unchanged. Scratch generators are
`make_archery_variants.py` and `render_archery_variants.py` in the parent folder;
keep them until the owner selects the final design, then clean them up.

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
bounded diagnostic logging and cleanup after camera failure.

Mandatory owner checks: two-arm pose and lower grip in third person, all pull
frames in first/third person, zoom and release/cancel/slot/death/portal/reload
cleanup, table/anvil Power/Punch/Flame/Infinity, identical aim/full-hit damage
against vanilla, custom-arrow entity recovery and ground pickup. Custom ammo can
crit at 0.8s; vanilla ammo retains its native threshold, so compare 0.8s and 1s.
M0 did not record Infinity's custom-arrow consumption: verify exactly one custom
arrow is consumed and returned, including creative, with no ammo duplication.
Infinity officially saves normal arrows only; custom consumption is an inference,
not an observed result. Recovery remains 100% per the explicit owner decision.

Reusable template and source audit: `C:/mcmods/.claude/skills/bedrock-items/templates/custom_archery/`.
The snapshot includes this polishing pass; shared reference
`.claude/skills/bedrock-items/references/custom-bow-polish.md` records evidence and limits.
