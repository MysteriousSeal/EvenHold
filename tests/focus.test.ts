import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, FOCUS_RANGE } from '../src/model/constants';
import { FRAME, fresh } from './support/testWorld';
import { cycleFocus } from '../src/model/hero/focus';
import { makeEnemy } from '../src/model/enemies/enemies';
import type { Enemy } from '../src/model/types';

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
    Object.assign(bandit, { x: model.hero.x + 0.5, z: model.hero.z, homeX: model.hero.x, homeZ: model.hero.z, state: 'chase' }); // (at home here: not off back to a camp far away)
    wolf.x = model.hero.x - 5; // out of the way for now
    for (let t = 0; t < ENEMY_STATS.bandit.swing + FRAME && !model.focused; t += FRAME) model.update(0, 0, FRAME);
    expect(model.focused).toBe(bandit);
    wolf.x = model.hero.x;
    wolf.z = model.hero.z + 0.45;
    wolf.state = 'chase';
    for (let t = 0; t < 2; t += FRAME) model.update(0, 0, FRAME);
    expect(model.focused).toBe(bandit); // a second attacker doesn't take the focus
  });

  it('focuses the foe the hero strikes, if none is focused; never steals it from the one that is', () => {
    const model = fresh();
    model.godMode = true;
    const [a, b] = model.enemies.filter((e) => e.kind === 'bandit');
    model.enemies.splice(0, model.enemies.length, a, b);
    Object.assign(a, { x: model.hero.x, z: model.hero.z + 0.45, homeX: model.hero.x, homeZ: model.hero.z, hp: 99, maxHp: 99 }); // (at home here: not off back to its camp, a walk away)
    b.x = model.hero.x + 9;
    model.hero.facing = 0; // (toward a)
    model.startAttack();
    for (let t = 0; t < 1; t += FRAME) model.update(0, 0, FRAME);
    expect(a.hp).toBeLessThan(99);
    expect(model.focused).toBe(a);
    // Focused on b (clicked), a blow on a leaves the focus with b.
    Object.assign(b, { x: model.hero.x + 2, z: model.hero.z });
    model.focus(b.id);
    Object.assign(model.hero, { facing: 0 });
    Object.assign(a, { x: model.hero.x, z: model.hero.z + 0.45 });
    model.startAttack();
    for (let t = 0; t < 1; t += FRAME) model.update(0, 0, FRAME);
    expect(model.focused).toBe(b);
  });

  it('lets go the moment its enemy dies, so the next one to strike takes the focus', () => {
    const model = fresh();
    model.godMode = true;
    const [a, b] = model.enemies.filter((e) => e.kind === 'bandit');
    model.enemies.splice(0, model.enemies.length, a, b);
    model.focus(a.id);
    a.state = 'dead';
    model.update(0, 0, FRAME);
    expect(model.focused).toBeNull();
    Object.assign(b, { x: model.hero.x + 0.5, z: model.hero.z, homeX: model.hero.x, homeZ: model.hero.z, state: 'chase' });
    for (let t = 0; t < ENEMY_STATS.bandit.swing + FRAME && !model.focused; t += FRAME) model.update(0, 0, FRAME);
    expect(model.focused).toBe(b);
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
    expect(a.hp).toBe(a.maxHp - 1);
    expect(b.hp).toBe(b.maxHp);
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

  it('turns with Tab to the next foe in sight, nearest first, round again; Shift+Tab back; none dead, too far or unseen', () => {
    const at = { x: 0, z: 0 };
    const foe = (id: number, x: number, more: Partial<Enemy> = {}): Enemy => ({ ...makeEnemy(id, 'wolf', x, 0), ...more });
    const foes = [foe(1, 3), foe(2, 1), foe(3, 2), foe(4, 1.5, { state: 'dead' }), foe(5, FOCUS_RANGE + 2), foe(6, 2.5)];
    let focused: Enemy | null = null;
    const focusing = { hero: at, foes, get focused() { return focused; }, focus: (id: number | null) => void (focused = foes.find((f) => f.id === id) ?? null) };
    const sees = (f: Enemy) => f.id !== 6; // (6 behind a wall)
    const order: number[] = [];
    for (let i = 0; i < 4; i++) {
      cycleFocus(focusing, sees);
      order.push(focused!.id);
    }
    expect(order).toEqual([2, 3, 1, 2]); // nearest first (2 at 1, 3 at 2, 1 at 3), round again
    cycleFocus(focusing, sees, true);
    expect(focused!.id).toBe(1); // back
    cycleFocus({ ...focusing, foes: [] }, sees);
    expect(focused).toBeNull(); // nothing to focus: let go
  });

  it('turns with Tab in the game, among the foes in sight of the hero', () => {
    const model = fresh();
    const near = model.enemies.filter((e) => e.state !== 'dead').slice(0, 2);
    model.enemies.splice(0, model.enemies.length, ...near);
    Object.assign(near[0], { x: model.hero.x + 1, z: model.hero.z });
    Object.assign(near[1], { x: model.hero.x + 2, z: model.hero.z });
    model.cycleFocus();
    expect(model.focused).toBe(near[0]);
    model.cycleFocus();
    expect(model.focused).toBe(near[1]);
    model.cycleFocus(true);
    expect(model.focused).toBe(near[0]);
  });
});
