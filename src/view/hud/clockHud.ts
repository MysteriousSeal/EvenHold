// The game's clock, top right (styles in hud.css): a small sand card, a
// voxel sign of the time of day (its name on hover), the day and the time
// ("Day 3 · 14:30"), the blessings' cards under it.

import { clockAt, timeOfDay, type TimeOfDay } from '../../model/clock';
import { frontIcon, type FrontVoxels } from '../ui/frontIcon';
import { dayModel, eveningModel, morningModel, nightModel } from './timeOfDayVoxels';

const SIGNS: Record<TimeOfDay, { model: FrontVoxels; name: string }> = {
  morning: { model: morningModel, name: 'Morning' },
  day: { model: dayModel, name: 'Day' },
  evening: { model: eveningModel, name: 'Evening' },
  night: { model: nightModel, name: 'Night' },
};

export function createClockHud(): (minutes: number) => void {
  const card = document.createElement('div');
  card.className = 'clock-hud';
  card.innerHTML = '<i class="clock-hud-sign"><em class="clock-hud-tip"></em></i><span></span><b></b>';
  const sign = card.querySelector('i') as HTMLElement;
  const tip = card.querySelector('em') as HTMLElement;
  const day = card.querySelector('span') as HTMLElement;
  const time = card.querySelector('b') as HTMLElement;
  document.body.append(card);
  let shown = '';
  let part: TimeOfDay | null = null;
  return (minutes) => {
    const now = clockAt(minutes);
    const nowPart = timeOfDay(minutes);
    if (nowPart !== part) {
      part = nowPart;
      sign.querySelector('canvas')?.remove();
      sign.prepend(frontIcon(`time:${nowPart}`, SIGNS[nowPart].model, 30)); // seen straight on
      tip.textContent = SIGNS[nowPart].name;
    }
    const text = `${now.day}|${now.time}`;
    if (text === shown) return;
    shown = text;
    day.textContent = `Day ${now.day}`;
    time.textContent = now.time;
  };
}
