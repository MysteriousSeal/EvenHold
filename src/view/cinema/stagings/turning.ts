// Someone, or a four-legged beast, turned into a creature (a hen, a horse: becoming.ts), played step by step (a
// staging all its own: staging.ts `direct`):
//  1. a start at it; then, someone with a body of their own under what they wear: that off them piece by piece
//     (vapour.ts), and their hands looked down at;
//  2. its stance taken, still themselves, unsteady (someone: down on all fours, or stooped);
//  3. each part into its part in its own turn, held a beat (partMorph.ts): legs, arms (seen close), body, head (seen
//     close); it bare still of what grows on it;
//  4. that grown on it, a thing at a time (growth.ts: ears, a mane, a tail; a comb, a beak, feathers);
//  5. down to its own size, where it's the smaller, to give way to it.
// Anything with no such parts: null (taken apart whole and put together again, as before: transformCinema.ts).
import * as THREE from 'three';
import type { BodyLook } from '../../../model/human/humanoid';
import type { Joint } from '../../meshes/human/bodyVoxels';
import { makeActor } from '../actor';
import { partPieces, type Becoming, type Script } from './becoming';
import { bell, smooth, through, type Span } from '../easing';
import { PartMorph } from '../morph/partMorph';
import type { Directed, Staging } from '../staging';
import { Undressing } from './undress';

// What's said of each step (`{name}`: whoever's turned).
export interface Telling {
  start: string;
  bare: string; // what they wear, off them (someone's)
  look: string; // their hands looked at (someone's)
  stance: string;
  legs: string;
  arms: string;
  body: string;
  head: string;
  done: string;
}

// What's said of what someone wears coming off them, and of their hands looked at: the same whatever they turn into.
export const UNDRESSED = { bare: 'What they wear comes off them piece by piece, unravelling into threads.', look: '{name} looks down at their hands.' };

const DOWN = 0.94; // from when, of the whole, it comes down to its own size
const START: Span = [0, 0.03];
const BARE: Span = [0.03, 0.22];
const LOOK: Span = [0.225, 0.255];
const LOWER: Span = [0.265, 0.295];
const SWELL = 0.1; // of its width, a part swollen as it reshapes

export function turningInto(becoming: Becoming, says: { person: Telling; beast: Telling }, feathered = false): NonNullable<Staging['direct']> {
  return (figure, scene, tall, actor): Directed | null => {
    if (!actor.human && !actor.beast) return null;
    // Someone whose body's their own, under what they wear: that first (a beast, the dead: as they stand).
    const look = actor.human ? ((figure.userData.look as BodyLook | null | undefined) ?? null) : null;
    const undressing = look ? new Undressing(figure, { look, equipment: {} }, scene, tall) : null;
    const bare = undressing?.bare ?? null;
    // Everything after: in what's left of the whole.
    const from = bare ? 0.3 : 0.05;
    const at = (a: number, b: number): Span => [from + (DOWN - from) * a, from + (DOWN - from) * b];
    const grown = becoming.grows?.(1) ?? [];
    const script: Script = {
      posing: at(0, 0.15),
      // (What stands on four legs: all four at once, so it's never left with its fore end in the air.)
      windows: becoming.fourLegged ? { legs: at(0.17, 0.37), arms: at(0.17, 0.37), trunk: at(0.41, 0.55), head: at(0.58, 0.72) } : { legs: at(0.17, 0.29), arms: at(0.31, 0.43), trunk: at(0.45, 0.57), head: at(0.59, 0.72) },
      grows: grown.map((_, i) => at(0.74 + (0.26 * i) / grown.length, 0.74 + (0.26 * (i + 1.25)) / grown.length)),
      down: DOWN,
      swell: (t) => SWELL * bell(t),
    };
    const body = bare ? makeActor(bare.root) : actor;
    const made = partPieces(body, becoming, script)!;
    const morph = new PartMorph(made.pieces, made.big, made.down, made.glow);
    scene.add(morph.object);
    const told = actor.human ? says.person : says.beast;
    const lines: Array<[number, string]> = [[0, told.start], ...(bare ? ([[BARE[0], told.bare], [LOOK[0], told.look]] as Array<[number, string]>) : []), [script.posing[0], told.stance], [script.windows.legs[0], told.legs], ...(becoming.fourLegged ? [] : ([[script.windows.arms[0], told.arms]] as Array<[number, string]>)), [script.windows.trunk[0], told.body], [script.windows.head[0], told.head], ...grown.map((thing, i): [number, string] => [script.grows[i][0], thing.line]), [DOWN, told.done]];

    // How someone holds themselves before it: a start; bare, their hands lifted and looked down at, let fall.
    const posed = (joints: Record<Joint, THREE.Group>, u: number) => {
      const [start, looking] = [bell(through(u, START)), smooth(through(u, LOOK)) - smooth(through(u, LOWER))];
      joints.head.rotation.set(-0.1 * start + 0.24 * looking, 0, 0);
      for (const joint of ['leftArm', 'rightArm'] as const) joints[joint].rotation.set(-0.95 * looking, 0, Math.sign(joints[joint].getWorldPosition(new THREE.Vector3()).x) * 0.3 * start);
    };
    // Where it's seen from: whole (room over them for what lifts off, and for it, where it's the bigger); close on
    // its forelimbs as they change; close on its head, for that and what grows on it; whole again; and with it as
    // it comes down to its size.
    const its = becoming.parts(made.big).joints;
    const [high, long] = [Math.max(tall, becoming.tall * made.big), (becoming.long ?? becoming.tall) * made.big];
    const first = { x: 0, z: 0, aim: tall * 0.5, far: tall * 4.6, rise: 0.28 }; // (themselves, till they take its stance)
    const whole = { x: 0, z: 0, aim: high * 0.5, far: Math.max(high * 4.4, long * 3.4), rise: 0.28 };
    const limbs = { x: 0, z: its.arms[0].z, aim: its.arms[0].y * 0.55, far: high * 2.7, rise: 0.12 };
    const face = { x: 0, z: its.head.z + long * 0.12, aim: its.head.y + high * 0.1, far: high * 2.5, rise: 0.14 };
    const onHead = grown.map((thing, i) => (thing.on === 'head' ? script.grows[i][1] : 0)).reduce((a, b) => Math.max(a, b), script.windows.head[1]); // (till the last of what grows on its head has)
    return {
      length: bare ? 14 : 12,
      lines,
      feathers: feathered ? [script.grows[0]?.[0] ?? DOWN, 1] : undefined,
      update(u, time) {
        const changing = u >= script.posing[0];
        if (undressing) undressing.update(through(u, BARE), changing, time, (joints) => posed(joints, u), bell(through(u, START)));
        else {
          figure.visible = !changing;
          figure.rotation.z = changing ? 0 : Math.sin(time * 40) * 0.05 * through(u, [0, script.posing[0]]); // (a beast, the dead: a shiver)
        }
        morph.object.visible = changing;
        morph.update(u, time);
        morph.object.rotation.z = actor.human ? 0.05 * Math.sin(time * 6) * bell(through(u, script.posing)) : 0; // (unsteady, going down)
      },
      view(u) {
        const [arms, head] = [script.windows.arms, script.windows.head];
        const near = smooth(through(u, [arms[0] - 0.025, arms[0] + 0.015])) - smooth(through(u, [arms[1], arms[1] + 0.03]));
        const close = smooth(through(u, [head[0] - 0.025, head[0] + 0.015])) - smooth(through(u, [onHead, onHead + 0.03]));
        const k = 1 + (1 / made.big - 1) * smooth(through(u, [DOWN, 1])); // (as it comes down)
        const wide = smooth(through(u, script.posing));
        const mix = (key: 'x' | 'z' | 'aim' | 'far' | 'rise') => ((now) => now + (face[key] - now) * close)(((now) => now + (limbs[key] - now) * near)(first[key] + (whole[key] - first[key]) * wide));
        return { x: mix('x') * k, z: mix('z') * k, aim: mix('aim') * k, far: mix('far') * k, rise: mix('rise') };
      },
      dispose() {
        undressing?.dispose();
        morph.dispose();
      },
    };
  };
}
