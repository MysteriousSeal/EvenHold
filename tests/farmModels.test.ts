// @vitest-environment happy-dom
// The farm animals people are turned into (view/meshes/turned/: a pig, a sheep, a goat, a donkey), each in every
// coat it has: every part of it builds; the voxels its turning's played with sit where its rig draws them; it
// stands on the ground; no part of it is inside another; and what has parts has something to become for each of
// them, with what grows on it and without (view/cinema/stagings/).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { quadrupedClouds, type Becoming } from '../src/view/cinema/stagings/becoming';
import { DONKEY, donkeyBecomingOf, donkeyStagingOf } from '../src/view/cinema/stagings/donkeyStaging';
import { GOAT, goatBecomingOf, goatStagingOf } from '../src/view/cinema/stagings/goatStaging';
import { HORSE } from '../src/view/cinema/stagings/horseStaging';
import { PIG, pigBecomingOf, pigStagingOf } from '../src/view/cinema/stagings/pigStaging';
import { SHEEP, sheepBecomingOf, sheepStagingOf } from '../src/view/cinema/stagings/sheepStaging';
import type { Staging } from '../src/view/cinema/staging';
import { makeActor } from '../src/view/cinema/actor';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { DonkeyRig } from '../src/view/meshes/turned/donkeyRig';
import { DONKEY_PALETTES, donkeyShape } from '../src/view/meshes/turned/donkeyVoxels';
import { GoatRig } from '../src/view/meshes/turned/goatRig';
import { GOAT_COLORS, GOAT_PALETTES, goatShape } from '../src/view/meshes/turned/goatVoxels';
import { PigRig } from '../src/view/meshes/turned/pigRig';
import { PIG_COLORS, PIG_PALETTES, pigShape } from '../src/view/meshes/turned/pigVoxels';
import { createQuadruped, quadrupedParts, type GrazerRig, type Quadruped } from '../src/view/meshes/turned/quadruped';
import { SheepRig } from '../src/view/meshes/turned/sheepRig';
import { SHEEP_COLORS, SHEEP_PALETTES, sheepShape } from '../src/view/meshes/turned/sheepVoxels';

const material = new THREE.MeshBasicMaterial();
interface Kind {
  palettes: number[][];
  shape(coat?: number): Quadruped;
  staging(coat?: number): Staging;
  becoming(coat?: number): Becoming;
  rig(coat: number): GrazerRig;
  size: THREE.Vector3;
  back: number; // how tall it stands at its back (a donkey: its withers), about
  grown: number[]; // the things grown on it, in each coat
}
const KINDS: Record<string, Kind> = {
  pig: { palettes: PIG_PALETTES, shape: pigShape, staging: pigStagingOf, becoming: pigBecomingOf, rig: (coat) => new PigRig(material, coat), size: PIG, back: 0.26, grown: [3, 4, 3] },
  sheep: { palettes: SHEEP_PALETTES, shape: sheepShape, staging: sheepStagingOf, becoming: sheepBecomingOf, rig: (coat) => new SheepRig(material, coat), size: SHEEP, back: 0.3, grown: [3, 3] },
  goat: { palettes: GOAT_PALETTES, shape: goatShape, staging: goatStagingOf, becoming: goatBecomingOf, rig: (coat) => new GoatRig(material, coat), size: GOAT, back: 0.32, grown: [3, 3, 5] },
  donkey: { palettes: DONKEY_PALETTES, shape: donkeyShape, staging: donkeyStagingOf, becoming: donkeyBecomingOf, rig: (coat) => new DonkeyRig(material, coat), size: DONKEY, back: 0.4, grown: [4, 4] },
};
const EACH = Object.entries(KINDS).flatMap(([name, kind]) => kind.palettes.map((_palette, coat): [string, number, Kind] => [name, coat, kind]));
const filled = (grid: { cells: ArrayLike<number> }) => Array.from(grid.cells).filter((cell) => cell !== 0).length;
const keyOf = (size: number) => (p: THREE.Vector3) => p.toArray().map((n) => Math.round(n / (size / 2))).join();
const beast = { id: 1, kind: 'horse' as const, x: 0, y: 0, z: 0, at: null, from: { x: 0, z: 0 }, to: null, peck: 0, facing: 0 };
const headOf = (rig: GrazerRig) => (rig as unknown as { head: THREE.Group }).head;
const legsOf = (rig: GrazerRig) => (rig as unknown as { legs: THREE.Group[] }).legs;

describe('the farm animals, each said once in each of its coats', () => {
  it('has its coats: three of a pig, two of a sheep, three of a goat, two of a donkey; a palette of few colours, no two alike', () => {
    expect(Object.values(KINDS).map((kind) => kind.palettes.length)).toEqual([3, 2, 3, 2]);
    for (const kind of Object.values(KINDS)) for (const palette of kind.palettes) [expect(palette.length).toBeLessThanOrEqual(8), expect(new Set(palette).size).toBe(palette.length)];
  });

  it.each(EACH)('a %s, coat %i: every part builds, in its palette; it stands on the ground, read off where its rig draws it', (_name, coat, kind) => {
    const shape = kind.shape(coat);
    expect(shape.palette).toBe(kind.palettes[coat]);
    expect(shape.voxel).toBe(0.02);
    const parts = quadrupedParts(shape);
    for (const part of [parts.body, parts.head, ...parts.legs]) {
      expect(filled(part.grid)).toBeGreaterThan(0);
      expect(Math.max(...Array.from(part.grid.cells))).toBeLessThanOrEqual(shape.palette.length); // (no colour it hasn't)
    }
    expect(parts.legs.length).toBe(4);
    expect(Math.max(parts.legs[0].at[2], parts.legs[1].at[2])).toBeLessThan(Math.min(parts.legs[2].at[2], parts.legs[3].at[2])); // (the hind ones behind)
    const made = createQuadruped(material, shape);
    made.root.updateMatrixWorld(true);
    const drawn = new THREE.Box3().setFromObject(made.root);
    expect(drawn.min.y).toBeCloseTo(0, 6); // (its hooves on the ground)
    const clouds = quadrupedClouds(shape, 1);
    const read = new THREE.Box3().setFromPoints([clouds.body, clouds.head, ...clouds.legs].flatMap((cloud) => cloud.at)).expandByScalar(shape.voxel / 2);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(read.min[axis]).toBeCloseTo(drawn.min[axis], 6);
      expect(read.max[axis]).toBeCloseTo(drawn.max[axis], 6);
    }
    // As big as it's said to be: its staging's size the whole of it; its back at its kind's height, near enough.
    expect(drawn.max.y).toBeCloseTo(kind.size.y, 6);
    expect(drawn.max.x - drawn.min.x).toBeCloseTo(kind.size.x, 6);
    expect(drawn.max.z - drawn.min.z).toBeCloseTo(kind.size.z, 6);
    const back = Math.max(...clouds.body.at.map((at) => at.y)) + shape.voxel / 2; // (the highest of its body: its withers, or a tail held up)
    expect(Math.abs(back - kind.back)).toBeLessThan(shape.voxel * 1.01);
    expect(kind.size.y).toBeLessThan(HORSE.y); // (none as tall as the horse)
  });

  it.each(EACH)('a %s, coat %i: no two parts of it share a voxel, each part in one piece with the rest', (_name, coat, kind) => {
    const cloud = kind.staging(coat).cloud!();
    const key = keyOf(cloud.size);
    expect(new Set(cloud.at.map(key)).size).toBe(cloud.at.length);
    // Each part touches another: a face of one of its voxels against one of theirs.
    const clouds = quadrupedClouds(kind.shape(coat), 1);
    const all = [clouds.body, clouds.head, ...clouds.legs];
    for (const [i, part] of all.entries()) {
      const others = new Set(all.filter((_other, k) => k !== i).flatMap((other) => other.at.map(key)));
      const touching = part.at.some((at) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([x, y, z]) => others.has(key(at.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(cloud.size))))));
      expect(touching, `part ${i}`).toBe(true);
    }
  });

  it.each(EACH)('a %s, coat %i: what has parts becomes it limb for limb, each part something, plain and grown', (_name, coat, kind) => {
    const shape = kind.shape(coat);
    const whole = quadrupedClouds(shape, 1);
    const staging = kind.staging(coat);
    expect(staging.direct).toBeTypeOf('function');
    expect(staging.title.length).toBeGreaterThan(0);
    const rig = new HumanRig();
    rig.update(0, 0, 0, 0, null, 0, 'stand');
    const scene = new THREE.Scene();
    scene.add(rig.root);
    const directed = staging.direct!(rig.root, scene, makeActor(rig.root).size.y, makeActor(rig.root))!;
    expect(directed).not.toBeNull();
    const said = directed.lines!.map(([, line]) => line);
    expect(said.every((line) => line.length > 0)).toBe(true);
    expect(said.some((line) => /all four/.test(line))).toBe(true);
    expect(said.length).toBe(8 + kind.grown[coat]); // (a start, undressed, their hands, a stance, legs, body, head; each thing grown; done)
    for (let u = 0; u <= 1.0001; u += 0.05) directed.update(Math.min(1, u), u * 14);
    directed.dispose();
    // What it becomes: every part of it something, plain and whole; nothing lost between them.
    for (const big of [1, 2.5]) {
      for (const plain of [false, true]) {
        const its = kind.becoming(coat).parts(big, plain);
        for (const part of [...its.legs, ...its.arms, its.body, its.head]) expect(part.at.length).toBeGreaterThan(0);
        expect(its.joints.legs.every((hip, i) => hip.z < its.joints.arms[i].z)).toBe(true);
        expect(its.joints.head.y).toBeGreaterThan(its.joints.body.y);
      }
      // What grows on it: each thing some voxels of it, none of them in two things; with its plain self, all of it.
      const becoming = kind.becoming(coat);
      const grown = becoming.grows!(big);
      expect(grown.length).toBe(kind.grown[coat]);
      for (const thing of grown) [expect(thing.cloud.at.length, thing.line).toBeGreaterThan(0), expect(thing.line.length).toBeGreaterThan(0)];
      const key = keyOf(shape.voxel * big);
      const plain = becoming.parts(big, true);
      for (const on of ['body', 'head'] as const) {
        const things = grown.filter((thing) => thing.on === on).flatMap((thing) => thing.cloud.at.map(key));
        expect(new Set(things).size).toBe(things.length);
        const covered = new Set([...things, ...plain[on].at.map(key)]);
        expect(covered.size).toBe(whole[on].at.length); // (plain, and what grows on it: the whole of it, no more)
      }
    }
  });

  it.each(Object.entries(KINDS))('a %s goes about as its kind does: walks on diagonal pairs, lowers its head stood, and has a way of its own', (name, kind) => {
    const rig = kind.rig(0);
    rig.update(beast, 0.05);
    rig.update({ ...beast, z: 0.1 }, 0.05);
    const legs = legsOf(rig).map((leg) => leg.rotation.x);
    expect(legs[0]).toBeCloseTo(legs[3], 9);
    expect(legs[1]).toBeCloseTo(-legs[0], 9);
    expect(Math.abs(legs[0])).toBeGreaterThan(0);
    // Stood: its head down, and up again; turned aside or tossed at some point (its own idle).
    const stood = kind.rig(0);
    let [lowest, highest, aside, pawed] = [0, 0, 0, 0];
    for (let t = 0; t < 40; t += 0.05) {
      stood.update(beast, 0.05);
      const head = headOf(stood).rotation;
      [lowest, highest, aside] = [Math.max(lowest, head.x), Math.min(highest, head.x), Math.max(aside, Math.abs(head.y) + Math.abs(head.z))];
      pawed = Math.max(pawed, -legsOf(stood)[3].rotation.x);
    }
    expect(lowest).toBeGreaterThan(0.4);
    expect(aside).toBeGreaterThan(0.05);
    if (name === 'goat') [expect(highest).toBeLessThan(-0.4), expect(pawed).toBeGreaterThan(0.3)]; // (a toss of its horns, a stamp)
    else expect(pawed).toBe(0);
  });

  it('is what it is: a spotted pig spotted, a black-faced sheep black in the face and leg, a piebald goat patched', () => {
    const count = (shape: Quadruped, role: number, part: 'body' | 'head' | 'leg') => Array.from((part === 'leg' ? shape.leg(false) : shape[part]()).cells).filter((cell) => cell === role).length;
    expect(PIG_PALETTES.map((_p, coat) => count(pigShape(coat), PIG_COLORS.spot, 'body') > 0)).toEqual([false, true, false]);
    expect(GOAT_PALETTES.map((_p, coat) => count(goatShape(coat), GOAT_COLORS.patch, 'body') > 0 && count(goatShape(coat), GOAT_COLORS.patch, 'head') > 0)).toEqual([false, false, true]);
    expect(count(goatShape(), GOAT_COLORS.horn, 'head')).toBeGreaterThan(0);
    expect(count(goatShape(), GOAT_COLORS.beard, 'head')).toBeGreaterThan(0);
    expect(count(pigShape(), PIG_COLORS.snout, 'head')).toBeGreaterThan(0);
    const dark = (hex: number) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25;
    expect(SHEEP_PALETTES.map((palette) => dark(palette[SHEEP_COLORS.face - 1]))).toEqual([false, true]);
    expect(count(sheepShape(1), SHEEP_COLORS.face, 'leg')).toBeGreaterThan(0);
    // A sheep's wool: far wider than its legs stand; itself, shorn, inside it.
    const sheep = quadrupedClouds(sheepShape(), 1);
    const wide = (cloud: { at: THREE.Vector3[] }) => Math.max(...cloud.at.map((at) => Math.abs(at.x)));
    expect(wide(sheep.body)).toBeGreaterThan(wide(sheep.legs[0]) + 0.03);
    expect(count(sheepShape(), SHEEP_COLORS.skin, 'body')).toBeGreaterThan(200);
    // A donkey: its ears the tallest of it, well over its withers; smaller than the horse.
    expect(DONKEY.y).toBeGreaterThan(0.4 + 0.12);
    expect(DONKEY.z).toBeLessThan(HORSE.z);
  });
});

