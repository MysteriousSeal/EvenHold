// What stands in a room, rolled from the same seed as the room itself, so
// it's always the same for everyone on that seed. Each kind of building is
// furnished its own way: a home has a hearth, a bed, a table with chairs, a
// chest, a shelf, barrels and a rug; the inn a bar (bottle shelves, a
// counter, stools, kegs), a hearth corner with a bear rug and armchairs,
// tavern tables with chairs, and things hung on its walls; the smithy a
// forge, an anvil, a trough, a weapon rack and a heap of coal. Big pieces stand against the back (-Z) or
// left (-X) wall; nothing blocks the door or the way in from it.

import { hashCell, mulberry32, shuffle } from '../../util/random';
import type { Entrance, Room } from './interiors';

export type FurnitureKind =
  | 'hearth'
  | 'bed'
  | 'nightstand' // by a bed's head
  | 'table'
  | 'chair'
  | 'chest'
  | 'shelf'
  | 'barrel'
  | 'rug'
  | 'counter'
  | 'keg'
  | 'sink' // behind the bar, where the empty mugs go
  | 'stairs' // up to the inn's upper floor, along the wall past the bar
  | 'stairwell' // where they come up, upstairs
  | 'hallWall' // upstairs: a low wall between the hallway and the rooms off it
  | 'hallDoor' // and a room's door in it
  | 'roomBed' // and in the rooms, a bed
  | 'doubleBed' // or, in the bigger ones, a double
  | 'wardrobe' // and in the bigger ones, a wardrobe,
  | 'framedPicture' // a picture propped on a wall's rail,
  | 'bathtub' // and a wooden tub
  | 'forge'
  | 'bellows' // beside the forge
  | 'smithCounter' // where the smith trades, by the door
  | 'weaponWall' // his weapons on show, hung on a wall
  | 'armorStand' // a suit of his armour on a stand
  | 'grindstone'
  | 'toolBoard' // his tongs and hammers, hung on a wall
  | 'anvil'
  | 'trough'
  | 'rack'
  | 'coal'
  // The inn's own
  | 'armchair'
  | 'bearRug'
  | 'barStool'
  | 'bench' // on the village squares, outdoors (worldgen/benches.ts)
  | 'bottleShelf'
  | 'tavernTable'
  | 'antlers'
  | 'wallShield'
  | 'noticeBoard'
  | 'wallLantern';

export interface Furniture {
  kind: FurnitureKind;
  x: number; // its first floor tile
  z: number;
  w: number; // tiles it covers along x
  d: number; // along z
  wall: 'back' | 'left' | 'none'; // which wall it stands against (and faces away from)
  solid: boolean; // blocks walking (rugs don't)
  facing?: [number, number]; // a chair: the way its seat faces (toward its table), as (dx, dz)
  open?: boolean; // a door (upstairs, hallDoor): open, its doorway passable
  cloth?: number; // a bed: its blanket's colour, of four (clothFor)
  suit?: number; // an armour stand: the suit on it, of four (chain, plate, studded leather, brigandine)
  tall?: boolean; // an inner wall (hallWall, hallDoor): full height (the walls option), else low; a picture on one: hung on its face
}

const RUGS: FurnitureKind[] = ['rug', 'bearRug'];
// Hung on a wall, above everything on the floor: they take no floor tiles.
const WALL_HUNG: FurnitureKind[] = ['antlers', 'wallShield', 'noticeBoard', 'wallLantern', 'weaponWall', 'toolBoard'];

// A bed's blanket colour (of four), the same each time for the world (`seed`), its building and where it stands.
export const clothFor = (seed: number, entrance: Entrance, x: number, z: number, salt = 0): number =>
  hashCell(Math.round(entrance.x * 4) + x * 31, Math.round(entrance.z * 4) + z * 17, seed + 104729 + salt) % 4;

export function furnish(seed: number, entrance: Entrance, room: Room): Furniture[] {
  const rng = mulberry32(hashCell(Math.round(entrance.x * 4), Math.round(entrance.z * 4), seed + 7919));
  const taken = new Set<string>();
  const kept = new Set<string>(); // left free around a piece (a bed's side), for nothing to crowd it
  const key = (x: number, z: number) => `${x},${z}`;
  // Kept clear: the door's column (the way in) and the tiles either side of the doorway.
  const clear = (x: number, z: number) => x === room.door || (z >= room.depth - 1 && Math.abs(x - room.door) <= 1);
  // `backWall`: the door's column may be taken where it meets the back wall (nothing's in the way there).
  const fits = (x: number, z: number, w: number, d: number, onRug = false, backWall = false) => {
    if (x < 0 || z < 0 || x + w > room.width || z + d > room.depth) return false;
    for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++) if ((clear(i, k) && !(backWall && k === 0)) || kept.has(key(i, k)) || (!onRug && taken.has(key(i, k)))) return false;
    return true;
  };
  const items: Furniture[] = [];
  // Places a piece at the first free spot among `spots` (shuffled), marking its tiles taken.
  const place = (kind: FurnitureKind, w: number, d: number, wall: Furniture['wall'], spots: Array<[number, number]>, shuffled = true, backWall = false): Furniture | null => {
    if (shuffled) shuffle(spots, rng);
    const rug = RUGS.includes(kind) || WALL_HUNG.includes(kind);
    for (const [x, z] of spots) {
      if (!fits(x, z, w, d, rug, backWall)) continue;
      const item: Furniture = { kind, x, z, w, d, wall, solid: !rug };
      if (WALL_HUNG.includes(kind)) {
        // Hung pieces only need their spot on the wall free of other hung pieces.
        if (items.some((o) => WALL_HUNG.includes(o.kind) && o.wall === wall && o.x === x && o.z === z)) continue;
      }
      if (!rug) for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) taken.add(key(a, b));
      items.push(item);
      return item;
    }
    return null;
  };
  const along = (z: number) => Array.from({ length: room.width }, (_, x): [number, number] => [x, z]); // spots along a row
  const down = (x: number) => Array.from({ length: room.depth }, (_, z): [number, number] => [x, z]); // along a column
  // A free floor tile no one could walk to from the door, if any (furniture all round it).
  const walledIn = (): [number, number] | null => {
    const seen = new Set<string>();
    const todo: Array<[number, number]> = [[room.door, room.depth - 1]];
    while (todo.length > 0) {
      const [x, z] = todo.pop()!;
      if (x < 0 || z < 0 || x >= room.width || z >= room.depth || seen.has(key(x, z)) || taken.has(key(x, z))) continue;
      seen.add(key(x, z));
      todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth; z++) if (!taken.has(key(x, z)) && !seen.has(key(x, z))) return [x, z];
    return null;
  };
  const inside = () => {
    const spots: Array<[number, number]> = [];
    for (let x = 1; x < room.width - 1; x++) for (let z = 1; z < room.depth - 1; z++) spots.push([x, z]);
    return spots;
  };
  // Two to four chairs round a table, on its free sides (in a rolled order),
  // each facing it.
  const chairs = (table: Furniture, kind: FurnitureKind = 'chair') => {
    const sides: Array<[number, number, number, number]> = [
      [table.x - 1, table.z, 1, 0],
      [table.x + table.w, table.z, -1, 0],
      [table.x, table.z - 1, 0, 1],
      [table.x, table.z + table.d, 0, -1],
    ];
    shuffle(sides, rng);
    let wanted = 2 + Math.floor(rng() * 3);
    for (const [x, z, dx, dz] of sides) {
      if (wanted === 0) break;
      const chair = place(kind, 1, 1, 'none', [[x, z]]);
      if (!chair) continue;
      chair.facing = [dx, dz];
      wanted--;
    }
  };

  if (entrance.type === 'house') {
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
  } else if (entrance.type === 'inn') {
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
    // On the back wall, over the room: antlers, a shield, the notice board, lanterns (the left wall by the door kept clear).
    place('antlers', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
    place('wallShield', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
    place('noticeBoard', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
    for (let n = 3; n > 0; n--) place('wallLantern', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
  } else {
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
      items.push({ kind: 'barrel', x: px, z: pz, w: 1, d: 1, wall: 'none', solid: true });
      taken.add(key(px, pz));
    }
  }
  return items;
}

// Slim pieces against a wall block only the part of their tiles they fill,
// as a span out from the wall (0 at the wall, 1 at the far side of the
// tile); everything else blocks its whole tiles (a touch inset).
const SLIM: Partial<Record<FurnitureKind, [number, number]>> = {
  bottleShelf: [0, 0.42],
  counter: [0.26, 0.74],
  shelf: [0, 0.34],
  keg: [0, 0.62],
  hallWall: [0, 0.2], // a wall's thickness, at the tile's edge
  smithCounter: [0.24, 0.84], // (standing free, its span across z) only as deep as it's drawn
  hallDoor: [0, 0.2],
  sink: [0, 0.42], // slim against the wall, like the shelves // on its side, reaching 0.6 of its tile out (tap and all)
};

// Seats pulled up to what they face (a chair to its table, a stool to the
// bar) fill only part of their tile: a span across it and a span toward what
// they face (0 at the back of the tile, 1 at the front), as they're drawn.
const PULLED_UP: Partial<Record<FurnitureKind, { across: [number, number]; forward: [number, number] }>> = {
  chair: { across: [0.24, 0.72], forward: [0.48, 0.96] },
  barStool: { across: [0.28, 0.72], forward: [0.56, 1] },
  nightstand: { across: [0.2, 0.8], forward: [0.04, 0.56] }, // (not a seat: its back to the wall, only as big as it's drawn)
};

// A seat's footprint within its tile, as tile fractions [x0, x1, z0, z1],
// its front turned toward `facing`.
function seatSpan(across: [number, number], forward: [number, number], [dx, dz]: [number, number]): [number, number, number, number] {
  const flip = ([a, b]: [number, number]): [number, number] => [1 - b, 1 - a];
  if (dz === 1) return [...across, ...forward];
  if (dz === -1) return [...flip(across), ...flip(forward)];
  if (dx === 1) return [...forward, ...flip(across)];
  return [...flip(forward), ...across];
}

const LEAF_HINGE = 6; // voxels in from the door's tile, where its leaf hangs (innFurnitureVoxels.ts DOOR_LEAF)
const LEAF_REACH = 0.52; // tiles out from its wall the leaf reaches, swung open
const DOORWAY = 0.36; // half an open door's passable width, from its middle (out to its posts: the walker's a squeeze through the leaf's own)

// Whether a walker of half-width r at (x, z) bumps into solid furniture.
export function bumpsFurniture(items: readonly Furniture[], x: number, z: number, r: number): boolean {
  const inset = 0.08; // pieces don't quite fill their tiles
  return items.some((f) => {
    if (!f.solid) return false;
    let [x0, x1, z0, z1] = [f.x - 0.5 + inset, f.x + f.w - 0.5 - inset, f.z - 0.5 + inset, f.z + f.d - 0.5 - inset];
    const slim = SLIM[f.kind];
    if (slim && f.wall === 'left') [x0, x1] = [f.x - 0.5 + slim[0], f.x - 0.5 + slim[1]];
    if (slim && f.wall !== 'left') [z0, z1] = [f.z - 0.5 + slim[0], f.z - 0.5 + slim[1]]; // back wall (or standing free: across z)
    const seat = PULLED_UP[f.kind];
    if (seat && f.facing) {
      const [a0, a1, b0, b1] = seatSpan(seat.across, seat.forward, f.facing);
      [x0, x1, z0, z1] = [f.x - 0.5 + a0, f.x - 0.5 + a1, f.z - 0.5 + b0, f.z - 0.5 + b1];
    }
    const hit = (a0: number, a1: number, b0: number, b1: number) => x + r > a0 && x - r < a1 && z + r > b0 && z - r < b1;
    if (f.open) {
      // An open door: through its doorway, but not the wall either side of it,
      // nor its leaf, swung out into the room (just clear of the doorway itself).
      const left = f.wall === 'left';
      const start = (left ? f.z : f.x) - 0.5;
      const len = left ? f.d : f.w;
      const mid = start + len / 2;
      const hinge = start + (Math.floor((len * 25 - 25) / 2) + LEAF_HINGE) / 25; // along the wall
      const face = (left ? f.x : f.z) - 0.5 + 0.1; // the wall's middle
      const [a0, a1, c0, c1] = [hinge - 0.15, hinge - 0.02, face + 0.1, face + LEAF_REACH]; // the swung leaf: along, then out
      return left
        ? hit(x0, x1, z0, mid - DOORWAY) || hit(x0, x1, mid + DOORWAY, z1) || hit(c0, c1, a0, a1)
        : hit(x0, mid - DOORWAY, z0, z1) || hit(mid + DOORWAY, x1, z0, z1) || hit(a0, a1, c0, c1);
    }
    return hit(x0, x1, z0, z1);
  });
}

// Where someone sits on a seat: the top of its seat (as drawn), a little
// toward its front, facing the way it faces. A bed is lain on instead: on
// the mattress, head on the pillow (by the headboard, at the low end along
// the wall), (x, z) then where the feet go and `facing` from head to feet.
export interface Seat {
  piece: Furniture;
  x: number;
  z: number;
  y: number; // the seat's top, where the hips rest (or the back, lying down)
  facing: number; // yaw, as the hero's facing (atan2(dx, dz))
  lying: boolean;
}

const MATTRESS = 0.24; // where a sleeper's back lies: a little under the blanket's top (0.32), so they're tucked in, face and chest above it
const HEAD_TO_FEET = 1.12; // from the headboard end of the bed to where the feet lie (the head a little clear of the headboard)

const SEATS: Partial<Record<FurnitureKind, { height: number; forward: number }>> = {
  chair: { height: 0.36, forward: 0.26 }, // forward enough that the head clears the chair's back
  armchair: { height: 0.32, forward: -0.05 }, // back against its backrest
  barStool: { height: 0.56, forward: 0.26 },
};

const OFF_WALL = 0.2; // tiles upstairs beds are drawn out from the wall they stand against (off its thickness)
const DOUBLE_SIDES = [0.7, 1.48]; // a double bed's two sleepers, each under a pillow, in tiles out from its wall's edge

// The seat on a piece of furniture, or null if it's not something to sit on;
// on a double bed, the side nearest `near` (the one standing by it).
export function seatOf(piece: Furniture, near?: { x: number; z: number }): Seat | null {
  if (piece.kind === 'bed' || piece.kind === 'roomBed' || piece.kind === 'doubleBed') {
    const alongZ = piece.wall === 'left';
    const far = piece.kind !== 'bed'; // upstairs, its head at its far end, against the wall there
    const start = (alongZ ? piece.z : piece.x) - 0.5;
    const feet = far ? start + (alongZ ? piece.d : piece.w) - HEAD_TO_FEET : start + HEAD_TO_FEET;
    const edge = (alongZ ? piece.x : piece.z) - 0.5; // its wall's side
    let across = edge + (alongZ ? piece.w : piece.d) / 2 + (piece.kind === 'roomBed' ? OFF_WALL : 0); // down its middle (upstairs, drawn off the wall)
    if (piece.kind === 'doubleBed') {
      const sides = DOUBLE_SIDES.map((s) => edge + s);
      const at = near ? (alongZ ? near.x : near.z) : sides[0];
      across = Math.abs(at - sides[0]) <= Math.abs(at - sides[1]) ? sides[0] : sides[1]; // the nearer side
    }
    return {
      piece,
      x: alongZ ? across : feet,
      z: alongZ ? feet : across,
      y: MATTRESS,
      facing: (alongZ ? 0 : Math.PI / 2) + (far ? Math.PI : 0),
      lying: true,
    };
  }
  const seat = SEATS[piece.kind];
  if (!seat || !piece.facing) return null;
  const [dx, dz] = piece.facing;
  return { piece, x: piece.x + dx * seat.forward, z: piece.z + dz * seat.forward, y: seat.height, facing: Math.atan2(dx, dz), lying: false };
}

// How far (x, z) is from a piece's tiles (0 on them).
export function distanceTo(piece: Furniture, x: number, z: number): number {
  const dx = Math.max(piece.x - 0.5 - x, 0, x - (piece.x + piece.w - 0.5));
  const dz = Math.max(piece.z - 0.5 - z, 0, z - (piece.z + piece.d - 0.5));
  return Math.hypot(dx, dz);
}
