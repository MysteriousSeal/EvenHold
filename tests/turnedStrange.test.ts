// The three stranger charms (model/spells/turned.ts). A ghost: themselves, kept with who they're of, drifting slower
// than any beast and through whatever stands in the way. A painting: under a roof only, hung on the nearest free
// stretch of their room's two full walls (spells/hung.ts), facing out from it, never moving, kept with who it's of;
// refused, nothing spent, out of doors, down a dungeon, upstairs, or where there's no wall free. A doll: a thing on
// the ground where they stood (loot/junk.ts), picked up and sold like any junk, none of the kept; refused in a
// building's room. Whoever's turned is gone as with the other charms: a foe as if slain, a villager lost.
import { describe, expect, it } from 'vitest';
import { eachSeed, fresh, regionCrypt } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import { goesUnder } from '../src/model/dungeons/dungeonTypes';
import { makeEnemy } from '../src/model/enemies/enemies';
import { layoutOf } from '../src/model/interiors/indoors';
import { isJunk, sellValue } from '../src/model/shops/sellValue';
import { LOOT } from '../src/model/loot/loot';
import { parseSave, restore, snapshot } from '../src/model/save';
import { castSpell } from '../src/model/spells/casting';
import { HUNG_FACING, hungAt, soundHung, wallFor, type Hung } from '../src/model/spells/hung';
import { SPELLS, learn, type SpellId } from '../src/model/spells/spells';
import { BEASTS, GAIT, ROAM, mayTurn, placeOf } from '../src/model/spells/turned';
import type { GameEvent } from '../src/model/types';

// What's told, kept.
function telling(model: GameModel): GameEvent[] {
  const told: GameEvent[] = [];
  const report = model.report;
  model.report = (event) => [told.push(event), report.call(model, event)];
  return told;
}
// A game with a wolf a little ahead of the hero, out of doors, focused, the hero knowing the charm.
function withWolf(charm: SpellId) {
  const model = fresh();
  const { hero } = model;
  model.enemies.length = 0;
  hero.facing = 0;
  const foe = { ...makeEnemy(900, 'wolf', hero.x, hero.z + 2), hp: 500, maxHp: 500 };
  model.enemies.push(foe);
  model.focus(foe.id);
  learn(hero, charm);
  return { model, hero, foe, told: telling(model) };
}
// A game with the hero in a herbalist's house, beside her, her picked out, the hero knowing the charm.
function withKeeper(charm: SpellId) {
  const model = fresh();
  const { hero } = model;
  learn(hero, charm);
  const keeper = model.npcs.find((n) => n.role === 'herbalist')!;
  model.teleport(keeper.home.x, keeper.home.z);
  model.useDoor();
  model.update(0, 0, 0.1);
  Object.assign(hero, { x: keeper.x, z: keeper.z + 1.2 });
  model.select(keeper);
  return { model, hero, keeper, told: telling(model) };
}
const run = (model: GameModel, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 0.1) [model.update(0, 0, 0.1), each?.()];
};
// Nothing done by a cast refused: no Breath spent, no wait begun, no one turned.
function refused(model: GameModel, charm: SpellId, who: { id: number }) {
  const breath = model.moves.breath;
  expect(castSpell(model, charm)).toBe('noTarget');
  expect(model.moves.breath).toBe(breath);
  expect(model.hero.spellWait?.[charm]).toBeUndefined();
  expect(model.chickens.hens).toEqual([]);
  expect(model.loot).toEqual([]);
  expect([...model.enemies, ...model.npcs].some((one) => one.id === who.id)).toBe(true); // (still there)
}

describe("the sexton's knell", () => {
  it('makes a ghost of a foe, gone as if slain: of itself, where it stood, with no coat, kept in a save', () => {
    const { model, hero, foe, told } = withWolf('ghost');
    const [xp, money] = [hero.xp, hero.money];
    expect(castSpell(model, 'ghost')).toBe('cast');
    expect(model.enemies).not.toContain(foe);
    expect(model.slain.has(foe.id)).toBe(true);
    expect([hero.xp, hero.money, model.loot.length]).toEqual([xp, money, 0]); // (nothing had for it)
    const ghost = model.chickens.hens[0];
    expect(ghost).toMatchObject({ kind: 'ghost', x: foe.x, z: foe.z, at: null, stone: { foe: 'wolf', id: foe.id } });
    expect(ghost.coat).toBeUndefined();
    expect(told.find((e) => e.kind === 'transformed')).toMatchObject({ into: 'ghost', who: { id: foe.id } });
    const again = fresh();
    again.chickens.load(JSON.parse(JSON.stringify(model.chickens.save())));
    expect(again.chickens.hens.map((h) => [h.kind, h.stone])).toEqual([['ghost', { foe: 'wolf', id: foe.id }]]);
    again.chickens.load({ hens: [[1, 1, null, 1, 1, 'ghost'], [2, 2, null, 2, 2, 'ghost', null, { id: 3 }], [3, 3, null, 3, 3, 'ghost', null, 'her']], lost: [] }); // (a ghost of no one: none)
    expect(again.chickens.hens).toEqual([]);
  });

  it('makes a ghost of a villager, lost to their village: in their own look and what they wore', () => {
    const model = fresh();
    const villager = model.npcs.find((n) => n.role === 'villager' && !n.led)!;
    expect(model.chickens.turn(villager, 'ghost')).toBe(true);
    expect(model.npcs).not.toContain(villager);
    expect(model.chickens.lost.has(villager.id)).toBe(true);
    const ghost = model.chickens.hens[0];
    expect(ghost.stone).toEqual({ id: villager.id, human: { look: villager.look, equipment: villager.equipment } });
    expect(ghost.at).toBe(placeOf(villager.where));
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.npcs.some((n) => n.id === villager.id)).toBe(false);
    expect(again.chickens.hens[0]).toMatchObject({ kind: 'ghost', stone: { id: villager.id, human: { look: villager.look } } });
  });

  it('drifts about where it was turned, slower than any beast, through what a beast could not walk through', () => {
    const movers = BEASTS.filter((kind) => GAIT[kind].pace > 0);
    expect(Math.min(...movers.map((kind) => GAIT[kind].pace))).toBe(GAIT.ghost.pace);
    expect(movers.filter((kind) => GAIT[kind].pace === GAIT.ghost.pace)).toEqual(['ghost']);
    expect(movers.filter((kind) => GAIT[kind].drifts)).toEqual(['ghost']);
    const gone = (kind: 'ghost' | 'pig') => {
      const { model, hero, foe } = withWolf(kind);
      model.chickens.turn(foe, kind);
      const one = model.chickens.hens[0];
      model.isOpenTile = () => false; // (something stood on every tile)
      Object.assign(hero, { x: one.x, z: one.z }); // (and the hero where it is)
      let [far, fastest] = [0, 0];
      for (let t = 0; t < 120; t += 0.1) {
        const [x, z] = [one.x, one.z];
        model.chickens.update(0.1);
        fastest = Math.max(fastest, Math.hypot(one.x - x, one.z - z) / 0.1);
        far = Math.max(far, Math.hypot(one.x - foe.x, one.z - foe.z));
        expect(far).toBeLessThanOrEqual(ROAM + 1e-6);
      }
      return { far, fastest };
    };
    expect(gone('pig').far).toBe(0); // (shut in)
    const ghost = gone('ghost');
    expect(ghost.far).toBeGreaterThan(0.5);
    expect(ghost.fastest).toBeCloseTo(GAIT.ghost.pace, 5);
  });

  it('keeps to the floor of the room it was turned in, through its furniture', () => {
    const { model, keeper } = withKeeper('ghost');
    const { room, furniture } = model.inside!;
    expect(castSpell(model, 'ghost')).toBe('cast');
    expect(model.npcs).not.toContain(keeper);
    const ghost = model.chickens.hens[0];
    expect(ghost).toMatchObject({ kind: 'ghost', at: placeOf(keeper.home), stone: { id: keeper.id } });
    furniture.push({ kind: 'table', x: 0, z: 0, w: room.width, d: room.depth, wall: 'none', solid: true }); // (the whole floor taken)
    const [x0, z0] = [ghost.x, ghost.z];
    let far = 0;
    for (let t = 0; t < 200; t += 0.1) {
      model.chickens.update(0.1);
      far = Math.max(far, Math.hypot(ghost.x - x0, ghost.z - z0));
      expect(ghost.x).toBeGreaterThan(-0.5);
      expect(ghost.z).toBeGreaterThan(-0.5);
      expect(ghost.x).toBeLessThan(room.width - 0.5);
      expect(ghost.z).toBeLessThan(room.depth - 0.5);
      expect(ghost.y).toBe(0);
    }
    expect(far).toBeGreaterThan(0.5);
  });
});

describe("the limner's likeness", () => {
  it('finds the nearest free stretch of the two full walls, and says which way it faces', () => {
    const room = { width: 4, depth: 3, door: 2, floor: 'planks', wall: 'plaster' } as const;
    expect(wallFor(room, [], [], { x: 3, z: 2 })).toEqual({ wall: 'back', x: 3, z: 0 });
    expect(wallFor(room, [], [], { x: 0.2, z: 2 })).toEqual({ wall: 'left', x: 0, z: 2 });
    expect(wallFor(room, [], [{ wall: 'back', x: 3, z: 0 }], { x: 3, z: 2 })).toEqual({ wall: 'back', x: 2, z: 0 }); // (another's: the next along)
    const shelf = { kind: 'shelf', x: 1, z: 0, w: 3, d: 1, wall: 'back', solid: false } as const;
    const rug = { kind: 'rug', x: 0, z: 0, w: 4, d: 3, wall: 'none', solid: false } as const;
    expect(wallFor(room, [shelf, rug], [], { x: 3, z: 0 })).toEqual({ wall: 'back', x: 0, z: 0 }); // (not behind what's hung there; a rug no matter)
    const barrel = { kind: 'barrel', x: 3, z: 0, w: 1, d: 1, wall: 'none', solid: true } as const;
    expect(wallFor(room, [barrel], [], { x: 3, z: 2 })).toEqual({ wall: 'back', x: 3, z: 0 }); // (over what stands free on the floor)
    expect(wallFor(room, [{ ...rug, kind: 'hearth', wall: 'back', solid: true }], [], { x: 1, z: 1 })).toBeNull(); // (none free)
    expect(hungAt({ wall: 'back', x: 3, z: 0 })).toEqual({ x: 3, z: -0.5 }); // (on the wall's own face)
    expect(hungAt({ wall: 'left', x: 0, z: 2 })).toEqual({ x: -0.5, z: 2 });
    expect([HUNG_FACING.back, HUNG_FACING.left]).toEqual([0, Math.PI / 2]); // (toward +Z; toward +X)
    for (const bad of [null, 'back', {}, { wall: 'right', x: 0, z: 0 }, { wall: 'back', x: 2, z: 1 }, { wall: 'left', x: 1, z: 1 }, { wall: 'back', x: 1.5, z: 0 }, { wall: 'left', x: 0, z: -1 }]) expect(soundHung(bad), JSON.stringify(bad)).toBe(false);
  });

  it("has a stretch of wall free in every house and inn of every test world, wherever in it someone stands (a smithy's may all be taken)", () => {
    let [smithies, full] = [0, 0];
    eachSeed((model) => {
      const doors = model.entrances.filter((e) => !goesUnder(e));
      expect(doors.length).toBeGreaterThan(3);
      for (const door of doors) {
        const { room, furniture } = layoutOf(model.seed, door);
        const found = [{ x: 0, z: 0 }, { x: room.width - 1, z: room.depth - 1 }, { x: room.door, z: room.depth - 1 }].map((from) => wallFor(room, furniture, [], from));
        if (door.type !== 'smithy') for (const hung of found) expect(hung, `${door.type} at ${door.x},${door.z}`).not.toBeNull();
        else [smithies, full] = [smithies + 1, full + (found.includes(null) ? 1 : 0)];
      }
    });
    expect(full).toBeLessThan(smithies / 2); // (most of them, too)
  });

  it('is refused out of doors, the cast spending nothing', () => {
    const { model, foe } = withWolf('painting');
    expect(model.chickens.may(foe, 'painting')).toBe(false);
    refused(model, 'painting', foe);
    const villager = model.npcs.find((n) => n.role === 'villager' && !n.led)!;
    villager.where = null;
    expect(model.chickens.turn(villager, 'painting')).toBe(false);
    expect(model.npcs).toContain(villager);
    const one = model.travellers.list[0];
    expect(model.chickens.may(one, 'painting')).toBe(false); // (the roads: no wall)
  });

  it('hangs a villager on the nearest wall of their room, facing out from it, never moving; they lost to their village', () => {
    const { model, hero, keeper, told } = withKeeper('painting');
    const { room, furniture } = model.inside!;
    const stood = { x: keeper.x, z: keeper.z };
    const breath = model.moves.breath;
    expect(castSpell(model, 'painting')).toBe('cast');
    expect(model.moves.breath).toBe(breath - SPELLS.painting.breath);
    expect(model.npcs).not.toContain(keeper);
    expect(model.folk).not.toContain(keeper);
    expect(model.chickens.lost.has(keeper.id)).toBe(true);
    expect(model.chosen.person).toBeNull();
    const painting = model.chickens.hens[0];
    const hung = painting.hung!;
    expect(painting).toMatchObject({ kind: 'painting', at: placeOf(keeper.home), from: stood, y: 0, stone: { id: keeper.id, human: { look: keeper.look } } });
    expect(painting.stone!.foe).toBeUndefined();
    expect(soundHung(hung)).toBe(true);
    expect({ x: painting.x, z: painting.z }).toEqual(hungAt(hung)); // (on its wall)
    expect(painting.facing).toBe(HUNG_FACING[hung.wall]);
    expect(hung.wall === 'back' ? [painting.z, hung.x < room.width] : [painting.x, hung.z < room.depth]).toEqual([-0.5, true]);
    expect(furniture.some((f) => f.wall !== 'none' && hung.x >= f.x && hung.x < f.x + f.w && hung.z >= f.z && hung.z < f.z + f.d)).toBe(false); // (nothing against the wall there)
    // The nearest there is, of every stretch of both walls that's free.
    const far = (h: Hung) => Math.hypot(hungAt(h).x - stood.x, hungAt(h).z - stood.z);
    const walls: Hung[] = [...Array.from({ length: room.width }, (_, x): Hung => ({ wall: 'back', x, z: 0 })), ...Array.from({ length: room.depth }, (_, z): Hung => ({ wall: 'left', x: 0, z }))];
    const free = walls.filter((h) => !furniture.some((f) => (f.wall !== 'none' || f.kind === 'stairs') && h.x >= f.x && h.x < f.x + f.w && h.z >= f.z && h.z < f.z + f.d));
    expect(far(hung)).toBe(Math.min(...free.map(far)));
    expect(told.find((e) => e.kind === 'transformed')).toMatchObject({ into: 'painting', hung, who: { id: keeper.id } });
    expect(model.chickens.here).toEqual([painting]);
    const still = { ...painting, fresh: undefined };
    run(model, 30, () => expect({ ...painting, fresh: undefined }).toEqual(still));
    // Another, in the same room: a stretch of its own.
    const foe = { ...makeEnemy(901, 'wolf', stood.x, stood.z), hp: 500, maxHp: 500 };
    model.enemies.push(foe);
    expect(model.chickens.turn(foe, 'painting')).toBe(true);
    const other = model.chickens.hens[1];
    expect(other).toMatchObject({ kind: 'painting', at: placeOf(keeper.home), stone: { foe: 'wolf', id: foe.id } });
    expect(other.hung).not.toEqual(hung);
    expect(far(other.hung!)).toBeGreaterThanOrEqual(far(hung));
    // No wall left free: refused, nothing spent.
    furniture.push({ kind: 'shelf', x: 0, z: 0, w: room.width, d: room.depth, wall: 'back', solid: true });
    const last = { ...makeEnemy(902, 'wolf', hero.x, hero.z + 0.5), hp: 500, maxHp: 500 };
    model.enemies.push(last);
    model.focus(last.id);
    const spent = model.moves.breath;
    expect(castSpell(model, 'painting')).toBe('noTarget');
    expect([model.moves.breath, model.chickens.hens.length, model.enemies.includes(last)]).toEqual([spent, 2, true]);
  });

  it('is kept in a save, on its wall, with who it is of; one of no one, or on no wall, is none', () => {
    const { model, keeper } = withKeeper('painting');
    expect(castSpell(model, 'painting')).toBe('cast');
    const painting = model.chickens.hens[0];
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.npcs.some((n) => n.id === keeper.id)).toBe(false);
    expect(again.chickens.hens).toHaveLength(1);
    expect(again.chickens.hens[0]).toMatchObject({ kind: 'painting', x: painting.x, z: painting.z, y: 0, at: painting.at, facing: painting.facing, hung: painting.hung, stone: { id: keeper.id, human: { look: keeper.look } } });
    expect(again.chickens.here).toEqual(again.chickens.hens); // (the hero in that room still)
    const [of, wall] = [{ id: 4, foe: 'wolf' }, { wall: 'left', x: 0, z: 2 }];
    again.chickens.load({ hens: [[9, 9, '1,1', 3, 3, 'painting', null, of, wall], [1, 1, '1,1', 1, 1, 'painting', null, null, wall], [1, 1, '1,1', 1, 1, 'painting', null, of], [1, 1, '1,1', 1, 1, 'painting', null, of, { wall: 'right', x: 0, z: 2 }], [1, 1, null, 1, 1, 'painting', null, of, wall], [1, 1, '1,1', 1, 1, 'painting']], lost: [] });
    expect(again.chickens.hens).toHaveLength(1); // (the sound one alone)
    expect(again.chickens.hens[0]).toMatchObject({ kind: 'painting', x: -0.5, z: 2, facing: Math.PI / 2, hung: wall, stone: of, from: { x: 3, z: 3 } }); // (on its wall, whatever the save said of where)
  });

  it('is refused down a dungeon, and upstairs; a floor shows only what hangs on it', () => {
    const { model } = withKeeper('painting');
    const inside = model.inside!;
    const wolf = { ...makeEnemy(903, 'wolf', model.hero.x, model.hero.z), hp: 500, maxHp: 500 };
    expect(model.chickens.may(wolf, 'painting')).toBe(true);
    model.inside = { ...inside, below: inside.entrance }; // (upstairs: its rooms walled off within)
    expect(model.chickens.may(wolf, 'painting')).toBe(false);
    model.chickens.load({ hens: [[1, 1, placeOf(inside.entrance), 1, 1, 'cat', 0, null, null, true], [2, 2, placeOf(inside.entrance), 2, 2, 'rat', 0, null, null, false], [3, 3, placeOf(inside.entrance), 3, 3, 'pig', 0]], lost: [] });
    expect(model.chickens.here.map((h) => h.kind)).toEqual(['cat']); // (upstairs: the one turned there)
    model.inside = inside;
    expect(model.chickens.here.map((h) => h.kind)).toEqual(['rat', 'pig']);
    expect(model.chickens.save().hens.map((row) => row[9])).toEqual([true, false, false]);
    // Down a crypt: rock, and no wall to hang on.
    const below = fresh();
    learn(below.hero, 'painting');
    const crypt = regionCrypt(below);
    below.teleport(crypt.entrance.x, crypt.entrance.z);
    below.useDoor();
    expect(below.dungeon).not.toBeNull();
    const guard = below.foes.find((foe) => mayTurn(foe))!;
    expect(below.chickens.may(guard, 'painting')).toBe(false);
    Object.assign(below.hero, { x: guard.x, z: guard.z + 1 });
    below.focus(guard.id);
    const breath = below.moves.breath;
    expect(castSpell(below, 'painting')).toBe('noTarget');
    expect([below.moves.breath, below.chickens.hens.length, below.foes.includes(guard)]).toEqual([breath, 0, true]);
  });
});

describe("the poppet-maker's stitch", () => {
  it('leaves a foe a doll on the ground where it stood, gone as if slain: none of the kept, picked up and sold as junk', () => {
    const { model, hero, foe, told } = withWolf('doll');
    expect(LOOT.doll).toMatchObject({ name: 'Poppet', droppedBy: {} });
    const [xp, money] = [hero.xp, hero.money];
    expect(castSpell(model, 'doll')).toBe('cast');
    expect(model.enemies).not.toContain(foe);
    expect(model.slain.has(foe.id)).toBe(true);
    expect([hero.xp, hero.money]).toEqual([xp, money]);
    expect(model.chickens.hens).toEqual([]); // (no beast of it)
    expect(model.chickens.trees).toEqual([]);
    expect(model.loot.map(({ item, x, z }) => ({ item, x, z }))).toEqual([{ item: 'doll', x: foe.x, z: foe.z }]);
    expect(told.find((e) => e.kind === 'transformed')).toMatchObject({ into: 'doll', who: { id: foe.id } });
    // Kept in a save, lying there.
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.loot.map((l) => l.item)).toEqual(['doll']);
    expect(again.chickens.hens).toEqual([]);
    // Picked up, and worth a little.
    Object.assign(hero, { x: foe.x, z: foe.z });
    expect(model.pickUp()).toBe('doll');
    expect(model.loot).toEqual([]);
    expect(hero.bag.doll).toBe(1);
    expect(isJunk('doll')).toBe(true);
    expect(sellValue('doll')).toBe(LOOT.doll.value);
    expect(LOOT.doll.value).toBeGreaterThan(0);
  });

  it('leaves a villager a doll, they lost to their village; someone on the road, off it', () => {
    const model = fresh();
    const villager = model.npcs.find((n) => n.role === 'villager' && !n.led)!;
    villager.where = null; // (out of doors)
    expect(model.chickens.turn(villager, 'doll')).toBe(true);
    expect(model.npcs).not.toContain(villager);
    expect(model.chickens.lost.has(villager.id)).toBe(true);
    expect(model.loot.map(({ item, x, z }) => ({ item, x, z }))).toEqual([{ item: 'doll', x: villager.x, z: villager.z }]);
    const one = model.travellers.list[0];
    expect(model.chickens.turn(one, 'doll')).toBe(true);
    expect(model.travellers.list).not.toContain(one);
    expect(model.loot.map((l) => l.item)).toEqual(['doll', 'doll']);
    expect(model.chickens.hens).toEqual([]);
  });

  it('is refused in a building\'s room, the cast spending nothing; down a dungeon it lies on its floor', () => {
    const { model, keeper } = withKeeper('doll');
    expect(model.chickens.may(keeper, 'doll')).toBe(false);
    refused(model, 'doll', keeper);
    const below = fresh();
    const crypt = regionCrypt(below);
    below.teleport(crypt.entrance.x, crypt.entrance.z);
    below.useDoor();
    const guard = below.foes.find((foe) => mayTurn(foe))!;
    const [x, z] = [guard.x, guard.z];
    expect(below.chickens.turn(guard, 'doll')).toBe(true);
    expect(below.foes).not.toContain(guard);
    expect(below.groundHere.loot.map((l) => ({ item: l.item, x: l.x, z: l.z }))).toEqual([{ item: 'doll', x, z }]);
    expect(below.loot).toEqual([]); // (the crypt's floor, not the world's)
    Object.assign(below.hero, { x, z });
    expect(below.pickUp()).toBe('doll');
  });
});
