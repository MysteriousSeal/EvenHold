// A cave's beasts while the hero's down there (a dungeon's run:
// dungeons/dungeonTypes.ts): where they lie in wait, from the seed and the
// cave (bats nearer the mouth, spiders in its middle reaches and every den,
// worms deeper in; one along the burrows every so often; none near the way up,
// none in the nest but her), run as any foes (enemies.ts, their own director
// on the cave's floor) and their told moves (caveMoves.ts):
// - spiders spit webs (flying at the hero, webbing them) and lunge;
// - bats flit as they come, and dart back off once they've bitten;
// - worms go underground (unseen, unstruck), burst up under the hero (told:
//   the ground heaving), stay up a while (SURFACED) to be fought, then dig
//   down again;
// - the brood mother, still on her silk till the hero comes into her nest (or
//   strikes her), spits volleys and charges; at two thirds of her health and
//   at one third, her brood hatches from the egg sacs. Slain: her hoard, the
//   crack to the daylight open, the cave cleared. The slain stay slain (the
//   save's record, by post: dungeons/dungeonRecord.ts).

import { rollHoard, type Hoard } from '../loot/hoard';
import type { Enemy, GameEvent, Hero } from '../types';
import { hashCell, mulberry32 } from '../../util/random';
import { cellKey } from '../map/grid';
import { makeEnemy } from '../enemies/enemies';
import { EnemyDirector, type Ground } from '../enemies/enemyDirector';
import { ToldMoves, knockAway } from '../enemies/toldMoves';
import { isFloor } from '../dungeons/floorPlan';
import { BOSS_POST, CHEST_POST, SUMMONED } from '../dungeons/dungeonRecord';
import type { DungeonHooks } from '../dungeons/dungeonTypes';
import { DungeonFoes } from '../dungeons/dungeonFoes';
import { caveBlocks, type CaveInside } from './caves';
import { reachedFrom, solidTiles } from './caveProps';
import type { Hollow } from './caveLayout';
import { ERUPT, ERUPT_KNOCK, LUNGE_KNOCK, RUSH_KNOCK, SPIT, SURFACED, VOLLEY, VOLLEY_SPREAD, WEB_HIT, WEB_RANGE, WEB_SPEED, lungeMove, rushMove } from './caveMoves';
import { kept } from '../../util/kept';

export const CAVE_FOE_ID = 4_000_000; // its beasts' ids: this plus their post's number (clear of the world's, the quests', the crypts')
const CLEAR_OF_WAY_UP = 7; // tiles from the way up no beast lies
export const TEARS_AT = 0.8; // the share of the cave cleared when the silk walling the nest off tears (as a crypt's lord rises)
const NUDGE = 1.4; // tiles from the silk the hero's told it holds
const BURROW_EVERY = 12; // tiles of burrow to a beast along it, about
const BROOD_AT = [2 / 3, 1 / 3]; // of her health, under each: her brood hatches
const BROOD = 3; // hatchlings each time, from the egg sacs nearest her
const BAT_FLIT = 0.9; // tiles a second a bat flits across its way
const BAT_DART = 0.6; // tiles it darts back, having bitten

export type BeastKind = 'caveSpider' | 'caveBat' | 'caveWorm';
export interface Post {
  x: number;
  z: number;
  kind: BeastKind;
}

// A web in flight: spat by a spider (or the brood mother), flying straight on till it catches the hero or hits the rock.
export interface Web {
  x: number;
  z: number;
  dx: number;
  dz: number;
  flown: number;
  by: Enemy;
}

// Where a cave's beasts lie in wait, and what each is: from the seed and the cave, the same every time.
export function cavePosts(seed: number, inside: CaveInside): Post[] {
  const { plan, props, cave } = inside;
  const rng = mulberry32(hashCell(cave.mouth.x * 3 + 7, cave.mouth.z * 5 + 1, seed + 9011));
  const solid = solidTiles(props);
  const taken = new Set<string>();
  const nest = plan.hollows.find((h) => h.kind === 'nest')!;
  const deep = (z: number) => 1 - z / Math.max(1, plan.depth - 1);
  const outside = reachedFrom(plan, new Set([...solid, ...inside.sealKeys])); // (this side of the silk walling the nest off: none walled in with her)
  const open = (x: number, z: number) =>
    outside.has(cellKey(x, z)) && !taken.has(cellKey(x, z)) && Math.hypot(x - nest.x, z - nest.z) > nest.r + 1.5 && Math.hypot(x - plan.door, z - (plan.depth - 1)) > CLEAR_OF_WAY_UP;
  const posts: Post[] = [];
  const post = (x: number, z: number, kind: BeastKind) => {
    taken.add(cellKey(x, z));
    posts.push({ x, z, kind });
  };
  // `kinds` in a hollow, on open floor, picked from the rng.
  const fill = (h: Hollow, kinds: BeastKind[]) => {
    const spots: Array<[number, number]> = [];
    for (let x = Math.floor(h.x - h.r); x <= Math.ceil(h.x + h.r); x++) for (let z = Math.floor(h.z - h.r); z <= Math.ceil(h.z + h.r); z++) if (open(x, z)) spots.push([x, z]);
    for (const kind of kinds) {
      if (spots.length === 0) return;
      const [x, z] = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      if (open(x, z)) post(x, z, kind);
    }
  };
  for (const h of plan.hollows) {
    const d = deep(h.z);
    if (h.kind === 'den') fill(h, ['caveSpider', 'caveSpider', ...(rng() < 0.5 ? (['caveSpider'] as const) : [])]); // (a den: spiders')
    else if (h.kind === 'chamber') {
      if (d < 0.35) fill(h, ['caveBat', 'caveBat', ...(rng() < 0.6 ? (['caveBat'] as const) : [])]);
      else if (d < 0.65) fill(h, ['caveSpider', 'caveSpider', ...(rng() < 0.5 ? (['caveBat'] as const) : [])]);
      else fill(h, ['caveWorm', 'caveSpider', ...(rng() < 0.5 ? (['caveSpider'] as const) : [])]);
    }
  }
  // Along the burrows, one every so often: a worm deep in, else a bat.
  for (const line of plan.burrows) {
    let run = 0;
    for (const [x, z] of line) {
      run += 0.5;
      if (run < BURROW_EVERY || !open(x, z)) continue;
      run = 0;
      post(x, z, deep(z) > 0.45 && rng() < 0.6 ? 'caveWorm' : 'caveBat');
    }
  }
  return posts;
}

// How many beasts a cave has, all told (its posts).
const counted = kept<CaveInside, number>();
export const beastCount = (seed: number, inside: CaveInside): number => counted(inside, () => cavePosts(seed, inside).length);

// What the brood mother's hoard holds: a fine piece (worth a hundred or more) and coins by the cave's level.
export const caveHoard = (inside: CaveInside, seed: number): Hoard =>
  rollHoard(inside.cave.mouth.x, inside.cave.mouth.z, seed + 9137, inside.cave.level, { worth: 100, base: 60, spread: 40 });

export class CaveRun extends DungeonFoes {
  readonly foes: Enemy[];
  readonly webs: Web[] = []; // in flight
  readonly director: EnemyDirector;
  readonly spits = new ToldMoves(SPIT, (spider, m) => this.spit(spider, m.dx, m.dz));
  readonly lunges: ToldMoves;
  readonly eruptions = new ToldMoves(ERUPT, (worm, m) => this.hooks.blow(worm, Math.round(worm.damage * 1.5), knockAway({ x: m.tx, z: m.tz }, this.director.quarry, ERUPT_KNOCK)));
  readonly volleys = new ToldMoves(VOLLEY, (mother, m) => [-1, 0, 1].forEach((k) => this.spit(mother, ...turned(m.dx, m.dz, k * VOLLEY_SPREAD))));
  readonly rushes: ToldMoves;
  mother: Enemy | null = null; // the nest's own (null once slain, or till then if slain before)
  private readonly surfaced = new Map<Enemy, { left: number; x: number; z: number }>(); // a worm up out of the ground: seconds before it digs down, its hole (where it stays)
  protected readonly posts: number; // all its posts
  private broods = 0; // her brood hatched so many times
  private hatched = 0;
  private clock = 0; // seconds down here (the bats' flitting)
  private told = false; // the hero's been told the silk holds (till they walk off from it)

  constructor(
    seed: number,
    private readonly inside: CaveInside,
    slain: Set<number>, // of its posts, those slain (kept: the save's)
    hero: Hero,
    hooks: DungeonHooks,
  ) {
    super(seed, slain, hooks, { firstId: CAVE_FOE_ID, chestReach: 1.1, drop: { x: 0.35, z: 0.4 } });
    const posts = cavePosts(seed, inside);
    this.posts = posts.length;
    this.foes = posts.flatMap((p, i) => (slain.has(i) ? [] : [{ ...makeEnemy(CAVE_FOE_ID + i, p.kind, p.x, p.z, p.x, p.z, inside.cave.level), buried: p.kind === 'caveWorm' }]));
    const nest = this.nest;
    if (!slain.has(BOSS_POST)) {
      this.mother = makeEnemy(CAVE_FOE_ID + BOSS_POST, 'broodMother', nest.x, nest.z, nest.x, nest.z, inside.cave.level);
      this.foes.push(this.mother);
    } else this.chest = { x: nest.x, z: nest.z, open: slain.has(CHEST_POST) };
    inside.sealed = this.sealed; // (the silk whole, or torn already: before anything moves)
    const blocked = (x: number, z: number) => caveBlocks(inside, x, z, 0.2);
    this.lunges = new ToldMoves(lungeMove(blocked), (spider, m) => this.hooks.blow(spider, Math.round(spider.damage * 1.5), { dx: m.dx * LUNGE_KNOCK, dz: m.dz * LUNGE_KNOCK }));
    this.rushes = new ToldMoves(rushMove((x, z) => caveBlocks(inside, x, z, 0.32)), (mother, m) => this.hooks.blow(mother, Math.round(mother.damage * 1.5), { dx: m.dx * RUSH_KNOCK, dz: m.dz * RUSH_KNOCK }));
    const ground: Ground = {
      isBlocked: (x, z, r) => caveBlocks(inside, x, z, r),
      blocksSight: (x, z) => !isFloor(inside.plan, Math.round(x), Math.round(z)),
    };
    const size = { width: inside.plan.width, depth: inside.plan.depth };
    this.director = new EnemyDirector(this.foes, hero, ground, size, () => 0, (e) => this.bite(e), true);
  }

  private get nest(): Hollow {
    return this.inside.plan.hollows.find((h) => h.kind === 'nest')!;
  }

  standing(foe: Enemy): Enemy {
    foe.y = 0;
    return foe;
  }

  update(dt: number): void {
    const hero = this.director.quarry;
    this.clock += dt;
    this.tear(hero);
    this.wakeMother(hero);
    this.director.update(dt);
    for (const [worm, up] of this.surfaced) Object.assign(worm, { x: up.x, z: up.z }); // (up, it's rooted in its hole: turning, striking, not going)
    this.flit(dt);
    const moves = [this.spits, this.lunges, this.eruptions, this.volleys, this.rushes];
    for (const told of moves) {
      // One at a time; a worm bursts up only from underground, and does nothing else down there.
      told.update(this.foes, hero, dt, (foe) => moves.some((other) => other !== told && other.doing(foe)) || (foe.kind === 'caveWorm' && (told === this.eruptions) !== !!foe.buried));
    }
    this.surface(dt);
    this.brood();
    if (this.mother?.state === 'dead') {
      this.chest = { x: this.nest.x, z: this.nest.z, open: false }; // her hoard, where she lay
      this.mother = null;
    }
    for (let i = this.webs.length - 1; i >= 0; i--) if (this.fly(this.webs[i], dt)) this.webs.splice(i, 1);
  }

  // Whether the silk walling the nest off is whole: till most of the cave's cleared (TEARS_AT), or she's slain.
  get sealed(): boolean {
    return this.inside.seal.length > 0 && !this.slain.has(BOSS_POST) && this.share < TEARS_AT;
  }

  // The silk tearing, as the last of most of the cave's beasts falls (told); while it holds, the hero walking up to
  // it told so (once, till they walk off from it).
  private tear(hero: Hero): void {
    const sealed = this.sealed;
    if (this.inside.sealed && !sealed) this.hooks.report({ kind: 'torn' });
    this.inside.sealed = sealed;
    if (!sealed) return;
    const near = this.inside.seal.some((t) => Math.hypot(hero.x - t.x, hero.z - t.z) < NUDGE);
    if (near && !this.told) this.hooks.report({ kind: 'walled', share: this.share });
    if (!near && this.inside.seal.every((t) => Math.hypot(hero.x - t.x, hero.z - t.z) > NUDGE * 2)) this.told = false;
    else if (near) this.told = true;
  }

  // She stirs on her silk the moment the hero comes into her nest (struck first, she's up anyway: passive).
  private wakeMother(hero: Hero): void {
    const mother = this.mother;
    const nest = this.nest;
    if (!mother || mother.state !== 'wander' || Math.hypot(hero.x - nest.x, hero.z - nest.z) > nest.r + 0.5) return;
    Object.assign(mother, { state: 'chase', lastSeen: { x: hero.x, z: hero.z }, lostFor: 0, target: null });
    this.hooks.report({ kind: 'stirs', name: 'The brood mother' });
  }

  // A beast's bite lands (not a worm's from underground); a bat, having bitten, darts back off.
  private bite(beast: Enemy): void {
    if (beast.buried) return;
    this.hooks.strike(beast);
    if (beast.kind === 'caveBat') {
      const hero = this.director.quarry;
      const d = Math.hypot(beast.x - hero.x, beast.z - hero.z) || 1;
      this.director.move(beast, ((beast.x - hero.x) / d) * BAT_DART, ((beast.z - hero.z) / d) * BAT_DART);
    }
  }

  // Bats flit across their way as they come (never into the rock: the director's to stop them).
  private flit(dt: number): void {
    for (const bat of this.foes) {
      if (bat.kind !== 'caveBat' || bat.state !== 'chase') continue;
      const t = bat.id * 1.7 + this.clock; // (each its own)
      this.director.move(bat, Math.sin(t * 5.1) * BAT_FLIT * dt, Math.cos(t * 4.3) * BAT_FLIT * dt);
    }
  }

  // Worms burst up from an eruption stay up a while (to be fought), then dig down again (not mid-blow).
  private surface(dt: number): void {
    for (const worm of this.foes) {
      if (worm.kind !== 'caveWorm' || worm.state === 'dead') continue;
      if (worm.buried && worm.told === 'erupt' && (worm.windUp ?? 0) >= ERUPT.tell) {
        worm.buried = false;
        this.surfaced.set(worm, { left: SURFACED, x: worm.x, z: worm.z });
      }
      if (worm.buried || !this.surfaced.has(worm)) continue;
      const up = this.surfaced.get(worm)!;
      up.left -= dt;
      if (up.left <= 0 && worm.swingFor === null && !worm.told) {
        worm.buried = true;
        this.surfaced.delete(worm);
      }
    }
  }

  // Under two thirds of her health, and under one third: her brood hatches, from the egg sacs nearest her.
  private brood(): void {
    const mother = this.mother;
    if (!mother || mother.state !== 'chase' || this.broods >= BROOD_AT.length || mother.hp > mother.maxHp * BROOD_AT[this.broods]) return;
    this.broods++;
    const sacs = this.inside.props.filter((p) => p.kind === 'eggSac').sort((a, b) => Math.hypot(a.x - mother.x, a.z - mother.z) - Math.hypot(b.x - mother.x, b.z - mother.z));
    for (const sac of sacs.slice(0, BROOD)) {
      const spot = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dz]) => ({ x: sac.x + dx * 0.6, z: sac.z + dz * 0.6 })).find((s) => !caveBlocks(this.inside, s.x, s.z, 0.11));
      if (!spot) continue;
      this.foes.push({ ...makeEnemy(CAVE_FOE_ID + SUMMONED + this.hatched++, 'hatchling', spot.x, spot.z, spot.x, spot.z, this.inside.cave.level), state: 'chase' });
    }
    this.hooks.report({ kind: 'brood' });
  }

  // A web spat from `by` along (dx, dz).
  private spit(by: Enemy, dx: number, dz: number): void {
    this.webs.push({ x: by.x + dx * 0.3, z: by.z + dz * 0.3, dx, dz, flown: 0, by });
  }

  // A web on (dungeonFoes.ts flyShot); true once it's done.
  private fly(web: Web, dt: number): boolean {
    return this.flyShot(web, { speed: WEB_SPEED, hit: WEB_HIT, range: WEB_RANGE }, dt, (x, z) => caveBlocks(this.inside, x, z, 0.02), () => this.hooks.web(web.by));
  }

  free(x: number, z: number, r: number): boolean {
    return !caveBlocks(this.inside, x, z, r);
  }

  // Which post a beast lay at (for the save's record of the slain).
  static postOf(enemy: Enemy): number {
    return enemy.id - CAVE_FOE_ID;
  }

  protected get bossFell(): string {
    return 'The brood mother slain';
  }

  protected cleared(point: boolean): GameEvent {
    return { kind: 'cleared', name: this.inside.cave.name, point, place: 'cave' };
  }

  // The crack to the daylight in the nest's far wall, opened once she's slain: where to stand for it (or null).
  get exitOpen(): { x: number; z: number } | null {
    return this.slain.has(BOSS_POST) ? this.inside.exit.spot : null;
  }

  // Her hoard: a fine piece and coins by the cave's level.
  protected hoard(): Hoard {
    return caveHoard(this.inside, this.seed);
  }
}

// (dx, dz) turned by `a` radians.
function turned(dx: number, dz: number, a: number): [number, number] {
  return [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
}
