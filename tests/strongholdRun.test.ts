// A bandit stronghold played whole, in the game itself, by a scripted hero
// (support/strongholdDelve.ts: the keys and a blow a frame, nothing set by
// hand once inside), on every test seed: walked up to its gate out in the
// world and gone in; its four wings cleared room by room and their bosses
// fought through their phases; the great hall's gate shut till the last of
// the four falls, then open (told once); the king and all he calls in slain;
// his chest opened; the five named pieces picked up, one each; out by the
// postern, back before the gate; gone into again, empty. All the while no foe
// in the rock or through the shut gate, no boss mended whole by its leash,
// the cleared share never going back. Its cheats: god mode, and Strength
// trained till a blow does 4 (a level 1 hero's does 1: the fights are the
// same, shorter). About 5 seconds a seed.
import { describe, expect, it } from 'vitest';
import { BOSS_POST, CHEST_POST } from '../src/model/dungeons/dungeonRecord';
import { WINGS } from '../src/model/strongholds/strongholdLayout';
import { WING_BOSS, strongholdHoard } from '../src/model/strongholds/strongholdFoes';
import { bossPiece } from '../src/model/strongholds/strongholdLoot';
import { strongholdKey } from '../src/model/strongholds/strongholds';
import { Delve } from './support/strongholdDelve';
import { TEST_SEEDS } from './support/testWorld';

describe('a stronghold played whole by a scripted hero', () => {
  for (const seed of TEST_SEEDS) {
    it(`seed ${seed}: in at the gate, the four wings, the gate open, the king, his chest, out by the postern`, { timeout: 120_000 }, () => {
      const d = Delve.on(seed).strong(4);
      const { model, stronghold } = d;
      d.enter();
      expect(model.inside?.entrance).toBe(stronghold.entrance);
      const { run } = d;
      const level = stronghold.level;
      const posted = model.foes.length;
      expect(run.gateShut).toBe(true);

      // The wings: everyone this side of the gate, the nearest first; those their bosses call up with them.
      d.clear(() => model.foes.filter((f) => !d.beyond(f)), 'the wings');
      expect(d.problems).toEqual([]);
      expect(run.wingsLeft).toEqual([]);
      expect(run.gateShut).toBe(false);
      expect(d.events.filter((e) => e.kind === 'unbarred')).toHaveLength(1);
      expect(d.standing.every((f) => d.beyond(f))).toBe(true);
      // Each wing's boss was met and turned twice (told each time), and left the piece that's his where he fell.
      const banners = d.events.flatMap((e) => (e.kind === 'banner' ? [`${e.title}: ${e.line}`] : []));
      for (const title of ['The Houndmaster', 'The Quartermaster', 'The Gaoler', 'The Captain']) expect(banners.filter((b) => b.startsWith(title)), `${title}: ${banners.join(' | ')}`).toHaveLength(3);
      const wingPieces = WINGS.map((wing) => bossPiece(WING_BOSS[wing], level)!);
      expect([...d.namedLying].sort()).toEqual([...wingPieces].sort());
      expect(d.gather()).toEqual([]);
      expect([...d.namedHeld].sort()).toEqual([...wingPieces].sort());

      // The great hall: the king, his guard, and whoever comes in at the doors.
      d.clear(() => model.foes, 'the great hall');
      d.wait(0.5);
      expect(d.problems).toEqual([]);
      expect(run.king).toBeNull();
      expect(d.standing).toEqual([]);
      expect(run.share).toBe(1);
      expect(model.clearedShare(stronghold.entrance)).toBe(1);
      expect(d.events.filter((e) => e.kind === 'cleared')).toEqual([{ kind: 'cleared', name: stronghold.name, point: expect.any(Boolean), place: 'stronghold' }]); // (the point told with it if the king fell last)
      expect(d.events.filter((e) => e.kind === 'point')).toHaveLength(1);
      expect(d.events.filter((e) => e.kind === 'unbarred')).toHaveLength(1);
      expect(d.namedLying).toEqual([]); // (his own is in his chest: nothing of it where he fell)

      // His chest, opened as E opens it; what it holds picked up.
      expect(run.chest).toMatchObject({ open: false });
      const purse = d.hero.money;
      expect(d.openChest()).toBe(true);
      expect(d.namedLying).toEqual([bossPiece('banditKing', level)]);
      expect(d.gather()).toEqual([]);
      d.wait(0.5);
      expect(d.hero.money).toBeGreaterThanOrEqual(purse + strongholdHoard(d.inside, seed).coins);
      expect([...d.namedHeld].sort()).toEqual([...wingPieces, bossPiece('banditKing', level)!].sort());
      expect(d.namedHeld.every((piece) => d.hero.bag[piece] === 1)).toBe(true);
      expect(d.openChest()).toBe(false); // (once)

      // Out by the postern: back in the world, before its gate.
      const exit = run.exitOpen!;
      expect(d.walkTo(() => exit, 0.3, 60)).toBe('there');
      expect(model.doorInReach).toBe(stronghold.entrance);
      expect(model.useDoor()).toBe(true);
      expect([model.inside, model.dungeon]).toEqual([null, null]);
      expect(d.far(stronghold.entrance)).toBeLessThan(0.01);
      expect(model.isBlocked(d.hero.x, d.hero.z, 0.1)).toBe(false);
      d.wait(1);

      // Its record: every post, its boss, its chest; none of those called up.
      const slain = model.cleared(strongholdKey(stronghold));
      expect([...slain].filter((post) => post < BOSS_POST)).toHaveLength(posted - 1);
      expect([slain.has(BOSS_POST), slain.has(CHEST_POST)]).toEqual([true, true]);
      // Gone into again: no one, the gate open, the chest empty, no named piece lying.
      if (model.doorInReach !== stronghold.entrance) model.teleport(stronghold.entrance.x, stronghold.entrance.z); // (a wolf's shove, out there)
      expect(model.useDoor()).toBe(true);
      expect(model.foes).toEqual([]);
      const again = d.run;
      expect([again.gateShut, again.chest?.open, again.share]).toEqual([false, true, 1]);
      expect(d.namedLying).toEqual([]); // (what its foes left and nobody took lies there still, kept: none of it a named piece)
      d.wait(1);
      expect(d.problems).toEqual([]);
      expect(d.events.filter((e) => e.kind === 'unbarred' || e.kind === 'point')).toHaveLength(2); // (neither told again)
    });
  }
});
