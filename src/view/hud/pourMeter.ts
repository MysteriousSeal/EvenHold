// Behind the bar (model/jobs/barShift.ts), the pour under way as a tankard drawn beside the hero: filling from the
// bottom, the line it's perfect at marked across it (as wide as the hero's steady hand makes it); amber short of it,
// gold within it, the froth's cream over it, red as it nears the brim. Each pour stopped (or run over), its word
// floating up over the hero: "Perfect!" (a run of them counted), "Frothy", "Short", "Thin", "Spilled!".

import type { BarShift } from '../../model/jobs/barShift';
import { LINE, bandOf, type PourGrade } from '../../model/jobs/pour';
import type { ToScreen } from './floatingText';

const WORDS: Record<PourGrade, { text: string; ink: string }> = {
  perfect: { text: 'Perfect!', ink: '#ffd96a' },
  frothy: { text: 'Frothy', ink: '#f2e6c8' },
  short: { text: 'Short', ink: '#ffc94a' },
  thin: { text: 'Thin!', ink: '#ff6a5a' },
  spilled: { text: 'Spilled!', ink: '#ff6a5a' },
};
const BESIDE = 0.55; // world units to the hero's right, the tankard's middle
const UP = 1.1; // and up from their feet

export class PourMeter {
  private readonly root = document.createElement('div');
  private readonly fill = document.createElement('div');
  private readonly line = document.createElement('div');
  private told = 0; // pours whose word's been shown

  constructor(private readonly word: (at: { x: number; y: number; z: number }, text: string, ink: string) => void) {
    this.root.className = 'pour-meter';
    this.root.hidden = true;
    this.fill.className = 'pour-meter-fill';
    this.line.className = 'pour-meter-line';
    this.root.append(this.fill, this.line);
    document.body.append(this.root);
  }

  // Each frame: the pour, if one's under way, beside the hero; the word for one just stopped.
  update(shift: BarShift | null, hero: { x: number; y: number; z: number }, toScreen: ToScreen): void {
    const last = shift?.last;
    if (!shift) this.told = 0;
    else if (last && last.n > this.told) {
      this.told = last.n;
      const { text, ink } = WORDS[last.grade];
      this.word({ x: hero.x, y: hero.y + 1.3, z: hero.z }, last.grade === 'perfect' && shift.streak > 1 ? `Perfect ×${shift.streak}` : text, ink);
    }
    const pour = shift?.pour;
    this.root.hidden = !pour;
    if (!pour || !shift) return;
    const band = bandOf(shift.rank.steady);
    const fill = Math.min(1, pour.fill);
    this.fill.style.height = `${fill * 100}%`;
    this.line.style.bottom = `${(LINE - band) * 100}%`;
    this.line.style.height = `${band * 2 * 100}%`;
    this.root.dataset.state = fill >= 0.96 ? 'brim' : Math.abs(fill - LINE) <= band ? 'line' : fill > LINE ? 'froth' : 'short';
    this.root.dataset.drink = pour.drink;
    const at = toScreen(hero.x, hero.y + UP, hero.z);
    const side = toScreen(hero.x + BESIDE, hero.y + UP, hero.z - BESIDE);
    this.root.style.transform = `translate(${at.x + Math.abs(side.x - at.x)}px, ${at.y}px) translate(-50%, -50%)`;
  }
}
