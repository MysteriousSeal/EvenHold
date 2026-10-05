// @vitest-environment happy-dom
// The dev cheat menu (controller/cheats/cheatPanel.ts), in a stand-in page:
// every tab's rows in groups under a header, and the bag's cheats.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { createCheatPanel } from '../src/controller/cheats/cheatPanel';
import { slotsUsed } from '../src/model/hero/bagStacks';
import { bagRoom } from '../src/model/hero/bagSlots';
import { BAG_IDS } from '../src/model/loot/bags';
import { TIRED, tiredPace } from '../src/model/hero/heroStats';
import { landBlow, type Fight } from '../src/model/hero/fighting';
import { makeEnemy } from '../src/model/enemies/enemies';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

describe('the cheat menu', () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  createCheatPanel(model, { scale: 1 });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }));
  const menu = document.querySelector<HTMLElement>(".menu[aria-label='Cheats']")!;
  const tabs = () => Array.from(menu.querySelectorAll<HTMLElement>('.menu-tab'));
  const open = (name: string) => tabs().find((t) => t.textContent?.includes(name))!.click();
  const row = (title: string) => Array.from(menu.querySelectorAll<HTMLElement>('.menu-row')).find((r) => r.querySelector('b')?.textContent === title)!;

  it('a tab for each thing a cheat touches, each one\'s rows starting under a header', () => {
    expect(tabs().map((t) => t.textContent?.trim())).toEqual(['Go to', 'Sights', 'Hero', 'Appearance', 'Items', 'Foes', 'World']);
    for (const tab of ['Go to', 'Sights', 'Hero', 'Appearance', 'Items', 'Foes', 'World']) {
      open(tab);
      const first = menu.querySelector('.menu-list')!.querySelector('.menu-section, .menu-row');
      expect(first?.className, tab).toBe('menu-section');
    }
    open('Go to');
    expect(Array.from(menu.querySelectorAll('.menu-section')).map((h) => h.textContent)).toEqual(['Towns', 'Dungeons', 'Wilds', 'Roads', 'Start']);
    open('Hero');
    expect(Array.from(menu.querySelectorAll('.menu-section')).map((h) => h.textContent)).toEqual(['Powers', 'Health & energy', 'Level & stats']); // (the powers first: the most used)
  });

  it('the bag\'s: every bag in it; junk till it\'s full; emptied', () => {
    open('Items');
    row('Every bag').click();
    for (const id of BAG_IDS) expect(model.hero.bag[id]).toBe(1);
    row('Fill the bag with junk').click();
    expect(slotsUsed(model.hero.bag)).toBeGreaterThanOrEqual(bagRoom(model.hero));
    row('Empty the bag').click();
    expect(model.hero.bag).toEqual({});
  });

  it('make tired: energy one under where the walk slows', () => {
    open('Hero');
    row('Make tired').click();
    expect(model.hero.energy).toBe(TIRED - 1);
    expect(tiredPace(model.hero)).toBeLessThan(1);
  });

  it('one-hit kills: toggled on, a blow fells a foe at full health (a draugr, the toughest); off, it doesn\'t', () => {
    open('Hero');
    const blowOn = () => {
      const draugr = makeEnemy(999, 'draugr', model.hero.x, model.hero.z + 0.5);
      const fight: Fight = { ...model, foes: [draugr], focused: draugr, hero: model.hero, slain: new Set(), quests: model.quests, oneHitKills: model.oneHitKills, godMode: false, random: () => 0.5, report: () => {}, focus: () => {}, dropLoot: () => {}, dropCoins: () => {}, slayGuard: () => {}, fall: () => {}, shove: () => {} };
      landBlow(fight);
      return draugr.state;
    };
    expect(blowOn()).not.toBe('dead');
    row('One-hit kills').click();
    expect(model.oneHitKills).toBe(true);
    expect(blowOn()).toBe('dead');
    row('One-hit kills').click();
    expect(model.oneHitKills).toBe(false);
  });
});
