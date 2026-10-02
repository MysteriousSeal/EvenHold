// @vitest-environment happy-dom
// The main menu (controller/mainMenu.ts), as WoW's and Diablo's character select,
// and what it lists (storage/saveGame.ts
// savedWorlds), without WebGL (no world, no opening: view/title's, in
// mainMenuWorld.test.ts): the title, a saying under it, every hero at once, the last
// played chosen and drawn, Enter World; one let go (asked twice); a new
// world from a seed or a random one; the controls; Escape back.
import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTitleCamp } from '../src/view/title/titleCamp';
import { createTitleScene } from '../src/view/title/titleScene';
import { places } from '../src/view/title/titleHeroes';
import { GameModel } from '../src/model/GameModel';
import { snapshot } from '../src/model/save';
import { MAX_WORLDS, forgetWorld, savedWorlds, startAutoSave } from '../src/controller/storage/saveGame';
import { showMainMenu } from '../src/controller/mainMenu';
import { CONTROLS } from '../src/controller/controls';
import { LOOK_TRAITS, fitLook, stepTrait, withTrait } from '../src/model/human/lookTraits';
import { HERO_LOOK, SKIN_TONE_COUNT, STYLES_OF } from '../src/model/human/humanoid';
import { seedFrom } from '../src/util/seed';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// A world saved here: its hero named, levelled, played at `at`.
const keep = (seed: number, name: string, level: number, at: number) => {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  Object.assign(model.hero, { name, level });
  localStorage.setItem(`evenhold.save.${seed}`, JSON.stringify(snapshot(model)));
  localStorage.setItem(`evenhold.played.${seed}`, String(at));
};
const click = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.startsWith(text))!.click();

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="loading"><h1>EvenHold</h1><div id="loading-bar"></div></div>';
});

describe('seeds typed in', () => {
  it('a number as it is; a word, the same world each time; nothing, none', () => {
    expect(seedFrom(' 42 ')).toBe(42);
    expect(seedFrom('dragon')).toBe(seedFrom('dragon'));
    expect(seedFrom('dragon')).not.toBe(seedFrom('griffin'));
    expect(Number.isInteger(seedFrom('dragon'))).toBe(true);
    expect(seedFrom('  ')).toBeNull();
  });
});

describe('the worlds saved here', () => {
  it('each its hero, level and day, the last played first; one forgotten, gone', () => {
    keep(TEST_SEEDS[0], 'Aleyn', 17, 100);
    keep(TEST_SEEDS[1], 'Bertrade', 3, 200);
    localStorage.setItem('evenhold.save.999', 'not a save');
    const worlds = savedWorlds();
    expect(worlds.map((w) => [w.name, w.level])).toEqual([['Bertrade', 3], ['Aleyn', 17]]);
    expect(worlds[0].day).toBeGreaterThanOrEqual(1);
    forgetWorld(TEST_SEEDS[1]);
    expect(savedWorlds().map((w) => w.name)).toEqual(['Aleyn']);
  });
});

describe('the main menu', () => {
  const hooks = { worlds: savedWorlds, forget: forgetWorld };
  const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  const cards = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.title-card'));
  const shown = () => document.querySelector('.title-hero-name')?.textContent;

  it('opens on every hero at once (no Press any key), a saying under the title, the last played chosen and drawn', () => {
    keep(TEST_SEEDS[0], 'Aleyn', 17, 100);
    keep(TEST_SEEDS[1], 'Bertrade', 3, 200);
    void showMainMenu(hooks, 'Mind the bouncer.');
    expect(document.querySelector('.title-saying')?.textContent).toBe('Mind the bouncer.');
    expect(document.querySelector('.title-press')).toBeNull();
    expect(document.getElementById('loading')!.classList.contains('flat')).toBe(true); // (the flat sun and hills)
    expect(cards().map((c) => c.querySelector('b')?.textContent)).toEqual(['Bertrade', 'Aleyn']);
    expect(cards()[0].querySelector('.title-portrait canvas')).not.toBeNull(); // (their bust)
    expect(cards()[1].querySelector('.title-crest')?.textContent).toBe('17'); // (their level, on a shield)
    expect(cards()[0].classList.contains('chosen')).toBe(true);
    expect(shown()).toBe('Bertrade');
    expect(document.querySelector('.title-stage canvas')).not.toBeNull(); // (in their look and gear)
    press('Escape');
    expect(shown()).toBe('Bertrade'); // (nowhere further back)
  });

  it('another hero by the arrows or a click; Enter (or Enter World) plays them', async () => {
    keep(TEST_SEEDS[0], 'Aleyn', 17, 100);
    keep(TEST_SEEDS[1], 'Bertrade', 3, 200);
    let chosen = showMainMenu(hooks);
    press('ArrowDown');
    expect(shown()).toBe('Aleyn');
    cards()[0].click();
    expect(shown()).toBe('Bertrade');
    press('Enter');
    expect((await chosen).seed).toBe(TEST_SEEDS[1]);
    expect(document.querySelector('.title-screen')).toBeNull();
    expect(document.querySelector('.title-saying')).toBeNull();
    expect(document.getElementById('loading')!.classList.contains('title')).toBe(false);
    document.body.innerHTML = '<div id="loading"><h1>EvenHold</h1></div>';
    chosen = showMainMenu(hooks);
    press('ArrowUp');
    click('Enter World');
    expect((await chosen).seed).toBe(TEST_SEEDS[0]);
  });

  it('lets a hero go only when asked twice', async () => {
    keep(TEST_SEEDS[0], 'Aleyn', 17, 100);
    keep(TEST_SEEDS[1], 'Bertrade', 3, 200);
    const chosen = showMainMenu(hooks);
    click('Delete hero');
    expect(savedWorlds()).toHaveLength(2);
    click('Forget Bertrade?');
    expect(savedWorlds().map((w) => w.name)).toEqual(['Aleyn']);
    click('Enter World');
    expect((await chosen).seed).toBe(TEST_SEEDS[0]);
  });

  it('with nothing saved: an empty stage; Create Hero, the creation screen', async () => {
    const chosen = showMainMenu(hooks);
    expect(cards()).toHaveLength(0);
    expect(document.querySelector('.title-enter')?.textContent).toBe('Create Hero');
    click('Create Hero');
    expect(document.querySelector('.title-forge')).not.toBeNull();
    document.querySelector<HTMLInputElement>('.forge-world .title-input')!.value = 'dragon';
    click('Create Hero');
    const made = await chosen;
    expect(made.seed).toBe(seedFrom('dragon'));
    expect(made.hero?.name).toBeTruthy();
  });

  it('tells the controls; Back to the heroes', () => {
    keep(TEST_SEEDS[0], 'Aleyn', 17, 100);
    void showMainMenu(hooks);
    click('Controls');
    expect(Array.from(document.querySelectorAll('.title-group h3')).map((h) => h.textContent)).toEqual(['Getting about', 'Fighting', 'Your hero']);
    const line = (what: string) => Array.from(document.querySelectorAll('.title-control')).find((l) => l.querySelector('.title-what')?.firstChild?.textContent === what)!;
    expect(Array.from(line('Move').querySelectorAll('.title-cluster')).map((c) => c.textContent)).toEqual(['WASD', '↑←↓→']); // (in their keyboard shape)
    expect(line('Strike').querySelector('.title-cap.wide')?.textContent).toBe('Space');
    expect(line('Guard').querySelector('small')?.textContent).toBe('raise it as a blow lands: parry');
    expect(line('Zoom').querySelector('.title-mouse.wheel')).not.toBeNull();
    expect(CONTROLS).toContainEqual(['Guard (raise it as a blow lands: parry)', 'Hold Q']); // (the pause menu's, as text)
    click('Back');
    expect(shown()).toBe('Aleyn');
  });
});

describe("the main menu's world", () => {
  it('a camp: the fire lit, the woods round it, the clearing where the heroes stand left open', () => {
    const scene = new THREE.Scene();
    buildTitleCamp(scene);
    const meshes = scene.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(30);
    expect(meshes.some((m) => (m.material as THREE.MeshStandardMaterial).emissiveIntensity > 1)).toBe(true); // (the fire's glow)
    for (const m of meshes.filter((m) => m.scale.x > 1)) expect(Math.hypot(m.position.x / 4.4, (m.position.z + 1) / 3.2)).toBeGreaterThanOrEqual(1); // (no tree in the clearing)
  });

  it('without WebGL, none: the menu draws the hero flat', () => {
    expect(createTitleScene(document.getElementById('loading')!)).toBeNull();
  });
});

describe("the main menu's valley", () => {
  it('level with the camp at its edge, rising away; a lake in a hollow; built whole, quickly', async () => {
    const { valleyHeight, buildTitleValley } = await import('../src/view/title/titleValley');
    expect(valleyHeight(0, 5.5)).toBe(0);
    expect(valleyHeight(-9.5, -3)).toBe(0);
    expect(valleyHeight(-40, -40)).toBeGreaterThan(3);
    expect(valleyHeight(0, -95)).toBeGreaterThanOrEqual(15); // (the far peaks, snowy)
    expect(valleyHeight(19, -26)).toBe(0); // (the lake)
    const scene = new THREE.Scene();
    const began = performance.now();
    buildTitleValley(scene);
    expect(performance.now() - began).toBeLessThan(3000);
    const forests = scene.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
    expect(forests.reduce((n, f) => n + f.count, 0)).toBeGreaterThan(500);
  });
});

describe('eight worlds at most', () => {
  // `n` worlds saved here (one hero's save, copied under each seed).
  const fill = (n: number) => {
    const data = snapshot(new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE));
    for (let i = 0; i < n; i++) {
      localStorage.setItem(`evenhold.save.${100 + i}`, JSON.stringify({ ...data, seed: 100 + i }));
      localStorage.setItem(`evenhold.played.${100 + i}`, String(i));
    }
  };

  it('a slot for each place left (a new hero); full: none, and told why; one let go, a slot back', () => {
    fill(MAX_WORLDS - 1);
    let menu = showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    expect(document.querySelectorAll('.title-slot')).toHaveLength(1);
    expect(document.querySelector('.title-list-head small')?.textContent).toBe('7 / 8');
    document.querySelector<HTMLButtonElement>('.title-slot')!.click();
    expect(document.querySelector('.title-forge')).not.toBeNull(); // (a new hero, made)
    void menu;
    document.body.innerHTML = '<div id="loading"><h1>EvenHold</h1></div>';
    fill(MAX_WORLDS);
    menu = showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
    expect(document.querySelectorAll('.title-slot')).toHaveLength(0);
    expect(document.querySelector('.title-full')?.textContent).toContain('8 heroes at most');
    click('Delete hero');
    click('Forget');
    expect(document.querySelectorAll('.title-slot')).toHaveLength(1);
    expect(document.querySelector('.title-full')).toBeNull();
  });

  it('full: a new world (a shared link) is played but not kept; a saved one still is', () => {
    fill(MAX_WORLDS);
    const fresh = startAutoSave(new GameModel(TEST_SEEDS[1], TEST_MAP_SIZE));
    fresh.save();
    expect(localStorage.getItem(`evenhold.save.${TEST_SEEDS[1]}`)).toBeNull();
    fresh.forget();
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    (model as { seed: number }).seed = 100;
    const kept = startAutoSave(model);
    localStorage.removeItem('evenhold.played.100');
    kept.save();
    expect(localStorage.getItem('evenhold.played.100')).not.toBeNull();
    kept.forget();
  });
});

describe("the heroes' places before the fire", () => {
  it.each([1, 3, 4, 5, 6, 7, 8])('%i: four in front, the rest behind in the gaps, nobody hidden, the whole centred', (n) => {
    const spots = places(n);
    expect(spots.filter((p) => !p.back)).toHaveLength(Math.min(n, 4));
    const front = spots.filter((p) => !p.back);
    for (const b of spots.filter((p) => p.back)) for (const f of front) expect(Math.abs(b.x - f.x)).toBeGreaterThan(0.25);
    const mid = spots.reduce((sum, p) => sum + p.x, 0) / n;
    expect(Math.abs(mid)).toBeLessThan(0.3);
  });
});

describe('the character creation screen', () => {
  const hooks = { worlds: savedWorlds, forget: forgetWorld };
  const trait = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('.forge-trait')).find((t) => t.querySelector('.forge-trait-head span')?.textContent === label);
  const option = (label: string, name: string) => Array.from(trait(label)!.querySelectorAll<HTMLButtonElement>('.forge-option')).find((b) => b.title === name)!;
  const open = () => {
    const chosen = showMainMenu(hooks);
    click('Create Hero');
    return chosen;
  };

  it('every trait of a look, each drawn for its kind; none known to it by name', () => {
    void open();
    for (const t of LOOK_TRAITS.filter((t) => t.key !== 'beard')) { // (the beard, a man's only: checked below)
      expect(trait(t.label)?.classList.contains(t.kind)).toBe(true);
    }
    expect(trait('Skin')!.querySelectorAll('.forge-option')).toHaveLength(SKIN_TONE_COUNT);
    expect(option('Skin', 'Fair').style.getPropertyValue('--swatch')).toMatch(/^#[0-9a-f]{6}$/); // (its colour)
  });

  it("a woman: her hair styles, no beard; a man: his, and the beard to choose; a name to match, unless one's typed", () => {
    void open();
    option('Body', 'Woman').click();
    expect(trait('Beard')).toBeUndefined();
    const at = Number(trait('Hair')!.querySelector('.forge-face small')!.textContent!.split(' / ')[0]) - 1; // (his style kept, were it hers too)
    expect(trait('Hair')!.querySelector('.forge-face small')?.textContent).toBe(`${at + 1} / ${STYLES_OF.female.length}`);
    trait('Hair')!.querySelectorAll<HTMLButtonElement>('.forge-arrow')[1].click();
    const next = STYLES_OF.female[(at + 1) % STYLES_OF.female.length];
    expect(trait('Hair')!.querySelector('.forge-face b')?.textContent).toBe(LOOK_TRAITS.find((t) => t.key === 'hairStyle')!.name(next)); // (the next of hers)
    option('Body', 'Man').click();
    expect(trait('Beard')).toBeDefined();
    expect(STYLES_OF.male).toContain(trait('Hair')!.querySelector('.forge-face b')!.textContent!.toLowerCase());
    const name = document.querySelector<HTMLInputElement>('.forge-name')!;
    name.value = 'Wynn';
    name.dispatchEvent(new Event('input'));
    option('Body', 'Woman').click();
    expect(document.querySelector<HTMLInputElement>('.forge-name')!.value).toBe('Wynn'); // (theirs, kept)
  });

  it('made as chosen: their name and look; a name refused, and told why', async () => {
    const chosen = open();
    option('Body', 'Woman').click();
    option('Skin', 'Deep').click();
    option('Clothes', 'Turquoise').click();
    const name = document.querySelector<HTMLInputElement>('.forge-name')!;
    name.value = '  ';
    name.dispatchEvent(new Event('input'));
    click('Create Hero');
    expect(document.querySelector('.forge-problem')?.textContent).toBe('Your hero needs a name.');
    name.value = 'Brída  of  the Wold';
    name.dispatchEvent(new Event('input'));
    click('Create Hero');
    const made = await chosen;
    expect(made.hero).toEqual({ name: 'Brída of the Wold', look: expect.objectContaining({ build: 'female', skin: 3, dye: 5, beard: false }) });
  });

  it("Surprise me: a whole new look, still sound; Back, and Escape, to the heroes", () => {
    keep(TEST_SEEDS[0], 'Aleyn', 17, 100);
    void showMainMenu(hooks);
    document.querySelector<HTMLButtonElement>('.title-slot')!.click(); // (a hero saved: a slot for a new one)
    for (let i = 0; i < 20; i++) {
      click('Surprise me');
      if (option('Body', 'Woman').classList.contains('chosen')) expect(trait('Beard')).toBeUndefined();
    }
    click('Back');
    expect(document.querySelector('.title-forge')).toBeNull();
    document.querySelector<HTMLButtonElement>('.title-slot')!.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    expect(document.querySelector('.title-list')).not.toBeNull();
  });
});

describe('look traits', () => {
  it('a look made sound: a style of their build, no beard on a woman; one trait set, the rest kept sound', () => {
    expect(fitLook({ ...HERO_LOOK, build: 'female', beard: true, hairStyle: 'cropped' })).toMatchObject({ beard: false, hairStyle: STYLES_OF.female[0] });
    expect(withTrait(HERO_LOOK, 'skin', 2)).toEqual({ ...HERO_LOOK, skin: 2 });
    expect(stepTrait({ ...HERO_LOOK, hairStyle: STYLES_OF.male.at(-1)! }, 'hairStyle', 1).hairStyle).toBe(STYLES_OF.male[0]); // (round)
    expect(LOOK_TRAITS.find((t) => t.key === 'hairStyle')!.name('twinBraids')).toBe('Twin braids');
  });
});
