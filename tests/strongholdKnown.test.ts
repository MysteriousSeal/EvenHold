// What a stronghold gets wrong as it stands, found playing it whole
// (strongholdRun.test.ts, strongholdSaves.test.ts) and left for whoever owns
// the code it's in: each a small reproduction, written as it SHOULD go and
// marked `it.fails` (it passes while the fault's there, and fails the day
// it's mended: then take the mark off).
// - A named piece lying on a stronghold's floor is lost for good by a save
//   and a load, or by going out and in again: a dungeon's floor isn't kept
//   (model/save.ts keeps the world's ground alone; GameModel.enterRoom makes
//   its floor afresh), and the boss who left it stays slain, his chest open.
// - The point to spend its king's fall gives is lost by a save and a load
//   (model/save.ts pointsOf: no more points than the hero's levels gave).
// - The king's waves stand in a file at the hall's doors behind their own
//   crossbowman (who holds his ground) while the hero fights the king a few
//   tiles off: none of those who fight hand to hand comes up.
// - A stronghold bandit whose sex the moon-turn charm changed is as the seed
//   made them the next time the hero comes in (and after a load), though the
//   game still counts them changed (spells/swaps.ts: only the world's own
//   foes are changed again as they're made; a dungeon's are made afresh each
//   visit, under ids every stronghold shares), so the next cast does nothing.
// - The game's pathfinding loses a long way round (model/map/pathfinding.ts:
//   its costs kept as 32-bit floats, a step called stale by their rounding).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { findPath } from '../src/model/map/pathfinding';
import { parseSave, restore, snapshot } from '../src/model/save';
import { WINGS } from '../src/model/strongholds/strongholdLayout';
import { strongholdBlocks, strongholdInside } from '../src/model/strongholds/strongholds';
import { WING_BOSS, type StrongholdRun } from '../src/model/strongholds/strongholdFoes';
import { bossPiece } from '../src/model/strongholds/strongholdLoot';
import { castSpell, type Caster } from '../src/model/spells/casting';
import { learn } from '../src/model/spells/spells';
import { WAVES, WAVE_EVERY } from '../src/model/strongholds/strongholdKing';
import { namedIn, type GearKey } from '../src/model/human/items/gear';
import type { Enemy } from '../src/model/types';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { cellKey } from '../src/model/map/grid';
import { reachedFrom, solidTiles } from '../src/model/strongholds/strongholdProps';
import { summoned } from './support/strongholdDelve';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const SEED = TEST_SEEDS[0];
const goIn = (model = new GameModel(SEED, TEST_MAP_SIZE)) => {
  const stronghold = model.strongholds[0];
  model.teleport(stronghold.entrance.x, stronghold.entrance.z);
  model.useDoor();
  Object.assign(model, { godMode: true });
  return { model, stronghold, run: model.dungeon as StrongholdRun, inside: strongholdInside(model.seed, stronghold.entrance) };
};
const fell = (model: GameModel, foe: Enemy) => {
  Object.assign(foe, { hp: 0, state: 'dead' });
  model.slayGuard(foe);
};
const reloaded = (model: GameModel) => {
  const loaded = new GameModel(model.seed, TEST_MAP_SIZE);
  restore(loaded, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
  return loaded;
};
const named = (model: GameModel): GearKey[] => model.groundHere.loot.map((l) => l.item as GearKey).filter((i) => namedIn(i));

describe('known faults of a stronghold (each fails as written: the fault is there)', () => {
  it.fails('a wing\'s boss\'s piece left lying is still there after a save and a load', () => {
    const { model, run, stronghold } = goIn();
    const piece = bossPiece(WING_BOSS[WINGS[0]], stronghold.level)!;
    fell(model, run.bossOf(WINGS[0])!);
    expect(named(model)).toEqual([piece]);
    const loaded = reloaded(model);
    expect((loaded.dungeon as StrongholdRun).bossOf(WINGS[0])).toBeNull(); // (he's slain for good: no second piece to be had)
    expect(named(loaded)).toEqual([piece]);
  });

  it.fails('a wing\'s boss\'s piece left lying is still there once the hero\'s gone out and come in again', () => {
    const { model, run, stronghold, inside } = goIn();
    const piece = bossPiece(WING_BOSS[WINGS[1]], stronghold.level)!;
    fell(model, run.bossOf(WINGS[1])!);
    expect(named(model)).toEqual([piece]);
    Object.assign(model.hero, { x: inside.plan.door, z: inside.plan.depth - 1 });
    model.useDoor();
    model.useDoor();
    expect(model.dungeon).not.toBeNull();
    expect(named(model)).toEqual([piece]);
  });

  it.fails('the king\'s own, out of his chest and left lying, is still there after a save and a load', () => {
    const { model, run, stronghold } = goIn();
    fell(model, run.king!);
    model.update(0, 0, FRAME);
    run.openChest();
    expect(named(model)).toEqual([bossPiece('banditKing', stronghold.level)]);
    const loaded = reloaded(model);
    expect(loaded.dungeon?.chest?.open).toBe(true); // (opened for good: not to be had from it again)
    expect(named(loaded)).toEqual([bossPiece('banditKing', stronghold.level)]);
  });

  it.fails('the point to spend the king\'s fall gave is still theirs after a save and a load', () => {
    const { model, run } = goIn();
    const points = model.hero.statPoints;
    fell(model, run.king!);
    expect(model.hero.statPoints).toBe(points + 1);
    expect(reloaded(model).hero.statPoints).toBe(points + 1);
  });

  it.fails('the king\'s waves come up to the hero: those who fight hand to hand within a few tiles, half a minute after the last came in', () => {
    const { model, run, inside } = goIn();
    const king = run.king!;
    for (const foe of [...run.foes]) if (foe !== king) fell(model, foe); // (himself alone, the gate open)
    // The hero by the king, off to one side of the hall (as a fight drifts); the king kept under two thirds, never slain.
    Object.assign(model.hero, { x: king.x - 3.5, z: king.z, maxHp: 10_000, hp: 10_000 });
    expect(strongholdBlocks(inside, model.hero.x, model.hero.z, 0.25)).toBe(false);
    const seconds = 6 + WAVE_EVERY * WAVES.length + 30;
    for (let t = 0; t < seconds; t += FRAME) {
      king.hp = Math.min(king.hp, Math.floor(king.maxHp * 0.6));
      model.update(0, 0, FRAME);
    }
    const hand = run.foes.filter((f) => f.state !== 'dead' && summoned(f) && (f.kind === 'bruiser' || f.kind === 'warHound'));
    expect(hand).toHaveLength(5);
    const far = hand.map((f) => +Math.hypot(f.x - model.hero.x, f.z - model.hero.z).toFixed(1));
    expect(Math.max(...far), `they stand ${far.join(', ')} tiles off`).toBeLessThan(3.5);
  });

  it.fails('a stronghold bandit whose sex a charm changed is still changed when the hero comes back in', () => {
    const { model, run, inside } = goIn();
    learn(model.hero, 'swap');
    const bruiser = run.foes.find((f) => f.kind === 'bruiser')!;
    const was = bruiser.human!.look.build;
    Object.assign(model.hero, { x: bruiser.x + 1.5, z: bruiser.z });
    model.focus(bruiser.id);
    expect(castSpell(model as unknown as Caster, 'swap')).toBe('cast');
    expect(bruiser.human!.look.build).not.toBe(was);
    expect(model.swaps.has(bruiser)).toBe(true);
    Object.assign(model.hero, { x: inside.plan.door, z: inside.plan.depth - 1 });
    model.useDoor();
    model.useDoor();
    const again = model.foes.find((f) => f.id === bruiser.id)!;
    expect(model.swaps.has(again)).toBe(true); // (the game still holds them changed)
    expect(again.human!.look.build).not.toBe(was);
  });

  it.fails('the way from one wing to another\'s end is found by the game\'s pathfinding', () => {
    const { inside } = goIn();
    const free = (x: number, z: number) => !strongholdBlocks(inside, x, z, HERO_RADIUS * INDOOR_SCALE);
    const [from, to] = [{ x: 28, z: 30 }, { x: 97, z: 19 }]; // (a room of the lower west wing; the upper east wing's boss's room: seed 1)
    const reached = reachedFrom(inside.plan, solidTiles(inside.props));
    expect([free(from.x, from.z), free(to.x, to.z), reached.has(cellKey(from.x, from.z)), reached.has(cellKey(to.x, to.z))]).toEqual([true, true, true, true]);
    const way = findPath(from, to, 130, free); // (a window wider than the whole floor: every room in it)
    expect(way[way.length - 1]).toEqual(to);
  });
});
