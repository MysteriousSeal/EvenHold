// A hedge-witch's cottage inside (interiors/furnish.ts), smaller and meaner than a herbalist's (herbalistLayout.ts):
// the hearth on the back wall and her cauldron before it (the tile in front kept free), a rack of things drying in
// the back corner, the counter by the door she's asked across (a row behind it for her, one before it for the hero),
// her table toward the front, her bed along the left wall, her stores heaped in a front corner; no floor walled in.

import type { Entrance, Room } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import type { Planner } from '../interiors/roomPlanner';

const BLANKET = 3; // (a bed's cloth: view/interior/bedVoxels.ts BLANKETS; hers the darkest)

export function furnishWitch(plan: Planner, room: Room, _seed: number, _entrance: Entrance): void {
  const { kept, key, taken, fits, place, along, down, inside, walledIn, fillPocket } = plan;
  const { width: W, depth: D, door } = room;
  // Where she works (witchWork.ts), the tiles before each kept free to stand on; a piece on the left wall, beside it.
  const before = (piece: Furniture | null) => {
    if (piece?.wall === 'left') for (let z = piece.z; z < piece.z + piece.d; z++) kept.add(key(piece.x + piece.w, z));
    else if (piece) for (let x = piece.x; x < piece.x + piece.w; x++) kept.add(key(x, piece.z + piece.d));
  };
  const open = (x: number, z: number, w: number) => z < D && Array.from({ length: w }, (_, i) => x + i).every((i) => i >= 0 && i < W && !taken.has(key(i, z)));
  const counter = place('herbCounter', 2, 1, 'none', [[door - 2, D - 3], [door + 1, D - 3]], false);
  if (counter) for (let x = counter.x; x < counter.x + counter.w; x++) [counter.z - 1, counter.z + 1].forEach((z) => kept.add(key(x, z)));
  const bed = place('bed', 1, 2, 'left', [[0, 0]], false);
  if (bed) {
    bed.cloth = BLANKET;
    kept.add(key(1, 1));
  }
  const hearth = place('hearth', 2, 1, 'back', [[2, 0], [3, 0], ...along(0)], false);
  before(place('cauldron', 1, 1, 'none', hearth ? [[hearth.x, 1], [hearth.x + 1, 1], ...inside()] : inside(), false));
  before(place('dryingRack', 2, 1, 'back', ([[W - 2, 0], ...along(0)] as Array<[number, number]>).filter(([x]) => open(x, 1, 2)), false) ?? place('dryingRack', 1, 2, 'left', down(0).filter(([, z]) => open(1, z, 1) && open(1, z + 1, 1))));
  const tableSpots: Array<[number, number]> = [[W - 2, D - 3], [W - 2, D - 2], [0, D - 3], [0, D - 2], ...inside()];
  before(place('herbTable', 2, 1, 'none', tableSpots.filter(([x, z]) => fits(x, z, 2, 1) && open(x, z + 1, 2)), false));
  place('herbStores', 1, 1, 'none', [[W - 1, D - 1], [0, D - 1], [W - 1, 0]], false);
  for (let pocket = walledIn(); pocket; pocket = walledIn()) fillPocket(...pocket);
}
