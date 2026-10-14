// One war hound on screen (a bandit stronghold's: houndVoxels.ts), animated from its model state each frame. Built
// on the quadruped said once (turned/quadruped.ts: its parts sculpted, each on its own pivot, its legs never inside
// it), not on the wild beasts' rig (beastRig.ts: boxes at the wolf's voxels, one gait), for it goes two ways:
// - walking, a trot: its legs in diagonal pairs, paced by the distance moved, its head low and nodding;
// - running (after someone): a gallop: its forelegs together and its hind legs together, a quarter stride apart,
//   its body pitching and bounding with it, its head carried forward;
// - its bite, over its own swing: crouched and drawn back, then sprung forward with its forelegs reaching and its
//   head thrown up and snapped down, then recovered;
// - stood: breathing, its head turned now and then to listen;
// - a red flash while hurt, a voxel health bar over it; on death, rolled onto its side, then burst into cubes.
import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { createQuadruped } from '../turned/quadruped';
import { KIND_LOOKS } from './enemyKinds';
import { HealthBar } from './enemyParts';
import { FoeRig } from './foeRig';
import { HOUND_BODY, HOUND_PALETTE, HOUND_SHAPE, HOUND_VOXEL_SIZE } from './houndVoxels';

const V = HOUND_VOXEL_SIZE;
const HEIGHT = (HOUND_SHAPE.legHeight + HOUND_BODY[1] - HOUND_SHAPE.pivots.body[1]) * V; // its withers, about
const TURN_RATE = 12; // how fast it turns the way it's going
const TROT = { stride: 9, swing: 0.5, bob: 0.006 }; // leg-swing radians per world unit, radians swung, world units risen
const GALLOP = { stride: 6, swing: 0.85, bob: 0.025, pitch: 0.14 };
const SWING = 0.5; // seconds its bite takes, where the model has none for its kind
const TOPPLE_TIME = 0.35; // seconds to fall onto its side
const ON_ITS_SIDE = (HOUND_BODY[0] / 2) * V; // how high its middle lies then

export interface HoundLook {
  normal: THREE.Material;
  flash: THREE.Material;
}

// What every hound on screen is drawn in.
export function createHoundLook(flash: THREE.Material): HoundLook {
  return { normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), flash };
}

export class HoundRig extends FoeRig {
  private readonly whole: THREE.Group; // all of it (pitched and thrown forward as one)
  private readonly body: THREE.Group;
  private readonly head: THREE.Group;
  private readonly legs: THREE.Group[]; // hind left, hind right, fore left, fore right
  private readonly meshes: THREE.Mesh[] = [];
  private phase = 0;
  private run = 0; // 0 trotting .. 1 galloping, eased

  constructor(
    hound: Pick<Enemy, 'kind' | 'name'>,
    private readonly look: HoundLook,
  ) {
    const kinds = KIND_LOOKS as Partial<typeof KIND_LOOKS>; // (its kind's name, once its kind's among them)
    super(0, new HealthBar(HEIGHT + 0.2, hound.name ?? kinds[hound.kind]?.name ?? 'War hound'), { colors: HOUND_PALETTE.slice(0, 5), height: HEIGHT });
    const made = createQuadruped(look.normal, HOUND_SHAPE);
    [this.whole, this.body, this.head, this.legs] = [made.root, made.body, made.head, made.legs];
    this.whole.traverse((o) => o instanceof THREE.Mesh && this.meshes.push(o));
    this.root.add(this.whole, this.bar.group);
    this.root.userData.beast = { body: this.whole, trunk: this.body, head: this.head, legs: this.legs }; // (for what stages it part by part)
  }

  update(hound: Enemy, dt: number): void {
    const moved = this.follow(hound, dt, TURN_RATE);
    this.marked(hound);
    if (hound.state === 'dead') return this.die(hound.deadFor, dt);

    const going = moved > 1e-4;
    this.run += ((going && hound.state === 'chase' ? 1 : 0) - this.run) * Math.min(1, 8 * dt);
    const r = this.run;
    if (going) this.phase += moved * (TROT.stride + (GALLOP.stride - TROT.stride) * r);
    const walking = going ? 1 : 0;
    const [s, c] = [Math.sin(this.phase) * walking, Math.cos(this.phase) * walking];
    // Trotting: diagonal pairs. Galloping: its forelegs together, its hind legs together, a quarter stride behind.
    const trot = [s, -s, -s, s].map((v) => v * TROT.swing);
    const gallop = [c, c, s, s].map((v) => v * GALLOP.swing);
    this.legs.forEach((leg, i) => (leg.rotation.x = trot[i] * (1 - r) + gallop[i] * r));
    this.whole.position.set(0, Math.abs(s) * TROT.bob * (1 - r) + Math.max(0, s) * GALLOP.bob * r, 0);
    this.whole.rotation.set(-c * GALLOP.pitch * r, 0, 0);
    // Its head: low and nodding at a trot, forward at a gallop; stood, turned now and then to listen.
    const listening = going ? 0 : Math.sin(this.time * 0.7) > 0.6 ? Math.sin(this.time * 2.1) * 0.35 : 0;
    this.head.rotation.set(walking * (0.12 * (1 - r) + Math.sin(this.phase * 2) * 0.05) + Math.sin(this.time * 2.4) * 0.015, listening, 0);

    const swing = (ENEMY_STATS as Partial<typeof ENEMY_STATS>)[hound.kind]?.swing ?? SWING;
    if (hound.swingFor !== null) this.lunge(Math.min(1, hound.swingFor / swing));
    const material = hound.hurtFor > 0 ? this.look.flash : this.look.normal;
    for (const mesh of this.meshes) mesh.material = material;
  }

  // The bite, over its progress p (0..1): from rest to `back` (drawn back, crouched), to `forward` (sprung), to rest.
  private lunge(p: number): void {
    const key = (back: number, forward: number) => (p < 0.35 ? back * (p / 0.35) : p < 0.6 ? back + (forward - back) * ((p - 0.35) / 0.25) : forward * (1 - (p - 0.6) / 0.4));
    this.whole.position.z = key(-0.05, 0.14);
    this.whole.position.y = key(-0.02, 0.035);
    this.whole.rotation.x = key(0.12, -0.22); // reared back, then pitched into it
    this.head.rotation.x = key(-0.45, 0.4); // thrown up, then snapped down
    for (const leg of [this.legs[2], this.legs[3]]) leg.rotation.x = key(0.3, -0.95); // its forelegs reaching
    for (const leg of [this.legs[0], this.legs[1]]) leg.rotation.x = key(-0.2, 0.55); // its hind legs pushing
  }

  // Death: rolled onto its side, then burst into voxel pieces.
  private die(t: number, dt: number): void {
    for (const mesh of this.meshes) mesh.material = this.look.normal;
    const fall = Math.min(1, t / TOPPLE_TIME);
    this.whole.rotation.set(0, 0, (fall * fall * Math.PI) / 2);
    this.whole.position.set(0, fall * ON_ITS_SIDE, 0);
    for (const leg of this.legs) leg.rotation.x = 0;
    this.head.rotation.set(0.2 * fall, 0, 0);
    if (this.bursting(t, dt)) this.whole.visible = false;
  }
}
