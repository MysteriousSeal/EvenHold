// EvenHold menus (styles in menu.css): the one layout every in-game menu
// shares. A menu has a title and tabs; a tab shows either rows (actions,
// some of them on/off toggles) or a ledger of facts. The menu owns its
// keyboard: left/right switch tabs, up/down choose, Enter or Space uses,
// number keys pick directly, Escape closes; the mouse works too. While open
// it takes every key, so none reaches the game.

import './menu.css';
// An icon: makes a canvas showing it at `size` CSS pixels (e.g. voxelIcon).
export type MenuIcon = (size: number) => HTMLCanvasElement;

export interface MenuAction {
  icon?: MenuIcon;
  title: string;
  detail?: string;
  run(): string | void; // may return a line for the status bar
  isOn?(): boolean; // present for toggles
}

export interface MenuTab {
  name: string;
  icon?: MenuIcon;
  actions?: MenuAction[];
  facts?(): Array<[string, string]>; // a ledger, refreshed when shown
}

export interface MenuOptions {
  title: string;
  tabs: MenuTab[];
  toggleKey?: string; // a key code that opens and closes this menu
  onOpenChange?(open: boolean): void;
}

export interface Menu {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createMenu(options: MenuOptions): Menu {
  const backdrop = el('div', 'menu-backdrop');
  backdrop.hidden = true;
  const menu = el('div', 'menu');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', options.title);
  const header = el('div', 'menu-header');
  header.append(el('h2', 'menu-title', options.title));
  const tabBar = el('div', 'menu-tabs');
  const body = el('div', 'menu-body');
  const list = el('div', 'menu-list');
  const status = el('p', 'menu-status');
  body.append(list, status);
  const footer = el('div', 'menu-footer');
  footer.innerHTML =
    '<span class="menu-key">←</span><span class="menu-key">→</span> tabs · <span class="menu-key">↑</span><span class="menu-key">↓</span> choose · <span class="menu-key">Enter</span> use · <span class="menu-key">Esc</span> close';
  menu.append(header, tabBar, body, footer);
  backdrop.append(menu);
  document.body.append(backdrop);

  let tabIndex = 0;
  let selected = 0;
  let rows: HTMLButtonElement[] = [];

  const tabButtons = options.tabs.map((tab, i) => {
    const button = el('button', 'menu-tab');
    if (tab.icon) button.append(tab.icon(28));
    button.append(tab.name);
    button.addEventListener('click', () => showTab(i));
    tabBar.append(button);
    return button;
  });
  if (options.tabs.length < 2) tabBar.hidden = true;

  function showTab(i: number): void {
    tabIndex = (i + options.tabs.length) % options.tabs.length;
    tabButtons.forEach((b, j) => b.classList.toggle('active', j === tabIndex));
    const tab = options.tabs[tabIndex];
    list.replaceChildren();
    if (tab.facts) {
      const ledger = el('dl', 'menu-ledger');
      for (const [label, value] of tab.facts()) {
        const fact = el('div', 'menu-fact');
        fact.append(el('dt', undefined, label), el('i'), el('dd', undefined, value));
        ledger.append(fact);
      }
      list.append(ledger);
    }
    rows = (tab.actions ?? []).map((action, j) => {
      const row = el('button', 'menu-row');
      const icon = el('span', 'menu-icon');
      if (action.icon) icon.append(action.icon(34));
      const text = el('span', 'menu-text');
      text.append(el('b', undefined, action.title));
      if (action.detail) text.append(el('small', undefined, action.detail));
      row.append(icon, text, action.isOn ? el('span', 'menu-toggle') : el('span', 'menu-key', String(j + 1)));
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
    rows[selected].scrollIntoView?.({ block: 'nearest' }); // long lists scroll to follow the keyboard
  }

  function use(i: number): void {
    const action = options.tabs[tabIndex].actions?.[i];
    if (!action) return;
    select(i);
    status.textContent = action.run() ?? '';
    refresh();
  }

  function refresh(): void {
    options.tabs[tabIndex].actions?.forEach((action, j) => rows[j]?.classList.toggle('on', action.isOn?.() ?? false));
  }

  const api: Menu = {
    get isOpen() {
      return !backdrop.hidden;
    },
    open() {
      backdrop.hidden = false;
      status.textContent = '';
      showTab(tabIndex);
      options.onOpenChange?.(true);
    },
    close() {
      backdrop.hidden = true;
      options.onOpenChange?.(false);
    },
    toggle() {
      if (api.isOpen) api.close();
      else api.open();
    },
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) api.close(); // click outside the menu
  });

  // Capture phase: while open, the menu sees every key before the game does.
  window.addEventListener(
    'keydown',
    (event) => {
      if (options.toggleKey && event.code === options.toggleKey) {
        event.stopImmediatePropagation();
        if (!event.repeat) api.toggle();
        return;
      }
      if (!api.isOpen) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.repeat && !event.code.startsWith('Arrow')) return;
      if (event.code === 'Escape') api.close();
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

  return api;
}
