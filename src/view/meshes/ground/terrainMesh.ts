import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, TILE_HEIGHT } from '../../../model/constants';
import { hashCell } from '../../../util/random';
import { TERRAIN_COLORS } from '../../constants';
import { createGrassTexture, type GrassTexture } from './grassTexture';
import { groupByChunk } from '../common/chunks';

const TILE_SHADE_JITTER = 0.03; // ± per-tile brightness, breaks up the repeating texture
const BOX_TOP_FACE = 2; // BoxGeometry material groups: +x, -x, +y, -y, +z, -z

interface TileGroup {
  tier: number;
  cells: Array<{ x: number; z: number }>;
}

// Land tiles get the grass texture on their top face only (stretched over a
// column's tall sides it would streak), with the color lifted so the
// texture's darkening averages out to the original shade.
function tileMaterial(group: TileGroup, grass: GrassTexture): THREE.Material[] {
  const color = new THREE.Color(TERRAIN_COLORS[group.tier % TERRAIN_COLORS.length]);
  const side = new THREE.MeshStandardMaterial({ color });
  const top = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(1 / grass.meanBrightness), map: grass.texture });
  const materials: THREE.Material[] = Array(6).fill(side);
  materials[BOX_TOP_FACE] = top;
  return materials;
}

// Land tiles, grouped by tier, each group instanced per chunk. Lakes are
// drawn by water/waterMesh.ts; roads and village squares are voxel tiles
// laid on top by roadMesh.ts.
export function buildTerrain(scene: THREE.Scene, model: GameModel): void {
  const groups = new Map<number, TileGroup>();

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      if (model.lakeMap[x][z]) continue;
      const tier = model.heightMap[x][z];
      let group = groups.get(tier);
      if (!group) {
        group = { tier, cells: [] };
        groups.set(tier, group);
      }
      group.cells.push({ x, z });
    }
  }

  const grass = createGrassTexture();
  const matrix = new THREE.Matrix4();
  const shade = new THREE.Color();

  for (const group of groups.values()) {
    // Column spans from one tier below ground level up to the tile's surface.
    const columnHeight = (group.tier + 1) * TILE_HEIGHT;
    const geometry = new THREE.BoxGeometry(1, columnHeight, 1);
    const material = tileMaterial(group, grass);

    // One InstancedMesh per chunk (sharing geometry and material), so
    // off-screen chunks are frustum-culled.
    for (const cells of groupByChunk(group.cells)) {
      const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
      cells.forEach((cell, i) => {
        matrix.makeTranslation(cell.x, group.tier * TILE_HEIGHT - columnHeight / 2, cell.z);
        mesh.setMatrixAt(i, matrix);
        const jitter = ((hashCell(cell.x, cell.z, 1) % 1000) / 1000 - 0.5) * 2 * TILE_SHADE_JITTER;
        mesh.setColorAt(i, shade.setScalar(1 + jitter));
      });
      scene.add(mesh);
    }
  }
}
