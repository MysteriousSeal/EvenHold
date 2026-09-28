import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS, FOCUS_RANGE } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 60;
const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

describe('enemy focus', () => {
  it('focuses a living enemy by id; not a dead one, and null lets go', () => {
    const model = fresh();
    const [a, b] = model.enemies;
    model.focus(a.id);
    expect(model.focused).toBe(a);
    b.state = 'dead';
    model.focus(b.id);
    expect(model.focused).toBeNull();
    model.focus(a.id);
    model.focus(null);
    expect(model.focused).toBeNull();
  });

  it('focuses the first enemy to land a blow, even when invulnerable, and keeps it', () => {
    const model = fresh();
    model.godMode = true;
    const bandit = model.enemies.find((e) => e.kind === 'bandit')!;
    const wolf = model.enemies.find((e) => e.kind === 'wolf')!;
    model.enemies.splice(0, model.enemies.length, bandit, wolf);
    bandit.x = model.hero.x + 0.5;
    bandit.z = model.hero.z;
    bandit.state = 'chase';
    wolf.x = model.hero.x - 5; // out of the way for now
    for (let t = 0; t < ENEMY_STATS.bandit.swing + FRAME && !model.focused; t += FRAME) model.update(0, 0, FRAME);
    expect(model.focused).toBe(bandit);
    wolf.x = model.hero.x;
    wolf.z = model.hero.z + 0.45;
    wolf.state = 'chase';
    for (let t = 0; t < 2; t += FRAME) model.update(0, 0, FRAME);
    expect(model.focused).toBe(bandit); // a second attacker doesn't take the focus
  });

  it('lets go of an enemy that is far off or gone', () => {
    const model = fresh();
    const [a] = model.enemies;
    model.focus(a.id);
    a.x = model.hero.x + FOCUS_RANGE + 1;
    model.update(0, 0, FRAME);
    expect(model.focused).toBeNull();
    model.focus(a.id);
    model.enemies.splice(model.enemies.indexOf(a), 1);
    model.update(0, 0, FRAME);
    expect(model.focused).toBeNull();
  });
});

describe('striking the focused enemy', () => {
  it('turns to face it when close and lands the blow on it, even with another closer', async () => {
    const { ATTACK_DURATION } = await import('../src/model/constants');
    const model = fresh();
    model.godMode = true;
    model.enemiesFrozen = true;
    const [a, b] = model.enemies.filter((e) => e.kind === 'wolf');
    model.enemies.splice(0, model.enemies.length, a, b);
    model.update(1, 0, 1e-6); // facing +X
    a.x = model.hero.x;
    a.z = model.hero.z - 0.7; // behind the hero's facing, to -Z
    b.x = model.hero.x + 0.5; // nearer, straight ahead
    b.z = model.hero.z;
    model.focus(a.id);
    model.startAttack();
    expect(Math.abs(Math.atan2(Math.sin(model.hero.facing - Math.PI), Math.cos(model.hero.facing - Math.PI)))).toBeLessThan(1e-6);
    for (let t = 0; t < ATTACK_DURATION + FRAME; t += FRAME) model.update(0, 0, FRAME);
    expect(a.hp).toBe(ENEMY_STATS.wolf.hp - 1);
    expect(b.hp).toBe(ENEMY_STATS.wolf.hp);
  });

  it('keeps its facing when the focused enemy is far', () => {
    const model = fresh();
    const [a] = model.enemies;
    model.update(1, 0, 1e-6);
    const facing = model.hero.facing;
    a.x = model.hero.x;
    a.z = model.hero.z - 5;
    model.focus(a.id);
    model.startAttack();
    expect(model.hero.facing).toBe(facing);
  });
});
