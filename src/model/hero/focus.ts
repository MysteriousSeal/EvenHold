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
  const near = at.foes.filter((e) => e.state !== 'dead' && !e.buried && far(e) <= FOCUS_RANGE && sees(e)).sort((a, b) => far(a) - far(b) || a.id - b.id);
  if (near.length === 0) return at.focus(null);
  const now = at.focused ? near.indexOf(at.focused) : -1;
  const next = now < 0 ? (back ? near.length - 1 : 0) : (now + (back ? -1 : 1) + near.length) % near.length;
  at.focus(near[next].id);
}

// Whether a focus on `enemy` is kept: it's there, alive, above ground, and near enough.
export const focusKept = (enemy: Enemy | null, hero: { x: number; z: number }): boolean =>
  !!enemy && enemy.state !== 'dead' && !enemy.buried && Math.hypot(enemy.x - hero.x, enemy.z - hero.z) <= FOCUS_RANGE;

// The foe the hero's focused on: by its id, the foe itself kept to hand (the world's foes not searched for it each ask:
// none focused, mostly, nothing looked through at all).
export class Focus {
  private id: number | null = null;
  private foe: Enemy | null = null;

  constructor(private readonly foes: () => readonly Enemy[]) {}

  get focused(): Enemy | null {
    if (this.id === null) return null;
    if (this.foe?.id !== this.id) this.foe = this.foes().find((e) => e.id === this.id) ?? null;
    return this.foe;
  }

  // Focuses a living foe by id; null (or a dead one, or one under the ground) lets go.
  focus(id: number | null): void {
    const foe = id === null ? undefined : this.foes().find((e) => e.id === id);
    this.id = foe && foe.state !== 'dead' && !foe.buried ? foe.id : null;
  }

  // Let go the moment its foe dies (so the next to strike takes it), or once it's gone or far off.
  keep(hero: { x: number; z: number }): void {
    if (!focusKept(this.focused, hero)) this.id = null;
  }
}
