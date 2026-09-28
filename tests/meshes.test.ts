// Geometry invariants for the procedural building meshes. Buildings are
// instanced one per grid cell, so anything poking past the cell edge would
// clip into a neighbor.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildHouseParts } from '../src/view/meshes/house/parts';
import { HOUSE_PARTS } from '../src/view/meshes/house/houseTypes';
import { HOUSE_VARIANTS } from '../src/view/meshes/house/variants';
import { buildWellParts, WELL_PARTS } from '../src/view/meshes/well/wellParts';

const CELL_HALF = 0.5;
const EPSILON = 1e-6;

function horizontalExtent(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  return Math.max(-min.x, max.x, -min.z, max.z);
}

describe('house meshes', () => {
  it.each(HOUSE_VARIANTS.map((v, i) => [i, v] as const))('variant %i: everything but the roof overhang stays in its cell', (_, variant) => {
    const parts = buildHouseParts(variant);
    for (const part of HOUSE_PARTS) {
      // Roof shingles and the bargeboards (timber) along them overhang the walls by design.
      if (part === 'roof' || part === 'timber') continue;
      expect(horizontalExtent(parts[part]), part).toBeLessThanOrEqual(CELL_HALF + EPSILON);
    }
  });

  it.each(HOUSE_VARIANTS.map((v, i) => [i, v] as const))('variant %i: decor carries per-vertex colors', (_, variant) => {
    const decor = buildHouseParts(variant).decor;
    expect(decor.getAttribute('color')?.count).toBe(decor.getAttribute('position').count);
  });

  it.each(HOUSE_VARIANTS.map((v, i) => [i, v] as const))('variant %i: roof never sinks below the gable slope', (_, variant) => {
    const roof = buildHouseParts(variant).roof;
    const wallTop = 0.1 + variant.height;
    const ridgeY = wallTop + variant.roofHeight;
    const halfSpan = (variant.twoStorey ? variant.depth + 0.1 : variant.depth) / 2;
    const slope = Math.hypot(halfSpan, variant.roofHeight);
    const position = roof.getAttribute('position');

    for (let i = 0; i < position.count; i++) {
      const z = Math.abs(position.getZ(i));
      if (z > halfSpan) continue; // eave overhang, beyond the gable
      // Signed distance from the gable's sloped face (positive = outside it).
      const distance = z * (variant.roofHeight / slope) + (position.getY(i) - ridgeY) * (halfSpan / slope);
      expect(distance).toBeGreaterThanOrEqual(-EPSILON);
    }
  });
});

describe('well mesh', () => {
  it('stays inside its cell', () => {
    const parts = buildWellParts();
    for (const part of WELL_PARTS) {
      expect(horizontalExtent(parts[part]), part).toBeLessThanOrEqual(CELL_HALF + EPSILON);
    }
  });
});
