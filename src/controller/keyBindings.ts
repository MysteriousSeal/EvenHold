// The keys the game's actions are on, and the player's own choice of them: each action its keys (the first the one
// that's rebound, any after it kept: the arrows besides W A S D, the right Shift besides the left), the defaults
// unless rebound, kept in the browser's storage between visits (none to be had: the defaults, each visit). A key
// given to one action that another had is swapped: that other gets the first's old key, so none is left without.
// Escape (the pause menu, shutting windows) and the backquote (the cheats) are never rebound.

export type KeyAction =
  | 'up' | 'down' | 'left' | 'right' | 'roll' | 'use' | 'ale' | 'pie'
  | 'attack' | 'guard' | 'focus' | `bar${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
  | 'sheet' | 'bag' | 'journal' | 'skills' | 'levelUp';

export const DEFAULT_KEYS: Readonly<Record<KeyAction, readonly string[]>> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  roll: ['ShiftLeft', 'ShiftRight'],
  use: ['KeyE'],
  ale: ['KeyF'],
  pie: ['KeyG'],
  attack: ['Space'],
  guard: ['KeyQ'],
  focus: ['Tab'],
  bar1: ['Digit1'],
  bar2: ['Digit2'],
  bar3: ['Digit3'],
  bar4: ['Digit4'],
  bar5: ['Digit5'],
  bar6: ['Digit6'],
  bar7: ['Digit7'],
  bar8: ['Digit8'],
  sheet: ['KeyC'],
  bag: ['KeyB'],
  journal: ['KeyL'],
  skills: ['KeyK'],
  levelUp: ['KeyP'],
};
export const KEY_ACTIONS = Object.keys(DEFAULT_KEYS) as KeyAction[];
export const BAR_ACTIONS = KEY_ACTIONS.filter((a) => a.startsWith('bar')) as Array<`bar${number}` & KeyAction>;
export const RESERVED = new Set(['Escape', 'Backquote', 'MetaLeft', 'MetaRight', 'ContextMenu']);
const STORE = 'evenhold.keys';

const fresh = (): Record<KeyAction, string[]> => Object.fromEntries(KEY_ACTIONS.map((a) => [a, [...DEFAULT_KEYS[a]]])) as Record<KeyAction, string[]>;
let keys = fresh();
let byCode = new Map<string, KeyAction>();
const listeners = new Set<() => void>();

function reindex(): void {
  byCode = new Map();
  for (const action of KEY_ACTIONS) for (const code of keys[action]) if (!byCode.has(code)) byCode.set(code, action);
}

// The action a key code is on, if any.
export const actionOf = (code: string): KeyAction | null => byCode.get(code) ?? null;
// The keys an action's on (its first, the rebound one).
export const keysOf = (action: KeyAction): readonly string[] => keys[action];
// The key code an action is first on (a window's toggle key: menu.ts).
export const keyOf = (action: KeyAction): string => keys[action][0] ?? '';
// Whether a key code is on an action.
export const isKey = (action: KeyAction, code: string): boolean => keys[action].includes(code);

// `action` put on `code` (its first key): whatever else had it, given the action's old key in its place. False for a
// reserved key.
export function rebind(action: KeyAction, code: string): boolean {
  if (RESERVED.has(code) || !code) return false;
  const old = keys[action][0];
  for (const other of KEY_ACTIONS) {
    if (other === action) continue;
    const at = keys[other].indexOf(code);
    if (at < 0) continue;
    if (old && !keys[other].includes(old)) keys[other][at] = old;
    else keys[other].splice(at, 1);
  }
  keys[action] = [code, ...keys[action].slice(1).filter((k) => k !== code)];
  changed();
  return true;
}

// Every key back as it came.
export function resetKeys(): void {
  keys = fresh();
  changed();
}

// Told whenever a key's rebound (what shows the keys, redrawn).
export function onKeysChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed(): void {
  reindex();
  try {
    const own = Object.fromEntries(KEY_ACTIONS.filter((a) => keys[a].join() !== DEFAULT_KEYS[a].join()).map((a) => [a, keys[a]]));
    if (Object.keys(own).length) localStorage.setItem(STORE, JSON.stringify(own));
    else localStorage.removeItem(STORE);
  } catch {
    // (no storage: kept for this visit only)
  }
  for (const listener of listeners) listener();
}

// The player's keys, read back (anything unsound in them left as it came).
export function loadKeys(text?: string | null): void {
  keys = fresh();
  let saved: unknown = null;
  try {
    saved = JSON.parse(text === undefined ? localStorage.getItem(STORE) ?? 'null' : text ?? 'null');
  } catch {
    saved = null;
  }
  if (saved && typeof saved === 'object') {
    const taken = new Set<string>();
    for (const action of KEY_ACTIONS) {
      const list = Object.hasOwn(saved, action) ? (saved as Record<string, unknown>)[action] : undefined;
      if (!Array.isArray(list) || !list.length || !list.every((c) => typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c) && !RESERVED.has(c))) continue;
      keys[action] = [...new Set(list as string[])];
    }
    // (two actions on one key, from a damaged save: the later one's back to its defaults)
    for (const action of KEY_ACTIONS) {
      if (keys[action].some((c) => taken.has(c))) keys[action] = DEFAULT_KEYS[action].filter((c) => !taken.has(c));
      for (const c of keys[action]) taken.add(c);
    }
  }
  reindex();
}

const NAMED: Record<string, string> = {
  Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: 'Back', CapsLock: 'Caps',
  ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl', AltLeft: 'Alt', AltRight: 'R Alt',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', IntlBackslash: '<',
};
// A key code as it's printed on the key (KeyE: E, Digit1: 1, Numpad4: Num 4).
export function keyLabel(code: string): string {
  if (!code) return '—';
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}
// An action's first key, printed (`(P)` in a line of text: `(${label('levelUp')})`).
export const label = (action: KeyAction): string => keyLabel(keyOf(action));

loadKeys();
