// A herbalist's house (view/meshes/building/herbalistHouse.ts), told from the
// others outside, whatever its layout: a green door, a sign with its flask
// and leaf, herbs drying under the eaves, pots by the door; and every
// village's herbalist's home found among the houses.
import { describe, expect, it } from 'vitest';
import { HOUSE_LAYOUTS, buildHouseVoxels } from '../src/view/meshes/building/houseVoxels';
import { C } from '../src/view/meshes/building/housePalette';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const count = (cells: ArrayLike<number>, color: number) => Array.from(cells).filter((c) => c === color).length;

describe("a herbalist's house", () => {
  it.each(HOUSE_LAYOUTS.map((layout, i) => [i, layout]))('layout %i: its own outside, the rest as any', (_i, layout) => {
    const plain = buildHouseVoxels(layout, 0);
    const theirs = buildHouseVoxels(layout, 0, true);
    expect(count(theirs.cells, C.door) + count(theirs.cells, C.doorDark)).toBe(0); // (painted green)
    expect(count(theirs.cells, C.herbPaint)).toBe(count(plain.cells, C.door));
    for (const herb of [C.herbFresh, C.herbSage, C.herbDry]) expect(count(theirs.cells, herb), 'herbs').toBeGreaterThan(0);
    expect(count(theirs.cells, C.sign)).toBeGreaterThan(count(plain.cells, C.sign)); // (its sign)
    expect(count(theirs.cells, C.clayPot)).toBeGreaterThan(count(plain.cells, C.clayPot)); // (its pots)
    // Only added to, past the paint: nothing of the house itself taken away.
    const lost = Array.from(plain.cells).filter((c, k) => c !== 0 && theirs.cells[k] === 0).length;
    expect(lost).toBe(0);
  });

  it('every herbalist\'s home one of the houses', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    for (const h of model.npcs.filter((n) => n.role === 'herbalist')) expect(model.houses[model.entrances.indexOf(h.home)]).toBeDefined();
  });
});
