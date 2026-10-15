// What's heard of what the model tells (its GameEvents): a blow's whoosh, its landing (on flesh, or on armour and
// bone), a parry's ring, a foe falling, a bane caught; a gong for the big moments (a lord risen, a gate unbarred); the
// coin, a skill risen, a level gained, something not to be had; a potion or a drink gulped, food eaten, a charm cast;
// each stroke at work, a line cast and what came of it, a thing made. What's only seen (a village's name): none.

import type { EnemyKind, GameEvent } from '../../model/types';
import type { SoundId } from './soundBank';

export interface Cue {
  id: SoundId;
  gain?: number; // over its own level (1)
}

// Foes a blow rings off: in mail and plate, or bare bone.
const ARMOURED: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['banditChief', 'skeleton', 'skeletonArcher', 'draugr', 'cryptLord', 'bruiser', 'houndmaster', 'quartermaster', 'gaoler', 'captain', 'banditKing', 'unquietBrother', 'gildedSaint', 'gildedDeacon']);

const STROKES = { axe: 'chop', pick: 'mine', hammer: 'anvil', bench: 'bench' } as const;
const GUARDS = { rolled: null, parried: 'parry', blocked: 'block', broken: 'broken' } as const; // (rolled through: the roll's own whoosh, heard already)

export function soundsFor(event: GameEvent): Cue[] {
  switch (event.kind) {
    case 'swing': return [{ id: event.roll ? 'roll' : 'swing' }];
    case 'hit':
      if (event.on === 'hero') return [{ id: 'hurt' }];
      return event.crit ? [{ id: 'crit' }, { id: ARMOURED.has(event.on) ? 'hitArmour' : 'hitFlesh', gain: 0.6 }] : [{ id: ARMOURED.has(event.on) ? 'hitArmour' : 'hitFlesh' }];
    case 'dodge': return [{ id: 'dodge' }];
    case 'guard': return GUARDS[event.outcome] ? [{ id: GUARDS[event.outcome]! }] : [];
    case 'slain': return [{ id: 'slain' }];
    case 'fallen': return [{ id: 'fallen' }];
    case 'coins': return [{ id: 'coin' }];
    case 'skillUp':
    case 'jobRank': return [{ id: 'skillUp' }];
    case 'levelUp': return [{ id: 'levelUp' }];
    case 'quest': return event.done ? [{ id: 'quest' }] : [];
    case 'cleared': return [{ id: 'quest' }];
    case 'poor': return [{ id: 'error' }];
    case 'locked': return [{ id: 'locked' }];
    case 'stroke': return [{ id: STROKES[event.tool] }];
    case 'felled': return [{ id: 'felled' }];
    case 'castLine': return [{ id: 'castLine' }];
    case 'fished': return [{ id: event.item ? 'catch' : 'lost' }];
    case 'crafted': return [{ id: 'crafted' }];
    case 'salvaged': return [{ id: 'salvaged' }];
    case 'consumed': return [{ id: event.drink ? 'drink' : 'eat' }];
    case 'cast': return [{ id: event.mended === undefined ? 'cast' : 'mend' }];
    case 'chilled': return [{ id: 'frost' }];
    case 'webbed': return [{ id: 'web' }];
    case 'brood': return [{ id: 'hatch' }];
    case 'rises':
    case 'stirs':
    case 'torn':
    case 'unbarred': return [{ id: 'sting' }];
    case 'arrive':
    case 'campGate': return [{ id: 'sting', gain: 0.45 }]; // (somewhere dangerous come into: softer)
    case 'barred':
    case 'walled': return [{ id: 'locked' }];
    case 'blessing': return [{ id: 'blessing' }];
    case 'point': return [{ id: 'skillUp' }];
    case 'mending': return [{ id: 'mend', gain: 0.6 }];
    case 'shift': return [{ id: 'quest' }];
    default: return [];
  }
}
