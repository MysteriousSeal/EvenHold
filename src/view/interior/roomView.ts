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
import { ROOM_ORIGIN_VOXELS, ROOM_PALETTE, ROOM_VOXEL, buildPieceVoxels, buildRoomVoxels, sunkBelow } from './roomVoxels';
import { tankard } from './furniturePalette';
import { DOOR_LEAF, paintDoorLeaf } from './innFurnitureVoxels';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';

// The room's scene, what to call each frame (its fire burning), and how to
// free it once the hero's left (it disposes only what it made: the hero, moved
// in from the world, isn't touched).
// The drinks on the bar's counter, before the stools: full tankards, and the empty mugs they leave.
const MUG_AT = { x: 1.1, y: 0.52 }; // over the counter's top, on the customers' side
function mugGeometries(): Record<'full' | 'empty', THREE.BufferGeometry> {
  const mesh = (full: boolean) => {
    const grid = createGrid([4, 5, 3]);
    tankard((u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, color), 0, 0, 0, full);
    return greedyMesh(grid, ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3(-2 * ROOM_VOXEL, 0, -1.5 * ROOM_VOXEL));
  };
  return { full: mesh(true), empty: mesh(false) };
}

const TILE_VOXELS = 25;
const SWING = (100 * Math.PI) / 180; // how far a door swings open
const SWING_TIME = 0.7; // seconds, to open or close

// A hallway door's leaf, hung from its hinge edge (x 0), standing on the floor, its thickness centred.
function doorLeafGeometry(): THREE.BufferGeometry {
  const { width, height, thick } = DOOR_LEAF;
  const grid = createGrid([width, height, thick]);
  paintDoorLeaf((u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, color));
  return greedyMesh(grid, ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3(0, 0, (-thick / 2) * ROOM_VOXEL));
}

export function buildRoomScene(room: Room, furniture: readonly Furniture[] = [], door = true): { scene: THREE.Scene; update(time: number): void; dispose(): void; showMugs(mugs: ReadonlyArray<{ z: number; full: boolean }>): void } {
  const scene = new THREE.Scene();
  const DARK = 0x1c130c;
  scene.background = new THREE.Color(DARK); // darkness beyond the walls
  const offset = -ROOM_ORIGIN_VOXELS * ROOM_VOXEL;
  const below = sunkBelow(furniture); // the grid reaching under the floor (a stairwell)
  const origin = new THREE.Vector3(offset, -ROOM_VOXEL * (1 + below), offset);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const lamps = furniture.filter((f) => f.kind === 'wallLantern');
  const geometry = greedyMesh(buildRoomVoxels(room, furniture.filter((f) => f.kind !== 'wallLantern'), door), ROOM_PALETTE, ROOM_VOXEL, origin);
  const room3d = new THREE.Mesh(geometry, material);
  room3d.castShadow = true; // furniture and walls block the firelight,
  room3d.receiveShadow = true; // and the floor shows it
  scene.add(room3d);
  // The wall lanterns, meshed apart and casting no shadow: their own light
  // shines from them, and a lantern's shadow on the wall behind it looks wrong.
  const lamps3d = lamps.length > 0 ? new THREE.Mesh(greedyMesh(buildPieceVoxels(room, lamps, below), ROOM_PALETTE, ROOM_VOXEL, origin), material) : null;
  if (lamps3d) scene.add(lamps3d);
  // What's under the floor (a stairwell's shaft) hidden from outside: a
  // curtain the colour of the dark beyond, unlit, down the room's two near
  // sides (looking down into the shaft, the eye passes over it).
  const curtain = new THREE.MeshBasicMaterial({ color: DARK, toneMapped: false });
  const drapes: THREE.PlaneGeometry[] = [];
  if (below > 0) {
    const out = ROOM_ORIGIN_VOXELS * ROOM_VOXEL - 1; // the near walls' outer faces, past the last tiles' edge
    const [x0, x1, z0, z1] = [offset, room.width + out, offset, room.depth + out];
    const h = below * ROOM_VOXEL + 0.01;
    const y = -ROOM_VOXEL - h / 2; // from the floor's underside down
    const front = new THREE.PlaneGeometry(x1 - x0, h).translate((x0 + x1) / 2, y, z1 + 0.001);
    const side = new THREE.PlaneGeometry(z1 - z0, h).rotateY(Math.PI / 2).translate(x1 + 0.001, y, (z0 + z1) / 2);
    drapes.push(front, side);
    for (const g of drapes) scene.add(new THREE.Mesh(g, curtain));
  }
  // The doors upstairs, each hung from its hinge, meshed apart to swing
  // (into the room behind it) as it's opened or closed.
  const leafShape = doorLeafGeometry();
  const doors = furniture.filter((f) => f.kind === 'hallDoor').map((f) => {
    const left = f.wall === 'left';
    const len = (left ? f.d : f.w) * TILE_VOXELS;
    const along = (left ? f.z : f.x) - 0.5 + (Math.floor((len - TILE_VOXELS) / 2) + DOOR_LEAF.hinge) * ROOM_VOXEL;
    const across = (left ? f.x : f.z) - 0.5 + (DOOR_LEAF.thick / 2) * ROOM_VOXEL; // in its wall's middle
    const leaf = new THREE.Mesh(leafShape, material);
    leaf.castShadow = leaf.receiveShadow = true;
    const hinge = new THREE.Group();
    hinge.position.set(left ? across : along, 0, left ? along : across);
    hinge.add(leaf);
    scene.add(hinge);
    // Along the wall (+z on the left one, +x on the back), swung toward +x or +z.
    return { f, hinge, base: left ? -Math.PI / 2 : 0, way: left ? 1 : -1, t: f.open ? 1 : 0 };
  });
  const swingDoors = (dt: number) => {
    for (const d of doors) {
      d.t = Math.min(1, Math.max(0, d.t + (d.f.open ? dt : -dt) / SWING_TIME));
      const eased = (1 - Math.cos(d.t * Math.PI)) / 2; // eased in and out, gently (one curve both ways: no jump turning back mid-swing)
      d.hinge.rotation.y = d.base + d.way * SWING * eased;
    }
  };
  swingDoors(0);
  let lastTime: number | null = null;
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
  if (spot) scene.add(glow); // no fire (upstairs), no glow: else a warm spot on the bare floor
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
  // The drinks on the bar (inn/barMugs.ts): a mesh each, made as needed and reused.
  const mugShapes = mugGeometries();
  const mugs: THREE.Mesh[] = [];
  return {
    scene,
    showMugs(list) {
      while (mugs.length < list.length) {
        const mug = new THREE.Mesh(mugShapes.full, material);
        scene.add(mug);
        mugs.push(mug);
      }
      mugs.forEach((mug, i) => {
        const at = list[i];
        mug.visible = !!at;
        if (!at) return;
        mug.geometry = at.full ? mugShapes.full : mugShapes.empty;
        mug.position.set(MUG_AT.x, MUG_AT.y, at.z);
      });
    },
    update(time) {
      swingDoors(lastTime === null ? 0 : Math.max(0, time - lastTime));
      lastTime = time;
      lanterns.forEach((light, i) => (light.intensity = 1.8 * flicker(time * 0.7, i * 5)));
      fire?.update(time);
      glow.intensity = 4.5 * flicker(time);
    },
    dispose() {
      geometry.dispose();
      lamps3d?.geometry.dispose();
      for (const g of drapes) g.dispose();
      leafShape.dispose();
      curtain.dispose();
      mugShapes.full.dispose();
      mugShapes.empty.dispose();
      material.dispose();
      for (const light of [glow, ...lanterns]) light.dispose(); // their shadow maps
      fire?.dispose();
    },
  };
}
