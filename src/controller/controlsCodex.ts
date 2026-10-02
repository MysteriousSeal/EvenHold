// The game's controls as a codex (the main menu's, the pause menu's):
// grouped (controls.ts), each control its name, a note under it, and its keys
// drawn as keycaps: parchment caps with an ink edge and a deep bevel, a word
// between them ("or", "hold"), W over A S D and the arrows in their keyboard
// shape, a drawn mouse (its button lit, or its wheel). Styles in
// controlsCodex.css; the panel round it is the caller's.

import { CONTROL_GROUPS, type KeyMark } from './controls';
import { el } from '../view/ui/dom';
import './controlsCodex.css';

// A key, drawn.
function mark(m: KeyMark): HTMLElement {
  if ('cap' in m) return el('kbd', `keycap${m.cap.length > 1 ? ' wide' : ''}`, m.cap);
  if ('word' in m) return el('span', 'codex-word', m.word);
  if ('mouse' in m) {
    const mouse = el('span', `keycap-mouse ${m.mouse}`);
    mouse.title = m.mouse === 'wheel' ? 'Mouse wheel' : 'Click';
    return mouse;
  }
  const [top, ...row] = m.cluster === 'wasd' ? ['W', 'A', 'S', 'D'] : ['↑', '←', '↓', '→'];
  const cluster = el('span', 'keycap-cluster');
  cluster.append(el('kbd', 'keycap', top), ...row.map((k) => el('kbd', 'keycap', k)));
  return cluster;
}

export function controlsCodex(): HTMLElement {
  const groups = el('div', 'codex');
  for (const group of CONTROL_GROUPS) {
    const section = el('section', 'codex-group');
    section.append(el('h3', '', group.name));
    for (const c of group.controls) {
      const line = el('div', 'codex-control');
      const what = el('span', 'codex-what', c.what);
      if (c.note) what.append(el('small', '', c.note));
      const keys = el('span', 'codex-keys');
      keys.append(...c.marks.map(mark));
      line.append(what, keys);
      section.append(line);
    }
    groups.append(section);
  }
  return groups;
}
