// Someone's sex changed by a charm (model/spells/swaps.ts), staged (staging.ts: a staging all its own):
//  1. as they stand, dressed; then what they wear comes off them as vapour: read off as the voxels of them that
//     aren't their body's, lifting away from the ground up, thinning to nothing; their body left, as it is;
//  2. their body changes, each part of it into the same part of the other build's (partMorph.ts: legs, arms, torso,
//     head, each on its own joint, reshaped where it is): the hips, the chest, the shoulders, the set of the head;
//     their hair into its new style, a beard gone or grown;
//  3. and they give way to themselves as they now are, dressed again in what they wore, cut for them.
import * as THREE from 'three';
import type { Humanoid } from '../../model/human/humanoid';
import { JOINT_NAMES, type Joint } from '../meshes/human/bodyVoxels';
import { personMaterial } from '../meshes/human/humanParts';
import { HumanRig } from '../meshes/human/humanRig';
import { unclothed } from '../meshes/human/unclothed';
import { PartMorph, type Piece } from './partMorph';
import type { Staging } from './staging';
import { sampleFigure, type Cloud } from './voxelMorph';

const ROWS = 30; // cubes to their height, read off them
const BARE: [number, number] = [0.04, 0.36]; // when, of the whole, what they wear comes off them
// When each part of them changes, after: from the ground up, all but together.
const WINDOWS: Record<Joint, [number, number]> = { leftLeg: [0.36, 0.76], rightLeg: [0.36, 0.76], torso: [0.4, 0.86], leftArm: [0.42, 0.82], rightArm: [0.42, 0.82], head: [0.5, 0.94] };

// Someone as they stand, facing +Z: in what they wear (nothing in their hands), or as their body alone.
export function standing(who: Humanoid, dressed: boolean): HumanRig {
  const rig = new HumanRig(dressed ? who.look : unclothed(who.look), personMaterial());
  if (dressed) rig.wear(who.equipment);
  rig.hideHeld(true);
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  rig.root.updateMatrixWorld(true);
  return rig;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const through = (u: number, [a, b]: [number, number]) => Math.max(0, Math.min(1, (u - a) / (b - a)));
const keyOf = (at: THREE.Vector3, size: number) => `${Math.round(at.x / size - 0.5)},${Math.round(at.y / size - 0.5)},${Math.round(at.z / size - 0.5)}`;

// What they wear, as vapour: each voxel of it lifting off in its turn (from the ground up), drifting, thinning away.
class Vapour {
  readonly mesh: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly spot = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly still = new THREE.Quaternion();
  private readonly span: [number, number];

  constructor(private readonly cloud: Cloud) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), Math.max(1, cloud.at.length));
    this.mesh.frustumCulled = false;
    const ys = cloud.at.map((at) => at.y);
    this.span = [Math.min(0, ...ys), Math.max(1e-6, ...ys)];
    for (const [k, color] of cloud.color.entries()) this.mesh.setColorAt(k, color);
    this.update(0, 0);
  }

  // `k`: 0 worn still, 1 gone.
  update(k: number, time: number): void {
    const { cloud, mesh } = this;
    for (const [i, at] of cloud.at.entries()) {
      const up = (at.y - this.span[0]) / (this.span[1] - this.span[0]); // (how far up them it is: the lowest first)
      const e = smooth(Math.max(0, Math.min(1, (k - up * 0.55) / 0.45)));
      const sway = Math.sin(i * 12.9898) * 43758.5453;
      const own = sway - Math.floor(sway);
      this.spot.set(at.x + Math.sin(time * 3 + i) * cloud.size * 2 * e + (own - 0.5) * cloud.size * 6 * e, at.y + e * e * cloud.size * (10 + own * 14), at.z + Math.cos(time * 2.3 + i * 1.7) * cloud.size * 2 * e);
      this.scale.setScalar(Math.max(1e-5, cloud.size * (1 - e)));
      mesh.setMatrixAt(i, this.matrix.compose(this.spot, this.still, this.scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// `before`: as they were; `after`: as they are now (the same things worn); `called`: what they're now called.
export function swapStaging(before: Humanoid, after: Humanoid, called: string): Staging {
  const woman = after.look.build === 'female';
  return {
    title: 'Moon-turn charm',
    becomes: called,
    lines: [
      [0, '{name} hears the verse, and stands very still.'],
      [BARE[0], 'What they wear lifts off them in threads, and is gone.'],
      [0.36, woman ? 'The body changes: the hips, the chest, the shoulders narrowing.' : 'The body changes: the hips, the chest, the shoulders broadening.'],
      [0.6, woman ? 'The face, the hair. A beard, if there was one, gone.' : 'The face, the hair. The jaw.'],
    ],
    target() {
      const rig = standing(after, true);
      return { root: rig.root, height: new THREE.Box3().setFromObject(rig.joints.torso.parent!).max.y, settle() {} };
    },
    direct(figure, scene, tall) {
      const [bare, into] = [standing(before, false), standing(after, false)];
      scene.add(bare.root);
      // What they wear: the voxels of them, dressed, where their body alone has none.
      const [worn, body] = [sampleFigure(figure, tall, ROWS), sampleFigure(bare.root, tall, ROWS)];
      const skin = new Set(body.at.map((at) => keyOf(at, worn.size)));
      const clothes = worn.at.map((at, i) => ({ at, color: worn.color[i] })).filter((cube) => !skin.has(keyOf(cube.at, worn.size)));
      const vapour = new Vapour({ at: clothes.map((c) => c.at), color: clothes.map((c) => c.color), size: worn.size });
      scene.add(vapour.mesh);
      // Their body, part by part, into the other build's: each on its own joint, where it is.
      const where = (group: THREE.Object3D) => group.getWorldPosition(new THREE.Vector3());
      const pieces = JOINT_NAMES.map((joint): Piece => ({ from: sampleFigure(bare.joints[joint], tall, ROWS), into: sampleFigure(into.joints[joint], tall, ROWS), window: WINDOWS[joint], pivot: [where(bare.joints[joint]), where(into.joints[joint])] }));
      const morph = new PartMorph(pieces, 1, 0.99);
      scene.add(morph.object);
      return {
        update(u, time) {
          const bared = through(u, BARE);
          const changing = u >= WINDOWS.leftLeg[0];
          figure.visible = bared <= 0; // (dressed, till it starts to come off them)
          bare.root.visible = bared > 0 && !changing;
          vapour.mesh.visible = bared > 0 && bared < 1;
          vapour.update(bared, time);
          morph.object.visible = changing;
          morph.update(u, time);
        },
        dispose() {
          for (const object of [bare.root, vapour.mesh]) object.removeFromParent();
          morph.dispose();
        },
      };
    },
  };
}
