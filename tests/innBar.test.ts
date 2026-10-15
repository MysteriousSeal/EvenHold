// The inn's ground floor, as a player finds it: what was found wrong there, kept fixed. A patron served at a table by
// the hero, the shift then over, up and off once done (not sat there for good); the hero's own order at the bar
// called off when they get up still waiting on it (never handed to them on another stool, nor paid for).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { createBar, type BarView } from '../src/controller/trade/barOrder';
import { ordersAt } from '../src/model/inn/barOrders';
import { mugsAt } from '../src/model/inn/barMugs';
import { seatOf, type Furniture } from '../src/model/interiors/furniture';
import type { Entrance } from '../src/model/interiors/interiors';
import { TEST_MAP_SIZE } from './support/testWorld';

// A model with the hero in an inn, its bar's queue and mugs cleared.
function inTheInn() {
  const model = new GameModel(1, TEST_MAP_SIZE);
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  ordersAt(inn).splice(0);
  mugsAt(inn).splice(0);
  return { model, inn, furniture: model.inside!.furniture };
}

// The hero sat down on `piece` (stood by it first).
function sitOn(model: GameModel, piece: Furniture): void {
  if (model.seated) model.sitOrStand();
  const seat = seatOf(piece)!;
  Object.assign(model.hero, { x: seat.x + 0.6, z: seat.z });
  expect(model.sitOrStand()).toBe(true);
  expect(model.seated?.seat.piece).toBe(piece);
}

describe('a table served by the hero, the shift over', () => {
  it.each([false, true])("lets those with a drink before them up once it's over (left early: %s)", (early) => {
    const { model, inn, furniture } = inTheInn();
    const chair = furniture.find((f) => f.kind === 'chair')!;
    const patron = model.npcs.find((n) => n.role === 'villager' && n.inn === inn)!;
    Object.assign(patron, { where: inn, x: chair.x + 1, z: chair.z, steps: [{ kind: 'sit', seat: seatOf(chair)!, for: 3 }], path: null, waited: 0 });
    model.update(0, 0, 0.1);
    expect(model.work.start(inn, 'innServer')).toBe(true);
    patron.drinking = { left: 15, seconds: 15, drink: 'ale' }; // (served by the hero)
    if (early) model.work.end(true);
    else model.work.shift!.left = 0;
    for (let t = 0; t < 20 && patron.seat; t += 0.1) model.update(0, 0, 0.1);
    expect(model.work.shift).toBeNull();
    expect([patron.drinking, patron.seat]).toEqual([null, null]); // up, not sat there for good
  });
});

describe("the hero's own order at the bar", () => {
  const timers: Array<() => void> = [];
  beforeEach(() => vi.stubGlobal('window', { setTimeout: (f: () => void) => timers.push(f) }));
  afterEach(() => {
    vi.unstubAllGlobals();
    timers.length = 0;
  });
  const view: BarView = { heroDrinks: () => {}, heroStopsDrinking: () => {}, speak: () => {}, countdown: () => {} };
  const barmaidOf = (model: GameModel, inn: Entrance) => model.folk.find((n) => n.role === 'barkeep' && n.where === inn)!;

  it("is called off when they get up still waiting: out of her queue, never handed over on another stool, nothing paid", () => {
    const { model, inn, furniture } = inTheInn();
    const [first, second] = furniture.filter((f) => f.kind === 'barStool');
    const bar = createBar(model, view);
    model.hero.money = 100;
    sitOn(model, first);
    bar.order(barmaidOf(model, inn), 'ale');
    expect([bar.busy, ordersAt(inn).length]).toEqual([true, 1]);
    sitOn(model, second); // (up, and on the next stool along)
    bar.update();
    expect([bar.busy, bar.canOrder, ordersAt(inn).length]).toEqual([false, true, 0]);
    for (let t = 0; t < 30; t += 0.1) model.update(0, 0, 0.1);
    timers.splice(0).forEach((f) => f());
    expect([model.hero.drinking ?? null, model.hero.money]).toEqual([null, 100]);
  });

  it("is had on the stool it was ordered from: set down there, paid for and drunk", () => {
    const { model, inn, furniture } = inTheInn();
    const stool = furniture.find((f) => f.kind === 'barStool')!;
    const bar = createBar(model, view);
    model.hero.money = 100;
    sitOn(model, stool);
    bar.order(barmaidOf(model, inn), 'ale');
    for (let t = 0; t < 30 && timers.length === 0; t += 0.1) {
      model.update(0, 0, 0.1);
      bar.update();
    }
    expect(mugsAt(inn)).toMatchObject([{ z: stool.z, full: true }]);
    timers.splice(0).forEach((f) => f());
    expect(model.hero.drinking).not.toBeNull();
    expect(model.hero.money).toBeLessThan(100);
    expect(bar.busy).toBe(false);
  });

  it("isn't had if they got up between its being set down and picked up: left on the bar, unpaid", () => {
    const { model, inn, furniture } = inTheInn();
    const [first, second] = furniture.filter((f) => f.kind === 'barStool');
    const bar = createBar(model, view);
    model.hero.money = 100;
    sitOn(model, first);
    bar.order(barmaidOf(model, inn), 'ale');
    for (let t = 0; t < 30 && timers.length === 0; t += 0.1) model.update(0, 0, 0.1);
    sitOn(model, second);
    bar.update();
    timers.splice(0).forEach((f) => f());
    expect([model.hero.drinking ?? null, model.hero.money, bar.busy]).toEqual([null, 100, false]);
  });
});
