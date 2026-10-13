// @vitest-environment happy-dom
// The small creatures people are turned into (view/meshes/turned/: a toad, a rat, a cat), each in every coat: said
// once as a four-legged beast (quadruped.ts), its rig drawn from that with a part or two of its own (its throat, its
// tail: ownParts.ts), its turning's voxels read off where the rig draws them, and what grows on it in its turning.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { quadrupedClouds } from '../src/view/cinema/stagings/becoming';
import { catBecomingOf, catStagingOf } from '../src/view/cinema/stagings/catStaging';
import { ratBecomingOf, ratStagingOf } from '../src/view/cinema/stagings/ratStaging';
import { toadBecomingOf, toadStagingOf } from '../src/view/cinema/stagings/toadStaging';
import { makeActor } from '../src/view/cinema/actor';
import { partPieces, type Becoming } from '../src/view/cinema/stagings/becoming';
import { split } from '../src/view/meshes/turned/ownParts';
import { quadrupedParts, type Quadruped } from '../src/view/meshes/turned/quadruped';
import { RatRig, createRat } from '../src/view/meshes/turned/ratRig';
import { RAT_PALETTES, isRatTail, ratShape } from '../src/view/meshes/turned/ratVoxels';
import { ToadRig, createToad } from '../src/view/meshes/turned/toadRig';
import { TOAD_PALETTES, isToadThroat, toadShape } from '../src/view/meshes/turned/toadVoxels';
import { TurnedCatRig, createTurnedCat } from '../src/view/meshes/turned/turnedCatRig';
import { TURNED_CAT_PALETTES, isCatTail, turnedCatShape } from '../src/view/meshes/turned/turnedCatVoxels';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import type { Staging } from '../src/view/cinema/staging';
import type { VoxelGrid } from '../src/view/meshes/voxel/greedyMesh';

const material = new THREE.MeshBasicMaterial();
interface Kind {
  shape(coat: number): Quadruped;
  create(coat: number): { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[] };
  staging(coat: number): Staging;
  becoming(coat: number): Becoming;
  own: { of: 'body' | 'head'; is(x: number, y: number, z: number): boolean }; // the part of it that's its own in its rig
  tall: number; // world units, about
  grown: number; // things that grow on it in its turning
}
const KINDS: Record<string, Kind & { coats: number }> = {
  toad: { coats: TOAD_PALETTES.length, shape: toadShape, create: (coat) => createToad(material, coat), staging: toadStagingOf, becoming: toadBecomingOf, own: { of: 'head', is: isToadThroat }, tall: 0.08, grown: 4 },
  rat: { coats: RAT_PALETTES.length, shape: ratShape, create: (coat) => createRat(material, coat), staging: ratStagingOf, becoming: ratBecomingOf, own: { of: 'body', is: isRatTail }, tall: 0.07, grown: 3 },
  cat: { coats: TURNED_CAT_PALETTES.length, shape: turnedCatShape, create: (coat) => createTurnedCat(material, coat), staging: catStagingOf, becoming: catBecomingOf, own: { of: 'body', is: isCatTail }, tall: 0.15, grown: 5 },
};
const EACH = Object.entries(KINDS).flatMap(([name, kind]) => Array.from({ length: kind.coats }, (_, coat): [string, Kind, number] => [`a ${name}, coat ${coat}`, kind, coat]));
const filled = (grid: VoxelGrid) => grid.cells.reduce((n, cell) => n + (cell ? 1 : 0), 0);
// Someone, as they stand.
const human = () => {
  const rig = new HumanRig();
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  rig.root.updateMatrixWorld(true);
  return rig.root;
};

describe('the small creatures people are turned into', () => {
  it('come in their coats: a toad in two, a rat in two, a cat in four', () => {
    expect([KINDS.toad.coats, KINDS.rat.coats, KINDS.cat.coats]).toEqual([2, 2, 4]);
    for (const palettes of [TOAD_PALETTES, RAT_PALETTES, TURNED_CAT_PALETTES]) {
      for (const palette of palettes) expect(new Set(palette).size, 'each role a colour of its own, to be told by').toBe(palette.length);
      expect(new Set(palettes.map((palette) => palette[0])).size).toBe(palettes.length); // (no two coats the same)
    }
  });

  it.each(EACH)('%s: every part builds, in its palette', (_name, kind, coat) => {
    const shape = kind.shape(coat);
    for (const grid of [shape.body(), shape.head(), shape.leg(true), shape.leg(false)]) {
      expect(filled(grid)).toBeGreaterThan(0);
      for (const cell of grid.cells) expect(cell).toBeLessThanOrEqual(shape.palette.length);
    }
    expect(shape.legs.length).toBe(4);
  });

  it.each(EACH)('%s: stands on the ground, as small as it should, its voxels read off where its rig draws them', (_name, kind, coat) => {
    const shape = kind.shape(coat);
    const made = kind.create(coat);
    made.root.updateMatrixWorld(true);
    const drawn = new THREE.Box3().setFromObject(made.root);
    expect(drawn.min.y).toBeCloseTo(0, 6);
    expect(drawn.max.y).toBeGreaterThan(kind.tall * 0.85);
    expect(drawn.max.y).toBeLessThan(kind.tall * 1.15);
    const clouds = quadrupedClouds(shape, 1);
    const read = new THREE.Box3().setFromPoints([clouds.body, clouds.head, ...clouds.legs].flatMap((cloud) => cloud.at)).expandByScalar(shape.voxel / 2);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(read.min[axis]).toBeCloseTo(drawn.min[axis], 6);
      expect(read.max[axis]).toBeCloseTo(drawn.max[axis], 6);
    }
    expect(read.min.x).toBeCloseTo(-read.max.x, 6); // (the same either side)
    // The part of its own in its rig: taken out of the part it's told in, none of it lost, none of it twice.
    const whole = shape[kind.own.of]();
    const [rest, part] = split(whole, kind.own.is);
    expect(filled(part)).toBeGreaterThan(0);
    expect(filled(rest) + filled(part)).toBe(filled(whole));
    // Its hind legs behind its forelegs.
    const parts = quadrupedParts(shape);
    expect(Math.max(parts.legs[0].at[2], parts.legs[1].at[2])).toBeLessThan(Math.min(parts.legs[2].at[2], parts.legs[3].at[2]));
  });

  it.each(EACH)('%s: no two parts share a voxel, and all are on one grid', (_name, kind, coat) => {
    const shape = kind.shape(coat);
    const parts = quadrupedParts(shape);
    const taken = new Map<string, number>();
    for (const [p, part] of [parts.body, parts.head, ...parts.legs].entries()) {
      const [sx, sy, sz] = part.grid.size;
      // (On one grid: each part's corner a whole number of voxels from every other's, each way.)
      for (const axis of [0, 1, 2]) expect(Math.abs(((part.at[axis] - parts.body.at[axis]) % 1) + 1) % 1).toBeCloseTo(0, 9);
      for (let z = 0; z < sz; z++) {
        for (let y = 0; y < sy; y++) {
          for (let x = 0; x < sx; x++) {
            if (!part.grid.cells[x + sx * (y + sy * z)]) continue;
            const key = [part.at[0] + x, part.at[1] + y, part.at[2] + z].map((n) => Math.round(n * 2)).join(',');
            expect(taken.get(key), `parts ${taken.get(key)} and ${p} at ${key}`).toBeUndefined();
            taken.set(key, p);
            expect(part.at[1] + y).toBeGreaterThanOrEqual(0); // (none of it under the ground)
          }
        }
      }
    }
  });

  it.each(EACH)('%s: someone turned into it has every part something to become, plain and whole, and what grows on it', (_name, kind, coat) => {
    const staging = kind.staging(coat);
    expect(staging.title.length).toBeGreaterThan(0);
    expect(staging.cloud!().at.length).toBeGreaterThan(20);
    // Someone turned into it: played through, and what they've become settled.
    const scene = new THREE.Scene();
    const figure = human();
    const played = staging.direct!(figure, scene, 0.45, makeActor(figure))!;
    expect(played.length).toBe(14);
    expect(played.lines!.length).toBe(8 + kind.grown); // a start, what they wear off them, their hands looked at, a stance, legs, body, head; each thing grown; done
    for (const [, line] of played.lines!) expect(line.length).toBeGreaterThan(0);
    for (const u of [0, 0.3, 0.6, 0.8, 0.95, 1]) played.update(u, u * 14);
    played.dispose();
    const target = staging.target();
    expect(target.height).toBeGreaterThan(kind.tall * 0.85);
    for (const j of [0, 0.3, 0.6, 1]) target.settle(j, j * 2);
    target.root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(target.root).min.y).toBeGreaterThan(-kind.shape(coat).voxel * 1.5); // (settled: on the ground still)
  });

  it.each(EACH)('%s: both parts(1) and parts(1, true) give every part something to become', (_name, kind, coat) => {
    const becoming = kind.becoming(coat);
    for (const plain of [false, true]) {
      const its = becoming.parts(1, plain);
      for (const cloud of [...its.legs, ...its.arms, its.body, its.head]) {
        expect(cloud.at.length).toBeGreaterThan(0);
        expect(cloud.color.length).toBe(cloud.at.length);
      }
    }
    const [whole, plain] = [becoming.parts(1), becoming.parts(1, true)];
    expect(plain.body.at.length + plain.head.at.length).toBeLessThan(whole.body.at.length + whole.head.at.length); // (plain: less of it)
    const grown = becoming.grows!(1);
    expect(grown.length).toBe(kind.grown);
    for (const thing of grown) {
      expect(thing.cloud.at.length, thing.line).toBeGreaterThan(0);
      expect(thing.line.length).toBeGreaterThan(0);
    }
    expect(becoming.fourLegged).toBe(true);
    expect(partPieces(makeActor(human()), becoming)!.big).toBeGreaterThan(1); // (smaller than someone: built big, to come down)
  });

  it('go about as their kind does: a toad hops, a rat scurries and sits up, a cat walks and sits', () => {
    const at = (z: number) => ({ x: 0, y: 0, z, facing: 0 });
    const inner = (rig: { root: THREE.Group }) => rig.root.children[0] as THREE.Group;
    // A toad: off the ground as it goes, on it again soon after it stops.
    const toad = new ToadRig(material);
    toad.update(at(0), 0.05);
    let [high, z] = [0, 0];
    for (let i = 0; i < 20; i++) {
      toad.update(at((z += 0.02)), 0.05);
      high = Math.max(high, inner(toad).position.y);
    }
    expect(high).toBeGreaterThan(0.03);
    for (let i = 0; i < 20; i++) toad.update(at(z), 0.05);
    expect(inner(toad).position.y).toBe(0);
    // A rat: its body level going, tipped up now and then stopped.
    const rat = new RatRig(material);
    const pitch = (rig: { root: THREE.Group }) => -(inner(rig).children.find((child) => child.children.length > 1) as THREE.Group).rotation.x;
    rat.update(at(0), 0.05);
    rat.update(at(0.02), 0.05);
    expect(pitch(rat)).toBeCloseTo(0, 2);
    let most = 0;
    for (let i = 0; i < 200; i++) {
      rat.update(at(0.02), 0.05);
      most = Math.max(most, pitch(rat));
    }
    expect(most).toBeGreaterThan(0.6);
    // A cat: sat down soon after it stops, up again as it goes.
    const cat = new TurnedCatRig(material, 2);
    cat.update(at(0), 0.05);
    for (let i = 0; i < 60; i++) cat.update(at(0), 0.05);
    expect(pitch(cat)).toBeGreaterThan(0.5);
    for (let i = 0; i < 60; i++) cat.update(at((i + 1) * 0.02), 0.05);
    expect(pitch(cat)).toBeLessThan(0.05);
  });
});
