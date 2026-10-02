// What a dungeon (a crypt, a cave: dungeons.ts) keeps of what's been done in
// it, in the save: the posts of its foes slain for good (each foe's place in
// it, by number), its boss's post, its chest's once opened, and the point its
// boss's fall gave the hero (once a dungeon, ever: kept through a reset);
// numbers from SUMMONED up are those called up mid-fight (not its to count).

export const BOSS_POST = 10_000; // the boss's place in the record of the slain (its foes' posts are below it)
export const CHEST_POST = 10_001; // the boss's chest (or hoard), once opened
export const AWARD_POST = 10_002; // the point the boss's fall gave the hero
export const SUMMONED = 20_000; // from here on: those called up mid-fight

// How much of a dungeon is cleared (0..1): its foes slain and its boss, of all of them (its `foes` posts and the boss).
export function clearedShare(slain: ReadonlySet<number>, foes: number): number {
  let count = slain.has(BOSS_POST) ? 1 : 0;
  for (const post of slain) if (post < BOSS_POST) count++;
  return Math.min(1, count / (foes + 1));
}
