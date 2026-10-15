// The reliquary under the cathedral (model/reliquary/): its hand-shaped plan, every floor tile reached from the stair
// and every post on open floor; gone down into from its door (barred while the story says so); its dead at their
// posts, its saints still till the hero comes near, its Brothers' prayers mending the dead round them; the Gilded
// Deacon formed as the hero comes into his sanctum, his fight turning three times (a reliquary off him at each, told;
// the first, its dead got up; his moves his as he's broken); slain, the reliquary cleared, a point, his chest, the way
// out; and all of it kept through a save.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import type { Entrance } from '../src/model/interiors/interiors';
import { MAP, PLACES, reliquaryPlan } from '../src/model/reliquary/reliquaryPlan';
import { reliquaryProps, solidTiles, wayOut } from '../src/model/reliquary/reliquaryProps';
import { RELIQUARY_LEVEL, RELIQUARY_NAME, registerReliquary, reliquaryInside } from '../src/model/reliquary/reliquary';
import { DEACON, RELIQUARY_FOE_ID, ReliquaryRun, deaconSpot, reliquaryPosts } from '../src/model/reliquary/reliquaryFoes';
import { DEACON_CALLS, DEACON_TURNS, PRAYER_TELL } from '../src/model/reliquary/reliquaryMoves';
import { inFullView, isFloor } from '../src/model/dungeons/floorPlan';
import { BOSS_POST, CHEST_POST } from '../src/model/dungeons/dungeonRecord';
import { strike } from '../src/model/hero/fighting';
import { phaseFloor } from '../src/model/enemies/bossPhases';
import { parseSave, restore, snapshot } from '../src/model/save';
import { cellKey, flood } from '../src/model/map/grid';
import { FRAME, fresh } from './support/testWorld';
import type { GameEvent } from '../src/model/types';

// A world with the reliquary's door right before the hero (as the cathedral town would place it).
const withReliquary = (barred?: () => { title: string; line: string } | null) => {
  const model = fresh();
  const entrance: Entrance = { type: 'reliquary', x: model.hero.x, z: model.hero.z + 0.3, outX: 0, outZ: 1 };
  registerReliquary(entrance, { x: 40, z: 41 }, { barred });
  model.entrances.push(entrance);
  return { model, entrance };
};
const goDown = (barred?: () => { title: string; line: string } | null) => {
  const { model, entrance } = withReliquary(barred);
  model.teleport(entrance.x, entrance.z);
  expect(model.useDoor()).toBe(true);
  return { model, entrance, run: model.dungeon as ReliquaryRun };
};
const banners = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'banner' ? [e.title] : []));
// The hero stood at (x, z) down there, a frame run.
const standAt = (model: GameModel, x: number, z: number) => {
  Object.assign(model.hero, { x, z });
  model.update(0, 0, FRAME);
};

describe("the reliquary's plan", () => {
  const plan = reliquaryPlan();
  const props = reliquaryProps();
  const solid = solidTiles(props);

  it('is the map, every row as wide, the stair at its foot', () => {
    expect(new Set(MAP.map((row) => row.length)).size).toBe(1);
    expect([plan.width, plan.depth]).toEqual([MAP[0].length, MAP.length]);
    expect(isFloor(plan, plan.door, plan.depth - 1) && isFloor(plan, plan.door + 1, plan.depth - 1)).toBe(true);
  });

  it('has every floor tile not under something solid reached from the stair, and every place on the way', () => {
    const open = (x: number, z: number) => isFloor(plan, x, z) && !solid.has(cellKey(x, z));
    const reached = flood([[plan.door, plan.depth - 1]], open);
    for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (open(x, z)) expect(reached.has(cellKey(x, z)), `${x},${z}`).toBe(true);
    for (const [name, r] of Object.entries(PLACES)) expect(reached.has(cellKey(Math.round((r.x0 + r.x1) / 2), Math.round((r.z0 + r.z1) / 2))) || solid.has(cellKey(Math.round((r.x0 + r.x1) / 2), Math.round((r.z0 + r.z1) / 2))), name).toBe(true);
  });

  it('has its dead posted on open floor, none in the sanctum (his alone) nor near the stair; four saints in the gallery', () => {
    const posts = reliquaryPosts({ plan });
    expect(posts.length).toBeGreaterThanOrEqual(20);
    for (const p of posts) {
      expect(isFloor(plan, p.x, p.z) && !solid.has(cellKey(p.x, p.z)), `${p.x},${p.z}`).toBe(true);
      expect(Math.hypot(p.x - plan.door, p.z - plan.depth)).toBeGreaterThan(7);
      const s = PLACES.sanctum;
      expect(p.x >= s.x0 && p.x <= s.x1 && p.z >= s.z0 && p.z <= s.z1).toBe(false);
    }
    const g = PLACES.gallery;
    expect(posts.filter((p) => p.kind === 'gildedSaint' && p.x >= g.x0 && p.x <= g.x1 && p.z >= g.z0 && p.z <= g.z1)).toHaveLength(4);
    expect(new Set(posts.map((p) => p.kind))).toEqual(new Set(['skeleton', 'skeletonArcher', 'unquietBrother', 'gildedSaint']));
  });

  it('has its way out and the old door in the rock, in full view, the floor before the way out open; a niche behind every Brother', () => {
    const way = wayOut(plan);
    for (const x of [Math.floor(way.door.x), Math.ceil(way.door.x)]) expect([isFloor(plan, x, way.door.z), inFullView(plan, x, way.door.z), isFloor(plan, x, way.spot.z)]).toEqual([false, true, true]);
    const old = props.find((p) => p.kind === 'oldDoor')!;
    expect([isFloor(plan, old.x, old.z), inFullView(plan, old.x, old.z), isFloor(plan, old.x, old.z + 1)]).toEqual([false, true, true]);
    for (const b of reliquaryPosts({ plan }).filter((p) => p.kind === 'unquietBrother')) expect(props.some((p) => (p.kind === 'niche' && Math.abs(p.x - b.x) + Math.abs(p.z - b.z) === 1) || (p.kind === 'oldDoor' && b.x >= p.x && b.x < p.x + p.w && b.z === p.z + 1)), `${b.x},${b.z}`).toBe(true); // (the one by the old door, praying to it)
  });
});

describe('down into the reliquary', () => {
  it('barred while the story says so: told why at its door, not gone down', () => {
    let open = false;
    const { model, entrance } = withReliquary(() => (open ? null : { title: 'The ossuary door is barred', line: 'Brother Anselm keeps the key' }));
    model.teleport(entrance.x, entrance.z);
    model.takeEvents();
    expect(model.useDoor()).toBe(false);
    expect(model.inside).toBeNull();
    expect(banners(model.takeEvents())).toEqual(['The ossuary door is barred']);
    open = true;
    expect(model.useDoor()).toBe(true);
    expect(model.dungeon).toBeInstanceOf(ReliquaryRun);
  });

  it("barred while the story's saint is shut away: the story's line at its door (open where there's no such story)", () => {
    const { model, entrance } = withReliquary();
    model.teleport(entrance.x, entrance.z);
    const story = model.story as unknown as { saint?: { open: boolean } };
    story.saint = { open: false };
    model.takeEvents();
    expect(model.useDoor()).toBe(false);
    expect(model.takeEvents()).toContainEqual({ kind: 'banner', title: 'The ossuary door is barred', line: 'Sister Agnes keeps the key.' });
    story.saint.open = true;
    expect(model.useDoor()).toBe(true);
  });

  it("gone down by a stair inside a building (the Minster's), and back up it into the room, by the stair", () => {
    const model = fresh();
    const room = model.entrances.find((e) => e.type === 'inn')!; // (a room stood in for the Minster's)
    const down: Entrance = { type: 'reliquary', x: room.x, z: room.z, outX: room.outX, outZ: room.outZ };
    registerReliquary(down, { x: 7, z: 7 }, { stair: { of: room, x: 0.5, z: 0.5 } });
    model.teleport(room.x, room.z);
    model.useDoor();
    expect(model.inside?.entrance).toBe(room);
    Object.assign(model.hero, { x: 0.6, z: 1.9 });
    expect(model.doorInReach).toBe(down);
    expect(model.useDoor()).toBe(true);
    expect(model.dungeon).toBeInstanceOf(ReliquaryRun);
    Object.assign(model.hero, { x: model.inside!.room.door, z: model.inside!.room.depth - 1 });
    expect(model.doorInReach).toBe(down);
    expect(model.useDoor()).toBe(true);
    expect([model.inside?.entrance, model.dungeon]).toEqual([room, null]);
    expect(Math.hypot(model.hero.x - 0.5, model.hero.z - 0.5)).toBeLessThan(1.6);
  });

  it('has its dead at their posts, of its level; the arrival told; each place told by name coming into it', () => {
    const { model, run } = goDown();
    expect(model.takeEvents()).toContainEqual({ kind: 'arrive', name: RELIQUARY_NAME, level: RELIQUARY_LEVEL });
    expect(model.foes).toHaveLength(reliquaryPosts(reliquaryInside(model.inside!.entrance)).length);
    expect(model.foes.every((f) => f.level === RELIQUARY_LEVEL && f.id >= RELIQUARY_FOE_ID)).toBe(true);
    const n = PLACES.nave;
    standAt(model, (n.x0 + n.x1) / 2, n.z1);
    expect(banners(model.takeEvents())).toContain('The bone nave');
    standAt(model, (n.x0 + n.x1) / 2, n.z1 - 1);
    expect(banners(model.takeEvents())).not.toContain('The bone nave'); // (once)
    expect(run.deacon).toBeNull();
  });

  it("wakes a saint only as the hero comes near it (or strikes it)", () => {
    const { model } = goDown();
    const saint = model.foes.find((f) => f.kind === 'gildedSaint')!;
    for (const f of model.foes) if (f !== saint) Object.assign(f, { state: 'dead', x: -50 }); // (out of the way)
    standAt(model, saint.x + 4, saint.z);
    expect(saint.state).toBe('wander');
    standAt(model, saint.x + 2, saint.z);
    expect(saint.state).toBe('chase');
    expect(banners(model.takeEvents())).toContain('A saint gets up');
  });

  it("a Brother's prayer mends the dead round him; struck while he prays, it's lost", () => {
    const { model, run } = goDown();
    const brother = model.foes.find((f) => f.kind === 'unquietBrother')!;
    const skeleton = { ...model.foes.find((f) => f.kind === 'skeleton')!, x: brother.x + 1, z: brother.z, hp: 1, id: 999 };
    model.foes.push(skeleton);
    const pray = () => {
      Object.assign(brother, { state: 'chase', hurtFor: 0 });
      Object.assign(model.hero, { x: brother.x + 3, z: brother.z });
      for (let t = 0; !run.prayers.doing(brother) && t < 10; t += FRAME) run.update(FRAME);
      expect(run.prayers.doing(brother)).toBe(true);
    };
    pray();
    for (let s = 0; s < PRAYER_TELL + 0.1; s += FRAME) run.update(FRAME);
    expect(skeleton.hp).toBeGreaterThan(1);
    skeleton.hp = 1;
    pray();
    strike(model, brother, 1, false); // (his prayer broken)
    for (let s = 0; s < PRAYER_TELL + 0.1; s += FRAME) run.update(FRAME);
    expect(skeleton.hp).toBe(1);
  });
});

describe('the Gilded Deacon', () => {
  const intoSanctum = () => {
    const down = goDown();
    const { model } = down;
    for (const f of model.foes) Object.assign(f, { state: 'dead', x: -50 });
    model.foes.length = 0;
    const s = PLACES.sanctum;
    standAt(model, (s.x0 + s.x1) / 2, s.z1);
    return down;
  };

  it('forms out of his shrine as the hero comes into his sanctum, two levels over the reliquary, and is on them', () => {
    const { model, run } = intoSanctum();
    const events = model.takeEvents();
    expect(events).toContainEqual({ kind: 'rises', name: DEACON });
    expect(banners(events)).toContain("The Deacon's sanctum");
    const deacon = run.deacon!;
    expect([deacon.kind, deacon.level, deacon.state, deacon.id]).toEqual(['gildedDeacon', RELIQUARY_LEVEL + 2, 'chase', RELIQUARY_FOE_ID + BOSS_POST]);
    const spot = deaconSpot(reliquaryInside(model.inside!.entrance));
    expect(Math.hypot(deacon.x - spot.x, deacon.z - spot.z)).toBeLessThan(0.1); // (a step on already)
  });

  it('turns three times, held at each: a reliquary off him, told; the casket\'s dead got up; his moves his as he breaks; his rage at the last', () => {
    const { model, run } = intoSanctum();
    const deacon = run.deacon!;
    model.takeEvents();
    const turns = DEACON_TURNS.map((share) => Math.floor(deacon.maxHp * share));
    const told: string[] = [];
    for (let k = 0; k < 3; k++) {
      strike(model, deacon, deacon.maxHp * 2, false);
      expect(deacon.hp).toBe(turns[k]);
      expect(phaseFloor(deacon)).toBe(k < 2 ? turns[k + 1] : -Infinity);
      Object.assign(model.hero, { x: deacon.x + 6, z: deacon.z + 3 });
      run.update(FRAME);
      expect(run.brokenOff).toBe(k + 1);
      told.push(...banners(model.takeEvents()));
      if (k === 0) expect(model.foes.filter((f) => f.kind === 'skeleton' && f.state === 'chase')).toHaveLength(DEACON_CALLS);
    }
    expect(told).toEqual(['The bone casket breaks off his back', "The saint's arm breaks away", 'The finger falls from its monstrance']);
    deacon.cooldown = 2;
    run.update(FRAME);
    expect(deacon.cooldown).toBeLessThan(0.5);
    strike(model, deacon, deacon.maxHp, false);
    expect(deacon.state).toBe('dead');
  });

  it('only slams while whole; sweeps and charges once the casket is off; his souls once the arm is', () => {
    const { model, run } = intoSanctum();
    const deacon = run.deacon!;
    const did = new Set<string>();
    const fight = (seconds: number) => {
      for (let t = 0; t < seconds; t += FRAME) {
        Object.assign(model.hero, { x: deacon.x < 16.5 ? deacon.x + 4 : deacon.x - 4, z: Math.min(11, deacon.z + 1), hp: 9999 }); // (a few tiles off him, in the sanctum)
        deacon.hp = Math.max(deacon.hp, 1);
        model.update(0, 0, FRAME);
        if (deacon.told) did.add(deacon.told);
      }
    };
    fight(20);
    expect([...did].filter((m) => m !== 'slam')).toEqual([]);
    deacon.hp = Math.floor(deacon.maxHp * 0.45);
    fight(30);
    expect(did.has('charge') || did.has('barrage')).toBe(true);
    expect(did.has('eruption')).toBe(false);
  });

  it('slain: the reliquary cleared, a point, the way out open behind the shrine, his chest before it; kept through a save', () => {
    const { model, run, entrance } = intoSanctum();
    const deacon = run.deacon!;
    model.takeEvents();
    deacon.phases = [];
    for (let k = 0; k < 4 && deacon.state !== 'dead'; k++) [strike(model, deacon, deacon.maxHp * 2, false), run.update(FRAME)];
    expect(deacon.state).toBe('dead');
    // (all the rest slain for the cleared share: theirs, by post)
    for (let post = 0; post < reliquaryPosts(reliquaryInside(entrance)).length; post++) model.cleared(reliquaryInside(entrance).place.key).add(post);
    model.update(0, 0, FRAME);
    expect(run.exitOpen).toEqual(wayOut(reliquaryPlan()).spot);
    expect(run.chest).toMatchObject({ ...deaconSpot(reliquaryInside(entrance)), open: false });
    Object.assign(model.hero, { x: run.chest!.x, z: run.chest!.z + 0.6 });
    expect(run.chestInReach(model.hero)).toBe(true);
    run.openChest();
    const key = reliquaryInside(entrance).place.key;
    expect([model.cleared(key).has(BOSS_POST), model.cleared(key).has(CHEST_POST)]).toEqual([true, true]);
    const other = fresh();
    other.entrances.push(entrance);
    restore(other, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect([other.cleared(key).has(BOSS_POST), other.cleared(key).has(CHEST_POST)]).toEqual([true, true]);
    expect(other.clearedShare(entrance)).toBe(1);
  });
});
