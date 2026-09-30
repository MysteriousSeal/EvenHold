// The hero sheet, opened and closed with C, like an MMO's character panel:
// the hero as dressed, turning slowly, with a slot for each piece of gear
// around them (drag one into the bag, or onto the ground; drag gear from the
// bag onto the hero to wear it), and their stats underneath: health and
// energy, the four stats (with what gear adds), armour, and what they come
// to in a fight. It sits on the left, under the HUD, and the game plays on around it.

import type { GameModel } from '../../model/GameModel';
import { HERO_SPEED } from '../../model/constants';
import { ITEMS, SLOT_NAMES, type EquipSlot } from '../../model/human/equipment';
import { xpToNext } from '../../model/hero/heroStats';
import { armorOf, blowOf, critChanceOf, dodgeChanceOf, gearStats, maxEnergyOf, maxHpOf, statsOf } from '../../model/hero/attributes';
import { STATS, STAT_NAMES, type Stat } from '../../model/hero/statKinds';
import { POINTS_PER_LEVEL } from '../../model/hero/training';

import { gearLines } from './gearLines';
import { STAT_DOES } from './statText';
import { humanFigure } from '../../view/meshes/human/humanFigure';
import { gearIcon, slotPlaceholder } from '../../view/ui/itemIcons';
import { createMenu, type DollSlot, type Menu } from '../../view/ui/menu';
import { FigureStage } from '../../view/ui/figureStage';
import { counted, percent } from '../../view/ui/words';

const LEFT: EquipSlot[] = ['head', 'neck', 'shoulders', 'torso'];
const RIGHT: EquipSlot[] = ['hands', 'legs', 'feet', 'ring'];
const BOTTOM: EquipSlot[] = ['mainHand', 'offHand'];

// Returns the function to call each frame: it redraws the sheet when the
// hero's gear or stats changed.
// `levelUp`: opens the level-up window (P), to spend points.
export function createHeroSheet(model: GameModel, hooks: { levelUp?(): void } = {}): { menu: Menu; update(): void } {
  const { hero } = model;
  const stage = new FigureStage(180, 250); // the hero, turning slowly
  let dressedAs = '';
  const slot = (which: EquipSlot): DollSlot => {
    const item = hero.equipment[which];
    return {
      label: SLOT_NAMES[which],
      accepts: which,
      placeholder: slotPlaceholder(which),
      slot: item
        ? {
            icon: gearIcon(item),
            title: ITEMS[item].name,
            lines: [SLOT_NAMES[which], ...gearLines(item), 'Drag into your bag, or onto the ground'],
            // Onto another window (the bag): into the bag. Onto the world: on the ground.
            fits: which,
            dragOut: (over) => void (over?.closest('.menu') ? model.unequip(which) : model.dropEquipped(which)),
          }
        : null,
    };
  };
  const menu = createMenu({
    title: 'Hero',
    toggleKey: 'KeyC',
    keyHints: false,
    modal: false,
    place: 'left',
    tabs: [
      {
        name: 'Hero',
        doll: () => {
          const dressed = JSON.stringify([hero.look, hero.equipment]);
          if (dressed !== dressedAs) {
            dressedAs = dressed;
            // Framed on the bare body, so whatever's worn or held never changes its size or tilts its turn.
            stage.show(humanFigure(hero.look, hero.equipment), humanFigure(hero.look, {}));
          }
          return {
            figure: stage.canvas,
            left: LEFT.map(slot),
            right: RIGHT.map(slot),
            bottom: BOTTOM.map(slot),
          };
        },
        facts: () => {
          const stats = statsOf(hero);
          const gear = gearStats(hero);
          const armor = armorOf(hero);
          const soFrom = (s: Stat) => `${stats[s] - gear[s]} from points you've spent${gear[s] ? `, +${gear[s]} from your gear` : ''}`;
          // Two columns (menu.css): the hero on the left, their stats and what they come to on the right.
          return [
            ['Level', String(hero.level), [`Each level: ${counted(POINTS_PER_LEVEL, 'point')} to spend on your stats (P), 2 more health, and health back in full`]],
            ['Experience', `${hero.xp} / ${xpToNext(hero.level)}`, [`${xpToNext(hero.level) - hero.xp} more to level ${hero.level + 1}`, 'Won by slaying foes and handing in quests']],
            ['Health', `${Math.floor(hero.hp)} / ${maxHpOf(hero)}`, ['More with Stamina', 'Never comes back by itself: eat, drink, or sleep in a bed']],
            ['Energy', `${Math.floor(hero.energy)} / ${maxEnergyOf(hero)}`, ['More with Endurance', 'Spent through the day, slept back in a bed', 'Under a quarter: tired, a slower walk']],
            ['Armour', String(armor), [`${Math.floor(armor / 5)} less damage from each blow taken (1 for every 5), never under 1`, 'From what you wear']],
            ['Damage', `${blowOf(hero)} a blow`, ['More with Strength', 'Double on a critical blow']],
            ['Speed', `${HERO_SPEED} a second`, ['Tiles walked in a second (slower when tired)']],
            ['Points', String(hero.statPoints), [`To spend on your stats, in the level-up window (P)`, `${counted(POINTS_PER_LEVEL, 'point')} more with each level`]],
            ...STATS.map((s): [string, string, string[]] => [STAT_NAMES[s], gear[s] ? `${stats[s]} (+${gear[s]})` : String(stats[s]), [STAT_DOES[s], soFrom(s)]]),
            ['Dodge', percent(dodgeChanceOf(hero)), ['The chance an enemy\'s blow misses you', 'More with Agility (at most 40%)']],
            ['Critical', percent(critChanceOf(hero)), ['The chance a blow of yours does double damage', 'More with Agility (at most 40%)']],
          ];
        },
        // Points to spend: a button to the level-up window.
        footer: () => {
          const box = document.createElement('div');
          box.className = 'sheet-points';
          if (hero.statPoints > 0 && hooks.levelUp) {
            const button = document.createElement('button');
            button.className = 'menu-button teal sheet-spend';
            button.textContent = `Spend ${counted(hero.statPoints, 'point')} (P)`;
            button.addEventListener('click', () => hooks.levelUp!());
            box.append(button);
          }
          return box;
        },
      },
    ],
  });
  let shown = '';
  const update = () => {
    if (menu.isOpen) stage.render();
    const state = `${JSON.stringify(hero.equipment)}|${hero.level}|${hero.xp}|${Math.floor(hero.hp)}|${Math.floor(hero.energy)}|${hero.statPoints}|${JSON.stringify(hero.trained)}`;
    if (state === shown) return;
    shown = state;
    menu.refresh();
  };
  return { menu, update };
}
