// A first-hour tip (controller/tips/firstTips.ts): a small gilded card over the action bar, its title in gold and a
// line or two under it, fading in, gone after a while or with its ×. One at a time; a new one takes its place.
// Styles in tipCard.css.

import { el } from '../ui/dom';
import '../ui/gilded.css';
import './tipCard.css';

const SHOWN = 14; // seconds on screen

// A key's name marked in a tip's text (main.ts's key() for the tips), shown as a key cap, not a plain word.
export const keyMark = (name: string): string => `\u0001${name}\u0002`;
const MARKED = /\u0001([^\u0002]*)\u0002/;

// A tip's line: its words, each marked key a key cap among them.
function tipText(text: string): HTMLElement {
  const p = el('p', 'tip-text');
  text.split(MARKED).forEach((part, i) => part && p.append(i % 2 ? el('kbd', 'tip-key', part) : part)); // (odd: a key)
  return p;
}

export interface TipShown {
  title: string;
  text: string;
}

export function createTipCard(): { show(tip: TipShown): void; update(dt: number): void } {
  const card = el('aside', 'tip-card gilded');
  card.setAttribute('role', 'status');
  card.hidden = true;
  document.body.append(card);
  let left = 0;
  const hide = () => {
    card.classList.remove('shown');
    left = 0;
    window.setTimeout(() => left <= 0 && (card.hidden = true), 400); // (once faded)
  };
  return {
    show(tip) {
      const close = el('button', 'tip-close', '×');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close the tip');
      close.addEventListener('click', hide);
      card.replaceChildren(el('b', 'tip-title', tip.title), tipText(tip.text), close);
      card.hidden = false;
      requestAnimationFrame(() => card.classList.add('shown'));
      left = SHOWN;
    },
    update(dt) {
      if (left <= 0) return;
      left -= dt;
      if (left <= 0) hide();
    },
  };
}
