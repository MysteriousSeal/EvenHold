// What every loot item is (junk.ts, ingredients.ts, provisions.ts, quest
// items), apart from loot.ts, which gathers them all.

// Who drops what: families of enemies (ENEMY_STATS[kind].family).
export type LootSource = 'beast' | 'humanoid' | 'boar' | 'undead' | 'draugr' | 'ghost' | 'vermin';

export interface LootEntry {
  name: string;
  value: number; // copper pieces when sold
  droppedBy: Partial<Record<LootSource, number>>; // weights among what that family drops
}
