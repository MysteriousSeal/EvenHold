// Dev-only cheat menu, toggled with the backquote key (`): a storybook-style
// pause menu (styles in cheatPanel.css) with tabs by category. The game
// pauses behind it. main.ts loads this module only when Vite runs in dev
// mode, so production builds don't contain it.
//
// Keys: left/right switch tabs, up/down choose, Enter uses, number keys
// pick directly, Escape closes. The mouse works too. While open, the menu
// takes every key so none reaches the game.

import './cheatPanel.css';
import type { GameModel } from '../model/GameModel';
import {
  nearestCamp,
  nearestLakeShore,
  nearestPack,
  nextVillage,
  slayNearby,
  spawnEnemyNear,
  spawnTile,
  villageEntrance,
  type Tile,
} from '../model/cheats';
import type { Village } from '../model/types';

const TOGGLE_KEY = 'Backquote';
const SPEED_BOOST = 3;
const NEARBY = 15; // tiles, for "nearby enemies"

interface Action {
  title: string;
  detail: string;
  run(): string; // what happened, for the status line
  isOn?(): boolean; // present for switches
}
interface Tab {
  name: string;
  actions: Action[];
  chronicle?: boolean; // shows the live world readout instead of actions
}

export interface CheatPanelHooks {
  setPaused(paused: boolean): void;
}

export function createCheatPanel(model: GameModel, hooks: CheatPanelHooks): void {
  const here = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  const travel = (tile: Tile | null, where: string) => {
    if (!tile) return `There is no ${where} in this world.`;
    model.teleport(tile.x, tile.z);
    return `You travel to ${where}.`;
  };
  const visited = new Set<Village>(); // the village tour: nearest first, no repeats
  const toggle = (get: () => boolean, set: (on: boolean) => void, on: string, off: string): Pick<Action, 'run' | 'isOn'> => ({
    isOn: get,
    run: () => {
      set(!get());
      return get() ? on : off;
    },
  });

  const tabs: Tab[] = [
    {
      name: 'Travel',
      actions: [
        {
          title: 'Next village',
          detail: 'The nearest village not yet visited',
          run: () => {
            const village = nextVillage(model, here(), visited);
            return travel(village && villageEntrance(model, village, here()), `village ${visited.size} of ${model.villages.length}`);
          },
        },
        { title: 'Nearest lake', detail: 'Stand on the closest shore', run: () => travel(nearestLakeShore(model, here()), 'the lake shore') },
        { title: 'Bandit camp', detail: 'Outside the nearest camp’s gate', run: () => travel(nearestCamp(model, here()), 'a bandit camp') },
        { title: 'Wolf pack', detail: 'A few paces from the nearest wolves', run: () => travel(nearestPack(model, here()), 'a wolf pack') },
        { title: 'Back to spawn', detail: 'Where the journey began', run: () => travel(spawnTile(model), 'where you began') },
      ],
    },
    {
      name: 'Hero',
      actions: [
        {
          title: 'Swift feet',
          detail: `Walk ${SPEED_BOOST}× faster`,
          ...toggle(() => model.speedMultiplier !== 1, (on) => (model.speedMultiplier = on ? SPEED_BOOST : 1), 'Swift as the wind!', 'Back to a steady pace.'),
        },
        { title: 'Wander freely', detail: 'Walk through walls, water and foes', ...toggle(() => model.noclip, (on) => (model.noclip = on), 'Nothing stands in your way.', 'The world is solid again.') },
        { title: 'Invulnerable', detail: 'Ready for when foes can hurt you', ...toggle(() => model.godMode, (on) => (model.godMode = on), 'You feel untouchable.', 'Mortal once more.') },
      ],
    },
    {
      name: 'Enemies',
      actions: [
        { title: 'Summon a wolf', detail: 'Appears just ahead of you', run: () => (spawnEnemyNear(model, 'wolf'), 'A wolf howls nearby.') },
        { title: 'Summon a bandit', detail: 'Appears just ahead of you', run: () => (spawnEnemyNear(model, 'bandit'), 'A bandit steps out of hiding.') },
        { title: 'Slay nearby foes', detail: `Every enemy within ${NEARBY} tiles`, run: () => `${slayNearby(model, NEARBY)} foes fall.` },
        { title: 'Freeze foes', detail: 'Enemies stand still', ...toggle(() => model.enemiesFrozen, (on) => (model.enemiesFrozen = on), 'Time stands still for your foes.', 'Your foes stir again.') },
      ],
    },
    { name: 'World', actions: [], chronicle: true },
  ];

  // --- Markup ---
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const backdrop = el('div');
  backdrop.id = 'cheat-backdrop';
  backdrop.hidden = true;
  const panel = el('div');
  panel.id = 'cheat-panel';
  const corner = '<svg viewBox="0 0 22 22"><path d="M1 21V9a8 8 0 0 1 8-8h12" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 21v-9a7 7 0 0 1 7-7h9" fill="none" stroke="currentColor" stroke-width="0.8"/><circle cx="4" cy="4" r="1.6" fill="currentColor"/></svg>';
  (['0 auto auto 0', '0 0 auto auto', 'auto auto 0 0', 'auto 0 0 auto'] as const).forEach((inset, i) => {
    const c = el('span', 'cheat-corner');
    c.innerHTML = corner;
    const [top, right, bottom, left] = inset.split(' ');
    Object.assign(c.style, { top: top === 'auto' ? '' : '6px', right: right === 'auto' ? '' : '6px', bottom: bottom === 'auto' ? '' : '6px', left: left === 'auto' ? '' : '6px' });
    c.style.transform = ['', 'scaleX(-1)', 'scaleY(-1)', 'scale(-1)'][i];
    panel.append(c);
  });
  const tabBar = el('div', 'cheat-tabs');
  const list = el('div', 'cheat-list');
  const status = el('div', 'cheat-status');
  const hint = el('div', 'cheat-hint');
  hint.innerHTML =
    '<span class="cheat-key">←</span><span class="cheat-key">→</span> tabs · <span class="cheat-key">↑</span><span class="cheat-key">↓</span> choose · <span class="cheat-key">Enter</span> use · <span class="cheat-key">Esc</span> close';
  panel.append(el('h2', 'cheat-title', 'Cheats'), el('p', 'cheat-subtitle', 'The world holds its breath'), tabBar, list, status, hint);
  backdrop.append(panel);
  document.body.append(backdrop);

  const tabButtons = tabs.map((tab, i) => {
    const button = el('button', 'cheat-tab', tab.name);
    button.addEventListener('click', () => showTab(i));
    tabBar.append(button);
    return button;
  });

  // --- State ---
  let tabIndex = 0;
  let selected = 0;
  let rows: HTMLButtonElement[] = [];
  let chronicle: HTMLElement | null = null;

  function showTab(i: number): void {
    tabIndex = (i + tabs.length) % tabs.length;
    tabButtons.forEach((b, j) => b.classList.toggle('active', j === tabIndex));
    list.replaceChildren();
    const tab = tabs[tabIndex];
    chronicle = tab.chronicle ? el('dl', 'cheat-chronicle') : null;
    if (chronicle) list.append(chronicle);
    rows = tab.actions.map((action, j) => {
      const row = el('button', 'cheat-row');
      const text = el('span', 'cheat-text');
      text.append(el('b', undefined, action.title), el('small', undefined, action.detail));
      row.append(text, action.isOn ? el('span', 'cheat-switch') : el('span', 'cheat-key', String(j + 1)));
      row.addEventListener('mouseenter', () => select(j));
      row.addEventListener('click', () => use(j));
      list.append(row);
      return row;
    });
    select(0);
    refresh();
  }

  function select(i: number): void {
    if (rows.length === 0) return;
    selected = (i + rows.length) % rows.length;
    rows.forEach((row, j) => row.classList.toggle('selected', j === selected));
  }

  function use(i: number): void {
    const action = tabs[tabIndex].actions[i];
    if (!action) return;
    select(i);
    status.textContent = action.run();
    refresh();
  }

  // Switch states and the live chronicle.
  function refresh(): void {
    tabs[tabIndex].actions.forEach((action, j) => rows[j]?.classList.toggle('on', action.isOn?.() ?? false));
    if (!chronicle) return;
    const { hero } = model;
    const tx = Math.round(hero.x);
    const tz = Math.round(hero.z);
    const near = model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) <= NEARBY);
    const village = model.villages.reduce<Village | null>((best, v) => (!best || Math.hypot(v.x - tx, v.z - tz) < Math.hypot(best.x - tx, best.z - tz) ? v : best), null);
    const facts: Array<[string, string]> = [
      ['Seed', String(model.seed)],
      ['Position', `${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}`],
      ['Ground', `tier ${model.heightMap[tx]?.[tz] ?? '?'} · ${model.lakeMap[tx]?.[tz] ? 'water' : (model.surfaceMap[tx]?.[tz] ?? '?')}`],
      ['Foes near', `${near.filter((e) => e.kind === 'wolf').length} wolves, ${near.filter((e) => e.kind === 'bandit').length} bandits`],
      ['Village', village ? `${Math.round(Math.hypot(village.x - tx, village.z - tz))} tiles away` : 'none'],
      ['World', `${model.size.width}×${model.size.depth} · ${model.villages.length} villages · ${model.camps.length} camps`],
    ];
    chronicle.replaceChildren(...facts.flatMap(([k, v]) => [el('dt', undefined, k), el('dd', undefined, v)]));
  }

  function open(isOpen: boolean): void {
    backdrop.hidden = !isOpen;
    hooks.setPaused(isOpen);
    if (isOpen) {
      status.textContent = '';
      showTab(tabIndex);
    }
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) open(false); // click outside the page
  });

  // Capture phase: while open, the menu sees every key before the game does
  // and keeps it from moving the hero.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.code === TOGGLE_KEY) {
        if (!event.repeat) open(backdrop.hidden);
        return;
      }
      if (backdrop.hidden) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.repeat && !event.code.startsWith('Arrow')) return;
      if (event.code === 'Escape') open(false);
      else if (event.code === 'ArrowRight') showTab(tabIndex + 1);
      else if (event.code === 'ArrowLeft') showTab(tabIndex - 1);
      else if (event.code === 'ArrowDown') select(selected + 1);
      else if (event.code === 'ArrowUp') select(selected - 1);
      else if (event.code === 'Enter' || event.code === 'Space') use(selected);
      else {
        const pick = Number(event.key) - 1;
        if (pick >= 0 && pick < rows.length) use(pick);
      }
    },
    true,
  );
}
