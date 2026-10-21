// Conservative offline footprint audit. No world writes or exact Bedrock RNG.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadVillageData, rotated } from "./village_sim.mjs";

const EMPTY = "minecraft:empty";
const mod = join(dirname(fileURLToPath(import.meta.url)), "..");
export const bounds = (origin, size) => ({ min: [...origin], max: origin.map((v, i) => v + size[i] - 1) });
export const overlaps = (a, b) => a.min.every((v, i) => v <= b.max[i] && a.max[i] >= b.min[i]);

// Enumerate every possible single attachment path, including depth-limit
// fallback pieces. Ignore competing sibling branches: they can only remove
// candidates, so this intentionally overestimates the completed assembly.
// Ancestor collisions and the real configured distance limits still apply.
// Native terrain matching is not modelled; this audit requires rigid pieces.
export function assemblyEnvelope(data) {
  const { structure: s, pools, getPiece } = data;
  const distance = s.max_distance_from_center;
  const horizontal = typeof distance === "number" ? distance : distance.horizontal;
  const vertical = typeof distance === "number" ? distance : distance.vertical ?? horizontal;
  const hull = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const witnesses = Array(6).fill(null);
  const pending = [];
  let paths = 0, deepest = 0;
  function add(location, rotation, origin, depth, used, ancestors, path) {
    const rp = rotated(getPiece(location), rotation), box = bounds(origin, rp.size);
    if (ancestors.length && (box.min.some((v, i) => v < -(i === 1 ? vertical : horizontal))
      || box.max.some((v, i) => v > (i === 1 ? vertical : horizontal))
      || ancestors.some(a => overlaps(a, box)))) return;
    paths++; deepest = Math.max(deepest, depth);
    for (let i = 0; i < 3; i++) {
      if (box.min[i] < hull.min[i]) { hull.min[i] = box.min[i]; witnesses[i] = path; }
      if (box.max[i] > hull.max[i]) { hull.max[i] = box.max[i]; witnesses[i + 3] = path; }
    }
    if (depth > 20 || paths > 2000000) throw new Error("unbounded/oversized attachment graph; audit aborted");
    pending.push({ rp, origin, depth, used, ancestors: [...ancestors, box], path });
  }
  const single = element => {
    if (element.element_type === "minecraft:empty_pool_element") return null;
    if (element.element_type !== "minecraft:single_pool_element" || (element.projection ?? "rigid") !== "rigid")
      throw new Error("footprint audit supports rigid single-template elements only");
    return element.location;
  };
  for (const entry of pools.get(s.start_pool).elements) {
    const location = single(entry.element);
    if (!location) continue;
    for (let turn = 0; turn < 4; turn++) {
      const piece = rotated(getPiece(location), turn);
      const anchor = piece.jigsaws.find(j => j.name === s.start_jigsaw_name);
      if (!anchor) throw new Error(`missing start anchor in ${location}`);
      add(location, turn, [-anchor.x, -anchor.y, -anchor.z], 0, null, [], [location]);
    }
  }
  while (pending.length) {
    const p = pending.pop();
    for (const pj of p.rp.jigsaws) {
      if (pj === p.used || pj.pool === EMPTY || !pj.vec) continue;
      const pool = pools.get(pj.pool);
      if (!pool) throw new Error(`missing child pool ${pj.pool}`);
      const fallback = pool.fallback && pool.fallback !== EMPTY ? pools.get(pool.fallback) : null;
      if (pool.fallback && pool.fallback !== EMPTY && !fallback) throw new Error(`missing fallback ${pool.fallback}`);
      const candidates = [...(p.depth < s.max_depth ? pool.elements : []), ...(fallback?.elements ?? [])];
      const cell = p.origin.map((v, i) => v + [pj.x, pj.y, pj.z][i] + pj.vec[i]);
      for (const location of new Set(candidates.map(e => single(e.element)).filter(Boolean))) {
        for (let turn = 0; turn < 4; turn++) {
          const piece = rotated(getPiece(location), turn);
          for (const cj of piece.jigsaws) {
            if (cj.name !== pj.target || !cj.vec || cj.vec.some((v, i) => v !== -pj.vec[i])) continue;
            const origin = cell.map((v, i) => v - [cj.x, cj.y, cj.z][i]);
            add(location, turn, origin, p.depth + 1, cj, p.ancestors, [...p.path, location]);
          }
        }
      }
    }
  }
  return { hull, paths, deepest, witnesses,
    horizontalRadius: Math.max(Math.abs(hull.min[0]), Math.abs(hull.max[0]), Math.abs(hull.min[2]), Math.abs(hull.max[2])) };
}

// Standard random-spread integer candidate model already used by the local
// landscape tests. Candidate offsets: 0 .. spacing-separation-1 chunks.
// Adjacent cells can put starts (separation+1)*16 blocks apart along an axis.
export function spacingForRadius(radius, margin = 0, freeColumns = 0) {
  if ([radius, margin, freeColumns].some(v => !Number.isSafeInteger(v) || v < 0))
    throw new Error("radius, margin and clearance must be nonnegative integers");
  const requiredDistance = 2 * (radius + margin) + 1 + freeColumns;
  const separation = Math.max(0, Math.ceil(requiredDistance / 16) - 1);
  const spacing = 2 * separation + 1; // strict engine rule: separation < spacing/2
  const minimumDistance = (separation + 1) * 16;
  return { radius, margin, freeColumns, requiredDistance, spacing, separation, minimumDistance,
    actualFreeColumns: minimumDistance - (2 * (radius + margin) + 1),
    averageCellWidth: spacing * 16, candidatesPerMillionBlocks: 1000000 / (spacing * 16) ** 2 };
}

export function spacingReport() {
  const data = loadVillageData();
  // A developer's simulation depth override must not change this source audit.
  data.structure = JSON.parse(readFileSync(join(mod, "lothlorien_bp/worldgen/structures/elven_village.json"), "utf8"))["minecraft:jigsaw"];
  const village = assemblyEnvelope(data);
  const existing = JSON.parse(readFileSync(join(mod, "lothlorien_bp/worldgen/structure_sets/giant_mallorn.json"), "utf8"))["minecraft:structure_set"].placement;
  const currentDensity = 1000000 / (existing.spacing * 16) ** 2;
  // 12 is the earlier prototype's allowance, not a proven bound for every
  // runtime finisher or a licence to shrink production reservations.
  const options = [
    { name: "Configured village reservation", ...spacingForRadius(116, 12, 0) },
    { name: "Configured reservation + 64 clear columns", ...spacingForRadius(116, 12, 64) },
    { name: "Enumerated template paths + provisional 12 allowance", ...spacingForRadius(village.horizontalRadius, 12, 0) },
  ].map(o => ({ ...o, densityReductionAgainstCurrentTreeGrid: currentDensity / o.candidatesPerMillionBlocks,
    villageCandidatesPerMillionBlocksAtOneInNine: o.candidatesPerMillionBlocks / 9 }));
  return { date: "2026-10-18", target: "1.26.52", evidence: "offline rigid-template graph and spacing arithmetic; not native generation proof",
    village, currentTreeGrid: { ...existing, averageCellWidth: existing.spacing * 16, candidatesPerMillionBlocks: currentDensity },
    desiredIndividualWeights: { village: 2, platform: 3, plain: 5, small: 8 }, options,
    caveats: ["No biome rejection or eligible biome area included in candidate densities.",
      "All possible attachment paths are enumerated; sibling collisions are ignored conservatively.",
      "The 12-block finishing allowance is provisional; runtime additions need an independent bound.",
      "Separate salts/independent sets have no established cross-set clearance guarantee.",
      "Tighter geometry is not applied to production and does not establish terrain suitability."] };
}

export function writeSpacingReport() {
  const report = spacingReport();
  const out = join(mod, "../../temp/worldgen-spacing");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "audit.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(out, "comparison.html"), spacingHtml(report));
  console.log(JSON.stringify({ village: { radius: report.village.horizontalRadius, paths: report.village.paths, depth: report.village.deepest, hull: report.village.hull }, current: report.currentTreeGrid, options: report.options }, null, 2));
}
function spacingHtml(report) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lothlorien spacing comparison</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef1e8;color:#233629;font:16px/1.5 system-ui,sans-serif}main{max-width:1050px;margin:35px auto;padding:28px;background:#fff;border-radius:16px}h1{font-size:32px;margin:0 0 12px}h2{font-size:21px}p{max-width:850px}.note{padding:14px;background:#fff4d5;border-radius:8px}.controls{display:flex;gap:26px;flex-wrap:wrap;padding:18px 0}label{display:block}select,input{font:inherit}canvas{width:100%;height:auto;background:#f5f7f2;border-radius:8px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{text-align:left;padding:12px 8px;border-bottom:1px solid #dbe2d7}.big{font-size:24px;font-weight:650}.small{font-size:14px;color:#546258}.bar{height:15px;background:#527a45;border-radius:3px;margin:6px 0}a{color:#28613c}
</style><main><h1>Room for villages</h1><p>A shared set can select one village or one landmark at each candidate. To prevent two neighbouring villages overlapping, every candidate must leave room for the largest build.</p>
<p class="note"><b>Offline study, Bedrock 1.26.52.</b> This is footprint and density arithmetic, not an engine test. The 12-block finishing allowance is provisional. Terrain, biome rejection and other worldgen content are not included.</p>
<div class="controls"><label>Village footprint bound<br><select id="radius"><option value="116">Configured limit: 116 blocks</option><option value="${report.village.horizontalRadius}">Enumerated template paths: ${report.village.horizontalRadius} blocks (provisional)</option></select></label><label>Additional clear ground between reservations<br><input id="gap" type="range" min="0" max="64" step="1" value="0"> <output id="gapValue">0</output> blocks</label></div>
<canvas id="diagram" width="1000" height="265"></canvas>
<p id="headline" class="big"></p><table><thead><tr><th>Quantity</th><th>Original tree grid</th><th>Shared individual-build grid</th></tr></thead><tbody id="rows"></tbody></table>
<h2>Candidate density before biome filtering</h2><div>Original tree candidates <span id="originalDensity"></span></div><div class="bar" style="width:100%"></div><div>Shared individual-build candidates <span id="newDensity"></span></div><div class="bar" id="newBar"></div>
<p id="villageRate"></p><p class="small">Desired relative weights: village 2, platform Mallorn 3, plain Great Mallorn 5, smaller places 8. That is one village to 1.5 platforms, 2.5 plain giants and four smaller places over many eligible attempts, not a quota for each biome patch.</p>
<h2>The design choice</h2><p><b>Individual sites:</b> keep each build as its own start and accept lower density. <b>Coordinated layouts:</b> use fewer starts, each containing several complete landmarks with varied offsets and distances. This requires a new layout and terrain prototype; the old repeated cross-shaped group is not an accepted design.</p>
<p class="small">The tighter template-path audit enumerated ${report.village.paths.toLocaleString("en-US")} attachment paths, including terminal fallback pieces. It ignores sibling competition conservatively and was checked against 20 full simulated assemblies. Future template or finisher changes require a new audit.</p></main>
<script>const original=${report.currentTreeGrid.candidatesPerMillionBlocks};
function update(){const r=+document.getElementById('radius').value,g=+document.getElementById('gap').value,m=12,w=2*(r+m)+1,sep=Math.ceil((w+g)/16)-1,spacing=2*sep+1,d=(sep+1)*16,pitch=spacing*16,density=1e6/(pitch*pitch),actual=d-w;
document.getElementById('gapValue').value=g;document.getElementById('headline').textContent=(original/density).toFixed(1)+' times fewer candidate sites than the original tree grid';
const rows=[['Grid cell width','96 blocks',pitch+' blocks'],['Closest neighbouring starts','48 blocks',d+' blocks'],['Spacing / separation','6 / 2 chunks',spacing+' / '+sep+' chunks'],['Free columns between padded reservations','Tree-only grid',actual+' blocks']];
document.getElementById('rows').innerHTML=rows.map(a=>'<tr>'+a.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');document.getElementById('originalDensity').textContent=original.toFixed(1)+' / million square blocks';document.getElementById('newDensity').textContent=density.toFixed(2)+' / million square blocks';document.getElementById('newBar').style.width=(density/original*100)+'%';document.getElementById('villageRate').textContent='At one village per nine candidates: about '+(density/9).toFixed(2)+' village candidates per million square blocks, before biome rejection.';
const ctx=document.getElementById('diagram').getContext('2d');ctx.clearRect(0,0,1000,265);const scale=850/(w*2+actual),left=75,top=48,height=120,bw=w*scale,bgap=actual*scale;ctx.fillStyle='#dce9d5';ctx.fillRect(left,top,bw,height);ctx.fillRect(left+bw+bgap,top,bw,height);ctx.strokeStyle='#527a45';ctx.lineWidth=2;ctx.strokeRect(left,top,bw,height);ctx.strokeRect(left+bw+bgap,top,bw,height);ctx.fillStyle='#233629';ctx.font='18px system-ui';ctx.textAlign='center';ctx.fillText('Village reservation',left+bw/2,top+58);ctx.fillText('Neighbour reservation',left+bw+bgap+bw/2,top+58);ctx.font='15px system-ui';ctx.fillText(w+' blocks including provisional margin',left+bw/2,top+88);ctx.fillText(actual+' clear columns',left+bw+bgap/2,top-15);ctx.strokeStyle='#81917c';ctx.beginPath();ctx.moveTo(left+bw/2,215);ctx.lineTo(left+bw+bgap+bw/2,215);ctx.stroke();ctx.fillText('Minimum start distance: '+d+' blocks',500,245);}
document.getElementById('radius').addEventListener('change',update);document.getElementById('gap').addEventListener('input',update);update();</script></html>`;
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) writeSpacingReport();
