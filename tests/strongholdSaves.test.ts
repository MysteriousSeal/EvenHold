// A stronghold saved and loaded at awkward moments of a run played by a
// scripted hero (support/strongholdDelve.ts), in the game itself: with two of
// the four wings' bosses slain; in the middle of a boss's fight, those he
// called up about; with the great hall's gate just open; with the king slain
// and his chest shut; with the chest open and what it held picked up. After
// each load: the gate as it was, the slain still slain, those called up gone
// and never counted, the cleared share the same, the named pieces carried
// neither lost nor twice had; and played on from a load mid-run to its end,
// the five pieces once each. (What a load loses of what LIES on its floor,
// and of the point its king gave: strongholdKnown.test.ts.) One run, about
// 12 seconds.
import { beforeAll, describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BOSS_POST, CHEST_POST } from '../src/model/dungeons/dungeonRecord';
import { isBoss } from '../src/model/enemies/enemyLevels';
import { parseSave, restore, snapshot } from '../src/model/save';
import { WINGS } from '../src/model/strongholds/strongholdLayout';
import { STRONGHOLD_FOE_ID, StrongholdRun, WING_BOSS, WING_POST, strongholdPosts } from '../src/model/strongholds/strongholdFoes';
import { bossPiece } from '../src/model/strongholds/strongholdLoot';
import { strongholdKey } from '../src/model/strongholds/strongholds';
import type { GearKey } from '../src/model/human/items/gear';
import { Delve, summoned } from './support/strongholdDelve';
import { TEST_MAP_SIZE } from './support/testWorld';

const SEED = 3;

// A moment of the run: its save, and how things stood then.
interface Moment {
  json: string;
  share: number;
  shut: boolean;
  left: string[];
  slain: number[];
  held: GearKey[];
  called: number; // those called up, standing then
  at: { x: number; z: number };
}

const moments: Record<string, Moment> = {};
let played!: Delve;

const keep = (d: Delve, name: string): void => {
  const { run, model } = d;
  moments[name] = {
    json: JSON.stringify(snapshot(model)),
    share: run.share,
    shut: run.gateShut,
    left: [...run.wingsLeft],
    slain: [...model.cleared(strongholdKey(d.stronghold))].sort((a, b) => a - b),
    held: [...d.namedHeld].sort(),
    called: d.standing.filter(summoned).length,
    at: { x: d.hero.x, z: d.hero.z },
  };
};

// A moment's save taken up in a world made afresh.
const load = (name: string): Delve => {
  const model = new GameModel(SEED, TEST_MAP_SIZE);
  restore(model, parseSave(moments[name].json, SEED)!);
  return new Delve(model).strong(4);
};

// What every load must show of its moment.
const sound = (name: string): Delve => {
  const then = moments[name];
  const d = load(name);
  const { run, model } = d;
  expect(model.dungeon).toBeInstanceOf(StrongholdRun);
  expect([run.gateShut, d.inside.shut]).toEqual([then.shut, then.shut]);
  expect(run.wingsLeft).toEqual(then.left);
  expect(run.share).toBe(then.share);
  expect(model.clearedShare(d.stronghold.entrance)).toBe(then.share);
  expect([...model.cleared(strongholdKey(d.stronghold))].sort((a, b) => a - b)).toEqual(then.slain);
  // Those standing: every post not slain, at its post, whole; no one called up.
  const posts = strongholdPosts(SEED, d.inside).filter((p) => !then.slain.includes(p.post));
  expect(model.foes.map((f) => f.id - STRONGHOLD_FOE_ID).sort((a, b) => a - b)).toEqual(posts.map((p) => p.post).sort((a, b) => a - b));
  expect(model.foes.some(summoned)).toBe(false);
  expect(model.foes.every((f) => f.hp === f.maxHp && f.state === 'wander')).toBe(true);
  for (const wing of WINGS) expect(!!run.bossOf(wing)).toBe(!then.slain.includes(WING_POST[wing]));
  expect(!!run.king).toBe(!then.slain.includes(BOSS_POST));
  // The hero where they were, on its floor; what they carried, once each.
  expect(d.far(then.at)).toBeLessThan(0.02);
  expect([...d.namedHeld].sort()).toEqual(then.held);
  expect(d.namedHeld.every((piece) => d.hero.bag[piece] === 1)).toBe(true);
  const told = d.events.length;
  d.wait(1);
  expect(d.problems).toEqual([]);
  expect(d.events.slice(told).filter((e) => e.kind === 'unbarred' || e.kind === 'point' || e.kind === 'cleared')).toEqual([]); // (nothing told again)
  return d;
};

describe('a stronghold saved and loaded mid-run', () => {
  beforeAll(() => {
    const d = (played = Delve.on(SEED).strong(4));
    const { model } = d;
    d.enter();
    const { run } = d;
    const wings = () => model.foes.filter((f) => !d.beyond(f));
    d.clear(wings, 'two wings', () => run.wingsLeft.length <= 2);
    d.gather();
    keep(d, 'two bosses slain');
    d.clear(wings, 'a boss met', () => d.standing.some(summoned) && d.standing.some((f) => isBoss(f.kind) && f.state === 'chase' && f.hp < f.maxHp));
    keep(d, 'mid-fight, adds out');
    d.clear(wings, 'the wings', () => !run.gateShut);
    d.gather();
    keep(d, 'the gate just open');
    d.clear(() => model.foes, 'the king', () => !run.king);
    d.wait(0.2);
    keep(d, 'the king slain, his chest shut');
    d.clear(() => model.foes, 'the great hall');
    d.openChest();
    d.gather();
    keep(d, 'the chest open, all picked up');
  }, 120_000);

  it('was played to those moments: two bosses down, a boss hurt with his adds about, the gate open, the king dead with his chest shut, all of it done', () => {
    expect(played.problems).toEqual([]);
    expect(moments['two bosses slain']).toMatchObject({ shut: true, left: { length: 2 } });
    expect(moments['two bosses slain'].held).toHaveLength(2);
    expect(moments['mid-fight, adds out']).toMatchObject({ shut: true });
    expect(moments['mid-fight, adds out'].called).toBeGreaterThan(0);
    expect(moments['the gate just open']).toMatchObject({ shut: false, left: [] });
    expect(moments['the gate just open'].held).toHaveLength(4);
    expect(moments['the king slain, his chest shut'].slain).toContain(BOSS_POST);
    expect(moments['the king slain, his chest shut'].slain).not.toContain(CHEST_POST);
    expect(moments['the chest open, all picked up']).toMatchObject({ share: 1 });
    expect(moments['the chest open, all picked up'].held).toHaveLength(5);
  });

  it('with two of the four slain: the gate shut, the two still slain, the other two at their posts, the pieces carried kept', () => {
    const d = sound('two bosses slain');
    const [gate] = d.inside.plan.gate;
    expect(d.run.free(gate.x, gate.z, 0.14)).toBe(false);
    expect(d.run.wingsLeft).toHaveLength(2);
  });

  it('mid boss fight with adds out: those called up gone and never counted, the boss back at his post whole, his fight to be fought again and his piece left once', { timeout: 60_000 }, () => {
    const then = moments['mid-fight, adds out'];
    const d = sound('mid-fight, adds out');
    expect(then.slain.every((post) => post < 20_000)).toBe(true);
    // Fought again from the load: he falls, and leaves the piece that's his, once.
    const boss = d.standing.filter((f) => isBoss(f.kind) && f.kind !== 'banditKing').sort((a, b) => d.far(a) - d.far(b))[0];
    d.clear(() => d.run.packOf(boss), 'the boss again');
    d.wait(0.5);
    expect(boss.state).toBe('dead');
    expect(d.problems).toEqual([]);
    expect(d.namedLying).toEqual([bossPiece(boss.kind, d.stronghold.level)]);
    expect(d.gather()).toEqual([]);
    expect([...d.namedHeld].sort()).toEqual([...then.held, bossPiece(boss.kind, d.stronghold.level)!].sort());
  });

  it('with the gate just open: open, and walked through; played on from there to the end, the five pieces once each', { timeout: 60_000 }, () => {
    const d = sound('the gate just open');
    for (const t of d.inside.plan.gate) expect(d.run.free(t.x, t.z, 0.14)).toBe(true);
    d.clear(() => d.model.foes, 'the great hall');
    d.wait(0.5);
    expect(d.run.share).toBe(1);
    expect(d.openChest()).toBe(true);
    expect(d.gather()).toEqual([]);
    expect(d.problems).toEqual([]);
    const all = [...WINGS.map((wing) => bossPiece(WING_BOSS[wing], d.stronghold.level)!), bossPiece('banditKing', d.stronghold.level)!];
    expect([...d.namedHeld].sort()).toEqual(all.sort());
    expect(d.namedHeld.every((piece) => d.hero.bag[piece] === 1)).toBe(true);
    expect(d.walkTo(() => d.run.exitOpen!, 0.3, 60)).toBe('there');
    expect(d.model.useDoor()).toBe(true);
    expect(d.model.inside).toBeNull();
  });

  it('with the king slain and his chest shut: whoever he called in gone, the place cleared or as it was, his chest there, shut, opened once for his piece', () => {
    const d = sound('the king slain, his chest shut');
    expect(d.run.chest).toMatchObject({ open: false });
    expect(d.run.exitOpen).not.toBeNull();
    expect(d.openChest()).toBe(true);
    expect(d.namedLying).toEqual([bossPiece('banditKing', d.stronghold.level)]);
    expect(d.gather()).toEqual([]);
    expect(d.openChest()).toBe(false);
    expect(d.namedLying).toEqual([]);
  });

  it('with the chest open and all of it picked up: the chest open and empty, the five pieces carried once each, no one there, the postern the way out', () => {
    const d = sound('the chest open, all picked up');
    expect(d.model.foes).toEqual([]);
    expect(d.run.chest).toMatchObject({ open: true });
    expect(d.openChest()).toBe(false);
    expect(d.model.groundHere.loot.filter((l) => d.namedHeld.includes(l.item as GearKey))).toEqual([]);
    expect(d.namedHeld).toHaveLength(5);
    expect(d.walkTo(() => d.run.exitOpen!, 0.3, 60)).toBe('there');
    expect(d.model.doorInReach).toBe(d.stronghold.entrance);
  });
});
