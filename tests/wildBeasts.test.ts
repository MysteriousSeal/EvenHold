// The wilds' fiercer beasts (model/enemies/wildMoves.ts, enemies.ts): brown
// bears alone in deep forest, lynxes at the forest's edges, placed after every
// other foe (so the rest keep their ids, and a save its slain). A bear rears
// up and slams down round it (whoever's in it hurt and knocked away), and
// charges only once it's hurt; a lynx pounces from a few tiles off, biting
// where it lands. They drop their own spoils, cooking ingredients among them;
// and the cheats go to them, and spawn them.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { makeEnemy } from '../src/model/enemies/enemies';
import { createForestDensity } from '../src/model/worldgen/trees';
import { rollDrop } from '../src/model/loot/loot';
import { INGREDIENTS } from '../src/model/loot/ingredients';
import { JUNK_ITEMS } from '../src/model/loot/junk';
import { nearestOf, spawnEnemyNear } from '../src/model/cheats';
import { SLAM_TELL, CHARGE_TELL, POUNCE_TELL } from '../src/model/enemies/wildMoves';
import type { Enemy, EnemyKind } from '../src/model/types';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const world = new GameModel(1, MID);

// A fresh world, the hero standing on open ground, `kind` set on them `far` tiles off (+x), the rest of the foes still.
const faceOff = (kind: EnemyKind, far: number) => {
  const model = new GameModel(2, MID);
  for (const e of model.enemies) e.state = 'dead';
  const { x, z } = model.hero;
  let at = { x: x + far, z };
  for (let k = 0; k < 40 && !model.isOpenTile(Math.round(at.x), Math.round(at.z)); k++) at = { x: x + far, z: z + k * 0.5 };
  const beast: Enemy = { ...makeEnemy(900_000, kind, at.x, at.z, at.x, at.z, 3), state: 'chase', y: model.getGroundY(at.x, at.z) };
  model.enemies.push(beast);
  Object.assign(model.hero, { maxHp: 10_000, hp: 10_000, z: at.z });
  model.random = () => 0.99; // (no dodging)
  return { model, beast };
};
const run = (model: GameModel, seconds: number, until: () => boolean = () => false) => {
  for (let t = 0; t < seconds && !until(); t += FRAME) model.update(0, 0, FRAME);
};

describe('the wilds\' fiercer beasts', () => {
  it('live where they should: bears in deep forest, lynxes at its edges; last of all the foes (the rest keep their ids)', () => {
    const forest = createForestDensity(world.seed);
    const bears = world.enemies.filter((e) => e.kind === 'bear');
    const lynxes = world.enemies.filter((e) => e.kind === 'lynx');
    expect(bears.length).toBeGreaterThan(3);
    expect(lynxes.length).toBeGreaterThan(bears.length);
    for (const b of bears) expect(forest(b.homeX, b.homeZ)).toBeGreaterThanOrEqual(0.35);
    for (const l of lynxes) expect(forest(l.homeX, l.homeZ)).toBeLessThan(0.32);
    const others = world.enemies.filter((e) => e.kind !== 'bear' && e.kind !== 'lynx');
    expect(Math.min(...[...bears, ...lynxes].map((e) => e.id))).toBeGreaterThan(Math.max(...others.map((e) => e.id)));
  });

  it('a bear rears up and slams down round it: the hero in it hurt and knocked away', () => {
    const { model, beast } = faceOff('bear', 1.2);
    const hp = model.hero.hp;
    const x0 = model.hero.x;
    run(model, 10, () => beast.told === 'slam');
    expect(beast.told).toBe('slam');
    expect(model.wild.slams.moves).toHaveLength(1);
    run(model, SLAM_TELL + 0.4);
    expect(model.hero.hp).toBeLessThan(hp);
    expect(Math.abs(model.hero.x - x0)).toBeGreaterThan(0.3); // (knocked)
  });

  it('a bear charges only once it\'s hurt', () => {
    const { model, beast } = faceOff('bear', 4);
    beast.hp = beast.maxHp;
    let charged = false;
    for (let t = 0; t < 3; t += FRAME) {
      Object.assign(beast, { x: model.hero.x + 4, z: model.hero.z }); // (kept off, out of reach)
      model.update(0, 0, FRAME);
      charged ||= beast.told === 'charge';
    }
    expect(charged).toBe(false);
    beast.hp = Math.floor(beast.maxHp * 0.4);
    run(model, 6, () => beast.told === 'charge');
    expect(beast.told).toBe('charge');
    expect(model.wild.charges.moves[0].t).toBeLessThan(CHARGE_TELL + 1);
  });

  it('a lynx pounces from a few tiles off, its bite where it lands', () => {
    const { model, beast } = faceOff('lynx', 3);
    const hp = model.hero.hp;
    run(model, 6, () => beast.told === 'lunge');
    expect(beast.told).toBe('lunge');
    const from = { x: beast.x, z: beast.z };
    run(model, POUNCE_TELL + 0.5);
    expect(Math.hypot(beast.x - from.x, beast.z - from.z)).toBeGreaterThan(1); // (it leapt)
    expect(model.hero.hp).toBeLessThan(hp);
  });

  it('drop their own spoils: cooking ingredients (bear meat, honeycomb, lynx meat), claws and pelts', () => {
    const own = (family: 'bear' | 'lynx') => [...Object.entries(JUNK_ITEMS), ...Object.entries(INGREDIENTS)].filter(([, item]) => (item.droppedBy as Record<string, number>)[family]).map(([id]) => id);
    for (const family of ['bear', 'lynx'] as const) {
      const drops = new Set(Array.from({ length: 300 }, (_, i) => rollDrop(family, i, 1)));
      expect([...drops].every((id) => id !== null && own(family).includes(id))).toBe(true);
      expect([...drops].some((id) => id! in INGREDIENTS)).toBe(true);
    }
    expect(own('bear')).toEqual(expect.arrayContaining(['rawBearMeat', 'honeycomb']));
    expect(own('lynx')).toContain('leanLynxMeat');
  });

  it('the cheats: going to the nearest of each; spawning one just ahead, its told moves its own', () => {
    for (const kind of ['bear', 'lynx'] as const) expect(nearestOf(world, { x: world.hero.x, z: world.hero.z }, kind)).not.toBeNull();
    const model = new GameModel(1, MID);
    spawnEnemyNear(model, 'bear');
    const bear = model.enemies.at(-1)!;
    expect(bear.kind).toBe('bear');
    expect(Math.hypot(bear.x - model.hero.x, bear.z - model.hero.z)).toBeLessThan(4);
  });
});
