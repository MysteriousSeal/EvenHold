// What a life came to (player.ts): the counts a report reads the game by (play.ts), and what the trainer's told of each
// life (env.py info). Everything a player might do is here, done or not: what's never done is the part to read.
export interface Tally {
  seconds: number;
  level: number;
  xp: number; // in all, from level 1
  money: number;
  earned: number; // coin in, in all
  spent: number;
  quests: { taken: number; done: number; abandoned: number };
  falls: number;
  kills: number;
  hurt: number; // health lost, in whole bars
  doors: Record<string, number>; // buildings gone into, by type
  windows: Record<string, number>; // windows opened, by kind
  bought: number;
  sold: number;
  crafted: number;
  salvaged: number;
  chopped: number; // trees felled
  shifts: number;
  ales: number;
  pies: number;
  rooms: number;
  wishes: number;
  chests: number;
  camps: number; // cleared
  dungeons: number; // bosses slain
  equipped: number;
  eaten: number;
  potions: number;
  pointsSpent: number;
  keys: Record<string, number>; // each key pressed, how often
  did: Record<string, number>; // other things done, by name (a chop begun, a word with a traveller, slept, dropped, lain on a bedroll)
  moving: number; // decisions spent going somewhere
  places: { outdoors: number; inn: number; smithy: number; house: number; herbalist: number; dungeon: number; upstairs: number; camp: number }; // seconds
  wasted: number; // E with nothing to do
}

export const emptyTally = (): Tally => ({
  seconds: 0, level: 1, xp: 0, money: 0, earned: 0, spent: 0, quests: { taken: 0, done: 0, abandoned: 0 }, falls: 0, kills: 0, hurt: 0,
  doors: {}, windows: {}, bought: 0, sold: 0, crafted: 0, salvaged: 0, chopped: 0, shifts: 0, ales: 0, pies: 0, rooms: 0, wishes: 0, chests: 0, camps: 0, dungeons: 0,
  equipped: 0, eaten: 0, potions: 0, pointsSpent: 0, keys: {}, did: {}, moving: 0,
  places: { outdoors: 0, inn: 0, smithy: 0, house: 0, herbalist: 0, dungeon: 0, upstairs: 0, camp: 0 }, wasted: 0,
});

export const count = (by: Record<string, number>, key: string, n = 1): void => void (by[key] = (by[key] ?? 0) + n);
