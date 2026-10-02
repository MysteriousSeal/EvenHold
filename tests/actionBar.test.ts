// @vitest-environment happy-dom
// The action bar (model/hero/actionBar.ts, view/hud/actionBar.ts): shortcuts
// to food and drink in the bag, set (one slot each), swapped, cleared, used
// from the bag; kept in the save; its keys 1 to 8; its tiles showing what
// each points at and how many are carried, a click using it.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ACTION_SLOTS, clearAction, readActionBar, setAction, swapActions, useAction } from '../src/model/hero/actionBar';
import { parseSave, restore, snapshot } from '../src/model/save';
import { KeyboardInput } from '../src/controller/KeyboardInput';
import { createActionBar } from '../src/view/hud/actionBar';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

describe('the action bar', () => {
  it('eight slots, empty at first; food and drink only, one slot each; swapped, cleared', () => {
    const { hero } = fresh();
    expect(hero.actionBar).toEqual(Array(ACTION_SLOTS).fill(null));
    expect(setAction(hero, 0, 'bread')).toBe(true);
    expect(setAction(hero, 1, 'wolfFang')).toBe(false); // (not food or drink)
    expect(setAction(hero, 8, 'ale')).toBe(false); // (no such slot)
    setAction(hero, 2, 'ale');
    setAction(hero, 2, 'bread'); // (moved: the ale to where the bread was)
    expect(hero.actionBar.slice(0, 3)).toEqual(['ale', null, 'bread']);
    swapActions(hero, 0, 2);
    expect(hero.actionBar.slice(0, 3)).toEqual(['bread', null, 'ale']);
    clearAction(hero, 0);
    expect(hero.actionBar[0]).toBeNull();
  });

  it('used: one of it from the bag, eaten; none carried, nothing; the slot stays', () => {
    const { hero } = fresh();
    hero.bag = { bread: 2 };
    setAction(hero, 0, 'bread');
    expect(useAction(hero, 0)).toBe(true);
    expect(hero.bag.bread).toBe(1);
    expect(hero.eating?.item).toBe('bread');
    hero.eating = null;
    useAction(hero, 0);
    hero.eating = null;
    expect(useAction(hero, 0)).toBe(false); // (none left)
    expect(hero.actionBar[0]).toBe('bread');
    expect(useAction(hero, 5)).toBe(false); // (an empty slot)
  });

  it('kept in the save; an older save\'s, or a stranger\'s, read as empty', () => {
    const model = fresh();
    setAction(model.hero, 3, 'mead');
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.actionBar[3]).toBe('mead');
    expect(readActionBar(undefined)).toEqual(Array(ACTION_SLOTS).fill(null));
    expect(readActionBar(['bread', 'shortSword', 7])).toEqual(['bread', ...Array(ACTION_SLOTS - 1).fill(null)]);
  });

  it('its keys, 1 to 8', () => {
    const input = new KeyboardInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
    expect(input.consumeAction()).toBe(2);
    expect(input.consumeAction()).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit9' }));
    expect(input.consumeAction()).toBeNull();
  });

  it('its tiles: what each points at, how many carried, greyed with none; a click uses it', () => {
    const { hero } = fresh();
    hero.bag = { ale: 3 };
    setAction(hero, 0, 'ale');
    setAction(hero, 1, 'bread');
    const used: number[] = [];
    const update = createActionBar(hero, { use: (i) => used.push(i), swap: () => {}, clear: () => {} });
    update();
    const tiles = Array.from(document.querySelectorAll<HTMLElement>('.action-slot')).slice(-ACTION_SLOTS);
    expect(tiles).toHaveLength(ACTION_SLOTS);
    expect(tiles[0].querySelector('.menu-slot-count')?.textContent).toBe('3');
    expect(tiles[1].classList.contains('spent')).toBe(true); // (no bread carried)
    expect(tiles[2].classList.contains('empty')).toBe(true);
    expect(tiles[0].querySelector('.action-key')?.textContent).toBe('1');
    tiles[0].dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 11, clientY: 10 }));
    expect(used).toEqual([0]);
  });
});
