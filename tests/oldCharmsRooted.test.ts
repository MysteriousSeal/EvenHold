// The mason's curse and the woodward's rooting, played whole (support/oldCharmStage.ts): what's told where they're
// refused (under a roof, down a dungeon, no ground for a tree), each case in its own words; where a tree lands (a
// free tile beside them: never the hero's, another tree's, a statue's, water, a building, a road); a tree in the way
// just as the world's own are, a statue in the way all round; neither walked through by the hero, by a foe after
// them, or by a villager finding their way; both there still when the hero's been indoors and come out, and after
// a save; a tree felled like any other, and gone for good.
import { describe, expect, it } from 'vitest';
import { goIn, reloaded } from './support/charmStage';
import { banners, castAt, foeAt, game, settled, walkTo } from './support/oldCharmStage';
import { TEST_SEEDS } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import { TREE_COLLISION_HALF } from '../src/model/constants';
import type { Obstacles } from '../src/model/map/obstacles';
import { walk } from '../src/model/npcs/npcWalk';
import { castSpell } from '../src/model/spells/casting';
import { SPELLS } from '../src/model/spells/spells';
import { chopsIn, treeKey } from '../src/model/skills/lumber';

// What blocks the way, to stage with (a tree of the world's put on a tile, taken off it).
const ground = (model: GameModel) => (model as unknown as { obstacles: Obstacles }).obstacles;
// A stretch of open natural ground clear of everything, nearest the hero: the middle of a 5 by 5 of it.
function clearing(model: GameModel): { x: number; z: number } {
  const { hero, size } = model;
  const open = (x: number, z: number) => model.isOpenTile(x, z) && model.tiles.surface(x, z) === 'natural' && !model.isBlocked(x, z, 0.49);
  let best: { x: number; z: number } | null = null;
  for (let x = 3; x < size.width - 3; x++)
    for (let z = 3; z < size.depth - 3; z++) {
      if (best && Math.hypot(x - hero.x, z - hero.z) >= Math.hypot(best.x - hero.x, best.z - hero.z)) continue;
      let clear = true;
      for (let dx = -2; dx <= 2 && clear; dx++) for (let dz = -2; dz <= 2 && clear; dz++) clear = open(x + dx, z + dz);
      if (clear) best = { x, z };
    }
  return best!;
}
// A game with no one in it but the hero, and a clearing to stage in.
function alone(seed: number) {
  const model = game(seed);
  model.enemies.length = 0;
  model.travellers.list.splice(0);
  return { model, at: clearing(model) };
}

describe('a statue or a tree refused', () => {
  it('under a roof and down a dungeon says so, in the same words for either; nothing spent', () => {
    for (const where of ['villager in', 'smith', 'barkeep', 'herbalist', 'crypt', 'cave', 'stronghold'] as const) {
      for (const charm of ['statue', 'tree'] as const) {
        const { model, told } = settled(TEST_SEEDS[1], where)!;
        expect(castSpell(model, charm), `${charm} at ${where}`).toBe('noTarget');
        expect([told.map((e) => (e.kind === 'banner' ? [e.title, e.line] : e.kind)), model.moves.breath], `${charm} at ${where}`).toEqual([[[SPELLS[charm].name, 'Not under a roof.']], 100]);
      }
    }
  });

  it('a tree with no free ground to root in says that, out of doors: every tile about them taken; a statue is made there all the same', () => {
    for (const seed of TEST_SEEDS.slice(0, 3)) {
      const { model, at } = alone(seed);
      const foe = foeAt(model, at.x, at.z);
      // Every tile about it but the hero's: a tree of the world's put on each.
      const hero = { x: at.x, z: at.z + 1 };
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!(dx === 0 && dz === 1) && !(dx === 0 && dz === 0)) ground(model).addProp(at.x + dx, at.z + dz, TREE_COLLISION_HALF);
      // Its own tile: a statue's (another, stood there a moment ago).
      const first = foeAt(model, at.x, at.z, 'wolf', 901);
      expect(castAt(model, first, 'statue', hero), `seed ${seed}`).toBe('cast');
      model.takeEvents();
      const told: string[] = [];
      const report = model.report;
      model.report = (event) => [event.kind === 'banner' && told.push(event.line), report.call(model, event)];
      expect([castAt(model, foe, 'tree', hero), told, model.moves.breath, model.chickens.trees.length, model.enemies.includes(foe)], `seed ${seed}`).toEqual(['noTarget', ['No ground free here for them to root in.'], 100, 0, true]);
      // One tile of them freed: taken.
      ground(model).clearProp(at.x - 1, at.z);
      expect(castAt(model, foe, 'tree', hero), `seed ${seed}`).toBe('cast');
      expect(model.chickens.trees.map((t) => [t.x, t.z]), `seed ${seed}`).toEqual([[at.x - 1, at.z]]);
    }
  });
});

describe('where a tree lands', () => {
  it("on the tile they stand on; the hero on it, the nearest beside; never another tree's, a statue's, water or a building", () => {
    for (const seed of TEST_SEEDS) {
      const { model, at } = alone(seed);
      const said = `seed ${seed}`;
      // Stood off its tile's middle, the hero two tiles away: its own tile.
      const one = foeAt(model, at.x + 0.3, at.z - 0.2, 'wolf', 900);
      expect(castAt(model, one, 'tree', { x: at.x, z: at.z + 2 }), said).toBe('cast');
      expect(model.chickens.trees.map((t) => [t.x, t.z]), said).toEqual([[at.x, at.z]]);
      // Another where the first stood: that tile's a tree's now; the nearest beside it, not the hero's.
      const two = foeAt(model, at.x + 0.4, at.z + 0.3, 'wolf', 901);
      expect(castAt(model, two, 'tree', { x: at.x + 0.9, z: at.z + 0.2 }), said).toBe('cast'); // (the hero on the tile nearest it: (x + 1, z))
      const second = model.chickens.trees[1];
      expect([[at.x, at.z], [at.x + 1, at.z]], said).not.toContainEqual([second.x, second.z]);
      expect(Math.max(Math.abs(second.x - two.x), Math.abs(second.z - two.z)), said).toBeLessThanOrEqual(1.5);
      // A statue's tile: not that either.
      const stone = foeAt(model, at.x - 1, at.z - 1, 'wolf', 902);
      expect(castAt(model, stone, 'statue', { x: at.x - 1, z: at.z - 3 }), said).toBe('cast');
      const three = foeAt(model, at.x - 1.4, at.z - 1.3, 'wolf', 903);
      expect(castAt(model, three, 'tree', { x: at.x - 3, z: at.z - 3 }), said).toBe('cast');
      const third = model.chickens.trees[2];
      expect([third.x, third.z], said).not.toEqual([at.x - 1, at.z - 1]);
      // Every one of them a tile that was open ground, each its own, all of them the world's now.
      const tiles = model.chickens.trees.map((t) => `${t.x},${t.z}`);
      expect(new Set(tiles).size, said).toBe(3);
      for (const tree of model.chickens.trees) expect([model.trees.includes(tree), model.tiles.lake(tree.x, tree.z), model.tiles.surface(tree.x, tree.z)], said).toEqual([true, false, 'natural']);
    }
  });

  it('beside water or a house, is on dry open ground: on every seed, at the nearest shore and the nearest wall', () => {
    let [found, rooted] = [0, 0];
    for (const seed of TEST_SEEDS) {
      const model = game(seed);
      model.enemies.length = 0;
      const { width, depth } = model.size;
      const spots: Array<{ x: number; z: number }> = [];
      // An open tile with water beside it, and one against a house's wall.
      for (const shut of [(x: number, z: number) => model.tiles.lake(x, z), (x: number, z: number) => !model.tiles.lake(x, z) && model.isBlocked(x, z, 0.4) && model.isBlocked(x + 0.3, z + 0.3, 0.01) && model.isBlocked(x - 0.3, z - 0.3, 0.01)]) {
        search: for (let x = 2; x < width - 2; x++) for (let z = 2; z < depth - 2; z++) if (model.isOpenTile(x, z) && shut(x + 1, z) && model.isOpenTile(x - 1, z) && model.isOpenTile(x - 2, z)) {
          spots.push({ x, z });
          break search;
        }
      }
      found += spots.length;
      spots.forEach((spot, i) => {
        const foe = foeAt(model, spot.x + 0.45, spot.z, 'wolf', 900 + i); // (hard against the water, the wall)
        const result = castAt(model, foe, 'tree', { x: spot.x - 2, z: spot.z });
        const tree = model.chickens.trees[model.chickens.trees.length - 1];
        if (result === 'noTarget') return; // (no natural ground beside them: a street)
        expect([result, model.tiles.lake(tree.x, tree.z), model.tiles.surface(tree.x, tree.z)], `seed ${seed}, spot ${i}`).toEqual(['cast', false, 'natural']);
        expect(model.trees.filter((t) => t.x === tree.x && t.z === tree.z).length, `seed ${seed}, spot ${i}`).toBe(1);
        rooted++;
      });
    }
    expect([found, rooted].every((n) => n > 8), `${found} found, ${rooted} rooted`).toBe(true);
  });
});

describe('a tree and a statue in the way', () => {
  it("a tree's is its trunk, just as one of the world's own: the same about both, at every step across them", () => {
    const { model, at } = alone(TEST_SEEDS[0]);
    const foe = foeAt(model, at.x, at.z);
    expect(castAt(model, foe, 'tree')).toBe('cast');
    const [mine, theirs] = [model.chickens.trees[0], model.trees.find((t) => !t.planted && model.tiles.surface(t.x, t.z) === 'natural' && !model.isBlocked(t.x + 0.45, t.z + 0.45, 0.01))!];
    for (const r of [0.01, 0.14, 0.26])
      for (let dx = -0.48; dx <= 0.48; dx += 0.06)
        for (let dz = -0.48; dz <= 0.48; dz += 0.06) {
          if (Math.abs(dx) + r > 0.5 || Math.abs(dz) + r > 0.5) continue; // (onto the next tile: whatever's there)
          const far = Math.max(Math.abs(dx), Math.abs(dz)) - (r + TREE_COLLISION_HALF);
          if (Math.abs(far) < 0.01) continue; // (on its very edge: either)
          expect([model.isBlocked(mine.x + dx, mine.z + dz, r), model.isBlocked(theirs.x + dx, theirs.z + dz, r)], `${dx.toFixed(2)}, ${dz.toFixed(2)}, r ${r}`).toEqual([far < 0, far < 0]); // (its trunk, and no more)
        }
    expect([ground(model).blocksSight(mine.x, mine.z), ground(model).blocksSight(theirs.x, theirs.z)]).toEqual([true, true]);
  });

  for (const charm of ['statue', 'tree'] as const)
    it(`a ${charm} is never walked through: by the hero from any side, by a wolf after them, by a villager finding their way round`, () => {
      for (const seed of TEST_SEEDS.slice(0, 4)) {
        const { model, at } = alone(seed);
        const said = `seed ${seed}`;
        expect(castAt(model, foeAt(model, at.x, at.z), charm), said).toBe('cast');
        const inIt = (p: { x: number; z: number }, r: number) => (charm === 'statue' ? Math.hypot(p.x - at.x, p.z - at.z) < 0.22 : Math.abs(p.x - at.x) < r + TREE_COLLISION_HALF && Math.abs(p.z - at.z) < r + TREE_COLLISION_HALF);
        // The hero, straight at it and on past it, from eight sides: never in it, and not held by it for good.
        for (let k = 0; k < 8; k++) {
          const [sx, sz] = [Math.sin((k * Math.PI) / 4), Math.cos((k * Math.PI) / 4)];
          Object.assign(model.hero, { x: at.x + sx * 1.5, z: at.z + sz * 1.5 });
          for (let t = 0; t < 2; t += 1 / 60) {
            model.update(-sx, -sz, 1 / 60);
            expect(inIt(model.hero, 0.14), `${said}, from ${k}`).toBe(false);
          }
          expect(Math.hypot(model.hero.x - (at.x + sx * 1.5), model.hero.z - (at.z + sz * 1.5)), `${said}, from ${k}`).toBeGreaterThan(1); // (walked up to it)
          expect(walkTo(model, { x: at.x + sx * 1.5, z: at.z + sz * 1.5 }), `${said}, back from ${k}`).toBeLessThan(0.1); // (and away again)
        }
        // A wolf after the hero, it between them: never in it.
        Object.assign(model.hero, { x: at.x, z: at.z + 1.5 });
        const wolf = foeAt(model, at.x, at.z - 1.5, 'wolf', 950);
        Object.assign(wolf, { state: 'chase' });
        for (let t = 0; t < 6; t += 1 / 60) {
          model.update(0, 0, 1 / 60);
          model.hero.hp = 50;
          expect(inIt(wolf, 0.18), `${said}, the wolf`).toBe(false);
        }
        model.enemies.length = 0;
        // A villager walked across it: round it, and there.
        const npc = model.npcs.find((n) => !n.led)!;
        Object.assign(npc, { where: null, seat: null, path: null, x: at.x - 1.5, z: at.z });
        Object.assign(model.hero, { x: at.x, z: at.z + 2.4 });
        let there = false;
        for (let t = 0; t < 12 && !there; t += 1 / 30) {
          there = walk(npc, [npc], model, { x: at.x + 1.5, z: at.z }, 1 / 30);
          expect(inIt(npc, 0.14), `${said}, the villager`).toBe(false);
        }
        expect([there, Math.hypot(npc.x - (at.x + 1.5), npc.z - at.z) < 0.3], `${said}, the villager`).toEqual([true, true]);
      }
    });
});

describe('a statue and a tree, kept', () => {
  it('are there still, in the way, when the hero has been indoors and come out; and after a save and a load, as they were', () => {
    for (const seed of TEST_SEEDS) {
      const { model, at } = alone(seed);
      const said = `seed ${seed}`;
      expect([castAt(model, foeAt(model, at.x, at.z, 'bandit', 900), 'statue'), castAt(model, foeAt(model, at.x + 2, at.z, 'wolf', 901), 'tree')], said).toEqual(['cast', 'cast']);
      const tree = model.chickens.trees[0];
      const stands = (m: GameModel) => ({ statue: m.chickens.hens.map((h) => [h.kind, h.at, Math.round(h.x * 100), Math.round(h.z * 100), h.stone?.foe, h.stone?.id, h.stone?.human?.look]), statues: m.chickens.statues().length, inTheWay: [m.isBlocked(at.x, at.z, 0.05), m.isBlocked(at.x + 0.2, at.z, 0.01), m.isBlocked(at.x + 0.3, at.z, 0.01)], tree: m.chickens.trees.map((t) => [t.x, t.z, t.kind, t.shape, t.quarterTurns, t.groundTier, t.planted]), among: m.trees.filter((t) => t.x === tree.x && t.z === tree.z).length, shut: m.isOpenTile(tree.x, tree.z) });
      const first = stands(model);
      expect(first, said).toMatchObject({ statues: 1, inTheWay: [true, true, false], among: 1, shut: false });
      expect(first.statue[0][6], said).toBeTruthy(); // (a bandit's: in their own look)
      // Indoors and out again (and none of it indoors with them).
      const door = model.entrances.find((e) => e.type !== 'crypt' && e.type !== 'cave' && e.type !== 'stronghold')!;
      goIn(model, door);
      expect(model.chickens.here, said).toEqual([]);
      for (let t = 0; t < 5; t += 0.1) model.update(0, 0, 0.1);
      expect(model.useDoor(), said).toBe(true);
      expect(stands(model), said).toEqual(first);
      expect(model.chickens.here, said).toEqual(model.chickens.hens);
      // Saved and loaded; and again from that.
      const again = reloaded(model);
      expect(stands(again), said).toEqual(first);
      expect(stands(reloaded(again)), said).toEqual(first);
      for (let t = 0; t < 5; t += 0.1) again.update(0, 0, 0.1);
      expect(stands(again), said).toEqual(first);
    }
  });

  it('a tree someone was turned into is felled like any other, and is gone for good: not back with the game taken up again', () => {
    const { model, at } = alone(TEST_SEEDS[0]);
    expect(castAt(model, foeAt(model, at.x, at.z), 'tree')).toBe('cast');
    const tree = model.chickens.trees[0];
    model.lumber.cut.set(treeKey(tree), chopsIn(tree, model.seed));
    expect(model.lumber.felled(tree)).toBe(true);
    const again = reloaded(model);
    expect([again.trees.some((t) => t.x === tree.x && t.z === tree.z), again.isOpenTile(tree.x, tree.z)]).toEqual([false, true]);
  });

  it("has nothing told but the once: no banner of a refusal's where it is taken", () => {
    const { model, told } = settled(TEST_SEEDS[0], 'wolf')!;
    expect(castSpell(model, 'statue')).toBe('cast');
    expect(banners(told)).toEqual([]);
  });
});
