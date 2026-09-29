// One cat on screen, animated from its model state each frame (cats.ts),
// easing between its poses so it settles rather than snaps:
// - walking, its legs step in diagonal pairs, its tail up with the tip curved;
// - sitting, its chest up on straight front legs, the hind ones folded under,
//   the tail curled round on the ground;
// - grooming, sitting with its head bobbing down to a raised front paw;
// - napping or loafing (on a bench too), low, legs tucked in, head down,
//   the tail wrapped round.

import * as THREE from 'three';
import type { CatVariant, Wildlife } from '../../../model/wildlife/wildlife';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import {
  BODY_PIVOT,
  CAT_VOXEL_SIZE,
  HEAD_AT,
  HEAD_PIVOT,
  LEGS_AT,
  LEG_LENGTH,
  LEG_PIVOT,
  TAIL_AT,
  TAIL_LENGTH,
  TAIL_PIVOT,
  buildCatBody,
  buildCatHead,
  buildCatLeg,
  buildCatTail,
  catPalette,
} from './catVoxels';

const V = CAT_VOXEL_SIZE;
const TURN_RATE = 9;
const STRIDE = 30; // walk-cycle radians per world unit walked
const SWING = 0.6;
const SIT_PITCH = 0.6; // the body tipped up, sitting
const EASE = 8; // how fast it moves into a pose
const Y_EASE = 12; // and onto a new ground height (or a bench)

export interface CatLook {
  material: THREE.Material;
  parts: Record<CatVariant, { body: THREE.BufferGeometry; head: THREE.BufferGeometry; leg: THREE.BufferGeometry; tail: THREE.BufferGeometry; tip: THREE.BufferGeometry }>;
}

// Meshed parts and the material shared by every cat on screen.
export function createCatLook(): CatLook {
  const mesh = (grid: VoxelGrid, palette: number[], pivot: [number, number, number]) =>
    greedyMesh(grid, palette, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V));
  const parts = {} as CatLook['parts'];
  for (const variant of ['ginger', 'tabby', 'black', 'white'] as const) {
    const palette = catPalette(variant);
    parts[variant] = {
      body: mesh(buildCatBody(variant), palette, BODY_PIVOT),
      head: mesh(buildCatHead(variant), palette, HEAD_PIVOT),
      leg: mesh(buildCatLeg(), palette, LEG_PIVOT),
      tail: mesh(buildCatTail(variant, false), palette, TAIL_PIVOT),
      tip: mesh(buildCatTail(variant, true), palette, TAIL_PIVOT),
    };
  }
  return { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), parts };
}

export class CatRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly tip = new THREE.Group();
  private readonly legs: { group: THREE.Group; front: boolean; left: boolean }[] = [];
  private heading: number | null = null;
  private y: number | null = null;
  private phase = 0;
  private swing = 0;
  private time: number;
  private readonly last = { x: Number.NaN, z: 0 };
  // The pose, eased: body height and tip, head tip, tail lift and curl, legs' reach.
  private readonly now = { bodyY: LEG_LENGTH * V, pitch: 0, head: 0, tail: -1.1, curl: 0, hind: 1, tuck: 1, paw: 0 };

  constructor(cat: Wildlife, look: CatLook) {
    const { body, head, leg, tail, tip } = look.parts[cat.variant as CatVariant];
    this.body.add(new THREE.Mesh(body, look.material));
    this.head.position.set(HEAD_AT[0] * V, HEAD_AT[1] * V, HEAD_AT[2] * V);
    this.head.add(new THREE.Mesh(head, look.material));
    this.tail.position.set(TAIL_AT[0] * V, TAIL_AT[1] * V, TAIL_AT[2] * V);
    this.tail.rotation.y = Math.PI; // out behind
    this.tail.add(new THREE.Mesh(tail, look.material));
    this.tip.position.z = TAIL_LENGTH * V;
    this.tip.add(new THREE.Mesh(tip, look.material));
    this.tail.add(this.tip);
    this.body.add(this.head, this.tail);
    this.root.add(this.body);
    for (const front of [true, false]) {
      for (const left of [true, false]) {
        const group = new THREE.Group();
        group.position.set((left ? LEGS_AT.side : -LEGS_AT.side) * V, LEG_LENGTH * V, (front ? LEGS_AT.front : LEGS_AT.back) * V);
        group.add(new THREE.Mesh(leg, look.material));
        this.root.add(group);
        this.legs.push({ group, front, left });
      }
    }
    this.time = cat.id * 1.3;
  }

  update(cat: Wildlife, dt: number): void {
    this.time += dt;
    const moved = Number.isNaN(this.last.x) ? 0 : Math.hypot(cat.x - this.last.x, cat.z - this.last.z);
    this.last.x = cat.x;
    this.last.z = cat.z;

    // Turning, and settling onto the ground (or up onto a bench).
    if (this.heading === null) this.heading = cat.heading;
    const diff = Math.atan2(Math.sin(cat.heading - this.heading), Math.cos(cat.heading - this.heading));
    this.heading += diff * Math.min(1, TURN_RATE * dt);
    this.y = this.y === null ? cat.y : this.y + (cat.y - this.y) * Math.min(1, Y_EASE * dt);
    this.root.position.set(cat.x, this.y, cat.z);
    this.root.rotation.y = this.heading;

    // What the pose wants, eased into.
    const walking = moved > 1e-4;
    const sitting = !walking && (cat.pose === 'sit' || cat.pose === 'groom');
    const lying = !walking && (cat.pose === 'nap' || cat.pose === 'loaf');
    const grooming = sitting && cat.pose === 'groom';
    const want = {
      bodyY: sitting ? 2 * V : lying ? 0.4 * V : LEG_LENGTH * V,
      pitch: sitting ? -SIT_PITCH : 0,
      head: sitting ? SIT_PITCH + (grooming ? 0.75 + Math.sin(this.time * 7) * 0.15 : 0) : lying ? 0.4 : 0,
      tail: sitting ? 1.25 : lying ? 1.4 : -1.1,
      curl: sitting ? 1.3 : lying ? 1.7 : -0.5,
      hind: sitting ? 0.3 : 1, // folded under, sitting
      tuck: lying ? 0.15 : 1, // tucked in, lying
      paw: grooming ? -1.3 : 0, // a front paw up to the mouth
    };
    const k = Math.min(1, EASE * dt);
    for (const key of Object.keys(want) as Array<keyof typeof want>) this.now[key] += (want[key] - this.now[key]) * k;
    const now = this.now;
    this.body.position.y = now.bodyY;
    this.body.rotation.x = now.pitch;
    this.head.rotation.x = now.head;
    this.tail.rotation.x = now.tail;
    this.tip.rotation.y = now.curl;
    this.tip.rotation.x = walking ? -0.4 : 0;

    // Legs: stepping in diagonal pairs; sitting, the front ones reach down
    // from the raised chest and the hind ones fold; lying, all tucked in.
    this.swing += ((walking ? 1 : 0) - this.swing) * Math.min(1, 10 * dt);
    this.phase += moved * STRIDE;
    const s = Math.sin(this.phase) * this.swing;
    const chest = now.bodyY + LEGS_AT.front * V * Math.sin(-now.pitch); // how high the chest is, tipped up
    for (const { group, front, left } of this.legs) {
      const reach = front ? chest / (LEG_LENGTH * V) : now.hind;
      group.scale.y = Math.max(0.05, reach * now.tuck);
      group.position.y = LEG_LENGTH * V * group.scale.y;
      group.rotation.x = s * SWING * (front === left ? 1 : -1) + (front && left ? now.paw : 0);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
