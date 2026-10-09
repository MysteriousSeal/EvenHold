// The game's windows as the AI works them (player.ts): each a list of rows (what a player reads there: what it is,
// its price, whether they can afford, wear or make it, whether it's better than what's worn) and the clicks a player
// makes in it (a row's button, the row's other button, the other page, the list scrolled). Each is built from the
// model exactly as its panel is (controller/…Panel.ts), and does what the panel's click does, by the same model
// calls. A modal one (the board's, the jobs') holds the game as the real one does; the others shut when the hero
// walks off, as the real ones do.
import type { GameModel } from '../../src/model/GameModel';
import type { Npc } from '../../src/model/npcs/npcs';
import type { Traveller } from '../../src/model/travellers/travellers';
import type { Entrance } from '../../src/model/interiors/interiors';
import { doorNumber } from '../../src/model/interiors/interiors';
import { type BagItem } from '../../src/model/hero/bag';
import { fitBag } from '../../src/model/hero/bagSlots';
import { betterThanWorn, canWear, isGear, levelOf, slotOfGear, type GearKey } from '../../src/model/human/items/gear';
import { isJewelrySlot } from '../../src/model/human/equipment';
import { isProvision, PROVISIONS } from '../../src/model/loot/provisions';
import { isPotion } from '../../src/model/loot/potions';
import { isIngredient } from '../../src/model/loot/ingredients';
import { isBagItem } from '../../src/model/loot/bags';
import { isTool } from '../../src/model/loot/tools';
import { QUEST_ITEMS } from '../../src/model/quests/questItems';
import { isJunk } from '../../src/model/shops/sellValue';
import { STATS, STAT_NAMES } from '../../src/model/hero/statKinds';
import { spendPoints } from '../../src/model/hero/training';
import { JOBS, JOB_IDS } from '../../src/model/jobs/jobs';
import { RECIPES, RECIPE_IDS, type RecipeId } from '../../src/model/skills/woodworking';
import { salvageOf } from '../../src/model/skills/salvage';
import { difficulty, skillOf } from '../../src/model/skills/skills';
import { buyGear, gearPrice, gearSellPrice, sellGear, smithBuys, smithShopIn } from '../../src/model/smithy/smithShop';
import { buy, buyPrice, innWants, sell, sellPrice, shopAt } from '../../src/model/inn/tavernShop';
import { buyFromPedlar, pedlarBuys, pedlarPrice, pedlarShopAt, sellToPedlar } from '../../src/model/travellers/pedlarShop';
import { buyFromHerbalist, herbalistBuys, herbalistPrice, herbalistShopAt, sellToHerbalist } from '../../src/model/herbalist/herbalistShop';
import { talkingTo } from '../../src/model/npcs/talk';
import { travellerInReach } from '../../src/model/travellers/travellerTalk';
import type { Shop } from '../../src/model/shops/shopStock';
import { ROWS } from './keys';

export const WINDOW_KINDS = ['bag', 'points', 'board', 'jobs', 'smith', 'inn', 'pedlar', 'herbalist', 'recipes', 'salvage'] as const;
export type WindowKind = (typeof WINDOW_KINDS)[number];
export const CATEGORIES = ['weapon', 'shield', 'armour', 'jewelry', 'food', 'drink', 'potion', 'material', 'tool', 'pack', 'quest', 'junk', 'stat', 'job', 'recipe', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// A row as read: what it is, and the numbers beside it (a shop's price, a count, a level); and what its buttons do
// (`act`: the row's own; `other`: its second, if any). Each returns a word of what came of it (the tally's), or null.
export interface Row {
  label: string;
  category: Category;
  price: number; // copper (0: none)
  affordable: boolean;
  better: boolean; // gear better than what's worn
  count: number;
  level: number; // its level less the hero's (gear, recipes: the skill's), 0 otherwise
  can: boolean; // the button would do something (wearable, makeable, affordable, taken…)
  flag: boolean; // taken (a quest), done, fitted…
  act: () => string | null;
  other?: () => string | null;
}

export interface Window {
  kind: WindowKind;
  modal: boolean;
  page: 'buy' | 'sell' | null;
  offset: number; // the first row shown
  rows(): Row[];
  valid(): boolean; // still to be shown (the keeper in reach, the board before them)
  flip?(): void; // the other page
}

export const category = (item: string): Category => {
  if (isGear(item)) {
    const slot = slotOfGear(item);
    return slot === 'mainHand' ? 'weapon' : slot === 'offHand' ? 'shield' : isJewelrySlot(slot) ? 'jewelry' : 'armour';
  }
  if (isProvision(item)) return PROVISIONS[item].drink ? 'drink' : 'food';
  if (isPotion(item)) return 'potion';
  if (isIngredient(item)) return 'material';
  if (isTool(item)) return 'tool';
  if (isBagItem(item)) return 'pack';
  if (item in QUEST_ITEMS) return 'quest';
  return isJunk(item as BagItem) ? 'junk' : 'other';
};

const row = (label: string, category: Category, act: () => string | null, more: Partial<Row> = {}): Row => ({
  label, category, price: 0, affordable: true, better: false, count: 1, level: 0, can: true, flag: false, act, ...more,
});

// The bag's stacks, in their slots' order.
function bagRows(model: GameModel): Row[] {
  const { hero } = model;
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const item of hero.bagOrder) {
    if (!item || seen.has(item) || !(hero.bag[item] ?? 0)) continue;
    seen.add(item);
    const cat = category(item);
    const gear = isGear(item);
    const act = (): string | null => {
      if (gear) return canWear(item, hero.level) && model.equipFromBag(item) ? 'equipped' : null;
      if (isProvision(item)) return model.consume(item) ? 'eaten' : null;
      if (isPotion(item)) return model.drinkPotion(item) ? 'potions' : null;
      if (isBagItem(item)) return fitBag(hero, item) ? 'fitted' : null;
      if (item === 'bedroll') return model.lieDown() ? 'bedroll' : null;
      return null;
    };
    rows.push(row(item, cat, act, {
      count: hero.bag[item] ?? 0,
      better: gear && betterThanWorn(item, hero),
      level: gear ? levelOf(item) - hero.level : 0,
      can: gear ? canWear(item, hero.level) : isProvision(item) || isPotion(item) || isBagItem(item) || item === 'bedroll',
      other: () => (model.dropFromBag(item) ? 'dropped' : null),
    }));
  }
  return rows;
}

const pointsRows = (model: GameModel): Row[] =>
  STATS.map((s) => row(STAT_NAMES[s], 'stat', () => (spendPoints(model.hero, { [s]: 1 }) ? 'pointsSpent' : null), { count: model.hero.trained[s], can: model.hero.statPoints > 0 }));

// A village's notice board: its quests, each taken or not, done or not.
function boardRows(model: GameModel, board: number): Row[] {
  const { quests, hero } = model;
  return quests.offersAt(board).filter((q) => !quests.isCompleted(q.key)).map((q) => {
    const taken = quests.takenOf(q.key);
    const done = !!taken && quests.done(taken);
    return row(`${q.kind} ${q.count} ${q.foe}`, 'quest', () => (done ? (quests.handIn(q.key) ? 'questDone' : null) : taken ? null : quests.accept(q) ? 'questTaken' : null), {
      price: q.copper, count: q.count, level: q.level - hero.level, can: done || (!taken && !quests.full), flag: !!taken, better: done,
      other: () => (taken ? (quests.abandon(q.key), 'questAbandoned') : null),
    });
  });
}

const jobRows = (model: GameModel, inn: Entrance): Row[] =>
  JOB_IDS.map((job) => row(JOBS[job].name, 'job', () => (model.work.start(inn, job) ? 'shift' : null), { can: !model.work.shift }));

// A shop's two pages: its wares to buy, and what it buys of the hero's.
function shopRows(model: GameModel, page: 'buy' | 'sell', shop: Shop, wares: (id: string) => boolean, buys: (id: string) => boolean, price: (id: BagItem, selling: boolean) => number, buyOne: (id: BagItem) => string, sellOne: (id: BagItem) => string): Row[] {
  const { hero } = model;
  if (page === 'buy') {
    return (Object.keys(shop.stock) as BagItem[]).filter((id) => (shop.stock[id] ?? 0) > 0 && wares(id)).map((id) => {
      const cost = price(id, false);
      const gear = isGear(id);
      return row(id, category(id), () => (buyOne(id) === 'bought' ? 'bought' : null), {
        price: cost, affordable: hero.money >= cost, count: shop.stock[id] ?? 0, better: gear && betterThanWorn(id, hero), level: gear ? levelOf(id) - hero.level : 0, can: hero.money >= cost && (!gear || canWear(id, hero.level)),
      });
    });
  }
  const seen = new Set<string>();
  return hero.bagOrder.filter((id): id is BagItem => !!id && !seen.has(id) && !!seen.add(id) && (hero.bag[id] ?? 0) > 0 && buys(id)).map((id) => {
    const gets = price(id, true);
    return row(id, category(id), () => (sellOne(id) === 'sold' ? 'sold' : null), { price: gets, count: hero.bag[id] ?? 0, better: isGear(id) && betterThanWorn(id, hero), can: shop.money >= gets });
  });
}

const recipeRows = (model: GameModel): Row[] => {
  const { woodworking, hero } = model;
  const level = skillOf(hero, 'woodworking').level;
  return RECIPE_IDS.filter((id) => woodworking.knows(id)).sort((a, b) => RECIPES[a].needs - RECIPES[b].needs).map((id: RecipeId) =>
    row(RECIPES[id].name, 'recipe', () => (woodworking.start(id, 1) ? 'crafted' : null), {
      count: woodworking.canMake(id), level: RECIPES[id].needs - level, can: woodworking.canMake(id) > 0 && difficulty(RECIPES[id].needs, level).chance > 0 && woodworking.roomFor(id),
      other: () => (woodworking.start(id, Infinity) ? 'crafted' : null),
    }));
};

const salvageRows = (model: GameModel): Row[] => {
  const { salvage, hero } = model;
  const level = skillOf(hero, 'salvaging').level;
  return salvage.candidates.map((key: GearKey) => row(key, category(key), () => (salvage.start(key) === 'started' ? 'salvaged' : null), { better: betterThanWorn(key, hero), level: salvageOf(key).needs - level, can: level >= salvageOf(key).needs }));
};

// The windows, each opened for what it's about: a trade's keeper, a board, a traveller.
export function openWindow(model: GameModel, kind: WindowKind, about?: Npc | Traveller | number | Entrance): Window | null {
  const atTalker = (role: Npc['role']) => () => talkingTo(model.folk, model.inside, model.hero)?.role === role;
  let page: 'buy' | 'sell' = 'buy';
  const w = (modal: boolean, rows: () => Row[], valid: () => boolean, paged = false): Window => {
    const self: Window = { kind, modal, page: paged ? page : null, offset: 0, rows, valid };
    if (paged) self.flip = () => void (self.page = page = page === 'buy' ? 'sell' : 'buy');
    return self;
  };
  switch (kind) {
    case 'bag': return w(false, () => bagRows(model), () => true);
    case 'points': return w(false, () => pointsRows(model), () => true);
    case 'recipes': return w(false, () => recipeRows(model), () => true);
    case 'salvage': return w(false, () => salvageRows(model), () => model.salvage.benchInReach !== null);
    case 'board': return typeof about === 'number' ? w(true, () => boardRows(model, about), () => model.boardInReach === about) : null;
    case 'jobs': return about && typeof about === 'object' && 'type' in about ? w(true, () => jobRows(model, about), () => model.work.noticeInReach === about) : null;
    case 'smith': {
      if (!model.inside) return null;
      const shop = () => smithShopIn(model);
      return w(false, () => shopRows(model, page, shop(), isGear, smithBuys, (id, selling) => (selling ? gearSellPrice(id as GearKey) : gearPrice(id as GearKey)), (id) => buyGear(shop(), model.hero, id as GearKey), (id) => sellGear(shop(), model.hero, id)), atTalker('smith'), true);
    }
    case 'inn': {
      if (!model.inside) return null;
      const door = doorNumber(model.inside.entrance);
      const shop = () => shopAt(model.shops, model.seed, door);
      const sells = (id: string) => innWants(id) || (isProvision(id) && sellPrice(id) > 0);
      return w(false, () => shopRows(model, page, shop(), isProvision, sells, (id, selling) => (selling ? sellPrice(id as never) : buyPrice(id as never)), (id) => buy(shop(), model.hero, id as never), (id) => sell(shop(), model.hero, id)), atTalker('barkeep'), true);
    }
    case 'pedlar': {
      const t = about as Traveller;
      if (!t || !('role' in t) || t.role !== 'pedlar') return null;
      const shop = () => pedlarShopAt(model.shops, model.seed, t);
      return w(false, () => shopRows(model, page, shop(), () => true, pedlarBuys, pedlarPrice, (id) => buyFromPedlar(shop(), model.hero, id), (id) => sellToPedlar(shop(), model.hero, id)), () => travellerInReach(model.travellers.list, model.hero) === t, true);
    }
    case 'herbalist': {
      const npc = about as Npc;
      if (!npc || !('role' in npc) || npc.role !== 'herbalist') return null;
      const shop = () => herbalistShopAt(model.shops, model.seed, npc);
      return w(false, () => shopRows(model, page, shop(), () => true, herbalistBuys, herbalistPrice, (id) => buyFromHerbalist(shop(), model.hero, id), (id) => sellToHerbalist(shop(), model.hero, id)), atTalker('herbalist'), true);
    }
  }
}

// The rows on show: ROWS of them from the offset.
export const shown = (window: Window): Row[] => window.rows().slice(window.offset, window.offset + ROWS);
