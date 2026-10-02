// The pause menu, on Escape when no other window is open (or the toolbar):
// the game stands still behind it. Resume, start over, set how close the
// camera is and how tall the walls between rooms are, or look up the controls. The game saves itself (saveGame.ts).

import { createMenu, type Menu } from '../view/ui/menu';
import { stepZoom, zoomLevel } from '../view/render/zoom';
import { CONTROLS } from './controls';

// `redraw`: draws one frame, so a setting changed while paused shows at once.
// `newGame`: forgets this world's save and starts over. `mainMenu`: saves, and back to the title (main menu).
// `walls`: the inner walls option (full height, or cut low), to read and switch.
export function createPauseMenu(hooks: { setPaused(paused: boolean): void; redraw(): void; newGame(): void; mainMenu(): void; walls: { full(): boolean; toggle(): void } }): Menu {
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
          { title: 'Main menu', detail: 'This world saved, back to the title: another world, another hero', run: () => hooks.mainMenu() },
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
        facts: () => CONTROLS.map(([what, keys]) => [what, keys]),
      },
    ],
  });
  return menu;
}
