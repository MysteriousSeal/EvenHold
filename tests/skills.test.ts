// @vitest-environment happy-dom
// The hero's skills (model/skills/skills.ts: cooking, fishing), each a level from 1 to the most there is, through its
// tiers (Apprentice to Artisan), what each opens; kept in the save (an older one's, or a broken one's, made sound);
// and the skills window (controller/skills/skillsPanel.ts, K): a row each (its tier and level), the one picked told
// of: its tier over its name, the road of its tiers with where the hero stands, what it opens, how it's raised.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { SKILLS, SKILL_IDS, SKILL_MAX, SKILL_TIERS, practise, raiseSkill, readSkills, skillOf, stepsOf, tierOf } from '../src/model/skills/skills';
import { parseSave, restore, snapshot } from '../src/model/save';
import { TEST_MAP_SIZE } from './support/testWorld';
import { RECIPES, RECIPE_IDS } from '../src/model/skills/woodworking';
import { COOK_RECIPES, COOK_RECIPE_IDS } from '../src/model/skills/cooking';
import { salvageOf } from '../src/model/skills/salvage';
import { gearKey } from '../src/model/human/items/gear';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createSkillsPanel, statusOf } = await import('../src/controller/skills/skillsPanel');

describe('skills', () => {
  it('are lumberjacking and woodworking (main skills), salvaging, cooking and fishing (secondary), each with what it opens', () => {
    expect(SKILL_IDS).toEqual(['lumberjacking', 'woodworking', 'salvaging', 'cooking', 'fishing']);
    expect(SKILL_IDS.map((id) => SKILLS[id].kind)).toEqual(['main', 'main', 'secondary', 'secondary', 'secondary']);
    const fishing = SKILLS.fishing.unlocks.map((u) => u.at); // (practised: every tier's start, and a lucky catch between)
    expect(fishing).toEqual(expect.arrayContaining(SKILL_TIERS.map((t) => t.from)));
    expect(fishing).toEqual([...fishing].sort((a, b) => a - b));
    const cooking = SKILLS.cooking.unlocks.map((u) => u.at); // (cooking's as built: from the start, rising, something at every tier)
    expect([cooking[0], cooking]).toEqual([1, [...cooking].sort((x, y) => x - y)]);
    for (const tier of SKILL_TIERS) expect(cooking.some((at) => at >= tier.from && at < tier.to)).toBe(true);
    expect(SKILLS.cooking.practice).toBeDefined(); // (by a fire)
    expect(SKILLS.lumberjacking.unlocks[0].at).toBe(1); // (from the start)
    expect(SKILLS.lumberjacking.practice).toBeDefined(); // (it can be raised: chopping)
  });

  it('promise nothing before its level: every recipe at a row of its own, or named with its level in the row before', () => {
    for (const [skill, needs] of [['woodworking', RECIPE_IDS.map((id) => RECIPES[id].needs)], ['cooking', COOK_RECIPE_IDS.map((id) => COOK_RECIPES[id].needs)]] as const) {
      const rows = SKILLS[skill].unlocks;
      for (const row of rows) expect(needs, `${skill} ${row.at}`).toContain(row.at); // (a row's level: a recipe's)
      for (const n of needs) {
        const row = rows.filter((r) => r.at <= n).at(-1)!;
        expect(row.at === n || new RegExp(`\\b${n}\\b`).test(row.what), `${skill}: a recipe at ${n}`).toBe(true);
      }
    }
  });

  it("salvaging's level 75 reaches common gear up to level 27, as it says, and no further", () => {
    expect(SKILLS.salvaging.unlocks.find((u) => u.at === 75)?.what).toBe('Common gear up to level 27');
    expect(salvageOf(gearKey({ item: 'armingSword', level: 27, rarity: 'common', roll: 0 })).needs).toBeLessThanOrEqual(75);
    expect(salvageOf(gearKey({ item: 'armingSword', level: 28, rarity: 'common', roll: 0 })).needs).toBeGreaterThan(75);
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

  it('rise a level only after so many tries that taught (its tier\'s steps), told then; a grey try teaches nothing', () => {
    const hero = new GameModel(1, TEST_MAP_SIZE).hero;
    const events: unknown[] = [];
    const steps = stepsOf('lumberjacking', 1);
    expect(steps).toBe(SKILLS.lumberjacking.steps[0]);
    for (let i = 1; i < steps; i++) expect(practise(hero, 'lumberjacking', 1, 0, (e) => events.push(e))).toBe(0);
    expect([skillOf(hero, 'lumberjacking'), events]).toEqual([{ level: 1, toward: steps - 1 }, []]);
    expect(practise(hero, 'lumberjacking', 1, 0.99, (e) => events.push(e))).toBe(1); // (an orange try: always teaches)
    expect(skillOf(hero, 'lumberjacking')).toEqual({ level: 2 });
    expect(events).toEqual([{ kind: 'skillUp', skill: 'Lumberjacking', level: 2 }]);
    skillOf(hero, 'cooking').level = 200;
    expect([practise(hero, 'cooking', 1, 0, () => {}), skillOf(hero, 'cooking').toward]).toEqual([0, undefined]); // (grey)
    for (const id of SKILL_IDS) for (const n of SKILLS[id].steps) expect(n).toBeGreaterThanOrEqual(1);
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
    expect(readSkills({ lumberjacking: { level: 5, toward: 3 }, fishing: { level: 5, toward: 99 }, cooking: { level: 5, toward: -1 } })).toEqual({ lumberjacking: { level: 5, toward: 3 }, fishing: { level: 5 }, cooking: { level: 5 } }); // (tries toward the next: kept, if sound)
  });
});

// (the newest of a kind: each window made stays in the document)
const all = (selector: string) => Array.from(document.querySelectorAll(selector)) as HTMLElement[];
const q = (selector: string) => all(selector).at(-1)!;

describe('the skills window', () => {
  // The skills list's cards (the newest list: each window made stays in the document).
  const cardsOf = () => Array.from(all('.skill-cards').at(-1)!.querySelectorAll<HTMLElement>('.skill-card'));

  it('shows a card a skill: its level, its tier and how far to the next, its ruler, what it\'s practised for; the main over the secondary', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    raiseSkill(model.hero, 'lumberjacking', 99);
    const panel = createSkillsPanel(model);
    panel.menu.open();
    const cards = cardsOf();
    expect(cards.map((c) => c.dataset.skill)).toEqual(['lumberjacking', 'woodworking', 'salvaging', 'cooking', 'fishing']);
    expect(Array.from(all('.skill-cards').at(-1)!.querySelectorAll('.skill-cards-group')).map((g) => g.textContent)).toEqual(['Main skills', 'Secondary skills']);
    expect(cards[0].querySelector('.skill-card-level')?.textContent).toBe('100');
    expect(cards[0].querySelector('.skill-card-tier')?.textContent).toBe('Journeyman · 50 to Expert');
    expect(cards[0].querySelector('.skill-rule.slim')).toBeTruthy();
    expect([cards[4].classList.contains('idle'), cards[4].querySelector('.skill-card-status')?.textContent]).toEqual([false, 'Open to see what it offers']); // (fishing: practicable, nothing under way)
    expect(panel.window.menu.isOpen).toBe(false);
    panel.menu.close();
  });

  it('says what they are at just now: chopping a tree, making something, breaking a piece down', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const tree = model.trees.find((t) => t.kind === 'birch')!;
    model.lumber.chopping = { tree, t: 0 };
    expect(statusOf(model, 'lumberjacking')).toMatch(/^Chopping birch · \d chops? left$/);
    model.hero.bag.birchLog = 3;
    model.lumber.stop();
    model.woodworking.start('birchPlank', 3);
    expect(statusOf(model, 'woodworking')).toBe('Crafting Birch plank · 1 of 3');
    const panel = createSkillsPanel(model);
    panel.menu.open();
    expect(cardsOf()[1].querySelector('.skill-card-status.live')?.textContent).toBe('Crafting Birch plank · 1 of 3');
    panel.menu.close();
    model.woodworking.stop();
    model.salvage.breaking = { key: 'armingSword', t: 0, left: 0 }; // (and breaking a piece down at the bench)
    expect(statusOf(model, 'salvaging')).toBe('Breaking down Arming sword');
  });

  it("opens a skill's own window, clicked: where they stand across the top (their title, level, ruler, what's next), what it offers under it", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    raiseSkill(model.hero, 'lumberjacking', 120); // (121: three short of ancient pines)
    const panel = createSkillsPanel(model);
    panel.menu.open();
    cardsOf()[0].click();
    expect([panel.window.menu.isOpen, panel.window.skill, panel.menu.isOpen]).toEqual([true, 'lumberjacking', true]);
    expect(q('.skill-band-title').textContent).toBe('Journeyman lumberjack');
    expect(q('.skill-band-level').textContent).toBe('121 / 300 · 29 to Expert');
    expect(q('.skill-band-next').textContent).toBe('Next at 125: Fell ancient pines: two logs a chop · 4 levels to go');
    expect(Array.from(q('.skill-band').querySelectorAll('.skill-rule-tier')).map((b) => b.className)).toEqual(['skill-rule-tier past', 'skill-rule-tier here', 'skill-rule-tier', 'skill-rule-tier']);
    expect(q('.skill-rule-notch').textContent).toBe('121');
    expect(q('.book-detail .book-title').textContent).toBe('Oak'); // (the trees: the best to learn from, picked)
    cardsOf()[1].click();
    expect(all('.book-group').slice(-7).map((g) => g.textContent)).toEqual(['Materials', 'Goods', 'Tools', 'Packs', 'Trinkets', 'Weapons', 'Shields']); // (woodworking: its recipes)
    // Picked, the list is redrawn, but stays where it was scrolled to.
    const list = () => all('.book-list').at(-1)!;
    list().scrollTop = 120;
    all('.book-row').at(-1)!.click();
    expect(list().scrollTop).toBe(120);
    cardsOf()[2].click();
    expect(all('.book-row .book-name').slice(-5).map((r) => r.textContent)).toEqual(['Iron', 'Leather', 'Cloth', 'Silver', 'Wood']); // (salvaging: its guide, what gear is made of)
    expect(q('.book-detail .book-title').textContent).toBe('Iron');
    cardsOf()[3].click();
    expect(all('.book-group').slice(-5).map((g) => g.textContent)).toEqual(['Roasts', 'Fish', 'Stews', 'Pies', 'Feasts']); // (cooking: its recipes)
    expect(q('.cook-fire').textContent).toContain('No fire here');
    cardsOf()[4].click();
    expect(document.querySelector('.skill-notyet')).toBeNull(); // (fishing: its guide, what bites)
    expect(all('.book-row .book-name').map((r) => r.textContent)).toContain('Small fry');
    panel.window.menu.close();
    panel.menu.close();
  });

  it('keeps up while open: a level risen, redrawn (the list, and the skill window)', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const panel = createSkillsPanel(model);
    panel.menu.open();
    panel.window.open('lumberjacking');
    panel.update();
    raiseSkill(model.hero, 'lumberjacking', 4);
    panel.update();
    expect(q('.skill-band-level').textContent).toContain('5 / 300');
    expect(cardsOf()[0].querySelector('.skill-card-level')?.textContent).toBe('5');
    panel.window.menu.close();
    panel.menu.close();
  });
});
