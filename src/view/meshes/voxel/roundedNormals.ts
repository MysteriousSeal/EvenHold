// Soft shading on blocky forms, without a voxel more: each vertex of a
// greedy-meshed voxel model gets a normal bent from its face's toward the
// way out of the solid around it there (from the eight voxels touching that
// corner), so a head or a limb is lit as a rounded form while its outline
// stays every bit as blocky (no smoothing of the shape itself, which would
// lose the voxel look). Flat runs keep their face's normal: the bend only
// shows at edges and corners, shading across the faces between them.

import * as THREE from 'three';
import type { VoxelGrid } from './greedyMesh';
import { colorAt } from './voxelShapes';

const STRENGTH = 0.55; // 0: flat faces, 1: fully rounded

export function roundNormals(geometry: THREE.BufferGeometry, grid: VoxelGrid, voxelSize: number, origin: THREE.Vector3, strength = STRENGTH): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal) return geometry;
  const solid = (x: number, y: number, z: number) => colorAt(grid, x, y, z) !== 0;
  const face = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    // The grid corner this vertex sits on.
    const gx = Math.round((position.getX(i) - origin.x) / voxelSize);
    const gy = Math.round((position.getY(i) - origin.y) / voxelSize);
    const gz = Math.round((position.getZ(i) - origin.z) / voxelSize);
    // Out of the solid: away from the voxels touching it.
    out.set(0, 0, 0);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let h = 0; h < 2; h++) if (solid(gx - 1 + h, gy - 1 + j, gz - 1 + k)) out.add(face.set(0.5 - h, 0.5 - j, 0.5 - k));
    face.fromBufferAttribute(normal, i);
    if (out.lengthSq() < 1e-6) continue;
    out.normalize();
    if (out.dot(face) <= 0.15) continue; // (a crease the other way: keep it crisp)
    out.multiplyScalar(strength).addScaledVector(face, 1 - strength).normalize();
    normal.setXYZ(i, out.x, out.y, out.z);
  }
  normal.needsUpdate = true;
  return geometry;
}
