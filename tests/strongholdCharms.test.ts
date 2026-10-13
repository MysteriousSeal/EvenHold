// @vitest-environment happy-dom
// A stronghold and the hero's charms (model/spells/), cast in the game itself
// at whoever's focused: its five bosses not to be turned (a hen, a horse,
// cattle), the Breath kept; its packs' may be: a bruiser, a hound turned is
// gone as if slain, its post kept, the cleared share up by one, nothing had
// for it; one called up mid-fight turned is never counted; a runner turned
// as it runs fetches no one; a statue or a tree refused down there; a wing
// with all its pack turned and its boss slain is as cleared as any. The
// moon-turn charm changes a stronghold bandit's body and leaves it dressed
// as its kind (drawn afresh in its outfit). And the rest of the game it
// meets: what its bandits count for with those who ask bandits slain.
// (What the charm gets wrong of a bandit met again: strongholdKnown.test.ts.)
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { SUMMONED } from '../src/model/dungeons/dungeonRecord';
import { isBoss } from '../src/model/enemies/enemyLevels';
import { castSpell, type Caster } from '../src/model/spells/casting';
import { SPELLS, learn, type SpellId } from '../src/model/spells/spells';
import { mayTurn } from '../src/model/spells/turned';
import { maySwap } from '../src/model/spells/swaps';
import { WINGS } from '../src/model/strongholds/strongholdLayout';
import { STRONGHOLD_FOE_ID, StrongholdRun, WING_BOSS, strongholdFoeCount } from '../src/model/strongholds/strongholdFoes';
import { strongholdInside, strongholdKey } from '../src/model/strongholds/strongholds';
import type { Stage } from '../src/model/strongholds/strongholdStage';
import type { Enemy, EnemyKind } from '../src/model/types';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// No canvas in happy-dom: a 2D context that draws nothing (the foes' names, their bars), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

const BOSSES: readonly EnemyKind[] = ['houndmaster', 'quartermaster', 'gaoler', 'captain', 'banditKing'];
const TURNS: readonly SpellId[] = ['chicken', 'cow', 'horse', 'statue', 'tree'];

const goIn = (seed = TEST_SEEDS[0]) => {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const stronghold = model.strongholds[0];
  model.teleport(stronghold.entrance.x, stronghold.entrance.z);
  model.useDoor();
  model.godMode = true;
  model.random = () => 0.5;
  for (const id of Object.keys(SPELLS) as SpellId[]) learn(model.hero, id);
  const run = model.dungeon as StrongholdRun;
  // The charm cast at `foe` as the game casts it: the hero two tiles off, the foe focused, the Breath for it.
  const cast = (id: SpellId, foe: Enemy) => {
    Object.assign(model.hero, { x: foe.x + 1.5, z: foe.z + 0.5 });
    model.focus(foe.id);
    model.moves.breath = 100;
    return castSpell(model as unknown as Caster, id);
  };
  const posts = () => [...model.cleared(strongholdKey(stronghold))].sort((a, b) => a - b);
  return { model, stronghold, run, cast, posts, inside: strongholdInside(seed, stronghold.entrance) };
};
const of = (run: StrongholdRun, kind: EnemyKind) => run.foes.find((f) => f.kind === kind && f.state !== 'dead')!;
const post = (foe: Enemy) => foe.id - STRONGHOLD_FOE_ID;

describe('a stronghold and the charms', () => {
  it('its five bosses are bosses, not to be turned into anything: the charm not cast, the Breath kept, the boss as he was', () => {
    const { model, run, cast, posts } = goIn();
    for (const kind of BOSSES) {
      const boss = of(run, kind);
      expect([kind, isBoss(kind), mayTurn(boss)]).toEqual([kind, true, false]);
      for (const id of TURNS) {
        expect([kind, id, cast(id, boss)]).toEqual([kind, id, 'noTarget']);
        expect(model.moves.breath).toBe(100);
      }
      expect([boss.state !== 'dead', boss.hp, run.foes.includes(boss)]).toEqual([true, boss.maxHp, true]);
    }
    expect(posts()).toEqual([]);
    expect(model.chickens.hens).toEqual([]);
    expect(model.takeEvents().some((e) => e.kind === 'transformed')).toBe(false);
  });

  it('a bruiser, a hound, a sawbones turned: gone as if slain (its post kept, the cleared share up by one each), a beast in its place down there, nothing had for it; so after a save\'s record is read back', () => {
    const { model, run, cast, posts, stronghold, inside } = goIn();
    const all = strongholdFoeCount(model.seed, inside) + 1;
    const [xp, money] = [model.hero.xp, model.hero.money];
    const turned: Array<[EnemyKind, SpellId]> = [['bruiser', 'chicken'], ['warHound', 'cow'], ['sawbones', 'horse'], ['crossbowman', 'chicken']];
    const gone: number[] = [];
    for (const [kind, id] of turned) {
      const foe = of(run, kind);
      const pack = run.packOf(foe).length;
      const mate = run.packOf(foe).find((f) => f !== foe)!;
      expect([kind, cast(id, foe)]).toEqual([kind, 'cast']);
      gone.push(post(foe));
      expect([foe.state, run.foes.includes(foe), run.packOf(mate).length]).toEqual(['dead', false, pack - 1]);
      expect(run.share).toBeCloseTo(gone.length / all, 10);
    }
    expect(posts()).toEqual([...gone].sort((a, b) => a - b));
    expect(model.clearedShare(stronghold.entrance)).toBeCloseTo(4 / all, 10);
    expect(model.chickens.here.map((h) => h.kind)).toEqual(['chicken', expect.stringMatching(/^(cow|bull)$/), 'horse', 'chicken']);
    expect([model.hero.xp, model.hero.money, model.groundHere.loot.length, model.groundHere.coins.length]).toEqual([xp, money, 0, 0]);
    expect(model.takeEvents().filter((e) => e.kind === 'transformed')).toHaveLength(4);
    // The beasts wander its floor, never into its rock; its foes fight on about them.
    Object.assign(model.hero, { x: inside.plan.door, z: inside.plan.depth - 1 });
    for (let t = 0; t < 20; t += FRAME) model.update(0, 0, FRAME);
    for (const hen of model.chickens.here) expect(run.free(hen.x, hen.z, 0.1), `${hen.kind} at ${hen.x},${hen.z}`).toBe(true);
    // Gone out and come in again: they're not back.
    model.useDoor();
    model.useDoor();
    expect(model.foes.map(post).filter((p) => gone.includes(p))).toEqual([]);
    expect(model.chickens.here).toHaveLength(4);
  });

  it('a statue, a tree: refused down there (out of doors only), on a boss or anyone: not cast, the Breath kept', () => {
    const { model, run, cast } = goIn();
    for (const kind of ['bruiser', 'warHound', 'runner', 'captain'] as const) {
      const foe = of(run, kind);
      for (const id of ['statue', 'tree'] as const) expect([kind, id, cast(id, foe), model.moves.breath, foe.state !== 'dead']).toEqual([kind, id, 'noTarget', 100, true]);
    }
    expect(model.chickens.hens).toEqual([]);
    expect(model.chickens.trees).toEqual([]);
  });

  it('a runner turned as it runs for the next room fetches no one; one called up mid-fight turned is never counted', () => {
    // (A seed whose stronghold has a runner posted with others, and another pack of its wing to run for.)
    const seed = TEST_SEEDS.find((s) => {
      const g = goIn(s);
      for (let t = 0; t < 0.1; t += FRAME) g.model.update(0, 0, FRAME);
      const pack = (g.run.moves as unknown as { parts: Array<{ fetched?(runner: Enemy): Enemy[] }> }).parts[0];
      return g.run.foes.some((f) => f.kind === 'runner' && g.run.packOf(f).length > 1 && pack.fetched!(f).length > 0);
    })!;
    expect(seed).toBeDefined();
    const { model, run, cast, posts } = goIn(seed);
    const stage = (run.moves as unknown as { stage: Stage }).stage;
    const fetched = (r: Enemy) => (run.moves as unknown as { parts: Array<{ fetched?(runner: Enemy): Enemy[] }> }).parts[0].fetched!(r);
    const runner = run.foes.filter((f) => f.kind === 'runner').find((r) => run.packOf(r).length > 1 && fetched(r).length > 0)!;
    const mate = run.packOf(runner).find((f) => f !== runner)!;
    Object.assign(model.hero, { x: mate.x + 0.5, z: mate.z + 0.5 });
    Object.assign(mate, { hurtFor: 0.3, state: 'chase' }); // (its pack set upon)
    for (let t = 0; t < 1.5 && !stage.walking(runner); t += FRAME) model.update(0, 0, FRAME);
    expect(stage.walking(runner)).toBe(true); // (off for the next room)
    const others = run.foes.filter((f) => f.state === 'wander' && run.packOf(f)[0] !== run.packOf(runner)[0]);
    expect(cast('chicken', runner)).toBe('cast');
    expect(posts()).toContain(post(runner));
    for (let t = 0; t < 12; t += FRAME) model.update(0, 0, FRAME);
    expect(stage.walking(runner)).toBe(false);
    expect(others.filter((f) => stage.walking(f) || f.state === 'chase')).toEqual([]); // (no one fetched, no one set on the hero)
    // One called up (as a boss calls them): turned, it's gone, and no post of it kept.
    const share = run.share;
    const kept = posts().length;
    const add = run.summon('warHound', model.hero.x - 1, model.hero.z, run.bossOf(WINGS[0])!)!;
    expect(add.id).toBeGreaterThanOrEqual(STRONGHOLD_FOE_ID + SUMMONED);
    expect(cast('horse', add)).toBe('cast');
    expect([run.foes.includes(add), run.share, posts().length]).toEqual([false, share, kept]);
  });

  it('a wing with all its pack turned and its boss slain is as cleared as any: the gate opens with the four slain, the place cleared with every post turned or slain', () => {
    const { model, run, cast, stronghold } = goIn();
    const told: string[] = [];
    for (const foe of [...run.foes]) {
      if (isBoss(foe.kind)) continue;
      expect([foe.kind, cast('chicken', foe)]).toEqual([foe.kind, 'cast']);
    }
    expect(run.gateShut).toBe(true); // (the four still stand)
    for (const wing of WINGS) {
      const boss = run.bossOf(wing)!;
      expect(boss.kind).toBe(WING_BOSS[wing]);
      Object.assign(boss, { hp: 0, state: 'dead' });
      model.slayGuard(boss);
    }
    model.update(0, 0, FRAME);
    expect(run.gateShut).toBe(false);
    const king = run.king!;
    Object.assign(king, { hp: 0, state: 'dead' });
    model.slayGuard(king);
    model.update(0, 0, FRAME);
    for (const e of model.takeEvents()) if (e.kind === 'cleared' || e.kind === 'unbarred') told.push(e.kind);
    expect(told).toEqual(['unbarred', 'cleared']);
    expect([run.share, model.clearedShare(stronghold.entrance)]).toEqual([1, 1]);
  });

  it('the moon-turn charm changes a stronghold bandit\'s body, a boss\'s too, and leaves each dressed as its kind: drawn afresh in its outfit, nothing stripped', () => {
    const { model, run, cast, stronghold } = goIn();
    const built = buildDungeonScene(model.seed, stronghold.entrance)!;
    const drawn = (foe: Enemy) => built.scene.children.filter((o) => o instanceof THREE.Group && Math.hypot(o.position.x - foe.x, o.position.z - foe.z) < 0.01);
    const meshes = (root: THREE.Object3D) => {
      let n = 0;
      root.traverse((o) => void (o instanceof THREE.Mesh && o.visible && n++));
      return n;
    };
    for (const kind of ['bruiser', 'crossbowman', 'firebrand', 'sawbones', 'runner', 'captain', 'banditKing'] as const) {
      const foe = of(run, kind);
      expect([kind, maySwap(foe)]).toEqual([kind, true]);
      Object.assign(model.hero, { x: foe.x + 1.5, z: foe.z + 0.5 });
      built.life.update(model, FRAME);
      const [before] = drawn(foe);
      expect(before, kind).toBeDefined();
      const [dressed, build, worn] = [meshes(before), foe.human!.look.build, { ...foe.human!.equipment }];
      expect(cast('swap', foe)).toBe('cast');
      expect([foe.kind, foe.state !== 'dead', foe.human!.look.build === build, foe.human!.equipment]).toEqual([kind, true, false, worn]);
      built.life.update(model, FRAME);
      built.life.update(model, FRAME);
      const [after] = drawn(foe);
      expect(after, kind).toBeDefined();
      expect(after).not.toBe(before); // (drawn afresh)
      expect([kind, meshes(after)]).toEqual([kind, dressed]); // (as much on them as before)
    }
    expect(of(run, 'warHound').human).toBeNull();
    expect(maySwap(of(run, 'warHound'))).toBe(false);
    built.life.dispose();
    built.dispose();
  });

  it('its bandits slain count for no one who asks bandits slain (they are bruisers, crossbowmen…, never "bandit"): as it stands', () => {
    const { model, run } = goIn();
    const kinds = new Set(run.foes.map((f) => f.kind));
    expect(kinds.has('bandit')).toBe(false);
    expect(run.foes.every((f) => f.quest === undefined)).toBe(true);
    void model;
  });
});
