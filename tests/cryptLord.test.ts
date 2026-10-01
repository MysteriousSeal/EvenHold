// A crypt's lord (model/crypts/cryptLord.ts): named for whom the crypt is;
// rising before his tomb once most of it's cleared, of its level and two
// more; his slam (told, then hard on whoever's still in its ring); two of the
// dead called up at half health (not the crypt's to count); his rage; slain,
// the crypt cleared, his chest's gear and coins on the floor, opened once,
// and all of it kept in a save.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { cryptInside } from '../src/model/crypts/crypts';
import { CryptFoes } from '../src/model/crypts/cryptFoes';
import { LORD_POST, RISES_AT, SLAM_RADIUS, SLAM_TELL, lordName, lordSpot } from '../src/model/crypts/cryptLord';
import { enemyPower } from '../src/model/enemies/enemyLevels';
import { parseSave, restore, snapshot } from '../src/model/save';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const goDown = (model: GameModel) => {
  const crypt = model.crypts[0];
  model.teleport(crypt.entrance.x, crypt.entrance.z);
  model.useDoor();
  return crypt;
};
// Slays guards (the crypt's record of them) till `share` of it is cleared.
const clearTo = (model: GameModel, share: number) => {
  for (const guard of model.foes.filter((f) => f.kind !== 'cryptLord')) {
    if (model.crypt!.share >= share) return;
    guard.state = 'dead';
    model.slayGuard(guard);
  }
};
const lordOf = (model: GameModel) => model.foes.find((f) => f.kind === 'cryptLord');

describe('a crypt\'s lord', () => {
  it('is whom the crypt is named for (an order\'s first; a nameless place\'s keeper)', () => {
    expect(lordName('the tomb of Lady Morwen')).toBe('Lady Morwen');
    expect(lordName('the barrow of the Hollow King')).toBe('The Hollow King');
    expect(lordName('the ossuary of the Grey Brothers')).toBe('The First of the Grey Brothers');
    expect(lordName('the cold sepulchre')).toBe('The Keeper');
  });

  it('rises before his tomb once most of the crypt is cleared, not before: of its level and two more, eight skeletons\' health, told', () => {
    const model = new GameModel(1, MID);
    const crypt = goDown(model);
    model.hero.x = -50; // (out of the way)
    clearTo(model, RISES_AT - 0.1);
    model.update(0, 0, FRAME);
    expect(lordOf(model)).toBeUndefined();
    clearTo(model, RISES_AT);
    model.takeEvents();
    model.update(0, 0, FRAME);
    const lord = lordOf(model)!;
    expect(lord).toBeDefined();
    expect(lord.level).toBe(crypt.level + 2);
    expect(lord.maxHp).toBe(enemyPower('skeleton', lord.level).maxHp * 8);
    expect(lord.name).toBe(lordName(crypt.name));
    expect(model.takeEvents()).toContainEqual({ kind: 'rises', name: lord.name });
    const spot = lordSpot(cryptInside(model.seed, crypt.entrance));
    expect([lord.homeX, lord.homeZ]).toEqual([spot.x, spot.z]);
  });

  it('slams, told first: hard on the hero still in its ring, nothing to one who stepped out', () => {
    for (const stay of [true, false]) {
      const model = new GameModel(2, MID);
      goDown(model);
      model.random = () => 0.99;
      clearTo(model, RISES_AT);
      model.update(0, 0, FRAME);
      const lord = lordOf(model)!;
      for (const f of model.foes) if (f !== lord) f.state = 'dead';
      Object.assign(model.hero, { x: lord.x + 1.2, z: lord.z });
      Object.assign(lord, { state: 'chase', cooldown: 99 }); // (no plain blows: the slam alone)
      let slam = null;
      for (let t = 0; t < 8 && !slam; t += FRAME) {
        lord.cooldown = 99;
        Object.assign(model.hero, { x: lord.x + 1.2, z: lord.z });
        model.update(0, 0, FRAME);
        slam = (model.crypt!.slams.moves[0] ?? null);
      }
      expect(slam).not.toBeNull();
      if (!stay) Object.assign(model.hero, { x: slam!.x + SLAM_RADIUS + 0.5, z: slam!.z });
      model.hero.hp = 999; // (enough to take it, not fall: a fall heals)
      const hp = model.hero.hp;
      for (let t = 0; t < SLAM_TELL + 0.2; t += FRAME) {
        lord.cooldown = 99;
        model.crypt!.update(FRAME);
      }
      if (stay) expect(model.hero.hp).toBeLessThanOrEqual(hp - lord.damage);
      else expect(model.hero.hp).toBe(hp);
    }
  });

  it('calls two of the dead up at half health (not the crypt\'s to count), and rages below a quarter', () => {
    const model = new GameModel(3, MID);
    goDown(model);
    clearTo(model, RISES_AT);
    model.update(0, 0, FRAME);
    const lord = lordOf(model)!;
    const before = model.foes.length;
    lord.hp = lord.maxHp / 2;
    model.crypt!.update(FRAME);
    const called = model.foes.slice(before);
    expect(called).toHaveLength(2);
    const share = model.crypt!.share;
    for (const c of called) {
      c.state = 'dead';
      model.slayGuard(c);
    }
    expect(model.crypt!.share).toBe(share);
    lord.hp = 1;
    lord.cooldown = 5;
    model.crypt!.update(FRAME);
    expect(model.crypt!.lord!.raging).toBe(true);
    expect(lord.cooldown).toBeLessThanOrEqual(0.35);
  });

  it('slain, clears the crypt (told once), and his chest stands where he rose: its gear and coins on the floor; all kept in a save', () => {
    const model = new GameModel(1, MID);
    const crypt = goDown(model);
    clearTo(model, 1);
    model.update(0, 0, FRAME);
    const lord = lordOf(model)!;
    model.takeEvents();
    lord.state = 'dead';
    model.slayGuard(lord);
    expect(model.crypt!.share).toBe(1);
    expect(model.takeEvents().filter((e) => e.kind === 'cleared')).toHaveLength(1);
    expect(model.clearedShare(crypt.entrance)).toBe(1);
    model.crypt!.update(FRAME);
    const chest = model.crypt!.chest!;
    expect(chest).toMatchObject({ x: lord.homeX, z: lord.homeZ, open: false });
    Object.assign(model.hero, { x: chest.x, z: chest.z + 0.6 });
    expect(model.crypt!.chestInReach(model.hero)).toBe(true);
    const [loot, money] = [model.groundHere.loot.length, model.hero.money];
    model.crypt!.openChest();
    expect(model.crypt!.chestInReach(model.hero)).toBe(false);
    expect(model.groundHere.loot.length).toBe(loot + 1);
    model.update(0, 0, FRAME);
    expect(model.hero.money - money + model.groundHere.coins.length).toBeGreaterThan(0);
    // In a save: slain, his chest opened; he rises no more.
    const loaded = new GameModel(1, MID);
    restore(loaded, parseSave(JSON.stringify(snapshot(model)), 1)!);
    loaded.update(0, 0, FRAME);
    expect(lordOf(loaded)).toBeUndefined();
    expect(loaded.crypt!.chest).toMatchObject({ open: true });
    expect(loaded.cleared(`${crypt.ruin.x},${crypt.ruin.z}`).has(LORD_POST)).toBe(true);
    expect(CryptFoes.postOf(lord)).toBe(LORD_POST);
  });
});
