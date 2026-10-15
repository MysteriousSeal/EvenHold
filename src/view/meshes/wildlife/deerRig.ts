// One deer on screen, animated from its model state each frame:
// - it turns smoothly toward where it walks, and settles onto the ground's height;
// - walking, its legs stride in diagonal pairs; fleeing, it bounds, front
//   legs and hind legs together, its body rocking and rising with each leap;
// - grazing, its neck stretches forward and its head drops to the grass;
//   fleeing, or wary of the hero coming, its head comes up (wary, stock-still,
//   an ear-flick of a twitch now and then); resting, it glances slowly around;
// - at night it lies down, legs folded under it, its head up, nodding off.
// Stag, doe and fawn share one skeleton, drawn at their own sizes.

import * as THREE from 'three';
import type { DeerVariant, Wildlife } from '../../../model/wildlife/wildlife';
import { CreatureRig, partMesher, type Leg } from '../common/creatureRig';
import {
  BODY_PIVOT,
  DEER_VOXEL_SIZE,
  HEAD_PIVOT,
  LEGS_AT,
  LEG_LENGTH,
  LEG_PIVOT,
  NECK_AT,
  buildDeerBody,
  buildDeerHead,
  buildDeerLeg,
  deerPalette,
} from './deerVoxels';

const V = DEER_VOXEL_SIZE;
const SIZE: Record<DeerVariant, number> = { stag: 0.95, doe: 0.82, fawn: 0.5 };
const TURN_RATE = 8;
const STRIDE = 7; // walk-cycle radians per world unit walked (scaled by size: small legs step faster)
const WALK_SWING = 0.45;
const BOUND_SWING = 0.95;
const BOUND_SPEED = 1.4; // world units per second above which a deer bounds
const GRAZE_PITCH = 1.5; // neck forward, head down to the grass
const ALERT_PITCH = -0.15;
const Y_EASE = 12; // how fast it settles onto a new ground height

export interface DeerLook {
  material: THREE.Material;
  parts: Record<DeerVariant, { body: THREE.BufferGeometry; head: THREE.BufferGeometry; leg: THREE.BufferGeometry }>;
}

// Meshed parts and the material shared by every deer on screen.
export function createDeerLook(): DeerLook {
  const mesh = partMesher(V);
  const parts = {} as DeerLook['parts'];
  for (const variant of ['stag', 'doe', 'fawn'] as const) {
    const palette = deerPalette(variant);
    parts[variant] = {
      body: mesh(buildDeerBody(variant), palette, BODY_PIVOT),
      head: mesh(buildDeerHead(variant), palette, HEAD_PIVOT),
      leg: mesh(buildDeerLeg(), palette, LEG_PIVOT),
    };
  }
  return { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), parts };
}

export class DeerRig extends CreatureRig {
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: Leg[];
  private readonly size: number;
  private phase = 0;
  private swing = 0; // 0 standing .. 1 full stride, eased
  private bound = 0; // 0 walking .. 1 bounding, eased
  private pitch = 0;
  private lying = 0; // 0 stood .. 1 lying down, eased

  constructor(deer: Wildlife, look: DeerLook) {
    super(deer.id * 1.7); // so a herd doesn't glance about in step
    const variant = deer.variant as DeerVariant;
    const { body, head, leg } = look.parts[variant];
    this.size = SIZE[variant];
    this.root.scale.setScalar(this.size);
    this.body.position.y = LEG_LENGTH * V;
    this.body.add(new THREE.Mesh(body, look.material));
    this.head.position.set(NECK_AT[0] * V, NECK_AT[1] * V, NECK_AT[2] * V);
    this.head.add(new THREE.Mesh(head, look.material));
    this.body.add(this.head);
    this.root.add(this.body);
    this.legs = this.addLegs(leg, look.material, { side: LEGS_AT.side * V, front: LEGS_AT.front * V, back: LEGS_AT.back * V }, LEG_LENGTH * V);
  }

  update(deer: Wildlife, dt: number): void {
    // Turning and settling.
    const moved = this.follow(deer, dt, TURN_RATE, Y_EASE);
    const speed = dt > 0 ? moved / dt : 0;

    // Legs: a walk in diagonal pairs, or a bound with front and hind pairs together.
    const walking = moved > 1e-4;
    this.swing += ((walking ? 1 : 0) - this.swing) * Math.min(1, 10 * dt);
    this.bound += ((speed > BOUND_SPEED ? 1 : 0) - this.bound) * Math.min(1, 6 * dt);
    this.phase += (moved / this.size) * STRIDE * (1 - this.bound * 0.45);
    const s = Math.sin(this.phase) * this.swing;
    const amplitude = WALK_SWING + (BOUND_SWING - WALK_SWING) * this.bound;
    for (const { group, front, left } of this.legs) {
      const walkSide = front === left ? 1 : -1; // diagonal pairs
      const boundSide = front ? 1 : -1; // front pair against hind pair
      group.rotation.x = s * amplitude * (walkSide * (1 - this.bound) + boundSide * this.bound);
    }
    // Lying down for the night: down on its folded legs (front ones tucked forward, hind ones back).
    this.lying += ((deer.bedded ? 1 : 0) - this.lying) * Math.min(1, 1.5 * dt);
    if (this.lying > 0.001) for (const { group, front } of this.legs) group.rotation.x = (front ? -1.4 : 1.4) * this.lying;
    // Each leap lifts and rocks the body.
    this.body.position.y = LEG_LENGTH * V * (1 - this.lying * 0.8) + Math.abs(Math.sin(this.phase)) * 0.06 * this.bound * this.swing;
    for (const { group } of this.legs) group.position.y = LEG_LENGTH * V * (1 - this.lying * 0.8);
    this.body.rotation.x = Math.cos(this.phase) * 0.12 * this.bound * this.swing;

    // The head: down to graze, up when fleeing, glancing about at rest.
    const grazing = deer.dabble !== null && deer.dabble >= 0;
    const dozing = deer.bedded ? Math.max(0, Math.sin(this.time * 0.3)) * 0.5 : 0;
    const pitch = grazing ? GRAZE_PITCH : deer.fleeing || deer.wary ? ALERT_PITCH : dozing;
    this.pitch += (pitch - this.pitch) * Math.min(1, 4 * dt);
    this.head.rotation.x = this.pitch;
    const twitch = deer.wary && this.time % 2.7 < 0.15 ? 0.12 : 0;
    const glance = deer.wary ? twitch : !grazing && !deer.fleeing && !walking ? Math.sin(this.time * 0.6) * 0.45 : 0;
    this.head.rotation.y += (glance - this.head.rotation.y) * Math.min(1, 3 * dt);
  }
}
