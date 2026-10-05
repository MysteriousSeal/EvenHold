// A bandit camp's name and level, told at its gate (model/camps/campGate.ts):
// coming up to its way in, a banner (its name, its level), once, not again
// while the hero's about it, only once they've gone well away and come back;
// nothing told away from any gate. Its name the same every time, the camps'
// names many; its level its ground's, its bandits that or one either side.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { campLevel, campName } from '../src/model/camps/campGate';
import { FRAME } from './support/testWorld';

const MID = { width: 256, depth: 256 };

describe('a bandit camp\'s gate', () => {
  it('tells its name and level as the hero comes up to it, once; again only after going well away', () => {
    const model = new GameModel(1, MID);
    for (const e of model.enemies) e.state = 'dead'; // (none to bother the hero)
    const camp = model.camps[0];
    const told = () => model.takeEvents().filter((e) => e.kind === 'campGate');
    model.teleport(camp.way.x + 10, camp.way.z + 10);
    model.update(0, 0, FRAME);
    expect(told()).toEqual([]);
    model.teleport(camp.way.x, camp.way.z);
    model.update(0, 0, FRAME);
    expect(told()).toEqual([{ kind: 'campGate', name: campName(camp, model.seed), level: campLevel(camp, model.size) }]);
    for (let i = 0; i < 30; i++) model.update(0, 0, FRAME);
    expect(told()).toEqual([]); // (not again, while they're about it)
    model.teleport(camp.way.x + 12, camp.way.z);
    model.update(0, 0, FRAME);
    model.teleport(camp.way.x, camp.way.z);
    model.update(0, 0, FRAME);
    expect(told()).toHaveLength(1); // (back again: told again)
  });

  it('names each camp the same every time, the camps\' names many; its level its ground\'s, its bandits within one of it', () => {
    const model = new GameModel(2, MID);
    const names = model.camps.map((c) => campName(c, model.seed));
    expect(model.camps.map((c) => campName(c, model.seed))).toEqual(names);
    expect(new Set(names).size).toBeGreaterThan(names.length * 0.6);
    for (const name of names) expect(name.length).toBeGreaterThan(5);
    for (const camp of model.camps) {
      const level = campLevel(camp, model.size);
      for (const b of model.enemies.filter((e) => e.kind === 'bandit' && e.homeX === camp.x && e.homeZ === camp.z)) expect(Math.abs(b.level - level)).toBeLessThanOrEqual(1);
    }
  });
});
