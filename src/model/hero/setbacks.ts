// The hero's setbacks, each waking them at an inn, Weary a while (blessing.ts):
// out of energy, they collapse, and wake in the nearest inn lying on the floor
// before its hearth (on its bear rug), a little of their energy back and more
// coming while they lie there (E to get up); out of health, they fall, half
// their coin dropped where they fell (purse.ts: theirs again, walked back to), and wake in the last inn they entered
// (or at spawn, before any), healed. A bed in someone else's house (a villager's, the herbalist's) isn't theirs to rest in: its
// owner home, found in it, turns them out; away, it rests them only as a bedroll would (and no Well rested: an inn's
// room, paid for, gives that).

import { wearOnFall } from './wear';
import { dropPurse } from './purse';
import type { GameModel } from '../GameModel';
import { recover } from './heroStats';
import { maxEnergyOf, maxHpOf } from './attributes';
import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import { bumpsFurniture, type Furniture } from '../interiors/furniture';
import { sitDown, standUp, type Seated } from '../interiors/indoors';
import type { Npc } from '../npcs/npcs';
import type { Enemy } from '../types';
import { inTurn, say } from '../npcs/speech';
import { herbalistAbed } from '../herbalist/herbalistWork';
import { witchAbed } from '../witch/witchWork';
import { makeWeary } from './blessing';
import { spawnOf } from '../map/grid';
import { ownsHere } from '../homestead/cottage';

const WAKE_ENERGY = 0.3; // of their most energy: what they wake with
const FLOOR = 0.06; // lying on the rug, just over the floor
export const BEDROLL_REST = 0.5; // how well they sleep on a bedroll, to a bed's 1 (lieOnBedroll)
const BEDROLL_Y = 0.12; // where their back lies on a bedroll, over the ground

// The bedroll unrolled where they stand (outdoors, on open ground, not at work nor chopping), and lain down on: as a
// bed, they rest and mend (slower, on the ground: BEDROLL_REST), the foes still about. Up again as they walk, or with
// E. Whether they did.
export function lieOnBedroll(model: GameModel): boolean {
  const { hero } = model;
  if (model.inside || model.yard || model.outdoors.seated || model.work.shift || !(hero.bag.bedroll ?? 0)) return false;
  model.lumber.stop();
  model.mining.stop();
  model.woodworking.stop();
  const piece: Furniture = { kind: 'bedroll', x: Math.round(hero.x), z: Math.round(hero.z), w: 1, d: 1, wall: 'none', solid: false };
  sitDown(model.outdoors, hero, { piece, x: hero.x, z: hero.z, y: model.getGroundY(hero.x, hero.z) + BEDROLL_Y, facing: hero.facing, lying: true });
  model.report({ kind: 'mending' });
  return true;
}

// The hero's timers and energy over `dt` (recover: lying down, it comes
// back; sat down, it's kept), then collapsing if it's run out; returns whether they did.
export function liveOn(model: GameModel, dt: number): boolean {
  const owned = ownedBed(model);
  if (owned) {
    const was = ownerSeen.get(owned.seated);
    ownerSeen.set(owned.seated, !!owned.owner);
    if (owned.owner && was === false) turnOut(model, owned.owner); // (home, and found them in it)
  }
  const seat = (model.inside ? model.inside.seated : model.outdoors.seated)?.seat;
  recover(model.hero, dt, !!seat?.lying, !!seat && !seat.lying, seat?.piece.kind === 'bedroll' || owned ? BEDROLL_REST : 1); // (on a bedroll, on the ground, or in another's bed: slower)
  return collapseIfSpent(model);
}

// What the owner of a bed says, finding the hero in it.
export const NOT_YOURS: readonly string[] = [
  'Oi! Out of my bed!',
  "That's my bed you're in. Out, before I fetch a stick.",
  'Who the hell are you? Get out of my bed!',
  "I don't care how tired you are. Out!",
  'Pay for a room at the inn like everyone else. Out of my bed.',
  "You've got some nerve. Up, and out of it.",
];

// Each lying in someone else's bed, whether its owner was home when last looked (the hero laid there with them home,
// a night of a quest's: their guest, not turned out).
const ownerSeen = new WeakMap<NonNullable<Seated>, boolean>();

// The hero lying in a bed in someone else's house: how they lie, and its owner, if home (a herbalist, always home:
// only once it's their bedtime, herbalist/herbalistWork.ts; at their work all day, as good as away).
function ownedBed(model: GameModel): { seated: NonNullable<Seated>; owner: Npc | null } | null {
  const inside = model.inside;
  const seated = inside?.seated;
  if (!inside || inside.below || !seated?.seat.lying || seated.seat.piece.kind !== 'bed' || ownsHere(model.hero, inside.entrance)) return null; // (an inn's beds upstairs: its rooms'; the hero's own, at home)
  return { seated, owner: model.folk.find((n) => n.home === inside.entrance && n.where === inside.entrance && (n.role === 'herbalist' ? herbalistAbed(model.minutes) : n.role !== 'witch' || witchAbed(model.minutes))) ?? null };
}

// The owner's word, and the hero up out of their bed.
function turnOut(model: GameModel, owner: Npc): void {
  say(owner, inTurn(owner, NOT_YOURS));
  standUp(model.inside!, model.hero);
}

// The hero just lain down (GameModel sitOrStand): in someone else's bed, its owner home, turned out at once.
export function intoBed(model: GameModel): void {
  const owned = ownedBed(model);
  if (owned?.owner) turnOut(model, owned.owner);
  else if (owned) ownerSeen.set(owned.seated, false);
}

// Collapses the hero if their energy's run out (not while asleep in a bed); returns whether they did.
function collapseIfSpent(model: GameModel): boolean {
  const { hero } = model;
  if (hero.energy > 0 || model.inside?.seated?.seat.lying) return false;
  const here = model.inside ? (model.inside.below ?? model.inside.entrance) : hero;
  const inns = model.entrances.filter((e) => e.type === 'inn');
  const inn = inns.reduce<(typeof inns)[number] | null>((best, e) => (!best || Math.hypot(e.x - here.x, e.z - here.z) < Math.hypot(best.x - here.x, best.z - here.z) ? e : best), null);
  hero.energy = maxEnergyOf(hero) * WAKE_ENERGY;
  makeWeary(hero);
  if (!inn) return true;
  model.enterRoom(inn);
  const inside = model.inside!;
  const hearth = inside.furniture.find((f) => f.kind === 'hearth');
  if (!hearth) return true;
  const rug = inside.furniture.find((f) => f.kind === 'bearRug') ?? hearth;
  const at = { x: hearth.x + hearth.w / 2 - 0.5, z: hearth.z + 1.2 }; // before the fire, along it
  // Up again on the spot (the rug, before the fire, clear of the armchairs round it), or beside it if that's taken.
  const r = HERO_RADIUS * INDOOR_SCALE;
  const up = [0, -0.6, 0.6, -1.2, 1.2].map((dx) => ({ x: at.x + dx, z: at.z })).find((p) => !bumpsFurniture(inside.furniture, p.x, p.z, r)) ?? at;
  inside.seated = { seat: { piece: rug, x: at.x, z: at.z, y: FLOOR, facing: Math.PI / 2, lying: true }, from: up };
  Object.assign(hero, { x: at.x, z: at.z, y: FLOOR, facing: Math.PI / 2 });
  return true;
}

// Fallen (out of health): half their coin dropped in a purse where they fell (purse.ts: the last one, if still lying
// there, lost), they wake in the last inn they entered (or at spawn, before any), healed but Weary; the foes lose
// interest. (A tenth was lost for good before, a hundred copper at most.)
export function fall(model: GameModel, by?: Enemy | null): void {
  const { hero } = model;
  if (by?.kind === 'witchFinder' && model.roads.takenFallen()) return; // (felled by the witch-finders: to the stocks, roads/arrest.ts)
  dropPurse(model);
  wearOnFall(hero, (e) => model.report(e)); // (everything they wear knocked about: hero/wear.ts)
  makeWeary(hero);
  [hero.knock, hero.y, model.moves.roll, model.moves.guard] = [undefined, 0, null, null]; // (no knock nor roll still carrying them, waking)
  const spawn = spawnOf(model.size);
  if (model.lastInn) model.enterRoom(model.lastInn);
  else model.teleport(spawn.x, spawn.z);
  hero.hp = maxHpOf(hero);
  for (const e of model.enemies) if (e.state === 'chase') e.state = 'wander';
}
