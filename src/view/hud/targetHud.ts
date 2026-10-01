// The focused enemy's frame, beside the hero's (styles in hud.css): its
// portrait facing the hero (a beast's head, a skull, or the bandit's own head
// and shoulders, as dressed), its name and health. Hidden with no focus.

import type { Enemy, EnemyKind } from '../../model/types';
import { humanBust } from '../meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../meshes/enemy/wolfVoxels';
import { BOAR_PALETTE, buildBoarHead } from '../meshes/enemy/boarVoxels';
import { SKELETON_PALETTE, buildSkull } from '../meshes/enemy/skeletonVoxels';
import { LORD_PALETTE, buildCrownedSkull } from '../meshes/enemy/lordVoxels';
import { DRAUGR_PALETTE, buildDraugrHead } from '../meshes/enemy/draugrVoxels';
import { ENEMY_STATS } from '../../model/constants';
import { difficulty } from '../../model/enemies/enemyLevels'; // (how dangerous a foe is: the bar over its head says so too)
import { voxelIcon } from '../ui/voxelIcon';

const PORTRAIT_SIZE = 84; // as the hero's
const NAMES: Record<EnemyKind, string> = { wolf: 'Wolf', bandit: 'Bandit', boar: 'Boar', skeleton: 'Skeleton', skeletonArcher: 'Skeleton archer', draugr: 'Draugr', cryptLord: 'Crypt lord' };

// Each kind's portrait: a beast's head, or a bandit's own head and shoulders as dressed.
const PORTRAITS: Record<EnemyKind, (enemy: Enemy) => HTMLCanvasElement> = {
  wolf: () => voxelIcon('target:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), PORTRAIT_SIZE),
  boar: () => voxelIcon('target:boar', () => ({ grid: buildBoarHead(), palette: BOAR_PALETTE }), PORTRAIT_SIZE),
  bandit: (enemy) => {
    const human = enemy.human!;
    const key = `target:bandit:${JSON.stringify(human.look)}:${JSON.stringify(human.equipment)}`;
    return voxelIcon(key, () => humanBust(human.look, human.equipment, 'left'), PORTRAIT_SIZE);
  },
  skeleton: () => voxelIcon('target:skull', () => ({ grid: buildSkull(), palette: SKELETON_PALETTE }), PORTRAIT_SIZE),
  skeletonArcher: () => voxelIcon('target:skull', () => ({ grid: buildSkull(), palette: SKELETON_PALETTE }), PORTRAIT_SIZE),
  draugr: () => voxelIcon('target:draugr', () => ({ grid: buildDraugrHead(), palette: DRAUGR_PALETTE }), PORTRAIT_SIZE),
  cryptLord: () => voxelIcon('target:crownedSkull', () => ({ grid: buildCrownedSkull(), palette: LORD_PALETTE }), PORTRAIT_SIZE),
};
const portrait = (enemy: Enemy) => PORTRAITS[enemy.kind](enemy);


// Returns the function to call each frame with the focused enemy (or null)
// and the hero's level.
export function createTargetHud(parent: HTMLElement): (enemy: Enemy | null, heroLevel: number) => void {
  const root = document.createElement('div');
  root.className = 'hero-hud target-hud';
  root.hidden = true;
  root.innerHTML =
    '<div class="hero-hud-bars"><div class="target-hud-name"></div><div class="hero-hud-bar hero-hud-hp"><i></i><span></span></div></div><div class="hero-hud-portrait"><div class="hero-hud-level"></div></div>';
  parent.append(root);
  const name = root.querySelector('.target-hud-name') as HTMLElement;
  const fill = root.querySelector('.hero-hud-hp i') as HTMLElement;
  const label = root.querySelector('.hero-hud-hp span') as HTMLElement;
  const frame = root.querySelector('.hero-hud-portrait') as HTMLElement;
  const levelGem = root.querySelector('.hero-hud-level') as HTMLElement;

  let shownId: number | null = null;
  let shown = '';
  return (enemy, heroLevel) => {
    root.hidden = !enemy;
    if (!enemy) {
      shownId = null;
      return;
    }
    if (enemy.id !== shownId) {
      shownId = enemy.id;
      name.textContent = enemy.name ?? NAMES[enemy.kind];
      frame.querySelector('canvas')?.remove();
      frame.prepend(portrait(enemy));
      levelGem.textContent = String(enemy.level);
      root.classList.toggle('passive', ENEMY_STATS[enemy.kind].passive); // a yellow bar: it only fights back
    }
    const max = enemy.maxHp;
    const hp = Math.max(0, enemy.hp);
    const state = `${enemy.id}/${hp}/${enemy.hurtFor > 0}/${heroLevel}`;
    if (state === shown) return;
    shown = state;
    root.classList.toggle('hurt', enemy.hurtFor > 0);
    name.dataset.difficulty = levelGem.dataset.difficulty = difficulty(enemy.level, heroLevel);
    fill.style.width = `${(hp / max) * 100}%`;
    label.textContent = `${hp} / ${max}`;
  };
}
