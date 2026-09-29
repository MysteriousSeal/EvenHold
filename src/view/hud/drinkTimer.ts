// Over the hero's head while they sip a drink at the bar (heroStats.ts
// drinking): a small pill in the HUD's look, an amber bar draining as the
// tankard empties, and the seconds left. Styles in hud.css.

import type { Hero } from '../../model/types';

export function createDrinkTimer(): (drinking: Hero['drinking'], at: { x: number; y: number } | null) => void {
  const pill = document.createElement('div');
  pill.className = 'drink-timer';
  pill.hidden = true;
  pill.innerHTML = '<i></i><span></span>';
  const fill = pill.querySelector('i') as HTMLElement;
  const left = pill.querySelector('span') as HTMLElement;
  document.body.append(pill);
  let shown = '';
  return (drinking, at) => {
    pill.hidden = !drinking || !at;
    if (!drinking || !at) return;
    const text = `${Math.ceil(drinking.left)}s`;
    if (text !== shown) left.textContent = shown = text;
    fill.style.width = `${(drinking.left / drinking.seconds) * 100}%`;
    pill.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
  };
}
