// The forge's chimney smoke: thick sooty puffs that rise from each forge
// chimney, lean off downwind (the one wind, as the houses' smoke and the
// grass), swell and then thin away, lightening as they go (the puffs'
// shape and drift: smoke/puffs.ts). Every puff of every chimney is one
// instance of a single mesh, moved each frame (a few hundred at most).

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { puffAt, puffGeometry, type Draft } from '../smoke/puffs';

const PUFFS_PER_CHIMNEY = 7;
const LIFETIME = 3.6; // seconds from chimney to gone
const DRAFT: Draft = { rise: 1.0, lean: 1.0, size: 0.2 }; // (a forge's: dense, quick, not far)
const SOOT = new THREE.Color(0x6a6560);
const HAZE = new THREE.Color(0xd8d4cc);

// `wind`: which way it blows now (x, z) and how hard (0..1).
export function addChimneySmoke(scene: WorldSink, chimneys: THREE.Vector3[], wind: () => { x: number; z: number; strength: number }): (elapsedSeconds: number) => void {
  if (chimneys.length === 0) return () => {};
  const count = chimneys.length * PUFFS_PER_CHIMNEY;
  const mesh = new THREE.InstancedMesh(puffGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), count);
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
    const now = wind();
    chimneys.forEach((chimney, c) => {
      for (let p = 0; p < PUFFS_PER_CHIMNEY; p++) {
        // Puffs are evenly staggered in time, each chimney on its own phase.
        const t = ((elapsedSeconds / LIFETIME + p / PUFFS_PER_CHIMNEY + c * 0.37) % 1 + 1) % 1;
        const size = puffAt(position, chimney, t, now, elapsedSeconds, c * 0.37, DRAFT);
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
