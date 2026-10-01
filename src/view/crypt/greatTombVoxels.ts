// A crypt's great tomb (cryptVoxels.ts: greatSarcophagus, on its dais), its
// lord's (model/crypts/cryptLord.ts), two tiles across and three long, in the
// crypt's own stone (its ashlar, its sarcophagi's panels and roundels): a royal
// tomb in stepped tiers, two of plinth and the body over them, panels sunk in
// its sides, a roundel on each end, corner pillars capped in gold, a lid edged in gold; on it
// the lord carved lying, large to read from afar (his crowned head on a
// cushion, his arms crossed on his chest over a sword laid down his length,
// his feet on a carved hound); chains wrapped round the lid and him, as if to
// keep him in; a tall iron candelabra at each corner, its candles lit. Burst
// (once he's risen): the lid smashed through, half of it gone, the dark inside
// showing, its broken half tipped into the hole; his carved head knocked off,
// lying on the plinth; the chains snapped, hanging; a candelabra toppled.

import { C, type Box } from './cryptVoxels';
import { panelledBody, plinth } from './tombVoxels';
import { ashlarStone } from '../meshes/voxel/ashlar';

const [X0, X1, Z0, Z1] = [7, 42, 7, 67]; // the body, across and along
const [BODY, LID] = [16, 17]; // the body's top, the lid's

export function greatTomb(box: Box, burst: boolean): void {
  // The plinth: two tiers stepping in, laid in the crypt's ashlar (its rock's: cryptWallVoxels.ts), moss at its
  // foot as at a sarcophagus's (tombVoxels.ts), light along their top edges.
  plinth(box, 4, 4, 45, 70, 4, true);
  ashlarTier(box, 3, 0, 3, 46, 2, 71);
  box(5, 4, 5, 44, 6, 69, C.stone);
  ashlarTier(box, 5, 4, 5, 44, 5, 69);
  box(5, 6, 5, 44, 6, 69, C.stoneLight);
  // The body as a sarcophagus's (tombVoxels.ts), grander: sunk panels between posts, a carved roundel on each
  // end; a pillar at each corner standing out, capped in gold.
  panelledBody(box, X0, Z0, X1, Z1, 7, BODY);
  for (const x of [X0 - 1, X1 - 1]) for (const z of [Z0 - 1, Z1 - 1]) {
    box(x, 7, z, x + 2, BODY, z + 2, C.stoneLight);
    box(x, BODY + 1, z, x + 2, BODY + 1, z + 2, C.gold); // its cap
  }
  if (burst) return burstOpen(box);
  // The lid: overhanging, edged in gold, its top chamfered in.
  box(X0 - 1, LID, Z0 - 1, X1 + 1, LID, Z1 + 1, C.lid);
  box(X0 - 1, LID, Z0 - 1, X1 + 1, LID, Z0 - 1, C.gold);
  box(X0 - 1, LID, Z1 + 1, X1 + 1, LID, Z1 + 1, C.gold);
  box(X0 - 1, LID, Z0 - 1, X0 - 1, LID, Z1 + 1, C.gold);
  box(X1 + 1, LID, Z0 - 1, X1 + 1, LID, Z1 + 1, C.gold);
  box(X0 + 1, LID + 1, Z0 + 1, X1 - 1, LID + 1, Z1 - 1, C.lid);
  effigy(box);
  chains(box, false);
  for (const [x, z] of [[1, 1], [47, 1], [1, 72], [47, 72]]) candelabra(box, x, z);
}

// A tier's faces in the crypt's ashlar: blocks in courses, their joints sunk, each block its own tone (meshes/voxel/ashlar.ts).
function ashlarTier(box: Box, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  const tones = { stone: C.stone, dark: C.stoneDark, light: C.stoneLight, mortar: C.mortar };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) box(x, y, z, x, y, z, ashlarStone(tones, x, y - y0 + 1, true, 0, 191) || C.mortar);
    for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) box(x, y, z, x, y, z, ashlarStone(tones, z, y - y0 + 1, true, 1, 192) || C.mortar);
  }
}

// The lord carved lying on the lid, his head toward -z: shapes big enough to read from afar.
function effigy(box: Box): void {
  const y = LID + 2;
  box(16, y, 11, 33, y + 1, 20, C.clay); // the cushion
  head(box, 20, y + 1, 12);
  box(14, y, 21, 35, y + 4, 27, C.stoneLight); // the shoulders
  box(16, y, 28, 33, y + 3, 50, C.stoneLight); // the body, robed
  for (let z = 30; z <= 50; z += 4) box(17, y + 3, z, 32, y + 3, z, C.stone); // the robe's folds
  box(18, y + 4, 29, 31, y + 4, 33, C.stoneLight); // the arms, crossed on the chest
  box(22, y + 4, 30, 27, y + 5, 33, C.stone);
  box(24, y + 4, 25, 25, y + 5, 28, C.gold); // the sword's pommel and grip, in his hands
  box(19, y + 4, 34, 30, y + 4, 35, C.gold); // its crossguard
  box(23, y + 4, 36, 26, y + 4, 58, C.iron); // its blade, down his length
  box(17, y, 51, 22, y + 4, 56, C.stoneLight); // his feet
  box(27, y, 51, 32, y + 4, 56, C.stoneLight);
  box(16, y, 57, 33, y + 3, 64, C.stoneDark); // the hound they rest on, curled
  box(29, y + 2, 58, 34, y + 5, 63, C.stoneDark); // its head
  box(32, y + 4, 62, 33, y + 4, 63, C.socket); // its eye
}

// A crowned head, face up, its face toward +z; the crown's band gold with spikes standing.
function head(box: Box, x: number, y: number, z: number): void {
  box(x, y, z, x + 9, y + 5, z + 8, C.stoneLight);
  box(x + 3, y + 5, z + 6, x + 6, y + 5, z + 8, C.stone); // the nose and brow
  box(x - 1, y + 1, z, x + 10, y + 3, z + 2, C.gold); // the crown's band, round its brow
  for (let k = 0; k <= 10; k += 2) box(x - 1 + k, y + 4, z, x - 1 + k, y + 5, z, C.gold); // its spikes
}

// Two chains round the lid and him, across, down to the plinth (snapped and hanging, burst).
function chains(box: Box, snapped: boolean): void {
  for (const z of [24, 47]) {
    for (let x = X0 - 2; x <= X1 + 2; x++) {
      if (snapped && x > X0 + 3 && x < X1 - 3) continue;
      const top = x < X0 || x > X1 ? 7 : x < 14 || x > 35 ? LID + 2 : LID + 7; // (over the effigy where it lies)
      box(x, top, z, x, top, z, x % 2 ? C.iron : C.ironDark);
    }
    for (const x of [X0 - 2, X1 + 2]) for (let y = 7; y <= LID + 1; y++) box(x, y, z, x, y, z, y % 2 ? C.iron : C.ironDark); // down its sides
  }
}

// A tall iron candelabra at (x, z): a footed base, a stem, arms out, three candles lit.
function candelabra(box: Box, x: number, z: number, fallen = false): void {
  if (fallen) {
    box(x - 1, 0, z, x + 1, 1, z, C.iron); // lying, along x
    box(x, 0, z - 12, x, 1, z, C.ironDark);
    box(x - 1, 0, z - 13, x + 1, 0, z - 13, C.wax);
    return;
  }
  box(x - 1, 0, z - 1, x + 1, 1, z + 1, C.ironDark);
  box(x, 2, z, x, 26, z, C.iron);
  box(x - 2, 26, z, x + 2, 26, z, C.iron);
  for (const dx of [-2, 0, 2]) {
    box(x + dx, 27, z, x + dx, 29, z, C.wax);
    box(x + dx, 30, z, x + dx, 30, z, C.flame);
    box(x + dx, 31, z, x + dx, 31, z, C.core);
  }
}

// Burst open, where he came out: the lid smashed through, half of it gone, the dark within; its broken half
// tipped down into the hole; his carved head knocked off onto the plinth; the chains snapped; a candelabra down.
function burstOpen(box: Box): void {
  box(X0 + 2, 7, Z0 + 2, X1 - 2, BODY, Z1 - 2, 0);
  box(X0 + 2, 7, Z0 + 2, X1 - 2, 7, Z1 - 2, C.socket); // the dark within
  for (const [x0, x1] of [[X0, X0 + 1], [X1 - 1, X1]]) box(x0, 8, Z0 + 2, x1, BODY, Z1 - 2, C.stoneDark); // its walls, in shade
  // What's left of the lid at the head end, broken jagged across.
  for (let x = X0 - 1; x <= X1 + 1; x++) {
    const edge = Z0 + 12 + ((x * 7) % 5) + (x > 24 ? 3 : 0);
    box(x, LID, Z0 - 1, x, LID, edge, C.lid);
    box(x, LID, Z0 - 1, x, LID, Z0 - 1, C.gold);
  }
  box(16, LID + 1, 11, 33, LID + 2, 18, C.clay); // the cushion, the head gone from it
  // The rest of it tipped down into the hole, cracked.
  for (let z = Z0 + 20; z <= Z0 + 40; z++) {
    const y = LID - 1 - Math.floor((z - Z0 - 20) / 3);
    box(X0 + 3, y, z, X1 - 3, y, z, (z * 3) % 7 === 0 ? C.stoneDark : C.lid);
  }
  head(box, 33, 7, 70); // his carved head, knocked off onto the plinth
  chains(box, true);
  for (const [x, z] of [[1, 1], [47, 1], [1, 72]]) candelabra(box, x, z);
  candelabra(box, 47, 72, true);
}
