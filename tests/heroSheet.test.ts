// @vitest-environment happy-dom
// The hero sheet (C) in a stand-in page: its figure and icons are plain canvases.
import { describe, expect, it, vi } from 'vitest';
import { createHeroSheet } from '../src/controller/heroSheet';
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
