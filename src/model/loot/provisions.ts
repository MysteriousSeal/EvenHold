// Provisions: food and drink, bought and sold at the inn (the barmaid's
// shop, npcs/tavernShop.ts), and eaten or drunk from the bag to get health
// back (food more than drink). Nothing drops them (yet).

import type { LootEntry } from './loot';

export interface Provision extends LootEntry {
  heal: number; // health it gives back
  drink?: boolean;
  about: string; // a line telling of it
}

const PROVISION_TABLE = {
  bread: { name: 'Bread loaf', value: 4, heal: 2, droppedBy: {}, about: 'Baked this morning, still soft inside.' },
  cheese: { name: 'Cheese wedge', value: 6, heal: 2, droppedBy: {}, about: 'Sharp and crumbly, from the dairy up the valley.' },
  apple: { name: 'Apple', value: 2, heal: 1, droppedBy: {}, about: 'Red and crisp, from the orchard behind the inn.' },
  roastLeg: { name: 'Roast leg', value: 12, heal: 4, droppedBy: {}, about: 'Slow-roasted over the hearth, dripping and hot.' },
  meatPie: { name: 'Meat pie', value: 9, heal: 3, droppedBy: {}, about: 'Golden crust, rich with meat and gravy.' },
  ale: { name: 'Ale', value: 3, heal: 1, drink: true, droppedBy: {}, about: 'A frothing tankard of the house brew.' },
  mead: { name: 'Mead', value: 7, heal: 2, drink: true, droppedBy: {}, about: 'Sweet honey wine, warming to the toes.' },
  wine: { name: 'Wine', value: 15, heal: 3, drink: true, droppedBy: {}, about: 'A dark red from the south, sealed in wax.' },
} satisfies Record<string, Provision>;

export type ProvisionId = keyof typeof PROVISION_TABLE;
export const PROVISIONS: Record<ProvisionId, Provision> = PROVISION_TABLE;
export const PROVISION_IDS = Object.keys(PROVISIONS) as ProvisionId[];
export const isProvision = (item: string): item is ProvisionId => item in PROVISIONS;
