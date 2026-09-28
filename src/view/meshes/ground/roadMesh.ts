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
import { groupByChunk } from '../chunks';
import { ROAD_PALETTE, ROAD_VOXEL_SIZE, buildCobbleTile, buildRoadTile } from './roadVoxels';

const ROAD_VARIANTS = 3;
const COBBLE_VARIANTS = 4;

interface PavedTile {
  x: number;
  z: number;
  tier: number;
}

export function buildRoads(scene: THREE.Scene, model: GameModel): void {
  // Template key -> how to build that tile's voxels, and every tile using it.
  const templates = new Map<string, { build: () => VoxelGrid; tiles: PavedTile[] }>();
  const add = (key: string, build: () => VoxelGrid, tile: PavedTile) => {
    const template = templates.get(key) ?? { build, tiles: [] };
    template.tiles.push(tile);
    templates.set(key, template);
  };

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const surface = model.surfaceMap[x][z];
      const tile = { x, z, tier: model.heightMap[x][z] };
      if (surface === 'plaza') {
        const variant = hashCell(x, z, 6) % COBBLE_VARIANTS;
        add(`cobble:${variant}`, () => buildCobbleTile(variant), tile);
      } else if (surface === 'path') {
        const mask = roadConnections(model.surfaceMap, x, z);
        const variant = hashCell(x, z, 7) % ROAD_VARIANTS;
        add(`road:${mask}:${variant}`, () => buildRoadTile(mask, variant), tile);
      }
    }
  }

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const origin = new THREE.Vector3(-0.5, 0, -0.5); // voxel grid starts at the tile's corner, on its top surface
  const matrix = new THREE.Matrix4();

  for (const { build, tiles } of templates.values()) {
    const geometry = greedyMesh(build(), ROAD_PALETTE, ROAD_VOXEL_SIZE, origin);
    for (const chunk of groupByChunk(tiles)) {
      const mesh = new THREE.InstancedMesh(geometry, material, chunk.length);
      chunk.forEach((tile, i) => {
        matrix.makeTranslation(tile.x, tile.tier * TILE_HEIGHT, tile.z);
        mesh.setMatrixAt(i, matrix);
      });
      scene.add(mesh);
    }
  }
}
