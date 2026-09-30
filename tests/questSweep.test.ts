import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { OFFERS, questTitle, type QuestFoe } from '../src/model/quests/quests';
import { FIRST_MOB_ID } from '../src/model/quests/questBook';
import { QUEST_ITEMS_OF } from '../src/model/quests/questItems';
import { LOOT, LOOT_IDS, rollDrop, type LootSource } from '../src/model/loot/loot';
import { ENEMY_STATS } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const NEAR = 14; // tiles from the village, the nearest a quest's foes gather (quests.ts)

describe('every notice board in every test world', () => {
  for (const seed of TEST_SEEDS) {
    it(`offers six sound quests, out beyond its village (seed ${seed})`, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const problems: string[] = [];
      for (const [board, village] of model.villages.entries()) {
        const offers = model.quests.offersAt(board);
        expect(offers).toHaveLength(OFFERS);
        expect(new Set(offers.map((q) => q.key)).size).toBe(OFFERS);
        for (const q of offers) {
          const at = `board ${board} "${questTitle(q)}"`;
          if (!model.isOpenTile(q.x, q.z)) problems.push(`${at}: its foes gather on no open ground`);
          if (Math.hypot(q.x - village.x, q.z - village.z) < NEAR - 1) problems.push(`${at}: its foes gather in the village`);
          if (q.kind === 'kill' ? q.count < 6 || q.count > 8 : q.count < 4 || q.count > 6) problems.push(`${at}: asks ${q.count}`);
          if (q.kind === 'collect' && !QUEST_ITEMS_OF[q.foe].includes(q.item!)) problems.push(`${at}: wants what its foe doesn't carry`);
          if (!(q.copper > 0 && q.xp > 0 && q.level >= 1)) problems.push(`${at}: pays nothing`);
        }
      }
      expect(problems).toEqual([]);
    });

    it(`can have a quest of each kind taken, its foes gathering, done and handed in (seed ${seed})`, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const offers = model.quests.offersAt(0);
      for (const kind of ['kill', 'collect'] as const) {
        const quest = offers.find((q) => q.kind === kind);
        if (!quest) continue;
        expect(model.quests.accept(quest)).toBe(true);
        const marked = model.enemies.filter((e) => e.id >= FIRST_MOB_ID && e.kind === quest.foe && Math.hypot(e.x - quest.x, e.z - quest.z) < 8);
        expect(marked.length, `${kind} quest's foes gathered`).toBeGreaterThan(0);
        for (const foe of marked) expect(model.isBlocked(foe.x, foe.z, 0.05), 'a marked foe in a wall').toBe(false);
        const taken = model.quests.takenOf(quest.key)!;
        if (kind === 'kill') {
          for (let i = 0; i < quest.count; i++) model.quests.onKill(marked[i % marked.length]);
        } else {
          model.hero.bag[quest.item!] = quest.count;
          model.quests.onPickUp(quest.item!);
        }
        expect(model.quests.done(taken)).toBe(true);
        const [money, xp, level] = [model.hero.money, model.hero.xp, model.hero.level];
        expect(model.quests.handIn(quest.key)).toBe(true);
        expect(model.hero.money).toBe(money + quest.copper);
        expect(model.hero.xp > xp || model.hero.level > level).toBe(true);
        expect(model.quests.isCompleted(quest.key)).toBe(true);
        if (kind === 'collect') expect(model.hero.bag[quest.item!] ?? 0).toBe(0); // given up
      }
    });
  }
});

describe('loot', () => {
  it('is all named and priced, and every foe a quest can ask for drops something', () => {
    for (const id of LOOT_IDS) {
      expect(LOOT[id].name.length, id).toBeGreaterThan(0);
      expect(LOOT[id].value, id).toBeGreaterThanOrEqual(0);
    }
    for (const foe of ['wolf', 'bandit', 'boar'] as QuestFoe[]) {
      const source = ENEMY_STATS[foe].family as LootSource;
      const drops = new Set(Array.from({ length: 400 }, (_, i) => rollDrop(source, i, 1)).filter(Boolean));
      expect(drops.size, `${foe} drops`).toBeGreaterThan(0);
    }
  });
});
