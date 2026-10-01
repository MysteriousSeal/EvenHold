// The crypts' guards (model/crypts/cryptFoes.ts): skeletons posted on open
// floor away from the stairs, swordsmen and bowmen, a band in the great hall;
// gone down to, they wake at the sight of the hero and come on; a swordsman's
// blow and a bowman's arrow land; arrows stop at the rock; the slain stay
// slain (out and back in, and in a save), leaving their loot on the crypt's floor.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { cryptInside } from '../src/model/crypts/crypts';
import { isFloor, planCrypt } from '../src/model/crypts/cryptLayout';
import { furnishCrypt } from '../src/model/crypts/cryptProps';
import { CRYPT_FOE_ID, CryptFoes, guardPosts } from '../src/model/crypts/cryptFoes';
import { mulberry32 } from '../src/util/random';
import { parseSave, restore, snapshot } from '../src/model/save';
import { floorReached, solidTiles } from './support/cryptChecks';
import { resetCrypts, spawnDraugr } from '../src/model/cheats';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const goDown = (model: GameModel) => {
  const crypt = model.crypts[0];
  model.teleport(crypt.entrance.x, crypt.entrance.z);
  model.useDoor();
  return crypt;
};
// A spot `far` tiles from `foe` along the floor, in plain view of it (floor all the way).
const inView = (model: GameModel, foe: { x: number; z: number }, far: number) => {
  const { plan } = cryptInside(model.seed, model.inside!.entrance);
  return [[far, 0], [-far, 0], [0, far], [0, -far]]
    .map(([dx, dz]) => ({ x: foe.x + dx, z: foe.z + dz }))
    .find((p) => Array.from({ length: 9 }, (_, i) => i / 8).every((t) => isFloor(plan, Math.round(foe.x + (p.x - foe.x) * t), Math.round(foe.z + (p.z - foe.z) * t))));
};
const run = (model: GameModel, seconds: number, dx = 0, dz = 0) => {
  for (let t = 0; t < seconds; t += FRAME) model.update(dx, dz, FRAME);
};

describe('the crypts\' guards', () => {
  it('stand at posts on open floor, away from the stairs, the same every time; a band in the great hall; swordsmen, bowmen and draugr (more of them deeper in); none in the great hall (its lord\'s alone), none walled in (50 seeds)', () => {
    let archers = 0;
    let swords = 0;
    const draugr: number[] = []; // where along the crypt each stood (0 the far end, 1 the stairs)
    for (let i = 0; i < 50; i++) {
      const seed = Math.floor(mulberry32(8800 + i)() * 2 ** 31);
      const ruin = { x: 30 + i * 13, z: 40 + i * 7 };
      const plan = planCrypt(seed, ruin);
      const props = furnishCrypt(seed, ruin, plan);
      const inside = { crypt: { ruin, level: 3 }, plan, props } as unknown as Parameters<typeof guardPosts>[1];
      const posts = guardPosts(seed, inside);
      expect(guardPosts(seed, inside)).toEqual(posts);
      const solid = solidTiles(props);
      const reached = floorReached(plan, solid);
      const great = plan.places.find((p) => p.kind === 'great')!;
      expect(posts.filter((p) => p.x >= great.x0 - 1 && p.x <= great.x1 + 1 && p.z >= great.z0 - 1 && p.z <= great.z1 + 1)).toEqual([]); // (the lord's alone)
      expect(new Set(posts.map((p) => `${p.x},${p.z}`)).size).toBe(posts.length);
      for (const p of posts) {
        expect(isFloor(plan, p.x, p.z) && !solid.has(`${p.x},${p.z}`)).toBe(true);
        expect(reached.has(`${p.x},${p.z}`)).toBe(true);
        expect(Math.hypot(p.x - plan.door, p.z - (plan.depth - 1))).toBeGreaterThan(6);
        if (p.kind === 'skeletonArcher') archers++;
        else if (p.kind === 'draugr') draugr.push(p.z / plan.depth);
        else swords++;
      }
    }
    expect(archers).toBeGreaterThan(50);
    expect(swords).toBeGreaterThan(archers);
    // Draugr: about one guard in five, the more the deeper in (low z: far from the stairs).
    const all = archers + swords + draugr.length;
    expect(draugr.length / all).toBeGreaterThan(0.12);
    expect(draugr.length / all).toBeLessThan(0.32);
    expect(draugr.filter((z) => z < 0.5).length).toBeGreaterThan(draugr.filter((z) => z >= 0.5).length);
  });

  it('are there going down (the world\'s foes are not), of the crypt\'s level; gone again climbing out', () => {
    const model = new GameModel(1, MID);
    const crypt = goDown(model);
    expect(model.foes.length).toBeGreaterThan(5);
    expect(model.foes.every((f) => (f.kind === 'skeleton' || f.kind === 'skeletonArcher' || f.kind === 'draugr') && f.level === crypt.level && f.id >= CRYPT_FOE_ID)).toBe(true);
    expect(model.crypt).not.toBeNull();
    const { plan } = cryptInside(model.seed, crypt.entrance);
    Object.assign(model.hero, { x: plan.door, z: plan.depth - 1 });
    model.useDoor();
    expect(model.crypt).toBeNull();
    expect(model.foes).toBe(model.enemies);
  });

  it('wake at the sight of the hero and come on: a swordsman\'s blow lands', () => {
    const model = new GameModel(2, MID);
    goDown(model);
    model.random = () => 0.99; // (no dodging)
    const guard = model.foes.find((f) => f.kind === 'skeleton' && inView(model, f, 2))!;
    for (const f of model.foes) if (f !== guard) f.state = 'dead'; // (him alone)
    Object.assign(model.hero, inView(model, guard, 2));
    const hp = model.hero.hp;
    run(model, 4);
    expect(guard.state).toBe('chase');
    expect(model.hero.hp).toBeLessThan(hp);
  });

  it('a bowman looses an arrow that flies at the hero and strikes him; one aimed into the rock stops there', () => {
    const model = new GameModel(3, MID);
    goDown(model);
    model.random = () => 0.99;
    const crypt = model.crypt!;
    const archer = model.foes.find((f) => f.kind === 'skeletonArcher' && inView(model, f, 4))!;
    for (const f of model.foes) if (f !== archer) f.state = 'dead'; // (him alone)
    const plan = cryptInside(model.seed, model.inside!.entrance).plan;
    Object.assign(model.hero, inView(model, archer, 4)); // (where he sees him, at his distance)
    const hp = model.hero.hp;
    let flew = false;
    for (let t = 0; t < 5 && model.hero.hp === hp; t += FRAME) {
      model.update(0, 0, FRAME);
      flew ||= crypt.arrows.length > 0;
    }
    expect(flew).toBe(true);
    expect(model.hero.hp).toBeLessThan(hp);
    // Aimed into the rock: gone at it, never past.
    crypt.arrows.length = 0;
    const rockward = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !isFloor(plan, Math.round(archer.x + dx * 3), Math.round(archer.z + dz * 3)))!;
    crypt.arrows.push({ x: archer.x, z: archer.z, dx: rockward[0], dz: rockward[1], flown: 0, damage: 1 });
    Object.assign(model.hero, { x: archer.x - rockward[0] * 3, z: archer.z - rockward[1] * 3 });
    for (let t = 0; t < 1; t += FRAME) crypt.update(FRAME);
    expect(crypt.arrows.filter((a) => a.dx === rockward[0] && a.dz === rockward[1])).toHaveLength(0);
  });

  it('slain, leave their loot on the crypt\'s floor (not the world\'s), and stay slain: out and back in, and in a save', () => {
    const model = new GameModel(1, MID);
    const crypt = goDown(model);
    const guard = model.foes[0];
    const post = CryptFoes.postOf(guard);
    Object.assign(model.hero, { x: guard.x, z: guard.z + 0.4, facing: Math.PI });
    guard.hp = 1;
    model.focus(guard.id);
    const [worldLoot, worldCoins, money] = [model.loot.length, model.coins.length, model.hero.money];
    model.startAttack();
    run(model, 1);
    expect(guard.state).toBe('dead');
    // What it left on the crypt's floor (its coins scooped up at once, the hero beside them), none on the world's.
    expect(model.hero.money - money + model.groundHere.coins.length + model.groundHere.loot.length).toBeGreaterThan(0);
    expect([model.loot.length, model.coins.length]).toEqual([worldLoot, worldCoins]);
    // Out and back in: still slain.
    const plan = cryptInside(model.seed, crypt.entrance).plan;
    Object.assign(model.hero, { x: plan.door, z: plan.depth - 1 });
    model.useDoor();
    goDown(model);
    expect(model.foes.some((f) => CryptFoes.postOf(f) === post)).toBe(false);
    // And in a save.
    const loaded = new GameModel(1, MID);
    restore(loaded, parseSave(JSON.stringify(snapshot(model)), 1)!);
    expect(loaded.crypt).not.toBeNull();
    expect(loaded.foes.some((f) => CryptFoes.postOf(f) === post)).toBe(false);
    expect(loaded.foes.length).toBe(model.foes.length);
  });

  it('are all back at their posts with the Reset crypts cheat, the hero out at the stairs first if down in one', () => {
    const model = new GameModel(2, MID);
    const crypt = goDown(model);
    const all = model.foes.length;
    model.foes[0].state = 'dead';
    model.slayGuard(model.foes[0]);
    resetCrypts(model);
    expect(model.inside).toBeNull();
    expect(Math.hypot(model.hero.x - crypt.entrance.x, model.hero.z - crypt.entrance.z)).toBeLessThan(0.01);
    goDown(model);
    expect(model.foes).toHaveLength(all);
  });

  it('count toward how much of the crypt is cleared (its lord the one more: cryptLord.test.ts), never all of it without him; the same at its way in', () => {
    const model = new GameModel(1, MID);
    const crypt = goDown(model);
    const all = model.foes.length;
    expect(model.clearedShare(crypt.entrance)).toBe(0);
    model.takeEvents();
    model.foes.forEach((guard, i) => {
      guard.state = 'dead';
      model.slayGuard(guard);
      expect(model.clearedShare(crypt.entrance)).toBeCloseTo((i + 1) / (all + 1));
      expect(model.takeEvents().filter((e) => e.kind === 'cleared')).toHaveLength(0);
    });
    expect(model.clearedShare(crypt.entrance)).toBeCloseTo(all / (all + 1));
  });

  it('shamble about their posts with no one near: off them now and then, a few tiles at most, slow, pausing long, never into the rock', () => {
    const model = new GameModel(3, MID);
    goDown(model);
    const crypt = model.crypt!;
    const { plan } = cryptInside(model.seed, model.inside!.entrance);
    // Where the hero stands: the floor with the most guards near enough to stir (within 30 tiles), none within their sight (8).
    let best = { x: plan.door, z: plan.depth - 1, count: -1 };
    for (let x = 0; x < plan.width; x += 2) for (let z = 0; z < plan.depth; z += 2) {
      if (!isFloor(plan, x, z) || model.foes.some((f) => Math.hypot(f.x - x, f.z - z) < 8)) continue;
      const count = model.foes.filter((f) => Math.hypot(f.x - x, f.z - z) < 30).length;
      if (count > best.count) best = { x, z, count };
    }
    Object.assign(model.hero, { x: best.x, z: best.z });
    const near = model.foes.filter((f) => Math.hypot(f.x - best.x, f.z - best.z) < 30); // (those near enough to stir: the far ones think only once the hero comes near)
    const posts = new Map(near.map((f) => [f, { x: f.homeX, z: f.homeZ }]));
    const moved = new Set<unknown>();
    let walking = 0;
    let frames = 0;
    for (let t = 0; t < 60; t += FRAME) {
      const before = model.foes.map((f) => [f.x, f.z]);
      crypt.update(FRAME);
      model.foes.forEach((f, i) => {
        if (f.state !== 'wander') return posts.delete(f); // (any that saw him: chasing, not roaming)
        if (!posts.has(f)) return;
        const step = Math.hypot(f.x - before[i][0], f.z - before[i][1]);
        frames++;
        if (step > 1e-6) walking++;
        expect(step / FRAME).toBeLessThan(1); // (a shamble: well under their run, a sidestep round a corner or easing apart at most)
        const post = posts.get(f)!;
        expect(Math.hypot(f.x - post.x, f.z - post.z)).toBeLessThan(2.5 * Math.SQRT2 + 0.3);
        expect(isFloor(plan, Math.round(f.x), Math.round(f.z))).toBe(true);
        if (Math.hypot(f.x - post.x, f.z - post.z) > 0.5) moved.add(f);
      });
    }
    expect(posts.size).toBeGreaterThan(5);
    expect(moved.size).toBeGreaterThan(posts.size / 2); // (most get about)
    expect(walking / frames).toBeLessThan(0.5); // (more paused than walking)
  });

  it('may be joined by a draugr at the hero\'s level by the cheat: in a crypt, one of its foes, chasing, never counted; out in the world, a foe there', () => {
    const model = new GameModel(1, MID);
    model.hero.level = 7;
    const outside = model.enemies.length;
    spawnDraugr(model);
    expect(model.enemies).toHaveLength(outside + 1);
    expect(model.enemies[outside]).toMatchObject({ kind: 'draugr', level: 7 });
    const crypt = goDown(model);
    const [guards, share] = [model.foes.length, model.clearedShare(crypt.entrance)];
    spawnDraugr(model);
    const draugr = model.foes[guards];
    expect(model.foes).toHaveLength(guards + 1);
    expect(draugr).toMatchObject({ kind: 'draugr', level: 7, state: 'chase' });
    draugr.state = 'dead';
    model.slayGuard(draugr);
    expect(model.clearedShare(crypt.entrance)).toBe(share);
  });
});
