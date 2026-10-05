// A bandit camp's props in voxels (campVoxels.ts: its palette, the palisade,
// the gatehouse, the watchtower, the woodpile), each a tile, facing local +Z:
// - the fire: a ring of stones on scorched earth, logs and embers in it (its
//   flames the fire effect's: campFires.ts), an iron pot of stew hung from a
//   tripod over it, log seats round it, their sawn ends showing;
// - a tent by its look: a big A-frame of patched hides, its crossed poles
//   standing up past the ridge, guy ropes pegged out, a bedroll inside, its
//   door flap tied back (0); a bell tent of red and pale canvas in stripes, a
//   pennant on its pole, a dark door (1);
// - the banner: a tall pole, a red banner with a white skull on it; before it a
//   weapon rack of spears, an axe and a sword, a round shield leaning on it;
// - stolen goods: crates (one open, apples in it), banded barrels, sacks, a cart
//   wheel leaning on them;
// - the loot: an iron-bound chest (buildLootChest: shut and padlocked, or thrown open and emptied), gold spilling
//   out, a goblet and a candlestick by it, on a red rug.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, voxelLine } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C, TILE, logAlongX, post, set, skull } from './campVoxels';

const MID = (TILE - 1) / 2;

export const FIRE_HIGH = 18;
export function buildCampfire(): VoxelGrid {
  const g = createGrid([TILE, FIRE_HIGH, TILE]);
  // Scorched earth round it, ash and char.
  for (let x = 4; x <= 20; x++) for (let z = 4; z <= 20; z++) {
    const r = Math.hypot(x - MID, z - MID) + (hashUnit(x, z, 80) - 0.5) * 1.5;
    if (r < 7.5) set(g, x, 0, z, r < 3.5 ? C.char : r < 5.5 ? C.ash : C.earth);
  }
  // Its ring of stones, two high.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const [x, z] = [Math.round(MID + Math.cos(a) * 4.6 - 0.5), Math.round(MID + Math.sin(a) * 4.6 - 0.5)];
    fillBox(g, x, 1, z, x + 1, 2, z + 1, (xx, y) => (y === 2 && xx === x ? C.stone : k % 2 ? C.stoneDark : C.stone));
  }
  // Logs crossed in it, embers glowing between them.
  voxelLine(g, [9, 1, 10], [15, 2, 14], C.bark);
  voxelLine(g, [9, 1, 14], [15, 2, 10], C.barkDark);
  for (const [x, z] of [[11, 12], [13, 12], [12, 11], [12, 13]]) set(g, x, 1, z, C.ember);
  // The tripod: three poles leaning in to a point over it, a chain down, the pot hung from it, stew in it.
  for (const [x, z] of [[6, 8], [18, 8], [12, 19]]) voxelLine(g, [x, 1, z], [12, 15, 12], C.barkDark);
  for (let y = 9; y <= 14; y++) set(g, 12, y, 12, C.iron);
  for (let x = 10; x <= 14; x++) for (let z = 10; z <= 14; z++) {
    if ((x === 10 || x === 14) && (z === 10 || z === 14)) continue;
    for (let y = 5; y <= 8; y++) set(g, x, y, z, y === 8 && x > 10 && x < 14 && z > 10 && z < 14 ? C.stew : C.pot);
  }
  // Log seats on three sides, their ends sawn; a stump on the fourth.
  logAlongX(g, 6, 18, 0, 21, 3);
  for (let x = 1; x <= 3; x++) for (let y = 0; y <= 2; y++) for (let z = 6; z <= 18; z++) if (!((x === 1 || x === 3) && (y === 0 || y === 2))) set(g, x, y, z, z === 6 || z === 18 ? C.cutEnd : (z + y) % 4 === 0 ? C.barkDark : C.bark);
  for (let x = 21; x <= 23; x++) for (let y = 0; y <= 2; y++) for (let z = 7; z <= 17; z++) if (!((x === 21 || x === 23) && (y === 0 || y === 2))) set(g, x, y, z, z === 7 || z === 17 ? C.cutEnd : (z + y) % 4 === 0 ? C.barkDark : C.bark);
  return g;
}

export const TENT_HIGH = 24;
export function buildTent(variant = 0): VoxelGrid {
  return variant === 1 ? bellTent() : hideTent();
}

// The A-frame of patched hides: its ridge along z, its door at +z (toward the fire), its flap tied back.
function hideTent(): VoxelGrid {
  const g = createGrid([TILE, TENT_HIGH, TILE]);
  const top = 17;
  const patch = (x: number, y: number, z: number) => {
    if (z % 6 === 0 || (y % 5 === 0 && y > 0)) return C.seam; // stitched seams
    const h = hashUnit(Math.floor(x / 5), Math.floor(y / 4) * 10 + Math.floor(z / 6), 81);
    return h < 0.4 ? C.hideTan : h < 0.75 ? C.hideBrown : C.canvas;
  };
  for (let y = 0; y < top; y++) {
    const half = 11 - Math.floor((y * 11) / top);
    for (const side of [-1, 1]) for (let d = 0; d <= 1; d++) {
      const x = Math.round(MID + side * Math.max(0, half - d));
      for (let z = 2; z <= 20; z++) set(g, x, y, z, patch(x, y, z));
    }
    for (let x = Math.round(MID - half); x <= Math.round(MID + half); x++) set(g, x, y, 2, patch(x, y, 2)); // its closed back
    for (let x = Math.round(MID - half) + 1; x <= Math.round(MID + half) - 1; x++) set(g, x, y, 20, x > MID + 1 && y < top - 4 ? C.hideBrown : C.inside); // its door, the flap tied back on one side
  }
  // Its crossed poles at either end, standing up past the ridge; the ridge pole between.
  for (const z of [1, 21]) {
    voxelLine(g, [Math.round(MID - 4), 0, z], [Math.round(MID + 2), top + 4, z], C.barkDark);
    voxelLine(g, [Math.round(MID + 4), 0, z], [Math.round(MID - 2), top + 4, z], C.barkDark);
  }
  fillBox(g, Math.round(MID), top, 1, Math.round(MID), top, 21, C.bark);
  // Guy ropes to pegs at its corners; a bedroll inside, by the door.
  for (const [x, z] of [[0, 0], [24, 0], [0, 23], [24, 23]]) {
    voxelLine(g, [x, 0, z], [x < 12 ? 4 : 20, 8, z < 12 ? 3 : 20], C.rope);
    set(g, x, 0, z, C.barkDark);
  }
  fillBox(g, 9, 0, 14, 15, 1, 19, (x, y) => (y === 1 ? (x % 3 === 0 ? C.furDark : C.fur) : C.hideBrown));
  return g;
}

// The bell tent: round, its canvas in red and pale stripes, a pole out of its peak with a pennant, a dark door toward
// the fire, guy ropes all round.
function bellTent(): VoxelGrid {
  const g = createGrid([TILE, TENT_HIGH, TILE]);
  const high = 18;
  for (let y = 0; y <= high; y++) {
    const r = y < 6 ? 10.5 : 10.5 * (1 - ((y - 6) / (high - 6)) ** 1.15); // (straight-sided low, then the cone)
    for (let x = 0; x < TILE; x++) for (let z = 0; z < TILE; z++) {
      const d = Math.hypot(x - MID, z - MID);
      if (d > r || (d < r - 1.6 && y < high)) continue;
      const a = Math.atan2(z - MID, x - MID);
      const door = Math.abs(a - Math.PI / 2) < 0.38 && y < 11; // (toward +z)
      const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0;
      set(g, x, y, z, door ? C.inside : y === 5 ? C.redDark : stripe ? C.red : C.canvas);
    }
  }
  fillBox(g, Math.round(MID), high, Math.round(MID), Math.round(MID), high + 4, Math.round(MID), C.barkDark); // its pole
  fillBox(g, Math.round(MID) + 1, high + 2, Math.round(MID), Math.round(MID) + 4, high + 4, Math.round(MID), (x, y) => (x === Math.round(MID) + 4 && y === high + 2 ? 0 : C.red)); // a pennant
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2; // (none across its door, at a quarter turn)
    const [px, pz] = [Math.round(MID + Math.cos(a) * 12), Math.round(MID + Math.sin(a) * 12)];
    voxelLine(g, [px, 0, pz], [Math.round(MID + Math.cos(a) * 9), 7, Math.round(MID + Math.sin(a) * 9)], C.rope);
    set(g, px, 0, pz, C.barkDark);
  }
  return g;
}

export const RACK_HIGH = 36;
export function buildRack(): VoxelGrid {
  const g = createGrid([TILE, RACK_HIGH, TILE]);
  // The banner: a tall pole, a crossbar, the banner hung from it, a skull on it in bone; its foot torn.
  post(g, 18, 6, 2, 0, 34, true, 82);
  fillBox(g, 12, 31, 7, 23, 31, 7, C.barkDark);
  for (let x = 12; x <= 23; x++) for (let y = 15; y <= 30; y++) {
    if (y < 17 && (x + y) % 3 === 0) continue;
    set(g, x, y, 8, x === 12 || x === 23 ? C.redDark : C.red);
  }
  skull(g, 15, 21, 9); // (painted on, standing proud a voxel)
  for (const [x, y] of [[14, 19], [21, 19], [14, 28], [21, 28]]) set(g, x, y, 9, C.bone); // its crossed bones' ends
  // The weapon rack before it: two X-legs, a rail; spears leaning, an axe, a sword hung; a round shield leaning.
  for (const x of [3, 15]) {
    voxelLine(g, [x - 1, 0, 14], [x + 1, 9, 14], C.bark);
    voxelLine(g, [x + 1, 0, 14], [x - 1, 9, 14], C.bark);
  }
  fillBox(g, 2, 9, 14, 16, 9, 14, C.barkDark);
  for (const x of [5, 8]) {
    voxelLine(g, [x, 0, 17], [x, 15, 15], C.split); // spears, leaning on the rail
    set(g, x, 16, 15, C.steel);
    set(g, x, 17, 15, C.steel);
  }
  fillBox(g, 11, 2, 15, 11, 10, 15, C.bark); // an axe's haft
  fillBox(g, 10, 9, 15, 12, 11, 15, (x) => (x === 11 ? C.iron : C.steel));
  fillBox(g, 14, 3, 15, 14, 9, 15, C.steel); // a sword
  fillBox(g, 13, 9, 15, 15, 9, 15, C.iron);
  for (let x = 3; x <= 11; x++) for (let y = 0; y <= 8; y++) {
    const r = Math.hypot(x - 7, y - 4);
    if (r <= 4.3) set(g, x, y, 19, r > 3.3 ? C.iron : r < 1.2 ? C.steel : x % 3 === 0 ? C.redDark : C.crate); // a shield, leaning
  }
  return g;
}

export const CRATES_HIGH = 18;
export function buildCrates(): VoxelGrid {
  const g = createGrid([TILE, CRATES_HIGH, TILE]);
  const crate = (x0: number, y0: number, z0: number, s: number, open = false) => {
    for (let x = x0; x < x0 + s; x++) for (let y = y0; y < y0 + s; y++) for (let z = z0; z < z0 + s; z++) {
      const edges = [x === x0 || x === x0 + s - 1, y === y0 || y === y0 + s - 1, z === z0 || z === z0 + s - 1].filter(Boolean).length;
      if (open && y === y0 + s - 1 && edges < 2) {
        set(g, x, y, z, (x + z) % 2 ? C.apple : (x * z) % 5 === 0 ? C.leaf : C.apple); // apples heaped in it
        continue;
      }
      set(g, x, y, z, edges >= 2 ? C.crateDark : y === y0 + Math.floor(s / 2) ? C.crateDark : C.crate);
    }
  };
  crate(2, 0, 3, 8);
  crate(10, 0, 2, 8, true);
  crate(4, 8, 4, 6);
  // Two barrels, bound in iron.
  for (const [cx, cz] of [[19, 6], [17, 14]]) {
    for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++) {
      const r = Math.hypot(x - cx, z - cz);
      for (let y = 0; y <= 9; y++) {
        const bulge = 2.6 + (y > 1 && y < 8 ? 0.6 : 0);
        if (r > bulge) continue;
        set(g, x, y, z, y === 1 || y === 8 ? C.iron : y === 9 ? (r < 1.5 ? C.crateDark : C.crate) : (x + z) % 2 ? C.crate : C.crateDark);
      }
    }
  }
  // Sacks slumped by them; a cart's wheel leaning on the crates.
  for (const [x0, z0] of [[3, 15], [9, 18]]) {
    for (let y = 0; y <= 5; y++) {
      const r = y >= 4 ? 1 : 2;
      fillBox(g, x0 + 2 - r, y, z0 + 2 - r, x0 + 2 + r, y, z0 + 2 + r, y === 4 ? C.rope : y % 2 === 0 ? C.burlap : C.burlapDark);
    }
  }
  for (let x = 2; x <= 12; x++) for (let y = 0; y <= 10; y++) {
    const r = Math.hypot(x - 7, y - 5);
    if (r > 5.3) continue;
    const spoke = r < 4.6 && (Math.abs(x - 7) < 0.6 || Math.abs(y - 5) < 0.6 || Math.abs(x - 7 - (y - 5)) < 0.6);
    if (r > 4.4 || spoke || r < 1) set(g, x, y, 11, r > 4.4 ? C.barkDark : C.split); // its rim, spokes and hub
  }
  return g;
}

export const LOOT_HIGH = 14;
export function buildLoot(): VoxelGrid {
  const g = createGrid([TILE, LOOT_HIGH, TILE]);
  // A red rug under it all, its border darker (the chest on it its own: buildLootChest, shut or thrown open).
  for (let x = 3; x <= 21; x++) for (let z = 5; z <= 21; z++) set(g, x, 0, z, x === 3 || x === 21 || z === 5 || z === 21 ? C.redDark : (x + z) % 4 === 0 ? C.goldDim : C.red);
  // Gold spilt over the rug; a goblet and a candlestick by the chest.
  for (const [x, z] of [[9, 18], [12, 19], [15, 18], [18, 13], [6, 14], [13, 20]]) set(g, x, 1, z, C.gold);
  fillBox(g, 19, 1, 17, 19, 3, 17, (_x, y) => (y === 2 ? C.goldDim : C.gold)); // the goblet
  set(g, 18, 3, 17, C.gold);
  set(g, 20, 3, 17, C.gold);
  fillBox(g, 4, 1, 17, 4, 6, 17, (_x, y) => (y === 1 ? C.goldDim : y === 6 ? C.flameHeart : C.bone)); // the candlestick, its candle lit
  return g;
}

// The chest on the rug, iron-bound: shut and padlocked (its chief has the key), a glint of gold under its lid by the
// lock; or thrown open, its lid back, emptied (what it held out on the rug), a coin or two left in the corner.
export function buildLootChest(open: boolean): VoxelGrid {
  const g = createGrid([TILE, LOOT_HIGH, TILE]);
  const band = (x: number, y: number, z: number) => y === 3 || x === 7 || x === 17 || z === 10 || z === 16;
  fillBox(g, 7, 1, 10, 17, 6, 16, (x, y, z) => (band(x, y, z) ? (y === 1 || x === 7 || x === 17 ? C.iron : C.crateDark) : C.crate));
  if (open) {
    fillBox(g, 8, 4, 11, 16, 6, 15, 0); // (hollowed: its inside)
    fillBox(g, 8, 3, 11, 16, 3, 15, C.crateDark); // its floor, in shadow
    set(g, 9, 4, 12, C.gold); // a coin or two left
    set(g, 15, 4, 14, C.gold);
    fillBox(g, 7, 7, 9, 17, 12, 9, (_x, y) => (y === 9 ? C.iron : C.crateDark)); // the lid, back
    set(g, 12, 4, 17, C.iron); // its hasp, hanging
    return g;
  }
  // The lid, shut: domed (its crest a row in), iron at its ends and two straps over it.
  const strap = (x: number) => x === 7 || x === 17 || x === 10 || x === 14;
  fillBox(g, 7, 7, 10, 17, 7, 16, (x) => (strap(x) ? C.iron : C.crate));
  fillBox(g, 7, 8, 11, 17, 8, 15, (x) => (strap(x) ? C.iron : C.crateDark));
  // The padlock: an iron hasp down from the lid, a brass lock on it, its keyhole dark.
  fillBox(g, 12, 6, 17, 12, 7, 17, C.iron);
  fillBox(g, 11, 3, 17, 13, 5, 17, (x, y) => (x === 12 && y === 4 ? C.crateDark : C.goldDim));
  set(g, 11, 6, 16, C.gold); // (gold peeking under the lid)
  set(g, 13, 6, 16, C.gold);
  return g;
}
