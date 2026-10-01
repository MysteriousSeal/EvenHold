// Many small cubes drawn as one (motes of frost, chips of stone: crypt/), up
// to `max` of them, each its own place, size and colour, set afresh each
// frame (count: how many are shown).

import * as THREE from 'three';

export function cubeCloud(max: number, material: THREE.Material): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, max);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  mesh.frustumCulled = false; // (spread about: never culled by the one box)
  mesh.count = 0;
  return mesh;
}
