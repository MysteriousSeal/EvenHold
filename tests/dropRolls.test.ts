// What the slain leave, rolled afresh (loot/loot.ts, hero/fighting.ts): a dungeon's guards by their post's number
// once left the same thing forever, in every dungeon, across restocks; a ruin's risen ghosts the same in every world.
// Now each dungeon and each time down rolls its own, and the risen by the world and when they rose. And a mercy for
// what a story quest wants brought (loot/dropMercy.ts): the odds climb with each kill without it, so no player's
// stranded: on every test seed, "What they were paid in" (three old silver off the crypt's draugr) and "Maren's
// locket" (off the ruin's ghosts) done within a sane number of kills.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { strike } from '../src/model/hero/fighting';
import { BOSS_POST } from '../src/model/dungeons/dungeonRecord';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import type { Enemy } from '../src/model/types';
import { LOOT, type LootId } from '../src/model/loot/loot';

const MID = { width: 512, depth: 512 };

// Down into a crypt (or up again and down, the next time); what its draugr leave, slain, all of them.
const goDown = (model: GameModel, at = 0) => {
  const crypt = model.crypts[at];
  model.teleport(crypt.entrance.x, crypt.entrance.z);
  model.useDoor();
  return crypt;
};
const fell = (model: GameModel, foe: Enemy): LootId[] => {
  const before = model.groundHere.loot.length;
  strike(model, foe, foe.hp + 999, false);
  return model.groundHere.loot.slice(before).map((l) => l.item as LootId).filter((item) => item in LOOT); // (its loot, not its gear)
};
const wanting = (model: GameModel, items: LootId[]) => Object.assign(model.story, { wantedItems: () => items });

describe("a dungeon's guards' drops", () => {
  it('differ between dungeons, post for post', () => {
    const model = new GameModel(1, MID);
    expect(model.crypts.length).toBeGreaterThanOrEqual(2);
    const left = [0, 1].map((at) => {
      goDown(model, at);
      return model.foes.slice(0, 12).map((f) => fell(model, Object.assign(f, { kind: 'skeleton' as const })).join('+')).join(','); // (the first twelve posts, each a skeleton)
    });
    expect(left[0]).not.toBe(left[1]);
  });

  it('roll afresh once the dungeon is restocked and gone down into again', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const crypt = goDown(model);
    const byPost = () => new Map(model.foes.filter((f) => f.kind !== 'cryptLord').map((f) => [f.id, fell(model, f).join('+')]));
    const once = byPost();
    for (const f of model.foes) [(f.state = 'dead'), model.slayGuard(f)];
    model.useDoor();
    model.minutes += 3 * 24 * 60; // (days on)
    const slain = model.cleared(`${crypt.ruin.x},${crypt.ruin.z}`);
    for (const post of [...slain]) if (post < BOSS_POST) slain.delete(post);
    goDown(model);
    const again = byPost();
    const posts = [...again.keys()].filter((id) => once.has(id));
    expect(posts.length).toBeGreaterThan(8);
    expect(posts.map((id) => again.get(id)).join(',')).not.toBe(posts.map((id) => once.get(id)).join(',')); // (post for post)
  });
});

describe("a ruin's risen ghosts' drops", () => {
  it('differ between worlds: the first locket not always the same ghost', () => {
    const firsts = new Set<number>();
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const ruin = model.ruins[0];
      let first = -1;
      for (let n = 0; n < 40 && first < 0; n++) {
        model.haunt(ruin, 1);
        const ghost = model.enemies.filter((e) => e.kind === 'ghost' && e.state !== 'dead').at(-1)!;
        if (fell(model, ghost).includes('fadedLocket')) first = n;
      }
      firsts.add(first);
    }
    expect(firsts.size).toBeGreaterThan(2);
  });
});

describe('the mercy for what a story quest wants brought', () => {
  it('"What they were paid in": three old silver off the crypt\'s draugr within 30 kills, on every test seed', () => {
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, MID);
      wanting(model, ['oldSilver']);
      let [kills, silver] = [0, 0];
      while (silver < 3 && kills < 30) {
        const crypt = goDown(model);
        const draugr = model.foes.filter((f) => f.kind === 'draugr');
        for (const f of draugr.length ? draugr : model.foes.slice(0, 3).map((f) => Object.assign(f, { kind: 'draugr' as const }))) {
          silver += fell(model, f).filter((i) => i === 'oldSilver').length;
          kills++;
        }
        for (const f of model.foes) if (f.state === 'dead') model.slayGuard(f);
        model.useDoor();
        model.minutes += 24 * 60;
        const slain = model.cleared(`${crypt.ruin.x},${crypt.ruin.z}`);
        for (const post of [...slain]) if (post < BOSS_POST) slain.delete(post);
      }
      expect(silver, `seed ${seed}: ${kills} kills`).toBeGreaterThanOrEqual(3);
    }
  });

  it('"Maren\'s locket": a faded locket off the ruin\'s ghosts within 15 kills, on every test seed', () => {
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      wanting(model, ['fadedLocket']);
      let kills = 0;
      for (; kills < 15; kills++) {
        model.haunt(model.ruins[0], 1);
        const ghost = model.enemies.filter((e) => e.kind === 'ghost' && e.state !== 'dead').at(-1)!;
        if (fell(model, ghost).includes('fadedLocket')) break;
      }
      expect(kills, `seed ${seed}`).toBeLessThan(15);
    }
  });

  it('wants nothing when no quest wants it: no locket more than its odds', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    wanting(model, []);
    let lockets = 0;
    for (let n = 0; n < 60; n++) {
      model.haunt(model.ruins[0], 1);
      const ghost = model.enemies.filter((e) => e.kind === 'ghost' && e.state !== 'dead').at(-1)!;
      lockets += fell(model, ghost).filter((i) => i === 'fadedLocket').length;
    }
    expect(lockets).toBeLessThan(30);
  });
});
