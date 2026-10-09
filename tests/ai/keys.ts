// What the AI plays by (player.ts): a decision each FRAMES_PER_DECISION frames of FRAME seconds; a way to go (MOVES:
// still, or one of 8 round from +z) and one key (KEYS). Its keys are the game's (controller/controls.ts) and the clicks a
// player makes in its windows (windows.ts): a row picked, the button under it, the other page, the list scrolled.
export const FRAME = 1 / 30;
export const FRAMES_PER_DECISION = 6; // a decision each fifth of a second
export const MOVES = 9; // still, or one of 8 ways
export const WAYS: ReadonlyArray<[number, number]> = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.sin((i * Math.PI) / 4), Math.cos((i * Math.PI) / 4)] as [number, number])];

export const ROWS = 12; // rows of a window seen (and pickable) at once; the rest by scrolling

export const KEYS = [
  'none',
  'strike', // Space
  'roll', // Shift
  'guard', // Q, held this decision
  'use', // E: whatever's in reach (the prompt)
  'focus', // Tab: the next foe
  'ale', // F: an ale, sat at the bar
  'other', // G: a pie at the bar; a room off the barmaid; to sleep, in a let bed at night
  'bag', // B
  'points', // P: the level-up window
  'skills', // K: the recipe book
  'close', // Escape: the window shut
  ...Array.from({ length: ROWS }, (_, i) => `row${i}`), // a row of the open window picked (and its first button pressed)
  'button', // the window's other button on the row picked (sell page: sell; recipes: craft all; board: give up; bag: drop)
  'page', // the window's other page (buy/sell)
  'down', // the list scrolled on
  'up',
] as const;
export type Key = (typeof KEYS)[number];
export const ROW_KEY = KEYS.indexOf('row0');
