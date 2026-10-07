// QA: the hero's hands, gear and setbacks, at their edges (model/hero/: hands.ts, wearing.ts, setbacks.ts). A full
// bag; indoors; a swap that frees its own room; worn gear dropped straight to the ground (never through the bag:
// a full bag no bar, and never half done); coins scooped; a fall's toll (never below nothing), where they wake, the
// foes losing interest; a collapse, on the inn's rug.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { addToBag, type BagItem } from '../src/model/hero/bag';
import { BAG_ROOM } from '../src/model/hero/bagSlots';
import { LOOT_IDS } from '../src/model/loot/loot';
import { isBagItem } from '../src/model/loot/bags';
import { maxHpOf } from '../src/model/hero/attributes';
import { spawnOf } from '../src/model/map/grid';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
const KINDS = LOOT_IDS.filter((id) => !isBagItem(id)) as BagItem[];
const fill = (model: GameModel, n = BAG_ROOM) => {
  for (const id of KINDS.slice(0, n)) addToBag(model.hero.bag, id);
};
const bagCount = (model: GameModel) => Object.values(model.hero.bag).reduce((a: number, n) => a + (n ?? 0), 0);

describe('the hero\'s hands', () => {
  it('picks up what lies in reach (counted for its quest), not what lies beyond it', () => {
    const model = fresh();
    model.dropLoot('wolfFang', model.hero.x + 0.3, model.hero.z);
    model.dropLoot('boarTusk', model.hero.x + 5, model.hero.z);
    expect(model.pickUp()).toBe('wolfFang');
    expect(model.hero.bag.wolfFang).toBe(1);
    expect(model.pickUp()).toBeNull(); // (the tusk, out of reach)
    expect(model.loot.map((l) => l.item)).toEqual(['boarTusk']);
  });

  it('drops a thing from the bag just ahead (one of it); nothing dropped indoors, the bag as it was', () => {
    const model = fresh();
    addToBag(model.hero.bag, 'wolfFang');
    addToBag(model.hero.bag, 'wolfFang');
    model.hero.facing = 0; // (+z)
    expect(model.dropFromBag('wolfFang')).toBe(true);
    expect(model.hero.bag.wolfFang).toBe(1);
    const [dropped] = model.loot;
    expect([dropped.x - model.hero.x, dropped.z - model.hero.z].map((v) => Math.round(v * 100) / 100)).toEqual([0, 0.45]);
    model.enterRoom(model.entrances.find((e) => e.type === 'inn')!);
    expect(model.dropFromBag('wolfFang')).toBe(false);
    expect(model.hero.bag.wolfFang).toBe(1);
  });

  it('drops what\'s worn straight on the ground, the bag full or not', () => {
    const model = fresh();
    model.hero.equipment.head = 'leatherCap';
    fill(model);
    const carried = bagCount(model);
    expect(model.dropEquipped('head')).toBe(true);
    expect(model.hero.equipment.head).toBeUndefined();
    expect(model.loot.map((l) => l.item)).toEqual(['leatherCap']);
    expect(bagCount(model)).toBe(carried); // (never through the bag)
  });

  it('drops nothing worn indoors, and leaves it worn: never half done', () => {
    const model = fresh();
    model.hero.equipment.head = 'leatherCap';
    model.enterRoom(model.entrances.find((e) => e.type === 'inn')!);
    expect(model.dropEquipped('head')).toBe(false);
    expect(model.hero.equipment.head).toBe('leatherCap'); // (still on)
    expect(model.hero.bag.leatherCap).toBeUndefined(); // (not slipped into the bag)
    expect(model.dropEquipped('feet')).toBe(false); // (nothing worn there)
  });

  it('scoops up coins near them as they pass, told; none farther off', () => {
    const model = fresh();
    model.dropCoins(7, model.hero.x + 0.2, model.hero.z);
    model.dropCoins(9, model.hero.x + 30, model.hero.z);
    const money = model.hero.money;
    model.update(0, 0, 0.05);
    expect(model.hero.money).toBe(money + 7);
    expect(model.takeEvents()).toContainEqual({ kind: 'coins', amount: 7 });
    expect(model.coins).toHaveLength(1);
  });
});

describe('the hero\'s gear', () => {
  it('swaps one worn for one in a full bag (the one taken out frees its room)', () => {
    const model = fresh();
    model.hero.equipment.head = 'leatherCap';
    fill(model, BAG_ROOM - 1);
    model.hero.bag.maskedHood = 1; // (the last slot: the bag full)
    expect(model.equipFromBag('maskedHood')).toBe(true);
    expect([model.hero.equipment.head, model.hero.bag.leatherCap, model.hero.bag.maskedHood]).toEqual(['maskedHood', 1, undefined]);
  });

  it("won't put on gear above their level, the bag as it was", () => {
    const model = fresh();
    const high = 'greatHelm@30c0' as BagItem;
    model.hero.bag[high] = 1;
    expect(model.equipFromBag(high as never)).toBe(false);
    expect([model.hero.bag[high], model.hero.equipment.head]).toEqual([1, undefined]);
  });
});

describe('the hero\'s setbacks', () => {
  it('a fall: a quarter of their coin lost (rounded their way), healed, Weary, at spawn before any inn; chasers lose interest', () => {
    const model = fresh();
    Object.assign(model.hero, { money: 103, hp: 1 });
    const chaser = model.enemies[0];
    chaser.state = 'chase';
    model.fall();
    expect(model.hero.money).toBe(103 - Math.floor(103 * 0.25));
    expect(model.hero.hp).toBe(maxHpOf(model.hero));
    expect(model.hero.blessings?.some((b) => b.kind === 'weary')).toBe(true);
    const spawn = spawnOf(model.size);
    expect([model.hero.x, model.hero.z]).toEqual([spawn.x, spawn.z]);
    expect(chaser.state).toBe('wander');
  });

  it('a fall with no coin costs none (never below nothing); after an inn, wakes in it', () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    model.useDoor();
    model.hero.money = 0;
    model.fall();
    expect(model.hero.money).toBe(0);
    expect(model.inside?.entrance).toBe(inn);
  });

  it('a collapse (out of energy): in the nearest inn, lying on its rug before the fire, some energy back', () => {
    const model = fresh();
    model.hero.energy = 0;
    model.update(0, 0, 0.05);
    expect(model.inside?.entrance.type).toBe('inn');
    expect(model.inside?.seated?.seat.lying).toBe(true);
    expect(model.hero.energy).toBeGreaterThan(0);
  });
});
