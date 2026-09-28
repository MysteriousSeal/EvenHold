// The pause menu, on Escape when no other window is open (or the toolbar):
// the game stands still behind it. Resume, start over, set how close the
// camera is, or look up the controls. The game saves itself (saveGame.ts).

import { createMenu, type Menu } from '../view/ui/menu';
import { stepZoom, zoomLevel } from '../view/render/zoom';

// `redraw`: draws one frame, so a setting changed while paused shows at once.
// `newGame`: forgets this world's save and starts over.
export function createPauseMenu(hooks: { setPaused(paused: boolean): void; redraw(): void; newGame(): void }): Menu {
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
          { title: 'New game', detail: "Forget this world's save and start over, a new hero", run: () => hooks.newGame() },
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
