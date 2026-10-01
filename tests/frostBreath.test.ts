// The crypts' draugr (model/crypts/frostBreath.ts): their frost breath, told
// then loosed in a cone before them (stepped out of, it misses); caught, the
// hero harmed and chilled, slowed a while; and a draugr hardly moved by a blow.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BREATH_REACH, BREATH_TELL, CHILL_FOR, caught } from '../src/model/crypts/frostBreath';
import { makeEnemy } from '../src/model/enemies/enemies';
import { DROP_CHANCE, LOOT, rollDrop } from '../src/model/loot/loot';
import { ENEMY_STATS } from '../src/model/constants';
import { landBlow } from '../src/model/hero/fighting';
import type { Enemy } from '../src/model/types';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
// Down in a crypt, the hero and one foe of `kind` alone, side by side on open floor.
const alone = (seed: number, kind: 'draugr' | 'skeleton') => {
  const model = new GameModel(seed, MID);
  const crypt = model.crypts[0];
  model.teleport(crypt.entrance.x, crypt.entrance.z);
  model.useDoor();
  for (const f of model.foes) f.state = 'dead';
  const { x, z } = model.hero; // (the foot of the stairs: open floor round it)
  const foe: Enemy = { ...makeEnemy(4_999_000, kind, x, z - 1.5, x, z - 1.5, 3), state: 'chase' };
  model.foes.push(foe);
  model.random = () => 0.99; // (no dodging)
  model.hero.hp = 999;
  return { model, foe };
};

describe('draugr', () => {
  it('breathe frost in a cone before them: so far, so wide', () => {
    const breath = { x: 0, z: 0, dx: 1, dz: 0 };
    expect(caught(breath, { x: 2, z: 0 })).toBe(true);
    expect(caught(breath, { x: 2, z: 1 })).toBe(true);
    expect(caught(breath, { x: 0, z: 2 })).toBe(false); // (to its side)
    expect(caught(breath, { x: -1, z: 0 })).toBe(false); // (behind)
    expect(caught(breath, { x: BREATH_REACH + 0.2, z: 0 })).toBe(false);
  });

  it('draw breath first, then the frost: the hero still before them harmed and chilled (a while), one who stepped aside spared', () => {
    for (const stay of [true, false]) {
      const { model, foe } = alone(4, 'draugr');
      const frost = model.crypt!.frost;
      foe.cooldown = 99; // (no axe blows: the breath alone)
      for (let t = 0; t < 8 && frost.breaths.length === 0; t += FRAME) {
        foe.cooldown = 99;
        model.crypt!.update(FRAME);
      }
      const breath = frost.breaths[0];
      expect(breath).toBeDefined();
      if (!stay) Object.assign(model.hero, { x: breath.x - breath.dx * 1.5, z: breath.z - breath.dz * 1.5 }); // (behind it)
      const hp = model.hero.hp;
      for (let t = 0; t < BREATH_TELL + 0.1; t += FRAME) {
        foe.cooldown = 99;
        model.crypt!.update(FRAME);
      }
      if (stay) {
        expect(model.hero.hp).toBeLessThan(hp);
        expect(model.hero.chilledFor).toBeGreaterThan(CHILL_FOR - 0.3);
        expect(model.takeEvents()).toContainEqual({ kind: 'chilled' });
        for (let t = 0; t < CHILL_FOR + 0.5; t += FRAME) model.crypt!.update(FRAME);
        expect(model.hero.chilledFor).toBe(0);
      } else {
        expect(model.hero.hp).toBe(hp);
        expect(model.hero.chilledFor ?? 0).toBe(0);
      }
    }
  });

  it('leave the hero slow while he\'s chilled', () => {
    const walked = (chilled: boolean) => {
      const { model, foe } = alone(4, 'skeleton');
      foe.state = 'dead';
      model.hero.chilledFor = chilled ? 99 : 0;
      const z = model.hero.z;
      for (let t = 0; t < 0.5; t += FRAME) model.update(0, -1, FRAME);
      return z - model.hero.z;
    };
    expect(walked(true)).toBeLessThan(walked(false) * 0.7);
  });

  it('are hardly moved by a blow that sends a skeleton back', () => {
    const shoved = (kind: 'draugr' | 'skeleton') => {
      const { model, foe } = alone(4, kind);
      Object.assign(foe, { x: model.hero.x, z: model.hero.z - 0.45, hp: 999, maxHp: 999 });
      model.hero.facing = Math.PI;
      let push = 0;
      landBlow({ ...model, foes: model.foes, focused: null, hero: model.hero, slain: model.slain, quests: model.quests, godMode: false, random: () => 0.5, report: () => {}, focus: () => {}, dropLoot: () => {}, dropCoins: () => {}, slayGuard: () => {}, fall: () => {}, shove: (_e, dx, dz) => (push = Math.hypot(dx, dz)) });
      expect(foe.hp).toBeLessThan(999);
      return push;
    };
    expect(shoved('draugr')).toBeLessThan(shoved('skeleton') * 0.5);
  });

  it('leave better loot than skeletons, and more often', () => {
    const drops = (kind: 'draugr' | 'skeleton') =>
      Array.from({ length: 2000 }, (_, id) => rollDrop(ENEMY_STATS[kind].family, id, DROP_CHANCE * ENEMY_STATS[kind].loot)).filter((item) => item !== null);
    const [draugr, skeleton] = [drops('draugr'), drops('skeleton')];
    expect(draugr.length).toBeGreaterThan(skeleton.length * 1.4);
    const worth = (items: typeof draugr) => items.reduce((sum, item) => sum + LOOT[item!].value, 0) / items.length;
    expect(worth(draugr)).toBeGreaterThan(worth(skeleton) * 2);
  });
});
