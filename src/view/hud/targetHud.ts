// The focused enemy's frame, beside the hero's (styles in hud.css): its
// portrait facing the hero (a beast's head, a skull, or the bandit's own head
// and shoulders, as dressed), its name and health. Hidden with no focus.

import type { Enemy, EnemyKind } from '../../model/types';
import { humanBust } from '../meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../meshes/enemy/wolfVoxels';
import { BOAR_PALETTE, buildBoarHead } from '../meshes/enemy/boarVoxels';
import { SKELETON_PALETTE, bossSkull, buildSkull } from '../meshes/enemy/skeletonVoxels';
import { LORD_PALETTE, buildCrownedSkull } from '../meshes/enemy/lordVoxels';
import { DRAUGR_PALETTE, buildDraugrHead, draugrLook } from '../meshes/enemy/draugrVoxels';
import { ENEMY_STATS } from '../../model/constants';
import { difficulty, isBoss } from '../../model/enemies/enemyLevels'; // (how dangerous a foe is: the bar over its head says so too)
import { GHOST_PALETTE, ghostHead } from '../meshes/enemy/ghostVoxels';
import { voxelIcon } from '../ui/voxelIcon';

const PORTRAIT_SIZE = 84; // as the hero's
const NAMES: Record<EnemyKind, string> = { wolf: 'Wolf', bandit: 'Bandit', boar: 'Boar', skeleton: 'Skeleton', skeletonArcher: 'Skeleton archer', draugr: 'Draugr', cryptLord: 'Crypt lord', ghost: 'Ghost' };

// Each kind's portrait: a beast's head, or a bandit's own head and shoulders as dressed.
const PORTRAITS: Record<EnemyKind, (enemy: Enemy) => HTMLCanvasElement> = {
  ghost: () => voxelIcon('target:ghost', () => ({ grid: ghostHead(), palette: GHOST_PALETTE }), PORTRAIT_SIZE),
  wolf: () => voxelIcon('target:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), PORTRAIT_SIZE),
  boar: () => voxelIcon('target:boar', () => ({ grid: buildBoarHead(), palette: BOAR_PALETTE }), PORTRAIT_SIZE),
  bandit: (enemy) => {
    const human = enemy.human!;
    const key = `target:bandit:${JSON.stringify(human.look)}:${JSON.stringify(human.equipment)}`;
    return voxelIcon(key, () => humanBust(human.look, human.equipment, 'left'), PORTRAIT_SIZE);
  },
  skeleton: () => voxelIcon('target:skull', () => ({ grid: buildSkull(), palette: SKELETON_PALETTE }), PORTRAIT_SIZE),
  skeletonArcher: () => voxelIcon('target:skull', () => ({ grid: buildSkull(), palette: SKELETON_PALETTE }), PORTRAIT_SIZE),
  draugr: (enemy) => {
    const look = draugrLook(enemy.id); // (as it's dressed)
    return voxelIcon(`target:draugr:${look.head}:${look.beard}`, () => ({ grid: buildDraugrHead(look), palette: DRAUGR_PALETTE }), PORTRAIT_SIZE);
  },
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
      // A boss: a gold BOSS tag before its name, a gold skull badge on its portrait's corner.
      const boss = isBoss(enemy.kind);
      if (boss) {
        const tag = document.createElement('span');
        tag.className = 'target-hud-boss-tag';
        tag.textContent = 'Boss';
        name.prepend(tag);
      }
      frame.querySelector('.target-hud-boss')?.remove();
      if (boss) {
        const badge = document.createElement('div');
        badge.className = 'target-hud-boss';
        badge.append(voxelIcon('boss-skull-white', bossSkull, 28)); // (a white skull on the gold)
        frame.append(badge);
      }
      frame.querySelector(':scope > canvas')?.remove(); // (the portrait's own: never the boss badge's)
      frame.prepend(portrait(enemy));
      levelGem.textContent = String(enemy.level);
    }
    root.classList.toggle('passive', ENEMY_STATS[enemy.kind].passive && enemy.state !== 'chase'); // a yellow bar: it only fights back (till it's fighting)
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
