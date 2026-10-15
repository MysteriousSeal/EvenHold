// The salvage bench's window (E before the smithy's bench: skills/salvage.ts): the gear carried, and the junk with
// something in it, a case each, with what breaking it down would leave and the skill level it asks (in the colour of
// how much it'd teach); the one chosen told of on the right, and the buttons to break it down, one or all of them. A window in the middle of the screen, modeless: the game goes on, the bench works, and it shuts as the
// hero walks off. And the skill window's page
// on Salvaging (salvageGuide): what each kind of gear leaves, and where the benches stand.
import '../quests/questPanels.css';
import './skills.css';
import type { GameModel } from '../../model/GameModel';
import { nameOf } from '../../model/hero/bag';
import { isGear, levelOf, rarityOf, RARITY_NAMES } from '../../model/human/items/gear';
import { LOOT } from '../../model/loot/loot';
import { MAKE_NAMES, TOO_HARD, salvageOf, teachChance, type Salvaged, type Salvageable, type SalvageOutcome } from '../../model/skills/salvage';
import { betterThanWorn } from '../../model/human/items/gear';
import { SKILLS, difficulty, skillOf } from '../../model/skills/skills';
import { el, line } from '../../view/ui/dom';
import { bagIcon } from '../../view/ui/itemIcons';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { detailParts } from '../../view/ui/menuDetail';
import { capitalize } from '../../util/text';

const SAID: Record<SalvageOutcome, string> = {
  started: '',
  'no bench': "You're not at the bench.",
  none: "You haven't one of those.",
  busy: 'One thing at a time: the bench is taken.',
  full: 'Your bag is full: no room for what it would leave.',
};
const COLUMNS = 8; // cases across, as the bag's

// What breaking a piece down would teach a hand at `level`, in words: its difficulty's colour; nothing, too hard
// (past it by more than TOO_HARD) or grey; green at most, one as a recipe makes it.
export function teachesWords({ needs, made }: Salvaged, level: number): string {
  const chance = teachChance({ needs, made } as Salvaged, level);
  if (needs > level + TOO_HARD) return 'too hard to learn from yet';
  if (chance === 0) return 'teaches nothing more';
  return `teaches (${chance < difficulty(needs, level).chance ? 'green: one you could make' : difficulty(needs, level).name})`;
}

// What `gives` is, in words: "2 Iron scrap, 1 Tempered ingot".
export const givesWords = (gives: Array<[string, number]>): string => gives.map(([item, n]) => `${n} ${LOOT[item as keyof typeof LOOT]?.name ?? item}`).join(', ');

export function createSalvagePanel(model: GameModel): { open(): void; update(): void; menu: Menu } {
  const shown = new WeakMap<MenuSlot, Salvageable>();
  let said = '';
  let saidFor = '';
  let drawnFor: string | null = null; // what the detail was last drawn breaking, and how many more (redrawn as each begins and ends)
  let confirming: { key: Salvageable; count: number } | null = null; // a piece better than what's worn: asked before it's broken down

  const carried = (key: Salvageable) => model.hero.bag[key as keyof typeof model.hero.bag] ?? 0;
  const slotOf = (key: Salvageable): MenuSlot => {
    const level = skillOf(model.hero, 'salvaging').level;
    const salvaged = salvageOf(key, level);
    const { needs, gives } = salvaged;
    const slot: MenuSlot = {
      key,
      icon: bagIcon(key),
      title: nameOf(key),
      count: carried(key),
      lines: [isGear(key) ? `Level ${levelOf(key)} · ${RARITY_NAMES[rarityOf(key)]}` : 'Junk', `Leaves ${givesWords(gives)}`, `Salvaging ${needs} · ${teachesWords(salvaged, level)}`],
      dim: teachChance(salvaged, level) === 0,
    }; // (no use() on the case: a click picks it; the button breaks it down, nothing by accident)
    shown.set(slot, key);
    return slot;
  };

  const detail = (slot: MenuSlot | null): HTMLElement => {
    const pane = document.createElement('div');
    const key = slot && shown.get(slot);
    if (!key) {
      pane.append(line('menu-detail-hint', model.salvage.candidates.length ? 'Pick a piece to see what it would leave.' : 'Nothing in your bag to break down: weapons, armour and jewellery can be, and old iron, leather and silver foes leave.'));
      return pane;
    }
    if (saidFor !== key) said = '';
    if (confirming && confirming.key !== key) confirming = null;
    const level = skillOf(model.hero, 'salvaging').level;
    const salvaged = salvageOf(key, level);
    const { make, needs, gives, finerAt } = salvaged;
    const breaking = model.salvage.breaking?.key === key;
    const { icon, facts, fact } = detailParts(bagIcon(key)(96), 'menu-detail-facts quest-facts');
    fact('Made of', [MAKE_NAMES[make]]);
    fact('Leaves', [gives.map(([item, n]) => `${n} × ${nameOf(item as never)}`).join(', ')]);
    if (finerAt) fact('Finer', [`Something finer besides, from Salvaging ${finerAt}`]);
    fact('Teaches', [`Salvaging ${needs} · ${teachesWords(salvaged, level)}`]);
    const go = (count: number) => {
      const outcome = model.salvage.start(key, count);
      [said, saidFor, confirming] = [SAID[outcome], key, null];
      menu.refresh();
    };
    const bar = el('span', 'craft-progress', el('i'));
    (bar.firstElementChild as HTMLElement).style.width = `${Math.round((model.salvage.progress ?? 0) * 100)}%`;
    pane.append(line('menu-detail-name', nameOf(key)), icon, facts);
    if (confirming?.key === key) {
      const count = confirming.count;
      // Better than what's worn in its slot: asked first.
      const yes = el('button', 'menu-detail-button salvage-go salvage-sure', 'Break it down anyway') as HTMLButtonElement;
      yes.addEventListener('click', () => go(count));
      const no = el('button', 'menu-detail-button salvage-keep', 'Keep it') as HTMLButtonElement;
      no.addEventListener('click', () => [(confirming = null), menu.refresh()]);
      pane.append(line('menu-detail-said salvage-warn', `This ${nameOf(key).toLowerCase()} is better than what you wear. Break it down anyway?`), yes, no);
    } else {
      const button = el('button', 'menu-detail-button salvage-go', breaking ? 'Breaking down…' : 'Break down') as HTMLButtonElement;
      const ask = (count: number) => (isGear(key) && betterThanWorn(key, model.hero) ? [(confirming = { key, count }), menu.refresh()] : go(count));
      button.disabled = !!model.salvage.breaking;
      button.addEventListener('click', () => ask(1));
      const all = el('button', 'menu-detail-button salvage-all', `Break all (${carried(key)})`) as HTMLButtonElement;
      all.disabled = !!model.salvage.breaking;
      all.addEventListener('click', () => ask(Infinity));
      pane.append(button, ...(carried(key) > 1 ? [all] : []), ...(breaking ? [bar] : []), ...(said ? [line('menu-detail-said', said)] : []));
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
      const now = model.salvage.breaking ? `${model.salvage.breaking.key}|${model.salvage.breaking.left}` : null; // (each of a stack broken down: redrawn)
      if (now !== drawnFor) [(drawnFor = now), menu.refresh()];
      else if (now) for (const bar of Array.from(document.querySelectorAll<HTMLElement>('.salvage-go ~ .craft-progress > i'))) bar.style.width = `${Math.round((model.salvage.progress ?? 0) * 100)}%`;
    },
  };
}
