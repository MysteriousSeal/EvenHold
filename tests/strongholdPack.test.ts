// A stronghold's packs' roles (model/strongholds/strongholdPack.ts, on the
// stage of strongholdStage.ts): a bruiser's smash, told, throwing the hero
// back; a crossbowman keeping off, his bolt told down its line, stopped by a
// wall, lost to a blow; a firebrand's pot, its circle told before it lands,
// burning after; a sawbones mending the most wounded of its pack, put off by
// a blow, backing away; a runner fetching the next pack, unless it's cut down
// on the way; a war hound's lunge, then worrying. Nothing told ever a hero's
// whole health. (The seam: strongholdMoves.test.ts; the bosses:
// strongholdBosses.test.ts.)
import { describe, expect, it } from 'vitest';
import { ENEMY_STATS } from '../src/model/constants';
import { isBoss } from '../src/model/enemies/enemyLevels';
import { maxHpAt } from '../src/model/hero/attributes';
import { MEND_SHARE, POT_BURN, POT_RADIUS, Pack, SMASH_RADIUS, WORRY } from '../src/model/strongholds/strongholdPack';
import { BOLT, Stage } from '../src/model/strongholds/strongholdStage';
import type { Enemy, EnemyKind } from '../src/model/types';
import { packsOf, staged, stagedWith, type Staged } from './support/strongholdStage';

// A pack of the wings' rooms with one of `kind` in it (and `mate`, if asked), no boss's.
const packWith = (kind: EnemyKind, mate?: EnemyKind) => (s: Staged) => packsOf(s).find((p) => p.some((f) => f.kind === kind) && (!mate || p.some((f) => f.kind === mate)) && !p.some((f) => isBoss(f.kind))) ?? null;
const of = (pack: Enemy[], kind: EnemyKind) => pack.find((f) => f.kind === kind)!;

describe('a stronghold\'s packs\' roles', () => {
  it('a bruiser smashes the ground round him: told first (a ring, himself planted), then whoever\'s still in it hurt and thrown back; stepped out of, nothing', () => {
    for (const stays of [true, false]) {
      const { s, pack } = stagedWith(packWith('bruiser'));
      const bruiser = of(pack, 'bruiser');
      s.only(bruiser);
      s.face(bruiser, 0.8);
      expect(s.tick(6, () => bruiser.told === 'smash')).toBe(true);
      const at = { x: bruiser.x, z: bruiser.z };
      s.tick(0.3);
      expect(s.moves.marks).toContainEqual(expect.objectContaining({ shape: 'ring', tone: 'blow', x: at.x, z: at.z, r: SMASH_RADIUS }));
      expect(s.game.blow).not.toHaveBeenCalled();
      if (!stays) s.hero.x += 20; // (out of it, well before it lands)
      s.hit(bruiser, 0); // (a blow on him doesn't put him off it)
      s.tick(1.2);
      expect([bruiser.x, bruiser.z]).toEqual([at.x, at.z]);
      expect(s.game.blow.mock.calls.length).toBe(stays ? 1 : 0);
      if (!stays) continue;
      const [by, damage, knock] = s.game.blow.mock.calls[0];
      expect(by).toBe(bruiser);
      expect(damage).toBeGreaterThan(bruiser.damage);
      expect(damage).toBeLessThanOrEqual(s.hardest);
      expect(Math.hypot(knock!.dx, knock!.dz)).toBeCloseTo(1.6);
    }
  });

  it('a crossbowman never closes: he aims (its line told, fixed as he starts) and looses a bolt down it, striking the hero still on it; sidestepped, it flies on to the wall and no further; struck as he aims, the shot\'s lost; come up to, he backs away', () => {
    for (const how of ['struck', 'sidestepped', 'spoiled'] as const) {
      const { s, pack } = stagedWith(packWith('crossbowman'));
      const bowman = of(pack, 'crossbowman');
      s.only(bowman);
      const wall = new Stage(s.fight);
      const { dx, dz } = s.face(bowman, 4, (dx, dz) => wall.reach(bowman.x, bowman.z, dx, dz, BOLT.range) < BOLT.range - 1.5); // (a wall behind the hero, within a bolt's range)
      expect(s.tick(5, () => bowman.told === 'shot')).toBe(true);
      const mark = s.moves.marks.find((m) => m.shape === 'strip' && m.tone === 'shot')!;
      expect([mark.x, mark.z]).toEqual([bowman.x, bowman.z]);
      if (mark.shape === 'strip') expect([mark.dx, mark.dz].map((v) => Math.round(v))).toEqual([dx, dz]);
      if (how === 'spoiled') {
        s.hit(bowman, 0);
        s.tick(1.5);
        expect([bowman.told, s.moves.shots.length, s.game.arrow.mock.calls.length]).toEqual([null, 0, 0]);
        continue;
      }
      expect(s.tick(2, () => s.moves.shots.length > 0)).toBe(true);
      const bolt = s.moves.shots[0];
      expect([bolt.kind, bolt.by, bolt.damage]).toEqual(['bolt', bowman, bowman.damage]);
      if (how === 'sidestepped') Object.assign(s.hero, { x: s.hero.x + dz * 1.2, z: s.hero.z + dx * 1.2 });
      expect(s.tick(3, () => !s.moves.shots.includes(bolt))).toBe(true);
      expect(s.game.arrow.mock.calls.length).toBe(how === 'struck' ? 1 : 0);
      if (how === 'struck') expect(s.game.arrow).toHaveBeenCalledWith(expect.objectContaining({ damage: bowman.damage }));
      else {
        expect(s.fight.blocked(bolt.x, bolt.z, 0.02)).toBe(true); // (in the wall, or something solid: where it stopped)
        expect(bolt.flown).toBeLessThan(BOLT.range);
      }
      expect(s.game.strike).not.toHaveBeenCalled(); // (never a plain blow)
      // Come right up to, he gives ground.
      Object.assign(s.hero, { x: bowman.x - dx * 1.2, z: bowman.z - dz * 1.2 });
      const near = s.far(bowman);
      Object.assign(s.hero, { x: bowman.x + dx * 1.2, z: bowman.z + dz * 1.2 });
      bowman.told = null;
      s.tick(0.5);
      expect(s.far(bowman)).toBeGreaterThan(near - 1e-6);
    }
  });

  it('a firebrand lobs a fire pot at where the hero stands: its circle told on the floor all the while it flies, then it bursts on whoever\'s still in it, and its ground burns a moment after', () => {
    const { s, pack } = stagedWith(packWith('firebrand'));
    const brand = of(pack, 'firebrand');
    s.only(brand);
    s.face(brand, 3.5);
    expect(s.tick(5, () => s.moves.shots.length > 0)).toBe(true);
    const pot = s.moves.shots[0];
    const stood = { x: s.hero.x, z: s.hero.z };
    expect([pot.kind, pot.by]).toEqual(['pot', brand]);
    let high = 0;
    let told = 0;
    expect(s.tick(3, () => {
      high = Math.max(high, pot.high ?? 0);
      if (s.moves.shots.includes(pot)) {
        told++;
        expect(s.moves.marks).toContainEqual(expect.objectContaining({ shape: 'ring', tone: 'fire', x: stood.x, z: stood.z, r: POT_RADIUS }));
        expect(s.game.blow).not.toHaveBeenCalled(); // (told before it lands)
      }
      return s.moves.fires.length > 0;
    })).toBe(true);
    expect(told).toBeGreaterThan(30); // (frames: the better part of a second to step out of it)
    expect(high).toBeGreaterThan(0.9); // (lobbed: up, and down)
    expect(s.game.blow).toHaveBeenCalledTimes(1);
    expect(s.moves.bursts).toHaveLength(1);
    expect(s.far(pot)).toBeLessThan(0.1);
    // Its ground burns: stood in, it bites again and again; stepped out of, no more; then it's out.
    const fire = s.moves.fires[0];
    expect([fire.x, fire.z]).toEqual([stood.x, stood.z]);
    s.tick(1.5);
    const bitten = s.game.blow.mock.calls.length;
    expect(bitten).toBeGreaterThanOrEqual(3);
    s.only();
    s.hero.x += fire.r + 0.5;
    s.tick(POT_BURN);
    expect(s.game.blow.mock.calls.length).toBe(bitten);
    expect(s.moves.fires).toEqual([]);
    for (const damage of s.blows()) expect(damage).toBeLessThanOrEqual(s.hardest);
  });

  it('a pot thrown and stepped away from bursts on no one', () => {
    const { s, pack } = stagedWith(packWith('firebrand'));
    const brand = of(pack, 'firebrand');
    s.only(brand);
    const { dx, dz } = s.face(brand, 3.5);
    expect(s.tick(5, () => s.moves.shots.length > 0)).toBe(true);
    s.only();
    Object.assign(s.hero, { x: s.hero.x - dx * 2, z: s.hero.z - dz * 2 }); // (toward where it came from: out of its circle)
    s.tick(2);
    expect(s.game.blow).not.toHaveBeenCalled();
  });

  it('a sawbones never fights: it mends the most wounded of its pack (told, a long while), is put off it by a blow, and backs away from the hero', () => {
    for (const struck of [false, true]) {
      const { s, pack } = stagedWith(packWith('sawbones', 'bruiser'));
      const [sawbones, bruiser] = [of(pack, 'sawbones'), of(pack, 'bruiser')];
      s.only(sawbones, bruiser);
      s.face(sawbones, 4);
      Object.assign(bruiser, { x: s.hero.x, z: s.hero.z, hp: 1, cooldown: 99 }); // (the worse for wear, right by the hero)
      s.hero.x += 0.7;
      expect(s.tick(4, () => sawbones.told === 'mend')).toBe(true);
      expect(bruiser.hp).toBe(1);
      if (struck) s.hit(sawbones, 0);
      s.tick(2.2);
      expect(sawbones.told ?? null).toBeNull();
      expect(bruiser.hp).toBe(struck ? 1 : Math.min(bruiser.maxHp, 1 + Math.max(2, Math.round(sawbones.maxHp * MEND_SHARE))));
      expect(sawbones.hp).toBe(sawbones.maxHp);
      // It gives ground as the hero comes on, and never lands a blow.
      s.only(sawbones);
      const { dx, dz } = s.face(sawbones, 1.5);
      s.tick(0.6);
      expect(s.far(sawbones)).toBeGreaterThan(1.5 - 1e-6);
      expect(Math.sign((sawbones.x - s.hero.x) * dx + (sawbones.z - s.hero.z) * dz)).toBe(-1);
      expect(s.game.strike).not.toHaveBeenCalled();
    }
  });

  it('a runner, its pack set upon, runs for the nearest other pack of its wing and brings them back at the hero; cut down on the way, no one comes', () => {
    // A runner with another pack to fetch (asked of roles of the test's own, on a stage of their own).
    const fetchable = (s: Staged) => {
      const roles = new Pack(new Stage(s.fight));
      const runner = s.run.foes.find((f) => f.kind === 'runner' && roles.fetched(f).length > 0);
      return runner ? [runner, ...roles.fetched(runner)] : null;
    };
    for (const cutDown of [false, true]) {
      const { s, pack: [runner, ...fetched] } = stagedWith(fetchable);
      const own = s.fight.packOf(runner);
      const [wing, theirs] = [s.fight.plan.rooms[s.fight.placeOf(runner)!.room].wing, s.fight.plan.rooms[s.fight.placeOf(fetched[0])!.room].wing];
      expect(theirs).not.toBeNull();
      if (wing) expect(theirs).toBe(wing);
      expect(fetched.some((f) => own.includes(f) || isBoss(f.kind))).toBe(false);
      s.only(...own, ...fetched);
      s.face(runner, 2.5);
      const stood = s.far(fetched[0]);
      expect(fetched.every((f) => f.state === 'wander')).toBe(true);
      expect(s.tick(3, () => s.banners().includes('Cut them down before they fetch the next room'))).toBe(true);
      const from = s.far(runner);
      s.tick(1);
      expect(s.far(runner)).toBeGreaterThan(from + 1.5); // (off, and fast)
      expect(s.far(runner, fetched[0])).toBeLessThan(Math.hypot(runner.homeX - fetched[0].x, runner.homeZ - fetched[0].z));
      if (cutDown) s.slay(runner);
      const came = s.tick(40, () => fetched.some((f) => f.state === 'chase' && s.far(f) < ENEMY_STATS[f.kind].sight));
      expect(came).toBe(!cutDown);
      if (cutDown) {
        expect(fetched.every((f) => f.state === 'wander' && Math.abs(s.far(f) - stood) < 12)).toBe(true);
        continue;
      }
      s.tick(6);
      expect(fetched.filter((f) => f.state === 'chase').length).toBe(fetched.length);
      expect(runner.state).toBe('chase'); // (back with them)
      expect(s.far(runner)).toBeLessThan(stood);
    }
  });

  it('a war hound lunges from a few tiles off (told: a streak to where it\'ll land), its bite where it lands, then worries at the hero, its bites coming fast a while', () => {
    const { s, pack } = stagedWith(packWith('warHound'));
    const hound = of(pack, 'warHound');
    s.only(hound);
    s.tick(1); // (the hero a moment in the place, off at its way in)
    const hub = s.fight.plan.rooms.find((r) => r.kind === 'hub')!;
    const open = { x: s.fight.plan.door + 0.5, z: (hub.z0 + hub.z1) / 2 }; // (out in the entry hall, room to spring in)
    Object.assign(hound, { ...open, homeX: open.x, homeZ: open.z, target: null });
    const { dx, dz } = s.face(hound, 3);
    expect(s.tick(4, () => hound.told === 'lunge')).toBe(true);
    const from = { x: hound.x, z: hound.z };
    expect(s.far(from)).toBeGreaterThan(1.4);
    s.tick(0.1);
    expect(s.moves.marks).toContainEqual(expect.objectContaining({ shape: 'strip', tone: 'blow', x: from.x, z: from.z }));
    expect(s.game.blow).not.toHaveBeenCalled();
    expect(s.tick(1, () => s.game.blow.mock.calls.length > 0)).toBe(true);
    const [by, damage, knock] = s.game.blow.mock.calls[0];
    expect(by).toBe(hound);
    expect(damage).toBeLessThanOrEqual(s.hardest);
    expect(Math.sign(knock!.dx * dx + knock!.dz * dz)).toBe(1); // (on along its leap)
    s.tick(0.6);
    expect(s.far(hound, from)).toBeGreaterThan(1.5); // (carried to where they stood)
    let quick = true;
    s.tick(WORRY - 1, () => ((quick &&= hound.cooldown <= 0.3 + 1e-9), false));
    expect(quick).toBe(true);
  });

  it('nothing told is ever a hero of its level\'s whole health, however hard its foe hits', () => {
    const s = staged();
    const stage = new Stage(s.fight);
    const brute = { ...s.run.foes[0], damage: 999 };
    expect(stage.harm(brute, 3)).toBe(s.hardest);
    expect(s.hardest).toBeLessThan(maxHpAt(s.level));
    expect(stage.harm({ ...brute, damage: 1 }, 0.1)).toBe(1);
  });
});
