// The cathedral town drawn (view/meshes/town/): each piece's triangles within its budget (the cathedral solid within,
// its insides never meshed), its glass apart (drawn unlit), and the town built into the scene as the world's builders do.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { greedyMesh } from '../src/view/meshes/voxel/greedyMesh';
import { buildCathedralVoxels } from '../src/view/meshes/town/cathedralVoxels';
import { buildStall, buildWallPiece } from '../src/view/meshes/town/townWallVoxels';
import { GLASS, TOWN_PALETTE, TOWN_VOXEL } from '../src/view/meshes/town/townPalette';
import { buildTown } from '../src/view/meshes/town/townMesh';
import { eagerSink } from '../src/view/world/chunkLayer';
import { generateRegionLand, REGION, STREAMED_SIZE } from '../src/model/worldgen/regions';
import { townSite } from '../src/model/town/townSite';
import type { GameModel } from '../src/model/GameModel';

const tris = (g: THREE.BufferGeometry) => g.attributes.position.count / 3;
const mesh = (grid: ReturnType<typeof buildCathedralVoxels>, glass = false) => greedyMesh(grid, TOWN_PALETTE, TOWN_VOXEL, new THREE.Vector3(), (c) => GLASS.has(c) === glass);

describe('the cathedral town drawn', () => {
  it('keeps each piece within its triangles', () => {
    const cathedral = buildCathedralVoxels();
    expect(tris(mesh(cathedral))).toBeLessThan(40_000);
    expect(tris(mesh(cathedral, true))).toBeGreaterThan(0); // (its stained glass)
    for (const piece of ['wall', 'tower', 'gate'] as const) expect(tris(mesh(buildWallPiece(piece))), piece).toBeLessThan(2_000);
    for (const kind of ['relics', 'wine', 'cloth', 'potions'] as const) expect(tris(mesh(buildStall(kind))), kind).toBeLessThan(1_000);
  });

  it('is built into the scene: the cathedral, its walls a tile a piece, its stalls', () => {
    const site = townSite(1, STREAMED_SIZE)!;
    const land = generateRegionLand(1, Math.floor(site.x / REGION), Math.floor(site.z / REGION));
    const model = { towns: land.towns, buildings: land.buildings, getGroundY: () => 0.6 } as unknown as GameModel;
    const scene = new THREE.Scene();
    buildTown(eagerSink(scene), model);
    const meshes = scene.children.filter((o): o is THREE.InstancedMesh => (o as THREE.InstancedMesh).isInstancedMesh);
    const count = (n: number) => meshes.reduce((all, m) => all + m.count, 0) >= n;
    const town = land.towns![0];
    expect(count(2 + town.walls.length + town.stalls.length)).toBe(true);
  }, 60_000);
});
