import { describe, expect, it } from 'vitest';
import { buildLilyGeometry, buildReedGeometry, shoreDistances } from '../src/view/meshes/water/waterMesh';
import { LILY_VARIANTS, REED_VARIANTS } from '../src/view/meshes/water/waterVoxels';

describe('voxel water', () => {
  it('measures each lake tile’s Chebyshev distance to the nearest land', () => {
    const width = 32; // any size works: the distance field takes it from the map
    const lakeMap = Array.from({ length: width }, () => Array<boolean>(width).fill(false));
    for (let x = 10; x <= 16; x++) for (let z = 10; z <= 16; z++) lakeMap[x][z] = true; // a 7x7 lake
    const d = shoreDistances(lakeMap);
    const at = (x: number, z: number) => d[x + z * width];
    expect(at(0, 0)).toBe(0);
    expect(at(10, 10)).toBe(1);
    expect(at(11, 12)).toBe(2);
    expect(at(13, 13)).toBe(4);
  });

  it.each(Array.from({ length: LILY_VARIANTS }, (_, i) => i))('lily pad %i floats flat and small', (variant) => {
    const g = buildLilyGeometry(variant);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(0.37);
    expect(box.min.y).toBeLessThan(0); // sits in the surface, no gap
    expect(box.max.y).toBeLessThanOrEqual(0.1 + 1e-6); // pad plus bloom: 3 voxels
  });

  it.each(Array.from({ length: REED_VARIANTS }, (_, i) => i))('reed clump %i stands upright and fits its tile', (variant) => {
    const g = buildReedGeometry(variant);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(0.15);
    expect(box.max.y).toBeGreaterThan(0.2);
  });
});
