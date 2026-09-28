// A humanoid on screen (the hero, a bandit): the shared naked body
// (bodyVoxels.ts) on a simple rig of joints, so each part swings on its own
// pivot, wearing whatever its equipment says. Worn pieces hang on the joints
// of the parts they cover and held items in the hands (gear/), so they all
// move with the body; wear() swaps them as the equipment changes.
//
//   root (at the feet, turned to face where they walk)
//   └ body (bobs while walking, breathes while idle)
//     ├ torso            hips at the pivot
//     ├ head             neck at the pivot
//     ├ leftArm/rightArm shoulders at the pivots, arms hang down
//     └ leftLeg/rightLeg hips at the pivots, legs hang down
//
// Walking is driven by distance actually moved, so the stride matches any
// speed (including the dev speed boost) and stops the moment they do.

import * as THREE from 'three';
import { EQUIP_SLOTS, ITEMS, isHeldSlot, type EquipSlot, type Equipment, type ItemId } from '../../../model/human/equipment';
import { HERO_LOOK, type BodyLook } from '../../../model/human/humanoid';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { HAND, HELD_BY, HUMAN_VOXEL_SIZE, JOINTS, JOINT_NAMES, PART_PIVOT, bodyPalette, buildBodyPart, type BodyPart, type Joint } from './bodyVoxels';
import { BODY_FILL, withBody } from './gear/armorShell';
import { ITEM_MODELS, wornGrid } from './gear/itemModels';

const V = HUMAN_VOXEL_SIZE;
const STRIDE = 4.5; // walk-cycle radians per world unit walked: ~3 cycles a second at walking speed
const LEG_SWING = 0.7; // radians at full stride: long, loping steps
const ARM_SWING = 0.55;
const BOB = 0.012; // body rise at each step, world units
const TURN_RATE = 14; // how fast they turn toward where they're walking (per second)

// The blow, keyed over its progress (0..1): the right arm winds up overhead
// and slightly back, strikes forward and down fast, then recovers; the body
// twists into it, dips and leans in at the strike, and the legs brace.
// Arm angles: negative swings the arm forward and up (the body faces +Z).
type Keys = Array<[number, number]>;
const ATTACK = {
  rightArm: [[0, 0], [0.35, -3.3], [0.52, -0.9], [0.75, -0.7], [1, 0]] as Keys,
  leftArm: [[0, 0], [0.35, -0.4], [0.52, 0.55], [1, 0]] as Keys,
  twist: [[0, 0], [0.35, -0.4], [0.52, 0.35], [1, 0]] as Keys, // body turn about Y: right shoulder back, then through
  dip: [[0, 0], [0.35, 0.01], [0.55, -0.018], [1, 0]] as Keys, // body rise
  lunge: [[0, 0], [0.35, -0.01], [0.55, 0.03], [1, 0]] as Keys, // body shift forward
  frontLeg: [[0, 0], [0.4, -0.35], [0.8, -0.35], [1, 0]] as Keys,
  backLeg: [[0, 0], [0.4, 0.3], [0.8, 0.3], [1, 0]] as Keys,
};

// Smoothly interpolated value of `keys` at `p`.
function key(keys: Keys, p: number): number {
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i];
    if (p <= p1) {
      const [p0, v0] = keys[i - 1];
      const t = (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * t * t * (3 - 2 * t);
    }
  }
  return keys[keys.length - 1][1];
}

// Geometries are shared by everyone with the same look, or wearing the
// same item, and live as long as the page.
const geometries = new Map<string, THREE.BufferGeometry | null>();
function cached(key: string, make: () => THREE.BufferGeometry | null): THREE.BufferGeometry | null {
  if (!geometries.has(key)) geometries.set(key, make());
  return geometries.get(key) ?? null;
}

// Meshes `grid` so that `pivot` (in voxels within the grid) sits at the
// origin, drawing only the colors `include` accepts.
function meshAround(grid: VoxelGrid, palette: number[], pivot: [number, number, number], include?: (color: number) => boolean): THREE.BufferGeometry {
  return greedyMesh(grid, palette, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V), include);
}

function bodyGeometry(look: BodyLook, part: BodyPart): THREE.BufferGeometry {
  const key = `body:${look.skin}:${look.hair}:${look.hairStyle}:${look.beard}:${part}`;
  return cached(key, () => meshAround(buildBodyPart(part, look), bodyPalette(look), PART_PIVOT[part]))!;
}

// A worn item's shell on one joint's part, or null if it doesn't cover it:
// meshed around the (undrawn) body, so no faces press against the skin.
// The shell's grid starts one voxel before the part, so its pivot is one further in.
function wornGeometry(item: ItemId, joint: Joint): THREE.BufferGeometry | null {
  const { part, side } = JOINTS[joint];
  return cached(`${item}:${part}:${side}`, () => {
    const grid = wornGrid(item, part, side);
    const pivot = PART_PIVOT[part].map((p) => p + 1) as [number, number, number];
    return grid && meshAround(withBody(grid, part), ITEM_MODELS[item].palette, pivot, (c) => c !== BODY_FILL);
  });
}

function heldGeometry(item: ItemId): THREE.BufferGeometry | null {
  const { held, palette } = ITEM_MODELS[item];
  return cached(`${item}:held`, () => (held ? meshAround(held.build(), palette, held.grip) : null));
}

export class HumanRig {
  readonly root = new THREE.Group();
  readonly joints: Record<Joint, THREE.Group>;
  readonly meshes: THREE.Mesh[] = []; // the body's, then everything worn
  private readonly worn = new Map<EquipSlot, { item: ItemId; meshes: THREE.Mesh[] }>();
  private readonly body = new THREE.Group();
  private readonly last = new THREE.Vector3(Number.NaN, 0, 0);
  private phase = 0;
  private swing = 0; // 0 standing .. 1 full stride, eased
  private heading = 0;
  private time = 0;

  constructor(
    readonly look: BodyLook = HERO_LOOK,
    private material: THREE.Material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  ) {
    const joints = {} as Record<Joint, THREE.Group>;
    for (const joint of JOINT_NAMES) {
      const { part, at } = JOINTS[joint];
      const group = new THREE.Group();
      group.position.set(at[0] * V, at[1] * V, at[2] * V);
      group.add(this.mesh(bodyGeometry(look, part)));
      this.body.add(group);
      joints[joint] = group;
    }
    this.joints = joints;
    this.root.add(this.body);
  }

  // Dresses the body in `equipment`: takes off what's no longer in it and
  // puts on what's new, leaving unchanged slots alone (cheap every frame).
  wear(equipment: Equipment): void {
    for (const slot of EQUIP_SLOTS) {
      const item = equipment[slot];
      const current = this.worn.get(slot);
      if (current?.item === item) continue;
      if (current) {
        for (const mesh of current.meshes) {
          mesh.removeFromParent();
          this.meshes.splice(this.meshes.indexOf(mesh), 1);
        }
        this.worn.delete(slot);
      }
      if (item) this.worn.set(slot, { item, meshes: this.putOn(slot, item) });
    }
  }

  // Every color on the body as dressed now (skin, hair and what's worn),
  // e.g. for the voxels it bursts into.
  get colors(): number[] {
    const colors = bodyPalette(this.look).slice(0, 5);
    for (const { item } of this.worn.values()) colors.push(...ITEM_MODELS[item].palette);
    return colors;
  }

  private putOn(slot: EquipSlot, item: ItemId): THREE.Mesh[] {
    if (ITEMS[item].slot !== slot) throw new Error(`${item} doesn't go in the ${slot} slot`);
    const meshes: THREE.Mesh[] = [];
    if (isHeldSlot(slot)) {
      const geometry = heldGeometry(item);
      if (geometry) {
        const mesh = this.mesh(geometry);
        mesh.position.set(HAND[0] * V, HAND[1] * V, HAND[2] * V);
        this.joints[HELD_BY[slot]].add(mesh);
        meshes.push(mesh);
      }
      return meshes;
    }
    for (const joint of JOINT_NAMES) {
      const geometry = wornGeometry(item, joint);
      if (!geometry) continue;
      const mesh = this.mesh(geometry);
      this.joints[joint].add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  private mesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material);
    this.meshes.push(mesh);
    return mesh;
  }

  // Everything, body and what's worn, drawn with `material` (e.g. a hit flash).
  setMaterial(material: THREE.Material): void {
    this.material = material;
    for (const mesh of this.meshes) mesh.material = material;
  }

  // Falls flat on its back as `progress` goes 0 -> 1 (a death), pivoting at the feet.
  fall(progress: number): void {
    const p = Math.min(1, progress);
    this.body.rotation.set(-(p * p * Math.PI) / 2, 0, 0);
    this.body.position.set(0, 0, 0);
  }

  // Places the body at (x, y, z) and animates from how far they moved
  // since last frame (facing, walk cycle, bob, or idle breathing) and, while
  // attacking, from how far through the blow they are (0..1).
  update(x: number, y: number, z: number, dt: number, attack: number | null = null): void {
    this.time += dt;
    const dx = Number.isNaN(this.last.x) ? 0 : x - this.last.x;
    const dz = Number.isNaN(this.last.x) ? 0 : z - this.last.z;
    this.last.set(x, y, z);
    this.root.position.set(x, y, z);

    const moved = Math.hypot(dx, dz);
    const walking = moved > 1e-4;
    if (walking) {
      // Turn toward the direction of travel along the shortest way round.
      const target = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += diff * Math.min(1, TURN_RATE * dt);
      this.phase += moved * STRIDE;
    }
    this.root.rotation.y = this.heading;
    this.swing += ((walking ? 1 : 0) - this.swing) * Math.min(1, 12 * dt);

    const s = Math.sin(this.phase) * this.swing;
    this.joints.leftLeg.rotation.x = s * LEG_SWING;
    this.joints.rightLeg.rotation.x = -s * LEG_SWING;
    this.joints.leftArm.rotation.x = -s * ARM_SWING;
    this.joints.rightArm.rotation.x = s * ARM_SWING;
    // A rise at each footfall while walking; a slow breath while idle.
    const breath = Math.sin(this.time * 2.2) * 0.004 * (1 - this.swing);
    this.body.position.y = Math.abs(Math.sin(this.phase)) * BOB * this.swing + breath;
    this.body.position.z = 0;
    this.body.rotation.y = 0;
    this.joints.head.rotation.x = breath * 4; // the head nods slightly with it

    if (attack !== null) {
      // Blend in over the first tenth and out over the last fifth, so the
      // blow picks up from (and hands back to) the walk without a snap.
      const w = Math.min(1, attack / 0.1, (1 - attack) / 0.2);
      const mix = (from: number, to: number) => from + (to - from) * w;
      const s = this.joints;
      s.rightArm.rotation.x = mix(s.rightArm.rotation.x, key(ATTACK.rightArm, attack));
      s.leftArm.rotation.x = mix(s.leftArm.rotation.x, key(ATTACK.leftArm, attack));
      s.leftLeg.rotation.x = mix(s.leftLeg.rotation.x, key(ATTACK.frontLeg, attack));
      s.rightLeg.rotation.x = mix(s.rightLeg.rotation.x, key(ATTACK.backLeg, attack));
      this.body.rotation.y = key(ATTACK.twist, attack) * w;
      this.body.position.y += key(ATTACK.dip, attack) * w;
      this.body.position.z = key(ATTACK.lunge, attack) * w;
    }
  }
}
