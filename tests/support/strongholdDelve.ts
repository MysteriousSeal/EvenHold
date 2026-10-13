// A scripted hero for a stronghold played whole, in the game itself
// (strongholdRun.test.ts, strongholdSaves.test.ts): the keys' direction and a
// blow a frame, as a player gives them, never set down anywhere by hand once
// inside. It walks by its own way found over the floor (the game's
// pathfinding, the place's own rock, props and gate), fights whoever it's
// sent at till they fall, opens the chest, picks up what lies about, and goes
// out by the door in reach. Every frame it looks the place over (`watch`)
// and keeps what's wrong (`problems`): a foe in the rock or through the shut
// gate, the gate open early, the cleared share going back, a boss mended
// whole by its leash. Its cheats: god mode (never hurt: reach and state are
// looked at, not balance) and, asked for, one-hit kills.
import { GameModel } from '../../src/model/GameModel';
import { ATTACK_REACH, ENEMY_STATS, HERO_RADIUS, INDOOR_SCALE } from '../../src/model/constants';
import { blowOf } from '../../src/model/hero/attributes';
import { isBoss } from '../../src/model/enemies/enemyLevels';
import { namedIn, type GearKey } from '../../src/model/human/items/gear';
import { chestInReach } from '../../src/model/loot/chests';
import { clearLine, type Point } from '../../src/model/map/obstacles';
import { SUMMONED } from '../../src/model/dungeons/dungeonRecord';
import { roomAt } from '../../src/model/strongholds/strongholdLayout';
import { reachedFrom } from '../../src/model/strongholds/strongholdProps';
import { cellKey } from '../../src/model/map/grid';
import { Nav } from '../bots/nav';
import { STRONGHOLD_FOE_ID, StrongholdRun } from '../../src/model/strongholds/strongholdFoes';
import { strongholdInside, type Stronghold, type StrongholdInside } from '../../src/model/strongholds/strongholds';
import type { Enemy, GameEvent } from '../../src/model/types';
import { isGear } from '../../src/model/human/items/gear';
import { mulberry32 } from '../../src/util/random';
import { FRAME, TEST_MAP_SIZE } from './testWorld';

export type Went = 'there' | 'no way' | 'stuck' | 'late';
export type Fought = 'slain' | 'no way' | 'stuck' | 'late' | 'no harm';

const REPATH = 0.5; // seconds between fresh ways
const STILL = 5; // seconds pressing on and getting nowhere: stuck

export const summoned = (foe: Enemy): boolean => foe.id >= STRONGHOLD_FOE_ID + SUMMONED;

export class Delve {
  readonly problems: string[] = [];
  readonly events: GameEvent[] = [];
  seconds = 0;
  halt: (() => boolean) | null = null; // a moment a test wants to stop at: looked for every frame of a walk or a fight
  private readonly said = new Set<string>();
  private share = 0;
  private readonly was = new Map<Enemy, number>(); // each boss's health a frame ago

  constructor(
    readonly model: GameModel,
    readonly stronghold: Stronghold = model.strongholds[0],
  ) {
    model.godMode = true;
    model.random = mulberry32(model.seed * 7 + 3); // (its fights' chances the same every time)
  }

  // A strong arm (a cheat): Strength trained till a blow of theirs does `blow`.
  strong(blow: number): this {
    while (blowOf(this.hero) < blow) this.hero.trained.strength += 1;
    return this;
  }

  static on(seed: number): Delve {
    return new Delve(new GameModel(seed, TEST_MAP_SIZE));
  }

  get run(): StrongholdRun {
    return this.model.dungeon as StrongholdRun;
  }
  get inside(): StrongholdInside {
    return strongholdInside(this.model.seed, this.stronghold.entrance);
  }
  get hero() {
    return this.model.hero;
  }
  // Its foes still up (those called up mid-fight too).
  get standing(): Enemy[] {
    return this.model.foes.filter((f) => f.state !== 'dead');
  }
  far = (a: Point, b: Point = this.hero): number => Math.hypot(a.x - b.x, a.z - b.z);

  // Something wrong, kept once (by `key`).
  flag(key: string, what: string): void {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.problems.push(`[${this.seconds.toFixed(1)}s] ${what}`);
  }

  // A frame of the game, the keys pressed (dx, dz); then the place looked over.
  frame(dx = 0, dz = 0): void {
    this.model.update(dx, dz, FRAME);
    this.seconds += FRAME;
    this.events.push(...this.model.takeEvents());
    if (this.model.dungeon instanceof StrongholdRun) this.watch();
  }

  wait(seconds: number): void {
    for (let t = 0; t < seconds; t += FRAME) this.frame();
  }

  // What must hold every frame down there.
  private watch(): void {
    const { run, inside, hero } = this;
    const { plan } = inside;
    const beyond = this.beyond;
    const at = (p: Point) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
    if (!Number.isFinite(hero.x + hero.z) || !roomAt(plan, hero.x, hero.z)) this.flag('hero-rock', `the hero off the floor at ${at(hero)}`);
    if (inside.shut !== run.gateShut) this.flag('gate-lag', `the gate drawn ${inside.shut ? 'shut' : 'open'} while its run says ${run.gateShut ? 'shut' : 'open'}`);
    if (!inside.shut && run.wingsLeft.length > 0 && run.king) this.flag('gate-early', `the gate open with ${run.wingsLeft.join(', ')} still standing`);
    if (inside.shut && beyond(hero)) this.flag('hero-through', `the hero past the shut gate at ${at(hero)}`);
    for (const foe of run.foes) {
      if (foe.state === 'dead') continue;
      const name = `${foe.kind} #${foe.id - STRONGHOLD_FOE_ID}`;
      if (!Number.isFinite(foe.x + foe.z + foe.hp)) this.flag(`nan:${foe.id}`, `${name} is nowhere (${foe.x}, ${foe.z}, hp ${foe.hp})`);
      else if (!roomAt(plan, foe.x, foe.z)) this.flag(`rock:${foe.id}`, `${name} in the rock at ${at(foe)}`);
      else if (!run.free(foe.x, foe.z, 0.02)) this.flag(`solid:${foe.id}`, `${name} inside something solid at ${at(foe)}`);
      const post = run['placed'].get(foe); // (where it was posted: the run's own)
      if (inside.shut && post && !summoned(foe) && !inside.gateKeys.has(cellKey(Math.round(foe.x), Math.round(foe.z))) && beyond(post) !== beyond(foe)) this.flag(`through:${foe.id}`, `${name} the wrong side of the shut gate at ${at(foe)}`);
      if (isBoss(foe.kind)) {
        const before = this.was.get(foe) ?? foe.hp;
        if (foe.hp === foe.maxHp && before < foe.maxHp * 0.9) this.flag(`leash:${foe.id}:${Math.floor(this.seconds / 20)}`, `${name} mended whole from ${before}/${foe.maxHp}, ${this.far(foe, { x: foe.homeX, z: foe.homeZ }).toFixed(1)} tiles from home, the hero ${this.far(foe).toFixed(1)} off`);
        this.was.set(foe, foe.hp);
      }
    }
    if (run.share < this.share - 1e-9) this.flag('share-back', `its cleared share went back from ${this.share} to ${run.share}`);
    this.share = run.share;
  }

  // Whether a spot's behind the great hall's gate: the way past it and the hall (what its shutting cuts off).
  private front: Set<string> | null = null;
  beyond = (p: Point): boolean => {
    const { plan, gateKeys } = this.inside;
    this.front ??= reachedFrom(plan, gateKeys);
    const key = cellKey(Math.round(p.x), Math.round(p.z));
    return !this.front.has(key) && !gateKeys.has(key);
  };

  // The way over the floor from the hero toward `to`, tile by tile (a search of its own, the whole floor over: the
  // game's pathfinding loses long ways, see strongholdRun.test.ts): from their tile's middle, or (that in something:
  // stood at a prop's edge) from the nearest clear one they can walk straight to; to the tile nearest `to` that's reached.
  private way(to: Point): Point[] {
    const { hero, free } = this;
    const { width, depth } = this.inside.plan;
    const [tx, tz] = [Math.round(hero.x), Math.round(hero.z)];
    const near: Point[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) near.push({ x: tx + dx, z: tz + dz });
    near.sort((a, b) => this.far(a) - this.far(b));
    const first = free(tx, tz) ? { x: tx, z: tz } : near.find((p) => free(p.x, p.z) && clearLine(hero, p, free, 0.1));
    if (!first) return [];
    const came = new Int32Array(width * depth).fill(-1);
    const queue = [first.x * depth + first.z];
    came[queue[0]] = queue[0];
    let best = queue[0];
    const off = (cell: number) => Math.hypot(Math.floor(cell / depth) - to.x, (cell % depth) - to.z);
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      if (off(cell) < off(best)) best = cell;
      const [x, z] = [Math.floor(cell / depth), cell % depth];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [nx, nz] = [x + dx, z + dz];
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth || came[nx * depth + nz] >= 0 || !free(nx, nz) || !free(x + dx / 2, z + dz / 2)) continue;
        came[nx * depth + nz] = cell;
        queue.push(nx * depth + nz);
      }
    }
    const path: Point[] = [];
    for (let cell = best; came[cell] !== cell; cell = came[cell]) path.push({ x: Math.floor(cell / depth), z: cell % depth });
    path.push(first);
    return path.reverse();
  }

  // Where the hero could stand down there (the place's own rock, props and gate).
  // (Asked a great many times a search, the same of every half tile: kept, till the gate's swung.)
  private readonly fits = new Map<number, boolean>();
  private fitsShut: boolean | null = null;
  private free = (x: number, z: number): boolean => {
    const walls = this.model.inside?.walls;
    if (!walls) return false;
    const [i, j] = [x * 2, z * 2];
    if (!Number.isInteger(i) || !Number.isInteger(j)) return !walls(x, z, HERO_RADIUS * INDOOR_SCALE);
    if (this.fitsShut !== this.inside.shut) [this.fits.clear(), (this.fitsShut = this.inside.shut)];
    const key = (i + 8) * 4096 + (j + 8);
    let fit = this.fits.get(key);
    if (fit === undefined) this.fits.set(key, (fit = !walls(x, z, HERO_RADIUS * INDOOR_SCALE)));
    return fit;
  };

  // Whether there's a way over the floor from the hero to `to` as things stand.
  reaches(to: Point): boolean {
    const way = this.way(to);
    const end = way[way.length - 1] ?? this.hero;
    return this.far(end, to) < 1.2;
  }

  // Walked to within `near` of `to` (asked every frame: someone moving), whoever stands in the way cut down.
  walkTo(to: () => Point, near: number, limit = 90): Went {
    let [path, age, still, last, t] = [[] as Point[], Infinity, 0, { x: this.hero.x, z: this.hero.z }, 0];
    for (; t < limit; t += FRAME) {
      if (this.halt?.()) return 'late';
      const goal = to();
      const { hero } = this;
      if (this.far(goal) <= near) return 'there';
      if ((age += FRAME) > REPATH) {
        path = this.way(goal);
        age = 0;
        const end = path[path.length - 1] ?? hero;
        if (this.far(end, goal) > Math.max(1.2, near + 0.8)) return 'no way';
      }
      while (path.length > 0 && this.far(path[0]) < 0.2) path.shift();
      const straight = this.free(goal.x, goal.z) && clearLine(hero, goal, this.free, 0.1);
      let ahead = 0;
      for (let i = 1; i < Math.min(path.length, 6); i++) if (clearLine(hero, path[i], this.free, 0.1)) ahead = i;
      if (ahead > 0) path.splice(0, ahead);
      const next = straight || path.length === 0 ? goal : path[0];
      const d = this.far(next) || 1;
      // Someone in the way: struck at as they stand there.
      const blocker = still > 0.4 ? this.standing.find((f) => this.far(f) < ATTACK_REACH + ENEMY_STATS[f.kind].radius) : null;
      if (blocker) [this.model.focus(blocker.id), this.model.startAttack()];
      this.frame((next.x - hero.x) / d, (next.z - hero.z) / d);
      if (this.far(last) > 0.25) [last, still] = [{ x: hero.x, z: hero.z }, 0];
      else if ((still += FRAME) > STILL) return 'stuck';
    }
    return 'late';
  }

  // One fought till it falls: come up to, kept in front, struck at every frame.
  fight(foe: Enemy, limit = 150): Fought {
    let [lowest, since] = [foe.hp, 0];
    const reach = ATTACK_REACH + ENEMY_STATS[foe.kind].radius - 0.15;
    for (let t = 0; t < limit; ) {
      if (foe.state === 'dead') return 'slain';
      if (this.halt?.()) return 'late';
      if (this.far(foe) > reach) {
        const before = this.seconds;
        const went = this.walkTo(() => foe, reach - 0.05, Math.min(20, limit - t));
        t += this.seconds - before;
        if ((foe.state as string) === 'dead') return 'slain';
        if (went === 'no way' || went === 'stuck') return went;
        continue;
      }
      this.model.focus(foe.id);
      this.model.startAttack();
      this.frame();
      t += FRAME;
      if (foe.hp < lowest) [lowest, since] = [foe.hp, 0];
      else if ((since += FRAME) > 45) return 'no harm';
    }
    return foe.state === 'dead' ? 'slain' : 'late';
  }

  // Everyone of `those` (asked afresh each time: those called up join them) fought, the nearest that can be come to
  // first, a sawbones before its fellows; who couldn't be: said, and left.
  clear(those: () => Enemy[], why: string, till: (() => boolean) | null = null): void {
    this.halt = till;
    try {
      this.clearAll(those, why);
    } finally {
      this.halt = null;
    }
  }

  private clearAll(those: () => Enemy[], why: string): void {
    const left = new Map<Enemy, number>(); // tries at each
    for (let rounds = 0; rounds < 400; rounds++) {
      const up = those().filter((f) => f.state !== 'dead' && (left.get(f) ?? 0) < 3);
      if (up.length === 0 || this.halt?.()) return;
      const rank = (f: Enemy) => this.far(f) - (f.kind === 'sawbones' && this.far(f) < 8 ? 100 : 0);
      up.sort((a, b) => rank(a) - rank(b));
      const foe = up.find((f) => this.reaches(f)) ?? up[0];
      const how = this.fight(foe);
      if (how === 'slain' || this.halt?.()) continue;
      left.set(foe, (left.get(foe) ?? 0) + 1);
      if (left.get(foe) === 3) this.flag(`fight:${foe.id}`, `${why}: ${foe.kind} #${foe.id - STRONGHOLD_FOE_ID} not to be slain (${how}), at ${foe.x.toFixed(1)},${foe.z.toFixed(1)}, ${foe.hp}/${foe.maxHp}, ${foe.state}; the hero at ${this.hero.x.toFixed(1)},${this.hero.z.toFixed(1)}`);
    }
    this.flag(`clear:${why}`, `${why}: still fighting after 400 rounds`);
  }

  // The king's chest walked to and opened as E opens it (loot/chests.ts); whether it was.
  openChest(): boolean {
    const chest = this.run.chest;
    if (!chest) return false;
    this.walkTo(() => ({ x: chest.x, z: chest.z + 0.7 }), 0.25, 40);
    const at = chestInReach(this.model);
    at?.open();
    return !!at && chest.open;
  }

  // What lies on the floor: the named pieces there (and all else that's gear).
  get lying(): GearKey[] {
    return this.model.groundHere.loot.map((l) => l.item).filter((i): i is GearKey => isGear(i));
  }
  get namedLying(): GearKey[] {
    return this.lying.filter((i) => namedIn(i));
  }
  get namedHeld(): GearKey[] {
    return (Object.keys(this.hero.bag) as GearKey[]).filter((i) => isGear(i) && namedIn(i) && (this.hero.bag[i] ?? 0) > 0);
  }

  // Every named piece on the floor walked to and picked up (what lies nearer taken with it); those not to be had.
  gather(): GearKey[] {
    const missed: GearKey[] = [];
    for (const loot of [...this.model.groundHere.loot]) {
      if (!isGear(loot.item) || !namedIn(loot.item)) continue;
      const went = this.walkTo(() => loot, 0.6, 60);
      for (let i = 0; i < 12 && this.model.groundHere.loot.includes(loot); i++) if (!this.model.pickUp()) break;
      if (this.model.groundHere.loot.includes(loot)) [missed.push(loot.item), this.flag(`loot:${loot.item}`, `${loot.item} at ${loot.x.toFixed(1)},${loot.z.toFixed(1)} not to be picked up (${went})`)];
    }
    return missed;
  }

  // In from the world: set down on open ground a few tiles off its gate (a cheat's step), walked round to the spot
  // before it as the bots walk (bots/nav.ts), and gone in with E.
  enter(): void {
    const { entrance } = this.stronghold;
    const { model } = this;
    const from = [4, 3, 5, 2].flatMap((far) => [0, 1, -1, 2, -2].map((side) => ({ x: Math.round(entrance.x + entrance.outX * far + entrance.outZ * side), z: Math.round(entrance.z + entrance.outZ * far + entrance.outX * side) }))).find((t) => model.isOpenTile(t.x, t.z));
    if (!from) throw new Error(`no open ground before the gate at ${entrance.x},${entrance.z}`);
    model.teleport(from.x, from.z);
    const nav = new Nav(model);
    for (let t = 0; t < 40 && model.doorInReach !== entrance; t += FRAME) {
      const { dx, dz, state } = nav.toward(entrance, 0.05, FRAME);
      if (state === 'stuck' || state === 'no way') break;
      this.frame(dx, dz);
    }
    if (model.doorInReach !== entrance) throw new Error(`the gate not come to (from ${from.x},${from.z}): the hero at ${this.hero.x.toFixed(2)},${this.hero.z.toFixed(2)}, its way in at ${entrance.x},${entrance.z}`);
    model.useDoor();
  }
}
