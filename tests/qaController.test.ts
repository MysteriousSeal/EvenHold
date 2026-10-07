// @vitest-environment happy-dom
// QA: the keys (controller/GameController.ts, KeyboardInput.ts), pressed as a player would, a frame at a time: W A S
// D (and the arrows) walk the way the camera faces, together on the slant, let go: still; the window left, nothing
// held. E in its order: chopping, it stops (the logs at their feet not picked up); else what's in reach picked up,
// before anything else; a tree, an axe in hand: chopping; the notice board: its window; the well: a coin; a door, last;
// at work, the work's alone (no door). Held, E once. Space: a blow; Shift: a roll; Q held: the guard, let go: down;
// 1 to 8: what's on the action bar; Tab: a foe in sight, Escape: none. Paused, none of it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { setAction } from '../src/model/hero/actionBar';
import { TEST_MAP_SIZE } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { GameController } = await import('../src/controller/GameController');

// A view as far as the keys need one: the camera facing -z, its right +x.
const fakeView = () => ({ canvas: document.createElement('canvas'), pickEnemy: () => null, getMovementAxes: () => ({ forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } }), render() {}, update() {} });

type Hooks = { read: number[]; work: unknown[]; picked: unknown[] };
function play(model = new GameModel(1, TEST_MAP_SIZE)) {
  const hooks: Hooks = { read: [], work: [], picked: [] };
  const controller = new GameController(model, fakeView() as never, { uncapped: false, onRead: (b) => hooks.read.push(b), onWork: (i) => hooks.work.push(i), onPickUp: (i) => hooks.picked.push(i) });
  const step = (frames = 1) => {
    for (let i = 0; i < frames; i++) (controller as unknown as { step(dt: number): void }).step(1 / 30);
  };
  return { model, controller, step, hooks };
}
const key = (code: string, down: boolean, extra: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, ...extra }));
const tap = (code: string, extra: KeyboardEventInit = {}) => [key(code, true, extra), key(code, false, extra)];
const released: string[] = [];
const hold = (code: string) => [key(code, true), released.push(code)];
afterEach(() => {
  for (const code of released.splice(0)) key(code, false);
  window.dispatchEvent(new Event('blur'));
});

describe('the keys: walking', () => {
  it('W A S D (and the arrows) walk the way the camera faces; two together, on the slant; let go, still', () => {
    const { model, step } = play();
    const start = { ...model.hero };
    hold('KeyW');
    step(15);
    expect(model.hero.z).toBeLessThan(start.z - 0.3); // (forward: -z)
    expect(Math.abs(model.hero.x - start.x)).toBeLessThan(0.05);
    hold('ArrowRight');
    const at = { x: model.hero.x, z: model.hero.z };
    step(15);
    expect(model.hero.x).toBeGreaterThan(at.x + 0.2); // (and right: +x)
    expect(model.hero.z).toBeLessThan(at.z - 0.2);
    for (const code of released.splice(0)) key(code, false);
    const still = { x: model.hero.x, z: model.hero.z };
    step(10);
    expect([model.hero.x, model.hero.z]).toEqual([still.x, still.z]);
  });

  it('lets go of every key held when the window loses focus (no walking on by itself)', () => {
    const { model, step } = play();
    key('KeyD', true);
    window.dispatchEvent(new Event('blur'));
    const at = model.hero.x;
    step(10);
    expect(model.hero.x).toBe(at);
  });

  it('does nothing at all paused', () => {
    const { model, controller, step } = play();
    controller.paused = true;
    hold('KeyW');
    tap('Space');
    const at = { ...model.hero };
    step(10);
    expect([model.hero.x, model.hero.z, model.attackProgress]).toEqual([at.x, at.z, null]);
  });
});

describe('the keys: E, in its order', () => {
  it('picks up what lies in reach before anything else (a tree to chop beside it, an axe in hand)', () => {
    const { model, step, hooks } = play();
    const tree = model.trees.find((t) => t.kind === 'birch')!;
    Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z });
    model.hero.equipment.mainHand = 'hatchet';
    model.dropLoot('wolfFang', model.hero.x, model.hero.z);
    tap('KeyE');
    step();
    expect([hooks.picked, model.lumber.chopping]).toEqual([['wolfFang'], null]);
    tap('KeyE'); // (nothing left to pick up: the tree)
    step();
    expect(model.lumber.chopping?.tree).toBe(tree);
  });

  it('chopping, stops it (the logs at their feet left lying); held down, once', () => {
    const { model, step, hooks } = play();
    const tree = model.trees.find((t) => t.kind === 'birch')!;
    Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z });
    model.hero.equipment.mainHand = 'hatchet';
    model.lumber.use();
    step(Math.ceil(model.lumber.chopSeconds * 30) + 2); // (a chop: a log at their feet)
    expect(model.loot.length).toBeGreaterThan(0);
    key('KeyE', true);
    key('KeyE', true, { repeat: true }); // (held: the key's own repeats)
    step(2);
    key('KeyE', false);
    expect(model.lumber.chopping).toBeNull();
    expect(hooks.picked).toEqual([]); // (stopping took the press: nothing picked up with it)
  });

  it('by the inn\'s notice board, opens its work; at work, E is the work\'s alone (never the door)', () => {
    const { model, step, hooks } = play();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    const board = model.inside!.furniture.find((f) => f.kind === 'noticeBoard')!;
    Object.assign(model.hero, board.wall === 'left' ? { x: board.x - 0.5 + 0.8, z: board.z } : { x: board.x, z: board.z - 0.5 + 0.8 });
    tap('KeyE');
    step();
    expect(hooks.work).toEqual([inn]);
    model.work.start(inn, 'innServer');
    Object.assign(model.hero, { x: inn.x, z: inn.z }); // (by the way out)
    const room = model.inside;
    tap('KeyE');
    step();
    expect(model.inside).toBe(room); // (still in: no leaving at work)
    model.work.end(true);
  });

  it('beside a village well, a silver coin tossed in for a blessing', () => {
    const { model, step } = play();
    const village = model.villages[0];
    Object.assign(model.hero, { x: village.x, z: village.z, money: 500 });
    tap('KeyE');
    step();
    expect(model.hero.money).toBeLessThan(500);
    expect(model.hero.blessings?.length).toBeGreaterThan(0);
  });

  it('by a door, and nothing else in reach, through it', () => {
    const { model, step } = play();
    const house = model.entrances.find((e) => e.type === 'house')!;
    Object.assign(model.hero, { x: house.x, z: house.z });
    tap('KeyE');
    step();
    expect(model.inside?.entrance).toBe(house);
  });
});

describe('the keys: the rest', () => {
  it('Space: a blow; Shift: a roll; Q held: the guard up, let go: down', () => {
    const { model, step } = play();
    tap('Space');
    step();
    expect(model.attackProgress).not.toBeNull();
    step(40); // (the blow over)
    hold('KeyW');
    tap('ShiftLeft');
    step();
    expect(model.moves.roll).not.toBeNull();
    for (const code of released.splice(0)) key(code, false);
    step(40);
    key('KeyQ', true);
    step();
    expect(model.moves.guard).not.toBeNull();
    key('KeyQ', false);
    step();
    expect(model.moves.guard).toBeNull();
  });

  it('1 to 8: what\'s in that slot of the action bar, had from the bag', () => {
    const { model, step } = play();
    model.hero.bag.ale = 2;
    setAction(model.hero, 2, 'ale');
    model.hero.energy = 1;
    tap('Digit3');
    step();
    expect(model.hero.bag.ale).toBe(1);
  });

  it('Tab: the nearest foe in sight focused; Escape: none', () => {
    const { model, step } = play();
    const foe = model.enemies[0];
    Object.assign(foe, { x: model.hero.x + 2, z: model.hero.z, state: 'wander' });
    tap('Tab');
    step();
    expect(model.focused).toBe(foe);
    tap('Escape');
    expect(model.focused).toBeNull();
  });
});
