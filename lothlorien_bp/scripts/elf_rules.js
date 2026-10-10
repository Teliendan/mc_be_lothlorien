// Civilian elf rules (design: docs/mobs/elves.md, docs/design/elven_inhabitants.md). Pure (no @minecraft/server) so tools/build_village.mjs,
// tools/village_sim.mjs and tests/run.mjs import the very same numbers and functions; elf_village.js and elf.js wire them to the game.
//
// An elf is a persistent village inhabitant (entities/elf.json). Every village gets all five professions: the Loremaster on the central
// tree, each other profession on a tree of its own. A jigsaw piece cannot know which profession it gets, so the tree pieces carry neutral
// `lothlorien:elf_post` marker entities and the village planner run assigns the professions once per village (assignHomes).

export const ELF_ID = "lothlorien:elf";
export const POST_ID = "lothlorien:elf_post";
export const ELF_FAMILY = "lothlorien_elf";
// The index is `minecraft:variant` and must equal tools/make_elves.py PROFESSIONS (a test checks it).
export const PROFESSIONS = ["gardener", "healer", "woodwright", "lamplighter", "loremaster"];
// Professions that stand on trees of their own, in the order they get the trees nearest to the Loremaster.
export const HOME_ORDER = ["healer", "gardener", "woodwright", "lamplighter"];
export const spawnEventOf = (profession) => `lothlorien:as_${profession}`;

// Post kinds: entity definitions groups `lothlorien:post_<kind>` (entities/elf_post.json) put the kind into the post's type families.
export const POST_KINDS = ["loremaster", "reserve", "home"];
export const POST_GROUP_PREFIX = "lothlorien:post_";

// ---- Entity values (entities/elf.json): THE place to tune how the elves behave. ----
// movement stays below warden_replace_rules.js WRONG_MOVEMENT_ABOVE (0.5); a first guess, measure it with /scriptevent lothlorien:speed.
export const STATS = { health: 20, movement: 0.3, stroll: 0.6, panic: 1.25, avoidDist: 6, avoidWalk: 1.0, avoidSprint: 1.25, home: 0.6, lookDistance: 8 };
// Home restriction (blocks) per profession: each elf stays around its own tree (bridges are 7..15 long).
export const HOME_RADIUS = { loremaster: 6, healer: 10, gardener: 10, woodwright: 10, lamplighter: 10 };

// ---- Generator tunables (tools/build_village.mjs) ----
export const POST_SPACING = 3; // Chebyshev cells between a post and every warden / other post of its piece
export const ROPE_CLEARANCE = 2; // the Loremaster's post is at least this far (Chebyshev) from the rope cell
export const RESERVE_POSTS = 4; // reserve posts on the central tree: leftover professions stand there when a village has too few outer trees
export const HOME_MIN = 5; // a tree "has room" for a later home when a free square of this size exists
export const HOME_MAX = 7;
export const HOME_MIN_SQUARE = 3; // homeSite looks for squares down to this size

// ---- Wardens defend elves (60 s tag on the attacker) ----
export const FOE_TAG = "lothlorien_elf_foe";
export const FOE_MS = 60000;

// ---- Record for the home milestone ----
export const HOMES_PROPERTY = "lothlorien:village_homes"; // world property: JSON list of { rect, loremaster: [x,y,z] | null, homes: [{ p, x, y, z, site }] }
export const HOME_OF_ELF = "lothlorien:home"; // entity property: "x,y,z" (the post cell)
export const MAX_HOME_RECORDS = 64;
export const parseHomes = (s) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };
export const addHomes = (list, record) => [...list, record].slice(-MAX_HOME_RECORDS);

// ---- Home sites ----
const AIR_IDS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const PLANKS = "lothlorien:mallorn_planks"; // a fence (or anything else) in the three cells above fails the air test

// Free square of open deck that contains the deck cell (x, y, z): `at(x, y, z)` -> block type id (the cell under the post's feet is y).
// Open deck cell = planks at y, three cells of air above, no fence in those cells (trunks are logs, never planks). Returns the largest
// { x0, z0, k } (k from HOME_MAX down to HOME_MIN_SQUARE, the square's corner is x0, z0); among squares of equal size the one whose middle is
// nearest to the cell, then smaller x0, then smaller z0. null when no 3 x 3 square fits. Used by the generator (where a home post stands),
// the runtime (the record) and the simulator, so a later home step recomputes it from live blocks.
export function homeSite(at, x, y, z) {
  const memo = new Map();
  const open = (cx, cz) => {
    const key = `${cx},${cz}`;
    if (!memo.has(key)) memo.set(key, at(cx, y, cz) === PLANKS && [1, 2, 3].every((h) => AIR_IDS.has(at(cx, y + h, cz))));
    return memo.get(key);
  };
  for (let k = HOME_MAX; k >= HOME_MIN_SQUARE; k--) {
    let best = null;
    for (let x0 = x - k + 1; x0 <= x; x0++) for (let z0 = z - k + 1; z0 <= z; z0++) {
      let ok = true;
      for (let i = 0; i < k && ok; i++) for (let j = 0; j < k && ok; j++) ok = open(x0 + i, z0 + j);
      if (!ok) continue;
      const d = Math.hypot(x0 + (k - 1) / 2 - x, z0 + (k - 1) / 2 - z);
      if (!best || d < best.d || (d === best.d && (x0 < best.x0 || (x0 === best.x0 && z0 < best.z0)))) best = { x0, z0, k, d };
    }
    if (best) return { x0: best.x0, z0: best.z0, k };
  }
  return null;
}

// ---- Assignment (pure; the result depends only on block positions) ----
// posts: [{ kind: "home" | "reserve", x, y, z, site }] (site = homeSite result or null); loremaster: [x, y, z] | null.
// Home posts are ordered by: tree with room (site.k >= HOME_MIN) first, then nearest to the Loremaster, then x, then z; they get HOME_ORDER in turn.
// Professions without a home post (fewer than four outer trees) stand on reserve posts, in the same order, nearest reserve first (fallback F1).
// Returns [{ post, p }] in HOME_ORDER order; posts that are not used are ignored; a profession is never assigned twice.
export function assignHomes(posts, loremaster) {
  const dist = (post) => (loremaster ? Math.hypot(post.x - loremaster[0], post.z - loremaster[2]) : 0);
  const room = (post) => (post.site && post.site.k >= HOME_MIN ? 0 : 1);
  const byPlace = (a, b) => a.x - b.x || a.z - b.z || a.y - b.y;
  const homes = posts.filter((q) => q.kind !== "reserve").sort((a, b) => room(a) - room(b) || dist(a) - dist(b) || byPlace(a, b));
  const reserves = posts.filter((q) => q.kind === "reserve").sort((a, b) => dist(a) - dist(b) || byPlace(a, b));
  const out = [];
  HOME_ORDER.forEach((p, i) => {
    const post = i < homes.length ? homes[i] : reserves[i - homes.length];
    if (post) out.push({ post, p });
  });
  return out;
}
