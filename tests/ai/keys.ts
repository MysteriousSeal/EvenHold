// What every AI here plays by (the fighter's arena, arena.ts; the whole game's player, player.ts): a decision each
// FRAMES_PER_DECISION frames of FRAME seconds (a tenth of a second), and the way it goes: one of MOVES (still, or one
// of the 8 ways round from +z: WAYS, as the watch page's keys show them).
export const FRAME = 1 / 30;
export const FRAMES_PER_DECISION = 3; // a decision each tenth of a second
export const MOVES = 9; // still, or one of 8 ways
export const WAYS: ReadonlyArray<[number, number]> = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.sin((i * Math.PI) / 4), Math.cos((i * Math.PI) / 4)] as [number, number])];
