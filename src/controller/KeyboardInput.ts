import type { BarMenuItem } from './trade/barOrder';
import { BAR_ACTIONS, actionOf, type KeyAction } from './keyBindings';

export type Direction = 'up' | 'down' | 'left' | 'right';

const MOVES: Partial<Record<KeyAction, Direction>> = { up: 'up', down: 'down', left: 'left', right: 'right' };
const ORDERS: Partial<Record<KeyAction, BarMenuItem>> = { ale: 'ale', pie: 'pie' }; // at the bar: order an ale, or a pie

// The game's keys (keyBindings.ts: the player's own, or the defaults), each what it asks of the hero.
export class KeyboardInput {
  private readonly pressed = new Set<Direction>();
  private attackRequested = false;
  private pickupRequested = false;
  private orderRequested: BarMenuItem | null = null;
  private focusRequested: 'next' | 'back' | null = null;
  private rollRequested = false;
  private guardHeld = false;
  private actionRequested: number | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    // keyup never fires if focus leaves the page mid-press (e.g. alt-tab),
    // which would otherwise leave the hero running on its own.
    window.addEventListener('blur', () => [this.pressed.clear(), (this.guardHeld = false)]);
  }

  isPressed(direction: Direction): boolean {
    return this.pressed.has(direction);
  }

  // True once per press of the attack key (holding it doesn't repeat).
  consumeAttack(): boolean {
    const requested = this.attackRequested;
    this.attackRequested = false;
    return requested;
  }

  // True once per press of Shift (holding it doesn't repeat).
  consumeRoll(): boolean {
    const requested = this.rollRequested;
    this.rollRequested = false;
    return requested;
  }

  // Which action bar slot's key was pressed (0 for 1), once per press; else null.
  consumeAction(): number | null {
    const requested = this.actionRequested;
    this.actionRequested = null;
    return requested;
  }

  // Whether the guard key is held.
  get guarding(): boolean {
    return this.guardHeld;
  }

  // True once per press of the pick-up key.
  consumePickup(): boolean {
    const requested = this.pickupRequested;
    this.pickupRequested = false;
    return requested;
  }

  // Which way to turn the focus, once per press of its key ('back' with Shift); else null.
  consumeFocus(): 'next' | 'back' | null {
    const requested = this.focusRequested;
    this.focusRequested = null;
    return requested;
  }

  // What's ordered, once per press of an order key (F: an ale, G: a pie); else null.
  consumeOrder(): BarMenuItem | null {
    const requested = this.orderRequested;
    this.orderRequested = null;
    return requested;
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    const action = actionOf(e.code);
    if (!action) return;
    const press = isDown && !e.repeat;
    const direction = MOVES[action];
    if (direction) {
      if (isDown) this.pressed.add(direction);
      else this.pressed.delete(direction);
      return;
    }
    if (action.startsWith('bar')) {
      if (press) this.actionRequested = BAR_ACTIONS.indexOf(action as (typeof BAR_ACTIONS)[number]);
      return;
    }
    const order = ORDERS[action];
    if (order) {
      if (press) this.orderRequested = order;
      return;
    }
    switch (action) {
      case 'roll':
        if (press) this.rollRequested = true;
        return;
      case 'guard':
        this.guardHeld = isDown;
        return;
      case 'use':
        if (press) this.pickupRequested = true;
        return;
      case 'focus':
        e.preventDefault(); // (never off to the page's buttons)
        if (press) this.focusRequested = e.shiftKey ? 'back' : 'next';
        return;
      case 'attack':
        e.preventDefault(); // no page scroll, no re-clicking a focused button
        if (press) this.attackRequested = true;
        return;
    }
  }
}
