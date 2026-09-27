import { describe, it, expect } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { HERO_RADIUS } from '../src/model/constants';
import { cellKey } from '../src/model/grid';

// Walks the hero east into the west face of a house and checks its body
// stops outside the house's cell rather than sinking into it.
describe('hero collision', () => {
  it('stops the hero body at the edge of a house cell', () => {
    const model = new GameModel(1);
    const blocked = new Set(model.houses.map((h) => cellKey(h.x, h.z)));

    // A house whose two western neighbors are open, level, dry ground.
    const house = model.houses.find(
      (h) =>
        !blocked.has(cellKey(h.x - 1, h.z)) &&
        !blocked.has(cellKey(h.x - 2, h.z)) &&
        !model.lakeMap[h.x - 1][h.z] &&
        !model.lakeMap[h.x - 2][h.z],
    );
    expect(house).toBeDefined();

    model.hero.x = house!.x - 2;
    model.hero.z = house!.z;

    for (let i = 0; i < 120; i++) model.move(1, 0, 1 / 60);

    const houseWestEdge = house!.x - 0.5;
    expect(model.hero.x + HERO_RADIUS).toBeLessThanOrEqual(houseWestEdge);
    expect(model.hero.x).toBeGreaterThan(house!.x - 1.5); // it did actually walk up to the house
  });

  it('ignores non-positive dt', () => {
    const model = new GameModel(1);
    const { x, z } = model.hero;
    model.move(1, 0, -0.01);
    model.move(1, 0, 0);
    expect(model.hero.x).toBe(x);
    expect(model.hero.z).toBe(z);
  });
});
