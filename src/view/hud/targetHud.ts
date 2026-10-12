// The focused enemy's frame, beside the hero's (styles in hud.css): its
// portrait facing the hero (a beast's head, a skull, or the bandit's own head
// and shoulders, as dressed), its name and health. Hidden with no focus. Someone picked out who's no foe (a villager,
// a traveller): their face and name there instead, their health (a friendly green) and level.

import type { Enemy, EnemyKind } from '../../model/types';
import type { Person } from '../../model/hero/selection';
import { titleOf } from '../../model/npcs/npcs';
import { capitalize } from '../../util/text';
import { humanBust } from '../meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../meshes/enemy/wolfVoxels';
import { BOAR_PALETTE, buildBoarHead } from '../meshes/enemy/boarVoxels';
import { BEAR_PALETTE, LYNX_PALETTE, bearHead, lynxHead } from '../meshes/enemy/wildBeastVoxels';
import { SKELETON_PALETTE, bossSkull, buildSkull } from '../meshes/enemy/skeletonVoxels';
import { LORD_PALETTE, buildCrownedSkull } from '../meshes/enemy/lordVoxels';
import { DRAUGR_PALETTE, buildDraugrHead, draugrLook } from '../meshes/enemy/draugrVoxels';
import { ENEMY_STATS } from '../../model/constants';
import { difficulty, isBoss } from '../../model/enemies/enemyLevels'; // (how dangerous a foe is: the bar over its head says so too)
import { GHOST_PALETTE, ghostHead } from '../meshes/enemy/ghostVoxels';
import { voxelIcon } from '../ui/voxelIcon';
import { enemyName } from '../meshes/enemy/enemyParts';
import { BROOD_MOTHER, CAVE_SPIDER, HATCHLING } from '../meshes/enemy/spiderVoxels';
import { BAT_PALETTE, batBody } from '../meshes/enemy/batVoxels';
import { WORM_PALETTE, wormHead } from '../meshes/enemy/wormVoxels';

const PORTRAIT_SIZE = 84; // as the hero's

// Each kind's portrait: a beast's head, or a bandit's own head and shoulders as dressed.
// A bandit's (or their chief's) bust, as dressed.
const humanPortrait = (enemy: Enemy): HTMLCanvasElement => {
  const human = enemy.human!;
  const key = `target:bandit:${JSON.stringify(human.look)}:${JSON.stringify(human.equipment)}`;
  return voxelIcon(key, () => humanBust(human.look, human.equipment, 'left'), PORTRAIT_SIZE);
};

const PORTRAITS: Record<EnemyKind, (enemy: Enemy) => HTMLCanvasElement> = {
  ghost: () => voxelIcon('target:ghost', () => ({ grid: ghostHead(), palette: GHOST_PALETTE }), PORTRAIT_SIZE),
  wolf: () => voxelIcon('target:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), PORTRAIT_SIZE),
  boar: () => voxelIcon('target:boar', () => ({ grid: buildBoarHead(), palette: BOAR_PALETTE }), PORTRAIT_SIZE),
  bear: () => voxelIcon('target:bear', () => ({ grid: bearHead(), palette: BEAR_PALETTE }), PORTRAIT_SIZE),
  lynx: () => voxelIcon('target:lynx', () => ({ grid: lynxHead(), palette: LYNX_PALETTE }), PORTRAIT_SIZE),
  bandit: (enemy) => humanPortrait(enemy),
  banditChief: (enemy) => humanPortrait(enemy), // (his horned helm)
  skeleton: () => voxelIcon('target:skull', () => ({ grid: buildSkull(), palette: SKELETON_PALETTE }), PORTRAIT_SIZE),
  skeletonArcher: () => voxelIcon('target:skull', () => ({ grid: buildSkull(), palette: SKELETON_PALETTE }), PORTRAIT_SIZE),
  draugr: (enemy) => {
    const look = draugrLook(enemy.id); // (as it's dressed)
    return voxelIcon(`target:draugr:${look.head}:${look.beard}`, () => ({ grid: buildDraugrHead(look), palette: DRAUGR_PALETTE }), PORTRAIT_SIZE);
  },
  cryptLord: () => voxelIcon('target:crownedSkull', () => ({ grid: buildCrownedSkull(), palette: LORD_PALETTE }), PORTRAIT_SIZE),
  caveSpider: () => voxelIcon('target:caveSpider', () => ({ grid: CAVE_SPIDER.head.build(), palette: CAVE_SPIDER.palette }), PORTRAIT_SIZE),
  hatchling: () => voxelIcon('target:hatchling', () => ({ grid: HATCHLING.head.build(), palette: HATCHLING.palette }), PORTRAIT_SIZE),
  broodMother: () => voxelIcon('target:broodMother', () => ({ grid: BROOD_MOTHER.head.build(), palette: BROOD_MOTHER.palette }), PORTRAIT_SIZE),
  caveBat: () => voxelIcon('target:caveBat', () => ({ grid: batBody(), palette: BAT_PALETTE }), PORTRAIT_SIZE),
  caveWorm: () => voxelIcon('target:caveWorm', () => ({ grid: wormHead(), palette: WORM_PALETTE }), PORTRAIT_SIZE),
};
const portrait = (enemy: Enemy) => PORTRAITS[enemy.kind](enemy);


// Returns the function to call each frame with the focused enemy (or null)
// and the hero's level.
export function createTargetHud(parent: HTMLElement): (enemy: Enemy | null, heroLevel: number, person?: Person | null, health?: { level: number; hp: number; max: number }) => void {
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
  let shownPerson: Person | null = null;
  return (enemy, heroLevel, person = null, health) => {

    root.hidden = !enemy && !person;
    root.classList.toggle('person', !enemy && !!person);
    // Someone picked out who's no foe (hero/selection.ts): their face, their name and calling, their health and level.
    if (!enemy && person) {
      if (person !== shownPerson) {
        [shownPerson, shownId, shown] = [person, null, ''];
        name.textContent = 'road' in person ? `${person.name} (${capitalize(person.role)})` : titleOf(person);
        delete name.dataset.difficulty;
        delete levelGem.dataset.difficulty;
        frame.querySelector('.target-hud-boss')?.remove();
        frame.querySelector(':scope > canvas')?.remove();
        frame.prepend(voxelIcon(`target:person:${JSON.stringify(person.look)}:${JSON.stringify(person.equipment)}`, () => humanBust(person.look, person.equipment, 'left'), PORTRAIT_SIZE));
        root.classList.remove('hurt', 'passive');
      }
      const { level, hp, max } = health ?? { level: 1, hp: 1, max: 1 };
      const state = `${level}/${hp}/${max}`;
      if (state === shown) return;
      shown = state;
      levelGem.textContent = String(level);
      fill.style.width = `${(hp / max) * 100}%`;
      label.textContent = `${Math.round(hp)} / ${max}`;
      return;
    }
    shownPerson = null;
    if (!enemy) {
      shownId = null;
      return;
    }
    if (enemy.id !== shownId) {
      shownId = enemy.id;
      name.textContent = enemyName(enemy);
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
