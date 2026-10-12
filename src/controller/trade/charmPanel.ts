// Learning charms from a village's hedge-witch (E by her, in the herbalist's hut): what she teaches (model/spells/
// teaching.ts), a row each with its price, as a keeper's wares are (tradePanel.ts): hover one for what it does, click
// it (or right-click) to be taught it; its price in red when it's more than the hero has, faded once known or while
// they're too green for it. Her face and word over it, the hero's purse under. The game plays on around it: walk
// away from her, and it shuts.
import './shopPanel.css';
import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { TALK_RANGE } from '../../model/npcs/talk';
import { AIM_WORDS, SPELLS, knows, spellText, type SpellId } from '../../model/spells/spells';
import { TAUGHT, mayLearn, teach, type Taught } from '../../model/spells/teaching';
import { coinParts } from '../../view/ui/coins';
import { el } from '../../view/ui/dom';
import { createMenu, toned, type Menu, type MenuSlot } from '../../view/ui/menu';
import { SPELL_ICONS } from '../../view/ui/spellIcons';
import { pick, talk } from './tradePanel';

const HELLO = ["Words, not herbs. That's what I have. Which do you want?", "My grandmother's sayings, every one. They still work.", 'Sit. No, stand. What do you want to learn?', 'She brews, I mutter. Between us the village gets by.'];
const SAYS: Record<Taught, readonly string[]> = {
  taught: ["Say it after me, slowly. Good. It's in your spellbook now: put it on your bar.", 'There. Mind who you throw it at.', "That's all there is to it. Don't tell the priest."],
  known: ['You have that one already. I heard you muttering it.', "I don't teach a thing twice."],
  level: ["Not yet. You'd only hurt yourself. Come back when you've seen more of the world.", "You're too green for that one."],
  'too poor': ["Words are free. Teaching isn't. Come back with the coin.", 'Your purse is too light for that one.'],
};

export function createCharmPanel(model: GameModel): { open(witch: Npc): void; update(): void; menu: Menu } {
  const { hero } = model;
  let witch: Npc | null = null;
  let says = '';
  const learnIt = (id: SpellId) => {
    says = pick(SAYS[teach(hero, id)]);
    menu.refresh();
  };
  const ware = (id: SpellId): MenuSlot => {
    const spell = SPELLS[id];
    const may = mayLearn(hero, id);
    return {
      icon: SPELL_ICONS[id],
      title: spell.name,
      key: id,
      tag: knows(hero, id) ? ['Known'] : coinParts(spell.price),
      badge: may === 'level' ? `Lv ${spell.level}` : undefined,
      dim: may === 'known' || may === 'level',
      warn: may === 'too poor',
      lines: [
        toned('kind', `Charm · ${AIM_WORDS[spell.aim]}`),
        toned('stat', spellText(id)),
        toned('flavor', spell.about),
        toned('hint', may === 'known' ? 'You know it: it is in your spellbook (N)' : may === 'level' ? `Taught from level ${spell.level}` : 'Click to be taught it'),
      ],
      use: () => learnIt(id),
      alt: () => learnIt(id),
    };
  };
  const menu = createMenu({
    title: 'Charms',
    keyHints: false,
    modal: false, // the game plays on around it
    place: 'center',
    tabs: [{ name: 'Learn', slots: () => ({ cells: TAUGHT.map(ware), columns: 2, rows: true }), header: () => talk(witch!, says, 'buy'), footer: () => el('div', 'menu-purse', el('span', 'shop-purse', el('b', undefined, 'Your purse'), ...coinParts(hero.money))) }],
  });
  return {
    menu,
    open(npc) {
      if (menu.isOpen && witch === npc) return;
      witch = npc;
      says = pick(HELLO);
      menu.setTitle(`${npc.name}'s charms`);
      menu.open(0);
    },
    // Each frame: the hero walked off (out of her reach, or out of the hut), the window shuts.
    update() {
      if (!menu.isOpen || !witch) return;
      if ((model.inside?.entrance ?? null) !== witch.where || Math.hypot(hero.x - witch.x, hero.z - witch.z) > TALK_RANGE + 0.5) menu.close();
    },
  };
}
