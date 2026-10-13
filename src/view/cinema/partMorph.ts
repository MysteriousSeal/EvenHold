// A figure turned into another part by part (what has parts: someone human-shaped, a four-legged beast:
// transformCinema.ts), in two movements, as a body might:
//  1. it takes the new thing's stance, still itself: each part, unchanged, carried on its joint (`pivot`) to where the
//     new thing's joint would be were it their size (`pose`), and turned over if what it becomes lies another way
//     (`tip`: a torso stood upright bent forward at the waist till it lies level; so someone turned into a horse goes
//     down on all fours first, their head carried forward, their arms come down as forelegs);
//  2. then every part reshapes where it now is, all at once, into the part it becomes: each read off as its own
//     voxels (voxelMorph.ts sampleFigure), each voxel going the short way to the place in the new part that answers
//     to its own, the part changing shape, size and colour as one; its joint carried on to where the new thing's is at
//     the size it's built (so it grows, or keeps its size, as it changes).
// What it becomes may be built bigger than itself (`big`): once every part has changed, there it is whole, and only
// then does it come down to its own size (to be put in its place unseen).
import * as THREE from 'three';
import { Growth } from './growth';
import { VoxelMorph, type Cloud } from './voxelMorph';

export interface Piece {
  from: Cloud; // a part of the figure
  into: Cloud; // the part it becomes, at the size it's built
  posing?: [from: number, to: number]; // when, of the whole, it takes its stance (none: it has it)
  window: [from: number, to: number]; // when it reshapes
  pivot?: [from: THREE.Vector3, into: THREE.Vector3]; // the joint it hangs on: where it is, and where the new part's is
  pose?: THREE.Vector3; // where its joint is once it's taken its stance (none: where it'll end)
  tip?: number; // radians it's turned over forward (about its joint) as it takes its stance
  contort?(t: number, time: number): [x: number, y: number, z: number]; // how it's moved on its joint as it reshapes, `t` through it (radians; at rest at either end)
  carried?(u: number): THREE.Vector3; // where its joint is, all along, if that's said outright (a body kept joined as its parts change in turn)
  moving?: [from: number, to: number]; // when its joint goes to where the new part's is (none: as it reshapes)
  pace?(t: number): number; // how far reshaped it is, `t` through its turn (none: steadily; e.g. in stages, each held)
  acting?(u: number, time: number): [x: number, y: number, z: number]; // how it's held on its joint all along (radians: someone moving as they change)
  swell?(t: number): number; // how much wider than itself it is as it reshapes, `t` through its turn (0: not)
  rides?: THREE.Object3D[];
  // What grows on the new part once it's there (growth.ts: its voxels where the new part's are, each one's turn, and when of the whole).
  grows?: Array<{ cloud: Cloud; order: number[]; window: [from: number, to: number] }>; // what's carried on its joint (set from the joint: hair, a beard)
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const through = (u: number, [a, b]: [number, number]) => Math.max(0, Math.min(1, (u - a) / (b - a)));
const X = new THREE.Vector3(1, 0, 0);

export class PartMorph {
  readonly object = new THREE.Group();
  private readonly parts: Array<{ morph: VoxelMorph; joint: THREE.Group; piece: Piece; grown: Growth[] }>;

  // `big`: how many times its own size what it becomes is built at; `down`: from when, of the whole, it comes down to it.
  constructor(
    pieces: readonly Piece[],
    private readonly big: number,
    private readonly down: number,
    private readonly glow?: { color: number; stays: boolean }, // what the figure's lit with from within (someone's: so are its voxels), and whether what it becomes is too (not: gone by the time it's that)
  ) {
    this.parts = pieces
      .filter((piece) => piece.from.at.length > 0 && piece.into.at.length > 0)
      .map((piece) => {
        // Each part's voxels kept from its joint: the old part's from where the joint is, the new part's from where it'll
        // be (turned back the way the part's turned over, so it's where it should be once it has been).
        const [pivotFrom, pivotInto] = piece.pivot ?? [new THREE.Vector3(), new THREE.Vector3()];
        const from = { ...piece.from, at: piece.from.at.map((at) => at.clone().sub(pivotFrom)) };
        const into = { ...piece.into, at: piece.into.at.map((at) => at.clone().sub(pivotInto).applyAxisAngle(X, -(piece.tip ?? 0))) };
        const morph = new VoxelMorph(from, into, true);
        if (glow) (morph.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(glow.color);
        const joint = new THREE.Group();
        for (const object of [morph.mesh, ...(piece.rides ?? [])]) joint.add(object);
        const grown = (piece.grows ?? []).map(({ cloud, order }) => new Growth({ ...cloud, at: cloud.at.map((at) => at.clone().sub(pivotInto).applyAxisAngle(X, -(piece.tip ?? 0))) }, order, 0));
        for (const growth of grown) joint.add(growth.mesh);
        this.object.add(joint);
        return { morph, joint, piece, grown };
      });
    this.update(0, 0);
  }

  // `u`: 0 the figure whole, 1 what it becomes whole and at its own size.
  update(u: number, time: number): void {
    for (const { morph, joint, piece, grown } of this.parts) {
      for (const [i, growth] of grown.entries()) growth.update(through(u, piece.grows![i].window));
      const stance = piece.posing ? smooth(through(u, piece.posing)) : 1;
      const t = through(u, piece.window);
      const e = smooth(t);
      morph.update(piece.pace ? piece.pace(t) : t, time);
      if (this.glow && !this.glow.stays) (morph.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 - e;
      if (piece.carried) joint.position.copy(piece.carried(u));
      else if (piece.pivot) {
        const [pivotFrom, pivotInto] = piece.pivot;
        const posed = piece.pose ?? pivotInto;
        const m = piece.moving ? through(u, piece.moving) : t;
        if (m > 0) joint.position.lerpVectors(posed, pivotInto, (m + smooth(m)) / 2); // (steadily, as its voxels go)
        else joint.position.lerpVectors(pivotFrom, posed, stance);
      }
      const moved = t > 0 && t < 1 ? piece.contort?.(t, time) ?? [0, 0, 0] : [0, 0, 0];
      const wide = 1 + (t > 0 && t < 1 ? piece.swell?.(t) ?? 0 : 0);
      joint.scale.set(wide, 1, wide);
      const held = piece.acting?.(u, time) ?? [0, 0, 0];
      joint.rotation.set((piece.tip ?? 0) * stance + moved[0] + held[0], moved[1] + held[1], moved[2] + held[2]);
    }
    this.object.scale.setScalar(1 + (1 / this.big - 1) * smooth(through(u, [this.down, 1])));
  }

  dispose(): void {
    this.object.removeFromParent();
    for (const { morph, grown } of this.parts) [morph.dispose(), ...grown.map((growth) => growth.dispose())];
  }
}
