// Geometry invariants for the building models (voxel houses, the well).
// Buildings are instanced one per grid cell, so anything poking past the
// cell edge would clip into a neighbor.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildHouseGeometry } from '../src/view/meshes/house/houseMesh';
import { buildHouseVoxels, HOUSE_LAYOUTS } from '../src/view/meshes/house/houseVoxels';
import { C, ROOF_SETS } from '../src/view/meshes/house/housePalette';
import { voxelIndex } from '../src/view/meshes/voxel/greedyMesh';
import { buildWellParts, WELL_PARTS } from '../src/view/meshes/well/wellParts';

const CELL_HALF = 0.5;
const EPSILON = 1e-6;

function horizontalExtent(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  return Math.max(-min.x, max.x, -min.z, max.z);
}

const houseModels = HOUSE_LAYOUTS.flatMap((_, layout) => ROOF_SETS.map((__, roof) => [layout, roof] as const));

describe('voxel houses', () => {
  it.each(houseModels)('layout %i, roof %i: stays inside its tile and stands on the ground', (layout, roof) => {
    for (const glowing of [false, true]) {
      const geometry = buildHouseGeometry(layout, roof, glowing);
      expect(horizontalExtent(geometry)).toBeLessThanOrEqual(CELL_HALF + EPSILON);
      expect(geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(-EPSILON);
    }
  });

  it.each(houseModels)('layout %i, roof %i: glass is meshed only in the glowing mesh', (layout, roof) => {
    const main = buildHouseGeometry(layout, roof, false);
    const glow = buildHouseGeometry(layout, roof, true);
    expect(glow.getAttribute('position').count).toBeGreaterThan(0);
    // The glowing mesh holds only glass-colored faces; the main mesh none.
    // Baked ambient occlusion darkens corners, so a glass vertex is the glass
    // color scaled by some light level in (0, 1].
    const glass = new THREE.Color(0xffd98a);
    const isGlass = (g: THREE.BufferGeometry, i: number) => {
      const c = g.getAttribute('color');
      const k = c.getX(i) / glass.r;
      return k > 0 && k <= 1 + 1e-4 && Math.abs(c.getY(i) - glass.g * k) + Math.abs(c.getZ(i) - glass.b * k) < 1e-4;
    };
    for (let i = 0; i < glow.getAttribute('position').count; i++) expect(isGlass(glow, i)).toBe(true);
    for (let i = 0; i < main.getAttribute('position').count; i++) expect(isGlass(main, i)).toBe(false);
  });

  it.each(HOUSE_LAYOUTS.map((l, i) => [i, l] as const))('layout %i: its door is on the front (-Z) wall', (index, layout) => {
    const grid = buildHouseVoxels(layout, 0);
    const [sx, sy, sz] = grid.size;
    let doorZ = Infinity;
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) if (grid.cells[voxelIndex(grid, x, y, z)] === C.doorDark) doorZ = Math.min(doorZ, z);
      }
    }
    expect(doorZ, `layout ${index}`).toBeLessThan(sz / 2);
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
