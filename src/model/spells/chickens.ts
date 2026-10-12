// Someone turned into a chicken (spells.ts: a charm for anyone, cast at whoever's picked out): a foe, a villager or
// keeper, someone on the road; never a boss, nor anyone only passing through. For a while they're a chicken and
// nothing else: wandering aimlessly, never more than ROAM tiles from where they were turned, a few steps and a
// peck; a foe leaves off the fight (and takes what harm comes, a chicken still), a villager their day (no word to be
// had, no trade), a traveller their road. One at a time: another turned, the first is back. Back as they were when it
// runs out, or they die; a foe wary again, a villager on with their day from where they stand, a traveller on their
// road. Turned there and then, as the game goes ('transformed' told: how it happens, part by part, is the view's to
// play while the game stands still, view/cinema/). Turning back at the end takes a moment (TURNING seconds): stood
// where they are meanwhile, part one thing and part the other (`morphOf`: the view's to draw,
// wildlife/chickenMorph.ts); told once they're back ('puff').
import { isBoss } from '../enemies/enemyLevels';
import type { Entrance } from '../interiors/interiors';
import type { Point } from '../map/obstacles';
import type { Npc } from '../npcs/npcs';
import { roomFree } from '../npcs/npcWalk';
import type { Traveller } from '../travellers/travellers';
import type { Enemy, GameEvent } from '../types';

export const ROAM = 5; // tiles from where they were turned, at most
export const TURNING = 1.8; // seconds turning back takes, at the end
const PACE = 0.55; // tiles a second, strutting
const PECK: [number, number] = [0.6, 2.2]; // seconds stood pecking between strolls
const ARRIVED = 0.08;

export interface Chickened {
  left: number; // seconds more
  age: number; // seconds since they were turned
  from: Point; // where they were turned
  to: Point | null; // where they're strutting to, if anywhere
  peck: number; // seconds more stood pecking
  facing: number; // the way they strut
}
export type Being = Enemy | Npc | Traveller;
const isFoe = (being: Being): being is Enemy => 'kind' in being;
const isNpc = (being: Being): being is Npc => 'home' in being;

export interface ChickenHost {
  readonly seed: number;
  readonly hero: Point;
  readonly inside: { entrance: Entrance } | null;
  readonly dungeon: { free(x: number, z: number, r: number): boolean } | null;
  random(): number;
  isOpenTile(x: number, z: number): boolean;
  getGroundY(x: number, z: number): number;
  report(event: GameEvent): void;
}

// Whether `being` may be turned: living, no boss, not someone only passing through (led: not theirs to wander).
// (A boss: a dungeon's, and a camp's chief, who's one in all but the name.)
const boss = (foe: Enemy): boolean => isBoss(foe.kind) || foe.kind === 'banditChief';
export const mayTurn = (being: Being): boolean => (isFoe(being) ? being.state !== 'dead' && !being.buried && !boss(being) : !(isNpc(being) && being.led));

// How far turned they are: 0 themselves, 1 all chicken; rising as they're turned, falling again at the end.
export const morphOf = (state: Pick<Chickened, 'left' | 'age'>): number => Math.max(0, Math.min(1, state.age / TURNING, state.left / TURNING));

export class Chickens {
  current: Being | null = null;

  constructor(private readonly host: ChickenHost) {}

  // Turned, for `seconds`: whether they were (the one before them back as they were).
  turn(being: Being, seconds: number): boolean {
    if (!mayTurn(being)) return false;
    if (this.current && this.current !== being) this.back(this.current);
    being.chicken = { left: seconds, age: TURNING, from: { x: being.x, z: being.z }, to: null, peck: PECK[0], facing: isFoe(being) ? 0 : being.facing };
    // (Whatever they were at, let go: a foe's blow and its fight, a villager's seat and errand.)
    if (isFoe(being)) Object.assign(being, { swingFor: null, windUp: null, told: null, state: 'idle' });
    else if (isNpc(being)) Object.assign(being, { seat: null, stood: null, steps: [], path: null, waited: 0, working: false, moving: false });
    this.current = being;
    this.host.report({ kind: 'transformed', who: being, into: 'chicken' });
    return true;
  }

  // A moment on: their time running down, a few steps and a peck; back as they were, once it's out (or they're dead).
  update(dt: number): void {
    const being = this.current;
    const state = being?.chicken;
    if (!being || !state) return void (this.current = null);
    state.left -= dt;
    if (state.left <= 0 || (isFoe(being) && being.state === 'dead')) return this.back(being);
    if (isFoe(being)) Object.assign(being, { swingFor: null, windUp: null, told: null }); // (no blow of its own under way)
    state.age += dt;
    if (morphOf(state) < 1) return; // (turning, or turning back: stood where they are)
    if (state.peck > 0) return void (state.peck -= dt);
    const { host } = this;
    if (!state.to) {
      // Somewhere within reach of where they were turned, any way round.
      const [angle, far] = [host.random() * Math.PI * 2, host.random() * ROAM];
      state.to = { x: state.from.x + Math.sin(angle) * far, z: state.from.z + Math.cos(angle) * far };
    }
    const [dx, dz] = [state.to.x - being.x, state.to.z - being.z];
    const left = Math.hypot(dx, dz);
    const step = Math.min(left, PACE * dt);
    const [x, z] = left > 1e-6 ? [being.x + (dx / left) * step, being.z + (dz / left) * step] : [being.x, being.z];
    if (left <= ARRIVED || !this.free(being, x, z)) {
      [state.to, state.peck] = [null, PECK[0] + host.random() * (PECK[1] - PECK[0])]; // there, or the way shut: a peck, then elsewhere
      return;
    }
    [being.x, being.z, state.facing] = [x, z, Math.atan2(dx, dz)];
    if (!isFoe(being)) being.facing = state.facing;
    if (!this.indoors(being)) being.y = host.getGroundY(x, z);
  }

  // Whether the one turned is where the hero is (to be drawn): down in the dungeon with them, in their room, or out of doors.
  get here(): Being | null {
    const being = this.current;
    if (!being?.chicken) return null;
    if (isFoe(being)) return being;
    return being.where === (this.host.inside?.entrance ?? null) ? being : null;
  }

  private indoors = (being: Being): boolean => (isFoe(being) ? !!this.host.dungeon : being.where !== null);

  // Whether a chicken could stand at (x, z): open ground there (a room's floor, a dungeon's), and not on the hero.
  private free(being: Being, x: number, z: number): boolean {
    const { host } = this;
    if (Math.hypot(x - host.hero.x, z - host.hero.z) < 0.3 && (isFoe(being) || being.where === (host.inside?.entrance ?? null))) return false;
    if (isFoe(being)) return host.dungeon ? host.dungeon.free(x, z, 0.12) : host.isOpenTile(Math.round(x), Math.round(z));
    return being.where ? roomFree(host.seed, being.where)(x, z) : host.isOpenTile(Math.round(x), Math.round(z));
  }

  private back(being: Being): void {
    delete being.chicken;
    if (this.current === being) this.current = null;
    if (isFoe(being) && being.state === 'dead') return; // (dead: no more to it)
    this.puff(being);
  }

  private puff(being: Being): void {
    if (isFoe(being) || being.where === (this.host.inside?.entrance ?? null)) this.host.report({ kind: 'puff', x: being.x, y: being.y, z: being.z });
  }
}
