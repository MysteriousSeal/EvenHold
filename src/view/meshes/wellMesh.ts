import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameModel } from '../../model/GameModel';
import { TILE_HEIGHT } from '../../model/constants';
import { HOUSE_STONE_COLOR, HOUSE_TIMBER_COLOR, HOUSE_ROOF_COLORS, WATER_COLOR } from '../constants';

const RIM_HEIGHT = 0.24;
const POST_HEIGHT = 0.5;
const POST_X = 0.27;

function placed(geometry: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  geometry.translate(x, y, z);
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

// Well geometry in local space (origin on the ground at the well's center),
// merged per material.
function buildWellParts(): Record<'stone' | 'water' | 'timber' | 'roof', THREE.BufferGeometry> {
  const roof = new THREE.ConeGeometry(0.42, 0.2, 4);
  roof.rotateY(Math.PI / 4); // edges parallel to the crossbar

  return {
    stone: placed(new THREE.CylinderGeometry(0.3, 0.33, RIM_HEIGHT, 10), 0, RIM_HEIGHT / 2, 0),
    // Sits just on top of the stone, so it reads as water inside a stone rim.
    water: placed(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 10), 0, RIM_HEIGHT + 0.005, 0),
    timber: mergeGeometries([
      placed(new THREE.BoxGeometry(0.05, POST_HEIGHT, 0.05), -POST_X, RIM_HEIGHT - 0.04 + POST_HEIGHT / 2, 0),
      placed(new THREE.BoxGeometry(0.05, POST_HEIGHT, 0.05), POST_X, RIM_HEIGHT - 0.04 + POST_HEIGHT / 2, 0),
      placed(new THREE.BoxGeometry(0.6, 0.04, 0.04), 0, 0.64, 0), // crossbar
      placed(new THREE.BoxGeometry(0.015, 0.16, 0.015), 0, 0.54, 0), // rope
      placed(new THREE.BoxGeometry(0.09, 0.08, 0.09), 0, 0.42, 0), // bucket
    ])!,
    roof: placed(roof, 0, 0.8, 0),
  };
}

export function buildWells(scene: THREE.Scene, model: GameModel): void {
  const count = model.villages.length;
  if (count === 0) return;

  const parts = buildWellParts();
  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: HOUSE_STONE_COLOR, flatShading: true, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: WATER_COLOR, roughness: 0.3, metalness: 0.1 }),
    timber: new THREE.MeshStandardMaterial({ color: HOUSE_TIMBER_COLOR, flatShading: true, roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: HOUSE_ROOF_COLORS[0], flatShading: true, roughness: 0.85 }),
  };

  const matrix = new THREE.Matrix4();
  for (const part of ['stone', 'water', 'timber', 'roof'] as const) {
    const mesh = new THREE.InstancedMesh(parts[part], materials[part], count);
    model.villages.forEach((village, i) => {
      matrix.makeTranslation(village.x, village.groundTier * TILE_HEIGHT, village.z);
      mesh.setMatrixAt(i, matrix);
    });
    scene.add(mesh);
  }
}
