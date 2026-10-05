// The inns where the hero's at work just now (innShift.ts), for those who'd act otherwise there: the inn's own server,
// off her feet while the hero has the tables (inn/innStaff.ts). On its own, importing nothing: the villagers' rounds
// ask it, and the shift itself sends villagers in (no loop between the two).

import type { Entrance } from '../interiors/interiors';

const working = new WeakSet<Entrance>();

export const onShift = (inn: Entrance): boolean => working.has(inn);
export const shiftBegun = (inn: Entrance): void => void working.add(inn);
export const shiftOver = (inn: Entrance): void => void working.delete(inn);
