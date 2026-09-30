// The smithy's furniture (interiors/furnish.ts): the forge on the back wall
// with its trough and bellows either side, the row before it kept free, the
// anvil and grindstone side by side across from it, the counter by the door
// (room behind it for the smith, before it for the hero), the weapon rack,
// racks hung on the walls, armour on stands against them, coal and barrels;
// the tiles the smith works from kept free (smithWork.ts), and no floor
// walled in.

import type { Room } from '../interiors/interiors';
import { type Furniture } from '../interiors/furniture';
import { shuffle } from '../../util/random';
import type { Planner } from '../interiors/roomPlanner';

export function furnishSmithy(plan: Planner, room: Room): void {
  const { rng, taken, kept, key, fits, items, place, along, down, walledIn, inside, fillPocket } = plan;
  // Where the smith works (smithy/smithWork.ts), each with the tile before it kept free to stand on.
  const before = (piece: Furniture | null) => piece && kept.add(key(piece.x, piece.z + piece.d));
  // The forge on the back wall where its trough fits beside it (on its
  // right, else its left) and its bellows on its other side.
  const wall = along(0);
  shuffle(wall, rng);
  const room2 = (x: number) => fits(x, 0, 2, 1, false, true);
  const room1 = (x: number) => fits(x, 0, 1, 1, false, true);
  const rightOf = (x: number) => room2(x) && room2(x + 2);
  const leftOf = (x: number) => room2(x) && room2(x - 2);
  const spot =
    wall.find(([x]) => rightOf(x) && room1(x - 1)) ?? wall.find(([x]) => leftOf(x) && room1(x + 2)) ?? wall.find(([x]) => rightOf(x)) ?? wall.find(([x]) => leftOf(x));
  const forge = place('forge', 2, 1, 'back', spot ? [spot] : along(0), true, true);
  if (forge) {
    // The quench trough along the back wall on the forge's right, the bellows on its left (the other way round if there's no room).
    const right = room2(forge.x + 2) && (room1(forge.x - 1) || !(room2(forge.x - 2) && room1(forge.x + 2))); // (right, unless only the left leaves the bellows room)
    before(place('trough', 2, 1, 'back', right ? [[forge.x + forge.w, 0]] : [[forge.x - 2, 0]], false, true)); // against the wall
    place('bellows', 1, 1, 'back', right ? [[forge.x - 1, 0], [forge.x + forge.w, 0]] : [[forge.x + forge.w, 0], [forge.x - 1, 0]], false, true);
    // The row before the forge kept free (to work the fire, and see it);
    // the anvil and the grindstone side by side across it from the fire,
    // or else wherever two tiles side by side are free, nearest it (the
    // tile before each free to stand on).
    for (let x = forge.x; x < forge.x + forge.w; x++) kept.add(key(x, 1));
    const two = ([x, g, z]: [number, number, number]) => fits(x, z, 1, 1) && fits(g, z, 1, 1) && fits(x, z + 1, 1, 1) && fits(g, z + 1, 1, 1);
    const across: Array<[number, number, number]> = [[forge.x, forge.x + 1, 2], [forge.x + 1, forge.x, 2], [forge.x, forge.x - 1, 2], [forge.x + 1, forge.x + 2, 2]]; // [anvil, grindstone, row]
    const anywhere = () => {
      const pairs: Array<[number, number, number]> = [];
      for (const [x, z] of inside()) for (const g of [x - 1, x + 1]) pairs.push([x, g, z]);
      const far = ([x, , z]: [number, number, number]) => Math.hypot(x - forge.x - 0.5, z);
      return pairs.filter(two).sort((a, b) => far(a) - far(b))[0];
    };
    const [ax, gx, az] = across.find(two) ?? anywhere() ?? [forge.x, -1, 2];
    const anvil = place('anvil', 1, 1, 'none', [[ax, az], ...inside()], false);
    before(anvil);
    if (anvil && gx >= 0) before(place('grindstone', 1, 1, 'none', [[gx, az]], false));
  }
  // By the door, the counter where he trades: a row behind it for him, one before it for the hero.
  const counter = place('smithCounter', 2, 1, 'none', [[room.door + 1, room.depth - 3], [room.door - 2, room.depth - 3]], false);
  if (counter) for (let x = counter.x; x < counter.x + counter.w; x++) [counter.z - 1, counter.z + 1].forEach((z) => kept.add(key(x, z)));
  // (No room for it beside the anvil: the free spot nearest the anvil, then.)
  const anvil = items.find((f) => f.kind === 'anvil') ?? forge;
  const nearAnvil = inside().sort(([ax, az], [bx, bz]) => (anvil ? Math.hypot(ax - anvil.x, az - anvil.z) - Math.hypot(bx - anvil.x, bz - anvil.z) : 0));
  if (!items.some((f) => f.kind === 'grindstone')) before(place('grindstone', 1, 1, 'none', nearAnvil, false));
  if (!items.some((f) => f.kind === 'trough')) before(place('trough', 2, 1, 'none', inside())); // (no room by the forge: out in the room)
  const rack = place('rack', 1, 2, 'left', down(0));
  // On the walls, first (their spots kept from the stands): his weapons on
  // show on the back wall (not over the fire or the trough), his tools on
  // the left (not over the rack).
  const byFire = (x: number) => !!forge && x >= forge.x - 1 && x <= forge.x + 2;
  const trough = items.find((f) => f.kind === 'trough' && f.wall === 'back');
  const overTrough = (x: number) => !!trough && x >= trough.x && x < trough.x + trough.w;
  for (let n = 2; n > 0; n--) place('weaponWall', 1, 1, 'back', along(0).filter(([x]) => !byFire(x) && !overTrough(x)));
  place('toolBoard', 1, 1, 'left', down(0).filter(([, z]) => z >= 1 && z < room.depth - 2 && !(rack && z >= rack.z && z < rack.z + rack.d)));
  const hungOn = (wall: Furniture['wall'], x: number, z: number) => items.some((f) => (f.kind === 'weaponWall' || f.kind === 'toolBoard') && f.wall === wall && f.x === x && f.z === z);
  // His armour on stands, backed against the back and left walls (clear of the fire, not under what's hung), each in a suit of its own.
  const wallSpots = [...along(0).filter(([x]) => !byFire(x) && !hungOn('back', x, 0)).map((p) => ['back', p] as const), ...down(0).filter(([, z]) => !hungOn('left', 0, z)).map((p) => ['left', p] as const)];
  shuffle(wallSpots, rng);
  const stands: Furniture[] = [];
  const [many, first] = [2 + Math.floor(rng() * 2), Math.floor(rng() * 4)]; // how many, and the first's suit (the next ones the next suits)
  for (const [wall, spot] of wallSpots) {
    if (stands.length >= many) break;
    const stand = place('armorStand', 1, 1, wall, [spot], false);
    if (stand) stands.push(Object.assign(stand, { suit: (first + stands.length) % 4 }));
  }
  // Coal on the back wall, else the free spot nearest the forge.
  const nearForge = inside().sort(([ax, az], [bx, bz]) => (forge ? Math.hypot(ax - forge.x, az) - Math.hypot(bx - forge.x, bz) : 0));
  if (!place('coal', 1, 1, 'none', [[room.width - 1, 0], ...along(0)])) place('coal', 1, 1, 'none', nearForge, false);
  place('barrel', 1, 1, 'none', [[room.width - 1, room.depth - 1], [0, room.depth - 1]]);
  // No floor walled in: a stand shutting a tile off from the door is taken
  // away; any other such tile (a corner, boxed in) gets a barrel, clutter
  // where no one could go anyway.
  for (let pocket = walledIn(); pocket; pocket = walledIn()) {
    const [px, pz] = pocket;
    const stand = stands.find((f) => Math.abs(f.x - px) + Math.abs(f.z - pz) === 1);
    if (stand) {
      stands.splice(stands.indexOf(stand), 1);
      items.splice(items.indexOf(stand), 1);
      taken.delete(key(stand.x, stand.z));
      continue;
    }
    fillPocket(px, pz);
  }
}
