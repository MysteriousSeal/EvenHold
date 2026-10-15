// Voxel roads. Each trail tile's layout comes from which neighbors it
// connects to (a 4-bit mask), plus a small variant number from its position
// hash, and how near a village it is (its setts). Every distinct tile is greedy-meshed once and instanced per map
// chunk, so off-screen road is culled. Village squares are plazaMesh.ts.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { roadConnections } from '../../../model/map/roads';
import { hashCell } from '../../../util/random';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { voxelLayer } from '../voxel/voxelInstances';
import { chunkKeysIn, chunkTilesIn } from '../../world/chunks';
import { NEIGHBORS_4 } from '../../../model/map/grid';
import { ROAD_PALETTE, ROAD_VOXEL_SIZE, SETT_LEVELS, buildRoadTile, roadTileOffset } from './roadVoxels';
import { REACH } from '../../../model/worldgen/roads';

const SET_OUT = 14; // tiles past a village's lanes its road's setts run out, fewer and fewer

const ROAD_VARIANTS = 3;

interface PavedTile {
  x: number;
  z: number;
  tier: number;
  model: string; // which voxel tile template it uses
  build: () => VoxelGrid;
  drops: number; // road arms stepping down to a lower neighbor (their grid is padded)
}

// Where a tile's voxel grid starts, relative to the tile center on its top
// surface: at the tile's corner, pushed out and down for stair padding.
function tileOrigin(drops: number): THREE.Vector3 {
  const { side, below } = roadTileOffset(drops);
  return new THREE.Vector3(-0.5 - side * ROAD_VOXEL_SIZE, -below * ROAD_VOXEL_SIZE, -0.5 - side * ROAD_VOXEL_SIZE);
}

// How set a road tile is (roadVoxels.ts: its setts), by how near it is a village: its lanes most, then fewer out to
// SET_OUT past them, then none.
function settsAt(villages: GameModel['villages'], x: number, z: number): number {
  let near = Infinity;
  for (const v of villages) near = Math.min(near, Math.max(Math.abs(v.x - x), Math.abs(v.z - z)));
  const out = near - REACH;
  return out <= 0 ? SETT_LEVELS - 1 : Math.max(0, Math.ceil((SETT_LEVELS - 1) * (1 - out / SET_OUT)));
}

// The road tiles of `area` (a chunk, as it's built: only those near the hero ever looked at).
function pavedTiles(model: GameModel, area: { x0: number; z0: number; x1: number; z1: number }): PavedTile[] {
  const tiles: PavedTile[] = [];
  const { x0, z0, x1, z1 } = area;
  const villages = model.villages.filter((v) => v.x > x0 - REACH - SET_OUT && v.x < x1 + REACH + SET_OUT && v.z > z0 - REACH - SET_OUT && v.z < z1 + REACH + SET_OUT); // (those near enough to matter)
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const surface = model.tiles.surface(x, z);
      const tier = model.tiles.height(x, z);
      if (surface === 'path') {
        const mask = roadConnections(model.tiles, x, z);
        const variant = hashCell(x, z, 7) % ROAD_VARIANTS;
        // Terrain smoothing keeps neighbors within one tier, so a drop is always one step.
        let drops = 0;
        NEIGHBORS_4.forEach(([dx, dz], i) => {
          if (mask & (1 << i) && model.tiles.height(x + dx, z + dz) < tier) drops |= 1 << i;
        });
        const setts = settsAt(villages, x, z);
        tiles.push({
          x,
          z,
          tier,
          model: `road:${mask}:${variant}:${drops}:${setts}`,
          build: () => buildRoadTile(mask, variant, drops, setts),
          drops,
        });
      }
    }
  }
  return tiles;
}

export function buildRoads(scene: WorldSink, model: GameModel): void {
  scene.layer(voxelLayer(
    () => chunkKeysIn(model.area),
    (key) => {
      const tiles = chunkTilesIn(key, model.area); // (its own part of the map only)
      return tiles ? pavedTiles(model, tiles) : [];
    },
    (tile) => tile.model,
    (tile) => greedyMesh(tile.build(), ROAD_PALETTE, ROAD_VOXEL_SIZE, tileOrigin(tile.drops)),
    (tile) => ({ x: tile.x, y: tile.tier * TILE_HEIGHT, z: tile.z, quarterTurns: 0 }),
    Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), { userData: { trodden: true } }), // (snow lies thin on it: render/stylize.ts)
  ));
}
