// The salvage bench's window (E by a village's bench: skills/salvage.ts): the gear carried, a row each, with what
// breaking it down would leave and the skill level it asks; the one chosen told of on the right, and the button to
// break it down. A window in the middle of the screen, modeless: the game goes on, the bench works, and it shuts as the
// hero walks off. And the skill window's page
// on Salvaging (salvageGuide): what each kind of gear leaves, and where the benches stand.
import '../quests/questPanels.css';
import './skills.css';
import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { gearName, levelOf, rarityOf, RARITY_NAMES, type GearKey } from '../../model/human/items/gear';
import { LOOT } from '../../model/loot/loot';
import { MAKE_NAMES, salvageOf, type SalvageOutcome } from '../../model/skills/salvage';
import { betterThanWorn } from '../../model/human/items/gear';
import { SKILLS, skillOf } from '../../model/skills/skills';
import { el, line } from '../../view/ui/dom';
import { bagIcon } from '../../view/ui/itemIcons';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { detailParts } from '../../view/ui/menuDetail';
import { capitalize } from '../../util/text';

const SAID: Record<SalvageOutcome, string> = {
  started: '',
  'no bench': "You're not at a bench.",
  none: "You haven't one of those.",
  skill: 'Your Salvaging is not up to this piece yet.',
  busy: 'One thing at a time: the bench is taken.',
};
const COLUMNS = 8; // cases across, as the bag's

// What `gives` is, in words: "2 Iron scrap, 1 Tempered ingot".
export const givesWords = (gives: Array<[string, number]>): string => gives.map(([item, n]) => `${n} ${LOOT[item as keyof typeof LOOT]?.name ?? item}`).join(', ');

export function createSalvagePanel(model: GameModel): { open(): void; update(): void; menu: Menu } {
  const shown = new WeakMap<MenuSlot, GearKey>();
  let said = '';
  let saidFor = '';
  let drawnFor: string | null = null; // what the detail was last drawn breaking (redrawn as it begins and ends)
  let confirming: GearKey | null = null; // a piece better than what's worn: asked before it's broken down

  const slotOf = (key: GearKey): MenuSlot => {
    const { needs, gives } = salvageOf(key);
    const level = skillOf(model.hero, 'salvaging').level;
    const slot: MenuSlot = {
      key,
      icon: bagIcon(key),
      title: gearName(key),
      count: model.hero.bag[key as keyof typeof model.hero.bag],
      lines: [`Level ${levelOf(key)} · ${RARITY_NAMES[rarityOf(key)]}`, `Leaves ${givesWords(gives)}`, level < needs ? `Asks Salvaging ${needs} · yours is ${level}` : `Asks Salvaging ${needs}`],
      badge: level < needs ? `${needs}` : undefined,
      badgeTone: level < needs ? 'past' : undefined,
      dim: level < needs,
    }; // (no use() on the case: a click picks it; the button breaks it down, nothing by accident)
    shown.set(slot, key);
    return slot;
  };

  const detail = (slot: MenuSlot | null): HTMLElement => {
    const pane = document.createElement('div');
    const key = slot && shown.get(slot);
    if (!key) {
      pane.append(line('menu-detail-hint', model.salvage.candidates.length ? 'Pick a piece to see what it would leave.' : 'Nothing in your bag to break down: weapons, armour and jewellery can be.'));
      return pane;
    }
    if (saidFor !== key) said = '';
    if (confirming && confirming !== key) confirming = null;
    const { make, needs, gives } = salvageOf(key);
    const level = skillOf(model.hero, 'salvaging').level;
    const breaking = model.salvage.breaking?.key === key;
    const { icon, facts, fact } = detailParts(bagIcon(key)(96), 'menu-detail-facts quest-facts');
    fact('Made of', [MAKE_NAMES[make]]);
    fact('Leaves', [gives.map(([item, n]) => `${n} × ${nameOf(item as never)}`).join(', ')]);
    fact('Asks', [`Salvaging ${needs}${level < needs ? ` · yours is ${level}` : ''}`]);
    const go = () => {
      const outcome = model.salvage.start(key);
      [said, saidFor, confirming] = [SAID[outcome], key, null];
      menu.refresh();
    };
    const bar = el('span', 'craft-progress', el('i'));
    (bar.firstElementChild as HTMLElement).style.width = `${Math.round((model.salvage.progress ?? 0) * 100)}%`;
    pane.append(line('menu-detail-name', gearName(key)), icon, facts);
    if (confirming === key) {
      // Better than what's worn in its slot: asked first.
      const yes = el('button', 'menu-detail-button salvage-go salvage-sure', 'Break it down anyway') as HTMLButtonElement;
      yes.addEventListener('click', go);
      const no = el('button', 'menu-detail-button salvage-keep', 'Keep it') as HTMLButtonElement;
      no.addEventListener('click', () => [(confirming = null), menu.refresh()]);
      pane.append(line('menu-detail-said salvage-warn', `This ${gearName(key).toLowerCase()} is better than what you wear. Break it down anyway?`), yes, no);
    } else {
      const button = el('button', 'menu-detail-button salvage-go', breaking ? 'Breaking down…' : 'Break down') as HTMLButtonElement;
      button.disabled = level < needs || !!model.salvage.breaking;
      button.addEventListener('click', () => (betterThanWorn(key, model.hero) ? [(confirming = key), menu.refresh()] : go()));
      pane.append(button, ...(breaking ? [bar] : []), ...(said ? [line('menu-detail-said', said)] : []));
    }
    return pane;
  };

  const menu = createMenu({
    title: 'Salvage bench',
    keyHints: false,
    modal: false, // (the game goes on: the bench works while it's open, as the crafting windows do)
    place: 'center',
    tabs: [
      {
        name: 'Gear',
        slots: () => ({ cells: model.salvage.candidates.map(slotOf), columns: COLUMNS }),
        detail,
        header: () => line('menu-detail-hint', `${capitalize(SKILLS.salvaging.name)} ${skillOf(model.hero, 'salvaging').level} · ${model.salvage.candidates.length} piece${model.salvage.candidates.length === 1 ? '' : 's'} carried`),
      },
    ],
  });
  return {
    menu,
    open() {
      said = '';
      menu.open();
    },
    // Each frame while open: the bar filling; redrawn as a piece begins and as it's done (the cases: one fewer).
    update() {
      if (!menu.isOpen) return;
      if (model.salvage.benchInReach === null) return menu.close(); // (walked off from the bench: shut)
      const now = model.salvage.breaking?.key ?? null;
      if (now !== drawnFor) [(drawnFor = now), menu.refresh()];
      else if (now) for (const bar of Array.from(document.querySelectorAll<HTMLElement>('.salvage-go ~ .craft-progress > i'))) bar.style.width = `${Math.round((model.salvage.progress ?? 0) * 100)}%`;
    },
  };
}
