import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { allChunkKeys, chunkTiles } from '../../world/chunks';
import type { GameModel } from '../../../model/GameModel';
import { MAX_TIER, TILE_HEIGHT } from '../../../model/constants';
import { hashCell } from '../../../util/random';
import { TERRAIN_COLORS } from '../../constants';
import { createGrassTexture, type GrassTexture } from './grassTexture';

const TILE_SHADE_JITTER = 0.03; // ± per-tile brightness, breaks up the repeating texture
const BOX_TOP_FACE = 2; // BoxGeometry material groups: +x, -x, +y, -y, +z, -z

// Land tiles get the grass texture on their top face only (stretched over a
// column's tall sides it would streak), with the color lifted so the
// texture's darkening averages out to the original shade.
function tileMaterial(tier: number, grass: GrassTexture): THREE.Material[] {
  const color = new THREE.Color(TERRAIN_COLORS[tier % TERRAIN_COLORS.length]);
  const side = new THREE.MeshStandardMaterial({ color });
  const top = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(1 / grass.meanBrightness), map: grass.texture });
  const materials: THREE.Material[] = Array(6).fill(side);
  materials[BOX_TOP_FACE] = top;
  return materials;
}

// Land tiles, grouped by tier, each group instanced per chunk. Lakes are
// drawn by water/waterMesh.ts; roads and village squares are voxel tiles
// laid on top by roadMesh.ts.
export function buildTerrain(scene: WorldSink, model: GameModel): void {
  const grass = createGrassTexture();
  const matrix = new THREE.Matrix4();
  const shade = new THREE.Color();
  // Per tier: a column reaching from one tier below ground up to the tile's
  // surface, and its materials, made the first time a chunk has that tier.
  const tiers = new Map<number, { geometry: THREE.BufferGeometry; material: THREE.Material[] }>();
  const tierOf = (tier: number) => {
    let entry = tiers.get(tier);
    if (!entry) {
      entry = { geometry: new THREE.BoxGeometry(1, (tier + 1) * TILE_HEIGHT, 1), material: tileMaterial(tier, grass) };
      tiers.set(tier, entry);
    }
    return entry;
  };
  for (let tier = 0; tier <= MAX_TIER; tier++) tierOf(tier); // so every material is known up front

  scene.layer({
    materials: [...tiers.values()].flatMap((t) => t.material),
    chunkKeys: () => allChunkKeys(model.size.width, model.size.depth),
    build(key) {
      const { x0, z0, x1, z1 } = chunkTiles(key, model.size.width, model.size.depth);
      const byTier = new Map<number, Array<{ x: number; z: number }>>();
      for (let x = x0; x < x1; x++) {
        for (let z = z0; z < z1; z++) {
          if (model.lakeMap[x][z]) continue;
          const tier = model.heightMap[x][z];
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
          const jitter = ((hashCell(cell.x, cell.z, 1) % 1000) / 1000 - 0.5) * 2 * TILE_SHADE_JITTER;
          mesh.setColorAt(i, shade.setScalar(1 + jitter));
        });
        return mesh;
      });
    },
  });
}
