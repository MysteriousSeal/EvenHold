// The smithy's furniture (interiors/furnish.ts): the forge on the back wall
// with its trough and bellows either side, the row before it kept free, the
// anvil and grindstone side by side across from it, the counter by the door
// (room behind it for the smith, before it for the hero), the weapon rack,
// racks hung on the walls, armour on stands against them, coal and barrels;
// the tiles the smith works from kept free (smithWork.ts), and no floor
// walled in.

import type { Room } from '../interiors/interiors';
import { distanceTo, type Furniture } from '../interiors/furniture';
import { shuffle } from '../../util/random';
import type { Planner } from '../interiors/roomPlanner';

// How far (tiles) from the counter the hero must be, stepping in or at their work, for the smith not to come to it.
const AWAY = 2.5; // (keeperWork.ts SERVE_NEAR: nearer, they come)

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
    const bellows = place('bellows', 1, 1, 'back', right ? [[forge.x - 1, 0], [forge.x + forge.w, 0]] : [[forge.x + forge.w, 0], [forge.x - 1, 0]], false, true);
    if (bellows) bellows.side = bellows.x < forge.x ? 1 : -1;
    // The row before the forge kept free (to work the fire, and see it);
    // the anvil and the grindstone side by side across it from the fire,
    // or else wherever two tiles side by side are free, nearest it (the
    // tile before each free to stand on).
    for (let x = forge.x; x < forge.x + forge.w; x++) kept.add(key(x, 1));
    // The anvil wants the tile behind it free too: the smith's, across it from the hero (smithWork.ts).
    const behind = (x: number, z: number) => z >= 1 && !taken.has(key(x, z - 1));
    const two = ([x, g, z]: [number, number, number]) => fits(x, z, 1, 1) && fits(g, z, 1, 1) && fits(x, z + 1, 1, 1) && fits(g, z + 1, 1, 1) && behind(x, z);
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
    if (anvil) kept.add(key(anvil.x, anvil.z - 1));
    if (anvil && gx >= 0) before(place('grindstone', 1, 1, 'none', [[gx, az]], false));
  }
  // The counter where he trades, a row behind it for him and one before it for the hero: as near the door as it
  // can be while the hero, stepping in, isn't yet at it (SERVE_NEAR, npcs/keeperWork.ts: else he'd leave his work the
  // moment they're in), nor standing at the anvil (the hero smiths there too).
  const workAt = items.filter((f) => f.kind === 'anvil').map((f) => [f.x, f.z + f.d] as const);
  const counterAt = (x: number, z: number): Furniture => ({ kind: 'smithCounter', x, z, w: 2, d: 1, wall: 'none', solid: true });
  const fromDoor = (x: number, z: number) => distanceTo(counterAt(x, z), room.door, room.depth - 1);
  const clearOf = (x: number, z: number, [wx, wz]: readonly [number, number]) => distanceTo(counterAt(x, z), wx, wz) >= AWAY;
  const rows = (x: number, z: number) => z >= 1 && z <= room.depth - 2 && fits(x, z - 1, 2, 1) && fits(x, z + 1, 2, 1);
  const spots: Array<[number, number]> = [];
  for (let x = 0; x < room.width - 1; x++) for (let z = 1; z < room.depth - 1; z++) if (fits(x, z, 2, 1) && rows(x, z)) spots.push([x, z]);
  const byDoor = (list: Array<[number, number]>) => list.sort(([ax, az], [bx, bz]) => fromDoor(ax, az) - fromDoor(bx, bz));
  // (Out in the room if it can be, off the back wall, else the smith's walled in behind it, and off the left, its
  // wall left for the rack and the armour; else as near those as it can be.)
  const ok = ([x, z]: [number, number]) => fromDoor(x, z) >= AWAY;
  const clear = ([x, z]: [number, number]) => ok([x, z]) && workAt.every((w) => clearOf(x, z, w));
  const out = ([, z]: [number, number]) => z >= 2;
  const tiers = [(p: [number, number]) => clear(p) && out(p) && p[0] >= 1, (p: [number, number]) => clear(p) && out(p), clear, ok];
  const best = tiers.map((tier) => byDoor(spots.filter(tier))[0]).find((p) => p) ?? byDoor(spots).reverse()[0];
  const counter = best ? place('smithCounter', 2, 1, 'none', [best], false) : null;
  if (counter) for (let x = counter.x; x < counter.x + counter.w; x++) [counter.z - 1, counter.z + 1].forEach((z) => kept.add(key(x, z)));
  // The salvage bench (skills/salvage.ts), out in the room, its front (kept free) out of the counter's reach, as the
  // anvil's is; nearest the anvil, the work kept together.
  const near = items.find((f) => f.kind === 'anvil') ?? forge;
  const benchSpots = inside().filter(([x, z]) => fits(x, z + 1, 1, 1) && !(counter && distanceTo(counter, x, z + 1) < AWAY));
  benchSpots.sort(([ax, az], [bx, bz]) => (near ? Math.hypot(ax - near.x, az - near.z) - Math.hypot(bx - near.x, bz - near.z) : 0));
  before(place('salvageBench', 1, 1, 'none', benchSpots, false) ?? place('salvageBench', 1, 1, 'none', inside().filter(([x, z]) => fits(x, z + 1, 1, 1)), true) ?? place('salvageBench', 1, 1, 'none', inside(), true)); // (a small smithy: wherever it fits)
  // (No room for it beside the anvil: the free spot nearest the anvil, then.)
  const anvil = items.find((f) => f.kind === 'anvil') ?? forge;
  const nearAnvil = inside().sort(([ax, az], [bx, bz]) => (anvil ? Math.hypot(ax - anvil.x, az - anvil.z) - Math.hypot(bx - anvil.x, bz - anvil.z) : 0));
  if (!items.some((f) => f.kind === 'grindstone')) before(place('grindstone', 1, 1, 'none', nearAnvil, false));
  if (!items.some((f) => f.kind === 'trough')) before(place('trough', 2, 1, 'none', inside())); // (no room by the forge: out in the room)
  const rack = place('rack', 1, 2, 'left', down(0));
  // On the walls, first (their spots kept from the stands): his weapons on
  // show on the back wall (not over the fire or the trough), his tools on
  // the left (not over the rack; else on the back wall too).
  const byFire = (x: number) => !!forge && x >= forge.x - 1 && x <= forge.x + 2;
  const trough = items.find((f) => f.kind === 'trough' && f.wall === 'back');
  const overTrough = (x: number) => !!trough && x >= trough.x && x < trough.x + trough.w;
  for (let n = 2; n > 0; n--) place('weaponWall', 1, 1, 'back', along(0).filter(([x]) => !byFire(x) && !overTrough(x)));
  place('toolBoard', 1, 1, 'left', down(0).filter(([, z]) => z >= 1 && z < room.depth - 2 && !(rack && z >= rack.z && z < rack.z + rack.d))) ??
    place('toolBoard', 1, 1, 'back', along(0).filter(([x]) => !byFire(x) && !overTrough(x))); // (the left wall's taken: by the weapons)
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
  // (Too few walls free for two: the rest stood out on the floor by his counter, facing the door, on show.)
  const byCounter = inside().sort(([ax, az], [bx, bz]) => (counter ? distanceTo(counter, ax, az) - distanceTo(counter, bx, bz) : 0));
  while (stands.length < 2) {
    const stand = place('armorStand', 1, 1, 'none', byCounter, false);
    if (!stand) break;
    stands.push(Object.assign(stand, { suit: (first + stands.length) % 4 }));
  }
  // Coal on the back wall, else the free spot nearest the forge.
  const nearForge = inside().sort(([ax, az], [bx, bz]) => (forge ? Math.hypot(ax - forge.x, az) - Math.hypot(bx - forge.x, bz) : 0));
  if (!place('coal', 1, 1, 'none', [[room.width - 1, 0], ...along(0)])) place('coal', 1, 1, 'none', nearForge, false);
  // His bar stock stood in a corner (the back wall's, else along it, else the right wall's); the scrap heaped beside
  // the salvage bench.
  const corners: Array<[number, number]> = [[room.width - 1, 0], [0, 0], ...along(0).filter(([x]) => !byFire(x)), ...down(room.width - 1)];
  place('barStock', 1, 1, 'none', corners, false); // (standing free: low, its wall still free to hang over)
  const bench = items.find((f) => f.kind === 'salvageBench');
  if (bench) place('scrapHeap', 1, 1, 'none', [[bench.x + 1, bench.z], [bench.x - 1, bench.z], [bench.x, bench.z - 1]], false);
  // In the front of the room: a crate of new blades at an end of his counter, and a cartwheel's tyre stood against the
  // right wall.
  if (counter) place('bladeCrate', 1, 1, 'none', [[counter.x + counter.w, counter.z], [counter.x - 1, counter.z]], false);
  place('wheelRim', 1, 1, 'none', down(room.width - 1).filter(([, z]) => z >= 1 && z < room.depth - 1).reverse(), false);
  place('barrel', 1, 1, 'none', [[room.width - 1, room.depth - 1], [0, room.depth - 1], [room.width - 1, 0], ...down(room.width - 1).reverse()], false);
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
  // A lantern by his wares, so they catch the eye away from the fire: on the back wall beside a wall of weapons, else on
  // the left wall toward the door, else wherever on those walls it hangs free (never over the fire or the trough, nor
  // over a stand or the rack).
  const under = (wall: Furniture['wall'], x: number, z: number) => items.some((f) => (f.kind === 'armorStand' || f.kind === 'rack') && f.wall === wall && x >= f.x && x < f.x + f.w && z >= f.z && z < f.z + f.d);
  const wares = items.filter((f) => f.kind === 'weaponWall').flatMap((f) => [f.x - 1, f.x + 1]);
  const back = along(0).filter(([x]) => !byFire(x) && !overTrough(x) && !under('back', x, 0));
  const left = down(0).filter(([, z]) => !under('left', 0, z)).reverse(); // (toward the door first)
  place('wallLantern', 1, 1, 'back', back.filter(([x]) => wares.includes(x)), false) ??
    place('wallLantern', 1, 1, 'left', left.filter(([, z]) => z >= room.depth - 3), false) ??
    place('wallLantern', 1, 1, 'back', back, false) ??
    place('wallLantern', 1, 1, 'left', left, false);
  // At least one stretch of back or left wall left free (spells/hung.ts: a painting hangs there): else the lantern
  // taken down, then a stand off the wall.
  const covered = (x: number, z: number) => items.some((f) => f.wall !== 'none' && x >= f.x && x < f.x + f.w && z >= f.z && z < f.z + f.d);
  const wallFree = () => along(0).some(([x]) => !covered(x, 0)) || down(0).some(([, z]) => !covered(0, z));
  for (const kind of ['wallLantern', 'armorStand'] as const) {
    const piece = items.find((f) => f.kind === kind && f.wall !== 'none');
    if (wallFree() || !piece || (kind === 'armorStand' && items.filter((f) => f.kind === 'armorStand').length < 2)) continue;
    items.splice(items.indexOf(piece), 1);
    if (piece.solid) taken.delete(key(piece.x, piece.z));
  }
}
