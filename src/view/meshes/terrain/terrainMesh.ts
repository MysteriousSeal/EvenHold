import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { chunkKeysIn, chunkTilesIn } from '../../world/chunks';
import type { GameModel } from '../../../model/GameModel';
import { MAX_TIER, TILE_HEIGHT } from '../../../model/constants';
import { TERRAIN_COLORS } from '../../constants';
import { addVoxelGround } from './voxelGround';

const BOX_TOP_FACE = 2; // BoxGeometry material groups: +x, -x, +y, -y, +z, -z

// Land tiles get voxel-shaded grass on their top face only (voxelGround.ts);
// the column's sides stay plain.
function tileMaterial(tier: number): THREE.Material[] {
  const color = new THREE.Color(TERRAIN_COLORS[tier % TERRAIN_COLORS.length]);
  const side = new THREE.MeshStandardMaterial({ color });
  const top = new THREE.MeshStandardMaterial({ color });
  addVoxelGround(top);
  const materials: THREE.Material[] = Array(6).fill(side);
  materials[BOX_TOP_FACE] = top;
  return materials;
}

// Land tiles, grouped by tier, each group instanced per chunk. Lakes are
// drawn by water/waterMesh.ts; roads and village squares are voxel tiles
// laid on top by roadMesh.ts.
export function buildTerrain(scene: WorldSink, model: GameModel): void {
  const matrix = new THREE.Matrix4();
  // Per tier: a column reaching from one tier below ground up to the tile's
  // surface, and its materials, made the first time a chunk has that tier.
  const tiers = new Map<number, { geometry: THREE.BufferGeometry; material: THREE.Material[] }>();
  const tierOf = (tier: number) => {
    let entry = tiers.get(tier);
    if (!entry) {
      entry = { geometry: new THREE.BoxGeometry(1, (tier + 1) * TILE_HEIGHT, 1), material: tileMaterial(tier) };
      tiers.set(tier, entry);
    }
    return entry;
  };
  for (let tier = 0; tier <= MAX_TIER; tier++) tierOf(tier); // so every material is known up front

  scene.layer({
    materials: [...tiers.values()].flatMap((t) => t.material),
    chunkKeys: () => chunkKeysIn(model.area), // (its own part of the map: a streamed world's region)
    build(key) {
      const tiles = chunkTilesIn(key, model.area); // (its own part of the map only)
      if (!tiles) return [];
      const { x0, z0, x1, z1 } = tiles;
      const byTier = new Map<number, Array<{ x: number; z: number }>>();
      const pits = new Set(model.crypts.flatMap((c) => c.steps.map((t) => `${t.x},${t.z}`))); // (no ground where a crypt's stairs go down into it)
      for (let x = x0; x < x1; x++) {
        for (let z = z0; z < z1; z++) {
          if (model.tiles.lake(x, z) || pits.has(`${x},${z}`)) continue;
          const tier = model.tiles.height(x, z);
          const cells = byTier.get(tier);
          if (cells) cells.push({ x, z });
          else byTier.set(tier, [{ x, z }]);
        }
      }
      return [...byTier].map(([tier, cells]) => {
        const { geometry, material } = tierOf(tier);
        const columnHeight = (tier + 1) * TILE_HEIGHT;
        const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
        cells.forEach((cell, i) => {
          mesh.setMatrixAt(i, matrix.makeTranslation(cell.x, tier * TILE_HEIGHT - columnHeight / 2, cell.z));
        });
        return mesh;
      });
    },
  });
}
