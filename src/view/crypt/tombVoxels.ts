// The crypt's tombs and jars (cryptVoxels.ts: sarcophagus, greatSarcophagus,
// urns), in its palette. A sarcophagus: on a stepped plinth, its sides
// panelled (sunk panels between posts at the corners), a carved roundel on
// each end; its lid pitched to a ridge, or flat with a cross carved on it, or
// broken open; its corners chipped, moss at its foot. The great one: the same,
// grander, on a taller plinth, gold along its lid, a lord carved lying on it
// (his helmed head, his hands clasped on a sword, his shield at his feet).
// The jars: round, turned (a foot, a full belly, a shoulder, a neck, a lipped
// rim), a painted band round them, their mouths dark, a lid on some; now and
// then one lying broken on its side, its shards about.

import { C, type Box } from './cryptVoxels';

// A panelled body from (u0, v0) to (u1, v1), `y0` to `y1`: sunk panels along its long sides between posts,
// a roundel carved on each end.
function panelledBody(box: Box, u0: number, v0: number, u1: number, v1: number, y0: number, y1: number): void {
  box(u0, y0, v0, u1, y1, v1, C.stone);
  const [py0, py1] = [y0 + 2, y1 - 2];
  const long = v1 - v0;
  const panels = Math.max(2, Math.round(long / 14));
  const span = (long - 4) / panels;
  for (let k = 0; k < panels; k++) {
    const [a, b] = [Math.round(v0 + 3 + k * span), Math.round(v0 + 3 + (k + 1) * span) - 2];
    for (const u of [u0, u1]) box(u, py0, a, u, py1, b, 0); // sunk
    for (const u of [u0 + 1, u1 - 1]) box(u, py0, a, u, py1, b, C.stoneDark); // its back, in shade
  }
  for (const u of [u0, u1]) for (const v of [v0, v1]) box(u, y0, v, u, y1, v, C.stoneLight); // the corner posts
  // A roundel on each end.
  const [mu, my] = [(u0 + u1) / 2, (y0 + y1) / 2];
  for (const v of [v0, v1]) {
    for (let u = u0 + 1; u < u1; u++) for (let y = y0 + 1; y < y1; y++) {
      const r = Math.hypot(u - mu, (y - my) * 1.2);
      if (r <= 3.2 && r > 1.8) box(u, y, v, u, y, v, C.stoneLight);
      else if (r <= 1.8) box(u, y, v, u, y, v, C.stoneDark);
    }
  }
}

// A stepped plinth under a body from (u0, v0) to (u1, v1), `high` voxels.
function plinth(box: Box, u0: number, v0: number, u1: number, v1: number, high: number, mossy: boolean): void {
  box(u0 - 1, 0, v0 - 1, u1 + 1, high - 1, v1 + 1, C.stoneDark);
  box(u0, high - 1, v0, u1, high - 1, v1, C.stone);
  if (mossy) for (let v = v0; v <= v1; v += 3) box(u0 - 1, 0, v, u0 - 1, 1, v + 1, C.moss);
}

export function sarcophagus(box: Box, variant: number): void {
  plinth(box, 3, 3, 21, 46, 2, variant === 1);
  panelledBody(box, 4, 4, 20, 45, 2, 9);
  // Chipped corners at the top of the body.
  for (const [u, v] of [[4, 4], [20, 45]]) box(u, 9, v, u, 9, v, 0);
  if (variant === 3) return brokenOpen(box);
  if (variant === 2) {
    // A flat lid, its edge moulded, a cross carved on it.
    box(3, 10, 3, 21, 11, 46, C.lid);
    box(4, 12, 4, 20, 12, 45, C.stoneLight);
    box(11, 13, 9, 13, 13, 39, C.stoneDark); // the cross's upright
    box(6, 13, 15, 18, 13, 17, C.stoneDark); // its arm
    return;
  }
  // A lid pitched to a ridge, overhanging a voxel, a light ridge stone along the top; moss on one (variant 1).
  for (let v = 3; v <= 46; v++) lidSlice(box, v, 10);
  for (const v of [3, 46]) box(3, 10, v, 21, 10, v, C.stoneLight); // its ends' edges, light
  if (variant === 1) for (let v = 6; v < 44; v += 5) box(7 + (v % 3), 12, v, 9 + (v % 3), 12, v + 2, C.moss);
}

// A pitched lid's courses, from its foot up (across u): overhanging the coffin a voxel, up to the ridge stone.
const PITCH: ReadonlyArray<readonly [number, number]> = [[3, 21], [4, 20], [6, 18], [9, 15], [11, 13]];

// One slice of a pitched lid, across, at `v`, its foot at `y0`; shifted `du` across, only what's within `[lo, hi]`;
// `keep(u, k)` whether each voxel of it is still there (broken off: not).
function lidSlice(box: Box, v: number, y0: number, du = 0, [lo, hi] = [-99, 99], keep = (_u: number, _k: number) => true): void {
  PITCH.forEach(([a, b], k) => {
    for (let u = Math.max(lo, a + du); u <= Math.min(hi, b + du); u++) if (keep(u, k)) box(u, y0 + k, v, u, y0 + k, v, k === PITCH.length - 1 ? C.stoneLight : C.lid);
  });
}

// A sarcophagus broken open, its lid the whole ones' (pitched), broken: hollow, the dark inside it showing,
// bones in it; the lid's head end still on, broken off jagged; a piece of the middle fallen in, tilted down
// into the dark; half the foot end, split along the ridge, lying on the floor beside it; shards about.
function brokenOpen(box: Box): void {
  // Hollow: its walls two thick, in shade within, the dark at the bottom, what's left of the dead lying in it.
  box(6, 4, 6, 18, 9, 43, 0);
  box(6, 3, 6, 18, 3, 43, C.socket);
  for (const [u0, v0, u1, v1] of [[6, 6, 6, 43], [18, 6, 18, 43], [6, 6, 18, 6], [6, 43, 18, 43]]) box(u0, 4, v0, u1, 9, v1, C.stoneDark);
  box(4, 9, 4, 20, 9, 5, C.stoneDark); // the rim, along the top of its walls
  box(4, 9, 44, 20, 9, 45, C.stoneDark);
  box(4, 9, 4, 5, 9, 45, C.stoneDark);
  box(19, 9, 4, 20, 9, 45, C.stoneDark);
  box(10, 4, 36, 13, 6, 39, C.bone); // a skull, at the foot end (the head's under the lid still on)
  box(10, 5, 39, 13, 5, 39, C.socket);
  box(9, 4, 26, 10, 4, 34, C.boneShade); // long bones
  box(14, 4, 24, 15, 4, 31, C.boneShade);
  box(11, 4, 21, 13, 4, 23, C.bone); // ribs
  // The head end of the lid, still on: broken off jagged across, the break higher up the ridge.
  const edge = (u: number, k: number) => 15 + ((u * 7 + k * 3) % 4) + (u > 12 ? 2 : 0) - k;
  for (let v = 3; v <= 19; v++) lidSlice(box, v, 10, 0, [-99, 99], (u, k) => v <= edge(u, k));
  box(3, 10, 3, 21, 10, 3, C.stoneLight);
  // A piece of the middle, fallen in: tilted down from the break into the dark, within the hollow, broken at both ends.
  for (let v = 22; v <= 32; v++) {
    const y0 = 5 - Math.floor((v - 22) / 4);
    lidSlice(box, v, y0, 0, [7, 17], (u, k) => v >= 22 + ((u + k) % 3) && v <= 30 + ((u * 3 + k) % 3));
  }
  // Half the foot end, split along its ridge, lying on the floor beside it, ridge up; shards about.
  for (let v = 29; v <= 43; v++) lidSlice(box, v, 0, 19, [22, 33], (u, k) => v <= 41 + ((u + k) % 3));
  box(24, 0, 24, 25, 1, 26, C.lid);
  box(26, 0, 20, 26, 0, 21, C.stoneLight);
  box(-2, 0, 36, -1, 1, 38, C.lid);
  box(23, 0, 45, 24, 0, 46, C.lid);
}

export function greatSarcophagus(box: Box): void {
  plinth(box, 5, 5, 44, 69, 3, true);
  box(5, 3, 5, 44, 3, 69, C.stoneLight); // a light course over the plinth
  panelledBody(box, 6, 6, 43, 68, 4, 12);
  // The lid: overhanging, gold along its edge.
  box(4, 13, 4, 45, 14, 70, C.lid);
  for (const [u0, v0, u1, v1] of [[4, 4, 45, 4], [4, 70, 45, 70], [4, 4, 4, 70], [45, 4, 45, 70]]) box(u0, 14, v0, u1, 14, v1, C.gold);
  // The lord carved lying on it, his head toward -v: a helmed head on a cushion, shoulders, his body under a
  // surcoat, his hands clasped on a sword laid down his length, his feet against his shield.
  box(16, 15, 9, 33, 15, 17, C.stoneDark); // the cushion
  box(20, 16, 10, 29, 20, 17, C.stoneLight); // the helm
  box(21, 21, 11, 28, 21, 16, C.stone);
  box(24, 18, 17, 25, 18, 17, C.socket); // its eye slit (toward his feet: seen from above)
  box(15, 15, 18, 34, 18, 24, C.stoneLight); // the shoulders
  box(17, 15, 25, 32, 17, 54, C.stoneLight); // the body
  box(18, 18, 25, 31, 18, 54, C.stone); // the surcoat's folds
  for (let v = 27; v < 54; v += 4) box(18, 18, v, 31, 18, v, C.stoneLight);
  box(22, 19, 30, 27, 20, 36, C.stoneLight); // the hands, clasped
  box(24, 19, 22, 25, 20, 29, C.gold); // the sword's hilt and pommel
  box(20, 19, 29, 29, 19, 29, C.gold); // its crossguard
  box(24, 19, 37, 25, 19, 56, C.iron); // its blade, down his length
  box(17, 15, 55, 22, 18, 62, C.stoneLight); // his feet
  box(27, 15, 55, 32, 18, 62, C.stoneLight);
  box(18, 15, 63, 31, 21, 66, C.stone); // the shield at his feet, standing
  box(23, 17, 62, 26, 20, 62, C.gold); // its boss
}

// A turned jar `high` voxels at (u, v) (its middle), its belly `belly` across (radius); `lid` on it.
function jar(box: Box, u: number, v: number, high: number, belly: number, lid: boolean, band: number): void {
  const radius = (y: number) => {
    const t = y / high;
    if (t < 0.12) return belly * 0.55; // the foot
    if (t < 0.5) return belly * (0.55 + (t - 0.12) * 1.2); // swelling to the belly
    if (t < 0.78) return belly * (1 - (t - 0.5) * 1.1); // the shoulder
    if (t < 0.92) return belly * 0.45; // the neck
    return belly * 0.6; // the rim
  };
  for (let y = 0; y < high; y++) {
    const r = radius(y);
    for (let du = -Math.ceil(r); du <= Math.ceil(r); du++) for (let dv = -Math.ceil(r); dv <= Math.ceil(r); dv++) {
      if (du * du + dv * dv > r * r + 0.6) continue;
      const mouth = y === high - 1 && du * du + dv * dv <= (r - 1) * (r - 1) && !lid;
      box(u + du, y, v + dv, u + du, y, v + dv, mouth ? C.socket : y === band || y === band + 1 ? C.clayDark : y === high - 1 ? C.clayDark : C.clay);
    }
  }
  if (lid) box(u - 1, high, v - 1, u + 1, high, v + 1, C.clayDark);
}

// A jar lying broken on its side along u, its top half gone, shards about.
function brokenJar(box: Box, u: number, v: number): void {
  for (let k = 0; k <= 8; k++) {
    const r = k < 2 ? 2 : k < 6 ? 3 : 1.5;
    for (let dy = 0; dy <= Math.ceil(r) * 2; dy++) for (let dv = -3; dv <= 3; dv++) {
      const yy = dy - r;
      if (yy * yy + dv * dv > r * r + 0.5 || dy > r + 0.5) continue; // (its upper half broken away)
      box(u + k, dy, v + dv, u + k, dy, v + dv, Math.abs(dv) < r - 0.5 && dy > 0 ? C.socket : C.clay);
    }
  }
  box(u + 10, 0, v - 2, u + 11, 0, v - 1, C.clay);
  box(u + 3, 0, v + 4, u + 4, 0, v + 5, C.clayDark);
  box(u - 2, 0, v + 2, u - 2, 0, v + 2, C.clay);
}

export function urns(box: Box, variant: number): void {
  jar(box, 7, 7, 15, 4.5, variant % 2 === 0, 7);
  jar(box, 16, 11, 11, 3.5, false, 5);
  if (variant > 1) jar(box, 8, 17, 9, 3, true, 4);
  if (variant % 2 === 1) brokenJar(box, 12, 19);
}
