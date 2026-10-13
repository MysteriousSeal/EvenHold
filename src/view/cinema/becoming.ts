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
import { strands, stubble } from './growth';
import type { Piece } from './partMorph';
import { PERSON_GLOW } from '../meshes/human/humanParts';
import { PERSON_CUBE, sampleFigure, type Cloud } from './voxelMorph';

export interface Becoming {
  tall: number; // how tall it stands, itself
  long?: number; // and how long, nose to tail
  fourLegged?: boolean; // it stands on what answers to arms too: those change with its legs
  // What grows on it once every part's changed (a mane, a comb, feathers over a body bare till then), in the order
  // it does: on which part, its voxels `big` times its size, how (growth.ts: out from `root` strand by strand, or
  // here and there), and what's said of it.
  grows?(big: number): Array<{ on: 'body' | 'head'; cloud: Cloud; root?: THREE.Vector3; line: string }>;
  // Its parts' voxels `big` times its size (each pair: the one at -x, then the one at +x), and where each hangs.
  // `plain`: without what grows on it after.
  parts(big: number, plain?: boolean): {
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
const smooth = (t: number) => t * t * (3 - 2 * t);
const span = (u: number, [a, b]: [number, number]) => Math.max(0, Math.min(1, (u - a) / (b - a)));

// When each thing's done, of the whole, where it isn't as above (a turning played step by step: turning.ts): the
// stance, each part's reshaping, each thing that grows on it after (as `becoming.grows` has them), its coming down.
export interface Script {
  posing: [number, number];
  windows: Record<'legs' | 'arms' | 'trunk' | 'head', [number, number]>;
  grows: Array<[number, number]>;
  down: number;
  swell?(t: number): number; // how much wider than itself a part is as it reshapes
}

export function partPieces(actor: Actor, becoming: Becoming, script?: Script): { pieces: Piece[]; big: number; down: number; glow?: { color: number; stays: boolean } } | null {
  const { beast, human, size } = actor;
  if (!beast && !human) return null;
  // As big as they are, where they're the bigger: it comes down to its own size once it's whole. Where it's the bigger
  // (a horse, of a man): built at its own size, each part of them growing into its part as it changes.
  const big = Math.max(1, (size.y * 0.9) / becoming.tall);
  const its = becoming.parts(big, !!script);
  const [posing, windows] = [script?.posing ?? POSING, script?.windows ?? WINDOWS];
  const grows = (on: 'body' | 'head') => (script ? (becoming.grows?.(big) ?? []).map((grown, i) => ({ ...grown, window: script.grows[i] })).filter((grown) => grown.on === on).map(({ cloud, root, window }) => ({ cloud, order: root ? strands(cloud, root) : stubble(cloud), window })) : undefined);
  const stance = becoming.parts((size.y * 0.9) / becoming.tall).joints; // (where its joints would be, were it their size: the stance they take first)
  const read = (...parts: THREE.Object3D[]): Cloud => {
    const clouds = parts.map((part) => sampleFigure(part, size.y, ROWS, human ? PERSON_CUBE : undefined)); // (someone human-shaped: fine cubes, each where a voxel of them is)
    return { at: clouds.flatMap((c) => c.at), color: clouds.flatMap((c) => c.color), size: Math.max(...clouds.map((c) => c.size)) };
  };
  const sideOf = (group: THREE.Object3D) => Math.sign(new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()).x) || 1;
  const where = (group: THREE.Object3D) => group.getWorldPosition(new THREE.Vector3());
  const made = human
    ? { legs: [human.joints.leftLeg, human.joints.rightLeg], arms: [human.joints.leftArm, human.joints.rightArm], trunk: [human.joints.torso], head: human.joints.head, waist: human.hips, tip: Math.PI / 2 }
    : { legs: beast!.hind, arms: beast!.fore, trunk: [beast!.trunk, beast!.tail], head: beast!.head, waist: beast!.trunk, tip: 0 };
  // Played step by step, their body's kept joined: its stance is one of their own proportions (someone: their
  // torso level, their legs under its back end, their arms under its fore end, their head on the front of it; a
  // beast: as it stands), and from there each part's joint goes to where its own is with their trunk as that
  // reshapes (across and along), and up or down with their legs as those change length.
  const level = human ? where(human.joints.head).y - where(human.hips).y : 0; // (their torso's length)
  const back = new THREE.Vector3(0, human?.legLength ?? 0, -level / 2); // (their waist, once they've taken it)
  const stood = (group: THREE.Object3D, kind: 'legs' | 'arms' | 'trunk' | 'head'): THREE.Vector3 => {
    const at = where(group);
    if (!human) return at;
    if (kind === 'legs') return new THREE.Vector3(at.x, back.y, back.z);
    if (kind === 'trunk') return back.clone();
    const along = at.y - where(human.hips).y; // (how far up their torso it hangs: that far along it, now)
    return kind === 'arms' ? new THREE.Vector3(at.x, Math.max(back.y, at.y - Math.min(...made.arms.map((arm) => new THREE.Box3().setFromObject(arm).min.y))), back.z + along) : new THREE.Vector3(0, back.y, back.z + along);
  };
  const steady = (t: number) => (t + smooth(t)) / 2;
  const carried = (group: THREE.Object3D, kind: 'legs' | 'arms' | 'trunk' | 'head', into: THREE.Vector3) => {
    if (!script) return {};
    const [from, stance] = [where(group), stood(group, kind)];
    const lift = its.joints.body.y - stood(made.waist, 'trunk').y;
    return {
      carried: (u: number) => {
        const [s, up, out] = [smooth(span(u, script.posing)), steady(span(u, script.windows.legs)), steady(span(u, script.windows.trunk))];
        const at = from.clone().lerp(stance, s);
        // (Up with their legs as far as their trunk goes; the rest of the way, what it's carried by their trunk's own change: a head on a back grown deep.)
        return at.set(at.x + (into.x - stance.x) * out, at.y + lift * up + (into.y - stance.y - lift) * out, at.z + (into.z - stance.z) * out);
      },
    };
  };
  const more = { swell: script?.swell };
  return {
    big,
    down: script?.down ?? DOWN,
    glow: human ? { color: PERSON_GLOW, stays: false } : undefined, // (someone: their voxels lit as they are, till they're a beast's)
    pieces: [
      // The legs: carried to where its legs stand, then reshaped.
      ...made.legs.map((leg): Piece => {
        const side = sideOf(leg);
        return { from: read(leg), into: its.legs[side < 0 ? 0 : 1], posing, window: windows.legs, pivot: [where(leg), its.joints.legs[side < 0 ? 0 : 1]], pose: stance.legs[side < 0 ? 0 : 1], ...more, ...carried(leg, 'legs', its.joints.legs[side < 0 ? 0 : 1]) };
      }),
      // The arms (a beast's forelegs), moved as the creature has it.
      ...made.arms.map((arm): Piece => {
        const side = sideOf(arm);
        return { from: read(arm), into: its.arms[side < 0 ? 0 : 1], posing, window: windows.arms, pivot: [where(arm), its.joints.arms[side < 0 ? 0 : 1]], pose: stance.arms[side < 0 ? 0 : 1], contort: (t) => becoming.arms(side, t), ...more, ...carried(arm, 'arms', its.joints.arms[side < 0 ? 0 : 1]) };
      }),
      // The torso: bent forward at the waist till it lies level (a beast's trunk: level already).
      { from: read(...made.trunk), into: its.body, posing, window: windows.trunk, pivot: [where(made.waist), its.joints.body], pose: stance.body, tip: made.tip, grows: grows('body'), ...more, ...carried(made.waist, 'trunk', its.joints.body) },
      // The head: carried to where its neck rises, held up, then reshaped.
      { from: read(made.head), into: its.head, posing, window: windows.head, pivot: [where(made.head), its.joints.head], pose: stance.head, grows: grows('head'), ...more, ...carried(made.head, 'head', its.joints.head) },
    ],
  };
}
