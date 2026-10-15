// Indoors, the camera aimed part way to the room's fire (view/render/camera.ts: roomAim): from a building's door,
// its fire (a smithy's forge, an inn's or a herbalist's hearth) is in frame, its top and all, on every test seed.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { CAMERA_OFFSET, INDOOR_ZOOM } from '../src/view/constants';
import { createCamera, resizeCamera, roomAim } from '../src/view/render/camera';
import { fireOf } from '../src/view/interior/furnitureVoxels';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FIRE_TOP = 1; // world units up (a forge's hood, a hearth's mantel)

// Where a point is on a 16:9 screen (-1 to 1 each way), the camera aimed at `aim`.
function onScreen(aim: { x: number; z: number }, point: THREE.Vector3): THREE.Vector3 {
  const camera = createCamera();
  resizeCamera(camera, 1600, 900);
  camera.zoom = INDOOR_ZOOM;
  camera.updateProjectionMatrix();
  camera.position.set(aim.x + CAMERA_OFFSET.x, CAMERA_OFFSET.y, aim.z + CAMERA_OFFSET.z);
  camera.lookAt(aim.x, 0, aim.z);
  camera.updateMatrixWorld();
  return point.clone().project(camera);
}

describe('the camera indoors', () => {
  it.each(['smithy', 'inn', 'herbalist'] as const)("frames a %s's fire from its door", (type) => {
    let seen = 0;
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const door of type === 'herbalist' ? model.npcs.filter((n) => n.role === 'herbalist').map((n) => n.home!) : model.entrances.filter((e) => e.type === type)) {
        const { room, furniture } = layoutOf(seed, door);
        const fire = fireOf(furniture);
        if (!fire) continue;
        const hero = { x: room.door, z: room.depth - 1 };
        const top = onScreen(roomAim(room, furniture, hero), new THREE.Vector3(fire.x, FIRE_TOP, fire.z));
        const at = onScreen(roomAim(room, furniture, hero), new THREE.Vector3(hero.x, 0, hero.z));
        expect(Math.abs(top.y), `seed ${seed}, ${type} ${room.width}x${room.depth}: the fire's top`).toBeLessThan(0.95);
        expect(Math.abs(top.x)).toBeLessThan(0.95);
        expect(Math.abs(at.y), 'the hero, still in frame').toBeLessThan(0.8);
        // And wherever they stand in it, the hero well in frame.
        for (let x = 0; x < room.width; x++) {
          for (let z = 0; z < room.depth; z++) {
            const p = onScreen(roomAim(room, furniture, { x, z }), new THREE.Vector3(x, 0, z));
            expect(Math.max(Math.abs(p.x), Math.abs(p.y)), `the hero at ${x},${z}`).toBeLessThan(0.7);
          }
        }
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
