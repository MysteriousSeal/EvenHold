// The inside of a building, as its own little scene: the room's voxels
// (roomVoxels.ts) under warm indoor light, laid out in the room's tile
// coordinates (floor tile (0, 0) centered on the origin), so the hero and
// camera move in it just as outdoors.

import * as THREE from 'three';
import type { Room } from '../../model/interiors/interiors';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { Furniture } from '../../model/interiors/furniture';
import { fireOf } from './furnitureVoxels';
import { ROOM_ORIGIN_VOXELS, ROOM_PALETTE, ROOM_VOXEL, buildRoomVoxels } from './roomVoxels';

export function buildRoomScene(room: Room, furniture: readonly Furniture[] = []): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c130c); // darkness beyond the walls
  const offset = -ROOM_ORIGIN_VOXELS * ROOM_VOXEL;
  const geometry = greedyMesh(buildRoomVoxels(room, furniture), ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3(offset, -ROOM_VOXEL, offset));
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  // Warm light from above, a hearth glow from the back corner.
  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x3a2616, 1.3));
  const sun = new THREE.DirectionalLight(0xffd7a0, 1.4);
  sun.position.set(room.width * 0.6, 6, room.depth * 0.8);
  sun.target.position.set(room.width / 2, 0, room.depth / 2);
  scene.add(sun, sun.target);
  // The fire's glow, from the hearth or forge if there's one.
  const fire = fireOf(furniture) ?? { x: 0.3, z: 0.3 };
  const hearth = new THREE.PointLight(0xff9a4a, 3.5, 6, 1.5);
  hearth.position.set(fire.x, 0.45, fire.z + 0.4);
  scene.add(hearth);
  return scene;
}
