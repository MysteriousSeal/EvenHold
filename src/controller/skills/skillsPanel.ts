// The skills window (K, or its tile on the toolbar): the hero's skills (model/skills/skills.ts), a row each, its icon,
// its tier and level; the main ones (lumberjacking, woodworking) over the secondary (cooking, fishing), each under
// its header. A skill clicked opens its own window (skillWindow.ts: where they stand in it, what it opens, its
// recipes). A small window in the corner: the game goes on while it's open.

import './skillsPanel.css';
import type { GameModel } from '../../model/GameModel';
import { SKILLS, SKILL_IDS, skillOf, tierOf, type SkillId } from '../../model/skills/skills';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { SKILL_ICONS } from '../../view/ui/skillIcons';
import { createSkillWindow } from './skillWindow';

export function createSkillsPanel(model: GameModel): { menu: Menu; window: ReturnType<typeof createSkillWindow>; update(): void } {
  const window = createSkillWindow(model);
  // A skill's row: clicked (or Enter), its own window.
  const slotOf = (id: SkillId): MenuSlot => {
    const { level } = skillOf(model.hero, id);
    const { tier } = tierOf(level);
    return { key: id, icon: SKILL_ICONS[id], title: SKILLS[id].name, note: `${tier.name} · ${level} / ${tier.to}`, badge: String(level), badgeTone: 'progress', use: () => window.open(id) };
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
      },
    ],
  });

  // Kept up with while open: redrawn when a level moves; the skill's own window, its own way.
  let seen = '';
  const update = () => {
    window.update();
    if (!menu.isOpen) return;
    const now = SKILL_IDS.map((id) => skillOf(model.hero, id).level).join('|');
    if (now === seen) return;
    seen = now;
    menu.refresh();
  };
  return { menu, window, update };
}
