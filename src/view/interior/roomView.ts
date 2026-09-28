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
import { ROOM_ORIGIN_VOXELS, ROOM_PALETTE, ROOM_VOXEL, buildPieceVoxels, buildRoomVoxels } from './roomVoxels';

// The room's scene, what to call each frame (its fire burning), and how to
// free it once the hero's left (it disposes only what it made: the hero, moved
// in from the world, isn't touched).
export function buildRoomScene(room: Room, furniture: readonly Furniture[] = []): { scene: THREE.Scene; update(time: number): void; dispose(): void } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c130c); // darkness beyond the walls
  const offset = -ROOM_ORIGIN_VOXELS * ROOM_VOXEL;
  const origin = new THREE.Vector3(offset, -ROOM_VOXEL, offset);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const lamps = furniture.filter((f) => f.kind === 'wallLantern');
  const geometry = greedyMesh(buildRoomVoxels(room, furniture.filter((f) => f.kind !== 'wallLantern')), ROOM_PALETTE, ROOM_VOXEL, origin);
  const room3d = new THREE.Mesh(geometry, material);
  room3d.castShadow = true; // furniture and walls block the firelight,
  room3d.receiveShadow = true; // and the floor shows it
  scene.add(room3d);
  // The wall lanterns, meshed apart and casting no shadow: their own light
  // shines from them, and a lantern's shadow on the wall behind it looks wrong.
  const lamps3d = lamps.length > 0 ? new THREE.Mesh(greedyMesh(buildPieceVoxels(room, lamps), ROOM_PALETTE, ROOM_VOXEL, origin), material) : null;
  if (lamps3d) scene.add(lamps3d);
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
  // Wall lanterns light the room around them and cast their own shadows
  // (at a lower resolution than the fire's), each light just out in front of
  // its lantern's glass so the lantern itself doesn't block it.
  const lanterns = lamps.map((f) => {
      const light = new THREE.PointLight(0xffc070, 1.8, 4, 1.5);
      const out = 0.42; // off the wall, past the lantern
      light.position.set(f.wall === 'left' ? f.x - 0.5 + out : f.x, 0.62, f.wall === 'left' ? f.z : f.z - 0.5 + out);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.004;
      light.shadow.normalBias = 0.02;
      light.shadow.radius = 3;
      light.shadow.camera.near = 0.05;
      light.shadow.camera.far = 6;
      // A softer light between lantern and wall (no shadow), so the wall behind glows too.
      const back = new THREE.PointLight(0xffc070, 0.9, 1.4, 1.6);
      const behind = 0.1;
      back.position.set(f.wall === 'left' ? f.x - 0.5 + behind : f.x, 0.72, f.wall === 'left' ? f.z : f.z - 0.5 + behind);
      scene.add(light, back);
      return light;
    });
  return {
    scene,
    update(time) {
      lanterns.forEach((light, i) => (light.intensity = 1.8 * flicker(time * 0.7, i * 5)));
      fire?.update(time);
      glow.intensity = 4.5 * flicker(time);
    },
    dispose() {
      geometry.dispose();
      lamps3d?.geometry.dispose();
      material.dispose();
      for (const light of [glow, ...lanterns]) light.dispose(); // their shadow maps
      fire?.dispose();
    },
  };
}
