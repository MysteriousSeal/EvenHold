// The main menu's valley (titleScene.ts), round the camp (titleCamp.ts):
// stepped voxel hills rising away from the clearing, a lake in a hollow
// catching the sky, the camp's path running on down a pass between them,
// and far off a ridge of mountains capped with snow, melting into the dusk.
// Forests cover the slopes, thick low down, thinning up high: chunky
// low-voxel trees (oaks, pines, birches, a few turning amber), instanced, so
// thousands cost little; the game's own fine trees stand only in the camp,
// where the camera comes close.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { mulberry32 } from '../../util/random';
import { CAMP_AREA } from './titleCamp';

const CELL = 0.5;
const SPAN = { x0: -60, x1: 60, z0: -100, z1: 50 };
const LAYERS = 20;
const LAKE = { x: 19, z: -26, r: 7.5 };
const PALETTE = [
  0x8bbf6a, 0x7fb35e, 0x95c774, 0x6fa552, // grass
  0x8a7f78, 0x7d736c, 0x6c625d, // stone
  0x9c774b, // earth
  0xf4ece6, 0xdcd6e0, // snow, its shade
  0x6f9cc4, 0x8fb6d6, // water, its glints
  0xa8916c, // the path
];
const [G0, G1, G2, G3, S0, S1, S2, EARTH, SNOW, SNOW2, WATER, GLINT, PATH] = PALETTE.map((_, i) => i + 1);

// Where the camp's path runs off (titleCamp's), on into the pass.
const pathX = (z: number) => -0.4 + 0.35 * Math.sin(z * 0.45);

function noise(x: number, z: number): number {
  return Math.sin(x * 0.13 + 0.7) * 0.9 + Math.sin(z * 0.11 + 1.3) * 0.8 + Math.sin((x + z) * 0.071) * 1.1 + Math.sin((x - z) * 0.23) * 0.35;
}

// The ground's height there, in cells (0: level with the camp).
export function valleyHeight(x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x) - 9, 0);
  const dz = Math.max(0, z - 5, -10 - z, 0);
  const d = Math.hypot(dx, dz);
  let h = d * 0.2 + noise(x, z) * Math.min(1, d / 8) * 1.4;
  h -= Math.max(0, 4 - Math.abs(x - pathX(z))) * 0.5 * Math.min(1, Math.max(0, -10 - z) / 6); // (the pass)
  if (z < -55) h += (-55 - z) * 0.32 + Math.abs(Math.sin(x * 0.09)) * 5; // (the far mountains)
  const lake = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
  if (lake < 1.6) h = Math.min(h, lake < 1 ? 0 : (lake - 1) * 5);
  return Math.max(0, Math.min(LAYERS - 1, Math.round(h)));
}
const inLake = (x: number, z: number) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r;
const inCamp = (x: number, z: number) => x > CAMP_AREA.x0 && x < CAMP_AREA.x1 && z > CAMP_AREA.z0 && z < CAMP_AREA.z1;

function terrain(): THREE.BufferGeometry {
  const rng = mulberry32(0x7a11e);
  const nx = (SPAN.x1 - SPAN.x0) / CELL;
  const nz = (SPAN.z1 - SPAN.z0) / CELL;
  const grid = createGrid([nx, LAYERS + 1, nz]);
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const x = SPAN.x0 + (i + 0.5) * CELL;
      const z = SPAN.z0 + (k + 0.5) * CELL;
      if (inCamp(x, z)) continue; // (the camp's own ground)
      const h = valleyHeight(x, z);
      const roll = rng();
      let top: number;
      if (inLake(x, z)) top = roll < 0.06 ? GLINT : WATER;
      else if (h >= 15) top = roll < 0.3 ? SNOW2 : SNOW;
      else if (h >= 11) top = roll < 0.5 ? S0 : roll < 0.75 ? S1 : G3;
      else if (Math.abs(x - pathX(z)) < 0.55 && z < -10) top = PATH;
      else top = roll < 0.25 ? G1 : roll < 0.45 ? G2 : roll < 0.52 ? G3 : G0;
      // The column: rock down its sides (earth just under the grass), its top as above.
      for (let y = 0; y <= h; y++) {
        const color = y === h ? top : y === h - 1 && h < 11 ? EARTH : (x * 3 + y * 7 + z) % 5 < 2 ? S1 : y % 3 ? S0 : S2;
        setColor(grid, i, y, k, color);
      }
    }
  }
  return greedyMesh(grid, PALETTE, CELL, new THREE.Vector3(SPAN.x0, -CELL, SPAN.z0));
}

// The far trees: few voxels, strong silhouettes.
const TREE_CELL = 0.28;
const TREE_PALETTE = [0x6b4a32, 0x4f7d3a, 0x3f6a32, 0x5f9446, 0x2f5a3a, 0x24493a, 0xece4d6, 0x9fca6a, 0x86b257, 0xd98a3a, 0xc4692e];
const [TRUNK, OAK, OAK_DARK, OAK_LIGHT, PINE, PINE_DARK, BARK_PALE, BIRCH, BIRCH_DARK, AMBER, AMBER_DARK] = TREE_PALETTE.map((_, i) => i + 1);
type FarTree = 'oak' | 'pine' | 'birch' | 'amber';

function farTree(kind: FarTree): THREE.BufferGeometry {
  const grid = createGrid([7, 11, 7]);
  const trunk = kind === 'birch' ? BARK_PALE : TRUNK;
  const tall = kind === 'pine' ? 2 : 3;
  for (let y = 0; y < tall; y++) setColor(grid, 3, y, 3, trunk);
  const [light, dark] = kind === 'pine' ? [PINE, PINE_DARK] : kind === 'birch' ? [BIRCH, BIRCH_DARK] : kind === 'amber' ? [AMBER, AMBER_DARK] : [OAK_LIGHT, OAK_DARK];
  for (let y = tall; y < 11; y++) {
    for (let x = 0; x < 7; x++) {
      for (let z = 0; z < 7; z++) {
        const r = Math.hypot(x - 3, z - 3);
        const up = y - tall;
        const inside = kind === 'pine' ? r <= 3.2 - (up % 3) * 0.9 - up * 0.28 && up < 8 : r ** 2 / 9.5 + ((up - 2.6) / 2.9) ** 2 <= 1 && (kind !== 'birch' || r < 2.6);
        if (!inside) continue;
        const lit = y > tall + 2 && (x + z) % 3 !== 0 ? light : kind === 'oak' && (x * z) % 4 === 1 ? OAK : dark;
        setColor(grid, x, y, z, lit);
      }
    }
  }
  return greedyMesh(grid, TREE_PALETTE, TREE_CELL, new THREE.Vector3(-3.5 * TREE_CELL, 0, -3.5 * TREE_CELL));
}

// Where trees mustn't stand: the camp, the meadow before it (where the camera ends), the lake, the path.
function open(x: number, z: number, h: number): boolean {
  if (x > CAMP_AREA.x0 - 1 && x < CAMP_AREA.x1 + 1 && z > CAMP_AREA.z0 - 1 && z < CAMP_AREA.z1 + 1) return true;
  if (Math.abs(x) < 13 && z > 3 && z < 30) return true;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1) return true;
  if (Math.abs(x - pathX(z)) < 1.6) return true;
  return h >= 13;
}

export function buildTitleValley(scene: THREE.Scene): void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const land = new THREE.Mesh(terrain(), material);
  land.receiveShadow = true;
  scene.add(land);

  const kinds: FarTree[] = ['oak', 'pine', 'birch', 'amber'];
  const spots: Record<FarTree, THREE.Matrix4[]> = { oak: [], pine: [], birch: [], amber: [] };
  const rng = mulberry32(0xf0e57);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let x = SPAN.x0 + 1; x < SPAN.x1 - 1; x += 1.5) {
    for (let z = SPAN.z0 + 1; z < SPAN.z1 - 1; z += 1.5) {
      const tx = x + (rng() - 0.5) * 1.3;
      const tz = z + (rng() - 0.5) * 1.3;
      const h = valleyHeight(tx, tz);
      if (open(tx, tz, h)) continue;
      const thick = h < 5 ? 0.62 : h < 9 ? 0.45 : 0.2; // (thick low down, thin up high)
      if (rng() > thick) continue;
      const roll = rng();
      const kind: FarTree = h >= 8 ? (roll < 0.85 ? 'pine' : 'birch') : roll < 0.38 ? 'oak' : roll < 0.68 ? 'pine' : roll < 0.86 ? 'birch' : 'amber';
      const s = 0.85 + rng() * 0.5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(rng() * 4) * (Math.PI / 2));
      spots[kind].push(m.clone().compose(new THREE.Vector3(tx, h * CELL, tz), q, new THREE.Vector3(s, s * (0.9 + rng() * 0.3), s)));
    }
  }
  for (const kind of kinds) {
    const forest = new THREE.InstancedMesh(farTree(kind), material, spots[kind].length);
    spots[kind].forEach((at, i) => forest.setMatrixAt(i, at));
    forest.castShadow = true;
    forest.receiveShadow = true;
    scene.add(forest);
  }
}
