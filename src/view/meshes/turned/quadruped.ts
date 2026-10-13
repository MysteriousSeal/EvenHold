// A four-legged beast someone's been turned into (a horse, a cow, a bull: model/spells/turned.ts), said once and
// built from that everywhere it's seen: what it's made of (`Quadruped`: its parts' grids, its palette, where each
// part hangs), its parts put together (`createQuadruped`: its rig's, and what it's turned into before the eye:
// view/cinema/), each part's place (`quadrupedParts`: for its voxels read off, its icon), and how it goes about
// (`GrazerRig`: walking, its legs in diagonal pairs; stood, its head down to graze and up again).
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { CreatureRig, partMesher } from '../common/creatureRig';
import type { VoxelGrid } from '../voxel/greedyMesh';

type Voxels = [x: number, y: number, z: number];
export interface Quadruped {
  voxel: number; // a voxel's side
  palette: number[];
  legHeight: number; // voxels its hips and shoulders are off the ground
  legs: ReadonlyArray<[x: number, z: number]>; // each leg's hip, in voxels from the middle of it on the ground: hind left, hind right, fore left, fore right
  neck: Voxels; // the base of its neck, likewise
  // Where each part's own (0, 0, 0) is from where it hangs: its body from the middle of it at its hips' height, its
  // head from the base of its neck, a leg from its hip.
  pivots: { body: Voxels; head: Voxels; leg: Voxels };
  body(): VoxelGrid; // (its tail with it)
  head(): VoxelGrid; // (on its neck)
  leg(hind: boolean): VoxelGrid;
}

// Each part's grid, and where its (0, 0, 0) is in voxels from the middle of the beast on the ground.
export function quadrupedParts(q: Quadruped): { body: { grid: VoxelGrid; at: Voxels }; head: { grid: VoxelGrid; at: Voxels }; legs: Array<{ grid: VoxelGrid; at: Voxels }> } {
  const from = (at: readonly number[], pivot: Voxels): Voxels => [at[0] - pivot[0], at[1] - pivot[1], at[2] - pivot[2]];
  return {
    body: { grid: q.body(), at: from([0, q.legHeight, 0], q.pivots.body) },
    head: { grid: q.head(), at: from(q.neck, q.pivots.head) },
    legs: q.legs.map(([x, z], i) => ({ grid: q.leg(i < 2), at: from([x, q.legHeight, z], q.pivots.leg) })),
  };
}

// Its parts, put together: its body carried on its legs, its head on its neck (to be lowered, or tossed).
export function createQuadruped(material: THREE.Material, q: Quadruped): { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[] } {
  const [root, body, head] = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const mesh = partMesher(q.voxel);
  const V = q.voxel;
  body.add(new THREE.Mesh(mesh(q.body(), q.palette, q.pivots.body), material));
  body.position.y = q.legHeight * V;
  head.add(new THREE.Mesh(mesh(q.head(), q.palette, q.pivots.head), material));
  head.position.set(q.neck[0] * V, (q.neck[1] - q.legHeight) * V, q.neck[2] * V);
  body.add(head);
  const legs = q.legs.map(([x, z], i) => {
    const leg = new THREE.Group();
    leg.add(new THREE.Mesh(mesh(q.leg(i < 2), q.palette, q.pivots.leg), material));
    leg.position.set(x * V, q.legHeight * V, z * V);
    root.add(leg);
    return leg;
  });
  root.add(body);
  return { root, body, head, legs };
}

// How one goes about.
export interface Gait {
  turn: number; // how fast it turns
  stride: number; // leg-swing radians per world unit walked
  swing: number; // radians its legs swing
  bob: number; // world units its body rises with a stride
  nod: number; // radians its head nods with a stride
  every: number; // seconds, stood: one grazing and one look about
  grazing: number; // of that, its head down
  down: number; // radians its neck lowers
  ease: number; // how fast its head goes down and comes up
}

export class GrazerRig extends CreatureRig {
  protected readonly body: THREE.Group;
  protected readonly head: THREE.Group;
  protected readonly legs: THREE.Group[];
  private walked = 0;
  protected lowered = 0; // how far its head is lowered, eased

  constructor(
    material: THREE.Material,
    private readonly shape: Quadruped,
    private readonly gait: Gait,
  ) {
    super(0);
    const made = createQuadruped(material, shape);
    [this.body, this.head, this.legs] = [made.body, made.head, made.legs];
    this.root.add(made.root);
  }

  // Stood with its head up: how its head's held besides (radians), and how far a foreleg's lifted to paw (0: not).
  protected idle(_time: number): { head: [x: number, y: number, z: number]; paw: number } {
    return { head: [0, 0, 0], paw: 0 };
  }

  update(beast: Hen, dt: number): void {
    const { gait } = this;
    const moved = this.follow({ x: beast.x, y: beast.y, z: beast.z, heading: beast.facing }, dt, gait.turn);
    this.walked += moved;
    const walking = moved > 1e-5;
    const swing = walking ? Math.sin(this.walked * gait.stride) : 0;
    // Diagonal pairs: hind left with fore right, hind right with fore left.
    for (const [i, leg] of this.legs.entries()) leg.rotation.x = (i === 0 || i === 3 ? swing : -swing) * gait.swing;
    this.body.position.y = this.shape.legHeight * this.shape.voxel + (walking ? Math.abs(swing) * gait.bob : 0);
    // Stood: its head down to graze most of the while, up for a look about; walking: up, nodding with its stride.
    const grazing = !walking && this.time % gait.every < gait.every * gait.grazing;
    this.lowered += ((grazing ? 1 : 0) - this.lowered) * Math.min(1, gait.ease * dt);
    const { head, paw } = !walking && !grazing ? this.idle(this.time) : { head: [0, 0, 0], paw: 0 };
    if (paw) this.legs[3].rotation.x = -paw;
    this.head.rotation.set(this.lowered * gait.down + (walking ? swing * gait.nod : 0) + head[0], head[1], head[2]);
  }
}
