import * as THREE from 'three';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../constants';

export interface MovementAxes {
  forward: { x: number; z: number };
  right: { x: number; z: number };
}

export function createCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-FRUSTUM_SIZE, FRUSTUM_SIZE, FRUSTUM_SIZE, -FRUSTUM_SIZE, 0.1, 100);
  camera.position.copy(CAMERA_OFFSET);
  camera.lookAt(0, 0, 0);
  return camera;
}

// Movement axes are derived from the camera's fixed direction, flattened
// to the XZ plane, so WASD lines up visually with the isometric view.
export function computeMovementAxes(): MovementAxes {
  const forward = new THREE.Vector2(-CAMERA_OFFSET.x, -CAMERA_OFFSET.z).normalize();
  const right = new THREE.Vector2(-forward.y, forward.x).normalize();
  return {
    forward: { x: forward.x, z: forward.y },
    right: { x: right.x, z: right.y },
  };
}

export function resizeCamera(camera: THREE.OrthographicCamera, width: number, height: number): void {
  const aspect = width / height;
  camera.left = (-FRUSTUM_SIZE * aspect) / 2;
  camera.right = (FRUSTUM_SIZE * aspect) / 2;
  camera.top = FRUSTUM_SIZE / 2;
  camera.bottom = -FRUSTUM_SIZE / 2;
  camera.updateProjectionMatrix();
}
