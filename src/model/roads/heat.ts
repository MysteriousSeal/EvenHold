// Witch-finder heat: what the bishop's men in grey have heard of the hero, kept by village (the nearest village to
// wherever it was earned). A turning cast (spells/turned.ts) raises it where it was cast, a foe's less than someone's;
// a sex changed by a charm (spells/swaps.ts) too; the story's choices raise it or calm it (story/: `raise`, `calm`).
// It cools a point a game day, every village's. A patrol on the road knows what's been heard near it (`known`: the
// worst of the villages within earshot, fading with distance), and treats the hero by it (patrols.ts):
//  - 0: nothing, a nod as they pass;
//  - 1-2 (SUSPECT): a word, and a lie passes easily;
//  - 3-5 (WANTED): a lie is hard, a bribe dearer;
//  - 6 and over (SEIZE): no questions, they come to take them.
// Kept in the save, with how many of their parties the hero has cut down (`blood`: each one more on the next).
import type { GameEvent, Village } from '../types';
import { DAY_MINUTES } from '../clock';

export const SUSPECT = 1;
export const WANTED = 3;
export const SEIZE = 6;
export const MOST = 9; // heat a village holds, at most
const NEAR = 150; // tiles: what's heard of in a village is known in full this near it
const EARSHOT = 400; // and fading to nothing this far
const TURNED_PERSON = 3; // someone turned (a villager, a traveller): the worst of it
const TURNED_FOE = 1; // a foe turned: witchcraft all the same
const SWAPPED = 2; // a charm that changes someone's sex
// What's told as the heat crosses each mark, somewhere.
const MARKS: ReadonlyArray<[number, string, string]> = [
  [SUSPECT, 'Talk of witchcraft', 'The men in grey will want a word'],
  [WANTED, 'Wanted by the witch-finders', 'A lie will hardly pass them now'],
  [SEIZE, 'To be seized on sight', "The bishop's men will take you to the stocks"],
];

export interface HeatHost {
  readonly villages: readonly Village[];
  readonly minutes: number;
  boardOf(village: Village): number; // (a village's own number: world/liveWorld.ts)
  villageOf(n: number): Village | undefined;
  report?(event: GameEvent): void; // (told as it crosses a mark: SUSPECT, WANTED, SEIZE)
}

export class Heat {
  private readonly by = new Map<number, number>(); // heat, by village number
  blood = 0; // the parties of witch-finders the hero has cut down (each, one more in the next: patrols.ts)
  private cooled: number | null = null; // the game minute it last cooled (null: not yet looked)

  constructor(private readonly host: HeatHost) {}

  // The village nearest `at` (of those known), or null.
  nearest(at: { x: number; z: number }): Village | null {
    let best: Village | null = null;
    let near = Infinity;
    for (const v of this.host.villages) {
      const d = Math.hypot(v.x - at.x, v.z - at.z);
      if (d < near) [best, near] = [v, d];
    }
    return best;
  }

  // Heat in a village.
  of(village: Village): number {
    return this.by.get(this.host.boardOf(village)) ?? 0;
  }

  // Heat raised (or, `amount` under 0, calmed) at the village nearest `at`; what it is there now.
  raise(at: { x: number; z: number }, amount: number, _why = ''): number {
    const village = this.nearest(at);
    if (!village) return 0;
    const n = this.host.boardOf(village);
    const was = this.by.get(n) ?? 0;
    const now = Math.max(0, Math.min(MOST, was + amount));
    const mark = MARKS.find(([at]) => was < at && now >= at && !MARKS.some(([higher]) => higher > at && now >= higher));
    if (mark) this.host.report?.({ kind: 'banner', title: mark[1], line: mark[2] });
    if (now > 0) this.by.set(n, now);
    else this.by.delete(n);
    return now;
  }
  calm = (at: { x: number; z: number }, amount: number): number => this.raise(at, -amount);

  // Every village's heat calmed by `amount` (a fine paid: the slate wiped, in the stocks).
  calmAll(amount = MOST): void {
    for (const [n, heat] of [...this.by]) if (heat - amount > 0) this.by.set(n, heat - amount);
    else this.by.delete(n);
  }

  // What a patrol at `at` knows of the hero: the worst heard within earshot, in full near its village, fading after.
  known(at: { x: number; z: number }): number {
    let most = 0;
    for (const [n, heat] of this.by) {
      const v = this.host.villageOf(n);
      if (!v) continue; // (a village not made just now: too far off to be heard of)
      const d = Math.hypot(v.x - at.x, v.z - at.z);
      const share = d <= NEAR ? 1 : Math.max(0, 1 - (d - NEAR) / (EARSHOT - NEAR));
      most = Math.max(most, Math.floor(heat * share + 1e-9));
    }
    return most;
  }

  // A point off every village's, each game day gone by.
  update(): void {
    const { minutes } = this.host;
    this.cooled ??= minutes;
    while (minutes - this.cooled >= DAY_MINUTES) {
      this.cooled += DAY_MINUTES;
      this.calmAll(1);
    }
  }

  // What raises it as it happens: a turning (someone's, worse than a foe's), a charm changing someone.
  onEvent(event: GameEvent): void {
    if (event.kind === 'transformed') this.raise(event.who, 'kind' in event.who ? TURNED_FOE : TURNED_PERSON, 'a turning');
    else if (event.kind === 'swapped') this.raise(event.who, SWAPPED, 'a changing');
  }

  save(): { by: Array<[number, number]>; blood: number; cooled: number | null } {
    return { by: [...this.by], blood: this.blood, cooled: this.cooled };
  }

  // As saved (an older save's, or anything amiss: none heard of, none cut down).
  load(saved: unknown): void {
    this.by.clear();
    [this.blood, this.cooled] = [0, null];
    if (!saved || typeof saved !== 'object') return;
    const { by, blood, cooled } = saved as Partial<ReturnType<Heat['save']>>;
    for (const e of Array.isArray(by) ? by : []) if (Array.isArray(e) && Number.isFinite(e[0]) && Number.isFinite(e[1]) && e[1] > 0) this.by.set(e[0], Math.min(MOST, Math.round(e[1])));
    if (Number.isInteger(blood) && (blood as number) > 0) this.blood = blood as number;
    if (Number.isFinite(cooled)) this.cooled = cooled as number;
  }
}
