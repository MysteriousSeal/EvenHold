// The pause menu's Keys (pauseMenu.ts): every key the player can rebind (controls.ts REBINDABLE), grouped, each what
// it does and its keycap; one chosen (a click, or Enter) waits for its new key, the next pressed (Escape: left as it
// was); a key another action had is swapped with it (keyBindings.ts). Every key back as it came, and Back. Styles in
// pauseMenu.css.

import { REBINDABLE } from './controls';
import { keysOf, keyLabel, resetKeys, type KeyAction } from './keyBindings';
import { el } from '../view/ui/dom';

export interface KeysScreen {
  node: HTMLElement;
  items: Array<{ node: HTMLElement; act(): void }>; // in the order the arrows go through them
}

// `waiting`: the action waiting for its new key, if any; `choose`: one chosen to rebind; `back`: back to the menu.
export function keysScreen(waiting: KeyAction | null, choose: (action: KeyAction) => void, back: () => void, redraw: () => void): KeysScreen {
  const node = el('div', 'pause-keys-screen');
  const items: KeysScreen['items'] = [];
  const head = el('div', 'gilded-head');
  head.append(el('span', '', 'Keys'));
  const list = el('div', 'pause-keys');
  for (const group of REBINDABLE) {
    const section = el('section', 'pause-keys-group');
    section.append(el('h3', '', group.name));
    for (const [action, what] of group.keys) {
      const row = el('button', `pause-item pause-key${waiting === action ? ' waiting' : ''}`);
      row.type = 'button';
      const [first, ...rest] = keysOf(action);
      const caps = el('span', 'pause-key-caps');
      if (waiting === action) caps.append(el('span', 'pause-key-wait', 'Press a key…'));
      else caps.append(el('kbd', `keycap${keyLabel(first).length > 1 ? ' wide' : ''}`, keyLabel(first)), ...rest.map((k) => el('small', '', `or ${keyLabel(k)}`)));
      row.append(el('b', '', what), caps);
      row.addEventListener('click', () => choose(action));
      section.append(row);
      items.push({ node: row, act: () => choose(action) });
    }
    list.append(section);
  }
  const foot = el('div', 'pause-keys-foot');
  const button = (text: string, act: () => void) => {
    const b = el('button', 'pause-item pause-back', el('b', '', text));
    b.type = 'button';
    b.addEventListener('click', act);
    items.push({ node: b, act });
    return b;
  };
  foot.append(button('Back', back), button('Every key as it came', () => (resetKeys(), redraw())));
  node.append(head, el('p', 'pause-keys-note', waiting ? 'Press the new key · Esc to leave it as it was' : 'Choose one, then press its new key. A key already in use swaps over.'), list, foot);
  return { node, items };
}
