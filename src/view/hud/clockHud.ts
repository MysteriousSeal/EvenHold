// The game's clock, top right (styles in hud.css): a small sand card, the
// day and the time ("Day 3 · 14:30"), the blessings' cards under it.

import { clockAt } from '../../model/clock';

export function createClockHud(): (minutes: number) => void {
  const card = document.createElement('div');
  card.className = 'clock-hud';
  card.innerHTML = '<span></span><b></b>';
  const day = card.querySelector('span') as HTMLElement;
  const time = card.querySelector('b') as HTMLElement;
  document.body.append(card);
  let shown = '';
  return (minutes) => {
    const now = clockAt(minutes);
    const text = `${now.day}|${now.time}`;
    if (text === shown) return;
    shown = text;
    day.textContent = `Day ${now.day}`;
    time.textContent = now.time;
  };
}
