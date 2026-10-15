// The hedge-witch (model/witch/): in about one village in three, at home in the house at its edge (hers alone: no
// villager lives there), a woman, at work by day and abed 23:00 to 06:00; her cottage inside, its pieces each where
// she works them; and what she teaches across her counter (witchTeaching.ts): the hex and the mending charm, gated by
// level, for coin (and a bat's wing), on the hero's bar once learned; never a turning, nor the Moon-turn.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { layoutOf } from '../src/model/interiors/indoors';
import { hasWitch, isWitchHome, witchHomeIn } from '../src/model/witch/witchHomes';
import { witchAbed } from '../src/model/witch/witchWork';
import { LESSONS, TAUGHT, witchTalk } from '../src/model/witch/witchTeaching';
import { SPELLS, SPELL_IDS, knows, spellKey } from '../src/model/spells/spells';
import { titleOf, type Npc } from '../src/model/npcs/npcs';
import type { Talk } from '../src/model/story/story';
import type { Entrance } from '../src/model/interiors/interiors';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const worlds = TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE));
const witches = worlds.flatMap((m) => m.npcs.filter((n) => n.role === 'witch').map((w) => ({ m, w })));
const at = (hour: number) => hour * 60;

describe('which villages have a hedge-witch', () => {
  it('about one in three, by where each stands', () => {
    const villages = Array.from({ length: 900 }, (_, i) => ({ x: (i % 30) * 37 + 5, z: Math.floor(i / 30) * 41 + 9, groundTier: 0 }));
    const share = villages.filter((v) => hasWitch(1234, v)).length / villages.length;
    expect(share).toBeGreaterThan(0.28);
    expect(share).toBeLessThan(0.39);
  });

  it('her house the farthest from its middle, and none in a village too small to spare one', () => {
    const village = villages(1234)[0];
    const house = (x: number, z: number): Entrance => ({ type: 'house', x, z, outX: 0, outZ: 1 });
    const houses = [house(village.x + 1, village.z), house(village.x - 6, village.z + 2), house(village.x, village.z - 3), house(village.x + 2, village.z + 2)];
    expect(witchHomeIn(1234, village, houses)).toBe(houses[1]);
    expect(witchHomeIn(1234, village, houses.slice(0, 3))).toBeNull();
  });

  it('in the worlds: a woman, a hedge-witch, at home in a house of her village, no villager living there', () => {
    expect(witches.length).toBeGreaterThan(0);
    for (const { m, w } of witches) {
      expect(w.home.type).toBe('house');
      expect(isWitchHome(w.home)).toBe(true);
      expect(hasWitch(m.seed, w.village)).toBe(true);
      expect(w.look.build).toBe('female');
      expect(titleOf(w)).toMatch(/\(Hedge-witch\)$/);
      expect(m.npcs.filter((n) => n.home === w.home)).toEqual([w]);
      expect(m.npcs.filter((n) => n.role === 'witch' && n.village === w.village)).toHaveLength(1);
    }
    for (const m of worlds) for (const v of m.villages.filter((v) => !hasWitch(m.seed, v))) expect(m.npcs.some((n) => n.role === 'witch' && n.village === v)).toBe(false);
  });
});

// Villages to try her rules on, of `seed`, that have her.
function villages(seed: number) {
  return Array.from({ length: 200 }, (_, i) => ({ x: i * 13 + 3, z: i * 7 + 1, groundTier: 0 })).filter((v) => hasWitch(seed, v));
}

describe("her cottage inside, her day", () => {
  it('her counter, the hearth and its cauldron, her table, the drying rack and her bed; earth and daub', () => {
    for (const { m, w } of witches) {
      const { room, furniture } = layoutOf(m.seed, w.home);
      expect([room.floor, room.wall]).toEqual(['earth', 'daub']);
      for (const kind of ['herbCounter', 'hearth', 'cauldron', 'herbTable', 'dryingRack', 'bed']) expect(furniture.some((f) => f.kind === kind), kind).toBe(true);
      expect(furniture.some((f) => f.kind === 'potionShelf')).toBe(false); // (no potions: the herbalist's trade)
    }
  });

  it('abed from 23:00 to 06:00, as the herbalists and the smiths are', () => {
    expect([22, 23.5, 3, 5.9, 6.1, 12].map((h) => witchAbed(at(h)))).toEqual([false, true, true, true, false, false]);
  });

  it('at work by day, round her pieces; at her counter when the hero comes to it', () => {
    const { m, w } = witches[0];
    m.minutes = at(10);
    m.teleport(w.home.x, w.home.z);
    m.useDoor();
    for (let i = 0; i < 60 * 30; i++) m.update(0, 0, 1 / 60);
    expect(w.where).toBe(w.home);
    const counter = layoutOf(m.seed, w.home).furniture.find((f) => f.kind === 'herbCounter')!;
    m.hero.x = counter.x + 0.5;
    m.hero.z = counter.z + 1.2;
    for (let i = 0; i < 60 * 20; i++) m.update(0, 0, 1 / 60);
    expect(Math.hypot(w.x - (counter.x + 0.5), w.z - (counter.z - 0.6))).toBeLessThan(0.3);
  });
});

// The hero, a witch and her talk, with what's picked of it.
const ask = (talk: Talk, label: RegExp): Talk => {
  const answer = talk.answers.find((a) => label.test(a.label));
  expect(answer, `${label}`).toBeDefined();
  return answer!.pick() as Talk;
};
const fresh = () => {
  const m = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  m.hero.spells = [];
  m.hero.actionBar = m.hero.actionBar.map(() => null);
  m.minutes = at(12);
  return m;
};
const WITCH = { name: 'Old Mother Gammer' } as Npc;

describe('what she teaches', () => {
  it('the hex and the mending charm, and nothing that turns anyone, nor the Moon-turn', () => {
    expect(TAUGHT.sort()).toEqual(['hex', 'mend']);
    for (const id of TAUGHT) expect(SPELLS[id].turns).toBeUndefined();
    const talk = witchTalk(fresh(), WITCH, 0);
    const turnings = SPELL_IDS.filter((id) => SPELLS[id].turns || SPELLS[id].swaps);
    for (const answer of talk.answers) for (const id of turnings) expect(answer.label).not.toContain(SPELLS[id].name);
  });

  it('asked for a turning, she won\'t, and says what it costs a village; nothing learned', () => {
    const m = fresh();
    const said = ask(witchTalk(m, WITCH, 0), /turn someone/);
    expect(said.lines.join(' ')).toMatch(/burn/);
    expect(m.hero.spells).toEqual([]);
  });

  it('the hex: not before level 3, not without 150 copper; then learned, paid, on the bar', () => {
    const m = fresh();
    m.hero.money = 1000;
    m.hero.level = 2;
    expect(ask(witchTalk(m, WITCH, 0), /hex/).lines[0]).toMatch(/level 3/);
    expect(knows(m.hero, 'hex')).toBe(false);
    m.hero.level = 3;
    m.hero.money = 149;
    expect(ask(witchTalk(m, WITCH, 0), /hex/).lines[0]).toMatch(/short/);
    expect([knows(m.hero, 'hex'), m.hero.money]).toEqual([false, 149]);
    m.hero.money = 200;
    const taught = ask(witchTalk(m, WITCH, 0), /hex/);
    expect([knows(m.hero, 'hex'), m.hero.money]).toEqual([true, 200 - LESSONS.hex!.copper]);
    expect(m.hero.actionBar).toContain(spellKey('hex'));
    expect(taught.lines[0]).toMatch(/on your bar/);
    expect(witchTalk(m, WITCH, 0).answers.some((a) => /hex/.test(a.label))).toBe(false); // (had: not offered again)
  });

  it('the mending charm: a bat\'s wing besides the coin, taken', () => {
    const m = fresh();
    m.hero.level = 5;
    m.hero.money = 500;
    expect(ask(witchTalk(m, WITCH, 0), /Mending/).lines[0]).toMatch(/bat wing/);
    expect([knows(m.hero, 'mend'), m.hero.money]).toEqual([false, 500]);
    m.hero.bag.batWing = 2;
    ask(witchTalk(m, WITCH, 0), /Mending/);
    expect([knows(m.hero, 'mend'), m.hero.money, m.hero.bag.batWing]).toEqual([true, 100, 1]);
  });

  it('all she has taught: she says the rest is in the dark', () => {
    const m = fresh();
    m.hero.spells = ['hex', 'mend'];
    expect(witchTalk(m, WITCH, 0).lines.join(' ')).toMatch(/dark/);
  });

  it('abed: no lessons', () => {
    const m = fresh();
    m.minutes = at(2);
    expect(witchTalk(m, WITCH, 0).answers).toEqual([]);
  });
});
