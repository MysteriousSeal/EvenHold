// A word with a traveller on the road (travellers.ts), E by them: a pedlar
// opens their pack (pedlarShop.ts); a pilgrim tells of the nearest crypt
// (which way, how far, its name), or a word of the road; a guard,
// a word about keeping the roads. Each line in turn, never one twice running.

import type { Traveller } from './travellers';
import type { Crypt } from '../crypts/crypts';

export const TRAVELLER_TALK_RANGE = 1.6; // tiles: near enough for a word, out on the road

// The traveller near enough for a word, standing (the nearest), if any.
export function travellerInReach(travellers: readonly Traveller[], hero: { x: number; z: number }): Traveller | null {
  let best: Traveller | null = null;
  let near = TRAVELLER_TALK_RANGE;
  for (const t of travellers) {
    if (t.down !== null) continue;
    const d = Math.hypot(t.x - hero.x, t.z - hero.z);
    if (d < near) [best, near] = [t, d];
  }
  return best;
}

// The prompt over them: "Trade with Osric", "Talk to Wenna".
export const travellerPrompt = (t: Traveller): string => `${t.role === 'pedlar' ? 'Trade with' : 'Talk to'} ${t.name}`;

export const GUARD_LINES = [
  'Keep to the road, traveller. The woods have teeth.',
  "Wolves were seen this side of the ridge. Stay sharp.",
  'We walk this road from village to village, sun or rain.',
  "Bandits keep clear when they see the tabard. Mostly.",
  'Seen anything on your way? Smoke, tracks, anything?',
  "Don't linger near the old ruins after dark.",
  'Move along, nothing to see. Unless you saw something.',
  "A quiet road's a good road.",
] as const;

export const PILGRIM_ROAD_LINES = [
  'Every road ends at a well, they say. And every well remembers.',
  'I walk to the old shrines, one by one. Slowly.',
  'The dead sleep poorly round here. Mind your step.',
  'Light be with you, friend.',
  "My feet are sore and my heart is light. That's a good day.",
] as const;

// Which way (x, z) lies from (from), in the eight winds.
export function bearing(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const angle = Math.atan2(to.x - from.x, -(to.z - from.z)); // (north is -z, east +x: the map's top and right)
  const winds = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return winds[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

// A pilgrim's rumour of the nearest crypt: which way it lies, how far, what it's called.
export function cryptRumour(t: { x: number; z: number }, crypts: readonly Crypt[]): string | null {
  let best: Crypt | null = null;
  let near = Infinity;
  for (const c of crypts) {
    const d = Math.hypot(c.middle.x - t.x, c.middle.z - t.z);
    if (d < near) [best, near] = [c, d];
  }
  if (!best) return null;
  const far = near < 60 ? 'not far' : near < 160 ? 'a fair walk' : 'a long road';
  return `There's a crypt to the ${bearing(t, best.middle)}, ${far} from here: ${best.name}. Go armed.`;
}

const said = new WeakMap<object, number>(); // each traveller's lines taken in turn
const inTurn = (t: Traveller, lines: readonly string[]): string => {
  const n = said.get(t) ?? 0;
  said.set(t, n + 1);
  return lines[n % lines.length];
};

// What a pilgrim or a guard says when spoken to (a pedlar trades instead): a pilgrim, every other time, of the nearest
// crypt (if any).
export function travellerSays(t: Traveller, crypts: readonly Crypt[]): string {
  if (t.role === 'guard') return inTurn(t, GUARD_LINES);
  const n = said.get(t) ?? 0;
  const rumour = n % 2 === 0 ? cryptRumour(t, crypts) : null;
  if (rumour) return (said.set(t, n + 1), rumour);
  return inTurn(t, PILGRIM_ROAD_LINES);
}
