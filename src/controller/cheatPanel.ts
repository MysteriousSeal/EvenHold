// Dev-only cheat panel, toggled with the backquote key (`). main.ts loads
// this module only when Vite runs in dev mode, so production builds don't
// contain it. Buttons act on the model directly, like the keyboard does.

import type { GameModel } from '../model/GameModel';
import { nearestLakeShore, nextVillage, spawnTile, villageEntrance, type Tile } from '../model/cheats';
import type { Village } from '../model/types';

const TOGGLE_KEY = 'Backquote';
const SPEED_BOOST = 3;

export function createCheatPanel(model: GameModel): void {
  const panel = document.createElement('div');
  panel.id = 'cheat-panel';
  panel.hidden = true;
  const status = document.createElement('div');
  status.className = 'cheat-status';

  const hero = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  const goTo = (tile: Tile | null, label: string) => {
    if (!tile) {
      status.textContent = `no ${label} in this world`;
      return;
    }
    model.teleport(tile.x, tile.z);
    status.textContent = `→ ${label} (${tile.x}, ${tile.z})`;
  };

  // Repeated presses tour the villages, nearest first, without revisiting
  // any until all have been seen.
  const visited = new Set<Village>();
  const button = (label: string, action: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => {
      action();
      b.blur(); // keep Space/Enter from re-triggering it while playing
    });
    panel.append(b);
  };
  const title = document.createElement('div');
  title.className = 'cheat-title';
  title.textContent = 'Cheats  ( ` to close )';
  panel.append(title);
  button('Next nearest village', () => {
    const village = nextVillage(model, hero(), visited);
    goTo(village && villageEntrance(model, village, hero()), `village ${visited.size}/${model.villages.length}`);
  });
  button('Nearest lake', () => goTo(nearestLakeShore(model, hero()), 'lake shore'));
  button('Spawn', () => goTo(spawnTile(model), 'spawn'));

  const speed = document.createElement('label');
  const speedBox = document.createElement('input');
  speedBox.type = 'checkbox';
  speedBox.addEventListener('change', () => {
    model.speedMultiplier = speedBox.checked ? SPEED_BOOST : 1;
    speedBox.blur();
  });
  speed.append(speedBox, ` Speed ×${SPEED_BOOST}`);
  panel.append(speed, status);
  document.body.append(panel);

  window.addEventListener('keydown', (event) => {
    if (event.code !== TOGGLE_KEY || event.repeat) return;
    panel.hidden = !panel.hidden;
  });
}
