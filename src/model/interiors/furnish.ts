// Furnishing a room by the kind of building it's in (each its own layout,
// placed by roomPlanner.ts): rolled from the same seed as the room itself,
// so it's always the same for everyone on that seed. Big pieces stand
// against the back (-Z) or left (-X) wall; nothing blocks the door or the
// way in from it.

import type { Entrance, Room } from './interiors';
import type { Furniture } from './furniture';
import { roomPlanner } from './roomPlanner';
import { furnishHouse } from './houseLayout';
import { furnishInn } from '../inn/innLayout';
import { furnishSmithy } from '../smithy/smithyLayout';

export function furnish(seed: number, entrance: Entrance, room: Room): Furniture[] {
  const plan = roomPlanner(seed, entrance, room);
  if (entrance.type === 'house') furnishHouse(plan, room, seed, entrance);
  else if (entrance.type === 'inn') furnishInn(plan, room);
  else furnishSmithy(plan, room);
  return plan.items;
}
