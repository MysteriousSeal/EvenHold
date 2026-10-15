// The cathedral within (interiors/furnish.ts): one plan, every world's the same, its room NAVE wide and DEEP long, the
// great door in the middle of its near wall (interiors.ts). Down its length two rows of pillars, the nave between
// them and an aisle outside each; pews in the nave either side of the way up it; at its far end the high altar
// against the back wall under its gilded retable, a candle stand either side and a lectern before it; in the left
// aisle's end the stair down to the reliquary (behind its grille: the reliquary's own, reliquary/); in the right
// aisle's end, walled off, the bishop's quarters (a screen along the pillars' line and across the aisle, its door in it): a great
// bed, a cask of wine, his coffer. Votive candles along the aisles.

import type { Room } from '../interiors/interiors';
import type { Furniture, FurnitureKind } from '../interiors/furniture';
import type { Planner } from '../interiors/roomPlanner';

export const NAVE = 11; // the room's width
export const DEEP = 17; // and depth
const PILLARS_X = [2, 8];
const PILLARS_Z = [4, 7, 10, 13];
const PEWS_Z = [7, 9, 11, 13];
export const RELIQUARY_STAIR: [number, number] = [0, 0]; // its first tile (2 by 2), in the left aisle's far end
export const BISHOP = { x0: 9, z1: 3 }; // his quarters: from x0 to the right wall, from the back wall to z1 (its screens just past: the pillar at their corner)

export function furnishCathedral(plan: Planner, room: Room): void {
  const { items, taken, key } = plan;
  const put = (kind: FurnitureKind, x: number, z: number, w = 1, d = 1, wall: Furniture['wall'] = 'none', extra: Partial<Furniture> = {}): Furniture => {
    const piece: Furniture = { kind, x, z, w, d, wall, solid: kind !== 'rug', ...extra };
    if (piece.solid) for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) taken.add(key(a, b));
    items.push(piece);
    return piece;
  };
  const middle = room.door;
  put('altar', middle - 1, 0, 3, 1, 'back');
  put('rug', middle - 2, 1, 5, 2); // (the sanctuary's carpet, before the altar)
  for (const x of [middle - 2, middle + 2]) put('candleStand', x, 0, 1, 1, 'back');
  put('lectern', middle + 1, 3);
  for (const x of PILLARS_X) for (const z of PILLARS_Z) put('pillar', x, z);
  for (const z of PEWS_Z) for (const x of [PILLARS_X[0] + 1, middle + 1]) put('pew', x, z, middle - 1 - PILLARS_X[0], 1); // (each its back to the door)
  put('reliquaryStair', RELIQUARY_STAIR[0], RELIQUARY_STAIR[1], 2, 2, 'back');
  for (const z of [6, 10]) put('candleStand', 0, z, 1, 1, 'left');
  // The bishop's quarters: a screen along the aisle (its left edge) and across it (its far edge), its door in the corner.
  for (let z = 0; z <= BISHOP.z1; z++) put('hallWall', BISHOP.x0 - 1, z, 1, 1, 'left', { tall: true }); // (on the pillars' line)
  put('hallWall', BISHOP.x0, BISHOP.z1 + 1, 1, 1, 'back', { tall: true });
  put('hallDoor', room.width - 1, BISHOP.z1 + 1, 1, 1, 'back', { tall: true });
  put('doubleBed', BISHOP.x0 + (room.width - 1 - BISHOP.x0 > 1 ? 1 : 0), 0, 2, 2, 'back');
  put('barrel', BISHOP.x0, 2); // (his wine)
  put('chest', BISHOP.x0, BISHOP.z1, 1, 1, 'none'); // (his coffer: the way in from the door, along the wall, free)
}
