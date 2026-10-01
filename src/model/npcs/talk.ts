// Whoever the hero can talk to right now (E), one rule for all who talk:
// someone of a role that talks (the barmaid, the smith, the bouncer), in the hero's room,
// within reach (across her bar, his counter); the nearest. While the prompt
// shown is to talk to them, their name gives way to it.

import type { Inside } from '../interiors/indoors';
import type { Npc, NpcRole } from './npcs';

export const TALK_RANGE = 2.2; // room tiles: across a bar or a counter

// Those who talk, and what the prompt calls it.
const TALKS: Partial<Record<NpcRole, string>> = { barkeep: 'Talk to', smith: 'Trade with', bouncer: 'Talk to' };

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
