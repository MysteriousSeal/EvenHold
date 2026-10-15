// The vintner's (the cathedral town's stall: town/stallShop.ts): wine no village inn pours, drunk from the bag as hers is
// (provisions.ts), for more energy than her wine and dearer for it, a share point the dearer the finer: hippocras, red
// wine mulled with honey and spices, as the canons drink it; and the bishop's reserve, pressed for the altar.

import type { Provision } from './provisions';

const VINTAGE_TABLE = {
  hippocras: { name: 'Hippocras', value: 48, energy: 0.65, drink: true, droppedBy: {}, about: "Red wine mulled with honey, ginger and cinnamon: the canons' own." },
  bishopsReserve: { name: "Bishop's reserve", value: 90, energy: 0.9, drink: true, droppedBy: {}, about: 'Pressed for the altar. Most of it never reaches one.' },
} satisfies Record<string, Provision>;

export type VintageId = keyof typeof VINTAGE_TABLE;
export const VINTAGES: Record<VintageId, Provision> = VINTAGE_TABLE;
export const VINTAGE_IDS = Object.keys(VINTAGE_TABLE) as VintageId[];
