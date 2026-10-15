// Hazard, the inn's dice game, as the hero plays it (inn/diceTable.ts): the hero casts, the one across the table sets
// (covers the stake). The caster calls a main, five to nine, and throws two dice:
// - the main comes up: a nick, the caster wins;
// - two or three: crabs, the caster loses; eleven and twelve by the main (eleven a nick on a seven, else crabs; twelve
//   a nick on a six or an eight, else crabs);
// - anything else is the caster's chance, and they throw on till the chance comes again (they win) or the main (they
//   lose).
// Even money, and the caster's a shade under evens whatever they call (49.3% on a seven, 48.8% on a six or an eight:
// casterOdds): the house's edge, small, the hero's to bear.
// A sharp's dice (diceSharps.ts) are fullams, loaded: one face far more often than the rest (LOADED), aces against a
// low main, sixes against a nine (whichever does the caster more harm: fullamsAgainst).

export const MAINS = [5, 6, 7, 8, 9] as const;
export type Main = (typeof MAINS)[number];
export type Fullams = 'aces' | 'sixes';
export type Cast = [number, number]; // two dice, each 1 to 6

export const LOADED = 0.5; // of a loaded die's coming up its face (the others share the rest)

// A die's six faces' odds: fair, or loaded on one.
export function faceOdds(loaded: Fullams | null = null): number[] {
  if (!loaded) return [1, 1, 1, 1, 1, 1].map((n) => n / 6);
  const face = loaded === 'aces' ? 0 : 5;
  return Array.from({ length: 6 }, (_, i) => (i === face ? LOADED : (1 - LOADED) / 5));
}

// One die thrown (`roll`: 0..1).
export function throwDie(roll: number, loaded: Fullams | null = null): number {
  const odds = faceOdds(loaded);
  let at = 0;
  for (let i = 0; i < 6; i++) if (roll < (at += odds[i])) return i + 1;
  return 6;
}

// Two dice thrown, `rng` for each.
export const throwDice = (rng: () => number, loaded: Fullams | null = null): Cast => [throwDie(rng(), loaded), throwDie(rng(), loaded)];

// What the caster's first throw makes of `main`: a nick, crabs, or the chance they throw for.
export function firstThrow(main: Main, sum: number): 'nick' | 'crabs' | number {
  if (sum === main) return 'nick';
  if (sum === 2 || sum === 3) return 'crabs';
  if (sum === 11) return main === 7 ? 'nick' : 'crabs';
  if (sum === 12) return main === 6 || main === 8 ? 'nick' : 'crabs';
  return sum;
}

// A throw after that, for `chance` on `main`: won (the chance again), lost (the main), or on (anything else).
export const laterThrow = (main: Main, chance: number, sum: number): 'won' | 'lost' | null => (sum === chance ? 'won' : sum === main ? 'lost' : null);

// The odds of each total of two dice thrown with `faces`' odds.
function totals(faces: readonly number[]): number[] {
  const p = new Array(13).fill(0);
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) p[a + b + 2] += faces[a] * faces[b];
  return p;
}

// The caster's odds of winning on `main`, exactly (with fair dice, or a sharp's).
export function casterOdds(main: Main, loaded: Fullams | null = null): number {
  const p = totals(faceOdds(loaded));
  let won = 0;
  for (let sum = 2; sum <= 12; sum++) {
    const first = firstThrow(main, sum);
    if (first === 'nick') won += p[sum];
    else if (typeof first === 'number') won += (p[sum] * p[sum]) / (p[sum] + p[main]); // (the chance before the main)
  }
  return won;
}

// The fullams a sharp slips in against `main`: whichever loading leaves the caster the worse odds.
export const fullamsAgainst = (main: Main): Fullams => (casterOdds(main, 'aces') <= casterOdds(main, 'sixes') ? 'aces' : 'sixes');
