// Provisions: food and drink, bought and sold at the inn (the barmaid's
// shop, inn/tavernShop.ts), and eaten or drunk from the bag: food for health
// back, drink for energy, each a share of the hero's most (the dearer, the
// more), over a few seconds (hero/bag.ts eatOrDrink). Nothing drops them (yet). A cook's meals (meals.ts) are food
// too, eaten so, but not hers to sell (PROVISION_IDS: hers alone).

import type { LootEntry } from './lootEntry';
import type { BlessingKind } from '../hero/blessing';
import { MEALS, type MealId } from './meals';
import { VINTAGES, type VintageId } from './vintages';

export interface Provision extends LootEntry {
  heal?: number; // food: the share of their most health it gives back (0..1)
  energy?: number; // drink: the share of their most energy it gives back
  drink?: boolean;
  fed?: { kind: BlessingKind; seconds: number }; // a cook's meal: its blessing once eaten through (hero/blessing.ts feed)
  about: string; // a line telling of it
}

// (Priced so a full belly's worth something: a loaf a tenth of a wolf's purse at the first village, not a copper or
// two that never runs short; a cook's own meals the cheaper way to mend.)
const PROVISION_TABLE = {
  bread: { name: 'Bread loaf', value: 10, heal: 0.2, droppedBy: {}, about: 'Baked this morning, still soft inside.' },
  cheese: { name: 'Cheese wedge', value: 14, heal: 0.25, droppedBy: {}, about: 'Sharp and crumbly, from the dairy up the valley.' },
  apple: { name: 'Apple', value: 5, heal: 0.1, droppedBy: {}, about: 'Red and crisp, from the orchard behind the inn.' },
  roastLeg: { name: 'Roast leg', value: 30, heal: 0.5, droppedBy: {}, about: 'Slow-roasted over the hearth, dripping and hot.' },
  meatPie: { name: 'Meat pie', value: 22, heal: 0.35, droppedBy: {}, about: 'Golden crust, rich with meat and gravy.' },
  ale: { name: 'Ale', value: 6, energy: 0.2, drink: true, droppedBy: {}, about: 'A frothing tankard of the house brew.' },
  mead: { name: 'Mead', value: 15, energy: 0.35, drink: true, droppedBy: {}, about: 'Sweet honey wine, warming to the toes.' },
  wine: { name: 'Wine', value: 30, energy: 0.5, drink: true, droppedBy: {}, about: 'A dark red from the south, sealed in wax.' },
} satisfies Record<string, Provision>;

export type InnProvisionId = keyof typeof PROVISION_TABLE; // the barmaid's
export type ProvisionId = InnProvisionId | MealId | VintageId; // (and the cathedral town's vintner's: vintages.ts)
export const PROVISIONS: Record<ProvisionId, Provision> = { ...PROVISION_TABLE, ...MEALS, ...VINTAGES };
export const PROVISION_IDS = Object.keys(PROVISION_TABLE) as InnProvisionId[];
export const isProvision = (item: string): item is ProvisionId => item in PROVISIONS;

export const MEAL_SECONDS = 15; // food eaten, or drink drunk, over so long

// What one gives back, and over how long: "Heals 20% over 15 seconds" (food), "Restores 20% energy over 15 seconds"
// (drink), of the most; a meal's energy too, and its blessing after ("then Well fed for 15 minutes").
const percent = (share = 0) => `${Math.round(share * 100)}%`;
export function givesText(id: ProvisionId): string {
  const { drink, heal, energy, fed } = PROVISIONS[id];
  if (drink) return `Restores ${percent(energy)} energy over ${MEAL_SECONDS} seconds`;
  const gives = `${heal === 1 ? 'Heals fully' : `Heals ${percent(heal)}`}${energy ? ` and restores ${percent(energy)} energy` : ''} over ${MEAL_SECONDS} seconds`;
  return fed ? `${gives}, then ${FED_NAMES[fed.kind] ?? 'blessed'} for ${Math.round(fed.seconds / 60)} minutes` : gives;
}
const FED_NAMES: Partial<Record<BlessingKind, string>> = { fed: 'Well fed', fortified: 'Fortified', feasted: 'Feasted' }; // (blessing.ts's names: not imported, the loot's below the hero's)
