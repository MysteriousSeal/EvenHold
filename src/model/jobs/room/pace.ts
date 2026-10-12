// The hour with a client, played (roomShift.ts; drawn over the dark: controller/story/paceGame.ts): a game of
// keeping their pace. A marker crosses a track once a beat; pressed as it passes the middle, the beat's well kept
// (`GOOD`), a little off, nearly (`NEAR`), wide of it or not pressed at all, missed. Each temper has its own pace
// (a shy one's slow and even, a blunt one's quick, a bold one's changing, a merry one's lilting: `PACES`), and those
// who are trouble theirs. The tone the hero took at the door, to their taste, widens what counts as kept; not to
// it, narrows it. How it went, 0 to 1 (`score`), is what they're pleased by.
import type { Temper, Trouble } from './roomLines';

export interface Pace {
  periods: readonly number[]; // seconds each beat lasts, in turn
  band: number; // how far from the middle of a beat still counts as well kept, of the beat's length (nearly: twice that)
}

const BAND = 0.13; // (of a beat, either side of its middle)
const TASTE = { liked: 1.45, plain: 1, disliked: 0.8 } as const; // on the band, by the tone taken at the door
const NEAR = 0.5; // what a beat nearly kept is worth, of one well kept
const beats = (n: number, seconds: number): number[] => Array.from({ length: n }, () => seconds);
const turns = (n: number, each: readonly number[]): number[] => Array.from({ length: n }, () => each).flat();

// Each one's pace: how many beats, how long each.
export const PACES: Record<Temper | Trouble, readonly number[]> = {
  shy: beats(9, 1.3), // slow, even
  lonely: beats(9, 1.4), // slower still
  weary: beats(10, 1.15), // unhurried
  blunt: beats(14, 0.75), // quick, even
  bold: [...beats(4, 1.1), ...beats(4, 0.65), ...beats(4, 1.1), ...beats(4, 0.6)], // changing: slow, quick, slow, quicker
  merry: turns(7, [0.6, 1.1]), // lilting: short, long
  skinflint: beats(12, 0.9), // brisk: the hour's paid for
  rough: beats(16, 0.62), // fast, and no let-up
  soldier: beats(14, 0.8), // a march
};

// The pace of one of that temper (or that trouble), the tone taken `liked` by them, or not, or neither here nor there.
export const paceOf = (who: Temper | Trouble, taste: keyof typeof TASTE = 'plain'): Pace => ({ periods: PACES[who], band: BAND * TASTE[taste] });

// A game of it under way.
export class PaceRun {
  beat = 0; // which beat they're on
  readonly marks: number[] = []; // each beat past: 1 well kept, NEAR nearly, 0 missed
  private into = 0; // seconds into this beat
  private pressed = false;

  constructor(readonly pace: Pace) {}

  get done(): boolean {
    return this.beat >= this.pace.periods.length;
  }
  // Where the marker is on its way across, 0 to 1 (the middle: 0.5).
  get at(): number {
    return this.done ? 0 : this.into / this.pace.periods[this.beat];
  }
  // How long this beat lasts (the next's, between two): for the marker's speed.
  get period(): number {
    return this.pace.periods[Math.min(this.beat, this.pace.periods.length - 1)];
  }
  // How it's gone so far, of all of it: 0 to 1.
  get score(): number {
    return this.marks.reduce((a, b) => a + b, 0) / this.pace.periods.length;
  }

  // Time passing: the marker on; a beat ended unpressed is missed.
  update(dt: number): void {
    let left = dt;
    while (!this.done && left > 0) {
      const room = this.pace.periods[this.beat] - this.into;
      if (left < room) return void (this.into += left);
      left -= room;
      if (!this.pressed) this.marks.push(0);
      [this.beat, this.into, this.pressed] = [this.beat + 1, 0, false];
    }
  }

  // Pressed, now: what the beat's worth (once a beat: null for a second press, or with the game over).
  press(): number | null {
    if (this.done || this.pressed) return null;
    const off = Math.abs(this.at - 0.5);
    const worth = off <= this.pace.band ? 1 : off <= this.pace.band * 2 ? NEAR : 0;
    this.marks.push(worth);
    this.pressed = true;
    return worth;
  }
}

// A game played out by pressing each beat `off` from its middle (of a beat's length): how it would score (for
// the tests, and for a hand that isn't there to play it).
export function played(pace: Pace, off = 0): number {
  const run = new PaceRun(pace);
  for (const period of pace.periods) {
    run.update(period * (0.5 + off));
    run.press();
    run.update(period * (0.5 - off));
  }
  return run.score;
}
