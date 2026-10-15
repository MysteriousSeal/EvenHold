import * as THREE from 'three';
import { CAMERA_OFFSET, FRUSTUM_SIZE } from '../constants';
import type { Room } from '../../model/interiors/interiors';
import type { Furniture } from '../../model/interiors/furniture';
import { fireOf } from '../interior/furnitureVoxels';

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

// Indoors, where the camera aims: part way from the hero toward the room's fire (a smithy's forge, a hearth), else its
// middle, so the room's heart is in frame from its door; never so far the hero's off to the frame's edge.
export const ROOM_BIAS = 0.5; // of the way there
const ROOM_LEAD = { across: 3.5, along: 3 }; // world units at most, across the screen and up it (the frame's shorter)

export function roomAim(room: Room, furniture: readonly Furniture[], hero: { x: number; z: number }): { x: number; z: number } {
  const fire = fireOf(furniture);
  const [fx, fz] = fire ? [fire.x, fire.z] : [(room.width - 1) / 2, (room.depth - 1) / 2]; // (tile centres at whole numbers)
  const [dx, dz] = [(fx - hero.x) * ROOM_BIAS, (fz - hero.z) * ROOM_BIAS];
  const clamp = (v: number, most: number) => Math.max(-most, Math.min(most, v));
  const across = clamp((dx - dz) / Math.SQRT2, ROOM_LEAD.across); // (the camera looks along -x-z: across is x-z, along x+z)
  const along = clamp((dx + dz) / Math.SQRT2, ROOM_LEAD.along);
  return { x: hero.x + (across + along) / Math.SQRT2, z: hero.z + (along - across) / Math.SQRT2 };
}
