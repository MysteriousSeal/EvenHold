// The game's controls, each what it does and its keys: told in the pause menu
// (pauseMenu.ts, as text) and on the main menu (mainMenu.ts, grouped, its
// keys drawn as keycaps).

// A key's drawing: a cap (its label), a word between caps ("or", "hold"),
// a cluster in its keyboard shape (W over A S D, the arrows), or the mouse.
export type KeyMark = { cap: string } | { word: string } | { cluster: 'wasd' | 'arrows' } | { mouse: 'click' | 'wheel' };

export interface Control {
  what: string;
  note?: string; // (a little more, under it)
  keys: string; // as text
  marks: KeyMark[]; // as drawn
}

const cap = (label: string): KeyMark => ({ cap: label });
const word = (text: string): KeyMark => ({ word: text });

export const CONTROL_GROUPS: ReadonlyArray<{ name: string; controls: readonly Control[] }> = [
  {
    name: 'Getting about',
    controls: [
      { what: 'Move', keys: 'W A S D, or the arrows', marks: [{ cluster: 'wasd' }, word('or'), { cluster: 'arrows' }] },
      { what: 'Roll', note: 'untouchable a moment', keys: 'Shift', marks: [cap('Shift')] },
      { what: 'Pick up, talk, sit, open, go in', keys: 'E', marks: [cap('E')] },
      { what: 'Zoom', keys: 'Mouse wheel', marks: [{ mouse: 'wheel' }] },
    ],
  },
  {
    name: 'Fighting',
    controls: [
      { what: 'Strike', keys: 'Space', marks: [cap('Space')] },
      { what: 'Guard', note: 'raise it as a blow lands: parry', keys: 'Hold Q', marks: [word('hold'), cap('Q')] },
      { what: 'Focus a foe', keys: 'Click it, or Tab', marks: [{ mouse: 'click' }, word('or'), cap('Tab')] },
      { what: 'Action bar', note: 'food and drink dragged onto it', keys: '1 to 8', marks: [cap('1'), word('to'), cap('8')] },
    ],
  },
  {
    name: 'Your hero',
    controls: [
      { what: 'Hero sheet', keys: 'C', marks: [cap('C')] },
      { what: 'Bag', keys: 'B', marks: [cap('B')] },
      { what: 'Quest journal', keys: 'L', marks: [cap('L')] },
      { what: 'Spend points', keys: 'P', marks: [cap('P')] },
      { what: 'Pause', keys: 'Escape', marks: [cap('Esc')] },
    ],
  },
];

// Every control as text: what it does (with its note), and its keys.
export const CONTROLS: ReadonlyArray<readonly [string, string]> = CONTROL_GROUPS.flatMap((g) =>
  g.controls.map((c) => [c.note ? `${c.what} (${c.note})` : c.what, c.keys] as const),
);
