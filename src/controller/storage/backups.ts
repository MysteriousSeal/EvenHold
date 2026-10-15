// A world's save kept behind the scenes, the last BACKUPS of them (saveGame.ts takes one as the game opens, as it
// stood before this sitting, and another every BACKUP_EVERY of play; and one of a save before it's replaced by a file
// or a backup), so a bad load, a broken update or a mistake can be rolled back from the pause menu (heroFiles.ts). In
// the browser's storage beside the save, the newest first; a backup that can't be read is left out. Full storage: the
// other worlds' let go, then this one's oldest, till it fits (none at all, at worst: never the save itself).

import { parseSave } from '../../model/save';
import { START_MINUTES, clockAt } from '../../model/clock';

export const BACKUPS = 3;
export const BACKUP_EVERY = 10 * 60_000; // milliseconds of play
const PREFIX = 'evenhold.backups.';
const keyOf = (seed: number) => `${PREFIX}${seed}`;

// A backup: when it was taken (milliseconds), its hero's level and the game's day then, and the save itself.
export interface Backup {
  at: number;
  level: number;
  day: number;
  raw: string;
}

// The world `seed`'s backups, the newest first (none: no storage, or none kept). Read lightly (a save can run to a
// megabyte: each is only parsed whole when it's put back, heroFiles.ts), what's not a backup left out.
export function backupsOf(seed: number): Backup[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(keyOf(seed)) ?? '[]');
    if (!Array.isArray(list)) return [];
    const sound = (b: Partial<Backup> | null): b is Backup => !!b && typeof b === 'object' && typeof b.raw === 'string' && [b.at, b.level, b.day].every((n) => typeof n === 'number' && Number.isFinite(n));
    return list.filter(sound).map(({ at, level, day, raw }) => ({ at, level, day, raw })).slice(0, BACKUPS);
  } catch {
    return [];
  }
}

// `raw` kept as the world `seed`'s newest backup (unless it's the newest already), the oldest let go past BACKUPS.
// Storage full: the other worlds' backups let go first (this world's played now), then this one's oldest.
export function keepBackup(seed: number, raw: string | null, now = Date.now()): void {
  const data = raw ? parseSave(raw, seed) : null;
  if (!raw || !data) return;
  const kept = backupsOf(seed);
  if (kept[0]?.raw === raw) return;
  const minutes = typeof data.minutes === 'number' && Number.isFinite(data.minutes) ? data.minutes : START_MINUTES;
  const list = [{ at: now, level: Math.max(1, Math.floor(data.hero.level)), day: clockAt(minutes).day, raw }, ...kept].slice(0, BACKUPS);
  let freed = false;
  for (let n = list.length; n > 0; ) {
    try {
      localStorage.setItem(keyOf(seed), JSON.stringify(list.slice(0, n)));
      return;
    } catch {
      if (freed) n--; // (full: the other worlds' let go first, then one fewer of its own)
      else forgetOtherBackups(seed);
      freed = true;
    }
  }
}

// Every other world's backups let go (storage full: the world played now kept first); how many worlds' were.
export function forgetOtherBackups(seed: number): number {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k && k.startsWith(PREFIX) && k !== keyOf(seed));
    for (const key of keys) localStorage.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}

// The world `seed`'s backups forgotten (with its save: saveGame.ts forgetWorld).
export function forgetBackups(seed: number): void {
  try {
    localStorage.removeItem(keyOf(seed));
  } catch {
    // (nothing kept anyway)
  }
}
