// @vitest-environment happy-dom
// Windows in front of each other (view/ui/menu.ts): the one opened or clicked last on top, whatever its kind (a
// side window, the bag, the skills; a modal one, a shop); closed, out of the way; never over the action bar.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createMenu } = await import('../src/view/ui/menu');

const make = (title: string, modal: boolean) => createMenu({ title, modal, tabs: [{ name: title, actions: [{ title: 'Do', run: () => {} } as never] }] });
const layerOf = (title: string) => {
  const panel = Array.from(document.querySelectorAll<HTMLElement>('.menu')).find((m) => m.getAttribute('aria-label') === title)!;
  return Number((panel.parentElement as HTMLElement).style.zIndex);
};

describe('windows in front of each other', () => {
  it('the one opened last on top; pressed on, one to the front; closed, out of it; under the action bar always', () => {
    const [bag, skills, shop] = [make('Bag', false), make('Skills', false), make('Shop', true)];
    bag.open();
    skills.open();
    expect(layerOf('Skills')).toBeGreaterThan(layerOf('Bag'));
    shop.open();
    expect(layerOf('Shop')).toBeGreaterThan(layerOf('Skills')); // (a modal one too)
    const bagPanel = Array.from(document.querySelectorAll<HTMLElement>('.menu')).find((m) => m.getAttribute('aria-label') === 'Bag')!;
    bagPanel.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(layerOf('Bag')).toBeGreaterThan(layerOf('Shop'));
    expect(layerOf('Shop')).toBeGreaterThan(layerOf('Skills'));
    for (const title of ['Bag', 'Skills', 'Shop']) expect(layerOf(title)).toBeLessThan(25); // (the action bar's)
    shop.close();
    skills.open(); // (already open: to the front again)
    expect(layerOf('Skills')).toBeGreaterThan(layerOf('Bag'));
    [bag, skills].forEach((m) => m.close());
  });
});
