// Village well geometry in local space (origin on the ground at the well's
// center), merged per material. Sized for the 0.45-tall hero: the stone
// rim comes up to about its waist.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, beam, cylinder } from '../common/geometry';

export const WELL_PARTS = ['stoneLight', 'stoneDark', 'timber', 'wood', 'roof', 'water', 'rope', 'iron', 'glow'] as const;
export type WellPart = (typeof WELL_PARTS)[number];

const PLINTH_TOP = 0.11;
const COURSE_HEIGHT = 0.1;
const RING_RADIUS = 0.28; // center line of the stone ring
const BLOCKS_PER_COURSE = 10;
const RIM_TOP = PLINTH_TOP + 2 * COURSE_HEIGHT; // top of the stonework, under the capstones
const CAP_TOP = RIM_TOP + 0.04;

const POST_X = 0.3;
const POST_TOP = 0.86;
const AXLE_Y = 0.62;
const ROOF_BASE = POST_TOP + 0.025;
const ROOF_HEIGHT = 0.24;
const ROOF_SPAN = 0.62; // along Z
const ROOF_LENGTH = 0.82; // along X
const SHINGLE_ROWS = 3;

// Stone block tangent to the ring at `angle`: radial depth along the local
// X axis before rotating, so rotateY(-angle) points it outward.
function ringBlock(angle: number, y: number, radial: number, height: number, tangential: number, radius: number) {
  const g = new THREE.BoxGeometry(radial, height, tangential);
  g.rotateY(-angle);
  g.translate(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  return g.toNonIndexed();
}

// Two staggered courses of blocks (like brickwork) in alternating shades,
// topped with a ring of flat capstones that overhang slightly.
function stoneRing(): { light: THREE.BufferGeometry[]; dark: THREE.BufferGeometry[] } {
  const light: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const step = (Math.PI * 2) / BLOCKS_PER_COURSE;
  const blockLength = RING_RADIUS * step * 0.92; // leave thin mortar gaps

  for (let course = 0; course < 2; course++) {
    const y = PLINTH_TOP + COURSE_HEIGHT * (course + 0.5);
    const offset = course * (step / 2);
    for (let i = 0; i < BLOCKS_PER_COURSE; i++) {
      const block = ringBlock(i * step + offset, y, 0.1, COURSE_HEIGHT * 0.94, blockLength, RING_RADIUS);
      ((i + course) % 3 === 0 ? dark : light).push(block);
    }
  }
  for (let i = 0; i < BLOCKS_PER_COURSE; i++) {
    light.push(ringBlock(i * step + step / 4, RIM_TOP + 0.02, 0.14, 0.04, blockLength * 1.05, RING_RADIUS + 0.01));
  }
  return { light, dark };
}

// Gabled roof built from overlapping shingle rows on each slope, stepped
// outward so each row's lower edge shows, plus a ridge cap.
function shingledRoof(): THREE.BufferGeometry[] {
  const halfSpan = ROOF_SPAN / 2;
  const slope = Math.hypot(halfSpan, ROOF_HEIGHT);
  const pitch = Math.atan2(ROOF_HEIGHT, halfSpan);
  const rowLength = slope / SHINGLE_ROWS + 0.04;
  const thickness = 0.025;
  const parts: THREE.BufferGeometry[] = [];

  for (const side of [1, -1]) {
    for (let row = 0; row < SHINGLE_ROWS; row++) {
      // Distance of the row's center down the slope from the ridge; lower
      // rows sit a little further out so the rows overlap like shingles.
      const t = (row + 0.5) * (slope / SHINGLE_ROWS) + 0.02;
      const lift = thickness * (0.5 + row * 0.6);
      const z = side * ((halfSpan / slope) * t + (ROOF_HEIGHT / slope) * lift);
      const y = ROOF_BASE + ROOF_HEIGHT - (ROOF_HEIGHT / slope) * t + (halfSpan / slope) * lift;
      parts.push(box(ROOF_LENGTH, thickness, rowLength, 0, y, z, side * pitch));
    }
  }
  parts.push(box(ROOF_LENGTH + 0.02, 0.035, 0.07, 0, ROOF_BASE + ROOF_HEIGHT + 0.025, 0));
  return parts;
}

function timberFrame(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const postHeight = POST_TOP - CAP_TOP;

  for (const sx of [-1, 1]) {
    const x = sx * POST_X;
    parts.push(box(0.055, postHeight, 0.055, x, CAP_TOP + postHeight / 2, 0));
    // Knee braces from each post up to the gable-end tie beam, front and back.
    for (const sz of [-1, 1]) parts.push(beam(x, POST_TOP - 0.2, 0, x * 1.25, ROOF_BASE - 0.02, sz * 0.2, 0.03));
    // Rafters along the gable ends.
    for (const sz of [-1, 1]) {
      parts.push(beam(x * 1.25, ROOF_BASE, sz * (ROOF_SPAN / 2), x * 1.25, ROOF_BASE + ROOF_HEIGHT, 0, 0.035));
    }
  }
  parts.push(box(ROOF_LENGTH - 0.06, 0.045, 0.05, 0, POST_TOP, 0)); // top beam
  parts.push(box(0.05, 0.035, ROOF_SPAN, POST_X * 1.25, ROOF_BASE, 0), box(0.05, 0.035, ROOF_SPAN, -POST_X * 1.25, ROOF_BASE, 0));
  return parts;
}

function bucket(x: number, baseY: number, z: number, hanging: boolean) {
  const height = 0.09;
  const midY = baseY + height / 2;
  return {
    wood: [cylinder(0.06, 0.05, height, 8, x, midY, z)],
    iron: [
      cylinder(0.063, 0.063, 0.012, 8, x, baseY + height * 0.25, z),
      cylinder(0.063, 0.063, 0.012, 8, x, baseY + height * 0.8, z),
      // Handle: two short uprights and a bar across the top.
      box(0.008, 0.05, 0.008, x - 0.055, baseY + height + 0.02, z),
      box(0.008, 0.05, 0.008, x + 0.055, baseY + height + 0.02, z),
      box(0.118, 0.008, 0.008, x, baseY + height + 0.045, z),
    ],
    water: hanging ? [] : [cylinder(0.052, 0.052, 0.005, 8, x, baseY + height - 0.012, z)],
  };
}

export function buildWellParts(): Record<WellPart, THREE.BufferGeometry> {
  const ring = stoneRing();
  const hangingBucket = bucket(0, 0.4, 0, true);
  const spareBucket = bucket(0.3, PLINTH_TOP, 0.3, false); // resting on the plinth's top step

  const parts: Record<WellPart, THREE.BufferGeometry[]> = {
    stoneLight: [...ring.light, box(0.78, 0.05, 0.78, 0, PLINTH_TOP - 0.025, 0)],
    stoneDark: [...ring.dark, box(0.92, 0.07, 0.92, 0, 0.025, 0)], // bottom plinth step, sunk slightly
    timber: timberFrame(),
    wood: [...hangingBucket.wood, ...spareBucket.wood],
    roof: shingledRoof(),
    // Sits well below the rim so it reads as deep water inside the shaft.
    water: [cylinder(0.22, 0.22, 0.02, 12, 0, RIM_TOP - 0.07, 0), ...spareBucket.water],
    rope: [
      cylinder(0.05, 0.05, 0.16, 10, 0, AXLE_Y, 0, 'x'), // coil around the axle
      box(0.012, AXLE_Y - 0.05 - 0.54, 0.012, 0, (AXLE_Y - 0.05 + 0.54) / 2, 0), // down to the bucket
    ],
    iron: [
      ...hangingBucket.iron,
      ...spareBucket.iron,
      cylinder(0.03, 0.03, POST_X * 2 + 0.16, 8, 0, AXLE_Y, 0, 'x'), // axle, long enough to reach the crank
      box(0.025, 0.13, 0.025, POST_X + 0.07, AXLE_Y - 0.055, 0), // crank arm
      cylinder(0.014, 0.014, 0.07, 6, POST_X + 0.1, AXLE_Y - 0.11, 0, 'x'), // crank handle
      // Lantern bracket on the -X post, the lantern's base plate and cap.
      box(0.02, 0.02, 0.14, -POST_X, 0.74, -0.07),
      box(0.075, 0.015, 0.075, -POST_X, 0.64, -0.14),
      cylinder(0.0, 0.055, 0.05, 4, -POST_X, 0.72, -0.14),
    ],
    glow: [box(0.05, 0.07, 0.05, -POST_X, 0.68, -0.14)],
  };

  const merged = {} as Record<WellPart, THREE.BufferGeometry>;
  for (const part of WELL_PARTS) merged[part] = mergeGeometries(parts[part])!;
  return merged;
}
