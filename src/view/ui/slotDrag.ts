// Dragging a menu slot (menu.ts): the whole slot (its tile, icon and count)
// follows the pointer, above every menu, so it shows over another one it's
// dragged to. Doll slots on any menu that it fits glow; the one under the
// pointer shows green if it fits, red if not. On release, `drop` is told
// where the pointer was let go.

import type { MenuSlot } from './menu';

export function dragSlot(event: PointerEvent, cell: MenuSlot, drop: (e: PointerEvent) => void): void {
  const ghost = document.createElement('div');
  ghost.className = 'menu-slot menu-drag';
  ghost.append(cell.icon(44));
  if (cell.count && cell.count > 1) {
    const count = document.createElement('span');
    count.className = 'menu-slot-count';
    count.textContent = String(cell.count);
    ghost.append(count);
  }
  const follow = (e: PointerEvent) => (ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`);
  follow(event);
  document.body.append(ghost);
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-accepts]'));
  for (const target of targets) target.classList.toggle('drop-hint', !!cell.fits && target.dataset.accepts === cell.fits);
  let hovered: HTMLElement | null = null;
  const mark = (e: PointerEvent) => {
    const target = (document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-accepts]') as HTMLElement | null) ?? null;
    if (target === hovered) return;
    hovered?.classList.remove('drop-ok', 'drop-bad');
    hovered = target;
    if (target && cell.fits) target.classList.add(target.dataset.accepts === cell.fits ? 'drop-ok' : 'drop-bad');
  };
  const move = (e: PointerEvent) => {
    follow(e);
    mark(e);
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    ghost.remove();
    for (const target of targets) target.classList.remove('drop-hint', 'drop-ok', 'drop-bad');
    drop(e);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
