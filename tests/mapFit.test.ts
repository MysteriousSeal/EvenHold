// The map opening fitted to the land seen (view/atlas/mapView.ts fitLook): a fresh hero's round of land fills the
// window, as it lies turned (not the box round it, its corners turned out); held to 0.5..4 pixels a tile.
import { describe, expect, it } from 'vitest';
import { fitLook, toScreen } from '../src/view/atlas/mapView';

const CELL = 4;
const round = (cx: number, cz: number, r: number): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  for (let x = cx - r; x < cx + r; x += CELL) for (let z = cz - r; z < cz + r; z += CELL) if (Math.hypot(x + 2 - cx, z + 2 - cz) <= r) cells.push([x, z]);
  return cells;
};

describe('the map fitted as it opens', () => {
  it("fills nine tenths of the window's short side with a fresh hero's round of land, the hero at the middle", () => {
    const look = { x: 1000, z: 1000, scale: 1.5 };
    fitLook(look, round(1000, 1000, 80), CELL, 860, 560);
    const ys = round(1000, 1000, 80).flatMap(([x, z]) => [toScreen(look, 860, 560, x, z)[1], toScreen(look, 860, 560, x + CELL, z + CELL)[1]]);
    expect((Math.max(...ys) - Math.min(...ys)) / 560).toBeGreaterThan(0.8);
    expect([look.x, look.z]).toEqual([1000, 1000]);
  });

  it('is held to 4 pixels a tile however little is seen, and nothing seen leaves it be', () => {
    const look = { x: 0, z: 0, scale: 1.5 };
    fitLook(look, round(0, 0, 8), CELL, 860, 560);
    expect(look.scale).toBe(4);
    const still = { x: 5, z: 5, scale: 1.5 };
    fitLook(still, [], CELL, 860, 560);
    expect(still).toEqual({ x: 5, z: 5, scale: 1.5 });
  });
});
