// The reliquary's dead while the hero's down there (a dungeon's run: dungeons/dungeonTypes.ts), at their posts on its
// plan (reliquaryPlan.ts: the same every time): skeletons and bowmen in the bone nave and along the ways; the Unquiet
// Brothers by the walls they pray in; the gilded saints on their plinths, still till the hero comes near (or strikes
// one), then up. Their moves (reliquaryMoves.ts): the Brothers' prayers mending the dead round them, the saints'
// smash. Each of its places told by name as the hero first comes into it. And in the sanctum the Gilded Deacon, formed
// out of his shrine of relics the moment the hero comes in (none before: the shrine a heap of reliquaries): his
// fight turning three times (DEACON_TURNS), a reliquary breaking off him at each: the bone casket (its dead got up),
// the saint's arm (his souls loosed), the finger (his rage). Slain: the reliquary cleared, the way out open behind the
// shrine, and his chest before it. The slain stay slain (the save's record, by post: dungeons/dungeonRecord.ts).

import type { Enemy, GameEvent, Hero } from '../types';
import type { DungeonHooks } from '../dungeons/dungeonTypes';
import { DungeonFoes } from '../dungeons/dungeonFoes';
import { BOSS_POST, CHEST_POST, SUMMONED } from '../dungeons/dungeonRecord';
import { rollHoard, type Hoard } from '../loot/hoard';
import { makeEnemy } from '../enemies/enemies';
import { EnemyDirector, type Ground } from '../enemies/enemyDirector';
import { ToldMoves, knockAway, type Told } from '../enemies/toldMoves';
import { isFloor } from '../dungeons/floorPlan';
import { ENEMY_STATS } from '../constants';
import { CHARGE_KNOCK, SWEEP_KNOCK } from '../crypts/cryptLord';
import type { Arrow, Soul } from '../crypts/cryptFoes';
import { PLACES, placeAt, type ReliquaryPlace } from './reliquaryPlan';
import { floorHeight, wayOut } from './reliquaryProps';
import { reliquaryBlocks, type ReliquaryInside } from './reliquary';
import {
  DEACON_BARRAGE, DEACON_CALLS, DEACON_ERUPTION, DEACON_FROM, DEACON_RAGE_COOLDOWN, DEACON_SLAM, DEACON_SWEEP, DEACON_TURNS, PRAYER, PRAYER_MENDS, PRAYER_REACH, SAINT_SMASH, SMASH_KNOCK, deaconCharge,
} from './reliquaryMoves';

export const RELIQUARY_FOE_ID = 6_000_000; // its dead's ids: this plus their post's number (clear of the world's, the quests', the other dungeons')
export const DEACON = 'The Gilded Deacon';
const SAINT_WAKES = 2.4; // tiles from a saint on its plinth the hero wakes it
const ARROW = { speed: 7, hit: 0.22, range: 10 }; // a bowman's arrow (as a crypt's)
const SOUL = { speed: 2.6, turn: 1.3, hit: 0.28, life: 4.5 }; // one of his souls (as a crypt lord's)

export type ReliquaryKind = 'skeleton' | 'skeletonArcher' | 'unquietBrother' | 'gildedSaint';
const OF_MARK: Record<string, ReliquaryKind> = { s: 'skeleton', a: 'skeletonArcher', b: 'unquietBrother', g: 'gildedSaint' };

// What's told coming into each place, the first time each time down.
const TOLD: Record<ReliquaryPlace, string> = {
  nave: 'Bone on bone, wall to wall: the bishop\'s ossuary',
  westChapel: 'A saint on its plinth, gilt to the knuckles',
  eastChapel: 'A saint on its plinth, gilt to the knuckles',
  walk: 'They pray in the walls: cut them down before they\'re done',
  gallery: 'Four saints, and every one of them listening',
  oldDoor: 'Older than the cathedral, older than the bishops. It does not open',
  sanctum: 'His shrine: every relic in the vault, heaped up',
};
const TURNS: ReadonlyArray<[title: string, line: string]> = [
  ['The bone casket breaks off his back', 'What was in it gets up'],
  ["The saint's arm breaks away", 'His souls come loose'],
  ['The finger falls from its monstrance', 'Only the deacon now, and raging'],
];

// Where its dead stand, and what each is: its plan's letters, in the map's order (their posts' numbers).
export const reliquaryPosts = (inside: Pick<ReliquaryInside, 'plan'>): Array<{ x: number; z: number; kind: ReliquaryKind }> =>
  inside.plan.marks.flatMap(({ x, z, mark }) => (OF_MARK[mark] ? [{ x, z, kind: OF_MARK[mark] }] : []));

// Where the Deacon forms (on the dais before his shrine) and his chest stands, once he's slain.
export const deaconSpot = (inside: Pick<ReliquaryInside, 'plan'>): { x: number; z: number } => {
  const d = inside.plan.marks.find((m) => m.mark === 'D')!;
  return { x: d.x + 0.5, z: d.z };
};

// What his chest holds: a fine piece (the Reliquary's, half the time) and coins by the reliquary's level, a charm.
export const deaconHoard = (inside: ReliquaryInside, seed: number): Hoard =>
  rollHoard(deaconSpot(inside).x * 2, deaconSpot(inside).z, seed + 7717, inside.place.level, { worth: 150, base: 90, spread: 60, keeper: 'gildedDeacon', dark: true });

export class ReliquaryRun extends DungeonFoes {
  readonly foes: Enemy[];
  readonly director: EnemyDirector;
  readonly arrows: Arrow[] = []; // its bowmen's, flying
  readonly souls: Soul[] = []; // the Deacon's, drifting after the hero
  deacon: Enemy | null = null; // formed, standing
  readonly prayers = new ToldMoves(PRAYER, (brother) => this.pray(brother));
  readonly smashes = new ToldMoves(SAINT_SMASH, (saint, m) => this.hooks.blow(saint, Math.round(saint.damage * 1.6), knockAway(m, this.director.quarry, SMASH_KNOCK)));
  readonly slams = new ToldMoves(DEACON_SLAM, (deacon) => this.hooks.blow(deacon, deacon.damage * 2));
  readonly sweeps = new ToldMoves(DEACON_SWEEP, (deacon, m) => this.hooks.blow(deacon, Math.round(deacon.damage * 1.5), knockAway(m, this.director.quarry, SWEEP_KNOCK)));
  readonly charges: ToldMoves;
  readonly eruptions = new ToldMoves(DEACON_ERUPTION, (deacon) => this.hooks.blow(deacon, Math.round(deacon.damage * 1.5)));
  readonly barrages = new ToldMoves(DEACON_BARRAGE, (deacon, m) => this.loosesSouls(deacon, m));
  protected readonly posts: number;
  private broken = 0; // reliquaries broken off him
  private called = 0;
  private readonly told = new Set<ReliquaryPlace>(); // places told of, this time down
  private saintsTold = false;
  readonly way: { door: { x: number; z: number }; spot: { x: number; z: number } };

  constructor(
    seed: number,
    private readonly inside: ReliquaryInside,
    slain: Set<number>, // of its posts, those slain (kept: the save's)
    hero: Hero,
    hooks: DungeonHooks,
  ) {
    super(seed, slain, hooks, { firstId: RELIQUARY_FOE_ID, chestReach: 1, drop: { x: 0.35, z: 0.4 } });
    const posts = reliquaryPosts(inside);
    this.posts = posts.length;
    this.foes = posts.flatMap((p, i) => (slain.has(i) ? [] : [this.standing(makeEnemy(RELIQUARY_FOE_ID + i, p.kind, p.x, p.z, p.x, p.z, inside.place.level))]));
    if (slain.has(BOSS_POST)) this.chest = { ...deaconSpot(inside), open: slain.has(CHEST_POST) };
    this.way = wayOut(inside.plan);
    const blocked = (x: number, z: number, r: number) => reliquaryBlocks(inside, x, z, r);
    this.charges = new ToldMoves(deaconCharge((x, z) => blocked(x, z, 0.24)), (deacon, m) => this.hooks.blow(deacon, Math.round(deacon.damage * 1.5), { dx: m.dx * CHARGE_KNOCK, dz: m.dz * CHARGE_KNOCK }));
    const ground: Ground = { isBlocked: blocked, blocksSight: (x, z) => !isFloor(inside.plan, Math.round(x), Math.round(z)) };
    const size = { width: inside.plan.width, depth: inside.plan.depth };
    this.director = new EnemyDirector(this.foes, hero, ground, size, (x, z) => floorHeight(inside.props, x, z), (e) => (e.kind === 'skeletonArcher' ? this.loose(e, hero) : this.hooks.strike(e)), true);
  }

  standing(foe: Enemy): Enemy {
    foe.y = floorHeight(this.inside.props, foe.x, foe.z);
    return foe;
  }

  update(dt: number): void {
    const hero = this.director.quarry;
    if (!hero.knock) hero.y = floorHeight(this.inside.props, hero.x, hero.z); // (up on the dais, a plinth)
    this.tell(hero);
    this.wakeSaints(hero);
    this.holdDeacon(hero);
    for (const brother of this.foes) if (brother.kind === 'unquietBrother') brother.cooldown = Math.max(brother.cooldown, 1); // (a Brother never strikes: he prays)
    this.director.update(dt);
    this.turn();
    const told = [this.prayers, this.smashes, this.slams, this.sweeps, this.charges, this.eruptions, this.barrages];
    const from = new Map<ToldMoves, number>([[this.sweeps, DEACON_FROM.sweep], [this.charges, DEACON_FROM.charge], [this.barrages, DEACON_FROM.barrage], [this.eruptions, DEACON_FROM.eruption]]);
    for (const moves of told) moves.update(this.foes, hero, dt, (foe) => told.some((other) => other !== moves && other.doing(foe)) || this.broken < (from.get(moves) ?? 0)); // (one at a time; his, as he's broken)
    if (this.deacon?.state === 'dead') {
      this.chest = { ...deaconSpot(this.inside), open: false }; // his chest, where he formed
      this.deacon = null;
    }
    for (let i = this.arrows.length - 1; i >= 0; i--) if (this.fly(this.arrows[i], dt)) this.arrows.splice(i, 1);
    for (let i = this.souls.length - 1; i >= 0; i--) if (this.drift(this.souls[i], dt)) this.souls.splice(i, 1);
  }

  // Each place told by name as the hero first comes into it; the sanctum, the Deacon formed (if he's not been slain).
  private tell(hero: Hero): void {
    const place = placeAt(hero.x, hero.z);
    if (!place || this.told.has(place)) return;
    this.told.add(place);
    this.hooks.report({ kind: 'banner', title: PLACES[place].name, line: TOLD[place] });
    if (place === 'sanctum' && !this.deacon && !this.slain.has(BOSS_POST)) this.form(hero);
  }

  // The Deacon formed out of his shrine, two levels over the reliquary, and set on the hero.
  private form(hero: Hero): void {
    const at = deaconSpot(this.inside);
    const deacon = this.standing({ ...makeEnemy(RELIQUARY_FOE_ID + BOSS_POST, 'gildedDeacon', at.x, at.z, at.x, at.z, this.inside.place.level + 2), name: DEACON, state: 'chase', lastSeen: { x: hero.x, z: hero.z } });
    this.foes.push(deacon);
    this.deacon = deacon;
    this.hooks.report({ kind: 'rises', name: DEACON });
  }

  // The Deacon, formed, never letting the hero be while they're in his sanctum (as a crypt's lord in his hall).
  private holdDeacon(hero: Hero): void {
    const deacon = this.deacon;
    if (deacon && deacon.state === 'wander' && placeAt(hero.x, hero.z) === 'sanctum') Object.assign(deacon, { state: 'chase', lastSeen: { x: hero.x, z: hero.z }, lostFor: 0, target: null });
  }

  // The saints on their plinths, the hero come near: up, and on them (told, the first time).
  private wakeSaints(hero: Hero): void {
    for (const saint of this.foes) {
      if (saint.kind !== 'gildedSaint' || saint.state !== 'wander' || Math.hypot(hero.x - saint.x, hero.z - saint.z) > SAINT_WAKES) continue;
      Object.assign(saint, { state: 'chase', lastSeen: { x: hero.x, z: hero.z }, lostFor: 0, target: null });
      if (!this.saintsTold) this.hooks.report({ kind: 'banner', title: 'A saint gets up', line: 'Gilt bones, and a grudge' });
      this.saintsTold = true;
    }
  }

  // His turns: each reliquary off him as his health falls past it, told; the first, its dead got up round him; the
  // last, his rage.
  private turn(): void {
    const deacon = this.deacon;
    if (!deacon || deacon.state === 'dead') return;
    const broken = DEACON_TURNS.filter((share) => deacon.hp <= deacon.maxHp * share).length;
    while (this.broken < broken) {
      const [title, line] = TURNS[this.broken++];
      this.hooks.report({ kind: 'banner', title, line });
      if (this.broken === 1) this.outOfTheCasket(deacon);
    }
    if (this.broken >= 3) deacon.cooldown = Math.min(deacon.cooldown, DEACON_RAGE_COOLDOWN);
  }

  // The dead out of the bone casket, round him, on the hero: never counted, never kept.
  private outOfTheCasket(at: { x: number; z: number }): void {
    for (let k = 0; k < DEACON_CALLS; k++) {
      const a = (k / DEACON_CALLS) * Math.PI * 2 + 0.3;
      const [x, z] = [at.x + Math.cos(a) * 1.1, at.z + Math.sin(a) * 1.1];
      const spot = this.free(x, z, ENEMY_STATS.skeleton.radius) ? { x, z } : at;
      this.foes.push(this.standing({ ...makeEnemy(RELIQUARY_FOE_ID + SUMMONED + this.called++, 'skeleton', spot.x, spot.z, spot.x, spot.z, this.inside.place.level), state: 'chase' }));
    }
  }

  // A Brother's prayer said: the dead round him mended (never the Deacon).
  private pray(brother: Enemy): void {
    for (const foe of this.foes) {
      if (foe.state === 'dead' || foe.kind === 'gildedDeacon' || Math.hypot(foe.x - brother.x, foe.z - brother.z) > PRAYER_REACH) continue;
      foe.hp = Math.min(foe.maxHp, foe.hp + Math.max(1, Math.round(foe.maxHp * PRAYER_MENDS)));
    }
  }

  // His souls loosed: three in a fan from him, toward the hero.
  private loosesSouls(deacon: Enemy, m: Told): void {
    const heading = Math.atan2(m.dz, m.dx);
    for (const spread of [-0.6, 0, 0.6]) {
      const a = heading + spread;
      this.souls.push({ x: deacon.x + Math.cos(a) * 0.4, z: deacon.z + Math.sin(a) * 0.4, dx: Math.cos(a), dz: Math.sin(a), age: 0, damage: Math.max(1, Math.round(deacon.damage * 0.6)), by: deacon });
    }
  }

  // A soul on, turning slowly after the hero; striking them, lost at the rock, or spent. True once done.
  private drift(soul: Soul, dt: number): boolean {
    const hero = this.director.quarry;
    soul.age += dt;
    let turn = Math.atan2(hero.z - soul.z, hero.x - soul.x) - Math.atan2(soul.dz, soul.dx);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const a = Math.atan2(soul.dz, soul.dx) + Math.max(-SOUL.turn * dt, Math.min(SOUL.turn * dt, turn));
    [soul.dx, soul.dz] = [Math.cos(a), Math.sin(a)];
    soul.x += soul.dx * SOUL.speed * dt;
    soul.z += soul.dz * SOUL.speed * dt;
    if (Math.hypot(hero.x - soul.x, hero.z - soul.z) < SOUL.hit) return this.hooks.blow(soul.by, soul.damage), true;
    return soul.age > SOUL.life || reliquaryBlocks(this.inside, soul.x, soul.z, 0.02);
  }

  // A bowman looses at where the hero stands now.
  private loose(archer: Enemy, hero: Hero): void {
    const d = Math.hypot(hero.x - archer.x, hero.z - archer.z);
    if (d < 1e-6) return;
    const [dx, dz] = [(hero.x - archer.x) / d, (hero.z - archer.z) / d];
    this.arrows.push({ x: archer.x + dx * 0.25, z: archer.z + dz * 0.25, dx, dz, flown: 0, damage: archer.damage });
  }

  private fly(arrow: Arrow, dt: number): boolean {
    return this.flyShot(arrow, ARROW, dt, (x, z) => reliquaryBlocks(this.inside, x, z, 0.02), () => this.hooks.arrow(arrow));
  }

  // How many reliquaries are off him (0..3).
  get brokenOff(): number {
    return this.broken;
  }

  free(x: number, z: number, r: number): boolean {
    return !reliquaryBlocks(this.inside, x, z, r);
  }

  protected get bossFell(): string {
    return `${DEACON} slain`;
  }

  protected cleared(point: boolean): GameEvent {
    return { kind: 'cleared', name: this.inside.place.name, point, place: 'reliquary' };
  }

  protected hoard(): Hoard {
    return deaconHoard(this.inside, this.seed);
  }

  // The way out behind the shrine, open once he's slain: where to stand for it (or null, shut).
  get exitOpen(): { x: number; z: number } | null {
    return this.slain.has(BOSS_POST) ? this.way.spot : null;
  }
}
