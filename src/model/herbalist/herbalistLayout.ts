// A herbalist's house inside (interiors/furnish.ts), shop, workroom and home
// in one: the hearth on the back wall and the cauldron before it (the tile
// in front kept free, to stir it from), a shelf of potions and a rack of
// herbs drying on the back wall too, the worktable out in the room (its
// front kept free), the counter by the door where they trade (a row behind
// it for them, one before it for the hero), their bed along the left wall,
// a barrel of roots; no floor walled in. Each piece in its own place first,
// as a herbalist would have it (the room just big enough for them all:
// interiors.ts), else anywhere it fits.

import type { Entrance, Room } from '../interiors/interiors';
import { clothFor, type Furniture } from '../interiors/furniture';
import type { Planner } from '../interiors/roomPlanner';

export function furnishHerbalist(plan: Planner, room: Room, seed: number, entrance: Entrance): void {
  const { kept, key, taken, fits, place, along, down, inside, walledIn, fillPocket } = plan;
  const { width: W, depth: D, door } = room;
  // Where they work (herbalistWork.ts), the tiles before each, its whole length, kept free to stand on (they stand
  // before its middle: a two-tile piece's, between the two); a piece on the left wall, the tiles beside it.
  const before = (piece: Furniture | null) => {
    if (piece?.wall === 'left') for (let z = piece.z; z < piece.z + piece.d; z++) kept.add(key(piece.x + piece.w, z));
    else if (piece) for (let x = piece.x; x < piece.x + piece.w; x++) kept.add(key(x, piece.z + piece.d));
  };
  // Whether the row before (x..x+w-1, z) is open to stand in (nothing standing there; another's standing room is fine).
  const open = (x: number, z: number, w: number) => z < D && Array.from({ length: w }, (_, i) => x + i).every((i) => i >= 0 && i < W && !taken.has(key(i, z)));
  // Each piece tries its own place first, as a herbalist would have it (the room's just big enough: interiors.ts),
  // then anywhere it fits.
  // By the door, the counter: a row behind it for them, one before it for the hero.
  const counter = place('herbCounter', 2, 1, 'none', [[door + 1, D - 3], [door - 2, D - 3]], false);
  if (counter) for (let x = counter.x; x < counter.x + counter.w; x++) [counter.z - 1, counter.z + 1].forEach((z) => kept.add(key(x, z)));
  // Their bed in the back corner, along the left wall, its head against the back wall, the tile beside its pillow free.
  const bed = place('bed', 1, 2, 'left', [[0, 0]], false);
  if (bed) {
    bed.cloth = clothFor(seed, entrance, bed.x, bed.z);
    kept.add(key(1, 1));
  }
  // The hearth in the middle of the back wall, the cauldron before it on its embers, stirred from the tile in front.
  const hearth = place('hearth', 2, 1, 'back', [[2, 0], [3, 0], ...along(0)], false);
  before(place('cauldron', 1, 1, 'none', hearth ? [[hearth.x, 1], [hearth.x + 1, 1], ...inside()] : inside(), false));
  // The drying rack in the far corner of the back wall (else the left wall); the potions on their shelf by the bed.
  before(place('dryingRack', 2, 1, 'back', ([[W - 2, 0], ...along(0)] as Array<[number, number]>).filter(([x]) => open(x, 1, 2)), false) ?? place('dryingRack', 1, 2, 'left', down(0).filter(([, z]) => open(1, z, 1) && open(1, z + 1, 1))));
  before(place('potionShelf', 1, 1, 'back', ([[1, 0], [W - 3, 0], ...along(0)] as Array<[number, number]>).filter(([x]) => open(x, 1, 1)), false));
  // The worktable at the left, toward the front, its front free; else anywhere it and its front fit.
  const tableSpots: Array<[number, number]> = [[0, D - 3], [0, D - 2], [W - 2, D - 3], [W - 2, D - 2], ...inside()];
  before(place('herbTable', 2, 1, 'none', tableSpots.filter(([x, z]) => fits(x, z, 2, 1) && open(x, z + 1, 2)), false));
  // A barrel in a corner.
  place('barrel', 1, 1, 'none', [[W - 1, D - 1], [0, D - 1], [W - 1, 0]]);
  for (let pocket = walledIn(); pocket; pocket = walledIn()) fillPocket(...pocket);
}
