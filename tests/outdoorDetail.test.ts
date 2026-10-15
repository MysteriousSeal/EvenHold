// @vitest-environment happy-dom
// Low and Medium cut what's drawn outdoors (v0.9: they drew about as much of the land as High): the grass and small
// plants thinned, none of them past a reach, the trees far off at half their detail (view/meshes/voxel/
// voxelInstances.ts' detail, coarseGrid.ts); each chunk told as the hero crosses a tile or the quality changes
// (view/world/chunkStreamer.ts). High draws all of it, as ever.
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PRESETS, QUALITIES, reloadGraphics, setGraphics } from '../src/view/render/graphics';
import { voxelLayer } from '../src/view/meshes/voxel/voxelInstances';
import { coarseGrid } from '../src/view/meshes/voxel/coarseGrid';
import { createGrid, fillBox } from '../src/view/meshes/voxel/voxelShapes';
import { buildTreeFarGeometry, buildTreeGeometry } from '../src/view/meshes/tree/treeMesh';
import { ChunkStreamer } from '../src/view/world/chunkStreamer';
import type { ChunkLayer } from '../src/view/world/chunkLayer';

afterEach(() => {
  localStorage.clear();
  reloadGraphics();
});

const triangles = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;

describe('the outdoor detail of each quality', () => {
  it('High draws all of it; each step down less grass, a shorter reach for the small things, simpler trees nearer', () => {
    expect(PRESETS.high).toMatchObject({ flora: 1, propReach: Infinity, treeFar: Infinity });
    const [low, medium, high] = QUALITIES.map((q) => PRESETS[q]);
    for (const [less, more] of [[low, medium], [medium, high]]) {
      expect(less.flora).toBeLessThan(more.flora);
      expect(less.propReach).toBeLessThan(more.propReach);
      expect(less.treeFar).toBeLessThan(more.treeFar);
    }
    expect(low.propReach).toBeGreaterThanOrEqual(12); // (the grass round the hero, always: what's walked through)
    expect(low.treeFar).toBeGreaterThanOrEqual(6);
  });
});

// A layer of `n` small things (or trees) in one chunk, built.
function built(n: number, detail: Parameters<typeof voxelLayer>[7]) {
  const items = Array.from({ length: n }, (_, i) => ({ x: (i % 10) * 0.37, z: Math.floor(i / 10) * 0.41 }));
  const near = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const layer = voxelLayer(() => ['0,0'], () => items, () => 'one', () => near, (it) => ({ ...it, y: 0, quarterTurns: 0 }), new THREE.MeshStandardMaterial(), undefined, detail);
  const objects = layer.build('0,0');
  return { layer, mesh: objects[0] as THREE.InstancedMesh, objects, near };
}

const order = (mesh: THREE.InstancedMesh, count: number) => Array.from({ length: count }, (_, i) => new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16).elements[12]);

describe('a layer of small things', () => {
  it('is thinned at a lower quality (the same ones kept each time), and none past its reach; all at High', () => {
    const { layer, mesh, objects } = built(200, { small: true });
    setGraphics({ quality: 'high' });
    layer.fit!(objects, 40);
    expect([mesh.count, mesh.visible]).toEqual([200, true]);
    setGraphics({ quality: 'low' });
    layer.fit!(objects, 3);
    expect(mesh.count).toBe(Math.ceil(200 * PRESETS.low.flora));
    const kept = order(mesh, mesh.count);
    setGraphics({ quality: 'medium' });
    layer.fit!(objects, 3);
    expect(mesh.count).toBe(Math.ceil(200 * PRESETS.medium.flora));
    expect(order(mesh, kept.length)).toEqual(kept); // (Medium's: Low's and more)
    layer.fit!(objects, PRESETS.medium.propReach + 1);
    expect([mesh.count, mesh.visible]).toEqual([0, false]);
  });

  it('kept ones spread over the chunk, not bunched (thinned in a shuffled order)', () => {
    const { layer, mesh, objects } = built(200, { small: true });
    setGraphics({ quality: 'low' });
    layer.fit!(objects, 0);
    const xs = order(mesh, mesh.count);
    expect(Math.min(...xs)).toBeLessThan(0.5);
    expect(Math.max(...xs)).toBeGreaterThan(3);
  });
});

describe('the trees far off', () => {
  it('at half their detail past the quality\'s distance: a fraction of the triangles, as tall and wide', () => {
    for (const kind of ['oak', 'pine', 'birch'] as const) {
      const [near, far] = [buildTreeGeometry(kind, 0), buildTreeFarGeometry(kind, 0)];
      expect(triangles(far)).toBeLessThan(triangles(near) * 0.35);
      near.computeBoundingBox();
      far.computeBoundingBox();
      const [a, b] = [near.boundingBox!.getSize(new THREE.Vector3()), far.boundingBox!.getSize(new THREE.Vector3())];
      expect(b.y).toBeGreaterThan(a.y * 0.85);
      expect(b.x).toBeGreaterThan(a.x * 0.7);
    }
  });

  it('swap model by distance at Low and Medium; never at High', () => {
    const farTree = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const { layer, mesh, objects, near } = built(5, { far: () => farTree });
    setGraphics({ quality: 'low' });
    layer.fit!(objects, PRESETS.low.treeFar + 1);
    expect(mesh.geometry).toBe(farTree);
    expect(mesh.count).toBe(5); // (every tree still there)
    layer.fit!(objects, PRESETS.low.treeFar - 1);
    expect(mesh.geometry).toBe(near);
    setGraphics({ quality: 'high' });
    layer.fit!(objects, 100);
    expect(mesh.geometry).toBe(near);
  });

  it('half the detail: each 2x2x2 block one voxel, where most of it is', () => {
    const solid = createGrid([4, 4, 4]);
    fillBox(solid, 0, 0, 0, 3, 3, 3, 2);
    const half = coarseGrid(solid);
    expect(half.size).toEqual([2, 2, 2]);
    expect([...half.cells]).toEqual(Array(8).fill(2));
    const speck = createGrid([4, 4, 4]);
    fillBox(speck, 1, 1, 1, 1, 1, 1, 1);
    expect([...coarseGrid(speck).cells].every((c) => c === 0)).toBe(true);
  });
});

describe('the chunks streamed', () => {
  it('are fitted as they load, as the hero crosses a tile, and again on a change of quality', () => {
    const told: number[] = [];
    const layer: ChunkLayer = { materials: [], chunkKeys: () => ['0,0'], build: () => [new THREE.Object3D()], fit: (_o, distance) => told.push(distance) };
    const streamer = new ChunkStreamer(new THREE.Scene());
    streamer.loadRadius = 4;
    streamer.layer(layer);
    streamer.loadAround(8, 8);
    const loaded = told.length;
    expect(loaded).toBeGreaterThan(0);
    expect(told).toContain(0); // (the hero's own chunk)
    streamer.update(8.2, 8.1); // (the same tile: nothing told)
    expect(told.length).toBe(loaded);
    streamer.update(9.6, 8.1);
    const moved = told.length;
    expect(moved).toBeGreaterThan(loaded);
    streamer.refit();
    streamer.update(9.6, 8.1);
    expect(told.length).toBeGreaterThan(moved);
  });
});
