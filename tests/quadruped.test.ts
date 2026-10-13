// @vitest-environment happy-dom
// The four-legged beasts people are turned into (view/meshes/turned/quadruped.ts): each said once, and its rig, the
// voxels its turning's played with and its place among the kinds all built from that.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { INTO } from '../src/model/spells/turned';
import { quadrupedBecoming, quadrupedClouds } from '../src/view/cinema/stagings/becoming';
import { STAGINGS } from '../src/view/cinema/staging';
import { CowRig } from '../src/view/meshes/turned/cowRig';
import { cowShape } from '../src/view/meshes/turned/cowVoxels';
import { HORSE_SHAPE } from '../src/view/meshes/turned/horseVoxels';
import { HorseRig } from '../src/view/meshes/turned/horseRig';
import { createQuadruped, quadrupedParts, type Quadruped } from '../src/view/meshes/turned/quadruped';

const SHAPES: Array<[string, Quadruped]> = [['a horse', HORSE_SHAPE], ['a cow', cowShape()], ['a bull', cowShape(1, true)]];
const material = new THREE.MeshBasicMaterial();

describe('a four-legged beast, said once', () => {
  it.each(SHAPES)('%s: its rig stands on the ground, and its voxels are read off where the rig draws them', (_name, shape) => {
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
    // Twice its size: every voxel twice as far out, twice as big.
    const twice = quadrupedClouds(shape, 2);
    expect(twice.body.size).toBeCloseTo(shape.voxel * 2, 9);
    expect(twice.head.at[0].x).toBeCloseTo(clouds.head.at[0].x * 2, 9);
    // Its parts: a body, a head, two hind legs and two forelegs, the hind ones behind.
    const parts = quadrupedParts(shape);
    expect(parts.legs.length).toBe(4);
    expect(Math.max(parts.legs[0].at[2], parts.legs[1].at[2])).toBeLessThan(Math.min(parts.legs[2].at[2], parts.legs[3].at[2]));
  });

  it.each(SHAPES)('%s: what has parts becomes it limb for limb, on all four, plain till what grows on it has', (_name, shape) => {
    const grown = [{ on: 'head' as const, cloud: { at: [new THREE.Vector3()], color: [new THREE.Color()], size: shape.voxel }, line: 'Something.' }];
    let plained = 0;
    const becoming = quadrupedBecoming(shape, new THREE.Vector3(0.2, 0.5, 0.7), { grows: () => grown, plain: () => void plained++ });
    expect(becoming).toMatchObject({ tall: 0.5, long: 0.7, fourLegged: true });
    expect(becoming.grows!(1)).toBe(grown);
    const its = becoming.parts(1);
    expect(plained).toBe(0);
    becoming.parts(1, true);
    expect(plained).toBe(1);
    expect(its.joints.legs.every((hip, i) => hip.z < its.joints.arms[i].z)).toBe(true); // (their legs: its hind legs)
    expect(its.joints.legs[0].y).toBeCloseTo(shape.legHeight * shape.voxel, 9);
    expect(its.joints.head.y).toBeGreaterThan(its.joints.body.y);
  });

  it('goes about as its kind does: a horse and a cow walk and graze, a bull paws the ground', () => {
    const beast = { id: 1, kind: 'horse' as const, x: 0, y: 0, z: 0, at: null, from: { x: 0, z: 0 }, to: null, peck: 0, facing: 0 };
    const pawed = (rig: HorseRig | CowRig) => {
      let most = 0;
      for (let t = 0; t < 30; t += 0.05) {
        rig.update(beast, 0.05);
        most = Math.max(most, -(rig as unknown as { legs: THREE.Group[] }).legs[3].rotation.x);
      }
      return most;
    };
    expect(pawed(new HorseRig(material))).toBe(0);
    expect(pawed(new CowRig(material))).toBe(0);
    expect(pawed(new CowRig(material, 0, true))).toBeGreaterThan(0.3);
    // Walking: its legs in diagonal pairs.
    const rig = new HorseRig(material);
    rig.update(beast, 0.05);
    rig.update({ ...beast, z: 0.1 }, 0.05);
    const legs = (rig as unknown as { legs: THREE.Group[] }).legs.map((leg) => leg.rotation.x);
    expect(legs[0]).toBeCloseTo(legs[3], 9);
    expect(legs[1]).toBeCloseTo(-legs[0], 9);
    expect(Math.abs(legs[0])).toBeGreaterThan(0);
  });

  it('has a staging for every kind someone may be turned into', () => {
    expect(Object.keys(STAGINGS).sort()).toEqual([...INTO].sort());
    for (const kind of INTO) expect(STAGINGS[kind].direct, kind).toBeTypeOf('function');
  });
});
