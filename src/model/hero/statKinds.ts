// The hero's four stats, as WoW's: what each is called (their effects: attributes.ts).

export const STATS = ['strength', 'agility', 'stamina', 'endurance'] as const;
export type Stat = (typeof STATS)[number];
export const isStat = (kind: string): kind is Stat => (STATS as readonly string[]).includes(kind);
export const STAT_NAMES: Record<Stat, string> = { strength: 'Strength', agility: 'Agility', stamina: 'Stamina', endurance: 'Endurance' };
