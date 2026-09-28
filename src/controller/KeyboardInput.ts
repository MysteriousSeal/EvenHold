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

export class KeyboardInput {
  private readonly pressed = new Set<Direction>();
  private attackRequested = false;
  private pickupRequested = false;

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

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    if (e.code === PICKUP_KEY) {
      if (isDown && !e.repeat) this.pickupRequested = true;
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
