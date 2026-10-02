// @vitest-environment happy-dom
// The main menu with its world (view/title/titleScene.ts, stood in for here:
// no WebGL in tests): the opening first (the heroes not there yet, no menu; a
// key or a click skips it), then the heroes coming, the last played lit;
// a hero clicked in the world chosen; the chosen one clicked again, played.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { snapshot } from '../src/model/save';
import { forgetWorld, savedWorlds } from '../src/controller/storage/saveGame';
import { showMainMenu } from '../src/controller/mainMenu';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const world = vi.hoisted(() => ({ shown: [] as string[], chosen: -1, present: false, skipped: 0, pick: (_: number) => {}, done: () => {} }));
vi.mock('../src/view/title/titleScene', () => ({
  TITLE_HEROES: 8,
  createTitleScene: () => ({
    intro: (done: () => void) => (world.done = done),
    skip: () => (world.skipped++, world.done()),
    show: (heroes: { name: string }[], chosen: number, present: boolean) => Object.assign(world, { shown: heroes.map((h) => h.name), chosen, present }),
    onPick: (pick: (i: number) => void) => (world.pick = pick),
    dispose: () => {},
  }),
}));

const keep = (seed: number, name: string, at: number) => {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  Object.assign(model.hero, { name });
  localStorage.setItem(`evenhold.save.${seed}`, JSON.stringify(snapshot(model)));
  localStorage.setItem(`evenhold.played.${seed}`, String(at));
};
const lit = () => document.querySelector('.title-card.chosen b')?.textContent;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="loading"><h1>EvenHold</h1></div>';
  keep(TEST_SEEDS[0], 'Aleyn', 100);
  keep(TEST_SEEDS[1], 'Bertrade', 200);
  keep(TEST_SEEDS[2], 'Cuthbert', 300);
  world.skipped = 0;
});

describe('the main menu, its world', () => {
  it('opens on the flight: no heroes yet, no menu; then they come, the last played lit', () => {
    void showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    expect(world.shown).toEqual(['Cuthbert', 'Bertrade', 'Aleyn']);
    expect(world.present).toBe(false);
    expect(document.querySelector('.title-card')).toBeNull();
    expect(document.querySelector('.title-press')).toBeNull(); // (no Press any key)
    world.done(); // (the flight, over)
    expect(world.present).toBe(true);
    expect(world.chosen).toBe(0);
    expect(lit()).toBe('Cuthbert');
  });

  it('a key or a click skips the flight', () => {
    void showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(world.skipped).toBe(1);
    expect(world.present).toBe(true);
    document.getElementById('loading')!.click(); // (the menu up: a click no longer skips)
    expect(world.skipped).toBe(1);
  });

  it('a hero clicked in the world, chosen', () => {
    void showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    world.done();
    world.pick(2); // (Aleyn, on the right)
    expect(lit()).toBe('Aleyn');
    expect(world.chosen).toBe(2);
    world.pick(1);
    expect(lit()).toBe('Bertrade');
  });

  it('the chosen one clicked again: into their world', async () => {
    const chosen = showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    world.done();
    world.pick(1);
    world.pick(1);
    expect((await chosen).seed).toBe(TEST_SEEDS[1]);
  });
});
