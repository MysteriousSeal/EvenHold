// The mist in the ruins: how thick it lies by the hour.

import { describe, expect, it } from 'vitest';
import { mistAt } from '../src/view/meshes/ruin/ruinMist';

describe('the mist in the ruins', () => {
  it('lies thick through the night and the dawn, thins to half by midday, gathers again at evening', () => {
    const at = (hour: number) => mistAt(hour * 60);
    expect(at(2)).toBe(1);
    expect(at(6)).toBe(1);
    expect(at(13)).toBeCloseTo(0.5);
    expect(at(9)).toBeGreaterThan(at(13));
    expect(at(9)).toBeLessThan(at(6));
    expect(at(19)).toBeGreaterThan(at(13));
    expect(at(23)).toBeGreaterThan(0.9);
    expect(at(24 + 13)).toBeCloseTo(at(13)); // (any day)
    for (let h = 0; h < 24; h += 0.25) expect(Math.abs(at(h + 0.25) - at(h))).toBeLessThan(0.1); // (no jumps)
  });
});
