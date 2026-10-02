// A herbalist's house inside (interiors/furnish.ts), shop, workroom and home
// in one: the hearth on the back wall and the cauldron before it (the tile
// in front kept free, to stir it from), a shelf of potions and a rack of
// herbs drying on the back wall too, the worktable out in the room (its
// front kept free), the counter by the door where they trade (a row behind
// it for them, one before it for the hero), their bed along the left wall,
// barrels of roots and dried leaves; no floor walled in. The counter first,
// then the bed into the back corner, its head to the wall, then the
// workroom (the room's roomier than a house's: interiors.ts).

import type { Entrance, Room } from '../interiors/interiors';
import { clothFor, type Furniture } from '../interiors/furniture';
import type { Planner } from '../interiors/roomPlanner';

export function furnishHerbalist(plan: Planner, room: Room, seed: number, entrance: Entrance): void {
  const { kept, key, fits, place, along, down, inside, walledIn, fillPocket } = plan;
  // Where they work (herbalistWork.ts), the tiles before each, its whole length, kept free to stand on (they stand
  // before its middle: a two-tile piece's, between the two); a piece on the left wall, the tiles beside it.
  const before = (piece: Furniture | null) => {
    if (piece?.wall === 'left') for (let z = piece.z; z < piece.z + piece.d; z++) kept.add(key(piece.x + piece.w, z));
    else if (piece) for (let x = piece.x; x < piece.x + piece.w; x++) kept.add(key(x, piece.z + piece.d));
  };
  // By the door, the counter: a row behind it for them, one before it for the hero.
  const counter = place('herbCounter', 2, 1, 'none', [[room.door + 1, room.depth - 3], [room.door - 2, room.depth - 3]], false);
  if (counter) for (let x = counter.x; x < counter.x + counter.w; x++) [counter.z - 1, counter.z + 1].forEach((z) => kept.add(key(x, z)));
  // Their bed in the back corner, along the left wall, its head against the back wall (before the wall's pieces take
  // the corner), the tiles along its open side kept free.
  const bed = place('bed', 1, 2, 'left', [[0, 0]], false);
  if (bed) {
    bed.cloth = clothFor(seed, entrance, bed.x, bed.z);
    for (let z = bed.z; z < bed.z + bed.d; z++) kept.add(key(1, z));
  }
  // The hearth, and the cauldron before it on its embers, stirred from the tile in front.
  const hearth = place('hearth', 2, 1, 'back', along(0));
  const cauldron = place('cauldron', 1, 1, 'none', hearth ? [[hearth.x, 1], [hearth.x + 1, 1], ...inside()] : inside());
  before(cauldron);
  // On the back wall too: the potions on their shelf, the herbs drying.
  const frontFree = (w: number) => along(0).filter(([x]) => fits(x, 1, w, 1)); // (where what's before it is free to stand on)
  before(place('potionShelf', 1, 1, 'back', frontFree(1)));
  before(place('dryingRack', 2, 1, 'back', frontFree(2)) ?? place('dryingRack', 1, 2, 'left', down(0).filter(([, z]) => fits(1, z, 1, 2)))); // (no room on the back wall: the left one)
  // Out in the room, the worktable, its front free (after the wall's pieces, clear of their fronts: kept).
  before(place('herbTable', 2, 1, 'none', inside().filter(([x, z]) => fits(x, z + 1, 2, 1)))); // (only where its front's free too)
  // Barrels in the corners.
  place('barrel', 1, 1, 'none', [[room.width - 1, 0], [room.width - 1, room.depth - 1], [0, room.depth - 1]]);
  for (let pocket = walledIn(); pocket; pocket = walledIn()) fillPocket(...pocket);
}
