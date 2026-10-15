// Each stroke of a tool at work landing, told (for its sound: view/audio/): the axe on a tree, the pick on a rock, the
// hammer on the anvil or the salvage bench. A stroke lands as the swing (lumber.ts, mining.ts, smithing.ts,
// salvage.ts: how far through it, 0..1, round and round) passes its strike, as a blow's does (constants.ts).

import { ATTACK_STRIKE } from '../constants';
import type { GameEvent } from '../types';

export type Tool = 'axe' | 'pick' | 'hammer' | 'bench';

// Which tool's swinging, and how far through its swing, of a model's trades (none: null).
export function swinging(m: { lumber: { swing: number | null }; mining: { swing: number | null }; smithing: { swing: number | null }; salvage: { swing: number | null } }): { tool: Tool; swing: number } | null {
  const [tool, swing] = m.lumber.swing !== null ? ['axe', m.lumber.swing] as const : m.mining.swing !== null ? ['pick', m.mining.swing] as const : m.smithing.swing !== null ? ['hammer', m.smithing.swing] as const : ['bench', m.salvage.swing] as const;
  return swing === null ? null : { tool, swing };
}

export class Strokes {
  private last: { tool: Tool; swing: number } | null = null;

  // A moment on: the tool swinging now (none: null), a stroke told if it's passed its strike since the last (round
  // past the end too); the first moment of a tool's, from where it is.
  update(now: { tool: Tool; swing: number } | null, report: (event: GameEvent) => void): void {
    const was = this.last?.tool === now?.tool ? this.last?.swing ?? null : null;
    this.last = now && { ...now };
    if (!now || was === null) return;
    const passed = now.swing >= was ? was < ATTACK_STRIKE && now.swing >= ATTACK_STRIKE : was < ATTACK_STRIKE || now.swing >= ATTACK_STRIKE;
    if (passed) report({ kind: 'stroke', tool: now.tool });
  }
}
