# Star canopy harvest

2026-10-10; target Bedrock 1.26.52 / stable Script API 2.8.0. Configuration and
guard logic tested; native gameplay, tool wear and final break effects remain
unverified in game. This is a bounded harvest repair, not a claim of full parity.

The existing stone-backed recipe uses native deepslate tiles, so they are the
harvest counterpart. Any tagged pickaxe, including wooden, golden and copper,
collects one star canopy tile. Hand and other tools remove it without collecting
the tile. Fortune and Silk Touch do not change its one-item collection recipe.
Creative/Spectator and already-canceled events are left to the engine/other code.

The block's explicit native table owns allowed-player and environmental drops,
with `set_count:1` followed by `explosion_decay`. A plain `match_tool` gate would
also suppress tool-less explosions, so it cannot implement both requirements.
Instead, the completed wrong-tool player break is canceled, and a writable
next-tick callback removes the unchanged cell with `setType("minecraft:air")`,
which does not request loot. No item entities, blast math or particles are
scripted. The gate is loaded through `blocks.js`, avoiding changes to the busy
main script. Both the star-canopy generator and support postpass retain its
explicit loot route.

The deferred operation deduplicates simultaneous same-cell attempts, checks the
player/mode and full sorted block permutation again, and skips unloaded, moved,
invalid or changed blocks. Player placement and block-explosion events invalidate
pending work, including observed same-type/state replacements. An identical
replacement by an unobserved command within that tick has no accessible block
identity; this limitation is shared with the Starstone gate. Inventory/tool wear
uses the captured slot and cloned used tool, guarded against later slot changes.
Lothlorien support tracking is explicitly invalidated/refreshed because canceled
breaks do not trigger its ordinary after-break subscription.

`harvestWear.js` is the same sourced helper as Starstone: current native tools
have their documented rejected-mining damage, documented Unbreaking rolls and
unbreakable protection. Unknown custom wrong-tool wear is not inferred. The
unchanged allowed-pickaxe path keeps native engine wear. No synthetic native
player-break event, statistics, block sound or final particle count is produced;
those possible differences require game observation before deciding whether any
exception is unavoidable. The helper does not emulate the Wiki's Bedrock extra
use at zero durability; last-use behavior and possible late native wear are
explicitly pending acceptance, rather than an approved exception.

Evidence read 2026-10-10:

- [Minecraft Wiki: Deepslate Tiles, revision 2731188](https://minecraft.wiki/w/Deepslate_Tiles?oldid=2731188),
  Breaking: pickaxe collection; other tools yield nothing. The tool table includes
  wooden and golden pickaxes. The web tool's snapshot is old (2024-era upcoming
  labels), so the target copper extension relies on current official copper
  equipment evidence and native pickaxe tags; exact 1.26.52 behavior still needs
  comparison. Existing historical dataset supports the same six pre-copper
  pickaxes but is not a current engine extraction.
- [Mojang: Deepslate](https://www.minecraft.net/en-us/article/block-week--deepslate)
  explains the material's pickaxe collection and decorative tile family; it does
  not publish an exact current tile harvest implementation.
- Installed 1.26.52 references contain deepslate tile recipes but no readable
  native tile block/loot definition. Recipe and texture data alone are not harvest
  evidence. The star canopy recipe itself has deepslate tiles as its stone row.
- [Official 26.50 changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)
  and [loot conditions](https://learn.microsoft.com/en-us/minecraft/creator/documents/loottableconditions?view=minecraft-bedrock-stable)
  document supported tool predicates; no documented block-source condition was
  found to distinguish bare-hand player loot from tool-less environmental loot.
- [Official before-break event](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerbreakblockbeforeevent?view=minecraft-bedrock-stable)
  and local `reference/server-2.8.0.d.ts` define cancellation, used item snapshot,
  player, and deferred writable scheduling. These establish API availability,
  not engine equivalence of a canceled-and-removed break.
- [Archived Minecraft Wiki: Durability (2025-11)](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Durability)
  is the shared helper's source for Bedrock wrong-tool durability costs and
  Unbreaking probability. This older snapshot is documented evidence, not a
  target-game measurement. The shared research and tests live with Starstone;
  Lothlorien's production helper is copied byte-for-byte and its tests use the
  local pack import only.

`node tests/star_canopy_harvest.mjs` exercises the real pure gate service with a
fake scheduler: no before-event mutation, allowed and unrelated routes untouched,
captured item/slot, changed/unloaded cells, mode/logout guards, invalidation,
deduplication, subsequent recovery, and support cleanup even if tool wear fails.
It also checks the native table/route and generator persistence. Companion wear
tests validate the copied helper. Static checks do not reproduce engine effects.

Pending game acceptance: compare native deepslate tiles and canopy with hand,
axe, sword, shovel, hoe, shears and every pickaxe tier; repeat wrong-tool breaks
with Unbreaking, one durability remaining, item/slot swaps and mode changes.
Check attached buttons/plates/lamps after wrong-tool removal, simultaneous players,
and separate TNT/creeper/water/piston/command causes with relevant decay gamerules.
Record drops, wear, timing, final sounds/particles, statistics and observed
after-break side effects independently. No new owner exception is requested
until an actual unavoidable difference has been observed.
