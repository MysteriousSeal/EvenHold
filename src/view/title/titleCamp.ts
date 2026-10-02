// The main menu's world (titleScene.ts): a heroes' camp in a clearing at
// dusk, built from the game's own voxel models. Grass shaded tile by tile,
// a trodden clearing of earth round the campfire, a path running off
// between the trees; a tent, crates and a weapon rack; logs to sit on,
// boulders, bushes, and the woods closing in behind and at the sides.
// Returns the fire's flames, to be lit (scaled up from nothing).

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { buildTreeGeometry } from '../meshes/tree/treeMesh';
import { buildBushGeometry } from '../meshes/bush/bushMesh';
import { buildCampGeometry } from '../meshes/camp/campMesh';
import { SCENERY_PALETTE, SCENERY_VOXEL, buildScenery, sceneryGrid } from '../meshes/scenery/sceneryVoxels';
import { HOUSE_WINDOW_GLOW } from '../constants';
import { mulberry32 } from '../../util/random';
import type { BushKind, TreeKind } from '../../model/types';
import type { SceneryKind } from '../../model/scenery/scenery';

const CELL = 0.2; // the ground's voxels
const GROUND = { x0: -9, x1: 9, z0: -10, z1: 5 }; // world units
export const CAMP_AREA = GROUND; // (the valley round it leaves it be: titleValley.ts)
export const FIRE = new THREE.Vector3(0, 0, -0.9);
const PALETTE = [0x8bbf6a, 0x7fb35e, 0x95c774, 0x6fa552, 0xb08a5a, 0x9c774b, 0xa8916c, 0x5f9f4c];
const [GRASS, GRASS_DARK, GRASS_LIGHT, GRASS_DEEP, EARTH, EARTH_DARK, PATH, TUFT] = [1, 2, 3, 4, 5, 6, 7, 8];

function ground(): THREE.BufferGeometry {
  const rng = mulberry32(0x7171e);
  const nx = Math.round((GROUND.x1 - GROUND.x0) / CELL);
  const nz = Math.round((GROUND.z1 - GROUND.z0) / CELL);
  const grid = createGrid([nx, 3, nz]);
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const x = GROUND.x0 + (i + 0.5) * CELL;
      const z = GROUND.z0 + (k + 0.5) * CELL;
      const wobble = (rng() - 0.5) * 0.5;
      const clearing = Math.hypot(x / 1.5, (z - FIRE.z - 0.6) / 1.15) + wobble; // (round the fire, and where the heroes stand)
      const path = Math.abs(x - 0.35 * Math.sin(z * 0.45) + 0.4) < 0.45 + wobble * 0.3 && z < FIRE.z - 1;
      const roll = rng();
      const top = clearing < 1.6 ? (roll < 0.3 ? EARTH_DARK : EARTH) : clearing < 2 ? (roll < 0.5 ? EARTH : GRASS_DARK) : path ? PATH : roll < 0.25 ? GRASS_DARK : roll < 0.45 ? GRASS_LIGHT : roll < 0.5 ? GRASS_DEEP : GRASS;
      setColor(grid, i, 0, k, EARTH_DARK);
      setColor(grid, i, 1, k, top);
      if (clearing > 2.6 && !path && rng() < 0.05) setColor(grid, i, 2, k, TUFT); // (tufts, away from the camp)
    }
  }
  return greedyMesh(grid, PALETTE, CELL, new THREE.Vector3(GROUND.x0, -2 * CELL, GROUND.z0));
}

// Every piece of the camp, added to `scene`; the materials made here are its to dispose with the geometries.
export function buildTitleCamp(scene: THREE.Scene): THREE.Object3D {
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const glowing = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: 1.8, roughness: 0.5 });
  const put = (geometry: THREE.BufferGeometry, x: number, z: number, turn = 0, scale = 1, material = plain) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = turn;
    mesh.scale.setScalar(scale);
    mesh.castShadow = material === plain;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const floor = new THREE.Mesh(ground(), plain);
  floor.receiveShadow = true;
  scene.add(floor);

  // The camp.
  put(buildCampGeometry('fire', false), FIRE.x, FIRE.z);
  const flames = put(buildCampGeometry('fire', true), FIRE.x, FIRE.z, 0, 1, glowing);
  put(buildCampGeometry('tent', false), -2.9, -2.4, 0.5);
  put(buildCampGeometry('crates', false), 2.7, -2.1, -0.3);
  put(buildCampGeometry('rack', false), 3.3, -0.6, -1.2);
  const scenery = (kind: SceneryKind, variant: number, x: number, z: number, turn = 0) => {
    const [sx, , sz] = sceneryGrid(kind);
    put(greedyMesh(buildScenery(kind, variant), SCENERY_PALETTE, SCENERY_VOXEL, new THREE.Vector3((-sx * SCENERY_VOXEL) / 2, 0, (-sz * SCENERY_VOXEL) / 2)), x, z, turn);
  };
  scenery('log', 1, -1.25, -1.5, 0.5); // (seats by the fire)
  scenery('log', 3, 1.3, -1.6, -0.6);
  scenery('boulder', 2, -4.2, -0.4);
  scenery('boulder', 5, 4.6, -3.4, 1);
  scenery('outcrop', 1, -5.6, -4.8);
  scenery('menhir', 2, 5.4, -6.4);
  scenery('cairn', 0, -1.8, -5.6);

  // Bushes, then the woods: close at the sides, thick behind, a gap where the path runs off.
  const bushes: Array<[BushKind, number, number]> = [['berry', -3.6, 1.4], ['leafy', 3.8, 1.2], ['flowering', -2.2, -3.6], ['leafy', 1.9, -4], ['berry', 5.2, -1.6], ['flowering', -5, -2.2]];
  bushes.forEach(([kind, x, z], i) => put(buildBushGeometry(kind, i * 3 + 1), x, z, i));
  const rng = mulberry32(0x7ee5);
  const kinds: TreeKind[] = ['oak', 'pine', 'birch'];
  for (let n = 0; n < 70; n++) {
    const x = GROUND.x0 + 0.5 + rng() * (GROUND.x1 - GROUND.x0 - 1);
    const z = GROUND.z0 + 0.5 + rng() * (GROUND.z1 - GROUND.z0 - 1);
    const open = Math.hypot(x / 4.4, (z + 1) / 3.2) < 1 || (Math.abs(x + 0.4) < 1.3 && z < -3); // (the clearing, the path)
    if (open || z > 2.2) continue;
    put(buildTreeGeometry(kinds[n % 3], n), x, z, rng() * 6, 1.1 + rng() * 0.35);
  }
  return flames;
}
