// @vitest-environment happy-dom
// The character creation screen, edge by edge: its panels on their own
// (controller/title/heroForge.ts: the name's rules, the dice, a name typed kept,
// the steppers wrapping, the swatches, the helm tried on, the seed, every
// change told), the screen in the menu (Enter, Escape, a fresh one each
// visit, a world of theirs carried on), and the traits it's drawn from
// (model/human/lookTraits.ts: every one sound, every random look sound).
// Names stood in for (Osric for him, Wenna for her): the same each time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heroForge } from '../src/controller/title/heroForge';
import { showMainMenu } from '../src/controller/title/mainMenu';
import { forgetWorld, savedWorlds } from '../src/controller/storage/saveGame';
import { GameModel } from '../src/model/GameModel';
import { snapshot } from '../src/model/save';
import { EXPRESSIONS, HAIR_COLOR_COUNT, SKIN_TONE_COUNT, STYLES_OF, randomLook, type BodyLook } from '../src/model/human/humanoid';
import { LOOK_TRAITS, fitLook, stepTrait, withTrait } from '../src/model/human/lookTraits';
import { HERO_LOOK } from '../src/model/human/humanoid';
import { seedFrom } from '../src/util/seed';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/model/npcs/npcs', async (original) => ({
  ...(await original<typeof import('../src/model/npcs/npcs')>()),
  randomName: (build: string) => (build === 'female' ? 'Wenna' : 'Osric'),
}));

const hooks = { worlds: savedWorlds, forget: forgetWorld };
const base = snapshot(new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE));
const keep = (seed: number, name: string) => {
  localStorage.setItem(`evenhold.save.${seed}`, JSON.stringify({ ...base, seed, hero: { ...base.hero, name } }));
  localStorage.setItem(`evenhold.played.${seed}`, '1');
};

// A forge on its own, in the page, its changes counted.
const forge = (heroOf?: (seed: number) => string | null) => {
  const told: Array<{ look: BodyLook; name: string }> = [];
  const f = heroForge((look, name) => told.push({ look, name }), heroOf);
  document.body.append(f.panel, f.identity);
  return { f, told };
};
const trait = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('.forge-trait')).find((t) => t.querySelector('.forge-trait-head span')?.textContent === label);
const option = (label: string, name: string) => Array.from(trait(label)!.querySelectorAll<HTMLButtonElement>('.forge-option')).find((b) => b.title === name || b.textContent === name)!;
const arrows = (label: string) => Array.from(trait(label)!.querySelectorAll<HTMLButtonElement>('.forge-arrow'));
const face = (label: string) => trait(label)!.querySelector('.forge-face')!;
const nameField = () => document.querySelector<HTMLInputElement>('.forge-name')!;
const typeName = (text: string) => {
  nameField().value = text;
  nameField().dispatchEvent(new Event('input'));
};
const problem = () => document.querySelector('.forge-problem')?.textContent ?? '';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});
afterEach(() => vi.restoreAllMocks());

describe('the name', () => {
  it.each([
    ['Ann', 'Ann'],
    ['  Ann  ', 'Ann'],
    ['Jo   Ann', 'Jo Ann'],
    ["O'Neil", "O'Neil"],
    ['Anne-Marie', 'Anne-Marie'],
    ['Brída', 'Brída'],
    ['Ελένη', 'Ελένη'],
    ['Æthelflæd', 'Æthelflæd'],
    ['A', 'A'],
    ['Abcdefghijklmnopqr', 'Abcdefghijklmnopqr'], // (18: the most)
  ])('%j: taken, as %j', (typed, made) => {
    const { f } = forge();
    typeName(typed);
    expect(f.submit()?.name).toBe(made);
    expect(problem()).toBe('');
  });

  it.each(['', '   ', '-Ann', "'Ann", 'R2D2', 'Ann!', 'Ann_1', '🐉', 'Ann.'])('%j: refused, and told why', (typed) => {
    const { f } = forge();
    typeName(typed);
    expect(f.submit()).toBeNull();
    expect(problem()).toMatch(typed.trim() ? /letters/ : /needs a name/);
  });

  it('never longer than 18 (the field holds no more); a problem told, cleared once typing again', () => {
    const { f } = forge();
    expect(nameField().maxLength).toBe(18);
    typeName('');
    f.submit();
    expect(problem()).not.toBe('');
    typeName('B');
    expect(problem()).toBe('');
  });

  it('one to match their body, until one is typed; the dice, a new one, matching again', () => {
    const { f } = forge();
    option('Body', 'Man').click();
    expect(f.name()).toBe('Osric');
    option('Body', 'Woman').click();
    expect(f.name()).toBe('Wenna');
    typeName('Hild');
    option('Body', 'Man').click();
    expect(f.name()).toBe('Hild'); // (theirs, kept)
    document.querySelector<HTMLButtonElement>('.forge-name-line .forge-dice')!.click();
    expect(f.name()).toBe('Osric');
    option('Body', 'Woman').click();
    expect(f.name()).toBe('Wenna');
  });

  it('Surprise me: a new look, a typed name kept', () => {
    const { f } = forge();
    typeName('Hild');
    for (let i = 0; i < 10; i++) document.querySelector<HTMLButtonElement>('.forge-surprise')!.click();
    expect(f.name()).toBe('Hild');
  });
});

describe('the look', () => {
  it('every change told, as it is (the hero being made stands changed)', async () => {
    const { f, told } = forge();
    await Promise.resolve();
    expect(told).toHaveLength(1); // (at first)
    option('Body', 'Woman').click();
    option('Skin', 'Deep').click();
    arrows('Hair')[1].click();
    typeName('Hild');
    expect(told).toHaveLength(5);
    expect(told.at(-1)).toEqual({ look: f.look(), name: 'Hild' });
  });

  it('a swatch chosen: lit, pressed, its name in the head; the others not', () => {
    forge();
    option('Hair colour', 'Red').click();
    const red = option('Hair colour', 'Red');
    expect(red.classList.contains('chosen')).toBe(true);
    expect(red.getAttribute('aria-pressed')).toBe('true');
    expect(trait('Hair colour')!.querySelector('.forge-trait-head b')?.textContent).toBe('Red');
    expect(trait('Hair colour')!.querySelectorAll('.forge-option.chosen')).toHaveLength(1);
    expect(trait('Hair colour')!.querySelectorAll('.forge-option')).toHaveLength(HAIR_COLOR_COUNT);
    expect(trait('Skin')!.querySelectorAll('.forge-option')).toHaveLength(SKIN_TONE_COUNT);
  });

  it('the steppers wrap round both ways, telling where they are', () => {
    const { f } = forge();
    option('Body', 'Man').click();
    const styles = STYLES_OF.male;
    while (f.look().hairStyle !== styles[0]) arrows('Hair')[1].click();
    arrows('Hair')[0].click();
    expect(f.look().hairStyle).toBe(styles.at(-1));
    expect(face('Hair').querySelector('small')?.textContent).toBe(`${styles.length} / ${styles.length}`);
    arrows('Hair')[1].click();
    expect(f.look().hairStyle).toBe(styles[0]);
    for (let i = 0; i < EXPRESSIONS.length; i++) arrows('Face')[1].click();
    expect(face('Face').querySelector('small')?.textContent).toMatch(new RegExp(`/ ${EXPRESSIONS.length}$`));
  });

  it("a woman: no beard to choose, none on her; a man again: clean-shaven, and his hair one of his", () => {
    const { f } = forge();
    option('Body', 'Man').click();
    option('Beard', 'Bearded').click();
    option('Body', 'Woman').click();
    expect(trait('Beard')).toBeUndefined();
    expect(f.look().beard).toBe(false);
    option('Body', 'Man').click();
    expect(option('Beard', 'Clean-shaven').classList.contains('chosen')).toBe(true);
    expect(STYLES_OF.male).toContain(f.look().hairStyle);
  });

  it('the helm: off at first, tried on, off again; right under the hair style', () => {
    const { f } = forge();
    expect(f.helm()).toBe(false);
    expect(trait('Hair')!.nextElementSibling?.classList.contains('forge-helm')).toBe(true);
    option('Helm', 'On').click();
    expect(f.helm()).toBe(true);
    option('Helm', 'Off').click();
    expect(f.helm()).toBe(false);
  });
});

describe('the seed', () => {
  it('made with the seed typed (a word, a number), or a random one', () => {
    const { f } = forge();
    const seedField = document.querySelector<HTMLInputElement>('.forge-seed')!;
    seedField.value = 'dragon';
    expect(f.submit()?.seed).toBe(seedFrom('dragon'));
    seedField.value = ' 77 ';
    expect(f.submit()?.seed).toBe(77);
    seedField.value = '';
    const seed = f.submit()!.seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 31);
  });

  it("a world of theirs named (asked of the menu, seed by seed)", () => {
    const asked: number[] = [];
    forge((seed) => (asked.push(seed), seed === 9 ? 'Ann' : null));
    const seedField = document.querySelector<HTMLInputElement>('.forge-seed')!;
    seedField.value = '9';
    seedField.dispatchEvent(new Event('input'));
    expect(document.querySelector('.forge-seed-reading')?.textContent).toBe("Opens Ann's world: they carry on there.");
    seedField.value = '10';
    seedField.dispatchEvent(new Event('input'));
    expect(document.querySelector('.forge-seed-reading')?.textContent).toBe('World 10');
    expect(asked).toEqual([9, 10]);
  });
});

describe('the creation screen, in the menu', () => {
  const open = () => {
    document.body.innerHTML = '<div id="loading" class="title"><h1>EvenHold</h1></div>';
    const menu = showMainMenu(hooks);
    document.querySelector<HTMLButtonElement>('.title-slot')!.click();
    return menu;
  };

  it('Enter makes the hero, typing the name or not', async () => {
    let menu = open();
    const offered = nameField().value; // (the name it came with)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    expect(['Osric', 'Wenna']).toContain(offered);
    expect((await menu).hero?.name).toBe(offered);
    menu = open();
    typeName('Hild');
    nameField().dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    expect((await menu).hero?.name).toBe('Hild');
  });

  it('a name refused: not made, the screen stays', async () => {
    const menu = open();
    typeName('R2D2');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    let done = false;
    void menu.then(() => (done = true));
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(false);
    expect(document.querySelector('.title-forge')).not.toBeNull();
    expect(problem()).toMatch(/letters/);
  });

  it('Escape in the name: back to the heroes; a fresh screen the next time (no problem, no helm, no seed)', () => {
    keep(1, 'Ann');
    void open();
    typeName('');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    option('Helm', 'On').click();
    document.querySelector<HTMLInputElement>('.forge-seed')!.value = 'dragon';
    nameField().dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    expect(document.querySelector('.title-forge')).toBeNull();
    document.querySelector<HTMLButtonElement>('.title-slot')!.click();
    expect(problem()).toBe('');
    expect(option('Helm', 'Off').classList.contains('chosen')).toBe(true);
    expect(document.querySelector<HTMLInputElement>('.forge-seed')!.value).toBe('');
  });

  it("made in a world of theirs: no new hero, theirs carries on", async () => {
    keep(1, 'Ann');
    const menu = open();
    document.querySelector<HTMLInputElement>('.forge-seed')!.value = '1';
    document.querySelector<HTMLButtonElement>('.title-enter')!.click();
    expect(await menu).toEqual({ seed: 1 });
  });

  it('made: only their name and a sound look (no helm, nothing else)', async () => {
    const menu = open();
    option('Body', 'Woman').click();
    option('Helm', 'On').click();
    document.querySelector<HTMLButtonElement>('.title-enter')!.click();
    const { hero } = await menu;
    expect(Object.keys(hero!).sort()).toEqual(['look', 'name']);
    expect(hero!.look).toEqual(fitLook(hero!.look));
    expect(hero!.look.beard).toBe(false);
  });
});

describe('look traits', () => {
  const builds = ['male', 'female'] as const;
  const looks = builds.map((build) => fitLook({ ...randomLook(), build }));

  it('every trait: a label, a kind, values for every body, each named once', () => {
    for (const t of LOOK_TRAITS) {
      expect(t.label).toBeTruthy();
      expect(['pick', 'swatch', 'cycle', 'toggle']).toContain(t.kind);
      for (const look of looks) {
        const values = t.values(look);
        expect(values.length, `${t.key} for ${look.build}`).toBeGreaterThan(0);
        expect(new Set(values).size).toBe(values.length);
        const names = values.map((v) => t.name(v));
        expect(names.every((n) => n.trim() === n && n.length > 0)).toBe(true);
        expect(new Set(names).size, `${t.key}'s names`).toBe(names.length);
      }
    }
    expect(new Set(LOOK_TRAITS.map((t) => t.label)).size).toBe(LOOK_TRAITS.length);
  });

  it('every colour offered once, in order (all the skin tones, all the hair colours)', () => {
    const values = (key: string) => [...LOOK_TRAITS.find((t) => t.key === key)!.values(looks[0])].map(Number);
    expect([...values('skin')].sort((a, b) => a - b)).toEqual(Array.from({ length: SKIN_TONE_COUNT }, (_, i) => i));
    expect([...values('hair')].sort((a, b) => a - b)).toEqual(Array.from({ length: HAIR_COLOR_COUNT }, (_, i) => i));
  });

  it('any random look is already sound (a hundred of them), and stays the same made sound again', () => {
    for (let i = 0; i < 100; i++) {
      const look = randomLook();
      expect(fitLook(look)).toEqual({ expression: 'calm', ...look });
      expect(fitLook(fitLook(look))).toEqual(fitLook(look));
    }
  });

  it('a value not allowed: the first that is; stepping back from the first: the last', () => {
    const man = fitLook({ ...looks[0], build: 'male' });
    expect(withTrait(man, 'hairStyle', 'braid').hairStyle).toBe(STYLES_OF.male[0]); // (a style of hers)
    expect(withTrait(man, 'skin', 99).skin).toBe(LOOK_TRAITS.find((t) => t.key === 'skin')!.values(man)[0]);
    const first = withTrait(man, 'expression', EXPRESSIONS[0]);
    expect(stepTrait(first, 'expression', -1).expression).toBe(EXPRESSIONS.at(-1));
  });
});

describe('look traits: made sound', () => {
  it('a look made sound: a style of their build, no beard on a woman; one trait set, the rest kept sound', () => {
    expect(fitLook({ ...HERO_LOOK, build: 'female', beard: true, hairStyle: 'cropped' })).toMatchObject({ beard: false, hairStyle: STYLES_OF.female[0] });
    expect(withTrait(HERO_LOOK, 'skin', 2)).toEqual({ ...HERO_LOOK, skin: 2, expression: 'calm' }); // (calm: it had none)
    expect(stepTrait({ ...HERO_LOOK, hairStyle: STYLES_OF.male.at(-1)! }, 'hairStyle', 1).hairStyle).toBe(STYLES_OF.male[0]); // (round)
    expect(LOOK_TRAITS.find((t) => t.key === 'hairStyle')!.name('twinBraids')).toBe('Twin braids');
  });
});
