// A bandit stronghold's foes while the hero's in it (a dungeon's run:
// dungeons/dungeonTypes.ts): who stands where, from the seed and the
// stronghold, the same every time:
// - PACKS, a room each: in the entry hall, the watch; in every room of a
//   wing, a bruiser in front (toward the way in) with a crossbowman behind
//   and, by the seed, a firebrand, a sawbones, a runner, now and then a war
//   hound; in the kennels' rooms mostly hounds, a handler or two with them;
//   in a small side room, two; none in the gatehouse nor the ways between;
// - each wing's boss in its last room (the houndmaster, the quartermaster,
//   the gaoler, the captain), a guard of two with him;
// - the king before his throne in the great hall, his own guard about him.
// All run as any foes (enemies.ts, their own director on the stronghold's
// floor); what more they do is strongholdMoves.ts's, called from here every
// frame (the seam: see there), this file knowing nothing of it.
//
// The great hall's gate is shut till the four wings' bosses are slain (in any
// order): each has a post of his own in the record of the slain (WING_POST,
// under BOSS_POST, counted as any foe's: dungeons/dungeonRecord.ts), so the
// gate's as it was after a save and a load; shut, it blocks the way
// (strongholds.ts) and what's seen through it. The king is the dungeon's boss
// (BOSS_POST): slain, a point to spend (once), his chest before his throne,
// the postern in the far wall open: the way out. The slain stay slain.

import { rollHoard, type Hoard } from '../loot/hoard';
import type { Enemy, EnemyKind, GameEvent, Hero } from '../types';
import { hashCell, mulberry32, oneOf } from '../../util/random';
import { ENEMY_STATS } from '../constants';
import { FACINGS, cellKey } from '../map/grid';
import { makeEnemy } from '../enemies/enemies';
import { EnemyDirector, type Ground } from '../enemies/enemyDirector';
import { isFloor } from '../dungeons/floorPlan';
import { BOSS_POST, CHEST_POST, SUMMONED } from '../dungeons/dungeonRecord';
import type { DungeonHooks } from '../dungeons/dungeonTypes';
import { DungeonFoes } from '../dungeons/dungeonFoes';
import { strongholdBlocks, type StrongholdInside } from './strongholds';
import { WINGS, middleOf, roomAt, type StrongholdRoom, type Wing } from './strongholdLayout';
import { chestSpot, kingSpot, solidTiles } from './strongholdProps';
import { kingName } from './strongholdNames';
import { strongholdMoves, type StrongholdFight, type StrongholdMoves, type StrongholdPost } from './strongholdMoves';
import { bossPiece } from './strongholdLoot';
import { kept } from '../../util/kept';

export const STRONGHOLD_FOE_ID = 5_000_000; // its foes' ids: this plus their post's number (clear of the world's, the quests', the crypts', the caves')
export const WING_BOSS = { kennels: 'houndmaster', stores: 'quartermaster', gaol: 'gaoler', barracks: 'captain' } as const satisfies Record<Wing, EnemyKind>;
export const WING_POST: Record<Wing, number> = { kennels: 9_000, stores: 9_001, gaol: 9_002, barracks: 9_003 }; // each wing's boss's place in the record of the slain (over any pack's, under BOSS_POST)
const NUDGE = 1.6; // tiles from the gate the hero's told it's barred
const SPREAD = 1.5; // tiles between a pack's, side by side

type PackKind = 'bruiser' | 'crossbowman' | 'firebrand' | 'sawbones' | 'runner' | 'warHound';
const FRONT: ReadonlySet<EnemyKind> = new Set(['bruiser', 'warHound']); // who stands before the rest, toward the way in

// Where a stronghold's foes stand, and what each is: its packs (their posts numbered from 0), then its four wings'
// bosses, then its king; from the seed and the stronghold, the same every time.
export function strongholdPosts(seed: number, inside: StrongholdInside): StrongholdPost[] {
  const { plan, props, stronghold } = inside;
  const rng = mulberry32(hashCell(stronghold.gate.x * 3 + 5, stronghold.gate.z * 7 + 2, seed + 5501));
  const maybe = (chance: number, kind: PackKind): PackKind[] => (rng() < chance ? [kind] : []);
  const solid = solidTiles(props);
  const taken = new Set<string>();
  const posts: StrongholdPost[] = [];
  const bosses: StrongholdPost[] = [];
  let packs = 0;
  // The open tile of `room` nearest (x, z): floor, nothing solid on it, no one posted there.
  const spot = (room: StrongholdRoom, x: number, z: number): { x: number; z: number } | null => {
    let best: { x: number; z: number } | null = null;
    for (let tx = room.x0; tx <= room.x1; tx++) {
      for (let tz = room.z0; tz <= room.z1; tz++) {
        if (!isFloor(plan, tx, tz) || solid.has(cellKey(tx, tz)) || taken.has(cellKey(tx, tz))) continue;
        if (!best || Math.hypot(tx - x, tz - z) < Math.hypot(best.x - x, best.z - z)) best = { x: tx, z: tz };
      }
    }
    return best;
  };
  // A pack in `room`, about (cx, cz): those of the front a little toward the way in, the rest behind, side by side.
  const pack = (room: StrongholdRoom, index: number, kinds: readonly PackKind[], cx: number, cz: number, deep: number) => {
    const [fx, fz] = FACINGS[room.from];
    const lines = [kinds.filter((k) => FRONT.has(k)), kinds.filter((k) => !FRONT.has(k))];
    lines.forEach((line, behind) => line.forEach((kind, n) => {
      const [along, across] = [(behind ? -1 : 1) * deep, (n - (line.length - 1) / 2) * SPREAD];
      const at = spot(room, cx + fx * along + fz * across, cz + fz * along + fx * across);
      if (!at) return;
      taken.add(cellKey(at.x, at.z));
      posts.push({ ...at, kind, room: index, pack: packs, post: posts.length });
    }));
    packs++;
  };
  plan.rooms.forEach((room, index) => {
    const mid = middleOf(room);
    const deep = (room.from % 2 ? room.x1 - room.x0 : room.z1 - room.z0) * 0.2; // how far before and behind its middle its lines stand
    if (room.kind === 'hub') pack(room, index, ['bruiser', 'crossbowman', 'crossbowman', ...maybe(0.5, 'runner')], mid.x, room.z0 + 3, 1.5); // (the watch, before the gated way)
    else if (room.kind === 'room') {
      if (room.wing === 'kennels') pack(room, index, ['warHound', 'warHound', ...maybe(0.6, 'warHound'), oneOf(['bruiser', 'crossbowman'] as const, rng()), ...maybe(0.4, 'crossbowman')], mid.x, mid.z, deep);
      else {
        const behind: PackKind[] = rng() < 0.6 ? ['firebrand', ...maybe(0.5, 'sawbones')] : ['sawbones']; // (a mix, always: one to burn or one to mend, or both)
        pack(room, index, ['bruiser', 'crossbowman', ...behind, ...maybe(0.35, 'runner'), ...maybe(0.15, 'warHound')], mid.x, mid.z, deep);
      }
    } else if (room.kind === 'side') pack(room, index, room.wing === 'kennels' ? ['warHound', 'warHound'] : [oneOf(['runner', 'firebrand', 'crossbowman'] as const, rng()), oneOf(['sawbones', 'bruiser'] as const, rng())], mid.x, mid.z, 0.6);
    else if (room.kind === 'boss') {
      const wing = room.wing!;
      const at = spot(room, mid.x, mid.z)!;
      taken.add(cellKey(at.x, at.z));
      bosses.push({ ...at, kind: WING_BOSS[wing], room: index, pack: packs, post: WING_POST[wing] });
      pack(room, index, wing === 'kennels' ? ['warHound', 'warHound'] : ['bruiser', 'crossbowman'], mid.x, mid.z, 2); // (his guard: either side, before and behind him)
    } else if (room.kind === 'great') {
      const king = kingSpot(plan);
      bosses.push({ ...king, kind: 'banditKing', room: index, pack: packs, post: BOSS_POST });
      pack(room, index, ['bruiser', 'bruiser', 'sawbones'], king.x, king.z + 2, 1);
    }
  });
  const order = (p: StrongholdPost) => (p.post === BOSS_POST ? WINGS.length : WINGS.findIndex((w) => WING_POST[w] === p.post));
  return [...posts, ...bosses.sort((a, b) => order(a) - order(b))];
}

// How many foes a stronghold has, all told (its packs and its wings' bosses: the king besides).
const counted = kept<StrongholdInside, number>();
export const strongholdFoeCount = (seed: number, inside: StrongholdInside): number => counted(inside, () => strongholdPosts(seed, inside).length - 1);

// What the king's chest holds: his own axe, found nowhere else (strongholdLoot.ts), and coins by the stronghold's level.
export const strongholdHoard = (inside: StrongholdInside, seed: number): Hoard =>
  ({ ...rollHoard(inside.stronghold.gate.x, inside.stronghold.gate.z, seed + 5519, inside.stronghold.level, { worth: 150, base: 90, spread: 60 }), item: bossPiece('banditKing', inside.stronghold.level)! });

export class StrongholdRun extends DungeonFoes {
  readonly foes: Enemy[];
  readonly director: EnemyDirector;
  readonly moves: StrongholdMoves; // what its foes do past any foe's (strongholdMoves.ts), for the view to draw
  king: Enemy | null = null; // standing (null once slain)
  protected readonly posts: number; // all its posts
  private readonly placed = new Map<Enemy, StrongholdPost>(); // where each was posted (one called up: where whoever called it was)
  private readonly bosses = new Map<Wing, Enemy>(); // the wings', standing
  private summoned = 0;
  private told = false; // the hero's been told the gate's barred (till they walk off from it)

  constructor(
    seed: number,
    private readonly inside: StrongholdInside,
    slain: Set<number>, // of its posts, those slain (kept: the save's)
    hero: Hero,
    hooks: DungeonHooks,
    makeMoves: (fight: StrongholdFight) => StrongholdMoves = strongholdMoves,
  ) {
    super(seed, slain, hooks, { firstId: STRONGHOLD_FOE_ID, chestReach: 1.1, drop: { x: 0.4, z: 0.5 } });
    const { stronghold, plan } = inside;
    const posts = strongholdPosts(seed, inside);
    this.posts = posts.length - 1;
    this.foes = [];
    for (const post of posts) {
      if (slain.has(post.post)) continue;
      const foe = makeEnemy(STRONGHOLD_FOE_ID + post.post, post.kind, post.x, post.z, post.x, post.z, stronghold.level + (post.post === BOSS_POST ? 1 : 0)); // (the king a level over his men, as a camp's chief)
      if (post.post === BOSS_POST) this.king = Object.assign(foe, { name: kingName(stronghold.gate, seed) });
      const wing = WINGS.find((w) => WING_POST[w] === post.post);
      if (wing) this.bosses.set(wing, foe);
      this.placed.set(foe, post);
      this.foes.push(foe);
    }
    if (slain.has(BOSS_POST)) this.chest = { ...chestSpot(plan), open: slain.has(CHEST_POST) };
    inside.shut = this.gateShut; // (the gate shut, or open already: before anything moves)
    const ground: Ground = {
      isBlocked: (x, z, r) => strongholdBlocks(inside, x, z, r),
      blocksSight: (x, z) => !isFloor(plan, Math.round(x), Math.round(z)) || (inside.shut && inside.gateKeys.has(cellKey(Math.round(x), Math.round(z)))),
    };
    this.director = new EnemyDirector(this.foes, hero, ground, { width: plan.width, depth: plan.depth }, () => 0, (foe) => void (this.moves.strike(foe) || this.hooks.strike(foe)), true);
    this.moves = makeMoves(this.fight(hero));
  }

  // What its foes' moves are handed (strongholdMoves.ts: the seam).
  private fight(hero: Hero): StrongholdFight {
    const { inside } = this;
    const standing = { king: () => this.king, gateShut: () => this.gateShut }; // (asked each time: as they are then)
    return {
      hero,
      foes: this.foes,
      hooks: this.hooks,
      director: this.director,
      plan: inside.plan,
      props: inside.props,
      name: inside.stronghold.name,
      level: inside.stronghold.level,
      get king() { return standing.king(); },
      get gateShut() { return standing.gateShut(); },
      bossOf: (wing) => this.bossOf(wing),
      roomAt: (x, z) => roomAt(inside.plan, x, z),
      placeOf: (foe) => this.placed.get(foe) ?? null,
      packOf: (foe) => this.packOf(foe),
      blocked: (x, z, r) => strongholdBlocks(inside, x, z, r),
      summon: (kind, x, z, by) => this.summon(kind, x, z, by),
      fly: (shot, how, dt, strike) => this.flyShot(shot, how, dt, (x, z) => strongholdBlocks(inside, x, z, 0.02), strike),
    };
  }

  standing(foe: Enemy): Enemy {
    foe.y = 0;
    return foe;
  }

  update(dt: number): void {
    const hero = this.director.quarry;
    this.bar(hero);
    this.director.update(dt);
    this.moves.update(dt);
    for (const [wing, boss] of this.bosses) if (boss.state === 'dead') this.bosses.delete(wing);
    if (this.king?.state === 'dead') {
      this.chest = { ...chestSpot(this.inside.plan), open: false }; // his chest, before his throne
      this.king = null;
    }
  }

  // A wing's boss, standing (null once slain).
  bossOf(wing: Wing): Enemy | null {
    return this.bosses.get(wing) ?? null;
  }

  // Which of the four wings' bosses still stand (by the record of the slain).
  get wingsLeft(): Wing[] {
    return WINGS.filter((wing) => !this.slain.has(WING_POST[wing]));
  }

  // Whether the great hall's gate is shut: till the four wings' bosses are slain (or the king is, however that came about).
  get gateShut(): boolean {
    return this.wingsLeft.length > 0 && !this.slain.has(BOSS_POST);
  }

  // The gate opening, as the last of the four falls (told); while it's shut, the hero walking up to it told so, and
  // how many still stand (once, till they walk off from it).
  private bar(hero: Hero): void {
    const shut = this.gateShut;
    if (this.inside.shut && !shut) this.hooks.report({ kind: 'unbarred' });
    this.inside.shut = shut;
    if (!shut) return;
    const far = Math.min(...this.inside.plan.gate.map((t) => Math.hypot(hero.x - t.x, hero.z - t.z)));
    if (far < NUDGE && !this.told) this.hooks.report({ kind: 'barred', left: this.wingsLeft.length });
    if (far < NUDGE) this.told = true;
    else if (far > NUDGE * 2) this.told = false;
  }

  // Those of a foe's pack still standing (itself among them, if it is).
  packOf(foe: Enemy): Enemy[] {
    const pack = this.placed.get(foe)?.pack;
    return pack === undefined ? [foe].filter((f) => f.state !== 'dead') : this.foes.filter((f) => f.state !== 'dead' && this.placed.get(f)?.pack === pack);
  }

  // One called up mid-fight (its moves': strongholdMoves.ts), at (x, z) or the nearest spot it could stand, set on the
  // hero: never counted, never kept (its id from SUMMONED up); of `by`'s pack, if someone called it.
  summon(kind: EnemyKind, x: number, z: number, by?: Enemy): Enemy | null {
    const r = ENEMY_STATS[kind].radius;
    const at = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]].map(([dx, dz]) => ({ x: x + dx, z: z + dz })).find((s) => !strongholdBlocks(this.inside, s.x, s.z, r));
    if (!at) return null;
    const foe: Enemy = { ...makeEnemy(STRONGHOLD_FOE_ID + SUMMONED + this.summoned++, kind, at.x, at.z, at.x, at.z, this.inside.stronghold.level), state: 'chase' };
    const post = by && this.placed.get(by);
    if (post) this.placed.set(foe, post);
    this.foes.push(foe);
    return foe;
  }

  // One slain: its post kept, what's told of it (dungeonFoes.ts); and its moves told too (a pack's, a boss's).
  slay(enemy: Enemy, hero: Hero): GameEvent[] {
    const told = super.slay(enemy, hero);
    this.moves.slain(enemy);
    return told;
  }

  free(x: number, z: number, r: number): boolean {
    return !strongholdBlocks(this.inside, x, z, r);
  }

  protected get bossFell(): string {
    return 'The bandit king slain';
  }

  protected cleared(point: boolean): GameEvent {
    return { kind: 'cleared', name: this.inside.stronghold.name, point, place: 'stronghold' };
  }

  // The postern in the great hall's far wall, opened once the king's slain: where to stand for it (or null).
  get exitOpen(): { x: number; z: number } | null {
    return this.slain.has(BOSS_POST) ? this.inside.exit.spot : null;
  }

  // His chest: a fine piece and coins by the stronghold's level.
  protected hoard(): Hoard {
    return strongholdHoard(this.inside, this.seed);
  }
}
