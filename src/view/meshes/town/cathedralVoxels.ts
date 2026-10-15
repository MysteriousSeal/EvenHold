// The cathedral, the tallest thing in the game: nine tiles across and ten deep (town/townPlan.ts), twelve voxels a tile
// (townPalette.ts), its great door in its front (local -Z, the square's side). Silhouette first: a long nave under a
// steep slate roof, lower aisles either side under lean-tos, a rounded apse at its far end, and over the crossing a
// square tower with a tall slate spire and a gold cross, seen over everything; buttresses down its flanks, each flying
// an arch to the nave's wall, pinnacles on them all. Its front: twin turrets, a pointed portal with oak doors under
// rings of carved stone, a gallery of saints in niches, and a rose window in the gable. Its windows stained glass
// (GLASS: drawn unlit). Built from the ground up, the nave's walls and the apse's one curve (`spanAt`: how far from the
// nave's line a point is, the apse squeezed into its last tiles), the roofs laid over them by the same measure.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor, voxelLine } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { T } from './townPalette';

export const CATHEDRAL_GRID: [number, number, number] = [108, 212, 120];
const [W, H, D] = CATHEDRAL_GRID;
const MID = W / 2; // the nave's line
const APSE = 96; // where the apse begins (the nave's four bays before it)
const APSE_SQUEEZE = 30 / 23; // its curve squeezed into the last two tiles
const NAVE = 30; // the nave's walls' outer face, out from its line
const AISLE = 52; // the aisles' outer walls'
const AISLE_TOP = 36;
const CLERE_TOP = 66; // the nave's walls' top
const RIDGE = 100;
const BAYS = [24, 48, 72]; // the bays' lines (a buttress each side)
const TOWER = { u: 18, z0: 60, z1: 95, top: 150 }; // over the crossing: half its width, its ends, its walls' top
const SPIRE_TOP = 202;

const put = (grid: VoxelGrid, x: number, y: number, z: number, color: number) => {
  if (x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D) setColor(grid, x, y, z, color);
};
const across = (x: number) => x + 0.5 - MID; // a voxel's middle, from the nave's line
// How far from the nave's line a point is: across it, but round the apse's curve past APSE.
const spanAt = (x: number, z: number) => Math.hypot(across(x), Math.max(0, z + 0.5 - APSE) * APSE_SQUEEZE);
// The nave's roof's top over a point that far out (its eaves at CLERE_TOP, two voxels past the walls).
const naveRoofAt = (span: number) => CLERE_TOP + Math.round(((NAVE + 2 - span) * (RIDGE - CLERE_TOP)) / (NAVE + 2));
const aisleRoofAt = (u: number) => AISLE_TOP + 1 + Math.round(((AISLE + 1 - u) * 13) / (AISLE + 1 - NAVE));

// Dressed limestone: blocks six long, courses three high (every other offset), mostly mid tone; the bottom course
// darker, moss in its joints.
function stone(x: number, y: number, z: number): number {
  const course = Math.floor(y / 3);
  const h = hashUnit(Math.floor((x + z + (course % 2) * 3) / 6), course, 3);
  if (y <= 2) return h < 0.3 ? T.moss : T.limeDark;
  return h < 0.62 ? T.lime : h < 0.82 ? T.limeDark : T.limeLight;
}

// Slate, in courses two high along the eaves, each slate three long with a tone of its own; the eaves' course dark,
// the ridge capped with lead.
function slate(x: number, y: number, z: number, eave: boolean, ridge: boolean): number {
  if (ridge) return T.lead;
  if (eave) return T.slateDark;
  const h = hashUnit(Math.floor((x + z + (Math.floor(y / 2) % 2)) / 3), Math.floor(y / 2), 11);
  return h < 0.18 ? T.slateDark : h < 0.4 ? T.slateLight : T.slate;
}

// A pointed (lancet) opening's shape: within `half` of its middle up to `spring`, then narrowing to its point at `apex`.
const lancet = (u: number, y: number, half: number, spring: number, apex: number) => y <= spring || Math.abs(u) <= half * Math.sqrt(Math.max(0, 1 - ((y - spring) / (apex - spring)) ** 2)) * 1.05;

export function buildCathedralVoxels(): VoxelGrid {
  const grid = createGrid(CATHEDRAL_GRID);
  fillBox(grid, 0, 0, 0, W - 1, 0, APSE - 1, T.limeDark); // (its floor, under all)
  solid(grid);
  naveAndApse(grid);
  aisles(grid);
  buttresses(grid);
  front(grid);
  tower(grid);
  return grid;
}

// Its body filled in under its roofs (never seen within: no faces inside its walls and roofs to mesh and draw), what's
// laid on it after cutting its windows and doors into its skin.
function solid(grid: VoxelGrid): void {
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const span = spanAt(x, z);
      const u = Math.abs(across(x));
      const top = span <= NAVE ? naveRoofAt(span) - 2 : z < APSE - 2 && u > NAVE && u < AISLE - 2 ? aisleRoofAt(u) - 2 : 0;
      if (top > 0) fillBox(grid, x, 1, z, x, top, z, T.mortar);
    }
  }
}

// The nave's walls and the apse's, one curve, and the roof over both; the clerestory's lancets in each bay, the
// apse's tall ones round its end.
function naveAndApse(grid: VoxelGrid): void {
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const span = spanAt(x, z);
      if (span > NAVE + 2) continue;
      if (span >= NAVE - 2 && span <= NAVE) for (let y = 1; y <= CLERE_TOP; y++) put(grid, x, y, z, stone(x, y, z));
      const top = naveRoofAt(span);
      for (let y = top - 1; y <= top; y++) put(grid, x, y, z, slate(x, y, z, span > NAVE + 1, span < 1.5));
    }
  }
  // The clerestory's lancets, two to a bay, on both walls; the apse's, round its curve.
  for (const z0 of [0, ...BAYS]) {
    for (const z of [z0 + 7, z0 + 17]) {
      for (const x of [MID - NAVE, MID + NAVE - 1]) {
        for (let y = 50; y <= 63; y++) for (let dz = -2; dz <= 2; dz++) if (lancet(dz, y, 2, 58, 63)) for (const t of [0, 1]) put(grid, x + (x < MID ? t : -t), y, z + dz, z0 === BAYS[2] && z > TOWER.z0 - 2 ? stone(x, y, z) : (z + y) % 9 < 5 ? T.glassBlue : T.glassRed);
      }
    }
  }
  for (let x = 0; x < W; x++) {
    for (let z = APSE; z < D; z++) {
      const span = spanAt(x, z);
      if (span < NAVE - 2 || span > NAVE) continue;
      const angle = Math.atan2(Math.max(0, z + 0.5 - APSE) * APSE_SQUEEZE, across(x)); // (0 to pi round the end)
      const off = ((angle / (Math.PI / 6) + 0.5) % 1) - 0.5; // (a lancet every thirty degrees round)
      const k = Math.round(angle / (Math.PI / 6));
      if (k < 1 || k > 5) continue;
      const u = off * 7; // (voxels across the lancet, near enough)
      for (let y = 14; y <= 54; y++) if (lancet(u, y, 1.8, 46, 54)) put(grid, x, y, z, Math.abs(u) > 1.4 ? T.limeLight : y > 44 ? T.glassGold : k % 2 ? T.glassRed : T.glassBlue);
    }
  }
}

// The aisles either side, lower, under lean-to roofs against the nave's walls; a lancet in each bay.
function aisles(grid: VoxelGrid): void {
  for (let x = 0; x < W; x++) {
    const u = Math.abs(across(x));
    if (u < NAVE - 1 || u > AISLE + 1.5) continue;
    for (let z = 0; z < APSE; z++) {
      if (u >= AISLE - 2 && u <= AISLE) for (let y = 1; y <= AISLE_TOP; y++) put(grid, x, y, z, stone(x, y, z));
      if (u > NAVE) {
        const top = aisleRoofAt(u);
        if (z >= APSE - 2) for (let y = 1; y < top - 1; y++) put(grid, x, y, z, stone(x, y, z)); // (its end wall)
        for (let y = top - 1; y <= top; y++) put(grid, x, y, z, slate(x, y, z, u > AISLE, false));
      }
    }
  }
  for (const z0 of [0, ...BAYS]) {
    const z = z0 + 12;
    for (const x of [MID - AISLE, MID + AISLE - 1]) {
      for (let y = 10; y <= 30; y++) {
        for (let dz = -3; dz <= 3; dz++) {
          if (!lancet(dz, y, 3, 24, 30)) continue;
          const frame = Math.abs(dz) === 3 || !lancet(dz, y, 2, 24, 29);
          for (const t of [0, 1]) put(grid, x + (x < MID ? t : -t), y, z + dz, frame ? T.limeLight : dz === 0 ? T.limeLight : y > 24 ? T.glassGold : (y >> 2) % 2 ? T.glassBlue : T.glassGreen);
        }
      }
    }
  }
}

// A buttress at each bay's line, both sides: stepped, a pinnacle on it, and an arch flying from it to the nave's wall.
function buttresses(grid: VoxelGrid): void {
  for (const line of BAYS) {
    for (const side of [-1, 1]) {
      const outer = side < 0 ? 0 : W - 1;
      for (let i = 0; i < 4; i++) {
        const x = outer - side * i;
        const top = i === 0 ? 30 : 44;
        for (let z = line - 2; z <= line + 1; z++) for (let y = 1; y <= top; y++) put(grid, x, y, z, stone(x, y, z));
        if (i === 0) for (let z = line - 2; z <= line + 1; z++) put(grid, x, 31, z, T.limeLight); // (its step's weathering)
      }
      const px = outer - side * 2;
      for (let y = 45; y <= 56; y++) {
        const r = y < 52 ? 1 : 0;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r - 1; dz <= r; dz++) put(grid, px + dx, y, line + dz, y < 52 ? T.limeLight : T.lime);
      }
      put(grid, px, 57, line - 1, T.gold);
      // The flying arch: from the buttress's top to the nave's wall, high under its eaves.
      const wall = side < 0 ? MID - NAVE - 1 : MID + NAVE;
      for (const z of [line - 1, line]) {
        voxelLine(grid, [outer - side * 3, 44, z], [wall, 60, z], T.lime);
        voxelLine(grid, [outer - side * 3, 43, z], [wall, 59, z], T.limeDark);
      }
    }
  }
}

// Its front: the nave's gable over the great portal and the gallery of saints, the rose window high in it; the aisles'
// fronts with a lancet each; a turret at each corner of the nave, a pinnacle on it.
function front(grid: VoxelGrid): void {
  for (let x = 0; x < W; x++) {
    const u = Math.abs(across(x));
    const top = u <= NAVE ? naveRoofAt(u) + 1 : u <= AISLE + 1 ? aisleRoofAt(u) + 1 : 0;
    for (let z = 0; z <= 2; z++) for (let y = 1; y <= top; y++) put(grid, x, y, z, y === top ? T.limeLight : stone(x, y, z));
  }
  // The portal: a deep pointed arch, rings of carved stone round it, the oak doors back in it, a gold cross over them.
  for (let x = 0; x < W; x++) {
    const u = across(x);
    for (let y = 1; y <= 38; y++) {
      if (lancet(u, y, 10, 22, 38) && !lancet(u, y, 8, 22, 34)) put(grid, x, y, 0, (y + Math.round(u)) % 4 === 0 ? T.limeDark : T.limeLight); // (its rings)
      if (lancet(u, y, 8, 22, 34)) {
        put(grid, x, y, 0, 0);
        put(grid, x, y, 1, lancet(u, y, 6, 22, 31) ? 0 : T.limeLight);
        const door = y <= 24 && Math.abs(u) <= 6;
        put(grid, x, y, 2, door ? (Math.abs(u) < 0.6 ? T.iron : y === 8 || y === 18 ? T.iron : Math.round(u) % 2 ? T.oak : T.oakDark) : T.lime);
      }
    }
  }
  fillBox(grid, MID - 1, 26, 2, MID, 32, 2, T.gold);
  fillBox(grid, MID - 3, 29, 2, MID + 2, 30, 2, T.gold);
  // The gallery of saints: niches across the nave's front, a figure in each.
  for (let x = MID - NAVE + 4; x <= MID + NAVE - 5; x++) {
    const i = x - (MID - NAVE + 4);
    put(grid, x, 41, 0, T.limeLight);
    put(grid, x, 50, 0, T.limeLight);
    if (i % 6 === 0 || i % 6 === 5) continue;
    for (let y = 42; y <= 49; y++) put(grid, x, y, 0, 0);
    for (let y = 42; y <= 49; y++) put(grid, x, y, 1, i % 6 === 2 || i % 6 === 3 ? (y >= 48 ? T.limeLight : T.lime) : T.limeDark);
  }
  // The rose: petals of red and blue round a gold heart, tracery between, a carved ring round it.
  const [ry, rr] = [76, 11];
  for (let x = 0; x < W; x++) {
    for (let y = ry - rr - 1; y <= ry + rr + 1; y++) {
      const [u, v] = [across(x), y - ry];
      const r = Math.hypot(u, v);
      if (r > rr + 1) continue;
      const petal = Math.atan2(v, u) / (Math.PI / 6);
      const spoke = Math.abs(petal - Math.round(petal)) < 0.12 && r > 3;
      const color = r > rr - 0.5 ? T.limeLight : r < 2.5 ? T.glassGold : spoke || Math.abs(r - 7) < 0.5 ? T.limeLight : (Math.floor(petal + 12) % 2 ? T.glassRed : T.glassBlue);
      put(grid, x, y, 0, color);
      put(grid, x, y, 1, color);
    }
  }
  // The aisles' lancets.
  for (const sx of [-41, 41]) {
    for (let y = 8; y <= 28; y++) for (let du = -3; du <= 3; du++) if (lancet(du, y, 3, 22, 28)) put(grid, Math.floor(MID + sx + du), y, 0, Math.abs(du) === 3 || !lancet(du, y, 2, 22, 27) ? T.limeLight : y > 22 ? T.glassGold : T.glassBlue);
  }
  // The turrets at the nave's corners, square, a string course every so often, a pinnacle each with a gold finial.
  for (const x0 of [MID - NAVE - 4, MID + NAVE - 2]) {
    for (let y = 1; y <= 112; y++) {
      for (let x = x0; x < x0 + 6; x++) for (let z = 0; z < 6; z++) put(grid, x, y, z, y % 24 === 0 ? T.limeLight : stone(x, y, z));
      if (y > 80 && y < 106 && y % 8 < 5) for (const [x, z] of [[x0 + 2, 0], [x0 + 3, 0]]) put(grid, x, y, z, T.dark); // (its slits)
    }
    for (let y = 113; y <= 128; y++) {
      const r = Math.max(0, Math.round(((128 - y) / 15) * 3));
      for (let x = x0 + 3 - r - (r > 0 ? 0 : 1); x <= x0 + 2 + r; x++) for (let z = 3 - r - (r > 0 ? 0 : 1); z <= 2 + r; z++) put(grid, x, y, z, y === 113 ? T.limeLight : T.slate);
    }
    put(grid, x0 + 2, 129, 2, T.gold);
    put(grid, x0 + 2, 130, 2, T.gold);
  }
}

// The crossing's tower: up from the roofs, lancets, then its belfry (open, a bronze bell in each face), a parapet with
// pinnacles at its corners; and its spire of slate, lead down its edges, small dormers on its faces, the gold cross.
function tower(grid: VoxelGrid): void {
  const { u: half, z0, z1, top } = TOWER;
  const zMid = (z0 + z1 + 1) / 2;
  for (let x = Math.floor(MID - half); x < MID + half; x++) {
    for (let z = z0; z <= z1; z++) {
      const [u, v] = [across(x), z + 0.5 - zMid];
      const edge = Math.max(Math.abs(u), Math.abs(v));
      if (edge < half - 3) continue;
      const corner = Math.abs(u) > half - 3 && Math.abs(v) > half - 3; // (its corners, buttressed)
      for (let y = 60; y <= top; y++) {
        const face = Math.abs(u) > Math.abs(v) ? v : u; // (across the face it's on)
        const along = Math.abs(face);
        const belfry = !corner && y >= 122 && y <= 142 && along >= 3 && along <= 8 && (y < 138 || along <= 8 - (y - 138));
        const window = !corner && y >= 100 && y <= 114 && along <= 3 && lancet(face, y, 3, 109, 114);
        const course = y === 96 || y === 118 || y === 146;
        let color = course ? T.limeLight : stone(x, y, z);
        if (belfry) color = edge > half - 1 ? 0 : T.dark;
        else if (window) color = edge > half - 2 ? (Math.abs(face) > 2 ? T.limeLight : y > 109 ? T.glassGold : T.glassBlue) : T.dark;
        put(grid, x, y, z, color);
      }
    }
  }
  // A bell in each of its belfry's openings, hung back in the dark.
  for (const [bx, bz] of [[MID, z0 + 3], [MID, z1 - 3], [MID - half + 3, zMid], [MID + half - 3, zMid]]) {
    for (let y = 126; y <= 133; y++) {
      const r = y > 131 ? 1 : 2;
      for (let dx = -r; dx < r; dx++) for (let dz = -r; dz < r; dz++) put(grid, Math.floor(bx + dx), y, Math.floor(bz + dz), T.bronze);
    }
  }
  // The parapet, crenellated, and a pinnacle at each corner.
  for (let x = Math.floor(MID - half); x < MID + half; x++) {
    for (let z = z0; z <= z1; z++) {
      const [u, v] = [across(x), z + 0.5 - zMid];
      if (Math.max(Math.abs(u), Math.abs(v)) < half - 1) continue;
      const merlon = Math.floor((Math.abs(u) > Math.abs(v) ? z : x) / 3) % 2 === 0;
      for (let y = top + 1; y <= top + (merlon ? 5 : 2); y++) put(grid, x, y, z, T.limeLight);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const [cx, cz] = [Math.floor(MID + sx * (half - 1.5)), Math.floor(zMid + sz * (half - 1.5))];
      for (let y = top + 1; y <= top + 16; y++) {
        const r = y < top + 8 ? 1 : 0;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) put(grid, cx + dx, y, cz + dz, y < top + 8 ? T.lime : T.slate);
      }
      put(grid, cx, top + 17, cz, T.gold);
    }
  }
  // The spire: a square pyramid of slate, lead down its four edges, a dormer in each face low on it.
  const base = half - 3;
  for (let y = top + 1; y <= SPIRE_TOP; y++) {
    const r = base * (1 - (y - top - 1) / (SPIRE_TOP - top));
    for (let x = Math.floor(MID - r - 1); x <= Math.ceil(MID + r); x++) {
      for (let z = Math.floor(zMid - r - 1); z <= Math.ceil(zMid + r); z++) {
        const [u, v] = [Math.abs(across(x)), Math.abs(z + 0.5 - zMid)];
        if (Math.max(u, v) > r + 0.5 || Math.max(u, v) < r - 2) continue;
        const edge = Math.abs(u - v) < 1 && Math.max(u, v) > r - 1;
        put(grid, x, y, z, edge ? T.lead : slate(x, y, z, false, false));
      }
    }
  }
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const out = base * (1 - 10 / (SPIRE_TOP - top)) + 1;
    for (let y = top + 8; y <= top + 15; y++) {
      for (let a = -2; a <= 1; a++) {
        const [x, z] = dx === 0 ? [Math.floor(MID + a), Math.floor(zMid + dz * out)] : [Math.floor(MID + dx * out), Math.floor(zMid + a)];
        const roofed = y >= top + 13;
        put(grid, x, y, z, roofed ? T.slateDark : a === -2 || a === 1 ? T.limeLight : T.dark);
      }
    }
  }
  // The gold cross.
  fillBox(grid, MID - 1, SPIRE_TOP + 1, Math.floor(zMid) - 1, MID, H - 1, Math.floor(zMid), T.gold);
  fillBox(grid, MID - 3, H - 5, Math.floor(zMid) - 1, MID + 2, H - 4, Math.floor(zMid), T.gold);
}
