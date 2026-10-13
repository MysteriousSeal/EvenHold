// A cat someone's been turned into (model/spells/turned.ts), drawn where it is (quadruped.ts; ownParts.ts): walking
// (its legs in diagonal pairs, its tail carried up, the tip swaying); and, stopped, soon sat down for as long as
// it's left to: its rump on the ground, its hind legs folded forward under it, its chest up on its straight
// forelegs (those reaching a little, as the village cats' do: wildlife/catRig.ts), its tail laid down and curled round beside it, the tip of it flicking; now and then a forepaw lifted
// and washed, its head down to it.
import * as THREE from 'three';
import { bell, smooth, through } from '../../cinema/easing';
import { CreatureRig } from '../common/creatureRig';
import { carried, hung, split, stood, tipped, type Turned } from './ownParts';
import { createQuadruped, type Quadruped } from './quadruped';
import { CAT_TAIL_END_JOINT, CAT_TAIL_JOINT, TURNED_CAT_VOXEL_SIZE, isCatTail, isCatTailEnd, turnedCatShape } from './turnedCatVoxels';

const V = TURNED_CAT_VOXEL_SIZE;
const TURN_RATE = 8;
const STRIDE = 30; // leg-swing radians per world unit walked
const SWING = 0.55;
const STANDS = 0.7; // seconds stopped before it sits
const SIT = 0.6; // radians its body's tipped up, sat
const HAUNCH: [number, number] = [0, -2]; // what it's tipped about: its hips (ownParts.ts tipped)
const DOWN = V * 1.9; // how far those are let down, sat
const WASH_EVERY = 8; // seconds sat, from one wash to the next
const WASHING = 2.8; // of those, washing
const EASE = 6; // how fast it sits, and gets up

export interface TurnedCat {
  shape: Quadruped;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  tail: [near: THREE.Group, far: THREE.Group];
}

// The cat's parts, put together: its tail a part of its own in two lengths, the upper hung from the lower. `coat`:
// which of its coats.
export function createTurnedCat(material: THREE.Material, coat = 0): TurnedCat {
  const shape = turnedCatShape(coat);
  const [body, tail] = split(shape.body(), isCatTail);
  const [near, far] = split(tail, isCatTailEnd);
  const made = createQuadruped(material, { ...shape, body: () => body });
  const parts: TurnedCat['tail'] = [hung(material, shape, near, CAT_TAIL_JOINT, shape.pivots.body), hung(material, shape, far, CAT_TAIL_END_JOINT, CAT_TAIL_JOINT)];
  made.body.add(parts[0]);
  parts[0].add(parts[1]);
  return { ...made, shape, tail: parts };
}

// It sat (`sat`: 0 stood, 1 sat down), and washing (`wash`: 0 not, 1 its paw at its mouth): its body tipped up about
// its haunches and let down till its rump's on the ground; its hind legs carried down with it and folded forward
// along the ground; its forelegs drawn back under its chest, straight, reaching up to its shoulders; its head kept
// level; its tail down behind it and curled round to its side, the tip flicking (`time`). Washing: its off forepaw
// lifted before its chest, its head down to it, going at it.
export function seated(cat: TurnedCat, sat: number, wash: number, time: number): void {
  const { shape, body, legs, head, tail } = cat;
  const pitch = SIT * sat;
  tipped(shape, body, pitch, HAUNCH);
  body.position.y -= DOWN * sat;
  for (const i of [0, 1]) carried(shape, body, legs[i], i, pitch - 1.5 * sat);
  for (const i of [2, 3]) {
    carried(shape, body, legs[i], i, pitch);
    legs[i].scale.y = legs[i].position.y / (shape.legHeight * V);
  }
  const lick = Math.sin(time * 9) * 0.1 * wash;
  head.rotation.set(pitch + (0.45 + lick) * wash, 0, -0.12 * wash);
  legs[3].rotation.set((-1.75 + lick * 1.5) * wash, 0, 0.3 * wash);
  tail[0].rotation.set(pitch - 2.3 * sat, 0, 1.0 * sat);
  tail[1].rotation.set(0.75 * sat, 0, (1.1 + Math.sin(time * 2.6) * 0.3) * sat);
}

export class TurnedCatRig extends CreatureRig {
  private readonly cat: TurnedCat;
  private walked = 0;
  private stopped = 0; // seconds since it last went anywhere
  private sat = 0; // how far it's sat down, eased

  constructor(material: THREE.Material, coat = 0) {
    super(0);
    this.cat = createTurnedCat(material, coat);
    this.root.add(this.cat.root);
  }

  update(cat: Turned, dt: number): void {
    const { legs, tail, head, shape } = this.cat;
    const moved = this.follow({ x: cat.x, y: cat.y, z: cat.z, heading: cat.facing }, dt, TURN_RATE);
    const walking = moved > 1e-5;
    this.walked += moved;
    this.stopped = walking ? 0 : this.stopped + dt;
    // Stopped: stood a moment, then sat; sat a while, a wash, and again.
    this.sat += ((this.stopped > STANDS ? 1 : 0) - this.sat) * Math.min(1, EASE * dt);
    const sat = smooth(this.sat);
    const since = Math.max(0, this.stopped - STANDS) % WASH_EVERY;
    const wash = sat > 0.95 ? smooth(Math.min(1, bell(through(since, [WASH_EVERY - WASHING, WASH_EVERY])) * 3)) : 0;
    for (const [i, leg] of legs.entries()) stood(shape, leg, i);
    seated(this.cat, sat, wash, this.time);
    // Walking: its legs in diagonal pairs, its head nodding a little; its tail up, the tip of it swaying.
    const swing = walking ? Math.sin(this.walked * STRIDE) : 0;
    for (const [i, leg] of legs.entries()) leg.rotation.x += (i === 0 || i === 3 ? swing : -swing) * SWING * (1 - sat);
    this.cat.body.position.y += walking ? Math.abs(swing) * V * 0.2 : 0;
    head.rotation.x += swing * 0.05;
    tail[0].rotation.x += -0.2 * (1 - sat);
    tail[1].rotation.x += (-0.35 + (walking ? swing * 0.15 : Math.sin(this.time * 1.7) * 0.12)) * (1 - sat);
  }
}
