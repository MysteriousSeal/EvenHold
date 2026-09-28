// Voxel roads and village squares. Each trail tile's layout comes from
// which neighbors it connects to (a 4-bit mask), plus a small variant
// number from its position hash; square tiles pick one of a few cobble
// variants. Every distinct tile is greedy-meshed once and instanced per
// map chunk, so off-screen road is culled.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, TILE_HEIGHT } from '../../../model/constants';
import { roadConnections } from '../../../model/roads';
import { hashCell } from '../../../util/random';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { ROAD_PALETTE, ROAD_VOXEL_SIZE, buildCobbleTile, buildRoadTile } from './roadVoxels';

const ROAD_VARIANTS = 3;
const COBBLE_VARIANTS = 4;
const TILE_ORIGIN = new THREE.Vector3(-0.5, 0, -0.5); // voxel grid starts at the tile's corner, on its top surface

interface PavedTile {
  x: number;
  z: number;
  tier: number;
  model: string; // which voxel tile template it uses
  build: () => VoxelGrid;
}

function pavedTiles(model: GameModel): PavedTile[] {
  const tiles: PavedTile[] = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const surface = model.surfaceMap[x][z];
      const tier = model.heightMap[x][z];
      if (surface === 'plaza') {
        const variant = hashCell(x, z, 6) % COBBLE_VARIANTS;
        tiles.push({ x, z, tier, model: `cobble:${variant}`, build: () => buildCobbleTile(variant) });
      } else if (surface === 'path') {
        const mask = roadConnections(model.surfaceMap, x, z);
        const variant = hashCell(x, z, 7) % ROAD_VARIANTS;
        tiles.push({ x, z, tier, model: `road:${mask}:${variant}`, build: () => buildRoadTile(mask, variant) });
      }
    }
  }
  return tiles;
}

export function buildRoads(scene: THREE.Scene, model: GameModel): void {
  addVoxelInstances(
    scene,
    pavedTiles(model),
    (tile) => tile.model,
    (tile) => greedyMesh(tile.build(), ROAD_PALETTE, ROAD_VOXEL_SIZE, TILE_ORIGIN),
    (tile) => ({ x: tile.x, y: tile.tier * TILE_HEIGHT, z: tile.z, quarterTurns: 0 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
}
