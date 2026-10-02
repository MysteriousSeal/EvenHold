// A herbalist's hut (view/meshes/building/herbalistHouse.ts): their own
// building, nothing like the village houses: stone and daub walls, a
// shaggy thatch, a plank door and a lit round window, embers under a
// cauldron, herbs, a sign, pots; whole (nothing floating), on its tile; and
// every village's herbalist's home found among the houses.
import { describe, expect, it } from 'vitest';
import { buildHermitHut } from '../src/view/meshes/building/herbalistHouse';
import { HOUSE_LAYOUTS, buildHouseVoxels } from '../src/view/meshes/building/houseVoxels';
import { C, GLOWING } from '../src/view/meshes/building/housePalette';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const count = (cells: ArrayLike<number>, color: number) => Array.from(cells).filter((c) => c === color).length;

describe("a herbalist's hut", () => {
  const hut = buildHermitHut();
  const [sx, sy, sz] = hut.size;
  const at = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && hut.cells[x + sx * (y + sy * z)] !== 0;

  it('of its own stuff: stone and daub, thatch, a plank door, a lit window, embers; herbs, a sign, pots, a cauldron', () => {
    for (const color of [C.stone, C.mud, C.thatch, C.thatchDark, C.door, C.glass, C.ember, C.herbFresh, C.herbSage, C.herbDry, C.sign, C.clayPot, C.iron, C.roofMoss]) expect(count(hut.cells, color), `colour ${color}`).toBeGreaterThan(0);
    expect(GLOWING.has(C.glass) && GLOWING.has(C.ember)).toBe(true); // (its window and embers lit at night)
    for (const color of [C.plaster, C.timberLight]) expect(count(hut.cells, color)).toBe(0); // (none of a village house's plaster or timber frame)
  });

  it('nothing like any village house, and lower than most', () => {
    const top = (grid: typeof hut) => {
      let y = 0;
      grid.cells.forEach((c, i) => c && (y = Math.max(y, Math.floor(i / sx) % sy)));
      return y;
    };
    for (const layout of HOUSE_LAYOUTS) expect(Array.from(buildHouseVoxels(layout, 0).cells)).not.toEqual(Array.from(hut.cells));
    expect(top(hut)).toBeLessThan(Math.max(...HOUSE_LAYOUTS.map((l) => top(buildHouseVoxels(l, 0)))));
  });

  it('whole: every voxel joined to the ground through the others', () => {
    const seen = new Set<number>();
    const queue: number[][] = [];
    for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) if (at(x, 0, z)) [seen.add(x + sx * sy * z), queue.push([x, 0, z])];
    while (queue.length) {
      const [x, y, z] = queue.pop()!;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const [nx, ny, nz] = [x + dx, y + dy, z + dz];
        const key = nx + sx * (ny + sy * nz);
        if (!at(nx, ny, nz) || seen.has(key)) continue;
        seen.add(key);
        queue.push([nx, ny, nz]);
      }
    }
    expect(seen.size).toBe(hut.cells.filter((c) => c !== 0).length);
  });

  it('every herbalist\'s home one of the houses', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    for (const h of model.npcs.filter((n) => n.role === 'herbalist')) expect(model.houses[model.entrances.indexOf(h.home)]).toBeDefined();
  });
});
