import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { greedyMesh, voxelIndex, type VoxelGrid } from '../src/view/meshes/voxel/greedyMesh';
import { buildBushGeometry } from '../src/view/meshes/bush/bushMesh';
import { buildBushVoxels, BUSH_PALETTE } from '../src/view/meshes/bush/bushVoxels';
import type { BushKind, TreeKind } from '../src/model/types';
import { buildTreeGeometry } from '../src/view/meshes/tree/treeMesh';

function grid(size: [number, number, number], voxels: Array<[number, number, number, number]>): VoxelGrid {
  const g: VoxelGrid = { size, cells: new Uint8Array(size[0] * size[1] * size[2]) };
  for (const [x, y, z, c] of voxels) g.cells[voxelIndex(g, x, y, z)] = c;
  return g;
}

const triangles = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;

describe('greedy mesher', () => {
  it('draws a single voxel as 6 faces', () => {
    expect(triangles(greedyMesh(grid([1, 1, 1], [[0, 0, 0, 1]]), [0x00ff00], 1, new THREE.Vector3()))).toBe(12);
  });

  it('merges a solid same-colored block down to 6 faces, with no interior faces', () => {
    const voxels: Array<[number, number, number, number]> = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) voxels.push([x, y, z, 1]);
    expect(triangles(greedyMesh(grid([3, 3, 3], voxels), [0x00ff00], 1, new THREE.Vector3()))).toBe(12);
  });

  it('keeps different colors as separate faces', () => {
    const mesh = greedyMesh(grid([2, 1, 1], [[0, 0, 0, 1], [1, 0, 0, 2]]), [0xff0000, 0x0000ff], 1, new THREE.Vector3());
    // Top, bottom, front, back each split in two (8 quads) plus the two end caps.
    expect(triangles(mesh)).toBe(20);
  });

  it('winds every face outward, matching its normal', () => {
    const voxels: Array<[number, number, number, number]> = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) voxels.push([x, y, z, 1]);
    const mesh = greedyMesh(grid([3, 3, 3], voxels), [0x00ff00], 1, new THREE.Vector3(-1.5, -1.5, -1.5));
    const p = mesh.getAttribute('position');
    const n = mesh.getAttribute('normal');
    for (let t = 0; t < p.count; t += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, t);
      const b = new THREE.Vector3().fromBufferAttribute(p, t + 1);
      const c = new THREE.Vector3().fromBufferAttribute(p, t + 2);
      const winding = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      expect(winding.dot(new THREE.Vector3().fromBufferAttribute(n, t))).toBeGreaterThan(0);
    }
  });
});

const KINDS: BushKind[] = ['leafy', 'berry', 'flowering'];
const models = KINDS.flatMap((kind) => [0, 1].map((shape) => [kind, shape] as const));

describe('bush voxel models', () => {
  it.each(models)('%s shape %i stays inside its tile and stands on the ground', (kind, shape) => {
    const geometry = buildBushGeometry(kind, shape);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    expect(Math.max(-min.x, max.x, -min.z, max.z)).toBeLessThanOrEqual(0.5);
    expect(min.y).toBeLessThanOrEqual(0); // no floating gap under it
    expect(max.y).toBeLessThan(0.45); // shorter than the hero
  });

  it.each(models)('%s shape %i uses only its own accent colors', (kind, shape) => {
    const used = new Set(buildBushVoxels(kind, shape).cells);
    const berry = BUSH_PALETTE.indexOf(0xc23b32) + 1;
    const blossoms = [BUSH_PALETTE.indexOf(0xf3eee2) + 1, BUSH_PALETTE.indexOf(0xea9bb8) + 1];
    expect(used.has(berry)).toBe(kind === 'berry');
    expect(blossoms.some((b) => used.has(b))).toBe(kind === 'flowering');
  });
});

const TREE_KINDS: TreeKind[] = ['oak', 'pine'];
const trees = TREE_KINDS.flatMap((kind) => [0, 1, 2].map((shape) => [kind, shape] as const));

describe('tree voxel models', () => {
  it.each(trees)('%s shape %i overhangs its tile only slightly and stands on the ground', (kind, shape) => {
    const geometry = buildTreeGeometry(kind, shape);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    // Canopies may spread a little past the tile (collision is trunk-only),
    // but not so far they'd bury a neighboring tile's contents.
    expect(Math.max(-min.x, max.x, -min.z, max.z)).toBeLessThanOrEqual(0.6);
    expect(min.y).toBeLessThanOrEqual(0);
    expect(max.y).toBeGreaterThan(0.9); // clearly taller than the 0.45 hero
  });

  it.each(trees)('%s shape %i stays within a sane triangle budget', (kind, shape) => {
    // ~400 trees per map; greedy meshing keeps each model a few thousand triangles at most.
    expect(buildTreeGeometry(kind, shape).getAttribute('position').count / 3).toBeLessThan(4000);
  });
});
