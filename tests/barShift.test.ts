// Tending an inn's bar (model/jobs/: barShift.ts, pour.ts, work.ts, jobs.ts): a pour begun at the tap (or a bottle
// shelf, for wine) and stopped by E, graded by where it stops (perfect at the line, wider the steadier the rank; run
// over at the brim: spilled, the cup to wash, a copper out of the pay); a patron on a stool handed theirs across the
// bar for a wage and a tip (the better the pour, the more), walking out if kept waiting; the server's tickets for the
// tables poured and set down at the pass, paid once all there, taken by her as she comes by, their empties brought
// back; clean cups running out, the empties gathered and washed. At work: the barkeep off her feet (not to be called
// over), paid at the end all at once, a perfect pour worth more experience in the job; the job's own costume.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BarShift } from '../src/model/jobs/barShift';
import { InnShift } from '../src/model/jobs/innShift';
import { FILL_SECONDS, LINE, bandOf, gradePour, type Pourable } from '../src/model/jobs/pour';
import { JOBS, recordOf } from '../src/model/jobs/jobs';
import { onShift } from '../src/model/jobs/shiftsAt';
import { WAGE } from '../src/model/jobs/shift';
import { BONUS } from '../src/model/jobs/work';
import { callBarkeep, ordersAt } from '../src/model/inn/barOrders';
import { sitAtBar } from '../src/model/inn/barPatrons';
import { mugsAt, setMug } from '../src/model/inn/barMugs';
import { AISLE_X, AT_KEG } from '../src/model/inn/innStaff';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { layoutOf } from '../src/model/interiors/indoors';
import type { Furniture } from '../src/model/interiors/furniture';
import type { Entrance } from '../src/model/interiors/interiors';
import type { Npc } from '../src/model/npcs/npcs';
import { COSTUMES, COSTUME_LOOKS } from '../src/view/meshes/human/gear/costumes';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const RANKS = JOBS.innBarkeep.ranks;

// A model with the hero in an inn (its bar's queue and mugs cleared), the inn's first stool, and a shift at its bar.
function behindTheBar(rank = RANKS[0]) {
  const model = new GameModel(1, TEST_MAP_SIZE);
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  ordersAt(inn).splice(0);
  mugsAt(inn).splice(0);
  const stool = layoutOf(model.seed, inn).furniture.find((f) => f.kind === 'barStool')!;
  return { model, inn, stool, shift: new BarShift(inn, rank, model.seed) };
}

// A villager sat on `stool`, their order (an ale, or now and then a wine) in the bar's queue.
function patronOn(inn: Entrance, stool: Furniture, id = 77): Npc {
  const npc = { id, name: `P${id}`, where: inn, home: null, x: stool.x, z: stool.z, seat: { piece: stool }, awaiting: false, drinking: null, waited: 0, steps: [], role: 'villager', stop: 1, salt: 0 } as unknown as Npc;
  sitAtBar(npc, [npc], stool);
  return npc;
}

// The inn's server, stood at the pass's end (where she takes the tables' drinks).
const serverAt = (inn: Entrance, at: { x: number; z: number }) => ({ id: 5, name: 'Server', role: 'server', home: inn, where: inn, x: at.x, z: at.z, carrying: false, steps: [] }) as unknown as Npc;

// The shift on `seconds`, a tenth at a time (the hero where they stand).
const run = (shift: BarShift, folk: Npc[], seconds: number, hero = { x: 0, z: 0 }) => {
  for (let t = 0; t < seconds; t += 0.1) shift.update(folk, 0.1, hero);
};

// A pour of `drink`, at its station, stopped at `fill` (a frame at a time, as it'd be; `folk`: those about).
function poured(shift: BarShift, drink: Pourable, fill = LINE, folk: Npc[] = []): void {
  const at = drink === 'ale' ? shift.stations.tap : shift.stations.shelves[0];
  expect(shift.actionAt(at)).toMatchObject({ kind: 'pour', drink, dry: false });
  shift.use(at);
  while (shift.pour && shift.pour.fill < fill) shift.update(folk, 1 / 60, at);
  shift.use(at);
}

describe('a pour', () => {
  it('perfect at the line (wider the steadier the hand), frothy over it, short and thin under it, spilled at the brim', () => {
    expect(gradePour(LINE)).toBe('perfect');
    expect(gradePour(LINE + 0.07)).toBe('frothy');
    expect(gradePour(LINE + 0.07, RANKS[4].steady)).toBe('perfect');
    expect(gradePour(LINE - 0.1)).toBe('short');
    expect(gradePour(0.4)).toBe('thin');
    expect(gradePour(1)).toBe('spilled');
    expect(bandOf(RANKS[4].steady)).toBeGreaterThan(bandOf(RANKS[0].steady));
    expect(FILL_SECONDS.wine).toBeLessThan(FILL_SECONDS.ale); // (wine, the harder pour)
  });

  it("at the tap takes a clean tankard; stopped at the line, a perfect ale in hand; a run of them kept", () => {
    const { shift } = behindTheBar(RANKS[3]);
    poured(shift, 'ale');
    expect(shift.clean.ale).toBe(5);
    expect(shift.held).toEqual([{ kind: 'drink', drink: 'ale', grade: 'perfect', streak: 1 }]);
    poured(shift, 'ale');
    expect([shift.streak, shift.last]).toEqual([2, { grade: 'perfect', n: 2 }]);
    poured(shift, 'ale', 0.5);
    expect([shift.streak, shift.best, shift.held.at(-1)]).toEqual([0, 2, { kind: 'drink', drink: 'ale', grade: 'thin', streak: 0 }]);
  });

  it('let fill to the brim, runs over: spilled, the cup in hand to wash, a copper out of the pay (never below none)', () => {
    const { shift } = behindTheBar();
    const at = shift.stations.tap;
    shift.use(at);
    shift.update([], FILL_SECONDS.ale + 0.1, at);
    expect(shift.pour).toBeNull();
    expect(shift.held).toEqual([{ kind: 'empty', drink: 'ale' }]);
    expect([shift.spilled, shift.earned, shift.last?.grade]).toEqual([1, 0, 'spilled']);
  });

  it('walked away from, the cup goes back on the shelf; with no clean cup, none to be begun', () => {
    const { shift } = behindTheBar();
    const at = shift.stations.tap;
    shift.use(at);
    shift.update([], 0.2, { x: at.x, z: at.z + 2 });
    expect([shift.pour, shift.clean.ale]).toEqual([null, 6]);
    shift.clean.ale = 0;
    expect(shift.actionAt(at)).toMatchObject({ kind: 'pour', dry: true });
    expect(shift.use(at)).toBeNull();
  });
});

describe('the stools', () => {
  it("a patron's order is handed across the bar to them: set down before them, a wage and a tip, the better the pour the more", () => {
    const { inn, stool, shift } = behindTheBar();
    const patron = patronOn(inn, stool);
    run(shift, [patron], 0.1);
    const want = [...shift.wants.values()][0];
    expect(want.npc).toBe(patron);
    const row = { x: AISLE_X, z: stool.z };
    expect(shift.actionAt(row)?.kind).not.toBe('hand'); // (nothing in hand for them)
    poured(shift, want.drink, LINE, [patron]);
    expect(shift.actionAt(row)).toMatchObject({ kind: 'hand', want });
    const paid = shift.use(row)!;
    expect(paid).toBeGreaterThan(WAGE + 1);
    expect([shift.served, shift.perfect, shift.held.length, ordersAt(inn).length]).toEqual([1, 1, 0, 0]);
    expect(mugsAt(inn).find((m) => m.z === stool.z)).toMatchObject({ full: true, drink: want.drink }); // (before them)
    expect(patron.awaiting).toBe(false);
    // A thin one's worth less.
    const again = behindTheBar();
    const other = patronOn(again.inn, again.stool, 78);
    run(again.shift, [other], 0.1);
    poured(again.shift, [...again.shift.wants.values()][0].drink, 0.4, [other]);
    expect(again.shift.use(row)!).toBeLessThan(paid);
  });

  it('a patron kept waiting too long gets up and goes, their order out of the queue', () => {
    const { inn, stool, shift } = behindTheBar();
    const patron = patronOn(inn, stool);
    run(shift, [patron], 56);
    expect([shift.walkedOut, shift.wants.size, ordersAt(inn).length, patron.waited]).toEqual([1, 0, 0, Infinity]);
  });

  it("the empty left before a patron's gathered off the bar and washed at the washstand: a clean tankard again", () => {
    const { inn, stool, shift } = behindTheBar();
    setMug(inn, stool.z, false, 3, 'ale');
    shift.clean.ale = 0;
    expect(shift.actionAt({ x: AISLE_X, z: stool.z })).toEqual({ kind: 'gather', empties: 1, z: stool.z });
    shift.use({ x: AISLE_X, z: stool.z });
    expect(shift.held).toEqual([{ kind: 'empty', drink: 'ale' }]);
    const sink = shift.stations.sink!;
    expect(shift.actionAt(sink)).toEqual({ kind: 'wash', empties: 1 });
    shift.use(sink);
    expect([shift.held.length, shift.clean.ale]).toEqual([0, 1]);
  });
});

describe("the tables' tickets", () => {
  // A table of the inn, and `n` villagers sat round it.
  function tableOf(inn: Entrance, seed: number, n: number) {
    const table = layoutOf(seed, inn).furniture.find((f) => f.kind === 'tavernTable')!;
    const folk = Array.from({ length: n }, (_, i) => ({ id: 90 + i, name: `T${i}`, role: 'villager', where: inn, x: table.x + (i ? 0.6 : -0.6), z: table.z, seat: { piece: { kind: 'chair' } }, awaiting: false, drinking: null, waited: 0, steps: [] }) as unknown as Npc);
    return { table, folk };
  }
  // The server's steps as she'd walk them: each hand's work done (what she takes up, what she sets down).
  const walked = (server: Npc) => {
    for (const step of server.steps.splice(0)) if (step.kind === 'hand') step.then();
  };

  it('called only for a table with folk sat at it, a drink each, they waiting on it; none for empty tables', () => {
    const { inn, model, shift } = behindTheBar(RANKS[4]);
    const server = serverAt(inn, { x: 9, z: 9 });
    run(shift, [server], 9);
    expect(shift.tickets).toHaveLength(0); // (no one at the tables)
    const { table, folk } = tableOf(inn, model.seed, 2);
    run(shift, [server, ...folk], 20);
    expect(shift.tickets).toHaveLength(1);
    const [ticket] = shift.tickets;
    expect([ticket.at, ticket.patrons, ticket.ordered.length, ticket.drinks.length]).toEqual([table, folk, 2, 2]);
    expect(folk.every((n) => n.awaiting)).toBe(true);
  });

  it('poured, set down at the pass and paid; the server carries them over and sets each down before whoever asked; their empties back', () => {
    const { inn, model, shift } = behindTheBar(RANKS[4]);
    const server = serverAt(inn, { x: 9, z: 9 });
    const { table, folk } = tableOf(inn, model.seed, 2);
    const all = [server, ...folk];
    run(shift, all, 9);
    const ticket = shift.tickets[0];
    const drinks = [...ticket.drinks];
    for (const drink of drinks) poured(shift, drink, LINE, all);
    const pass = { x: AISLE_X, z: shift.passZ };
    expect(shift.actionAt(pass)).toEqual({ kind: 'pass', drinks: drinks.length });
    expect(shift.use(pass)!).toBeGreaterThan(drinks.length * WAGE);
    expect([ticket.done, shift.served, shift.passMugs.length]).toEqual([true, drinks.length, drinks.length]);
    run(shift, all, 0.1);
    const goes = server.steps.filter((st) => st.kind === 'go').map((st) => (st.kind === 'go' ? st.to : null));
    expect(goes[0]).toEqual(shift.pickupSpot); // (to the counter's end for them)
    expect(Math.hypot(goes[1]!.x - table.x, goes[1]!.z - table.z)).toBeLessThanOrEqual(1.5); // (then to the table)
    walked(server);
    expect(shift.tickets.includes(ticket)).toBe(false);
    expect(folk.map((n) => [n.awaiting, n.drinking?.drink])).toEqual(folk.map((_, i) => [false, ticket.ordered[i]])); // (each what they asked for)
    run(shift, all, 16);
    expect(folk.every((n) => !n.drinking)).toBe(true); // (had)
    run(shift, all, 31);
    expect(shift.passEmpties.slice(0, drinks.length).sort()).toEqual([...drinks].sort());
  });

  it("with no server about to carry them, set down before them all the same", () => {
    const { inn, model, shift } = behindTheBar(RANKS[4]);
    const { folk } = tableOf(inn, model.seed, 1);
    run(shift, folk, 9);
    const ticket = shift.tickets[0];
    for (const drink of [...ticket.drinks]) poured(shift, drink, LINE, folk);
    shift.use({ x: AISLE_X, z: shift.passZ });
    run(shift, folk, 0.1);
    expect([shift.tickets.includes(ticket), folk[0].drinking?.drink]).toEqual([false, ticket.ordered[0]]);
  });

  it('a ticket left too long, given up on: they walk out, what was set down for it back to wash', () => {
    const { inn, model, shift } = behindTheBar();
    const { folk } = tableOf(inn, model.seed, 1);
    run(shift, [serverAt(inn, { x: 9, z: 9 }), ...folk], 9);
    const ticket = shift.tickets[0];
    ticket.set.push({ kind: 'drink', drink: 'ale', grade: 'perfect', streak: 1 });
    ticket.patience = 0.05;
    run(shift, folk, 0.1);
    expect([shift.tickets.includes(ticket), shift.walkedOut, shift.passEmpties]).toEqual([false, 1, ['ale']]);
    expect([folk[0].awaiting, folk[0].waited]).toEqual([false, Infinity]);
  });
});

describe("the counter's end", () => {
  it("is the same place to both jobs: where the server waits, where what's set down for her stands", () => {
    const { model, inn, shift } = behindTheBar();
    const tables = new InnShift(inn, JOBS.innServer.ranks[0], model.seed);
    expect([tables.pickupSpot, tables.barEndZ]).toEqual([shift.pickupSpot, shift.barEndZ]);
    expect(shift.barEndZ).toBe(shift.passZ + 0.5); // (on the pass's row)
    tables.release();
  });
});

describe('the aisle behind the bar', () => {
  it('is walkable in every inn (of every test world, and a full 512 one): from its mouth past the counter to the tap', () => {
    const worlds = [...TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)), new GameModel(11, { width: 512, depth: 512 })];
    const r = HERO_RADIUS * INDOOR_SCALE;
    for (const model of worlds) {
      for (const inn of model.entrances.filter((e) => e.type === 'inn')) {
        const { furniture } = layoutOf(model.seed, inn);
        const counter = furniture.find((f) => f.kind === 'counter')!;
        const where = `seed ${model.seed}, the inn at ${inn.x},${inn.z}`;
        for (let z = counter.z + counter.d; z >= 0; z -= 0.25) expect(bumpsFurniture(furniture, AT_KEG.x, z, r), `${where}: down the aisle at ${z}`).toBe(false); // (by the tap's side of it: past the keg's corner)
        expect(bumpsFurniture(furniture, AT_KEG.x, AT_KEG.z, r), `${where}: at the tap`).toBe(false);
      }
    }
  }, 60_000);
});

describe('at work behind the bar', () => {
  it("the barkeep off her feet (not to be called over); paid at the end, all at once; a perfect pour worth more in the job", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    expect(model.work.start(inn, 'innBarkeep')).toBe(true);
    expect(onShift(inn)).toBe('innBarkeep');
    const shift = model.work.shift as BarShift;
    expect(shift).toBeInstanceOf(BarShift);
    const barkeep = model.folk.find((n) => n.role === 'barkeep' && n.home === inn)!;
    const steps = barkeep.steps;
    callBarkeep(barkeep);
    expect(barkeep.steps).toBe(steps); // (on her break: let be)
    const money = model.hero.money;
    const pour = (fill: number) => {
      Object.assign(model.hero, shift.stations.tap);
      model.work.use();
      while (shift.pour && shift.pour.fill < fill) model.work.update(1 / 60);
      model.work.use();
    };
    pour(LINE);
    ordersAt(inn).splice(0);
    const stool = layoutOf(model.seed, inn).furniture.find((f) => f.kind === 'barStool')!;
    const patron = patronOn(inn, stool);
    const want = { drink: ordersAt(inn)[0].drink };
    if (want.drink !== 'ale') ordersAt(inn)[0].drink = 'ale';
    shift.update([patron], 0.1, model.hero);
    Object.assign(model.hero, { x: AISLE_X, z: stool.z });
    expect(model.work.use()).toBe(true);
    expect(recordOf(model.hero, 'innBarkeep')).toMatchObject({ served: 1, xp: 2 }); // (one served, perfect: twice the learning)
    expect(model.hero.money).toBe(money); // (owed till the end)
    const earned = shift.earned;
    shift.left = 0;
    model.work.update(0.1);
    expect([model.work.shift, onShift(inn)]).toEqual([null, undefined]);
    expect(model.hero.money).toBe(money + earned + BONUS); // (and a clean shift's bonus: one served, none walked out)
    const over = model.takeEvents().find((e) => e.kind === 'shift');
    expect(over).toMatchObject({ job: 'Tending the bar', served: 1, tally: '1 perfect pour · 0 spilled' });
  });

  it('sends the barkeep to sit by the fire: an armchair, or with both taken, the chair nearest it', () => {
    for (const taken of [false, true]) {
      const model = new GameModel(1, TEST_MAP_SIZE);
      const inn = model.entrances.find((e) => e.type === 'inn')!;
      model.enterRoom(inn);
      const { furniture } = layoutOf(model.seed, inn);
      const armchairs = furniture.filter((f) => f.kind === 'armchair');
      const sitters = model.npcs.filter((n) => n.role === 'villager').slice(0, taken ? armchairs.length : 0);
      for (const [i, n] of sitters.entries()) Object.assign(n, { where: inn, x: armchairs[i].x, z: armchairs[i].z, seat: { piece: armchairs[i] }, steps: [{ kind: 'wait', for: 999 }] });
      model.work.start(inn, 'innBarkeep');
      const barkeep = model.folk.find((n) => n.role === 'barkeep' && n.home === inn)!;
      for (let t = 0; t < 25 && !barkeep.seat; t += 0.1) model.update(0, 0, 0.1);
      expect(barkeep.seat?.piece.kind, taken ? 'armchairs taken' : 'armchairs free').toBe(taken ? 'chair' : 'armchair');
      model.work.end(true);
    }
  }, 60_000);

  it("dresses the hero in the tapster's costume: its every look a costume's", () => {
    const looks = Object.values(COSTUMES.innBarkeep);
    expect(looks.length).toBeGreaterThan(0);
    for (const look of looks) expect(COSTUME_LOOKS[look!]).toBeDefined();
    expect(COSTUMES.innBarkeep.head).toBeUndefined(); // (bare-headed, apart from the server's kerchief)
  });
});
