import { describe, expect, it } from 'vitest';
import { ENEMY_STATS } from '../src/model/constants';
import { DROP_CHANCE, LOOT, LOOT_IDS, PICKUP_RANGE, rollDrop, type LootSource } from '../src/model/loot/loot';
import { LOOT_MODELS } from '../src/view/meshes/loot/lootModels';
import { INGREDIENTS } from '../src/model/loot/ingredients';
import { JUNK_ITEMS } from '../src/model/loot/junk';
import { PROVISIONS } from '../src/model/loot/provisions';
import { QUEST_ITEMS } from '../src/model/quests/questItems';
import { fresh, slay } from './support/testWorld';

const drops = (source: LootSource) => Array.from({ length: 400 }, (_, id) => rollDrop(source, id));

describe('loot ids', () => {
  it('are never shared between junk, ingredients, provisions and quest items (one would hide the other)', () => {
    const ids = [...Object.keys(JUNK_ITEMS), ...Object.keys(INGREDIENTS), ...Object.keys(PROVISIONS), ...Object.keys(QUEST_ITEMS)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('loot drops', () => {
  it('drops about half the time, only what that family of enemy carries', () => {
    for (const source of ['beast', 'humanoid'] as const) {
      const all = drops(source);
      const dropped = all.filter((d) => d !== null);
      expect(dropped.length / all.length).toBeGreaterThan(DROP_CHANCE - 0.1);
      expect(dropped.length / all.length).toBeLessThan(DROP_CHANCE + 0.1);
      for (const item of dropped) expect(LOOT[item!].droppedBy[source]).toBeGreaterThan(0);
      // Every item of that family shows up.
      const kinds = LOOT_IDS.filter((id) => LOOT[id].droppedBy[source]);
      expect(new Set(dropped).size).toBe(kinds.length);
    }
    expect(rollDrop('beast', 7)).toBe(rollDrop('beast', 7)); // the same fight, the same loot
  });

  it('wolves are beasts and bandits humanoids, and every item has a model', () => {
    expect(ENEMY_STATS.wolf.family).toBe('beast');
    expect(ENEMY_STATS.bandit.family).toBe('humanoid');
    for (const id of LOOT_IDS) expect(LOOT_MODELS[id].build().cells.some((c) => c > 0)).toBe(true);
  });
});

describe('picking up loot', () => {
  it('only within reach, into the bag, and off the ground', () => {
    const model = fresh();
    expect(model.pickUp()).toBeNull();
    model.dropLoot('wolfFang', model.hero.x + PICKUP_RANGE + 0.3, model.hero.z);
    expect(model.lootInReach).toBeNull();
    model.dropLoot('bentSpoon', model.hero.x + 0.4, model.hero.z);
    expect(model.lootInReach?.item).toBe('bentSpoon');
    expect(model.pickUp()).toBe('bentSpoon');
    expect(model.hero.bag).toEqual({ bentSpoon: 1 });
    expect(model.loot.map((l) => l.item)).toEqual(['wolfFang']);
  });

  it('a slain enemy may leave loot where it fell', () => {
    // Find a wolf whose id rolls a drop, and kill it.
    const model = fresh();
    model.godMode = true;
    const wolf = model.enemies.find((e) => e.kind === 'wolf' && rollDrop('beast', e.id) !== null)!;
    model.enemies.splice(0, model.enemies.length, wolf);
    slay(model, wolf);
    expect(model.loot).toHaveLength(1);
    expect(model.loot[0].item).toBe(rollDrop('beast', wolf.id));
    expect(Math.hypot(model.loot[0].x - wolf.x, model.loot[0].z - wolf.z)).toBeLessThan(0.5);
  });

  it('drops one item from the bag just in front of the hero', () => {
    const model = fresh();
    model.hero.bag.wolfFang = 2;
    model.update(1, 0, 1e-6); // facing +X
    expect(model.dropFromBag('wolfFang')).toBe(true);
    expect(model.hero.bag.wolfFang).toBe(1);
    const [dropped] = model.loot;
    expect(dropped.item).toBe('wolfFang');
    expect(dropped.x).toBeGreaterThan(model.hero.x);
    expect(Math.hypot(dropped.x - model.hero.x, dropped.z - model.hero.z)).toBeLessThan(PICKUP_RANGE); // right there to pick back up
    expect(model.dropFromBag('wolfFang')).toBe(true);
    expect(model.hero.bag).toEqual({});
    expect(model.dropFromBag('wolfFang')).toBe(false);
  });
});
