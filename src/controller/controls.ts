// The game's controls, each what it does and its keys (the player's own: keyBindings.ts): told in the pause menu
// (pauseMenu.ts, where they're rebound) and on the main menu (title/mainMenu.ts, grouped, its keys drawn as keycaps).

import { DEFAULT_KEYS, keysOf, label, type KeyAction } from './keyBindings';

// A key's drawing: a cap (its label), a word between caps ("or", "hold"),
// a cluster in its keyboard shape (W over A S D, the arrows), or the mouse.
export type KeyMark = { cap: string } | { word: string } | { cluster: 'wasd' | 'arrows' } | { mouse: 'click' | 'wheel' };

export interface Control {
  what: string;
  note?: string; // (a little more, under it)
  keys: string; // as text
  marks: KeyMark[]; // as drawn
}

const cap = (text: string): KeyMark => ({ cap: text });
const word = (text: string): KeyMark => ({ word: text });
const one = (what: string, action: KeyAction, note?: string, hold = false): Control => ({
  what,
  note,
  keys: `${hold ? 'Hold ' : ''}${label(action)}`,
  marks: hold ? [word('hold'), cap(label(action))] : [cap(label(action))],
});
const either = (what: string, a: KeyAction, b: KeyAction, note?: string, between = 'or'): Control => ({ what, note, keys: `${label(a)} ${between} ${label(b)}`, marks: [cap(label(a)), word(between), cap(label(b))] });
const MOVES: KeyAction[] = ['up', 'left', 'down', 'right'];
const asDefault = (actions: KeyAction[]) => actions.every((a) => keysOf(a).join() === DEFAULT_KEYS[a].join());

// Moving: W over A S D and the arrows as they came; else the four keys each (their first).
function move(): Control {
  if (asDefault(MOVES)) return { what: 'Move', keys: 'W A S D, or the arrows', marks: [{ cluster: 'wasd' }, word('or'), { cluster: 'arrows' }] };
  const [up, left, down, right] = MOVES.map(label);
  return { what: 'Move', note: 'up, left, down, right', keys: [up, left, down, right].join(' '), marks: [up, left, down, right].map(cap) };
}

export function controlGroups(): ReadonlyArray<{ name: string; controls: readonly Control[] }> {
  return [
    {
      name: 'Getting about',
      controls: [
        move(),
        one('Roll', 'roll', 'untouchable a moment'),
        one('Pick up, talk, sit, open, go in', 'use'),
        either('At the inn', 'ale', 'pie', 'sat at the bar: an ale, a pie; by the barmaid: a room'),
        one('Dice', 'dice', 'sat at an inn\'s table across from someone'),
        { what: 'Zoom', keys: 'Mouse wheel', marks: [{ mouse: 'wheel' }] },
      ],
    },
    {
      name: 'Fighting',
      controls: [
        one('Strike', 'attack'),
        one('Guard', 'guard', 'raise it as a blow lands: parry', true),
        { what: 'Focus a foe', keys: `Click it, or ${label('focus')}`, marks: [{ mouse: 'click' }, word('or'), cap(label('focus'))] },
        either('Action bar', 'bar1', 'bar8', 'food and drink dragged onto it', 'to'),
      ],
    },
    {
      name: 'Your hero',
      controls: [
        one('Hero sheet', 'sheet'),
        one('Bag', 'bag'),
        one('Journal', 'journal', 'your quests'),
        one('Skills', 'skills'),
        one('Level up', 'levelUp', 'your points to spend'),
        one('Map', 'map', 'the land you have walked'),
        { what: 'Pause', note: 'or shut the window on top', keys: 'Escape', marks: [cap('Esc')] },
      ],
    },
  ];
}

// Every control as text: what it does (with its note), and its keys.
export const controlsText = (): ReadonlyArray<readonly [string, string]> =>
  controlGroups().flatMap((g) => g.controls.map((c) => [c.note ? `${c.what} (${c.note})` : c.what, c.keys] as const));

// Every key the player can rebind, grouped, each what it does (the pause menu's Keys).
export const REBINDABLE: ReadonlyArray<{ name: string; keys: ReadonlyArray<readonly [KeyAction, string]> }> = [
  { name: 'Getting about', keys: [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'], ['roll', 'Roll'], ['use', 'Pick up, talk, open'], ['ale', 'An ale (at the bar)'], ['pie', 'A pie, a room, sleep'], ['dice', 'Dice (at an inn table)']] },
  { name: 'Fighting', keys: [['attack', 'Strike'], ['guard', 'Guard (held)'], ['focus', 'Focus the next foe'], ...([1, 2, 3, 4, 5, 6, 7, 8] as const).map((n) => [`bar${n}`, `Action bar ${n}`] as const)] },
  { name: 'Windows', keys: [['sheet', 'Hero sheet'], ['bag', 'Bag'], ['journal', 'Journal'], ['skills', 'Skills'], ['levelUp', 'Level up'], ['map', 'Map']] },
];
