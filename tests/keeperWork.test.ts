// Keepers at work in their own place (model/npcs/keeperWork.ts): the smith
// in his smithy and a herbalist at home, the same way: round their work,
// and behind their counter when the hero's at it (their work put down at
// once), standing still there.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { enterNearest, visitHerbalist } from '../src/model/cheats';
import type { NpcRole } from '../src/model/npcs/npcs';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const keepers: Array<{ role: NpcRole; counter: string; enter: (m: GameModel) => boolean }> = [
  { role: 'smith', counter: 'smithCounter', enter: (m) => enterNearest(m, 'smithy', new Set()) },
  { role: 'herbalist', counter: 'herbCounter', enter: (m) => visitHerbalist(m, new Set()) },
];

describe.each(keepers)('the $role', ({ role, counter: kind, enter }) => {
  it('works their round, then, the hero at their counter, stands behind it, still', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    expect(enter(model)).toBe(true);
    const keeper = model.npcs.find((n) => n.role === role && n.home === model.inside!.entrance)!;
    const { room, furniture } = layoutOf(model.seed, keeper.home);
    const counter = furniture.find((f) => f.kind === kind)!;
    // The hero away from the counter, in the far corner from it: the keeper at their work.
    [model.hero.x, model.hero.z] = [counter.x < room.width / 2 ? room.width - 1 : 0, 0];
    const spots = new Set<string>();
    for (let t = 0; t < 30; t += 1 / 30) {
      model.update(0, 0, 1 / 30);
      if (!keeper.moving) spots.add(`${keeper.x.toFixed(1)},${keeper.z.toFixed(1)}`);
    }
    expect(spots.size, 'round their work').toBeGreaterThan(1);
    [model.hero.x, model.hero.z] = [counter.x + 0.5, counter.z + 1];
    for (let t = 0; t < 5; t += 1 / 30) model.update(0, 0, 1 / 30); // (their work put down at once: there in a few steps)
    expect(keeper.z).toBeLessThan(counter.z);
    const [x, z] = [keeper.x, keeper.z];
    for (let t = 0; t < 2; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect(Math.hypot(keeper.x - x, keeper.z - z)).toBeLessThan(0.01);
  });
});
