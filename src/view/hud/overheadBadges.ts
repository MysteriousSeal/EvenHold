// Badges over the world (the work marks over the inn's patrons, its tables, its counter: meshes/inn/workMarks.ts): a
// short word on a square dark plate rimmed in its ink, a tail under it pointing down at what it's about. Every one
// the same size whatever it says (its word fitted inside), as tall in the world as BADGE_HEIGHT whatever the zoom.
// Drawn on the page over the game, not in its scene: the scene's drawn at half the screen's pixels and blown up
// (render/renderOptions.ts), and a word in it comes out in blocks; here, as crisp as the HUD's.

import type { ToScreen } from './floatingText';

const BADGE_HEIGHT = 0.46; // world units, plate and tail
const EM_TALL = 3.1; // the badge's height in its own ems (hud.css .overhead-badge: plate 2.55, tail 0.55)
const WORD_ROOM = 2.0; // ems across its plate a word may take (inside the rim, a margin either side)
const WORD_EM = 0.85; // a word's size, at most, in ems


export interface BadgeAt {
  text: string;
  ink: string;
  at: { x: number; y: number; z: number }; // in the world: where its tail's tip points
  swell?: number; // times its size (a pulse), 1 if not given
}

// A word's width in ems at Fredoka bold, for fitting it inside the plate (kept once the font's in: before, a stand-in's
// width would stick; with nothing to measure by, about 0.6 an em a letter).
const widths = new Map<string, number>();
let measure: CanvasRenderingContext2D | null | undefined;
function emWidth(text: string): number {
  const known = widths.get(text);
  if (known !== undefined) return known;
  measure ??= document.createElement('canvas').getContext('2d');
  if (!measure) return text.length * 0.6;
  measure.font = "700 100px 'Fredoka', system-ui, sans-serif";
  const w = measure.measureText(text).width / 100;
  if (document.fonts?.check?.(measure.font)) widths.set(text, w);
  return w;
}

export class OverheadBadges {
  private readonly shown = new Map<unknown, { element: HTMLElement; word: HTMLElement; look: string }>();

  // Each frame: the badges there should be (by whatever they're about), each where it points; the rest gone.
  sync(wanted: Map<unknown, BadgeAt>, toScreen: ToScreen): void {
    for (const [key, badge] of this.shown) {
      if (wanted.has(key)) continue;
      badge.element.remove();
      this.shown.delete(key);
    }
    for (const [key, { text, ink, at, swell = 1 }] of wanted) {
      let badge = this.shown.get(key);
      if (!badge) {
        const element = document.createElement('div');
        element.className = 'overhead-badge';
        const word = document.createElement('span');
        element.append(word);
        document.body.append(element);
        badge = { element, word, look: '' };
        this.shown.set(key, badge);
      }
      const look = `${text}|${ink}`;
      if (badge.look !== look) {
        badge.look = look;
        badge.word.textContent = text;
        badge.word.style.fontSize = `${Math.min(WORD_EM, WORD_ROOM / emWidth(text))}em`; // (a long word, smaller: it fits)
        badge.element.style.setProperty('--ink', ink);
      }
      // As tall as BADGE_HEIGHT in the world, whatever the zoom: an em, from how tall a unit up is on screen.
      const tip = toScreen(at.x, at.y, at.z);
      const up = tip.y - toScreen(at.x, at.y + 1, at.z).y;
      badge.element.style.fontSize = `${((BADGE_HEIGHT * up) / EM_TALL) * swell}px`;
      badge.element.style.transform = `translate(${tip.x}px, ${tip.y}px) translate(-50%, calc(-100% - 0.55em))`; // (its tail's tip on the spot)
    }
  }

  clear(): void {
    for (const badge of this.shown.values()) badge.element.remove();
    this.shown.clear();
  }
}
