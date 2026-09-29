import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { MAX_ACTIVE, OFFERS, questAt } from '../src/model/quests/quests';
import { noticeBoards } from '../src/model/quests/noticeBoards';
import { RESPAWN_EVERY } from '../src/model/quests/questBook';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
const marked = (model: GameModel, key: string) => model.enemies.filter((e) => e.quest === key && e.state !== 'dead');
const slay = (model: GameModel, key: string) => {
  const foe = marked(model, key)[0];
  model.teleport(foe.x, foe.z);
  foe.hp = 1;
  model.focus(foe.id);
  model.startAttack();
  model.update(0, 0, 1);
};

describe('quests', () => {
  it('offers six quests a board, the same on the same seed, with a reward that grows with danger', () => {
    const model = fresh();
    expect(model.villages.length).toBeGreaterThan(0);
    const offers = model.quests.offersAt(0);
    expect(offers).toHaveLength(OFFERS);
    expect(fresh().quests.offersAt(0)).toEqual(offers);
    for (const q of offers) {
      const [least, most] = q.kind === 'kill' ? [6, 8] : [4, 6];
      expect(q.count).toBeGreaterThanOrEqual(least);
      expect(q.count).toBeLessThanOrEqual(most);
      expect(q.copper).toBeGreaterThan(0);
      expect(q.xp).toBeGreaterThan(0);
      expect(q.where).toMatch(/of the village$/);
      expect(q.kind === 'collect').toBe(q.item !== null);
    }
  });

  it('plays out the same on the same seed: the same foes, in the same places', () => {
    const foes = (reversed: boolean) => {
      const model = fresh();
      const [a, b] = model.quests.offersAt(0);
      for (const q of reversed ? [b, a] : [a, b]) model.quests.accept(q); // whichever is taken first
      return model.enemies.filter((e) => e.quest).map(({ id, quest, x, z, kind, level }) => ({ id, quest, x, z, kind, level })).sort((p, q) => p.id - q.id);
    };
    const first = foes(false);
    expect(first.length).toBeGreaterThan(0);
    expect(new Set(first.map((f) => f.id)).size).toBe(first.length); // no two alike
    expect(foes(true)).toEqual(first);
  });

  it('stands beside the inn, and is read up close', () => {
    const model = fresh();
    const spot = noticeBoards(model)[0];
    const inn = model.buildings.find((b) => b.kind === 'inn' && Math.hypot(b.x - model.villages[0].x, b.z - model.villages[0].z) < 5)!;
    expect(Math.min(...inn.tiles.map(([x, z]) => Math.abs(x - spot.x) + Math.abs(z - spot.z)))).toBeLessThanOrEqual(2);
    expect(model.isOpenTile(spot.x, spot.z)).toBe(false); // the board stands there
    const free = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dz]) => model.isOpenTile(spot.x + dx, spot.z + dz))!;
    model.teleport(spot.x + free[0], spot.z + free[1]);
    expect(model.boardInReach).toBe(0);
  });

  it('gathers a marked pack, counts kills, brings them back after a minute, and pays on hand-in', () => {
    const model = fresh();
    const quest = { ...questAt(model, 0, 0), kind: 'kill' as const, item: null, count: 3 };
    expect(model.quests.accept(quest)).toBe(true);
    expect(marked(model, quest.key)).toHaveLength(6); // twice as many as asked
    expect(marked(model, quest.key).every((e) => model.quests.marked(e))).toBe(true); // each wears the mark
    expect(model.quests.handIn(quest.key)).toBe(false); // not done
    slay(model, quest.key);
    const taken = model.quests.takenOf(quest.key)!;
    expect(taken.kills).toBe(1);
    expect(model.takeEvents().some((e) => e.kind === 'quest' && e.text === '1/3 wolves'.replace('wolves', quest.foe === 'wolf' ? 'wolves' : 'bandits'))).toBe(true);
    expect(model.slain.size).toBe(0); // a quest's foes aren't the world's
    // Two left to slay, five about (more than the four wanted): none comes back.
    model.quests.update(RESPAWN_EVERY + 1);
    expect(marked(model, quest.key)).toHaveLength(5);
    // Two wander off for good (gone): one is back a minute later.
    for (let i = 0; i < 2; i++) model.enemies.splice(model.enemies.indexOf(marked(model, quest.key)[0]), 1);
    model.quests.update(RESPAWN_EVERY / 2);
    expect(marked(model, quest.key)).toHaveLength(3);
    model.quests.update(RESPAWN_EVERY / 2 + 0.1);
    expect(marked(model, quest.key)).toHaveLength(4);
    expect(model.quests.readyAt(0)).toBe(false);
    taken.kills = 3;
    expect(model.quests.readyAt(0)).toBe(true); // done: a "?" over its board
    expect(model.quests.marked(marked(model, quest.key)[0])).toBe(false); // done: no more marks
    const [money, xp, level] = [model.hero.money, model.hero.xp, model.hero.level];
    expect(model.quests.handIn(quest.key)).toBe(true);
    expect(model.hero.money).toBe(money + quest.copper);
    expect(model.hero.xp !== xp || model.hero.level > level).toBe(true);
    expect(model.quests.taken).toHaveLength(0);
    expect(model.quests.isCompleted(quest.key)).toBe(true); // done for good
    expect(model.quests.accept(quest)).toBe(false);
  });

  it('takes at most three, and "bring" quests take what was brought', () => {
    const model = fresh();
    const offers = model.quests.offersAt(0);
    for (const q of offers.slice(0, MAX_ACTIVE)) expect(model.quests.accept(q)).toBe(true);
    expect(model.quests.accept(offers[MAX_ACTIVE])).toBe(false);
    model.quests.abandon(offers[0].key);
    const bring = { ...offers[MAX_ACTIVE], kind: 'collect' as const, item: 'wolfPelt' as const, count: 2 };
    expect(model.quests.accept(bring)).toBe(true);
    model.hero.bag.wolfPelt = 3;
    expect(model.quests.handIn(bring.key)).toBe(true);
    expect(model.hero.bag.wolfPelt).toBe(1);
  });

  it('has six quests for good: one handed in is done, and a board with all six done has no more', () => {
    const model = fresh();
    const offers = model.quests.offersAt(0);
    for (const q of offers) {
      model.quests.accept(q);
      model.quests.takenOf(q.key)!.kills = q.count;
      if (q.item) model.hero.bag[q.item] = q.count;
      expect(model.quests.handIn(q.key)).toBe(true);
      expect(model.quests.isCompleted(q.key)).toBe(true);
      expect(model.quests.accept(q)).toBe(false); // not again
    }
    expect(model.quests.offersAt(0)).toHaveLength(OFFERS); // still listed, all done
    expect(model.quests.available(0)).toBe(false);
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.quests.available(0)).toBe(false);
    expect(offers.every((q) => again.quests.isCompleted(q.key))).toBe(true);
  });

  it('keeps the boards and the quests taken in a save', () => {
    const model = fresh();
    const [a, b] = model.quests.offersAt(0);
    model.quests.accept(a);
    model.quests.takenOf(a.key)!.kills = 1;
    model.quests.takenOf(a.key)!.tracked = false;
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.quests.taken.map((t) => t.quest.key)).toEqual([a.key]);
    expect(again.quests.takenOf(a.key)!.kills).toBe(a.kind === 'kill' ? 1 : 1);
    expect(again.quests.takenOf(b.key)).toBeNull();
    expect(again.quests.takenOf(a.key)!.tracked).toBe(false);
    expect(marked(again, a.key).length).toBe(a.kind === 'kill' ? 2 * (a.count - 1) : 2 * a.count);
  });
});
