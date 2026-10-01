// A room at the inn: let by its barmaid (G, by her) from four in the
// afternoon till six in the morning, for ROOM_PRICE: the first small room off
// the hallway's back upstairs (letDoor), its door unlocked till ten the next
// morning; then locked again (the hero, if in it, shown out to the hallway).
// Out of hours, already let, or not enough coin: she says so. Kept in the
// save. Its bed slept in at night (G, by it): all health and energy back, up
// at eight the next morning.

import type { GameEvent, Hero } from '../types';
import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import type { Inside, Seated } from '../interiors/indoors';
import type { Seat } from '../interiors/furniture';
import { maxEnergyOf, maxHpOf } from '../hero/attributes';
import type { Npc } from '../npcs/npcs';
import { say } from '../npcs/speech';
import { roomsOff } from '../interiors/upstairs';

export const ROOM_PRICE = 50; // copper, a night
const LET_FROM = 16; // the hour rooms are let from
const LET_TILL = 6; // and till
const CHECK_OUT = 10; // the hour the next morning a room's to be left
const WAKE_AT = 8; // the hour slept till

// What she says: rooms not let yet (out of hours), one let already, one let just now; a different line each time.
export const LINES = {
  closed: [
    'Rooms are let from four in the afternoon. Come back later.',
    "The rooms are still being aired. Come back after four.",
    "Too early for a bed, love. Rooms are let from four.",
    "We're turning the beds over. Come back this afternoon.",
    "No rooms till four. Have a drink while you wait?",
    "The maid's still at the sheets. Four o'clock, come back then.",
    'Rooms go at four and not a minute before. Come back later.',
    "Sleeping in daylight? Not here. Come back at four.",
  ],
  taken: [
    "Your room's ready: up the stairs, the first door along the back.",
    "You've a room already. Up the stairs, first door on the back hall.",
    'Already yours, that room. Up the stairs, first door along the back.',
    "One room's enough for anyone. Yours is up the stairs, first on the back.",
    "Forgot already? Up the stairs, the first door along the back.",
  ],
  let: [
    'Up the stairs, the first door along the back. Till ten tomorrow.',
    "There you are. First door along the back hall upstairs. Out by ten, mind.",
    'Clean sheets and a candle. First door on the back hall, till ten tomorrow.',
    "It's yours till ten. Up the stairs, first door along the back.",
    'Sleep well. First door along the back upstairs, and out by ten.',
    "The quiet one's yours: first door along the back. Till ten in the morning.",
  ],
} as const;
let said = 0; // her lines taken in turn, from a different place each time
const line = (lines: readonly string[]): string => lines[(said++ * 5 + Math.floor(Date.now() / 1000)) % lines.length];

// Till when (game minutes) each inn's room is let, by the inn's door.
const lets = new WeakMap<Entrance, number>();
export const letUntil = (inn: Entrance): number | null => lets.get(inn) ?? null;
export const setLet = (inn: Entrance, until: number): void => void lets.set(inn, until);

// Whether rooms are let at `minutes` (four in the afternoon through to six in the morning).
export function lettingHours(minutes: number): boolean {
  const hour = Math.floor(minutes / 60) % 24;
  return hour >= LET_FROM || hour < LET_TILL;
}

// The next ten in the morning after `minutes`.
export function checkOutAfter(minutes: number): number {
  const day = 24 * 60;
  const ten = Math.floor(minutes / day) * day + CHECK_OUT * 60;
  return ten > minutes ? ten : ten + day;
}

// The room let: its door, the first along the hallway's back (a small room, a single bed in it).
export function letDoor(furniture: readonly Furniture[]): Furniture | null {
  const doors = furniture.filter((f) => f.kind === 'hallDoor' && f.wall === 'back');
  return doors.reduce<Furniture | null>((first, f) => (!first || f.x < first.x ? f : first), null);
}

// The floor upstairs just made: its let room's door unlocked, if it's let.
export function unlockLet(below: Entrance, furniture: readonly Furniture[]): void {
  const door = lets.has(below) ? letDoor(furniture) : null;
  if (door) door.locked = false;
}

// What the hero, by the barmaid, gets asking for a room: let (paid, the door unlocked till ten tomorrow), or told why not.
export function rentRoom(model: { hero: Hero; minutes: number; inside: Inside | null; report(event: GameEvent): void }, barmaid: Npc, purse?: { money: number }): 'let' | 'closed' | 'taken' | 'poor' {
  const inn = model.inside?.entrance;
  if (!inn) return 'closed';
  if (lets.has(inn)) {
    say(barmaid, line(LINES.taken));
    return 'taken';
  }
  if (!lettingHours(model.minutes)) {
    say(barmaid, line(LINES.closed));
    return 'closed';
  }
  if (model.hero.money < ROOM_PRICE) {
    model.report({ kind: 'poor', text: 'Not enough coin for a room' });
    return 'poor';
  }
  model.hero.money -= ROOM_PRICE;
  if (purse) purse.money += ROOM_PRICE; // (hers, the inn's)
  lets.set(inn, checkOutAfter(model.minutes));
  say(barmaid, line(LINES.let));
  return 'let';
}

// Whether the night's for sleeping at `minutes` (from when rooms are let till eight in the morning).
export function sleepingHours(minutes: number): boolean {
  const hour = Math.floor(minutes / 60) % 24;
  return hour >= LET_FROM || hour < WAKE_AT;
}

// The bed in the room let to the hero, if they're by it (or lying in it), it's theirs and it's the night: to sleep in.
export function letBed(model: { inside: Inside | null; seated: Seated; seatInReach: Seat | null; minutes: number }): Seat | null {
  const inside = model.inside;
  const seat = model.seated?.seat ?? model.seatInReach;
  if (!inside?.below || !seat?.lying || !lets.has(inside.below) || !sleepingHours(model.minutes)) return null;
  const door = letDoor(inside.furniture);
  const room = roomsOff(inside.furniture, inside.room).find((r) => door && r.doors.includes(door));
  return room?.tiles.some(([x, z]) => x === seat.piece.x && z === seat.piece.z) ? seat : null;
}

// A night's sleep in the let room's bed (lain in): all their health and energy back, and up at eight in the morning.
export function sleepTillMorning(model: { hero: Hero; minutes: number }): void {
  const day = 24 * 60;
  const eight = Math.floor(model.minutes / day) * day + WAKE_AT * 60;
  model.minutes = eight > model.minutes ? eight : eight + day;
  model.hero.hp = maxHpOf(model.hero);
  model.hero.energy = maxEnergyOf(model.hero);
}

// Rooms whose time is up let go: their doors locked again; the hero, upstairs in one, shown out to the hallway before it.
export function checkOut(model: { minutes: number; inside: Inside | null; hero: Hero }, inns: readonly Entrance[]): void {
  for (const inn of inns) {
    const until = lets.get(inn);
    if (until === undefined || model.minutes < until) continue;
    lets.delete(inn);
    const inside = model.inside;
    const door = inside?.below === inn ? letDoor(inside.furniture) : null;
    if (!door) continue;
    door.locked = true;
    door.open = false;
    const room = roomsOff(inside!.furniture, inside!.room).find((r) => r.doors.includes(door));
    const here = [Math.round(model.hero.x), Math.round(model.hero.z)];
    if (room?.tiles.some(([x, z]) => x === here[0] && z === here[1])) Object.assign(model.hero, { x: door.x - 0.5 + door.w / 2, z: door.z - 0.9 }); // (in it: out before its door)
  }
}
