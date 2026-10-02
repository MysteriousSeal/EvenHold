// The webs walling a cave's nest off (model/caves/caveProps.ts: nestSeal), in
// voxels, `span` voxels across the burrow. Silhouette first: what makes a web
// read is the orb (spokes out from a hub, a spiral wound round them) and the
// dark between its threads; no straight frame (that reads as a fence), no
// layers stacked (they read as bars). So: an orb web or two (one to every few
// tiles across), each in an uneven frame of threads between its anchors,
// moored by a few long lines to the rock either side, the floor and above; a
// small dense hub; a true spiral, out from it; where it meets the rock, a dim
// tangle of cobweb (the mass it's anchored in), and behind it all a dim sheet
// of tangled cobweb right across (no gap reads as a way through); a wrapped bundle of prey caught
// in it; a few dewdrops on the spiral catching the glowcaps' light (drawn
// glowing). Torn: its spokes snapped (the outer halves left hanging from their
// anchors, drooping), a fragment of frame and spiral here and there, the
// tangles at the rock left, clumps fallen on the floor. One voxel thin, every
// thread; built across local x, the orbs in the plane of its middle (z 1 of 3), the sheet behind them (z 0).

import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { mulberry32 } from '../../util/random';
import { C, TALL } from './cavePalette';

export const WEB_HIGH = TALL;
export const WEB_DEEP = 3;
const PLANE = 1;
const ORB_EVERY = 36; // voxels across to an orb, about (as wide as it can be tall: side by side, filling the burrow)

type P = [number, number];

export function webCurtain(span: number, variant: number, torn: boolean): VoxelGrid {
  const g = createGrid([span, WEB_HIGH, WEB_DEEP]);
  const rng = mulberry32(9400 + variant * 131 + span);
  const top = WEB_HIGH - 1;
  const put = (u: number, y: number, c: number, v = PLANE) => {
    const [x, h] = [Math.round(u), Math.round(y)];
    if (x >= 0 && h >= 0 && x < span && h <= top) setColor(g, x, h, v, c);
  };
  // A thread from a to b (its share from..to of the way): one voxel thin.
  const thread = (a: P, b: P, c: number, from = 0, to = 1, v = PLANE) => {
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))) || 1;
    for (let s = Math.round(from * steps); s <= to * steps; s++) put(a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps, c, v);
  };
  const clampIn = (p: P): P => [Math.max(0, Math.min(span - 1, p[0])), Math.max(0, Math.min(top, p[1]))];
  // The nearest of the rock either side, the floor, or above, from p: where a mooring line runs to.
  const moor = (p: P): P => {
    const options: P[] = [[0, p[1] + (rng() - 0.5) * 6], [span - 1, p[1] + (rng() - 0.5) * 6], [p[0] + (rng() - 0.5) * 8, 0], [p[0] + (rng() - 0.5) * 8, top]];
    return clampIn(options.sort((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1]))[0]);
  };

  const orbs = Math.max(1, Math.round(span / ORB_EVERY));
  for (let o = 0; o < orbs; o++) {
    const hub: P = [(span * (o + 0.5)) / orbs + (rng() - 0.5) * 8, top * (0.48 + rng() * 0.12)];
    const radius = Math.min(span / orbs / 2 - 1, top * 0.52);
    const spokes = 9 + Math.floor(rng() * 4);
    // Its frame: anchors round the hub at uneven reaches, each spoke out to one.
    const frame: P[] = [];
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2 + (rng() - 0.5) * 0.35;
      const r = radius * (0.8 + rng() * 0.45);
      frame.push(clampIn([hub[0] + Math.cos(a) * r * 1.15, hub[1] + Math.sin(a) * r]));
    }
    const lead = (k: number) => frame[k % spokes];
    if (torn) {
      // Snapped: each spoke's outer part left hanging from its anchor, drooping; frame and spiral in fragments.
      for (let k = 0; k < spokes; k++) {
        if (rng() < 0.35) continue;
        const end = frame[k];
        const keep = 0.3 + rng() * 0.3;
        const tip: P = [end[0] + (hub[0] - end[0]) * keep, end[1] + (hub[1] - end[1]) * keep];
        thread(end, [tip[0], Math.max(0, tip[1] - 3 - rng() * 5)], C.silkShade); // (drooping)
        if (rng() < 0.4) thread(end, lead(k + 1), C.silkShade, 0, 0.3 + rng() * 0.4);
      }
    } else {
      for (let k = 0; k < spokes; k++) {
        thread(hub, frame[k], C.silk);
        thread(frame[k], lead(k + 1), C.silk);
      }
      // The spiral: out from near the hub, round and round, crossing each spoke a little further out each time.
      const turns = Math.max(3, Math.floor(radius / 2.6));
      let last: P | null = null;
      for (let step = 0; step <= turns * spokes; step++) {
        const k = step % spokes;
        const share = 0.12 + (0.84 * step) / (turns * spokes);
        const p: P = [hub[0] + (frame[k][0] - hub[0]) * share, hub[1] + (frame[k][1] - hub[1]) * share];
        if (last) thread(last, p, C.silkShade);
        if (rng() < 0.05) put(p[0], p[1], C.dew); // (a dewdrop, where it crosses a spoke)
        last = p;
      }
      // The hub: a small dense knot.
      for (let du = -1; du <= 1; du++) for (let dy = -1; dy <= 1; dy++) put(hub[0] + du, hub[1] + dy, C.silk);
      // Prey, wrapped up and caught in it (one web in two).
      if (rng() < 0.5 || o === 0) {
        const [cu, cy] = [hub[0] + (rng() - 0.5) * radius, hub[1] + (rng() - 0.5) * radius * 0.6];
        for (let du = -1; du <= 1; du++) for (let dy = -2; dy <= 2; dy++) for (let dv = 0; dv < WEB_DEEP; dv++) {
          if (Math.abs(du) + Math.abs(dy) * 0.6 + Math.abs(dv - PLANE) <= 1.8) put(cu + du, cy + dy, (dy + du) % 3 === 0 ? C.eggVein : C.egg, dv);
        }
      }
    }
    // Moored by a few long lines (kept, torn or not: tied to the rock).
    for (const k of [0, Math.floor(spokes / 3), Math.floor((2 * spokes) / 3)]) thread(frame[k], moor(frame[k]), torn ? C.silkDeep : C.silkShade, 0, torn ? 0.5 : 1);
  }
  // Where it meets the rock either side: a dim tangle of cobweb.
  for (const side of [0, span - 1]) {
    const inward = side === 0 ? 1 : -1;
    for (let k = 0; k < 9; k++) {
      const a: P = [side, rng() * top];
      const b: P = [side + inward * (2 + rng() * 9), rng() * top];
      thread(a, b, C.silkDeep, 0, torn ? 0.6 : 1);
    }
  }
  // Behind the orbs, a sheet of tangled cobweb right across (dim, at random: no gap reads as a way through).
  for (let k = 0; k < span * (torn ? 0.2 : 0.7); k++) {
    const a: P = [rng() * (span - 1), rng() * top];
    const turn = rng() * Math.PI;
    const long = (torn ? 3 : 5) + rng() * 10;
    thread(a, clampIn([a[0] + Math.cos(turn) * long, a[1] + Math.sin(turn) * long * (rng() < 0.5 ? 1 : -1)]), C.silkDeep, 0, 1, 0); // (behind the orbs)
  }
  if (torn) {
    // What fell: clumps on the floor along its foot.
    for (let k = 0; k < Math.ceil(span / 10); k++) {
      const u = 2 + rng() * (span - 5);
      for (let du = -2; du <= 2; du++) put(u + du, 0, du % 2 ? C.silkShade : C.silk);
      put(u, 1, C.silkShade);
    }
  }
  return g;
}
