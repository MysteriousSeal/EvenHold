// What has parts (someone human-shaped, a four-legged beast: actor.ts) turned into a creature, each part into the
// part of it that answers to its own (partMorph.ts's pieces, made here for any such creature: a hen, a horse): their
// legs (a beast's hind legs) into its legs (a four-legged one's hind legs); their arms (a beast's forelegs) into
// what answers to arms on it (a hen's wings, a horse's forelegs); their torso (a beast's trunk and tail) into its
// body; their head into its head. In two movements (partMorph.ts): first they take its stance, still themselves
// (each part carried to where its joint would be were it their size, a torso stood upright bent level at the
// waist); then every part reshapes where it is, all but together. A creature smaller than they are is built as big
// as they are (`big` times its own size), and comes down to its own once it's whole; one bigger than they are is
// built at its own size, so each part of them grows into its part as it changes.
import * as THREE from 'three';
import type { Actor } from './actor';
import type { Piece } from './partMorph';
import { sampleFigure, type Cloud } from './voxelMorph';

export interface Becoming {
  tall: number; // how tall it stands, itself
  // Its parts' voxels `big` times its size (each pair: the one at -x, then the one at +x), and where each hangs.
  parts(big: number): {
    legs: [Cloud, Cloud];
    arms: [Cloud, Cloud];
    body: Cloud;
    head: Cloud;
    joints: { legs: [THREE.Vector3, THREE.Vector3]; arms: [THREE.Vector3, THREE.Vector3]; body: THREE.Vector3; head: THREE.Vector3 };
  };
  arms(side: number, t: number): [x: number, y: number, z: number]; // how an arm's moved on its joint through its turn (radians; at rest either end)
}

const ROWS = 22; // cubes to their height, read off them
export const POSING: [number, number] = [0.04, 0.28]; // when, of the whole, they take its stance, still themselves
// When each part reshapes, after: all but together, from the ground up.
const WINDOWS: Record<'legs' | 'arms' | 'trunk' | 'head', [number, number]> = { legs: [0.26, 0.76], arms: [0.3, 0.8], trunk: [0.34, 0.88], head: [0.4, 0.92] };
export const DOWN = 0.92; // from when, of the whole, it comes down to its own size
// At rest either end of a part's turn, at its most in the middle.
export const env = (t: number): number => Math.sin(t * Math.PI);

export function partPieces(actor: Actor, becoming: Becoming): { pieces: Piece[]; big: number; down: number } | null {
  const { beast, human, size } = actor;
  if (!beast && !human) return null;
  // As big as they are, where they're the bigger: it comes down to its own size once it's whole. Where it's the bigger
  // (a horse, of a man): built at its own size, each part of them growing into its part as it changes.
  const big = Math.max(1, (size.y * 0.9) / becoming.tall);
  const its = becoming.parts(big);
  const stance = becoming.parts((size.y * 0.9) / becoming.tall).joints; // (where its joints would be, were it their size: the stance they take first)
  const read = (...parts: THREE.Object3D[]): Cloud => {
    const clouds = parts.map((part) => sampleFigure(part, size.y, ROWS));
    return { at: clouds.flatMap((c) => c.at), color: clouds.flatMap((c) => c.color), size: Math.max(...clouds.map((c) => c.size)) };
  };
  const sideOf = (group: THREE.Object3D) => Math.sign(new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()).x) || 1;
  const where = (group: THREE.Object3D) => group.getWorldPosition(new THREE.Vector3());
  const made = human
    ? { legs: [human.joints.leftLeg, human.joints.rightLeg], arms: [human.joints.leftArm, human.joints.rightArm], trunk: [human.joints.torso], head: human.joints.head, waist: human.hips, tip: Math.PI / 2 }
    : { legs: beast!.hind, arms: beast!.fore, trunk: [beast!.trunk, beast!.tail], head: beast!.head, waist: beast!.trunk, tip: 0 };
  return {
    big,
    down: DOWN,
    pieces: [
      // The legs: carried to where its legs stand, then reshaped.
      ...made.legs.map((leg): Piece => {
        const side = sideOf(leg);
        return { from: read(leg), into: its.legs[side < 0 ? 0 : 1], posing: POSING, window: WINDOWS.legs, pivot: [where(leg), its.joints.legs[side < 0 ? 0 : 1]], pose: stance.legs[side < 0 ? 0 : 1] };
      }),
      // The arms (a beast's forelegs), moved as the creature has it.
      ...made.arms.map((arm): Piece => {
        const side = sideOf(arm);
        return { from: read(arm), into: its.arms[side < 0 ? 0 : 1], posing: POSING, window: WINDOWS.arms, pivot: [where(arm), its.joints.arms[side < 0 ? 0 : 1]], pose: stance.arms[side < 0 ? 0 : 1], contort: (t) => becoming.arms(side, t) };
      }),
      // The torso: bent forward at the waist till it lies level (a beast's trunk: level already).
      { from: read(...made.trunk), into: its.body, posing: POSING, window: WINDOWS.trunk, pivot: [where(made.waist), its.joints.body], pose: stance.body, tip: made.tip },
      // The head: carried to where its neck rises, held up, then reshaped.
      { from: read(made.head), into: its.head, posing: POSING, window: WINDOWS.head, pivot: [where(made.head), its.joints.head], pose: stance.head },
    ],
  };
}
