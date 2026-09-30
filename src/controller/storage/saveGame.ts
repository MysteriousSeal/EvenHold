// Keeping the game between visits: each world (seed) has its own save in the
// browser's storage, read back when that world is opened again, and written
// every few seconds while playing and whenever the page is left (closed,
// reloaded, or hidden). Storage may be unavailable (a private window, full):
// then the game simply isn't kept.

import type { GameModel } from '../../model/GameModel';
import { parseSave, restore, snapshot } from '../../model/save';

const EVERY = 5_000; // milliseconds between saves while playing
const keyOf = (seed: number) => `evenhold.save.${seed}`;

// Puts this world's saved game back into `model`; returns whether there was one.
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

export interface AutoSave {
  save(): void;
  // Forgets this world's save and stops saving (for a new game).
  forget(): void;
}

export function startAutoSave(model: GameModel): AutoSave {
  let on = true;
  const save = () => {
    if (!on) return;
    try {
      localStorage.setItem(keyOf(model.seed), JSON.stringify(snapshot(model)));
    } catch {
      // not kept, then
    }
  };
  const timer = window.setInterval(save, EVERY);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  return {
    save,
    forget() {
      on = false;
      window.clearInterval(timer);
      try {
        localStorage.removeItem(keyOf(model.seed));
      } catch {
        // nothing to forget
      }
    },
  };
}
