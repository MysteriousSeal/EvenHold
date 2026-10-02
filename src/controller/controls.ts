// The game's controls, each what it does and its keys: told in the pause menu
// (pauseMenu.ts) and on the main menu (view/ui/mainMenu.ts).

export const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['Move', 'W A S D, or the arrows'],
  ['Strike', 'Space'],
  ['Roll (untouchable a moment)', 'Shift'],
  ['Guard (raise it as a blow lands: parry)', 'Hold Q'],
  ['Action bar (food and drink dragged onto it)', '1 to 8'],
  ['Pick up, talk, sit, open, go in', 'E'],
  ['Focus a foe', 'Click it, or Tab'],
  ['Hero sheet', 'C'],
  ['Bag', 'B'],
  ['Quest journal', 'L'],
  ['Spend points', 'P'],
  ['Zoom', 'Mouse wheel'],
  ['Pause', 'Escape'],
];
