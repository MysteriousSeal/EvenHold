// @vitest-environment happy-dom
// Spells on the screen: the action bar's tile for one (view/hud/actionBar.ts: its icon, its wait counting down,
// greyed meanwhile), a click casting it; the spellbook (controller/spells/spellbook.ts) listing what's known, a click
// putting one on the first free slot; both kept through a save.
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { createSpellbook } from '../src/controller/spells/spellbook';
import { makeEnemy } from '../src/model/enemies/enemies';
import { setAction } from '../src/model/hero/actionBar';
import { parseSave, restore, snapshot } from '../src/model/save';
import { SPELLS, learn, spellKey } from '../src/model/spells/spells';
import { createActionBar } from '../src/view/hud/actionBar';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

describe('a spell on the screen', () => {
  it('shows on its tile of the bar, its wait counting down on it once cast', () => {
    document.body.replaceChildren();
    const model = fresh();
    const { hero } = model;
    learn(hero, 'hex');
    setAction(hero, 0, spellKey('hex'));
    const update = createActionBar(hero, { use: (i) => model.useAction(i), swap: () => {}, clear: () => {} });
    update();
    const tile = document.querySelector<HTMLElement>('.action-slot[data-slot="0"]')!;
    expect(tile.querySelector('canvas')).not.toBeNull();
    expect(tile.classList.contains('empty')).toBe(false);
    expect(tile.classList.contains('spent')).toBe(false); // (nothing carried to run out of)
    expect(tile.querySelector('.toolbar-tip')!.textContent).toContain(SPELLS.hex.name);
    hero.facing = 0;
    model.enemies.length = 0;
    model.enemies.push({ ...makeEnemy(900_001, 'wolf', hero.x, hero.z + 2), hp: 500, maxHp: 500 });
    expect(model.useAction(0)).toBe(true);
    update();
    expect(tile.classList.contains('busy')).toBe(true);
    expect(tile.querySelector('.action-cool')!.textContent).toBe(String(SPELLS.hex.cooldown));
    hero.spellWait = {};
    update();
    expect(tile.classList.contains('busy')).toBe(false);
    expect(tile.querySelectorAll('canvas').length).toBe(1); // (its icon: drawn once)
  });

  it('is listed in the spellbook once known, and goes from it onto the first free slot', () => {
    document.body.replaceChildren();
    const model = fresh();
    const { hero } = model;
    const book = createSpellbook(model);
    book.menu.open();
    expect(document.body.textContent).toContain("hedge-witch teaches them"); // (none known: where to learn)
    expect(document.querySelectorAll('.menu-slot').length).toBe(0);
    learn(hero, 'hex');
    book.update();
    const slot = document.querySelector<HTMLElement>('.menu-slot')!;
    expect(slot).not.toBeNull();
    setAction(hero, 0, 'bread');
    slot.click();
    expect(hero.actionBar[1]).toBe(spellKey('hex'));
    slot.click();
    expect(hero.actionBar.filter((a) => a === spellKey('hex')).length).toBe(1); // (not twice)
  });

  it('is kept through a save: what is known, and where it sits on the bar', () => {
    const model = fresh();
    learn(model.hero, 'hex');
    setAction(model.hero, 3, spellKey('hex'));
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.spells).toEqual(['hex']);
    expect(again.hero.actionBar[3]).toBe(spellKey('hex'));
  });
});
