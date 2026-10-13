// @vitest-environment happy-dom
// Spells on the screen: the action bar's tile for one (view/hud/actionBar.ts: its icon, its wait counting down,
// greyed meanwhile), a click casting it; the charms handed out from the cheat menu (controller/cheats/charmCheats.ts),
// each onto the first free slot; both kept through a save.
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { charmActions, grantCharm } from '../src/controller/cheats/charmCheats';
import { makeEnemy } from '../src/model/enemies/enemies';
import { setAction } from '../src/model/hero/actionBar';
import { parseSave, restore, snapshot } from '../src/model/save';
import { SPELLS, SPELL_IDS, knows, learn, spellKey } from '../src/model/spells/spells';
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

  it('is handed out from the cheat menu: known, and onto the first free slot of the bar, not twice; a row for each', () => {
    const model = fresh();
    const { hero } = model;
    setAction(hero, 0, 'bread');
    expect(grantCharm(model, 'tree')).toMatch(/key 2/);
    expect(knows(hero, 'tree')).toBe(true);
    expect(hero.actionBar[1]).toBe(spellKey('tree'));
    expect(grantCharm(model, 'tree')).toMatch(/already/);
    expect(hero.actionBar.filter((a) => a === spellKey('tree')).length).toBe(1);
    const rows = charmActions(model);
    expect(rows.filter((row) => SPELL_IDS.some((id) => SPELLS[id].name === row.title)).length).toBe(SPELL_IDS.length);
    expect(rows[0].section).toBe('Turn someone');
    // Every one of them: all known; the bar full, the rest known all the same.
    expect(rows[rows.length - 1].run!()).toBe('Every charm known.');
    expect(SPELL_IDS.every((id) => knows(hero, id))).toBe(true);
    expect(hero.actionBar.every((slot) => slot !== null)).toBe(true);
    expect(grantCharm(model, 'swap')).toMatch(/already|full/);
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
