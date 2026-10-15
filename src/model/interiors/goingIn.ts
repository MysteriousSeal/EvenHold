// The hero going in and out (GameModel's): through a door, onto a room's floor or down into a dungeon, and out again;
// walking the room; sat down and up again; moved straight somewhere (outdoors); off to the furniture yard and back.
import { INDOOR_HERO_SPEED } from '../constants';
import { bumpsEnemy } from '../enemies/enemies';
import { maxHpOf } from '../hero/attributes';
import { intoBed } from '../hero/setbacks';
import { bumpsNpc } from '../npcs/npcs';
import { dungeonAt, dungeonBarred, dungeonBlocks, dungeonRun, dungeonWalls } from '../dungeons/dungeons';
import { goesUnder } from '../dungeons/dungeonTypes';
import { hashCell } from '../../util/random';
import { dungeonHooks } from '../hero/fighting';
import { benchSeatInReach, squareBenches } from '../worldgen/benches';
import type { GameModel } from '../GameModel';
import type { Seat } from './furniture';
import { toggleYard } from './furnitureYard';
import type { Entrance } from './interiors';
import { layoutOf, seatInReach as roomSeatInReach, sitDown, standUp, walkInside } from './indoors';

// Moves the hero straight to (x, z), standing on the ground there
// (outdoors, leaving any room they were in, a dungeon's too: its run over, its foes no more about).
export function teleport(m: GameModel, x: number, z: number): void {
  m.inside = null;
  m.below = null;
  m.yard = null;
  m.outdoors.seated = null;
  m.makeAround(x, z); // (a streamed world's ground there made first, if it isn't)
  m.hero.x = x;
  m.hero.z = z;
  m.hero.y = m.getGroundY(x, z);
  m.hop = null;
}

// Dev cheat: the flat grass yard, or back to where the hero was.
export function toggleFurnitureYard(m: GameModel): string {
  m.hop = null;
  m.focus(null);
  return toggleYard(m);
}

// Goes through the door in reach: in, onto the room's floor just inside
// it; or out, onto the spot outside it, facing away. Returns whether it did.
export function useDoor(m: GameModel): boolean {
  const entrance = m.work.shift ? null : m.doorInReach; // (at work: no leaving, the shift's to be ended at the notice board)
  if (!entrance) return false;
  const { hero } = m;
  m.hop = null;
  if (m.inside) {
    m.inside = null;
    m.below = null;
    hero.x = entrance.x;
    hero.z = entrance.z;
    hero.y = m.getGroundY(hero.x, hero.z);
    hero.facing = Math.atan2(entrance.outX, entrance.outZ);
    return true;
  }
  const barred = dungeonBarred(entrance); // (a way down barred: told why, not gone down)
  if (barred) return m.events.push({ kind: 'banner', ...barred }), false;
  enterRoom(m, entrance);
  return true;
}

// In through a building's door, onto the floor just inside it, facing in.
export function enterRoom(m: GameModel, entrance: Entrance): void {
  m.yard = null;
  const { room, furniture } = layoutOf(m.seed, entrance);
  const place = goesUnder(entrance) ? dungeonAt(entrance) : null; // (down into a dungeon: its own floor for what its foes leave)
  m.inside = { entrance, room, furniture, seated: null, ...(place && { walls: dungeonWalls(dungeonBlocks(m.seed, entrance), () => m.below?.run), exitAt: () => m.below?.run.exitOpen ?? null }) };
  if (place) m.events.push({ kind: 'arrive', name: place.name, level: place.level }); // (its name and level, as the hero comes down)
  if (place && m.clearedShare(entrance) === 1) m.events.push({ kind: 'banner', title: place.name, line: `Level ${place.level} · cleared: its foes slain for good` }); // (told over its arrival: none here to rise again, dungeons/dungeonRecord.ts)
  m.below = place && { key: place.key, run: dungeonRun(m.seed, entrance, m.cleared(place.key), m.hero, dungeonHooks(m)), ground: m.floors.of(place.key), salt: hashCell([...place.key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7), Math.floor(m.minutes), m.seed) }; // (its foes' drops rolled with the dungeon and the time down: hero/fighting.ts)
  m.outdoors.seated = null;
  if (entrance.type === 'inn') m.lastInn = entrance; // to wake in, after a fall
  m.focus(null);
  m.hop = null;
  Object.assign(m.hero, { x: room.door, z: room.depth - 1, y: 0, facing: Math.PI }); // into the room (-Z)
}

// Indoors: the hero walks the room's floor (getting up first if seated);
// out only through the door, with E (useDoor).
export function moveInside(m: GameModel, dirX: number, dirZ: number, dt: number): void {
  const inside = m.inside!;
  if (Math.hypot(dirX, dirZ) < 1e-6) return;
  standUp(inside, m.hero);
  const bumps = (x: number, z: number, r: number) => bumpsNpc(m.folk, inside.entrance, m.hero, x, z, r) || (!!m.below && bumpsEnemy(m.below.run.foes, m.hero, x, z, r));
  walkInside(inside, m.hero, dirX, dirZ, INDOOR_HERO_SPEED * m.pace * dt, bumps); // (out only with E at the door)
}

// The free seat the hero could sit on right now (in the room, or a bench's), or null (seated).
export function seatInReach(m: GameModel): Seat | null {
  if (m.yard) return null;
  const taken = (piece: Seat['piece']) => m.folk.some((n) => n.seat?.piece === piece); // (those round about: the world's every villager gone through for each seat, each frame, cost a frame indoors)
  if (m.inside) return roomSeatInReach(m.inside, m.hero, taken);
  return m.outdoors.seated ? null : benchSeatInReach(squareBenches(m), m.hero, (seat) => taken(seat.piece)); // the squares' benches
}

// Sits down on the seat in reach, or gets up if seated; returns whether either happened.
export function sitOrStand(m: GameModel): boolean {
  if (m.work.shift && !m.seated) return false; // (at work: no sitting down)
  const at = m.inside ?? m.outdoors;
  if (at.seated) {
    standUp(at, m.hero, m.inside ? 0 : m.getGroundY(at.seated.from.x, at.seated.from.z));
    return true;
  }
  const seat = m.seatInReach;
  if (seat) sitDown(at, m.hero, seat);
  if (seat?.lying && (intoBed(m), m.seated) && m.hero.hp < maxHpOf(m.hero)) m.report({ kind: 'mending' }); // (someone else's bed, its owner home: turned out of it, hero/setbacks.ts; else, hurt: told it mends)
  return !!seat;
}
