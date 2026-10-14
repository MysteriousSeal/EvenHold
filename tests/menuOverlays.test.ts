// @vitest-environment happy-dom
// Windows over the whole game (view/ui/menu.ts's trackMenu: the pause menu, a talk, a scene played full screen) and
// the menus under them: while one's up, no menu's key (B, P, Escape) is heard by the menus, only by it; and Escape,
// with menus alone open, shuts the one on top first.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createMenu, trackMenu } = await import('../src/view/ui/menu');

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const make = (title: string, modal: boolean, toggleKey?: string) => createMenu({ title, modal, toggleKey, tabs: [{ name: title, actions: [{ title: 'Do', run: () => {} } as never] }] });
const bag = make('Bag', false, 'KeyB');
const levelUp = make('Level up', true, 'KeyP');
const shop = make('Shop', true);
const all = [bag, levelUp, shop];

afterEach(() => all.forEach((m) => m.isOpen && m.close()));

describe('a window over the game', () => {
  it("keeps the menus' toggle keys from them while it's up", () => {
    const scene = {};
    const heard: string[] = [];
    const listen = (e: KeyboardEvent) => heard.push(e.code);
    window.addEventListener('keydown', listen, true); // (the scene's own: after the menus', as it's made later)
    trackMenu(scene, true);
    press('KeyB');
    press('KeyP');
    expect(bag.isOpen).toBe(false);
    expect(levelUp.isOpen).toBe(false);
    expect(heard).toEqual(['KeyB', 'KeyP']); // (the scene's, all of them)
    trackMenu(scene, false);
    window.removeEventListener('keydown', listen, true);
    press('KeyB');
    expect(bag.isOpen).toBe(true);
  });

  it('opened over a menu, its Escape is its own, the menu left open under it', () => {
    bag.open();
    const talk = {};
    trackMenu(talk, true);
    press('Escape');
    expect(bag.isOpen).toBe(true);
    trackMenu(talk, false);
    press('Escape');
    expect(bag.isOpen).toBe(false);
  });
});

describe('Escape with menus open', () => {
  it('shuts the one on top, then the next', () => {
    bag.open();
    shop.open(); // (over the bag)
    press('Escape');
    expect(shop.isOpen).toBe(false);
    expect(bag.isOpen).toBe(true);
    press('Escape');
    expect(bag.isOpen).toBe(false);
  });

  it('the bag brought to the front: the bag first', () => {
    shop.open();
    bag.open();
    press('Escape');
    expect(bag.isOpen).toBe(false);
    expect(shop.isOpen).toBe(true);
  });
});
