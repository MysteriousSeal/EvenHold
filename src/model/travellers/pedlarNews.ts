// What a pedlar has to say (their window: controller/trade/pedlarPanel.ts): a word on the hero as they come up (camped
// for the night, hurt, their bag full, bones in it to sell, a trinket of theirs worn, a light purse); the news of the
// road, at the foot of their window (once the carter's gone up the cathedral road with his box, "The long road" done:
// the greycoats on the roads, Saint Aldous's miracles at Greyminster, the relic trade, and the act's own word, the ending's
// at the last; before, the road's own); and a rumour to
// buy, a place on the road inked on the hero's map (atlas.ts hear), one a while (RUMOUR_EVERY, as a shop restocks).

import type { Hero } from '../types';
import type { BagItem } from '../hero/bag';
import { maxHpOf } from '../hero/attributes';
import { bagRoom } from '../hero/bagSlots';
import { slotsUsed } from '../hero/bagStacks';
import { ITEMS, type ItemId } from '../human/equipment';
import { oneOf } from '../../util/random';
import { isRelic } from './pedlarShop';
import type { Shop } from '../shops/shopStock';
import type { Entrance } from '../interiors/interiors';
import { dungeonAt } from '../dungeons/dungeons';
import type { Camp as BanditCamp } from '../camps/camps';
import { bearing } from './travellerTalk';
import type { SaintState } from '../story/saint/saintState';

export const RUMOUR_PRICE = 15; // copper: a place on the map
const RUMOUR_REACH = 400; // tiles from the pedlar a place they've heard of lies at most
const RUMOURS = 'rumour'; // (a rumour told, kept with what they've bought: one sold on, as it were, each restock)

// Their word as the hero comes up, by how the hero is: null, none of their own (one of their hellos, then).
// `roll`: 0..1. `camped`: theirs made for the night.
const CAMPED = ['Pull up a stone. The fire is free, the wares are not.', "You're out late. Warm your hands, then buy something.", "Kettle's on. Mind the mule, she bites."];
const HURT = ["You're bleeding on my pack. A red potion? I've one somewhere.", 'Sit before you fall. I sell potions, you know. Red ones.'];
const FULL = ["Your bag's fit to burst. Lighten it: I'm buying.", "Clanking like a tinker's cart, you are. Sell me some of that."];
const BONES = ['Is that a bone charm I see in your bag? I know pilgrims who would kiss it.', "You've been in the crypts. Got any bones? Saints' bones, I mean. Any bones."];
const MINE = ["Ha! That's one of mine you're wearing. Or my cousin's. Wears well, doesn't it?", 'Nice trinket. I sold a dozen like it last spring.'];
const SKINT = ['Light purse? Sell me something, then. I buy most things.', "You look skint. I know the feeling. Got anything to sell?"];

export function pedlarGreets(hero: Hero, camped: boolean, roll = Math.random()): string | null {
  if (camped) return oneOf(CAMPED, roll);
  if (hero.hp < maxHpOf(hero) * 0.4) return oneOf(HURT, roll);
  if (roll >= 0.6) return null; // (not every time a remark)
  const r = roll / 0.6;
  const carried = Object.keys(hero.bag) as BagItem[];
  if (slotsUsed(hero.bag) >= bagRoom(hero)) return oneOf(FULL, r);
  if (carried.some((id) => isRelic(id) && (hero.bag[id] ?? 0) > 0)) return oneOf(BONES, r);
  if (Object.values(hero.equipment).some((id) => (ITEMS[id as ItemId]?.soldBy?.pedlar ?? 0) > 0)) return oneOf(MINE, r);
  if (hero.money < 10) return oneOf(SKINT, r);
  return null;
}

// The news of the road: the road's own; and once arc 2's begun, the cathedral's.
const ROAD = [
  'Wolves took a goose off my cart last week. The goose fought back. Brave goose.',
  'The fords are up past the hill villages. Go round by the bridges.',
  'Bandits on the north road. Polite ones, mind. They said please.',
  "Pilgrims pay silver for a saint's bones. Any old bone, if it has a hole in it.",
  'An innkeeper two villages back waters her ale. I will not say which. It was all of them.',
];
const CATHEDRAL = [
  'Greycoats stopped me at the ford. Turned out my whole cart looking for poppets. Took two candles and a ham.',
  "Everyone's walking to Greyminster. They say Saint Aldous's finger healed a blind cooper. Healed him of his savings, more like.",
  "Bones are dear this year. Every crypt from here to Greyminster's been dug.",
  'A woman sat a day in the stocks for selling love charms. The men in grey bought three first.',
  "A pilgrim wept the whole road to the Minster. Said she'd felt something there. Who am I to say she didn't?",
  "Bishop Osric's men are buying up relics. They pay in blessings. I take coin.",
  "There's a pardoner in Greyminster, Gil, selling Saint Aldous's toenails. Nine feet, that saint had, by Gil's count.",
  'Keep your charms in your boot when the greycoats ride by. Captain Grey asks his questions with his fists.',
];
// The act's own word (story/saint/saintState.ts: the empty wagon, the road of fires, Greyminster), and the ending's.
const BY_ACT: Record<1 | 2 | 3, string> = {
  1: "Pilgrims all walking to Greyminster, the roads thick with them. The new saint heals, they say. Heals what, I ask.",
  2: 'The greycoats are chaining hedge-witches along the north road. Whole villages watching, and none saying a word.',
  3: "There's a man in the bishop's cells shouting the saint's a knuckle. A pig's knuckle. They'll not let him shout long.",
};
const ENDED = {
  exposed: "Heard the news? They put the bishop in the stocks! I threw a turnip. Everyone threw a turnip.",
  kept: 'The miracles stopped, but the pilgrims still come. Faith is a stubborn mule, friend.',
};
export const pedlarNews = (saint: Pick<SaintState, 'act' | 'ending'>, n: number): string => {
  const { act, ending } = saint;
  const word = act === 0 ? null : act === 4 ? (ending ? ENDED[ending] : null) : BY_ACT[act];
  const lines = act === 0 ? ROAD : [...(word ? [word] : []), ...CATHEDRAL, ...ROAD.slice(0, 2)];
  return lines[((n % lines.length) + lines.length) % lines.length];
};

// The places a pedlar might tell of: the dungeons and camps about, not on the hero's map.
export interface RumourWorld {
  crypts: ReadonlyArray<{ entrance: Entrance }>;
  caves: ReadonlyArray<{ entrance: Entrance }>;
  strongholds: ReadonlyArray<{ entrance: Entrance }>;
  camps: readonly BanditCamp[];
  atlas: { places(): ReadonlyArray<{ key: string }>; hear(x: number, z: number): void };
}

// The nearest place to the pedlar at (x, z) the hero's map hasn't got, within RUMOUR_REACH: where, and its name.
export function rumourOf(world: RumourWorld, at: { x: number; z: number }): { x: number; z: number; name: string } | null {
  const known = new Set(world.atlas.places().map((p) => p.key));
  let best: { x: number; z: number; name: string } | null = null;
  let near = RUMOUR_REACH;
  const consider = (x: number, z: number, key: string, name: string) => {
    const d = Math.hypot(x - at.x, z - at.z);
    if (d < near && !known.has(key)) [best, near] = [{ x, z, name }, d];
  };
  for (const { entrance } of [...world.crypts, ...world.caves, ...world.strongholds]) {
    const place = dungeonAt(entrance);
    if (place) consider(entrance.x, entrance.z, place.key, place.name);
  }
  for (const camp of world.camps) consider(camp.x, camp.z, `camp:${camp.x},${camp.z}`, 'a bandit camp');
  return best;
}

// Whether they've a rumour to sell just now (one told a while: the next after their pack's next restock).
export const rumourToSell = (shop: Shop): boolean => (shop.bought?.[RUMOURS] ?? 0) === 0;

// A rumour bought: paid for, the place inked on the map; what they say of it (null: not sold, and why).
export function buyRumour(world: RumourWorld, shop: Shop, hero: Hero, at: { x: number; z: number }): { said: string; sold: boolean } {
  if (!rumourToSell(shop)) return { said: "That's all I know for now. Ask me again when I've heard more.", sold: false };
  const place = rumourOf(world, at);
  if (!place) return { said: "I've nothing you don't know already. You've been about, haven't you?", sold: false };
  if (hero.money < RUMOUR_PRICE) return { said: 'News costs coin, friend. Come back when you have some.', sold: false };
  hero.money -= RUMOUR_PRICE;
  shop.money += RUMOUR_PRICE;
  (shop.bought ??= {})[RUMOURS] = 1;
  world.atlas.hear(place.x, place.z);
  const far = Math.hypot(place.x - at.x, place.z - at.z);
  return { said: `${place.name}, to the ${bearing(at, place)}, ${far < 80 ? 'not far' : far < 200 ? 'a fair walk' : 'a long road'}. There, I've inked it on your map.`, sold: true };
}
