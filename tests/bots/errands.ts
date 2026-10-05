// A bot's errands, done in one go once it's there (bot.ts walks it there):
// quests taken from a board and handed in, trading at the inn and the
// smithy, points reset, a quest let go, a coin in a well. Each says when
// the game doesn't do what it should.
import { canWear, gearSpecs, isGear, slotOfGear, type GearKey } from '../../src/model/human/items/gear';
import type { GameModel } from '../../src/model/GameModel';
import { STATS } from '../../src/model/hero/statKinds';
import { resetCost, resetPoints } from '../../src/model/hero/training';
import { sellValue, isJunk } from '../../src/model/shops/sellValue';
import { sellTo, type Shop } from '../../src/model/shops/shopStock';
import { buy, shopAt } from '../../src/model/inn/tavernShop';
import { buyGear, gearPrice, smithShopIn } from '../../src/model/smithy/smithShop';
import { doorNumber } from '../../src/model/interiors/interiors';
import type { BotStats } from './bot';
import type { Balance } from './balance';

export type Status = 'run' | 'ok' | 'fail';
type Report = (kind: string, detail: string) => void;

// How much good a piece of gear does (its armor and stats together).
export const power = (key: GearKey) => {
  const { armor, stats } = gearSpecs(key);
  return armor + Object.values(stats).reduce((a, b) => a + b, 0);
};

// Whether `key` is worth wearing over what's worn in its slot (and they're of its level).
export const better = (key: GearKey, hero: GameModel['hero']): boolean => {
  const worn = hero.equipment[slotOfGear(key)];
  return canWear(key, hero.level) && (!worn || power(key) > power(worn));
};

export { isGear };

export class Errands {
  constructor(
    private readonly model: GameModel,
    private readonly report: Report,
    private readonly stats: BotStats,
    private readonly rng: () => number,
    private readonly balance: Balance,
  ) {}

  // Does `what`, counting the coin it brought in or cost (for the balance).
  private counted<T>(what: string, act: () => T): T {
    const before = this.model.hero.money;
    const result = act();
    this.balance.coin(what, this.model.hero.money - before);
    return result;
  }

  // Its points all back, for a price (by level), and spent again at once (chores()).
  respec(): Status {
    const { hero } = this.model;
    const [money, unspent, spent] = [hero.money, hero.statPoints, STATS.reduce((sum, s) => sum + hero.trained[s], 0)];
    const result = this.counted('resetting points', () => resetPoints(hero));
    if (result === 'reset') {
      if (hero.statPoints !== unspent + spent) this.report('points reset wrong', `${spent} spent and ${unspent} to spend, ${hero.statPoints} after`);
      if (hero.money !== money - resetCost(hero.level)) this.report('points reset charged wrong', `${money - hero.money} for ${resetCost(hero.level)}`);
    }
    return 'ok';
  }

  // A quest let go now and then (and then it's on offer again).
  giveUp(): Status {
    const { quests } = this.model;
    const taken = quests.taken[Math.floor(this.rng() * quests.taken.length)];
    if (!taken || this.rng() < 0.7) return 'ok';
    quests.abandon(taken.quest.key);
    this.balance.questEnded(taken.quest.key, 'given up');
    if (quests.takenOf(taken.quest.key)) this.report('quest not let go', taken.quest.key);
    else if (!quests.offersAt(taken.quest.board).some((q) => q.key === taken.quest.key)) this.report('quest let go, not on offer again', taken.quest.key);
    return 'ok';
  }

  takeQuests(board: number): Status {
    const { quests, hero } = this.model;
    if (this.model.boardInReach !== board) {
      this.report('board not in reach in front of it', `board ${board}, hero at ${hero.x.toFixed(2)},${hero.z.toFixed(2)}`);
      return 'fail';
    }
    for (const quest of quests.offersAt(board)) {
      if (quests.full || quests.fullAt(board) || quests.isCompleted(quest.key) || quests.takenOf(quest.key) || quest.level > hero.level + 2) continue;
      if (!quests.accept(quest)) this.report('quest not taken', `${quest.key} (${quests.taken.length} taken)`);
      else {
        this.stats.questsTaken++;
        this.balance.questTaken({ ...quest, xp: quests.xpFor(quest) });
      }
      if (this.rng() < 0.5) break;
    }
    return 'ok';
  }

  handIn(key: string): Status {
    const { quests, hero } = this.model;
    const taken = quests.takenOf(key)!;
    const [money, xp, level] = [hero.money, hero.xp, hero.level];
    if (!this.counted('quests', () => quests.handIn(key))) {
      this.report('quest not handed in, though done', `${key}: ${quests.progress(taken)}/${taken.quest.count}`);
      quests.abandon(key);
      return 'fail';
    }
    this.stats.questsDone++;
    this.balance.xp('quests', { level, xp });
    this.balance.questEnded(key, 'done');
    if (hero.money < money + taken.quest.copper) this.report('quest paid short', `${key}: ${hero.money - money} of ${taken.quest.copper}`);
    if (hero.xp === xp && hero.level === level) this.report('quest gave no experience', key);
    if (quests.takenOf(key)) this.report('quest still taken, handed in', key);
    return 'ok';
  }

  tradeAtInn(): void {
    const { hero, inside } = this.model;
    const shop = shopAt(this.model.shops, this.model.seed, doorNumber(inside!.entrance)); // (as the game keeps it: by its door's number)
    this.sellJunk(shop);
    for (const id of ['bread', 'meatPie', 'cheese'] as const) if (hero.money > 40 && this.counted('food', () => buy(shop, hero, id)) === 'bought') this.stats.trades++;
  }

  tradeAtSmith(): void {
    const { hero } = this.model;
    const shop = smithShopIn(this.model); // (as the game keeps it: by its door's number, forged at his village's level)
    this.sellJunk(shop);
    const want = (Object.keys(shop.stock) as GearKey[]).filter((key) => isGear(key) && (shop.stock[key] ?? 0) > 0 && gearPrice(key) <= hero.money && better(key, hero));
    const best = want.sort((a, b) => power(b) - power(a))[0];
    if (best) {
      const money = hero.money;
      if (this.counted('gear', () => buyGear(shop, hero, best)) !== 'bought') this.report('smith would not sell', `${best} at ${gearPrice(best)}, hero has ${money}`);
      else if (hero.money !== money - gearPrice(best)) this.report('smith charged wrong', `${best}: ${money - hero.money} for ${gearPrice(best)}`);
      else this.stats.trades++;
    }
  }

  sellJunk(shop: Shop): void {
    const { hero } = this.model;
    for (const id of Object.keys(hero.bag) as Array<keyof typeof hero.bag>) {
      if (!isJunk(id)) continue;
      while ((hero.bag[id] ?? 0) > 0 && this.counted('selling loot', () => sellTo(shop, hero, id, sellValue(id)!)) === 'sold') this.stats.trades++;
    }
  }

  wish(): Status {
    if (this.model.wellInReach === null) {
      this.report('well not in reach beside it', `hero at ${this.model.hero.x.toFixed(2)},${this.model.hero.z.toFixed(2)}`);
      return 'fail';
    }
    if (this.model.hero.money >= 100 && this.counted('wishes', () => this.model.tossCoin(this.rng()))) this.stats.wishes++;
    return 'ok';
  }
}
