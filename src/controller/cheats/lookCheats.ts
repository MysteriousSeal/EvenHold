// The cheat menu's Appearance tab (cheatPanel.ts): the hero's body, look and hair; whole outfits; each slot in turn.
import type { GameModel } from '../../model/GameModel';
import { BANDIT_OUTFIT, EQUIP_SLOTS, ITEMS, ITEM_IDS, SLOT_NAMES, STARTER_SET, pickOutfit, slotOf, wear } from '../../model/human/equipment';
import { HERO_LOOK, STYLES_OF, randomLook, type HairStyle } from '../../model/human/humanoid';
import { RARITIES, baseOf, gearKey, gearName, type GearKey } from '../../model/human/items/gear';
import { randomName } from '../../model/npcs/npcs';
import type { MenuAction } from '../../view/ui/menu';
import { HEROINE_LOOK, ICONS as ICON, itemIcon } from './cheatIcons';
import { give, group, toggle } from './cheatRows';

const STYLE_NAMES: Record<HairStyle, string> = {
  short: 'Short',
  long: 'Long',
  cropped: 'Cropped',
  bald: 'Bald',
  braid: 'Braid',
  bun: 'Bun',
  ponytail: 'Ponytail',
  twinBraids: 'Twin braids',
  crownBraid: 'Crown braid',
  waves: 'Loose waves',
  pigtails: 'Pigtails',
  bob: 'Bob',
  topknot: 'Topknot',
  shaggy: 'Shaggy',
  warriorTail: 'Warrior tail',
};

export function lookActions(model: GameModel): MenuAction[] {
  let banditDraws = 0; // for "Random bandit": a new outfit each time
  // Replaces everything the hero wears with `items`.
  const dress = (items: readonly GearKey[]) => {
    for (const slot of EQUIP_SLOTS) delete model.hero.equipment[slot];
    for (const item of items) wear(model.hero.equipment, item);
  };
  return [
    ...group('Body', [
      {
        icon: ICON.undress,
        title: 'Random new look',
        detail: 'Another body, face, hair and name, at random',
        run: () => {
          model.hero.look = randomLook();
          model.hero.name = randomName(model.hero.look.build);
          return `Now ${model.hero.name}.`;
        },
      },
      {
        icon: ICON.heroine,
        title: "Woman's body",
        detail: 'The hero as a woman (off: a man)',
        ...toggle(
          () => model.hero.look.build === 'female',
          (on) => (model.hero.look = on ? { ...HEROINE_LOOK } : { ...HERO_LOOK }),
          'The hero is a woman.',
          'The hero is a man.',
        ),
      },
      {
        icon: ICON.heroine,
        title: 'Next hairstyle',
        detail: 'Each click, the next style',
        current: () => ({ value: STYLE_NAMES[model.hero.look.hairStyle] }),
        run: () => {
          const styles = STYLES_OF[model.hero.look.build];
          const next = styles[(styles.indexOf(model.hero.look.hairStyle) + 1) % styles.length];
          model.hero.look = { ...model.hero.look, hairStyle: next };
          return `Hair: ${STYLE_NAMES[next]}.`;
        },
      },
    ]),
    ...group('Outfits', [
      { icon: ICON.undress, title: 'Undress', detail: 'Back to the bare body', run: () => (dress([]), 'Undressed.') },
      { icon: ICON.undress, title: 'Seen bare', detail: "Nothing on, to look at. What's worn stays worn, and still counts", ...toggle(() => model.seenBare, (on) => (model.seenBare = on), 'Seen with nothing on.', 'Dressed, as worn.') },
      { icon: ICON.starterSet, title: 'Starter set', detail: 'Everything the hero starts out with', run: () => (dress(STARTER_SET), 'Wearing the starter set.') },
      { icon: ICON.starterSet, title: 'Gear of each rarity', detail: 'A piece of each, at your level, into the bag', run: () => (give(model, RARITIES.map((rarity, i) => gearKey({ item: STARTER_SET[i % STARTER_SET.length], level: model.hero.level, rarity, roll: Math.floor(Math.random() * 1000) }))), 'Five pieces, common to legendary, in the bag.') },
      { icon: ICON.banditOutfit, title: 'Bandit outfit', detail: 'Hood, vest, gloves, trousers, boots, sword', run: () => (dress(BANDIT_OUTFIT), 'Wearing the bandit outfit.') },
      { icon: ICON.bandit, title: 'Random bandit outfit', detail: 'A new mix of what bandits wear, each time', run: () => (dress(Object.values(pickOutfit('bandit', ++banditDraws, 7))), 'Dressed as a bandit.') },
    ]),
    // One row per slot: each use puts on the slot's next item (then nothing, then round again).
    ...group(
      'Each slot',
      EQUIP_SLOTS.map((slot): MenuAction => {
        const choices = [undefined, ...ITEM_IDS.filter((item) => slotOf(item) === slot)];
        const worn = () => model.hero.equipment[slot];
        return {
          title: SLOT_NAMES[slot],
          run: () => {
            const now = worn();
            const next = choices[(choices.indexOf(now && baseOf(now)) + 1) % choices.length];
            if (next) wear(model.hero.equipment, next);
            else delete model.hero.equipment[slot];
            return next ? `${ITEMS[next].name} on.` : `Nothing on the ${SLOT_NAMES[slot].toLowerCase()}.`;
          },
          current: () => {
            const item = worn();
            return { detail: item ? gearName(item) : 'Nothing', icon: item ? itemIcon(item) : undefined, value: `${choices.indexOf(item && baseOf(item))} of ${choices.length - 1}` };
          },
        };
      }),
    ),
  ];
}
