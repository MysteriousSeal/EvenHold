// @vitest-environment happy-dom
// The main menu with its world (view/title/titleScene.ts, stood in for here:
// no WebGL in tests): who stands in the row, the chosen one lit; a hero
// clicked in the world chosen, on the title too (the click wakes it on them,
// not the last played); the chosen one clicked again, played.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { snapshot } from '../src/model/save';
import { forgetWorld, savedWorlds } from '../src/controller/storage/saveGame';
import { showMainMenu } from '../src/controller/mainMenu';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const world = vi.hoisted(() => ({ shown: [] as string[], chosen: -1, pick: (_: number) => {} }));
vi.mock('../src/view/title/titleScene', () => ({
  TITLE_HEROES: 4,
  createTitleScene: () => ({
    show: (heroes: { name: string }[], chosen: number) => Object.assign(world, { shown: heroes.map((h) => h.name), chosen }),
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
});

describe('the main menu, its world', () => {
  it('stands the heroes in a row, none lit on the title; a hero clicked there wakes it on them', () => {
    void showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    expect(world.shown).toEqual(['Cuthbert', 'Bertrade', 'Aleyn']);
    expect(world.chosen).toBe(-1);
    world.pick(2); // (Aleyn, on the right)
    document.getElementById('loading')!.click(); // (the same click, reaching the page: no second say)
    expect(lit()).toBe('Aleyn');
    expect(world.chosen).toBe(2);
    world.pick(1);
    expect(lit()).toBe('Bertrade');
  });

  it('the chosen one clicked again: into their world', async () => {
    const chosen = showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    world.pick(1);
    world.pick(1);
    expect(await chosen).toBe(TEST_SEEDS[1]);
  });
});
