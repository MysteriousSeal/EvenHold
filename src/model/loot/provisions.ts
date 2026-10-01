// Provisions: food and drink, bought and sold at the inn (the barmaid's
// shop, inn/tavernShop.ts), and eaten or drunk from the bag: food for health
// back, drink for energy. Nothing drops them (yet).

import type { LootEntry } from './lootEntry';

export interface Provision extends LootEntry {
  heal?: number; // food: the health it gives back
  energy?: number; // drink: the energy it gives back
  drink?: boolean;
  about: string; // a line telling of it
}

const PROVISION_TABLE = {
  bread: { name: 'Bread loaf', value: 4, heal: 3, droppedBy: {}, about: 'Baked this morning, still soft inside.' },
  cheese: { name: 'Cheese wedge', value: 6, heal: 3, droppedBy: {}, about: 'Sharp and crumbly, from the dairy up the valley.' },
  apple: { name: 'Apple', value: 2, heal: 2, droppedBy: {}, about: 'Red and crisp, from the orchard behind the inn.' },
  roastLeg: { name: 'Roast leg', value: 12, heal: 7, droppedBy: {}, about: 'Slow-roasted over the hearth, dripping and hot.' },
  meatPie: { name: 'Meat pie', value: 9, heal: 5, droppedBy: {}, about: 'Golden crust, rich with meat and gravy.' },
  ale: { name: 'Ale', value: 3, energy: 20, drink: true, droppedBy: {}, about: 'A frothing tankard of the house brew.' },
  mead: { name: 'Mead', value: 7, energy: 35, drink: true, droppedBy: {}, about: 'Sweet honey wine, warming to the toes.' },
  wine: { name: 'Wine', value: 15, energy: 50, drink: true, droppedBy: {}, about: 'A dark red from the south, sealed in wax.' },
} satisfies Record<string, Provision>;

export type ProvisionId = keyof typeof PROVISION_TABLE;
export const PROVISIONS: Record<ProvisionId, Provision> = PROVISION_TABLE;
export const PROVISION_IDS = Object.keys(PROVISIONS) as ProvisionId[];
export const isProvision = (item: string): item is ProvisionId => item in PROVISIONS;

// What one gives back, said short: "heals 3" (food), "+20 energy" (drink).
export const givesText = (id: ProvisionId): string => (PROVISIONS[id].drink ? `+${PROVISIONS[id].energy ?? 0} energy` : `heals ${PROVISIONS[id].heal ?? 0}`);
