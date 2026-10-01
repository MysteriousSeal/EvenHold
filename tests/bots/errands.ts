// A bot's errands, done in one go once it's there (bot.ts walks it there):
// quests taken from a board and handed in, trading at the inn and the
// smithy, points reset, a quest let go, a coin in a well. Each says when
// the game doesn't do what it should.
import type { GameModel } from '../../src/model/GameModel';
import { STATS } from '../../src/model/hero/statKinds';
import { resetCost, resetPoints } from '../../src/model/hero/training';
import { ITEMS, type ItemId } from '../../src/model/human/equipment';
import { sellValue, isJunk } from '../../src/model/shops/sellValue';
import { sellTo, type Shop } from '../../src/model/shops/shopStock';
import { buy, shopAt } from '../../src/model/inn/tavernShop';
import { SMITH_WARES, buyGear, gearPrice, smithShopAt } from '../../src/model/smithy/smithShop';
import type { BotStats } from './bot';

export type Status = 'run' | 'ok' | 'fail';
type Report = (kind: string, detail: string) => void;

// How much good a piece of gear does (its armor and stats together).
export const power = (id: ItemId) => (ITEMS[id].armor ?? 0) + Object.values(ITEMS[id].stats ?? {}).reduce((a, b) => a + b, 0);

export class Errands {
  constructor(
    private readonly model: GameModel,
    private readonly report: Report,
    private readonly stats: BotStats,
    private readonly rng: () => number,
  ) {}

  // Its points all back, for a price (by level), and spent again at once (chores()).
  respec(): Status {
    const { hero } = this.model;
    const [money, spent] = [hero.money, STATS.reduce((sum, s) => sum + hero.trained[s], 0)];
    const result = resetPoints(hero);
    if (result === 'reset') {
      if (hero.statPoints !== spent) this.report('points reset wrong', `${spent} spent, ${hero.statPoints} back`);
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
      else this.stats.questsTaken++;
      if (this.rng() < 0.5) break;
    }
    return 'ok';
  }

  handIn(key: string): Status {
    const { quests, hero } = this.model;
    const taken = quests.takenOf(key)!;
    const [money, xp, level] = [hero.money, hero.xp, hero.level];
    if (!quests.handIn(key)) {
      this.report('quest not handed in, though done', `${key}: ${quests.progress(taken)}/${taken.quest.count}`);
      quests.abandon(key);
      return 'fail';
    }
    this.stats.questsDone++;
    if (hero.money < money + taken.quest.copper) this.report('quest paid short', `${key}: ${hero.money - money} of ${taken.quest.copper}`);
    if (hero.xp === xp && hero.level === level) this.report('quest gave no experience', key);
    if (quests.takenOf(key)) this.report('quest still taken, handed in', key);
    return 'ok';
  }

  tradeAtInn(): void {
    const { hero, inside } = this.model;
    const shop = shopAt(this.model.shops, this.model.seed, this.model.entrances.indexOf(inside!.entrance));
    this.sellJunk(shop);
    for (const id of ['bread', 'meatPie', 'cheese'] as const) if (hero.money > 40 && buy(shop, hero, id) === 'bought') this.stats.trades++;
  }

  tradeAtSmith(): void {
    const { hero, inside } = this.model;
    const shop = smithShopAt(this.model.shops, this.model.seed, this.model.entrances.indexOf(inside!.entrance));
    this.sellJunk(shop);
    const want = SMITH_WARES.filter((id) => (shop.stock[id] ?? 0) > 0 && gearPrice(id) <= hero.money && (!hero.equipment[ITEMS[id].slot] || power(id) > power(hero.equipment[ITEMS[id].slot]!)));
    const best = want.sort((a, b) => power(b) - power(a))[0];
    if (best) {
      const money = hero.money;
      if (buyGear(shop, hero, best) !== 'bought') this.report('smith would not sell', `${best} at ${gearPrice(best)}, hero has ${money}`);
      else if (hero.money !== money - gearPrice(best)) this.report('smith charged wrong', `${best}: ${money - hero.money} for ${gearPrice(best)}`);
      else this.stats.trades++;
    }
  }

  sellJunk(shop: Shop): void {
    const { hero } = this.model;
    for (const id of Object.keys(hero.bag) as Array<keyof typeof hero.bag>) {
      if (!isJunk(id)) continue;
      while ((hero.bag[id] ?? 0) > 0 && sellTo(shop, hero, id, sellValue(id)!) === 'sold') this.stats.trades++;
    }
  }

  wish(): Status {
    if (this.model.wellInReach === null) {
      this.report('well not in reach beside it', `hero at ${this.model.hero.x.toFixed(2)},${this.model.hero.z.toFixed(2)}`);
      return 'fail';
    }
    if (this.model.hero.money >= 100 && this.model.tossCoin(this.rng())) this.stats.wishes++;
    return 'ok';
  }
}
