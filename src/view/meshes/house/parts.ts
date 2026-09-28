// Builds one medieval house variant's geometry in house-local space (origin
// at the ground under the house's center, door facing -Z, ridge along X),
// merged per material so each material is a single draw call per variant
// when instanced. Structure lives here; small details live in details.ts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HouseVariant } from './variants';
import { box, beam, cylinder, nonIndexed, tint } from '../geometry';
import {
  BEAM,
  BRACE,
  FOUNDATION_HEIGHT,
  HOUSE_PARTS,
  INSET,
  addTo,
  emptyBuckets,
  type HousePart,
  type PartBuckets,
  type Storey,
  type WindowSpot,
} from './houseTypes';
import { doorDetails, props, quoins, windowDetails } from './details';

const OVERHANG = 0.08;
const SHINGLE_ROWS = 4;
const SHINGLE_THICKNESS = 0.03;
const JETTY = 0.05; // how far a two-storey house's upper floor overhangs its stone ground floor
const CHIMNEY_POT_COLOR = 0xa0522d;

type Wall = 'front' | 'back' | 'left' | 'right';

// Triangular prism filling the attic under the roof: triangle in the YZ
// plane (base = depth, apex up), running along X. Built by hand rather than
// with ExtrudeGeometry, which pulls three.js's whole shape-triangulation
// code into the bundle for a single triangle. The bottom face is omitted —
// it sits on the wall top and is never visible.
function gable(depth: number, height: number, length: number, baseY: number): THREE.BufferGeometry {
  const hx = length / 2;
  const hz = depth / 2;
  const top = baseY + height;
  // prettier-ignore
  const positions = new Float32Array([
    // +X end, -X end
     hx, baseY, -hz,   hx, top, 0,       hx, baseY, hz,
    -hx, baseY, -hz,  -hx, baseY, hz,   -hx, top, 0,
    // +Z slope
    -hx, baseY, hz,    hx, baseY, hz,    hx, top, 0,
    -hx, baseY, hz,    hx, top, 0,      -hx, top, 0,
    // -Z slope
     hx, baseY, -hz,  -hx, baseY, -hz,  -hx, top, 0,
     hx, baseY, -hz,  -hx, top, 0,       hx, top, 0,
  ]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // mergeGeometries requires the same attributes as the BoxGeometry parts.
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  g.computeVertexNormals();
  return nonIndexed(g);
}

// Each slope is built from overlapping shingle rows, each lower row lifted
// a little further off the gable so its bottom edge shows, extending past
// the eaves by OVERHANG. A ridge cap hides the seam, and timber
// bargeboards trim both gable edges.
function shingledRoof(width: number, depth: number, roofHeight: number, wallTop: number): Partial<PartBuckets> {
  const halfSpan = depth / 2;
  const slope = Math.hypot(halfSpan, roofHeight);
  const pitch = Math.atan2(roofHeight, halfSpan);
  const along = slope + OVERHANG; // ridge to eave, down the slope
  const rowLength = along / SHINGLE_ROWS + 0.03;
  const panelWidth = width + 2 * OVERHANG;
  const ridgeY = wallTop + roofHeight;
  const down = { z: halfSpan / slope, y: -roofHeight / slope }; // unit step down the +Z slope
  const outward = { z: roofHeight / slope, y: halfSpan / slope }; // unit normal of the +Z slope

  const roof: THREE.BufferGeometry[] = [];
  const timber: THREE.BufferGeometry[] = [];

  for (const side of [1, -1]) {
    for (let row = 0; row < SHINGLE_ROWS; row++) {
      const t = (row + 0.5) * (along / SHINGLE_ROWS);
      const lift = SHINGLE_THICKNESS * (0.5 + row * 0.5);
      const z = side * (down.z * t + outward.z * lift);
      const y = ridgeY + down.y * t + outward.y * lift;
      roof.push(box(panelWidth, SHINGLE_THICKNESS, rowLength, 0, y, z, side * pitch));
    }

    const lift = SHINGLE_THICKNESS * 2.2;
    for (const sx of [-1, 1]) {
      const x = sx * (panelWidth / 2);
      timber.push(
        beam(
          x,
          ridgeY + outward.y * lift,
          side * outward.z * lift,
          x,
          ridgeY + down.y * along + outward.y * lift,
          side * (down.z * along + outward.z * lift),
          0.04,
        ),
      );
    }
  }

  roof.push(box(panelWidth + 0.02, 0.05, 0.11, 0, ridgeY + SHINGLE_THICKNESS * 1.1, 0));
  return { roof, timber };
}

// Corner posts, sill and head beams around the storey, plus a pair of
// diagonal braces on each braced wall rising from the bottom corners
// toward the middle — the classic half-timbered pattern — while leaving
// the wall's center clear for its window.
function timberFrame(s: Storey, bracedWalls: Wall[]): THREE.BufferGeometry[] {
  const hw = s.width / 2;
  const hd = s.depth / 2;
  const mid = (s.top + s.bottom) / 2;
  const parts: THREE.BufferGeometry[] = [];

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(box(BEAM, s.top - s.bottom, BEAM, sx * hw, mid, sz * hd));
  }
  for (const y of [s.top - BEAM / 2, s.bottom + BEAM / 2]) {
    parts.push(box(s.width + BEAM, BEAM, BEAM, 0, y, -hd));
    parts.push(box(s.width + BEAM, BEAM, BEAM, 0, y, hd));
    parts.push(box(BEAM, BEAM, s.depth + BEAM, -hw, y, 0));
    parts.push(box(BEAM, BEAM, s.depth + BEAM, hw, y, 0));
  }

  const lo = s.bottom + BEAM;
  const hi = s.top - BEAM;
  for (const wall of bracedWalls) {
    if (wall === 'front' || wall === 'back') {
      const z = wall === 'front' ? -hd : hd;
      parts.push(beam(-hw + BEAM / 2, lo, z, -0.12, hi, z, BRACE), beam(hw - BEAM / 2, lo, z, 0.12, hi, z, BRACE));
    } else {
      const x = wall === 'left' ? -hw : hw;
      parts.push(beam(x, lo, -hd + BEAM / 2, x, hi, -0.12, BRACE), beam(x, lo, hd - BEAM / 2, x, hi, 0.12, BRACE));
    }
  }
  return parts;
}

// King post and two raking struts on each plaster gable triangle.
function gableTimbering(s: Storey, roofHeight: number): THREE.BufferGeometry[] {
  const hd = s.depth / 2;
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * (s.width / 2 + 0.006);
    parts.push(beam(x, s.top, 0, x, s.top + roofHeight * 0.85, 0, BRACE));
    for (const sz of [-1, 1]) parts.push(beam(x, s.top + 0.02, sz * hd * 0.72, x, s.top + roofHeight * 0.48, 0, BRACE));
  }
  return parts;
}

// Four windows around a storey at height y (front one optional, since the
// ground floor of a single-storey house has the door there).
function windowRing(s: Storey, y: number, front: number | null): WindowSpot[] {
  const hw = s.width / 2 + INSET;
  const hd = s.depth / 2 + INSET;
  const spots: WindowSpot[] = [
    { x: 0, y, z: hd, facing: 'z' },
    { x: -hw, y, z: 0, facing: 'x' },
    { x: hw, y, z: 0, facing: 'x' },
  ];
  if (front !== null) spots.push({ x: front, y, z: -hd, facing: 'z' });
  return spots;
}

export function buildHouseParts(v: HouseVariant): Record<HousePart, THREE.BufferGeometry> {
  const wallTop = FOUNDATION_HEIGHT + v.height;
  const hd = v.depth / 2;
  const doorX = v.twoStorey ? 0 : -v.width * 0.2;

  // Two-storey houses get a stone ground floor with a jettied (slightly
  // wider) half-timbered upper floor on top; single-storey houses are
  // half-timbered all the way down to the foundation.
  const ground: Storey = { width: v.width, depth: v.depth, bottom: FOUNDATION_HEIGHT, top: FOUNDATION_HEIGHT + v.height / 2 };
  const upper: Storey = v.twoStorey
    ? { width: v.width + 2 * JETTY, depth: v.depth + 2 * JETTY, bottom: ground.top, top: wallTop }
    : { width: v.width, depth: v.depth, bottom: FOUNDATION_HEIGHT, top: wallTop };

  const windowSpots = v.twoStorey
    ? [
        ...windowRing(ground, FOUNDATION_HEIGHT + v.height * 0.25, null),
        ...windowRing(upper, FOUNDATION_HEIGHT + v.height * 0.75, 0),
      ]
    : windowRing(upper, FOUNDATION_HEIGHT + v.height * 0.55, v.width * 0.22);
  const bracedWalls: Wall[] = v.twoStorey ? ['front', 'back', 'left', 'right'] : ['back', 'left', 'right'];

  // Chimney pokes through the back (+Z) slope near one gable end.
  const chimneyX = upper.width / 2 - 0.15;
  const chimneyZ = upper.depth / 4;
  const chimneyBottom = wallTop + v.roofHeight / 2 - 0.05;
  const chimneyTop = wallTop + v.roofHeight + 0.14;

  const buckets = emptyBuckets();
  buckets.plaster.push(
    box(upper.width, upper.top - upper.bottom, upper.depth, 0, (upper.top + upper.bottom) / 2, 0),
    gable(upper.depth, v.roofHeight, upper.width, wallTop),
  );
  buckets.timber.push(...timberFrame(upper, bracedWalls), ...gableTimbering(upper, v.roofHeight));
  buckets.stone.push(
    // Sunk slightly into the ground so no gap shows on the tile edge.
    box(v.width + 0.08, FOUNDATION_HEIGHT + 0.03, v.depth + 0.08, 0, (FOUNDATION_HEIGHT - 0.03) / 2, 0),
    box(0.13, chimneyTop - chimneyBottom, 0.13, chimneyX, (chimneyTop + chimneyBottom) / 2, chimneyZ),
    box(0.155, 0.03, 0.155, chimneyX, chimneyTop - 0.07, chimneyZ), // band
    box(0.17, 0.04, 0.17, chimneyX, chimneyTop + 0.02, chimneyZ), // cap
    box(0.3, 0.07, 0.1, doorX, 0.035, -hd - 0.08), // door step
  );
  buckets.decor.push(tint(cylinder(0.028, 0.034, 0.06, 8, chimneyX, chimneyTop + 0.07, chimneyZ), CHIMNEY_POT_COLOR));
  if (v.twoStorey) {
    buckets.stone.push(box(ground.width, ground.top - ground.bottom, ground.depth, 0, (ground.top + ground.bottom) / 2, 0));
    addTo(buckets, quoins(ground));
  }

  addTo(buckets, shingledRoof(upper.width, upper.depth, v.roofHeight, wallTop));
  addTo(buckets, windowDetails(windowSpots));
  addTo(buckets, doorDetails(doorX, hd));
  addTo(buckets, props(v, upper, doorX));

  const merged = {} as Record<HousePart, THREE.BufferGeometry>;
  for (const part of HOUSE_PARTS) merged[part] = mergeGeometries(buckets[part])!;
  return merged;
}
