// The skills window (K, or its tile on the toolbar), as a crafter's book of trades: the hero's skills down the left
// (model/skills/skills.ts: cooking, fishing), a row each, its tier and level; the one picked told of on the right: its
// tier over its name, the road of its tiers (those passed, the one it's on filling toward the next, those ahead) with
// where the hero stands on it, what it's for, what each tier opens (reached, or not yet), and how it's raised. The main
// skills (lumberjacking) over the secondary (cooking, fishing). A side
// window in the corner: the game goes on while it's open.

import './skillsPanel.css';
import type { GameModel } from '../../model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_MAX, SKILL_TIERS, skillOf, tierOf, type SkillId } from '../../model/skills/skills';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { SKILL_ICONS } from '../../view/ui/skillIcons';
import { line } from '../../view/ui/dom';

// An element, its class, and what's in it.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, ...children: Array<string | Node>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function createSkillsPanel(model: GameModel): { menu: Menu; update(): void } {
  const picked = new WeakMap<MenuSlot, SkillId>();

  const slotOf = (id: SkillId): MenuSlot => {
    const { level } = skillOf(model.hero, id);
    const { tier } = tierOf(level);
    const slot: MenuSlot = { key: id, icon: SKILL_ICONS[id], title: SKILLS[id].name, note: `${tier.name} · ${level} / ${tier.to}`, badge: String(level), badgeTone: 'progress' };
    picked.set(slot, id);
    return slot;
  };

  // The road of its tiers: a stretch each, filled as far as the hero's come, their mark where they stand.
  const road = (level: number): HTMLElement => {
    const { index, toward } = tierOf(level);
    const track = el('ol', 'skill-road');
    track.setAttribute('aria-label', `Level ${level} of ${SKILL_MAX}`);
    for (const [i, tier] of SKILL_TIERS.entries()) {
      const fill = i < index ? 1 : i === index ? toward : 0;
      const bar = el('span', 'skill-road-bar', el('i'));
      (bar.firstChild as HTMLElement).style.width = `${Math.round(fill * 100)}%`;
      if (i === index) {
        const here = el('b', 'skill-road-here', String(level)); // (their mark, over where they stand)
        here.style.left = `${Math.round(toward * 100)}%`;
        bar.append(here);
      }
      track.append(el('li', i < index ? 'past' : i === index ? 'here' : 'ahead', bar, el('span', 'skill-road-name', tier.name), el('span', 'skill-road-range', `${tier.from}–${tier.to}`)));
    }
    return track;
  };

  const detail = (slot: MenuSlot | null): HTMLElement => {
    const id = slot && picked.get(slot);
    if (!id) return el('div', undefined, line('menu-detail-hint', 'Pick a skill to see where you stand in it.'));
    const skill = SKILLS[id];
    const { level } = skillOf(model.hero, id);
    const { tier, index } = tierOf(level);
    const next = SKILL_TIERS[index + 1];
    const unlocks = el('ul', 'skill-unlocks');
    for (const { at, what } of skill.unlocks) {
      const open = level >= at;
      const needs = SKILL_TIERS.find((t) => t.from === at)?.name ?? `Level ${at}`;
      unlocks.append(el('li', open ? 'open' : 'locked', el('span', 'skill-unlock-mark', open ? '✓' : ''), el('span', 'skill-unlock-what', what), el('span', 'skill-unlock-at', open ? 'Known' : needs)));
    }
    return el(
      'div',
      'skill-detail',
      el('div', 'skill-head', el('div', 'skill-icon', SKILL_ICONS[id](56)), el('div', undefined, el('span', 'skill-eyebrow', `${tier.name} ${skill.name.toLowerCase()}`), el('h3', 'skill-name', skill.name), el('span', 'skill-level', el('b', undefined, String(level)), ` / ${SKILL_MAX}`, next ? el('em', undefined, ` · ${tier.to - level} to ${next.name}`) : el('em', undefined, ' · Mastered')))),
      road(level),
      el('p', 'skill-about', skill.about),
      el('span', 'skill-label', 'What it opens'),
      unlocks,
      skill.practice ? el('p', 'skill-practice ready', skill.practice) : el('p', 'skill-practice', `You can't practise ${skill.name.toLowerCase()} yet: there's nowhere to ${skill.verb} in the world so far.`),
    );
  };

  const menu = createMenu({
    title: 'Skills',
    toggleKey: 'KeyK',
    keyHints: false,
    modal: false,
    place: 'bottom-right',
    tabs: [
      {
        name: 'Skills',
        // The main skills first (each a trade of its own), then the secondary, each under its header.
        slots: () => {
          const main = SKILL_IDS.filter((id) => SKILLS[id].kind === 'main');
          const secondary = SKILL_IDS.filter((id) => SKILLS[id].kind === 'secondary');
          const sections = [...(main.length ? [{ title: `Main skills · ${main.length}`, from: 0 }] : []), ...(secondary.length ? [{ title: `Secondary skills · ${secondary.length}`, from: main.length }] : [])];
          return { cells: [...main, ...secondary].map(slotOf), columns: 1, rows: true, sections };
        },
        detail,
      },
    ],
  });

  // Kept up with while open: redrawn when a level moves.
  let seen = '';
  const update = () => {
    if (!menu.isOpen) return;
    const now = SKILL_IDS.map((id) => skillOf(model.hero, id).level).join('|');
    if (now === seen) return;
    seen = now;
    menu.refresh();
  };
  return { menu, update };
}
