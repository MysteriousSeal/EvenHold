import type { MapSize } from './grid';

export interface Hero {
  x: number;
  z: number;
  y: number;
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
