// A hedge-witch's cottage (view/meshes/building/witchHouse.ts): her own building, nothing like the village houses
// nor the herbalist's hut: tarred boards on stone, a black thatch, a crow, bones and witch-bottles, a lit window and
// the door ajar; whole (nothing floating); its chimney's mouth its topmost soot (the smoke's: chimneySmoke.ts).
import { describe, expect, it } from 'vitest';
import { buildWitchHut } from '../src/view/meshes/building/witchHouse';
import { buildHermitHut } from '../src/view/meshes/building/herbalistHouse';
import { HOUSE_LAYOUTS, buildHouseVoxels } from '../src/view/meshes/building/houseVoxels';
import { C, GLOWING } from '../src/view/meshes/building/housePalette';

const count = (cells: ArrayLike<number>, color: number) => Array.from(cells).filter((c) => c === color).length;

describe("a hedge-witch's cottage", () => {
  const hut = buildWitchHut();
  const [sx, sy, sz] = hut.size;
  const at = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && hut.cells[x + sx * (y + sy * z)] !== 0;

  it('of its own stuff: tar and stone, black thatch, a crow, bones, witch-bottles, nettles; a lit window', () => {
    for (const color of [C.tar, C.tarLight, C.stone, C.blackThatch, C.blackThatchDark, C.crow, C.beak, C.bone, C.witchGlass, C.nettle, C.door, C.glass, C.iron, C.soot]) expect(count(hut.cells, color), `colour ${color}`).toBeGreaterThan(0);
    expect(GLOWING.has(C.glass)).toBe(true);
    for (const color of [C.plaster, C.mud, C.thatch]) expect(count(hut.cells, color)).toBe(0); // (no village plaster, nor the herbalist's daub and straw)
  });

  it('nothing like any village house nor the herbalist\'s hut', () => {
    for (const layout of HOUSE_LAYOUTS) expect(Array.from(buildHouseVoxels(layout, 0).cells)).not.toEqual(Array.from(hut.cells));
    expect(Array.from(buildHermitHut().cells)).not.toEqual(Array.from(hut.cells));
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

  it('its topmost soot the chimney\'s mouth, above the thatch', () => {
    let top = -1;
    let thatch = -1;
    hut.cells.forEach((c, i) => {
      const y = Math.floor(i / sx) % sy;
      if (c === C.soot) top = Math.max(top, y);
      if (c === C.blackThatch || c === C.blackThatchDark) thatch = Math.max(thatch, y);
    });
    expect(top).toBeGreaterThan(thatch - 6);
  });
});
