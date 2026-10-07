// A skill's own window (opened from the skills list: skillsPanel.ts), large in the middle of the screen, clear of the
// action bar, titled with the skill: two columns, where the hero stands in it (its tier over its name, their level of
// the most there is, the road of its tiers with their mark on it, what it's for, how it's raised); and what each tier
// opens (reached, or not yet), or a crafting skill's recipes (recipeList.ts), to be made from here; what's being made
// told of in the first column, under where they stand (its bar filling). The game goes on while it's open (what's made, made as it's watched).

import type { GameModel } from '../../model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_MAX, SKILL_TIERS, skillOf, tierOf, type SkillId } from '../../model/skills/skills';
import { createMenu, type Menu } from '../../view/ui/menu';
import { SKILL_ICONS } from '../../view/ui/skillIcons';
import { el } from '../../view/ui/dom';
import { craftStatus, recipeList, recipeProgress, recipeState } from './recipeList';

// The road of a skill's tiers: a stretch each, filled as far as the hero's come, their mark where they stand.
function road(level: number): HTMLElement {
  const { index, toward } = tierOf(level);
  const track = el('ol', 'skill-road');
  track.setAttribute('aria-label', `Level ${level} of ${SKILL_MAX}`);
  for (const [i, tier] of SKILL_TIERS.entries()) {
    const bar = el('span', 'skill-road-bar', el('i'));
    (bar.firstChild as HTMLElement).style.width = `${Math.round((i < index ? 1 : i === index ? toward : 0) * 100)}%`;
    if (i === index) {
      const here = el('b', 'skill-road-here', String(level)); // (their mark, over where they stand)
      here.style.left = `${Math.round(toward * 100)}%`;
      bar.append(here);
    }
    track.append(el('li', i < index ? 'past' : i === index ? 'here' : 'ahead', bar, el('span', 'skill-road-name', tier.name), el('span', 'skill-road-range', `${tier.from}–${tier.to}`)));
  }
  return track;
}

export function createSkillWindow(model: GameModel): { menu: Menu; open(skill: SkillId): void; update(): void; readonly skill: SkillId } {
  let skill: SkillId = SKILL_IDS[0];

  const detail = (): HTMLElement => {
    const id = skill;
    const about = SKILLS[id];
    const { level } = skillOf(model.hero, id);
    const { tier, index } = tierOf(level);
    const next = SKILL_TIERS[index + 1];
    const unlocks = el('ul', 'skill-unlocks');
    for (const { at, what } of about.unlocks) {
      const open = level >= at;
      const needs = SKILL_TIERS.find((t) => t.from === at)?.name ?? `Level ${at}`;
      unlocks.append(el('li', open ? 'open' : 'locked', el('span', 'skill-unlock-mark', open ? '✓' : ''), el('span', 'skill-unlock-what', what), el('span', 'skill-unlock-at', open ? 'Known' : needs)));
    }
    const head = el('div', 'skill-head', el('div', 'skill-icon', SKILL_ICONS[id](56)), el('div', undefined, el('span', 'skill-eyebrow', `${tier.name} ${about.name.toLowerCase()}`), el('h3', 'skill-name', about.name), el('span', 'skill-level', el('b', undefined, String(level)), ` / ${SKILL_MAX}`, el('em', undefined, next ? ` · ${tier.to - level} to ${next.name}` : ' · Mastered'))));
    const practice = about.practice ? el('p', 'skill-practice ready', about.practice) : el('p', 'skill-practice', `You can't practise ${about.name.toLowerCase()} yet: there's nowhere to ${about.verb} in the world so far.`);
    return el(
      'div',
      'skill-detail',
      el('div', 'skill-side', head, road(level), ...(id === 'woodworking' ? [craftStatus(model, () => menu.refresh()) ?? undefined] : []), el('p', 'skill-about', about.about), practice),
      el('div', 'skill-main', ...(id === 'woodworking' ? [el('span', 'skill-label', 'Recipes'), recipeList(model, () => menu.refresh())] : [el('span', 'skill-label', 'What it opens'), unlocks])),
    );
  };

  const menu = createMenu({ title: SKILLS[skill].name, keyHints: false, modal: false, place: 'center', tabs: [{ name: 'Skill', header: detail }] });

  // Kept up with while open: the bar of the one being made filling; redrawn when a level moves, or what's made.
  let seen = '';
  const update = () => {
    if (!menu.isOpen) return;
    recipeProgress(model);
    const now = `${skill}|${skillOf(model.hero, skill).level}|${recipeState(model)}`;
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
