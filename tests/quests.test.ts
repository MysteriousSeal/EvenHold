import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { spawnOf } from '../src/model/map/grid';
import { zoneLevel } from '../src/model/enemies/enemyLevels';
import { parseSave, restore, snapshot } from '../src/model/save';
import { MAX_ACTIVE, MAX_PER_BOARD, OFFERS, questAt, questProgress } from '../src/model/quests/quests';
import { noticeBoards } from '../src/model/quests/noticeBoards';
import { RESPAWN_EVERY } from '../src/model/quests/questBook';
import { TEST_MAP_SIZE, TEST_SEEDS, fresh, eachSeed } from './support/testWorld';

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

  it("stands beside each village's inn, and is read up close", () => {
    eachSeed((model) => {
      noticeBoards(model).forEach((spot, i) => {
        const inn = model.buildings.find((b) => b.kind === 'inn' && Math.hypot(b.x - model.villages[i].x, b.z - model.villages[i].z) < 5)!;
        expect(Math.min(...inn.tiles.map(([x, z]) => Math.abs(x - spot.x) + Math.abs(z - spot.z)))).toBeLessThanOrEqual(2);
        expect(model.isOpenTile(spot.x, spot.z)).toBe(false); // the board stands there
        // Read from the tile in front (the square's side), not from behind, nor from afar.
        model.teleport(spot.x + spot.front.dx * 0.6, spot.z + spot.front.dz * 0.6); // up against its face
        expect(model.boardInReach).toBe(i);
        model.teleport(spot.x + spot.front.dx, spot.z + spot.front.dz); // a whole tile off: too far
        expect(model.boardInReach).toBeNull();
        model.teleport(spot.x - spot.front.dx, spot.z - spot.front.dz);
        expect(model.boardInReach).toBeNull();
        model.teleport(spot.x + spot.front.dx * 3, spot.z + spot.front.dz * 3);
        expect(model.boardInReach).toBeNull();
      });
    });
  });

  it('gathers a marked pack, counts kills, brings them back after a minute, and pays on hand-in', () => {
    const model = fresh();
    const quest = { ...questAt(model, 0, 0), kind: 'kill' as const, item: null, count: 3 };
    expect(model.quests.accept(quest)).toBe(true);
    expect(marked(model, quest.key)).toHaveLength(4); // twice as many as asked, four at most at once
    expect(marked(model, quest.key).every((e) => model.quests.marked(e))).toBe(true); // each wears the mark
    expect(model.quests.handIn(quest.key)).toBe(false); // not done
    slay(model, quest.key);
    const taken = model.quests.takenOf(quest.key)!;
    expect(taken.kills).toBe(1);
    expect(model.takeEvents().some((e) => e.kind === 'quest' && e.text === questProgress(quest, 1).text)).toBe(true); // "1/3 boars", or whichever
    expect(model.slain.size).toBe(0); // a quest's foes aren't the world's
    // Two left to slay, three about (one slain of the four kept up): one comes back after a minute.
    model.quests.update(RESPAWN_EVERY + 1);
    expect(marked(model, quest.key)).toHaveLength(4);
    // Two wander off for good (gone): one is back a minute later.
    for (let i = 0; i < 2; i++) model.enemies.splice(model.enemies.indexOf(marked(model, quest.key)[0]), 1);
    model.quests.update(RESPAWN_EVERY / 2);
    expect(marked(model, quest.key)).toHaveLength(2);
    model.quests.update(RESPAWN_EVERY / 2 + 0.1);
    expect(marked(model, quest.key)).toHaveLength(3);
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

  it('takes at most three from a board and ten in all, and "bring" quests take what was brought', () => {
    const model = fresh();
    const [first] = model.quests.offersAt(0);
    for (const q of model.quests.offersAt(0).slice(0, MAX_PER_BOARD)) expect(model.quests.accept(q)).toBe(true);
    expect(model.quests.accept(model.quests.offersAt(0)[MAX_PER_BOARD])).toBe(false); // three from this board already
    expect(model.quests.available(0)).toBe(false);
    // Up to ten in all, one each from further boards (as if the world had more).
    const elsewhere = (board: number) => ({ ...first, board, key: `${board}:0` });
    for (let b = 1; b <= MAX_ACTIVE - MAX_PER_BOARD; b++) expect(model.quests.accept(elsewhere(b))).toBe(true);
    expect(model.quests.full).toBe(true);
    expect(model.quests.accept(elsewhere(MAX_ACTIVE))).toBe(false);
    model.quests.abandon(first.key);
    const bring = { ...model.quests.offersAt(0)[MAX_PER_BOARD], kind: 'collect' as const, item: 'wolfPelt' as const, count: 2 };
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

  it('tracks three at most: the fourth taken is untracked, and can only be tracked once one is let go', () => {
    const model = fresh();
    const offers = [...model.quests.offersAt(0).slice(0, 3), ...model.quests.offersAt(1).slice(0, 1)];
    for (const q of offers) model.quests.accept(q);
    expect(model.quests.taken.map((t) => t.tracked)).toEqual([true, true, true, false]);
    const [first, , , fourth] = offers;
    expect(model.quests.setTracked(fourth.key, true)).toBe(false);
    expect(model.quests.setTracked(first.key, false)).toBe(true);
    expect(model.quests.setTracked(fourth.key, true)).toBe(true);
    expect(model.quests.tracked).toBe(3);
  });

  it('shares what two quests both want: the first taken counts it first, and handing it in leaves the other its own', () => {
    const model = fresh();
    const [one, two] = model.quests.offersAt(0);
    const first = { ...one, kind: 'collect' as const, item: 'banditToken' as const, count: 4 };
    const second = { ...two, kind: 'collect' as const, item: 'banditToken' as const, count: 5 };
    model.quests.accept(first);
    model.quests.accept(second);
    const [a, b] = model.quests.taken;
    model.hero.bag.banditToken = 6;
    expect([model.quests.progress(a), model.quests.progress(b)]).toEqual([4, 2]); // not 4 and 5 from the same six
    expect(model.quests.handIn(first.key)).toBe(true);
    expect(model.quests.progress(b)).toBe(2); // still its two
  });

  it('sends the hero after boars too, for their hides, bristles, truffles and tusks', () => {
    const quests = TEST_SEEDS.flatMap((seed) => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      return model.villages.flatMap((_, board) => model.quests.offersAt(board));
    });
    const boars = quests.filter((q) => q.foe === 'boar');
    expect(boars.length).toBeGreaterThan(0);
    for (const q of boars) if (q.item) expect(['boarHide', 'bristleTuft', 'wildTruffle', 'greatTusk']).toContain(q.item);
  });

  it('asks for more than a pelt and a token across the boards', () => {
    const model = fresh();
    const items = model.villages.flatMap((_, board) => model.quests.offersAt(board).flatMap((q) => (q.item ? [q.item] : [])));
    expect(new Set(items).size).toBeGreaterThan(2);
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
    expect(marked(again, a.key).length).toBe(Math.min(4, a.kind === 'kill' ? 2 * (a.count - 1) : 2 * a.count)); // (twice those left, four at most)
  });
});

describe('quest levels', () => {
  it("are their village's: every quest on a board the same, farther villages higher (for better pay, farther out)", () => {
    const model = new GameModel(TEST_SEEDS[0], { width: 512, depth: 512 });
    const spawn = spawnOf(model.size);
    for (const [b, village] of model.villages.entries()) {
      const level = zoneLevel(spawn, village);
      for (let n = 0; n < OFFERS; n++) expect(questAt(model, b, n).level, `board ${b}`).toBe(level);
    }
    const byDistance = [...model.villages].sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z));
    expect(zoneLevel(spawn, byDistance[byDistance.length - 1])).toBeGreaterThan(zoneLevel(spawn, byDistance[0]));
  });
});
