// Shared house dimensions and types, used by the structural builder
// (parts.ts) and the small details (details.ts).

import type * as THREE from 'three';

// One merged geometry (and one draw call per variant) per material.
// 'decor' uses per-vertex colors, so every small multicolored detail —
// flowers, barrels, logs, signs — shares a single draw call.
export const HOUSE_PARTS = ['plaster', 'timber', 'stone', 'roof', 'door', 'window', 'iron', 'decor'] as const;
export type HousePart = (typeof HOUSE_PARTS)[number];
export type PartBuckets = Record<HousePart, THREE.BufferGeometry[]>;

export function emptyBuckets(): PartBuckets {
  return Object.fromEntries(HOUSE_PARTS.map((part) => [part, []])) as unknown as PartBuckets;
}

export function addTo(target: PartBuckets, source: Partial<PartBuckets>): void {
  for (const part of HOUSE_PARTS) {
    const geometries = source[part];
    if (geometries) target[part].push(...geometries);
  }
}

export const FOUNDATION_HEIGHT = 0.1;
export const BEAM = 0.05;
export const BRACE = 0.035;
export const PANE = 0.13;
export const INSET = 0.012; // how far wall-mounted details stand proud of the wall
export const DOOR_WIDTH = 0.19;
export const DOOR_HEIGHT = 0.3;

// A plaster-walled box the timber frame is wrapped around.
export interface Storey {
  width: number;
  depth: number;
  bottom: number;
  top: number;
}

export interface WindowSpot {
  x: number;
  y: number;
  z: number; // on the wall's outer face (already offset by INSET)
  facing: 'x' | 'z'; // axis of the wall's outward normal
}
