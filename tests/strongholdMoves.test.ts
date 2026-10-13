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
import { maxHpAt } from '../src/model/hero/attributes';
import { WINGS, bossRoom, roomAt } from '../src/model/strongholds/strongholdLayout';
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
    const moves = { shots: [], marks: [], fires: [], bursts: [], update: vi.fn(), strike: vi.fn(() => strikes), slain: vi.fn() } satisfies StrongholdMoves;
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

describe('a stronghold\'s foes\' ways (their roles: strongholdPack.test.ts; their bosses: strongholdBosses.test.ts)', () => {
  it('are a run\'s by default: nothing loosed, told or burning as the hero comes in; a bruiser\'s plain blow left to land, one who fights from afar never landing one; played in the game itself', () => {
    const model = fresh();
    const stronghold = model.strongholds[0];
    model.teleport(stronghold.entrance.x, stronghold.entrance.z);
    model.useDoor();
    const run = model.dungeon as StrongholdRun;
    expect([run.moves.shots, run.moves.marks, run.moves.fires, run.moves.bursts]).toEqual([[], [], [], []]);
    expect(run.moves.strike(run.foes.find((f) => f.kind === 'bruiser')!)).toBe(false);
    expect(run.moves.strike(run.foes.find((f) => f.kind === 'crossbowman')!)).toBe(true);
    // The hero stood among the watch a while, in the game itself: its ways played out on them (told, loosed, landing).
    const bowman = run.foes.find((f) => f.kind === 'crossbowman')!;
    Object.assign(model.hero, { x: bowman.x, z: bowman.z + 3, maxHp: 10_000, hp: 10_000 });
    let [told, loosed] = [false, false];
    for (let t = 0; t < 8; t += FRAME) {
      model.update(0, 0, FRAME);
      told ||= run.moves.marks.length > 0;
      loosed ||= run.moves.shots.length > 0;
    }
    expect([told, loosed]).toEqual([true, true]);
    expect(model.hero.hp).toBeLessThan(10_000);
    expect(strongholdMoves).toBeTypeOf('function');
  });

  it('every boss fought through his phases in the game itself: each told as he\'s met and as he turns, no blow on a hero of the place\'s level their whole health, those called up never kept, everything where it can stand', () => {
    const model = fresh();
    const stronghold = model.strongholds[0];
    model.teleport(stronghold.entrance.x, stronghold.entrance.z);
    model.useDoor();
    const run = model.dungeon as StrongholdRun;
    const inside = strongholdInside(model.seed, stronghold.entrance);
    const bosses = [...WINGS.map((wing) => run.bossOf(wing)!), run.king!];
    const whole = maxHpAt(inside.stronghold.level);
    for (const boss of bosses) {
      for (const guard of run.packOf(boss)) if (guard !== boss) guard.state = 'dead'; // (himself alone: none of his guard stood in his way)
      Object.assign(model.hero, { x: boss.x + 1, z: boss.z + 1.5, hp: 10_000 });
      model.takeEvents();
      const banners: string[] = [];
      for (const share of [1, 0.62, 0.45, 0.28, 0.18]) {
        for (let t = 0; t < 7; t += FRAME) {
          if (Math.floor(t * 3) !== Math.floor((t - FRAME) * 3)) boss.hp = Math.max(1, Math.min(boss.hp, Math.floor(boss.maxHp * share))); // (brought so low, a blow at a time: the captain's guard turns them but in his openings)
          model.update(0, 0, FRAME);
          for (const event of model.takeEvents()) {
            if (event.kind === 'banner') banners.push(event.line);
            if (event.kind === 'hit' && event.on === 'hero') expect(event.amount).toBeLessThan(whole);
          }
          boss.hp = Math.max(boss.hp, 1); // (whatever becomes of him meanwhile: his fight's the test's to turn)
          model.hero.hp = 10_000;
        }
      }
      expect([boss.kind, banners.length]).toEqual([boss.kind, 3]);
      for (const foe of run.foes) expect(foe.state === 'dead' || (Number.isFinite(foe.x) && Number.isFinite(foe.z) && !!roomAt(inside.plan, foe.x, foe.z))).toBe(true);
      for (const mark of run.moves.marks) expect(Number.isFinite(mark.x + mark.z + mark.k)).toBe(true);
    }
    expect(run.foes.some((f) => f.id >= STRONGHOLD_FOE_ID + SUMMONED)).toBe(true);
    expect(run.share).toBe(0);
    expect(model.hero.hp).toBeGreaterThan(0);
  });
});
