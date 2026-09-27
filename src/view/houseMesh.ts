import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import {
  HOUSE_BODY_WIDTH,
  HOUSE_BODY_HEIGHT,
  HOUSE_BODY_DEPTH,
  HOUSE_ROOF_HEIGHT,
  HOUSE_ROOF_RADIUS,
  HOUSE_BODY_COLOR,
  HOUSE_ROOF_COLOR,
  HOUSE_DOOR_COLOR,
  HOUSE_WINDOW_COLOR,
} from './constants';

// A box body with a square pyramid roof (a 4-sided cone rotated 45° so its
// edges line up with the box below), plus a door on the local -Z wall and a
// window on the local +X wall. Both accents rotate with the house since
// they're offset in the house's local frame before the shared rotation is
// applied.
export function buildHouses(scene: THREE.Scene, model: GameModel): void {
  const count = model.houses.length;
  if (count === 0) return;

  const bodyGeometry = new THREE.BoxGeometry(HOUSE_BODY_WIDTH, HOUSE_BODY_HEIGHT, HOUSE_BODY_DEPTH);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: HOUSE_BODY_COLOR, flatShading: true, roughness: 0.9 });
  const bodyMesh = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count);

  const roofGeometry = new THREE.ConeGeometry(HOUSE_ROOF_RADIUS, HOUSE_ROOF_HEIGHT, 4);
  roofGeometry.rotateY(Math.PI / 4);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: HOUSE_ROOF_COLOR, flatShading: true, roughness: 0.8 });
  const roofMesh = new THREE.InstancedMesh(roofGeometry, roofMaterial, count);

  // Thin dimension (0.06) faces outward from the wall it's mounted on.
  const doorGeometry = new THREE.BoxGeometry(0.22, 0.32, 0.06);
  const doorMaterial = new THREE.MeshStandardMaterial({ color: HOUSE_DOOR_COLOR, roughness: 0.9 });
  const doorMesh = new THREE.InstancedMesh(doorGeometry, doorMaterial, count);

  const windowGeometry = new THREE.BoxGeometry(0.06, 0.16, 0.16);
  const windowMaterial = new THREE.MeshStandardMaterial({ color: HOUSE_WINDOW_COLOR, roughness: 0.4 });
  const windowMesh = new THREE.InstancedMesh(windowGeometry, windowMaterial, count);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const base = new THREE.Vector3();
  const position = new THREE.Vector3();
  const localOffset = new THREE.Vector3();
  const scaleOne = new THREE.Vector3(1, 1, 1);

  model.houses.forEach((house, i) => {
    quaternion.setFromAxisAngle(upAxis, house.rotationY);
    base.set(house.x, house.groundHeight, house.z);

    position.copy(base).add(new THREE.Vector3(0, HOUSE_BODY_HEIGHT / 2, 0));
    matrix.compose(position, quaternion, scaleOne);
    bodyMesh.setMatrixAt(i, matrix);

    position.copy(base).add(new THREE.Vector3(0, HOUSE_BODY_HEIGHT + HOUSE_ROOF_HEIGHT / 2, 0));
    matrix.compose(position, quaternion, scaleOne);
    roofMesh.setMatrixAt(i, matrix);

    localOffset.set(0, 0.16, -HOUSE_BODY_DEPTH / 2 - 0.01).applyQuaternion(quaternion);
    position.copy(base).add(localOffset);
    matrix.compose(position, quaternion, scaleOne);
    doorMesh.setMatrixAt(i, matrix);

    localOffset.set(HOUSE_BODY_WIDTH / 2 + 0.01, HOUSE_BODY_HEIGHT / 2 + 0.05, 0).applyQuaternion(quaternion);
    position.copy(base).add(localOffset);
    matrix.compose(position, quaternion, scaleOne);
    windowMesh.setMatrixAt(i, matrix);
  });

  scene.add(bodyMesh, roofMesh, doorMesh, windowMesh);
}
