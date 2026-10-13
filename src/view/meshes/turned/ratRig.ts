// A rat someone's been turned into (model/spells/turned.ts), drawn where it is (quadruped.ts; ownParts.ts):
// scurrying, low (its feet going quick under it, in diagonal pairs; its tail trailed behind it, swung a little by
// its going); and stopped: its nose twitching, its tail drawn slowly to one side and the other, and now and then
// sat up on its haunches, its forefeet held up under its chin, to sniff the air.
import * as THREE from 'three';
import { smooth } from '../../cinema/easing';
import { CreatureRig } from '../common/creatureRig';
import { carried, hung, split, stood, tipped, type Turned } from './ownParts';
import { createQuadruped, type Quadruped } from './quadruped';
import { RAT_TAIL_END_JOINT, RAT_TAIL_JOINT, RAT_VOXEL_SIZE, isRatTail, isRatTailEnd, ratShape } from './ratVoxels';

const V = RAT_VOXEL_SIZE;
const TURN_RATE = 12;
const STEP = 70; // radians its feet go through per world unit scurried
const SIT_EVERY = 6.5; // seconds stopped, from one sitting up to the next
const SITTING = 2.4; // of those, sat up
const SIT_UP = 0.95; // radians its body's tipped up, sat
const HAUNCH: [number, number] = [0, -3.5]; // what it sits up about: the foot of its rump (ownParts.ts tipped)
const EASE = 9; // how fast it sits up, and comes down

export interface Rat {
  shape: Quadruped;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  tail: [near: THREE.Group, far: THREE.Group];
}

// The rat's parts, put together: its tail a part of its own in two lengths, the far one hung from the near. `coat`:
// which of its coats.
export function createRat(material: THREE.Material, coat = 0): Rat {
  const shape = ratShape(coat);
  const [body, tail] = split(shape.body(), isRatTail);
  const [near, far] = split(tail, isRatTailEnd);
  const made = createQuadruped(material, { ...shape, body: () => body });
  const parts: Rat['tail'] = [hung(material, shape, near, RAT_TAIL_JOINT, shape.pivots.body), hung(material, shape, far, RAT_TAIL_END_JOINT, RAT_TAIL_JOINT)];
  made.body.add(parts[0]);
  parts[0].add(parts[1]);
  return { ...made, shape, tail: parts };
}

// It sat up (`up`: 0 on all fours, 1 sat up on its haunches): its body tipped up about the foot of its rump, its
// forefeet carried up with it and held under its chin, its head brought back toward level, its tail left lying.
// `sniff`: how its nose is lifted besides (radians).
export function satUp(rat: Rat, up: number, sniff: number): void {
  const pitch = SIT_UP * up;
  tipped(rat.shape, rat.body, pitch, HAUNCH);
  for (const i of [2, 3]) carried(rat.shape, rat.body, rat.legs[i], i, 1.3 * up);
  rat.head.rotation.x = 0.7 * pitch - sniff;
  rat.tail[0].rotation.x = pitch;
}

export class RatRig extends CreatureRig {
  private readonly rat: Rat;
  private scurried = 0;
  private stopped = 0; // seconds since it last went anywhere
  private up = 0; // how far it's sat up, eased

  constructor(material: THREE.Material, coat = 0) {
    super(0);
    this.rat = createRat(material, coat);
    this.root.add(this.rat.root);
  }

  update(rat: Turned, dt: number): void {
    const { legs, tail, head, shape } = this.rat;
    const moved = this.follow({ x: rat.x, y: rat.y, z: rat.z, heading: rat.facing }, dt, TURN_RATE);
    const going = moved > 1e-5;
    this.scurried += moved;
    this.stopped = going ? 0 : this.stopped + dt;
    // Stopped a while: sat up, for the last of each while.
    const sitting = !going && this.stopped % SIT_EVERY > SIT_EVERY - SITTING;
    this.up += ((sitting ? 1 : 0) - this.up) * Math.min(1, EASE * dt);
    const up = smooth(this.up);
    // Its nose: twitching, stopped (the more, sat up); held still, going.
    satUp(this.rat, up, going ? 0 : Math.sin(this.time * 34) * 0.05 + 0.16 * up * Math.sin(this.time * 5));
    head.rotation.y = going ? 0 : Math.sin(this.time * 1.3) * 0.25 * (1 - up);
    this.rat.body.position.y += going ? Math.abs(Math.sin(this.scurried * STEP)) * V * 0.25 : 0;
    // Its feet: in diagonal pairs, each forward off the ground and back along it. (Sat up: its forefeet are held up.)
    for (const [i, leg] of legs.entries()) {
      if (i >= 2 && up > 0.001) continue;
      stood(shape, leg, i);
      if (!going) continue;
      const phase = this.scurried * STEP + (i === 0 || i === 3 ? 0 : Math.PI);
      leg.position.z += Math.sin(phase) * V * 0.9;
      leg.position.y += Math.max(0, Math.cos(phase)) * V * 0.6;
    }
    // Its tail: trailed, swung by its going, the end of it the more and after; stopped, drawn slowly from side to side.
    const sway = going ? Math.sin(this.scurried * STEP * 0.5) * 0.14 : Math.sin(this.time * 0.8) * 0.3;
    tail[0].rotation.y = sway;
    tail[1].rotation.y = going ? Math.sin(this.scurried * STEP * 0.5 - 1.1) * 0.3 : Math.sin(this.time * 0.8 - 0.9) * 0.5;
  }
}
