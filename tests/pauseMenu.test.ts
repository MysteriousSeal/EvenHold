// @vitest-environment happy-dom
// The pause menu (controller/pauseMenu.ts): Escape opens it only when no
// other window is, and while open it takes every key; the hero framed; the
// keys (arrows wrap, Enter acts, ← → change a setting, Escape resumes or
// comes back from the controls); the settings changed in place (zoom, inner
// walls), each change drawn at once; the controls; the main menu; a new game
// asked twice; a click outside resumes.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPauseMenu, type PauseHero } from '../src/controller/pauseMenu';
import { anyMenuOpen, createMenu, type Menu } from '../src/view/ui/menu';
import { ZOOM_LEVELS, stepZoom, zoomLevel } from '../src/view/render/zoom';
import { HERO_LOOK } from '../src/model/human/humanoid';

const press = (code: string, repeat = false) => window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat, bubbles: true, cancelable: true }));
const lit = () => document.querySelector('.pause-item.lit');
const litName = () => lit()?.querySelector('b')?.textContent;
const row = (name: string) => Array.from(document.querySelectorAll<HTMLElement>('.pause-item')).find((r) => r.querySelector('b')?.textContent === name)!;

// One pause menu, as in the game (each listens to the page for Escape: a second would hear it too); what it's
// told, set test by test.
let calls: string[] = [];
let fullWalls = false;
let hero: PauseHero;
const menu = createPauseMenu({
  setPaused: (p) => calls.push(`paused:${p}`),
  redraw: () => calls.push('redraw'),
  mainMenu: () => calls.push('mainMenu'),
  walls: { full: () => fullWalls, toggle: () => (fullWalls = !fullWalls) },
  hero: () => hero,
});
const open = () => menu;
let others: Menu[] = [];

beforeEach(() => {
  calls = [];
  fullWalls = false;
  hero = { name: 'Aleyn', level: 7, day: 3, seed: 42, look: HERO_LOOK, equipment: {} };
});
afterEach(() => {
  if (menu.isOpen) menu.close();
  for (const m of others) if (m.isOpen) m.close(); // (none left counted open for the next)
  others = [];
});

describe('the pause menu: opening and closing', () => {
  it('Escape opens it (the game paused, counted among the windows open), Escape again resumes', () => {
    press('Escape');
    expect(menu.isOpen).toBe(true);
    expect(calls).toContain('paused:true');
    expect(anyMenuOpen()).toBe(true);
    press('Escape');
    expect(menu.isOpen).toBe(false);
    expect(calls.at(-1)).toBe('paused:false');
    expect(anyMenuOpen()).toBe(false);
  });

  it('not over another window: Escape is that one\'s', () => {
    const other = createMenu({ title: 'Bag', tabs: [{ name: 'Bag', actions: [] }] });
    others.push(other);
    other.open();
    press('Escape');
    expect(menu.isOpen).toBe(false);
  });

  it('a held Escape does not flicker it', () => {
    press('Escape');
    press('Escape', true);
    expect(menu.isOpen).toBe(true);
  });

  it('while open, no key reaches the game', () => {
    const heard: string[] = [];
    window.addEventListener('keydown', (e) => heard.push(e.code));
    menu.open();
    press('KeyW');
    press('Space');
    expect(heard).toEqual([]);
  });

  it('a click outside its panels resumes; one inside does not', () => {
    menu.open();
    document.querySelector<HTMLElement>('.pause-main')!.click();
    expect(menu.isOpen).toBe(true);
    document.querySelector<HTMLElement>('.pause-backdrop')!.click();
    expect(menu.isOpen).toBe(false);
  });
});

describe('the pause menu: the hero', () => {
  it('framed: their portrait, name, level, day and world', () => {
    open().open();
    const card = document.querySelector('.pause-hero')!;
    expect(card.querySelector('.pause-portrait canvas')).not.toBeNull();
    expect(card.querySelector('.pause-hero-name')?.textContent).toBe('Aleyn');
    expect(card.querySelector('.pause-crest')?.textContent).toBe('Level 7');
    expect(card.querySelector('.pause-hero-line')?.textContent).toBe('Day 3 · World 42');
  });

  it('as they are now, each time it opens', () => {
    hero = { ...hero, level: 1 };
    menu.open();
    menu.close();
    hero = { ...hero, level: 9 };
    menu.open();
    expect(document.querySelector('.pause-crest')?.textContent).toBe('Level 9');
  });
});

describe('the pause menu: its keys', () => {
  it('opens on Resume; the arrows wrap round; Enter on Resume resumes', () => {
    menu.open();
    expect(litName()).toBe('Resume');
    press('ArrowUp');
    expect(litName()).toBe('Main menu'); // (round to the last)
    press('ArrowDown');
    expect(litName()).toBe('Resume');
    press('Enter');
    expect(menu.isOpen).toBe(false);
  });

  it('the mouse lights what it is over', () => {
    open().open();
    row('Main menu').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(litName()).toBe('Main menu');
  });
});

describe('the pause menu: the settings, changed in place', () => {
  it('zoom: › closer, ‹ farther (stopping at the ends), ← → too, Enter round; each change drawn at once', () => {
    open().open();
    while (zoomLevel() !== ZOOM_LEVELS[0]) stepZoom(-1);
    const value = () => document.querySelector('.pause-value')?.textContent;
    document.querySelectorAll<HTMLButtonElement>('.pause-arrow')[0].click();
    expect(zoomLevel()).toBe(ZOOM_LEVELS[0]); // (the farthest: no farther)
    document.querySelectorAll<HTMLButtonElement>('.pause-arrow')[1].click();
    expect(zoomLevel()).toBe(ZOOM_LEVELS[1]);
    expect(value()).toBe(ZOOM_LEVELS[1].name);
    expect(calls.filter((c) => c === 'redraw').length).toBeGreaterThanOrEqual(2);
    press('ArrowDown'); // (onto Zoom)
    expect(litName()).toBe('Zoom');
    press('ArrowRight');
    expect(zoomLevel()).toBe(ZOOM_LEVELS[2]);
    press('ArrowLeft');
    expect(zoomLevel()).toBe(ZOOM_LEVELS[1]);
    while (zoomLevel() !== ZOOM_LEVELS.at(-1)) press('Enter');
    press('Enter');
    expect(zoomLevel()).toBe(ZOOM_LEVELS[0]); // (round, after the closest)
  });

  it('inner walls: Low or Full, by a click or ← →; the chosen one lit and pressed', () => {
    open().open();
    const option = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('.pause-option')).find((b) => b.textContent === label)!;
    expect(option('Low').classList.contains('chosen')).toBe(true);
    option('Full').click();
    expect(fullWalls).toBe(true);
    expect(option('Full').getAttribute('aria-pressed')).toBe('true');
    option('Full').click();
    expect(fullWalls).toBe(true); // (already: no change)
    press('ArrowDown');
    press('ArrowDown'); // (onto Inner walls)
    press('ArrowLeft');
    expect(fullWalls).toBe(false);
    press('ArrowRight');
    expect(fullWalls).toBe(true);
    expect(calls).toContain('redraw');
  });
});

describe('the pause menu: the rest', () => {
  it('the controls, the codex; Escape (or Back) back to the menu, not out of it', () => {
    menu.open();
    row('Controls').click();
    expect(document.querySelectorAll('.pause-main .codex-group')).toHaveLength(3);
    press('Escape');
    expect(menu.isOpen).toBe(true);
    expect(document.querySelector('.pause-title')?.textContent).toBe('Paused');
    row('Controls').click();
    row('Back').click();
    expect(document.querySelector('.pause-title')).not.toBeNull();
  });

  it('the main menu, at once', () => {
    open().open();
    row('Main menu').click();
    expect(calls).toContain('mainMenu');
  });

  it('no new game here (a new hero is made from the main menu)', () => {
    menu.open();
    expect(Array.from(document.querySelectorAll('.pause-item b')).map((b) => b.textContent)).toEqual(['Resume', 'Zoom', 'Inner walls', 'Controls', 'Main menu']);
  });
});
