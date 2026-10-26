// Village soundtrack state machine (scripts/village_music_rules.js). Actual playback, queue clearing and biome-music return need the game.
import assert from "node:assert/strict";
import { CHECK_TICKS, LEAVE_TICKS, REST_TICKS, PIECES, pick, step } from "../lothlorien_bp/scripts/village_music_rules.js";

const pieces = [{ id: "a", ticks: 2000 }, { id: "b", ticks: 3000 }, { id: "c", ticks: 2500 }];
const ok = (name) => console.log(`ok   village music: ${name}`);
const fixed = (v) => () => v;

{ // entering starts a piece at once; staying inside does nothing until the piece and its rest are over
  let r = step(undefined, true, 100, fixed(0), pieces);
  assert.deepEqual(r.actions, [{ type: "play", id: "a" }]);
  assert.equal(r.state.last, "a");
  const first = r.state;
  assert.equal(first.nextAt, 100 + pieces.find((p) => p.id === first.last).ticks + REST_TICKS[0]);
  r = step(first, true, first.nextAt - 1, fixed(0), pieces);
  assert.deepEqual(r.actions, []);
  r = step(first, true, first.nextAt, fixed(0), pieces);
  assert.equal(r.actions.length, 1);
  assert.notEqual(r.actions[0].id, first.last, "the next piece is a different one");
  ok("enter plays, then piece + rest, then a different piece");
}

{ // the rest stays within REST_TICKS
  const lo = step(undefined, true, 0, fixed(0), pieces).state, hi = step(undefined, true, 0, fixed(0.999999), pieces).state;
  const len = (s) => s.nextAt - pieces.find((p) => p.id === s.last).ticks;
  assert.equal(len(lo), REST_TICKS[0]);
  assert.equal(len(hi), REST_TICKS[1]);
  ok("rest within REST_TICKS");
}

{ // brief exits keep the piece; a long one fades it out once
  let s = step(undefined, true, 0, fixed(0), pieces).state;
  let r = step(s, false, CHECK_TICKS, fixed(0), pieces);
  assert.deepEqual(r.actions, []);
  r = step(r.state, true, 2 * CHECK_TICKS, fixed(0), pieces);
  assert.deepEqual(r.actions, [], "back inside: no restart");
  assert.equal(r.state.outsideSince, undefined);
  s = r.state;
  r = step(s, false, 1000, fixed(0), pieces);
  r = step(r.state, false, 1000 + LEAVE_TICKS - 1, fixed(0), pieces);
  assert.deepEqual(r.actions, []);
  r = step(r.state, false, 1000 + LEAVE_TICKS, fixed(0), pieces);
  assert.deepEqual(r.actions, [{ type: "stop" }]);
  r = step(r.state, false, 5000, fixed(0), pieces);
  assert.deepEqual(r.actions, [], "outside and stopped: silent");
  r = step(r.state, true, 5040, fixed(0), pieces);
  assert.equal(r.actions[0].type, "play", "re-entering starts again");
  ok("hysteresis on leaving, one stop, restart on return");
}

{
  assert.deepEqual(step(undefined, true, 0, fixed(0), []).actions, [], "no pool: nothing");
  assert.equal(pick([{ id: "a", ticks: 1 }], "a").id, "a", "a single piece may repeat");
  for (const p of PIECES) assert.ok(p.id.startsWith("music.lothlorien.village.") && p.ticks > 0, p.id);
  ok("edge cases and the shipped pool");
}
