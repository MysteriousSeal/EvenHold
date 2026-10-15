// The pause menu's Keys (pauseMenu.ts): every key the player can rebind (controls.ts REBINDABLE), grouped, each what
// it does and its keycap; one chosen (a click, or Enter) waits for its new key, the next pressed (Escape: left as it
// was); a key another action had is swapped with it (keyBindings.ts). Back, and every key back as it came (asked
// once, on the right). Styles in pauseMenu.css.

import { REBINDABLE } from './controls';
import { keysOf, keyLabel, resetKeys, type KeyAction } from './keyBindings';
import { el } from '../view/ui/dom';

export interface KeysScreen {
  node: HTMLElement;
  items: Array<{ node: HTMLElement; act(): void }>; // in the order the arrows go through them
}

let sure = false; // (Every key as it came, clicked once: asking again)
let shown: HTMLElement | null = null; // (the screen last drawn: gone, as on Escape, and it's not asked any more)

// `waiting`: the action waiting for its new key, if any; `choose`: one chosen to rebind; `back`: back to the menu.
export function keysScreen(waiting: KeyAction | null, choose: (action: KeyAction) => void, back: () => void, redraw: () => void): KeysScreen {
  if (!shown?.isConnected) sure = false;
  const node = (shown = el('div', 'pause-keys-screen'));
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
      const pick = () => ((sure = false), choose(action));
      row.addEventListener('click', pick);
      section.append(row);
      items.push({ node: row, act: pick });
    }
    list.append(section);
  }
  const foot = el('div', 'pause-keys-foot');
  const button = (text: string, act: () => void, kind = '') => {
    const b = el('button', `pause-item pause-back${kind}`, el('b', '', text));
    b.type = 'button';
    b.addEventListener('click', act);
    items.push({ node: b, act });
    return b;
  };
  const reset = () => {
    if (!sure) return void ((sure = true), redraw());
    sure = false;
    resetKeys();
    redraw();
  };
  foot.append(
    button('Back', () => ((sure = false), back())),
    button(sure ? 'Reset every key? Click again' : 'Every key as it came', reset, ' danger'), // (on the right, asked once: it undoes them all)
  );
  node.append(head, el('p', 'pause-keys-note', waiting ? 'Press the new key · Esc to leave it as it was' : 'Choose one, then press its new key. A key already in use swaps over.'), list, foot);
  return { node, items };
}
