// What a menu's slot shows (menu.ts): its icon and count; on a row, its title, note and a box to tick; a badge, a tag.
// And a tooltip beside whatever it's about, kept EDGE px inside the window.
import { el } from './dom';
import { lineText, type MenuLine, type MenuSlot } from './menuTypes';

const EDGE = 8;

// `refresh`: the menu redrawn, once its box is ticked.
export function slotFace(button: HTMLButtonElement, cell: MenuSlot, iconSize: number, row: boolean, refresh: () => void): void {
  if (cell.tone) button.dataset.tone = cell.tone; // (gear's rarity: its frame tinted, menu.css)
  if (cell.key) button.dataset.key = cell.key; // (who it is, on the page too)
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
      refresh();
    });
    button.prepend(box);
  }
  if (row) {
    const text = el('span', 'menu-slot-text');
    const title = el('b', 'menu-slot-title', cell.title);
    if (cell.tone) title.dataset.tone = cell.tone;
    text.append(title);
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

// The tooltip beside `anchor`: a title (in its tone), and lines under it; on the right, else the left if there's no room.
export function placeTip(tooltip: HTMLElement, anchor: HTMLElement, text: string, lines: MenuLine[], tone?: string): void {
  const title = el('b', undefined, text);
  if (tone) title.dataset.tone = tone;
  // Each line in its part's look; a rule before a new part (the header over what wearing it would change, the
  // price, the hints).
  let last: string | undefined;
  const line = (l: MenuLine) => {
    const small = el('small', undefined, lineText(l));
    const tone = typeof l === 'string' ? undefined : l.tone;
    if (tone) small.dataset.tone = tone;
    if (tone !== last && (tone === 'head' || tone === 'hint' || tone === 'price')) small.classList.add('ruled');
    last = tone;
    return small;
  };
  tooltip.replaceChildren(title, ...lines.map(line));
  tooltip.hidden = false;
  const at = anchor.getBoundingClientRect();
  const [width, height] = [tooltip.offsetWidth, tooltip.offsetHeight];
  const left = Math.max(EDGE, at.right + 8 + width <= window.innerWidth - EDGE ? at.right + 8 : at.left - 8 - width);
  // Level with the slot's top, raised as far as it must be to end on screen (never past its top).
  const top = Math.max(EDGE, Math.min(at.top, window.innerHeight - EDGE - height));
  tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
