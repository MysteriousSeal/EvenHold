// The pause menu, on Escape when no other window is open (or the toolbar):
// the game stands still behind it. Resume, start over, set how close the
// camera is and how tall the walls between rooms are, or look up the controls. The game saves itself (saveGame.ts).

import { createMenu, type Menu } from '../view/ui/menu';
import { stepZoom, zoomLevel } from '../view/render/zoom';

// `redraw`: draws one frame, so a setting changed while paused shows at once.
// `newGame`: forgets this world's save and starts over.
// `walls`: the inner walls option (full height, or cut low), to read and switch.
export function createPauseMenu(hooks: { setPaused(paused: boolean): void; redraw(): void; newGame(): void; walls: { full(): boolean; toggle(): void } }): Menu {
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
          {
            title: 'Inner walls',
            detail: 'Walls between rooms indoors: cut low to see over, or full height',
            current: () => ({ value: hooks.walls.full() ? 'Full' : 'Low' }),
            run: () => {
              hooks.walls.toggle();
              hooks.redraw();
              return `Inner walls: ${hooks.walls.full() ? 'full height' : 'low'}.`;
            },
          },
        ],
      },
      {
        name: 'Controls',
        facts: () => [
          ['Move', 'W A S D, or the arrows'],
          ['Strike', 'Space'],
          ['Roll (untouchable a moment)', 'Shift'],
          ['Guard (raise it as a blow lands: parry)', 'Hold Q'],
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
