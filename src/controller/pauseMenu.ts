// The pause menu, on Escape when no other window is open (or the toolbar):
// the game stands still behind it. Resume, set how close the camera is, or
// look up the controls.

import { createMenu, type Menu } from '../view/ui/menu';
import { stepZoom, zoomLevel } from '../view/render/zoom';

// `redraw`: draws one frame, so a setting changed while paused shows at once.
export function createPauseMenu(hooks: { setPaused(paused: boolean): void; redraw(): void }): Menu {
  const menu: Menu = createMenu({
    title: 'Paused',
    toggleKey: 'Escape',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Game',
        actions: [
          { title: 'Resume', detail: 'Back to the adventure', run: () => menu.close() },
          {
            title: 'Zoom',
            detail: 'How close the camera is outdoors (or scroll in game)',
            current: () => ({ value: zoomLevel().name }),
            run: () => {
              stepZoom(1, true); // closer, round to the farthest after the closest
              hooks.redraw();
              return `Zoom: ${zoomLevel().name}.`;
            },
          },
        ],
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
          ['Zoom', 'Mouse wheel'],
          ['Pause', 'Escape'],
        ],
      },
    ],
  });
  return menu;
}
