// How loud the game is, by bus (all of it, its sound effects, the places' ambience), each 0..1: kept in the browser's
// storage between plays (none to be had, a private window's: the usual ones, unkept).

export interface Volumes {
  master: number;
  effects: number;
  ambience: number;
}

export const USUAL_VOLUMES: Readonly<Volumes> = { master: 0.8, effects: 1, ambience: 0.7 };
const KEY = 'evenhold.volumes';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browserStore = (): Store | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // (storage blocked)
  }
};

// The volumes kept, each one checked (a number 0..1, else the usual).
export function loadVolumes(store: Store | null = browserStore()): Volumes {
  let kept: Partial<Record<keyof Volumes, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') kept = parsed;
  } catch {
    // (unreadable, or not to be read: the usual)
  }
  const of = (key: keyof Volumes) => {
    const v = kept[key];
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : USUAL_VOLUMES[key];
  };
  return { master: of('master'), effects: of('effects'), ambience: of('ambience') };
}

export function saveVolumes(volumes: Volumes, store: Store | null = browserStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(volumes));
  } catch {
    // (full, or not allowed: kept for this play only)
  }
}
