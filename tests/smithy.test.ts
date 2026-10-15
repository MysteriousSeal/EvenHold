import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { layoutOf } from '../src/model/interiors/indoors';
import { ITEMS } from '../src/model/human/equipment';
import { LOOT } from '../src/model/loot/loot';
import { pedlarBuys, pedlarPrice } from '../src/model/travellers/pedlarShop';
import { saleOf } from '../src/model/shops/sellValue';
import { SMITH_WARES, UNDER_COUNTER, smithAsks, smithPriceFor, smithSellsTo, buyGear, gearPrice, gearSellPrice, sellGear, smithBuys, smithShopAt } from '../src/model/smithy/smithShop';
import { talkingTo } from '../src/model/npcs/talk';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 30;

// The hero in the nearest smithy.
function atTheSmithy(): GameModel {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (enterNearest(model, 'smithy', new Set())) return model;
  }
  throw new Error('no smithy');
}

describe('the smithy', () => {
  it('has a smith in every smithy, and his counter, forge, anvil, bellows, trough, grindstone, armour stand and weapons on show', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const smithies = model.entrances.filter((e) => e.type === 'smithy');
    expect(smithies.length).toBeGreaterThan(0);
    for (const smithy of smithies) {
      expect(model.npcs.filter((n) => n.role === 'smith' && n.home === smithy)).toHaveLength(1);
      const { room, furniture } = layoutOf(model.seed, smithy);
      for (const kind of ['smithCounter', 'forge', 'bellows', 'anvil', 'grindstone', 'trough', 'rack', 'coal', 'barrel', 'weaponWall', 'toolBoard'] as const) expect(furniture.some((f) => f.kind === kind), kind).toBe(true);
      const anvil = furniture.find((f) => f.kind === 'anvil')!;
      const grindstone = furniture.find((f) => f.kind === 'grindstone')!;
      expect([grindstone.z, Math.abs(grindstone.x - anvil.x)]).toEqual([anvil.z, 1]); // side by side
      const forge = furniture.find((f) => f.kind === 'forge')!;
      expect(furniture.some((f) => f.solid && f.z <= 1 && f.z + f.d > 1 && f.x < forge.x + forge.w && f.x + f.w > forge.x)).toBe(false); // the row before the forge free
      const trough = furniture.find((f) => f.kind === 'trough')!;
      expect(trough.z === 0 && (trough.x === forge.x + forge.w || trough.x === forge.x - 2)).toBe(true); // along the back wall, by the forge
      const stands = furniture.filter((f) => f.kind === 'armorStand');
      expect(stands.length).toBeGreaterThanOrEqual(2); // armour on stands, against the walls, in suits of their own
      expect(stands.every((f) => f.wall !== 'none')).toBe(true);
      expect(new Set(stands.map((f) => f.suit)).size).toBe(stands.length);
      expect(furniture.every((f) => f.x > room.door || f.x + f.w <= room.door || f.z + f.d <= room.depth - 1 || !f.solid)).toBe(true); // the way in clear
    }
  });

  it('sells what he forges at its value, buys gear back at half (not food, not jewellery), from a stock and purse of his own', () => {
    const model = atTheSmithy();
    const shop = smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    expect(SMITH_WARES.length).toBeGreaterThan(0);
    expect(SMITH_WARES.every((id) => ITEMS[id].soldBy?.smith && ITEMS[id].value)).toBe(true);
    const ware = SMITH_WARES.find((id) => (shop.stock[id] ?? 0) > 0)!;
    model.hero.money = gearPrice(ware);
    expect(buyGear(shop, model.hero, ware)).toBe('bought');
    expect(model.hero.money).toBe(0);
    expect(model.hero.bag[ware]).toBe(1);
    expect(sellGear(shop, model.hero, ware)).toBe('sold');
    expect(model.hero.money).toBe(gearSellPrice(ware));
    expect(gearSellPrice(ware)).toBe(Math.floor(gearPrice(ware) / 2));
    expect(smithBuys('ale')).toBe(false);
    expect(Object.keys(ITEMS).filter((id) => ['neck', 'ring'].includes(ITEMS[id as keyof typeof ITEMS].slot)).every((id) => !smithBuys(id))).toBe(true);
    // Kept in the save.
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    const kept = smithShopAt(again.shops, again.seed, again.entrances.indexOf(again.inside!.entrance));
    expect(kept.stock[ware]).toBe(shop.stock[ware]);
  });

  it("keeps his heaviest work for a hero who's proven: to a green one, a breastplate only under the counter, at a bribe's price", () => {
    const model = atTheSmithy();
    const shop = smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    Object.assign(model.hero, { level: 1, money: 100_000 });
    shop.stock.breastplate = 2;
    expect(smithAsks('breastplate')).toBe(7);
    expect(smithSellsTo(model.hero, 'breastplate')).toBe(false);
    expect(smithPriceFor(model.hero, 'breastplate')).toBe(Math.ceil(gearPrice('breastplate') * UNDER_COUNTER));
    expect(buyGear(shop, model.hero, 'breastplate')).toBe('bought');
    expect(model.hero.money).toBe(100_000 - Math.ceil(gearPrice('breastplate') * UNDER_COUNTER));
    expect(smithAsks('dagger')).toBe(1);
    model.hero.level = 7;
    const money = model.hero.money;
    expect(buyGear(shop, model.hero, 'breastplate')).toBe('bought');
    expect(money - model.hero.money).toBe(gearPrice('breastplate')); // (proven: its price)
  });

  it('takes the iron salvaged from gear at half its worth; a pedlar the silver and stones; logs and leather, no one', () => {
    const model = atTheSmithy();
    const shop = smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    Object.assign(model.hero, { money: 0, bag: { ironScrap: 1, temperedIngot: 1, leatherStrip: 1 } });
    expect(sellGear(shop, model.hero, 'temperedIngot')).toBe('sold');
    expect(sellGear(shop, model.hero, 'ironScrap')).toBe('sold');
    expect(model.hero.money).toBe(LOOT.temperedIngot.value / 2 + LOOT.ironScrap.value / 2);
    expect(sellGear(shop, model.hero, 'leatherStrip')).toBe('not wanted');
    expect([pedlarBuys('cutGem'), pedlarPrice('cutGem', true)]).toEqual([true, LOOT.cutGem.value / 2]);
    for (const id of ['oakLog', 'oakPlank', 'leatherStrip', 'linenScrap'] as const) expect(saleOf(id), id).toBeNull();
    expect(saleOf('ironScrap')).toEqual({ price: LOOT.ironScrap.value / 2, to: 'a smith' });
  });

  it('comes to his counter when the hero is by it, to trade (E)', () => {
    const model = atTheSmithy();
    const { furniture } = model.inside!;
    const counter = furniture.find((f) => f.kind === 'smithCounter')!;
    Object.assign(model.hero, { x: counter.x, z: counter.z + 1 }); // before it
    for (let t = 0; t < 20; t += FRAME) model.update(0, 0, FRAME);
    const smith = model.npcs.find((n) => n.role === 'smith' && n.where === model.inside!.entrance)!;
    expect(Math.abs(smith.z - (counter.z - 0.6))).toBeLessThan(0.05); // up against its back
    expect(talkingTo(model.npcs, model.inside, model.hero)).toBe(smith);
  });
});
