// Someone's sex changed by a charm (model/spells/swaps.ts), staged (staging.ts: a staging all its own), step by step:
//  1. they start at it; then what they wear comes off them piece by piece (vapour.ts: what's on their head first,
//     their braies last), each unravelling into threads from its edges, their body left as it is;
//  2. they look down at their hands; then their body changes a part at a time, each held a beat (partMorph.ts, each
//     part read off in fine cubes and reshaped where it is): the hips, the waist, the shoulders, the chest (in three
//     stages), the arms, the legs;
//  3. seen close, the face: the jaw, the brow; the hair and beard they had drawn back into them, those they have now
//     grown out (growth.ts);
//  4. and they give way to themselves as they now are, dressed again in what they wore, cut for them; seen whole
//     again.
import * as THREE from 'three';
import type { Humanoid } from '../../model/human/humanoid';
import { type Joint } from '../meshes/human/bodyVoxels';
import { PERSON_GLOW, personMaterial } from '../meshes/human/humanParts';
import { HumanRig } from '../meshes/human/humanRig';
import { unclothed } from '../meshes/human/unclothed';
import { Growth, strands, stubble } from './growth';
import { PartMorph, type Piece } from './partMorph';
import type { Staging } from './staging';
import { Vapour } from './vapour';
import { apart, band, bell, read, smooth, through, wornPieces, type Span } from './clouds';
import type { Cloud } from './voxelMorph';

export const SWAP_LENGTH = 14; // seconds
// When, of the whole (till they give way):
const START: Span = [0, 0.035]; // they start at it
export const BARE: Span = [0.035, 0.3]; // what they wear comes off them
const LOOK: Span = [0.31, 0.37]; // they look down at their hands,
const LOWER: Span = [0.385, 0.43]; // let them fall,
const AWAY: Span = [0.7, 0.735]; // then to their sides,
const UP: Span = [0.74, 0.8]; // and look up again
export const CHANGING = 0.375; // from when their body's changing
const STEPS = { hips: [0.39, 0.445], waist: [0.46, 0.515], shoulders: [0.53, 0.585], chest: [0.605, 0.725], arms: [0.74, 0.785], legs: [0.77, 0.82] } satisfies Record<string, Span>;
const CLOSE: Span = [0.8, 0.86]; // seen close, for the face
const FACE = { jaw: [0.85, 0.9], brow: [0.875, 0.925], goes: [0.85, 0.92], comes: [0.9, 0.985] } satisfies Record<string, Span>;
// Their torso and their head, from the bottom up, in bands (of its height): each changed in its own turn.
const BANDS = { hips: [0, 0.28], waist: [0.28, 0.5], chest: [0.5, 0.83], shoulders: [0.83, 1] } satisfies Record<string, Span>;
const JAW = 0.45; // of the head's height: under it the jaw, over it the brow

// Someone as they stand, facing +Z: in what they wear (nothing in their hands), or as their body alone.
export function standing(who: Humanoid, dressed: boolean): HumanRig {
  const rig = new HumanRig(dressed ? who.look : unclothed(who.look), personMaterial());
  if (dressed) rig.wear(who.equipment);
  rig.hideHeld(true);
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  rig.root.updateMatrixWorld(true);
  return rig;
}

const SWELL = 0.1; // of its width, a part swollen as it reshapes
const swell = (t: number) => SWELL * bell(t);
const staged = (t: number) => (t >= 1 ? 1 : (Math.floor(t * 3) + smooth(Math.min(1, (t * 3 - Math.floor(t * 3)) / 0.55))) / 3);

// How they hold themselves as it goes (radians on each joint): a start at the verse; then, bare, their hands lifted
// and looked down at, let fall, their head down still till their body's done.
function held(u: number): { head: [number, number, number]; arm(side: number): [number, number, number]; hop: number } {
  const start = bell(through(u, START));
  const looking = smooth(through(u, LOOK));
  return {
    head: [-0.1 * start + 0.24 * (looking - smooth(through(u, UP))), 0, 0],
    arm: (side) => [-0.95 * (looking - smooth(through(u, LOWER))), 0, side * (0.3 * start + 0.42 * (smooth(through(u, LOWER)) - smooth(through(u, AWAY))))], // (then held a little away from their sides, their body looked down at)
    hop: start,
  };
}

// `before`: as they were; `after`: as they are now (the same things worn); `called`: what they're now called.
export function swapStaging(before: Humanoid, after: Humanoid, called: string): Staging {
  const woman = after.look.build === 'female';
  const hair = before.look.hairStyle !== after.look.hairStyle;
  return {
    title: 'Moon-turn charm',
    becomes: called,
    length: SWAP_LENGTH,
    lines: [
      [0, '{name} hears the verse, and starts.'],
      [BARE[0], 'What they wear comes off them piece by piece, unravelling into threads.'],
      [LOOK[0], '{name} looks down at their hands.'],
      [STEPS.hips[0], woman ? 'The hips round out.' : 'The hips square.'],
      [STEPS.waist[0], woman ? 'The waist draws in.' : 'The waist thickens.'],
      [STEPS.shoulders[0], woman ? 'The shoulders narrow.' : 'The shoulders broaden.'],
      [STEPS.chest[0], woman ? 'The chest fills, a little at a time.' : 'The chest flattens, a little at a time.'],
      [STEPS.arms[0], woman ? 'Arms and legs slim.' : 'Arms and legs thicken.'],
      [FACE.jaw[0], woman ? 'The jaw softens; the brow.' : 'The jaw squares; the brow.'],
      [FACE.comes[0], before.look.beard ? 'The beard draws back into the skin.' : after.look.beard ? 'Stubble; then a beard.' : hair ? 'The hair, strand by strand.' : 'And it is done.'],
    ],
    target() {
      const rig = standing(after, true);
      return { root: rig.root, height: new THREE.Box3().setFromObject(rig.joints.torso.parent!).max.y, settle() {} };
    },
    direct(figure, scene, tall) {
      const [bare, into] = [standing(before, false), standing(after, false)];
      scene.add(bare.root);
      const where = (group: THREE.Object3D) => group.getWorldPosition(new THREE.Vector3());
      // What they wear, piece by piece, off them as vapour.
      const worn = wornPieces(figure, bare.root, tall);
      const vapour = new Vapour(worn.pieces);
      scene.add(vapour.mesh);
      // (Their hair, where what's on their head hid it: not seen till that's half gone.)
      const gathered = (bare.root.userData.gathered as () => THREE.Mesh | null)();
      const hidden = worn.headed ? (vapour.turns[0][0] + vapour.turns[0][1]) / 2 : 0;

      // Their body, a part at a time, into the other build's: each on its own joint, where it is.
      const act = held;
      const part = (joint: Joint, window: Span, more: Partial<Piece> = {}): Piece => ({ from: read(bare.joints[joint], tall), into: read(into.joints[joint], tall), window, pivot: [where(bare.joints[joint]), where(into.joints[joint])], pose: where(bare.joints[joint]), swell, ...more });
      const arm = (joint: 'leftArm' | 'rightArm') => part(joint, STEPS.arms, { moving: STEPS.shoulders, acting: (u) => act(u).arm(Math.sign(bare.joints[joint].position.x)) });
      const torso = part('torso', STEPS.hips);
      const trunk = (Object.keys(BANDS) as Array<keyof typeof BANDS>).map((name): Piece => ({ ...torso, from: band(torso.from, BANDS[name]), into: band(torso.into, BANDS[name]), window: STEPS[name], ...(name === 'chest' ? { pace: staged, swell: (t: number) => SWELL * bell((t * 3 - Math.floor(t * 3)) / 0.55) } : {}) }));
      // Their head: the skull of it (bald, shaven) reshaped, jaw then brow; their hair and beard carried on it.
      const heads = [before, after].map((who) => {
        const of = (look: Partial<Humanoid['look']>) => read(standing({ look: { ...who.look, ...look }, equipment: {} }, false).joints.head, tall);
        const [full, shaven, bald] = [of({}), of({ beard: false }), of({ beard: false, hairStyle: 'bald' })];
        return { bald, hair: apart(shaven, bald), beard: apart(full, shaven) };
      });
      const neck = where(bare.joints.head);
      const set = (cloud: Cloud): Cloud => ({ ...cloud, at: cloud.at.map((at) => at.clone().sub(neck)) }); // (from the joint it rides on)
      const crown = new THREE.Box3().setFromPoints(heads[0].bald.at).getCenter(new THREE.Vector3()).setY(new THREE.Box3().setFromPoints(heads[0].bald.at).max.y).sub(neck);
      const grown = (cloud: Cloud, beard: boolean) => ((placed) => new Growth(placed, beard ? stubble(placed) : strands(placed, crown)))(set(cloud));
      const kept = grown(apart(heads[0].hair, heads[1].hair, true), false); // (what of their hair they keep)
      const goes = [grown(apart(heads[0].hair, heads[1].hair), false), grown(heads[0].beard, true)];
      const comes = [grown(apart(heads[1].hair, heads[0].hair), false), grown(heads[1].beard, true)];
      kept.update(1);
      const skull = { ...part('head', FACE.jaw, { acting: (u) => act(u).head, swell: undefined }), from: heads[0].bald, into: heads[1].bald };
      const head: Piece[] = [
        { ...skull, from: band(skull.from, [0, JAW]), into: band(skull.into, [0, JAW]) },
        { ...skull, from: band(skull.from, [JAW, 1]), into: band(skull.into, [JAW, 1]), window: FACE.brow, moving: FACE.jaw, rides: [kept, ...goes, ...comes].map((growth) => growth.mesh) },
      ];
      const morph = new PartMorph([part('leftLeg', STEPS.legs), part('rightLeg', STEPS.legs), arm('leftArm'), arm('rightArm'), ...trunk, ...head], 1, 0.999, { color: PERSON_GLOW, stays: true });
      scene.add(morph.object);
      const posed = (rig: Record<Joint, THREE.Group>, u: number) => {
        const now = act(u);
        rig.head.rotation.set(...now.head);
        for (const joint of ['leftArm', 'rightArm'] as const) rig[joint].rotation.set(...now.arm(Math.sign(bare.joints[joint].position.x)));
      };
      const theirs = figure.userData.joints as Record<Joint, THREE.Group> | undefined;
      const eye = neck.y + (new THREE.Box3().setFromPoints(heads[0].bald.at).max.y - neck.y) * 0.5; // (the middle of their head)
      return {
        update(u, time) {
          const bared = through(u, BARE);
          const changing = u >= CHANGING;
          figure.visible = bared <= 0; // (dressed, till it starts to come off them)
          if (theirs && bared <= 0) posed(theirs, u);
          figure.position.y = bared <= 0 ? act(u).hop * tall * 0.03 : 0;
          bare.root.visible = bared > 0 && !changing;
          if (gathered) gathered.visible = bared >= hidden;
          posed(bare.joints, u);
          vapour.mesh.visible = bared > 0 && bared < 1;
          vapour.update(bared, time);
          morph.object.visible = changing;
          morph.update(u, time);
          morph.object.rotation.z = 0.045 * Math.sin(time * 5) * bell(through(u, STEPS.chest)); // (unsteady on their feet, as their chest changes)
          for (const growth of goes) growth.update(1 - through(u, FACE.goes));
          for (const growth of comes) growth.update(through(u, FACE.comes));
        },
        // Seen whole as what they wear lifts off; a little nearer as their body changes; close on their face for
        // it; and, themselves again, whole.
        view(u, j) {
          const [near, close, back] = [smooth(through(u, [0.33, 0.39])), smooth(through(u, CLOSE)), smooth(through(j, [0.06, 0.4]))];
          const mix = (whole: number, nearer: number, closest: number, after: number) => ((now) => now + (after - now) * back)(((now) => now + (closest - now) * close)(whole + (nearer - whole) * near));
          // (Their body: from level with it, under their head, near.)
          return { aim: mix(tall * 0.5, tall * 0.46, eye, tall * 0.5), far: mix(tall * 4.6, tall * 2.7, tall * 2.1, tall * 3.9), rise: mix(0.28, 0.06, 0.2, 0.28) };
        },
        dispose() {
          for (const object of [bare.root, vapour.mesh]) object.removeFromParent();
          for (const growth of [kept, ...goes, ...comes]) growth.dispose();
          morph.dispose();
        },
      };
    },
  };
}
