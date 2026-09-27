import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { FOLIAGE_LAYERS } from '../constants';

export function buildTrees(scene: THREE.Scene, model: GameModel): void {
  const count = model.trees.length;
  if (count === 0) return;

  const trunkGeometry = new THREE.CylinderGeometry(0.06, 0.12, 0.5, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a30, flatShading: true, roughness: 1 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);

  const foliageMeshes = FOLIAGE_LAYERS.map((layer) => {
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({ color: layer.color, flatShading: true, roughness: 0.9 });
    return new THREE.InstancedMesh(geometry, material, count);
  });

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scaleVec = new THREE.Vector3();

  model.trees.forEach((tree, i) => {
    quaternion.setFromAxisAngle(upAxis, tree.rotationY);

    scaleVec.set(tree.scale, tree.scale, tree.scale);
    position.set(tree.x, tree.groundHeight + 0.25 * tree.scale, tree.z);
    matrix.compose(position, quaternion, scaleVec);
    trunkMesh.setMatrixAt(i, matrix);

    FOLIAGE_LAYERS.forEach((layer, layerIndex) => {
      const radius = layer.radius * tree.scale;
      scaleVec.set(radius, radius, radius);
      position.set(tree.x, tree.groundHeight + layer.yOffset * tree.scale, tree.z);
      matrix.compose(position, quaternion, scaleVec);
      foliageMeshes[layerIndex].setMatrixAt(i, matrix);
    });
  });

  scene.add(trunkMesh, ...foliageMeshes);
}
