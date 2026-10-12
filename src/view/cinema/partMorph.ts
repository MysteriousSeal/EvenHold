// A figure turned into another part by part, each part morphing into the part it turns into (what has parts: someone
// human-shaped, a four-legged beast: transformCinema.ts): every part read off as its own voxels (voxelMorph.ts
// sampleFigure) and, in its turn, reshaped smoothly into the part it becomes (a leg into a hen's leg, a head into
// hers), each voxel going to the place in the new part that answers to its own, the part changing shape, size and
// colour as one. It hangs on its joint (`pivot`), which is carried to where the new part's is; moved on it a little
// as a limb would be (`contort`: an arm lifted, then laid down; nothing wrung or shaken); and turned over if what it
// becomes lies another way (`tip`: a torso stood upright into a body carried level, bent forward at the waist).
// What it becomes is built as big as it is, so each part changes where it stands; once every part has, there it is
// whole, the new thing itself, and only then does it come down to its own size (to be put in its place unseen).
import * as THREE from 'three';
import { VoxelMorph, type Cloud } from './voxelMorph';

export interface Piece {
  from: Cloud; // a part of the figure
  into: Cloud; // the part it becomes, as big as the figure
  window: [from: number, to: number]; // when, of the whole
  pivot?: [from: THREE.Vector3, into: THREE.Vector3]; // the joint it hangs on: where it is, and where the new part's is
  tip?: number; // radians it's turned over forward (about its joint) as it changes
  contort?(t: number, time: number): [x: number, y: number, z: number]; // how it's wrenched about on its joint, `t` through its turn (radians; at rest at either end)
  wring?: { twist: number; ripple: number };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const X = new THREE.Vector3(1, 0, 0);

export class PartMorph {
  readonly object = new THREE.Group();
  private readonly parts: Array<{ morph: VoxelMorph; joint: THREE.Group; piece: Piece }>;

  // `big`: how many times its own size what it becomes is built at; `down`: from when, of the whole, it comes down to it.
  constructor(
    pieces: readonly Piece[],
    private readonly big: number,
    private readonly down: number,
  ) {
    this.parts = pieces
      .filter((piece) => piece.from.at.length > 0 && piece.into.at.length > 0)
      .map((piece) => {
        // Each part's voxels kept from its joint: the old part's from where the joint is, the new part's from where it'll
        // be (turned back the way the part's to be turned over, so it's where it should be once it has been).
        const [pivotFrom, pivotInto] = piece.pivot ?? [new THREE.Vector3(), new THREE.Vector3()];
        const from = { ...piece.from, at: piece.from.at.map((at) => at.clone().sub(pivotFrom)) };
        const into = { ...piece.into, at: piece.into.at.map((at) => at.clone().sub(pivotInto).applyAxisAngle(X, -(piece.tip ?? 0))) };
        const morph = new VoxelMorph(from, into, true, piece.wring);
        const joint = new THREE.Group();
        joint.add(morph.mesh);
        this.object.add(joint);
        return { morph, joint, piece };
      });
    this.update(0, 0);
  }

  // `u`: 0 the figure whole, 1 what it becomes whole and at its own size.
  update(u: number, time: number): void {
    for (const { morph, joint, piece } of this.parts) {
      const t = Math.max(0, Math.min(1, (u - piece.window[0]) / (piece.window[1] - piece.window[0])));
      const e = smooth(t);
      morph.update(t, time);
      const [pivotFrom, pivotInto] = piece.pivot ?? [joint.position, joint.position];
      if (piece.pivot) joint.position.lerpVectors(pivotFrom, pivotInto, e);
      const wrench = t > 0 && t < 1 ? piece.contort?.(t, time) ?? [0, 0, 0] : [0, 0, 0];
      joint.rotation.set((piece.tip ?? 0) * e + wrench[0], wrench[1], wrench[2]);
    }
    this.object.scale.setScalar(1 + (1 / this.big - 1) * smooth(Math.max(0, Math.min(1, (u - this.down) / (1 - this.down)))));
  }

  dispose(): void {
    this.object.removeFromParent();
    for (const { morph } of this.parts) morph.dispose();
  }
}
