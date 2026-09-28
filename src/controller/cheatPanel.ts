// Dev-only cheat menu, toggled with the backquote key (`): a centered RPG
// panel in voxel style (styles in index.html). main.ts loads this module
// only when Vite runs in dev mode, so production builds don't contain it.
// Arrow keys move the selection and Enter picks it, like an RPG menu;
// number keys and the mouse work too; Escape closes it. Entries act on the
// model directly, like the keyboard does.

import type { GameModel } from '../model/GameModel';
import { nearestLakeShore, nextVillage, spawnTile, villageEntrance, type Tile } from '../model/cheats';
import type { Village } from '../model/types';

const TOGGLE_KEY = 'Backquote';
const SPEED_BOOST = 3;

// 8x8 pixel-art icons: one character per pixel, '.' transparent.
const ICON_COLORS: Record<string, string> = {
  r: '#9b4a32', R: '#b65c3c', w: '#e9dfc6', t: '#3a281c', d: '#5a3a22', y: '#ffd98a',
  b: '#3dbdb8', B: '#217c98', l: '#9be8da', g: '#62ad4c', f: '#8b3a2b', F: '#c4413a',
  p: '#5a3a22', s: '#7a5236', S: '#a0714a', W: '#f5f5f0', G: '#d9dde2',
};
const ICONS = {
  village: ['...rR...', '..rRRr..', '.rRRRRr.', 'rRRRRRRr', '.wwtwww.', '.wytwyw.', '.wwdtww.', '.wwdtww.'],
  lake: ['...l....', '...b....', '..lbb...', '..bbbb..', '.lbbbbB.', '.bbbbbB.', '..bbbB..', '...BB...'],
  spawn: ['.pFFFF..', '.pFFFFF.', '.pFfFFF.', '.pFFFFF.', '.pFF....', '.p......', '.p......', 'gggggggg'],
  speed: ['W.......', 'WW......', 'GWW.....', '.GW.sss.', '...ssss.', '..sssss.', '.SSSSSS.', '.dddddd.'],
};

function pixelIcon(rows: string[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', '1');
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', ICON_COLORS[c]);
      svg.append(rect);
    }),
  );
  return svg;
}

interface Entry {
  title: string;
  detail: string;
  icon: string[];
  run: (row: HTMLButtonElement) => void;
}

export function createCheatPanel(model: GameModel): void {
  const backdrop = document.createElement('div');
  backdrop.id = 'cheat-backdrop';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.id = 'cheat-panel';
  const title = document.createElement('h2');
  title.textContent = 'Cheats';
  const status = document.createElement('div');
  status.className = 'cheat-status';
  const hint = document.createElement('div');
  hint.className = 'cheat-hint';
  hint.innerHTML = '<kbd>↑</kbd><kbd>↓</kbd> choose · <kbd>Enter</kbd> use · <kbd>Esc</kbd> close';
  for (const [x, y] of [
    ['6px', '6px'],
    ['calc(100% - 14px)', '6px'],
    ['6px', 'calc(100% - 14px)'],
    ['calc(100% - 14px)', 'calc(100% - 14px)'],
  ]) {
    const rivet = document.createElement('i');
    rivet.className = 'cheat-rivet';
    rivet.style.left = x;
    rivet.style.top = y;
    panel.append(rivet);
  }
  const gem = document.createElement('i');
  gem.className = 'cheat-gem';

  const hero = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  const goTo = (tile: Tile | null, label: string) => {
    if (!tile) {
      status.textContent = `No ${label} in this world.`;
      return;
    }
    model.teleport(tile.x, tile.z);
    status.textContent = `Travelled to ${label}.`;
  };

  // Repeated picks tour the villages, nearest first, without revisiting any
  // until all have been seen.
  const visited = new Set<Village>();
  const entries: Entry[] = [
    {
      title: 'Next village',
      detail: 'Journey to the nearest village not yet visited',
      icon: ICONS.village,
      run: () => {
        const village = nextVillage(model, hero(), visited);
        goTo(village && villageEntrance(model, village, hero()), `village ${visited.size} of ${model.villages.length}`);
      },
    },
    { title: 'Nearest lake', detail: 'Stand on the closest shore', icon: ICONS.lake, run: () => goTo(nearestLakeShore(model, hero()), 'the lake shore') },
    { title: 'Back to spawn', detail: 'Return to where your journey began', icon: ICONS.spawn, run: () => goTo(spawnTile(model), 'spawn') },
    {
      title: 'Swift feet',
      detail: `Walk ${SPEED_BOOST}× faster (toggle)`,
      icon: ICONS.speed,
      run: (row) => {
        model.speedMultiplier = model.speedMultiplier === 1 ? SPEED_BOOST : 1;
        row.classList.toggle('on', model.speedMultiplier !== 1);
        status.textContent = model.speedMultiplier === 1 ? 'Back to a normal pace.' : 'Swift as the wind!';
      },
    },
  ];

  let selected = 0;
  const rows = entries.map((entry, i) => {
    const row = document.createElement('button');
    row.className = 'cheat-row';
    const icon = document.createElement('span');
    icon.className = 'cheat-icon';
    icon.append(pixelIcon(entry.icon));
    const text = document.createElement('span');
    text.className = 'cheat-text';
    const b = document.createElement('b');
    b.textContent = entry.title;
    const small = document.createElement('small');
    small.textContent = entry.detail;
    text.append(b, small);
    const key = document.createElement('kbd');
    key.textContent = String(i + 1);
    row.append(icon, text, key);
    row.addEventListener('mouseenter', () => select(i));
    row.addEventListener('click', () => {
      entry.run(row);
      row.blur(); // keep Space from re-clicking it while playing
    });
    return row;
  });
  const select = (i: number) => {
    selected = (i + rows.length) % rows.length;
    rows.forEach((row, j) => row.classList.toggle('selected', j === selected));
  };
  select(0);

  panel.append(title, ...rows, status, hint, gem);
  backdrop.append(panel);
  document.body.append(backdrop);
  const close = () => (backdrop.hidden = true);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close(); // click outside the panel
  });

  // Listens in the capture phase so that, while the menu is open, it sees
  // keys before the game does and keeps them from moving the hero.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.code === TOGGLE_KEY) {
        if (!event.repeat) {
          backdrop.hidden = !backdrop.hidden;
          status.textContent = '';
        }
        return;
      }
      if (backdrop.hidden) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (!event.repeat) handleKey(event);
    },
    true,
  );

  function handleKey(event: KeyboardEvent): void {
    if (event.code === 'Escape') close();
    else if (event.code === 'ArrowDown') select(selected + 1);
    else if (event.code === 'ArrowUp') select(selected - 1);
    else if (event.code === 'Enter') entries[selected].run(rows[selected]);
    else {
      const pick = Number(event.key) - 1;
      if (pick >= 0 && pick < entries.length) {
        select(pick);
        entries[pick].run(rows[pick]);
      }
    }
  }
}
