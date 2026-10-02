import type { BarMenuItem } from './trade/barOrder';

export type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_BINDINGS: Readonly<Record<string, Direction>> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const ATTACK_KEY = 'Space';
const PICKUP_KEY = 'KeyE';
const FOCUS_KEY = 'Tab'; // the next foe (Shift: back)
const ROLL_KEYS = ['ShiftLeft', 'ShiftRight']; // a roll, as Shift's pressed
const GUARD_KEY = 'KeyQ'; // held: the guard raised
const ACTION_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8']; // the action bar's slots (hero/actionBar.ts)
const ORDER_KEYS: Record<string, BarMenuItem> = { KeyF: 'ale', KeyG: 'pie' }; // at the bar: order an ale, or a pie

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

  // Which way to turn the focus, once per press of Tab ('back' with Shift); else null.
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
    if (ROLL_KEYS.includes(e.code)) {
      if (isDown && !e.repeat) this.rollRequested = true;
      return;
    }
    if (ACTION_KEYS.includes(e.code)) {
      if (isDown && !e.repeat) this.actionRequested = ACTION_KEYS.indexOf(e.code);
      return;
    }
    if (e.code === GUARD_KEY) {
      this.guardHeld = isDown;
      return;
    }
    if (e.code in ORDER_KEYS) {
      if (isDown && !e.repeat) this.orderRequested = ORDER_KEYS[e.code];
      return;
    }
    if (e.code === PICKUP_KEY) {
      if (isDown && !e.repeat) this.pickupRequested = true;
      return;
    }
    if (e.code === FOCUS_KEY) {
      e.preventDefault(); // (never off to the page's buttons)
      if (isDown && !e.repeat) this.focusRequested = e.shiftKey ? 'back' : 'next';
      return;
    }
    if (e.code === ATTACK_KEY) {
      e.preventDefault(); // no page scroll, no re-clicking a focused button
      if (isDown && !e.repeat) this.attackRequested = true;
      return;
    }
    const direction = KEY_BINDINGS[e.code];
    if (!direction) return;
    if (isDown) this.pressed.add(direction);
    else this.pressed.delete(direction);
  }
}
