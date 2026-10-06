// Materials: what's gathered rather than looted, for the trades (skills/: logs from the trees a lumberjack fells,
// skills/lumber.ts); none dropped by foes. Good for selling, till there's something to make of them.

import type { LootEntry } from './lootEntry';

export const MATERIALS = {
  birchLog: { name: 'Birch log', value: 2, droppedBy: {} }, // pale, light, quick to burn
  pineLog: { name: 'Pine log', value: 3, droppedBy: {} }, // straight and resinous
  oakLog: { name: 'Oak log', value: 5, droppedBy: {} }, // heavy, hard, the best of them
} satisfies Record<string, LootEntry>;

export type MaterialId = keyof typeof MATERIALS;
export const isMaterial = (item: string): item is MaterialId => item in MATERIALS;
