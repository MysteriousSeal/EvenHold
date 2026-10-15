// A cottage inside (cottage.ts), always the same room (COTTAGE_SIZE, its door in the middle): for sale, a table and a
// chair, the reeve's notice on the back wall; the hero's, the same table and chair, and each thing it could have in
// its own place, built or chalked out on the floor: the bed in the back left corner along the left wall, the hearth on
// the back wall, the cauldron beside it, the chest in the back right corner, the trophy wall along the left wall
// before the bed. The door's column kept clear, the floor before each piece free to stand on.

import type { Furniture } from '../interiors/furniture';
import type { Room } from '../interiors/interiors';
import { hungOf, type Trophies } from './trophies';
import type { Cottage, UpgradeId } from './cottage';

export const COTTAGE_SIZE = { width: [7, 7] as [number, number], depth: [6, 6] as [number, number] };
const BLANKET = 1; // (a bed's cloth: view/interior/bedVoxels.ts)

// Where each upgrade goes, and what it is, built (the garden's outdoors, later: none here).
const PLACES: Partial<Record<UpgradeId, Omit<Furniture, 'solid'>>> = {
  bed: { kind: 'bed', x: 0, z: 0, w: 1, d: 2, wall: 'left', cloth: BLANKET },
  hearth: { kind: 'hearth', x: 2, z: 0, w: 2, d: 1, wall: 'back' },
  cauldron: { kind: 'cauldron', x: 4, z: 0, w: 1, d: 1, wall: 'back' },
  chest: { kind: 'homeChest', x: 6, z: 0, w: 1, d: 1, wall: 'back' },
  trophies: { kind: 'trophyWall', x: 0, z: 2, w: 1, d: 4, wall: 'left' },
};
const FLAT: ReadonlySet<Furniture['kind']> = new Set(['trophyWall', 'cottageSpot', 'saleNotice', 'rug']); // (hung on a wall, or on the floor: nothing to bump)

// What's in it always: a table toward the front right, a chair pulled up to it, a rug under them.
function plain(): Furniture[] {
  return [
    { kind: 'rug', x: 4, z: 2, w: 3, d: 3, wall: 'none', solid: false },
    { kind: 'table', x: 5, z: 3, w: 1, d: 1, wall: 'none', solid: true },
    { kind: 'chair', x: 4, z: 3, w: 1, d: 1, wall: 'none', solid: true, facing: [1, 0] },
  ];
}

// A cottage for sale: bare but for the table and chair, and the reeve's notice nailed up.
export const forSale = (): Furniture[] => [...plain(), { kind: 'saleNotice', x: 3, z: 0, w: 1, d: 1, wall: 'back', solid: false }];

// The hero's cottage: what's built in place, what's not chalked out where it would go; the trophy wall with what's hung.
export function furnishCottage(room: Room, cottage: Cottage, trophies?: Trophies): Furniture[] {
  const pieces = plain();
  for (const [id, at] of Object.entries(PLACES) as Array<[UpgradeId, Omit<Furniture, 'solid'>]>) {
    if (at.x + at.w > room.width || at.z + at.d > room.depth) continue;
    const built = cottage.built.includes(id);
    if (built) pieces.push({ ...at, solid: !FLAT.has(at.kind), ...(at.kind === 'trophyWall' && { hung: hungOf(trophies) }) });
    else pieces.push({ kind: 'cottageSpot', x: at.x, z: at.z, w: at.w, d: at.d, wall: at.wall, solid: false, upgrade: id });
  }
  return pieces;
}
