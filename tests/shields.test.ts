// The shields (gear/items/offHand.ts): in the body's own voxels, in relief,
// gripped on quarter voxels (so none of their faces lies on a plane the
// body's or armour's do).
import { describe, expect, it } from 'vitest';
import { ITEM_MODELS } from '../src/view/meshes/human/gear/itemModels';

const SHIELDS = ['plankShield', 'buckler', 'heaterShield', 'towerShield', 'pavise', 'crestShield', 'bronzeTarge'] as const;

describe('shields', () => {
  it('each fine, standing out from its board (two layers deep at least), gripped on quarter voxels', () => {
    for (const item of SHIELDS) {
      const { held } = ITEM_MODELS[item];
      expect(held?.fine, item).toBe(true);
      const grid = held!.build();
      const [sx, sy, sz] = grid.size;
      let deepest = 0;
      for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if (grid.cells[x + sx * (y + sy * z)]) deepest = Math.max(deepest, z + 1);
      expect(deepest, item).toBeGreaterThanOrEqual(2);
      for (const g of held!.grip) expect([0.25, 0.75], `${item} grip ${held!.grip}`).toContain(((g % 1) + 1) % 1);
    }
  });

  it('every raised voxel stands on the one behind it (nothing floats off the board)', () => {
    for (const item of SHIELDS) {
      const grid = ITEM_MODELS[item].held!.build();
      const [sx, sy, sz] = grid.size;
      const at = (x: number, y: number, z: number) => grid.cells[x + sx * (y + sy * z)];
      for (let z = 1; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if (at(x, y, z)) expect(at(x, y, z - 1), `${item} at ${x},${y},${z}`).not.toBe(0);
    }
  });
});
