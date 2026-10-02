// What's worn on the head, sculpted round it (armorShell.ts buildHeadgear,
// gear/items/head.ts and helms.ts): every piece whole (no voxel floating
// free of the rest or the head), low enough over the crown, and every helm
// to be had somewhere.
import { describe, expect, it } from 'vitest';
import { HEAD_PAD, buildHeadgear } from '../src/view/meshes/human/gear/armorShell';
import { ITEM_MODELS } from '../src/view/meshes/human/gear/itemModels';
import { HEAD_ITEMS } from '../src/model/human/items/armor';

const HEAD = 11; // the head's cube
const HEADS = Object.keys(HEAD_ITEMS) as Array<keyof typeof HEAD_ITEMS>;

describe('head pieces', () => {
  it('each sculpted, whole: every voxel joined to the head through the others', () => {
    for (const item of HEADS) {
      for (const build of ['male', 'female'] as const) {
        const grid = buildHeadgear(ITEM_MODELS[item].headgear!, build);
        const [sx, sy, sz] = grid.size;
        const at = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && grid.cells[x + sx * (y + sy * z)] !== 0;
        const head = (x: number, y: number, z: number) => [x, y, z].every((v) => v >= HEAD_PAD && v < HEAD_PAD + HEAD);
        // Flood from the head's own voxels through the piece's, face to face.
        const seen = new Set<number>();
        const queue: number[][] = [];
        for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if (head(x, y, z)) queue.push([x, y, z]);
        while (queue.length) {
          const [x, y, z] = queue.pop()!;
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const [nx, ny, nz] = [x + dx, y + dy, z + dz];
            const key = nx + sx * (ny + sy * nz);
            if (head(nx, ny, nz) || seen.has(key) || !at(nx, ny, nz)) continue;
            seen.add(key);
            queue.push([nx, ny, nz]);
          }
        }
        const filled = grid.cells.filter((c) => c !== 0).length;
        expect(filled, item).toBeGreaterThan(0);
        expect(seen.size, `${item} (${build}): voxels floating free`).toBe(filled);
      }
    }
  });

  it('never more than two layers over the crown, never under the chin', () => {
    for (const item of HEADS) {
      const grid = buildHeadgear(ITEM_MODELS[item].headgear!);
      const [sx, sy, sz] = grid.size;
      for (let z = 0; z < sz; z++) {
        for (let y = 0; y < sy; y++) {
          for (let x = 0; x < sx; x++) {
            if (!grid.cells[x + sx * (y + sy * z)]) continue;
            expect(y, item).toBeGreaterThanOrEqual(HEAD_PAD);
            expect(y, item).toBeLessThan(HEAD_PAD + HEAD + 2);
          }
        }
      }
    }
  });

  it('twenty of them, every helm to be had: sold, worn by someone, or worth a crypt lord\'s hoard', () => {
    expect(HEADS).toHaveLength(20);
    for (const item of HEADS) {
      const { soldBy, wornBy, value = 0 } = HEAD_ITEMS[item] as { soldBy?: object; wornBy?: object; value?: number };
      if (item === 'circlet' || item === 'leatherCap') continue; // (the old ones the hero may start with or find)
      expect(Boolean(soldBy) || Boolean(wornBy) || value >= 100, item).toBe(true);
    }
  });
});
