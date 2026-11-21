// Population of a new Elven village as a JOB (generators, no @minecraft/server import: elf_village.js passes `engine` = { BlockPermutation, world }, the budget
// test and tools/village_steps.mjs pass fakes). It runs in loop_marker.js inside the village's ticking areas right after the build, as steps of at most
// ~128 native block reads, 16 writes and ONE structure placement / elf spawn / entity query (docs/SCRIPT_PERFORMANCE.md): the elves and the furnishing appear
// over about 0.5-1 s instead of one 74 ms call (owner 2026-11-21, plan village-hitch).
//   1 posts      the tree pieces' `lothlorien:elf_post` entities (one query), the site of each (home_furnish.js siteOfGen, cells read in paced prefetch steps)
//   2 homes      elf_rules.js assignHomes decides who stands where; one elf per assignment (spawn + home note in one step), then its pavilion is furnished:
//                the cells are read, planFurnish plans, <= 16 block writes per step, ONE structure placement per step (a cushion's entity check in the same step),
//                the fence mend of the written cells (3 cells per step)
//   3 record     the home record, then the posts go (<= 8 per step)
import { villageDebug } from "./village_debug.js";
import { ELF_ID, HOMES_PROPERTY, HOME_OF_ELF, POST_ID, addHomes, assignHomes, groupPosts, parseHomes, spawnEventOf } from "./elf_rules.js";
import { PANEL_AIR } from "./planter_panels.js";
import { findHomeGen, hasLayout, planFurnishGen, siteOfGen } from "./home_furnish.js";
import { cellsAround, mendFence } from "./rail_connections.js";
import { drive, prefetchBox } from "./village_geom.js";

const KIND_PREFIX = "elf_post_";
export const WRITES_PER_STEP = 16, MENDS_PER_STEP = 3, REMOVES_PER_STEP = 8;
export const boxQuery = (r) => ({ type: POST_ID, location: { x: r.x0, y: -64, z: r.z0 }, volume: { x: r.x1 - r.x0 + 1, y: 420, z: r.z1 - r.z0 + 1 } });

// the kind from the post's type families (definitions group lothlorien:post_<kind>); a post without one counts as a home post
export function kindOf(entity) {
  try {
    const families = entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
    const kind = families.find((f) => f.startsWith(KIND_PREFIX));
    return kind ? kind.slice(KIND_PREFIX.length) : "home";
  } catch {
    return "home";
  }
}

// A reader that remembers every cell it reads (a Map; one per post or home, so it stays small) and counts the native reads in .size(); get(x, y, z) -> type id | undefined.
export function memoReader(get, count) {
  const memo = new Map();
  let reads = 0;
  const r = (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (memo.has(k)) return memo.get(k);
    reads++; if (count) count();
    const v = get(x, y, z);
    memo.set(k, v);
    return v;
  };
  r.size = () => reads;
  return r;
}
const typeAt = (dimension) => (x, y, z) => { try { return dimension.getBlock({ x, y, z })?.typeId; } catch { return undefined; } };

// Furnishes the home pavilion round a home post for its profession (home_furnish.js): block writes for the objects, a tiny pre-built structure for each banner, planted
// flower pot and cushion (the Script API sets none of them; tools/build_furnish.mjs writes them). Every group of objects is placed whole or not at all, only into air
// cells of the furnishing area; a second run finds the cells taken and places nothing. -> number of blocks written
export function* furnishHomeGen(dimension, post, profession, engine, count) {
  const { BlockPermutation, world } = engine;
  if (!hasLayout(profession) || post.kind === "reserve") return 0;
  const nat = () => { if (count) count(); };
  const at = memoReader(typeAt(dimension), count);
  const frame = yield* findHomeGen(at, post);
  if (!frame) return 0;
  yield "furnish";
  const occupied = new Set(dimension.getEntities({ type: "minecraft:cushion", location: post, maxDistance: frame.k * 2 })
    .map((e) => { const p = e.location; return `${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`; }));
  yield "furnish";
  const k = frame.k, ends = [[-1, -1], [k, -1], [-1, k], [k, k]].map(([u, v]) => [frame.x0 + frame.du[0] * u + frame.dv[0] * v, frame.z0 + frame.du[1] * u + frame.dv[1] * v]);
  yield* prefetchBox(at, { x0: Math.min(...ends.map((e) => e[0])), x1: Math.max(...ends.map((e) => e[0])), y0: frame.y, y1: frame.y + 3, z0: Math.min(...ends.map((e) => e[1])), z1: Math.max(...ends.map((e) => e[1])) }, "furnish");
  yield "plan";
  const plan = yield* planFurnishGen(profession, frame, at, { occupied });
  let n = 0, since = 0;
  for (const w of plan.writes) {
    try { nat(); dimension.getBlock({ x: w.x, y: w.y, z: w.z }).setPermutation(BlockPermutation.resolve(w.name, w.states)); n++; }
    catch (e) { console.warn(`[lothlorien] elves: furnishing ${w.name} at ${w.x},${w.y},${w.z}: ${e?.message ?? e}`); }
    if (++since % WRITES_PER_STEP === 0) yield "furnishWrite";
  }
  yield "furnishWrite";
  for (const b of plan.structures) { // banners, planted flower pots and cushions: pre-built one-cell structures (script can set neither banner patterns, a pot's plant nor a cushion's colour)
    try {
      if (b.kind === "cushion" && dimension.getEntities({ type: "minecraft:cushion", location: { x: b.x + 0.5, y: b.y, z: b.z + 0.5 }, maxDistance: 0.8 }).length) { yield "structure"; continue; } // one cushion per cell, also on a second run
      world.structureManager.place(b.structure, dimension, { x: b.x, y: b.y, z: b.z }, { includeEntities: b.kind === "cushion" });
      n++;
    } catch (e) { console.warn(`[lothlorien] elves: structure ${b.structure} at ${b.x},${b.y},${b.z}: ${e?.message ?? e}`); }
    yield "structure";
  }
  since = 0;
  for (const p of plan.panels) {
    try { nat(); const block = dimension.getBlock(p); if (block && PANEL_AIR.has(block.typeId)) { block.setPermutation(BlockPermutation.resolve(p.name, p.states)); n++; } }
    catch (e) { console.warn(`[lothlorien] elves: planter border at ${p.x},${p.y},${p.z}: ${e?.message ?? e}`); }
    if (++since % WRITES_PER_STEP === 0) yield "panelWrite";
  }
  yield "panelWrite";
  const counted = { getBlock: (l) => { nat(); return dimension.getBlock(l); } }; // the fences round every written cell link up again: 5 cells per position, 3 positions per step
  let m = 0;
  for (const p of [...plan.writes, ...plan.structures, ...plan.panels]) {
    for (const loc of cellsAround(p)) { try { mendFence(counted, loc); } catch { /* unloaded */ } }
    if (++m % MENDS_PER_STEP === 0) yield "furnishMend";
  }
  return n;
}

// -> { spawned, own, reserve, failed }; never throws on a single bad post. at = [x, z] of the village (for the log line). count: optional, called once per native block read.
export function* populateGen(dimension, rect, at, engine, count) {
  const { world } = engine;
  const entities = dimension.getEntities(boxQuery(rect));
  yield "posts";
  if (!entities.length) return { spawned: 0, own: 0, reserve: 0, failed: 0 }; // a village that was populated before (or an old one): nothing to do
  const posts = [];
  for (const entity of entities) {
    const x = Math.floor(entity.location.x), y = Math.floor(entity.location.y), z = Math.floor(entity.location.z), post = { x, y, z };
    const site = yield* siteOfGen(memoReader(typeAt(dimension), count), post); // the pavilion's square when the home has one (home_furnish.js findHome), else the free square under the feet
    posts.push({ entity, kind: kindOf(entity), x, y, z, site });
    yield "site";
  }
  const failedPosts = new Set(), result = { spawned: 0, own: 0, reserve: 0, failed: 0 }, records = [], lines = [];
  const spawn = function* (post, p) {
    let ok = true;
    try {
      const elf = dimension.spawnEntity(ELF_ID, post.entity.location, { spawnEvent: spawnEventOf(p) });
      try { elf.setDynamicProperty(HOME_OF_ELF, `${post.x},${post.y},${post.z}`); } catch { /* the elf is there, only its home note is missing */ }
      result.spawned++;
    } catch (e) {
      failedPosts.add(post); // only for the log and the loremaster record: every post is removed below (a populated village is not planned again)
      result.failed++;
      console.warn(`[lothlorien] elves: could not spawn the ${p} at ${post.x},${post.y},${post.z}: ${e?.message ?? e}`);
      ok = false;
    }
    yield "spawn";
    return ok;
  };
  for (const { lore, others } of groupPosts(posts)) {
    const assigned = assignHomes(others, lore ? [lore.x, lore.y, lore.z] : null), homes = [], own0 = result.own, reserve0 = result.reserve, failed0 = result.failed;
    if (lore) yield* spawn(lore, "loremaster");
    for (const { post, p } of assigned) {
      if (!(yield* spawn(post, p))) continue;
      if (post.kind === "reserve") result.reserve++; else result.own++;
      try { yield* furnishHomeGen(dimension, post, p, engine, count); } catch (e) { console.warn(`[lothlorien] elves: could not furnish the ${p}'s home at ${post.x},${post.y},${post.z}: ${e?.message ?? e}`); }
      homes.push({ p, x: post.x, y: post.y, z: post.z, site: post.kind === "reserve" ? null : post.site });
    }
    records.push({ rect: { x0: rect.x0, x1: rect.x1, z0: rect.z0, z1: rect.z1 }, loremaster: lore && !failedPosts.has(lore) ? [lore.x, lore.y, lore.z] : null, homes });
    const failed = result.failed - failed0;
    lines.push(`${lore ? (failedPosts.has(lore) ? "loremaster FAILED" : "loremaster") : "no loremaster post"} + ${result.own - own0} on own trees (${result.reserve - reserve0} on reserves)${assigned.length < 4 ? `, only ${assigned.length} of 4 other professions found a post` : ""}${failed ? `, ${failed} failed` : ""}`);
  }
  if (result.spawned > 0) {
    try {
      world.setDynamicProperty(HOMES_PROPERTY, JSON.stringify(records.reduce(addHomes, parseHomes(world.getDynamicProperty(HOMES_PROPERTY)))));
    } catch (e) {
      console.warn(`[lothlorien] elves: could not write the home record: ${e?.message ?? e}`);
    }
  }
  yield "record";
  let removed = 0;
  for (const post of posts) {
    try { post.entity.remove(); } catch { /* unloaded meanwhile */ }
    if (++removed % REMOVES_PER_STEP === 0) yield "removePosts";
  }
  if (villageDebug()) console.warn(`[lothlorien] elves: village at ${at[0]},${at[1]}: ${lines.join("; ")}`);
  return result;
}
export const populateSync = (dimension, rect, at, engine) => drive(populateGen(dimension, rect, at, engine));
