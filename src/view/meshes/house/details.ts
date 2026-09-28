// Small decorative house details: dressed windows, door hardware, a wall
// lantern, and props (barrel, firewood, hanging sign, cornerstones). All
// in house-local space: door on the -Z wall, ridge along X.

import type * as THREE from 'three';
import { box, cylinder, tint } from '../common/geometry';
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  FOUNDATION_HEIGHT,
  INSET,
  PANE,
  type PartBuckets,
  type Storey,
  type WindowSpot,
} from './houseTypes';

const FLOWER_COLORS = [0xc4413a, 0xe8c547, 0x8a5ab5, 0xf1eee4, 0xd9607a];
const LEAF_COLOR = 0x4d7a3a;
const PLANTER_COLOR = 0x6b4a2c;
const BARREL_COLOR = 0x7a5230;
const BARK_COLOR = 0x5c4330;
const END_GRAIN_COLOR = 0xd9b98a;
const SIGN_COLOR = 0x8a6238;
const QUOIN_COLOR = 0xb0aca2;
const SHUTTER_WIDTH = 0.055;

// Box mounted on the wall a window sits on: `along` runs along the wall,
// `up` is vertical, `out` points away from the wall.
function onWall(
  spot: WindowSpot,
  alongSize: number,
  height: number,
  outSize: number,
  along: number,
  up: number,
  out: number,
): THREE.BufferGeometry {
  if (spot.facing === 'z') {
    const sign = Math.sign(spot.z);
    return box(alongSize, height, outSize, spot.x + along, spot.y + up, spot.z + sign * out);
  }
  const sign = Math.sign(spot.x);
  return box(outSize, height, alongSize, spot.x + sign * out, spot.y + up, spot.z + along);
}

// Glowing pane divided into four by a timber cross, with a sill below and
// shutters either side. Windows on the front and back walls also get a
// planter of flowers.
export function windowDetails(spots: WindowSpot[]): Partial<PartBuckets> {
  const window: THREE.BufferGeometry[] = [];
  const timber: THREE.BufferGeometry[] = [];
  const door: THREE.BufferGeometry[] = [];
  const decor: THREE.BufferGeometry[] = [];
  const shutterOffset = PANE / 2 + SHUTTER_WIDTH / 2 + 0.01;

  for (const spot of spots) {
    window.push(onWall(spot, PANE, PANE, 0.03, 0, 0, 0));
    timber.push(onWall(spot, 0.014, PANE, 0.02, 0, 0, 0.012), onWall(spot, PANE, 0.014, 0.02, 0, 0, 0.012));
    timber.push(onWall(spot, PANE + 0.05, 0.018, 0.04, 0, -PANE / 2 - 0.009, 0.012));
    for (const side of [-1, 1]) door.push(onWall(spot, SHUTTER_WIDTH, PANE + 0.02, 0.02, side * shutterOffset, 0, 0.008));

    if (spot.facing === 'z') {
      const boxTop = -PANE / 2 - 0.018;
      decor.push(tint(onWall(spot, PANE + 0.04, 0.035, 0.045, 0, boxTop - 0.0175, 0.032), PLANTER_COLOR));
      decor.push(tint(onWall(spot, PANE + 0.03, 0.014, 0.035, 0, boxTop + 0.006, 0.032), LEAF_COLOR));
      FLOWER_COLORS.forEach((color, i) => {
        decor.push(tint(onWall(spot, 0.022, 0.022, 0.022, (i - 2) * 0.03, boxTop + 0.02, 0.032), color));
      });
    }
  }
  return { window, timber, door, decor };
}

// Plank door with iron strap hinges and a ring handle, a timber frame, and
// a glowing lantern on a bracket beside it.
export function doorDetails(doorX: number, halfDepth: number): Partial<PartBuckets> {
  const front = -halfDepth - INSET;
  const doorMid = FOUNDATION_HEIGHT + DOOR_HEIGHT / 2;
  const lanternX = doorX - DOOR_WIDTH / 2 - 0.085;
  const lanternY = FOUNDATION_HEIGHT + DOOR_HEIGHT - 0.03;

  return {
    door: [box(DOOR_WIDTH, DOOR_HEIGHT, 0.03, doorX, doorMid, front)],
    timber: [
      box(0.035, DOOR_HEIGHT + 0.03, 0.04, doorX - DOOR_WIDTH / 2 - 0.02, doorMid, front),
      box(0.035, DOOR_HEIGHT + 0.03, 0.04, doorX + DOOR_WIDTH / 2 + 0.02, doorMid, front),
      box(DOOR_WIDTH + 0.1, 0.045, 0.04, doorX, FOUNDATION_HEIGHT + DOOR_HEIGHT + 0.02, front),
    ],
    iron: [
      box(DOOR_WIDTH * 0.85, 0.014, 0.012, doorX, FOUNDATION_HEIGHT + DOOR_HEIGHT * 0.28, front - 0.018),
      box(DOOR_WIDTH * 0.85, 0.014, 0.012, doorX, FOUNDATION_HEIGHT + DOOR_HEIGHT * 0.72, front - 0.018),
      box(0.02, 0.02, 0.012, doorX + DOOR_WIDTH * 0.3, doorMid, front - 0.02), // ring handle
      box(0.012, 0.012, 0.07, lanternX, lanternY + 0.045, front - 0.035), // lantern bracket
      box(0.056, 0.014, 0.056, lanternX, lanternY + 0.034, front - 0.07), // lantern cap
      box(0.05, 0.01, 0.05, lanternX, lanternY - 0.032, front - 0.07), // lantern base
    ],
    window: [box(0.04, 0.055, 0.04, lanternX, lanternY, front - 0.07)], // lantern glow
  };
}

// Barrel by the door, firewood stacked against the back wall, and — on the
// townhouse — a shop sign hanging from an iron bracket. Everything stays
// inside the house's 1x1 cell.
export function props(v: { width: number; depth: number; twoStorey: boolean }, upper: Storey, doorX: number): Partial<PartBuckets> {
  const hw = v.width / 2;
  const hd = v.depth / 2;
  const decor: THREE.BufferGeometry[] = [];
  const iron: THREE.BufferGeometry[] = [];

  // Barrel: two tapered halves make the bulge; clear of the foundation and door step.
  const bx = doorX + DOOR_WIDTH / 2 + 0.12;
  const bz = -hd - 0.09;
  decor.push(tint(cylinder(0.047, 0.04, 0.05, 8, bx, 0.025, bz), BARREL_COLOR));
  decor.push(tint(cylinder(0.04, 0.047, 0.05, 8, bx, 0.075, bz), BARREL_COLOR));
  iron.push(cylinder(0.049, 0.049, 0.008, 8, bx, 0.02, bz), cylinder(0.049, 0.049, 0.008, 8, bx, 0.08, bz));

  // Firewood: two logs with one on top, lying along X behind the house.
  // Pale cut ends make them read as logs rather than planks or steps.
  const logX = hw - 0.17;
  const logLength = 0.22;
  const logRadius = 0.022;
  for (const [dz, y] of [
    [0.065, logRadius],
    [0.11, logRadius],
    [0.0875, logRadius * 2.7],
  ] as const) {
    decor.push(tint(cylinder(logRadius, logRadius, logLength, 10, logX, y, hd + dz, 'x'), BARK_COLOR));
    for (const end of [-1, 1]) {
      const endX = logX + end * (logLength / 2 + 0.002);
      decor.push(tint(cylinder(logRadius * 0.85, logRadius * 0.85, 0.005, 10, endX, y, hd + dz, 'x'), END_GRAIN_COLOR));
    }
  }

  if (v.twoStorey) {
    const signX = upper.width / 2 - 0.06;
    const wall = -upper.depth / 2;
    const signY = upper.bottom + 0.1;
    iron.push(box(0.012, 0.012, 0.12, signX, signY + 0.06, wall - 0.06));
    iron.push(box(0.006, 0.03, 0.006, signX, signY + 0.04, wall - 0.03), box(0.006, 0.03, 0.006, signX, signY + 0.04, wall - 0.09));
    decor.push(tint(box(0.015, 0.07, 0.1, signX, signY - 0.005, wall - 0.06), SIGN_COLOR));
  }

  return { decor, iron };
}

// Alternating long/short dressed stones up each corner of the stone ground floor.
export function quoins(ground: Storey): Partial<PartBuckets> {
  const decor: THREE.BufferGeometry[] = [];
  const hw = ground.width / 2;
  const hd = ground.depth / 2;
  const courseHeight = 0.08;
  const courses = Math.floor((ground.top - ground.bottom) / courseHeight);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < courses; i++) {
        const lenX = i % 2 === 0 ? 0.11 : 0.06;
        const lenZ = i % 2 === 0 ? 0.06 : 0.11;
        const y = ground.bottom + courseHeight * (i + 0.5);
        const x = sx * (hw - lenX / 2 + 0.008);
        const z = sz * (hd - lenZ / 2 + 0.008);
        decor.push(tint(box(lenX, courseHeight * 0.9, lenZ, x, y, z), QUOIN_COLOR));
      }
    }
  }
  return { decor };
}

