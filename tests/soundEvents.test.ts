// What the model tells for the view's sounds (view/audio/): a blow begun and a roll (their whoosh), a foe slain and the
// hero felled, each stroke of a tool at work landing (skills/strokes.ts: once a swing, at its strike), a line cast.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { heroStruck, strike } from '../src/model/hero/fighting';
import { makeEnemy } from '../src/model/enemies/enemies';
import { Strokes } from '../src/model/skills/strokes';
import { SWING } from '../src/model/skills/lumber';
import { Fishing, type FishingHost } from '../src/model/skills/fishing';
import { freshHero } from '../src/model/hero/heroStats';
import type { GameEvent } from '../src/model/types';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  model.random = () => 0.999; // (no dodge, no critical blow by chance)
  model.enemies.length = 0;
  model.takeEvents();
  return model;
};
const kinds = (model: GameModel) => model.takeEvents().map((e) => e.kind);

describe('a fight tells', () => {
  it('a swing as a blow begins, and a roll; nothing when neither could', () => {
    const model = fresh();
    model.startAttack();
    expect(model.takeEvents()).toContainEqual({ kind: 'swing' });
    model.startAttack(); // (mid-blow: none)
    expect(kinds(model)).not.toContain('swing');
    for (let t = 0; t < 2; t += 0.05) model.update(0, 0, 0.05);
    model.takeEvents();
    model.roll(1, 0);
    expect(model.takeEvents()).toContainEqual({ kind: 'swing', roll: true });
  });

  it('a foe slain where it falls (and not one only hurt)', () => {
    const model = fresh();
    const wolf = makeEnemy(900, 'wolf', model.hero.x + 1, model.hero.z);
    strike(model, wolf, 1, false);
    expect(kinds(model)).not.toContain('slain');
    strike(model, wolf, 99, false);
    expect(model.takeEvents()).toContainEqual({ kind: 'slain', on: 'wolf', x: wolf.x, y: wolf.y, z: wolf.z });
  });

  it('the hero felled', () => {
    const model = fresh();
    model.hero.hp = 1;
    heroStruck(model, 5, makeEnemy(901, 'wolf', model.hero.x, model.hero.z + 0.5));
    expect(kinds(model)).toContain('fallen');
  });
});

describe('a stroke at work', () => {
  it('told once a swing, as it passes its strike, the wrap round too', () => {
    const told: GameEvent[] = [];
    const strokes = new Strokes();
    for (const swing of [null, 0, 0.3, 0.49, 0.6, 0.9, 0.1, 0.4, 0.7, 0.2]) strokes.update(swing === null ? null : { tool: 'axe', swing }, (e) => told.push(e));
    expect(told).toEqual([{ kind: 'stroke', tool: 'axe' }, { kind: 'stroke', tool: 'axe' }]);
    strokes.update({ tool: 'axe', swing: 0.3 }, (e) => told.push(e)); // (0.2 → 0.3)
    strokes.update({ tool: 'pick', swing: 0.8 }, (e) => told.push(e)); // (another tool begun: from where it is)
    expect(told).toHaveLength(2);
  });

  it('chopping a tree: an axe stroke each swing', () => {
    const model = fresh();
    const tree = model.trees.find((t) => t.kind === 'birch')!;
    Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z });
    model.hero.equipment.mainHand = 'hatchet';
    expect(model.lumber.use()).toBe(true);
    const told: GameEvent[] = [];
    for (let t = 0; t < SWING * 3 - 0.05; t += 0.05) [model.update(0, 0, 0.05), told.push(...model.takeEvents())];
    expect(told.filter((e) => e.kind === 'stroke')).toEqual([0, 1, 2].map(() => ({ kind: 'stroke', tool: 'axe' })));
  });
});

describe('the bag', () => {
  it('a potion drunk, a drink had, food eaten: told, from the action bar or the bag; nothing when it was not', () => {
    const model = fresh();
    model.hero.hp = 1;
    Object.assign(model.hero.bag, { minorHealthPotion: 2, bread: 1, ale: 1 });
    model.hero.actionBar[0] = 'minorHealthPotion';
    expect(model.useAction(0)).toBe(true);
    expect(model.takeEvents()).toContainEqual({ kind: 'consumed', drink: true });
    model.useAction(0); // (the potion's wait not yet over: refused)
    expect(kinds(model)).not.toContain('consumed');
    expect(model.consume('bread')).toBe(true);
    expect(model.takeEvents()).toContainEqual({ kind: 'consumed', drink: false });
    model.hero.eating = null;
    expect(model.consume('ale')).toBe(true);
    expect(model.takeEvents()).toContainEqual({ kind: 'consumed', drink: true });
  });
});

describe('fishing', () => {
  it('a line cast is told', () => {
    const hero = Object.assign(freshHero({ x: -1, z: 10 }), { facing: Math.PI / 2 });
    hero.bag.fishingRod = 1;
    const events: GameEvent[] = [];
    const host: FishingHost & { inside: unknown; yard: unknown } = { hero, tiles: { lake: (x, z) => x >= 0 && x <= 20 && z >= 0 && z <= 20 }, inside: null, yard: null, dropLoot: () => {}, report: (e) => events.push(e) };
    expect(new Fishing(host, () => 0.5).use()).toBe(true);
    expect(events).toEqual([{ kind: 'castLine' }]);
  });
});
