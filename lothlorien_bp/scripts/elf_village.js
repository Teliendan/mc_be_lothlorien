// Population of a new Elven village, run by the village planner (loop_marker.js planVillageAt) while the whole village is loaded.
// The tree pieces carry invisible `lothlorien:elf_post` entities (tools/build_village.mjs): one `loremaster` post and RESERVE_POSTS `reserve`
// posts on the central tree, one `home` post on every outer tree. This pass reads them all, lets elf_rules.js assignHomes decide who stands
// where (the Loremaster on the central tree, healer / gardener / woodwright / lamplighter on trees of their own, leftovers on reserve posts),
// spawns one elf per assignment with the profession event, records the result for the home milestone and removes the posts.
// Idempotent by construction: the posts are gone after one run, so a second run finds none and spawns nothing.
import { BlockPermutation, world } from "@minecraft/server";
import { ELF_ID, HOMES_PROPERTY, HOME_OF_ELF, POST_ID, addHomes, assignHomes, parseHomes, spawnEventOf } from "./elf_rules.js";
import { findHome, hasLayout, planFurnish, siteOf } from "./home_furnish.js";
import { mendAround } from "./rail_connections.js";

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

// Furnishes the home pavilion round a home post for its profession (home_furnish.js; every profession that has a layout there): block writes for the objects, a tiny
// pre-built structure for each banner (per facing), planted flower pot and cushion (the Script API sets none of them; tools/build_furnish.mjs writes them). Every group of objects is
// placed whole or not at all, only into air cells of the furnishing area; a second run finds the cells taken and places nothing. -> number of blocks written
export function furnishHome(dimension, post, profession) {
  if (!hasLayout(profession) || post.kind === "reserve") return 0;
  const get = (x, y, z) => { try { return dimension.getBlock({ x, y, z })?.typeId; } catch { return undefined; } };
  const frame = findHome(get, post);
  if (!frame) return 0;
  const occupied=new Set(dimension.getEntities({type:"minecraft:cushion",location:post,maxDistance:frame.k*2})
    .map(e=>{const p=e.location;return `${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;}));
  const plan = planFurnish(profession, frame, get, {occupied});
  let n = 0;
  for (const w of plan.writes) {
    try { dimension.getBlock({ x: w.x, y: w.y, z: w.z }).setPermutation(BlockPermutation.resolve(w.name, w.states)); n++; }
    catch (e) { console.warn(`[lothlorien] elves: furnishing ${w.name} at ${w.x},${w.y},${w.z}: ${e?.message ?? e}`); }
  }
  for (const b of plan.structures) { // banners, planted flower pots and cushions: pre-built one-cell structures (script can set neither banner patterns, a pot's plant nor a cushion's colour)
    try {
      if (b.kind === "cushion" && dimension.getEntities({ type: "minecraft:cushion", location: { x: b.x + 0.5, y: b.y, z: b.z + 0.5 }, maxDistance: 0.8 }).length) continue; // one cushion per cell, also on a second run
      world.structureManager.place(b.structure, dimension, { x: b.x, y: b.y, z: b.z }, { includeEntities: b.kind === "cushion" });
      n++;
    } catch (e) { console.warn(`[lothlorien] elves: structure ${b.structure} at ${b.x},${b.y},${b.z}: ${e?.message ?? e}`); }
  }
  for(const p of plan.panels) {
    try { const block=dimension.getBlock(p); if(block?.isAir){block.setPermutation(BlockPermutation.resolve(p.name,p.states));n++;} }
    catch(e){console.warn(`[lothlorien] elves: planter border at ${p.x},${p.y},${p.z}: ${e?.message ?? e}`);}
  }
  for (const p of [...plan.writes, ...plan.structures,...plan.panels]) mendAround(dimension, p);
  return n;
}

// -> { spawned, own, reserve, failed }; never throws on a single bad post
export function populateVillage(dimension, rect, at) {
  const get = (x, y, z) => { try { return dimension.getBlock({ x, y, z })?.typeId; } catch { return undefined; } };
  const posts = dimension.getEntities(boxQuery(rect)).map((entity) => {
    const x = Math.floor(entity.location.x), y = Math.floor(entity.location.y), z = Math.floor(entity.location.z);
    return { entity, kind: kindOf(entity), x, y, z, site: siteOf(get, { x, y, z }) }; // the pavilion's square when the home has one (home_furnish.js findHome), else the free square under the feet
  });
  if (!posts.length) return { spawned: 0, own: 0, reserve: 0, failed: 0 }; // a village that was populated before (or an old one): nothing to do
  const byPlace = (a, b) => a.x - b.x || a.z - b.z || a.y - b.y;
  const lore = posts.filter((q) => q.kind === "loremaster").sort(byPlace)[0] ?? null;
  const assigned = assignHomes(posts.filter((q) => q.kind !== "loremaster"), lore ? [lore.x, lore.y, lore.z] : null);
  const failedPosts = new Set(), result = { spawned: 0, own: 0, reserve: 0, failed: 0 }, homes = [];
  const spawn = (post, p) => {
    try {
      const elf = dimension.spawnEntity(ELF_ID, post.entity.location, { spawnEvent: spawnEventOf(p) });
      try { elf.setDynamicProperty(HOME_OF_ELF, `${post.x},${post.y},${post.z}`); } catch { /* the elf is there, only its home note is missing */ }
      result.spawned++;
      return true;
    } catch (e) {
      failedPosts.add(post); // only for the log and the loremaster record: every post is removed below (a populated village is not planned again)
      result.failed++;
      console.warn(`[lothlorien] elves: could not spawn the ${p} at ${post.x},${post.y},${post.z}: ${e?.message ?? e}`);
      return false;
    }
  };
  if (lore) spawn(lore, "loremaster");
  for (const { post, p } of assigned) {
    if (!spawn(post, p)) continue;
    if (post.kind === "reserve") result.reserve++; else result.own++;
    try { furnishHome(dimension, post, p); } catch (e) { console.warn(`[lothlorien] elves: could not furnish the ${p}'s home at ${post.x},${post.y},${post.z}: ${e?.message ?? e}`); }
    homes.push({ p, x: post.x, y: post.y, z: post.z, site: post.kind === "reserve" ? null : post.site });
  }
  if (result.spawned > 0) {
    try {
      world.setDynamicProperty(HOMES_PROPERTY, JSON.stringify(addHomes(parseHomes(world.getDynamicProperty(HOMES_PROPERTY)), { rect: { x0: rect.x0, x1: rect.x1, z0: rect.z0, z1: rect.z1 }, loremaster: lore && !failedPosts.has(lore) ? [lore.x, lore.y, lore.z] : null, homes })));
    } catch (e) {
      console.warn(`[lothlorien] elves: could not write the home record: ${e?.message ?? e}`);
    }
  }
  for (const post of posts) {
    try { post.entity.remove(); } catch { /* unloaded meanwhile */ }
  }
  const total = assigned.length;
  console.warn(`[lothlorien] elves: village at ${at[0]},${at[1]}: ${lore ? (failedPosts.has(lore) ? "loremaster FAILED" : "loremaster") : "no loremaster post"} + ${result.own} on own trees (${result.reserve} on reserves)${total < 4 ? `, only ${total} of 4 other professions found a post` : ""}${result.failed ? `, ${result.failed} failed` : ""}`);
  return result;
}
