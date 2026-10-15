// The hero's HUD, top left: a portrait (the hero's own voxel head and
// shoulders, redrawn when what they wear changes) with their level on its
// corner and their name on a ribbon over it, and beside it, within its
// height, a health bar, a thin breath bar under it (a fight's short-term
// one: combatMoves.ts), an energy bar and an experience bar.
// Styles in hud.css. Updated every frame, touching the page only when
// something shown has changed.

import './hud.css';
import type { Hero } from '../../model/types';
import { xpToNext } from '../../model/hero/heroStats';
import { maxEnergyOf, maxHpOf } from '../../model/hero/attributes';
import { humanBust } from '../meshes/human/humanFigure';
import { voxelIcon } from '../ui/voxelIcon';
import { el } from '../ui/dom';
import { BREATH } from '../../model/hero/combatMoves';

const PORTRAIT_SIZE = 84;


// Returns the function to call each frame.
export function createHeroHud(hero: Hero, parent: HTMLElement, moves: { breath: number; most: number }): () => void {
  const root = el('div', 'hero-hud');
  const portrait = el('div', 'hero-hud-portrait');
  const level = el('div', 'hero-hud-level');
  const bars = el('div', 'hero-hud-bars');
  const bar = (className: string) => {
    const node = el('div', `hero-hud-bar ${className}`);
    const fill = el('i');
    const label = el('span');
    node.append(fill, label);
    bars.append(node);
    return { node, fill, label };
  };
  const name = el('div', 'hero-hud-name'); // on a ribbon over the portrait's top
  name.textContent = hero.name;
  const hp = bar('hero-hud-hp');
  const breath = bar('hero-hud-breath');
  breath.node.title = 'Breath: spent by rolls and blocks, back in a moment'; // (what the thin bar is, on hover)
  const energy = bar('hero-hud-energy');
  const xp = bar('hero-hud-xp');
  portrait.append(level, name);
  root.append(portrait, bars);
  parent.append(root);

  let shown = '';
  let dressed = '';
  return () => {
    const outfit = JSON.stringify([hero.look, hero.equipment]); // their look (a cheat can change it) and what they wear
    if (outfit !== dressed) {
      dressed = outfit;
      const canvas = voxelIcon(`bust:${outfit}`, () => humanBust(hero.look, hero.equipment), PORTRAIT_SIZE);
      portrait.querySelector('canvas')?.remove();
      portrait.prepend(canvas);
    }
    if (name.textContent !== hero.name) name.textContent = hero.name; // a new hero (a cheat)
    const max = maxHpOf(hero);
    const need = xpToNext(hero.level);
    // Whole points only, in both the bar and the label, so they always agree
    // (healing fills in a point at a time).
    const health = Math.floor(hero.hp);
    const awake = Math.ceil(hero.energy);
    const winded = Math.round(moves.breath);
    const state = `${health}/${max}/${awake}/${hero.level}/${hero.xp}/${hero.hurtFor > 0}/${hero.statPoints > 0}/${maxEnergyOf(hero)}/${winded}/${moves.most}/${!!hero.draught}`;
    if (state === shown) return;
    shown = state;
    root.classList.toggle('hurt', hero.hurtFor > 0);
    root.classList.toggle('mending', !!hero.draught); // (a potion's heal over time: the bar aglow while it runs)
    level.textContent = String(hero.level);
    level.classList.toggle('points', hero.statPoints > 0); // points to spend: a mark on it
    hp.fill.style.width = `${(health / max) * 100}%`;
    hp.label.textContent = `${health} / ${max}`;
    breath.fill.style.width = `${(winded / moves.most) * 100}%`;
    breath.node.style.width = `${(100 * moves.most) / BREATH}%`; // (of the bars' width, hud.css's: shorter, tired)
    breath.node.classList.toggle('empty', winded <= 0);
    breath.node.classList.toggle('full', winded >= moves.most); // (faint while full: it draws the eye once it moves)
    const most = maxEnergyOf(hero);
    energy.fill.style.width = `${(awake / most) * 100}%`;
    energy.label.textContent = `${awake} / ${most}`;
    xp.fill.style.width = `${(hero.xp / need) * 100}%`;
    xp.label.textContent = `${hero.xp} / ${need} xp`;
  };
}
