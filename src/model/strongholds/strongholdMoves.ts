// How a bandit stronghold's foes fight, past what any foe does: THE SEAM
// between its run (strongholdFoes.ts: who stands where, the gate, the record
// of the slain, the chest, the way out) and their ways of fighting, put
// together here for a visit:
// - its packs' roles (strongholdPack.ts): a bruiser's smash, a crossbowman's
//   bolt, a firebrand's pot, a sawbones mending, a runner gone for the next
//   room, a war hound's lunge;
// - its four wings' bosses (strongholdBosses.ts) and its king
//   (strongholdKing.ts), each a fight in phases, told as it turns;
// - what each wing's boss leaves, slain: a piece of his own (strongholdLoot.ts);
// all played on one stage (strongholdStage.ts: told moves, blasts, burning
// ground, shots, walks), whose shots, marks, fires and bursts are the view's
// to draw (view/stronghold/strongholdMovesView.ts).
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
// of the hero (a crossbowman's range) are its ENEMY_STATS (model/constants.ts).

import type { Enemy, EnemyKind, Hero } from '../types';
import type { DungeonHooks } from '../dungeons/dungeonTypes';
import type { EnemyDirector } from '../enemies/enemyDirector';
import type { StrongholdPlan, StrongholdRoom, Wing } from './strongholdLayout';
import type { StrongholdProp } from './strongholdProps';
import { Stage } from './strongholdStage';
import { Pack } from './strongholdPack';
import { wingBosses } from './strongholdBosses';
import { King } from './strongholdKing';
import { bossPiece } from './strongholdLoot';

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

// Something loosed, in flight (a bolt, a fire pot): where it is, its heading (a unit vector), how far it's flown (a
// pot: how long, in seconds), what it is ('bolt', 'pot': the view's to draw by), who loosed it, the harm it does; a
// pot, how high along its arc (0..1).
export interface StrongholdShot {
  x: number;
  z: number;
  dx: number;
  dz: number;
  flown: number;
  kind: string;
  by: Enemy;
  damage: number;
  high?: number;
}

// What a told move shows on the floor before it lands: a ring round a spot, or a strip from one along a way; how far
// through its tell it is (`k`, 0..1), and what it is (its colour: a blow, fire, a shot's line, a hook's).
export type StrongholdMark = { tone: 'blow' | 'fire' | 'shot' | 'hook'; x: number; z: number; k: number } & ({ shape: 'ring'; r: number } | { shape: 'strip'; dx: number; dz: number; long: number; half: number });

// Ground burning (a pot's, a keg's, a brazier's coals): where, how wide, how long yet, whose doing.
export interface StrongholdFire {
  x: number;
  z: number;
  r: number;
  left: number;
  by: Enemy;
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

// A part of them (the packs' roles, a boss): run every frame, asked of the blows that are its own, told of the slain.
export interface StrongholdPart {
  update(dt: number): void;
  strike?(foe: Enemy): boolean;
  slain?(foe: Enemy): void;
}

// The moves of a visit: what the run calls, and what the view draws of them.
export interface StrongholdMoves {
  readonly shots: readonly StrongholdShot[]; // in flight
  readonly marks: readonly StrongholdMark[]; // told on the floor, this frame
  readonly fires: readonly StrongholdFire[]; // ground burning
  readonly bursts: ReadonlyArray<{ x: number; z: number; r: number; age: number }>; // blasts just burst (a moment each)
  update(dt: number): void;
  strike(foe: Enemy): boolean;
  slain(foe: Enemy): void;
}

// The packs' roles and the five bosses, on one stage.
class Moves implements StrongholdMoves {
  private readonly stage: Stage;
  private readonly parts: StrongholdPart[];

  constructor(private readonly fight: StrongholdFight) {
    this.stage = new Stage(fight);
    const pack = new Pack(this.stage);
    this.parts = [pack, ...wingBosses(this.stage, pack), ...(fight.king ? [new King(this.stage, fight.king)] : [])];
  }

  get shots() {
    return this.stage.shots;
  }
  get marks() {
    return this.stage.marks;
  }
  get fires() {
    return this.stage.fires;
  }
  get bursts() {
    return this.stage.bursts;
  }

  update(dt: number): void {
    for (const part of this.parts) part.update(dt);
    this.stage.update(dt);
  }

  strike(foe: Enemy): boolean {
    return this.parts.some((part) => part.strike?.(foe));
  }

  // One slain: its part told, what it set burning out; a wing's boss, the piece that's his alone left where he fell
  // (the king's is in his chest: strongholdFoes.ts).
  slain(foe: Enemy): void {
    for (const part of this.parts) part.slain?.(foe);
    this.stage.quench(foe);
    const piece = foe.kind === 'banditKing' ? null : bossPiece(foe.kind, this.fight.level);
    if (piece) this.fight.hooks.dropLoot(piece, foe.x - 0.25, foe.z + 0.2);
  }
}

export const strongholdMoves = (fight: StrongholdFight): StrongholdMoves => new Moves(fight);
