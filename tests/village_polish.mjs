import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseMcstructure } from "../tools/village_sim.mjs";
import { buildBalcony } from "../tools/village_combo.mjs";
import { framePlanters, clearSeatViews } from "../tools/village_polish.mjs";
import { relinkFences } from "../tools/village_dress.mjs";
import { connectionChanges, isLinkTarget, LINKS } from "../lothlorien_bp/scripts/rail_mender_rules.js";
import { closeUnusedExitsGen } from "../lothlorien_bp/scripts/village_repair.js";
import { drive, overlay, walkDist, walkDistGen } from "../lothlorien_bp/scripts/village_planner.js";

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

const walk = (x,y,z) => y===0 && x>=0 && x<100 && z===0 ? PL : "minecraft:air";
const gen = walkDistGen(walk,{x:0,y:0,z:0}); let yields=0,r;
while(!(r=gen.next()).done) yields++;
assert.ok(yields>=4); assert.deepEqual(r.value,walkDist(walk,{x:0,y:0,z:0}));
console.log("ok   village polish: walking search yields");

const {benchmark}=await import("../tools/village_performance.mjs");
const workload=await benchmark();
assert.ok(workload.leafSample.beforeNonPersistent.blockReads>100);
assert.equal(workload.leafSample.afterPersistent.blockReads,0);
assert.equal(workload.inventory.decayLeaves,0);
console.log("ok   village polish: production leaf callback workload drops to zero world reads for decorative foliage");
