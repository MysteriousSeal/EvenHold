// The wild beasts' told moves (toldMoves.ts: shown before they land), out in
// the world (GameModel runs them with its foes):
// - a brown bear rears up on its hind legs, roaring (a ring on the ground
//   round it), then slams down: whoever's still in it hurt, knocked away;
// - hurt, it charges, clumsily: lowering its head, pawing, then a rush down a
//   strip at the hero (stopped short of anything in the way), bowling them back;
// - a lynx, from a few tiles off, pounces: crouched, its eyes on the hero,
//   then a leap at where they stood, its bite where it lands.
// The leap and the rush built as any (toldMoves.ts); the blows land through the
// dungeons' own hooks (hero/fighting.ts: dungeonHooks).

import type { Enemy, Hero } from '../types';
import { ToldMoves, knockAway, leap, rush, type ToldMove } from './toldMoves';
import type { DungeonHooks } from '../dungeons/dungeonTypes';

export const SLAM_TELL = 1.0;
export const SLAM_RADIUS = 1.3; // tiles round the bear its slam reaches
const SLAM_KNOCK = 0.9;
export const CHARGE_TELL = 0.85;
const CHARGE_TIME = 0.55;
export const CHARGE_LONG = 4.5;
export const CHARGE_HALF = 0.42; // half its strip's width
const CHARGE_KNOCK = 1.7;
const HURT_TO_CHARGE = 0.65; // of its health, under it: it charges
export const POUNCE_TELL = 0.5;
const POUNCE_TIME = 0.28;
export const POUNCE_LONG = 4.2;
const POUNCE_BITE = 0.6; // tiles from where it lands it bites
const POUNCE_KNOCK = 0.5;

export const BEAR_SLAM: ToldMove = {
  told: 'slam',
  by: 'bear',
  tell: SLAM_TELL,
  after: 0.5,
  every: 7,
  first: 2.5,
  near: 1.8,
  staunch: true,
  hits: (m, hero) => Math.hypot(hero.x - m.x, hero.z - m.z) < SLAM_RADIUS,
};

// Its charge (once it's hurt): a rush down a strip at the hero, stopped short of what's in the way.
export const bearCharge = (blocked: (x: number, z: number) => boolean): ToldMove =>
  rush({ told: 'charge', by: 'bear', tell: CHARGE_TELL, after: CHARGE_TIME + 0.5, every: 9, first: 1, near: 6, far: 2.4, staunch: true }, blocked, { long: CHARGE_LONG, time: CHARGE_TIME, half: CHARGE_HALF });

// A lynx's pounce: from a few tiles off (at once, its ambush), a leap at the hero, its bite where it lands.
export const lynxPounce = (blocked: (x: number, z: number) => boolean): ToldMove =>
  leap({ told: 'lunge', by: 'lynx', tell: POUNCE_TELL, after: POUNCE_TIME + 0.35, every: 5, first: 0.3, near: 4, far: 1.4 }, blocked, { reach: POUNCE_LONG, time: POUNCE_TIME, bite: POUNCE_BITE });

// The wild beasts' moves, run over the world's foes each frame.
export class WildMoves {
  readonly slams: ToldMoves;
  readonly charges: ToldMoves;
  readonly pounces: ToldMoves;

  constructor(
    private readonly foes: () => readonly Enemy[], // (those round the hero: no move's started, told or landed further off)
    private readonly hero: Hero,
    blocked: (x: number, z: number) => boolean,
    hooks: () => DungeonHooks,
  ) {
    this.slams = new ToldMoves(BEAR_SLAM, (bear, m) => hooks().blow(bear, Math.round(bear.damage * 1.5), knockAway(m, this.hero, SLAM_KNOCK)));
    this.charges = new ToldMoves(bearCharge(blocked), (bear, m) => hooks().blow(bear, Math.round(bear.damage * 1.3), { dx: m.dx * CHARGE_KNOCK, dz: m.dz * CHARGE_KNOCK }));
    this.pounces = new ToldMoves(lynxPounce(blocked), (lynx, m) => hooks().blow(lynx, Math.round(lynx.damage * 1.5), { dx: m.dx * POUNCE_KNOCK, dz: m.dz * POUNCE_KNOCK }));
  }

  update(dt: number): void {
    const moves = [this.slams, this.charges, this.pounces];
    for (const told of moves) {
      // One at a time; a bear charges only once it's hurt.
      told.update(this.foes(), this.hero, dt, (foe) => moves.some((other) => other !== told && other.doing(foe)) || (told === this.charges && foe.hp > foe.maxHp * HURT_TO_CHARGE));
    }
  }
}
