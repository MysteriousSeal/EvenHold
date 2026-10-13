// How a bandit stronghold's foes fight, past what any foe does: THE SEAM
// between its run (strongholdFoes.ts: who stands where, the gate, the record
// of the slain, the chest, the way out) and their ways of fighting (here: the
// packs' roles, the bosses' phases). For now there are none: every one of them
// is run by the stronghold's own director (enemies/enemyDirector.ts) as a
// plain bandit is, a war hound as a wolf, and nothing here does a thing.
//
// The seam, for whoever gives them their ways (nothing else of the stronghold
// need be touched for it: not its run, its layout, nor the game's own files):
//
// - strongholdMoves(fight) is called once, as the hero comes in, and makes
//   the moves for that visit (a StrongholdMoves). Whatever it keeps is gone
//   when the hero leaves: what must outlast a visit is the run's (the slain).
// - update(dt), every frame, after the director has run every foe: start,
//   tell and land told moves (enemies/toldMoves.ts: ToldMoves, leap, rush, a
//   shape of your own; `fight.blocked` for what stops a rush), fly what's been
//   loosed (`fight.fly`, kept in `shots` for the view to draw), mend, call
//   for help, change a boss's phase by its health.
// - strike(foe), as a foe's plain blow is about to land (halfway through its
//   swing): true, and the blow is yours to deal (a crossbowman's a bolt
//   loosed rather than a cut: `fight.hooks.arrow`); false, and it lands as
//   any foe's does.
// - slain(foe), as one's slain (those called up mid-fight too): a pack's
//   left enraged, a boss's last gasp.
//
// What it's handed (StrongholdFight): the hero; every foe there (`foes`: the
// run's own list, the dying still in it a moment; never add to it but with
// `summon`); where each was posted and with whom (`placeOf`, `packOf`: a
// room's pack fights as one; a boss's guard is his pack); the bosses still
// standing (`bossOf`, `king`); the layout (`plan`: its rooms and wings,
// `roomAt`; `props`: what stands where, the kennels to loose hounds from, the
// kegs to set alight); the hooks on the game (`hooks`: blows, knocks, what's
// told: a `banner` event shows any words large); the director (`director.move`
// walks a foe with collisions, `director.inView` asks a line of sight); and
// `summon`, for adds: ids from SUMMONED up (dungeons/dungeonRecord.ts), never
// counted toward clearing the place nor kept in the save.
//
// How long each takes over a blow, how far it sees and where it stops short
// of the hero (a crossbowman's range) are its ENEMY_STATS (model/constants.ts):
// a first pass, to be tuned with its ways.

import type { Enemy, EnemyKind, Hero } from '../types';
import type { DungeonHooks } from '../dungeons/dungeonTypes';
import type { EnemyDirector } from '../enemies/enemyDirector';
import type { StrongholdPlan, StrongholdRoom, Wing } from './strongholdLayout';
import type { StrongholdProp } from './strongholdProps';

// Where a foe was posted: its spot, what it is, which of the plan's rooms (its place in plan.rooms), which pack (the
// packs numbered from 0, a room's guard and its boss one pack), and its post's number in the record of the slain.
export interface StrongholdPost {
  x: number;
  z: number;
  kind: EnemyKind;
  room: number;
  pack: number;
  post: number;
}

// Something loosed, in flight (a bolt, a firebomb): where it is, its heading (a unit vector), how far it's flown,
// what it is (the view's to draw by), who loosed it, the harm it does.
export interface StrongholdShot {
  x: number;
  z: number;
  dx: number;
  dz: number;
  flown: number;
  kind: string;
  by: Enemy;
  damage: number;
}

// What a stronghold's run hands its foes' moves.
export interface StrongholdFight {
  readonly hero: Hero;
  readonly foes: readonly Enemy[]; // every foe there (the dying too, a moment)
  readonly hooks: DungeonHooks; // what they do to the game
  readonly director: EnemyDirector; // who runs them
  readonly plan: StrongholdPlan;
  readonly props: readonly StrongholdProp[];
  readonly name: string; // the stronghold's
  readonly level: number;
  readonly king: Enemy | null; // standing (null once slain)
  readonly gateShut: boolean; // the great hall's
  bossOf(wing: Wing): Enemy | null; // a wing's, standing (null once slain)
  roomAt(x: number, z: number): StrongholdRoom | null;
  placeOf(foe: Enemy): StrongholdPost | null; // where it was posted (one called up mid-fight: where whoever called it was, or null)
  packOf(foe: Enemy): Enemy[]; // those of its pack still standing, itself among them
  blocked(x: number, z: number, r: number): boolean; // whether a walker of half-width r would be in the rock, something solid, or the gate shut
  // An add of `kind` at (x, z) (or the nearest spot it could stand), set on the hero; `by`: who called it (it fights as
  // one of their pack). Null if there's nowhere near to stand.
  summon(kind: EnemyKind, x: number, z: number, by?: Enemy): Enemy | null;
  // A shot on along its way, in short steps: `strike` once it reaches the hero; true once it's done (struck, flown its
  // range, or stopped by the rock or what stands solid).
  fly(shot: Pick<StrongholdShot, 'x' | 'z' | 'dx' | 'dz' | 'flown'>, how: { speed: number; hit: number; range: number }, dt: number, strike: () => void): boolean;
}

// The moves of a visit: what the run calls, and what the view draws of them.
export interface StrongholdMoves {
  readonly shots: readonly StrongholdShot[]; // in flight
  update(dt: number): void;
  strike(foe: Enemy): boolean;
  slain(foe: Enemy): void;
}

// Plain bandits, all of them: nothing loosed, nothing told, every blow landing as any foe's.
class PlainMoves implements StrongholdMoves {
  readonly shots: StrongholdShot[] = [];

  constructor(protected readonly fight: StrongholdFight) {}

  update(_dt: number): void {}

  strike(_foe: Enemy): boolean {
    return false;
  }

  slain(_foe: Enemy): void {}
}

export const strongholdMoves = (fight: StrongholdFight): StrongholdMoves => new PlainMoves(fight);
