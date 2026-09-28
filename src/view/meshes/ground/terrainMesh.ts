import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, WATER_LEVEL, TILE_HEIGHT } from '../../../model/constants';
import { hashCell } from '../../../util/random';
import { TERRAIN_COLORS, WATER_COLOR } from '../../constants';
import { createGrassTexture, type GrassTexture } from './grassTexture';

const TILE_SHADE_JITTER = 0.03; // ± per-tile brightness, breaks up the repeating texture
const BOX_TOP_FACE = 2; // BoxGeometry material groups: +x, -x, +y, -y, +z, -z

interface TileGroup {
  tier: number;
  kind: 'water' | 'land';
  cells: Array<{ x: number; z: number }>;
}

// Land tiles get the grass texture on their top face only (stretched over a
// column's tall sides it would streak), with the color lifted so the
// texture's darkening averages out to the original shade.
function tileMaterial(group: TileGroup, grass: GrassTexture): THREE.Material | THREE.Material[] {
  if (group.kind === 'water') {
    return new THREE.MeshStandardMaterial({ color: WATER_COLOR, flatShading: true, roughness: 0.35, metalness: 0.1 });
  }
  const color = new THREE.Color(TERRAIN_COLORS[group.tier % TERRAIN_COLORS.length]);
  const side = new THREE.MeshStandardMaterial({ color });
  const top = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(1 / grass.meanBrightness), map: grass.texture });
  const materials: THREE.Material[] = Array(6).fill(side);
  materials[BOX_TOP_FACE] = top;
  return materials;
}

// Every lake cell renders at a fixed WATER_LEVEL height regardless of its
// actual bed tier (0 or 1), so the lake surface stays flat — using each
// cell's real tier here would carve a visible internal cliff between
// adjacent water cells of different depths.
//
// Tiles are grouped by (tier, kind) and each group is one InstancedMesh, so
// the draw call count stays at a handful no matter how large the map is.
// Paths and village squares aren't tile colors — they're thin overlays
// drawn on top by groundDecals.ts, so they can be narrower than a tile.
export function buildTerrain(scene: THREE.Scene, model: GameModel): void {
  const groups = new Map<string, TileGroup>();

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const isLake = model.lakeMap[x][z];
      const tier = isLake ? WATER_LEVEL : model.heightMap[x][z];
      const kind = isLake ? 'water' : 'land';
      const key = `${kind}:${tier}`;

      let group = groups.get(key);
      if (!group) {
        group = { tier, kind, cells: [] };
        groups.set(key, group);
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
    const mesh = new THREE.InstancedMesh(geometry, tileMaterial(group, grass), group.cells.length);

    group.cells.forEach((cell, i) => {
      matrix.makeTranslation(cell.x, group.tier * TILE_HEIGHT - columnHeight / 2, cell.z);
      mesh.setMatrixAt(i, matrix);
      if (group.kind === 'land') {
        const jitter = ((hashCell(cell.x, cell.z, 1) % 1000) / 1000 - 0.5) * 2 * TILE_SHADE_JITTER;
        mesh.setColorAt(i, shade.setScalar(1 + jitter));
      }
    });

    scene.add(mesh);
  }
}
