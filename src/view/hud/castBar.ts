// A cast under way, as in WoW (chopping a tree: model/skills/lumber.ts; making something: woodworking.ts): a slim bar
// over the hero's head filling toward the next chop, or the next thing made, and what it's at over it ("3 chops left",
// "Oak plank · 4 to make"); gone when they stop. Drawn over the game, as the HUD is.

import type { ToScreen } from './floatingText';

const OVER = 1.5; // world units over their feet

export function createCastBar(): (cast: { progress: number; label: string } | null, hero: { x: number; y: number; z: number }, toScreen: ToScreen) => void {
  const root = document.createElement('div');
  root.className = 'cast-bar';
  root.hidden = true;
  const fill = document.createElement('i');
  const label = document.createElement('span');
  root.append(fill, label);
  document.body.append(root);
  return (cast, hero, toScreen) => {
    root.hidden = !cast;
    if (!cast) return;
    fill.style.width = `${Math.round(cast.progress * 100)}%`;
    if (label.textContent !== cast.label) label.textContent = cast.label;
    const at = toScreen(hero.x, hero.y + OVER, hero.z);
    root.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
  };
}
