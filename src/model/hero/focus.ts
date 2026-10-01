// Turning the hero's focus from foe to foe (Tab, Shift+Tab): among the living
// foes about within FOCUS_RANGE that the hero can see, nearest first, on to
// the next farther (or back to the next nearer), round again past the last;
// nothing to focus, it's let go.

import { FOCUS_RANGE } from '../constants';
import type { Enemy } from '../types';

export interface Focusing {
  readonly hero: { x: number; z: number };
  readonly foes: readonly Enemy[];
  readonly focused: Enemy | null;
  focus(id: number | null): void;
}

export function cycleFocus(at: Focusing, sees: (foe: Enemy) => boolean, back = false): void {
  const far = (e: Enemy) => Math.hypot(e.x - at.hero.x, e.z - at.hero.z);
  const near = at.foes.filter((e) => e.state !== 'dead' && far(e) <= FOCUS_RANGE && sees(e)).sort((a, b) => far(a) - far(b) || a.id - b.id);
  if (near.length === 0) return at.focus(null);
  const now = at.focused ? near.indexOf(at.focused) : -1;
  const next = now < 0 ? (back ? near.length - 1 : 0) : (now + (back ? -1 : 1) + near.length) % near.length;
  at.focus(near[next].id);
}
