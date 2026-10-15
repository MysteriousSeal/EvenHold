// Charms found in the dark (model/loot/scrolls.ts): now and then a scroll or a grimoire in the hoard of a crypt's lord,
// a brood mother or a stronghold's king (never a camp's), read from the bag to learn its charm (spells/charmLore.ts);
// never a turning; the Moon-turn the rarest, and found only there. And the charms the hero knows, and the scrolls
// they carry, kept in a save (an older one's: none known).
import { describe, expect, it } from 'vitest';
import { rollHoard } from '../src/model/loot/hoard';
import { SCROLL_IDS, SCROLL_SPELL, isScroll, type ScrollId } from '../src/model/loot/scrolls';
import { LEARNABLE, readScroll } from '../src/model/spells/charmLore';
import { SPELLS, SPELL_IDS, knows, spellKey } from '../src/model/spells/spells';
import { TAUGHT } from '../src/model/witch/witchTeaching';
import { groupOf, kindOf } from '../src/model/hero/bag';
import { saleOf } from '../src/model/shops/sellValue';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const HOARD = { worth: 100, base: 60, spread: 40 };
const spots = Array.from({ length: 3000 }, (_, i) => [(i * 37) % 997, (i * 53) % 991] as const);

describe('what the dark holds', () => {
  const found = spots.map(([x, z]) => rollHoard(x, z, 9091, 5, { ...HOARD, dark: true }).charm);

  it('a charm in about one hoard in four; the Moon-turn the rarest of them', () => {
    const share = found.filter(Boolean).length / found.length;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
    const of = (id: ScrollId) => found.filter((c) => c === id).length;
    expect(of('moonGrimoire')).toBeGreaterThan(0);
    expect(of('moonGrimoire')).toBeLessThan(Math.min(of('hexScroll'), of('mendScroll')));
  });

  it('never a turning: every charm written down is one to be learned, and the turnings none of them', () => {
    for (const charm of found) if (charm) expect(isScroll(charm)).toBe(true);
    for (const id of SCROLL_IDS) expect(SPELLS[SCROLL_SPELL[id]].turns).toBeUndefined();
    expect([...LEARNABLE].sort()).toEqual(['hex', 'mend', 'swap']);
    for (const id of SPELL_IDS.filter((id) => SPELLS[id].turns)) expect(LEARNABLE).not.toContain(id);
  });

  it("the Moon-turn found only in the dark: the hedge-witch doesn't teach it", () => {
    expect(Object.values(SCROLL_SPELL)).toContain('swap');
    expect(TAUGHT).not.toContain('swap');
  });

  it("a camp's chest never holds one, and every hoard's gear and coins are as they were", () => {
    for (const [x, z] of spots.slice(0, 300)) {
      const [lit, dark] = [rollHoard(x, z, 7717, 4, HOARD), rollHoard(x, z, 7717, 4, { ...HOARD, dark: true })];
      expect(lit.charm).toBeUndefined();
      expect([dark.item, dark.coins]).toEqual([lit.item, lit.coins]);
    }
  });
});

describe('a scroll read', () => {
  const hero = () => {
    const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    m.hero.spells = [];
    m.hero.actionBar = m.hero.actionBar.map(() => null);
    return m;
  };

  it('in the bag a charm, worth nothing to the shops', () => {
    expect(kindOf('moonGrimoire')).toBe('Charm, written down');
    expect(groupOf('hexScroll')).toBe('charm');
    for (const id of SCROLL_IDS) expect(saleOf(id)).toBeNull();
  });

  it('learns its charm, puts it on the bar, and is gone', () => {
    const { hero: h } = hero();
    h.bag.moonGrimoire = 1;
    expect(readScroll(h, 'moonGrimoire')).toMatch(/crumbles.*on your bar, key 1/);
    expect(knows(h, 'swap')).toBe(true);
    expect(h.actionBar[0]).toBe(spellKey('swap'));
    expect(h.bag.moonGrimoire).toBeUndefined();
  });

  it('a charm known already: kept, and said so; none carried: nothing', () => {
    const { hero: h } = hero();
    h.spells = ['hex'];
    h.bag.hexScroll = 1;
    expect(readScroll(h, 'hexScroll')).toMatch(/already/);
    expect(h.bag.hexScroll).toBe(1);
    expect(readScroll(h, 'mendScroll')).toBeNull();
  });
});

describe('in a save', () => {
  it('the charms known and the scrolls carried, kept', () => {
    const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    m.hero.spells = ['hex', 'swap'];
    m.hero.bag.mendScroll = 2;
    const loaded = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    restore(loaded, parseSave(JSON.stringify(snapshot(m)), m.seed)!);
    expect(loaded.hero.spells).toEqual(['hex', 'swap']);
    expect(loaded.hero.bag.mendScroll).toBe(2);
  });

  it("an older save, without the charms: none known, and nothing else of it lost", () => {
    const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    m.hero.money = 321;
    const data = snapshot(m);
    delete (data.hero as { spells?: unknown }).spells;
    const loaded = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    restore(loaded, parseSave(JSON.stringify(data), m.seed)!);
    expect([loaded.hero.spells ?? [], loaded.hero.money]).toEqual([[], 321]);
  });
});
