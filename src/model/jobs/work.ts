// The hero at work (jobs.ts): what's posted on an inn's notice board (its work: E in front of it), a shift taken up
// at an inn (innShift.ts), run while they're in it, paid as they go
// (each order's wage and tip, and some experience of their own besides), and over when its time's up or they leave
// the inn (paid what they've earned; a bonus, the whole shift worked with no one walked out). Their record in the job
// kept (its experience: their rank).

import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import type { Npc } from '../npcs/npcs';
import type { GameEvent, Hero } from '../types';
import { gainXp } from '../hero/heroStats';
import { JOBS, rankIn, recordOf, type JobId } from './jobs';
import { InnShift, type Order, type ShiftAction } from './innShift';

const HERO_XP = 4; // the hero's own experience, an order served (work's a way up too)
// Where one stands to read an inn's notice board (hung on a wall, in a tile against it): before it, no more than
// ALONG either way of its middle, between OUT[0] and OUT[1] out from its wall.
const ALONG = 0.55;
const OUT: [number, number] = [0.25, 1.35];
export const BONUS = 2; // copper an order, the shift worked to its end with no one walked out

export interface WorkHost {
  readonly hero: Hero;
  readonly seed: number;
  readonly inside: { entrance: Entrance; furniture: readonly Furniture[]; below?: Entrance } | null;
  readonly folk: readonly Npc[];
  report(event: GameEvent): void;
}

export class Work {
  shift: InnShift | null = null;
  private job: JobId = 'innServer';

  constructor(private readonly host: WorkHost) {}

  // The inn whose notice board the hero's in front of (its work posted there), or null.
  get noticeInReach(): Entrance | null {
    const { inside, hero } = this.host;
    if (!inside || inside.below || inside.entrance.type !== 'inn') return null;
    const board = inside.furniture.find((f) => f.kind === 'noticeBoard');
    return board && beforeBoard(board, hero) ? inside.entrance : null;
  }

  // A shift serving the tables of `inn` (where the hero is), begun; whether it was (not one under way already).
  start(inn: Entrance): boolean {
    if (this.shift || this.host.inside?.entrance !== inn) return false;
    this.job = 'innServer';
    this.shift = new InnShift(inn, rankIn(this.job, recordOf(this.host.hero, this.job).xp).rank, this.host.seed);
    return true;
  }

  // A moment of the shift: on while they're in its inn; over once its time's up, or they've left.
  update(dt: number): void {
    const { shift } = this;
    if (!shift) return;
    if (this.host.inside?.entrance !== shift.inn) return this.end(true);
    shift.update(this.host.folk, dt);
    if (shift.left <= 0) this.end(false);
  }

  // E at work: whether it did something (an order taken, the tray filled, an order served: paid).
  use(): boolean {
    const { shift } = this;
    if (!shift) return false;
    const paid = shift.use(this.host.hero, this.host.folk);
    if (paid === null) return false;
    if (paid > 0) this.pay(paid);
    return true;
  }

  // R at work: the next on the tray in hand.
  switchHeld(): void {
    this.shift?.switchHeld();
  }

  // What E would do at work now (for the prompt), if anything.
  get action(): ShiftAction | null {
    return this.shift?.actionAt(this.host.hero) ?? null;
  }

  // What's in the hero's hand, at work (the first on the tray), else nothing.
  get carrying(): Order | null {
    return this.shift?.carrying ?? null;
  }

  // An order served: its wage and tip in hand, experience in the job (a rank risen, maybe) and the hero's own.
  private pay(copper: number): void {
    const { hero } = this.host;
    const record = recordOf(hero, this.job);
    const before = rankIn(this.job, record.xp).index;
    hero.money += copper;
    record.earned += copper;
    record.served++;
    record.xp++;
    gainXp(hero, HERO_XP);
    this.host.report({ kind: 'coins', amount: copper });
    const now = rankIn(this.job, record.xp);
    if (now.index > before) {
      this.host.report({ kind: 'jobRank', job: JOBS[this.job].name, rank: now.rank.name });
      if (this.shift) this.shift.rank = now.rank; // (its perks from now on, this shift too)
    }
  }

  // The shift over (`early`: left before its time): the bonus for a clean shift, the record kept, how it went told.
  end(early: boolean): void {
    const { shift } = this;
    if (!shift) return;
    this.shift = null;
    shift.release();
    const record = recordOf(this.host.hero, this.job);
    const bonus = !early && shift.walkedOut === 0 && shift.served > 0 ? BONUS * shift.served : 0;
    if (bonus > 0) {
      this.host.hero.money += bonus;
      record.earned += bonus;
    }
    if (!early) record.shifts++;
    record.best = Math.max(record.best, shift.served);
    this.host.report({ kind: 'shift', job: JOBS[this.job].name, served: shift.served, walkedOut: shift.walkedOut, mixups: shift.mixups, cleared: shift.cleared, earned: shift.earned + bonus, bonus, early });
  }
}

// Where an inn's notice board (hung on its wall, `board`) is seen from the room: the middle of its face, at the wall.
export function boardFace(board: Furniture): { x: number; z: number } {
  const [cx, cz] = [board.x + (board.w - 1) / 2, board.z + (board.d - 1) / 2];
  return board.wall === 'left' ? { x: board.x - 0.5, z: cz } : { x: cx, z: board.z - 0.5 }; // (its wall: the tile's back edge)
}

// Whether `hero` stands before `board`, near enough to read it.
function beforeBoard(board: Furniture, hero: { x: number; z: number }): boolean {
  const face = boardFace(board);
  const [along, out] = board.wall === 'left' ? [hero.z - face.z, hero.x - face.x] : [hero.x - face.x, hero.z - face.z];
  return Math.abs(along) <= ALONG && out >= OUT[0] && out <= OUT[1];
}
