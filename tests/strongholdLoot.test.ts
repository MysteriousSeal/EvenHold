// A stronghold's five named pieces (model/human/items/namedGear.ts,
// strongholds/strongholdLoot.ts), as the rest of the game has them: each
// called by its own name wherever a thing's name is told; its own armour and
// stats those of a piece of its base, level and rarity, its extra lines those
// listed for it, each as strong as that line on any piece of its level and
// rarity; kept by a save, in the bag and worn; put on by a hero of its level
// and taken off again, never by one below it; sold to a smith and bought back
// the same (a necklace he won't have, as any); broken down at a smithy's
// bench for what its base is made of. And never to be had any other way:
// nothing a slain foe leaves, a hoard holds or a smith sells is one.
// (Where each is dropped, once: strongholdRun.test.ts.)
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { addToBag, nameOf } from '../src/model/hero/bag';
import { ITEMS } from '../src/model/human/equipment';
import { RARITIES, canWear, gearKey, gearName, gearOf, gearSpecs, isGear, levelOf, namedGear, namedIn, rarityOf, slotOfGear, tierOf, type GearKey } from '../src/model/human/items/gear';
import { NAMED, NAMED_FROM, type NamedId } from '../src/model/human/items/namedGear';
import { rollGearDrop } from '../src/model/loot/gearDrops';
import { rollHoard } from '../src/model/loot/hoard';
import { makeEnemy } from '../src/model/enemies/enemies';
import { parseSave, restore, snapshot } from '../src/model/save';
import { buyBack } from '../src/model/shops/shopStock';
import { BREAK_SECONDS, makeOf, salvageOf, scrapOf } from '../src/model/skills/salvage';
import { gearSellPrice, sellGear, smithBuys, smithShopAt, smithShopIn } from '../src/model/smithy/smithShop';
import { BOSS_PIECE, bossPiece } from '../src/model/strongholds/strongholdLoot';
import type { EnemyKind } from '../src/model/types';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const IDS = Object.keys(NAMED).map(Number) as NamedId[];
const LEVELS = [1, 4, 9, 17];
const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
const inSmithy = () => {
  const model = fresh();
  const smithy = model.entrances.find((e) => e.type === 'smithy')!;
  model.teleport(smithy.x, smithy.z);
  model.useDoor();
  const bench = model.inside!.furniture.find((f) => f.kind === 'salvageBench')!;
  Object.assign(model.hero, { x: bench.x, z: bench.z + 1 });
  return model;
};
const rollOf = (key: GearKey) => gearOf(key).roll;

describe("a stronghold's named pieces", () => {
  it('are five, one to a boss, each called by its own name wherever a thing is named, on a base of the catalog', () => {
    expect(Object.keys(BOSS_PIECE).sort()).toEqual(['banditKing', 'captain', 'gaoler', 'houndmaster', 'quartermaster']);
    expect(new Set(Object.values(BOSS_PIECE)).size).toBe(5);
    const names = new Set<string>();
    for (const kind of Object.keys(BOSS_PIECE) as EnemyKind[]) {
      for (const level of LEVELS) {
        const piece = bossPiece(kind, level)!;
        const named = NAMED[BOSS_PIECE[kind]!];
        expect(isGear(piece)).toBe(true);
        expect([gearName(piece), nameOf(piece), namedIn(piece)?.name]).toEqual([named.name, named.name, named.name]);
        expect(gearName(piece)).not.toBe(ITEMS[named.item].name);
        expect([gearOf(piece).item, levelOf(piece), rarityOf(piece), rollOf(piece)]).toEqual([named.item, level, named.rarity, BOSS_PIECE[kind]]);
        names.add(named.name);
      }
    }
    expect(names.size).toBe(5);
    expect(rarityOf(bossPiece('banditKing', 3)!)).toBe('legendary');
    for (const kind of ['houndmaster', 'quartermaster', 'gaoler', 'captain'] as const) expect(rarityOf(bossPiece(kind, 3)!)).toBe('epic');
    for (const kind of Object.keys(ENEMY_STATS) as EnemyKind[]) expect(!!bossPiece(kind, 2)).toBe(kind in BOSS_PIECE);
  });

  it('have the stats listed for them: their base\'s own, and their extra lines in order, each as strong as that line on any piece of its level and rarity', () => {
    for (const id of IDS) {
      const named = NAMED[id];
      for (const level of LEVELS) {
        const piece = namedGear(id, level);
        const specs = gearSpecs(piece);
        const extra = specs.lines.filter((l) => l.extra);
        expect(extra.map((l) => l.kind)).toEqual([...named.lines]);
        expect(extra).toHaveLength(tierOf(named.rarity));
        expect(extra.every((l) => l.amount > 0)).toBe(true);
        // Beside found pieces of its base, level and rarity (every roll there is): the same lines of its own, and each
        // extra line as strong as the same line found.
        const found = Array.from({ length: NAMED_FROM }, (_, roll) => gearSpecs(gearKey({ item: named.item, level, rarity: named.rarity, roll })));
        const own = (s: typeof specs) => s.lines.filter((l) => !l.extra).map((l) => [l.kind, l.amount]);
        expect(own(specs)).toEqual(own(found[0]));
        for (const line of extra) {
          const same = found.flatMap((s) => s.lines.filter((l) => l.extra && l.kind === line.kind));
          expect(same.length, `${named.name}: no found ${named.item} ever rolls ${line.kind}`).toBeGreaterThan(0);
          expect(new Set(same.map((l) => l.amount))).toEqual(new Set([line.amount]));
        }
      }
    }
  });

  it('are kept by a save and a load, in the bag and worn; worn by a hero of their level and taken off again, never by one below it', () => {
    for (const id of IDS) {
      const model = fresh();
      const { hero } = model;
      const [low, high] = [namedGear(id, 1), namedGear(id, 6)];
      const slot = slotOfGear(low);
      addToBag(hero.bag, low);
      addToBag(hero.bag, high);
      expect([canWear(low, hero.level), canWear(high, hero.level)]).toEqual([true, false]);
      expect(model.equipFromBag(high)).toBe(false);
      expect(model.equipFromBag(low)).toBe(true);
      expect([hero.equipment[slot], hero.bag[low] ?? 0, hero.bag[high]]).toEqual([low, 0, 1]);
      const loaded = fresh();
      restore(loaded, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
      expect([loaded.hero.equipment[slot], loaded.hero.bag[high], loaded.hero.bag[low] ?? 0]).toEqual([low, 1, 0]);
      expect(gearName(loaded.hero.equipment[slot]!)).toBe(NAMED[id].name);
      expect(loaded.unequip(slot)).toBe(true);
      expect([loaded.hero.equipment[slot], loaded.hero.bag[low]]).toEqual([undefined, 1]);
      loaded.hero.level = 6;
      expect(loaded.equipFromBag(high)).toBe(true);
      expect(loaded.hero.equipment[slot]).toBe(high);
    }
  });

  it('are sold to a smith for more than a plain one of their base and bought back the same (a necklace he won\'t have); broken down at his bench for what their base is made of', () => {
    for (const id of IDS) {
      const model = inSmithy();
      const { hero } = model;
      const piece = namedGear(id, 2);
      addToBag(hero.bag, piece);
      addToBag(hero.bag, piece);
      const shop = smithShopIn(model);
      shop.money = 100_000;
      const purse = hero.money;
      if (smithBuys(piece)) {
        expect(gearSellPrice(piece)).toBeGreaterThan(gearSellPrice(NAMED[id].item));
        expect(sellGear(shop, hero, piece)).toBe('sold');
        expect([hero.bag[piece], hero.money]).toEqual([1, purse + gearSellPrice(piece)]);
        expect(shop.buyback?.[0]?.id).toBe(piece);
        hero.money += 100_000;
        expect(buyBack(shop, hero, 0)).toBe('bought');
        expect(hero.bag[piece]).toBe(2);
      } else {
        expect(slotOfGear(piece)).toBe('neck');
        expect(sellGear(shop, hero, piece)).toBe('not wanted');
        expect(hero.bag[piece]).toBe(2);
      }
      // At the bench, with the skill it asks (its finer things too): broken down.
      const { needs } = salvageOf(piece);
      const { gives } = salvageOf(piece, needs); // (what it leaves at the skill it asks: more, the more skilled)
      expect(gives[0][0]).toBe(scrapOf(makeOf(NAMED[id].item), levelOf(piece)));
      expect(model.salvage.candidates).toContain(piece);
      hero.skills = { ...hero.skills, salvaging: { level: needs, toward: 0 } as never };
      expect(model.salvage.start(piece)).toBe('started');
      for (let t = 0; t < BREAK_SECONDS + 0.1 && model.salvage.breaking; t += 1 / 30) model.update(0, 0, 1 / 30);
      expect(model.takeEvents()).toContainEqual({ kind: 'salvaged', item: piece, gives });
      expect(hero.bag[piece]).toBe(1);
      for (const [item, n] of gives) expect(hero.bag[item]).toBe(n);
    }
  });

  it('are never to be had another way: nothing a slain foe leaves, a hoard holds or a smith sells is one, at any level', () => {
    let seen = 0;
    const plain = (key: string | null | undefined) => {
      if (!key || !isGear(key)) return;
      seen++;
      if (namedIn(key) || rollOf(key) >= NAMED_FROM) throw new Error(`${key} is a named piece's key`);
    };
    for (const kind of Object.keys(ENEMY_STATS) as EnemyKind[]) {
      for (let id = 0; id < 1500; id++) plain(rollGearDrop(makeEnemy(id, kind, id % 50, id % 37, 0, 0, 1 + (id % 20)), 4));
    }
    for (let i = 0; i < 1500; i++) plain(rollHoard(i, i * 7, 5519 + (i % 9), 1 + (i % 20), { worth: 150, base: 90, spread: 60 }).item);
    for (let smithy = 0; smithy < 40; smithy++) for (const key of Object.keys(smithShopAt(new Map(), 100 + smithy, smithy, 0, 1 + (smithy % 20)).stock)) plain(key);
    expect(seen).toBeGreaterThan(5000);
    // A key with a named piece's number on another base, or a number that's no one's: plain gear, no name of its own.
    for (const rarity of RARITIES) {
      expect(namedIn(gearKey({ item: 'armingSword', level: 3, rarity, roll: 1005 }))).toBeNull();
      expect(namedIn(gearKey({ item: 'broadAxe', level: 3, rarity, roll: 1500 }))).toBeNull();
      expect(gearSpecs(gearKey({ item: 'broadAxe', level: 3, rarity, roll: 1500 })).lines.filter((l) => l.extra)).toHaveLength(tierOf(rarity));
    }
  });
});
