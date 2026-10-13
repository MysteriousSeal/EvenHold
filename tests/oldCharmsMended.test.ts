// What the six older charms got wrong when they were played whole (oldCharmsWholeGame.test.ts and its neighbours),
// each a small reproduction of a fault since mended in model/spells/, kept so it stays mended: someone whose sex a
// charm changed back as the seed has them once their part of the world's let go and made again; a tree rooted in the
// middle of a road or a village street; a moon-turn refused on a beast, and not a word why.
import { describe, expect, it } from 'vitest';
import { dungeonFoe, pickOut, telling } from './support/charmStage';
import { banners, game, settled, words } from './support/oldCharmStage';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { castSpell } from '../src/model/spells/casting';

describe('mended: the moon-turn charm, where the world is made a part at a time', () => {
  // spells/swaps.ts remade: whoever's made again was known for one already changed only by their look being the very
  // same thing (===) as the one kept from before; someone made anew has a look of their own, so they stayed as the
  // seed has them, though the save still had them changed (and a cast to put them right did nothing to be seen).
  // (Half of it: a streamed world's region made again doesn't ask this yet, oldCharmsKnown.test.ts.)
  it('someone changed, made anew as the seed has them, is changed again: a keeper, a bandit', () => {
    const model = game(TEST_SEEDS[0]);
    const [smith, bandit] = [model.npcs.find((n) => n.role === 'smith')!, model.enemies.find((e) => e.kind === 'bandit')!];
    expect([model.swaps.swap(smith), model.swaps.swap(bandit)]).toEqual([true, true]);
    const anew = new GameModel(model.seed, TEST_MAP_SIZE); // (the same people, as the seed has them)
    const [theirs, his] = [anew.npcs.find((n) => n.id === smith.id)!, anew.enemies.find((e) => e.id === bandit.id)!];
    expect([theirs.look.build, his.human!.look.build]).not.toEqual([smith.look.build, bandit.human!.look.build]);
    model.swaps.remade([theirs, his]);
    expect([theirs.look, theirs.name, his.human!.look]).toEqual([smith.look, smith.name, bandit.human!.look]);
    // And cast on them again: as they first were.
    const first = new GameModel(model.seed, TEST_MAP_SIZE).npcs.find((n) => n.id === smith.id)!;
    expect(model.swaps.swap(theirs)).toBe(true);
    expect([theirs.look, theirs.name]).toEqual([first.look, first.name]);
  });
});

describe("mended: the woodward's rooting, where it lands", () => {
  // spells/turned.ts sapling: any open tile did: someone on the road took root in the middle of it (every one of
  // them: a road's own tiles are open), a villager in their street. None of the world's own trees stands on anything
  // but natural ground (worldgen: 769 to 1127 of them a test world, every one), and those on the road walk on through.
  it('is on natural ground, as every tree of the world is: never a road, a village street or a field', () => {
    let rooted = 0;
    for (const seed of TEST_SEEDS) {
      const world = game(seed);
      expect(world.trees.every((t) => world.tiles.surface(t.x, t.z) === 'natural'), `seed ${seed}`).toBe(true);
      for (const where of ['traveller', 'villager out', 'wolf'] as const) {
        const made = settled(seed, where);
        if (!made) continue;
        const { model, who, told } = made;
        const said = `${where}, seed ${seed}`;
        const road = new Set(model.travellers.roads.flatMap((r) => r.route.map(([x, z]) => `${x},${z}`)));
        const result = castSpell(model, 'tree');
        const tree = model.chickens.trees[0];
        if (result === 'noTarget') {
          // (No natural ground beside them: refused, and told so.)
          expect([banners(told), tree, model.moves.breath], said).toEqual([['No ground free here for them to root in.'], undefined, 100]);
          continue;
        }
        rooted++;
        expect([result, model.tiles.surface(tree.x, tree.z), road.has(`${tree.x},${tree.z}`)], said).toEqual(['cast', 'natural', false]);
        expect(Math.max(Math.abs(tree.x - who.x), Math.abs(tree.z - who.z)), said).toBeLessThanOrEqual(1.5); // (beside them still)
      }
    }
    expect(rooted).toBeGreaterThan(12);
  });
});

describe('mended: a moon-turn refused', () => {
  // spells/casting.ts: a charm that turns someone says why where it can't (turned.ts whyNot); the moon-turn, cast at
  // what has no man's or woman's body to change, was a key pressed and nothing.
  it('at a beast, or one of the dead that walk, says so: nothing spent, nothing changed', () => {
    for (const where of ['wolf', 'crypt', 'cave'] as const) {
      const { model, who, told } = settled(TEST_SEEDS[0], where)!;
      expect(castSpell(model, 'swap'), where).toBe('noTarget');
      expect([words(told), model.moves.breath, model.focused], where).toEqual([['banner: It finds neither man nor woman there.'], 100, who]);
    }
  });

  it('says nothing more than before where it is who they are, not what: no one picked out, someone slain', () => {
    const model = game(TEST_SEEDS[0]);
    const told = telling(model);
    expect(castSpell(model, 'swap')).toBe('noTarget');
    const foe = dungeonFoe(model, 'stronghold')!;
    pickOut(model, foe);
    Object.assign(foe, { state: 'dead', hp: 0 });
    expect(castSpell(model, 'swap')).toBe('noTarget');
    expect(told).toEqual([]);
  });
});
