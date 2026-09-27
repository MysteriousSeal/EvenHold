import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, WATER_LEVEL } from '../model/constants';
import { TERRAIN_COLORS, WATER_COLOR } from './constants';

// Every lake cell renders at a fixed WATER_LEVEL height regardless of its
// actual bed tier (0 or 1), so the lake surface stays flat — using each
// cell's real tier here would carve a visible internal cliff between
// adjacent water cells of different depths.
export function buildTerrain(scene: THREE.Scene, model: GameModel): void {
  const geometryByHeight = new Map<number, THREE.BoxGeometry>();
  const materialByKey = new Map<string, THREE.MeshStandardMaterial>();

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const isLake = model.lakeMap[x][z];
      const h = isLake ? WATER_LEVEL : model.heightMap[x][z];

      let geometry = geometryByHeight.get(h);
      if (!geometry) {
        geometry = new THREE.BoxGeometry(1, h + 1, 1);
        geometryByHeight.set(h, geometry);
      }

      const key = isLake ? 'water' : `land:${h}`;
      let material = materialByKey.get(key);
      if (!material) {
        material = isLake
          ? new THREE.MeshStandardMaterial({
              color: WATER_COLOR,
              flatShading: true,
              roughness: 0.35,
              metalness: 0.1,
            })
          : new THREE.MeshStandardMaterial({ color: TERRAIN_COLORS[h % TERRAIN_COLORS.length] });
        materialByKey.set(key, material);
      }

      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(x, (h + 1) / 2 - 1, z);
      scene.add(cube);
    }
  }
}
