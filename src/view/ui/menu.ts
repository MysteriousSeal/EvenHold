// EvenHold menus (styles in menu.css): the one layout every in-game menu
// shares. A menu has a title and tabs; a tab shows rows (actions, some of
// them on/off toggles), a ledger of facts, a grid of slots (a bag), or a
// paper doll (a figure with its slots around it). The menu owns its
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
  // For rows showing a setting (e.g. what's worn in a slot): its current
  // detail, icon and value (shown at the right), refreshed after every use.
  current?(): { detail?: string; icon?: MenuIcon; value?: string };
}

// One square of a grid of slots (an inventory, a shop): its icon, how many,
// and what its tooltip says (shown beside it on hover or when selected).
export interface MenuSlot {
  icon: MenuIcon;
  count?: number;
  title: string;
  tone?: string; // colors the title (e.g. an item quality: 'junk')
  lines?: string[];
  // If given, the slot can be dragged out of the menu; let go outside it,
  // this runs with what's under the pointer (another menu, or the world).
  dragOut?(over: Element | null): void;
}

// A slot around a paper doll: its name (shown while empty) and what's in it.
export interface DollSlot {
  label: string;
  slot: MenuSlot | null;
}

export interface MenuTab {
  name: string;
  icon?: MenuIcon;
  actions?: MenuAction[];
  facts?(): Array<[string, string]>; // a ledger, refreshed when shown
  // A grid of slots (null: an empty one), refreshed when shown; the
  // arrow keys move around it.
  slots?(): { cells: Array<MenuSlot | null>; columns: number };
  // A figure with slots down its left and right and along the bottom (a
  // character sheet), shown above any facts.
  doll?(): { figure: HTMLElement; left: DollSlot[]; right: DollSlot[]; bottom: DollSlot[] };
}

export interface MenuOptions {
  title: string;
  tabs: MenuTab[];
  toggleKey?: string; // a key code that opens and closes this menu
  keyHints?: boolean; // the line of key hints along the bottom (default: shown)
  // Modal (the default): the world dims, clicks outside close the menu, and
  // it takes every key. Modeless (false): the world stays clear and playable
  // around it, and only Escape and its toggle key reach the menu.
  modal?: boolean;
  place?: 'center' | 'left' | 'bottom-right'; // where a modeless menu sits (default: bottom right)
  onOpenChange?(open: boolean): void;
}

export interface Menu {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
  // Redraws the open tab (after what it shows has changed), keeping the
  // tooltip of the slot under the pointer.
  refresh(): void;
}

// The close button's X: two thick strokes with square ends and a soft drop
// shadow, drawn smooth on a canvas (crisp at any screen density) in `color`.
function closeCross(size: number, color: string, shadow: string): HTMLCanvasElement {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * ratio);
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const s = canvas.width;
  const inset = s * 0.24;
  const draw = (offset: number, stroke: string) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s * 0.17;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(inset, inset + offset);
    ctx.lineTo(s - inset, s - inset + offset);
    ctx.moveTo(s - inset, inset + offset);
    ctx.lineTo(inset, s - inset + offset);
    ctx.stroke();
  };
  draw(s * 0.06, shadow);
  draw(0, color);
  return canvas;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createMenu(options: MenuOptions): Menu {
  const modal = options.modal !== false;
  const backdrop = el('div', modal ? 'menu-backdrop' : `menu-backdrop modeless place-${options.place ?? 'bottom-right'}`);
  backdrop.hidden = true;
  const menu = el('div', 'menu');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', options.title);
  const header = el('div', 'menu-header');
  header.append(el('h2', 'menu-title', options.title));
  const closeButton = el('button', 'menu-close');
  closeButton.setAttribute('aria-label', 'Close');
  // Two drawings of the X: at rest, and lit on hover (CSS shows one).
  closeButton.append(closeCross(24, '#a4502f', 'rgba(46, 31, 20, 0.25)'), closeCross(24, '#7a3520', 'rgba(46, 31, 20, 0.3)'));
  header.append(closeButton);
  const tabBar = el('div', 'menu-tabs');
  const body = el('div', 'menu-body');
  const list = el('div', 'menu-list');
  const status = el('p', 'menu-status');
  body.append(list, status);
  const footer = el('div', 'menu-footer');
  footer.innerHTML =
    '<span class="menu-key">←</span><span class="menu-key">→</span> tabs · <span class="menu-key">↑</span><span class="menu-key">↓</span> choose · <span class="menu-key">Enter</span> use · <span class="menu-key">Esc</span> close';
  menu.append(header, tabBar, body);
  if (options.keyHints !== false) menu.append(footer);
  backdrop.append(menu);
  document.body.append(backdrop);

  let tabIndex = 0;
  let selected = 0;
  let rows: HTMLButtonElement[] = [];
  let grid: { buttons: HTMLButtonElement[]; cells: Array<MenuSlot | null>; columns: number; selected: number } | null = null;
  // A slot's tooltip, beside it (outside the panel, so nothing clips it).
  const tooltip = el('div', 'menu-tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  // Every slot button drawn (grid or doll), in order, so a redraw can show
  // the tooltip again on the one that had it.
  let slotButtons: Array<{ button: HTMLButtonElement; cell: MenuSlot | null }> = [];
  let tipped: number | null = null;

  function showTip(index: number): void {
    const entry = slotButtons[index];
    tipped = entry?.cell ? index : null;
    tooltip.hidden = tipped === null;
    if (!entry?.cell) return;
    const { cell, button } = entry;
    const title = el('b', undefined, cell.title);
    if (cell.tone) title.dataset.tone = cell.tone;
    tooltip.replaceChildren(title, ...(cell.lines ?? []).map((line) => el('small', undefined, line)));
    const slot = button.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const left = slot.right + 8 + width <= window.innerWidth ? slot.right + 8 : slot.left - 8 - width;
    tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(slot.top)}px)`;
  }

  function hideTip(): void {
    tipped = null;
    tooltip.hidden = true;
  }

  // A slot button: its icon and count, its tooltip on hover, and dragging if the slot allows it.
  function slotButton(cell: MenuSlot | null, iconSize: number, onHover: () => void): HTMLButtonElement {
    const button = el('button', cell ? 'menu-slot' : 'menu-slot empty');
    if (cell) {
      button.append(cell.icon(iconSize));
      if (cell.count && cell.count > 1) button.append(el('span', 'menu-slot-count', String(cell.count)));
    }
    button.addEventListener('mouseenter', onHover);
    if (cell?.dragOut) {
      button.classList.add('draggable');
      button.addEventListener('pointerdown', (event) => startDrag(event, cell));
    }
    slotButtons.push({ button, cell });
    return button;
  }

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
    slotButtons = [];
    if (tab.doll) showDoll(tab.doll());
    if (tab.facts) {
      const ledger = el('dl', 'menu-ledger');
      for (const [label, value] of tab.facts()) {
        const fact = el('div', 'menu-fact');
        fact.append(el('dt', undefined, label), el('i'), el('dd', undefined, value));
        ledger.append(fact);
      }
      list.append(ledger);
    }
    grid = null;
    list.classList.toggle('grid', !!tab.slots || !!tab.doll);
    body.classList.toggle('grid', !!tab.slots || !!tab.doll);
    if (tab.slots) showSlots(tab.slots());
    rows = (tab.actions ?? []).map((action, j) => {
      const row = el('button', 'menu-row');
      const icon = el('span', 'menu-icon');
      if (action.icon) icon.append(action.icon(34));
      const text = el('span', 'menu-text');
      text.append(el('b', undefined, action.title));
      if (action.detail || action.current) text.append(el('small', undefined, action.detail));
      const end = action.isOn ? el('span', 'menu-toggle') : action.current ? el('span', 'menu-value') : el('span', 'menu-key', String(j + 1));
      row.append(icon, text, end);
      row.addEventListener('mouseenter', () => select(j));
      row.addEventListener('click', () => use(j));
      list.append(row);
      return row;
    });
    select(0);
    refresh();
  }

  function showSlots({ cells, columns }: { cells: Array<MenuSlot | null>; columns: number }): void {
    const box = el('div', 'menu-grid');
    box.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    const buttons = cells.map((cell, i) => {
      const button = slotButton(cell, 44, () => selectSlot(i));
      box.append(button);
      return button;
    });
    box.addEventListener('mouseleave', hideTip);
    list.append(box);
    grid = { buttons, cells, columns, selected: 0 };
    selectSlot(0, false);
  }

  // The paper doll: the figure in the middle, slots down each side and
  // along the bottom; empty ones show their name.
  function showDoll({ figure, left, right, bottom }: { figure: HTMLElement; left: DollSlot[]; right: DollSlot[]; bottom: DollSlot[] }): void {
    const doll = el('div', 'menu-doll');
    const column = (slots: DollSlot[], className: string) => {
      const box = el('div', className);
      for (const { label, slot } of slots) {
        const index = slotButtons.length;
        const button = slotButton(slot, 40, () => showTip(index));
        button.addEventListener('mouseleave', hideTip);
        if (!slot) button.append(el('span', 'menu-slot-label', label));
        box.append(button);
      }
      return box;
    };
    const stage = el('div', 'menu-doll-figure');
    stage.append(figure);
    doll.append(column(left, 'menu-doll-side'), stage, column(right, 'menu-doll-side'), column(bottom, 'menu-doll-bottom'));
    list.append(doll);
  }

  // Dragging a slot: its icon follows the pointer; let go outside the menu
  // and the slot's dragOut runs (the grid is then redrawn), let go inside
  // and nothing happens.
  let justDropped = false;
  function startDrag(event: PointerEvent, cell: MenuSlot): void {
    if (event.button !== 0) return;
    event.preventDefault();
    hideTip();
    // The whole slot comes along under the pointer: its tile, icon and count.
    const ghost = el('div', 'menu-slot menu-drag');
    ghost.append(cell.icon(44));
    if (cell.count && cell.count > 1) ghost.append(el('span', 'menu-slot-count', String(cell.count)));
    const follow = (e: PointerEvent) => (ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`);
    follow(event);
    backdrop.append(ghost); // inside the menu's layer, so it wears the menu's colors
    const move = (e: PointerEvent) => follow(e);
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      const panel = menu.getBoundingClientRect();
      const outside = e.clientX < panel.left || e.clientX > panel.right || e.clientY < panel.top || e.clientY > panel.bottom;
      if (!outside || !cell.dragOut) return;
      justDropped = true; // the release's click on the backdrop mustn't close the menu
      cell.dragOut(document.elementFromPoint(e.clientX, e.clientY));
      const keep = grid?.selected ?? 0;
      showTab(tabIndex);
      selectSlot(keep, false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Selects a slot and, unless `tip` is false, shows its tooltip beside it:
  // to the right, or the left when there's no room.
  function selectSlot(i: number, tip = true): void {
    if (!grid) return;
    grid.selected = Math.max(0, Math.min(grid.buttons.length - 1, i));
    grid.buttons.forEach((b, j) => b.classList.toggle('selected', j === grid!.selected));
    if (!tip) {
      hideTip();
      return;
    }
    showTip(slotButtons.findIndex((entry) => entry.button === grid!.buttons[grid!.selected]));
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
    options.tabs[tabIndex].actions?.forEach((action, j) => {
      const row = rows[j];
      if (!row) return;
      row.classList.toggle('on', action.isOn?.() ?? false);
      const live = action.current?.();
      if (!live) return;
      const icon = live.icon ?? action.icon;
      row.querySelector('.menu-icon')?.replaceChildren(...(icon ? [icon(34)] : []));
      row.querySelector('.menu-text small')!.textContent = live.detail ?? action.detail ?? '';
      row.querySelector('.menu-value')!.textContent = live.value ?? '';
    });
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
      hideTip();
      options.onOpenChange?.(false);
    },
    toggle() {
      if (api.isOpen) api.close();
      else api.open();
    },
    refresh() {
      if (!api.isOpen) return;
      const tip = tipped;
      const keep = grid?.selected ?? 0;
      showTab(tabIndex);
      if (grid) selectSlot(keep, false);
      if (tip !== null) showTip(tip);
    },
  };

  closeButton.addEventListener('click', () => api.close());

  backdrop.addEventListener('click', (e) => {
    if (justDropped) {
      justDropped = false;
      return;
    }
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
      if (!modal && event.code !== 'Escape') return; // the game keeps its keys
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.repeat && !event.code.startsWith('Arrow')) return;
      if (event.code === 'Escape') api.close();
      else if (grid && event.code.startsWith('Arrow')) {
        const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: grid.columns, ArrowUp: -grid.columns }[event.code] ?? 0;
        selectSlot(grid.selected + step);
      } else if (event.code === 'ArrowRight') showTab(tabIndex + 1);
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
