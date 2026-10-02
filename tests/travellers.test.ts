// Travellers on the roads (travellers/): who sets out, walking the roads and on at the villages, stopping for the hero;
// foes going after them, guards going after the foes; brought down and others setting out; a word with them.

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { generateWorld } from '../src/model/worldgen/world';
import { WORD_HOLD, WALK, onRoad, onRoadSide, roadsFrom, spawnTravellers, type Traveller } from '../src/model/travellers/travellers';
import { GUARD_LINES, PILGRIM_ROAD_LINES, bearing, cryptRumour, travellerInReach, travellerPrompt, travellerSays } from '../src/model/travellers/travellerTalk';
import { PEDLAR_TRINKETS, PEDLAR_WARES, buyFromPedlar, pedlarBuys, pedlarPrice, pedlarShopAt, sellToPedlar } from '../src/model/travellers/pedlarShop';
import { makeEnemy } from '../src/model/enemies/enemies';
import { ITEMS } from '../src/model/human/equipment';
import { parseSave, restore, snapshot } from '../src/model/save';
import { spawnOf } from '../src/model/map/grid';
import { nearestTraveller } from '../src/model/cheats';
import { FRAME } from './support/testWorld';
import type { Enemy } from '../src/model/types';

const MID = { width: 512, depth: 512 };
const models = new Map<number, GameModel>();
const worlds = new Map<number, ReturnType<typeof generateWorld>>(); // (made once a seed: making them is most of the time)
const fresh = (seed = 1) => new GameModel(seed, MID, worlds.get(seed) ?? worlds.set(seed, generateWorld(seed, MID)).get(seed)!);
const shared = (seed = 1) => models.get(seed) ?? models.set(seed, fresh(seed)).get(seed)!;
const far = (model: GameModel) => Object.assign(model.hero, { x: 3, z: 3 }); // (the hero well away from them all)
// A model with one traveller of `role` alone on the roads, the hero far off, no foes about.
function alone(role: Traveller['role'], seed = 1): { model: GameModel; t: Traveller } {
  const model = fresh(seed);
  const t = model.travellers.list.find((x) => x.role === role && x.leader === null)!;
  model.travellers.list.splice(0, model.travellers.list.length, ...model.travellers.list.filter((x) => x === t || (role === 'guard' && x.leader === t.id)));
  model.enemies.splice(0);
  far(model);
  return { model, t };
}
const step = (model: GameModel, seconds: number) => {
  for (let s = 0; s < seconds; s += FRAME) model.update(0, 0, FRAME);
};

describe('travellers setting out', () => {
  it('one or two parties to every road: a pedlar, a pilgrim, or two guards together', () => {
    const { travellers } = shared();
    const roads = travellers.roads;
    expect(roads.length).toBeGreaterThan(10);
    const leaders = travellers.list.filter((t) => t.leader === null);
    const byRoad = new Map<number, number>();
    for (const t of leaders) byRoad.set(t.road, (byRoad.get(t.road) ?? 0) + 1);
    for (let r = 0; r < roads.length; r++) expect([1, 2], `road ${r}`).toContain(byRoad.get(r));
    for (const g of travellers.list.filter((t) => t.leader !== null)) {
      const leader = travellers.list.find((t) => t.id === g.leader)!;
      expect([g.role, leader.role]).toEqual(['guard', 'guard']);
      expect(g.road).toBe(leader.road);
    }
    const roles = new Set(leaders.map((t) => t.role));
    expect([...roles].sort()).toEqual(['guard', 'pedlar', 'pilgrim']);
  });

  it('are the seed\'s: the same each time', () => {
    const a = shared().travellers;
    const again = spawnTravellers(1, a.roads, spawnOf(MID));
    expect(again.map((t) => [t.role, t.name, t.road, t.along])).toEqual(fresh().travellers.list.map((t) => [t.role, t.name, t.road, t.along]));
  });

  it('stand on their roads, each with a name, a look, and the gear of their kind', () => {
    for (const t of shared().travellers.list) {
      const at = onRoadSide(shared().travellers.roads[t.road], t.along, t.way);
      expect([t.x, t.z]).toEqual([at.x, at.z]);
      expect(t.name.length).toBeGreaterThan(1);
      if (t.role === 'pedlar') expect(t.equipment.mainHand).toBeUndefined(); // (unarmed)
      if (t.role === 'guard') expect(['armingSword', 'spear']).toContain(t.equipment.mainHand);
      for (const item of Object.values(t.equipment)) expect(ITEMS[item!].wornBy?.[t.role], `${t.role} in ${item}`).toBeGreaterThan(0);
    }
  });

  it('are of higher levels the further out from where the hero set out (a guard\'s blows the harder)', () => {
    const list = shared().travellers.list;
    const spawn = spawnOf(MID);
    const dist = (t: Traveller) => Math.hypot(t.x - spawn.x, t.z - spawn.z);
    const near = list.filter((t) => dist(t) < 80);
    const out = list.filter((t) => dist(t) > 200);
    const mean = (ts: Traveller[]) => ts.reduce((s, t) => s + t.level, 0) / ts.length;
    expect(mean(out)).toBeGreaterThan(mean(near));
    const guard = list.find((t) => t.role === 'guard')!;
    expect(guard.damage).toBeGreaterThanOrEqual(3); // (their blow, by their level)
  });
});

describe('travellers walking', () => {
  it('walk along their road at a steady pace', () => {
    const { model, t } = alone('pilgrim');
    t.along = 5;
    t.way = 1;
    step(model, 2);
    expect(t.along).toBeCloseTo(5 + WALK * 2, 0);
    const at = onRoadSide(model.travellers.roads[t.road], t.along, t.way);
    expect(Math.hypot(t.x - at.x, t.z - at.z)).toBeLessThan(1e-6);
    expect(t.y).toBeCloseTo(model.getGroundY(t.x, t.z));
  });

  it('at a village, go on along another of its roads (or back, if it has no other)', () => {
    const { model, t } = alone('pedlar');
    const roads = model.travellers.roads;
    const from = roadsFrom(roads, model.villages.length);
    const end = roads[t.road].route.length - 1;
    const [road, village] = [t.road, roads[t.road].to];
    Object.assign(t, { along: end - 0.05, way: 1 });
    step(model, 0.5);
    const there = from[village].map((r) => r.road);
    expect(there).toContain(t.road);
    if (there.length > 1) expect(t.road).not.toBe(road);
    const r = roads[t.road];
    expect(Math.max(Math.abs(t.x - model.villages[village].x), Math.abs(t.z - model.villages[village].z))).toBeLessThan(15); // (still by the village)
    expect(t.way).toBe(r.from === village ? 1 : -1); // (heading away from it)
  });

  it('a guard follows their partner a pace behind, along the same road', () => {
    const { model, t } = alone('guard');
    const partner = model.travellers.list.find((x) => x.leader === t.id)!;
    step(model, 3);
    expect(partner.road).toBe(t.road);
    expect(Math.abs(partner.along - (t.along - t.way * 1.2))).toBeLessThan(0.05);
  });

  it('walk on as the hero comes up to them; spoken to, stand a moment turned to them, then walk on', () => {
    const { model, t } = alone('pilgrim');
    Object.assign(model.hero, { x: t.x + 1, z: t.z });
    const along = t.along;
    step(model, 1);
    expect(t.along).not.toBe(along); // (no stopping for the hero)
    Object.assign(model.hero, { x: t.x + 1, z: t.z });
    model.travellers.hold(t, WORD_HOLD);
    const held = t.along;
    step(model, WORD_HOLD - 0.5);
    expect(t.along).toBe(held);
    expect(Math.abs(Math.atan2(Math.sin(t.facing - Math.PI / 2), Math.cos(t.facing - Math.PI / 2)))).toBeLessThan(0.1); // (facing +x: the hero)
    step(model, 1);
    expect(t.along).not.toBe(held); // (on again)
  });

  it('a guard spoken to stands with their partner', () => {
    const { model, t } = alone('guard');
    const partner = model.travellers.list.find((x) => x.leader === t.id)!;
    model.travellers.hold(t, WORD_HOLD);
    const [a, b] = [t.along, partner.along];
    step(model, 2);
    expect([t.along, partner.along]).toEqual([a, b]);
  });

  it('walk only while the hero\'s out in the world (indoors, the world stands still)', () => {
    const { model, t } = alone('pilgrim');
    model.teleport(model.villages[0].x + 0.5, model.villages[0].z + 0.5);
    far(model);
    Object.defineProperty(model, 'inside', { value: { entrance: {}, room: { width: 4, depth: 4 }, furniture: [], seated: null }, configurable: true });
    const along = t.along;
    try {
      model.update(0, 0, 1);
    } catch {
      // (a stand-in room: whatever it trips on, the world outside's left alone)
    }
    expect(t.along).toBe(along);
  });
});

describe('travellers passing each other', () => {
  it('keep to their right of the road\'s middle: those going the other way pass them by, side by side', () => {
    const road = shared().travellers.roads[0];
    const along = road.route.length / 2;
    const [there, back] = [onRoadSide(road, along, 1), onRoadSide(road, along, -1)];
    const middle = onRoad(road, along);
    expect(Math.hypot(there.x - middle.x, there.z - middle.z)).toBeCloseTo(0.22);
    expect(Math.hypot(there.x - back.x, there.z - back.z)).toBeGreaterThan(0.42); // (room to pass)
  });

  it('never walk into one another: one catching up a pace behind the one stopped, walking round them', () => {
    const { model, t } = alone('pilgrim');
    const ahead = { ...t, id: 9_999, name: 'Ahead', along: t.along + t.way * 0.6 };
    const at = onRoadSide(model.travellers.roads[t.road], ahead.along, t.way);
    Object.assign(ahead, { x: at.x, z: at.z });
    model.travellers.list.push(ahead);
    Object.assign(model.hero, { x: ahead.x + 1.2, z: ahead.z }); // (the hero by the one ahead: they stand, the other comes on)
    step(model, 1.2);
    expect(Math.hypot(t.x - ahead.x, t.z - ahead.z)).toBeGreaterThanOrEqual(0.3);
  });

  it('one set out right on top of another steps apart and walks round them: never stuck', () => {
    const { model, t } = alone('pilgrim');
    const along = t.along;
    const ahead = { ...t, id: 9_998, name: 'Blocking', along: t.along + t.way * 0.3 };
    Object.assign(ahead, onRoadSide(model.travellers.roads[t.road], ahead.along, t.way));
    model.travellers.list.push(ahead);
    const beyond = onRoadSide(model.travellers.roads[t.road], t.along + t.way * 1.8, t.way); // (by the one ahead, past the other's stopping range)
    Object.assign(model.hero, { x: beyond.x, z: beyond.z });
    step(model, 4);
    expect(t.along).not.toBe(along);
  });
});

describe('no procession behind one stopped for the hero', () => {
  it('ten coming up behind one the hero\'s talking to all walk round them and go on: none left queueing', () => {
    const { model, t } = alone('pilgrim');
    const road = model.travellers.roads[t.road];
    t.along = Math.min(road.route.length - 3, Math.max(25, t.along));
    t.way = 1;
    Object.assign(t, onRoadSide(road, t.along, 1));
    const hero = onRoadSide(road, t.along + 1, 1, -3); // (by them, off the road on the far side: they stop for a word)
    Object.assign(model.hero, { x: hero.x, z: hero.z });
    const behind = Array.from({ length: 10 }, (_, i) => {
      const o = { ...t, id: 8_000 + i, name: `Behind ${i}`, along: t.along - 2 - i * 2, lane: 1, waited: 0 };
      return Object.assign(o, onRoadSide(road, o.along, 1));
    });
    model.travellers.list.push(...behind);
    const start = t.along;
    for (let s = 0; s < 40; s += FRAME) {
      model.travellers.hold(t, 0.5); // (trading with the hero, all the while)
      model.update(0, 0, FRAME);
    }
    expect(t.along).toBe(start); // (still stood there)
    const past = behind.filter((o) => o.road !== t.road || o.along > start + 1);
    expect(past.length).toBe(behind.length); // (every one by them and on)
    for (const o of behind) expect(o.lane).toBeCloseTo(1); // (back on their own side, overtaken)
  });
});

describe('travellers never in each other', () => {
  it('a busy stretch of road, both ways, a minute by the hero: no two ever in each other', () => {
    const { model, t } = alone('pilgrim');
    const road = model.travellers.roads[t.road];
    const len = road.route.length - 1;
    t.along = Math.min(len - 2, Math.max(10, t.along));
    const crowd = Array.from({ length: 14 }, (_, i) => {
      const way = (i % 2 ? 1 : -1) as 1 | -1;
      const o = { ...t, id: 7_000 + i, name: `Crowd ${i}`, way, along: Math.max(0.5, Math.min(len - 0.5, t.along + (i - 7) * 0.9)), lane: 1, waited: 0 };
      return Object.assign(o, onRoadSide(road, o.along, way));
    });
    model.travellers.list.push(...crowd);
    const here = onRoadSide(road, t.along, 1, -4);
    Object.assign(model.hero, { x: here.x, z: here.z });
    let worst = Infinity;
    for (let s = 0; s < 60; s += FRAME) {
      model.update(0, 0, FRAME);
      if (s < 2) continue; // (a moment to step apart, set out on top of each other)
      const list = model.travellers.list.filter((o) => Math.abs(o.x - model.hero.x) < 20 && Math.abs(o.z - model.hero.z) < 20);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (a.leader === b.id || b.leader === a.id) continue;
        worst = Math.min(worst, Math.hypot(a.x - b.x, a.z - b.z));
      }
    }
    expect(worst).toBeGreaterThan(0.28); // (two bodies side by side, never through each other)
  });
});

describe('travellers and the foes of the wilds', () => {
  it('foes leave travellers be: a wolf beside a pilgrim minds its own, the pilgrim walking on', () => {
    const { model, t } = alone('pilgrim');
    const along = t.along;
    watching(model, t);
    const wolf = wolfBy(model, t);
    const [wx, wz] = [wolf.x, wolf.z];
    step(model, 3);
    expect(wolf.state).toBe('wander');
    expect(Math.hypot(wolf.x - t.x, wolf.z - t.z)).toBeGreaterThan(0.3); // (not on them)
    expect(t.along).not.toBe(along); // (walking on, unbothered)
    void [wx, wz];
  });

  const wolfBy = (model: GameModel, t: Traveller, dx = 1.5): Enemy => {
    const wolf = makeEnemy(5_000_000 + model.enemies.length, 'wolf', t.x + dx, t.z, t.x + dx, t.z, 1);
    model.enemies.push(wolf);
    return wolf;
  };
  // The hero close enough for the foes to wake (they only think near the hero), but not so close the travellers stop.
  const watching = (model: GameModel, t: Traveller) => Object.assign(model.hero, { x: t.x, z: t.z + 8 });

  it('guards go for a foe near them, strike it down (slain for good), and go back to their road', () => {
    const { model, t } = alone('guard');
    watching(model, t);
    const wolf = wolfBy(model, t, 2.5);
    wolf.hp = wolf.maxHp = 6;
    step(model, 12);
    expect(wolf.state).toBe('dead');
    expect(model.slain.has(wolf.id)).toBe(false); // (a stand-in foe, past the world's own ids: not the world's)
    step(model, 10);
    expect(t.off).toBeNull(); // back on the road
    const at = onRoadSide(model.travellers.roads[t.road], t.along, t.way);
    expect(Math.hypot(t.x - at.x, t.z - at.z)).toBeLessThan(0.15);
  });

  it('a foe of the world\'s own a guard slays stays slain (in the save too)', () => {
    const { model, t } = alone('guard');
    watching(model, t);
    const wolf = makeEnemy(7, 'wolf', t.x + 2, t.z, t.x + 2, t.z, 1); // (one of the world's ids)
    model.enemies.push(wolf);
    step(model, 15);
    expect(wolf.state).toBe('dead');
    expect(model.slain.has(7)).toBe(true);
  });

  it('a passive foe left be is let be: guards walk on past a boar minding its own', () => {
    const { model, t } = alone('guard');
    watching(model, t);
    const boar = makeEnemy(5_000_002, 'boar', t.x + 1.5, t.z, t.x + 1.5, t.z, 1);
    model.enemies.push(boar);
    step(model, 3);
    expect(boar.hp).toBe(boar.maxHp);
    expect(t.off).toBeNull();
  });

  it('far from the hero, the roads are quiet: no fights there', () => {
    const { model, t } = alone('guard');
    const wolf = wolfBy(model, t, 2);
    step(model, 5);
    expect(wolf.hp).toBe(wolf.maxHp);
    expect(t.off).toBeNull();
  });
});

describe('a word with a traveller', () => {
  it('the one near enough: "Trade with" a pedlar, "Talk to" the rest', () => {
    const { model, t } = alone('pedlar');
    expect(travellerInReach(model.travellers.list, { x: t.x + 5, z: t.z })).toBeNull();
    expect(travellerInReach(model.travellers.list, { x: t.x + 1, z: t.z })).toBe(t);
    expect(travellerPrompt(t)).toBe(`Trade with ${t.name}`);
    const pilgrim = shared().travellers.list.find((x) => x.role === 'pilgrim')!;
    expect(travellerPrompt(pilgrim)).toBe(`Talk to ${pilgrim.name}`);
  });

  it('a guard\'s lines in turn, every one, never twice running', () => {
    const guard = shared().travellers.list.find((x) => x.role === 'guard')!;
    const heard = Array.from({ length: GUARD_LINES.length * 2 }, () => travellerSays(guard, []));
    expect(new Set(heard).size).toBe(GUARD_LINES.length);
    expect(heard.every((line, i) => i === 0 || line !== heard[i - 1])).toBe(true);
  });

  it('a pilgrim tells of the nearest crypt (which way, its name, not its level), every other time; else a word of the road', () => {
    const model = shared();
    const pilgrim = model.travellers.list.find((x) => x.role === 'pilgrim')!;
    const nearest = [...model.crypts].sort((a, b) => Math.hypot(a.middle.x - pilgrim.x, a.middle.z - pilgrim.z) - Math.hypot(b.middle.x - pilgrim.x, b.middle.z - pilgrim.z))[0];
    const first = travellerSays(pilgrim, model.crypts);
    expect(first).toContain(nearest.name);
    expect(first).not.toMatch(/level/i); // (how deep it goes left for the hero to find)
    expect(first).toContain(bearing(pilgrim, nearest.middle));
    expect(PILGRIM_ROAD_LINES).toContain(travellerSays(pilgrim, model.crypts));
    expect(cryptRumour(pilgrim, [])).toBeNull();
  });

  it('tells the eight winds by the map (north up, east right)', () => {
    const o = { x: 100, z: 100 };
    expect(bearing(o, { x: 100, z: 40 })).toBe('north');
    expect(bearing(o, { x: 160, z: 100 })).toBe('east');
    expect(bearing(o, { x: 100, z: 160 })).toBe('south');
    expect(bearing(o, { x: 40, z: 100 })).toBe('west');
    expect(bearing(o, { x: 150, z: 50 })).toBe('north-east');
    expect(bearing(o, { x: 50, z: 150 })).toBe('south-west');
  });
});

describe('a pedlar\'s pack', () => {
  it('food for the road and every trinket marked for pedlars', () => {
    expect(PEDLAR_WARES).toEqual(expect.arrayContaining(['bread', 'apple', 'cheese', 'ale']));
    expect(PEDLAR_TRINKETS.length).toBeGreaterThan(3);
    for (const id of PEDLAR_TRINKETS) {
      expect(ITEMS[id].soldBy?.pedlar).toBeGreaterThan(0);
      expect(pedlarPrice(id, true)).toBeLessThan(pedlarPrice(id, false)); // (bought back for less)
    }
  });

  it('bought from: paid for, out of their pack, into the bag; sold to: trinkets and food, not a sword', () => {
    const { model, t } = alone('pedlar');
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    const [money, bread] = [1000, shop.stock.bread!];
    model.hero.money = money;
    expect(buyFromPedlar(shop, model.hero, 'bread')).toBe('bought');
    expect([model.hero.money, shop.stock.bread, model.hero.bag.bread]).toEqual([money - pedlarPrice('bread', false), bread - 1, 1]);
    model.hero.bag.copperRing = 1;
    expect(pedlarBuys('copperRing')).toBe(true);
    expect(sellToPedlar(shop, model.hero, 'copperRing')).toBe('sold');
    model.hero.bag.armingSword = 1;
    expect(pedlarBuys('armingSword')).toBe(false);
    expect(sellToPedlar(shop, model.hero, 'armingSword')).toBe('not wanted');
  });

  it('each their own pack, kept apart from the inns\' and the smiths\', and in the save', () => {
    const { model, t } = alone('pedlar');
    const shop = pedlarShopAt(model.shops, model.seed, t, 0);
    shop.money = 1234;
    expect(model.shops.get(model.entrances.indexOf(model.entrances[0]))).not.toBe(shop);
    const again = new GameModel(model.seed, MID);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(pedlarShopAt(again.shops, again.seed, t, 0).money).toBe(1234);
  });

  it('travellers are kept in the save: each where they were on their road, going their way, their level', () => {
    const model = fresh(2);
    far(model);
    step(model, 3);
    const again = new GameModel(2, MID);
    restore(again, parseSave(JSON.stringify(snapshot(model)), 2)!);
    const kept = (m: GameModel) => m.travellers.list.map((t) => [t.id, t.role, t.name, t.road, t.way, Math.round(t.along * 100) / 100, t.leader, t.level]);
    expect(kept(again)).toEqual(kept(model));
    for (const t of again.travellers.list) {
      const was = model.travellers.list.find((x) => x.id === t.id)!;
      expect(Math.hypot(t.x - was.x, t.z - was.z)).toBeLessThan(0.02); // (where they stood)
      expect(t.look).toEqual(was.look); // (the same faces, whatever road they're on now)
    }
  });

});

describe('the travel cheats', () => {
  it.each(['pedlar', 'pilgrim', 'guard'] as const)('the nearest %s: on their road a pace ahead, near enough for a word', (role) => {
    const model = fresh();
    const found = nearestTraveller(model, model.hero, role)!;
    expect(found.traveller.role).toBe(role);
    expect(found.traveller.leader).toBeNull(); // (a patrol by its leader)
    const nearer = model.travellers.list.filter((t) => t.role === role && t.leader === null && Math.hypot(t.x - model.hero.x, t.z - model.hero.z) < Math.hypot(found.traveller.x - model.hero.x, found.traveller.z - model.hero.z));
    expect(nearer).toEqual([]);
    model.teleport(found.at.x, found.at.z);
    const by = travellerInReach(model.travellers.list, model.hero);
    expect(by === found.traveller || by?.leader === found.traveller.id).toBe(true);
  });

  it('none of that kind about: none to travel to', () => {
    const model = fresh();
    model.travellers.list.splice(0);
    expect(nearestTraveller(model, model.hero, 'pedlar')).toBeNull();
  });
});

describe('travellers from an older save', () => {
  it('a save from before this way of keeping them (an older format, or none marked): not kept, they set out spread over the roads again', () => {
    const model = fresh(2);
    const old = model.travellers.save().on.map(([id, role, road, along, way, leader, level]) => [id, role, road, along, way, 8, leader, level]);
    const again = fresh(2);
    again.travellers.load({ on: old } as unknown as ReturnType<typeof model.travellers.save>);
    const bunched = model.travellers.save().on.map(([id, role, road, , way, leader, level]) => [id, role, road, 1, way, leader, level]); // (all piled at a road's start, saved before the version: no `v`)
    const third = fresh(2);
    third.travellers.load({ on: bunched } as unknown as ReturnType<typeof model.travellers.save>);
    expect(third.travellers.list.map((t) => [t.id, t.road, t.along])).toEqual(fresh(2).travellers.list.map((t) => [t.id, t.road, t.along]));
    expect(again.travellers.list.map((t) => [t.id, t.road, t.along])).toEqual(fresh(2).travellers.list.map((t) => [t.id, t.road, t.along]));
    expect(nearestTraveller(again, again.hero, 'pedlar')).not.toBeNull();
  });

  it('a partner that isn\'t a leading guard\'s is let go: on their own', () => {
    const model = fresh(2);
    const pedlar = model.travellers.list.find((t) => t.role === 'pedlar')!;
    const on = model.travellers.save().on.map((e) => (e[0] === pedlar.id ? [...e.slice(0, 5), 3, e[6]] : e)) as ReturnType<typeof model.travellers.save>['on'];
    const again = fresh(2);
    again.travellers.load({ v: model.travellers.save().v, on });
    expect(again.travellers.list.find((t) => t.id === pedlar.id)!.leader).toBeNull();
  });

  it('are spread over the roads: one or two parties a road, none piled up anywhere', () => {
    const list = fresh(1).travellers.list;
    for (const t of list) expect(list.filter((o) => Math.hypot(o.x - t.x, o.z - t.z) < 3).length).toBeLessThanOrEqual(6);
  });
});
