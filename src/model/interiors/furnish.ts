// Furnishing a room by the kind of building it's in (each its own layout,
// placed by roomPlanner.ts): rolled from the same seed as the room itself,
// so it's always the same for everyone on that seed. Big pieces stand
// against the back (-Z) or left (-X) wall; nothing blocks the door or the
// way in from it. A seat boxed in by what came after it (a chair behind its
// table, a chest and the hearth either side), there being no sitting on it,
// is a barrel instead: the floor it stood on stays taken, as the rest of the room was planned round it.

import type { Entrance, Room } from './interiors';
import { SIT_RANGE, bumpsFurniture, distanceTo, seatOf, type Furniture } from './furniture';
import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import { roomPlanner } from './roomPlanner';
import { furnishHouse } from './houseLayout';
import { furnishInn } from '../inn/innLayout';
import { furnishSmithy } from '../smithy/smithyLayout';
import { furnishHerbalist } from '../herbalist/herbalistLayout';
import { isHerbalistHome } from '../herbalist/herbalistHomes';

export function furnish(seed: number, entrance: Entrance, room: Room): Furniture[] {
  const plan = roomPlanner(seed, entrance, room);
  if (entrance.type === 'house' && isHerbalistHome(entrance)) furnishHerbalist(plan, room, seed, entrance); // (a herbalist's: their shop)
  else if (entrance.type === 'house') furnishHouse(plan, room, seed, entrance);
  else if (entrance.type === 'inn') furnishInn(plan, room);
  else furnishSmithy(plan, room);
  return plan.items.map((piece) => (!seatOf(piece) || canSitOn(piece, plan.items, room) ? piece : { ...piece, kind: 'barrel', facing: undefined }));
}

// Whether the hero can stand somewhere in the room within reach of `seat` to sit on it.
function canSitOn(seat: Furniture, furniture: readonly Furniture[], room: Room): boolean {
  const r = HERO_RADIUS * INDOOR_SCALE;
  const stands = (x: number, z: number) => x >= -0.5 + r && x <= room.width - 0.5 - r && z >= -0.5 + r && z <= room.depth - 0.5 - r && !bumpsFurniture(furniture, x, z, r);
  for (let x = seat.x - 1; x <= seat.x + seat.w; x += 0.1) {
    for (let z = seat.z - 1; z <= seat.z + seat.d; z += 0.1) if (distanceTo(seat, x, z) <= SIT_RANGE && stands(x, z)) return true;
  }
  return false;
}
