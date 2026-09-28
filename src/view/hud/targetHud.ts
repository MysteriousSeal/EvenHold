// The focused enemy's frame, beside the hero's (styles in hud.css): its
// portrait facing the hero (a wolf's head, or the bandit's own head and
// shoulders, as dressed), its name and health. Hidden with no focus.

import type { Enemy } from '../../model/types';
import { ENEMY_STATS } from '../../model/constants';
import { humanBust } from '../meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../meshes/enemy/wolfVoxels';
import { voxelIcon } from '../ui/voxelIcon';

const PORTRAIT_SIZE = 64;
const NAMES = { wolf: 'Wolf', bandit: 'Bandit' } as const;

function portrait(enemy: Enemy): HTMLCanvasElement {
  if (enemy.kind === 'wolf') return voxelIcon('target:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), PORTRAIT_SIZE);
  const human = enemy.human!;
  const key = `target:bandit:${JSON.stringify(human.look)}:${JSON.stringify(human.equipment)}`;
  return voxelIcon(key, () => humanBust(human.look, human.equipment, 'left'), PORTRAIT_SIZE);
}

// Returns the function to call each frame with the focused enemy (or null).
export function createTargetHud(parent: HTMLElement): (enemy: Enemy | null) => void {
  const root = document.createElement('div');
  root.className = 'hero-hud target-hud';
  root.hidden = true;
  root.innerHTML =
    '<div class="hero-hud-bars"><div class="target-hud-name"></div><div class="hero-hud-bar hero-hud-hp"><i></i><span></span></div></div><div class="hero-hud-portrait"></div>';
  parent.append(root);
  const name = root.querySelector('.target-hud-name') as HTMLElement;
  const fill = root.querySelector('.hero-hud-hp i') as HTMLElement;
  const label = root.querySelector('.hero-hud-hp span') as HTMLElement;
  const frame = root.querySelector('.hero-hud-portrait') as HTMLElement;

  let shownId: number | null = null;
  let shown = '';
  return (enemy) => {
    root.hidden = !enemy;
    if (!enemy) {
      shownId = null;
      return;
    }
    if (enemy.id !== shownId) {
      shownId = enemy.id;
      name.textContent = NAMES[enemy.kind];
      frame.replaceChildren(portrait(enemy));
    }
    const max = ENEMY_STATS[enemy.kind].hp;
    const hp = Math.max(0, enemy.hp);
    const state = `${enemy.id}/${hp}/${enemy.hurtFor > 0}`;
    if (state === shown) return;
    shown = state;
    root.classList.toggle('hurt', enemy.hurtFor > 0);
    fill.style.width = `${(hp / max) * 100}%`;
    label.textContent = `${hp} / ${max}`;
  };
}
