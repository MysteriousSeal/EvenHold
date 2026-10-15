// The inn's furniture (interiors/furnish.ts): the bar along the left wall
// (a washstand, bottle shelves, the counter, stools facing it, a keg behind
// it), the stairs up in the front corner, the hearth corner (a bear rug,
// armchairs), tavern tables with chairs filling the floor, and what hangs on
// the back wall.

import type { Room } from '../interiors/interiors';
import { type Furniture } from '../interiors/furniture';
import type { Planner } from '../interiors/roomPlanner';
import { shuffle } from '../../util/random';

export function furnishInn(plan: Planner, room: Room): void {
  const { rng, items, place, fits, along, chairs, openWalledIn, fillWalledIn } = plan;
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
  // The hearth corner: the fire on the back wall, a bear rug before it, two armchairs flanking the fire either side
  // of the bear's head, turned to each other across it (the pelt between them seen), or on its back half facing the
  // fire if there's no room.
  const hearth = place('hearth', 2, 1, 'back', along(0).filter(([x]) => x >= 5 && x <= room.width - 3));
  if (hearth) {
    place('bearRug', 2, 2, 'none', [[hearth.x, 1]]);
    for (const [x, by, way] of [[hearth.x - 1, hearth.x, 1], [hearth.x + 2, hearth.x + 1, -1]]) {
      const chair = place('armchair', 1, 1, 'none', [[x, 1], [by, 2]], false);
      if (chair) chair.facing = chair.x === x ? [way, 0] : [0, -1]; // (beside it, turned to the other across the bear's head)
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
  // (None just inside the door: a little open floor to walk in on, three tiles deep straight ahead of it (two, in a
  // shallow room), two to either side.)
  const ahead = room.depth >= 9 ? 3 : 2;
  const byDoor = (x: number, z: number) => Math.abs(x - room.door) <= 1 ? room.depth - 1 - z < ahead : Math.max(Math.abs(x - room.door), room.depth - 1 - z) < 2;
  const floor: Array<[number, number]> = [];
  for (let x = 1; x < room.width; x++) for (let z = 1; z < room.depth - 1; z++) if (!byDoor(x, z)) floor.push([x, z]);
  // As many as fit, up to ten; and at least three: if the room's too
  // small, closer (two apart), a little further toward the bar and the hearth.
  const MAX_TABLES = 10;
  let tables = 0;
  // Packed, not strewn: each where it rules out fewest of the spots left for
  // the rest (in a rolled order among the equals), so no table set down in
  // the middle of the floor leaves the room half bare round it.
  for (const pass of [{ gap: 3, x: 4, z: 2, pastChairs: true }, { gap: 2, x: 5, z: 3 }, { gap: 2, x: 4, z: 2, pastChairs: true }]) {
    while (tables < MAX_TABLES && (pass.gap === 3 || tables < 3)) {
      const spots = floor.filter(([x, z]) => x >= pass.x && z >= pass.z && fits(x, z, 1, 1) && clearOf(x, z, pass.gap, pass.pastChairs));
      shuffle(spots, rng);
      const crowds = new Map(spots.map((s) => [s, spots.filter(([x, z]) => Math.max(Math.abs(x - s[0]), Math.abs(z - s[1])) < pass.gap).length]));
      spots.sort((a, b) => crowds.get(a)! - crowds.get(b)!);
      const table = place('tavernTable', 1, 1, 'none', spots, false);
      if (!table) break;
      chairs(table);
      tables++;
    }
  }
  // No chairs walling off a corner (past the bar's end, say: where the server
  // fetches from, and the stairs): the ones in the way left out.
  openWalledIn('chair');
  for (const chair of items) if (chair.kind === 'chair') chair.leather = true; // (red only at the hearth: its armchairs)
  // On the back wall, over the room (the left wall by the door kept clear): the notice board first (not over the
  // hearth: read from before it), then three lanterns spread along it (the three of the free spots furthest apart,
  // none on the chimney breast; over the door's column too, hung high in no one's way), not bunched at one end; then
  // antlers and a shield where there's room left.
  const overFire = (x: number) => !!hearth && x >= hearth.x && x < hearth.x + hearth.w;
  const blocked = (x: number) => items.some((o) => o.solid && o.z <= 1 && x >= o.x && x < o.x + o.w); // (something stood before it: an armchair by the fire)
  const board = place('noticeBoard', 1, 1, 'back', along(0).filter(([x]) => x >= 3 && !overFire(x) && !blocked(x))); // (never over the fire: room before it to read it)
  const wall = along(0).filter(([x]) => x >= 3 && !overFire(x) && x !== board?.x).map(([x]) => x);
  shuffle(wall, rng); // (among sets as far apart, a rolled one)
  let lanterns: number[] = wall.slice(0, 3);
  const gap = (xs: number[]) => Math.min(...xs.flatMap((a, i) => xs.slice(i + 1).map((b) => Math.abs(a - b))));
  for (let i = 0; i < wall.length; i++) {
    for (let j = i + 1; j < wall.length; j++) for (let k = j + 1; k < wall.length; k++) if (gap([wall[i], wall[j], wall[k]]) > gap(lanterns)) lanterns = [wall[i], wall[j], wall[k]];
  }
  for (const x of lanterns) place('wallLantern', 1, 1, 'back', [[x, 0]], false, true);
  // The bar lit too: a lantern on the back wall over the counter's end, and one on its own wall past the washstand
  // and shelves (none over them: it'd hang in the basin, or behind the bottles); the way up by one on the wall beside
  // the stairs' foot.
  place('wallLantern', 1, 1, 'back', [[1, 0]], false);
  place('menuSlate', 1, 1, 'back', [[2, 0]], false); // and beside it, what's poured, chalked up
  const backed = (z: number) => items.some((o) => o.wall === 'left' && o.kind !== 'wallLantern' && o.x === 0 && z >= o.z && z < o.z + o.d);
  const barWall = [...Array(barEnd + 1).keys()].filter((z) => z >= 2 && z <= room.depth - 4 && !backed(z)); // (two tiles clear of the stairs' one: not a pair)
  if (barWall.length > 0) place('wallLantern', 1, 1, 'left', [[0, barWall[barWall.length - 1]]], false);
  place('wallLantern', 1, 1, 'left', [[0, room.depth - 2]], false);
  place('antlers', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  place('wallShield', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  // Stores in the room's free corners on the right, at the front and the back (not a bare corner), clear of everything
  // else but each other (and of the floor before the notice board, where it's read from).
  // (Sacks of grain in the front one, the barrels beside them.)
  for (const [kind, x, z] of [['sacks', room.width - 1, room.depth - 1], ['barrel', room.width - 2, room.depth - 1], ['barrel', room.width - 1, room.depth - 2], ['barrel', room.width - 1, 0]] as const) {
    if (z === 0 && board?.x === x) continue;
    const near = (o: Furniture) => Math.max(o.x - x, x - (o.x + o.w - 1), o.z - z, z - (o.z + o.d - 1));
    if (items.every((o) => !o.solid || near(o) >= 2 || (['sacks', 'barrel'].includes(o.kind) && near(o) >= 1))) place(kind, 1, 1, 'none', [[x, z]], false);
  }
  fillWalledIn(); // no floor shut off from the door (a corner, boxed in: a barrel there)
}
