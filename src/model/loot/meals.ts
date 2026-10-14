// Meals: what a cook makes (skills/cooking.ts) of the meat beasts drop, the fish caught from a shore and what the
// barmaid sells (salt, flour): food, eaten from the bag as the inn's is (provisions.ts, hero/bag.ts eatOrDrink), sat
// down a while, for more of their health back than anything she sells; nobody sells them, nothing drops them, but the
// inn and pedlars buy them, as they do food. Eaten through, a blessing for a while (hero/blessing.ts): a roast's or a
// fish's Well fed a few minutes, a stew's longer, a pie's Fortified, a feast's Feasted. Each made by the cook alone; who eats it, the hero.

import type { Provision } from './provisions';

const MINUTES = 60;
const SNACK = { kind: 'fed', seconds: 4 * MINUTES } as const; // a roast's or a fish's: Well fed a little while (a stew's, longer)

const MEAL_TABLE = {
  // Over any fire (an apprentice's): meat and small fish roasted plain.
  roastedFry: { name: 'Roasted small fry', value: 4, heal: 0.3, fed: SNACK, droppedBy: {}, about: 'A handful of little fish, crisp from the fire, eaten bones and all.' },
  roastBoar: { name: 'Roast boar', value: 10, heal: 0.45, fed: SNACK, droppedBy: {}, about: 'A haunch turned over the flames till the fat spits.' },
  wolfSkewer: { name: 'Wolf skewer', value: 9, heal: 0.45, fed: SNACK, droppedBy: {}, about: 'Stringy, smoky, and better than it has any right to be.' },
  searedLynx: { name: 'Seared lynx', value: 12, heal: 0.5, fed: SNACK, droppedBy: {}, about: 'Lean and dark, seared hot and quick.' },
  bearSteak: { name: 'Bear steak', value: 16, heal: 0.6, fed: SNACK, droppedBy: {}, about: 'A slab as thick as your hand, charred at the edges.' },
  // A journeyman's: the better fish over any fire; stews at a hearth, Well fed after.
  grilledTrout: { name: 'Grilled trout', value: 14, heal: 0.55, fed: SNACK, droppedBy: {}, about: 'Split and laid on the coals, its skin blistered gold.' },
  saltedPerch: { name: 'Salt-baked perch', value: 15, heal: 0.55, fed: SNACK, droppedBy: {}, about: 'Baked in a crust of salt, cracked open steaming.' },
  boarStew: { name: 'Boar stew', value: 22, heal: 0.4, fed: { kind: 'fed', seconds: 15 * MINUTES }, droppedBy: {}, about: 'Thick and brown, simmered all afternoon at the hearth.' },
  fishStew: { name: "Fisherman's stew", value: 30, heal: 0.5, fed: { kind: 'fed', seconds: 20 * MINUTES }, droppedBy: {}, about: 'Trout and perch in a salty broth, as the boatmen make it.' },
  honeyBear: { name: 'Honey-glazed bear', value: 34, heal: 0.6, fed: { kind: 'fed', seconds: 20 * MINUTES }, droppedBy: {}, about: 'Bear meat glazed with the honey it was after, sticky and sweet.' },
  // An expert's: pike over any fire; pies and a honey cake at a hearth, Fortified after.
  roastPike: { name: 'Roast pike', value: 30, heal: 0.7, fed: SNACK, droppedBy: {}, about: 'A long fish, long roasted, its flesh white and firm.' },
  huntersPie: { name: "Hunter's pie", value: 38, heal: 0.5, fed: { kind: 'fortified', seconds: 20 * MINUTES }, droppedBy: {}, about: 'Boar and lynx under a thick crust. Sits in you like a stone, in a good way.' },
  pikePie: { name: 'Pike pie', value: 44, heal: 0.6, fed: { kind: 'fortified', seconds: 20 * MINUTES }, droppedBy: {}, about: 'Flaked pike baked in pastry, the old river folk dish.' },
  honeyCake: { name: 'Honey cake', value: 40, heal: 0.25, energy: 0.5, fed: { kind: 'fortified', seconds: 20 * MINUTES }, droppedBy: {}, about: 'Dense, golden and dripping. One slice and you could walk all day.' },
  // An artisan's: feasts at a hearth, before a hard fight, Feasted after.
  huntersFeast: { name: "Hunter's feast", value: 80, heal: 1, fed: { kind: 'feasted', seconds: 30 * MINUTES }, droppedBy: {}, about: 'A board heaped with every beast of the wild, roasted. Enough for a war band.' },
  riverFeast: { name: 'River feast', value: 90, heal: 1, fed: { kind: 'feasted', seconds: 30 * MINUTES }, droppedBy: {}, about: 'Every fish of the river on one platter, with fresh bread to mop it up.' },
  lordsFeast: { name: "Lord's feast", value: 120, heal: 1, energy: 0.5, fed: { kind: 'feasted', seconds: 30 * MINUTES }, droppedBy: {}, about: 'Bear roasted whole in honey, and the bread to go with it. Fit for a lord.' },
} satisfies Record<string, Provision>;

export type MealId = keyof typeof MEAL_TABLE;
export const MEALS: Record<MealId, Provision> = MEAL_TABLE;
export const MEAL_IDS = Object.keys(MEALS) as MealId[];
export const isMeal = (item: string): item is MealId => item in MEALS;
