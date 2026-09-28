// The hero sheet, opened and closed with C, like an MMO's character panel:
// the hero as dressed, turning slowly, with a slot for each piece of gear
// around them (drag one into the bag, or onto the ground; drag gear from the
// bag onto the hero to wear it), and their stats underneath. It sits on
// the left, under the HUD, and the game plays on around it.

import type { GameModel } from '../model/GameModel';
import { ATTACK_DURATION, HERO_DAMAGE, HERO_SPEED } from '../model/constants';
import { ITEMS, SLOT_NAMES, type EquipSlot } from '../model/human/equipment';
import { maxHpAt, xpToNext } from '../model/heroStats';
import { humanFigure } from '../view/meshes/human/humanFigure';
import { gearIcon, slotPlaceholder } from '../view/ui/itemIcons';
import { createMenu, type DollSlot } from '../view/ui/menu';
import { FigureStage } from '../view/ui/figureStage';

const LEFT: EquipSlot[] = ['head', 'neck', 'shoulders', 'torso'];
const RIGHT: EquipSlot[] = ['hands', 'legs', 'feet', 'ring'];
const BOTTOM: EquipSlot[] = ['mainHand', 'offHand'];

// Returns the function to call each frame: it redraws the sheet when the
// hero's gear or stats changed.
export function createHeroSheet(model: GameModel): () => void {
  const { hero } = model;
  const stage = new FigureStage(180, 250); // the hero, turning slowly
  let dressedAs = '';
  const slot = (which: EquipSlot): DollSlot => {
    const item = hero.equipment[which];
    return {
      label: SLOT_NAMES[which],
      placeholder: slotPlaceholder(which),
      slot: item
        ? {
            icon: gearIcon(item),
            title: ITEMS[item].name,
            lines: [SLOT_NAMES[which], 'Drag into your bag, or onto the ground'],
            // Onto another window (the bag): into the bag. Onto the world: on the ground.
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
          const dressed = JSON.stringify(hero.equipment);
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
        facts: () => [
          ['Level', String(hero.level)],
          ['Experience', `${hero.xp} / ${xpToNext(hero.level)}`],
          ['Health', `${Math.floor(hero.hp)} / ${maxHpAt(hero.level)}`],
          ['Damage', `${HERO_DAMAGE} per blow`],
          ['Blow', `${ATTACK_DURATION.toFixed(2)} s`],
          ['Speed', `${HERO_SPEED} tiles a second`],
        ],
      },
    ],
  });
  let shown = '';
  return () => {
    if (menu.isOpen) stage.render();
    const state = `${JSON.stringify(hero.equipment)}|${hero.level}|${hero.xp}|${Math.floor(hero.hp)}`;
    if (state === shown) return;
    shown = state;
    menu.refresh();
  };
}
