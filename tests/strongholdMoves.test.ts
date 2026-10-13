// The seam a stronghold's foes' ways of fighting go behind
// (model/strongholds/strongholdMoves.ts), as its run keeps it
// (strongholdFoes.ts): the moves made once as the hero comes in, handed all
// a way of fighting needs (the hero, every foe, each one's post and pack, the
// bosses standing, the rooms, what stands in them, the gate, the hooks);
// called every frame; asked of every plain blow before it lands; told of the
// slain; flying what's loosed; and calling up adds, never counted toward
// clearing the place. (The stronghold itself: stronghold.test.ts.)
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { SUMMONED } from '../src/model/dungeons/dungeonRecord';
import type { DungeonHooks } from '../src/model/dungeons/dungeonTypes';
import { strongholdInside } from '../src/model/strongholds/strongholds';
import { WINGS, bossRoom } from '../src/model/strongholds/strongholdLayout';
import { STRONGHOLD_FOE_ID, StrongholdRun, WING_BOSS } from '../src/model/strongholds/strongholdFoes';
import { strongholdMoves, type StrongholdFight, type StrongholdMoves } from '../src/model/strongholds/strongholdMoves';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

describe('the seam its foes\' ways go behind (strongholdMoves.ts)', () => {
  const hooks = (): DungeonHooks => ({ strike: vi.fn(), arrow: vi.fn(), blow: vi.fn(), frost: vi.fn(), web: vi.fn(), report: vi.fn(), dropLoot: vi.fn(), dropCoins: vi.fn() });
  // A run with moves of the test's own, handed what the run hands them.
  const staged = (strikes = false) => {
    const model = fresh();
    const inside = strongholdInside(model.seed, model.strongholds[0].entrance);
    const hero = Object.assign(model.hero, { x: inside.plan.door, z: inside.plan.depth - 1, maxHp: 10_000, hp: 10_000 });
    const moves = { shots: [], update: vi.fn(), strike: vi.fn(() => strikes), slain: vi.fn() } satisfies StrongholdMoves;
    let fight!: StrongholdFight;
    const game = hooks();
    const slain = new Set<number>();
    const made = new StrongholdRun(model.seed, inside, slain, hero, game, (f) => ((fight = f), moves));
    return { inside, hero, moves, fight, game, slain, run: made };
  };

  it('is called every frame, with all a way of fighting needs: the hero, every foe, each one\'s post and pack, the bosses standing, the rooms, what stands in them, the gate, the hooks', () => {
    const { run: made, moves, fight, hero, inside, game } = staged();
    expect(made.moves).toBe(moves);
    for (let i = 0; i < 3; i++) made.update(FRAME);
    expect(moves.update.mock.calls).toEqual([[FRAME], [FRAME], [FRAME]]);
    expect(fight.hero).toBe(hero);
    expect(fight.foes).toBe(made.foes);
    expect(fight.hooks).toBe(game);
    expect(fight.director).toBe(made.director);
    expect([fight.plan, fight.props]).toEqual([inside.plan, inside.props]);
    expect([fight.name, fight.level]).toEqual([inside.stronghold.name, inside.stronghold.level]);
    expect(fight.gateShut).toBe(true);
    expect(fight.king?.kind).toBe('banditKing');
    expect(fight.roomAt(hero.x, hero.z)?.kind).toBe('gatehouse');
    for (const wing of WINGS) {
      const boss = fight.bossOf(wing)!;
      expect(boss.kind).toBe(WING_BOSS[wing]);
      expect(inside.plan.rooms[fight.placeOf(boss)!.room]).toBe(bossRoom(inside.plan, wing));
      const pack = fight.packOf(boss);
      expect(pack).toContain(boss);
      expect(pack).toHaveLength(3); // (he and his guard of two)
      expect(pack.every((f) => fight.placeOf(f)!.room === fight.placeOf(boss)!.room)).toBe(true);
    }
    for (const foe of fight.foes) expect(fight.packOf(foe).length).toBeGreaterThanOrEqual(2);
    expect(fight.blocked(hero.x, hero.z, 0.14)).toBe(false);
    expect(fight.blocked(inside.plan.gate[0].x, inside.plan.gate[0].z, 0.14)).toBe(true);
    // The bosses as they stand, asked each time: one slain, no longer there; the last of the four, the gate open.
    for (const wing of WINGS) {
      const boss = fight.bossOf(wing)!;
      Object.assign(boss, { hp: 0, state: 'dead' });
      made.slay(boss, hero);
      expect(moves.slain).toHaveBeenLastCalledWith(boss);
      made.update(FRAME);
      expect(fight.bossOf(wing)).toBeNull();
    }
    expect(fight.gateShut).toBe(false);
    expect(game.report).toHaveBeenCalledWith({ kind: 'unbarred' });
  });

  it('is asked of every plain blow before it lands (its own to deal, or left to land as any foe\'s), and flies what\'s loosed till it strikes or is stopped', () => {
    for (const strikes of [true, false]) {
      const { run: made, moves, fight, hero, game } = staged(strikes);
      const foe = made.foes.find((f) => f.kind === 'bruiser')!; // (the watch's, in the entry hall, on the way up its middle)
      for (const f of made.foes) if (f !== foe) f.state = 'dead';
      Object.assign(hero, { x: foe.x, z: foe.z + 0.5 });
      foe.state = 'chase';
      for (let t = 0; t < 3 && moves.strike.mock.calls.length === 0; t += FRAME) made.update(FRAME);
      expect(moves.strike).toHaveBeenCalledWith(foe);
      expect((game.strike as ReturnType<typeof vi.fn>).mock.calls.length).toBe(strikes ? 0 : 1);
      // A shot along the way up toward the hero: struck; one into the rock: stopped, striking no one.
      const strike = vi.fn();
      const how = { speed: 8, hit: 0.3, range: 12 };
      const shot = { x: hero.x, z: hero.z - 3, dx: 0, dz: 1, flown: 0 };
      let done = false;
      for (let t = 0; t < 2 && !done; t += FRAME) done = fight.fly(shot, how, FRAME, strike);
      expect([done, strike.mock.calls.length]).toEqual([true, 1]);
      const stray = { x: hero.x, z: hero.z - 3, dx: 1, dz: 0, flown: 0 };
      done = false;
      for (let t = 0; t < 2 && !done; t += FRAME) done = fight.fly(stray, how, FRAME, strike);
      expect([done, strike.mock.calls.length]).toEqual([true, 1]);
      expect(stray.flown).toBeLessThan(how.range); // (the hall's wall, short of its range)
    }
  });

  it('calls up adds: set on the hero where they can stand, of their caller\'s pack, their ids from SUMMONED up, never counted toward clearing it nor kept; none where there\'s nowhere to stand', () => {
    const { run: made, moves, fight, hero, slain, inside } = staged();
    const caller = fight.bossOf('kennels')!;
    const before = made.foes.length;
    const hound = fight.summon('warHound', caller.x + 1, caller.z, caller)!;
    const other = fight.summon('runner', hero.x, hero.z - 1)!;
    expect(made.foes).toHaveLength(before + 2);
    expect(hound.id).toBe(STRONGHOLD_FOE_ID + SUMMONED);
    expect(other.id).toBe(STRONGHOLD_FOE_ID + SUMMONED + 1);
    expect([hound.kind, hound.state, hound.level]).toEqual(['warHound', 'chase', inside.stronghold.level]);
    expect(made.free(hound.x, hound.z, ENEMY_STATS.warHound.radius)).toBe(true);
    expect(fight.packOf(caller)).toContain(hound);
    expect(fight.placeOf(hound)).toBe(fight.placeOf(caller));
    expect([fight.placeOf(other), fight.packOf(other)]).toEqual([null, [other]]);
    expect(fight.summon('runner', -20, -20)).toBeNull(); // (deep in the rock)
    const share = made.share;
    Object.assign(hound, { hp: 0, state: 'dead' });
    expect(made.slay(hound, hero)).toEqual([]);
    expect(moves.slain).toHaveBeenLastCalledWith(hound);
    expect([made.share, slain.size]).toEqual([share, 0]);
    expect(fight.packOf(caller)).not.toContain(hound);
  });
});

describe('a stronghold\'s foes\' ways, for now', () => {
  it('are none: nothing loosed, every blow left to land as any foe\'s, a run made with them by default', () => {
    const model = fresh();
    const stronghold = model.strongholds[0];
    model.teleport(stronghold.entrance.x, stronghold.entrance.z);
    model.useDoor();
    const run = model.dungeon as StrongholdRun;
    expect(run.moves.shots).toEqual([]);
    expect(run.moves.strike(run.foes[0])).toBe(false);
    const plain = strongholdMoves({} as StrongholdFight);
    plain.update(FRAME);
    plain.slain(run.foes[0]);
    expect(plain.shots).toEqual([]);
  });
});
