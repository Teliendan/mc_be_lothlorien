# Woodland places outside villages

Updated 2026-10-16. Root shrine, garden and straight-pillar memorial accepted by
the owner. Memorial commit: `Add accepted leaf memorials at garden frequency`.
Other implementation commits remain pending; shared files contain unrelated changes.

## Confirmed brief and constraints

- Standalone, uninhabited outdoor points of interest among the trees, visited by
  elves. Compatible with village atmosphere without copying village architecture.
- Most sites can be approached from any direction. Do not depend on a designated
  entrance, screened approach, controlled reveal or unnatural enclosing walls.
  A root shrine can naturally have a sheltered recess, but that is site-specific.
- Use existing blocks and items only, including for memorials and discovery rewards.
  No new sculpture models, carved markers, bowls, keepsakes or custom items.
- Lighting is optional. Stone is acceptable in modest amounts, not monumental
  architecture or a dominant stone palette.
- Shrine idea liked. Garden should be simple; outside-biome flowers welcome.
  No Mallorn saplings, because growth could damage the composition.
- Pond/pool rejected on 2026-10-15. Glade of Song rejected on 2026-10-14.
- Memorial: leaf platform and straight capped pillar accepted; no cross-shaped
  arms, large statues or detailed new models.
- Hidden elements and a reward for discovery are appealing.
- Garden implementation authorized 2026-10-16, including a barrel with a few Mallorn
  nuts and flowers/gardening supplies. Memorial accepted and natural generation
  requested at the same frequency as gardens on 2026-10-16.
  Root shrine: prototype implementation authorized 2026-10-15, with
  explicit delegation to a subagent. Owner likes concealment and the roots, and
  asks where the shrine would sit relative to the ground.

## Grounding

Read `village_style.md`, `../ATMOSPHERE.md`, `elven_inhabitants.md` section 9,
structure sections in the original design plans, and the current BP block inventory.
Use existing Mallorn logs/wood, stairs, slabs, trapdoors, flowers, banners and vanilla
containers. Proposed visual results are untested. Existing village style supplies
silver wood, restrained heartwood accents, supported forms and deliberate planting.

The previous concepts over-relied on prose atmosphere, staged approaches and details
not representable with the existing assets. Judge future proposals by visible block
arrangements, silhouette from several directions and an understandable purpose.

## Current candidate build shapes

**Root shrine (accepted 2026-10-16):** a complete Mallorn with a shallow ground-level
nook among spreading roots. Silver/heartwood shelf, pot containing a full bottle
of dew, grouped candles, kneeling mat, flowers and the main banner inside with its
light-gray border changed to white. Hidden chest guarantees a Mending I book;
no emeralds. Final decisions, tests and placement: `../ROOT_SHRINE.md`.
Worldgen requested 2026-10-16: replace 25% of existing Great Mallorn placements
with this shrine, keeping the current total tree density. Uses the existing pool,
biome filter, ground alignment and placement grid; natural terrain review is pending.

**Flower garden (accepted 2026-10-16):** roughly 11 blocks across, four grouped
flower beds with low Mallorn slab edging, broad grass aisles, a silver stair bench
and an upright barrel of ordinary Mallorn Acorns, flowers, bone meal, a wooden hoe
and shears (owner's loot edit, two IDs corrected).
Outside-biome flowers alongside Elanor and Niphredil. Open from all sides; no planted
saplings, terraces, nursery or work shelter. Natural generation adds about one garden
per four existing big trees via a separate 12-chunk grid, preserving the current
6-chunk giant-tree/shrine grid and weights. Build, loot and tests: `../FLOWER_GARDEN.md`.

**Memorial (final, accepted 2026-10-16):** a low
silver plank leaf with a half-height slab rim, golden central vein and short stem.
A straight capped silver Mallorn pillar near the rounded heel carries existing banners
on opposite faces. Two short inward-facing benches and three repeated white-flower
soil pockets complete the composition. Natural generation uses its own grid at
the same frequency as gardens, preserving the existing garden and giant rates.
No loot. Final design, placement and checks: `../MEMORIAL.md`. The owner accepted
the straight pillar after removal of its cross-shaped shoulders. Iteration
scratch removed; only the accepted leaf design remains in the generator.

## Discovery and rewards

Conceal a vanilla chest/barrel in a reachable root pocket, behind an openable trapdoor
in a low base, or behind a conspicuous patch of hanging moss. A visible edge or recess
can give a clue from whatever direction the player happens to notice it. Reward with
existing mod supplies/items; no new tokens or keepsakes. Container contents and exact
placement remain open. Avoid requiring random excavation or a prescribed approach.

Do not add Harmony rewards for plant care or offerings without an owner decision;
the current policy has no harvesting penalties or plant-care rewards.
