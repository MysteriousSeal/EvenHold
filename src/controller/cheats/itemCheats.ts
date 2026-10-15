// The cheat menu's Items tab (cheatPanel.ts): coin into the purse; gear, bags, potions, food and junk into the bag;
// every loot item on the ground.
import type { GameModel } from '../../model/GameModel';
import { BANDIT_OUTFIT, STARTER_SET } from '../../model/human/equipment';
import { LOOT_IDS, type LootId } from '../../model/loot/loot';
import { BAG_IDS } from '../../model/loot/bags';
import { POTION_IDS } from '../../model/loot/potions';
import { JUNK_ITEMS } from '../../model/loot/junk';
import { PROVISION_IDS } from '../../model/loot/provisions';
import { MEAL_IDS } from '../../model/loot/meals';
import { COOK_RECIPES, COOK_RECIPE_IDS } from '../../model/skills/cooking';
import { JUNK_STACK, slotsUsed } from '../../model/hero/bagStacks';
import { bagRoom } from '../../model/hero/bagSlots';
import { COPPER_PER_SILVER, SILVER_PER_GOLD } from '../../model/hero/money';
import type { MenuAction } from '../../view/ui/menu';
import { lootIcon } from '../../view/ui/itemIcons';
import { ICONS as ICON, itemIcon } from './cheatIcons';
import { give, group } from './cheatRows';

export function itemActions(model: GameModel): MenuAction[] {
  return [
    ...group('Money', [
      { icon: itemIcon('goldRing'), title: 'Add 1 gold', detail: 'Into the purse', run: () => ((model.hero.money += COPPER_PER_SILVER * SILVER_PER_GOLD), 'A gold coin, added.') },
      { icon: itemIcon('silverRing'), title: 'Add 10 silver', detail: 'Into the purse', run: () => ((model.hero.money += 10 * COPPER_PER_SILVER), 'Ten silver, added.') },
    ]),
    ...group('Into the bag', [
      {
        icon: ICON.wardrobe,
        title: 'Starter & bandit gear',
        detail: 'Both outfits, to wear from the hero sheet',
        run: () => (give(model, [...STARTER_SET, ...BANDIT_OUTFIT]), 'Gear, in the bag.'),
      },
      { icon: lootIcon('roughSack'), title: 'Every bag', detail: 'One of each, to fit to the sockets', run: () => (give(model, BAG_IDS), 'One of every bag, in the bag.') },
      { icon: lootIcon('fishingRod'), title: 'A fishing rod', detail: 'To fish from a lake shore (E facing the water)', run: () => (give(model, ['fishingRod']), 'A fishing rod, in the bag.') },
      { icon: lootIcon('greaterHealthPotion'), title: 'Every potion', detail: 'Three of each', run: () => (give(model, POTION_IDS.flatMap((id) => [id, id, id])), 'Potions, in the bag.') },
      { icon: lootIcon('bread'), title: 'Every food & drink', detail: 'Five of each', run: () => (give(model, PROVISION_IDS.flatMap((id) => [id, id, id, id, id])), 'Food and drink, in the bag.') },
      { icon: lootIcon('huntersFeast'), title: 'Every meal', detail: "Three of each a cook makes", run: () => (give(model, MEAL_IDS.flatMap((id) => [id, id, id])), 'Meals, in the bag.') },
      { icon: lootIcon('rawBoarMeat'), title: "A cook's larder", detail: 'Ten of every making, two logs for a fire', run: () => (give(model, [...new Set(COOK_RECIPE_IDS.flatMap((id) => Object.keys(COOK_RECIPES[id].from) as LootId[]))].flatMap((id) => Array<LootId>(10).fill(id)).concat(['birchLog', 'birchLog'])), 'Makings for every recipe, in the bag.') },
      {
        icon: lootIcon('wolfFang'),
        title: 'Fill the bag with junk',
        detail: 'Full stacks of junk in every free slot',
        run: () => {
          const junk = Object.keys(JUNK_ITEMS) as LootId[];
          for (let i = 0; slotsUsed(model.hero.bag) < bagRoom(model.hero); i++) give(model, Array.from({ length: JUNK_STACK }, () => junk[i % junk.length])); // (round the junk again: another full stack each)
          return 'The bag is full of junk.';
        },
      },
      { icon: ICON.undress, title: 'Empty the bag', detail: 'Everything in it gone (fitted bags stay)', run: () => (Object.assign(model.hero, { bag: {}, bagOrder: [], bagCounts: [] }), 'The bag is empty.') },
    ]),
    ...group('On the ground', [
      {
        icon: lootIcon('rustyBuckle'),
        title: 'Every loot item, around you',
        detail: 'One of each kind, on the ground in a ring',
        run: () => {
          LOOT_IDS.forEach((item, i) => {
            const a = (i / LOOT_IDS.length) * Math.PI * 2;
            model.dropLoot(item, model.hero.x + Math.cos(a) * 1.2, model.hero.z + Math.sin(a) * 1.2);
          });
          return 'Loot all around.';
        },
      },
    ]),
  ];
}
