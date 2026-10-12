// Someone turned into a beast (spells.ts: a charm for anyone, cast at whoever's picked out; a chicken, or a horse:
// `Into`), for good: a foe, a
// villager or keeper, someone on the road; never a boss or a camp's chief, nor anyone only passing through.
// Whoever they were is no more, as surely as if they'd been killed:
//  - a foe counts as slain, for whatever counts the slain (a board's quest, a quest someone gave, a camp or a dungeon
//    cleared, the world's record of them: never back), though nothing's had for it: no experience, no loot, no coin;
//  - a villager or keeper is gone from their village (`lost`: kept, so a world made again is made without them): no
//    word, no trade, no quest of theirs (any under way let go: story.ts lose);
//  - a traveller is off the roads.
// In their place the beast (`hens`: a hen, or a horse; kept with the game), where they stood (out of doors, in a room, down a dungeon):
// wandering aimlessly, never more than ROAM tiles from where they were turned, a few steps and a peck, for ever.
// Told as it happens ('transformed': how it happens, part by part, is the view's to play, view/cinema/).
import { isBoss } from '../enemies/enemyLevels';
import { isWorldFoe } from '../enemies/foeIds';
import type { Entrance } from '../interiors/interiors';
import type { Point } from '../map/obstacles';
import type { Npc } from '../npcs/npcs';
import { roomFree } from '../npcs/npcWalk';
import type { Traveller } from '../travellers/travellers';
import type { Enemy, GameEvent } from '../types';

export type Into = 'chicken' | 'horse';
export const INTO: readonly Into[] = ['chicken', 'horse'];
export const ROAM = 5; // tiles from where they were turned, at most
// How each goes about: tiles a second, and the seconds stood between strolls (a hen pecking, a horse grazing).
const GAIT: Record<Into, { pace: number; stood: [number, number] }> = { chicken: { pace: 0.55, stood: [0.6, 2.2] }, horse: { pace: 0.8, stood: [3, 9] } };
const ARRIVED = 0.08;
const AWAKE = 40; // tiles from the hero a hen still wanders (farther: stood where she is)

export interface Hen {
  id: number;
  kind: Into; // what they were turned into
  x: number;
  y: number;
  z: number;
  at: string | null; // where she is: out of doors (null), or in a building or down a dungeon (its door's: placeOf)
  from: Point; // where they were turned
  to: Point | null; // where she's strutting to, if anywhere
  peck: number; // seconds more stood pecking
  facing: number;
  fresh?: boolean; // just turned (the view's: a puff of smoke as she's first seen)
}
export type Being = Enemy | Npc | Traveller;
const isFoe = (being: Being): being is Enemy => 'kind' in being;
const isNpc = (being: Being): being is Npc => 'home' in being;
// A place indoors, by its door.
export const placeOf = (entrance: Entrance | null | undefined): string | null => (entrance ? `${entrance.x},${entrance.z}` : null);

export interface ChickenHost {
  readonly seed: number;
  readonly hero: Point;
  readonly inside: { entrance: Entrance } | null;
  readonly dungeon: { free(x: number, z: number, r: number): boolean } | null;
  readonly foes: Enemy[]; // the foes about (the world's, or a dungeon's)
  readonly npcs: Npc[];
  readonly slain: Set<number>;
  readonly quests: { onKill(enemy: Enemy): unknown };
  readonly story: { onKill(enemy: Enemy): void; lose(who: Npc): void };
  readonly travellers: { lose(t: Traveller): void };
  readonly chosen: { readonly person: unknown };
  random(): number;
  isOpenTile(x: number, z: number): boolean;
  getGroundY(x: number, z: number): number;
  report(event: GameEvent): void;
  slayGuard(enemy: Enemy): void;
  focus(id: number | null): void;
  select(who: null): void;
}

// (A boss: a dungeon's, and a camp's chief, who's one in all but the name.)
const boss = (foe: Enemy): boolean => isBoss(foe.kind) || foe.kind === 'banditChief';
// Whether `being` may be turned: living, no boss, not someone only passing through (led: not theirs to wander).
export const mayTurn = (being: Being): boolean => (isFoe(being) ? being.state !== 'dead' && !being.buried && !boss(being) : !(isNpc(being) && being.led));

export interface SavedChickens {
  hens: Array<[x: number, z: number, at: string | null, fromX: number, fromZ: number, kind?: Into]>;
  lost: number[];
}

export class Chickens {
  readonly hens: Hen[] = [];
  readonly lost = new Set<number>(); // villagers and keepers turned, by id: gone from the world for good
  private next = 1;

  constructor(private readonly host: ChickenHost) {}

  // Turned, for good: whether they were. They're no more (above); a hen where they stood.
  turn(being: Being, into: Into = 'chicken'): boolean {
    if (!mayTurn(being)) return false;
    const { host } = this;
    const hen: Hen = { id: this.next++, kind: into, x: being.x, y: being.y, z: being.z, at: isFoe(being) ? (host.dungeon ? placeOf(host.inside?.entrance) : null) : placeOf(being.where), from: { x: being.x, z: being.z }, to: null, peck: GAIT[into].stood[0], facing: isFoe(being) ? 0 : being.facing, fresh: true };
    const shown: Being = isFoe(being) ? { ...being } : being; // (as they stood, for its turning to be played: the foe itself is dead from here on)
    if (isFoe(being)) {
      // As good as slain, for all that counts them (dead, to whatever still holds it: a camp's count of its crew); nothing had for it.
      Object.assign(being, { state: 'dead', hp: 0 });
      if (isWorldFoe(being.id)) host.slain.add(being.id);
      host.slayGuard(being);
      host.quests.onKill(being);
      host.story.onKill(being);
      host.focus(null);
      const at = host.foes.indexOf(being);
      if (at >= 0) host.foes.splice(at, 1);
    } else {
      if (host.chosen.person === being) host.select(null);
      if (isNpc(being)) {
        host.story.lose(being); // (their quests: let go, and no more of them)
        this.lost.add(being.id);
        const at = host.npcs.indexOf(being);
        if (at >= 0) host.npcs.splice(at, 1);
      } else host.travellers.lose(being);
    }
    this.hens.push(hen);
    host.report({ kind: 'transformed', who: shown, into });
    return true;
  }

  // A moment on: each hen where the hero is, a few steps and a peck.
  update(dt: number): void {
    for (const hen of this.here) {
      if (Math.abs(hen.x - this.host.hero.x) > AWAKE || Math.abs(hen.z - this.host.hero.z) > AWAKE) continue;
      this.strut(hen, dt);
    }
  }

  // The hens where the hero is (to be drawn, and to wander): down in the dungeon with them, in their room, or out of doors.
  get here(): Hen[] {
    const at = placeOf(this.host.inside?.entrance);
    return this.hens.filter((hen) => hen.at === at);
  }

  private strut(hen: Hen, dt: number): void {
    const { host } = this;
    if (hen.peck > 0) return void (hen.peck -= dt);
    if (!hen.to) {
      // Somewhere within reach of where they were turned, any way round.
      const [angle, far] = [host.random() * Math.PI * 2, host.random() * ROAM];
      hen.to = { x: hen.from.x + Math.sin(angle) * far, z: hen.from.z + Math.cos(angle) * far };
    }
    const [dx, dz] = [hen.to.x - hen.x, hen.to.z - hen.z];
    const left = Math.hypot(dx, dz);
    const { pace, stood } = GAIT[hen.kind];
    const step = Math.min(left, pace * dt);
    const [x, z] = left > 1e-6 ? [hen.x + (dx / left) * step, hen.z + (dz / left) * step] : [hen.x, hen.z];
    if (left <= ARRIVED || !this.free(x, z)) {
      [hen.to, hen.peck] = [null, stood[0] + host.random() * (stood[1] - stood[0])]; // there, or the way shut: a peck, then elsewhere
      return;
    }
    [hen.x, hen.z, hen.facing] = [x, z, Math.atan2(dx, dz)];
    if (!host.inside) hen.y = host.getGroundY(x, z);
  }

  // Whether a hen could stand at (x, z), where the hero is: open ground there (a room's floor, a dungeon's), and not on the hero.
  private free(x: number, z: number): boolean {
    const { host } = this;
    if (Math.hypot(x - host.hero.x, z - host.hero.z) < 0.3) return false;
    if (host.dungeon) return host.dungeon.free(x, z, 0.12);
    return host.inside ? roomFree(host.seed, host.inside.entrance)(x, z) : host.isOpenTile(Math.round(x), Math.round(z));
  }

  save(): SavedChickens {
    const round = (n: number) => Math.round(n * 100) / 100;
    return { hens: this.hens.map((hen) => [round(hen.x), round(hen.z), hen.at, round(hen.from.x), round(hen.from.z), hen.kind]), lost: [...this.lost] };
  }

  // A save's, as far as it's sound; those lost gone from the world as it stands (a world made after: liveWorld.ts).
  load(saved: unknown): void {
    const data = (saved ?? {}) as Partial<SavedChickens>;
    this.hens.length = 0;
    this.lost.clear();
    for (const id of Array.isArray(data.lost) ? data.lost : []) if (Number.isInteger(id)) this.lost.add(id);
    for (const row of Array.isArray(data.hens) ? data.hens : []) {
      if (!Array.isArray(row) || ![row[0], row[1], row[3], row[4]].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
      const [x, z, at, fromX, fromZ, kind] = row;
      this.hens.push({ id: this.next++, kind: INTO.includes(kind as Into) ? (kind as Into) : 'chicken', x, y: typeof at === 'string' ? 0 : this.host.getGroundY(x, z), z, at: typeof at === 'string' ? at : null, from: { x: fromX, z: fromZ }, to: null, peck: 0.5, facing: 0 });
    }
    for (let i = this.host.npcs.length - 1; i >= 0; i--) if (this.lost.has(this.host.npcs[i].id)) this.host.npcs.splice(i, 1);
  }
}
