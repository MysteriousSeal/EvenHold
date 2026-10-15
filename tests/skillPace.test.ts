// The gap between casual and optimal skilling (skills.ts; the model and its assumptions: support/skillPace.ts): the
// optimal hand's 1 to 300 as it was in 0.8 (the trades' steps raised where their yellow and green tries came to teach
// more), still the fastest; a casual one heeding the trades' hints (a grey tree's or rock's prompt pointing to one
// that teaches, the recipe that teaches most starred) within half as long again; and even one heeding nothing nearer
// the optimal than it was. PACE=1 prints the table.
import { describe, expect, it } from 'vitest';
import { TRADES, paceOf } from './support/skillPace';

// 0.8's hours from 1 to 300 played optimally, and the unhelped casual hand's over that (the same model, run on 0.8).
const V08: Record<string, { optimal: number; ratio: number }> = {
  lumberjacking: { optimal: 3.35, ratio: 2.98 },
  mining: { optimal: 3.41, ratio: 2.16 },
  woodworking: { optimal: 3.38, ratio: 1.67 },
  smithing: { optimal: 2.89, ratio: 1.69 },
  salvaging: { optimal: 0.33, ratio: 1.68 },
  fishing: { optimal: 3.54, ratio: 1.15 },
  cooking: { optimal: 5.29, ratio: 1.76 },
};
const paces = Object.fromEntries(Object.keys(TRADES).map((trade) => [trade, paceOf(trade)]));

describe('the pace of the trades, 1 to 300', () => {
  if (process.env.PACE) {
    const row = (cells: Array<string | number>) => cells.map((c) => (typeof c === 'number' ? c.toFixed(2) : c).padStart(8)).join(' ');
    console.log([row(['trade', 'optimal', 'casual', 'hinted', 'ratio', 'hinted', '0.8 opt', '0.8 rat']), ...Object.entries(paces).map(([t, p]) => row([t.slice(0, 8), p.optimal, p.casual, p.hinted, p.ratio, p.hintedRatio, V08[t].optimal, V08[t].ratio]))].join('\n'));
  }

  it('measures every trade', () => {
    expect(Object.keys(paces).sort()).toEqual(Object.keys(V08).sort());
  });

  it("keeps the optimal hand's hours as they were (within a twentieth), the trades' three to five hours (salvaging's few pieces aside)", () => {
    for (const [trade, p] of Object.entries(paces)) {
      expect(p.optimal / V08[trade].optimal, trade).toBeGreaterThan(0.95);
      expect(p.optimal / V08[trade].optimal, trade).toBeLessThan(1.05);
      if (trade !== 'salvaging') expect(p.optimal, trade).toBeGreaterThan(2.5);
      if (trade !== 'salvaging') expect(p.optimal, trade).toBeLessThan(5.5);
    }
  });

  it('leaves the optimal hand the fastest, and a casual one heeding the hints within half as long again', () => {
    for (const [trade, p] of Object.entries(paces)) {
      expect(p.hintedRatio, trade).toBeGreaterThan(1.05); // (playing well still pays)
      expect(p.hintedRatio, trade).toBeLessThanOrEqual(1.5);
      expect(p.ratio, trade).toBeGreaterThanOrEqual(p.hintedRatio - 1e-9); // (and heeding them never slower)
    }
  });

  it('brings even the casual hand that heeds nothing nearer the optimal than in 0.8', () => {
    for (const [trade, p] of Object.entries(paces)) expect(p.ratio, trade).toBeLessThan(V08[trade].ratio);
  });
});
