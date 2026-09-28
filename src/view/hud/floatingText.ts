// Floating text in the world (like FarHold's): a short line, e.g. coins
// looted, appearing over a point (the hero's head), popping in a little big,
// rising and drifting aside as it fades out. A new one near a fresh one goes
// above it instead of on top.

import { coinParts } from '../ui/coins';

const LIFE = 0.9; // seconds shown
const RISE = 45; // screen pixels a second
const DRIFT = 20; // at most, sideways, pixels a second
const POP = 0.12; // seconds it takes to shrink from popping in
const STACK = 18; // screen pixels a new text goes above a fresh one

type ToScreen = (x: number, y: number, z: number) => { x: number; y: number };

interface Floater {
  element: HTMLElement;
  at: { x: number; y: number; z: number }; // where in the world it appeared
  lift: number; // pixels above that, to clear a fresh one
  drift: number;
  age: number;
}

export interface FloatingText {
  // Shows `content` in `color` over the world point `at`.
  spawn(at: { x: number; y: number; z: number }, content: Array<string | HTMLElement>, color: string): void;
  update(toScreen: ToScreen, dt: number): void;
  // Takes it all away (going in or out a door: rooms have places of their own).
  clear(): void;
}

export function createFloatingText(): FloatingText {
  const floaters: Floater[] = [];
  return {
    spawn(at, content, color) {
      const element = document.createElement('div');
      element.className = 'floating-text';
      element.style.color = color;
      element.append(...content);
      document.body.append(element);
      // Over a fresh one nearby: above it instead.
      let lift = 0;
      for (const other of floaters) if (other.age < LIFE / 2 && Math.hypot(other.at.x - at.x, other.at.z - at.z) < 0.5) lift = Math.max(lift, other.lift + STACK);
      floaters.push({ element, at: { ...at }, lift, drift: (Math.random() * 2 - 1) * DRIFT, age: 0 });
    },
    clear() {
      for (const f of floaters) f.element.remove();
      floaters.length = 0;
    },
    update(toScreen, dt) {
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.age += dt;
        if (f.age >= LIFE) {
          f.element.remove();
          floaters.splice(i, 1);
          continue;
        }
        const p = toScreen(f.at.x, f.at.y, f.at.z);
        const scale = f.age < POP ? 1 + (POP - f.age) * 5 : 1;
        f.element.style.transform = `translate(${p.x + f.drift * f.age}px, ${p.y - f.lift - RISE * f.age}px) translate(-50%, -100%) scale(${scale})`;
        f.element.style.opacity = String(Math.min(1, ((LIFE - f.age) / LIFE) * 2)); // fading over its second half
      }
    },
  };
}

// Coins looted, as floating text: "+" and the amount, each figure followed by its coin.
export function coinText(copper: number): Array<string | HTMLElement> {
  return ['+', ...coinParts(copper)];
}
