import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { House } from '../../../model/types';
import { TILE_HEIGHT } from '../../../model/constants';
import {
  HOUSE_PLASTER_COLOR,
  HOUSE_TIMBER_COLOR,
  HOUSE_STONE_COLOR,
  HOUSE_DOOR_COLOR,
  HOUSE_WINDOW_COLOR,
  HOUSE_WINDOW_GLOW,
  HOUSE_ROOF_COLORS,
  IRON_COLOR,
} from '../../constants';
import { buildHouseParts } from './parts';
import { HOUSE_PARTS, type HousePart } from './houseTypes';
import { HOUSE_VARIANTS } from './variants';
import { groupByChunk } from '../chunks';
import { hashCell } from '../../../util/random';

function createMaterials(): Record<HousePart, THREE.MeshStandardMaterial> {
  return {
    plaster: new THREE.MeshStandardMaterial({ color: HOUSE_PLASTER_COLOR, flatShading: true, roughness: 0.95 }),
    timber: new THREE.MeshStandardMaterial({ color: HOUSE_TIMBER_COLOR, flatShading: true, roughness: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ color: HOUSE_STONE_COLOR, flatShading: true, roughness: 1 }),
    // White base so the per-instance roof color (setColorAt) comes through unchanged.
    roof: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85 }),
    door: new THREE.MeshStandardMaterial({ color: HOUSE_DOOR_COLOR, flatShading: true, roughness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: IRON_COLOR, flatShading: true, roughness: 0.6 }),
    // Per-vertex colors: flowers, barrels, logs, signs etc. in one draw call.
    decor: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    window: new THREE.MeshStandardMaterial({
      color: HOUSE_WINDOW_COLOR,
      emissive: HOUSE_WINDOW_GLOW,
      emissiveIntensity: 0.9,
      roughness: 0.5,
    }),
  };
}

// A house's look comes from a hash of its grid position rather than being
// stored in the model: it's purely visual, and drawing it from the world
// rng would shift every later placement (trees) for every existing seed.
//
// Houses are grouped by variant; each variant draws one InstancedMesh per
// material per map chunk (see chunks.ts), so off-screen villages are culled.
export function buildHouses(scene: THREE.Scene, model: GameModel): void {
  if (model.houses.length === 0) return;

  const materials = createMaterials();
  const housesByVariant: House[][] = HOUSE_VARIANTS.map(() => []);
  for (const house of model.houses) {
    housesByVariant[hashCell(house.x, house.z) % HOUSE_VARIANTS.length].push(house);
  }

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const roofColor = new THREE.Color();

  housesByVariant.forEach((houses, variantIndex) => {
    if (houses.length === 0) return;
    const geometries = buildHouseParts(HOUSE_VARIANTS[variantIndex]);

    for (const part of HOUSE_PARTS) {
      for (const chunk of groupByChunk(houses)) {
        const mesh = new THREE.InstancedMesh(geometries[part], materials[part], chunk.length);

        chunk.forEach((house, i) => {
          quaternion.setFromAxisAngle(upAxis, house.rotationY);
          position.set(house.x, house.groundTier * TILE_HEIGHT, house.z);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(i, matrix);

          if (part === 'roof') {
            const colorIndex = (hashCell(house.x, house.z) >>> 8) % HOUSE_ROOF_COLORS.length;
            mesh.setColorAt(i, roofColor.setHex(HOUSE_ROOF_COLORS[colorIndex]));
          }
        });

        scene.add(mesh);
      }
    }
  });
}
