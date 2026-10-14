// @vitest-environment happy-dom
// Fishing's guide, in its skill window (controller/skills/fishGuide.ts): what bites, the level each wants, the best to
// learn from starred; the one picked told of (where it bites, the wait, the rod), and how it's done. And while a line's
// out, the skills list says so; a bite, the bar over the hero runs (castOf.ts).
import { describe, expect, it } from 'vitest';
import { fishGuide } from '../src/controller/skills/fishGuide';
import { statusOf } from '../src/controller/skills/skillsPanel';
import { castOf } from '../src/controller/skills/castOf';
import { CATCHES } from '../src/model/skills/fishing';
import { skillOf } from '../src/model/skills/skills';
import { fresh } from './support/testWorld';

describe("fishing's guide", () => {
  it('lists every catch, the best to learn from starred, and tells of the one picked', () => {
    const model = fresh();
    skillOf(model.hero, 'fishing').level = 160;
    const state = { picked: null };
    const page = fishGuide(model, state, () => {});
    const rows = Array.from(page.querySelectorAll<HTMLElement>('.book-row'));
    expect(rows.map((r) => r.dataset.grade)).toEqual(CATCHES.map((c) => c.item));
    expect(state.picked).toBe('pike'); // (the hardest they can land that still teaches)
    expect(page.querySelector('.book-row.picked .book-best')).toBeTruthy();
    expect(page.querySelector('.book-title')?.textContent).toBe('Pike');
    expect(page.textContent).toContain('far from any bank');
    expect(page.querySelector('.book-tool.short')?.textContent).toContain('pedlar');
    model.hero.bag.fishingRod = 1;
    expect(fishGuide(model, state, () => {}).querySelector('.book-tool.had')).toBeTruthy();
  });

  it("shows, a line out, what they're at; a bite, the bar to hook it in", () => {
    const model = fresh();
    model.fishing.line = { spot: { x: 0, z: 0, narrows: true, deep: false }, phase: 'waiting', t: 0, wait: 5 };
    expect(statusOf(model, 'fishing')).toBe("Fishing a lake's narrows · waiting for a bite");
    expect(castOf(model)).toBeNull();
    model.fishing.line.phase = 'bite';
    expect(statusOf(model, 'fishing')).toBe('A bite! Hook it (E)');
    expect(castOf(model)?.label).toBe('Bite! E to hook it');
  });
});
