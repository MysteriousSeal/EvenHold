import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ATTACK_DURATION, ENEMY_CORPSE_TIME, ENEMY_STATS } from '../src/model/constants';
import { campPalisade, campPieces } from '../src/model/enemies';
import { cellKey } from '../src/model/grid';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import type { Enemy, EnemyKind } from '../src/model/types';

const FRAME = 1 / 60;
const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
const WOLF_HP = ENEMY_STATS.wolf.hp;
const WOLF_SIGHT = ENEMY_STATS.wolf.sight;
const WOLF_GIVE_UP = ENEMY_STATS.wolf.giveUp;
const nearest = (model: GameModel, kind: EnemyKind = 'wolf'): Enemy =>
  model.enemies.filter((e) => e.kind === kind).reduce((a, b) => (Math.hypot(a.x - model.hero.x, a.z - model.hero.z) < Math.hypot(b.x - model.hero.x, b.z - model.hero.z) ? a : b));

// Puts the wolf right in front of the hero (hero facing +X) and holds it there.
function faceToFace(model: GameModel, wolf: Enemy): void {
  model.update(1, 0, 1e-6); // face +X without really moving
  wolf.x = model.hero.x + 0.6;
  wolf.z = model.hero.z;
}

function swing(model: GameModel, wolf: Enemy): void {
  faceToFace(model, wolf);
  model.startAttack();
  for (let t = 0; t < ATTACK_DURATION + FRAME; t += FRAME) {
    model.update(0, 0, FRAME);
    if (wolf.state !== 'dead') faceToFace(model, wolf); // undo knockback so the next blow reaches
  }
}

describe('wolves', () => {
  it('a pack waits near spawn, on open ground, at full health', () => {
    const model = fresh();
    const wolf = nearest(model);
    expect(Math.hypot(wolf.x - model.hero.x, wolf.z - model.hero.z)).toBeLessThan(14);
    expect(model.enemies.every((w) => w.hp === ENEMY_STATS[w.kind].hp && model.isOpenTile(Math.round(w.x), Math.round(w.z)))).toBe(true);
  });

  it('chases the hero on sight and gives up when outrun', () => {
    const model = fresh();
    const wolf = nearest(model);
    model.teleport(Math.round(wolf.x) - 3, Math.round(wolf.z));
    const before = Math.hypot(wolf.x - model.hero.x, wolf.z - model.hero.z);
    expect(before).toBeLessThan(WOLF_SIGHT);
    for (let i = 0; i < 30; i++) model.update(0, 0, FRAME);
    expect(wolf.state).toBe('chase');
    expect(Math.hypot(wolf.x - model.hero.x, wolf.z - model.hero.z)).toBeLessThan(before);

    model.teleport(wolf.x + WOLF_GIVE_UP + 5, wolf.z);
    model.update(0, 0, FRAME);
    expect(wolf.state).toBe('wander');
  });

  it('loses a hit point per blow in front of the hero, and is shoved back', () => {
    const model = fresh();
    const wolf = nearest(model);
    model.teleport(Math.round(wolf.x) - 1, Math.round(wolf.z));
    faceToFace(model, wolf);
    model.startAttack();
    // Step until the blow lands, then look before the (now angry) wolf runs back in.
    for (let t = 0; t < ATTACK_DURATION && wolf.hp === WOLF_HP; t += FRAME) model.update(0, 0, FRAME);
    expect(wolf.hp).toBe(WOLF_HP - 1);
    expect(wolf.x - model.hero.x).toBeGreaterThan(0.6); // knocked away
    expect(wolf.state).toBe('chase');
  });

  it('is not hit by a blow aimed the other way', () => {
    const model = fresh();
    const wolf = nearest(model);
    model.teleport(Math.round(wolf.x) - 1, Math.round(wolf.z));
    model.update(-1, 0, 1e-6); // face -X, away from the wolf
    wolf.x = model.hero.x + 0.6;
    wolf.z = model.hero.z;
    model.startAttack();
    for (let t = 0; t < ATTACK_DURATION; t += FRAME) model.update(0, 0, FRAME);
    expect(wolf.hp).toBe(WOLF_HP);
  });

  it('dies after its last hit point, then disappears once the death has played', () => {
    const model = fresh();
    const wolf = nearest(model);
    model.teleport(Math.round(wolf.x) - 1, Math.round(wolf.z));
    for (let i = 0; i < WOLF_HP; i++) swing(model, wolf);
    expect(wolf.state).toBe('dead');
    expect(model.enemies).toContain(wolf);
    for (let t = 0; t < ENEMY_CORPSE_TIME + 0.1; t += FRAME) model.update(0, 0, FRAME);
    expect(model.enemies).not.toContain(wolf);
  });
});

describe('wolf collision', () => {
  it('blocks the hero, but never pins them', () => {
    const model = fresh();
    const wolf = nearest(model);
    model.teleport(Math.round(wolf.x) - 1, Math.round(wolf.z));
    wolf.x = model.hero.x + 0.6;
    wolf.z = model.hero.z;
    wolf.state = 'dead'; // hold it still for the check (dead wolves don't block)…
    model.update(1, 0, 0.05);
    const passesDead = model.hero.x;
    expect(passesDead).toBeGreaterThan(Math.round(wolf.x) - 1);

    wolf.state = 'wander';
    wolf.restFor = 99; // …and a living one, resting, does
    model.teleport(wolf.x - 0.6, wolf.z);
    for (let i = 0; i < 30; i++) model.update(1, 0, FRAME);
    expect(wolf.x - model.hero.x).toBeGreaterThanOrEqual(0.32 - 1e-9); // stopped against it

    const before = model.hero.x;
    for (let i = 0; i < 10; i++) model.update(-1, 0, FRAME);
    expect(model.hero.x).toBeLessThan(before); // can back away
  });
});

describe('bandits', () => {
  it('camp near spawn: a fire and a tent that block, with bandits around', () => {
    const model = fresh();
    const camp = model.camps[0];
    expect(Math.hypot(camp.x - model.hero.x, camp.z - model.hero.z)).toBeLessThan(25);
    // Everything but the loot blocks; a palisade rings the camp but for the entrance.
    for (const piece of campPieces(camp)) expect(model.isOpenTile(piece.x, piece.z)).toBe(piece.kind === 'loot');
    expect(campPalisade(camp).length).toBe(19); // 5 edges on each of 4 sides, less the entrance

    const around = model.enemies.filter((e) => e.kind === 'bandit' && Math.hypot(e.x - camp.x, e.z - camp.z) <= 4);
    expect(around.length).toBeGreaterThanOrEqual(2);
    expect(new Set(model.enemies.map((e) => cellKey(e.x, e.z))).size).toBe(model.enemies.length); // one per tile
  });

  it('swings when in reach, then waits before swinging again', () => {
    const model = fresh();
    const bandit = nearest(model, 'bandit');
    model.teleport(Math.round(bandit.x) - 2, Math.round(bandit.z));
    let swung = false;
    for (let i = 0; i < 120 && !swung; i++) {
      model.update(0, 0, FRAME);
      swung = bandit.swingFor !== null;
    }
    expect(swung).toBe(true);
    for (let t = 0; t <= ENEMY_STATS.bandit.swing; t += FRAME) model.update(0, 0, FRAME);
    expect(bandit.swingFor).toBeNull();
    expect(bandit.cooldown).toBeGreaterThan(0);
  });

  it('takes five hits, and a hit cuts its swing short', () => {
    const model = fresh();
    const bandit = nearest(model, 'bandit');
    model.enemies.splice(0, model.enemies.length, bandit); // blows land on the nearest; keep just this one
    model.teleport(Math.round(bandit.x) - 1, Math.round(bandit.z));
    bandit.swingFor = 0.1;
    swing(model, bandit);
    expect(bandit.hp).toBe(ENEMY_STATS.bandit.hp - 1);
    for (let i = 1; i < ENEMY_STATS.bandit.hp; i++) swing(model, bandit);
    expect(bandit.state).toBe('dead');
  });
});

describe('wolf bite', () => {
  it('lunges once in reach, then waits', () => {
    const model = fresh();
    const wolf = nearest(model);
    model.teleport(Math.round(wolf.x) - 2, Math.round(wolf.z));
    let bit = false;
    for (let i = 0; i < 120 && !bit; i++) {
      model.update(0, 0, FRAME);
      bit = wolf.swingFor !== null;
    }
    expect(bit).toBe(true);
    for (let t = 0; t <= ENEMY_STATS.wolf.swing; t += FRAME) model.update(0, 0, FRAME);
    expect(wolf.swingFor).toBeNull();
    expect(wolf.cooldown).toBeGreaterThan(0);
  });
});

describe('enemy spawning', () => {
  it.each([1, 2, 5, 11, 42, 99, 123, 777])('seed %i: generates without error', (seed) => {
    // Seeds 1, 5, 11 and 42 once crashed on a camp site past the map's far
    // edge. (A tiny test world may have no flat spot for a camp at all.)
    const model = new GameModel(seed, TEST_MAP_SIZE);
    expect(model.enemies.length).toBeGreaterThan(0);
  });
});

describe('enemy collisions', () => {
  const gap = (a: Enemy, b: Enemy) => Math.hypot(a.x - b.x, a.z - b.z) - ENEMY_STATS[a.kind].radius - ENEMY_STATS[b.kind].radius;

  it('eases apart enemies left on top of each other, wolves and bandits alike', () => {
    const model = fresh();
    const [a, b, c] = [nearest(model, 'wolf'), ...model.enemies.filter((e) => e.kind === 'wolf').slice(1, 2), nearest(model, 'bandit')];
    model.enemiesFrozen = false;
    for (const e of [a, b, c]) {
      e.x = a.x;
      e.z = a.z;
    }
    model.teleport(Math.round(a.x) + 8, Math.round(a.z)); // near enough to be awake, out of sight
    model.enemies.splice(0, model.enemies.length, a, b, c);
    for (let t = 0; t < 2; t += FRAME) model.update(0, 0, FRAME);
    for (const [p, q] of [[a, b], [a, c], [b, c]]) expect(gap(p, q)).toBeGreaterThan(-0.02);
  });

  it('never lets a pack closing in on the hero pile up', () => {
    const model = fresh();
    const wolves = model.enemies.filter((e) => e.kind === 'wolf').slice(0, 3);
    const lead = wolves[0];
    model.teleport(Math.round(lead.x) + 3, Math.round(lead.z));
    model.enemies.splice(0, model.enemies.length, ...wolves);
    wolves.forEach((w, i) => {
      w.x = lead.x - 0.4 * i;
      w.z = lead.z;
    });
    model.godMode = true;
    for (let t = 0; t < 4; t += FRAME) {
      model.update(0, 0, FRAME);
      for (let i = 0; i < wolves.length; i++) for (let j = i + 1; j < wolves.length; j++) expect(gap(wolves[i], wolves[j])).toBeGreaterThan(-0.02);
    }
  });
});
