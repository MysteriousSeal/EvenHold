// The work a hero can take up, to be what they like rather than only a sword for hire: each job where it's had and
// who gives it, its ranks (risen by work well done: experience in the job, its own), and what each rank brings. The
// hero's record in each (their experience, shifts worked, their best) is kept with them, and saved.
// The jobs: serving the inn's tables (innShift.ts: a shift's work).

export type JobId = 'innServer';

// A rank in a job, and what it brings.
export interface JobRank {
  name: string;
  from: number; // the job's experience it takes
  tray: number; // orders carried at once
  patience: number; // seconds more patrons wait before walking out
  tips: number; // tips, times
}

export interface Job {
  name: string;
  where: string; // where it's posted
  about: string; // what it is, in a line
  ranks: readonly JobRank[];
}

export const JOBS: Record<JobId, Job> = {
  innServer: {
    name: 'Serving the tables',
    where: "Posted on every inn's notice board",
    about: "Take the patrons' orders, fetch them from the bar, set them down before they lose patience, and clear the tables. A wage and a tip for each, all paid when the shift ends.",
    ranks: [
      { name: 'Pot-washer', from: 0, tray: 1, patience: 0, tips: 1 },
      { name: 'Serving hand', from: 10, tray: 2, patience: 5, tips: 1.2 },
      { name: 'Server', from: 30, tray: 2, patience: 10, tips: 1.4 },
      { name: 'Head server', from: 60, tray: 3, patience: 15, tips: 1.7 },
      { name: 'Keeper of the floor', from: 100, tray: 3, patience: 20, tips: 2 },
    ],
  },
};

export const JOB_IDS = Object.keys(JOBS) as JobId[];

// The hero's record in a job.
export interface JobRecord {
  xp: number; // experience in it
  shifts: number; // worked to the end
  served: number; // all told
  best: number; // most served in a shift
  earned: number; // copper, all told
}

export const freshRecord = (): JobRecord => ({ xp: 0, shifts: 0, served: 0, best: 0, earned: 0 });

// The hero's record in `job` (a fresh one, made, if they've none yet).
export function recordOf(hero: { jobs?: Partial<Record<JobId, JobRecord>> }, job: JobId): JobRecord {
  hero.jobs ??= {};
  return (hero.jobs[job] ??= freshRecord());
}

// Their rank in a job, by its experience; and the next one (null at the top), with how far toward it they are (0..1).
export function rankIn(job: JobId, xp: number): { rank: JobRank; index: number; next: JobRank | null; toward: number } {
  const { ranks } = JOBS[job];
  let index = 0;
  while (index + 1 < ranks.length && xp >= ranks[index + 1].from) index++;
  const [rank, next] = [ranks[index], ranks[index + 1] ?? null];
  return { rank, index, next, toward: next ? (xp - rank.from) / (next.from - rank.from) : 1 };
}

// A save's jobs, as far as they're sound (an older save's: none).
export function readJobs(saved: unknown): Partial<Record<JobId, JobRecord>> {
  const out: Partial<Record<JobId, JobRecord>> = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const job of JOB_IDS) {
    const r = (saved as Record<string, Partial<JobRecord>>)[job];
    if (!r) continue;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    out[job] = { xp: n(r.xp), shifts: n(r.shifts), served: n(r.served), best: n(r.best), earned: n(r.earned) };
  }
  return out;
}
