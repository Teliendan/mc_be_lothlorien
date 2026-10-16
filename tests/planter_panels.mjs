import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";
import { register } from "node:module";
import { isPlanterPanel,planterWalkName,PANEL_DIRS,PANEL_ID,planPlanterPanels,panelBlock } from "../lothlorien_bp/scripts/planter_panels.js";
import { framePlanters } from "../tools/village_polish.mjs";
import { keepClearViolations,supportCheck } from "../tools/village_checks.mjs";
import { parseMcstructure,applyPlan,wkey } from "../tools/village_sim.mjs";
import { sideTarget } from "../lothlorien_bp/scripts/village_loop.js";
import { findHome,frameArea,frameCell,framePost,planFurnish,frameLamp } from "../lothlorien_bp/scripts/home_furnish.js";
import { checkWalk } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";

const key=(x,y,z)=>`${x},${y},${z}`,PL="lothlorien:mallorn_planks";
const blk=(name,states={})=>({name,states});
const m=new Map();
for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)m.set(key(x,0,z),blk(PL));
m.set(key(0,1,0),blk("minecraft:moss_block"));
const keep=new Set(PANEL_DIRS.map(d=>key(d.dx,1,d.dz)));
assert.equal(framePlanters(m,keep).length,4,"protected center lanes do not suppress their thin side borders");
const get=(x,y,z)=>m.get(key(x,y,z));
assert.deepEqual(keepClearViolations(m,keep),[]);
assert.deepEqual(supportCheck(m),[]);
for(const d of PANEL_DIRS)assert.equal(isPlanterPanel(get,d.dx,1,d.dz),true);
const wrong=blk(PANEL_ID,{...panelBlock(PANEL_DIRS[0]).states,"minecraft:cardinal_direction":"west"});
assert.equal(isPlanterPanel(get,1,1,0,wrong),false,"screen facing another direction is not a planter skirt");
assert.equal(isPlanterPanel(get,1,1,0,blk(PANEL_ID)),false,"closed trapdoor is still solid");
const walkGet=(x,y,z)=>isPlanterPanel(get,x,y,z)?undefined:get(x,y,z);
const walk=checkWalk(walkGet,{x0:-2,x1:2,y0:0,y1:3,z0:-2,z1:2},{must:[{x:1,y:1,z:0},{x:-1,y:1,z:0}]});
assert.ok(!walk.violations.some(v=>v.rule==="unreachable"));
// Collision dimensions come from the actual block, not the old whole-cell assumption.
const trap=JSON.parse(readFileSync(new URL("../lothlorien_bp/blocks/mallorn_trapdoor.json",import.meta.url)))["minecraft:block"];
assert.ok(1-2*trap.components["minecraft:collision_box"].size[1]/16>0.6,"two skirts leave enough width for the pinned vanilla player's 0.6 collider");
const edge=new Map([[key(0,0,0),blk(PL)],[key(0,1,0),blk("minecraft:moss_block")],[key(-1,0,-1),blk(PL)],[key(1,0,1),blk(PL)]]);
assert.equal(framePlanters(edge,new Set()).length,4,"a moss-attached side needs no separate floor under its trapdoor");
assert.deepEqual(supportCheck(edge),[]);
assert.equal(planPlanterPanels(()=>undefined,[{x:0,y:1,z:0}]).length,0,"unloaded runtime targets are not empty space");
console.log("ok   planter borders: thin path-side panels, actual collision width, correct mounting, off-deck support and unloaded targets");

const joint=new Map();
for(let x=-2;x<=2;x++)for(let z=0;z<=2;z++)joint.set(key(x,0,z),blk(PL));
for(let x=-2;x<=2;x++)joint.set(key(x,1,0),blk("lothlorien:mallorn_fence"));
joint.set(key(2,1,1),blk("minecraft:moss_block"));joint.set(key(1,1,1),panelBlock(PANEL_DIRS[1]));
const jointGet=(x,y,z)=>joint.get(key(x,y,z))??blk("minecraft:air");
assert.equal(sideTarget(planterWalkName(jointGet),0,0,0,[0,1]),true,"a thin skirt must not hide a real bridge start");
const world=new Map(),states=new Map();
for(const [k,b]of joint){const [x,y,z]=k.split(",").map(Number);world.set(wkey(x,y,z),b.name);states.set(wkey(x,y,z),b.states);}
applyPlan(world,states,{cells:[{x:1,y:1,z:1,kind:"air"}],rails:[]});
assert.equal(world.get(wkey(1,1,1)),PANEL_ID,"opening a bridge's center lane preserves its side skirt");
console.log("ok   planter borders: bridge-start recognition and bridge air writes preserve moss-mounted borders");

const dir=new URL("../lothlorien_bp/structures/lothlorien/village/",import.meta.url);
let sides=0;
for(const f of readdirSync(dir).filter(f=>f.endsWith(".mcstructure"))) {
  const p=parseMcstructure(readFileSync(new URL(f,dir)),f),map=new Map(p.blocks.map(b=>[key(b.x,b.y,b.z),b])),reserved=new Set();
  const at=(x,y,z)=>p.at(x,y,z);
  for(const e of p.entities) {
    const [x,y,z]=e.pos.map(Math.floor);
    if(e.id==="minecraft:cushion")reserved.add(key(x,y,z));
    if(e.id==="lothlorien:elf_post"){
      const frame=findHome(at,{x,y,z});
      if(frame)for(const [u,v] of frameArea(frame)){const [a,b]=frameCell(frame,u,v);reserved.add(key(a,frame.y+1,b));}
    }
  }
  for(const b of p.blocks)if(b.name==="minecraft:moss_block"&&/mallorn_(heartwood_)?planks$/.test(at(b.x,b.y-1,b.z)??""))for(const d of PANEL_DIRS){
    const x=b.x+d.dx,z=b.z+d.dz;
    if(x<0||x>=p.size[0]||z<0||z>=p.size[2]||reserved.has(key(x,b.y,z)))continue;
    const q=map.get(key(x,b.y,z));
    assert.ok(q && !/^(minecraft:(air|cave_air|void_air))$/.test(q.name),`${f}: exposed available bed face at ${b.x},${b.y},${b.z} ${d.name}`);
    if(isPlanterPanel((a,y,c)=>map.get(key(a,y,c)),x,b.y,z))sides++;
  }
}
assert.ok(sides>100);console.log(`ok   planter borders: all available static bed sides are covered (${sides} correctly mounted panels)`);

for(const k of [4,5,6,7])for(const dv of [[1,0],[-1,0],[0,1],[0,-1]])for(const profession of ["healer","gardener"]){
  const frame={x0:10,z0:20,du:[-dv[1],dv[0]],dv,k,y:40},map=new Map();
  for(let u=-1;u<=k;u++)for(let v=-1;v<=k;v++){const [x,z]=frameCell(frame,u,v);map.set(key(x,40,z),blk(PL));}
  const at=(x,y,z)=>map.get(key(x,y,z))?.name??"minecraft:air";
  const plan=planFurnish(profession,frame,at);
  for(const p of [...plan.writes,...plan.structures,...plan.panels])map.set(key(p.x,p.y,p.z),blk(p.name,p.states));
  const get=(x,y,z)=>map.get(key(x,y,z)),[px,pz]=frameCell(frame,...framePost(frame));
  for(const p of plan.panels){assert.ok(isPlanterPanel(get,p.x,p.y,p.z));assert.ok(p.x!==px||p.z!==pz);}
  for(const bed of plan.writes.filter(p=>p.name==="minecraft:moss_block"))for(const d of PANEL_DIRS){
    const x=bed.x+d.dx,z=bed.z+d.dz,inside=Array.from({length:k*k},(_,i)=>frameCell(frame,Math.floor(i/k),i%k)).some(c=>c[0]===x&&c[1]===z);
    if(inside&&!(x===px&&z===pz))assert.notEqual(at(x,bed.y,z),"minecraft:air",`${profession} k${k}: runtime bed missing ${d.name} side`);
  }
}
console.log("ok   planter borders: runtime healer/gardener beds have every available side in all orientations and sizes");

register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs",import.meta.url));
const {__mock:mock}=await import("@minecraft/server");mock.reset();
const frame={x0:10,z0:20,du:[1,0],dv:[0,1],k:5,y:40},native=new Map();
for(let u=-2;u<=7;u++)for(let v=-2;v<=7;v++){const [x,z]=frameCell(frame,u,v);native.set(key(x,40,z),PL);}
for(const u of [0,4]){const [x,z]=frameCell(frame,u,4);for(const h of [1,2,3])native.set(key(x,40+h,z),"lothlorien:mallorn_stripped_log");}
const [lx,lz]=frameCell(frame,...frameLamp(frame));native.set(key(lx,43,lz),"lothlorien:elven_lantern_heartwood");
mock.setBlocks((x,y,z)=>native.get(key(x,y,z))??"minecraft:air");
const [px,pz]=frameCell(frame,...framePost(frame)),[cx,cz]=frameCell(frame,1,3);
mock.addEntity("minecraft:cushion",{x:cx+0.5,y:41,z:cz+0.5});
const {furnishHome}=await import("../lothlorien_bp/scripts/elf_village.js?planter_panels");
const dimension=mock.dimension();furnishHome(dimension,{x:px,y:41,z:pz,kind:"home"},"healer");
const panels=[...dimension.overrides].filter(([,b])=>b.id===PANEL_ID);
assert.ok(panels.length>0,"actual runtime writer must apply the border plan, not just ordinary furniture");
assert.notEqual(dimension.getBlock({x:cx,y:41,z:cz}).typeId,PANEL_ID,"an existing cushion keeps its floor cell");
for(const [k] of panels){const [x,y,z]=k.split(",").map(Number);const get=(a,b,c)=>{const p=dimension.getBlock({x:a,y:b,z:c});return {name:p.typeId,states:p.permutation.states};};assert.ok(isPlanterPanel(get,x,y,z));}
assert.equal(mock.pending,0,"framing adds no idle timer");
console.log("ok   planter borders: production home writer applies panels and preserves existing cushion actors without polling");
