// Floating text in the world (like FarHold's): a short line, e.g. coins
// looted, appearing over a point (the hero's head), popping in a little big,
// rising and drifting aside as it fades out. A new one near a fresh one goes
// above it instead of on top. And speech: what someone says, in a bubble
// over their head that stays a while and goes where they go (the barmaid at the bar).

import { coinParts } from '../ui/coins';

const LIFE = 0.9; // seconds shown
const RISE = 45; // screen pixels a second
const DRIFT = 20; // at most, sideways, pixels a second
const POP = 0.12; // seconds it takes to shrink from popping in
const STACK = 18; // screen pixels a new text goes above a fresh one
const SPEECH = { life: 3.2, rise: 6, fade: 0.4 }; // a speech bubble: seconds shown, pixels a second it rises, seconds it fades

// Where a point in the world is on screen, in page pixels (GameView.toScreen): what's drawn over the world goes by it.
export type ToScreen = (x: number, y: number, z: number) => { x: number; y: number };

interface Floater {
  element: HTMLElement;
  at: { x: number; y: number; z: number }; // where in the world it appeared
  lift: number; // pixels above that, to clear a fresh one
  drift: number;
  age: number;
  speech: boolean; // a speech bubble: steadier and longer-lived
  speaker?: { x: number; z: number }; // whom a speech bubble follows
}

export interface FloatingText {
  // Shows `content` in `color` over the world point `at`.
  spawn(at: { x: number; y: number; z: number }, content: Array<string | HTMLElement>, color: string): void;
  // `speaker` saying `text`, in a bubble `height` over them that follows them about (a new one from them replaces the last).
  speak(speaker: { x: number; z: number }, height: number, text: string): void;
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
      floaters.push({ element, at: { ...at }, lift, drift: (Math.random() * 2 - 1) * DRIFT, age: 0, speech: false });
    },
    speak(speaker, height, text) {
      for (let i = floaters.length - 1; i >= 0; i--) {
        if (floaters[i].speaker !== speaker) continue;
        floaters[i].element.remove(); // what they said before gives way
        floaters.splice(i, 1);
      }
      const element = document.createElement('div');
      element.className = 'speech-bubble';
      element.textContent = text;
      document.body.append(element);
      floaters.push({ element, at: { x: speaker.x, y: height, z: speaker.z }, lift: 0, drift: 0, age: 0, speech: true, speaker });
    },
    clear() {
      for (const f of floaters) f.element.remove();
      floaters.length = 0;
    },
    update(toScreen, dt) {
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.age += dt;
        const life = f.speech ? SPEECH.life : LIFE;
        if (f.age >= life) {
          f.element.remove();
          floaters.splice(i, 1);
          continue;
        }
        if (f.speaker) [f.at.x, f.at.z] = [f.speaker.x, f.speaker.z]; // over them, wherever they've gone
        const p = toScreen(f.at.x, f.at.y, f.at.z);
        const scale = f.age < POP ? 1 + (POP - f.age) * (f.speech ? 2 : 5) : 1;
        const rise = f.speech ? SPEECH.rise : RISE;
        f.element.style.transform = `translate(${p.x + f.drift * f.age}px, ${p.y - f.lift - rise * f.age}px) translate(-50%, -100%) scale(${scale})`;
        // Fading: text over its second half; a bubble only at the very end.
        f.element.style.opacity = String(f.speech ? Math.min(1, (life - f.age) / SPEECH.fade) : Math.min(1, ((LIFE - f.age) / LIFE) * 2));
      }
    },
  };
}

// Coins looted, as floating text: "+" and the amount, each figure followed by its coin.
export function coinText(copper: number): Array<string | HTMLElement> {
  return ['+', ...coinParts(copper)];
}
