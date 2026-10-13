// Someone turned into a rag doll (model/spells/turned.ts), played step by step (a staging all its own: staging.ts
// `direct`), on themselves as they stand (no cubes: a doll has limbs to go slack): a start; then smaller, down to a
// hand high, their head less than the rest of them; softer, their colours gone toward linen from the feet up; seams
// sewn up their legs, their arms, down their front, stitch by stitch; seen close, their eyes, a button over each,
// and their mouth stitched; then nothing in their limbs to hold them, and they go over on their back. Then the doll
// of them, lying there (meshes/turned/ragDoll.ts: themselves, made a doll, and not the one doll that lies in the
// world after, dollVoxels.ts, which is nobody's: what's told is them, to the end). Anything not human-shaped: the
// same, less its limbs and its eyes.
import * as THREE from 'three';
import { SMALL, ragDollOf } from '../../meshes/turned/ragDoll';
import { bell, smooth, through, type Span } from '../easing';
import type { Staging } from '../staging';

const LENGTH = 12; // seconds
const START: Span = [0, 0.05];
const SHRINKING: Span = [0.07, 0.36];
const SOFTENING: Span = [0.22, 0.48]; // their colours, from the feet up
const BAND = 0.3; // of their height, the linen's edge: where it's coming to them
const SEWING: Span = [0.44, 0.7];
const CLOSE: Span = [0.66, 0.72]; // seen close, for their face
const BUTTONS: Span = [0.7, 0.8];
const SLACK: Span = [0.82, 0.9];
const FALLING: Span = [0.89, 0.985];
const SAID: ReadonlyArray<[at: number, line: string]> = [
  [0, '{name} looks at the slab, and it is wider than it was.'],
  [SHRINKING[0], 'Smaller. Knee high; then less.'],
  [SOFTENING[0] + 0.02, 'Softer: skin to linen, the rest to stuffing.'],
  [SEWING[0], 'Seams, up the legs. Small, even stitches.'],
  [0.54, 'Up the arms; down the front. Whoever sewed it took care.'],
  [BUTTONS[0], 'The eyes: buttons. Thread through each.'],
  [SLACK[0], 'Nothing in the limbs to hold them.'],
  [FALLING[0] + 0.03, 'Down.'],
];

// `stood`: whoever's turned, drawn afresh as they stood (what the doll's made of).
export function dollStagingOf(stood: () => THREE.Object3D): Staging {
  return {
    title: "Seamstress's curse",
    becomes: 'A rag doll',
    lines: [[0, '{name} looks at the slab, and it is wider than it was.'], [0.5, 'And is small, and soft.']],
    target: () => {
      const doll = ragDollOf(stood());
      doll.soften(1);
      for (const done of ['shrink', 'sew', 'button', 'slacken', 'fall'] as const) doll[done](1);
      return { root: doll.root, height: doll.box.max.y * SMALL * 0.4, settle() {} };
    },
    direct(figure, _scene, tall) {
      const doll = ragDollOf(figure);
      const top = Math.max(1e-6, doll.box.max.y);
      return {
        length: LENGTH,
        lines: SAID,
        update(u) {
          const start = bell(through(u, START));
          doll.shrink(smooth(through(u, SHRINKING)));
          const soft = through(u, SOFTENING) * (1 + BAND);
          doll.soften((at) => smooth(Math.max(0, Math.min(1, (soft - at.y / top) / BAND))));
          doll.sew(through(u, SEWING));
          doll.button(through(u, BUTTONS));
          doll.slacken(smooth(through(u, SLACK)));
          // Over on their back: slowly, then all at once; a small bounce as they land.
          const t = through(u, FALLING);
          doll.fall(t < 0.8 ? (t / 0.8) ** 2.4 : 1 - 0.05 * bell((t - 0.8) / 0.2));
          figure.position.y += start * tall * 0.03; // (a start)
        },
        view(u) {
          // With them as they dwindle; close on their face for its buttons; then down to where they lie.
          const [small, close, down] = [smooth(through(u, SHRINKING)), smooth(through(u, CLOSE)) * (1 - smooth(through(u, [0.8, 0.86]))), smooth(through(u, FALLING))];
          const size = 1 + (SMALL - 1) * small;
          const mix = (whole: number, near: number) => whole + (near - whole) * close;
          return {
            aim: mix(tall * size * 0.5, tall * size * 0.82) * (1 - 0.7 * down),
            far: mix(tall * (4.2 + (1.9 - 4.2) * small), tall * 0.95) * (1 - 0.3 * down),
            rise: mix(0.28, 0.16) + 0.22 * down,
            z: -tall * size * 0.4 * down,
          };
        },
        dispose() {
          doll.dispose();
        },
      };
    },
  };
}
