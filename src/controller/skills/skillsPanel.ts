// The skills window (K, or its tile on the toolbar): the hero's skills (model/skills/skills.ts) as cards, the main
// ones (lumberjacking, woodworking) over the secondary (cooking, fishing): each its icon, its name, their level, their
// tier and how far to the next, its ruler (skillRuler.ts); and what they're at in it just now (chopping a tree, making
// something), else how it's practised. A card clicked (or Enter) opens the skill's own window (skillWindow.ts). A small
// window in the corner: the game goes on while it's open.

import './skills.css';
import type { GameModel } from '../../model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_TIERS, skillOf, tierOf, type SkillId } from '../../model/skills/skills';
import { RECIPES } from '../../model/skills/woodworking';
import { woodOf } from '../../model/skills/lumber';
import { createMenu, type Menu } from '../../view/ui/menu';
import { SKILL_ICONS } from '../../view/ui/skillIcons';
import { el } from '../../view/ui/dom';
import { counted } from '../../view/ui/words';
import { createSkillWindow } from './skillWindow';
import { skillRuler } from './skillRuler';

// What the hero's at in a skill just now, if anything ("Chopping a pine · 2 chops left").
export function statusOf(model: GameModel, id: SkillId): string | null {
  const { lumber, woodworking } = model;
  if (id === 'lumberjacking' && lumber.chopping) return `Chopping ${woodOf(lumber.chopping.tree, model.seed).name} · ${counted(lumber.left(lumber.chopping.tree), 'chop')} left`;
  const making = woodworking.making;
  if (id === 'woodworking' && making) return `Crafting ${RECIPES[making.recipe].name} · ${making.of - making.left + 1} of ${making.of}`;
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

  const menu = createMenu({ title: 'Skills', toggleKey: 'KeyK', keyHints: false, modal: false, place: 'bottom-right', tabs: [{ name: 'Skills', header: cards }] });

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
