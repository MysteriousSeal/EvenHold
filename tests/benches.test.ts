import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { VILLAGE_OUTER_RADIUS as R } from '../src/model/constants';
import { squareBenches } from '../src/model/worldgen/benches';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = (seed = TEST_SEEDS[0]) => new GameModel(seed, TEST_MAP_SIZE);

describe('square benches', () => {
  it('stand on the squares’ edges, off the corners, apart, facing the well, and block their tile', () => {
    for (const seed of TEST_SEEDS) {
      const model = fresh(seed);
      const benches = squareBenches(model);
      expect(benches.length).toBeGreaterThan(0);
      for (const b of benches) {
        const v = b.village;
        const [dx, dz] = [b.x - v.x, b.z - v.z];
        expect(Math.max(Math.abs(dx), Math.abs(dz))).toBe(R); // on the edge
        expect(Math.abs(dx) === R && Math.abs(dz) === R).toBe(false); // not a corner
        expect(-dx * b.front[0] - dz * b.front[1]).toBe(R); // facing straight in toward the well
        expect(model.isOpenTile(b.x, b.z)).toBe(false);
        expect(b.seats).toHaveLength(2);
        for (const o of benches) if (o !== b) expect(Math.max(Math.abs(o.x - b.x), Math.abs(o.z - b.z))).toBeGreaterThan(1);
      }
    }
  });

  it('seat the hero with E, and walking gets them up', () => {
    const model = fresh();
    const bench = squareBenches(model)[0];
    const seat = bench.seats[0];
    model.teleport(seat.x + bench.front[0] * 0.6, seat.z + bench.front[1] * 0.6);
    expect(model.seatInReach).toBe(seat);
    expect(model.sitOrStand()).toBe(true);
    expect(model.seated?.seat).toBe(seat);
    expect([model.hero.x, model.hero.y, model.hero.z]).toEqual([seat.x, seat.y, seat.z]);
    expect(model.startAttack()).toBe(false); // no blows from a bench
    model.update(0, 0, 0.1);
    expect(model.hero.y).toBe(seat.y); // stays put, sitting
    model.update(bench.front[0], bench.front[1], 0.1);
    expect(model.seated).toBeNull();
    expect(model.hero.y).toBeCloseTo(model.getGroundY(model.hero.x, model.hero.z));
  });

  it("won't seat the hero where a villager sits", () => {
    const model = fresh();
    const bench = squareBenches(model)[0];
    const [left, right] = bench.seats;
    model.npcs[0].seat = left;
    model.teleport(left.x + bench.front[0] * 0.6, left.z + bench.front[1] * 0.6);
    expect(model.seatInReach).toBe(right); // the other one
  });

  it('are sat on by villagers strolling the square', () => {
    const model = fresh(TEST_SEEDS[2]);
    const bench = squareBenches(model)[0];
    model.teleport(bench.x + bench.front[0] * 2, bench.z + bench.front[1] * 2); // villagers near the hero walk
    let sat = false;
    for (let t = 0; t < 900 && !sat; t += 0.1) {
      model.update(0, 0, 0.1);
      sat = model.npcs.some((n) => !n.where && squareBenches(model).some((b) => b.seats.some((s) => s === n.seat)));
    }
    expect(sat).toBe(true);
  }, 60_000);
});
