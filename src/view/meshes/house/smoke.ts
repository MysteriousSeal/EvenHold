// Chimney smoke as voxel puffs: small grey cubes that rise from each
// chimney, drift downwind, swell and then shrink away, lightening as they
// thin. Positions and sizes snap to the world's 0.04 voxel grid so the
// smoke reads as voxels too. Every puff of every chimney is one instance of
// a single mesh, moved each frame (a few hundred cubes at most).

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';

const VOXEL = 0.04;
const PUFFS_PER_CHIMNEY = 7;
const LIFETIME = 3.6; // seconds from chimney to gone
const RISE = 1.0; // world units risen over a lifetime
const DRIFT = new THREE.Vector3(0.32, 0, 0.19); // downwind travel over a lifetime (the wind's direction)
const SOOT = new THREE.Color(0x6a6560);
const HAZE = new THREE.Color(0xd8d4cc);

const snap = (v: number) => Math.round(v / VOXEL) * VOXEL;

export function addChimneySmoke(scene: WorldSink, chimneys: THREE.Vector3[]): (elapsedSeconds: number) => void {
  if (chimneys.length === 0) return () => {};
  const count = chimneys.length * PUFFS_PER_CHIMNEY;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    count,
  );
  // Puffs are spread over the whole map, so one bounding volume would cover
  // everything anyway; skip culling rather than recompute it every frame.
  mesh.frustumCulled = false;
  scene.add(mesh);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();

  return (elapsedSeconds) => {
    chimneys.forEach((chimney, c) => {
      for (let p = 0; p < PUFFS_PER_CHIMNEY; p++) {
        // Puffs are evenly staggered in time, each chimney on its own phase.
        const t = ((elapsedSeconds / LIFETIME + p / PUFFS_PER_CHIMNEY + c * 0.37) % 1 + 1) % 1;
        const wobble = Math.sin((t + c) * 9 + p) * 0.03;
        position.set(
          snap(chimney.x + DRIFT.x * t * t + wobble),
          snap(chimney.y + RISE * t),
          snap(chimney.z + DRIFT.z * t * t - wobble),
        );
        // Swells as it rises, then shrinks away; whole voxels, at least one.
        const size = Math.max(VOXEL, snap(VOXEL * (2 + 3 * t) * (1 - t * t)));
        matrix.compose(position, quaternion, scale.setScalar(size));
        const i = c * PUFFS_PER_CHIMNEY + p;
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, color.copy(SOOT).lerp(HAZE, t));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
}
