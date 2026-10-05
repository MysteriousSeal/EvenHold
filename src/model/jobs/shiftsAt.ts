// The inns where the hero's at work just now (shift.ts), and at which job, for those who'd act otherwise there: the
// inn's own server off her feet while the hero has the tables, its barkeep while they have the bar (inn/innStaff.ts).
// On its own, importing nothing but the job's name: the villagers' rounds ask it, and the shift itself sends villagers
// in (no loop between the two).

import type { Entrance } from '../interiors/interiors';
import type { JobId } from './jobs';

const working = new WeakMap<Entrance, JobId>();

// The job the hero's at in `inn`, if any.
export const onShift = (inn: Entrance): JobId | undefined => working.get(inn);
export const shiftBegun = (inn: Entrance, job: JobId): void => void working.set(inn, job);
export const shiftOver = (inn: Entrance): void => void working.delete(inn);
