// EvenHold menus (styles in menu.css): the one layout every in-game menu
// shares. A menu has a title and tabs; a tab shows rows (actions, some of
// them on/off toggles), a ledger of facts, a grid of slots (a bag), or a
// paper doll (a figure with its slots around it). The menu owns its
// keyboard: left/right switch tabs, up/down choose, Enter or Space uses,
// number keys pick directly, Escape closes; the mouse works too. While open
// it takes every key, so none reaches the game.

import './menu.css';
import { closeCross } from './closeCross';
import { dragSlot } from './slotDrag';
import type { DollSlot, Menu, MenuOptions, MenuSlot, MenuSlots } from './menuTypes';
export type { DollSlot, Menu, MenuAction, MenuIcon, MenuOptions, MenuSlot, MenuSlots, MenuTab } from './menuTypes';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Menus open right now, most recent last.
const openMenus: Menu[] = [];

export function anyMenuOpen(): boolean {
  return openMenus.length > 0;
}

export function createMenu(options: MenuOptions): Menu {
  const modal = options.modal !== false;
  const backdrop = el('div', modal ? 'menu-backdrop' : `menu-backdrop modeless place-${options.place ?? 'bottom-right'}`);
  backdrop.hidden = true;
  const menu = el('div', 'menu');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', options.title);
  const header = el('div', 'menu-header');
  const titleText = el('h2', 'menu-title', options.title);
  header.append(titleText);
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
  let slotButtons: Array<{ button: HTMLButtonElement; cell: MenuSlot | null; tip?: { title: string; lines: string[] } }> = [];
  let tipped: number | null = null;

  function showTip(index: number): void {
    const entry = slotButtons[index];
    const cell = entry?.cell ?? entry?.tip; // an empty slot may still say what it's for
    tipped = cell ? index : null;
    tooltip.hidden = tipped === null;
    if (!cell) return;
    const { button } = entry;
    const title = el('b', undefined, cell.title);
    if ('tone' in cell && cell.tone) title.dataset.tone = cell.tone;
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
  function slotButton(cell: MenuSlot | null, iconSize: number, onHover: () => void, row = false): HTMLButtonElement {
    const button = el('button', cell ? (cell.dim ? 'menu-slot dim' : 'menu-slot') : 'menu-slot empty');
    if (cell) {
      button.append(cell.icon(iconSize));
      if (row && cell.check) {
        const { on, label, locked, toggle } = cell.check;
        const box = el('span', `menu-slot-check${on ? ' on' : ''}${locked ? ' locked' : ''}`);
        box.setAttribute('role', 'checkbox');
        box.setAttribute('aria-checked', String(on));
        box.title = label;
        box.addEventListener('click', (event) => {
          event.stopPropagation(); // just the box: the row isn't chosen for it
          toggle();
          api.refresh();
        });
        button.prepend(box);
      }
      if (row) {
        const text = el('span', 'menu-slot-text');
        text.append(el('b', 'menu-slot-title', cell.title));
        if (cell.note) text.append(el('span', 'menu-slot-note', cell.note));
        button.append(text);
      }
      if (cell.count && cell.count > 1) button.append(el('span', 'menu-slot-count', String(cell.count)));
      if (cell.badge) button.append(el('span', cell.badgeTone ? `menu-slot-badge pill ${cell.badgeTone}` : 'menu-slot-badge', cell.badge));
      if (cell.tag) {
        const tag = el('span', 'menu-slot-tag');
        tag.append(...cell.tag);
        button.append(tag);
      }
    }
    button.addEventListener('mouseenter', onHover);
    const act = (action: (() => string | void) | undefined) => {
      if (!action) return;
      status.textContent = action() ?? '';
      api.refresh();
    };
    if (cell?.use) button.addEventListener('click', () => act(cell.use));
    if (cell?.alt) {
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        act(cell.alt);
      });
    }
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
    if (tab.header) list.append(tab.header());
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
    if (tab.footer) list.append(tab.footer());
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

  let detailPane: HTMLElement | null = null; // beside a grid whose tab has `detail`

  function showSlots({ cells, columns, rows, sections = [] }: MenuSlots): void {
    const box = el('div', rows ? 'menu-grid rows' : 'menu-grid');
    box.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    const detail = options.tabs[tabIndex].detail;
    const buttons = cells.map((cell, i) => {
      const button = slotButton(cell, rows ? 40 : 44, detail ? () => {} : () => selectSlot(i), rows);
      if (detail) button.addEventListener('click', () => selectSlot(i, false));
      for (const section of sections) if (section.from === i) box.append(el('div', 'menu-section', section.title));
      box.append(button);
      return button;
    });
    box.addEventListener('mouseleave', hideTip);
    if (detail) {
      // The grid on the left, the chosen slot told of on the right.
      detailPane = el('div', 'menu-detail');
      const split = el('div', 'menu-split');
      split.append(box, detailPane);
      list.append(split);
    } else {
      detailPane = null;
      list.append(box);
    }
    grid = { buttons, cells, columns, selected: 0 };
    selectSlot(0, false);
  }

  // The paper doll: the figure in the middle, slots down each side and
  // along the bottom; empty ones show their name.
  function showDoll({ figure, left, right, bottom }: { figure: HTMLElement; left: DollSlot[]; right: DollSlot[]; bottom: DollSlot[] }): void {
    const doll = el('div', 'menu-doll');
    const column = (slots: DollSlot[], className: string) => {
      const box = el('div', className);
      for (const { label, slot, placeholder, accepts } of slots) {
        const index = slotButtons.length;
        const button = slotButton(slot, 40, () => showTip(index));
        if (accepts) button.dataset.accepts = accepts;
        button.addEventListener('mouseleave', hideTip);
        if (!slot) {
          if (placeholder) button.append(placeholder(40));
          slotButtons[index].tip = { title: label, lines: ['Empty'] };
        }
        box.append(button);
      }
      return box;
    };
    const stage = el('div', 'menu-doll-figure');
    stage.append(figure);
    doll.append(column(left, 'menu-doll-side'), stage, column(right, 'menu-doll-side'), column(bottom, 'menu-doll-bottom'));
    list.append(doll);
  }

  // Dragging a slot (slotDrag.ts): let go outside the menu and its dragOut
  // runs; onto another slot of its grid, its move; either way the grid is
  // redrawn. Let go anywhere else in the menu and nothing happens.
  let justDropped = false;
  function startDrag(event: PointerEvent, cell: MenuSlot): void {
    if (event.button !== 0) return;
    event.preventDefault();
    hideTip();
    dragSlot(event, cell, (e) => {
      const panel = menu.getBoundingClientRect();
      const outside = e.clientX < panel.left || e.clientX > panel.right || e.clientY < panel.top || e.clientY > panel.bottom;
      // Onto another slot of the same grid: moved there (if it can be).
      const onto = grid?.buttons.indexOf(document.elementFromPoint(e.clientX, e.clientY)?.closest('.menu-slot') as HTMLButtonElement) ?? -1;
      if (!outside && onto >= 0 && cell.move) cell.move(onto);
      else if (outside && cell.dragOut) {
        justDropped = true; // the release's click on the backdrop mustn't close the menu
        cell.dragOut(document.elementFromPoint(e.clientX, e.clientY));
      } else return;
      const keep = onto >= 0 ? onto : (grid?.selected ?? 0);
      showTab(tabIndex);
      selectSlot(keep, false);
    });
  }

  // Selects a slot and, unless `tip` is false, shows its tooltip beside it:
  // to the right, or the left when there's no room.
  function selectSlot(i: number, tip = true): void {
    if (!grid) return;
    grid.selected = Math.max(0, Math.min(grid.buttons.length - 1, i));
    grid.buttons.forEach((b, j) => b.classList.toggle('selected', j === grid!.selected));
    detailPane?.replaceChildren(options.tabs[tabIndex].detail!(grid.cells[grid.selected]));
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
    setTitle(title) {
      titleText.textContent = title;
      menu.setAttribute('aria-label', title);
    },
    get isOpen() {
      return !backdrop.hidden;
    },
    open() {
      if (!openMenus.includes(api)) openMenus.push(api);
      backdrop.hidden = false;
      status.textContent = '';
      showTab(tabIndex);
      options.onOpenChange?.(true);
    },
    close() {
      const at = openMenus.indexOf(api);
      if (at >= 0) openMenus.splice(at, 1);
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
      const key = grid?.cells[keep]?.key;
      showTab(tabIndex);
      const moved = key ? (grid?.cells.findIndex((c) => c?.key === key) ?? -1) : -1;
      if (grid) selectSlot(moved >= 0 ? moved : keep, false);
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
      // Escape as a toggle key opens only when nothing else is open.
      const escapeMenu = options.toggleKey === 'Escape';
      if (escapeMenu && !api.isOpen && anyMenuOpen()) return;
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
      else if (grid && (event.code === 'Enter' || event.code === 'Space')) (detailPane?.querySelector('button') ?? slotButtons[grid.selected]?.button)?.click(); // the chosen slot's button, or the slot
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
