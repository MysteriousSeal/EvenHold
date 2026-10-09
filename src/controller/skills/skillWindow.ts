// A skill's own window (opened from the skills list: skillsPanel.ts), in the middle of the screen, clear of the action
// bar, titled with the skill. Across its top, where the hero stands: its icon, their title in it ("Journeyman
// woodworker"), their level of the most there is, its ruler (skillRuler.ts: the tiers, their notch, a diamond at each
// thing it opens), and what it opens next. Under it, as WoW's tradeskill window: a crafting skill's recipes
// (recipeBook.ts), a gathering skill's trees (woodGuide.ts), each a list and the one picked told of beside it; a skill
// not yet to be practised, said so, and what it'll open. The game goes on while it's open (what's made, made as it's
// watched).

import { salvageGuide } from './salvagePanel';
import type { GameModel } from '../../model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_MAX, SKILL_TIERS, skillOf, tierOf, type SkillId } from '../../model/skills/skills';
import { createMenu, type Menu } from '../../view/ui/menu';
import { SKILL_ICONS } from '../../view/ui/skillIcons';
import { el } from '../../view/ui/dom';
import { newBook, recipeBook, recipeProgress, recipeState } from './recipeBook';
import { woodGuide } from './woodGuide';
import { nextMilestone, skillRuler } from './skillRuler';
import type { Grade } from '../../model/skills/lumber';

// What someone at a skill's called ("Journeyman woodworker").
const CALLED: Record<SkillId, string> = { lumberjacking: 'lumberjack', woodworking: 'woodworker', salvaging: 'salvager', cooking: 'cook', fishing: 'angler' };

export function createSkillWindow(model: GameModel): { menu: Menu; open(skill: SkillId): void; update(): void; readonly skill: SkillId } {
  let skill: SkillId = SKILL_IDS[0];
  const book = newBook(); // (the recipe picked, the filter, how many: kept while the game's on)
  const guide: { picked: Grade | null } = { picked: null };
  const scrap: { picked: import('../../model/skills/salvage').Make | null } = { picked: null }; // (the salvage guide's: the make picked)

  // Where the hero stands in it.
  const head = (id: SkillId): HTMLElement => {
    const { level } = skillOf(model.hero, id);
    const { tier, index } = tierOf(level);
    const next = SKILL_TIERS[index + 1];
    const milestone = nextMilestone(id, level);
    return el(
      'header',
      'skill-band',
      el('span', 'skill-band-icon', SKILL_ICONS[id](64)),
      el(
        'div',
        'skill-band-text',
        el('span', 'skill-band-title', `${tier.name} ${CALLED[id]}`),
        el('span', 'skill-band-level', el('b', undefined, String(level)), ` / ${SKILL_MAX}`, el('em', undefined, next ? ` · ${tier.to - level} to ${next.name}` : ' · Mastered')),
      ),
      el('div', 'skill-band-rule', skillRuler(level), el('p', 'skill-band-next', milestone ? `Next at ${milestone.at}: ${milestone.what} · ${milestone.levels} ${milestone.levels === 1 ? 'level' : 'levels'} to go` : 'Everything it opens is yours.')),
    );
  };

  // A skill not to be practised yet: said so, what it's for, and what it'll open.
  const notYet = (id: SkillId): HTMLElement => {
    const about = SKILLS[id];
    const opens = el('ul', 'skill-opens', ...about.unlocks.map((u) => el('li', undefined, el('b', undefined, String(u.at)), u.what)));
    return el('div', 'skill-notyet', el('h3', undefined, 'Not practicable yet'), el('p', undefined, `${about.about} There's nowhere to ${about.verb} in the world so far.`), el('span', 'book-label', 'What it will open'), opens);
  };

  const body = (): HTMLElement => {
    const redraw = () => menu.refresh();
    const content = skill === 'woodworking' ? recipeBook(model, book, redraw) : skill === 'lumberjacking' ? woodGuide(model, guide, redraw) : skill === 'salvaging' ? salvageGuide(model, scrap, redraw) : notYet(skill);
    return el('div', 'skill-detail', head(skill), content);
  };

  const menu = createMenu({ title: SKILLS[skill].name, keyHints: false, modal: false, place: 'center', tabs: [{ name: 'Skill', header: body }] });

  // Kept up with while open: the bar of what's being made filling; redrawn when a level moves, or what's made.
  let seen = '';
  const update = () => {
    if (!menu.isOpen) return;
    recipeProgress(model);
    const now = `${skill}|${skillOf(model.hero, skill).level}|${recipeState(model)}|${model.lumber.axe}`;
    if (now === seen) return;
    seen = now;
    menu.refresh();
  };
  return {
    menu,
    update,
    get skill() {
      return skill;
    },
    open(id) {
      skill = id;
      seen = '';
      menu.setTitle(SKILLS[id].name);
      if (menu.isOpen) menu.refresh();
      else menu.open();
    },
  };
}
