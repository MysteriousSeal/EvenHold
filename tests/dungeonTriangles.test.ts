// @vitest-environment happy-dom
// What a dungeon's scene costs to draw (as the renderer counts it: every instance drawn, a hidden one too): its
// triangles and its draw calls, in a crypt, a cave and a stronghold, the hero just inside. The rock that can hide the
// hero is drawn once a tile (solid or see-through, never both, nor a hidden copy).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameModel } from '../src/model/GameModel';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import type { Entrance } from '../src/model/interiors/interiors';
import { TEST_MAP_SIZE, TEST_SEEDS, regionCrypt } from './support/testWorld';
import { greedyMesh } from '../src/view/meshes/voxel/greedyMesh';
import { seenFaces } from '../src/view/dungeon/dungeonScene';

const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

export function cost(scene: THREE.Object3D): { triangles: number; calls: number } {
  let [triangles, calls] = [0, 0];
  scene.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    const per = (g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0)) / 3;
    const count = o instanceof THREE.InstancedMesh ? o.count : 1;
    if (!per || !count) return;
    triangles += per * count;
    calls++;
  });
  return { triangles, calls };
}

const inside = (model: GameModel, entrance: Entrance) => {
  model.teleport(entrance.x, entrance.z);
  model.useDoor();
  const built = buildDungeonScene(model.seed, entrance)!;
  built.seeHero(model.hero.x, model.hero.z);
  const c = cost(built.scene);
  built.dispose();
  return c;
};

describe("a dungeon's cost to draw", () => {
  // (3.57M, 6.73M and 4.17M triangles before, in 68, 61 and 80 draw calls: every rock tile drawn twice, a hidden copy
  // shrunk to nothing, every face of every piece the camera never sees)
  it('stays within its budget in a crypt, a cave and a stronghold, in no more draw calls', () => {
    const crypt = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const cave = new GameModel(1, { width: 512, depth: 512 });
    const hold = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const costs = { crypt: inside(crypt, regionCrypt(crypt).entrance), cave: inside(cave, cave.caves[0].entrance), stronghold: inside(hold, hold.strongholds[0].entrance) };
    expect(costs.crypt.triangles).toBeLessThan(1_500_000);
    expect(costs.cave.triangles).toBeLessThan(2_700_000);
    expect(costs.stronghold.triangles).toBeLessThan(1_900_000);
    expect(costs.crypt.calls).toBeLessThanOrEqual(68);
    expect(costs.cave.calls).toBeLessThanOrEqual(61);
    expect(costs.stronghold.calls).toBeLessThanOrEqual(82);
  });

  it('draws only the faces the camera can see (it looks down from +x +z), turned as a piece is', () => {
    const block = greedyMesh({ size: [1, 1, 1], cells: Uint8Array.of(1) }, [0x808080], 1, new THREE.Vector3());
    const faces = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 6;
    expect(faces(block)).toBe(6);
    const seen = seenFaces(block);
    expect(faces(seen)).toBe(3);
    const normals = (g: THREE.BufferGeometry) => new Set(Array.from({ length: g.getAttribute('normal').count }, (_, i) => [0, 1, 2].map((k) => g.getAttribute('normal').array[i * 3 + k]).join()));
    expect(normals(seen)).toEqual(new Set(['1,0,0', '0,1,0', '0,0,1']));
    // Turned a quarter (+x to -z): its -x face is the one turned to face +z, toward the camera.
    expect(normals(seenFaces(block, 1))).toEqual(new Set(['-1,0,0', '0,1,0', '0,0,1']));
  });
});
