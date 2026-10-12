// @vitest-environment happy-dom
// Picking out someone who's no foe (model/hero/selection.ts): a villager, a traveller; one or the other, a foe
// focused or someone picked out; let go once far off or no longer where the hero is; Tab going round those about
// where there's no foe; their frame by the hero's (view/hud/targetHud.ts: a face and a name, no health). A harmful
// spell is never aimed at them (spells/casting.ts).
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { makeEnemy } from '../src/model/enemies/enemies';
import { cyclePeople, peopleAbout } from '../src/model/hero/selection';
import { titleOf } from '../src/model/npcs/npcs';
import { castSpell, castTarget } from '../src/model/spells/casting';
import { learn } from '../src/model/spells/spells';
import { createTargetHud } from '../src/view/hud/targetHud';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

// A game with the hero stood by someone on the road, no foe about.
function amongFolk() {
  const model = fresh();
  model.enemies.length = 0;
  const one = model.travellers.list[0];
  model.teleport(Math.round(one.x) + 1, Math.round(one.z));
  model.update(0, 0, 0.01);
  return { model, one };
}

describe('someone picked out', () => {
  it('is whoever is chosen, till a foe is focused; and a foe focused, till someone is', () => {
    const { model, one } = amongFolk();
    const { hero } = model;
    expect(peopleAbout(model)).toContain(one);
    model.select(one);
    expect(model.chosen.person).toBe(one);
    const foe = makeEnemy(900_001, 'wolf', hero.x, hero.z + 2);
    model.enemies.push(foe);
    model.focus(foe.id);
    expect(model.focused).toBe(foe);
    expect(model.chosen.person).toBeNull();
    model.select(one);
    expect(model.focused).toBeNull();
    expect(model.chosen.person).toBe(one);
    model.focus(null); // (letting go of no foe: they stay picked out)
    expect(model.chosen.person).toBe(one);
  });

  it('is let go once the hero is far from them', () => {
    const { model, one } = amongFolk();
    model.select(one);
    model.update(0, 0, 0.05);
    expect(model.chosen.person).toBe(one);
    Object.assign(model.hero, { x: one.x + 40, z: one.z + 40 });
    model.update(0, 0, 0.05);
    expect(model.chosen.person).toBeNull();
  });

  it('is gone round with Tab, nearest first, where there is no foe; none about, let go', () => {
    const { model } = amongFolk();
    const about = peopleAbout(model);
    const far = (p: { x: number; z: number }) => Math.hypot(p.x - model.hero.x, p.z - model.hero.z);
    const nearest = [...about].sort((a, b) => far(a) - far(b) || a.id - b.id);
    cyclePeople(model);
    expect(model.chosen.person).toBe(nearest[0]);
    cyclePeople(model);
    expect(model.chosen.person).toBe(nearest[1 % nearest.length]);
    cyclePeople(model, true);
    expect(model.chosen.person).toBe(nearest[0]);
    Object.assign(model.hero, { x: model.hero.x + 300 });
    for (const t of model.travellers.list) Object.assign(t, { x: -999 });
    cyclePeople(model);
    if (peopleAbout(model).length === 0) expect(model.chosen.person).toBeNull();
  });

  it('is never what a harmful spell is aimed at: the nearest foe ahead instead, or no one', () => {
    const { model, one } = amongFolk();
    const { hero } = model;
    learn(hero, 'hex');
    model.select(one);
    expect(castTarget(model, 'hex')).toBeNull();
    expect(castSpell(model, 'hex')).toBe('noFoe');
    hero.facing = 0;
    const foe = { ...makeEnemy(900_001, 'wolf', hero.x, hero.z + 2), hp: 500, maxHp: 500 };
    model.enemies.push(foe);
    expect(castTarget(model, 'hex')).toBe(foe);
    expect(castSpell(model, 'hex')).toBe('cast');
    expect(foe.hp).toBeLessThan(500);
    expect(model.focused).toBe(foe); // (the foe struck has the hero's attention now, as with a blow)
    expect(model.chosen.person).toBeNull();
  });

  it('shows in the frame by the hero: their name and calling, no health; a foe after, its own', () => {
    document.body.replaceChildren();
    const { model, one } = amongFolk();
    const update = createTargetHud(document.body);
    const root = document.querySelector<HTMLElement>('.target-hud')!;
    update(null, 1, null);
    expect(root.hidden).toBe(true);
    update(null, 1, one);
    expect(root.hidden).toBe(false);
    expect(root.classList.contains('person')).toBe(true);
    expect(root.querySelector('.target-hud-name')!.textContent).toMatch(new RegExp(`^${one.name} \\(`));
    const villager = model.npcs[0];
    update(null, 1, villager);
    expect(root.querySelector('.target-hud-name')!.textContent).toBe(titleOf(villager));
    const foe = makeEnemy(900_001, 'wolf', model.hero.x, model.hero.z + 2);
    update(foe, 1, null);
    expect(root.classList.contains('person')).toBe(false);
    expect(root.querySelector('.hero-hud-hp span')!.textContent).toContain('/');
  });
});
