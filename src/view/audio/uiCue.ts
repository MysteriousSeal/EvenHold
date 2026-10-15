// What's heard of the windows and the counters, told here by whatever did it (a window opened or shut: ui/menu.ts,
// ui/menuStack.ts; coin changing hands, or a sale refused: controller/trade/tradePanel.ts), and played by the sound
// (gameSound.ts) once it's up; nothing before.

export type UiCue = 'open' | 'close' | 'coin' | 'error';

let heard: ((cue: UiCue) => void) | null = null;

export const uiCue = (cue: UiCue): void => heard?.(cue);
export const hearUi = (listener: ((cue: UiCue) => void) | null): void => void (heard = listener);
