// What villagers and staff say aloud (a barmaid taking an order, the patron
// answering), for speech bubbles over them: said here, gathered with the
// model's events (GameModel.takeEvents), shown only in the room they're in.

import type { GameEvent } from '../types';
import type { Npc } from './npcs';

const said: GameEvent[] = [];

// `who` says `text` (where they are: a room, or outdoors): a villager, a traveller on the road.
export function say(who: Pick<Npc, 'x' | 'z'> & { where: Npc['where'] }, text: string): void {
  said.push({ kind: 'say', speaker: who, where: who.where, text });
}

// Lines taken in turn, by whoever (or whatever) says them: every line comes round, never one twice running.
const turns = new WeakMap<object, number>();
export function nextTurn(owner: object): number {
  const n = turns.get(owner) ?? 0;
  turns.set(owner, n + 1);
  return n;
}
export const inTurn = <T>(owner: object, lines: readonly T[]): T => lines[nextTurn(owner) % lines.length];

// What's been said since last asked, and forgotten.
export const takeSpeech = (): GameEvent[] => said.splice(0);

