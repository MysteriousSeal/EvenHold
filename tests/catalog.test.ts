// Everything that can be carried, one by one: every piece of gear (its
// slot, stats, armour, price, model) and every kind of loot (its worth,
// quality, model, and who'd buy it).
import { isBagItem } from '../src/model/loot/bags';
import { pedlarPrice } from '../src/model/travellers/pedlarShop';
import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_IDS, SLOT_NAMES, isHeldSlot, isJewelrySlot, type ItemId } from '../src/model/human/equipment';
import { STATS } from '../src/model/hero/statKinds';
import { gearPrice, gearSellPrice, smithBuys } from '../src/model/smithy/smithShop';
import { sellValue, isJunk } from '../src/model/shops/sellValue';
import { LOOT, LOOT_IDS, LOOT_QUALITY, type LootId } from '../src/model/loot/loot';
import { isProvision, PROVISIONS } from '../src/model/loot/provisions';
import { isQuestItem } from '../src/model/quests/questItems';
import { buyPrice, sellPrice } from '../src/model/inn/tavernShop';
import { gearLines } from '../src/controller/hero/gearLines';
import { ITEM_MODELS } from '../src/view/meshes/human/gear/itemModels';
import { LOOT_MODELS } from '../src/view/meshes/loot/lootModels';

describe.each(ITEM_IDS.map((id) => [id]))('%s', (id: ItemId) => {
  const item = ITEMS[id];

  it('is named, goes in a slot, and adds to the stats (whole points), with whole armour if any', () => {
    expect(item.name.trim().length).toBeGreaterThan(2);
    expect(SLOT_NAMES[item.slot]).toBeDefined();
    const stats = item.stats ?? {};
    expect(STATS.some((s) => (stats[s] ?? 0) > 0)).toBe(true);
    for (const n of Object.values(stats)) expect(Number.isInteger(n) && n! > 0 && n! <= 5).toBe(true);
    const armor = item.armor ?? 0;
    expect(Number.isInteger(armor) && armor >= 0 && armor <= 10).toBe(true);
    if (isJewelrySlot(item.slot) || item.slot === 'mainHand') expect(armor).toBe(0);
    // Its tooltip tells all of it.
    expect(gearLines(id)).toHaveLength((armor ? 1 : 0) + Object.keys(stats).length);
    // Its model, to wear or hold.
    expect(ITEM_MODELS[id]).toBeDefined();
    if (isHeldSlot(item.slot)) expect(ITEM_MODELS[id].held).toBeDefined();
    // Worth more bought than sold; the smith sells only what he makes, and has a price for it.
    expect(gearSellPrice(id)).toBeLessThanOrEqual(gearPrice(id));
    if (item.soldBy?.smith) expect(item.value).toBeGreaterThan(0);
    expect(smithBuys(id)).toBe(!isJewelrySlot(item.slot));
    expect(sellValue(id)).toBe(smithBuys(id) ? gearSellPrice(id) : null);
  });
});

describe.each(LOOT_IDS.map((id) => [id]))('loot: %s', (id: LootId) => {
  const loot = LOOT[id];

  it('is named, has its worth and quality, a model, and is sold (or not) as its kind is', () => {
    expect(loot.name.trim().length).toBeGreaterThan(2);
    expect(loot.value).toBeGreaterThanOrEqual(0);
    expect(['junk', 'ingredient', 'common', 'quest', 'bag']).toContain(LOOT_QUALITY[id]);
    expect(LOOT_MODELS[id].build().cells.some((c) => c > 0)).toBe(true);
    for (const w of Object.values(loot.droppedBy)) expect(w).toBeGreaterThan(0);
    if (isProvision(id)) {
      expect(sellValue(id)).toBe(sellPrice(id)); // the barmaid buys food and drink…
      expect(sellPrice(id)).toBeLessThan(buyPrice(id) + 1); // …for less than she sells it
      expect(PROVISIONS[id].drink ? PROVISIONS[id].energy : PROVISIONS[id].heal).toBeGreaterThan(0); // (food heals, drink gives energy)
      expect(PROVISIONS[id].drink ? PROVISIONS[id].heal : PROVISIONS[id].energy).toBeUndefined();
    } else if (isJunk(id)) expect(sellValue(id)).toBe(loot.value); // anyone buys junk, at its worth
    else if (isQuestItem(id)) expect(sellValue(id)).toBeNull(); // quest items: kept for the quest
    else if (isBagItem(id)) expect(pedlarPrice(id, true)).toBeLessThan(pedlarPrice(id, false)); // bags: sold back to a pedlar for less
  });
});
