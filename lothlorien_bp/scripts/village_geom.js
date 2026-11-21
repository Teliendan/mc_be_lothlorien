// Dependency-free helpers shared by the village planner modules. No imports here: this file breaks the village_planner <-> village_repair cycle.
// A rectangle is { x0, x1, z0, z1 } in blocks (inclusive). Areas load whole chunks, so boxes are chunk aligned.
export const hullOf = (cells) => ({ x0: Math.min(...cells.map((c) => c[0])), x1: Math.max(...cells.map((c) => c[0])), z0: Math.min(...cells.map((c) => c[2])), z1: Math.max(...cells.map((c) => c[2])) });
export const chunkAlign = (r) => ({ x0: (r.x0 >> 4) << 4, x1: ((r.x1 >> 4) << 4) + 15, z0: (r.z0 >> 4) << 4, z1: ((r.z1 >> 4) << 4) + 15 });
export const growRect = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
export const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
export const chunksIn = (r) => ((r.x1 - r.x0 + 1) >> 4) * ((r.z1 - r.z0 + 1) >> 4);
// Generators (`function*`) yield now and then so the runtime can run a planner inside system.runJob without one long tick; `drive` runs one to the end.
export function drive(gen) { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; }
// Pacing for generators that read through `at` (job step budget: at most ~128 native reads and 3 ms per step): `const due = pace(at); ... if (due()) yield "label";`
// is true once `limit` fresh native reads happened (a boundedReader / overlay counts them in .size()) or after `every` calls, whichever comes first. One loop body
// must stay under 128 - limit reads, so limit 48 leaves room for a body of up to 80.
export function pace(at, limit = 48, every = 32) {
  const counted = typeof at?.size === "function";
  let last = counted ? at.size() : 0, n = 0;
  return () => {
    if (++n >= every) { n = 0; if (counted) last = at.size(); return true; }
    if (!counted) return false;
    const s = at.size();
    if (s - last >= limit) { last = s; n = 0; return true; }
    return false;
  };
}
// Reads every cell of a box through `at` in steps of ~`limit` fresh reads, so that the pure code after it runs on memoised cells only (a boundedReader remembers them).
export function* prefetchBox(at, b, label = "prefetch") {
  const due = pace(at);
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) {
    for (let y = b.y0; y <= b.y1; y++) at(x, y, z);
    if (due()) yield label;
  }
}
// The [x, z] cells of `rect` whose block at height y is one of `ids`, ordered x then z (the order of a plain loop over the rect). Uses at.layer when the
// reader has one (native filtered query in game); otherwise loops, so a plain function reader gives the same cells.
export function* layerCells(at, y, ids, rect) {
  if (at.layer) return yield* at.layer(y, ids, rect);
  const want = new Set(ids), out = [];
  let n = 0;
  for (let x = rect.x0; x <= rect.x1; x++) for (let z = rect.z0; z <= rect.z1; z++) {
    if (want.has(at(x, y, z))) out.push([x, z]);
    if (++n % 512 === 0) yield "layerScan";
  }
  return out;
}
// [[x, z]] sorted by x then z through a native numeric sort of packed keys (a comparator sort of thousands of pairs took 3-5 ms in QuickJS).
export function sortXZ(list) {
  const n = list.length, keys = new Float64Array(n), out = new Array(n);
  for (let i = 0; i < n; i++) keys[i] = (list[i][0] + 32768) * 65536 + (list[i][1] + 32768);
  keys.sort();
  for (let i = 0; i < n; i++) { const q = keys[i], x = Math.floor(q / 65536); out[i] = [x - 32768, q - x * 65536 - 32768]; }
  return out;
}
