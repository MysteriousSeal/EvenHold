// What's looked through each frame, kept cheap (the full map: some fourteen thousand foes, twelve thousand villagers,
// thirty thousand animals). The views of things near the hero (view/meshes/common/nearby.ts): the right ones shown, a
// big list gone through once in a while, not each frame (a short one, as loot comes and goes, each frame, as ever);
// the model's focus (none: nothing looked through); the foes round the hero (enemyDirector.ts: around), what the wild
// beasts' moves and the hero's steps go by; a guard's partner found by id.
import { describe, expect, it } from 'vitest';
import { Nearby } from '../src/view/meshes/common/nearby';
import { GameModel } from '../src/model/GameModel';
import { FRAME } from './support/testWorld';

// A list counting each thing read out of it.
const counted = <T extends object>(list: T[]) => {
  const reads = { n: 0 };
  const proxy = new Proxy(list, {
    get: (target, key, receiver) => {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads.n++;
      return Reflect.get(target, key, receiver);
    },
  });
  return { list: proxy, reads };
};

describe('things near the hero, seen', () => {
  it('a big list: those near shown, the rest not; gone through once in a while, not each frame', () => {
    const things = Array.from({ length: 20000 }, (_, i) => ({ id: i, x: (i % 200) * 5, z: Math.floor(i / 200) * 5 }));
    const { list, reads } = counted(things);
    const made: number[] = [];
    const dropped: number[] = [];
    const near = new Nearby<(typeof things)[number], number>((t) => (made.push(t.id), t.id), (v) => dropped.push(v), 30);
    let seen = new Set<number>();
    for (let frame = 0; frame < 30; frame++) seen = near.update(list, 100, 100, () => {});
    const truth = things.filter((t) => Math.abs(t.x - 100) <= 30 && Math.abs(t.z - 100) <= 30).map((t) => t.id);
    expect([...seen].sort((a, b) => a - b)).toEqual(truth);
    expect(reads.n).toBeLessThan(things.length * 2); // (once, not thirty times)
    seen = near.update(list, 600, 600, () => {}); // (gone far off: the list made afresh, the old ones dropped)
    expect([...seen].every((id) => Math.abs(things[id].x - 600) <= 30 && Math.abs(things[id].z - 600) <= 30)).toBe(true);
    expect(dropped.length).toBe(truth.length);
  });

  it('a short list (loot, coins): each frame as it is, one taken and another come at once seen at once', () => {
    const loot = [{ id: 1, x: 5, z: 5 }, { id: 2, x: 6, z: 5 }];
    const near = new Nearby<(typeof loot)[number], number>((t) => t.id, () => {}, 30);
    near.update(loot, 5, 5, () => {});
    loot.splice(0, 1, { id: 3, x: 5, z: 6 }); // (picked up, and dropped, the same frame: as long as before)
    expect([...near.update(loot, 5, 5, () => {})].sort()).toEqual([2, 3]);
  });
});

describe('the model, each frame', () => {
  it("its focus: none, nothing looked through; one, found and kept to hand; the foes round the hero, by the director", () => {
    const model = new GameModel(1, { width: 256, depth: 256 });
    model.update(0, 0, FRAME);
    expect(model.focused).toBe(null);
    const foe = model['director'].around().find((e) => e.state !== 'dead')!;
    model.focus(foe.id);
    expect(model.focused).toBe(foe);
    model.focus(null);
    expect(model.focused).toBe(null);
    const around = model['director'].around();
    for (const e of model.enemies) if (Math.abs(e.x - model.hero.x) <= 40 && Math.abs(e.z - model.hero.z) <= 40) expect(around).toContain(e);
    expect(around.length).toBeLessThan(model.enemies.length);
  });

  it("a guard following their partner keeps with them, the save's and the seed's alike", () => {
    const model = new GameModel(3, { width: 256, depth: 256 });
    const follower = model.travellers.list.find((t) => t.leader !== null)!;
    const leader = model.travellers.list.find((t) => t.id === follower.leader)!;
    for (let i = 0; i < 60; i++) model.travellers.update(FRAME);
    expect(follower.road).toBe(leader.road);
    model.travellers.load(model.travellers.save());
    const again = model.travellers.list.find((t) => t.id === follower.id)!;
    for (let i = 0; i < 60; i++) model.travellers.update(FRAME);
    expect(again.road).toBe(model.travellers.list.find((t) => t.id === again.leader)!.road);
  });
});
