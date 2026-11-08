// Offline workload benchmark, not a device FPS/TPS claim. Uses shipped pieces and
// the production leaf callback; no Minecraft process or world files are required.
// node tools/village_performance.mjs [output.json]
import { readFileSync, writeFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { parseMcstructure } from "./village_sim.mjs";
let benchmarkRun = 0;

export async function benchmark() {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  const pieces = readdirSync(dir).filter(f => f.endsWith(".mcstructure")).map(f => parseMcstructure(readFileSync(new URL(f,dir)),f));
  const inventory = {pieces:pieces.length,hiddenLights:0,visibleLights:0,leaves:0,decayLeaves:0,cushions:0};
  for(const p of pieces) {
    inventory.cushions += p.entities.filter(e=>e.id==="minecraft:cushion").length;
    for(const b of p.blocks) {
      if(/light_block/.test(b.name)) inventory.hiddenLights++;
      if(/elven_lantern|chandelier|firefly_jar|cave_vines.*berries|froglight/.test(b.name)) inventory.visibleLights++;
      if(b.name==="lothlorien:mallorn_leaves") { inventory.leaves++; if(!b.states["lothlorien:persistent"]) inventory.decayLeaves++; }
    }
  }
  // Load the production trees.js (same source-loading approach as tests/script_performance.mjs). Leaves have no random
  // tick since 2026-11-08 (event-driven decay); the sample breaks one crown leaf and runs the resulting decay search.
  const components=new Map(), jobs=[], timers=new Map(), subscribe=()=>{};
  const world={beforeEvents:{playerInteractWithBlock:{subscribe}},afterEvents:{playerBreakBlock:{subscribe},blockExplode:{subscribe},playerPlaceBlock:{subscribe}}};
  const system={currentTick:1,runJob:g=>jobs.push(g),runInterval:fn=>{timers.set(timers.size+1,fn);return timers.size;},clearRun:id=>timers.delete(id),
    beforeEvents:{startup:{subscribe(fn){fn({blockComponentRegistry:{registerCustomComponent(id,c){components.set(id,c);}}});}}}};
  const source=readFileSync(new URL("../lothlorien_bp/scripts/trees.js",import.meta.url),"utf8");
  globalThis.__villagePerf={system,world,BlockPermutation:{},GameMode:{},EquipmentSlot:{}};
  // tree_interaction_rules.js and leaf_decay.js have no imports of their own: inline them.
  const inline=f=>readFileSync(new URL(`../lothlorien_bp/scripts/${f}`,import.meta.url),"utf8").replace(/^export /gm,"");
  const transformed=inline("tree_interaction_rules.js")+"\n"+inline("leaf_decay.js")+"\n"+source.replace(/^import .*;\r?$/gm,"");
  try { await import(`data:text/javascript;base64,${Buffer.from('const {system,world,BlockPermutation,GameMode,EquipmentSlot}=globalThis.__villagePerf;\n'+transformed).toString('base64')}#${benchmarkRun++}`); }
  finally { delete globalThis.__villagePerf; }
  const leafComponent=components.get("lothlorien:leaves");
  const crown=pieces.find(p=>p.name==="crown_central_a.mcstructure"), map=new Map(crown.blocks.map(b=>[`${b.x},${b.y},${b.z}`,b]));
  const leaf=crown.blocks.find(b=>b.name==="lothlorien:mallorn_leaves");
  map.delete(`${leaf.x},${leaf.y},${leaf.z}`);
  let reads=0, decayed=0;
  const dimension={id:"offline",getBlock(p){reads++;const b=map.get(`${p.x},${p.y},${p.z}`);
    return {typeId:b?.name??"minecraft:air",permutation:{getState:k=>b?.states?.[k]}};},runCommand(){decayed++;}};
  const t=performance.now();
  leafComponent.onBreak({block:{location:{x:leaf.x,y:leaf.y,z:leaf.z}},dimension});
  for(const job of jobs) for(let r=job.next();!r.done;r=job.next()) {}
  for(let i=0;i<300&&timers.size;i++) { system.currentTick++; for(const fn of [...timers.values()]) fn(); } // decay removals
  return {evidence:"Offline production callback workload; Node timing is not Minecraft CPU, FPS or low-end certification.",inventory,
    leafRandomTick:leafComponent.onRandomTick===undefined?"none":"present",
    breakSample:{piece:crown.name,searches:jobs.length,blockReads:reads,decayed,nodeMs:Math.round((performance.now()-t)*1000)/1000}};
}

if(process.argv[1] && realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))) {
  const result=await benchmark(), json=JSON.stringify(result,null,2)+"\n";
  if(process.argv[2]) writeFileSync(process.argv[2],json);
  console.log(json);
}
