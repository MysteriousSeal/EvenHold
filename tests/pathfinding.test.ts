import { describe, expect, it } from 'vitest';
import { findPath } from '../src/model/pathfinding';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_HEARING, ENEMY_LOSE_TIME, ENEMY_STATS } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// A wall along x = 5 up to z = 9, with a gap at z = 7.
const wall = (x: number, z: number) => !(Math.abs(x - 5) < 0.5 && z <= 9.5 && Math.round(z) !== 7);

describe('findPath', () => {
  it('goes round a wall through its gap, one tile at a time, never cutting corners', () => {
    const path = findPath({ x: 2, z: 2 }, { x: 8, z: 2 }, 20, wall);
    expect(path[path.length - 1]).toEqual({ x: 8, z: 2 });
    expect(path.some((p) => p.x === 5 && p.z === 7)).toBe(true);
    let prev = { x: 2, z: 2 };
    for (const p of path) {
      expect(Math.max(Math.abs(p.x - prev.x), Math.abs(p.z - prev.z))).toBe(1);
      expect(wall(p.x, p.z)).toBe(true);
      prev = p;
    }
  });

  it('with no way through, ends as close as it can get; already there, stays', () => {
    const sealed = (x: number) => !(Math.abs(x - 5) < 0.5);
    const path = findPath({ x: 2, z: 2 }, { x: 8, z: 2 }, 10, sealed);
    expect(path[path.length - 1]).toEqual({ x: 4, z: 2 });
    expect(findPath({ x: 2, z: 2 }, { x: 2.2, z: 1.9 }, 10, sealed)).toEqual([]);
  });
});

// A camp near spawn with a bandit inside it, and an open tile 3.5 tiles out
// behind its palisade (opposite the gate), or null.
function campScene() {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    for (const camp of model.camps) {
      let [bx, bz] = [0, -3.5];
      for (let q = 0; q < camp.quarterTurns; q++) [bx, bz] = [bz, -bx];
      const behind = { x: Math.round(camp.x + bx), z: Math.round(camp.z + bz) };
      if (!model.isOpenTile(behind.x, behind.z)) continue;
      const bandit = model.enemies.find((e) => e.kind === 'bandit' && Math.hypot(e.x - camp.x, e.z - camp.z) <= 2.5);
      if (!bandit) continue;
      model.enemies.splice(0, model.enemies.length, bandit);
      model.godMode = true;
      return { model, camp, bandit, behind };
    }
  }
  return null;
}
const FRAME = 1 / 30;

describe('enemies chase around obstacles', () => {
  it('a bandit that knows where the hero is walks out of its camp gate to reach them', () => {
    const scene = campScene()!;
    expect(scene).not.toBeNull();
    const { model, bandit, behind } = scene;
    model.teleport(behind.x, behind.z);
    bandit.state = 'chase';
    let reached = false;
    for (let t = 0; t < 20 && !reached; t += FRAME) {
      bandit.lastSeen = { x: model.hero.x, z: model.hero.z }; // someone keeps telling it
      bandit.lostFor = FRAME;
      model.update(0, 0, FRAME);
      reached = Math.hypot(bandit.x - model.hero.x, bandit.z - model.hero.z) <= ENEMY_STATS.bandit.stop + 0.1;
    }
    expect(reached).toBe(true);
  });
});

describe('enemy sight', () => {
  it("doesn't notice a hero hidden behind the palisade, but does one in plain view", () => {
    const { model, bandit, behind } = campScene()!;
    model.teleport(behind.x, behind.z);
    for (let t = 0; t < 1; t += FRAME) model.update(0, 0, FRAME);
    expect(bandit.state).toBe('wander');
    // Out in the open beside the hero, within sight, with nothing between: seen.
    const near = Math.floor(ENEMY_STATS.bandit.sight);
    const open = [[0, near], [near, 0], [0, -near], [-near, 0]].find(([dx, dz]) =>
      Array.from({ length: near }, (_, k) => k + 1).every((k) => model.isOpenTile(behind.x + (dx / near) * k, behind.z + (dz / near) * k)),
    );
    expect(open).toBeDefined();
    bandit.x = behind.x + open![0];
    bandit.z = behind.z + open![1];
    model.update(0, 0, FRAME);
    expect(bandit.state).toBe('chase');
  });

  it('hears a hero right next to it, even through cover', () => {
    const { model, bandit, behind } = campScene()!;
    model.teleport(behind.x, behind.z);
    bandit.x = model.hero.x + ENEMY_HEARING * 0.8; // within hearing, whatever's between
    bandit.z = model.hero.z;
    model.update(0, 0, FRAME);
    expect(bandit.state).toBe('chase');
  });

  it('hunts where it last saw the hero, then gives up and goes home', () => {
    const { model, bandit, behind } = campScene()!;
    model.teleport(behind.x, behind.z);
    bandit.state = 'chase';
    bandit.lastSeen = { x: bandit.x + 0.3, z: bandit.z }; // lost sight just there
    bandit.lostFor = FRAME;
    for (let t = 0; t < ENEMY_LOSE_TIME + 1 && bandit.state === 'chase'; t += FRAME) model.update(0, 0, FRAME);
    expect(bandit.state).toBe('wander'); // gave up, heading home
    expect(bandit.lastSeen).toBeNull();
  });
});
