// @vitest-environment happy-dom
// The first hour's tips (controller/tips/firstTips.ts): none at the start; each once, the moment it first matters
// (hurt, tired, out of breath, a foe closing in, a piece badly worn, knocked down, food in the bag, the bag full, the
// first inn, the first smithy), the most pressing first, a while between one and the next; seen kept in the browser;
// none at all with the pause menu's Tips off; each a line or two, never a wall of words.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { FirstTips, TIPS, reloadTips, setTipsOn, tipsOn } from '../src/controller/tips/firstTips';
import { TIRED } from '../src/model/hero/heroStats';
import { liveOn } from '../src/model/hero/setbacks';
import { maxHpOf } from '../src/model/hero/attributes';
import { createTipCard, keyMark } from '../src/view/hud/tipCard';
import { WORN } from '../src/model/hero/wear';
import { BAG_ROOM } from '../src/model/hero/bagSlots';
import { label } from '../src/controller/keyBindings';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const start = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  model.enemies.length = 0; // (no foe about: only what each test sets)
  return model;
};
const fresh = () => {
  const model = start();
  const { carter } = model.story.people!;
  model.teleport(carter.x - 8, carter.z + 8); // (out of the carter's call: only what each test sets)
  return model;
};
const shown = (tips: FirstTips, seconds = 0) => tips.next(seconds)?.id ?? null;

beforeEach(() => {
  localStorage.clear();
  reloadTips();
});
afterEach(() => localStorage.clear());

describe('the first hour\'s tips', () => {
  it("at the start, only where to go: the carter, his ! over him; not once he's been spoken to", () => {
    const model = start();
    const tips = new FirstTips(model);
    const tip = tips.next(1)!;
    expect(tip.id).toBe('carter');
    expect(tip.text(label, model)).toContain('!');
    expect(tip.text(label, model).length).toBeLessThan(120); // (a line)
    localStorage.clear();
    reloadTips();
    const spoken = start();
    spoken.story.talk(spoken.story.people!.carter)!.answers.find((a) => a.primary)!.pick(); // (his quest taken)
    expect(shown(new FirstTips(spoken), 1)).not.toBe('carter');
  });

  it('none away from the carter; hurt, then (a while after) tired, each once, kept as seen', () => {
    const model = fresh();
    const tips = new FirstTips(model);
    expect(shown(tips, 1)).toBeNull();
    model.hero.hp = maxHpOf(model.hero) * 0.4;
    model.hero.energy = TIRED - 1;
    expect(shown(tips)).toBe('hurt'); // (the most pressing first)
    expect(shown(tips, 5)).toBeNull(); // (not straight after another)
    expect(shown(tips, 20)).toBe('tired');
    expect(shown(tips, 30)).toBeNull(); // (each once)
    reloadTips();
    expect(shown(new FirstTips(model), 30)).toBeNull(); // (seen, in the browser)
    expect(JSON.parse(localStorage.getItem('evenhold.tips')!)).toEqual({ off: false, seen: ['hurt', 'tired'] });
  });

  it('knocked down: only for a fall that dropped a purse, shown at once though another was just shown', () => {
    const model = fresh();
    const tips = new FirstTips(model);
    model.hero.hp = maxHpOf(model.hero) * 0.4;
    expect(shown(tips)).toBe('hurt');
    model.hero.money = 100;
    model.fall();
    expect(shown(tips, 2)).toBe('fallen'); // (not lost in the wait after the last)
    const spent = fresh();
    [spent.hero.money, spent.hero.energy] = [100, 0];
    expect(liveOn(spent, 0.1)).toBe(true); // (passed out: Weary, no purse dropped)
    expect(shown(new FirstTips(spent), 30)).not.toBe('fallen');
  });

  it('each the moment it first matters', () => {
    const cases: Array<[string, (m: GameModel) => void]> = [
      ['fallen', (m) => ((m.hero.money = 100), m.fall())],
      ['breath', (m) => (m.moves.breath = 5)],
      ['worn', (m) => ((m.hero.equipment.mainHand = 'hatchet' as never), (m.hero.wear = { hatchet: WORN }))],
      ['food', (m) => (m.hero.bag.bread = 2)],
      ['bagFull', (m) => Object.assign(m.hero.bag, Object.fromEntries(Array.from({ length: BAG_ROOM }, (_, i) => [`ghost${i}`, 1])))],
      ['inn', (m) => enterNearest(m, 'inn', new Set())],
      ['trades', (m) => enterNearest(m, 'smithy', new Set())],
      ['guard', (m) => {
        const wolf = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE).enemies.find((e) => e.kind === 'wolf')!;
        m.enemies.push({ ...wolf, x: m.hero.x + 3, z: m.hero.z, state: 'chase' });
      }],
    ];
    for (const [id, set] of cases) {
      localStorage.clear();
      reloadTips();
      const model = fresh();
      const tips = new FirstTips(model);
      expect(shown(tips), `${id}: before`).toBeNull();
      set(model);
      expect(shown(tips), id).toBe(id);
    }
  });

  it('none with Tips off (the pause menu), and back with them on', () => {
    const model = fresh();
    setTipsOn(false);
    reloadTips();
    expect(tipsOn()).toBe(false);
    model.hero.hp = 1;
    expect(shown(new FirstTips(model), 60)).toBeNull();
    setTipsOn(true);
    expect(shown(new FirstTips(model))).toBe('hurt');
  });

  it('nonsense in the browser\'s storage: as if new', () => {
    localStorage.setItem('evenhold.tips', '{"off":"yes","seen":"hurt"}');
    reloadTips();
    const model = fresh();
    model.hero.hp = 1;
    expect([tipsOn(), shown(new FirstTips(model))]).toEqual([true, 'hurt']);
    localStorage.setItem('evenhold.tips', 'not json');
    expect(() => reloadTips()).not.toThrow();
  });

  it('a line or two each, never a wall of words', () => {
    const model = fresh();
    for (const tip of TIPS) {
      const text = tip.text(label, model);
      expect(text.length, tip.id).toBeLessThanOrEqual(160);
      expect(text).not.toContain('undefined');
    }
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
  });
});

describe('tip card key caps', () => {
  it('shows each key a tip names as a key cap, the words around it plain', () => {
    const card = createTipCard();
    const foe = TIPS.find((t) => t.id === 'guard')!;
    card.show({ title: foe.title, text: foe.text((a) => keyMark(a === 'guard' ? 'Q' : 'Shift'), null as unknown as GameModel) }); // (this tip reads no model)
    const caps = Array.from(document.querySelectorAll('.tip-text kbd.tip-key'), (k) => k.textContent);
    expect(caps).toEqual(['Q', 'Shift']);
    expect(document.querySelector('.tip-text')!.textContent).toMatch(/^Hold Q to raise your guard/);
  });
});
