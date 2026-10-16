# Elven village look (M7): style guide

Status: **approved by the owner 2026-10-14** (with the changes of section 0); **showcase (phase 2) accepted in game 2026-10-16**
("Awesome, I love it"). M7 is complete: owner accepted the finished villages on 2026-10-16 ("I love it, villages done"). Written by Claude as the design authority for M7; implementers follow it,
reviews judge against it. Structure and engine rules stay in `lothlorien_jigsaw_settlement.md`; roles and homes in `elven_inhabitants.md` section 10.

Owner's brief (2026-10-13): a village of magical, immortal Tolkien elves, "the gem of our mod, so people see it and wonder". Homes (walls and
beds optional), decorations (fountains, sculptures...), furniture, small decorations, lighting that is aesthetic, balconies and lookouts.
Placeholders (trees, deck shapes, floor heights) may change; keep loops, supports, rails and several floors; keep the central tree idea.
Owner answers the same day: existing blocks only (new-block ideas are proposed for round 2, see section 9); hidden light blocks allowed;
magic water allowed in the trees; ground under the village dressed as living forest, no built structures there; check in game after a showcase.

## 0. Owner's review of the mockups (2026-10-14)

- "Yes, the direction is right, I like the aesthetics." One-storey homes are good. Rebuilding the central tree is approved.
- **Nothing visible floats unsupported** (principle 10, rule 8). Lanterns may hang, things may be fixed to walls/trunks.
- **Water always has a visible container**, the spring included: never a source lying on a floor (section 7.3).
- **Richer decoration**: the mockups felt a little empty. More banners (also on the trunks), more furniture and small things such as
  pots. Section 7.10 sets a minimum dressing per deck; principle 6 now says "rich at the nodes" instead of "keep half plain".

### Owner's in-game tests of the showcase (2026-10-15/16)
Finishing feedback (2026-10-16, Codex; implemented and owner accepted in game): restore two adjacent cushions under slab seat roofs;
wood posts start on the deck; link rails to moss and slabs consistently; close unused jigsaw mouths; keep flower pots out of cushion views;
frame every available bed side without closing paths or future furnished-home access. Count real lamps before adding hidden-light gap fill.
Lag of concern is in an already loaded village; a slower initial build is acceptable. Measurements and retest steps: `../VILLAGE_POLISH_2026-10-16.md`.
Owner follow-up: "The rest looks good"; moss borders remained incomplete in a fresh village. Corrective pass covers thin path-facing skirts and runtime home beds, preserving bridges and cushions; deployed, verified and owner accepted: "I love it, villages done" (see the finishing report).
Later rounds (2026-10-16): up to one more banner per tree and 3-4 on the Hall; fences link to log posts (generator + rail mender); no jar
between a cushion and its view; a pot on a bridge always stands beside a lamp post, bridge lamp posts in left-right pairs; standing banners
need two free cells above and never stand at outer corners; flower pots (mostly planted, about 1 in 5 empty) on rails, decorated pots only
on the floor; about a quarter of the flowers are pretty vanilla ones (lily of the valley, cornflower, blue orchid, allium, azure bluet,
white/pink tulip, oxeye daisy); seat roofs are fence posts up to +3 with two top slabs between them, and no lantern stands beside a
fence; glow-berry tips at `growing_plant_age` 25 (no growth); the Hall roof is closed (its gaps were built-in windows, not decay).
First round:
- Liked: the general look, the pavilion roofs, the moss-and-trapdoor gardens, the golden ring in the deck, the lighting, the waterfall,
  the reading corner, the healer's home, firefly bushes on the forest floor.
- Changed: decks and bridges stay clean (no leaf drifts); the forest floor has no vanilla leaf litter and far fewer flowers;
  posts are whole logs from the deck up, never a log on a fence; banners: the original watch banner is the main one, its light-blue- and white-bordered variants are complementary;
  fewer banners, rim flags as standing banners on fence posts; no stair benches (they link to rails and can be unreachable): cushions;
  stair rails run the whole way up; nothing hangs over a walk lane below +3 (the bridge gate became lamp posts).
- Spawning (2026-10-16): natural villages stand inside the Lothlorien biome, which has no hostile spawn rules (TECHNICAL_NOTES "No monster"),
  so the ground and root flares need no light. A zombie met in a `/place`d village outside the biome led to one rule anyway: branch tops
  near the decks and in the crowns must not be dark (hidden lights), so a stray mob cannot drop onto a deck.

## 1. The idea in one paragraph

Caras Galadhon is not built *on* the trees; it is grown *with* them. The Mallorns lend their boughs: branches bend down to roof a talan, rise to
carry a lamp, and the trunk itself is the back wall of every home. Silver wood, gold and green leaves, and light that hangs like stars in the
branches: "lamps of green and gold and silver" (Fellowship, *Caras Galadhon*). Nothing is boxy, nothing is heavy, little is closed. The elves
need no walls against the weather (their magic and the trees keep it off), so homes are open pavilions with a light screen on the windward
side. Water is held up into the trees by the Mallorns and falls back as a thin silver stream. A visitor should feel **open space, quiet order,
and light that seems to belong to the trees rather than to lamps**.

## 2. Principles (each element is judged by them)

1. **Grown, not built.** Every roof, arch and lamp arm starts at a trunk or a branch. A post stands on a deck or a branch; a roof rests on
   branches that visibly come out of the trunk. Supports are logs/branches (`mallorn_log`, `mallorn_wood` sideways), never stacked planks.
2. **Open and light.** No solid plank walls. Enclosure, where wanted, is a *screen*: open trapdoors standing on edge, a hedge of leaves one block
   high, fence-lattice, or hanging moss. Sight lines across a deck stay open at eye level (y +2) except at the screen of a home.
3. **Silver body, gold and green accents.** About 60 % silver wood, 30 % leaves, 10 % accents. Accent colours only: heartwood gold, white,
   pale blue (the banner border), leaf green. **No** red, orange, purple, black iron, cobblestone, bricks, terracotta, copper or vanilla lanterns.
4. **Every thing has a reason.** A lamp lights a path, a door, a seat or a landmark. A screen stands on the windward rim. A basin has a source
   (the trunk). Furniture belongs to a person (profession set). If the reason cannot be said in one line, leave it out.
5. **Curves over corners.** Outlines in steps of 2 (the deck rule), roofs as low domes, eaves stepped with stairs/slabs; avoid long flat
   faces of one block type: break every run longer than 5 with a change (a post, a planter, a lamp, a leaf drift).
6. **Rich at the nodes, clear on the paths.** Decoration clusters densely at *nodes* (trunk foot, bridgeheads, home, rim corners, lookouts):
   a node should look lived in, with several small things together (a planter, a pot, a candle, a banner, a cushion). The paths between nodes
   (connector to trunk ring, the ring itself) stay clear. Every deck carries at least the dressing of section 7.10.
7. **Light is art; safety is invisible.** Visible lamps go where they are beautiful. Spawn-proofing comes from hidden `minecraft:light_block_*`.
8. **Each tree has a face.** From a bridge, a player should be able to say "this is the healer's tree" (signature, section 6).
9. **The ground belongs to the forest.** Under the village: no structures, but a lit, flowering forest floor (section 7.8).
10. **Nothing floats.** Every visible block is carried: it stands on a block, hangs from a block above (lanterns, moss, vines, rope, chains),
   or is fixed to a wall or trunk beside it (wall banners, trapdoors, glow lichen). Leaves count as carriers only for hanging plants and lamps
   that hang from a leaf blob a branch holds. Water is held on all sides and below (7.3).

## 3. Palette (blocks allowed; anything else needs a reason in the review)

| Role | Blocks |
|---|---|
| Structure | `lothlorien:mallorn_planks`, `_slab`, `_stairs`, `_log`, `_wood`, `_stripped_log`, `_stripped_wood`, `_fence` (THE rail), `_fence_gate`, `_trapdoor` |
| Gold accent | `lothlorien:mallorn_heartwood_planks/_slab/_stairs/_fence/_trapdoor` (trim, inlays, workbench tops; never a whole surface) |
| Foliage | `lothlorien:mallorn_leaves`, `mallorn_golden_leaves` (crown tips, roof ridges, central tree), `mallorn_leaf_carpet` (drifts), `mallorn_blossom` |
| Mod flora | `elanor`, `niphredil`, `athelas`, `golden_fern`, `nectar_bloom`, `mallorn_sapling` (nursery) |
| Vanilla flora | `pale_hanging_moss` (silver beards under decks/branches), `leaf_litter`, `wildflowers`, `pink_petals` (sparingly), `firefly_bush`, `moss_carpet`, `flowering_azalea`, `azalea_leaves_flowered`, `bush`, `fern`/`large_fern`, `lily_of_the_valley`, `spore_blossom` (central tree only), `cave_vines*_with_berries` (glow berries) |
| Light, visible | `lothlorien:elven_lantern` (silver, stand or hang), `elven_lantern_heartwood` (gold), `elven_chandelier` (ceiling), `firefly_jar` (floor), `verdant_froglight` / `pearlescent_froglight` (only *inside* leaf blobs: glowing fruit), glow berries, `end_rod` (only as star-spires on the highest points) |
| Light, hidden | `minecraft:light_block_<n>` (section 5) |
| Cloth | banners (the silver/blue watch design of M6 and white/green/light-blue variants), `white/light_gray/lime/green/light_blue_carpet`, cushions (native, M6 recipe), straw/white beds where a home has one |
| Elven goods | `elven_rope` / `elven_rope_hanging` (rope coils, lamp cords), `flower_pot`, `decorated_pot`, `barrel`, `bookshelf`, `chiseled_bookshelf`, `lectern`, shelves (`birch_shelf`/`pale_oak_shelf`), `loom`, `fletching_table`, `composter`, `brewing_stand`, `cauldron`, `white_candle` |
| Water | `minecraft:water` (contained, section 7.3) |
| Stone | none in the trees. `calcite` only as the lip of a basin if wood cannot hold the shape. |

## 4. Proportions and heights (all relative to a deck surface = y 0)

| Height | What |
|---|---|
| 0 | deck (planks / top slabs), leaf drifts, carpets |
| +1 | rails (fences), cushions, planters, low hedges, furniture tops |
| +2 | eye level: keep open; lamp heads on 2-high lamp posts |
| +3 | lowest ceiling of a home (lantern hanging at +3 under a +4 roof), lintels of arches |
| +4 | roof eaves (stairs upside down / slabs), hanging lamps under branches |
| +5 | roof crown / ridge (golden leaves). **Nothing above +5 on a deck** (crown box starts at +6; a tower's upper deck at +8) |

Upper-level decks (towers) are +8 over the lower deck, so a home on a lower tower deck is still capped at +5.

## 5. Lighting system

- **Hidden layer (safety).** `minecraft:light_block_<n>` placed in air cells that nobody walks through: at +3 over the deck where the cell is
  not a stair/walk headroom path, inside leaf-roof cavities, under the decks. Chosen by a greedy like `addLanterns`, but the candidates are
  hidden cells, and the target stays **light >= 8 on every walk cell**. Light blocks are walk-transparent and light-transparent: the walk checker
  and the light model must treat them as air (extend `structure_walk.mjs` / `structure_light.mjs` with fixtures).
  Real emitters count toward coverage (owner follow-up 2026-10-16); hidden blocks fill only remaining gaps. Removing a real lamp may darken its area.
- **Visible layer (art).** Placed first, by design, never by the greedy:
  - *Hanging lamps* under branches, eaves and the home roof: the lamp hangs from an `elven_rope_hanging` cord 1-2 long or directly under a
    block. Silver on paths, gold at homes and the central tree.
  - *Lamp posts* at bridgeheads: the outer rail post of each bridge end is raised to 2 fences + a lantern (both ends of every bridge = "gate").
    Not on every rail post (the current greedy look goes).
  - *Floor glow*: firefly jars beside doors and seats; glow berries hanging under decks and from roof eaves; `firefly_bush` on balconies.
  - *Crown stars* (the landmark at night): in every crown, 2-4 lanterns hang under branch tips (silver, gold) and 1-3 verdant/pearlescent
    froglights sit inside leaf blobs as green/white glowing fruit (the three colours of the book). The central crown has the most.
  - *Hall light*: one chandelier under the roof of the central hall.
- **Budget.** Visible lamps per tree deck: 3-6 (central: 8-12). A night render must show pools of warm light with soft darkness between.

## 6. Each tree has a face (profession signatures)

| Tree | Signature (seen from a bridge) | Furnishing set (inside the home) |
|---|---|---|
| Central tree (Loremaster, the Court) | the biggest trunk, golden crown with the most crown stars, the stream falling from the hall, banners | reading circle: chiseled bookshelves against the trunk, lectern, cushions in a half ring, blue-bordered banners |
| Healer | white and silver: white banner, white candles, a basin of clear water | cauldron of water, brewing stand, athelas and niphredil in planters, white bed(s), shelf of bottles (decorated pots) |
| Gardener | overflowing green: flowering azalea, a leaf arbour over the door, planter boxes on the rim | composter, planters with elanor/ferns/saplings (a Mallorn nursery), wildflowers, watering basin |
| Woodwright | gold heartwood: a workbench of heartwood, a stack of stripped logs, rope coils | fletching table, barrels, log stack (stripped logs sideways), rope coils (`elven_rope`), arrows in decorated pots |
| Lamplighter | the brightest home: a *lantern bough* (one branch hung with lamps of all three colours) | firefly jars on shelves, spare lanterns, a chandelier, white candles |

Wardens' trees keep their wardens; a warden tree that is also a home just carries both.

## 7. Elements

Each spec says **what, how it works, why (logic), and where it may not go**.

### 7.1 The Court: central tree (rebuilt, 2 levels + crown)
- **Lower deck +16 "the Court"**: the rope arrives here; the widest deck of the village. A ring of heartwood inlay round the trunk
  (the signature of every trunk, see 7.6). A **basin** of water on the deck against the trunk, fed by 7.3. The Loremaster's reading circle on
  the opposite side. Four bridgeheads with lamp posts. Banners on the trunk facing the rope (the first thing a visitor sees).
- **Upper deck +24 "the Hall"**: reached by the spiral stair round the trunk (the tower stair, adapted to the round 5x5 trunk). An open
  pavilion: a ring of slender posts (stripped logs) carrying a low leaf dome on branches that spring from the trunk; a chandelier hangs in the
  middle; cushions; the **spring** comes out of the trunk here (7.3). One balcony/lookout bay with a view over the village.
- **Crown**: golden leaves mixed in; crown stars (5); a `spore_blossom` or two under the lowest crown boughs over the Hall.
- Why: the heart of a Galadhrim city is the high hall of the Lord and Lady on the greatest tree; the village has one obvious summit to climb to.

### 7.2 The home (talan house), on a tree deck
- **Shape.** A pavilion against the trunk on the home site (`homeSite`, 5x5..7x7; a 3x3/4x4 site gets the *open variant*: no roof, a
  screen and a hanging lamp from a bent branch). Floor = the deck. Back = the trunk. Two or three slender posts (stripped log, 3 high) at the
  outer corners. Roof: branches (`mallorn_wood` sideways) spring from the trunk at +4 and reach the posts; on them a low leaf dome to +5 with
  golden leaves on the ridge; eaves of upside-down stairs where the roof meets the posts.
- **Screen.** On one side (the outer rim side): open trapdoors standing on edge between posts or a 1-high leaf hedge; one 3-wide opening
  toward the deck centre is the door (no door block; elves need none). Owner allows open homes: some homes have no screen at all.
- **Inside.** A hanging lamp from the roof at +3, a sleeping place (cushions on carpet, or a bed for 1 of 3 homes), the profession set (6).
- **Logic.** The tree shelters the home with its own branches; the screen breaks the wind; nothing is fixed with nails.
- **Not allowed.** No home in a connector corridor, the stair ring, the walk ring round the trunk or the 3-wide path between two connectors.

### 7.3 Water
- **Spring and stream (central tree).** The spring is a *vessel in the trunk*: a source block in a niche cut 1 deep into the trunk at the
  Hall, with trunk wood on three sides and below, and a heartwood lip (a slab or a stair) in front; above the niche a carved hood (an upside-down
  stair or slab) so it reads as a fountain mouth. The water leaves over the lip and falls beside the trunk through a 1x1 railed hole in the Hall
  deck into the Court basin. The column never crosses the stair or a walk path. Lore: the Mallorns draw water up for the elves.
- **Basins are raised vessels, never water on a floor.** The water surface sits at deck +1 inside a rim one block wide (stripped mallorn wood,
  heartwood stairs turned inward, or a heartwood slab ring) that is at least as high as the water, on a floor of planks/stripped wood. From the
  deck one sees a trough or bowl with a lip, like a stone fountain made of silver wood. Lily pads (`waterlily`) and one `sea_pickle` (soft light)
  in the larger ones. A basin is never in a walk path; its rim height +1 makes a seat edge.
- **Rule.** Every source has a non-water, non-air block on each side that is not another water cell of the same vessel, and below it. The only
  flowing water is the stream column. A static flow check (Bedrock rules: down first, else spread up to 7) proves every reachable water cell lies
  inside the vessel or the column.

### 7.4 Bridges
- Keep straight slab arches. Add: lamp posts at both bridgeheads (5), `pale_hanging_moss` and glow berries hanging under the arch belly
  (every 3-4 cells, not on the shortest bridges), leaf carpet drifts in the rail corners at both ends. Long bridges (>= 11) get a **gate arch**
  at the crown of the arch: two rail posts rise to +3, a heartwood slab lintel at +4 with a leaf crest, two lanterns hanging over the rail lines
  (never over the walk middle; headroom stays >= 2). Logic: it marks the midpoint and lights the longest dark stretch.

### 7.5 Balconies and lookouts
- **Balcony (on its pillar):** a "seat of song": a bench of two stairs facing outward under a leaf arbour (fences + leaves arching over),
  a firefly jar, a hanging lamp from the arbour, a planter. Pillar: the existing foliage decoration plus glow berries under the deck.
- **Lookout:** the warden's flet: a banner on a 3-high pole at the far rim, a cushion, a firefly jar, a 1-high leaf screen on one side;
  the highest lookout of a village gets an `end_rod` star-spire on the banner pole.
- New: **upper-level balconies/lookouts on towers** (a lookout off a tower's upper deck) so the village has views from +24.

### 7.6 Deck dressing (every tree deck)
- **Trunk ring:** a ring of heartwood planks in the deck round every trunk (one cell wide, at radius trunk + 1..2): the golden signature.
- **Leaf drifts:** `mallorn_leaf_carpet` and `leaf_litter` in rail corners and at trunk feet (never on a stair tread).
- **Planters:** a block of grass/moss framed by trapdoors on its sides, planted (elanor, niphredil, fern, sapling): at the rim between rails.
- **Trunk dressing:** wall banners on every trunk (the tree's own colours, section 6; 1-2 per trunk, top cell at +4 so the cloth hangs at
  +3..+4 above heads, facing the main approach); `pale_hanging_moss` strands high on trunks; a lantern on a short branch arm (log sideways out
  of the trunk + lantern hanging under its tip) instead of lanterns standing on the deck.

### 7.7 Under the village
- Under every deck: the existing woven struts and leaf blobs, plus `pale_hanging_moss` strands (2-5 long) and glow berries hanging
  from the struts and the deck underside. At night the village floats on a haze of small lights. Under-deck light also lights the forest floor.

### 7.8 The forest floor (runtime, no structures)
- Done by the planner's repair step (`village_repair.js`) on the real ground, like the root flares: in a radius round each trunk foot and
  under the decks, scatter `leaf_litter`, `mallorn_leaf_carpet`, ferns, `golden_fern`, `elanor`, `niphredil`, `wildflowers`, `firefly_bush`
  (fireflies under the village at night) and a few `moss_carpet` patches. Only into air on grass/dirt/moss/podzol; never on the rope foot.
- Density falls off with distance; most under the central tree (the foot of the rope is the visitor's first impression).

### 7.10 Minimum dressing per deck (owner: "more banners, furniture, little things like pots")
Every tree deck (and each tower level) carries at least:
- **Trunk:** 1-2 wall banners, 1-2 branch-arm lamps, the heartwood ring, a leaf drift at the trunk foot.
- **Each bridgehead:** two lamp posts plus one small thing beside a post (a potted plant on the post's neighbour rail, or a planter).
- **Rim:** every 5-7 rail posts away from connectors, one of: a potted flower on the rail post (`flower_pot` with elanor/fern/azalea),
  a planter box, a candle group on a slab, a decorated pot, a cushion facing the view.
- **Home cluster** (homes): the profession set of section 6, at least 6 objects, plus a banner on the screen post or trunk.
- **Corners and dead ends of the deck:** a small scene (a seat of two stairs with a cushion, a planter, a jar), never empty.
Small things are 1 block high, on the deck at the rim or against the trunk, never in a keep-clear cell (rule 8).

### 7.9 Fallback element (where a tree's crown does not fit)
- Per `lothlorien_jigsaw_settlement.md` section 6: a low element at deck level, <= +5, inside the smallest tree node deck. Options, in this
  style: a **treetop garden** (planters, an arbour, a small basin) or a **pavilion** (the home roof on four posts around a hollow stump of
  leaves). Built after the showcase.

## 8. Rules every element must pass (implementers and reviewers)

- Existing checks stay green: connector standard, walkability (`structure_walk.mjs`), light >= 8 (`structure_light.mjs`), orphan leaves,
  bare branch ends, crown-box fit, elf posts, `node tools/village_sim.mjs 300 1` 0 failures, `tests/run.mjs`, `.\mods verify lothlorien`.
- **No collisions:** a decoration may not stand in a connector corridor (3 wide, 4 deep), the walk ring round a trunk, a stair column, the
  3-wide main path connector-to-trunk-ring, an elf post / warden cell, or the rope column. A check lists these "keep-clear" cells per piece and
  fails on any non-air, non-carpet block in them.
- **Supported (principle 10), checked by a support check on every piece:** each non-air block is carried by one of: a block below it that
  can carry it; for hanging things (lantern face `down`, `elven_rope_hanging`, `chain`, moss, vines, glow berries, spore blossom) the block above;
  for wall things (wall banner, trapdoor, ladder, glow lichen) the block behind them; for logs/wood/leaves the tree's own rules (bent branches,
  trimFarLeaves). Lanterns standing on a rail post or deck are fine; a lamp, pot or banner in the air is a failure. Every post stands on deck;
  every roof rests on branches.
- **Rotation-safe:** only vanilla-namespace orientation states turn with a piece; stairs, trapdoors, banners and beds use states that rotate
  (check each one with a rotated render).
- **Box:** nothing outside the piece box; nothing above deck + 5 except the crown and the central Hall.
- **Readable at night:** the night render shows the signature of each tree.

## 9. Round-2 block proposals: owner's decisions (2026-10-16)

No new blocks for now; each proposal is answered with existing blocks:
1. **Lamp cord** -> `minecraft:waxed_oxidized_copper_chain` (green, waxed so it never changes), 1-3 long, with a lantern hanging under it.
   Iron chains stay out (palette: no black iron).
2. **Silver basin** -> a one-block basin: a water source with four mallorn stairs round it, the tall back of each stair against the water and
   the steps facing outward, on a solid floor. Used as fountain, birdbath, the gardener's watering basin, the healer's clear water.
3. **Leaf-roof block** -> not needed: normal leaves are good enough.
4. **Talan screen** -> not now.

### Phase 3 dressing as built (2026-10-16, implementer notes)
- **Lamp cords.** `minecraft:waxed_oxidized_copper_chain` (state `pillar_axis: "y"`, metadata-checked) hangs the branch-arm lamps: the arm leaves the trunk 1-2 blocks higher (lower decks) or bends
  out, up one log, out again (under a crown the trunk ends at +4); the lantern bottom stays at deck + 3. Rib-tip lanterns of the pavilion stay on the rib (a cord would drop them below +3).
- **Stair basins.** One block of water, four `mallorn_stairs` (`facing` = toward the water, bottom half), on deck planks, a lily pad on half of them; about one node or tower in three.
  `waterCheck` additionally rejects a stair beside a source whose steps face the water or that is upside down.
- **Tower lookout bays.** The upper deck of every tower fills one outer corner (`add` + `bay` in the level spec): rails round it, two cushions at the outer corner, a seat roof (rail posts to +3,
  top slabs over the cushions), a jar, a flag pole (stripped log, wall banner). The rest of the bay stays keep-clear.
- **lookout_01 is 11 x 11** (shape `lookout11`, pillar at the centre, `findPillar` reaches 5 cells): seat bay with roof, flag, jar and two flower beds in the corner pockets. The balcony's near arbour post is a stripped
  log from the deck up with the flag on its inner side; the far post stays a fence for the exit signature. Pillar foliage `light` 1.1 / `full` 1.8 (3 and 5 bent branches with leaf blobs). Cushion actors cannot be turned: "facing the view" is by position only.

## 10. Phases and checkpoints

1. **Style approval**: done 2026-10-14.
2. **Showcase**: done, accepted in game 2026-10-16. It grew beyond the plan: a home pavilion (k = 5) on every node and tower, deck
   dressing on every tree, bridges and runtime loop bridges in the new style, cushions, the healer's furnishing at runtime.
3. **Complete, accepted 2026-10-16:** profession furnishings, crown stars and fallback leaf caps, upper tower lookouts, paired view seats, connections and rails, complete moss-bed borders, and loaded-village performance checks. The central reading circle serves the Loremaster; new block proposals remain deferred by owner decision.

Final commit: **Finish accepted elven villages**. Final design and validation: [finishing record](../VILLAGE_POLISH_2026-10-16.md).
