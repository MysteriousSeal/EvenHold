// The inn's furniture (interiors/furnish.ts): the bar along the left wall
// (a washstand, bottle shelves, the counter, stools facing it, a keg behind
// it), the stairs up in the front corner, the hearth corner (a bear rug,
// armchairs), tavern tables with chairs filling the floor, and what hangs on
// the back wall.

import type { Room } from '../interiors/interiors';
import { type Furniture } from '../interiors/furniture';
import type { Planner } from '../interiors/roomPlanner';

export function furnishInn(plan: Planner, room: Room): void {
  const { rng, items, place, along, chairs, openWalledIn, fillWalledIn } = plan;
  // The bar, along the left wall: a washstand and shelves of bottles against it, the
  // counter just in front of them, and stools facing it.
  const barEnd = Math.min(room.depth - 3, 5);
  place('sink', 1, 2, 'left', [[0, 1]]); // nearest the keg: the washstand, where the empty mugs go
  for (let z = 3; z + 1 <= barEnd; z += 2) place('bottleShelf', 1, 2, 'left', [[0, z]]); // then bottle shelves
  const counter = place('counter', 1, barEnd + 1, 'left', [[1, 0]]); // from the back wall
  for (let z = counter ? counter.z : barEnd + 1; counter && z < counter.z + counter.d; z++) {
    if (rng() >= 0.75) continue;
    const stool = place('barStool', 1, 1, 'none', [[2, z]]);
    if (stool) stool.facing = [-1, 0]; // toward the bar
  }
  place('keg', 1, 1, 'left', [[0, 0]]); // behind the bar, its tap facing the counter
  // In the front corner past the bar, the stairs up: two long, out from the left wall into the
  // room, climbing from the room toward the wall (the floor above's stairwell in the same corner).
  place('stairs', 2, 1, 'none', [[0, room.depth - 1]]);
  // The hearth corner: the fire on the back wall, a bear rug before it, two armchairs facing it.
  const hearth = place('hearth', 2, 1, 'back', along(0).filter(([x]) => x >= 5 && x <= room.width - 3));
  if (hearth) {
    // The rug before the fire, and the two armchairs side by side on it,
    // a tile back from the hearth, facing the fire.
    place('bearRug', 2, 2, 'none', [[hearth.x, 1]]);
    for (const x of [hearth.x, hearth.x + 1]) {
      const chair = place('armchair', 1, 1, 'none', [[x, 2]]);
      if (chair) chair.facing = [0, -1];
    }
  }
  // Tavern tables, laid for a meal, with chairs round them, filling the
  // floor (out to the right-hand wall): each three tiles from the next
  // table, two from anything else. Others' chairs don't count: chairs pull
  // up to their own table, so two back to back between tables still leave
  // a walkway.
  const gapTo = (o: Furniture, x: number, z: number) => Math.max(o.x - x, x - (o.x + o.w - 1), o.z - z, z - (o.z + o.d - 1));
  const clearOf = (x: number, z: number, gap: number, pastChairs = false) =>
    items.every((o) => !o.solid || (pastChairs && o.kind === 'chair') || gapTo(o, x, z) >= (o.kind === 'tavernTable' ? gap : Math.min(gap, 2)));
  const floor: Array<[number, number]> = [];
  for (let x = 1; x < room.width; x++) for (let z = 1; z < room.depth - 1; z++) floor.push([x, z]);
  // As many as fit, up to ten; and at least three: if the room's too
  // small, closer (two apart), a little further toward the bar and the hearth.
  const MAX_TABLES = 10;
  let tables = 0;
  for (const pass of [{ gap: 3, x: 4, z: 2, pastChairs: true }, { gap: 2, x: 5, z: 3 }, { gap: 2, x: 4, z: 2, pastChairs: true }]) {
    while (tables < MAX_TABLES && (pass.gap === 3 || tables < 3)) {
      const spots = floor.filter(([x, z]) => x >= pass.x && z >= pass.z && clearOf(x, z, pass.gap, pass.pastChairs));
      const table = place('tavernTable', 1, 1, 'none', spots);
      if (!table) break;
      chairs(table);
      tables++;
    }
  }
  // No chairs walling off a corner (past the bar's end, say: where the server
  // fetches from, and the stairs): the ones in the way left out.
  openWalledIn('chair');
  // On the back wall, over the room: antlers, a shield, the notice board, lanterns (the left wall by the door kept clear).
  place('antlers', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  place('wallShield', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  place('noticeBoard', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  for (let n = 3; n > 0; n--) place('wallLantern', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  fillWalledIn(); // no floor shut off from the door (a corner, boxed in: a barrel there)
}
