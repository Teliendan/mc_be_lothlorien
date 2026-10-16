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
  // Capture the actual registered callback, using the same source-loading approach as
  // tests/script_performance.mjs. Growth/interaction functions aren't invoked here.
  const components=new Map(), world={beforeEvents:{playerInteractWithBlock:{subscribe(){}}}};
  const system={currentTick:1,beforeEvents:{startup:{subscribe(fn){fn({blockComponentRegistry:{registerCustomComponent(id,c){components.set(id,c);}}});}}}};
  const source=readFileSync(new URL("../lothlorien_bp/scripts/trees.js",import.meta.url),"utf8");
  globalThis.__villagePerf={system,world,BlockPermutation:{},GameMode:{},EquipmentSlot:{}};
  const transformed=source.replace(/^import .*;\r?$/gm,"");
  try { await import(`data:text/javascript;base64,${Buffer.from('const {system,world,BlockPermutation,GameMode,EquipmentSlot}=globalThis.__villagePerf;\n'+transformed).toString('base64')}#${benchmarkRun++}`); }
  finally { delete globalThis.__villagePerf; }
  const tick=components.get("lothlorien:leaves").onRandomTick;
  const crown=pieces.find(p=>p.name==="crown_central_a.mcstructure"), map=new Map(crown.blocks.map(b=>[`${b.x},${b.y},${b.z}`,b]));
  const leaves=crown.blocks.filter(b=>b.name==="lothlorien:mallorn_leaves");
  let reads=0;
  const dimension={id:"offline",getBlock(p){reads++;const b=map.get(`${p.x},${p.y},${p.z}`);return {typeId:b?.name??"minecraft:air"};},runCommand(){throw new Error("benchmark leaf unexpectedly decayed");}};
  const sample=Array.from({length:100},(_,i)=>leaves[Math.floor(i*leaves.length/100)]);
  const measure=persistent=>{
    reads=0;const t=performance.now();
    for(const b of sample) tick({block:{location:{x:b.x,y:b.y,z:b.z},dimension,permutation:{getState:()=>persistent}},dimension});
    return {callbacks:sample.length,blockReads:reads,nodeMs:Math.round((performance.now()-t)*1000)/1000};
  };
  return {evidence:"Offline production callback workload; Node timing is not Minecraft CPU, FPS or low-end certification.",inventory,leafSample:{piece:crown.name,beforeNonPersistent:measure(false),afterPersistent:measure(true)}};
}

if(process.argv[1] && realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))) {
  const result=await benchmark(), json=JSON.stringify(result,null,2)+"\n";
  if(process.argv[2]) writeFileSync(process.argv[2],json);
  console.log(json);
}
