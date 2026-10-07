// @vitest-environment happy-dom
// A window redrawn (view/ui/menu.ts refresh: after a button in it's pressed) tells of the slot chosen before, straight
// off: never the first on the way (what its panel says, a warning, a button armed to be sure, is the chosen one's,
// and would be lost). Wherever the chosen one's moved to; gone, the one in its place.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createMenu } = await import('../src/view/ui/menu');

describe('a window redrawn', () => {
  it('tells of the one chosen straight off, never the first on the way; wherever it moved; gone, the one in its place', () => {
    let keys = ['a', 'b', 'c'];
    const told: string[] = [];
    const menu = createMenu({
      title: 'Redrawn',
      tabs: [{ name: 'List', slots: () => ({ cells: keys.map((key) => ({ key, title: key, icon: () => document.createElement('canvas') })), columns: 1, rows: true }), detail: (slot) => (told.push(slot?.key ?? '-'), document.createElement('div')) }],
    });
    menu.open();
    const panel = Array.from(document.querySelectorAll('.menu')).find((m) => m.getAttribute('aria-label') === 'Redrawn')!;
    (panel.querySelector('[data-key="c"]') as HTMLElement).click();
    told.length = 0;
    menu.refresh();
    expect(told).toEqual(['c']); // (not 'a' first)
    keys = ['c', 'a', 'b']; // (moved to the top)
    told.length = 0;
    menu.refresh();
    expect(told).toEqual(['c']);
    expect(panel.querySelector('.menu-slot.selected')?.getAttribute('data-key')).toBe('c');
    keys = ['a', 'b']; // (gone, from the top: the one now in its place)
    menu.refresh();
    expect(panel.querySelector('.menu-slot.selected')?.getAttribute('data-key')).toBe('a');
    menu.close();
  });
});
