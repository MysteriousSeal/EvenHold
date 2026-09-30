// A home's furniture (furnish.ts): a hearth, a bed (into the back corner if
// it can, its open side kept free), a table with chairs, a chest, a shelf,
// barrels and a rug.

import type { Entrance, Room } from './interiors';
import { clothFor } from './furniture';
import type { Planner } from './roomPlanner';

export function furnishHouse(plan: Planner, room: Room, seed: number, entrance: Entrance): void {
  const { rng, kept, key, place, along, down, inside, chairs } = plan;
  // The bed first, into the back corner if it can, else along the left
  // wall; then the tiles along its open side and at its ends are kept free.
  const bedSpots = down(0).filter(([, z]) => z > 0);
  const bed = place('bed', 1, 2, 'left', [[0, 0]], false) ?? place('bed', 1, 2, 'left', bedSpots);
  if (bed) {
    bed.cloth = clothFor(seed, entrance, bed.x, bed.z);
    for (let z = bed.z - 1; z <= bed.z + bed.d; z++) kept.add(key(1, z));
    kept.add(key(0, bed.z - 1));
    kept.add(key(0, bed.z + bed.d));
  }
  place('hearth', 2, 1, 'back', along(0));
  const table = place('table', 1, 1, 'none', inside());
  if (table) {
    chairs(table);
    if (rng() < 0.7) place('rug', 3, 3, 'none', [[table.x - 1, table.z - 1]]);
  }
  place('chest', 1, 1, 'back', along(0));
  if (rng() < 0.7) place('shelf', 1, 1, 'back', along(0));
  for (let n = 1 + Math.floor(rng() * 2); n > 0; n--) place('barrel', 1, 1, 'none', [[room.width - 1, 0], [0, room.depth - 1], [room.width - 1, room.depth - 1], ...along(0)]);
}
