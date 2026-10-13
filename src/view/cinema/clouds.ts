// What the stagings played full screen share (swapStaging.ts, turning.ts): spans of the whole and ways through them;
// someone read off as fine cubes, and such clouds of cubes told apart, cut in bands; what someone wears read off them
// piece by piece.
import * as THREE from 'three';
import { ARMOR_SLOTS, type EquipSlot } from '../../model/human/equipment';
import { PERSON_CUBE, sampleFigure, type Cloud } from './voxelMorph';

export type Span = [from: number, to: number];
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const through = (u: number, [a, b]: Span): number => Math.max(0, Math.min(1, (u - a) / (b - a)));
export const bell = (t: number): number => Math.sin(Math.max(0, Math.min(1, t)) * Math.PI); // (at rest either end, at its most in the middle)

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
// A part's cubes between two heights of it (0 its foot, 1 its top).
export const band = (cloud: Cloud, [lo, hi]: Span): Cloud => {
  const ys = cloud.at.map((at) => at.y);
  const [min, max] = [Math.min(...ys), Math.max(...ys)];
  return some(cloud, (at) => ((f) => f >= lo && (f < hi || hi >= 1))((at.y - min) / (max - min || 1)));
};

// What `figure` wears (a HumanRig's root: what's worn where, by its `wornIn`), piece by piece in the order it comes
// off (what's on their head first), each the voxels of it that aren't their body's (`bare`: themselves unclothed, as
// they stand); and last whatever else of them isn't (their braies, close on them). `headed`: something on their head.
export function wornPieces(figure: THREE.Object3D, bare: THREE.Object3D, tall: number): { pieces: Cloud[]; headed: boolean } {
  const skin = read(bare, tall);
  const wornIn = (slot: EquipSlot) => ((figure.userData.wornIn as ((slot: EquipSlot) => THREE.Mesh[]) | undefined)?.(slot) ?? []).filter((mesh) => mesh.visible);
  const pieces = ARMOR_SLOTS.map((slot) => joined(wornIn(slot).map((mesh) => read(mesh, tall)), PERSON_CUBE));
  const gear = ARMOR_SLOTS.flatMap((slot) => wornIn(slot));
  for (const mesh of gear) mesh.visible = false;
  pieces.push(read(figure, tall));
  for (const mesh of gear) mesh.visible = true;
  return { pieces: pieces.map((piece) => apart(piece, skin)), headed: wornIn('head').length > 0 && pieces[0].at.length > 0 };
}
