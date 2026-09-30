// Whoever the hero can talk to right now (E), one rule for all who talk:
// someone of a role that talks (the barmaid, the smith), in the hero's room,
// within reach (across her bar, his counter); the nearest. While they can be
// talked to, their name gives way to the prompt over them.

import type { Inside } from '../interiors/indoors';
import type { Npc, NpcRole } from './npcs';

const TALK_RANGE = 2.2; // room tiles: across a bar or a counter

// Those who talk, and what the prompt calls it.
const TALKS: Partial<Record<NpcRole, string>> = { barkeep: 'Talk to', smith: 'Trade with' };

export function talkingTo(npcs: readonly Npc[], inside: Inside | null, hero: { x: number; z: number }): Npc | null {
  if (!inside) return null;
  let best: Npc | null = null;
  let near = TALK_RANGE;
  for (const n of npcs) {
    if (!TALKS[n.role] || n.where !== inside.entrance) continue;
    const d = Math.hypot(n.x - hero.x, n.z - hero.z);
    if (d < near) [best, near] = [n, d];
  }
  return best;
}

// The prompt over them: "Talk to Adawen", "Trade with Thoby".
export const talkPrompt = (npc: Npc): string => `${TALKS[npc.role] ?? 'Talk to'} ${npc.name}`;
