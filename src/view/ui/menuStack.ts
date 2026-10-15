// The windows open (menu.ts's, and those built their own way), and which is on top: each a layer over the one before.

import { uiCue } from '../audio/uiCue';

// Menus open right now, most recent last.
export const openMenus: object[] = []; // (the menus made here, and windows built their own way: counted, never called)
export const overWindows: object[] = []; // (of them, those built their own way: over the whole game, every key theirs)

// The windows open, by focus: the one opened or clicked last on top, each a layer over the one before it, from
// LOWEST up to HIGHEST (under the action bar, 25: food dragged onto it from the bag; tooltips and what's dragged, 30
// and over, over every window). More windows than layers: the furthest back share the lowest.
export const stack: HTMLElement[] = [];
const [LOWEST, HIGHEST] = [20, 24];
function layer(): void {
  const n = stack.length;
  stack.forEach((backdrop, i) => (backdrop.style.zIndex = String(Math.max(LOWEST, HIGHEST - (n - 1 - i)))));
}
// A window brought to the front (opened, or clicked).
export function raise(backdrop: HTMLElement): void {
  const at = stack.indexOf(backdrop);
  if (at === stack.length - 1 && at >= 0) return;
  if (at >= 0) stack.splice(at, 1);
  stack.push(backdrop);
  layer();
}
export function sink(backdrop: HTMLElement): void {
  const at = stack.indexOf(backdrop);
  if (at >= 0) [stack.splice(at, 1), layer()];
}

export function anyMenuOpen(): boolean {
  return openMenus.length > 0;
}

// A window built its own way (the pause menu, the talk scene), counted among those open: so Escape opens it only when nothing else
// is, and the game knows a window's up.
// While one's up, no menu here hears a key (B, P, Escape): they're all its own.
export function trackMenu(menu: object, open: boolean): void {
  if (openMenus.includes(menu) !== open) uiCue(open ? 'open' : 'close');
  for (const list of [openMenus, overWindows]) {
    const at = list.indexOf(menu);
    if (open && at < 0) list.push(menu);
    if (!open && at >= 0) list.splice(at, 1);
  }
}
