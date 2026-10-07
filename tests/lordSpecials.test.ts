// A crypt lord's specials (model/crypts/cryptLord.ts), as told moves: his
// sweep close (all round him, knocking away), and from afar his charge
// (along a strip, carried along it, stopped short of the rock), his bones
// bursting up under and beside where the hero stood, and his souls loosed
// (three, turning after the hero, striking or spent).
import { describe, expect, it } from 'vitest';
import { ToldMoves, type Told } from '../src/model/enemies/toldMoves';
import { BARRAGE, CHARGE_LENGTH, ERUPTION, ERUPTION_TELL, SWEEP, SWEEP_RADIUS, SWEEP_TELL, chargeMove, eruptionSpots } from '../src/model/crypts/cryptLord';
import { makeEnemy } from '../src/model/enemies/enemies';
import { GameModel } from '../src/model/GameModel';
import type { Enemy } from '../src/model/types';
import { FRAME, regionCrypt } from './support/testWorld';

const DT = 1 / 60;
const lord = (): Enemy => ({ ...makeEnemy(1, 'cryptLord', 0, 0), state: 'chase' });
const run = (moves: ToldMoves, f: Enemy, hero: { x: number; z: number }, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) moves.update([f], hero as never, DT);
};
const started = (move: ToldMoves['moves'] extends unknown ? ConstructorParameters<typeof ToldMoves>[0] : never, at: { x: number; z: number }) => {
  const moves = new ToldMoves({ ...move, first: 0 }, () => {});
  run(moves, lord(), at, DT);
  return moves.moves.length > 0;
};

describe('a crypt lord\'s specials', () => {
  it('come at their range: the sweep close; the charge, the bones and the souls only from afar', () => {
    expect(started(SWEEP, { x: 1, z: 0 })).toBe(true);
    expect(started(SWEEP, { x: 4, z: 0 })).toBe(false);
    for (const move of [chargeMove(() => false), ERUPTION, BARRAGE]) {
      expect(started(move, { x: 1, z: 0 })).toBe(false); // (too close)
      expect(started(move, { x: 4, z: 0 })).toBe(true);
    }
  });

  it('sweep all round him: the hero within it struck, one beyond spared', () => {
    for (const [at, hit] of [[{ x: 0, z: -1.2 }, true], [{ x: 0, z: -(SWEEP_RADIUS + 0.4) }, false]] as const) {
      const landed: Told[] = [];
      const moves = new ToldMoves({ ...SWEEP, first: 0 }, (_f, m) => landed.push(m));
      const f = lord();
      run(moves, f, { x: 1, z: 0 }, DT);
      run(moves, f, at, SWEEP_TELL + 0.1);
      expect(landed.length > 0).toBe(hit);
    }
  });

  it('charge along a strip at the hero, carried along it, stopped short of the rock', () => {
    const wall = 3; // (rock from x 3 on)
    const moves = new ToldMoves({ ...chargeMove((x) => x > wall), first: 0 }, () => {});
    const f = lord();
    run(moves, f, { x: 4, z: 0 }, DT);
    run(moves, f, { x: 4, z: 0 }, 1.1); // (its tell, then partway along)
    expect(f.x).toBeGreaterThan(1);
    run(moves, f, { x: 4, z: 0 }, 0.5);
    expect(f.x).toBeGreaterThan(wall - 0.3);
    expect(f.x).toBeLessThanOrEqual(wall);
    expect(f.x).toBeLessThan(CHARGE_LENGTH);
  });

  it('burst bones up under where the hero stood, and either side: the hero still there struck, one who stepped out spared', () => {
    const spots = eruptionSpots({ tx: 4, tz: 0, dx: 1, dz: 0 });
    expect(spots).toHaveLength(3);
    expect(spots[0]).toEqual({ x: 4, z: 0 });
    for (const [at, hit] of [[{ x: 4, z: 0 }, true], [{ x: 4.3, z: 1.4 }, true], [{ x: 4.95, z: 0 }, false]] as const) {
      const landed: Told[] = [];
      const moves = new ToldMoves({ ...ERUPTION, first: 0 }, (_f, m) => landed.push(m));
      const f = lord();
      run(moves, f, { x: 4, z: 0 }, DT);
      run(moves, f, at, ERUPTION_TELL + 0.1);
      expect(landed.length > 0).toBe(hit);
    }
  });

  it('loose three souls that turn after the hero and strike them, or are spent', () => {
    const model = new GameModel(1, { width: 512, depth: 512 });
    const crypt = regionCrypt(model);
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.useDoor();
    for (const f of model.foes) f.state = 'dead';
    const run = model.crypt!;
    const { x, z } = model.hero;
    const lordFoe: Enemy = { ...makeEnemy(4_999_100, 'cryptLord', x, z - 4, x, z - 4, 3), state: 'chase' };
    (run as unknown as { loosesSouls(l: Enemy, m: Told): void }).loosesSouls(lordFoe, { foe: lordFoe, x, z: z - 4, dx: 0, dz: 1, tx: x, tz: z, t: 0 });
    expect(run.souls).toHaveLength(3);
    model.godMode = false;
    model.random = () => 0.99;
    model.hero.hp = 999;
    for (let t = 0; t < 5 && run.souls.length > 0; t += FRAME) run.update(FRAME);
    expect(model.hero.hp).toBeLessThan(999);
    expect(run.souls).toHaveLength(0);
  });

  it('charging into the hero, bowls them back along it, a few tiles (not aside)', () => {
    const model = new GameModel(1, { width: 512, depth: 512 });
    const crypt = regionCrypt(model);
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.useDoor();
    for (const f of model.foes) f.state = 'dead';
    Object.assign(model, { random: () => 0.99 });
    model.hero.hp = 999;
    const { x, z } = model.hero; // (the foot of the stairs: the corridor runs on, -z)
    const lordFoe: Enemy = { ...makeEnemy(4_999_200, 'cryptLord', x, z, x, z, 3), state: 'chase' };
    model.foes.push(lordFoe);
    const before = { x, z: z - 4 }; // (at range, along the corridor: open floor behind them)
    Object.assign(model.hero, before);
    const charges = model.crypt!.charges;
    for (let t = 0; t < 6 && charges.moves.length === 0; t += FRAME) {
      Object.assign(lordFoe, { x, z, cooldown: 99, state: 'chase' }); // (held off, at range, till he charges)
      Object.assign(model.hero, before);
      model.crypt!.update(FRAME);
    }
    const charge = charges.moves[0];
    expect(charge).toBeDefined();
    Object.assign(model.hero, before);
    for (let t = 0; t < 1; t += FRAME) {
      lordFoe.cooldown = 99;
      model.crypt!.update(FRAME);
    }
    expect(model.hero.knock).toBeDefined(); // (knocked: carried back over a moment, not all at once)
    for (let t = 0; t < 0.5; t += FRAME) {
      lordFoe.cooldown = 99;
      model.update(0, 0, FRAME);
    }
    expect(model.hero.knock).toBeUndefined();
    const along = (model.hero.x - before.x) * charge.dx + (model.hero.z - before.z) * charge.dz;
    const aside = Math.abs((model.hero.x - before.x) * charge.dz - (model.hero.z - before.z) * charge.dx);
    expect(model.hero.hp).toBeLessThan(999);
    expect(along).toBeGreaterThan(1.5);
    expect(aside).toBeLessThan(0.3);
  });
});
