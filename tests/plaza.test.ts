import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TEST_SEEDS, testModel } from './support/testWorld';
import { buildPlazas } from '../src/view/meshes/plaza/plazaMesh';
import { PLAZA_GRID, PLAZA_RADIUS, buildPlaza } from '../src/view/meshes/plaza/plazaVoxels';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';

describe('voxel village squares', () => {
  it.each(TEST_SEEDS.slice(0, 3))('seed %i: builds a square for every village', (seed) => {
    const model = testModel(seed);
    const scene = new THREE.Scene();
    buildPlazas(scene, model);
    expect(scene.children.length).toBe(model.villages.length);
  });

  it('paves only square tiles, curbs grass edges and leaves road entrances open', () => {
    // A lone square with a road entering from the -x side.
    const r = PLAZA_RADIUS;
    const grid = buildPlaza((dx, dz) => (Math.max(Math.abs(dx), Math.abs(dz)) <= r ? 'plaza' : dx === -r - 1 && dz === 0 ? 'path' : 'natural'), 1);
    const [size] = PLAZA_GRID;
    const column = (i: number, k: number) => [0, 1, 2, 3].filter((y) => colorAt(grid, i, y, k) !== 0).length;
    // Curb along the +x edge (grass) stands at least as high as the stones.
    let curb = 0;
    for (let k = 0; k < size; k++) if (column(size - 1, k) >= 3) curb++;
    expect(curb).toBeGreaterThan(size / 2);
    // No raised curb across the road entrance on the -x edge, middle tile.
    const middle = Math.floor(size / 2);
    for (let k = middle - 7; k < middle + 8; k++) expect(column(0, k)).toBeLessThanOrEqual(3);
  });
});
