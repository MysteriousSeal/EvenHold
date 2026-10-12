// Someone turned into a chicken (model/spells/chickens.ts), staged part by part (staging.ts), each part of them
// morphing into the part of her it becomes (`pieces`: partMorph.ts; a hen built as big as they are, so each part
// changes where it stands):
//  1. a start, themselves;
//  2. the legs into her two legs, thin and yellow (someone human-shaped: their own two; a four-legged beast: its
//     hind legs, drawn in under its middle);
//  3. the arms (a beast's forelegs) into her wings, laid along her sides;
//  4. the torso (a beast's trunk and tail) into her body and her tail;
//  5. the head into hers: her comb, her beak, her wattle; a hen entire, as big as they were;
//  6. and down to her own size, to give way.
// Anything with no such parts (a spider, a bat, a worm): taken apart whole into its voxels and put together again as
// her (voxelMorph.ts: `cloud`, her voxels). What has no voxels to take apart either (a ghost, seen through): a
// shiver; its shape pulled to a hen's proportions; whitened; comb, beak and tail pushing out of it; then down to
// her size (`stage`).
// The hen then, herself: a startled hop, a shake of her head, and a peck at the ground.
import * as THREE from 'three';
import { createHen } from '../meshes/wildlife/chickenRig';
import { BODY_GRID, CHICKEN_PALETTE, CHICKEN_VOXEL_SIZE, HEAD_GRID, LEG_HEIGHT, buildChickenBody, buildChickenHead, buildChickenLeg } from '../meshes/wildlife/chickenVoxels';
import type { Piece } from './partMorph';
import { cloudOf, sampleFigure, type Cloud } from './voxelMorph';
import { over, swell, type Actor } from './actor';
import type { Staging } from './staging';

const FEATHER = new THREE.Color(0xf4f0e6);
const [RED, YELLOW, WHITE] = [0xd23a2e, 0xe8b23a, 0xf4f0e6];
const V = CHICKEN_VOXEL_SIZE;
// The hen, as she stands: how wide, tall and long.
export const HEN = new THREE.Vector3(BODY_GRID[0] * V, (LEG_HEIGHT + BODY_GRID[1] + HEAD_GRID[1] - 3) * V, (BODY_GRID[2] + 2) * V);

const ROWS = 22; // cubes to a beast's height, read off it
// The hen's voxels, where createHen puts them (chickenRig.ts), `big` times her size: her body, her head on its neck,
// her legs (the one at -x first).
function henClouds(big: number): { body: Cloud; head: Cloud; legs: Cloud[] } {
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
  const [bx, , bz] = BODY_GRID;
  return {
    body: cloudOf([{ grid: buildChickenBody(), palette: CHICKEN_PALETTE, origin: at(-bx / 2, LEG_HEIGHT, -bz / 2) }], V * big),
    head: cloudOf([{ grid: buildChickenHead(), palette: CHICKEN_PALETTE, origin: at(-HEAD_GRID[0] / 2, LEG_HEIGHT + 2.5, 2.5 - 1.5) }], V * big),
    legs: [-1, 1].map((side) => cloudOf([{ grid: buildChickenLeg(), palette: CHICKEN_PALETTE, origin: at(side - 0.5, LEG_HEIGHT - 3, -0.5) }], V * big)),
  };
}

// How she is once she's there (`j`: 0 just there, 1 settled): a startled hop, then a shake of her head; at rest after.
export function henShape(j: number): { hop: number; shake: number } {
  return {
    hop: j > 0.2 && j < 0.6 ? Math.sin(((j - 0.2) / 0.4) * Math.PI) * 0.07 : 0,
    shake: j > 0.55 && j < 0.85 ? Math.sin((j - 0.55) * 60) * 0.5 * Math.sin(((j - 0.55) / 0.3) * Math.PI) : 0,
  };
}

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
    [0.06, 'The legs bend and thin: yellow, and much too short.'],
    [0.24, 'The arms lift, and fold down into wings.'],
    [0.42, 'The spine bends at the waist until the body lies level. A tail.'],
    [0.6, 'The head tips back, and comes forward with a comb, a beak, a wattle.'],
    [0.88, 'A chicken as tall as a man. And then smaller. Much smaller.'],
  ],
  feathers: [0.3, 1],
  beastLines: [
    [0, '{name} feels something is wrong.'],
    [0.06, 'The hind legs bend and thin: two yellow ones, under the middle of it.'],
    [0.24, 'The forelegs lift off the ground and fold down into wings.'],
    [0.42, 'The body draws in and rounds out. A tail.'],
    [0.6, 'The head tips back, and comes forward with a comb, a beak, a wattle.'],
    [0.88, 'A chicken the size of a bear. And then smaller. Much smaller.'],
  ],
  looseLines: [
    [0, '{name} feels something is wrong.'],
    [0.08, 'It comes apart, from the ground up.'],
    [0.4, 'Every piece of it finds a new place.'],
    [0.72, 'Smaller. Whiter. Feathered.'],
  ],
  cloud() {
    const hen = henClouds(1);
    return { at: [hen.body, hen.head, ...hen.legs].flatMap((part) => part.at), color: [hen.body, hen.head, ...hen.legs].flatMap((part) => part.color), size: V };
  },

  // Their parts, and hers they become: a hen as big as they are (`big` times her size). Someone human-shaped: their
  // legs her legs, their arms her wings, their torso her body and tail, their head her head. A four-legged beast: its
  // hind legs her legs, its forelegs her wings, its trunk and tail her body, its head hers.
  pieces(actor) {
    const { beast, human, size } = actor;
    if (!beast && !human) return null;
    const big = (size.y * 0.9) / HEN.y;
    const hen = henClouds(big);
    const read = (...parts: THREE.Object3D[]): Cloud => {
      const clouds = parts.map((part) => sampleFigure(part, size.y, ROWS));
      return { at: clouds.flatMap((c) => c.at), color: clouds.flatMap((c) => c.color), size: Math.max(...clouds.map((c) => c.size)) };
    };
    // Her body's sides (its outermost columns): her wings; the rest of it, tail and all: her body.
    const edge = (BODY_GRID[0] / 2 - 1) * V * big;
    const part = (keep: (at: THREE.Vector3) => boolean): Cloud => ({ at: hen.body.at.filter(keep), color: hen.body.color.filter((_c, i) => keep(hen.body.at[i])), size: hen.body.size });
    const wing = (side: number) => part((at) => Math.sign(at.x) === side && Math.abs(at.x) > edge);
    const body = part((at) => Math.abs(at.x) <= edge);
    const sideOf = (group: THREE.Object3D) => Math.sign(new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()).x) || 1;
    const [legs, wings, trunk, head]: Array<[number, number]> = [[0.06, 0.36], [0.24, 0.56], [0.42, 0.76], [0.6, 0.88]];
    const made = human
      ? { legs: [human.joints.leftLeg, human.joints.rightLeg], arms: [human.joints.leftArm, human.joints.rightArm], trunk: [human.joints.torso], head: human.joints.head, waist: human.hips, tip: Math.PI / 2 }
      : { legs: beast!.hind, arms: beast!.fore, trunk: [beast!.trunk, beast!.tail], head: beast!.head, waist: beast!.trunk, tip: 0 };
    // Each part's joint: where it hangs now, and where hers does (her hip, the root of her wing, the middle of her, her neck).
    const where = (group: THREE.Object3D) => group.getWorldPosition(new THREE.Vector3());
    const hers = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
    const env = (t: number) => Math.sin(t * Math.PI); // (at rest either end of a part's turn, at its worst in the middle)
    return {
      big,
      down: 0.88,
      pieces: [
        // The legs: bending under them, knees out a little, as they thin and shorten.
        ...made.legs.map((leg): Piece => {
          const side = sideOf(leg);
          return { from: read(leg), into: hen.legs[side < 0 ? 0 : 1], window: legs, pivot: [where(leg), hers(side, LEG_HEIGHT, 0)], contort: (t) => [env(t) * 0.35, 0, side * env(t) * 0.2] };
        }),
        // The arms (a beast's forelegs): lifted out and back, then down flat along her sides.
        ...made.arms.map((arm): Piece => {
          const side = sideOf(arm);
          return { from: read(arm), into: wing(side), window: wings, pivot: [where(arm), hers(side * 2, LEG_HEIGHT + 3, 0)], contort: (t) => [-1.4 * env(t) * env(t), 0, side * env(t) * 0.7] };
        }),
        // The torso: bent forward at the waist till it lies level (a beast's trunk: level already).
        { from: read(...made.trunk), into: body, window: trunk, pivot: [where(made.waist), hers(0, LEG_HEIGHT, 0)], tip: made.tip, contort: () => [0, 0, 0] },
        // The head: tipped back, then set forward on her neck.
        { from: read(made.head), into: hen.head, window: head, pivot: [where(made.head), hers(0, LEG_HEIGHT + 2.5, 2.5)], contort: (t) => [-0.5 * env(t), 0, 0] },
      ],
    };
  },

  prepare(actor): Grown {
    const { box, size } = actor;
    // One part: its head taken to be its front, high; its rear, its back end.
    const front = new THREE.Box3(new THREE.Vector3(-size.x / 4, box.max.y - size.y / 3, box.max.z - size.z / 4), new THREE.Vector3(size.x / 4, box.max.y, box.max.z));
    return grown(actor, { on: actor.root, box: front }, { on: actor.root, at: new THREE.Vector3(0, box.max.y - size.y / 4, box.min.z) }, size.y / 9);
  },

  stage(actor, made, u, time) {
    const { root, size } = actor;
    const { comb, beak, wattle, tail } = made as Grown;
    const small = over(u, 0.86, 1);
    {
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
        const shape = henShape(j);
        hen.root.position.y = shape.hop;
        hen.head.rotation.set(j > 0.82 ? Math.sin(((j - 0.82) / 0.18) * Math.PI) * 1.1 : 0, shape.shake, 0); // (a shake of her head; then a peck)
        void time;
      },
    };
  },
};
