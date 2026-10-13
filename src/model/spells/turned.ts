// Someone turned into something (spells.ts: a charm for anyone, cast at whoever's picked out), for good: a beast (a
// hen, a horse, cattle: a man a bull, a woman a cow; a pig, a sheep, a goat, a donkey; a toad, a rat, a cat), a
// statue or a tree, a ghost of themselves, a painting of themselves on a wall, a doll (turnedKinds.ts: `Into`, and
// how each goes about). A foe, a villager or keeper, someone on the road; never a boss or a camp's chief, nor anyone
// only passing through. Whoever they were is no more, as surely as if they'd been killed:
//  - a foe counts as slain, for whatever counts the slain (a board's quest, a quest someone gave, a camp or a dungeon
//    cleared, the world's record of them: never back), though nothing's had for it: no experience, no loot, no coin;
//  - a villager or keeper is gone from their village (`lost`: kept, so a world made again is made without them): no
//    word, no trade, no quest of theirs (any under way let go: story.ts lose);
//  - a traveller is off the roads.
// In their place what they are now, where they stood (out of doors, in a room, down a dungeon), kept with the game:
// a beast wandering aimlessly, never more than ROAM tiles from where they were turned, a few steps and a while stood,
// for ever; a statue stood there, a painting hung on the nearest wall (hung.ts), never moving. A tree is one of the
// world's from then on, a doll a thing on the ground like any other (loot/junk.ts), to be picked up and sold.
// (The first of them was the hen: hence `Hen`, `hens`, `Chickens`, and what a save calls them.)
// Told as it happens ('transformed': how it happens, part by part, is the view's to play, view/cinema/).
import { isBoss } from '../enemies/enemyLevels';
import { isWorldFoe } from '../enemies/foeIds';
import type { BagItem } from '../hero/bag';
import type { Furniture } from '../interiors/furniture';
import type { Entrance, Room } from '../interiors/interiors';
import type { MapSize } from '../map/grid';
import type { Point } from '../map/obstacles';
import type { Npc } from '../npcs/npcs';
import { roomFree } from '../npcs/npcWalk';
import type { Traveller } from '../travellers/travellers';
import { TILE_HEIGHT, TREE_SHAPES } from '../constants';
import type { Enemy, GameEvent, Tree, TreeKind } from '../types';
import { humanOf, isFoe, isNpc, type Being } from './beings';
import { HUNG_FACING, hungAt, soundHung, wallFor, type Hung } from './hung';
import { BEASTS, GAIT, OF_SOMEONE, coatsOf, soundStone, type Beast, type Hen, type Into, type Stone } from './turnedKinds';

export { BEASTS, COATS, COW_COATS, GAIT, INTO, coatsOf, type Beast, type Coated, type Gait, type Hen, type Into, type Stone } from './turnedKinds';

const rooted = (into: Into): boolean => into === 'statue' || into === 'tree'; // (stood where they were, in the way: out of doors only)
const STATUE_HALF = 0.22; // how far round a statue blocks the way
export const ROAM = 5; // tiles from where they were turned, at most
const ARRIVED = 0.08;
const LIKE = 14; // tiles about someone turned into a tree: of the kind of the nearest tree within them
const TREE_KINDS: readonly TreeKind[] = ['oak', 'pine', 'birch'];
const AWAKE = 40; // tiles from the hero a hen still wanders (farther: stood where she is)
const DRIFT = 0.3; // how near a room's walls a ghost keeps (through all else in it)
const DOLL: BagItem = 'doll'; // what someone turned into one is, from then on (loot/junk.ts)

// A place indoors, by its door.
export const placeOf = (entrance: Entrance | null | undefined): string | null => (entrance ? `${entrance.x},${entrance.z}` : null);

export interface ChickenHost {
  readonly seed: number;
  readonly size: MapSize;
  readonly hero: Point;
  readonly inside: { entrance: Entrance; room?: Room; furniture?: readonly Furniture[]; below?: Entrance } | null; // (`below`: upstairs)
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
  readonly trees: readonly Tree[];
  readonly world: { rooted(): void }; // (what's rooted, put among the world's: world/liveWorld.ts)
  report(event: GameEvent): void;
  slayGuard(enemy: Enemy): void;
  focus(id: number | null): void;
  select(who: null): void;
  dropLoot(item: BagItem, x: number, z: number): void; // (on the ground where the hero is: the world's, a dungeon's)
}

// (A boss: a dungeon's, and a camp's chief, who's one in all but the name.)
const boss = (foe: Enemy): boolean => isBoss(foe.kind) || foe.kind === 'banditChief';
// Whether `being` may be turned: living, no boss, not someone only passing through (led: not theirs to wander).
export const mayTurn = (being: Being): boolean => (isFoe(being) ? being.state !== 'dead' && !being.buried && !boss(being) : !(isNpc(being) && being.led));
// Who something's of (a statue, a ghost, a painting): `being`, as they stand.
const stoneOf = (being: Being): Stone => ({ id: being.id, ...(isFoe(being) ? { foe: being.kind } : {}), ...(humanOf(being) ? { human: { look: humanOf(being)!.look, equipment: { ...humanOf(being)!.equipment } } } : {}) });

export interface SavedChickens {
  hens: Array<[x: number, z: number, at: string | null, fromX: number, fromZ: number, kind?: Beast, coat?: number | null, stone?: Stone | null, hung?: Hung | null, up?: boolean]>;
  lost: number[];
  trees?: Array<[x: number, z: number, kind: TreeKind, shape: number, quarterTurns: number, groundTier: number]>; // those turned into trees: where each stands
}

export class Chickens {
  readonly hens: Hen[] = [];
  readonly lost = new Set<number>(); // villagers and keepers turned, by id: gone from the world for good
  readonly trees: Tree[] = []; // those turned into trees: each one of the world's from then on (to be felled, as any)
  private next = 1;

  constructor(private readonly host: ChickenHost) {}

  // Whether `being` may be turned into that, here and now. A statue, a tree: out of doors only; a tree, where
  // there's a tile for it to stand on. A painting: in a building's room only, where there's wall for it. A doll:
  // not in a building's room (nothing lies on a room's floor to be picked up: hero/hands.ts).
  may(being: Being, into: Into = 'chicken'): boolean {
    if (!mayTurn(being)) return false;
    const { host } = this;
    if (into === 'painting') return this.wall(being) !== null;
    if (into === 'doll') return !(host.inside && !host.dungeon) && (isFoe(being) || !being.where);
    if (!rooted(into)) return true;
    const outside = !host.inside && !host.dungeon && (isFoe(being) || !being.where); // (the hero, and they themselves)
    return outside && (into !== 'tree' || this.sapling(being) !== null);
  }

  // The wall someone would hang on as a painting (hung.ts): the nearest free stretch of their room's, the hero in
  // it with them. None down a dungeon (rock, and no room's plan to it), none upstairs (its rooms walled off within).
  private wall(being: Being): Hung | null {
    const { inside, dungeon } = this.host;
    if (!inside?.room || dungeon || inside.below || !(isFoe(being) || being.where === inside.entrance)) return null;
    const at = placeOf(inside.entrance);
    return wallFor(inside.room, inside.furniture ?? [], this.hens.flatMap((hen) => (hen.hung && hen.at === at && !hen.up ? [hen.hung] : [])), being);
  }

  // The tree someone would be turned into: on the tile they stand on, or the nearest open one beside it (not the
  // hero's own, nor one of another's); of the kind of the nearest tree about (an oak, where there's none).
  private sapling(being: Being): Tree | null {
    const { host } = this;
    const [bx, bz, hx, hz] = [Math.round(being.x), Math.round(being.z), Math.round(host.hero.x), Math.round(host.hero.z)];
    const tiles = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dz) => ({ x: bx + dx, z: bz + dz }))).sort((a, b) => Math.hypot(a.x - being.x, a.z - being.z) - Math.hypot(b.x - being.x, b.z - being.z));
    const at = tiles.find((t) => !(t.x === hx && t.z === hz) && host.isOpenTile(t.x, t.z) && !this.trees.some((tree) => tree.x === t.x && tree.z === t.z) && !this.hens.some((hen) => hen.kind === 'statue' && Math.round(hen.x) === t.x && Math.round(hen.z) === t.z));
    if (!at) return null;
    let [kind, near]: [TreeKind, number] = ['oak', LIKE];
    for (const tree of host.trees) {
      const far = Math.max(Math.abs(tree.x - at.x), Math.abs(tree.z - at.z));
      if (far < near) [kind, near] = [tree.kind, far];
    }
    return { x: at.x, z: at.z, groundTier: Math.round(host.getGroundY(at.x, at.z) / TILE_HEIGHT), kind, shape: Math.floor(host.random() * TREE_SHAPES) % TREE_SHAPES, quarterTurns: Math.floor(host.random() * 4) % 4, planted: true };
  }

  // The statues standing out of doors: where each blocks the way (world/liveWorld.ts).
  statues(): Array<{ x: number; z: number; half: number }> {
    return this.hens.filter((hen) => hen.kind === 'statue' && hen.at === null).map((hen) => ({ x: hen.x, z: hen.z, half: STATUE_HALF }));
  }

  // Turned, for good: whether they were. They're no more (above); in their place, what they are now.
  turn(being: Being, as: Into = 'chicken'): boolean {
    if (!this.may(being, as)) return false;
    const { host } = this;
    // Cattle: a man a bull, a woman a cow; what's neither (a beast), one or the other by chance.
    const build = humanOf(being)?.look.build;
    const into: Into = as === 'cow' || as === 'bull' ? (build ? (build === 'male' ? 'bull' : 'cow') : host.random() < 0.5 ? 'bull' : 'cow') : as;
    const tree = into === 'tree' ? this.sapling(being)! : null;
    const hen = into === 'tree' || into === 'doll' ? null : this.beast(being, into);
    const shown: Being = isFoe(being) ? { ...being } : being; // (as they stood, for its turning to be played: the foe itself is dead from here on)
    this.gone(being);
    if (tree) this.trees.push(tree);
    if (hen) this.hens.push(hen);
    if (into === 'doll') host.dropLoot(DOLL, being.x, being.z); // (lying where they stood)
    if (rooted(into)) host.world.rooted(); // (in the way, from now)
    host.report({ kind: 'transformed', who: shown, into, coat: hen?.coat, ...(tree ? { tree } : {}), ...(hen?.hung ? { hung: hen.hung } : {}) });
    return true;
  }

  // What's kept of `being`, turned into that: where they stood (a painting: on its wall, facing out from it), in a
  // coat of its kind's by chance, of them if it's of anyone.
  private beast(being: Being, kind: Beast): Hen {
    const { host } = this;
    const hung = kind === 'painting' ? this.wall(being)! : null;
    const coats = coatsOf(kind);
    const up = !isFoe(being) && !!host.inside?.below && being.where === host.inside.entrance;
    return {
      id: this.next++,
      kind,
      ...(hung ? { ...hungAt(hung), y: 0, facing: HUNG_FACING[hung.wall], hung } : { x: being.x, y: being.y, z: being.z, facing: isFoe(being) ? 0 : being.facing }),
      at: isFoe(being) ? (host.dungeon || hung ? placeOf(host.inside?.entrance) : null) : placeOf(being.where),
      from: { x: being.x, z: being.z },
      to: null,
      peck: GAIT[kind].stood[0],
      fresh: true,
      ...(coats ? { coat: Math.floor(host.random() * coats) % coats } : {}),
      ...(OF_SOMEONE.includes(kind) ? { stone: stoneOf(being) } : {}),
      ...(GAIT[kind].hops ? { hop: 0 } : {}),
      ...(up ? { up } : {}),
    };
  }

  // Whoever's turned, no more (above): a foe as good as slain, a villager lost, a traveller off the roads.
  private gone(being: Being): void {
    const { host } = this;
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
      return;
    }
    if (host.chosen.person === being) host.select(null);
    if (isNpc(being)) {
      host.story.lose(being); // (their quests: let go, and no more of them)
      this.lost.add(being.id);
      const at = host.npcs.indexOf(being);
      if (at >= 0) host.npcs.splice(at, 1);
    } else host.travellers.lose(being);
  }

  // A moment on: each hen where the hero is, a few steps and a peck.
  update(dt: number): void {
    for (const hen of this.here) {
      if (Math.abs(hen.x - this.host.hero.x) > AWAKE || Math.abs(hen.z - this.host.hero.z) > AWAKE) continue;
      this.strut(hen, dt);
    }
  }

  // The hens where the hero is (to be drawn, and to wander): down in the dungeon with them, in their room (on their
  // floor of it), or out of doors.
  get here(): Hen[] {
    const [at, up] = [placeOf(this.host.inside?.entrance), !!this.host.inside?.below];
    return this.hens.filter((hen) => hen.at === at && !!hen.up === up);
  }

  private strut(hen: Hen, dt: number): void {
    const { host } = this;
    const gait = GAIT[hen.kind];
    if (!gait.pace) return; // (a statue, a painting: where it is, for ever)
    if (hen.peck > 0) return void (hen.peck -= dt);
    const rest = () => ([hen.to, hen.peck] = [null, gait.stood[0] + host.random() * (gait.stood[1] - gait.stood[0])]);
    if (!hen.to) {
      hen.to = this.bound(hen);
      if (gait.hops && !this.free(hen.to.x, hen.to.z, hen.kind)) return void rest(); // (nowhere to land: sat a while more)
    }
    const [dx, dz] = [hen.to.x - hen.x, hen.to.z - hen.z];
    const left = Math.hypot(dx, dz);
    const step = Math.min(left, gait.pace * dt);
    const [x, z] = left > 1e-6 ? [hen.x + (dx / left) * step, hen.z + (dz / left) * step] : [hen.x, hen.z];
    if (left <= ARRIVED || !this.free(x, z, hen.kind)) {
      rest(); // there, or the way shut: a peck, then elsewhere
      if (gait.hops) hen.hop = 0; // (landed)
      return;
    }
    [hen.x, hen.z, hen.facing] = [x, z, Math.atan2(dx, dz)];
    if (gait.hops) hen.hop = Math.min(1, Math.max(1e-3, (gait.dash! - (left - step)) / (gait.dash! - ARRIVED))); // (how far through its leap)
    if (!host.inside) hen.y = host.getGroundY(x, z);
  }

  // Where one's bound next. A stroller: somewhere within reach of where they were turned, any way round. One that
  // goes by dashes (a rat, a cat; a toad, by hops of just the one length): a little way off from where it is, any
  // way round; back toward where it was turned, when that would take it too far from there.
  private bound(hen: Hen): Point {
    const { host } = this;
    const { dash, hops } = GAIT[hen.kind];
    const angle = host.random() * Math.PI * 2;
    if (!dash) {
      const far = host.random() * ROAM;
      return { x: hen.from.x + Math.sin(angle) * far, z: hen.from.z + Math.cos(angle) * far };
    }
    const far = hops ? dash : dash * (0.4 + 0.6 * host.random());
    const to = { x: hen.x + Math.sin(angle) * far, z: hen.z + Math.cos(angle) * far };
    const home = Math.hypot(hen.from.x - hen.x, hen.from.z - hen.z);
    return Math.hypot(to.x - hen.from.x, to.z - hen.from.z) <= ROAM || home < 1e-6 ? to : { x: hen.x + ((hen.from.x - hen.x) / home) * far, z: hen.z + ((hen.from.z - hen.z) / home) * far };
  }

  // Whether one of that kind could be at (x, z), where the hero is: open ground there (a room's floor, a dungeon's),
  // and not on the hero. A ghost: through the hero and whatever stands there, kept only to the map, to its room's
  // floor, to a dungeon's open ground (its rock the end of it, as of anyone).
  private free(x: number, z: number, kind: Beast): boolean {
    const { host } = this;
    if (GAIT[kind].drifts && !host.dungeon) {
      const room = host.inside?.room;
      if (room) return x >= -0.5 + DRIFT && z >= -0.5 + DRIFT && x <= room.width - 0.5 - DRIFT && z <= room.depth - 0.5 - DRIFT;
      if (!host.inside) return x >= 0 && z >= 0 && x <= host.size.width - 1 && z <= host.size.depth - 1;
    }
    if (Math.hypot(x - host.hero.x, z - host.hero.z) < 0.3) return false;
    if (host.dungeon) return host.dungeon.free(x, z, 0.12);
    return host.inside ? roomFree(host.seed, host.inside.entrance)(x, z) : host.isOpenTile(Math.round(x), Math.round(z));
  }

  save(): SavedChickens {
    const round = (n: number) => Math.round(n * 100) / 100;
    return { hens: this.hens.map((hen) => [round(hen.x), round(hen.z), hen.at, round(hen.from.x), round(hen.from.z), hen.kind, hen.coat ?? null, hen.stone ?? null, hen.hung ?? null, !!hen.up]), lost: [...this.lost], trees: this.trees.map((t) => [t.x, t.z, t.kind, t.shape, t.quarterTurns, t.groundTier]) };
  }

  // A save's, as far as it's sound; those lost gone from the world as it stands (a world made after: liveWorld.ts).
  load(saved: unknown): void {
    const data = (saved ?? {}) as Partial<SavedChickens>;
    this.hens.length = 0;
    this.trees.length = 0;
    this.lost.clear();
    for (const id of Array.isArray(data.lost) ? data.lost : []) if (Number.isInteger(id)) this.lost.add(id);
    for (const row of Array.isArray(data.hens) ? data.hens : []) {
      if (!Array.isArray(row) || ![row[0], row[1], row[3], row[4]].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
      const [x, z, at, fromX, fromZ, said, coat, stone, hung, up] = row;
      const kind: Beast = BEASTS.includes(said as Beast) ? (said as Beast) : 'chicken'; // (an older save's, a broken one's: a hen)
      if (OF_SOMEONE.includes(kind) && !soundStone(stone)) continue; // (a statue of no one: none)
      if (kind === 'painting' && !(soundHung(hung) && typeof at === 'string')) continue; // (a painting on no wall: none)
      const coats = coatsOf(kind);
      const hangs = kind === 'painting' ? { ...hungAt(hung as Hung), facing: HUNG_FACING[(hung as Hung).wall], hung: hung as Hung } : {};
      this.hens.push({ id: this.next++, kind, x, y: typeof at === 'string' ? 0 : this.host.getGroundY(x, z), z, at: typeof at === 'string' ? at : null, from: { x: fromX, z: fromZ }, to: null, peck: 0.5, facing: 0, ...hangs, ...(coats ? { coat: typeof coat === 'number' && Number.isInteger(coat) && coat >= 0 && coat < coats ? coat : 0 } : {}), ...(OF_SOMEONE.includes(kind) ? { stone: stone as Stone } : {}), ...(GAIT[kind].hops ? { hop: 0 } : {}), ...(up === true && typeof at === 'string' ? { up } : {}) });
    }
    for (const row of Array.isArray(data.trees) ? data.trees : []) {
      if (!Array.isArray(row) || ![row[0], row[1], row[3], row[4], row[5]].every((n) => Number.isInteger(n)) || !TREE_KINDS.includes(row[2])) continue;
      this.trees.push({ x: row[0], z: row[1], kind: row[2], shape: row[3] % TREE_SHAPES, quarterTurns: row[4] % 4, groundTier: row[5], planted: true });
    }
    for (let i = this.host.npcs.length - 1; i >= 0; i--) if (this.lost.has(this.host.npcs[i].id)) this.host.npcs.splice(i, 1);
    this.host.world.rooted();
  }
}
