// The skills window (K, or its tile on the toolbar): the hero's skills (model/skills/skills.ts) as cards, the main
// ones (lumberjacking, woodworking) over the secondary (cooking, fishing): each its icon, its name, their level, their
// tier and how far to the next, its ruler (skillRuler.ts); and what they're at in it just now (chopping a tree, making
// something), else how it's practised. A card clicked (or Enter) opens the skill's own window (skillWindow.ts). A second
// tab, the charms the hero knows (charmTab.ts). A small window in the corner: the game goes on while it's open.

import { keyOf } from '../keyBindings';
import './skills.css';
import type { GameModel } from '../../model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_TIERS, skillOf, tierOf, type SkillId } from '../../model/skills/skills';
import { RECIPES } from '../../model/skills/woodworking';
import { COOK_RECIPES } from '../../model/skills/cooking';
import { woodOf } from '../../model/skills/lumber';
import { VEINS } from '../../model/skills/mining';
import { createMenu, type Menu } from '../../view/ui/menu';
import { SKILL_ICONS } from '../../view/ui/skillIcons';
import { el } from '../../view/ui/dom';
import { counted } from '../../view/ui/words';
import { nameOf } from '../../model/hero/bag';
import { SMITH_RECIPES } from '../../model/skills/smithing';
import { BREW_RECIPES } from '../../model/skills/alchemy';
import { createSkillWindow } from './skillWindow';
import { skillRuler } from './skillRuler';
import { charmsTab } from './charmTab';

// What the hero's at in a skill just now, if anything ("Chopping a pine · 2 chops left", "Mining iron · 3 strikes left", "Cooking Roast boar · 1 of 3").
export function statusOf(model: GameModel, id: SkillId): string | null {
  const { lumber, woodworking } = model;
  if (id === 'lumberjacking' && lumber.chopping) return `Chopping ${woodOf(lumber.chopping.tree, model.seed).name} · ${counted(lumber.left(lumber.chopping.tree), 'chop')} left`;
  const making = woodworking.making;
  if (id === 'woodworking' && making) return `Crafting ${RECIPES[making.recipe].name} · ${making.of - making.left + 1} of ${making.of}`;
  const forging = model.smithing.making;
  if (id === 'smithing' && forging) return `Forging ${SMITH_RECIPES[forging.recipe].name} · ${forging.of - forging.left + 1} of ${forging.of}`;
  const cooked = model.cooking.making;
  if (id === 'cooking' && cooked) return `Cooking ${COOK_RECIPES[cooked.recipe].name} · ${cooked.of - cooked.left + 1} of ${cooked.of}`;
  const breaking = model.salvage.breaking;
  if (id === 'salvaging' && breaking) return `Breaking down ${nameOf(breaking.key)}`;
  const striking = model.mining.striking;
  if (id === 'mining' && striking) return `Mining ${VEINS[model.mining.veinOf(striking.rock)].name} · ${counted(model.mining.left(striking.rock), 'strike')} left`;
  const brewing = model.alchemy.making;
  if (id === 'alchemy' && brewing) return `Brewing ${BREW_RECIPES[brewing.recipe].name} · ${brewing.of - brewing.left + 1} of ${brewing.of}`;
  const picking = model.herbs.picking;
  if (id === 'alchemy' && picking) return `Picking ${nameOf(picking.herb).toLowerCase()} · ${counted(model.herbs.left(picking.patch), 'herb')} left`;
  const line = model.fishing.line;
  if (id === 'fishing' && line) return line.phase === 'bite' ? 'A bite! Hook it (E)' : `Fishing ${line.spot.deep ? 'the deep' : line.spot.narrows ? "a lake's narrows" : 'open water'} · waiting for a bite`;
  return null;
}

export function createSkillsPanel(model: GameModel): { menu: Menu; window: ReturnType<typeof createSkillWindow>; update(): void } {
  const window = createSkillWindow(model);

  const card = (id: SkillId): HTMLElement => {
    const skill = SKILLS[id];
    const { level } = skillOf(model.hero, id);
    const { tier, index } = tierOf(level);
    const next = SKILL_TIERS[index + 1];
    const status = statusOf(model, id);
    const button = el(
      'button',
      skill.practice ? 'skill-card' : 'skill-card idle',
      el('span', 'skill-card-icon', SKILL_ICONS[id](32)),
      el('span', 'skill-card-name', skill.name),
      el('span', 'skill-card-level', String(level)),
      el('span', 'skill-card-tier', next ? `${tier.name} · ${tier.to - level} to ${next.name}` : `${tier.name} · Mastered`),
      skillRuler(level, false),
      el('span', status ? 'skill-card-status live' : skill.practice ? 'skill-card-status hint' : 'skill-card-status', status ?? (skill.practice ? 'Open to see what it offers' : 'Not practicable yet')),
      el('span', 'skill-card-go', '›'),
    );
    button.dataset.skill = id;
    button.setAttribute('aria-label', `${skill.name}, level ${level}: open`);
    button.addEventListener('click', () => window.open(id));
    return button;
  };

  const cards = (): HTMLElement => {
    const group = (kind: 'main' | 'secondary', title: string) => {
      const ids = SKILL_IDS.filter((id) => SKILLS[id].kind === kind);
      return ids.length ? [el('div', 'skill-cards-group', title), ...ids.map(card)] : [];
    };
    return el('div', 'skill-cards', ...group('main', 'Main skills'), ...group('secondary', 'Secondary skills'));
  };

  const menu = createMenu({ title: 'Skills', toggleKey: () => keyOf('skills'), keyHints: false, modal: false, place: 'bottom-right', tabs: [{ name: 'Skills', header: cards }, charmsTab(model)] }); // (and the charms known: put back on the bar from there)

  // Kept up with while open: redrawn when a level moves, or what they're at changes; the skill's own window, its own way.
  let seen = '';
  const update = () => {
    window.update();
    if (!menu.isOpen) return;
    const now = SKILL_IDS.map((id) => `${skillOf(model.hero, id).level}:${statusOf(model, id) ?? ''}`).join('|');
    if (now === seen) return;
    seen = now;
    menu.refresh();
  };
  return { menu, window, update };
}
