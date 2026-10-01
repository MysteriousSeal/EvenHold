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
const ORDER_KEYS: Record<string, BarMenuItem> = { KeyF: 'ale', KeyG: 'pie' }; // at the bar: order an ale, or a pie

export class KeyboardInput {
  private readonly pressed = new Set<Direction>();
  private attackRequested = false;
  private pickupRequested = false;
  private orderRequested: BarMenuItem | null = null;
  private focusRequested: 'next' | 'back' | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    // keyup never fires if focus leaves the page mid-press (e.g. alt-tab),
    // which would otherwise leave the hero running on its own.
    window.addEventListener('blur', () => this.pressed.clear());
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
