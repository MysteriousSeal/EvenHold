// Someone turned into a chicken (model/spells/chickens.ts), staged part by part (staging.ts).
// Someone human-shaped:
//  1. a start: they look about them, uneasy;
//  2. the legs go first: thinner, shorter (they sink), yellow, wobbling under them;
//  3. the arms: swung back and flattened against the sides into wings, white, a flap or two;
//  4. the body: tipped forward level over the legs, rounded out, white; a tail fanning up behind;
//  5. the head: smaller, white, held up; a comb pushing out of the crown, a beak from the face, a wattle under it;
//  6. all of it down to a hen's size, lit white from within, and it gives way to the hen.
// Anything else (a wolf, a spider, a ghost: one part, the whole of it): a shiver; its shape pulled to a hen's
// proportions; whitened; comb, beak and tail pushing out of it; then down to her size, likewise.
// The hen then: sprung out stretched, hopping, shaking her head, and a peck at the ground.
import * as THREE from 'three';
import { SWAP, henShape } from '../meshes/wildlife/chickenMorph';
import { createHen } from '../meshes/wildlife/chickenRig';
import { BODY_GRID, CHICKEN_VOXEL_SIZE, HEAD_GRID, LEG_HEIGHT } from '../meshes/wildlife/chickenVoxels';
import { over, swell, type Actor } from './actor';
import type { Staging } from './staging';

const FEATHER = new THREE.Color(0xf4f0e6);
const SHANK = new THREE.Color(0xe8b23a);
const [RED, YELLOW, WHITE] = [0xd23a2e, 0xe8b23a, 0xf4f0e6];
const V = CHICKEN_VOXEL_SIZE;
// The hen, as she stands: how wide, tall and long.
export const HEN = new THREE.Vector3(BODY_GRID[0] * V, (LEG_HEIGHT + BODY_GRID[1] + HEAD_GRID[1] - 3) * V, (BODY_GRID[2] + 2) * V);
const LEAN = 1.2; // radians the body tips forward

interface Grown {
  comb: THREE.Mesh[];
  beak: THREE.Mesh;
  wattle: THREE.Mesh;
  tail: THREE.Mesh[];
}

// What grows on them: on a head (its box) and at a back end, by a unit `u` of their own size.
function grown(actor: Actor, head: { on: THREE.Object3D; box: THREE.Box3 }, rear: { on: THREE.Object3D; at: THREE.Vector3 }, u: number): Grown {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const mid = head.box.getCenter(v(0, 0, 0));
  const comb = [-1, 0, 1].map((i) => actor.grow(head.on, v(mid.x, head.box.max.y + u * (i === 0 ? 0.75 : 0.5), mid.z + i * u), v(u * 0.8, u * (i === 0 ? 1.5 : 1), u), RED));
  const beak = actor.grow(head.on, v(mid.x, mid.y - u * 0.2, head.box.max.z + u * 0.8), v(u, u * 0.8, u * 1.6), YELLOW);
  const wattle = actor.grow(head.on, v(mid.x, mid.y - u * 1.3, head.box.max.z + u * 0.3), v(u * 0.8, u * 1.3, u * 0.8), RED);
  const tail = [-1, 0, 1].map((i) => actor.grow(rear.on, v(rear.at.x + i * u * 0.9, rear.at.y + u * (i === 0 ? 1.6 : 1.1), rear.at.z - u * 0.6), v(u * 0.8, u * (i === 0 ? 3.2 : 2.2), u * 0.7), WHITE));
  return { comb, beak, wattle, tail };
}

export const chickenStaging: Staging = {
  title: "Hen-wife's turn",
  becomes: 'A chicken',
  lines: [
    [0, '{name} feels something is wrong.'],
    [0.1, 'The legs go first: thin, yellow, and much too short.'],
    [0.3, 'The arms fold back into wings.'],
    [0.48, 'The body tips over and rounds out. A tail.'],
    [0.66, 'A comb. A beak. A wattle.'],
    [0.86, 'And smaller. Much smaller.'],
  ],
  feathers: [0.3, 1],

  prepare(actor): Grown {
    const { human, box, size } = actor;
    if (human) return grown(actor, { on: human.joints.head, box: human.head }, { on: human.joints.torso, at: new THREE.Vector3(0, human.torso.min.y, human.torso.min.z) }, human.head.getSize(new THREE.Vector3()).y / 5);
    // One part: its head taken to be its front, high; its rear, its back end.
    const front = new THREE.Box3(new THREE.Vector3(-size.x / 4, box.max.y - size.y / 3, box.max.z - size.z / 4), new THREE.Vector3(size.x / 4, box.max.y, box.max.z));
    return grown(actor, { on: actor.root, box: front }, { on: actor.root, at: new THREE.Vector3(0, box.max.y - size.y / 4, box.min.z) }, size.y / 9);
  },

  stage(actor, made, u, time) {
    const { root, human, size } = actor;
    const { comb, beak, wattle, tail } = made as Grown;
    const small = over(u, 0.86, 1);
    if (human) {
      const { joints, hips, body, legLength } = human;
      // 1. Uneasy.
      const uneasy = Math.sin(over(u, 0, 0.1) * Math.PI);
      // 2. The legs.
      const legs = over(u, 0.1, 0.3);
      const wobble = Math.sin(legs * Math.PI) * Math.sin(time * 15) * 0.22;
      for (const [leg, side] of [[joints.leftLeg, 1], [joints.rightLeg, -1]] as const) {
        leg.scale.set(1 - 0.55 * legs, 1 - 0.5 * legs, 1 - 0.55 * legs);
        leg.rotation.set(side * wobble, 0, 0);
      }
      body.position.y = -legLength * 0.5 * legs; // (sunk as they shorten: the feet kept on the ground)
      actor.tint('legs', SHANK, legs);
      // 3. The arms.
      const arms = over(u, 0.3, 0.5);
      const flap = Math.sin(over(u, 0.42, 0.56) * Math.PI) * Math.sin(time * 20) * 0.6;
      for (const [arm, side] of [[joints.leftArm, 1], [joints.rightArm, -1]] as const) {
        arm.scale.set(1 - 0.4 * arms, 1 - 0.15 * arms, 1 + 0.7 * arms);
        arm.rotation.set(1.05 * arms, 0, side * (0.3 * Math.sin(arms * Math.PI) + flap));
      }
      actor.tint('arms', FEATHER, arms);
      // 4. The body, and its tail.
      const tip = over(u, 0.48, 0.68);
      hips.rotation.x = LEAN * tip;
      hips.position.y = legLength * (1 - 0.12 * tip);
      joints.torso.scale.set(1 + 0.3 * tip, 1 - 0.25 * tip, 1 + 0.3 * tip);
      actor.tint('torso', FEATHER, tip);
      for (const [i, feather] of tail.entries()) swell(feather, over(u, 0.56 + i * 0.03, 0.72 + i * 0.03));
      // 5. The head: held up as the body tips, smaller; comb, beak, wattle.
      const head = over(u, 0.66, 0.84);
      joints.head.rotation.set(-LEAN * tip * 0.9, uneasy * Math.sin(time * 5) * 0.5 + Math.sin(head * Math.PI) * Math.sin(time * 9) * 0.25, 0);
      joints.head.scale.setScalar(1 - 0.3 * head);
      actor.tint('head', FEATHER, head);
      for (const [i, point] of comb.entries()) swell(point, over(u, 0.68 + i * 0.03, 0.78 + i * 0.03));
      swell(beak, over(u, 0.73, 0.83));
      swell(wattle, over(u, 0.78, 0.87));
      // 6. Down to her size.
      root.scale.setScalar(1 - (1 - (HEN.y * 1.25) / size.y) * small);
    } else {
      root.rotation.z = Math.sin(time * 40) * 0.06 * Math.sin(over(u, 0, 0.3) * Math.PI);
      // Its shape pulled to hers: as wide, tall and long as she is, for its size.
      const ratio = new THREE.Vector3(HEN.x / size.x, HEN.y / size.y, HEN.z / size.z);
      const most = Math.max(ratio.x, ratio.y, ratio.z);
      const shape = over(u, 0.15, 0.6);
      const down = 1 - (1 - most) * small;
      root.scale.set((1 + (ratio.x / most - 1) * shape) * down, (1 + (ratio.y / most - 1) * shape) * down, (1 + (ratio.z / most - 1) * shape) * down);
      actor.tint('all', FEATHER, over(u, 0.3, 0.7));
      for (const [i, feather] of tail.entries()) swell(feather, over(u, 0.5 + i * 0.03, 0.66 + i * 0.03));
      for (const [i, point] of comb.entries()) swell(point, over(u, 0.6 + i * 0.03, 0.72 + i * 0.03));
      swell(beak, over(u, 0.68, 0.8));
      swell(wattle, over(u, 0.74, 0.85));
    }
    actor.glow(small * small);
  },

  target() {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const hen = createHen(material);
    return {
      root: hen.root,
      height: HEN.y,
      settle(j, time) {
        const shape = henShape(SWAP + j * (1 - SWAP));
        hen.root.scale.set(shape.across, shape.up, shape.across);
        hen.root.rotation.y = shape.spin;
        hen.root.position.y = shape.hop;
        hen.head.rotation.set(j > 0.82 ? Math.sin(((j - 0.82) / 0.18) * Math.PI) * 1.1 : 0, shape.shake, 0); // (a shake of her head; then a peck)
        void time;
      },
    };
  },
};
