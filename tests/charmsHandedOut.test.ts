// The ten new charms as a player comes by them and keeps them: each a row of the cheat menu's Charms tab
// (controller/cheats/charmCheats.ts), under those that turn someone, with its own icon and name; picked, on the
// action bar and cast from it by its slot's key, as the game casts; a bar already full said so, and the charm on it
// once a slot's cleared; known and on the bar still after a save. And saves from before them: a save with none of
// what they added (no coat, no one a ghost's of, no wall, no floor, no dungeon floors, charms this game has never
// heard of) read without a fault, and played on.
import { describe, expect, it } from 'vitest';
import { NEW_CHARMS, pickOut, reloaded } from './support/charmStage';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { charmActions, grantCharm } from '../src/controller/cheats/charmCheats';
import { GameModel } from '../src/model/GameModel';
import { ACTION_SLOTS, clearAction } from '../src/model/hero/actionBar';
import { parseSave, restore, snapshot } from '../src/model/save';
import { SPELLS, knows, spellKey } from '../src/model/spells/spells';
import { mayTurn } from '../src/model/spells/turned';
import { SPELL_ICONS } from '../src/view/ui/spellIcons';

const game = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

describe('the ten new charms, handed out', () => {
  it('each has its row under "Turn someone", its own icon and name; picked, it is on the bar and cast from it', () => {
    const rows = charmActions(game());
    const turning = rows.slice(0, rows.findIndex((row) => row.section === 'Others'));
    expect(new Set(NEW_CHARMS.map((id) => SPELL_ICONS[id])).size).toBe(NEW_CHARMS.length); // (no two the same icon)
    for (const charm of NEW_CHARMS) {
      const row = turning.filter((r) => r.title === SPELLS[charm].name);
      expect(row, charm).toHaveLength(1);
      expect(row[0].icon, charm).toBe(SPELL_ICONS[charm]);
      expect(row[0].detail, charm).toContain(`into a ${charm}`);
      // Picked in a new game: on the first slot, and cast with it at a wolf (a painting: refused out of doors, as meant).
      const model = game();
      const mine = charmActions(model).find((r) => r.title === SPELLS[charm].name)!;
      expect(mine.run!(), charm).toMatch(/key 1/);
      expect([knows(model.hero, charm), model.hero.actionBar[0]], charm).toEqual([true, spellKey(charm)]);
      const wolf = model.enemies.find((e) => e.kind === 'wolf' && mayTurn(e))!;
      model.teleport(Math.round(wolf.x), Math.round(wolf.z));
      pickOut(model, wolf);
      expect(model.useAction(0), charm).toBe(charm !== 'painting');
      expect(model.enemies.includes(wolf), charm).toBe(charm === 'painting');
    }
  });

  it('a full bar is said to be full, the charm known all the same; on it once a slot is cleared; kept through a save', () => {
    const model = game();
    const { hero } = model;
    const said = NEW_CHARMS.map((charm) => grantCharm(model, charm));
    expect(said.slice(0, ACTION_SLOTS).every((s, i) => s.includes(`key ${i + 1}`))).toBe(true);
    expect(said.slice(ACTION_SLOTS).every((s) => /bar is full/.test(s))).toBe(true);
    expect(NEW_CHARMS.every((charm) => knows(hero, charm))).toBe(true);
    expect(hero.actionBar).toEqual(NEW_CHARMS.slice(0, ACTION_SLOTS).map(spellKey));
    clearAction(hero, 2);
    expect(grantCharm(model, 'doll')).toMatch(/key 3/);
    expect(hero.actionBar[2]).toBe(spellKey('doll'));
    const again = reloaded(model);
    expect(again.hero.actionBar).toEqual(hero.actionBar);
    expect(NEW_CHARMS.every((charm) => knows(again.hero, charm))).toBe(true);
  });
});

describe('a save from before the ten', () => {
  it('is read without a fault: its hens as they were, charms it never had not known, nothing of the new asked of it', () => {
    const model = game();
    grantCharm(model, 'chicken');
    const wolf = model.enemies.find((e) => e.kind === 'wolf' && mayTurn(e))!;
    expect(model.chickens.turn(wolf, 'chicken')).toBe(true);
    const saved = JSON.parse(JSON.stringify(snapshot(model)));
    // As it was written then: a hen five numbers and no more; no dungeon floors; a charm since taken out of the game.
    saved.chickens = { hens: saved.chickens.hens.map((row: unknown[]) => row.slice(0, 5)), lost: [] };
    delete saved.floors;
    saved.hero.spells = ['chicken', 'newt'];
    saved.hero.actionBar[1] = 'spell:newt';
    const again = game();
    restore(again, parseSave(JSON.stringify(saved), again.seed)!);
    expect(again.chickens.hens.map((h) => [h.kind, h.coat, h.stone, h.hung, h.up, h.hop])).toEqual([['chicken', undefined, undefined, undefined, undefined, undefined]]);
    expect([again.hero.spells, again.hero.actionBar[0], again.hero.actionBar[1]]).toEqual([['chicken'], spellKey('chicken'), null]);
    expect(again.enemies.some((e) => e.id === wolf.id)).toBe(false);
    for (let t = 0; t < 5; t += 0.1) again.update(0, 0, 0.1);
    // And one with rows of the new kinds gone wrong: each read as far as it's sound, none a fault.
    again.chickens.load({ hens: [[1, 1, null, 1, 1, 'pig', 99], [1, 1, null, 1, 1, 'cat', -1], [1, 1, null, 1, 1, 'toad', 'green'], [1, 1, null, 1, 1, 'doll'], [1, 1, null, 1, 1, 'tree'], [1, 1, 7, 1, 1, 'rat', 1, null, null, 'yes']], lost: ['x', 2.5] });
    expect(again.chickens.hens.map((h) => [h.kind, h.coat, h.at, h.up])).toEqual([['pig', 0, null, undefined], ['cat', 0, null, undefined], ['toad', 0, null, undefined], ['chicken', undefined, null, undefined], ['chicken', undefined, null, undefined], ['rat', 1, null, undefined]]);
    for (let t = 0; t < 5; t += 0.1) again.update(0, 0, 0.1);
  });
});
