// @vitest-environment happy-dom
// The hero sheet (C) in a stand-in page: its figure and icons are plain canvases.
import { describe, expect, it, vi } from 'vitest';
import { createHeroSheet } from '../src/controller/hero/heroSheet';
import { createLevelUpPanel } from '../src/controller/hero/levelUpPanel';
import { maxHpOf } from '../src/model/hero/attributes';
import { resetCost } from '../src/model/hero/training';
import { ITEMS } from '../src/model/human/equipment';
import { fresh } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
vi.mock('../src/view/ui/figureStage', () => ({
  FigureStage: class {
    canvas = document.createElement('canvas');
    show() {}
    render() {}
  },
}));
vi.mock('../src/view/meshes/human/humanFigure', () => ({ humanFigure: () => ({}), humanBust: () => ({}) }));
vi.mock('../src/view/meshes/human/fineFigure', () => ({ fineFigure: (figure: object) => figure })); // (the figure stood in for: as it is)

const fact = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('.menu-fact')).find((f) => f.querySelector('dt')!.textContent === label)!;
const tip = () => Array.from(document.querySelectorAll<HTMLElement>('.menu-tooltip')).find((t) => !t.hidden)?.textContent ?? '';

describe('the hero sheet', () => {
  it('lists the stats, what gear adds, and tells of each on hover', () => {
    const model = fresh();
    model.hero.equipment.mainHand = 'battleAxe'; // +5 Strength
    const sheet = createHeroSheet(model);
    sheet.menu.open();
    expect(fact('Strength').querySelector('dd')!.textContent).toBe(`${ITEMS.battleAxe.stats!.strength!} (+5)`); // 0 of their own at level 1
    fact('Strength').dispatchEvent(new MouseEvent('mouseenter'));
    expect(tip()).toContain('Harder blows');
    expect(tip()).toContain('+5 from your gear');
    fact('Armour').dispatchEvent(new MouseEvent('mouseenter'));
    expect(tip()).toContain('less damage from each blow');
    fact('Armour').dispatchEvent(new MouseEvent('mouseleave'));
    expect(tip()).toBe('');
  });
});

const levelUp = () => Array.from(document.querySelectorAll<HTMLElement>('.menu')).find((m) => m.getAttribute('aria-label') === 'Level up')!;
const row = (name: string) => Array.from(levelUp().querySelectorAll<HTMLElement>('.levelup-stat')).find((r) => r.querySelector('.levelup-name')!.textContent === name)!;
const button = (within: HTMLElement, text: string) => Array.from(within.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text)!;

describe('the level-up window', () => {
  it('plans points on the stats, shows what they come to, and spends them only on Confirm', () => {
    document.body.replaceChildren();
    const model = fresh();
    model.hero.statPoints = 3;
    const paused: boolean[] = [];
    const panel = createLevelUpPanel(model, { setPaused: (p) => paused.push(p) });
    panel.menu.open();
    expect(paused).toEqual([true]);
    expect(levelUp().querySelector('.levelup-points')!.textContent).toBe('3 of 3 points left to spend');
    button(row('Stamina'), '+').click();
    button(row('Stamina'), '+').click();
    button(row('Strength'), '+').click();
    expect(button(row('Agility'), '+').disabled).toBe(true); // none left
    expect(row('Stamina').querySelector('.levelup-value')!.textContent).toBe('0 → 2');
    const health = Array.from(levelUp().querySelectorAll('.levelup-effect')).find((e) => e.querySelector('dt')!.textContent === 'Health')!;
    expect(health.querySelector('dd')!.textContent).toBe(`${maxHpOf(model.hero)} → ${maxHpOf(model.hero) + 4}`);
    expect(model.hero.trained.stamina).toBe(0); // only planned
    button(row('Stamina'), '−').click();
    button(levelUp(), 'Clear').click();
    expect(row('Strength').querySelector('.levelup-value')!.textContent).toBe('0');
    button(row('Stamina'), '+').click();
    const hp = model.hero.hp;
    button(levelUp(), 'Confirm').click();
    expect([model.hero.statPoints, model.hero.trained.stamina, model.hero.hp]).toEqual([2, 1, hp + 2]); // spent, and the health it adds with it
    panel.menu.close();
    expect(paused).toEqual([true, false]);
  });

  it('has every point spent back for coin by the level, on a second click', () => {
    document.body.replaceChildren();
    const model = fresh();
    Object.assign(model.hero, { level: 5, statPoints: 0, money: 1_000 });
    model.hero.trained.strength = 4;
    const panel = createLevelUpPanel(model, { setPaused: () => {} });
    panel.menu.open();
    const respec = () => levelUp().querySelector<HTMLButtonElement>('.levelup-button.respec')!;
    expect(respec().textContent).toContain('Reset points');
    respec().click(); // asks…
    expect(respec().textContent).toContain('to reset?');
    expect(model.hero.trained.strength).toBe(4);
    respec().click(); // …and pays
    expect([model.hero.trained.strength, model.hero.statPoints, model.hero.money]).toEqual([0, 4, 1_000 - resetCost(5)]);
    expect(respec().disabled).toBe(true); // none spent now
  });

  it('opens from the hero sheet when there are points to spend', () => {
    document.body.replaceChildren();
    const model = fresh();
    let opened = 0;
    const sheet = createHeroSheet(model, { levelUp: () => opened++ });
    sheet.menu.open();
    expect(document.querySelector('.sheet-spend')).toBeNull(); // none to spend
    model.hero.statPoints = 3;
    sheet.menu.refresh();
    document.querySelector<HTMLButtonElement>('.sheet-spend')!.click();
    expect(opened).toBe(1);
  });
});
