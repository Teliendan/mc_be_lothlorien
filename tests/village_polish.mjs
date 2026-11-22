import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildBalcony } from "../tools/village_combo.mjs";
import { framePlanters, clearSeatViews } from "../tools/village_polish.mjs";
import { isPlanterPanel } from "../lothlorien_bp/scripts/planter_panels.js";
import { relinkFences } from "../tools/village_dress.mjs";
import { connectionChanges, isLinkTarget, LINKS } from "../lothlorien_bp/scripts/rail_mender_rules.js";
import { closeUnusedExitsGen } from "../lothlorien_bp/scripts/village_repair.js";
import { boundedReader, drive, overlay, walkDist, walkDistGen } from "../lothlorien_bp/scripts/village_planner.js";
import { parseMcstructure } from "../../../.claude/skills/bedrock-worldgen/scripts/mcstructure.mjs";

const key = (x,y,z) => `${x},${y},${z}`;
const PL = "lothlorien:mallorn_planks", F = "lothlorien:mallorn_fence";
const block = (name, states = {}) => ({name,states});
const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);

const balcony = buildBalcony();
assert.equal(balcony.cushions.length, 2, "the second balcony seat must not be replaced by a corner rail");
const [a,b] = balcony.cushions;
assert.equal(Math.abs(a.x-b.x)+Math.abs(a.z-b.z), 1);
for (const c of balcony.cushions) for (const h of [1,2]) assert.ok(!/fence|log/.test(balcony.blocks.get(key(c.x,c.y+h,c.z))?.name));

for (const f of readdirSync(dir).filter(f => f.endsWith(".mcstructure"))) {
  const p = parseMcstructure(readFileSync(new URL(f,dir)), f);
  for (const b of p.blocks) {
    if (/_log$|_wood$/.test(b.name)) assert.ok(!/fence$/.test(p.at(b.x,b.y-1,b.z) ?? ""), `${f}: wood on fence at ${b.x},${b.y},${b.z}`);
    if (b.name === "lothlorien:mallorn_leaves") assert.equal(!!b.states["lothlorien:persistent"], true, `${f}: decorative leaves must skip decay searches`);
    if (b.name === F) for (const l of LINKS) if (isLinkTarget(p.at(b.x+l.dx,b.y,b.z+l.dz))) assert.equal(!!b.states[l.state], true, `${f}: missed ${l.state} at ${b.x},${b.y},${b.z}`);
  }
  for (const c of p.entities.filter(e => e.id === "minecraft:cushion")) {
    const [x,y,z] = c.pos.map(Math.floor);
    for (const l of LINKS) if (/fence$/.test(p.at(x+l.dx,y,z+l.dz) ?? "")) assert.ok(!/flower_pot$|firefly_jar$/.test(p.at(x+l.dx,y+1,z+l.dz) ?? ""), `${f}: seat view blocked at ${x},${y},${z}`);
  }
}
console.log("ok   village polish: shipped seats, wood feet, persistent leaves and all known fence targets");

// Elves hop over an open panel and a hop fails without headroom (owner, 1.26.63, 2026-11-22): no moss bed in a shipped piece has a skirt at both ends of one of its rows
// with a rail (or no deck) beyond one of them, i.e. a row of skirt, moss, skirt that shuts a narrow lane (the 3-wide trunk-rail lane of combo_node_e_*).
let beds = 0;
for (const f of readdirSync(dir).filter(f => /^(combo_node_e_|balcony_braced|lookout_01).*\.mcstructure$/.test(f))) { // the pieces with a 3-wide trunk-rail lane (owner-approved scope; the trunk-foot beds of other pieces are not part of this rule)
  const p = parseMcstructure(readFileSync(new URL(f,dir)), f), st = new Map(p.blocks.map(b => [key(b.x,b.y,b.z), b]));
  const nm = (x,y,z) => p.at(x,y,z) ?? "minecraft:air";
  const moss = (x,y,z) => nm(x,y,z) === "minecraft:moss_block" && /mallorn_(heartwood_)?planks$/.test(nm(x,y-1,z));
  const skirt = (x,y,z) => nm(x,y,z) === "lothlorien:mallorn_trapdoor" && isPlanterPanel((a,b,c) => ({ name: nm(a,b,c), states: st.get(key(a,b,c))?.states }), x, y, z);
  const open = (x,y,z) => /mallorn_(heartwood_)?planks$/.test(nm(x,y-1,z)) && !/fence$/.test(nm(x,y,z));
  for (const b of p.blocks) {
    if (!moss(b.x,b.y,b.z)) continue;
    beds++;
    for (const [dx,dz] of [[1,0],[0,1]]) {
      let ax = b.x, az = b.z, bx = b.x, bz = b.z;
      while (moss(ax+dx,b.y,az+dz)) { ax += dx; az += dz; }
      while (moss(bx-dx,b.y,bz-dz)) { bx -= dx; bz -= dz; }
      if (skirt(ax+dx,b.y,az+dz) && skirt(bx-dx,b.y,bz-dz))
        assert.ok(open(ax+2*dx,b.y,az+2*dz) && open(bx-2*dx,b.y,bz-2*dz), `${f}: skirt, moss, skirt shuts a lane at ${b.x},${b.y},${b.z}`);
    }
  }
}
assert.ok(beds >= 6, `${beds} moss beds scanned`);
console.log("ok   village polish: no rim planter of combo_node_e_*, balcony_braced or lookout_01 shuts a narrow lane with a skirt at each end");

// Where a bed is not placed (the rule above) the dressing sets pots instead (owner 2026-11-22): the node_e pieces carry flower pots on rail posts, and no floor pot or jar in any
// shipped piece cuts a walkable cell off from its neighbours or stands in a 1-wide lane (elves treat every pot and jar as an obstacle).
{
  let railPots = 0, floorPots = 0;
  const nodeE = {};
  for (const f of readdirSync(dir).filter(f => f.endsWith(".mcstructure"))) {
    const p = parseMcstructure(readFileSync(new URL(f,dir)), f), nm = (x,y,z) => p.at(x,y,z) ?? "minecraft:air";
    const st = new Map(p.blocks.map(b => [key(b.x,b.y,b.z), b]));
    const isPot = n => /^minecraft:(flower_pot|decorated_pot)$|firefly_jar$/.test(n);
    const SOFT = /(^|:)(air|cave_air|void_air|structure_void)$|light_block|carpet|wall_banner|pale_hanging_moss|cave_vines|glow_lichen|spore_blossom|elven_rope/;
    const skirt = (x,y,z) => nm(x,y,z) === "lothlorien:mallorn_trapdoor" && isPlanterPanel((a,b,c) => ({ name: nm(a,b,c), states: st.get(key(a,b,c))?.states }), x, y, z);
    const free = (x,y,z) => SOFT.test(nm(x,y,z)) || skirt(x,y,z);
    for (const b of p.blocks) {
      if (!isPot(b.name)) continue;
      const deck = /mallorn_(heartwood_)?planks$/.test(nm(b.x,b.y-1,b.z));
      if (!deck) { if (nm(b.x,b.y-1,b.z) === "lothlorien:mallorn_fence" && b.name === "minecraft:flower_pot") { railPots++; if (/^combo_node_e_/.test(f)) nodeE[f] = (nodeE[f] ?? 0) + 1; } continue; }
      floorPots++;
      const walk = (x,z) => /mallorn_(heartwood_)?planks$/.test(nm(x,b.y-1,z)) && free(x,b.y,z) && free(x,b.y+1,z) && !(x === b.x && z === b.z);
      const nbrs = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz]) => [b.x+dx,b.z+dz]).filter(([x,z]) => walk(x,z));
      // the neighbours of the pot cell stay one piece (a flood fill without the pot cell reaches them all), unless the pot only has one open side
      if (nbrs.length >= 2) {
        const seen = new Set([nbrs[0].join()]), q = [nbrs[0]];
        for (let i = 0; i < q.length && seen.size < 4000; i++) for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const x = q[i][0]+dx, z = q[i][1]+dz; if (!seen.has(`${x},${z}`) && walk(x,z)) { seen.add(`${x},${z}`); q.push([x,z]); } }
        assert.ok(nbrs.every(n => seen.has(n.join())), `${f}: the ${b.name} at ${b.x},${b.y},${b.z} cuts the deck in two`);
      }
      const lane = [[1,0],[0,1]].some(([dx,dz]) => walk(b.x+dx,b.z+dz) && walk(b.x-dx,b.z-dz) && !walk(b.x+dz,b.z+dx) && !walk(b.x-dz,b.z-dx));
      assert.ok(!lane, `${f}: the ${b.name} at ${b.x},${b.y},${b.z} stands in a 1-wide lane`);
    }
  }
  for (const f of readdirSync(dir).filter(f => /^combo_node_e_/.test(f))) assert.ok((nodeE[f] ?? 0) >= 4, `${f}: pots stand in for the planters the lane rule rejected (${nodeE[f] ?? 0})`);
  assert.ok(railPots >= 8, `${railPots} flower pots on rail posts`);
  console.log(`ok   village polish: ${railPots} rail-post flower pots and ${floorPots} floor pots or jars in the shipped pieces, none cuts the deck or stands in a 1-wide lane`);
}

const m = new Map([[key(0,1,0),block(F)],[key(1,1,0),block("minecraft:moss_block")],[key(-1,1,0),block("lothlorien:mallorn_slab")]]);
relinkFences(m);
assert.equal(m.get(key(0,1,0)).states["minecraft:connection_east"],true);
assert.equal(m.get(key(0,1,0)).states["minecraft:connection_west"],true);
assert.deepEqual(connectionChanges({x:0,y:0,z:0}, (x,y,z) => x===1 ? "minecraft:air" : undefined, s=>s.endsWith("east")), [["minecraft:connection_east",false]], "remove stale air link but preserve unloaded directions");

const garden = new Map();
for(let x=-3;x<=3;x++) for(let z=-3;z<=3;z++) garden.set(key(x,0,z),block(PL));
garden.set(key(0,1,0),block("minecraft:moss_block"));
framePlanters(garden,new Set());
for(const l of LINKS) assert.equal(garden.get(key(l.dx,1,l.dz))?.name,"lothlorien:mallorn_trapdoor","every free side gets its panel");
const seat = new Map([[key(1,1,0),block(F)],[key(1,1,1),block(F)],[key(1,2,0),{...block("minecraft:flower_pot"),plant:{name:"lothlorien:elanor",states:{}}}]]);
clearSeatViews(seat,new Set(),[{x:0,y:0,z:0}]);
assert.equal(seat.get(key(1,2,0)).name,"minecraft:air");
assert.equal(seat.get(key(1,2,1)).plant.name,"lothlorien:elanor","moving the pot preserves native plant data");
console.log("ok   village polish: moss/slab links, unload safety, four-sided bed and intact moved pot");

// Three-cell opening above a lower bridge: the lower floor must not hide the upper drop.
function mouth(onward = false, step = false, turn = 0) {
  const cells = new Map(), pos = (x,y,z) => {for(let i=0;i<turn;i++) [x,z]=[-z,x];return key(x,y,z);};
  for(let x=-2;x<=2;x++) for(let z=-2;z<=0;z++) cells.set(pos(x,24,z),PL);
  for(const x of [-2,2]) cells.set(pos(x,25,0),F);
  for(let x=-1;x<=1;x++) cells.set(pos(x,16,1),PL);
  if(onward) for(let x=-1;x<=1;x++) cells.set(pos(x,step==='up'?25:step?23:24,1),step?"lothlorien:mallorn_slab":PL);
  return overlay((x,y,z)=>cells.get(key(x,y,z)) ?? "minecraft:air");
}
const rect = {x0:-5,x1:5,z0:-5,z1:5};
for(const turn of [0,1,2,3]) {
  const at = mouth(false,false,turn), caps=drive(closeUnusedExitsGen(at,rect,[24]));
  assert.equal(caps.length,1); assert.equal(caps[0].rails.length,3);
  assert.equal(drive(closeUnusedExitsGen(at,rect,[24])).length,0,"one-shot cap is idempotent");
  for(const step of [false,true,'up']) assert.equal(drive(closeUnusedExitsGen(mouth(true,step,turn),rect,[24])).length,0,"connected bridge/descending or rising half step remains open");
}
console.log("ok   village polish: upper unused mouth closes above a bridge, rotations, idempotence, real joins remain open");

// Two mouths at a deck corner: capping the north one puts up the rail post that the east one still lacks, so a scan from a fixed shoulder list would miss it.
{
  const cells = new Map(), rect2 = {x0:0,x1:20,z0:0,z1:20};
  for(let x=2;x<=11;x++) for(let z=2;z<=10;z++) cells.set(key(x,24,z),PL);
  for(const [x,z] of [[8,10],[12,10],[11,6],[11,14]]) cells.set(key(x,25,z),F);
  const get = (x,y,z)=>cells.get(key(x,y,z)) ?? "minecraft:air";
  const layer = function* (y,ids,r) { const out=[]; for(const k of cells.keys()) { const [x,h,z]=k.split(",").map(Number); if(h===y && ids.includes(cells.get(k)) && x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1) out.push([x,z]); } yield; return out; };
  const plain = drive(closeUnusedExitsGen(overlay(boundedReader(get,rect2)),rect2,[24]));
  const fast = drive(closeUnusedExitsGen(overlay(boundedReader(get,rect2,layer)),rect2,[24]));
  assert.equal(plain.length,2,"the first cap makes the second mouth");
  assert.deepEqual(fast,plain,"the layer path finds the same caps in the same order");
  console.log("ok   village polish: a layer scan equals the plain scan, also when a cap creates the next mouth");
}

const walk = (x,y,z) => y===0 && x>=0 && x<100 && z===0 ? PL : "minecraft:air";
const gen = walkDistGen(walk,{x:0,y:0,z:0}); let yields=0,r;
while(!(r=gen.next()).done) yields++;
assert.ok(yields>=4); assert.deepEqual(r.value,walkDist(walk,{x:0,y:0,z:0}));
console.log("ok   village polish: walking search yields");

const {benchmark}=await import("../tools/village_performance.mjs");
const workload=await benchmark();
assert.equal(workload.leafRandomTick,"none","leaves cost nothing while nobody breaks them");
assert.equal(workload.breakSample.searches,1); assert.ok(workload.breakSample.blockReads>0);
assert.equal(workload.breakSample.decayed,0,"decorative crown foliage never decays");
assert.equal(workload.inventory.decayLeaves,0);
console.log("ok   village polish: leaves have no random tick; a break in decorative foliage searches once and decays nothing");
