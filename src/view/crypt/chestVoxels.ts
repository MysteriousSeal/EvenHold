// A crypt lord's chest (model/crypts/cryptLord.ts), where he rose: dark wood
// planks bound in iron bands, gold at its corners and its lock, its lid
// rounded over; opened, the lid swung back on its hinges and a heap of gold
// inside. Built as two pieces, the box and the lid (it swings on its back edge).

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import { CRYPT_VOXEL } from './cryptVoxels';

const PALETTE = [0x5a3a22, 0x452c18, 0x45484c, 0xe0b040, 0x9a6e1c, 0x1c1612]; // wood, its seams, iron, gold, gold's shade, the dark within
const [WOOD, SEAM, IRON, GOLD, GOLD_DARK, DARK] = [1, 2, 3, 4, 5, 6];
const [W, D, BODY, LID] = [17, 11, 8, 4]; // voxels: across, deep, the box's height, the lid's
export const CHEST_HINGE = { y: BODY * CRYPT_VOXEL, z: (-D / 2) * CRYPT_VOXEL }; // the lid's back edge, from the chest's middle at the floor

// The box, a heap of gold within (seen once it's open).
export function chestBoxGeometry(): THREE.BufferGeometry {
  const grid = createGrid([W, BODY, D]);
  fillBox(grid, 0, 0, 0, W - 1, BODY - 1, D - 1, (_x, y) => (y % 3 === 2 ? SEAM : WOOD)); // planks, their seams dark
  fillBox(grid, 1, 2, 1, W - 2, BODY - 1, D - 2, 0); // (hollow)
  fillBox(grid, 1, 1, 1, W - 2, 1, D - 2, DARK);
  for (let x = 1; x <= W - 2; x++) for (let z = 1; z <= D - 2; z++) {
    const h = 3 + Math.round(3 * Math.sin((x / (W - 1)) * Math.PI) * Math.sin((z / (D - 1)) * Math.PI)); // (heaped)
    fillBox(grid, x, 2, z, x, h, z, (x + z) % 3 === 0 ? GOLD_DARK : GOLD);
  }
  for (const x of [3, W - 4]) fillBox(grid, x, 0, 0, x, BODY - 1, D - 1, IRON); // the bands
  for (const x of [0, W - 1]) for (const z of [0, D - 1]) fillBox(grid, x, 0, z, x, BODY - 1, z, GOLD); // gold at the corners
  fillBox(grid, 7, 3, D - 1, 9, 6, D - 1, GOLD); // the lock
  fillBox(grid, 8, 4, D - 1, 8, 4, D - 1, DARK); // its keyhole
  return greedyMesh(grid, PALETTE, CRYPT_VOXEL, new THREE.Vector3((-W / 2) * CRYPT_VOXEL, 0, (-D / 2) * CRYPT_VOXEL));
}

// The lid, its back edge at the origin (the hinge): rounded over, banded, gold-edged.
export function chestLidGeometry(): THREE.BufferGeometry {
  const grid = createGrid([W, LID, D]);
  for (let z = 0; z < D; z++) {
    const top = Math.round(LID - 1 - 2 * ((z - (D - 1) / 2) / ((D - 1) / 2)) ** 2); // (rounded front to back)
    fillBox(grid, 0, 0, z, W - 1, Math.max(0, top), z, WOOD);
  }
  for (const x of [3, W - 4]) for (let z = 0; z < D; z++) for (let y = 0; y < LID; y++) if (grid.cells[x + W * (y + LID * z)]) fillBox(grid, x, y, z, x, y, z, IRON);
  fillBox(grid, 0, 0, D - 1, W - 1, 0, D - 1, GOLD); // its front edge
  fillBox(grid, 7, 0, D - 1, 9, 1, D - 1, GOLD_DARK); // the lock's hasp
  return greedyMesh(grid, PALETTE, CRYPT_VOXEL, new THREE.Vector3((-W / 2) * CRYPT_VOXEL, 0, 0));
}
