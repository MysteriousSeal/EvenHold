// The inn's ground floor, as a player finds it: what was found wrong there, kept fixed. A patron served at a table by
// the hero, the shift then over, up and off once done (not sat there for good); the hero's own order at the bar
// called off when they get up still waiting on it (never handed to them on another stool, nor paid for), picked up in
// the game's own time; and at a table, the server called over for it.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { atOrderSeat, createBar, orderLabel, tableHere, type BarView } from '../src/controller/trade/barOrder';
import { buyPrice } from '../src/model/inn/tavernShop';
import { callBarkeep, ordersAt, placeOrder } from '../src/model/inn/barOrders';
import { mugsAt, setMug } from '../src/model/inn/barMugs';
import { BarShift } from '../src/model/jobs/barShift';
import { JOBS } from '../src/model/jobs/jobs';
import { AISLE_X, serveTable } from '../src/model/inn/innStaff';
import type { InnShift } from '../src/model/jobs/innShift';
import { distanceTo, seatOf, type Furniture } from '../src/model/interiors/furniture';
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

const view: BarView = { heroDrinks: () => {}, heroStopsDrinking: () => {}, speak: () => {}, countdown: () => {} };
const barmaidOf = (model: GameModel, inn: Entrance) => model.folk.find((n) => n.role === 'barkeep' && n.where === inn)!;

// The game played on `seconds` (and the bar's frames with it), till `done` if given.
function play(model: GameModel, bar: ReturnType<typeof createBar>, seconds: number, done?: () => boolean): void {
  for (let t = 0; t < seconds && !done?.(); t += 0.1) {
    model.update(0, 0, 0.1);
    bar.update();
  }
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
  it('has her greet them as they sit down at her bar, once a stool (not again while sat)', () => {
    const { model, furniture } = inTheInn();
    const [first, second] = furniture.filter((f) => f.kind === 'barStool');
    const said: string[] = [];
    const bar = createBar(model, { ...view, speak: (_, text) => said.push(text) });
    bar.update();
    expect(said).toEqual([]);
    sitOn(model, first);
    bar.update();
    bar.update();
    expect(said).toHaveLength(1);
    sitOn(model, second);
    bar.update();
    expect(said).toHaveLength(2);
    expect(said.join(' ')).not.toContain('{name}');
  });

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
    play(model, bar, 30);
    expect([model.hero.drinking ?? null, model.hero.money]).toEqual([null, 100]);
  });

  it("is had on the stool it was ordered from: set down there, paid for and drunk", () => {
    const { model, inn, furniture } = inTheInn();
    const stool = furniture.find((f) => f.kind === 'barStool')!;
    const bar = createBar(model, view);
    model.hero.money = 100;
    sitOn(model, stool);
    bar.order(barmaidOf(model, inn), 'ale');
    play(model, bar, 30, () => mugsAt(inn).some((m) => m.full));
    expect(mugsAt(inn)).toMatchObject([{ z: stool.z, full: true }]);
    play(model, bar, 2, () => !!model.hero.drinking);
    expect(model.hero.drinking).toBeTruthy();
    expect(model.hero.money).toBeLessThan(100);
    expect([bar.busy, mugsAt(inn)]).toEqual([false, []]); // (picked up)
  });

  it("waits to be picked up while the game's paused (the game's own time, not the clock on the wall)", () => {
    const { model, inn, furniture } = inTheInn();
    const stool = furniture.find((f) => f.kind === 'barStool')!;
    const bar = createBar(model, view);
    model.hero.money = 100;
    sitOn(model, stool);
    bar.order(barmaidOf(model, inn), 'ale');
    play(model, bar, 30, () => mugsAt(inn).some((m) => m.full));
    for (let i = 0; i < 200; i++) bar.update(); // (paused: frames drawn, the game not run)
    expect([model.hero.drinking ?? null, bar.busy]).toEqual([null, true]);
    play(model, bar, 2, () => !!model.hero.drinking);
    expect(model.hero.drinking).toBeTruthy();
  });

  it("isn't had if they got up between its being set down and picked up: left on the bar, unpaid, till she clears it", () => {
    const { model, inn, furniture } = inTheInn();
    const [first, second] = furniture.filter((f) => f.kind === 'barStool');
    const bar = createBar(model, view);
    model.hero.money = 100;
    sitOn(model, first);
    bar.order(barmaidOf(model, inn), 'ale');
    play(model, bar, 30, () => mugsAt(inn).some((m) => m.full));
    sitOn(model, second);
    play(model, bar, 2);
    expect([model.hero.drinking ?? null, model.hero.money, bar.busy]).toEqual([null, 100, false]);
    expect(mugsAt(inn)).toMatchObject([{ z: first.z, full: true }]);
    for (let t = 0; t < 90 && mugsAt(inn).length > 0; t += 0.1) model.update(0, 0, 0.1);
    expect(mugsAt(inn)).toEqual([]); // (cleared away by her, a few rounds on: not left standing for good)
  }, 60_000);
});

describe("the hero's own order at a table", () => {
  // The hero sat at the inn's first table, in a chair by it.
  const atATable = () => {
    const world = inTheInn();
    const table = world.furniture.find((f) => f.kind === 'tavernTable')!;
    const chair = world.furniture.find((f) => f.kind === 'chair' && distanceTo(table, f.x, f.z) <= 1)!;
    sitOn(world.model, chair);
    return { ...world, table, chair };
  };

  it("is called for (its prompt says so): the server comes over and takes it, it's poured, she carries it over, it's paid for and had", () => {
    const { model, inn, table } = atATable();
    const server = model.folk.find((n) => n.role === 'server' && n.where === inn)!;
    const said: Array<[string, string]> = [];
    const bar = createBar(model, { ...view, speak: (who, text) => said.push([who.role, text]) });
    model.hero.money = 100;
    expect([atOrderSeat(model), tableHere(model)]).toEqual([true, table]);
    expect(orderLabel(model, 'pie').label).toMatch(/^Call for a meat pie · \d+ copper$/);
    expect(bar.canOrder).toBe(true);
    bar.order(barmaidOf(model, inn), 'pie');
    expect(bar.busy).toBe(true);
    let [came, carried] = [false, false];
    play(model, bar, 60, () => {
      came ||= distanceTo(table, server.x, server.z) <= 1.2 && ordersAt(inn).length > 0;
      carried ||= server.carrying === 'pie';
      return !!model.hero.drinking;
    });
    expect([came, carried]).toEqual([true, true]);
    expect(model.hero.drinking).toBeTruthy();
    expect(model.hero.money).toBe(100 - buyPrice('meatPie'));
    expect(said.every(([who]) => who === 'server')).toBe(true); // (her word, not the barmaid's)
    expect(mugsAt(inn)).toEqual([]); // (nothing left on the bar for it)
  }, 60_000);

  it("is brought by the barmaid when the server's off her feet", () => {
    const { model, inn, table } = atATable();
    const server = model.folk.find((n) => n.role === 'server' && n.where === inn)!;
    server.resting = true;
    const barkeep = barmaidOf(model, inn);
    const bar = createBar(model, view);
    model.hero.money = 100;
    bar.order(barkeep, 'ale');
    let came = false;
    play(model, bar, 60, () => {
      came ||= distanceTo(table, barkeep.x, barkeep.z) <= 1.2;
      return !!model.hero.drinking;
    });
    expect(came).toBe(true);
    expect(model.hero.drinking).toBeTruthy();
    play(model, bar, 4); // (a moment with them, as she would)
    expect(barkeep.serving).toBe(false); // (free again for the bar)
  }, 60_000);

  it('is called off on getting up: nothing poured for it, nothing paid, the server back to her rounds', () => {
    const { model, inn } = atATable();
    const bar = createBar(model, view);
    model.hero.money = 100;
    bar.order(barmaidOf(model, inn), 'ale');
    play(model, bar, 4);
    model.sitOrStand(); // (up)
    play(model, bar, 40);
    expect([bar.busy, ordersAt(inn).length, model.hero.drinking ?? null, model.hero.money]).toEqual([false, 0, null, 100]);
  }, 60_000);

  it("isn't to be had at a chair that's no table's, nor upstairs: F there does nothing", () => {
    const { model } = atATable();
    model.inside!.seated!.seat.piece = { ...model.inside!.seated!.seat.piece, x: 999 }; // (a chair off on its own)
    expect([atOrderSeat(model), createBar(model, view).canOrder]).toEqual([false, false]);
  });
});

describe('the server, sat by the fire', () => {
  it("is up from her chair before carrying a table's drinks over (not walking the room sat)", () => {
    const { model, inn, furniture } = inTheInn();
    const server = model.npcs.find((n) => n.role === 'server' && n.home === inn)!;
    model.work.start(inn, 'innServer');
    for (let t = 0; t < 20 && !server.seat; t += 0.1) model.update(0, 0, 0.1);
    expect(server.seat).toBeTruthy(); // (her break)
    model.work.end(true);
    serveTable(server, furniture.find((f) => f.kind === 'tavernTable')!, 'ale', () => {}, model.seed);
    expect([server.seat, server.y]).toEqual([null, 0]);
  });
});

describe("the tables' orders with the barkeep, the shift over", () => {
  it("are out of her queue, the one at its front too: not poured after for no one", () => {
    const { model, inn, furniture } = inTheInn();
    const chair = furniture.find((f) => f.kind === 'chair')!;
    const patron = model.npcs.find((n) => n.role === 'villager' && n.inn === inn)!;
    Object.assign(patron, { where: inn, x: chair.x + 1, z: chair.z, steps: [{ kind: 'sit', seat: seatOf(chair)!, for: 60 }], path: null, waited: 0 });
    model.update(0, 0, 0.1);
    expect(model.work.start(inn, 'innServer')).toBe(true);
    const shift = model.work.shift as InnShift;
    for (let t = 0; t < 15 && shift.wants.get(patron)?.state !== 'calling'; t += 0.1) shift.update(model.folk, 0.1);
    shift.use({ x: patron.x + 0.5, z: patron.z }, model.folk); // (their order taken: to her)
    expect(ordersAt(inn)).toHaveLength(1);
    model.work.end(true);
    expect(ordersAt(inn)).toEqual([]);
  });
});

describe('the tables, the hero serving them', () => {
  it("never take the server's order: on her break in a chair by the fire, she's no patron", () => {
    const { model, inn, furniture } = inTheInn();
    const chair = furniture.find((f) => f.kind === 'chair')!;
    const server = model.npcs.find((n) => n.role === 'server' && n.home === inn)!;
    expect(model.work.start(inn, 'innServer')).toBe(true);
    Object.assign(server, { x: chair.x, z: chair.z, seat: seatOf(chair), stood: { x: chair.x + 1, z: chair.z }, steps: [{ kind: 'wait', for: 999 }] }); // (the armchair taken: a chair, then)
    const shift = model.work.shift as InnShift;
    for (let t = 0; t < 20; t += 0.1) shift.update([server], 0.1);
    expect([shift.wants.has(server), !!server.awaiting]).toEqual([false, false]);
  });
});

describe('the busy hour', () => {
  it("brings no one in who's abed, or off to it: a night shift's a quiet one", () => {
    const { model, inn } = inTheInn();
    const village = model.npcs.filter((n) => n.role === 'villager' && n.inn === inn);
    for (const n of village) Object.assign(n, { where: n.home, seat: { piece: { kind: 'bed' }, lying: true, x: n.x, z: n.z, y: 0, facing: 0 }, steps: [{ kind: 'wait', for: 999 }] });
    expect(model.work.start(inn, 'innServer')).toBe(true);
    for (let t = 0; t < 60; t += 0.1) model.work.shift!.update(model.folk, 0.1, model.hero);
    expect(village.filter((n) => n.steps.some((s) => s.kind === 'settle'))).toEqual([]);
  });
});

describe('the barkeep, the hero serving the tables', () => {
  it("pours the tables' orders before the stools' (the hero stood waiting at the counter's end)", () => {
    const { model, inn, furniture } = inTheInn();
    const [stool] = furniture.filter((f) => f.kind === 'barStool');
    const order: string[] = [];
    placeOrder(inn, { stool, by: null, drink: 'ale', served: () => order.push('stool') });
    placeOrder(inn, { stool: { ...stool, z: stool.z + 1 }, by: null, drink: 'ale', batch: true, served: () => order.push('table') });
    const barkeep = model.folk.find((n) => n.role === 'barkeep' && n.where === inn)!;
    Object.assign(barkeep, { serving: false });
    callBarkeep(barkeep);
    for (let t = 0; t < 60 && order.length < 2; t += 0.1) model.update(0, 0, 0.1);
    expect(order).toEqual(['table', 'stool']);
  }, 60_000);
});

describe('a pie plate left on the bar, behind the bar at work', () => {
  it('is cleared off it, but never washed into a tankard', () => {
    const { model, inn, furniture } = inTheInn();
    const stool = furniture.find((f) => f.kind === 'barStool')!;
    const shift = new BarShift(inn, JOBS.innBarkeep.ranks[0], model.seed);
    setMug(inn, stool.z, false, 3, 'pie'); // (the hero's, from before)
    const row = { x: AISLE_X, z: stool.z };
    expect(shift.actionAt(row)).toMatchObject({ kind: 'gather', z: stool.z });
    shift.use(row);
    expect([mugsAt(inn), shift.held]).toEqual([[], []]);
    shift.release();
  });
});
