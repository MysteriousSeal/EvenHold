// Serving an inn's tables (model/jobs/: innShift.ts, work.ts, jobs.ts): a patron sat at a table calls; the order
// taken by them goes to the barkeep's queue with the bar's others, and is ready at the counter's end once she's set it
// down; the tray filled there (no more than the rank allows); theirs set down before them off the tray, a wage and a
// tip the quicker it came; left waiting, they walk
// out; what they've had left empty on their table, to clear and take back (a cluttered table souring the next). At
// work: the hero paid as they go, experience in the job (a rank risen), their own besides; the inn's server off her
// feet meanwhile; the shift over at its time (a bonus for a clean one) or on leaving the inn; their record saved.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { InnShift } from '../src/model/jobs/innShift';
import { REACH, SHIFT } from '../src/model/jobs/shift';
import { JOBS, rankIn, recordOf } from '../src/model/jobs/jobs';
import { onShift } from '../src/model/jobs/shiftsAt';
import { ordersAt } from '../src/model/inn/barOrders';
import { roomAction } from '../src/model/inn/roomLetting';
import { layoutOf } from '../src/model/interiors/indoors';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { boardFace } from '../src/model/jobs/work';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { TEST_SEEDS } from './support/testWorld';
import type { Entrance } from '../src/model/interiors/interiors';
import type { Npc } from '../src/model/npcs/npcs';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE } from './support/testWorld';

const RANKS = JOBS.innServer.ranks;

// A patron sat at a table chair at (x, z).
const patronAt = (inn: Entrance, id: number, x: number, z: number) =>
  ({ id, name: `P${id}`, where: inn, x, z, seat: { piece: { kind: 'chair' } }, awaiting: false, drinking: null, waited: 0, steps: [], role: 'villager', inn: null }) as unknown as Npc;

// A model with the hero in an inn, and a patron of it sat on a chair at (3, 3).
function atTheInn() {
  const model = new GameModel(1, TEST_MAP_SIZE);
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  ordersAt(inn).splice(0); // (the bar's own orders let be: only the shift's here)
  return { model, inn, patron: patronAt(inn, 77, 3, 3) };
}

// The shift on `seconds`, a tenth at a time.
const run = (shift: InnShift, folk: Npc[], seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) shift.update(folk, 0.1);
};

// The barkeep, as her rounds would: each of the shift's orders in her queue set down at the counter's end.
const pour = (inn: Entrance) => {
  for (const order of ordersAt(inn).splice(0)) order.served();
};

// Patrons' orders taken, poured, and up on the tray.
function fetched(shift: InnShift, inn: Entrance, ...folk: Npc[]) {
  for (const p of folk) shift.use({ x: p.x + 0.5, z: p.z }, folk);
  pour(inn);
  shift.use(shift.pickupSpot, folk);
}

describe('a shift at the tables', () => {
  it("a patron calls; the order's taken, poured by the barkeep, fetched from the counter's end, and set down for a wage and a tip", () => {
    const { model, inn, patron } = atTheInn();
    const shift = new InnShift(inn, RANKS[0], model.seed);
    run(shift, [patron], 13);
    expect(shift.wants.get(patron)?.state).toBe('calling');
    expect(patron.awaiting).toBe(true);
    const by = { x: patron.x + REACH * 0.7, z: patron.z };
    expect(shift.actionAt(by)?.kind).toBe('take');
    expect(shift.use(by, [patron])).toBe(0);
    expect(shift.wants.get(patron)?.state).toBe('ordered');
    expect(ordersAt(inn)).toHaveLength(1); // (with the barkeep, in her queue)
    expect(shift.actionAt(shift.pickupSpot)).toBeNull(); // (not set down yet)
    pour(inn);
    expect(shift.readyOrders).toEqual([shift.wants.get(patron)!.order]);
    expect(shift.actionAt(shift.pickupSpot)?.kind).toBe('counter');
    shift.use(shift.pickupSpot, [patron]);
    expect(shift.carrying).toBe(shift.wants.get(patron)!.order);
    expect(shift.actionAt(by)).toMatchObject({ kind: 'serve', want: { npc: patron } });
    const paid = shift.use(by, [patron])!;
    expect(paid).toBeGreaterThanOrEqual(3 + 1); // (a wage, and a tip)
    expect([shift.served, patron.awaiting, !!patron.drinking, shift.tray.length]).toEqual([1, false, true, 0]);
  });

  it('pays a bigger tip the quicker it came', () => {
    const tipAfter = (wait: number) => {
      const { model, inn, patron } = atTheInn();
      const shift = new InnShift(inn, RANKS[0], model.seed);
      run(shift, [patron], 13);
      shift.use({ x: patron.x + 0.5, z: patron.z }, [patron]);
      run(shift, [patron], wait);
      pour(inn);
      shift.use(shift.pickupSpot, [patron]);
      return shift.use({ x: patron.x + 0.5, z: patron.z }, [patron])!;
    };
    expect(tipAfter(0)).toBeGreaterThan(tipAfter(20));
  });

  it("sets down a patron's own order off the tray, whatever's first on it", () => {
    const { model, inn } = atTheInn();
    const [a, b] = [patronAt(inn, 81, 2, 4), patronAt(inn, 82, 6, 4)];
    const shift = new InnShift(inn, RANKS[1], model.seed); // (two on the tray)
    run(shift, [a, b], 13);
    fetched(shift, inn, a, b);
    expect(shift.tray).toHaveLength(2);
    const second = shift.tray[1].kind === 'order' ? shift.tray[1].want.npc : null; // (theirs not first on it)
    const by = { x: second!.x + 0.5, z: second!.z };
    expect(shift.actionAt(by)).toMatchObject({ kind: 'serve', want: { npc: second } });
    expect(shift.use(by, [a, b])).toBeGreaterThan(0);
    expect(shift.tray).toHaveLength(1);
    expect(shift.tray[0].kind === 'order' && shift.tray[0].want.npc).not.toBe(second);
  });

  it('a patron left waiting too long walks out, up from their seat, and calls no more', () => {
    const { model, inn, patron } = atTheInn();
    const shift = new InnShift(inn, RANKS[0], model.seed);
    run(shift, [patron], 13 + 45 + 30);
    expect(shift.walkedOut).toBe(1);
    expect(shift.wants.size).toBe(0);
    expect(patron.awaiting).toBe(false);
    expect(patron.waited).toBe(Infinity);
  });

  it('fills the tray at the counter only as far as the rank allows', () => {
    const { model, inn } = atTheInn();
    const folk = [0, 1, 2].map((i) => patronAt(inn, 80 + i, 2 + i * 2, 4));
    for (const [rank, carried] of [[RANKS[0], 1], [RANKS[3], 3]] as const) {
      const shift = new InnShift(inn, rank, model.seed);
      run(shift, folk, 13);
      fetched(shift, inn, ...folk);
      expect(shift.tray).toHaveLength(carried);
      shift.release();
      for (const p of folk) p.awaiting = false;
    }
  });

  it('leaves what was had empty on the table: cleared onto the tray, taken back for a copper; a cluttered table sours the next', () => {
    const { model, inn, patron } = atTheInn();
    const shift = new InnShift(inn, RANKS[0], model.seed);
    const table = model.inside!.furniture.find((f) => f.kind === 'tavernTable')!;
    Object.assign(patron, { x: table.x + 1, z: table.z }); // (sat at it)
    run(shift, [patron], 13);
    fetched(shift, inn, patron);
    shift.use({ x: patron.x + 0.3, z: patron.z }, [patron]);
    run(shift, [patron], 16); // (had it)
    expect(shift.empties).toHaveLength(1);
    // A patron sitting down to it now starts the shorter of patience.
    const next = patronAt(inn, 90, table.x - 1, table.z);
    run(shift, [next], 13);
    expect(shift.wants.get(next)!.of).toBeLessThan(40);
    shift.use({ x: next.x - 0.3, z: next.z }, [next]); // (their order taken first)
    expect(shift.actionAt(table)?.kind).toBe('clear');
    shift.use(table, [next]);
    expect([shift.empties.length, shift.tray[0]?.kind]).toEqual([0, 'empty']);
    expect(shift.use(shift.pickupSpot, [next])).toBe(1); // (given back: a copper)
    expect([shift.cleared, shift.tray.length]).toEqual([1, 0]);
  });
});

describe('at work', () => {
  it("pays the hero at the shift's end, all at once (a clean shift's bonus besides); experience as they go (a rank risen), and their own", () => {
    const { model, inn, patron } = atTheInn();
    recordOf(model.hero, 'innServer').xp = RANKS[1].from - 1;
    expect(model.work.start(inn)).toBe(true);
    expect(onShift(inn)).toBe('innServer'); // (the server off her feet)
    const shift = model.work.shift as InnShift;
    const [money, xp] = [model.hero.money, model.hero.xp];
    run(shift, [patron], 13);
    Object.assign(model.hero, { x: patron.x + 0.5, z: patron.z });
    expect(model.work.use()).toBe(true); // (the order taken)
    pour(inn);
    Object.assign(model.hero, shift.pickupSpot);
    expect(model.work.use()).toBe(true); // (fetched)
    Object.assign(model.hero, { x: patron.x + 0.5, z: patron.z });
    expect(model.work.use()).toBe(true); // (served)
    expect(shift.earned).toBeGreaterThan(0);
    expect(model.hero.money).toBe(money); // (owed, not paid: not till the end)
    expect(model.hero.xp).toBeGreaterThan(xp);
    expect(recordOf(model.hero, 'innServer')).toMatchObject({ served: 1, earned: 0 });
    expect(rankIn('innServer', recordOf(model.hero, 'innServer').xp).rank.name).toBe(RANKS[1].name);
    expect(model.takeEvents().some((e) => e.kind === 'jobRank')).toBe(true);
    const earned = shift.earned;
    shift.left = 0;
    model.work.update(0.1);
    expect(model.work.shift).toBeNull();
    expect(onShift(inn)).toBeUndefined();
    const events = model.takeEvents();
    const over = events.find((e) => e.kind === 'shift');
    expect(over).toMatchObject({ served: 1, walkedOut: 0, early: false });
    const bonus = over && 'bonus' in over ? over.bonus : 0;
    expect(bonus).toBeGreaterThan(0);
    expect(model.hero.money).toBe(money + earned + bonus); // (all of it, at once)
    expect(events.filter((e) => e.kind === 'coins')).toEqual([{ kind: 'coins', amount: earned + bonus }]);
    expect(recordOf(model.hero, 'innServer')).toMatchObject({ shifts: 1, best: 1, earned: earned + bonus });
  });

  it("counts only orders served toward the job (empties given back are pay, not experience)", () => {
    const { model, inn } = atTheInn();
    model.work.start(inn);
    const shift = model.work.shift as InnShift;
    const table = model.inside!.furniture.find((f) => f.kind === 'tavernTable')!;
    shift.empties.push({ table, x: table.x, z: table.z, drink: 'ale' });
    Object.assign(model.hero, { x: table.x, z: table.z });
    expect(model.work.use()).toBe(true); // (cleared onto the tray)
    Object.assign(model.hero, shift.pickupSpot);
    expect(model.work.use()).toBe(true); // (given back)
    expect([shift.cleared, shift.earned, recordOf(model.hero, 'innServer').xp, recordOf(model.hero, 'innServer').served]).toEqual([1, 1, 0, 0]);
  });

  it('is over early on leaving the inn, paid what was earned; lasts SHIFT seconds at most', () => {
    const { model, inn } = atTheInn();
    model.work.start(inn);
    expect(model.work.shift!.left).toBe(SHIFT);
    expect(model.work.start(inn)).toBe(false); // (one at a time)
    model.teleport(model.entrances[0].x, model.entrances[0].z); // (out of the inn)
    model.update(0, 0, 0.1);
    expect(model.work.shift).toBeNull();
    expect(model.takeEvents().find((e) => e.kind === 'shift')).toMatchObject({ early: true });
  });

  it('holds the hero to the work: no leaving by the door, no sitting down, till the shift is over', () => {
    const { model, inn } = atTheInn();
    model.work.start(inn);
    const room = model.inside!.room;
    Object.assign(model.hero, { x: room.door, z: room.depth - 1 }); // (at the way out)
    expect(model.doorInReach).toBe(inn);
    expect(model.useDoor()).toBe(false);
    expect(model.inside?.entrance).toBe(inn);
    const chair = model.inside!.furniture.find((f) => f.kind === 'chair')!;
    Object.assign(model.hero, { x: chair.x, z: chair.z + 0.6 });
    expect(model.sitOrStand()).toBe(false);
    model.work.end(true);
    Object.assign(model.hero, { x: room.door, z: room.depth - 1 });
    expect(model.useDoor()).toBe(true); // (the shift over: out as ever)
  });

  it("offers no room to rent nor bed to sleep in while at work (G does nothing)", () => {
    const { model, inn } = atTheInn();
    const barkeep = model.npcs.find((n) => n.role === 'barkeep' && n.where === inn)!;
    Object.assign(model.hero, { x: barkeep.x + 1, z: barkeep.z }); // (across the bar from her)
    expect(roomAction(model)?.kind).toBe('rent');
    model.work.start(inn);
    expect(roomAction(model)).toBeNull();
    model.work.end(true);
    expect(roomAction(model)?.kind).toBe('rent');
  });

  it("keeps the hero's record in each job with their save", () => {
    const { model } = atTheInn();
    Object.assign(recordOf(model.hero, 'innServer'), { xp: 42, shifts: 3, served: 40, best: 17, earned: 512 });
    const again = new GameModel(1, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), 1)!);
    expect(again.hero.jobs?.innServer).toEqual({ xp: 42, shifts: 3, served: 40, best: 17, earned: 512 });
  });

  it('brings a busy hour: the village comes in for the tables, calls, and the barkeep pours their orders; the server takes a break', () => {
    const model = new GameModel(1, { width: 512, depth: 512 });
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    Object.assign(model.hero, { x: model.inside!.room.width / 2, z: model.inside!.room.depth / 2 }); // (out of the doorway)
    model.work.start(inn);
    const shift = model.work.shift as InnShift;
    for (let t = 0; t < 60; t += 1 / 30) model.update(0, 0, 1 / 30);
    const sat = model.folk.filter((n) => n.where === inn && n.seat?.piece.kind === 'chair');
    expect(sat.length).toBeGreaterThanOrEqual(3);
    const calling = [...shift.wants.values()].filter((w) => w.state === 'calling').sort((a, b) => b.patience - a.patience)[0]; // (the freshest call)
    expect(calling?.patience).toBeGreaterThan(20);
    shift.use({ x: calling.npc.x + 0.5, z: calling.npc.z }, model.folk);
    for (let t = 0; t < 40 && shift.readyOrders.length === 0; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect(shift.readyOrders.length).toBeGreaterThan(0); // (the barkeep, on her own rounds, set it down)
    const server = model.folk.find((n) => n.role === 'server' && n.home === inn)!;
    expect(server.resting).toBe(true);
  }, 60_000);
});

describe("an inn's notice board", () => {
  it('hangs in every inn (of every test world, and a full 512 one), never over the fire: room before it to read it', () => {
    const worlds = [...TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)), new GameModel(11, { width: 512, depth: 512 })];
    const r = HERO_RADIUS * INDOOR_SCALE;
    let inns = 0;
    for (const model of worlds) {
      for (const inn of model.entrances.filter((e) => e.type === 'inn')) {
        inns++;
        const { furniture } = layoutOf(model.seed, inn);
        const boards = furniture.filter((f) => f.kind === 'noticeBoard');
        expect(boards, `seed ${model.seed}, the inn at ${inn.x},${inn.z}`).toHaveLength(1);
        const face = boardFace(boards[0]);
        const before = boards[0].wall === 'left' ? { x: face.x + 0.8, z: face.z } : { x: face.x, z: face.z + 0.8 }; // (where it's read from)
        expect(bumpsFurniture(furniture, before.x, before.z, r), `seed ${model.seed}, the inn at ${inn.x},${inn.z}: before its board`).toBe(false);
      }
    }
    expect(inns).toBeGreaterThan(20);
  }, 60_000);

  it('has its work posted on it: read only from before it (not from the side, not from across the room)', () => {
    const { model, inn } = atTheInn();
    const board = model.inside!.furniture.find((f) => f.kind === 'noticeBoard')!;
    const out = (k: number) => (board.wall === 'left' ? { x: board.x - 0.5 + k, z: board.z } : { x: board.x, z: board.z - 0.5 + k }); // (k tiles out from its wall, before its middle)
    Object.assign(model.hero, out(0.8));
    expect(model.work.noticeInReach).toBe(inn);
    Object.assign(model.hero, out(2)); // (too far out)
    expect(model.work.noticeInReach).toBeNull();
    Object.assign(model.hero, { ...out(0.8), ...(board.wall === 'left' ? { z: board.z + 1 } : { x: board.x + 1 }) }); // (a tile to the side: not before it)
    expect(model.work.noticeInReach).toBeNull();
  });
});
