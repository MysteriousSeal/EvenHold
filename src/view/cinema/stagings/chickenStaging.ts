// Someone turned into a chicken (model/spells/turned.ts), staged part by part (staging.ts), each part of them
// morphing into the part of her it becomes (`pieces`: becoming.ts, partMorph.ts; a hen built as big as they are, so
// each part changes where it stands):
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
import { createHen } from '../../meshes/turned/chickenRig';
import { BODY_GRID, CHICKEN_PALETTE, CHICKEN_VOXEL_SIZE, HEAD_GRID, LEG_HEIGHT, buildChickenBody, buildChickenHead, buildChickenLeg } from '../../meshes/turned/chickenVoxels';
import type { Becoming } from './becoming';
import { hued, most, some } from '../morph/clouds';
import { UNDRESSED, turningInto, type Telling } from './turning';
import { cloudOf, type Cloud } from '../morph/voxelMorph';
import { over, swell, type Actor } from '../actor';
import type { Staging } from '../staging';

const FEATHER = new THREE.Color(0xf4f0e6);
const [RED, YELLOW, WHITE] = [0xd23a2e, 0xe8b23a, 0xf4f0e6];
const V = CHICKEN_VOXEL_SIZE;
// The hen, as she stands: how wide, tall and long.
export const HEN = new THREE.Vector3(BODY_GRID[0] * V, (LEG_HEIGHT + BODY_GRID[1] + HEAD_GRID[1] - 3) * V, (BODY_GRID[2] + 2) * V);

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

// What she is, for what has parts to become her (becoming.ts): their legs her legs, their arms her wings (her body's
// outermost columns, either side), their torso her body and tail, their head her head.
const hue = hued(CHICKEN_PALETTE);
const [RED_, RED_DARK, YELLOW_, EYE] = [4, 5, 6, 8]; // (chickenVoxels.ts's roles)
const PLUCKED = new THREE.Color(0xe9bfa6); // her skin, bare of feathers
// Her tail (up and back of her body), told from the rest of it.
const tailOf = (body: Cloud, big: number) => ((back, top) => (at: THREE.Vector3) => at.z < back + V * big || at.y > top - V * big * 2)(Math.min(...body.at.map((at) => at.z)), Math.max(...body.at.map((at) => at.y)));
export const henBecoming: Becoming = {
  tall: HEN.y,
  long: HEN.z,
  // What grows on her: her comb, her beak, her wattle; then feathers all over her (here and there, till she's
  // covered); her tail's fan, last.
  grows(big) {
    const { body, head } = henClouds(big);
    const top = Math.max(...head.at.map((at) => at.y));
    const tail = tailOf(body, big);
    const comb = some(head, (at, i) => hue(head, i, RED_, RED_DARK) && at.y > top - V * big);
    const fan = some(body, (at) => tail(at));
    return [
      { on: 'head', cloud: comb, root: most(comb, 'y', -1), line: 'A comb, red, in three points.' },
      { on: 'head', cloud: some(head, (_at, i) => hue(head, i, YELLOW_)), line: 'A beak.' },
      { on: 'head', cloud: some(head, (at, i) => hue(head, i, RED_, RED_DARK) && at.y <= top - V * big), line: 'A wattle, under it.' },
      { on: 'head', cloud: some(head, (_at, i) => !hue(head, i, RED_, RED_DARK, YELLOW_, EYE)), line: 'Feathers: here and there, then everywhere.' },
      { on: 'body', cloud: some(body, (at) => !tail(at)), line: 'Feathers: here and there, then everywhere.' },
      { on: 'body', cloud: fan, root: most(fan, 'y', -1), line: 'A tail, cocked up behind.' },
    ];
  },
  parts(big, plain) {
    const hen = henClouds(big);
    if (plain) {
      // (Without them: no comb, beak or wattle; no tail; her skin bare, pink.)
      const tail = tailOf(hen.body, big);
      hen.head = some(hen.head, (_at, i) => !hue(hen.head, i, RED_, RED_DARK, YELLOW_));
      hen.head.color = hen.head.color.map((color, i) => (hue(hen.head, i, EYE) ? color : PLUCKED.clone().multiply(color)));
      hen.body = some(hen.body, (at) => !tail(at));
      hen.body.color = hen.body.color.map((color) => PLUCKED.clone().multiply(color));
    }
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
    const edge = (BODY_GRID[0] / 2 - 1) * V * big;
    const part = (keep: (at: THREE.Vector3) => boolean): Cloud => ({ at: hen.body.at.filter(keep), color: hen.body.color.filter((_c, i) => keep(hen.body.at[i])), size: hen.body.size });
    const wing = (side: number) => part((p) => Math.sign(p.x) === side && Math.abs(p.x) > edge);
    return {
      legs: [hen.legs[0], hen.legs[1]],
      arms: [wing(-1), wing(1)],
      body: part((p) => Math.abs(p.x) <= edge),
      head: hen.head,
      joints: { legs: [at(-1, LEG_HEIGHT, 0), at(1, LEG_HEIGHT, 0)], arms: [at(-2, LEG_HEIGHT + 3, 0), at(2, LEG_HEIGHT + 3, 0)], body: at(0, LEG_HEIGHT, 0), head: at(0, LEG_HEIGHT + 2.5, 2.5) },
    };
  },
  arms: () => [0, 0, 0], // (at her sides already, once they've taken her stance)
};

const PERSON: Telling = {
  start: '{name} feels something is wrong, and starts.',
  ...UNDRESSED,
  stance: 'They stoop, unsteady: the back level, the arms drawn in to the sides.',
  legs: 'The legs thin: yellow, scaled, and much too short.',
  arms: 'The arms flatten against the sides: wings.',
  body: 'The body rounds out: bare, pink.',
  head: 'The head draws in, small, on a short neck.',
  done: 'A chicken as tall as they were. And then smaller. Much smaller.',
};
const BEAST: Telling = {
  ...PERSON,
  start: '{name} feels something is wrong.',
  stance: 'It gathers itself: its hind legs under its middle, its forelegs drawn up to its sides.',
  legs: 'The hind legs thin: two yellow ones, scaled.',
  arms: 'The forelegs flatten against the sides: wings.',
  body: 'The body draws in and rounds out: bare, pink.',
  done: 'A chicken as big as it was. And then smaller. Much smaller.',
};

export const chickenStaging: Staging = {
  title: "Hen-wife's turn",
  becomes: 'A chicken',
  // (Of what's staged whole, below: no legs or arms to it, and what's said kept to what's seen, as it's seen.)
  lines: [
    [0, '{name} feels something is wrong.'],
    [0.15, 'It draws in on itself: shorter, rounder.'],
    [0.3, 'It whitens.'],
    [0.5, 'A tail, pushing out behind.'],
    [0.6, 'A comb. A beak. A wattle.'],
    [0.86, 'And smaller. Much smaller.'],
  ],
  feathers: [0.3, 1],
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

  direct: turningInto(henBecoming, { person: PERSON, beast: BEAST }, true),

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
      // Her feathers ruffled; a startled hop; a shake of her head; then a peck at the ground, and another.
      settle(j, time) {
        const shape = henShape(j);
        const ruffle = j > 0.04 && j < 0.22 ? Math.sin(((j - 0.04) / 0.18) * Math.PI) : 0;
        hen.root.position.y = shape.hop;
        hen.body.scale.setScalar(1 + 0.12 * ruffle);
        hen.body.rotation.z = Math.sin(time * 38) * 0.09 * ruffle;
        hen.head.rotation.set(j > 0.78 ? Math.abs(Math.sin(((j - 0.78) / 0.22) * Math.PI * 2)) * 1.1 : 0, shape.shake, 0);
      },
    };
  },
};
