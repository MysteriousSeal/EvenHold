export interface Hero {
  x: number;
  z: number;
  y: number;
}

export interface Tree {
  x: number;
  z: number;
  groundHeight: number;
  rotationY: number;
  scale: number;
}

export interface House {
  x: number;
  z: number;
  groundHeight: number;
  rotationY: number;
}

export interface World {
  heightMap: number[][];
  lakeMap: boolean[][];
  houses: House[];
  trees: Tree[];
}
