// Fishing (model/skills/fishing.ts): a rod in the bag, E on a lake's shore casts; a wait for a bite, a moment to hook
// it with E (too late: it gets away); landed into the bag (full: at the hero's feet), and cast again. What bites is by
// the water (a lake's narrows, its open water, the deep) and the skill; the skill rises with what's landed. The
// prompt by the water says what E would do, or why not.
import { describe, expect, it } from 'vitest';
import { CATCHES, weightOf, Fishing, catchesAt, isFish, pickCatch, riseOf, type FishingHost } from '../src/model/skills/fishing';
import { SKILLS, skillOf, stepsOf } from '../src/model/skills/skills';
import { freshHero } from '../src/model/hero/heroStats';
import { LOOT_IDS } from '../src/model/loot/loot';
import { nearestLakeShore } from '../src/model/cheats';
import { interactionOf } from '../src/model/hero/interaction';
import { fishPrompt } from '../src/controller/skills/fishPrompt';
import { pedlarShopAt, sellToPedlar } from '../src/model/travellers/pedlarShop';
import { herbalistBuys } from '../src/model/herbalist/herbalistShop';
import { sellValue } from '../src/model/shops/sellValue';
import { LOOT } from '../src/model/loot/loot';
import { FISH, HUGE } from '../src/model/skills/fishing';
import { NEIGHBORS_4 } from '../src/model/map/grid';
import type { GameEvent } from '../src/model/types';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS, mapsOf } from './support/testWorld';

// A lake drawn by hand: open water (x 0..20, z 0..20) round a rock of an island (15, 15), and a narrow arm three tiles
// wide (x 0..20, z 100..102); dry everywhere else.
const lake = (x: number, z: number) => x >= 0 && x <= 20 && ((z >= 0 && z <= 20 && !(x === 15 && z === 15)) || (z >= 100 && z <= 102));
const EAST = Math.PI / 2; // facing +x (atan2(1, 0))

// A host with the hero on the shore at (x, z), facing the water (a rod in the bag, unless told not), and what's told.
function onShore(at = { x: -1, z: 10 }, rod = true, rolls: () => number = () => 0.5) {
  const hero = Object.assign(freshHero(at), { facing: EAST });
  if (rod) hero.bag.fishingRod = 1;
  const events: GameEvent[] = [];
  const dropped: Array<{ item: string; x: number; z: number }> = [];
  const host: FishingHost & { inside: unknown; yard: unknown } = { hero, tiles: { lake }, inside: null, yard: null, dropLoot: (item, x, z) => dropped.push({ item, x, z }), report: (e) => events.push(e) };
  return { hero, host, events, dropped, fishing: new Fishing(host, rolls) };
}

// On `seconds`, standing still, a tenth at a time.
const run = (fishing: Fishing, seconds: number, moving = false) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) fishing.update(0.1, moving);
};
// Waited till the bite.
const toBite = (fishing: Fishing) => {
  for (let i = 0; i < 1000 && !fishing.biting; i++) fishing.update(0.1, false);
};

describe('the shore', () => {
  it('is a dry tile beside the water: the line goes out into it before them, as far as the cast reaches', () => {
    const { fishing } = onShore();
    expect(fishing.spotInReach).toMatchObject({ x: 2, z: 10, narrows: false, deep: true });
  });

  it('is not the water itself, nor ground away from it, nor anywhere indoors', () => {
    expect(onShore({ x: 3, z: 10 }).fishing.spotInReach).toBeNull(); // (in the water)
    expect(onShore({ x: -3, z: 10 }).fishing.spotInReach).toBeNull(); // (back from the bank)
    const { fishing, host } = onShore();
    host.inside = {};
    expect(fishing.spotInReach).toBeNull();
  });

  it('is cast from on the side the hero faces most, where there is water on more than one', () => {
    const { fishing, hero } = onShore({ x: 15, z: 15 }); // (on the island: water all round)
    hero.facing = EAST;
    expect(fishing.spotInReach).toMatchObject({ x: 18, z: 15 });
    hero.facing = 0; // (+z)
    expect(fishing.spotInReach).toMatchObject({ x: 15, z: 18 });
  });

  it("tells a lake's narrows from its open water, and the deep (no bank near the bobber)", () => {
    expect(onShore({ x: -1, z: 101 }).fishing.spotInReach).toMatchObject({ narrows: true, deep: false });
    expect(onShore({ x: -1, z: 10 }).fishing.spotInReach).toMatchObject({ narrows: false, deep: true });
  });
});

describe('a line', () => {
  it('wants a rod in the bag: without one, nothing to be done, and why', () => {
    const { fishing } = onShore(undefined, false);
    expect(fishing.action).toMatchObject({ kind: 'cannot', why: 'rod' });
    expect(fishing.use()).toBe(false);
    expect(fishing.line).toBeNull();
  });

  it('is cast with E, facing the water, waiting for a bite as long as their skill allows', () => {
    const { fishing, hero } = onShore();
    hero.facing = 0;
    expect(fishing.use()).toBe(true);
    expect(fishing.line).toMatchObject({ phase: 'waiting', spot: { x: 2, z: 10 } });
    expect(hero.facing).toBeCloseTo(EAST, 1);
    const [least, most] = fishing.waitSeconds;
    expect(fishing.line!.wait).toBeGreaterThanOrEqual(least);
    expect(fishing.line!.wait).toBeLessThanOrEqual(most);
  });

  it('bites after the wait: hooked with E, landed into the bag and told, then cast again', () => {
    const { fishing, hero, events } = onShore();
    fishing.use();
    toBite(fishing);
    expect(fishing.biting).toBe(true);
    expect(fishing.use()).toBe(true);
    expect(hero.bag.smallFry).toBe(1); // (all a beginner catches)
    expect(fishing.line?.phase).toBe('landed');
    expect(events.find((e) => e.kind === 'fished')).not.toHaveProperty('dropped'); // (none at their feet)
    run(fishing, 1);
    expect(fishing.line?.phase).toBe('waiting');
  });

  it('knows what bites as it bites, and lands that very catch', () => {
    const { fishing, hero } = onShore(undefined, true, () => 0.99);
    skillOf(hero, 'fishing').level = 150;
    fishing.use();
    toBite(fishing);
    expect(fishing.line).toMatchObject({ caught: 'pike', window: CATCHES.find((c) => c.item === 'pike')!.window });
    fishing.use();
    expect(hero.bag.pike).toBe(1);
  });

  it('now and then hooks a huge one: worth so many, off the hook quicker, told in gold', () => {
    const rolls = [0.5, 0.99, 0, 0.5]; // (the wait; a pike; huge; the skill's roll)
    const { fishing, hero, events } = onShore(undefined, true, () => rolls.shift() ?? 0.5);
    skillOf(hero, 'fishing').level = 150;
    fishing.use();
    toBite(fishing);
    expect(fishing.line).toMatchObject({ caught: 'pike', huge: true });
    expect(fishing.line!.window).toBeCloseTo(CATCHES.find((c) => c.item === 'pike')!.window - HUGE.quicker);
    fishing.use();
    expect(hero.bag.pike).toBe(HUGE.worth);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'fished', item: 'pike', huge: true }));
  });

  it('never hooks huge small fry', () => {
    const { fishing } = onShore(undefined, true, () => 0);
    fishing.use();
    toBite(fishing);
    expect(fishing.line).toMatchObject({ caught: 'smallFry', huge: false });
  });

  it('gets away if the bite is not hooked in time, told so, and the line is cast again', () => {
    const { fishing, hero, events } = onShore();
    fishing.use();
    toBite(fishing);
    run(fishing, fishing.line!.window! + 0.1);
    expect(hero.bag.smallFry).toBeUndefined();
    expect(events).toContainEqual(expect.objectContaining({ kind: 'fished', item: null }));
    expect(fishing.line?.phase).toBe('waiting');
  });

  it('is reeled in with E while waiting, and stopped by walking off or the rod gone', () => {
    const { fishing, hero } = onShore();
    fishing.use();
    fishing.use();
    expect(fishing.line).toBeNull();
    fishing.use();
    run(fishing, 0.1, true);
    expect(fishing.line).toBeNull();
    fishing.use();
    delete hero.bag.fishingRod;
    run(fishing, 0.1);
    expect(fishing.line).toBeNull();
  });

  it('lands the catch at their feet when the bag is full', () => {
    const { fishing, hero, dropped, events } = onShore();
    for (const id of LOOT_IDS.filter((id) => id !== 'smallFry' && id !== 'fishingRod').slice(0, 40)) hero.bag[id] = 1;
    fishing.use();
    toBite(fishing);
    fishing.use();
    expect(hero.bag.smallFry).toBeUndefined();
    expect(dropped).toEqual([{ item: 'smallFry', x: hero.x, z: hero.z }]);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'fished', item: 'smallFry', dropped: 1 }));
    run(fishing, 1); // (landed: then reeled in, told, not cast again to pile more on the shore)
    expect(fishing.line).toBeNull();
    expect(events).toContainEqual({ kind: 'poor', text: 'Your bag is full' });
    expect(fishing.use()).toBe(true); // (cast again by hand: on as before)
    expect(fishing.line?.phase).toBe('waiting');
  });

  it('tells how many of a huge one landed at their feet, the bag full', () => {
    const rolls = [0.5, 0.99, 0, 0.5];
    const { fishing, hero, dropped, events } = onShore({ x: -1, z: 10 }, true, () => rolls.shift() ?? 0.5);
    skillOf(hero, 'fishing').level = 150;
    for (const id of LOOT_IDS.filter((id) => id !== 'pike' && id !== 'fishingRod').slice(0, 40)) hero.bag[id] = 1;
    fishing.use();
    toBite(fishing);
    fishing.use();
    expect(dropped.map((d) => d.item)).toEqual(['pike', 'pike', 'pike']);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'fished', item: 'pike', huge: true, dropped: 3 }));
  });

  it('bites quicker each tier on', () => {
    const { fishing, hero } = onShore();
    const early = fishing.waitSeconds;
    skillOf(hero, 'fishing').level = 250;
    expect(fishing.waitSeconds[1]).toBeLessThan(early[1]);
  });
});

describe('what bites', () => {
  const OPEN = { narrows: false, deep: false };
  const NARROWS = { narrows: true, deep: false };
  const DEEP = { narrows: false, deep: true };
  const items = (spot: typeof OPEN, level: number) => catchesAt(spot, level).map((c) => c.item);

  it('is small fry anywhere, for a beginner', () => {
    for (const spot of [OPEN, NARROWS, DEEP]) expect(items(spot, 1)).toEqual(['smallFry']);
  });

  it('is roach anywhere from 40; trout in the narrows and perch in open water from 75', () => {
    expect(items(NARROWS, 39)).toEqual(['smallFry']);
    for (const spot of [OPEN, NARROWS, DEEP]) expect(items(spot, 40)).toEqual(['smallFry', 'roach']);
    expect(items(NARROWS, 75)).toEqual(['smallFry', 'roach', 'riverTrout']);
    expect(items(OPEN, 75)).toEqual(['smallFry', 'roach', 'lakePerch']);
  });

  it('is, from 55, a lucky trout or perch now and then (a seventh of the bites at most), orange to learn from', () => {
    const trout = CATCHES.find((c) => c.item === 'riverTrout')!;
    expect(items(NARROWS, 54)).toEqual(['smallFry', 'roach']);
    expect(items(NARROWS, 55)).toEqual(['smallFry', 'roach', 'riverTrout']);
    expect(weightOf(trout, 55) / catchesAt(NARROWS, 55).reduce((sum, c) => sum + weightOf(c, 55), 0)).toBeLessThanOrEqual(1 / 7);
    expect(riseOf(trout, 55).chance).toBe(1);
  });

  it('is bream in open water from 110 (and the deep), grayling in the narrows from 160, an orange or yellow fish in every water through the middle tiers', () => {
    expect(items(OPEN, 110)).toContain('bream');
    expect(items(DEEP, 110)).toContain('bream');
    expect(items(NARROWS, 110)).not.toContain('bream');
    expect(items(NARROWS, 160)).toContain('grayling');
    expect(items(OPEN, 160)).not.toContain('grayling');
    const yellow = (spot: typeof OPEN, level: number) => catchesAt(spot, level).some((c) => isFish(c.item) && riseOf(c, level).chance >= 0.6);
    for (let level = 75; level < 160; level++) for (const spot of [OPEN, NARROWS, DEEP]) expect(yellow(spot, level), `${level}`).toBe(true);
    for (let level = 160; level < 210; level++) expect(yellow(NARROWS, level), `${level}`).toBe(true);
  });

  it('is salmon in any water from 240: an orange or yellow fish for an artisan, whatever the lake', () => {
    for (const spot of [OPEN, NARROWS, DEEP]) expect(items(spot, 240)).toContain('salmon');
    const yellow = (spot: typeof OPEN, level: number) => catchesAt(spot, level).some((c) => isFish(c.item) && riseOf(c, level).chance >= 0.6);
    for (let level = 240; level < 290; level++) for (const spot of [OPEN, NARROWS, DEEP]) expect(yellow(spot, level), `${level}`).toBe(true);
  });

  it('is eels in the narrows from 110, char in open water from 180, sturgeon in the deep from 250', () => {
    expect(items(NARROWS, 110)).toContain('eel');
    expect(items(OPEN, 110)).not.toContain('eel');
    expect(items(OPEN, 180)).toContain('char');
    expect(items(NARROWS, 180)).not.toContain('char'); // (the deep's open water too, as the perch's)
    expect(items(DEEP, 250)).toContain('sturgeon');
    expect(items(NARROWS, 250)).not.toContain('sturgeon');
  });

  it('tells, in its unlocks, the level each catch wants, and its lucky one', () => {
    const at = SKILLS.fishing.unlocks.map((u) => u.at);
    for (const fish of CATCHES) expect(at).toContain(fish.needs);
    for (const fish of CATCHES) if (fish.early !== undefined) expect(at).toContain(fish.early);
  });

  it('has, in every water, a catch never grey: nowhere a fisher is left with nothing to learn', () => {
    for (const spot of [OPEN, NARROWS, DEEP]) {
      for (let level = 1; level <= 300; level++) expect(catchesAt(spot, level).some((c) => riseOf(c, level).chance > 0)).toBe(true);
    }
  });

  it('has, every 25 levels, a catch orange or yellow to learn from', () => {
    for (let level = 1; level < 300; level++) expect(CATCHES.some((c) => c.needs <= level && riseOf(c, level).chance >= 0.6)).toBe(true);
  });

  it('thins the small fry once trout and perch are theirs, and fills the deep with pike', () => {
    const [fry, pike] = [CATCHES.find((c) => c.item === 'smallFry')!, CATCHES.find((c) => c.item === 'pike')!];
    expect(weightOf(fry, 75)).toBeLessThan(weightOf(fry, 74));
    expect(weightOf(pike, 150)).toBeGreaterThan(weightOf(fry, 150));
  });

  it('gives each catch its own moment to hook it: the bigger, the quicker it is off', () => {
    const windowOf = (item: string) => CATCHES.find((c) => c.item === item)!.window;
    expect(windowOf('smallFry')).toBeGreaterThan(windowOf('riverTrout'));
    expect(windowOf('riverTrout')).toBeGreaterThan(windowOf('pike'));
    expect(windowOf('pike')).toBeGreaterThanOrEqual(0.7); // (still in reach of a quick hand)
  });

  it('is pike in the deep from 150, nowhere else', () => {
    expect(items(DEEP, 150)).toContain('pike');
    expect(items(DEEP, 149)).not.toContain('pike');
    expect(items(OPEN, 300)).not.toContain('pike');
  });

  it('is, from 225, now and then what the water hides (a torc in the deep only)', () => {
    expect(items(OPEN, 225)).toEqual(expect.arrayContaining(['fadedLocket', 'oldSilver']));
    expect(items(OPEN, 300)).not.toContain('frostTorc');
    expect(items(DEEP, 225)).toContain('frostTorc');
    expect(items(DEEP, 224)).not.toContain('fadedLocket');
  });

  it('is picked by the weights: every roll some catch that could bite there', () => {
    for (let r = 0; r < 1; r += 0.01) expect(items(DEEP, 300)).toContain(pickCatch(DEEP, 300, r).item);
    expect(pickCatch(DEEP, 300, 0).item).toBe('smallFry');
  });

  it('is all of it real loot', () => {
    for (const fish of CATCHES) expect(LOOT_IDS).toContain(fish.item);
  });
});

describe('the skill', () => {
  it('is practised by fishing (said how), and rises with what is landed', () => {
    expect(SKILLS.fishing.practice).toBeTruthy();
    const { fishing, hero, events } = onShore(undefined, true, () => 0); // (every roll the likeliest: orange always rises)
    const xp = hero.xp;
    skillOf(hero, 'fishing').toward = stepsOf('fishing', 1) - 1; // (a catch short of the next level)
    fishing.use();
    toBite(fishing);
    fishing.use();
    expect(skillOf(hero, 'fishing').level).toBe(2);
    expect(events).toContainEqual({ kind: 'skillUp', skill: 'Fishing', level: 2 });
    expect(hero.xp).toBeGreaterThan(xp);
  });

  it('learns nothing from small fry for a master, but a pike is never grey', () => {
    expect(riseOf(CATCHES.find((c) => c.item === 'smallFry')!, 300).chance).toBe(0);
    expect(riseOf(CATCHES.find((c) => c.item === 'pike')!, 300).chance).toBeGreaterThan(0);
  });
});

describe('in the game', () => {
  // A world with a lake, the hero on its nearest shore facing the water.
  function atALake() {
    const seed = TEST_SEEDS.find((s) => mapsOf(new GameModel(s, TEST_MAP_SIZE)).lakeMap.flat().some(Boolean))!;
    const model = new GameModel(seed, TEST_MAP_SIZE);
    const shore = nearestLakeShore(model, model.hero)!;
    const [dx, dz] = NEIGHBORS_4.find(([dx, dz]) => model.tiles.lake(shore.x + dx, shore.z + dz))!;
    Object.assign(model.hero, { x: shore.x, z: shore.z, facing: Math.atan2(dx, dz) });
    return model;
  }

  it('offers to fish on a shore with a rod, and says why not without one', () => {
    const model = atALake();
    if (interactionOf(model)?.kind !== 'cannotFish') return; // (something else in reach first, at this shore: nothing to tell)
    expect(fishPrompt(model)).toMatchObject({ label: 'Needs a fishing rod', muted: true });
    model.hero.bag.fishingRod = 1;
    expect(interactionOf(model)?.kind).toBe('fish');
    expect(fishPrompt(model)?.label).toBe('Fish');
    skillOf(model.hero, 'fishing').level = 299;
    if (catchesAt(model.fishing.action!.spot, 299).every((c) => !isFish(c.item) || riseOf(c, 299).chance === 0)) expect(fishPrompt(model)?.label).toBe('Fish · teaches you nothing now');
    else expect(fishPrompt(model)?.label).toBe('Fish'); // (a lasting fish here: always something to learn)
  });

  it('runs a line through the model: a bite, hooked, landed; walking off stops it', () => {
    const model = atALake();
    model.hero.bag.fishingRod = 1;
    expect(model.fishing.use()).toBe(true);
    expect(interactionOf(model)?.kind).toBe('fishing');
    expect(fishPrompt(model)?.label).toBe('Reel in');
    for (let i = 0; i < 300 && !model.fishing.biting; i++) model.update(0, 0, 0.1);
    expect(fishPrompt(model)?.label).toBe('Bite! Hook it');
    model.fishing.use();
    expect(model.hero.bag.smallFry ?? 0).toBeGreaterThan(0);
    expect(model.takeEvents()).toContainEqual(expect.objectContaining({ kind: 'fished', item: 'smallFry' }));
    model.update(1, 0, 0.1);
    expect(model.fishing.line).toBeNull();
  });

  it('stops a making under way when cast, and is reeled in when one is begun', () => {
    const model = atALake();
    model.hero.bag.fishingRod = 1;
    model.hero.bag.birchLog = 5;
    expect(model.woodworking.start('birchPlank', 5)).toBe(true);
    expect(model.fishing.use()).toBe(true);
    model.update(0, 0, 0.1);
    expect([!!model.woodworking.making, !!model.fishing.line]).toEqual([false, true]);
    expect(model.woodworking.start('birchPlank', 5)).toBe(true);
    model.update(0, 0, 0.1);
    expect([!!model.woodworking.making, !!model.fishing.line]).toEqual([true, false]);
  });

  it('stops the cooking when cast, and is reeled in when cooking is begun, by a campfire on the shore', () => {
    const model = atALake();
    Object.assign(model.hero.bag, { fishingRod: 1, birchLog: 2, smallFry: 10 });
    expect(model.cooking.kindle()).toBe(true);
    expect(model.cooking.start('roastedFry', 5)).toBe(true);
    expect(model.fishing.use()).toBe(true);
    model.update(0, 0, 0.1);
    expect([!!model.cooking.making, !!model.fishing.line]).toEqual([false, true]);
    expect(model.cooking.start('roastedFry', 5)).toBe(true);
    model.update(0, 0, 0.1);
    expect([!!model.cooking.making, !!model.fishing.line]).toEqual([true, false]);
  });

  it('is sold at its worth, to a pedlar or a herbalist, the bag saying so', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const shop = pedlarShopAt(new Map(), model.seed, { id: 1 });
    for (const fish of FISH) {
      expect(sellValue(fish)).toBe(LOOT[fish].value);
      expect(herbalistBuys(fish)).toBe(true);
      model.hero.bag[fish] = 1;
      const money = model.hero.money;
      expect(sellToPedlar(shop, model.hero, fish)).toBe('sold');
      expect(model.hero.money - money).toBe(LOOT[fish].value);
    }
  });

  it('can be had from any pedlar: a rod in every pack', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    for (const id of [1, 2, 3]) expect(pedlarShopAt(new Map(), model.seed, { id }).stock.fishingRod).toBe(1);
  });
});
