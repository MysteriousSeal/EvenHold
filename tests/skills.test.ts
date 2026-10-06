// @vitest-environment happy-dom
// The hero's skills (model/skills/skills.ts: cooking, fishing), each a level from 1 to the most there is, through its
// tiers (Apprentice to Artisan), what each opens; kept in the save (an older one's, or a broken one's, made sound);
// and the skills window (controller/skills/skillsPanel.ts, K): a row each (its tier and level), the one picked told
// of: its tier over its name, the road of its tiers with where the hero stands, what it opens, how it's raised.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_MAX, SKILL_TIERS, raiseSkill, readSkills, skillOf, tierOf } from '../src/model/skills/skills';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createSkillsPanel } = await import('../src/controller/skills/skillsPanel');

describe('skills', () => {
  it('are lumberjacking (a main skill), cooking and fishing (secondary), each with what it opens', () => {
    expect(SKILL_IDS).toEqual(['lumberjacking', 'cooking', 'fishing']);
    expect(SKILL_IDS.map((id) => SKILLS[id].kind)).toEqual(['main', 'secondary', 'secondary']);
    for (const id of ['cooking', 'fishing'] as const) expect(SKILLS[id].unlocks.map((u) => u.at)).toEqual(SKILL_TIERS.map((t) => t.from));
    expect(SKILLS.lumberjacking.unlocks[0].at).toBe(1); // (from the start)
    expect(SKILLS.lumberjacking.practice).toBeDefined(); // (it can be raised: chopping)
  });

  it("start at 1 for every hero: an apprentice's", () => {
    const hero = new GameModel(1, TEST_MAP_SIZE).hero;
    for (const id of SKILL_IDS) expect(skillOf(hero, id)).toEqual({ level: 1 });
    expect(tierOf(1)).toEqual({ tier: SKILL_TIERS[0], index: 0, toward: 0 });
  });

  it('climb through their tiers, each from where the last tops out, to the most there is', () => {
    expect(tierOf(74).tier.name).toBe('Apprentice');
    expect(tierOf(75)).toMatchObject({ index: 1, toward: 0 });
    expect(tierOf(112).toward).toBeCloseTo((112 - 75) / 75);
    expect(tierOf(SKILL_MAX)).toMatchObject({ index: SKILL_TIERS.length - 1, toward: 1 });
    for (let i = 1; i < SKILL_TIERS.length; i++) expect(SKILL_TIERS[i].from).toBe(SKILL_TIERS[i - 1].to);
  });

  it('are raised a level at a time, never past the most there is', () => {
    const hero = new GameModel(1, TEST_MAP_SIZE).hero;
    expect(raiseSkill(hero, 'fishing')).toBe(1);
    expect(skillOf(hero, 'fishing').level).toBe(2);
    expect(raiseSkill(hero, 'fishing', 500)).toBe(SKILL_MAX - 2);
    expect(raiseSkill(hero, 'fishing')).toBe(0);
    expect(skillOf(hero, 'cooking').level).toBe(1); // (the others let be)
  });

  it("are kept in the save; an older save's none (each at 1), a broken one's made sound", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    raiseSkill(model.hero, 'cooking', 80);
    const again = new GameModel(1, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), 1)!);
    expect([skillOf(again.hero, 'cooking').level, skillOf(again.hero, 'fishing').level]).toEqual([81, 1]);
    expect(readSkills(undefined)).toEqual({});
    expect(readSkills({ cooking: { level: 9999 }, fishing: { level: -3 }, smithing: { level: 5 } })).toEqual({ cooking: { level: SKILL_MAX }, fishing: { level: 1 } });
    expect(readSkills({ cooking: { level: 'x' } })).toEqual({});
  });
});

// (the newest of a kind: each window made stays in the document)
const all = (selector: string) => Array.from(document.querySelectorAll(selector)) as HTMLElement[];
const q = (selector: string) => all(selector).at(-1)!;

describe('the skills window', () => {
  it('lists the skills, a row each: its tier and level', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    raiseSkill(model.hero, 'fishing', 99);
    const panel = createSkillsPanel(model);
    panel.menu.open();
    const rows = all('.menu-slot').filter((r) => r.closest('.menu')?.querySelector('.skill-detail, .menu-detail-hint'));
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Lumberjacking'), expect.stringContaining('Cooking'), expect.stringContaining('Fishing')]);
    expect(rows[1].textContent).toContain('Apprentice · 1 / 75');
    expect(rows[2].textContent).toContain('Journeyman · 100 / 150');
    const menu = rows[0].closest('.menu')!;
    expect(menu.textContent).toContain('Main skills · 1');
    expect(menu.textContent).toContain('Secondary skills · 2');
    panel.menu.close();
  });

  it('tells of the one picked: its tier, its level, the road of its tiers with the hero on it, what it opens, how it rises', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    raiseSkill(model.hero, 'cooking', 99); // (100: a journeyman, a third through)
    const panel = createSkillsPanel(model);
    panel.menu.open();
    expect(q('.skill-name').textContent).toBe('Lumberjacking'); // (the first, picked)
    expect(q('.skill-practice').textContent).toContain('axe in hand'); // (how it's raised)
    (all('.menu-slot').at(-2) as HTMLElement).click(); // (cooking)
    expect(q('.skill-name').textContent).toBe('Cooking');
    expect(q('.skill-eyebrow').textContent).toBe('Journeyman cooking');
    expect(q('.skill-level').textContent).toBe('100 / 300 · 50 to Expert');
    const stretches = Array.from(q('.skill-road').querySelectorAll('li'));
    expect(stretches.map((s) => s.className)).toEqual(['past', 'here', 'ahead', 'ahead']);
    expect(q('.skill-road-here').textContent).toBe('100');
    expect(q('.skill-road-here').style.left).toBe('33%');
    expect(Array.from(q('.skill-unlocks').querySelectorAll('li')).map((li) => li.className)).toEqual(['open', 'open', 'locked', 'locked']);
    expect(q('.skill-unlocks').textContent).toContain('Expert');
    expect(q('.skill-practice').textContent).toContain("can't practise cooking yet");
    panel.menu.close();
  });

  it('keeps up while open: a level risen, redrawn', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const panel = createSkillsPanel(model);
    panel.menu.open();
    panel.update();
    raiseSkill(model.hero, 'lumberjacking', 4);
    panel.update();
    expect(q('.skill-level').textContent).toContain('5 / 300');
    panel.menu.close();
  });
});
