// Drawing a drink behind the bar (barShift.ts): E at the tap (an ale) or at a bottle shelf (a glass of wine) sets it
// filling; E again stops it. Stopped at the line, a perfect pour; over it, a head of froth; short of it, short measure
// (well short: a thin one); let fill to the brim, it runs over: spilled, the cup to be washed. Wine fills quicker
// than ale: the harder pour, and the better paid. The steadier the hand (the rank's), the wider the line.

export type Pourable = 'ale' | 'wine';
export type PourGrade = 'perfect' | 'frothy' | 'short' | 'thin' | 'spilled';

export const LINE = 0.85; // of the cup, where a perfect pour stops
const BAND = 0.045; // either side of it, still perfect (and the rank's steadiness more)
const THIN = 0.6; // short of it, past saving
export const FILL_SECONDS: Record<Pourable, number> = { ale: 1.8, wine: 1.25 }; // from empty to the brim
// What each is worth in tips, of a perfect pour's.
export const GRADE_WORTH: Record<PourGrade, number> = { perfect: 1, frothy: 0.6, short: 0.45, thin: 0.15, spilled: 0 };

// How far either side of the line a pour is still perfect, with the rank's steadiness.
export const bandOf = (steady = 0): number => BAND + steady;

// A pour stopped at `fill` (0..1 of the cup), graded.
export function gradePour(fill: number, steady = 0): PourGrade {
  if (fill >= 1) return 'spilled';
  if (Math.abs(fill - LINE) <= bandOf(steady)) return 'perfect';
  if (fill > LINE) return 'frothy';
  return fill >= THIN ? 'short' : 'thin';
}
