// What the stagings played full screen share (swapStaging.ts, turning.ts): someone read off as fine
// cubes, and such clouds of cubes told apart, by colour, cut in bands.
import * as THREE from 'three';
import type { Span } from '../easing';
import { PERSON_CUBE, sampleFigure, type Cloud } from './voxelMorph';

const NOTHING = new THREE.Color(-9, -9, -9); // (no colour of anything's)
const keyOf = (at: THREE.Vector3, size: number) => `${Math.round((at.x / size) * 2)},${Math.round((at.y / size) * 2)},${Math.round((at.z / size) * 2)}`; // (to half a cube: the same place, the same key)
const off = (a: THREE.Color, b: THREE.Color) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 0.02;

// Someone (or a part of them) as fine cubes, each where a voxel of them is: nothing seen to change as it's put in their place.
export const read = (of: THREE.Object3D, tall: number): Cloud => sampleFigure(of, tall, 30, PERSON_CUBE);
export const some = (cloud: Cloud, keep: (at: THREE.Vector3, i: number) => boolean): Cloud => {
  const kept = cloud.at.map((at, i) => keep(at, i));
  return { at: cloud.at.filter((_, i) => kept[i]), color: cloud.color.filter((_, i) => kept[i]), size: cloud.size };
};
export const joined = (clouds: readonly Cloud[], size: number): Cloud => ({ at: clouds.flatMap((c) => c.at), color: clouds.flatMap((c) => c.color), size });
// The cubes of `a` that `b` hasn't (none there, or another colour's), or (`shared`) that it has.
export const apart = (a: Cloud, b: Cloud, shared = false): Cloud => {
  const there = new Map(b.at.map((at, i) => [keyOf(at, a.size), b.color[i]]));
  return some(a, (at, i) => off(a.color[i], there.get(keyOf(at, a.size)) ?? NOTHING) !== shared);
};
// Whether a cube of a cloud is one of these colours of `palette` (by their place in it, from 1: a voxel model's roles).
export const hued =
  (palette: readonly number[]) =>
  (cloud: Cloud, i: number, ...roles: number[]): boolean =>
    roles.some((role) => cloud.color[i].getHex() === palette[role - 1]);
// A part's cubes between two heights of it (0 its foot, 1 its top).
export const band = (cloud: Cloud, [lo, hi]: Span): Cloud => {
  const ys = cloud.at.map((at) => at.y);
  const [min, max] = [Math.min(...ys), Math.max(...ys)];
  return some(cloud, (at) => ((f) => f >= lo && (f < hi || hi >= 1))((at.y - min) / (max - min || 1)));
};
// Where a cloud's cubes are: their middle; the one furthest along an axis (`sign` -1: the least far), what's grown
// from there (a tail from its root, horns from the poll).
export const middleOf = (cloud: Cloud): THREE.Vector3 => new THREE.Box3().setFromPoints(cloud.at).getCenter(new THREE.Vector3());
export const most = (cloud: Cloud, axis: 'x' | 'y' | 'z', sign: 1 | -1 = 1): THREE.Vector3 => cloud.at.reduce((best, at) => (at[axis] * sign > best[axis] * sign ? at : best));
