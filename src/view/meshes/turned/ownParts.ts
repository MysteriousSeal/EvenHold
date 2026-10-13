// What the small creatures people are turned into share (a toad, a rat, a cat: toadRig.ts, ratRig.ts,
// turnedCatRig.ts), over what a four-legged beast is (quadruped.ts). A part of one that's told with its body or its
// head there (a tail, a throat: so its turning's voxels and its icon have it) is drawn as a part of its own here, to
// be moved: its voxels taken out of the grid they're told in (`split`), and hung where they were (`hung`). And how
// one sits up: its body tipped about a point of it, a leg carried with it (`tipped`, `carried`).
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { partMesher } from '../common/creatureRig';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, setColor } from '../voxel/voxelShapes';
import type { Quadruped } from './quadruped';

type Voxels = [x: number, y: number, z: number];
// Whoever's drawn, as far as these rigs read them: where they are, and which way they face.
export type Turned = Pick<Hen, 'x' | 'y' | 'z' | 'facing'>;

// A grid in two, each the size it was: what's left of it, and the voxels of it that `is` picks out.
export function split(grid: VoxelGrid, is: (x: number, y: number, z: number) => boolean): [rest: VoxelGrid, part: VoxelGrid] {
  const [rest, part] = [createGrid(grid.size), createGrid(grid.size)];
  forEachVoxel(grid, (x, y, z) => setColor(is(x, y, z) ? part : rest, x, y, z, colorAt(grid, x, y, z)));
  return [rest, part];
}

// Such a part, to be added to what it hangs from: its voxels where they were, turning about `joint` (in its grid's
// voxels). `from`: where what it hangs from turns about, in the same (a body's or a head's pivot; a part's own joint).
export function hung(material: THREE.Material, q: Quadruped, grid: VoxelGrid, joint: Voxels, from: Voxels): THREE.Group {
  const part = new THREE.Group();
  part.add(new THREE.Mesh(partMesher(q.voxel)(grid, q.palette, joint), material));
  part.position.set((joint[0] - from[0]) * q.voxel, (joint[1] - from[1]) * q.voxel, (joint[2] - from[2]) * q.voxel);
  return part;
}

// Its body tipped, its fore end up by `pitch` (radians), about a point of it that stays where it was: `about`, in
// voxels up and along from where its body hangs (the middle of it, at its hips' height).
export function tipped(q: Quadruped, body: THREE.Group, pitch: number, about: [y: number, z: number]): void {
  const [y, z, c, s] = [about[0] * q.voxel, about[1] * q.voxel, Math.cos(pitch), Math.sin(pitch)];
  body.rotation.x = -pitch;
  body.position.set(0, q.legHeight * q.voxel + y - (y * c + z * s), z - (z * c - y * s));
}

// A leg (`i`: as its legs are told) carried with its body, tipped as that is: its hip where its body has it now, and
// swung on it by `swing` (radians, forward the less).
export function carried(q: Quadruped, body: THREE.Group, leg: THREE.Group, i: number, swing: number): void {
  leg.position.set(q.legs[i][0] * q.voxel, 0, q.legs[i][1] * q.voxel).applyEuler(body.rotation).add(body.position);
  leg.rotation.x = body.rotation.x + swing;
}

// A leg back where it stands, as it was made.
export function stood(q: Quadruped, leg: THREE.Group, i: number): void {
  leg.position.set(q.legs[i][0] * q.voxel, q.legHeight * q.voxel, q.legs[i][1] * q.voxel);
  leg.rotation.set(0, 0, 0);
}
