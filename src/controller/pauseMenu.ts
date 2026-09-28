// The pause menu, on Escape when no other window is open (or the toolbar):
// the game stands still behind it. Resume, or look up the controls.

import { createMenu, type Menu } from '../view/ui/menu';

export function createPauseMenu(hooks: { setPaused(paused: boolean): void }): Menu {
  const menu: Menu = createMenu({
    title: 'Paused',
    toggleKey: 'Escape',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Game',
        actions: [{ title: 'Resume', detail: 'Back to the adventure', run: () => menu.close() }],
      },
      {
        name: 'Controls',
        facts: () => [
          ['Move', 'W A S D, or the arrows'],
          ['Strike', 'Space'],
          ['Pick up', 'E'],
          ['Focus a foe', 'Click it'],
          ['Hero sheet', 'C'],
          ['Bag', 'B'],
          ['Pause', 'Escape'],
        ],
      },
    ],
  });
  return menu;
}
