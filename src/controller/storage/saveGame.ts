// Keeping the game between visits: each world (seed) has its own save in the
// browser's storage, read back when that world is opened again, and written
// every few seconds while playing and whenever the page is left (closed,
// reloaded, or hidden). Storage may be unavailable (a private window, full):
// then the game simply isn't kept. Behind the scenes, the last few saves of each world kept besides (backups.ts).

import type { GameModel } from '../../model/GameModel';
import { parseSave, readEquipment, readLook, restore, snapshot } from '../../model/save';
import type { MapSize } from '../../model/map/grid';
import { START_MINUTES, clockAt } from '../../model/clock';
import type { BodyLook } from '../../model/human/humanoid';
import type { Equipment } from '../../model/human/equipment';
import { BACKUP_EVERY, forgetBackups, keepBackup } from './backups';

const EVERY = 5_000; // milliseconds between saves while playing
const PREFIX = 'evenhold.save.';
const keyOf = (seed: number) => `${PREFIX}${seed}`;
const playedKey = (seed: number) => `evenhold.played.${seed}`; // when it was last played (milliseconds), for the main menu's order
export const MAX_WORLDS = 8; // saved here at most: a ninth only once one's let go

// A world saved in this browser, as the main menu lists it: its seed, its hero, how far along, when last played.
export interface SavedWorld {
  seed: number;
  name: string;
  level: number;
  day: number;
  playedAt: number;
  look: BodyLook; // how they look, and what they wear (the main menu draws them)
  equipment: Equipment;
}

// Every world saved here, the last played first (one that can't be read, left out).
export function savedWorlds(): SavedWorld[] {
  const worlds: SavedWorld[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const seed = Number(key.slice(PREFIX.length));
      const data = parseSave(localStorage.getItem(key), seed);
      if (!data) continue;
      const playedAt = Number(localStorage.getItem(playedKey(seed))) || 0;
      const { name, level, look, equipment } = data.hero;
      // (Its look and what it wears as a load would read them: a damaged one's never drawn as it stands.)
      worlds.push({ seed, name, level: Math.max(1, Math.floor(level)), day: clockAt(typeof data.minutes === 'number' && Number.isFinite(data.minutes) ? data.minutes : START_MINUTES).day, playedAt, look: readLook(look), equipment: readEquipment(equipment) });
    }
  } catch {
    return worlds; // (no storage: none)
  }
  return worlds.sort((a, b) => b.playedAt - a.playedAt);
}

// Forgets the world `seed`'s save (its hero, and all they did).
export function forgetWorld(seed: number): void {
  try {
    localStorage.removeItem(keyOf(seed));
    localStorage.removeItem(playedKey(seed));
    forgetBackups(seed);
  } catch {
    // (nothing kept anyway)
  }
}

// Puts this world's saved game back into `model`; returns whether there was one.
// The size of the world a seed's game was saved in (a version 1 save's: a classic world's, 2048 a side), or null if
// there's none: a game goes on in the world it began in.
export function savedSize(seed: number): MapSize | null {
  try {
    const data = parseSave(localStorage.getItem(keyOf(seed)), seed);
    return data ? (data.size ?? { width: 2048, depth: 2048 }) : null;
  } catch {
    return null;
  }
}

export function loadGame(model: GameModel): boolean {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(keyOf(model.seed));
  } catch {
    return false;
  }
  const data = parseSave(raw, model.seed);
  if (!data) return false;
  restore(model, data);
  return true;
}

// Keeps `raw` (a sound save: heroFile.ts readHeroFile, a backup) as the world `seed`'s, the save it replaces backed up
// first; whether it was (not: storage full, or no room for another world).
export function keepSave(seed: number, raw: string): boolean {
  try {
    const was = localStorage.getItem(keyOf(seed));
    if (was === null && savedWorlds().length >= MAX_WORLDS) return false;
    keepBackup(seed, was);
    localStorage.setItem(keyOf(seed), raw);
    localStorage.setItem(playedKey(seed), String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export interface AutoSave {
  save(): void;
  // Forgets this world's save and stops saving (for a new game).
  forget(): void;
  // Stops saving, the save kept as it is (another put in its place: a file, a backup; the page reloaded after).
  stop(): void;
}

export function startAutoSave(model: GameModel): AutoSave {
  let on = true;
  let backedUp = Date.now();
  try {
    keepBackup(model.seed, localStorage.getItem(keyOf(model.seed))); // (the save as it stood before this sitting)
  } catch {
    // (no storage)
  }
  const save = () => {
    if (!on) return;
    if (!Number.isFinite(model.hero.x) || !Number.isFinite(model.hero.z)) return; // (lost somewhere: the last good save kept, not this)
    try {
      // (full: a new world, not kept. Full as the main menu counts it, by the worlds it lists: a save that can't be
      // read takes no place there, so it takes none here either, or the slot it offers would never be kept.)
      if (localStorage.getItem(keyOf(model.seed)) === null && savedWorlds().length >= MAX_WORLDS) return;
      const raw = JSON.stringify(snapshot(model));
      try {
        localStorage.setItem(keyOf(model.seed), raw);
      } catch {
        forgetBackups(model.seed); // (full: the save before its backups)
        localStorage.setItem(keyOf(model.seed), raw);
      }
      localStorage.setItem(playedKey(model.seed), String(Date.now()));
      if (Date.now() - backedUp >= BACKUP_EVERY) [keepBackup(model.seed, raw), (backedUp = Date.now())];
    } catch {
      // not kept, then
    }
  };
  const timer = window.setInterval(save, EVERY);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  const stop = () => {
    on = false;
    window.clearInterval(timer);
  };
  return {
    save,
    forget() {
      stop();
      forgetWorld(model.seed);
    },
    stop,
  };
}
