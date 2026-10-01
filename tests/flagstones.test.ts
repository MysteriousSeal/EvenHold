// Flagstones as both floors of old stone lay them (view/meshes/voxel/flagstones.ts).
import { describe, expect, it } from 'vitest';
import { layFlagstones, type Laying } from '../src/view/meshes/voxel/flagstones';
import { mulberry32 } from '../src/util/random';

const LAYINGS: Laying[] = [
  { size: 25, deep: [6, 6], long: [7, 8], lead: 8 }, // the crypts'
  { size: 25, deep: [5, 5], long: [6, 6], lead: 7 }, // the ruins'
];

describe('flagstones', () => {
  for (const laying of LAYINGS) {
    for (let seed = 0; seed < 8; seed++) {
      it(`laid ${JSON.stringify(laying.deep)} ${JSON.stringify(laying.long)}, pattern ${seed}: every column a stone, no joint along the edges (only across), the same every time`, () => {
        const flags = layFlagstones(mulberry32(seed), laying);
        const again = layFlagstones(mulberry32(seed), laying);
        const { size } = laying;
        const stones = new Set<number>();
        for (let u = 0; u < size; u++) {
          for (let v = 0; v < size; v++) {
            expect(flags.stone(u, v)).toBeGreaterThanOrEqual(0);
            expect(flags.stone(u, v)).toBe(again.stone(u, v));
            expect(flags.joint(u, v)).toBe(again.joint(u, v));
            stones.add(flags.stone(u, v));
            // No joint along the edges (the stones there run on into the next tile): only across them, between two stones.
            if (u === size - 1 && flags.joint(u, v)) expect(flags.joint(u - 1, v), `a joint along the edge at ${u},${v}`).toBe(true);
            if (v === size - 1 && flags.joint(u, v)) expect(flags.joint(u, v - 1), `a joint along the edge at ${u},${v}`).toBe(true);
            if (flags.byJoint(u, v)) expect([flags.joint(u + 1, v), flags.joint(u - 1, v), flags.joint(u, v + 1), flags.joint(u, v - 1)]).toContain(true);
          }
        }
        expect(stones.size).toBeGreaterThan(3); // (stones, not one slab)
        expect(flags.joint(-1, 0) || flags.joint(0, size)).toBe(false); // (nothing off it)
      });
    }
  }
});
