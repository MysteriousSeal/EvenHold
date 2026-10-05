// A bot's ventures, past the villages' everyday (bot.ts decides which, and when): through a door and out again (a
// house's, an inn's, a dungeon's way down and up), a word with a keeper; down a crypt or a cave, its foes fought and
// its boss's chest opened; a bandit camp raided, its chief slain and its chest opened; a pedlar's pack and a
// herbalist's shelves bought from; a word with a traveller on the road; a shift worked at an inn's tables (its notice
// board read, the shift started, its patrons served as they call, their tables cleared, paid at its end). Each says
// when the game doesn't do what it should.
import type { Enemy } from '../../src/model/types';
import { ENTER_RANGE, type Entrance } from '../../src/model/interiors/interiors';
import { maxHpOf } from '../../src/model/hero/attributes';
import { talkingTo } from '../../src/model/npcs/talk';
import type { Npc } from '../../src/model/npcs/npcs';
import { stairsInReach, stairsOf, takeStairs } from '../../src/model/interiors/upstairs';
import { chestInReach } from '../../src/model/loot/chests';
import { CHEST_REACH, chestOf } from '../../src/model/camps/campLife';
import type { Camp } from '../../src/model/camps/camps';
import { TRAVELLER_TALK_RANGE, travellerInReach, travellerSays } from '../../src/model/travellers/travellerTalk';
import type { Traveller } from '../../src/model/travellers/travellers';
import { buyFromPedlar, pedlarPrice, pedlarShopAt } from '../../src/model/travellers/pedlarShop';
import { buyFromHerbalist, herbalistPrice, herbalistShopAt } from '../../src/model/herbalist/herbalistShop';
import type { BagItem } from '../../src/model/hero/bag';
import { BotSteps, type Step } from './botSteps';
import type { GameModel } from '../../src/model/GameModel';
import { SHIFT } from '../../src/model/jobs/innShift';
import { BONUS, boardFace } from '../../src/model/jobs/work';
import type { Status } from './errands';

const SHIFT_SLACK = 20; // game seconds past a shift's length before it's said never to have ended
const POUR_WAIT = 45; // game seconds an order may wait on the barkeep before it's said she never poured it
const DELVE = 150; // game seconds down a dungeon, at most, before coming up (what's left: another time)
const RAID = 200; // and at a bandit camp

export class BotVentures extends BotSteps {
  protected enter(door: Entrance | null): Step[] {
    if (!door) return [() => 'fail'];
    return [
      this.walk(() => door, ENTER_RANGE * 0.9),
      () => {
        if (!this.model.useDoor()) {
          this.report('door not used', `at the ${door.type}'s door, ${this.model.hero.x.toFixed(2)},${this.model.hero.z.toFixed(2)}`);
          return 'fail';
        }
        this.stats.buildings++;
        return 'ok';
      },
    ];
  }

  // Out of the building (down the stairs first, if up them); out of a dungeon by its way out at the far end once its
  // boss is slain (as a player would: there, after its chest), else back up the way they came down.
  protected leave(): Step[] {
    return [
      (dt) => {
        const { inside, hero } = this.model;
        if (!inside?.below) return 'ok';
        const stairs = stairsOf(inside)!;
        if (stairsInReach(inside, hero)) return takeStairs(this.model) ? 'run' : 'fail';
        return this.walk(() => ({ x: stairs.x + stairs.w / 2 - 0.5, z: stairs.z + stairs.d }), 0.5)(dt) === 'fail' ? 'fail' : 'run';
      },
      (dt) => {
        const { inside } = this.model;
        if (!inside) return 'ok';
        if (this.model.seated) this.model.sitOrStand();
        if (this.model.doorInReach) return this.model.useDoor() ? 'ok' : 'fail';
        const way = inside.exitAt?.() ?? { x: inside.room.door, z: inside.room.depth - 1 };
        return this.walk(() => way, 0.25)(dt) === 'fail' ? 'fail' : 'run';
      },
    ];
  }

  protected talkTo(role: 'barkeep' | 'smith' | 'herbalist'): Step {
    return (dt) => {
      const { inside, hero, npcs } = this.model;
      if (talkingTo(npcs, inside, hero)?.role === role) return 'ok';
      const keeper = npcs.find((n) => n.role === role && n.where === inside?.entrance);
      if (!keeper) return 'fail';
      return this.walk(() => keeper, 1.2)(dt) === 'run' ? 'run' : talkingTo(npcs, inside, hero)?.role === role ? 'ok' : 'fail';
    };
  }

  // Foes fought one after another, nearest first (`foes`: those still to fight, as they stand), loot picked up as it
  // falls, and `after` once none are left (else 'ok': done); for `seconds` at most, or till hurt.
  private clearOut(seconds: number, foes: () => Enemy[], after: () => Status | Step): Step {
    let t = 0;
    let current: { of: unknown; step: Step } | null = null;
    const skipped = new Set<unknown>();
    return (dt) => {
      const { hero } = this.model;
      if ((t += dt) > seconds || hero.hp < maxHpOf(hero) * 0.35) return 'ok'; // (enough for now, or off to heal)
      if (this.model.lootInReach) this.model.pickUp();
      if (current) {
        const status = current.step(dt);
        if (status === 'run') return 'run';
        if (status === 'fail') skipped.add(current.of);
        current = null;
        this.nav.reset();
      }
      const left = foes().filter((e) => e.state !== 'dead' && !skipped.has(e));
      left.sort((a, b) => Math.hypot(a.x - hero.x, a.z - hero.z) - Math.hypot(b.x - hero.x, b.z - hero.z));
      if (left.length > 0) return (current = { of: left[0], step: this.fight(left[0]) }), 'run';
      const next = after();
      if (typeof next === 'string') return next;
      current = { of: next, step: next };
      return 'run';
    };
  }

  // Down a dungeon (its way in walked to and gone through) and up again: its foes fought, its boss's chest opened once
  // it falls (or lies there open since); how much of it's cleared never going back.
  protected dungeonTrip(door: Entrance): Step[] {
    let cleared = -1;
    let chestTried = false;
    const down: Step = this.clearOut(
      DELVE,
      () => this.model.foes,
      () => {
        const run = this.model.dungeon;
        const chest = run?.chest;
        if (!run || !chest || chest.open) return 'ok';
        if (!run.chestInReach(this.model.hero)) return chestTried ? 'ok' : (chestTried = true, this.walk(() => chest, 0.5));
        chestInReach(this.model)?.open();
        if (!run.chest?.open) this.report('dungeon chest would not open', `${door.type} at ${door.x},${door.z}, boss slain, hero at the chest`);
        else this.stats.chests++;
        return 'ok';
      },
    );
    const watched: Step = (dt) => {
      const run = this.model.dungeon;
      if (!run) return 'fail';
      if (cleared < 0) [cleared, this.stats.dungeons] = [run.share, this.stats.dungeons + 1];
      if (run.share < cleared - 1e-9) this.report('dungeon less cleared than it was', `${door.type} at ${door.x},${door.z}: ${(cleared * 100).toFixed(0)}% to ${(run.share * 100).toFixed(0)}%`);
      cleared = Math.max(cleared, run.share);
      return down(dt);
    };
    return [...this.enter(door), watched, ...this.leave()];
  }

  // A bandit camp raided: to its way in, its bandits and chief fought, then its chest opened (the chief's key).
  protected campRaid(camp: Camp): Step[] {
    const crew = () => this.model.enemies.filter((e) => (e.kind === 'bandit' || e.kind === 'banditChief') && Math.hypot(e.homeX - camp.x, e.homeZ - camp.z) < 12);
    const chest = chestOf(camp);
    let tried = false;
    const raid = this.clearOut(RAID, crew, () => {
      const { campLife, hero } = this.model;
      if (campLife.status(hero)?.chestOpened) return 'ok'; // (opened already, a raid ago)
      if (campLife.chestInReach(hero) !== camp) return tried ? 'ok' : (tried = true, this.walk(() => chest, CHEST_REACH - 0.05));
      if (campLife.locked(camp)) {
        this.report('camp chest locked, chief slain', `camp at ${camp.x},${camp.z}`);
        return 'ok';
      }
      chestInReach(this.model)?.open();
      if (campLife.chestInReach(hero) === camp) this.report('camp chest would not open', `camp at ${camp.x},${camp.z}, its chief down, hero at it`);
      else this.stats.chests++;
      return 'ok';
    });
    return [this.walk(() => camp.way, 1.5), () => ((this.stats.camps++, 'ok')), raid];
  }

  // A shift at an inn's tables, worked to its end: in, to its notice board (before it, as a player stands to read it),
  // the shift taken up, then its work done as it comes (an order on the tray to whoever it's for; the tray filled at
  // the counter when there's something to give back or take up; a call answered; a table cleared), till its time's up.
  // Said if it isn't as it should be: the board not to be read from before it, E doing nothing where it says it would,
  // the barkeep never pouring, the tray holding more than the rank allows, pay before the end or short at it, the hero
  // out of the inn while at work.
  // (`resume`: one under way already, picked up where it is: planned afresh mid-shift.)
  protected workShift(inn: Entrance, resume = false): Step[] {
    let t = 0;
    let shift: NonNullable<GameModel['work']['shift']> | null = resume ? this.model.work.shift : null;
    let money = this.model.hero.money;
    let pause = 0; // seconds stood still after a way found blocked (folk in the doorway, the busy hour's): then afresh
    const ordered = new Map<unknown, number>(); // orders with the barkeep, and game seconds they've waited
    const start: Step = (dt) => {
      const { model } = this;
      const board = model.inside?.furniture.find((f) => f.kind === 'noticeBoard');
      if (!board) return this.report('inn without a notice board', `at ${inn.x},${inn.z}`), 'fail';
      const face = boardFace(board);
      const before = board.wall === 'left' ? { x: face.x + 0.8, z: face.z } : { x: face.x, z: face.z + 0.8 };
      if (this.walk(() => before, 0.2)(dt) === 'run') return 'run';
      if (model.work.noticeInReach !== inn) return this.report('notice board out of reach before it', `at ${model.hero.x.toFixed(2)},${model.hero.z.toFixed(2)}, its face at ${face.x},${face.z}`), 'fail';
      if (!model.work.start(inn)) return this.report('shift not taken up', `at the inn at ${inn.x},${inn.z}`), 'fail';
      [shift, money, t] = [model.work.shift, model.hero.money, 0];
      this.stats.shifts++;
      return 'ok';
    };
    const work: Step = (dt) => {
      const { model } = this;
      const { hero } = model;
      if (!shift) return 'fail';
      if (!model.work.shift) {
        // Over: paid all at once, just what it earned (and a clean shift's bonus).
        const bonus = shift.walkedOut === 0 && shift.served > 0 ? BONUS * shift.served : 0;
        if (hero.money !== money + shift.earned + bonus) this.report('shift paid wrong', `${hero.money - money} for ${shift.earned} earned and ${bonus} bonus`);
        this.stats.orders += shift.served;
        return 'ok';
      }
      if ((t += dt) > SHIFT + SHIFT_SLACK) return this.report('shift never ended', `${t.toFixed(0)} s in`), 'fail';
      if (model.inside?.entrance !== inn) this.report('out of the inn at work', `at ${hero.x.toFixed(2)},${hero.z.toFixed(2)}`);
      if (hero.money !== money) {
        this.report('paid before the shift was over', `${hero.money - money} copper`);
        money = hero.money;
      }
      if (shift.tray.length > shift.rank.tray) this.report('tray over full', `${shift.tray.length} on a ${shift.rank.name}'s tray of ${shift.rank.tray}`);
      for (const want of shift.wants.values()) {
        if (want.state !== 'ordered' || want.ready) {
          ordered.delete(want);
          continue;
        }
        const waited = (ordered.get(want) ?? 0) + dt;
        ordered.set(want, waited);
        if (waited > POUR_WAIT && waited - dt <= POUR_WAIT) this.report('barkeep never poured', `${want.order} for ${want.npc.name}, ${POUR_WAIT} s on`); // (told once)
      }
      // E where there's something to do here.
      if (model.work.action) {
        const before = { level: hero.level, xp: hero.xp };
        const kind = model.work.action.kind;
        if (!model.work.use()) this.report('work did nothing', `${kind}: E by it, at ${hero.x.toFixed(2)},${hero.z.toFixed(2)}`);
        this.balance.xp('work', before);
        return 'run';
      }
      // Else to the next thing to do: an order on the tray to whoever it's for; the counter (empties to give back, or
      // orders ready and room to take them); the call waited on longest; a table to clear; else by the counter.
      const order = shift.tray.find((item) => item.kind === 'order');
      const calling = [...shift.wants.values()].filter((w) => w.state === 'calling').sort((a, b) => a.patience - b.patience)[0];
      const room = shift.rank.tray - shift.tray.length;
      const counter = shift.tray.some((item) => item.kind === 'empty') || (shift.readyOrders.length > 0 && room > 0);
      const table = room > 0 ? shift.empties[0]?.table : undefined;
      const to = order?.kind === 'order' ? order.want.npc : counter ? shift.pickupSpot : calling ? calling.npc : table ?? shift.pickupSpot;
      if ((pause -= dt) > 0) return 'run';
      if (this.walk(() => to, to === shift.pickupSpot ? 0.4 : 1)(dt) === 'fail') {
        pause = 2;
        this.nav.reset();
      }
      return 'run';
    };
    return resume ? [work] : [...this.enter(inn), start, work];
  }

  // To a traveller on the road (they walk on: followed), near enough for a word: a pedlar's pack opened and something
  // bought; anyone else, a word had.
  protected meet(traveller: Traveller): Step[] {
    const reach: Step = (dt) => (travellerInReach(this.model.travellers.list, this.model.hero) === traveller ? 'ok' : this.walk(() => traveller, TRAVELLER_TALK_RANGE * 0.6)(dt));
    const talk: Step = () => {
      if (travellerInReach(this.model.travellers.list, this.model.hero) !== traveller) return 'fail'; // (moved off, or gone)
      if (traveller.role !== 'pedlar') {
        if (!travellerSays(traveller, this.model.crypts)) this.report('traveller silent', `${traveller.role} ${traveller.name}`);
        this.stats.travellers++;
        return 'ok';
      }
      const shop = pedlarShopAt(this.model.shops, this.model.seed, traveller);
      this.buyOne(shop, (id) => pedlarPrice(id, false), (id) => buyFromPedlar(shop, this.model.hero, id), 'pedlar');
      this.stats.pedlars++;
      return 'ok';
    };
    return [reach, talk];
  }

  // To a village's herbalist, at home: something off their shelves.
  protected herbalistVisit(herbalist: Npc): Step[] {
    const shopping: Step = () => {
      const shop = herbalistShopAt(this.model.shops, this.model.seed, herbalist);
      this.buyOne(shop, (id) => herbalistPrice(id, false), (id) => buyFromHerbalist(shop, this.model.hero, id), 'herbalist');
      this.stats.herbalists++;
      return 'ok';
    };
    return [...this.enter(herbalist.home), this.talkTo('herbalist'), shopping, ...this.leave()];
  }

  // The cheapest thing in stock bought, if they can pay for it: their coin down by its price, it in the bag.
  private buyOne(shop: { stock: Partial<Record<BagItem, number>> }, price: (id: BagItem) => number, buy: (id: BagItem) => string, who: string): void {
    const { hero } = this.model;
    const wares = (Object.keys(shop.stock) as BagItem[]).filter((id) => (shop.stock[id] ?? 0) > 0).sort((a, b) => price(a) - price(b));
    const id = wares[0];
    if (!id || price(id) > hero.money) return;
    const [money, had] = [hero.money, hero.bag[id] ?? 0];
    const done = buy(id);
    if (done === 'full') return; // (no room in the bag)
    if (done !== 'bought') this.report(`${who} would not sell`, `${id} at ${price(id)}, hero has ${money}: ${done}`);
    else if (hero.money !== money - price(id)) this.report(`${who} charged wrong`, `${id}: ${money - hero.money} for ${price(id)}`);
    else if ((hero.bag[id] ?? 0) !== had + 1) this.report(`${who}'s ware not in the bag`, id);
    else this.stats.trades++;
  }
}
