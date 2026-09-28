// Builds one medieval house variant's geometry in house-local space (origin
// at the ground under the house's center, door facing -Z), merged per
// material so each material is a single draw call per variant when instanced.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HouseVariant } from './variants';
import { box, beam as beamBetween, nonIndexed } from '../geometry';

export const HOUSE_PARTS = ['plaster', 'timber', 'stone', 'roof', 'door', 'window'] as const;
export type HousePart = (typeof HOUSE_PARTS)[number];

const FOUNDATION_HEIGHT = 0.1;
const OVERHANG = 0.08;
const ROOF_THICKNESS = 0.05;
const BEAM = 0.05;
const BRACE = 0.035;
const PANE = 0.13;
const SHUTTER_WIDTH = 0.055;
const INSET = 0.012; // how far wall-mounted details stand proud of the wall
const JETTY = 0.05; // how far a two-storey house's upper floor overhangs its stone ground floor
const DOOR_WIDTH = 0.19;
const DOOR_HEIGHT = 0.3;

type Wall = 'front' | 'back' | 'left' | 'right';

// A plaster-walled box the timber frame is wrapped around.
interface Storey {
  width: number;
  depth: number;
  bottom: number;
  top: number;
}

interface WindowSpot {
  x: number;
  y: number;
  z: number;
  facing: 'x' | 'z'; // axis of the wall's outward normal
}

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

// Two thick panels meeting at the ridge, each tilted to the gable's pitch
// and extended past the eaves by OVERHANG, plus a cap to hide the seam.
function roofPanels(width: number, depth: number, roofHeight: number, wallTop: number): THREE.BufferGeometry[] {
  const halfSpan = depth / 2;
  const slope = Math.hypot(halfSpan, roofHeight);
  const pitch = Math.atan2(roofHeight, halfSpan);
  const panelLength = slope + OVERHANG;
  const panelWidth = width + 2 * OVERHANG;
  const ridgeY = wallTop + roofHeight;

  const panels = [1, -1].map((side) => {
    // Midpoint of the panel along the slope, pushed outward by half its
    // thickness so its underside rests on the gable's sloped face.
    const t = panelLength / 2;
    const z = side * (halfSpan / slope) * t + side * (roofHeight / slope) * (ROOF_THICKNESS / 2);
    const y = ridgeY - (roofHeight / slope) * t + (halfSpan / slope) * (ROOF_THICKNESS / 2);
    return box(panelWidth, ROOF_THICKNESS, panelLength, 0, y, z, side * pitch);
  });

  const ridgeCap = box(panelWidth, 0.045, 0.1, 0, ridgeY + ROOF_THICKNESS * 0.8, 0);
  return [...panels, ridgeCap];
}

// Corner posts, sill and head beams around the storey, plus a pair of
// diagonal braces on each braced wall rising from the bottom corners
// toward the middle — the classic medieval half-timbered pattern — while
// leaving the wall's center clear for its window.
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
      parts.push(beamBetween(-hw + BEAM / 2, lo, z, -0.12, hi, z, BRACE), beamBetween(hw - BEAM / 2, lo, z, 0.12, hi, z, BRACE));
    } else {
      const x = wall === 'left' ? -hw : hw;
      parts.push(beamBetween(x, lo, -hd + BEAM / 2, x, hi, -0.12, BRACE), beamBetween(x, lo, hd - BEAM / 2, x, hi, 0.12, BRACE));
    }
  }
  return parts;
}

// Glowing panes plus a wooden shutter on each side.
function windows(spots: WindowSpot[]): { panes: THREE.BufferGeometry[]; shutters: THREE.BufferGeometry[] } {
  const panes: THREE.BufferGeometry[] = [];
  const shutters: THREE.BufferGeometry[] = [];
  const shutterOffset = PANE / 2 + SHUTTER_WIDTH / 2 + 0.01;

  for (const { x, y, z, facing } of spots) {
    if (facing === 'z') {
      const out = Math.sign(z) * 0.008;
      panes.push(box(PANE, PANE, 0.03, x, y, z));
      for (const side of [-1, 1]) shutters.push(box(SHUTTER_WIDTH, PANE + 0.02, 0.02, x + side * shutterOffset, y, z + out));
    } else {
      const out = Math.sign(x) * 0.008;
      panes.push(box(0.03, PANE, PANE, x, y, z));
      for (const side of [-1, 1]) shutters.push(box(0.02, PANE + 0.02, SHUTTER_WIDTH, x + out, y, z + side * shutterOffset));
    }
  }
  return { panes, shutters };
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
  const { panes, shutters } = windows(windowSpots);
  const bracedWalls: Wall[] = v.twoStorey ? ['front', 'back', 'left', 'right'] : ['back', 'left', 'right'];

  // Chimney pokes through the back (+Z) slope near one gable end.
  const chimneyX = upper.width / 2 - 0.15;
  const chimneyZ = upper.depth / 4;
  const chimneyBottom = wallTop + v.roofHeight / 2 - 0.05;
  const chimneyTop = wallTop + v.roofHeight + 0.14;

  const doorFrontZ = -hd - INSET;
  const parts: Record<HousePart, THREE.BufferGeometry[]> = {
    plaster: [
      box(upper.width, upper.top - upper.bottom, upper.depth, 0, (upper.top + upper.bottom) / 2, 0),
      gable(upper.depth, v.roofHeight, upper.width, wallTop),
    ],
    timber: [
      ...timberFrame(upper, bracedWalls),
      // Door frame: two jambs and a lintel.
      box(0.035, DOOR_HEIGHT + 0.03, 0.04, doorX - DOOR_WIDTH / 2 - 0.02, FOUNDATION_HEIGHT + DOOR_HEIGHT / 2, doorFrontZ),
      box(0.035, DOOR_HEIGHT + 0.03, 0.04, doorX + DOOR_WIDTH / 2 + 0.02, FOUNDATION_HEIGHT + DOOR_HEIGHT / 2, doorFrontZ),
      box(DOOR_WIDTH + 0.1, 0.045, 0.04, doorX, FOUNDATION_HEIGHT + DOOR_HEIGHT + 0.02, doorFrontZ),
    ],
    stone: [
      // Sunk slightly into the ground so no gap shows on the tile edge.
      box(v.width + 0.08, FOUNDATION_HEIGHT + 0.03, v.depth + 0.08, 0, (FOUNDATION_HEIGHT - 0.03) / 2, 0),
      ...(v.twoStorey ? [box(ground.width, ground.top - ground.bottom, ground.depth, 0, (ground.top + ground.bottom) / 2, 0)] : []),
      box(0.13, chimneyTop - chimneyBottom, 0.13, chimneyX, (chimneyTop + chimneyBottom) / 2, chimneyZ),
      box(0.17, 0.04, 0.17, chimneyX, chimneyTop + 0.02, chimneyZ),
      box(0.3, 0.07, 0.1, doorX, 0.035, -hd - 0.08), // door step
    ],
    roof: roofPanels(upper.width, upper.depth, v.roofHeight, wallTop),
    door: [box(DOOR_WIDTH, DOOR_HEIGHT, 0.03, doorX, FOUNDATION_HEIGHT + DOOR_HEIGHT / 2, doorFrontZ), ...shutters],
    window: panes,
  };

  const merged = {} as Record<HousePart, THREE.BufferGeometry>;
  for (const part of HOUSE_PARTS) {
    merged[part] = mergeGeometries(parts[part])!;
  }
  return merged;
}
