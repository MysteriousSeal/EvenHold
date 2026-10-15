// The bandit strongholds (model/strongholds/): their gatehouses out in the
// wilds, one to a wide stretch (rarer than the caves), on open level ground,
// named, of the zone's level, kept by their way in. Inside, one great floor
// laid out from the seed (strongholdLayout.ts): a gatehouse, the entry hall,
// four wings off it (the kennels, the stores, the gaol, the barracks), each
// ending in its boss's room, and the great hall behind its gate; all of it
// reached from the way in but the great hall while its gate's shut. What's in
// it (strongholdProps.ts) of the kinds agreed, on its floor, sealing nothing
// off. Its foes (strongholdFoes.ts): packs by room, a mix of roles, the hounds
// mostly in the kennels; the four wings' bosses and the king. Gone into: its
// foes there, the place walked, left again; the gate shut (the way blocked,
// told coming up to it) till the four are slain, in any order, then open, and
// so after a save and a load; the king slain, a point (once), his chest, the
// postern: the way out. (The seam its foes' ways go behind:
// strongholdMoves.test.ts.)
import { describe, expect, it } from 'vitest';
import { isScroll } from '../src/model/loot/scrolls';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { CAVE_REGION } from '../src/model/caves/caves';
import { resetCrypts, nextStronghold } from '../src/model/cheats';
import { BOSS_POST } from '../src/model/dungeons/dungeonRecord';
import { dungeonAt } from '../src/model/dungeons/dungeons';
import { isFloor } from '../src/model/dungeons/floorPlan';
import { isBoss, zoneLevel } from '../src/model/enemies/enemyLevels';
import { FACINGS, cellKey, spawnOf } from '../src/model/map/grid';
import { parseSave, restore, snapshot } from '../src/model/save';
import { STRONGHOLD_REGION, strongholdAt, strongholdInside, strongholdKey } from '../src/model/strongholds/strongholds';
import { WINGS, bossRoom, greatHall, planStronghold, roomAt, type StrongholdPlan } from '../src/model/strongholds/strongholdLayout';
import { PROP_SIZE, chestSpot, furnishStronghold, kingSpot, reachedFrom, solidTiles, strongholdExit, tilesOf } from '../src/model/strongholds/strongholdProps';
import { STRONGHOLD_FOE_ID, StrongholdRun, WING_BOSS, WING_POST, strongholdPosts } from '../src/model/strongholds/strongholdFoes';
import type { Enemy, EnemyKind } from '../src/model/types';
import { mulberry32 } from '../src/util/random';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS, mapsOf, testModel } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const PACK: readonly EnemyKind[] = ['bruiser', 'crossbowman', 'firebrand', 'sawbones', 'runner', 'warHound'];
const BOSSES: readonly EnemyKind[] = ['houndmaster', 'quartermaster', 'gaoler', 'captain', 'banditKing'];
// Plans to look at: the test seeds', and a spread of others, each at a gate of its own.
const seeds = [...TEST_SEEDS, ...Array.from({ length: 22 }, (_, i) => Math.floor(mulberry32(7700 + i)() * 2 ** 31))];
const gateOf = (i: number) => ({ x: 30 + i * 13, z: 50 + i * 19 });
const plans = seeds.map((seed, i) => ({ seed, gate: gateOf(i), plan: planStronghold(seed, gateOf(i)) }));
const keys = (tiles: ReadonlyArray<{ x: number; z: number }>) => new Set(tiles.map((t) => cellKey(t.x, t.z)));
const floorOf = (plan: StrongholdPlan) => {
  const tiles: Array<[number, number]> = [];
  for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (isFloor(plan, x, z)) tiles.push([x, z]);
  return tiles;
};

const fresh = (seed = TEST_SEEDS[0]) => new GameModel(seed, TEST_MAP_SIZE);
const goIn = (model: GameModel) => {
  const stronghold = model.strongholds[0];
  model.teleport(stronghold.entrance.x, stronghold.entrance.z);
  model.useDoor();
  return stronghold;
};
const runOf = (model: GameModel) => model.dungeon as StrongholdRun;
const run = (model: GameModel, seconds: number, dirZ = 0) => {
  for (let t = 0; t < seconds; t += FRAME) model.update(0, dirZ, FRAME);
};
const fell = (model: GameModel, foe: Enemy) => {
  Object.assign(foe, { hp: 0, state: 'dead' });
  model.slayGuard(foe);
};
const bossOf = (model: GameModel, kind: EnemyKind) => model.foes.find((f) => f.kind === kind)!;
// No one about to trouble the hero (not slain: not counted), and nothing that hurts.
const quiet = (model: GameModel) => {
  for (const f of model.foes) f.state = 'dead';
  Object.assign(model.hero, { maxHp: 10_000, hp: 10_000 });
};

describe('the strongholds\' gatehouses', () => {
  it('stand in every test world, one to a wide stretch of the wilds (rarer than the caves): on open level ground, the gatehouse\'s tiles blocked, the ground before the gate open and level with it; each named, of its zone\'s level, known by its way in', () => {
    expect(STRONGHOLD_REGION).toBeGreaterThan(CAVE_REGION);
    for (const seed of TEST_SEEDS) {
      const model = testModel(seed);
      expect(model.strongholds, `seed ${seed}`).toHaveLength(1);
      for (const stronghold of model.strongholds) {
        const [ox, oz] = FACINGS[stronghold.quarterTurns];
        const { heightMap } = mapsOf(model);
        const level = heightMap[stronghold.gate.x][stronghold.gate.z];
        expect(stronghold.footing).toHaveLength(9);
        for (const t of stronghold.footing) {
          expect(model.isOpenTile(t.x, t.z)).toBe(false);
          expect(heightMap[t.x][t.z]).toBeGreaterThanOrEqual(level);
        }
        const before = { x: stronghold.gate.x + ox, z: stronghold.gate.z + oz };
        expect(heightMap[before.x][before.z]).toBe(level);
        expect(model.isOpenTile(before.x, before.z)).toBe(true);
        expect(Math.hypot(stronghold.entrance.x - before.x, stronghold.entrance.z - before.z)).toBeLessThan(0.5);
        expect(stronghold.entrance.type).toBe('stronghold');
        expect(model.entrances).toContain(stronghold.entrance);
        expect(strongholdAt(stronghold.entrance)).toBe(stronghold);
        expect(stronghold.name.length).toBeGreaterThan(3);
        expect(stronghold.level).toBe(zoneLevel(spawnOf(model.size), stronghold.gate));
        expect(dungeonAt(stronghold.entrance)).toEqual({ kind: 'stronghold', name: stronghold.name, level: stronghold.level, key: strongholdKey(stronghold) });
        expect(strongholdKey(stronghold)).toMatch(/^stronghold:\d+,\d+$/);
        // No foe was put where it's built, and none of the world's own is walled up in it.
        const walled = keys(stronghold.footing);
        expect(model.enemies.some((e) => walled.has(cellKey(Math.round(e.x), Math.round(e.z))))).toBe(false);
      }
    }
  });

  it('are the same every time, and of a higher level the farther out (a wider world\'s)', () => {
    const [model, again] = [new GameModel(1, MID), new GameModel(1, MID)];
    expect(model.strongholds.length).toBeGreaterThan(0);
    expect(model.strongholds.length).toBeLessThanOrEqual(model.caves.length);
    expect(again.strongholds.map((s) => [s.gate, s.name, s.level])).toEqual(model.strongholds.map((s) => [s.gate, s.name, s.level]));
    expect(model.strongholds[0].level).toBeGreaterThan(1);
    const names = new Set(TEST_SEEDS.map((seed) => testModel(seed).strongholds[0].name));
    expect(names.size).toBeGreaterThan(4);
  });

  it('are gone to with the cheat menu\'s row: the nearest, before its gate, where it\'s offered', () => {
    const model = fresh();
    const at = nextStronghold(model, { x: model.hero.x, z: model.hero.z }, new Set())!;
    model.teleport(at.x, at.z);
    expect(model.doorInReach).toBe(model.strongholds[0].entrance);
  });
});

describe('a stronghold\'s plan', () => {
  it('is sound: every room reached from the way in (two wide, in the +Z wall), no two rooms on the same floor, all its floor some room\'s; the same every time, another on another seed', () => {
    for (const { seed, gate, plan } of plans) {
      const reached = reachedFrom(plan, new Set());
      const floor = floorOf(plan);
      expect(floor.length, `seed ${seed}`).toBeGreaterThan(800);
      expect(floor.every(([x, z]) => reached.has(cellKey(x, z))), `seed ${seed}`).toBe(true);
      for (const x of [plan.door, plan.door + 1]) expect(isFloor(plan, x, plan.depth - 1)).toBe(true);
      const owned = new Map<string, number>();
      plan.rooms.forEach((r, i) => {
        for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) {
          expect(owned.has(cellKey(x, z)), `seed ${seed}: rooms ${owned.get(cellKey(x, z))} and ${i} overlap`).toBe(false);
          owned.set(cellKey(x, z), i);
          expect(isFloor(plan, x, z)).toBe(true);
        }
      });
      expect(owned.size).toBe(floor.length);
      expect(planStronghold(seed, gate)).toEqual(plan);
    }
    expect(new Set(plans.map(({ plan }) => `${plan.width}x${plan.depth}:${plan.rooms.length}`)).size).toBeGreaterThan(5);
  });

  it('has a gatehouse at the way in, the entry hall, four wings off it (the kennels, the stores, the gaol, the barracks), each with rooms on the way and one boss\'s room at its end, and one great hall', () => {
    for (const { seed, plan } of plans) {
      const count = (kind: string, wing: string | null = null) => plan.rooms.filter((r) => r.kind === kind && (wing === null || r.wing === wing)).length;
      expect(plan.rooms[0].kind).toBe('gatehouse');
      expect(roomAt(plan, plan.door, plan.depth - 1)).toBe(plan.rooms[0]);
      expect([count('gatehouse'), count('hub'), count('great')], `seed ${seed}`).toEqual([1, 1, 1]);
      const hub = plan.rooms.find((r) => r.kind === 'hub')!;
      for (const wing of WINGS) {
        expect(count('boss', wing), `seed ${seed}: ${wing}`).toBe(1);
        expect(count('room', wing)).toBeGreaterThanOrEqual(2);
        // Its boss's room the farthest of it from the hall, and a good size to fight in.
        const boss = bossRoom(plan, wing);
        const far = (r: { x0: number; x1: number }) => Math.max(hub.x0 - r.x1, r.x0 - hub.x1);
        for (const r of plan.rooms) if (r.wing === wing && r !== boss) expect(far(r)).toBeLessThan(far(boss));
        expect((boss.x1 - boss.x0 + 1) * (boss.z1 - boss.z0 + 1)).toBeGreaterThanOrEqual(100);
      }
      expect(plan.rooms.filter((r) => r.wing === null && r.kind !== 'passage')).toHaveLength(3);
    }
  });

  it('has the great hall behind its gate: the gate shut, all of it is reached but the great hall and the way beyond the gate; the four wings each reached without the others (any order)', () => {
    for (const { seed, plan } of plans) {
      expect(plan.gate.length).toBe(2);
      const shut = reachedFrom(plan, keys(plan.gate));
      const great = greatHall(plan);
      const beyond = (z: number) => z < plan.gate[0].z; // (past the gate, on its way or in the hall)
      for (const [x, z] of floorOf(plan)) {
        const inWay = roomAt(plan, x, z) === roomAt(plan, plan.gate[0].x, plan.gate[0].z);
        const behind = roomAt(plan, x, z) === great || (inWay && beyond(z));
        if (!plan.gate.some((t) => t.x === x && t.z === z)) expect(shut.has(cellKey(x, z)), `seed ${seed}: ${x},${z}`).toBe(!behind);
      }
      // Each wing with every other wing's floor shut: still reached, its boss's room and all.
      for (const wing of WINGS) {
        const others = new Set(floorOf(plan).filter(([x, z]) => { const r = roomAt(plan, x, z)!; return r.wing !== null && r.wing !== wing; }).map(([x, z]) => cellKey(x, z)));
        const alone = reachedFrom(plan, others);
        const boss = bossRoom(plan, wing);
        expect(alone.has(cellKey(boss.x0, boss.z0)), `seed ${seed}: ${wing}`).toBe(true);
      }
    }
  });
});

describe('what\'s in a stronghold', () => {
  it('is of the kinds agreed, each on free floor of its own (its tiles by its kind\'s size, as it\'s turned), nothing solid sealing any floor off; the gate across its way, the throne in the great hall; the king\'s place, his chest\'s and the postern clear', () => {
    const seen = new Set<string>();
    for (const { seed, gate, plan } of plans) {
      const props = furnishStronghold(seed, gate, plan);
      expect(furnishStronghold(seed, gate, plan)).toEqual(props);
      const taken = new Set<string>();
      for (const p of props) {
        seen.add(p.kind);
        expect(PROP_SIZE[p.kind]).toBeDefined();
        expect([p.w, p.d]).toEqual(p.facing % 2 ? [PROP_SIZE[p.kind][1], PROP_SIZE[p.kind][0]] : [...PROP_SIZE[p.kind]]);
        for (const [x, z] of tilesOf(p)) {
          expect(isFloor(plan, x, z), `seed ${seed}: ${p.kind} at ${x},${z}`).toBe(true);
          expect(taken.has(cellKey(x, z)), `seed ${seed}: two things at ${x},${z}`).toBe(false);
          taken.add(cellKey(x, z));
        }
      }
      const solid = solidTiles(props);
      const reached = reachedFrom(plan, solid);
      for (const [x, z] of floorOf(plan)) if (!solid.has(cellKey(x, z))) expect(reached.has(cellKey(x, z)), `seed ${seed}: ${x},${z} sealed off`).toBe(true);
      const gateProp = props.filter((p) => p.kind === 'gate');
      expect(gateProp).toHaveLength(1);
      expect(tilesOf(gateProp[0]).map(([x, z]) => ({ x, z }))).toEqual(plan.gate);
      expect(gateProp[0].solid).toBe(false); // (shut or open: its run's to say)
      const throne = props.find((p) => p.kind === 'throne')!;
      expect(roomAt(plan, throne.x, throne.z)).toBe(greatHall(plan));
      for (const spot of [kingSpot(plan), chestSpot(plan), strongholdExit(plan).spot]) {
        expect(roomAt(plan, spot.x, spot.z)).toBe(greatHall(plan));
        for (const x of [Math.floor(spot.x), Math.ceil(spot.x)]) for (const z of [Math.floor(spot.z), Math.ceil(spot.z)]) expect(solid.has(cellKey(x, z))).toBe(false);
      }
      expect(isFloor(plan, strongholdExit(plan).rock.x, strongholdExit(plan).rock.z)).toBe(false);
      // Each wing furnished for what it is.
      const inWing = (kind: string, wing: string) => props.filter((p) => p.kind === kind && roomAt(plan, p.x, p.z)?.wing === wing).length;
      expect(inWing('kennel', 'kennels')).toBeGreaterThan(0);
      expect(inWing('cage', 'gaol') + inWing('stocks', 'gaol')).toBeGreaterThan(0);
      expect(inWing('crate', 'stores') + inWing('barrel', 'stores') + inWing('keg', 'stores')).toBeGreaterThan(0);
      expect(props.filter((p) => p.kind === 'dummy' && roomAt(plan, p.x, p.z) === bossRoom(plan, 'barracks')).length).toBeGreaterThan(0);
    }
    // All the kinds agreed are used, but the chest (the king's: his run's, once he's slain).
    expect([...seen].sort()).toEqual(Object.keys(PROP_SIZE).filter((k) => k !== 'chest').sort());
  });
});

describe('a stronghold\'s foes', () => {
  it('stand in packs by room, a mix of roles (a bruiser or a hound to the fore), none in the gatehouse nor the ways between; the hounds mostly in the kennels; each wing\'s boss in his room and the king before his throne, each at a post of his own', () => {
    for (const seed of TEST_SEEDS) {
      const model = testModel(seed);
      const inside = strongholdInside(seed, model.strongholds[0].entrance);
      const { plan } = inside;
      const posts = strongholdPosts(seed, inside);
      expect(strongholdPosts(seed, inside)).toEqual(posts);
      const solid = solidTiles(inside.props);
      const stood = new Set<string>();
      for (const p of posts) {
        const room = plan.rooms[p.room];
        expect(roomAt(plan, p.x, p.z)).toBe(room);
        expect(['gatehouse', 'passage']).not.toContain(room.kind);
        for (const x of [Math.floor(p.x), Math.ceil(p.x)]) expect(solid.has(cellKey(x, p.z))).toBe(false);
        expect(stood.has(`${p.x},${p.z}`), `seed ${seed}: two posted at ${p.x},${p.z}`).toBe(false);
        stood.add(`${p.x},${p.z}`);
      }
      // The packs: their posts numbered from 0, one pack to a room, each of several kinds.
      const men = posts.filter((p) => PACK.includes(p.kind));
      expect(men.map((p) => p.post)).toEqual(men.map((_, i) => i));
      expect(men.length).toBeGreaterThan(30);
      const packs = new Map<number, typeof posts>();
      for (const p of posts) packs.set(p.pack, [...(packs.get(p.pack) ?? []), p]);
      for (const pack of packs.values()) {
        expect(new Set(pack.map((p) => p.room)).size).toBe(1);
        expect(pack.length).toBeGreaterThanOrEqual(2);
      }
      for (const room of plan.rooms.filter((r) => r.kind === 'room')) {
        const pack = men.filter((p) => plan.rooms[p.room] === room);
        expect(pack.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
        expect(new Set(pack.map((p) => p.kind)).size).toBeGreaterThanOrEqual(2);
        expect(pack.some((p) => p.kind === 'bruiser' || p.kind === 'warHound')).toBe(true);
      }
      const hounds = men.filter((p) => p.kind === 'warHound');
      expect(hounds.filter((p) => plan.rooms[p.room].wing === 'kennels').length).toBeGreaterThan(hounds.length / 2);
      // The five: each wing's in its own room, the king in the great hall.
      for (const wing of WINGS) {
        const boss = posts.filter((p) => p.kind === WING_BOSS[wing]);
        expect(boss).toHaveLength(1);
        expect(plan.rooms[boss[0].room]).toBe(bossRoom(plan, wing));
        expect(boss[0].post).toBe(WING_POST[wing]);
        expect(WING_POST[wing]).toBeLessThan(BOSS_POST);
        expect(WING_POST[wing]).toBeGreaterThan(men.length);
      }
      const king = posts.filter((p) => p.kind === 'banditKing');
      expect(king).toHaveLength(1);
      expect(plan.rooms[king[0].room]).toBe(greatHall(plan));
      expect(king[0].post).toBe(BOSS_POST);
      expect(posts.at(-1)).toBe(king[0]);
    }
  });

  it('are bosses, the five of them, wherever they\'re shown; and fight, for now, on a first pass of their own numbers', () => {
    for (const kind of BOSSES) expect(isBoss(kind)).toBe(true);
    for (const kind of PACK) expect(isBoss(kind)).toBe(false);
    const { bandit, banditChief, wolf, bruiser, warHound, banditKing } = ENEMY_STATS;
    expect(bruiser.hp).toBeGreaterThan(bandit.hp);
    expect(bruiser.run).toBeLessThan(bandit.run);
    expect(warHound.hp).toBeGreaterThan(wolf.hp);
    for (const wing of WINGS) {
      expect(ENEMY_STATS[WING_BOSS[wing]].hp).toBeGreaterThanOrEqual(banditChief.hp * 2);
      expect(banditKing.hp).toBeGreaterThan(ENEMY_STATS[WING_BOSS[wing]].hp);
    }
  });
});

describe('a stronghold, gone into', () => {
  it('has its foes there (the world\'s are not), of its level, the packs and the five bosses, each dressed to be drawn; walked up from the way in, the rock stopping the hero; left again by the way in', () => {
    for (const seed of TEST_SEEDS) {
      const model = fresh(seed);
      const stronghold = goIn(model);
      const { plan } = strongholdInside(seed, stronghold.entrance);
      expect(model.inside?.entrance).toBe(stronghold.entrance);
      expect(model.dungeon).toBeInstanceOf(StrongholdRun);
      expect(model.takeEvents()).toContainEqual({ kind: 'arrive', name: stronghold.name, level: stronghold.level });
      expect([model.hero.x, model.hero.z]).toEqual([plan.door, plan.depth - 1]);
      const kinds = new Set(model.foes.map((f) => f.kind));
      for (const kind of [...BOSSES, 'bruiser', 'crossbowman', 'warHound'] as const) expect(kinds.has(kind), `seed ${seed}: ${kind}`).toBe(true);
      expect(PACK.filter((k) => kinds.has(k)).length).toBeGreaterThanOrEqual(5);
      expect(model.foes.every((f) => f.id >= STRONGHOLD_FOE_ID && f.level === stronghold.level + (f.kind === 'banditKing' || f.champion ? 1 : 0))).toBe(true); // (the king, and a champion if there's one, a level over)
      expect(model.foes.every((f) => (f.kind === 'warHound') === (f.human === null))).toBe(true);
      expect(model.foes.find((f) => f.kind === 'banditKing')!.name).toMatch(/, the bandit king$/);
      expect(model.clearedShare(stronghold.entrance)).toBe(0);
      // Up the gatehouse and the way beyond it, into the entry hall; into the rock beside the way, not a step.
      quiet(model);
      run(model, 4, -1);
      expect(roomAt(plan, model.hero.x, model.hero.z)?.kind).toBe('hub');
      Object.assign(model.hero, { x: plan.door, z: plan.depth - 1 });
      for (let t = 0; t < 3; t += FRAME) model.update(-1, 0, FRAME);
      expect(roomAt(plan, model.hero.x, model.hero.z)?.kind).toBe('gatehouse');
      expect(runOf(model).free(model.hero.x - 1, model.hero.z, 0.2)).toBe(false);
      Object.assign(model.hero, { x: plan.door, z: plan.depth - 1 });
      expect(model.doorInReach).toBe(stronghold.entrance);
      model.useDoor();
      expect(model.inside).toBeNull();
      expect(model.dungeon).toBeNull();
      expect(model.foes).toBe(model.enemies);
    }
  });

  it('has the great hall\'s gate shut till the four wings\' bosses are slain: the way blocked, the hero told so coming up to it (and how many still stand); the four slain, in any order, it opens (told), and they walk through', () => {
    for (const seed of TEST_SEEDS) {
      const model = fresh(seed);
      const stronghold = goIn(model);
      const { plan } = strongholdInside(seed, stronghold.entrance);
      const [gate] = plan.gate;
      const bosses = WINGS.map((wing) => bossOf(model, WING_BOSS[wing]));
      const order = [bosses[(seed + 2) % 4], bosses[(seed + 3) % 4], bosses[seed % 4], bosses[(seed + 1) % 4]]; // (another order each seed)
      expect(runOf(model).gateShut).toBe(true);
      for (const t of plan.gate) expect(runOf(model).free(t.x, t.z, 0.14)).toBe(false);
      quiet(model);
      model.takeEvents();
      // Walking at it from the entry hall: told once, and no further than its near side.
      Object.assign(model.hero, { x: gate.x + 0.5, z: gate.z + 2.5 });
      run(model, 2, -1);
      expect(model.hero.z).toBeGreaterThan(gate.z + 0.5);
      expect(model.takeEvents().filter((e) => e.kind === 'barred')).toEqual([{ kind: 'barred', left: 4 }]);
      for (const boss of order.slice(0, 3)) fell(model, boss);
      run(model, 0.5, -1);
      expect(runOf(model).gateShut).toBe(true);
      expect(runOf(model).wingsLeft).toHaveLength(1);
      expect(model.hero.z).toBeGreaterThan(gate.z + 0.5);
      expect(model.takeEvents().filter((e) => e.kind === 'barred' || e.kind === 'unbarred')).toEqual([]); // (still there: not told again)
      Object.assign(model.hero, { x: gate.x + 0.5, z: gate.z + 6 });
      run(model, FRAME);
      Object.assign(model.hero, { x: gate.x + 0.5, z: gate.z + 1 });
      run(model, FRAME);
      expect(model.takeEvents()).toContainEqual({ kind: 'barred', left: 1 });
      fell(model, order[3]);
      run(model, FRAME);
      expect(runOf(model).gateShut).toBe(false);
      expect(model.takeEvents()).toContainEqual({ kind: 'unbarred' });
      for (const t of plan.gate) expect(runOf(model).free(t.x, t.z, 0.14)).toBe(true);
      run(model, 2, -1);
      expect(roomAt(plan, model.hero.x, model.hero.z)).toBe(greatHall(plan));
    }
  });

  it('keeps its record through a save and a load: the slain still slain, the gate as it was (shut with a wing\'s boss standing, open with the four slain, and not told again)', () => {
    for (const seed of TEST_SEEDS) {
      const model = fresh(seed);
      const stronghold = goIn(model);
      const all = model.foes.filter((f) => !f.champion).length; // (a champion, if there's one, none of its posts: model/champions/)
      const bosses = WINGS.map((wing) => bossOf(model, WING_BOSS[wing]));
      for (const f of [...model.foes.filter((f) => PACK.includes(f.kind) && !f.champion).slice(0, 5), bosses[0], bosses[2]]) fell(model, f);
      const share = model.clearedShare(stronghold.entrance);
      expect(share).toBeCloseTo(7 / all, 10);
      const load = () => {
        const loaded = fresh(seed);
        restore(loaded, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
        return loaded;
      };
      const half = load();
      expect(half.dungeon).toBeInstanceOf(StrongholdRun);
      expect(half.foes.filter((f) => !f.champion)).toHaveLength(all - 7);
      expect(half.clearedShare(half.strongholds[0].entrance)).toBe(share);
      expect(runOf(half).gateShut).toBe(true);
      expect(runOf(half).wingsLeft).toEqual([WINGS[1], WINGS[3]]);
      expect(runOf(half).bossOf(WINGS[0])).toBeNull();
      expect(runOf(half).bossOf(WINGS[1])?.kind).toBe(WING_BOSS[WINGS[1]]);
      const [gate] = strongholdInside(seed, half.strongholds[0].entrance).plan.gate;
      expect(runOf(half).free(gate.x, gate.z, 0.14)).toBe(false);
      fell(model, bosses[1]);
      fell(model, bosses[3]);
      run(model, FRAME);
      const open = load();
      expect(runOf(open).gateShut).toBe(false);
      expect(runOf(open).free(gate.x, gate.z, 0.14)).toBe(true);
      open.update(0, 0, FRAME);
      expect(open.takeEvents().some((e) => e.kind === 'unbarred')).toBe(false); // (open before: not told again)
      // All back at their posts with the Reset crypts & caves cheat, the gate shut again.
      resetCrypts(model);
      expect(model.inside).toBeNull();
      goIn(model);
      expect(model.foes.filter((f) => !f.champion)).toHaveLength(all);
      expect(runOf(model).gateShut).toBe(true);
    }
  });

  it('is cleared with its king: slain, a point to spend (once), his chest before his throne, the postern open: the way out, to before its gate; back in, he\'s gone, the chest empty, still cleared', () => {
    const model = fresh();
    const stronghold = goIn(model);
    const { plan } = strongholdInside(model.seed, stronghold.entrance);
    const king = bossOf(model, 'banditKing');
    expect(runOf(model).king).toBe(king);
    expect(runOf(model).exitOpen).toBeNull();
    expect(runOf(model).chest).toBeNull();
    for (const f of [...model.foes]) if (f !== king) fell(model, f);
    Object.assign(model.hero, { maxHp: 10_000, hp: 10_000 });
    run(model, FRAME);
    expect(model.clearedShare(stronghold.entrance)).toBeLessThan(1);
    model.takeEvents();
    const points = model.hero.statPoints;
    fell(model, king);
    run(model, FRAME);
    expect(model.hero.statPoints).toBe(points + 1);
    expect(model.clearedShare(stronghold.entrance)).toBe(1);
    const told = model.takeEvents();
    expect(told).toContainEqual({ kind: 'point', why: 'The bandit king slain' });
    expect(told).toContainEqual({ kind: 'cleared', name: stronghold.name, point: true, place: 'stronghold' });
    expect(runOf(model).king).toBeNull();
    const chest = runOf(model).chest!;
    expect(chest).toEqual({ ...chestSpot(plan), open: false });
    Object.assign(model.hero, { x: chest.x, z: chest.z + 0.6 });
    expect(runOf(model).chestInReach(model.hero)).toBe(true);
    const lying = model.groundHere.loot.length;
    runOf(model).openChest();
    expect(chest.open).toBe(true);
    const out = model.groundHere.loot.slice(lying); // (the piece of gear, and now and then a charm written down: loot/scrolls.ts)
    expect(out.filter((l) => !isScroll(l.item))).toHaveLength(1);
    expect(out.length).toBeLessThanOrEqual(2);
    const exit = runOf(model).exitOpen!;
    expect(exit).toEqual(strongholdExit(plan).spot);
    Object.assign(model.hero, { x: exit.x, z: exit.z });
    expect(model.doorInReach).toBe(stronghold.entrance);
    model.useDoor();
    expect(model.inside).toBeNull();
    expect(Math.hypot(model.hero.x - stronghold.entrance.x, model.hero.z - stronghold.entrance.z)).toBeLessThan(0.01);
    goIn(model);
    expect(model.foes).toHaveLength(0);
    expect(runOf(model).chest?.open).toBe(true);
    expect(runOf(model).gateShut).toBe(false);
    expect(model.clearedShare(stronghold.entrance)).toBe(1);
    fell(model, king); // (were he slain again: no second point)
    expect(model.hero.statPoints).toBe(points + 1);
  });
});
