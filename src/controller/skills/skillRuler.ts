// A skill's ruler (the skills windows: skillsPanel.ts, skillWindow.ts): its four tiers as blocks side by side, a gap
// between (Apprentice to Artisan, each named under it with its span), those passed filled, the one the hero's on lit
// and filling to where they stand (their level in a tag over it), those ahead bare. And the next thing the skill
// opens, in words (skillWindow.ts: "Next at 125: Fell ancient pines · 3 levels to go").

import { SKILLS, SKILL_MAX, SKILL_TIERS, tierOf, type SkillId } from '../../model/skills/skills';
import { el } from '../../view/ui/dom';

// How far through tier `i` a level is (0..1: none of it reached, to all of it).
const through = (level: number, i: number): number => {
  const tier = SKILL_TIERS[i];
  return Math.max(0, Math.min(1, (level - tier.from) / (tier.to - tier.from)));
};

export function skillRuler(level: number, full = true): HTMLElement {
  const { index } = tierOf(level);
  const rule = el('div', full ? 'skill-rule' : 'skill-rule slim');
  rule.setAttribute('role', 'meter');
  rule.setAttribute('aria-valuemin', '1');
  rule.setAttribute('aria-valuemax', String(SKILL_MAX));
  rule.setAttribute('aria-valuenow', String(level));
  rule.setAttribute('aria-label', `Level ${level} of ${SKILL_MAX}`);
  const track = el('div', 'skill-rule-track');
  for (const i of SKILL_TIERS.keys()) {
    const block = el('span', i < index || level >= SKILL_MAX ? 'skill-rule-tier past' : i === index ? 'skill-rule-tier here' : 'skill-rule-tier');
    const fill = el('i', 'skill-rule-fill');
    fill.style.width = `${(i < index ? 1 : i === index ? through(level, i) : 0) * 100}%`;
    block.append(fill);
    if (full) {
      if (i === index) {
        const notch = el('span', 'skill-rule-notch', String(level));
        notch.style.left = `${through(level, i) * 100}%`;
        block.append(notch);
      }
    }
    track.append(block);
  }
  rule.append(track);
  if (full) rule.append(el('div', 'skill-rule-names', ...SKILL_TIERS.map((t, i) => el('span', i === index ? 'here' : undefined, el('b', undefined, t.name), el('small', undefined, `${t.from}–${t.to}`)))));
  return rule;
}

// The next thing the skill opens, and how far off; none past the last.
export function nextMilestone(skill: SkillId, level: number): { at: number; what: string; levels: number } | null {
  const next = SKILLS[skill].unlocks.find((u) => u.at > level);
  return next ? { ...next, levels: next.at - level } : null;
}
