// @vitest-environment happy-dom
// The main menu (controller/title/mainMenu.ts), edge by edge (no WebGL here: the
// flat stage, mainMenuWorld.test.ts has the world's): the keys (wrapping,
// none while typing, none once gone), the roster (its order, its slots, what
// each card tells), letting heroes go (the last one, the chosen one, asking
// again after choosing another), the menu gone once a world's chosen
// (resolved once, its listeners off, the page as it was), the sayings, and
// what's saved here (broken saves left out, storage gone).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { snapshot } from '../src/model/save';
import { MAX_WORLDS, forgetWorld, savedWorlds } from '../src/controller/storage/saveGame';
import { SAYINGS, showMainMenu, type MenuChoice } from '../src/controller/title/mainMenu';
import { seedFrom } from '../src/util/seed';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const hooks = { worlds: savedWorlds, forget: forgetWorld };
// A world saved here: its hero named, levelled, played at `at` (the save copied: no world built per seed).
const base = snapshot(new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE));
const keep = (seed: number, name: string, at: number | null, level = 1) => {
  localStorage.setItem(`evenhold.save.${seed}`, JSON.stringify({ ...base, seed, hero: { ...base.hero, name, level } }));
  if (at !== null) localStorage.setItem(`evenhold.played.${seed}`, String(at));
};
const press = (code: string, target: EventTarget = window) => target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
const cards = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.title-card'));
const names = () => cards().map((c) => c.querySelector('b')?.textContent);
const chosen = () => document.querySelector('.title-card.chosen b')?.textContent;
const button = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.startsWith(text));
// Whether a promise has settled yet (after what's queued has run).
const settled = async (p: Promise<unknown>) => {
  let done = false;
  void p.then(() => (done = true));
  await new Promise((r) => setTimeout(r, 0));
  return done;
};

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="loading" class="title"><h1>EvenHold</h1></div>';
});
afterEach(() => vi.restoreAllMocks());

describe('the main menu: keys', () => {
  it('up and down wrap round the roster, both ways', () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    keep(3, 'Cuth', 100);
    void showMainMenu(hooks);
    expect(chosen()).toBe('Ann');
    press('ArrowUp');
    expect(chosen()).toBe('Cuth'); // (from the first, up: the last)
    press('ArrowDown');
    expect(chosen()).toBe('Ann'); // (from the last, down: the first)
    press('ArrowDown');
    press('ArrowDown');
    expect(chosen()).toBe('Cuth');
  });

  it('with no hero: the arrows and Enter do nothing (nothing to enter)', async () => {
    const menu = showMainMenu(hooks);
    press('ArrowDown');
    press('Enter');
    expect(await settled(menu)).toBe(false);
    expect(cards()).toHaveLength(0);
  });

  it("none heard while typing in a field (the arrows move the caret, Enter's the field's)", async () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    const menu = showMainMenu(hooks);
    const field = document.createElement('input');
    document.body.append(field);
    press('ArrowDown', field);
    expect(chosen()).toBe('Ann');
    press('Enter', field);
    expect(await settled(menu)).toBe(false);
  });

  it('Escape: from the controls back to the heroes; on the heroes, nowhere further', () => {
    keep(1, 'Ann', 300);
    void showMainMenu(hooks);
    button('Controls')!.click();
    expect(document.querySelector('.title-codex')).not.toBeNull();
    press('Escape');
    expect(document.querySelector('.title-codex')).toBeNull();
    expect(chosen()).toBe('Ann');
    press('Escape');
    expect(chosen()).toBe('Ann');
  });
});

describe('the main menu: the roster', () => {
  it('the last played first; a world never marked played, last of all', () => {
    keep(1, 'Never', null);
    keep(2, 'Old', 10);
    keep(3, 'New', 99);
    void showMainMenu(hooks);
    expect(names()).toEqual(['New', 'Old', 'Never']);
  });

  it("each card: their level on its shield, their day and world, who they are on hover; the count over them", () => {
    keep(7, 'Ann', 300, 12);
    keep(8, 'Bede', 200, 3);
    void showMainMenu(hooks);
    const [ann] = cards();
    expect(ann.querySelector('.title-crest')?.textContent).toBe('12');
    expect(ann.querySelector('.title-who small')?.textContent).toBe('Day 1 · World 7');
    expect(ann.title).toBe('Ann, level 12');
    expect(document.querySelector('.gilded-head small')?.textContent).toBe(`2 / ${MAX_WORLDS}`);
  });

  it('a slot for every place left: all of them with no hero, none when full', () => {
    void showMainMenu(hooks);
    expect(document.querySelectorAll('.title-slot')).toHaveLength(MAX_WORLDS);
    expect(button('Create Hero')).toBeDefined();
    document.body.innerHTML = '<div id="loading" class="title"><h1>EvenHold</h1></div>';
    for (let i = 0; i < MAX_WORLDS; i++) keep(100 + i, `Hero${i}`, i);
    void showMainMenu(hooks);
    expect(document.querySelectorAll('.title-slot')).toHaveLength(0);
    expect(cards()).toHaveLength(MAX_WORLDS);
  });

  it('a double click on a card: straight into their world', async () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    const menu = showMainMenu(hooks);
    cards()[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect((await menu).seed).toBe(2);
  });
});

describe('the main menu: letting a hero go', () => {
  it("asked again once another's chosen (a first click on Delete doesn't carry over)", () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    void showMainMenu(hooks);
    button('Delete hero')!.click();
    expect(button('Forget Ann?')).toBeDefined();
    cards()[1].click();
    expect(button('Forget')).toBeUndefined();
    button('Delete hero')!.click();
    button('Forget Bede?')!.click();
    expect(savedWorlds().map((w) => w.name)).toEqual(['Ann']); // (Bede, not Ann)
  });

  it('the arrows, too, take back a first click', () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    void showMainMenu(hooks);
    button('Delete hero')!.click();
    press('ArrowDown');
    expect(button('Forget')).toBeUndefined();
    expect(savedWorlds()).toHaveLength(2);
  });

  it('the chosen one, further down, let go: the first chosen after, the roster whole', () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    keep(3, 'Cuth', 100);
    void showMainMenu(hooks);
    cards()[2].click();
    button('Delete hero')!.click();
    button('Forget Cuth?')!.click();
    expect(names()).toEqual(['Ann', 'Bede']);
    expect(chosen()).toBe('Ann');
    expect(document.querySelectorAll('.title-slot')).toHaveLength(MAX_WORLDS - 2);
  });

  it('the last one let go: the empty roster, Create Hero, no Delete', () => {
    keep(1, 'Ann', 300);
    void showMainMenu(hooks);
    button('Delete hero')!.click();
    button('Forget Ann?')!.click();
    expect(cards()).toHaveLength(0);
    expect(document.querySelector('.title-enter')?.textContent).toBe('Create Hero');
    expect(button('Delete hero')).toBeUndefined();
    expect(localStorage.getItem('evenhold.save.1')).toBeNull();
    expect(localStorage.getItem('evenhold.played.1')).toBeNull();
  });
});

describe('the main menu: gone, once a world is chosen', () => {
  it("resolves once, with only the seed for a hero already made; the page as it was; deaf after", async () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    const menu = showMainMenu(hooks);
    const enter = button('Enter World')!;
    enter.click();
    enter.click();
    const choice: MenuChoice = await menu;
    expect(choice).toEqual({ seed: 1 });
    const root = document.getElementById('loading')!;
    expect(root.classList.contains('title')).toBe(false);
    expect(root.classList.contains('flat')).toBe(false);
    expect(root.querySelector('.title-screen, .title-saying')).toBeNull();
    expect(root.querySelector('h1')).not.toBeNull(); // (the title stays: the loading screen's)
    press('ArrowDown');
    press('Enter');
    expect(document.querySelector('.title-card')).toBeNull(); // (nothing drawn again)
  });

  it("a second menu after the first works on its own (the first's keys gone with it)", async () => {
    keep(1, 'Ann', 300);
    keep(2, 'Bede', 200);
    const first = showMainMenu(hooks);
    press('Enter');
    expect((await first).seed).toBe(1);
    document.body.innerHTML = '<div id="loading" class="title"><h1>EvenHold</h1></div>';
    const second = showMainMenu(hooks);
    press('ArrowDown'); // (one step, not two: the first menu hears nothing)
    expect(chosen()).toBe('Bede');
    press('Enter');
    expect((await second).seed).toBe(2);
  });
});

describe('the main menu: its saying', () => {
  it('one of the sayings, chosen at random', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    void showMainMenu(hooks);
    expect(document.querySelector('.title-saying')?.textContent).toBe(SAYINGS.at(-1));
  });

  it('every saying: one plain sentence, short enough for the signboard, none twice', () => {
    expect(SAYINGS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SAYINGS).size).toBe(SAYINGS.length);
    for (const saying of SAYINGS) {
      expect(saying, saying).toMatch(/^[A-Z][^!?]*\.$/); // (a calm saying: no exclamations)
      expect(saying.length, saying).toBeLessThanOrEqual(48);
      expect(saying).not.toMatch(/\s{2}|^\s|\s$/);
    }
  });
});

describe('the worlds saved here', () => {
  it('a save that cannot be read, or keyed by no seed, left out (the rest listed)', () => {
    keep(1, 'Ann', 300);
    localStorage.setItem('evenhold.save.2', '{ broken');
    localStorage.setItem('evenhold.save.3', JSON.stringify({ version: -1 }));
    localStorage.setItem('evenhold.save.notaseed', JSON.stringify(base));
    localStorage.setItem('unrelated.key', 'x');
    expect(savedWorlds().map((w) => w.name)).toEqual(['Ann']);
  });

  it("a save that can't be read takes no place: the slot the menu offers for it is kept", async () => {
    const { startAutoSave } = await import('../src/controller/storage/saveGame');
    for (let i = 0; i < MAX_WORLDS - 1; i++) keep(100 + i, `Hero${i}`, i);
    localStorage.setItem('evenhold.save.200', '{ broken');
    void showMainMenu(hooks);
    expect(document.querySelectorAll('.title-slot')).toHaveLength(1); // (a place offered)
    const fresh = new GameModel(TEST_SEEDS[1], TEST_MAP_SIZE);
    const auto = startAutoSave(fresh);
    auto.save();
    expect(localStorage.getItem(`evenhold.save.${TEST_SEEDS[1]}`)).not.toBeNull(); // (and kept)
    auto.forget();
  });

  it('each tells its hero (look and gear too, for the menu to draw)', () => {
    keep(5, 'Ann', 300, 4);
    const [world] = savedWorlds();
    expect(world).toMatchObject({ seed: 5, name: 'Ann', level: 4, day: 1, playedAt: 300 });
    expect(world.look).toEqual(base.hero.look);
    expect(world.equipment).toEqual(base.hero.equipment ?? {});
  });

  it('no storage (a private window): none listed, forgetting does no harm, the menu still opens', () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(savedWorlds()).toEqual([]);
    expect(() => forgetWorld(1)).not.toThrow();
    void showMainMenu(hooks);
    expect(document.querySelector('.title-enter')?.textContent).toBe('Create Hero');
  });
});

describe('seeds typed in', () => {
  it.each([
    ['42', 42],
    ['  42  ', 42],
    ['+7', 7],
    ['-7', -7],
    ['0', 0],
    ['-0', 0],
    [String(2 ** 31 - 1), 2 ** 31 - 1],
    [String(-(2 ** 31)), -(2 ** 31)],
  ])('%j: that number', (text, seed) => expect(Object.is(seedFrom(text), seed)).toBe(true));

  it.each(['1e30', '12345678901234567890', String(2 ** 31), '1.5', '0x10', 'Infinity', 'NaN', '4 2', 'dragon'])(
    '%j: a word, its own world (a valid seed, not some other number\'s)',
    (text) => {
      const seed = seedFrom(text)!;
      expect(Number.isSafeInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(1_000_000_000);
      expect(seedFrom(text)).toBe(seed); // (the same each time)
    },
  );

  it('two long numbers, two worlds (their digits not lost)', () => {
    expect(seedFrom('12345678901234567890')).not.toBe(seedFrom('12345678901234567891'));
    expect(seedFrom('1e30')).not.toBe(0);
  });

  it('words: case and accents count, spaces round them do not', () => {
    expect(seedFrom('Dragon')).not.toBe(seedFrom('dragon'));
    expect(seedFrom('dragón')).not.toBe(seedFrom('dragon'));
    expect(seedFrom('  dragon ')).toBe(seedFrom('dragon'));
    expect(seedFrom('🐉')).toBe(seedFrom('🐉'));
  });

  it('blank, none', () => {
    for (const blank of ['', '   ', '\t\n']) expect(seedFrom(blank)).toBeNull();
  });
});

describe('seeds typed in: the plain cases', () => {
  it('a number as it is; a word, the same world each time; nothing, none', () => {
    expect(seedFrom(' 42 ')).toBe(42);
    expect(seedFrom('dragon')).toBe(seedFrom('dragon'));
    expect(seedFrom('dragon')).not.toBe(seedFrom('griffin'));
    expect(Number.isInteger(seedFrom('dragon'))).toBe(true);
    expect(seedFrom('  ')).toBeNull();
  });
});
