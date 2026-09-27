import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, WATER_LEVEL } from '../model/constants';
import { TERRAIN_COLORS, WATER_COLOR } from './constants';

// Every lake cell renders at a fixed WATER_LEVEL height regardless of its
// actual bed tier (0 or 1), so the lake surface stays flat — using each
// cell's real tier here would carve a visible internal cliff between
// adjacent water cells of different depths.
//
// There are only a handful of distinct tile types (one per height tier,
// plus water), so every cell of a given type is drawn as one instance of a
// shared InstancedMesh rather than its own THREE.Mesh. That keeps the draw
// call count constant (a handful) no matter how large the map grid gets,
// instead of scaling linearly with cell count.
export function buildTerrain(scene: THREE.Scene, model: GameModel): void {
  const cellsByKey = new Map<string, Array<{ x: number; z: number }>>();
  const heightByKey = new Map<string, number>();

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const isLake = model.lakeMap[x][z];
      const h = isLake ? WATER_LEVEL : model.heightMap[x][z];
      const key = isLake ? 'water' : `land:${h}`;

      let cells = cellsByKey.get(key);
      if (!cells) {
        cells = [];
        cellsByKey.set(key, cells);
        heightByKey.set(key, h);
      }
      cells.push({ x, z });
    }
  }

  const matrix = new THREE.Matrix4();
  for (const [key, cells] of cellsByKey) {
    const h = heightByKey.get(key)!;
    const isLake = key === 'water';

    const geometry = new THREE.BoxGeometry(1, h + 1, 1);
    const material = isLake
      ? new THREE.MeshStandardMaterial({ color: WATER_COLOR, flatShading: true, roughness: 0.35, metalness: 0.1 })
      : new THREE.MeshStandardMaterial({ color: TERRAIN_COLORS[h % TERRAIN_COLORS.length] });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, cells.length);
    cells.forEach((cell, i) => {
      matrix.makeTranslation(cell.x, (h + 1) / 2 - 1, cell.z);
      instancedMesh.setMatrixAt(i, matrix);
    });

    scene.add(instancedMesh);
  }
}
