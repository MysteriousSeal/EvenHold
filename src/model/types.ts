import type { Blessing } from './hero/blessing';
import type { BagId } from './loot/bags';
import type { Road } from './worldgen/roads';
import type { MapSize } from './map/grid';
import type { Humanoid } from './human/humanoid';
import type { Bag, BagItem } from './hero/bag';
import type { Ruin } from './ruins/ruins';
import type { Camp } from './camps/camps';
import type { Stat } from './hero/statKinds';
import type { ActionBar } from './hero/actionBar';
import type { JobId, JobRecord } from './jobs/jobs';

// Something eaten or drunk over a while (heroStats.ts recover): the health and energy it gives back in all, the
// seconds left of it and in all; `item`, what it is (from the bag).
export interface Meal {
  heal: number;
  energy?: number;
  left: number;
  seconds: number;
  item?: BagItem;
}

// The hero is a humanoid: a look, and what they wear (naked at first).
export interface Hero extends Humanoid {
  name: string;
  x: number;
  z: number;
  y: number;
  facing: number; // yaw toward the last direction moved (atan2(dx, dz))
  hp: number; // up to maxHpOf (attributes.ts); may be fractional while healing
  energy: number; // up to maxEnergyOf (attributes.ts): spent through the day, slept back
  level: number;
  xp: number; // toward the next level
  statPoints: number; // gained with levels, not yet spent (training.ts)
  trained: Record<Stat, number>; // points spent on each stat
  hurtFor: number; // seconds left of the hit flash
  knock?: { dx: number; dz: number; t: number }; // knocked back by a blow (a lord's charge, a draugr's cleave): carried so far over KNOCK_TIME (hero/fighting.ts)
  bag: Bag; // what they've picked up
  bagOrder: Array<BagItem | null>; // where each thing sits in the bag, slot by slot (bag.ts bagStacks)
  bagCounts: number[]; // how many in each of those slots (a junk stack's own: bag.ts bagStacks; none, packed)
  bags: Array<BagId | null>; // the bags fitted to it, a socket each (hero/bagSlots.ts): six more slots each
  actionBar: ActionBar; // shortcuts to food and drink in the bag, keys 1 to 8 (hero/actionBar.ts)
  jobs?: Partial<Record<JobId, JobRecord>>; // their record in each job taken up (jobs/jobs.ts): none, till they work
  money: number; // their purse, in copper (money.ts)
  blessings?: Blessing[]; // a well's, for a while (blessing.ts); one, but for a cheat
  drinking?: Meal | null; // an ale at the bar, sipped a while, healing as it goes (or a pie, its energy) (heroStats.ts)
  eating?: Meal | null;
  potionCooldown?: number; // seconds before another potion may be drunk (bag.ts drinkPotion) // food or drink from the bag (`item`), sat on the ground, restoring as it goes (bag.ts eatOrDrink); getting up (a step, a blow struck, a roll, the guard) or a blow taken stops it
}

export type EnemyKind = 'wolf' | 'bandit' | 'banditChief' | 'boar' | 'skeleton' | 'skeletonArcher' | 'draugr' | 'cryptLord' | 'ghost' | 'caveSpider' | 'caveBat' | 'caveWorm' | 'hatchling' | 'broodMother' | 'bear' | 'lynx'; // (a bandit chief: each camp's own, its elite; bears and lynxes: the wilds' own, fiercer than wolves; skeletons and draugr: the crypts' guards; the lord: a crypt's own dead, risen; ghosts: haunting the old ruins; spiders, bats, worms and the brood mother with her hatchlings: the caves' beasts)

// Something that just happened worth showing (e.g. as floating text): coins
// looted, or a blow landing on an enemy or on the hero, at where they are.
export type GameEvent =
  | { kind: 'coins'; amount: number }
  | { kind: 'hit'; on: EnemyKind | 'hero'; amount: number; crit?: boolean; x: number; y: number; z: number } // crit: a critical blow (the hero's Agility)
  | { kind: 'dodge'; x: number; y: number; z: number } // the hero dodged a blow (their Agility)
  | { kind: 'guard'; outcome: 'rolled' | 'parried' | 'blocked' | 'broken'; x: number; y: number; z: number } // a blow rolled through, parried, blocked, or breaking the guard (combatMoves.ts)
  | { kind: 'levelUp'; level: number; points: number } // the hero's levelled up: their points to spend now
  | { kind: 'quest'; text: string; done: boolean; x: number; y: number; z: number }
  | { kind: 'blessing'; name: string } // a well's, just given
  | { kind: 'arrive'; name: string; level: number } // somewhere of note gone into (a crypt), and its level
  | { kind: 'campGate'; name: string; level: number } // a bandit camp's gate come up to: its name and level (camps/campGate.ts)
  | { kind: 'village'; name: string; level: number } // a village come into: its name and level (villages/villageWelcome.ts)
  | { kind: 'shift'; job: string; served: number; walkedOut: number; mixups: number; cleared: number; earned: number; bonus: number; early: boolean } // a shift of work over (jobs/work.ts): how it went, what it paid
  | { kind: 'jobRank'; job: string; rank: string } // risen a rank in a job (jobs/jobs.ts)
  | { kind: 'cleared'; name: string; point?: boolean; place?: 'crypt' | 'cave' | 'camp' } // a dungeon's last foe slain (its boss), a bandit camp's (its chief and his bandits); `point`: a point to spend given for it; `place`: a cave's, a camp's (else a crypt's)
  | { kind: 'point'; why: string } // a point to spend given (a crypt's lord slain, the first time)
  | { kind: 'rises'; name: string } // a crypt's lord, risen
  | { kind: 'stirs'; name: string } // a cave's brood mother, stirring on her silk (the hero come into her nest)
  | { kind: 'brood' } // her brood, hatching from the egg sacs
  | { kind: 'torn' } // the silk walling her nest off, torn (most of the cave cleared)
  | { kind: 'walled'; share: number } // the hero come up to that silk while it holds (how much of the cave's cleared)
  | { kind: 'locked' } // a door tried, locked (the inn's rooms upstairs)
  | { kind: 'chilled' } // the hero caught in a draugr's frost breath
  | { kind: 'webbed' } // the hero caught in a cave spider's web
  | { kind: 'poor'; text: string } // something the hero couldn't pay for
  | { kind: 'say'; speaker: { x: number; z: number }; where: object | null; text: string }; // someone speaking (npcs/speech.ts), in a room (its door) or outdoors
export type EnemyState = 'wander' | 'chase' | 'dead';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  y: number;
  homeX: number; // where it wanders around, and returns to
  homeZ: number;
  pen?: number; // if kept in (a camp's bandits): wanders only to the tiles this far round home, inside the palisade
  haunt?: { x0: number; z0: number; x1: number; z1: number }; // if bound to a place (a ruin's ghosts): never leaves it, nor chases the hero out of it
  level: number; // from how far from spawn it lives (enemyLevels.ts)
  maxHp: number;
  hp: number;
  damage: number; // per blow
  xp: number; // for killing it
  state: EnemyState;
  target: { x: number; z: number } | null; // wander goal
  restFor: number; // seconds before picking a new wander goal
  hurtFor: number; // seconds left of the hit flash
  deadFor: number; // seconds since it died
  swingFor: number | null; // seconds into its own attack swing (bandits), or null
  cooldown: number; // seconds before it can swing again
  path: Array<{ x: number; z: number }> | null; // while chasing around obstacles: tile centers still to walk
  pathAge: number; // seconds since the path was found
  lastSeen: { x: number; z: number } | null; // while chasing: where it last saw (or heard) the hero
  lostFor: number; // seconds since then
  human: Humanoid | null; // body look and equipment, for humanoid kinds (bandits)
  name?: string; // its own name, if it has one (a crypt's lord), over its kind's
  windUp?: number | null; // seconds into a told move (a crypt lord's slam, a draugr's breath or cleave), else null
  told?: 'slam' | 'breath' | 'cleave' | 'sweep' | 'charge' | 'eruption' | 'barrage' | 'web' | 'lunge' | 'erupt' | 'volley' | 'brood' | null; // which
  buried?: boolean; // underground (a cave worm, burrowing: caves/caveFoes.ts): not to be seen, struck or bumped into
  quest?: string; // the quest it was gathered for (quests/questBook.ts), by key
}

// A 5x5 bandit camp around a campfire on (x, z), its layout turned by
// `quarterTurns` (the entrance faces local +Z before turning).
export type TreeKind = 'oak' | 'pine' | 'birch';

export interface Tree {
  x: number;
  z: number;
  groundTier: number;
  kind: TreeKind;
  shape: number; // which voxel shape variant to draw
  quarterTurns: number; // 0-3, rotation about Y in 90-degree steps (grid-aligned)
}

export interface House {
  x: number;
  z: number;
  groundTier: number;
  rotationY: number;
}

// The inn and the blacksmith: two tiles long, standing on the square's
// outer ring with their door (local -Z) facing the well and their long side
// (local X) along the square's edge.
export type BuildingKind = 'inn' | 'smithy';

export interface Building {
  kind: BuildingKind;
  x: number; // center, halfway between its two tiles
  z: number;
  tiles: Array<[number, number]>;
  groundTier: number;
  quarterTurns: number; // rotation about Y in 90-degree steps
}

export type BushKind = 'leafy' | 'berry' | 'flowering';

export interface Bush {
  x: number;
  z: number;
  groundTier: number;
  kind: BushKind;
  shape: number; // which voxel shape variant to draw
  quarterTurns: number; // 0-3, rotation about Y in 90-degree steps (grid-aligned)
}

// A village's center tile, where its well stands in the middle of the square.
export interface Village {
  x: number;
  z: number;
  groundTier: number;
}

// What covers a dry tile's top. Water is tracked separately in lakeMap.
export type Surface = 'natural' | 'path' | 'plaza' | 'field';

// A fenced crop plot near a village: tiles x0..x0+width-1, z0..z0+depth-1,
// all on one tier. Crop rows run along the longer side. The fence has a gap
// at `gate` (an edge tile facing the village), and hay and tools sit on the
// `corner` tile.
export interface Field {
  x0: number;
  z0: number;
  width: number;
  depth: number;
  groundTier: number;
  rowsAlongX: boolean;
  gate: [number, number];
  corner: [number, number];
}

export interface World {
  size: MapSize;
  heightMap: number[][];
  lakeMap: boolean[][];
  surfaceMap: Surface[][];
  // Ordered tile routes of each trail, from start to village square.
  trails: Array<Array<[number, number]>>;
  roads: Road[]; // between the villages (worldgen/roads.ts)
  villages: Village[];
  houses: House[];
  buildings: Building[];
  fields: Field[];
  ruins: Ruin[]; // old keeps and chapels in the wilds (ruins/ruins.ts)
  camps: Camp[]; // the bandits' (camps/camps.ts)
  trees: Tree[];
  bushes: Bush[];
}
