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
import { furnishWitch } from '../witch/witchLayout';
import { isWitchHome } from '../witch/witchHomes';
import { furnishCathedral } from '../cathedral/cathedralLayout';

export function furnish(seed: number, entrance: Entrance, room: Room): Furniture[] {
  const plan = roomPlanner(seed, entrance, room);
  if (entrance.type === 'house' && isHerbalistHome(entrance)) furnishHerbalist(plan, room, seed, entrance); // (a herbalist's: their shop)
  else if (entrance.type === 'house' && isWitchHome(entrance)) furnishWitch(plan, room, seed, entrance); // (a hedge-witch's: her cottage)
  else if (entrance.type === 'house') furnishHouse(plan, room, seed, entrance);
  else if (entrance.type === 'inn') furnishInn(plan, room);
  else if (entrance.type === 'cathedral') furnishCathedral(plan, room);
  else furnishSmithy(plan, room);
  const reached = fromTheDoor(plan.items, room); // (once for the room, not for every seat)
  return plan.items.map((piece) => (!seatOf(piece) || canSitOn(piece, plan.items, room, reached) ? piece : { ...piece, kind: 'barrel', facing: undefined }));
}

// Whether the hero can stand somewhere in the room within reach of `seat` to sit on it, on floor walked to from the door
// (not a pocket the rest of the furniture shuts off).
function canSitOn(seat: Furniture, furniture: readonly Furniture[], room: Room, reached: ReadonlySet<string>): boolean {
  const r = HERO_RADIUS * INDOOR_SCALE;
  const stands = (x: number, z: number) => x >= -0.5 + r && x <= room.width - 0.5 - r && z >= -0.5 + r && z <= room.depth - 0.5 - r && !bumpsFurniture(furniture, x, z, r) && reached.has(`${Math.round(x)},${Math.round(z)}`);
  for (let x = seat.x - 1; x <= seat.x + seat.w; x += 0.1) {
    for (let z = seat.z - 1; z <= seat.z + seat.d; z += 0.1) if (distanceTo(seat, x, z) <= SIT_RANGE && stands(x, z)) return true;
  }
  return false;
}

// The room's floor tiles walked to from the doorway, round whatever solid stands on the rest (through an inner door:
// the bishop's in the cathedral, cathedral/cathedralLayout.ts).
export function fromTheDoor(furniture: readonly Furniture[], room: Room): Set<string> {
  const taken = new Set<string>();
  for (const f of furniture) if (f.solid && f.kind !== 'hallDoor') for (let x = f.x; x < f.x + f.w; x++) for (let z = f.z; z < f.z + f.d; z++) taken.add(`${x},${z}`);
  const seen = new Set<string>();
  const todo: Array<[number, number]> = [[room.door, room.depth - 1]];
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    const k = `${x},${z}`;
    if (x < 0 || z < 0 || x >= room.width || z >= room.depth || seen.has(k) || taken.has(k)) continue;
    seen.add(k);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}
