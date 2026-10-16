// The readout in the bottom-left corner (index.html #hud: the version, the seed, where the hero is, the frame rate):
// hidden till the pause menu's Performance is put On (a player's game: nothing of the developer's), kept in the browser.

const STORE = 'evenhold.readout';

let on = false;
try {
  on = localStorage.getItem(STORE) === 'on';
} catch {
  // (no storage: off, this visit)
}

export const readoutOn = (): boolean => on;

// Shown or hidden (the body's readout-on), and kept.
export function setReadoutOn(shown: boolean): void {
  on = shown;
  document.body.classList.toggle('readout-on', on);
  try {
    localStorage.setItem(STORE, on ? 'on' : 'off');
  } catch {
    // (kept for this visit only)
  }
}

// As it was left (the game's start).
export const showReadout = (): void => void document.body.classList.toggle('readout-on', on);
