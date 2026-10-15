// The skills window's Charms tab (controller/skills/charmTab.ts): every charm the hero knows, a row each, saying
// whether it's on the action bar; one cleared off the bar clicked back onto a free slot (never lost).
import { describe, expect, it } from 'vitest';
import { charmsTab } from '../src/controller/skills/charmTab';
import { clearAction } from '../src/model/hero/actionBar';
import { spellKey } from '../src/model/spells/spells';
import type { Hero } from '../src/model/types';

const heroOf = (spells: Hero['spells'], bar: Hero['actionBar']) => ({ hero: { spells, actionBar: bar } as Hero });

describe('the Charms tab', () => {
  it('lists only the charms known, each saying where it is on the bar', () => {
    const model = heroOf(['mend', 'hex'], [spellKey('hex'), null, null, null, null, null, null, null]);
    const { cells } = charmsTab(model).slots!();
    expect(cells.map((c) => c!.title)).toEqual(["Hedge-witch's hex", 'Mending charm']);
    expect(cells.map((c) => c!.note)).toEqual(['On your bar, key 1', 'Not on your bar: click to put it there']);
    expect(charmsTab(heroOf([], Array(8).fill(null))).slots!().cells).toEqual([]);
  });

  it('a charm cleared off the bar, clicked: back on the first free slot', () => {
    const model = heroOf(['hex'], [spellKey('hex'), 'ale', null, null, null, null, null, null]);
    clearAction(model.hero, 0);
    expect(model.hero.actionBar[0]).toBeNull();
    expect(charmsTab(model).slots!().cells[0]!.use!()).toMatch(/key 1/);
    expect(model.hero.actionBar[0]).toBe(spellKey('hex'));
    expect(charmsTab(model).slots!().cells[0]!.use!()).toMatch(/already/);
  });

  it('a full bar: said so, nothing pushed off', () => {
    const bar = Array(8).fill('ale');
    const model = heroOf(['mend'], bar);
    expect(charmsTab(model).slots!().cells[0]!.use!()).toMatch(/full/);
    expect(model.hero.actionBar).toEqual(Array(8).fill('ale'));
  });
});
