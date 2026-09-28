// The inside of a building, as its own little scene: the room's voxels
// (roomVoxels.ts) under warm indoor light, laid out in the room's tile
// coordinates (floor tile (0, 0) centered on the origin), so the hero and
// camera move in it just as outdoors.

import * as THREE from 'three';
import type { Room } from '../../model/interiors/interiors';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { Furniture } from '../../model/interiors/furniture';
import { fireOf } from './furnitureVoxels';
import { FireEffect, flicker } from '../meshes/common/fire';
import { ROOM_ORIGIN_VOXELS, ROOM_PALETTE, ROOM_VOXEL, buildRoomVoxels } from './roomVoxels';

// The room's scene, and what to call each frame (its fire burning).
export function buildRoomScene(room: Room, furniture: readonly Furniture[] = []): { scene: THREE.Scene; update(time: number): void } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c130c); // darkness beyond the walls
  const offset = -ROOM_ORIGIN_VOXELS * ROOM_VOXEL;
  const geometry = greedyMesh(buildRoomVoxels(room, furniture), ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3(offset, -ROOM_VOXEL, offset));
  const room3d = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  room3d.castShadow = true; // furniture and walls block the firelight,
  room3d.receiveShadow = true; // and the floor shows it
  scene.add(room3d);
  // Warm light from above, a hearth glow from the back corner.
  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x3a2616, 1.3));
  const sun = new THREE.DirectionalLight(0xffd7a0, 1.4);
  sun.position.set(room.width * 0.6, 6, room.depth * 0.8);
  sun.target.position.set(room.width / 2, 0, room.depth / 2);
  scene.add(sun, sun.target);
  // The fire, burning in the hearth or on the forge, and its flickering glow.
  const spot = fireOf(furniture);
  // Its light casts real shadows: set just in front of the opening (so the
  // stonework doesn't block it), shadows fan out from the fire and flicker with it.
  const glow = new THREE.PointLight(0xff9a4a, 4.5, 8, 1.4);
  glow.position.set(spot?.x ?? 0.3, 0.38, (spot?.z ?? 0.3) + 0.5);
  glow.castShadow = true;
  glow.shadow.mapSize.set(1024, 1024);
  glow.shadow.bias = -0.004;
  glow.shadow.normalBias = 0.02; // the room shadows itself: no acne on its faces
  glow.shadow.radius = 4;
  glow.shadow.camera.near = 0.05;
  glow.shadow.camera.far = 10;
  scene.add(glow);
  const fire = spot ? new FireEffect(spot.forge ? 0.3 : 0.36, spot.forge ? 0.22 : 0.3, 0.05) : null;
  if (fire && spot) {
    fire.group.position.set(spot.x, spot.y, spot.z);
    scene.add(fire.group);
  }
  return {
    scene,
    update(time) {
      fire?.update(time);
      glow.intensity = 4.5 * flicker(time);
    },
  };
}
