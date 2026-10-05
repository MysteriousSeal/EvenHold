// An arena for training a fighter (tests/ai/): a fight set up in a small world (the game's own model, its foes and
// their moves as ever), stepped a decision at a time. Each decision is one of 9 ways to go (still, or one of 8) and
// one of 4 moves (none, a blow, a roll that way, the guard held); what it sees is a fixed row of numbers (the hero,
// the ground round them, the nearest foes); what it's paid: damage dealt and foes slain, less damage taken, the fight
// won or lost (out of time: lost too). The same scenario and seed play the same every time.
import { GameModel } from '../../src/model/GameModel';
import { generateWorld } from '../../src/model/worldgen/world';
import type { World, Enemy, EnemyKind } from '../../src/model/types';
import { makeEnemy } from '../../src/model/enemies/enemies';
import { maxHpOf } from '../../src/model/hero/attributes';
import { POINTS_PER_LEVEL } from '../../src/model/hero/training';
import { STATS } from '../../src/model/hero/statKinds';
import { gearKey } from '../../src/model/human/items/gear';
import { ITEMS, type ItemId } from '../../src/model/human/equipment';
import { HERO_RADIUS } from '../../src/model/constants';
import { mulberry32 } from '../../src/util/random';
import type { MapSize } from '../../src/model/map/grid';

export const FRAME = 1 / 30;
export const FRAMES_PER_DECISION = 3; // a decision each tenth of a second
const TIME_LIMIT = 40; // game seconds a fight may last (then over: neither won nor lost)
const SIZE: MapSize = { width: 128, depth: 128 };
const WORLD_SEED = 11;

export const KINDS: readonly EnemyKind[] = ['wolf', 'bandit', 'banditChief', 'boar', 'skeleton', 'skeletonArcher', 'draugr', 'cryptLord', 'ghost', 'caveSpider', 'caveBat', 'caveWorm', 'hatchling', 'broodMother', 'bear', 'lynx'];
const TOLD = ['slam', 'breath', 'cleave', 'sweep', 'charge', 'eruption', 'barrage', 'web', 'lunge', 'erupt', 'volley', 'brood'] as const;
const NEAREST = 6; // foes seen, nearest first
const RAYS = 8; // ways round the hero the ground's felt, out to RAY_REACH
const RAY_REACH = 3;
const FOE_FEATURES = 1 + 4 + 2 + KINDS.length + 1 + 3 + 1 + TOLD.length;
export const OBSERVATION_SIZE = 9 + RAYS + NEAREST * FOE_FEATURES;
export const MOVES = 9; // still, or one of 8 ways
export const ACTIONS = 4; // none, a blow, a roll, the guard held
const WAYS: ReadonlyArray<[number, number]> = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.sin((i * Math.PI) / 4), Math.cos((i * Math.PI) / 4)] as [number, number])];

// A fight: the hero (their level, and whether they're kitted out as from the smith's), and the foes against them.
export interface Scenario {
  name: string;
  hero: number;
  kit: boolean;
  foes: Array<{ kind: EnemyKind; level: number }>;
}

// Fights to learn from, as the bots meet them: wolves alone and in packs, bandits, a camp's chief and his crew, the
// wilds' fiercer beasts; the hero from level 1 to 6, the foes about theirs.
export function randomScenario(rng: () => number): Scenario {
  const hero = 1 + Math.floor(rng() * 6);
  const near = () => Math.max(1, hero + Math.floor(rng() * 3) - 1);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  const many = (kind: EnemyKind, n: number) => Array.from({ length: n }, () => ({ kind, level: near() }));
  const fights: Array<() => Scenario['foes']> = [
    () => many('wolf', 1),
    () => many('wolf', 2 + Math.floor(rng() * 3)),
    () => many('bandit', 1 + Math.floor(rng() * 2)),
    () => [...many('banditChief', 1), ...many('bandit', 1 + Math.floor(rng() * 2))],
    () => many('boar', 1),
    () => many(pick(['bear', 'lynx'] as const), 1),
    () => [...many('wolf', 2), ...many('bandit', 1)],
  ];
  const foes = pick(fights)();
  return { name: foes.map((f) => f.kind).join('+'), hero, kit: rng() < 0.6, foes };
}

// Named fights (npm run ai:eval plays each, the watch page shows them in turn): wolves, bandits, a camp's chief and
// his crew, the wilds' fiercer beasts.
const many = (kind: EnemyKind, level: number, n: number) => Array.from({ length: n }, () => ({ kind, level }));
export const NAMED_FIGHTS: Scenario[] = [
  { name: 'a wolf, level 1, no kit', hero: 1, kit: false, foes: many('wolf', 1, 1) },
  { name: '3 wolves, level 1, no kit', hero: 1, kit: false, foes: many('wolf', 1, 3) },
  { name: '3 wolves, level 2, kit', hero: 2, kit: true, foes: many('wolf', 2, 3) },
  { name: '2 bandits, level 2, kit', hero: 2, kit: true, foes: many('bandit', 2, 2) },
  { name: 'a chief and 2 bandits, level 4, kit', hero: 4, kit: true, foes: [...many('banditChief', 4, 1), ...many('bandit', 4, 2)] },
  { name: 'a bear, level 3, kit', hero: 3, kit: true, foes: many('bear', 3, 1) },
  { name: 'a lynx, level 3, kit', hero: 3, kit: true, foes: many('lynx', 3, 1) },
];

let world: World | null = null; // the arena's ground, made once (each fight a fresh game on it)

export interface Step {
  observation: number[];
  reward: number;
  done: boolean; // won or lost
  truncated: boolean; // out of time
  info: { won: boolean; fell: boolean; dealt: number; taken: number; seconds: number };
}

export class Arena {
  model!: GameModel;
  scenario!: Scenario;
  private way: [number, number] = [0, 0]; // the way the hero's going, this decision
  private before = { hp: 0, foes: 0, alive: 0 }; // as it stood when the decision was made
  private foes: Enemy[] = [];
  private fell = false;
  private t = 0;
  private dealt = 0;
  private taken = 0;
  private totalFoeHp = 1;

  // A fresh fight: `scenario` (else one at random, from `seed`); in a fresh game, or (`keep`: the watch page, its view
  // built once) the same one, cleared.
  reset(seed: number, scenario?: Scenario, keep = false): number[] {
    const rng = mulberry32(seed);
    const fight = scenario ?? randomScenario(rng);
    this.scenario = fight;
    world ??= generateWorld(WORLD_SEED, SIZE);
    Math.random = mulberry32(seed ^ 0x5eed); // (chance in the fight: dodges, crits, from the seed)
    const model = keep && this.model ? this.model : new GameModel(WORLD_SEED, SIZE, world);
    this.model = model;
    this.fell = false;
    model.fall = () => void (this.fell = true); // (fallen: the fight's lost, there and then)
    model.travellers.list.splice(0); // (no guards on the road to join in)
    model.enemies.splice(0);
    model.groundHere.loot.splice(0); // (the last fight's drops)
    model.groundHere.coins.splice(0);
    model.moves.breath = model.moves.most;
    model.raiseGuard(false);
    const spot = arenaSpot(model, rng);
    model.teleport(spot.x, spot.z);
    const { hero } = model;
    hero.level = fight.hero;
    hero.statPoints = 0;
    const points = POINTS_PER_LEVEL * (fight.hero - 1);
    for (let i = 0; i < points; i++) hero.trained[STATS[i % STATS.length]]++; // (spread evenly, as a player might)
    hero.equipment = {};
    if (fight.kit) for (const item of ['armingSword', 'buckler', 'gambeson', 'leatherCap'] as ItemId[]) hero.equipment[ITEMS[item].slot] = gearKey({ item, level: fight.hero, rarity: 'common', roll: 0 });
    hero.hp = maxHpOf(hero);
    hero.energy = 100;
    this.foes = fight.foes.map((f, i) => {
      // (on open ground round the hero, a few tiles off: tried at random, else beside them)
      let [x, z] = [spot.x + 1, spot.z];
      for (let tries = 0; tries < 30; tries++) {
        const [a, d] = [rng() * Math.PI * 2, 3.5 + rng() * 3];
        const [tx, tz] = [spot.x + Math.sin(a) * d, spot.z + Math.cos(a) * d];
        if (model.isOpenTile(Math.round(tx), Math.round(tz)) && !model.isBlocked(tx, tz, 0.3)) {
          [x, z] = [tx, tz];
          break;
        }
      }
      const foe = makeEnemy(1_000 + i, f.kind, x, z, x, z, f.level);
      foe.y = model.getGroundY(x, z);
      foe.state = 'chase'; // (set on the hero from the first)
      model.enemies.push(foe);
      return foe;
    });
    this.totalFoeHp = this.foes.reduce((n, f) => n + f.maxHp, 0);
    [this.t, this.dealt, this.taken] = [0, 0, 0];
    return this.observe();
  }

  // One decision: which way (0 still, 1..8 the ways round from +z), and what (0 none, 1 a blow, 2 a roll, 3 the guard),
  // played out (FRAMES_PER_DECISION frames) and paid for.
  step(move: number, action: number): Step {
    this.decide(move, action);
    for (let f = 0; f < FRAMES_PER_DECISION; f++) this.advance(FRAME);
    return this.settle();
  }

  // The decision made: its move started (a blow, a roll), the guard raised or lowered, the way to go kept.
  decide(move: number, action: number): void {
    const { model } = this;
    this.way = WAYS[move] ?? [0, 0];
    this.before = { hp: model.hero.hp, foes: this.foeHp(), alive: this.alive() };
    model.raiseGuard(action === 3);
    if (action === 1) model.startAttack();
    if (action === 2) model.roll(...this.way);
  }

  // The game on `dt` seconds, the hero going the way decided (none once fallen).
  advance(dt: number): void {
    if (!this.fell) this.model.update(this.way[0], this.way[1], dt);
    this.t += dt;
  }

  private foeHp(): number {
    return this.foes.reduce((n, f) => n + Math.max(0, f.state === 'dead' ? 0 : f.hp), 0);
  }

  private alive(): number {
    return this.foes.filter((f) => f.state !== 'dead').length;
  }

  // What the decision came to, since it was made: what's seen now, what it earned, whether the fight's over.
  settle(): Step {
    const { hero } = this.model;
    const dealt = Math.max(0, this.before.foes - this.foeHp());
    const taken = this.fell ? this.before.hp : Math.max(0, this.before.hp - hero.hp);
    const slain = this.before.alive - this.alive();
    [this.dealt, this.taken] = [this.dealt + dealt, this.taken + taken];
    const won = this.foes.every((f) => f.state === 'dead');
    // (out of time counts as lost: else keeping away from what's dangerous, unhurt and never winning, pays best)
    const done = won || this.fell;
    const truncated = !done && this.t >= TIME_LIMIT;
    let reward = dealt / this.totalFoeHp + slain * 0.2 - (taken / maxHpOf(hero)) * 1.0 - 0.005;
    if (won) reward += 1;
    if (this.fell || truncated) reward -= 1;
    return { observation: this.observe(), reward, done, truncated, info: { won, fell: this.fell, dealt: this.dealt, taken: this.taken, seconds: this.t } };
  }

  // What the fighter sees: the hero (health, breath, the guard, a roll or a blow under way, facing), the ground round
  // them (how far it's open, each of 8 ways), and the nearest foes (where, how hurt, what kind and level, what
  // they're doing: closing in, swinging, winding up a told move).
  observe(): number[] {
    const { model } = this;
    const { hero, moves } = model;
    const out: number[] = [hero.hp / maxHpOf(hero), moves.breath / moves.most, moves.guard === null ? 0 : 1, moves.rollProgress ?? 0, model.attackProgress ?? 0, moves.untouchable ? 1 : 0, Math.sin(hero.facing), Math.cos(hero.facing), hero.level / 10];
    for (let i = 1; i <= RAYS; i++) {
      const [dx, dz] = WAYS[i];
      let open = 0;
      while (open < RAY_REACH && !model.isBlocked(hero.x + dx * (open + 0.25), hero.z + dz * (open + 0.25), HERO_RADIUS)) open += 0.25;
      out.push(open / RAY_REACH);
    }
    const near = this.foes.filter((f) => f.state !== 'dead' && !f.buried).sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z));
    for (let i = 0; i < NEAREST; i++) {
      const f = near[i];
      if (!f) {
        out.push(...new Array(FOE_FEATURES).fill(0));
        continue;
      }
      const [dx, dz] = [f.x - hero.x, f.z - hero.z];
      const d = Math.hypot(dx, dz);
      out.push(1, dx / 8, dz / 8, Math.min(d, 8) / 8, d < 1.2 ? 1 : 0, f.hp / f.maxHp, (f.level - hero.level) / 5);
      for (const kind of KINDS) out.push(f.kind === kind ? 1 : 0);
      out.push(f.state === 'chase' ? 1 : 0, f.swingFor === null ? 0 : 1, f.swingFor ?? 0, Math.min(f.cooldown, 2) / 2, f.windUp == null ? 0 : Math.min(f.windUp, 2) / 2);
      for (const told of TOLD) out.push(f.told === told ? 1 : 0);
    }
    return out;
  }
}

// Open ground for the fight: of spots tried at random away from the villages (no villagers about), the one with the
// most open ground round it (a tree or two, a bush, as in the wilds).
function arenaSpot(model: GameModel, rng: () => number): { x: number; z: number } {
  const openRound = (x: number, z: number) => {
    let n = 0;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (model.isOpenTile(x + dx, z + dz)) n++;
    return n;
  };
  let best = { x: 0, z: 0, open: -1 };
  for (let tries = 0; tries < 400; tries++) {
    const [x, z] = [8 + Math.floor(rng() * (SIZE.width - 16)), 8 + Math.floor(rng() * (SIZE.depth - 16))];
    if (!model.isOpenTile(x, z) || model.villages.some((v) => Math.hypot(v.x - x, v.z - z) < 18)) continue;
    const open = openRound(x, z);
    if (open > best.open) best = { x, z, open };
    if (open >= 75) break; // (open enough: of 81)
  }
  if (best.open < 0) throw new Error('no open ground for an arena');
  return best;
}
