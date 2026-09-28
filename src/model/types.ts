export interface Hero {
  x: number;
  z: number;
  y: number;
}

export interface Tree {
  x: number;
  z: number;
  groundTier: number;
  rotationY: number;
  scale: number;
}

export interface House {
  x: number;
  z: number;
  groundTier: number;
  rotationY: number;
}

// A village's center tile, where its well stands in the middle of the square.
export interface Village {
  x: number;
  z: number;
  groundTier: number;
}

// What covers a dry tile's top. Water is tracked separately in lakeMap.
export type Surface = 'natural' | 'path' | 'plaza';

export interface World {
  heightMap: number[][];
  lakeMap: boolean[][];
  surfaceMap: Surface[][];
  // Ordered tile routes of each trail, from start to village square.
  trails: Array<Array<[number, number]>>;
  villages: Village[];
  houses: House[];
  trees: Tree[];
}
