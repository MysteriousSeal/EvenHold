import type { MapSize } from './grid';
import type { Humanoid } from './human/humanoid';
import type { Bag } from './bag';

// The hero is a humanoid: a look, and what they wear (naked at first).
export interface Hero extends Humanoid {
  name: string;
  x: number;
  z: number;
  y: number;
  facing: number; // yaw toward the last direction moved (atan2(dx, dz))
  hp: number; // up to maxHpAt(level) (heroStats.ts); may be fractional while healing
  level: number;
  xp: number; // toward the next level
  hurtFor: number; // seconds left of the hit flash
  sinceHurt: number; // seconds since the last hit
  bag: Bag; // what they've picked up
  money: number; // their purse, in copper (money.ts)
}

export type EnemyKind = 'wolf' | 'bandit';
export type EnemyState = 'wander' | 'chase' | 'dead';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  y: number;
  homeX: number; // where it wanders around, and returns to
  homeZ: number;
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
}

// A 5x5 bandit camp around a campfire on (x, z), its layout turned by
// `quarterTurns` (the entrance faces local +Z before turning).
export interface Camp {
  x: number;
  z: number;
  quarterTurns: number;
}

export type CampPieceKind = 'fire' | 'tent' | 'rack' | 'crates' | 'loot';
export interface CampPiece {
  kind: CampPieceKind;
  x: number;
  z: number;
  quarterTurns: number; // faces the camp's center (local +Z)
}

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
  villages: Village[];
  houses: House[];
  buildings: Building[];
  fields: Field[];
  trees: Tree[];
  bushes: Bush[];
}
