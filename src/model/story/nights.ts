// A night spent with someone (a quest that ends in one: story.ts `sleep`): where the hero wakes. In that person's
// own place, in its bed, whoever it is stood beside it: the herbalist's house; the smithy (no bed there: by the
// forge); for someone of the inn (its bouncer), the room let upstairs, theirs till ten that morning. Whoever it is
// goes back to their day as the talk ends: from upstairs, out by the room's door (opened), along the hallway and
// down the stairs, on foot.
import { checkOutAfter, letDoor, letRoomBed, setLet } from '../inn/roomLetting';
import type { Furniture } from '../interiors/furniture';
import { layIn, standingBy, wayOver, type Inside } from '../interiors/indoors';
import type { Entrance } from '../interiors/interiors';
import { stairsOf, upstairsInside } from '../interiors/upstairs';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { Hero } from '../types';
import { far } from './storyCast';

export interface NightHost {
  readonly hero: Hero;
  inside: Inside | null;
  readonly seed: number;
  readonly fullWalls: boolean;
  readonly minutes: number;
  enterRoom(entrance: Entrance): void;
}

const LINGER = 0.6; // seconds they stay by the hero once the talk's over (the game's held while it's told), before their day takes them
const BEDS: ReadonlySet<Furniture['kind']> = new Set<Furniture['kind']>(['bed', 'roomBed', 'doubleBed']);
const BY: ReadonlyArray<Furniture['kind']> = ['forge', 'hearth']; // (no bed: where they'd have sat up)
const middle = (f: Furniture) => ({ x: f.x + (f.w - 1) / 2, z: f.z + (f.d - 1) / 2 });

// The hero and `who`, woken together in `who`'s place (see above); false where there's no standing room for it.
export function wakeWith(model: NightHost, who: Npc): boolean {
  const home = who.home;
  if (model.inside?.entrance !== home || model.inside.below) model.enterRoom(home);
  let inside = model.inside!;
  inside.seated = null; // (up off whatever they sat on)
  let where: Entrance = home;
  let within: Array<[number, number]> | undefined;
  const stairs = home.type === 'inn' ? stairsOf(inside) : undefined;
  if (stairs) {
    // The inn: its room upstairs, let till ten (no charge), its door unlocked.
    setLet(home, checkOutAfter(model.minutes));
    inside = model.inside = upstairsInside(home, inside.room, stairs, model.seed, model.fullWalls);
    where = inside.entrance;
    within = letRoomBed(inside)?.tiles;
  }
  const centre = within?.length ? { x: within.reduce((s, t) => s + t[0], 0) / within.length, z: within.reduce((s, t) => s + t[1], 0) / within.length } : null;
  const beds = inside.furniture.filter((f) => BEDS.has(f.kind));
  const bed = centre ? beds.sort((a, b) => far(middle(a), centre) - far(middle(b), centre))[0] : beds[0];
  const by = bed ?? inside.furniture.find((f) => BY.includes(f.kind));
  const spots = standingBy(inside, by ? middle(by) : (centre ?? { x: inside.room.door, z: inside.room.depth - 1 }), within);
  const mine = spots[0];
  const theirs = mine && spots.slice(1).sort((a, b) => far(a, mine) - far(b, mine))[0];
  if (!mine || !theirs) return false;
  const facing = (from: { x: number; z: number }, to: { x: number; z: number }) => Math.atan2(to.x - from.x, to.z - from.z);
  Object.assign(model.hero, { x: mine.x, z: mine.z, y: 0, facing: facing(mine, theirs) });
  if (bed) layIn(inside, model.hero, bed, mine); // (woken in it; up, onto that spot beside it)
  const back = { where: who.where, x: who.x, z: who.z }; // (someone of the inn: back to their post after)
  Object.assign(who, { where, x: theirs.x, z: theirs.z, y: 0, facing: facing(theirs, mine), seat: null, stood: null, path: null, waited: 0, moving: false });
  who.steps = [{ kind: 'wait', for: LINGER }];
  if (stairs) {
    // Back down: the room's door opened, the way to the head of the stairs walked, then at their foot below.
    const door = letDoor(inside.furniture);
    const was = door?.open;
    if (door) door.open = true; // (the way worked out with it open, as it will be)
    const way = wayOver(inside, theirs, { x: stairs.x, z: stairs.z - 1 });
    if (door) door.open = was;
    const down = { where: home, x: stairs.x + stairs.w, z: stairs.z };
    const leave: NpcStep[] = [{ kind: 'hand', then: () => void (door && (door.open = true)) }, ...(way ? [{ kind: 'along' as const, path: way }] : []), { kind: 'hand', then: () => void Object.assign(who, back.where === home ? back : down) }];
    who.steps.push(...leave);
  }
  return true;
}
