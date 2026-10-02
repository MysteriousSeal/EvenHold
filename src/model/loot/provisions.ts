// Provisions: food and drink, bought and sold at the inn (the barmaid's
// shop, inn/tavernShop.ts), and eaten or drunk from the bag: food for health
// back, drink for energy, each a share of the hero's most (the dearer, the
// more), over a few seconds (hero/bag.ts eatOrDrink). Nothing drops them (yet).

import type { LootEntry } from './lootEntry';

export interface Provision extends LootEntry {
  heal?: number; // food: the share of their most health it gives back (0..1)
  energy?: number; // drink: the share of their most energy it gives back
  drink?: boolean;
  about: string; // a line telling of it
}

const PROVISION_TABLE = {
  bread: { name: 'Bread loaf', value: 4, heal: 0.2, droppedBy: {}, about: 'Baked this morning, still soft inside.' },
  cheese: { name: 'Cheese wedge', value: 6, heal: 0.25, droppedBy: {}, about: 'Sharp and crumbly, from the dairy up the valley.' },
  apple: { name: 'Apple', value: 2, heal: 0.1, droppedBy: {}, about: 'Red and crisp, from the orchard behind the inn.' },
  roastLeg: { name: 'Roast leg', value: 12, heal: 0.5, droppedBy: {}, about: 'Slow-roasted over the hearth, dripping and hot.' },
  meatPie: { name: 'Meat pie', value: 9, heal: 0.35, droppedBy: {}, about: 'Golden crust, rich with meat and gravy.' },
  ale: { name: 'Ale', value: 3, energy: 0.2, drink: true, droppedBy: {}, about: 'A frothing tankard of the house brew.' },
  mead: { name: 'Mead', value: 7, energy: 0.35, drink: true, droppedBy: {}, about: 'Sweet honey wine, warming to the toes.' },
  wine: { name: 'Wine', value: 15, energy: 0.5, drink: true, droppedBy: {}, about: 'A dark red from the south, sealed in wax.' },
} satisfies Record<string, Provision>;

export type ProvisionId = keyof typeof PROVISION_TABLE;
export const PROVISIONS: Record<ProvisionId, Provision> = PROVISION_TABLE;
export const PROVISION_IDS = Object.keys(PROVISIONS) as ProvisionId[];
export const isProvision = (item: string): item is ProvisionId => item in PROVISIONS;

export const MEAL_SECONDS = 15; // food eaten, or drink drunk, over so long

// What one gives back, and over how long: "Heals 20% over 15 seconds" (food), "Restores 20% energy over 15 seconds"
// (drink), of the most.
const percent = (share = 0) => `${Math.round(share * 100)}%`;
export const givesText = (id: ProvisionId): string =>
  PROVISIONS[id].drink ? `Restores ${percent(PROVISIONS[id].energy)} energy over ${MEAL_SECONDS} seconds` : `Heals ${percent(PROVISIONS[id].heal)} over ${MEAL_SECONDS} seconds`;
