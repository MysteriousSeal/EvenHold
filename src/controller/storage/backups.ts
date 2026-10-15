// A world's save kept behind the scenes, the last BACKUPS of them (saveGame.ts takes one as the game opens, as it
// stood before this sitting, and another every BACKUP_EVERY of play; and one of a save before it's replaced by a file
// or a backup), so a bad load, a broken update or a mistake can be rolled back from the pause menu (heroFiles.ts). In
// the browser's storage beside the save, the newest first; a backup that can't be read is left out. Full storage: the
// oldest let go, till it fits (none at all, at worst: never the save itself).

import { parseSave } from '../../model/save';
import { START_MINUTES, clockAt } from '../../model/clock';

export const BACKUPS = 3;
export const BACKUP_EVERY = 10 * 60_000; // milliseconds of play
const keyOf = (seed: number) => `evenhold.backups.${seed}`;

// A backup: when it was taken (milliseconds), its hero's level and the game's day then, and the save itself.
export interface Backup {
  at: number;
  level: number;
  day: number;
  raw: string;
}

// The world `seed`'s backups, the newest first (none: no storage, or none kept).
export function backupsOf(seed: number): Backup[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(keyOf(seed)) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.flatMap((b): Backup[] => {
      const data = b && typeof b === 'object' && typeof b.raw === 'string' ? parseSave(b.raw, seed) : null;
      if (!data || typeof b.at !== 'number') return [];
      return [{ at: b.at, raw: b.raw, level: Math.max(1, Math.floor(data.hero.level)), day: clockAt(typeof data.minutes === 'number' && Number.isFinite(data.minutes) ? data.minutes : START_MINUTES).day }];
    }).slice(0, BACKUPS);
  } catch {
    return [];
  }
}

// `raw` kept as the world `seed`'s newest backup (unless it's the newest already), the oldest let go past BACKUPS.
export function keepBackup(seed: number, raw: string | null, now = Date.now()): void {
  if (!raw || !parseSave(raw, seed)) return;
  const kept = backupsOf(seed);
  if (kept[0]?.raw === raw) return;
  const list = [{ at: now, raw }, ...kept.map(({ at, raw }) => ({ at, raw }))].slice(0, BACKUPS);
  for (let n = list.length; n > 0; n--) {
    try {
      localStorage.setItem(keyOf(seed), JSON.stringify(list.slice(0, n)));
      return;
    } catch {
      // (full: one fewer)
    }
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
