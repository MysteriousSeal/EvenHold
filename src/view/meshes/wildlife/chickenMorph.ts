// Someone turning into a chicken, and back (model/spells/chickens.ts morphOf: 0 themselves, 1 all chicken), drawn
// in stages rather than swapped at a stroke:
//  1. themselves still, taken by a shiver that grows, hunching down and swelling at the middle, the first feathers
//     flying off them;
//  2. spinning faster and faster as they shrink toward a hen's size;
//  3. at SWAP, gone in a puff of smoke and a burst of feathers, the hen there in their place: stretched tall and thin
//     at first, still spinning down;
//  4. the hen springing back to her shape (overshooting, a wobble or two), a startled hop, a shake of her head.
// Turning back runs the same the other way. Their own figure is whatever draws them (a villager's, a traveller's, a
// foe's): `morphOut` is laid over its root each frame, after its own update; `henShape` is the hen's side of it.
import * as THREE from 'three';
import { morphOf, type Chickened } from '../../../model/spells/chickens';

export const SWAP = 0.58; // how far turned they are when one gives way to the other
const SMALL = 0.38; // their own figure's size as it gives way, of what it was
const TURNS = 2.5; // times round they spin, shrinking
const SHIVER = 46; // radians a second the shiver runs at

const smooth = (t: number) => t * t * (3 - 2 * t);

// Their own figure, part turned: shown up to SWAP, shivering, hunched, spun and shrunk; back as it was, otherwise.
export function morphOut(root: THREE.Object3D, chicken: Chickened | undefined, time: number): void {
  const m = chicken ? morphOf(chicken) : 0;
  const base = root.userData.morphBase as THREE.Vector3 | undefined;
  if (m <= 0) {
    if (base) {
      root.scale.copy(base);
      root.rotation.z = 0;
      delete root.userData.morphBase;
    }
    root.visible = true;
    return;
  }
  const from = base ?? (root.userData.morphBase = root.scale.clone());
  root.visible = m < SWAP;
  if (!root.visible) return;
  const k = m / SWAP; // 0 themselves, 1 about to give way
  const shrink = 1 - (1 - SMALL) * smooth(Math.max(0, (k - 0.35) / 0.65)); // (holding their size through the shiver, then down)
  const hunch = Math.sin(Math.min(1, k / 0.5) * Math.PI * 0.5); // down and out at the middle, early
  root.scale.set(from.x * shrink * (1 + 0.16 * hunch), from.y * shrink * (1 - 0.2 * hunch), from.z * shrink * (1 + 0.16 * hunch));
  root.rotation.z = Math.sin(time * SHIVER) * 0.07 * Math.sin(k * Math.PI); // the shiver, most in the middle of it
  root.rotation.y += k * k * k * TURNS * Math.PI * 2; // (laid over the way they face: set afresh each frame by their own rig)
}

// The hen's side of it, from SWAP on: how she's stretched (across, up), how far she's still spun round, how high off
// the ground her hop has her, and the shake of her head. All at rest once she's all chicken.
export function henShape(m: number): { across: number; up: number; spin: number; hop: number; shake: number } {
  const j = Math.max(0, Math.min(1, (m - SWAP) / (1 - SWAP))); // 0 just there, 1 settled
  const spring = Math.exp(-5 * j) * Math.cos(j * 13); // overshooting, and a wobble or two, dying away
  return {
    across: 1 - 0.45 * spring,
    up: 1 + 0.9 * spring,
    spin: (1 - j) * (1 - j) * Math.PI * 2,
    hop: j > 0.35 && j < 0.75 ? Math.sin(((j - 0.35) / 0.4) * Math.PI) * 0.07 : 0,
    shake: j > 0.7 ? Math.sin((j - 0.7) * 60) * 0.5 * (1 - j) * 3.3 : 0,
  };
}
