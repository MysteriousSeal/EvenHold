import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import {
  HOUSE_TIMBER_COLOR,
  HOUSE_DOOR_COLOR,
  HOUSE_ROOF_COLORS,
  HOUSE_WINDOW_COLOR,
  HOUSE_WINDOW_GLOW,
  WELL_STONE_LIGHT_COLOR,
  WELL_STONE_DARK_COLOR,
  WELL_WATER_COLOR,
  WELL_ROPE_COLOR,
  IRON_COLOR,
} from '../../constants';
import { WELL_PARTS, buildWellParts } from './wellParts';
import type { WellPart } from './wellParts';

function createMaterials(): Record<WellPart, THREE.MeshStandardMaterial> {
  const flat = (color: number, roughness: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness });
  return {
    stoneLight: flat(WELL_STONE_LIGHT_COLOR, 1),
    stoneDark: flat(WELL_STONE_DARK_COLOR, 1),
    timber: flat(HOUSE_TIMBER_COLOR, 0.9),
    wood: flat(HOUSE_DOOR_COLOR, 0.9),
    roof: flat(HOUSE_ROOF_COLORS[0], 0.85),
    water: new THREE.MeshStandardMaterial({ color: WELL_WATER_COLOR, roughness: 0.2, metalness: 0.1 }),
    rope: flat(WELL_ROPE_COLOR, 1),
    iron: flat(IRON_COLOR, 0.6),
    glow: new THREE.MeshStandardMaterial({ color: HOUSE_WINDOW_COLOR, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: 1.1 }),
  };
}

// One InstancedMesh per material, one instance per village.
export function buildWells(scene: THREE.Scene, model: GameModel): void {
  const count = model.villages.length;
  if (count === 0) return;

  const geometries = buildWellParts();
  const materials = createMaterials();
  const matrix = new THREE.Matrix4();

  for (const part of WELL_PARTS) {
    const mesh = new THREE.InstancedMesh(geometries[part], materials[part], count);
    model.villages.forEach((village, i) => {
      // Stands on the village cobbles, not the grass under them.
      matrix.makeTranslation(village.x, model.getGroundY(village.x, village.z), village.z);
      mesh.setMatrixAt(i, matrix);
    });
    scene.add(mesh);
  }
}
