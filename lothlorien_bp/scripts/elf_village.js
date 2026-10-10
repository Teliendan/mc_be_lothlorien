// Population of a new Elven village, run by the village planner (loop_marker.js planVillageAt) while the whole village is loaded.
// The tree pieces carry invisible `lothlorien:elf_post` entities (tools/build_village.mjs): one `loremaster` post and RESERVE_POSTS `reserve`
// posts on the central tree, one `home` post on every outer tree. This pass reads them all, lets elf_rules.js assignHomes decide who stands
// where (the Loremaster on the central tree, healer / gardener / woodwright / lamplighter on trees of their own, leftovers on reserve posts),
// spawns one elf per assignment with the profession event, records the result for the home milestone and removes the posts.
// Idempotent by construction: the posts are gone after one run, so a second run finds none and spawns nothing.
import { world } from "@minecraft/server";
import { ELF_ID, HOMES_PROPERTY, HOME_OF_ELF, POST_ID, addHomes, assignHomes, homeSite, parseHomes, spawnEventOf } from "./elf_rules.js";

const KIND_PREFIX = "elf_post_";
const boxQuery = (r) => ({ type: POST_ID, location: { x: r.x0, y: -64, z: r.z0 }, volume: { x: r.x1 - r.x0 + 1, y: 420, z: r.z1 - r.z0 + 1 } });

// the kind from the post's type families (definitions group lothlorien:post_<kind>); a post without one counts as a home post
function kindOf(entity) {
  try {
    const families = entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
    const kind = families.find((f) => f.startsWith(KIND_PREFIX));
    return kind ? kind.slice(KIND_PREFIX.length) : "home";
  } catch {
    return "home";
  }
}

// -> { spawned, own, reserve, failed }; never throws on a single bad post
export function populateVillage(dimension, rect, at) {
  const get = (x, y, z) => { try { return dimension.getBlock({ x, y, z })?.typeId; } catch { return undefined; } };
  const posts = dimension.getEntities(boxQuery(rect)).map((entity) => {
    const x = Math.floor(entity.location.x), y = Math.floor(entity.location.y), z = Math.floor(entity.location.z);
    return { entity, kind: kindOf(entity), x, y, z, site: homeSite(get, x, y - 1, z) }; // the deck cell is the one under the feet
  });
  if (!posts.length) return { spawned: 0, own: 0, reserve: 0, failed: 0 }; // a village that was populated before (or an old one): nothing to do
  const byPlace = (a, b) => a.x - b.x || a.z - b.z || a.y - b.y;
  const lore = posts.filter((q) => q.kind === "loremaster").sort(byPlace)[0] ?? null;
  const assigned = assignHomes(posts.filter((q) => q.kind !== "loremaster"), lore ? [lore.x, lore.y, lore.z] : null);
  const kept = new Set(), result = { spawned: 0, own: 0, reserve: 0, failed: 0 }, homes = [];
  const spawn = (post, p) => {
    try {
      const elf = dimension.spawnEntity(ELF_ID, post.entity.location, { spawnEvent: spawnEventOf(p) });
      try { elf.setDynamicProperty(HOME_OF_ELF, `${post.x},${post.y},${post.z}`); } catch { /* the elf is there, only its home note is missing */ }
      result.spawned++;
      return true;
    } catch (e) {
      kept.add(post); // the post stays: a later run tries again
      result.failed++;
      console.warn(`[lothlorien] elves: could not spawn the ${p} at ${post.x},${post.y},${post.z}: ${e?.message ?? e}`);
      return false;
    }
  };
  if (lore) spawn(lore, "loremaster");
  for (const { post, p } of assigned) {
    if (!spawn(post, p)) continue;
    if (post.kind === "reserve") result.reserve++; else result.own++;
    homes.push({ p, x: post.x, y: post.y, z: post.z, site: post.kind === "reserve" ? null : post.site });
  }
  if (result.spawned > 0) {
    try {
      world.setDynamicProperty(HOMES_PROPERTY, JSON.stringify(addHomes(parseHomes(world.getDynamicProperty(HOMES_PROPERTY)), { rect: { x0: rect.x0, x1: rect.x1, z0: rect.z0, z1: rect.z1 }, loremaster: lore && !kept.has(lore) ? [lore.x, lore.y, lore.z] : null, homes })));
    } catch (e) {
      console.warn(`[lothlorien] elves: could not write the home record: ${e?.message ?? e}`);
    }
  }
  for (const post of posts) {
    if (kept.has(post)) continue;
    try { post.entity.remove(); } catch { /* unloaded meanwhile */ }
  }
  const total = assigned.length;
  console.warn(`[lothlorien] elves: village at ${at[0]},${at[1]}: ${lore ? (kept.has(lore) ? "loremaster FAILED" : "loremaster") : "no loremaster post"} + ${result.own} on own trees (${result.reserve} on reserves)${total < 4 ? `, only ${total} of 4 other professions found a post` : ""}${result.failed ? `, ${result.failed} failed` : ""}`);
  return result;
}
