// The hero's HUD, top left: a portrait (the hero's own voxel head and
// shoulders, redrawn when what they wear changes) with their level on its
// corner, a health bar and an experience bar.
// Styles in hud.css. Updated every frame, touching the page only when
// something shown has changed.

import './hud.css';
import type { Hero } from '../../model/types';
import { maxHpAt, xpToNext } from '../../model/heroStats';
import { humanBust } from '../meshes/human/humanFigure';
import { voxelIcon } from '../ui/voxelIcon';

const PORTRAIT_SIZE = 84;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

// Returns the function to call each frame.
export function createHeroHud(hero: Hero, parent: HTMLElement): () => void {
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
  const hp = bar('hero-hud-hp');
  const xp = bar('hero-hud-xp');
  portrait.append(level);
  root.append(portrait, bars);
  parent.append(root);

  let shown = '';
  let dressed = '';
  return () => {
    const outfit = JSON.stringify(hero.equipment);
    if (outfit !== dressed) {
      dressed = outfit;
      const canvas = voxelIcon(`bust:${outfit}`, () => humanBust(hero.look, hero.equipment), PORTRAIT_SIZE);
      portrait.querySelector('canvas')?.remove();
      portrait.prepend(canvas);
    }
    const max = maxHpAt(hero.level);
    const need = xpToNext(hero.level);
    // Whole points only, in both the bar and the label, so they always agree
    // (healing fills in a point at a time).
    const health = Math.floor(hero.hp);
    const state = `${health}/${max}/${hero.level}/${hero.xp}/${hero.hurtFor > 0}`;
    if (state === shown) return;
    shown = state;
    root.classList.toggle('hurt', hero.hurtFor > 0);
    level.textContent = String(hero.level);
    hp.fill.style.width = `${(health / max) * 100}%`;
    hp.label.textContent = `${health} / ${max}`;
    xp.fill.style.width = `${(hero.xp / need) * 100}%`;
    xp.label.textContent = `${hero.xp} / ${need} xp`;
  };
}
