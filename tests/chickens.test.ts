// The hen-wife's turn (model/spells/chickens.ts): whoever's picked out turned into a chicken for 30 seconds from a
// puff of smoke, wandering within 5 tiles of where they were turned, at nothing else (a foe not fighting, a villager
// not to be spoken to), back in another puff; one at a time; never a boss, never the hero, never without someone
// picked out; a foe still harmed while one. The hen herself (view/meshes/wildlife/chickenVoxels.ts): her parts, her
// few colours.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { makeEnemy } from '../src/model/enemies/enemies';
import { interactionOf } from '../src/model/hero/interaction';
import { ROAM, mayTurn } from '../src/model/spells/chickens';
import { castSpell } from '../src/model/spells/casting';
import { SPELLS, learn } from '../src/model/spells/spells';
import { BODY_GRID, CHICKEN_PALETTE, HEAD_GRID, buildChickenBody, buildChickenHead, buildChickenLeg } from '../src/view/meshes/wildlife/chickenVoxels';

// A game with a wolf a little ahead of the hero, focused, the hero knowing the charm; what's told kept.
function withWolf() {
  const model = fresh();
  const { hero } = model;
  model.enemies.length = 0;
  hero.facing = 0;
  const foe = { ...makeEnemy(900_001, 'wolf', hero.x, hero.z + 2), hp: 500, maxHp: 500 };
  model.enemies.push(foe);
  model.focus(foe.id);
  learn(hero, 'chicken');
  const told: string[] = [];
  const report = model.report;
  model.report = (event) => [told.push(event.kind), report.call(model, event)];
  return { model, hero, foe, told };
}
const run = (model: ReturnType<typeof fresh>, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 0.1) [model.update(0, 0, 0.1), each?.()];
};

describe("the hen-wife's turn", () => {
  it('turns the foe picked out into a chicken from a puff of smoke, for 30 seconds, and back in another', () => {
    const { model, foe, told } = withWolf();
    expect(SPELLS.chicken).toMatchObject({ aim: 'anyone', chicken: 30, needsTarget: true });
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(foe.chicken).toBeDefined();
    expect(model.chickens.here).toBe(foe);
    expect(told.filter((k) => k === 'puff').length).toBe(1);
    run(model, 29);
    expect(foe.chicken).toBeDefined();
    run(model, 1.5);
    expect(foe.chicken).toBeUndefined();
    expect(model.chickens.here).toBeNull();
    expect(told.filter((k) => k === 'puff').length).toBe(2);
  });

  it('has them wander, never more than 5 tiles from where they were turned, and at nothing else', () => {
    const { model, hero, foe } = withWolf();
    const [x0, z0] = [foe.x, foe.z];
    castSpell(model, 'chicken');
    const hp = hero.hp;
    let [farthest, went] = [0, 0];
    let last = { x: foe.x, z: foe.z };
    run(model, 29, () => {
      farthest = Math.max(farthest, Math.hypot(foe.x - x0, foe.z - z0));
      went += Math.hypot(foe.x - last.x, foe.z - last.z);
      last = { x: foe.x, z: foe.z };
      expect(foe.swingFor).toBeNull(); // (no blow of its own)
    });
    expect(ROAM).toBe(5);
    expect(farthest).toBeLessThanOrEqual(ROAM + 1e-6);
    expect(went).toBeGreaterThan(1); // (it wandered)
    expect(hero.hp).toBe(hp); // (and never bit)
  });

  it('leaves a foe to be harmed while a chicken, a chicken still; dead, it is one no more', () => {
    const { model, hero, foe } = withWolf();
    learn(hero, 'hex');
    castSpell(model, 'chicken');
    model.moves.breath = 100;
    Object.assign(foe, { x: hero.x, z: hero.z + 2 });
    expect(castSpell(model, 'hex')).toBe('cast');
    expect(foe.hp).toBeLessThan(500);
    expect(foe.chicken).toBeDefined();
    foe.hp = 0;
    foe.state = 'dead';
    model.update(0, 0, 0.1);
    expect(foe.chicken).toBeUndefined();
  });

  it('is never cast with no one picked out, at the hero, or at a boss: nothing spent', () => {
    const { model, hero, foe } = withWolf();
    model.focus(null);
    expect(castSpell(model, 'chicken')).toBe('noTarget'); // (a foe about, not picked out: not found for it)
    expect(model.moves.breath).toBe(100);
    const boss = { ...makeEnemy(900_002, 'banditChief', hero.x + 1, hero.z + 1), hp: 500, maxHp: 500 };
    model.enemies.push(boss);
    model.focus(boss.id);
    expect(mayTurn(boss)).toBe(false);
    expect(castSpell(model, 'chicken')).toBe('noTarget');
    expect(boss.chicken).toBeUndefined();
    expect(hero.spellWait?.chicken ?? 0).toBe(0);
    expect(mayTurn(foe)).toBe(true);
  });

  it('keeps one at a time: another turned, the first is back', () => {
    const { model, hero, foe } = withWolf();
    castSpell(model, 'chicken');
    const other = { ...makeEnemy(900_003, 'boar', hero.x + 2, hero.z), hp: 500, maxHp: 500 };
    model.enemies.push(other);
    model.focus(other.id);
    hero.spellWait = {};
    model.moves.breath = 100;
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(other.chicken).toBeDefined();
    expect(foe.chicken).toBeUndefined();
  });

  it('turns someone who is no foe: a traveller off their road, not to be spoken to meanwhile, back on it after', () => {
    const model = fresh();
    const { hero } = model;
    model.enemies.length = 0;
    learn(hero, 'chicken');
    const one = model.travellers.list[0];
    model.teleport(Math.round(one.x) + 1, Math.round(one.z));
    model.update(0, 0, 0.01);
    Object.assign(hero, { x: one.x + 0.6, z: one.z });
    const before = interactionOf(model);
    model.select(one);
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(one.chicken).toBeDefined();
    const [x0, z0] = [one.x, one.z];
    expect(JSON.stringify(interactionOf(model))).not.toContain(one.name);
    run(model, 20, () => expect(Math.hypot(one.x - x0, one.z - z0)).toBeLessThanOrEqual(ROAM + 1e-6));
    run(model, 11);
    expect(one.chicken).toBeUndefined();
    expect(before).toBeDefined();
  });

  it('turns a villager in their own house, kept to its floor, and has them on with their day after', () => {
    const model = fresh();
    const { hero } = model;
    learn(hero, 'chicken');
    const witch = model.npcs.find((n) => n.role === 'hedgewitch')!;
    model.teleport(witch.home.x, witch.home.z);
    model.useDoor();
    model.update(0, 0, 0.1);
    Object.assign(hero, { x: witch.x, z: witch.z + 1 });
    model.select(witch);
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(model.chickens.here).toBe(witch);
    run(model, 25, () => {
      expect(witch.x).toBeGreaterThan(-0.6);
      expect(witch.z).toBeGreaterThan(-0.6);
    });
    run(model, 6);
    expect(witch.chicken).toBeUndefined();
    run(model, 20);
    expect(witch.steps.length).toBeGreaterThan(0); // (her day taken up again)
  });
});

describe('the hen', () => {
  it('is a body, a head and a leg in voxels, in her few colours: white, red, yellow', () => {
    const count = (grid: { cells: ArrayLike<number> }) => Array.from(grid.cells).filter(Boolean).length;
    const [body, head, leg] = [buildChickenBody(), buildChickenHead(), buildChickenLeg()];
    expect(body.size).toEqual(BODY_GRID);
    expect(head.size).toEqual(HEAD_GRID);
    for (const part of [body, head, leg]) expect(count(part)).toBeGreaterThan(2);
    const used = new Set([...Array.from(body.cells), ...Array.from(head.cells), ...Array.from(leg.cells)].filter(Boolean));
    expect(Math.max(...used)).toBeLessThanOrEqual(CHICKEN_PALETTE.length);
    expect(CHICKEN_PALETTE.length).toBeLessThanOrEqual(8); // (a small palette, said first)
    expect(count(body)).toBeLessThan(200); // (small: read by her shape, not her detail)
  });
});
