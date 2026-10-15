// The runner down the inn's hallway upstairs (view/interior/upstairsVoxels.ts): down its middle from the stairwell,
// on along the back, never into the rooms off it.
import { describe, expect, it } from 'vitest';
import { hallRunner } from '../src/view/interior/upstairsVoxels';
import { RED, RED_DARK } from '../src/view/interior/furniturePalette';

const [HALL, STAIRS, W] = [50, 225, 300]; // voxels: a hallway two tiles wide, the stairwell ten tiles down, a floor twelve across

describe('the hallway runner', () => {
  it('runs down the hallway\'s middle and along the back, its edge dark', () => {
    expect(hallRunner(25, 120, HALL, STAIRS, W)).toBe(RED); // down the left hallway, between diamonds
    expect(hallRunner(150, 22, HALL, STAIRS, W)).toBe(RED); // along the back
    expect(hallRunner(19, 120, HALL, STAIRS, W)).toBe(RED_DARK); // its edge
  });

  it('stops short of the stairwell, the far wall, and the rooms', () => {
    expect(hallRunner(25, STAIRS - 1, HALL, STAIRS, W)).toBeNull();
    expect(hallRunner(W - 2, 25, HALL, STAIRS, W)).toBeNull();
    expect(hallRunner(10, 120, HALL, STAIRS, W)).toBeNull(); // by the wall, bare boards
    expect(hallRunner(120, 120, HALL, STAIRS, W)).toBeNull(); // in a room
  });
});
