// Alchemy's pace, 1 to 300, as every trade's (skillPace.test.ts; the model: support/alchemyPace.ts): the optimal hand
// its few hours, still the fastest, and a casual one heeding the hints (a bare patch of what teaches nothing passed
// by, the starred brew) within half as long again. PACE=1 prints it.
import { describe, expect, it } from 'vitest';
import { TRADES, paceOf } from './support/skillPace';
import { alchemyOptions } from './support/alchemyPace';

TRADES.alchemy = { skill: 'alchemy', options: alchemyOptions };
const pace = paceOf('alchemy');

describe("alchemy's pace, 1 to 300", () => {
  if (process.env.PACE) console.log(`alchemy: optimal ${pace.optimal.toFixed(2)} h, casual ${pace.casual.toFixed(2)} (${pace.ratio.toFixed(2)}x), heeding the hints ${pace.hinted.toFixed(2)} (${pace.hintedRatio.toFixed(2)}x)`);

  it('takes the optimal hand a few hours, as the other trades', () => {
    expect(pace.optimal).toBeGreaterThan(2.5);
    expect(pace.optimal).toBeLessThan(5.5);
  });

  it('leaves the optimal hand the fastest, and a casual one heeding the hints within half as long again', () => {
    expect(pace.hintedRatio).toBeGreaterThan(1.05);
    expect(pace.hintedRatio).toBeLessThanOrEqual(1.5);
    expect(pace.ratio).toBeGreaterThanOrEqual(pace.hintedRatio);
  });
});
