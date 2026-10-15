// The signposts where roads meet out in the wilds (map/signposts.ts): one to each junction away from the villages, an
// arm down each way that leads to a village, naming the nearest along it; drawn as a post with a board down each way
// (view/meshes/road/signpostMesh.ts).

import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { mapsAsTiles } from '../src/model/map/tiles';
import { NEIGHBORS_4 } from '../src/model/map/grid';
import { REACH } from '../src/model/worldgen/roads';
import { signpostAt, signpostsIn } from '../src/model/map/signposts';
import { buildSignpost } from '../src/view/meshes/road/signpostMesh';
import { colorAt } from '../src/view/meshes/voxel/voxelShapes';

const world = generateWorld(1, { width: 512, depth: 512 });
const tiles = mapsAsTiles(world);
const posts = signpostsIn(tiles, world.villages, { x0: 0, z0: 0, x1: 512, z1: 512 });
const paved = (x: number, z: number) => ['path', 'plaza'].includes(tiles.surface(x, z));

describe('the signposts', () => {
  it('stand at junctions out in the wilds, one to a knot of them', () => {
    expect(posts.length).toBeGreaterThan(3);
    for (const p of posts) {
      expect(tiles.surface(p.x, p.z)).toBe('path');
      expect(NEIGHBORS_4.filter(([dx, dz]) => paved(p.x + dx, p.z + dz)).length).toBeGreaterThanOrEqual(3);
      for (const v of world.villages) expect(Math.max(Math.abs(v.x - p.x), Math.abs(v.z - p.z))).toBeGreaterThan(REACH);
      for (const q of posts) if (q !== p) expect(Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z))).toBeGreaterThan(1);
    }
  });

  it('point each arm down a paved way, to a village, no two to the same one', () => {
    for (const p of posts) {
      expect(p.arms.length).toBeGreaterThan(0);
      for (const a of p.arms) {
        const [dx, dz] = NEIGHBORS_4[a.dir];
        expect(paved(p.x + dx, p.z + dz)).toBe(true);
        expect(world.villages).toContain(a.village);
        expect(a.tiles).toBeGreaterThan(0);
      }
      expect(new Set(p.arms.map((a) => a.village)).size).toBe(p.arms.length);
    }
  });

  it('a road tile with no junction has none', () => {
    const straight = world.roads[0].route.find(([x, z]) => tiles.surface(x, z) === 'path' && NEIGHBORS_4.filter(([dx, dz]) => paved(x + dx, z + dz)).length === 2)!;
    expect(signpostAt(tiles, world.villages, straight[0], straight[1])).toBeNull();
  });

  it('drawn with a board down each way it points, none where it doesn\'t', () => {
    const boardAt = (grid: ReturnType<typeof buildSignpost>, dir: number) => {
      // (somewhere out past the post that way, at a board's height)
      const [dx, dz] = NEIGHBORS_4[dir];
      let found = false;
      for (let i = 0; i < grid.size[0]; i++) {
        for (let k = 0; k < grid.size[2]; k++) {
          for (let j = 9; j < 18; j++) if (colorAt(grid, i, j, k) && (dx ? Math.sign(i - 24.5) === dx && Math.abs(i - 24.5) > 12 : Math.sign(k - 24.5) === dz && Math.abs(k - 24.5) > 12)) found = true;
        }
      }
      return found;
    };
    const grid = buildSignpost([1, 1], 0b0101); // (east and south)
    expect(boardAt(grid, 0)).toBe(true);
    expect(boardAt(grid, 2)).toBe(true);
    const west = buildSignpost([-1, -1], 0b0010);
    expect(boardAt(west, 1)).toBe(true);
    expect(boardAt(west, 0)).toBe(false);
  });
});

describe('a signpost in the way', () => {
  it('its post walked round (not through), the road beside it open', async () => {
    const { GameModel } = await import('../src/model/GameModel');
    const { HERO_RADIUS } = await import('../src/model/constants');
    const { SIGN_CORNER } = await import('../src/model/map/signposts');
    const model = new GameModel(1, { width: 512, depth: 512 });
    const inner = posts.filter((p) => p.x > 2 && p.z > 2 && p.x < 509 && p.z < 509);
    expect(inner.length).toBeGreaterThan(3);
    for (const p of inner) {
      expect(model.isBlocked(p.x + p.corner[0] * SIGN_CORNER, p.z + p.corner[1] * SIGN_CORNER, HERO_RADIUS)).toBe(true);
      expect(model.isBlocked(p.x, p.z, HERO_RADIUS)).toBe(false);
    }
  }, 60_000);
});
