// A ruin's columns (ruinVoxels.ts: column, columnBroken, columnFallen), each
// in the middle of its tile, within what blocks (ruins.ts). Standing: a
// square plinth and a rounded torus over it; the shaft round, in drums (the
// joints between them sunk), fluted (the flutes lit and shaded by turns
// round it), a little narrower near the top; a flared capital under a square
// abacus. Broken: snapped off slantwise, the break light, a broken piece of
// it at its foot. Fallen: its drums lying in a row along the ground, a little
// out of line, their ends showing (a light face, the dowel hole dark), the
// capital lying tipped at one end. Weathered: chips out of the drums, moss at
// the foot and on top, ivy climbing (by variant).

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C, RUIN_GRID } from './ruinVoxels';

const MID = 12;
const DRUM = 7; // a drum's height

type Set = (u: number, y: number, v: number, color: number) => void;

// The plinth and the torus over it, moss round its foot.
function base(set: Set, variant: number): void {
  for (let u = 7; u <= 17; u++) for (let v = 7; v <= 17; v++) {
    const [du, dv] = [u - MID, v - MID];
    set(u, 0, v, hashUnit(u, v, 160 + variant) < 0.2 ? C.moss : C.stoneDark);
    set(u, 1, v, Math.abs(du) === 5 || Math.abs(dv) === 5 ? C.stone : C.stoneDark);
    if (du * du + dv * dv <= 20) set(u, 2, v, C.stoneLight); // the torus, rounded
    if (du * du + dv * dv <= 13) set(u, 3, v, C.stone);
  }
}

// The shaft from `from` to `to` (its top at `topAt(u, v)` if broken): drums, fluted, narrowing, chipped, ivy.
function shaft(set: Set, from: number, to: number, variant: number, topAt?: (u: number, v: number) => number): void {
  for (let u = MID - 3; u <= MID + 3; u++) for (let v = MID - 3; v <= MID + 3; v++) {
    const [du, dv] = [u - MID, v - MID];
    const r2 = du * du + dv * dv;
    const top = topAt ? topAt(u, v) : to;
    const a = Math.atan2(dv, du);
    const flute = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 2 === 0;
    for (let y = from; y <= top; y++) {
      const narrow = y > from + (to - from) * 0.66;
      if (r2 > (narrow ? 8 : 10)) continue;
      const outer = r2 > (narrow ? 4 : 5);
      const drum = Math.floor((y - from) / DRUM);
      if (outer && (y - from) % DRUM === DRUM - 1) continue; // (a joint between drums, sunk)
      if (outer && hashUnit(Math.floor(a * 2), drum, 161 + variant) < 0.12 && (y - from) % DRUM < 3) continue; // a chip out of it
      const ivy = outer && variant >= 2 && Math.abs(Math.sin(a + y * 0.25)) > 0.85 && y < from + 18;
      const broken = topAt && y === top;
      set(u, y, v, broken ? (outer ? C.stoneLight : C.stone) : ivy ? (hashUnit(u, y, 162) < 0.5 ? C.ivy : C.ivyLight) : outer ? (flute ? C.stoneLight : C.stone) : C.stoneDark);
    }
  }
}

export function columnStanding(variant: number): VoxelGrid {
  const grid = createGrid(RUIN_GRID);
  const set: Set = (u, y, v, c) => fillBox(grid, u, y, v, u, y, v, c);
  base(set, variant);
  const top = 28 + variant;
  shaft(set, 4, top, variant);
  // The capital: an echinus flaring out, the abacus square over it, moss on top.
  for (let u = 7; u <= 17; u++) for (let v = 7; v <= 17; v++) {
    const [du, dv] = [u - MID, v - MID];
    const r2 = du * du + dv * dv;
    if (r2 <= 10) set(u, top + 1, v, C.stone);
    if (r2 <= 16) set(u, top + 2, v, C.stoneLight);
    if (Math.abs(du) <= 4 && Math.abs(dv) <= 4) {
      set(u, top + 3, v, C.stone);
      set(u, top + 4, v, hashUnit(u, v, 163 + variant) < 0.25 + variant * 0.1 ? C.moss : C.stoneLight);
    }
  }
  return grid;
}

export function columnBroken(variant: number): VoxelGrid {
  const grid = createGrid(RUIN_GRID);
  const set: Set = (u, y, v, c) => fillBox(grid, u, y, v, u, y, v, c);
  base(set, variant);
  const high = 11 + variant * 3;
  shaft(set, 4, 28, variant, (u, v) => high - Math.round((u - MID) * 0.8 + (v - MID) * 0.5) - Math.floor(hashUnit(u, v, 164 + variant) * 2));
  // A piece of it broken off, lying at its foot.
  for (let u = 14; u <= 17; u++) for (let v = 4; v <= 6; v++) for (let y = 0; y <= 2; y++) {
    if (y === 2 && (u === 14 || v === 6)) continue;
    set(u, y, v, y === 2 || u === 17 ? C.stoneLight : C.stone);
  }
  set(8, 0, 16, C.stone);
  set(18, 0, 13, C.stoneLight);
  return grid;
}

export function columnFallen(variant: number): VoxelGrid {
  const grid = createGrid(RUIN_GRID);
  const set: Set = (u, y, v, c) => fillBox(grid, u, y, v, u, y, v, c);
  // Three drums along X, a voxel apart, each a little out of line.
  for (const [u0, u1] of [[1, 6], [8, 13], [15, 20]]) {
    const lean = Math.floor(hashUnit(u0, variant, 165) * 3) - 1;
    for (let u = u0; u <= u1; u++) for (let y = 0; y <= 6; y++) for (let v = 9; v <= 15; v++) {
      const [dy, dv] = [y - 3, v - MID - lean];
      const r2 = dy * dy + dv * dv;
      if (r2 > 10) continue;
      const end = u === u0 || u === u1;
      const outer = r2 > 5;
      const flute = Math.floor(((Math.atan2(dv, dy) + Math.PI) / (2 * Math.PI)) * 12) % 2 === 0;
      const moss = y >= 5 && hashUnit(u, v, 166 + variant) < 0.35;
      set(u, y, v, end ? (r2 <= 1 ? C.slit : outer ? C.stone : C.stoneLight) : moss ? C.moss : outer ? (flute ? C.stoneLight : C.stone) : C.stoneDark);
    }
  }
  // The capital, tipped on its side at the end: the abacus a square slab standing up, the flare toward the drums.
  for (let y = 0; y <= 8; y++) for (let v = 8; v <= 16; v++) {
    set(23, y, v, y === 8 || v === 8 || v === 16 ? C.stoneLight : C.stone);
    if (y <= 6 && v >= 9 && v <= 15) set(22, y, v, (y - 3) ** 2 + (v - MID) ** 2 <= 12 ? C.stone : 0);
  }
  return grid;
}
