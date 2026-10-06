// Chopping a tree (model/skills/lumber.ts): a slim bar over the hero's head filling toward the next chop, and the
// chops the tree has left beside it; gone when they stop. Drawn over the game, as the HUD is.

import type { ToScreen } from './floatingText';
import { counted } from '../ui/words';

const OVER = 1.5; // world units over their feet

export function createChopBar(): (chop: { progress: number; left: number } | null, hero: { x: number; y: number; z: number }, toScreen: ToScreen) => void {
  const root = document.createElement('div');
  root.className = 'chop-bar';
  root.hidden = true;
  const fill = document.createElement('i');
  const label = document.createElement('span');
  root.append(fill, label);
  document.body.append(root);
  return (chop, hero, toScreen) => {
    root.hidden = !chop;
    if (!chop) return;
    fill.style.width = `${Math.round(chop.progress * 100)}%`;
    const text = `${counted(chop.left, 'chop')} left`;
    if (label.textContent !== text) label.textContent = text;
    const at = toScreen(hero.x, hero.y + OVER, hero.z);
    root.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
  };
}
