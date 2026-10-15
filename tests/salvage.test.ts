// @vitest-environment happy-dom
// Salvaging (model/skills/salvage.ts): gear broken down at a smithy's salvage bench (smithy/smithyLayout.ts) into
// what it's made of, more of it the better the piece and something finer from a rare one, each asking a level of the
// skill; the bench in every smithy, out on the floor, reached from the tile before it; the window (controller/skills/
// salvagePanel.ts) listing the gear carried with the button to break it down.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { TEST_SEEDS, TEST_MAP_SIZE } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { restore, snapshot } from '../src/model/save';
import { betterThanWorn, foundAt, gearKey, gearPower, type Rarity } from '../src/model/human/items/gear';
import { gearSellPrice } from '../src/model/smithy/smithShop';
import { BREAK_SECONDS, FINER_AT, SCRAP_MOST, FOUND_TRIES, PER_LEVEL, TOO_HARD, isSalvageable, makeOf, salvageOf, teachChance } from '../src/model/skills/salvage';
import { RECIPES, RECIPE_IDS } from '../src/model/skills/woodworking';
import { castOf } from '../src/controller/skills/castOf';
import { LOOT } from '../src/model/loot/loot';
import { ITEMS } from '../src/model/human/equipment';
import { bagRoom, canCarry } from '../src/model/hero/bagSlots';
import { slotsUsed } from '../src/model/hero/bagStacks';
import { MATERIAL_RISE, SKILL_TIERS, difficulty, skillOf, stepsOf } from '../src/model/skills/skills';
import { createSalvagePanel } from '../src/controller/skills/salvagePanel';

const RARITY_ODDS: Record<Rarity, number> = { common: 0.6, uncommon: 0.26, rare: 0.1, epic: 0.035, legendary: 0.005 }; // (gear.ts rollRarity's)

describe('what gear is made of, and leaves', () => {
  it('knows iron from leather, cloth, silver and wood', () => {
    expect(['armingSword', 'chainMail', 'greatHelm', 'gauntlets'].map((id) => makeOf(id as never))).toEqual(['iron', 'iron', 'iron', 'iron']);
    expect(['leatherCap', 'studdedJerkin', 'furBoots', 'leatherBracers'].map((id) => makeOf(id as never))).toEqual(['leather', 'leather', 'leather', 'leather']);
    expect(['linenShirt', 'gambeson', 'woolHose', 'silkGloves'].map((id) => makeOf(id as never))).toEqual(['cloth', 'cloth', 'cloth', 'cloth']);
    expect(['rubyRing', 'silverLocket', 'copperRing'].map((id) => makeOf(id as never))).toEqual(['silver', 'silver', 'silver']);
    expect(['quarterstaff', 'club', 'plankShield'].map((id) => makeOf(id as never))).toEqual(['wood', 'wood', 'wood']);
  });

  it('leaves one scrap, one more every six levels, a gem shard off a stone, and a finer thing from a rare piece (from the skill its rarity wants); asks a level by its own and its rarity', () => {
    expect(salvageOf('armingSword', 1)).toEqual({ make: 'iron', needs: 1, gives: [['ironScrap', 1]], tries: FOUND_TRIES.common });
    expect(salvageOf(gearKey({ item: 'armingSword', level: 13, rarity: 'rare', roll: 2 }), 1)).toEqual({ make: 'iron', needs: 12 * PER_LEVEL + 50, gives: [['ironScrap', 3]], finerAt: FINER_AT.rare, tries: FOUND_TRIES.rare }); // (too green a hand: its scrap alone)
    expect(salvageOf(gearKey({ item: 'armingSword', level: 13, rarity: 'rare', roll: 2 }), FINER_AT.rare).gives.map(([item]) => item)).toContain('temperedIngot');
    expect(salvageOf(gearKey({ item: 'rubyRing', level: 7, rarity: 'epic', roll: 1 }), 1)).toEqual({ make: 'silver', needs: 6 * PER_LEVEL + 100, gives: [['silverFilings', 2], ['gemShard', 1]], finerAt: FINER_AT.epic, tries: FOUND_TRIES.epic });
    expect(salvageOf(gearKey({ item: 'rubyRing', level: 7, rarity: 'epic', roll: 1 }), FINER_AT.epic).gives).toContainEqual(['cutGem', 2]); // (two from an epic)
    expect(salvageOf('quarterstaff', 1).gives).toEqual([['birchPlank', 1]]); // (a wooden piece: the plank of its level's wood)
    expect(salvageOf(gearKey({ item: 'club', level: 9, rarity: 'common', roll: 0 }), 1).gives).toEqual([['pinePlank', 2]]); // (a drop's: not as a recipe makes it)
    expect(salvageOf(gearKey({ item: 'plankShield', level: 17, rarity: 'common', roll: 0 }), 1).gives).toEqual([['oakPlank', 3]]);
  });

  it("leaves a skilled hand more of its scrap, a master's near what the piece fetches whole, never as much; their own make, no more", () => {
    const worth = (gives: Array<[string, number]>) => gives.reduce((c, [item, n]) => c + n * LOOT[item as keyof typeof LOOT].value, 0);
    const sword = gearKey({ item: 'armingSword', level: 13, rarity: 'common', roll: 0 });
    const got = [1, 100, 200, 300].map((skill) => worth(salvageOf(sword, skill).gives));
    expect(salvageOf(sword, 1).gives).toEqual([['ironScrap', 3]]);
    for (let i = 1; i < got.length; i++) expect(got[i]).toBeGreaterThan(got[i - 1]); // (more at each)
    expect(salvageOf(sword, 300).gives).toEqual([['ironScrap', 3 * SCRAP_MOST], ['gemShard', 6]]); // (its scrap four times over, the rest in stones: 168c of 210c sold whole)
    // Never more of the finer things than a rare piece's own (a tempered ingot's a steel ingot at the forge: no mint of them).
    for (const [item, level, rarity] of [['chainMail', 20, 'rare'], ['greatHelm', 28, 'rare'], ['armingSword', 15, 'uncommon'], ['shortSword', 8, 'common']] as const)
      for (const skill of [100, 200, 300]) {
        const finer = salvageOf(gearKey({ item, level, rarity, roll: 0 }), skill).gives.filter(([it]) => it === 'temperedIngot' || it === 'cutGem');
        expect(finer.reduce((n, [, k]) => n + k, 0), `${item} ${rarity} @${skill}`).toBeLessThanOrEqual(rarity === 'rare' ? 1 : 0);
      }
    const ring = gearKey({ item: 'rubyRing', level: 7, rarity: 'common', roll: 1 });
    expect(salvageOf(ring, 300).gives).toEqual(salvageOf(ring, 1).gives); // (its silver and stone worth more than it sells for already: no more)
    // A bag of what's found, levels 1 to 20, as its rarities fall: a master's broken down near it sold whole, under.
    let [sold, master, green] = [0, 0, 0];
    for (let level = 1; level <= 20; level++)
      for (const item of Object.keys(ITEMS) as Array<keyof typeof ITEMS>) {
        if (!foundAt(item, level)) continue;
        for (const [rarity, odds] of Object.entries(RARITY_ODDS) as Array<[Rarity, number]>) {
          const key = gearKey({ item, level, rarity, roll: 0 });
          const gives = salvageOf(key, 300).gives;
          const finer = worth(gives.filter(([item]) => item === 'temperedIngot' || item === 'cutGem'));
          expect(worth(gives), key).toBeLessThan(Math.max(gearSellPrice(key), worth(salvageOf(key, 1).gives) + finer + 1)); // (each piece: under it whole, or its scrap no more than a green hand's)
          [sold, master, green] = [sold + odds * gearSellPrice(key), master + odds * worth(salvageOf(key, 300).gives), green + odds * worth(salvageOf(key, 1).gives)];
        }
      }
    expect(green / sold).toBeLessThan(0.12);
    expect(master / sold).toBeGreaterThan(0.7);
    expect(master / sold).toBeLessThan(0.9);
    // Their own make: as a green hand's (no ladder).
    const warClub = gearKey({ item: 'club', level: 24, rarity: 'uncommon', roll: 7 });
    expect(salvageOf(warClub, 300, true).gives).toEqual(salvageOf(warClub, 1, true).gives);
  });

  it("falls in its tiers on the gear a hero meets: levels 1 to 7 an apprentice's, 8 to 13 a journeyman's, 14 to 19 an expert's, 20 on an artisan's", () => {
    const tierAt = (level: number) => SKILL_TIERS.findIndex((t) => salvageOf(gearKey({ item: 'dagger', level, rarity: 'common', roll: 0 })).needs < t.to);
    expect([1, 7, 8, 13, 14, 19, 20, 25].map(tierAt)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(difficulty(salvageOf(gearKey({ item: 'dagger', level: 26, rarity: 'common', roll: 0 })).needs, 299).chance).toBeGreaterThan(0); // (something teaches to the top)
  });

  it("counts a piece found as many tries, the finer the more (a fighter's few drops carry the skill); junk and a crafter's own, one", () => {
    expect(FOUND_TRIES).toEqual({ common: 15, uncommon: 18, rare: 24, epic: 30, legendary: 36 });
    expect(salvageOf(gearKey({ item: 'mace', level: 9, rarity: 'rare', roll: 3 })).tries).toBe(24);
    expect([salvageOf('rustyBuckle').tries, salvageOf(gearKey({ item: 'club', level: 24, rarity: 'uncommon', roll: 7 }), Infinity, true).tries]).toEqual([1, 1]);
  });

  it('teaches nothing from a piece too hard to learn from (more than TOO_HARD past the skill), broken down all the same', () => {
    const club = salvageOf(gearKey({ item: 'mace', level: 26, rarity: 'common', roll: 0 }), 1);
    expect(club.needs).toBe(300);
    expect(teachChance(club, 1)).toBe(0);
    expect(teachChance(club, 300 - TOO_HARD)).toBe(1); // (within reach: orange, always)
    expect(club.gives).toEqual([['ironScrap', 5]]);
  });

  it("makes a piece the hero crafted (as a woodworker or a smith makes it) no ladder: green at most, half its scrap, less than went into it, no finer thing", () => {
    const warClub = gearKey({ item: 'club', level: 24, rarity: 'uncommon', roll: 7 }); // (woodworking's oak war club: three oak planks)
    const made = salvageOf(warClub, 300, true);
    expect([made.made, made.tries]).toEqual([true, 1]); // (one try: no ladder)
    expect(made.gives).toEqual([['oakPlank', 2]]);
    expect(teachChance(made, made.needs - 10)).toBe(MATERIAL_RISE.chance); // (orange for anyone else's: a material's little for this)
    const shield = salvageOf(gearKey({ item: 'towerShield', level: 33, rarity: 'rare', roll: 1 }), 300, true); // (the heartwood tower shield: rare, but made)
    expect(shield.gives.map(([item]) => item)).toEqual(['oakPlank']);
    expect(salvageOf(gearKey({ item: 'club', level: 24, rarity: 'common', roll: 7 }), 300, true).made).toBeUndefined(); // (not as any recipe makes it: a drop)
    expect(salvageOf(warClub, 300)).toMatchObject({ tries: FOUND_TRIES.uncommon }); // (the same, found on a foe: not the hero's own)
    for (const id of RECIPE_IDS) {
      const m = RECIPES[id].makes;
      if (typeof m === 'string') continue;
      const used = Object.values(RECIPES[id].from).reduce((n, k) => n + (k ?? 0), 0);
      const back = salvageOf(gearKey({ ...m, roll: 0 }), Infinity, true).gives.reduce((n, [, k]) => n + k, 0);
      expect(back, id).toBeLessThan(used);
    }
  });

  it('breaks down the junk with iron, leather, linen or silver in it, an apprentice\'s; not what has none', () => {
    expect(salvageOf('rustyBuckle')).toEqual({ make: 'iron', needs: 12, gives: [['ironScrap', 1]], tries: 1 });
    expect(salvageOf('tornPouch').gives).toEqual([['leatherStrip', 1]]);
    expect(salvageOf('runestone').gives).toEqual([['gemShard', 1]]);
    expect(salvageOf('frostTorc').needs).toBeLessThanOrEqual(60);
    expect([isSalvageable('crackedFlask'), isSalvageable('gnawedBone'), isSalvageable('rustyBuckle'), isSalvageable('armingSword')]).toEqual([false, false, true, true]);
  });
});

// A world with a smithy, the hero stood before its salvage bench (inside, on the tile toward the door).
const atTheBench = (seed = TEST_SEEDS[0]) => {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const smithy = model.entrances.find((e) => e.type === 'smithy')!;
  model.teleport(smithy.x, smithy.z);
  model.useDoor();
  const bench = model.inside!.furniture.find((f) => f.kind === 'salvageBench')!;
  Object.assign(model.hero, { x: bench.x, z: bench.z + 1 });
  return { model, bench };
};

describe('the salvage bench', () => {
  it('stands in every smithy out on the floor, its front tile free to stand at, and is in reach from there alone', () => {
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const smithy of model.entrances.filter((e) => e.type === 'smithy')) {
        model.teleport(smithy.x, smithy.z);
        model.useDoor();
        const bench = model.inside!.furniture.find((f) => f.kind === 'salvageBench');
        expect(bench, `seed ${seed}: the smithy at ${smithy.x},${smithy.z}`).toBeTruthy();
        expect(model.inside!.furniture.some((f) => f !== bench && f.x === bench!.x && f.z === bench!.z + 1), 'its front tile free').toBe(false);
        Object.assign(model.hero, { x: bench!.x, z: bench!.z + 1 });
        expect(model.salvage.benchInReach).toBe(bench);
        Object.assign(model.hero, { x: bench!.x + 2, z: bench!.z + 1 });
        expect(model.salvage.benchInReach).toBeNull();
        model.useDoor();
      }
    }
  });

  it('is not to be had outdoors, nor in an inn', () => {
    const model = fresh();
    expect(model.salvage.benchInReach).toBeNull();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.teleport(inn.x, inn.z);
    model.useDoor();
    expect(model.salvage.benchInReach).toBeNull();
  });
});

// The piece set on the bench, and the time it takes let pass (the model's frames, standing still).
const breakNow = (model: GameModel, key: string) => {
  const outcome = model.salvage.start(key as never);
  for (let t = 0; t < BREAK_SECONDS + 0.1 && model.salvage.breaking; t += 1 / 30) model.update(0, 0, 1 / 30);
  return outcome;
};

describe('breaking gear down', () => {
  it('at the bench, a while: the piece gone, its makings in the bag, the skill practised, the bar filling meanwhile; not away from one, nor past the skill, nor two at once; walking off stops it', () => {
    const { model, bench } = atTheBench();
    const { hero } = model;
    model.random = () => 0;
    hero.bag.armingSword = 2;
    Object.assign(hero, { x: bench.x + 3, z: bench.z + 1 }); // (away from it)
    expect(model.salvage.start('armingSword')).toBe('no bench');
    Object.assign(hero, { x: bench.x, z: bench.z + 1 });
    expect(model.salvage.candidates).toContain('armingSword');
    expect(model.salvage.start('armingSword')).toBe('started');
    expect(model.salvage.start('armingSword')).toBe('busy');
    model.update(0, 0, BREAK_SECONDS / 2);
    expect(model.salvage.progress).toBeCloseTo(0.5, 1);
    expect(castOf(model)).toMatchObject({ label: 'Breaking down Arming sword' });
    model.update(1, 0, 1 / 30); // (a step away: dropped)
    expect([model.salvage.breaking, hero.bag.armingSword]).toEqual([null, 2]);
    Object.assign(hero, { x: bench.x, z: bench.z + 1 });
    expect(breakNow(model, 'armingSword')).toBe('started');
    expect([hero.bag.armingSword, hero.bag.ironScrap]).toEqual([1, 1]);
    expect(skillOf(hero, 'salvaging').level).toBe(1 + FOUND_TRIES.common); // (a piece found: several tries, each its own roll)
    expect(model.takeEvents().some((e) => e.kind === 'salvaged')).toBe(true);
    expect(model.salvage.start('bentSpoon' as never)).toBe('none');
    // A full bag (of other things): no starting, nothing of what it leaves to be lost.
    hero.bag.armingSword = 2; // (two: the last's slot would be the scrap's)
    delete hero.bag.ironScrap; // (a stack of it would always take one more)
    for (const id of [...Object.keys(LOOT), ...Object.keys(ITEMS)]) if (canCarry(hero, 'ironScrap')) hero.bag[id as keyof typeof hero.bag] = 1; // (filled with one of everything)
    expect(canCarry(hero, 'ironScrap')).toBe(false);
    expect(model.salvage.start('armingSword')).toBe('full');
    delete hero.bag.bentSpoon;
    expect(model.salvage.start('armingSword')).toBe('started');
    model.salvage.stop();
    for (const id of [...Object.keys(LOOT), ...Object.keys(ITEMS)]) if (id !== 'ironScrap' && id !== 'armingSword') delete hero.bag[id as keyof typeof hero.bag]; // (emptied again)
    const rare = gearKey({ item: 'rubyRing', level: 9, rarity: 'rare', roll: 4 });
    hero.bag[rare] = 2;
    expect(breakNow(model, rare)).toBe('started'); // (any piece, at any skill: too green a hand, its scrap alone)
    expect([hero.bag.silverFilings, hero.bag.gemShard, hero.bag.cutGem]).toEqual([2, 1, undefined]);
    skillOf(hero, 'salvaging').level = 100;
    expect(breakNow(model, rare)).toBe('started');
    expect([hero.bag.silverFilings, hero.bag.gemShard, hero.bag.cutGem]).toEqual([4, 2, 1]);
  });

  it('breaks down as many as asked, one after another, junk as gear; walking off stops the rest', () => {
    const { model } = atTheBench();
    const { hero } = model;
    model.random = () => 0;
    hero.bag.rustyBuckle = 4;
    expect(model.salvage.candidates).toContain('rustyBuckle');
    expect(model.salvage.start('rustyBuckle', Infinity)).toBe('started');
    for (let t = 0; t < BREAK_SECONDS * 2.5; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect([hero.bag.rustyBuckle, hero.bag.ironScrap]).toEqual([2, 2]);
    expect(model.salvage.breaking?.key).toBe('rustyBuckle');
    model.update(1, 0, 1 / 30);
    expect(model.salvage.breaking).toBeNull();
    expect(hero.bag.rustyBuckle).toBe(2);
  });

  it("takes a piece found on a foe for found, though a recipe makes its like; only what the hero crafted for their own, a save and a load on", () => {
    const { model } = atTheBench();
    const { hero } = model;
    model.random = () => 0;
    skillOf(hero, 'salvaging').level = 10;
    const found = gearKey({ item: 'shortSword', level: 8, rarity: 'common', roll: 517 }); // (the smith's short sword's level and rarity: a foe's)
    hero.bag[found] = 1;
    expect(breakNow(model, found)).toBe('started');
    expect([hero.bag.ironScrap, skillOf(hero, 'salvaging').level]).toEqual([2, 10 + FOUND_TRIES.common]); // (as any found piece: its scrap, its tries)
    const anvil = model.inside!.furniture.find((f) => f.kind === 'anvil')!;
    Object.assign(hero, { x: anvil.x, z: anvil.z + 1 });
    skillOf(hero, 'smithing').level = 60;
    hero.bag.ironIngot = 2;
    expect(model.smithing.start('shortSword')).toBe(true);
    for (let t = 0; t < 5.2; t += 0.1) model.update(0, 0, 0.1);
    const made = Object.keys(hero.bag).find((k) => k.startsWith('shortSword@8'))!;
    expect(made).toBeTruthy();
    const loaded = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    restore(loaded, snapshot(model));
    expect(loaded.salvage.salvaged(made as never)).toMatchObject({ made: true, tries: 1, gives: [['ironScrap', 1]] }); // (the hero's own: one try, half its scrap)
    expect(salvageOf(made as never, 10)).toMatchObject({ tries: FOUND_TRIES.common }); // (anyone else's, found)
  });

  it('forgets the wear on a piece broken down, the last of it; a second like it keeps its own', () => {
    const { model } = atTheBench();
    const { hero } = model;
    hero.bag.hatchet = 2;
    hero.wear = { hatchet: 100 };
    expect(breakNow(model, 'hatchet')).toBe('started');
    expect(hero.wear.hatchet).toBe(100); // (one left, as worn)
    expect(breakNow(model, 'hatchet')).toBe('started');
    expect(hero.wear.hatchet).toBeUndefined(); // (none left: a plain one found later, unworn)
  });

  it("tells a piece's rises at the bench in one, however many its tries raise the skill", () => {
    const { model } = atTheBench();
    model.random = () => 0;
    model.hero.bag.armingSword = 1;
    model.takeEvents();
    expect(breakNow(model, 'armingSword')).toBe('started');
    const rises = model.takeEvents().filter((e) => e.kind === 'skillUp');
    expect(rises).toEqual([{ kind: 'skillUp', skill: 'Salvaging', level: 1 + FOUND_TRIES.common, gained: FOUND_TRIES.common }]);
  });

  it('tells, over the hero, how many more are to go; and why it stopped, the bag filled before the rest', () => {
    const { model } = atTheBench();
    const { hero } = model;
    model.random = () => 0;
    skillOf(hero, 'salvaging').level = FINER_AT.rare - 1;
    hero.skills!.salvaging!.toward = stepsOf('salvaging', FINER_AT.rare - 1) - 1; // (the first broken down: the hand skilled enough for a cut gem from the next)
    const rare = gearKey({ item: 'rubyRing', level: 9, rarity: 'rare', roll: 4 }); // (filings and a shard; then a cut gem besides, a slot of its own)
    hero.bag[rare] = 3;
    for (let i = 0; slotsUsed(hero.bag) < bagRoom(hero) - 2; i++) hero.bag[`dagger@${i + 2}c0` as never] = 1 as never; // (two slots free: the first's two, none for the next's gem)
    expect(model.salvage.start(rare, Infinity)).toBe('started');
    expect(castOf(model)?.label).toBe('Breaking down Ruby ring · 3 to go');
    model.takeEvents();
    for (let t = 0; t < BREAK_SECONDS + 0.1; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect([model.salvage.breaking, hero.bag[rare]]).toEqual([null, 2]);
    expect(model.takeEvents()).toContainEqual({ kind: 'poor', text: 'Your bag is full' });
  });

  it('never overfills the bag: a piece that leaves three new things, one slot free, isn\'t begun; the last of a piece leaves its slot', () => {
    const { model } = atTheBench();
    const { hero } = model;
    skillOf(hero, 'salvaging').level = 100;
    const rare = gearKey({ item: 'rubyRing', level: 9, rarity: 'rare', roll: 4 }); // (filings, a shard, a cut gem)
    hero.bag[rare] = 2;
    for (let i = 0; slotsUsed(hero.bag) < bagRoom(hero) - 1; i++) hero.bag[`dagger@${i + 2}c0` as never] = 1 as never; // (one slot left)
    expect(model.salvage.start(rare)).toBe('full');
    hero.bag[rare] = 1; // (the last: its slot and the free one, two of the three)
    expect(model.salvage.start(rare)).toBe('full');
    delete hero.bag['dagger@2c0' as never];
    expect(breakNow(model, rare)).toBe('started');
    expect(slotsUsed(hero.bag)).toBe(bagRoom(hero));
  });

  it('has a window: the gear carried in cases as the bag\'s, the one picked told of, and a button that sets it on the bench', () => {
    const { model } = atTheBench();
    model.random = () => 0.99;
    delete model.hero.bag.hatchet; // (a new hero's: a piece like any other, left out for the count)
    model.hero.bag.armingSword = 2;
    model.hero.bag.leatherCap = 1;
    const panel = createSalvagePanel(model);
    panel.open();
    const window = Array.from(document.querySelectorAll('.menu[aria-label="Salvage bench"]')).at(-1)!; // (this panel's: a closed one's stays in the document)
    expect(window).toBeTruthy();
    const cases = Array.from(window.querySelectorAll<HTMLElement>('.menu-slot'));
    expect(cases.length).toBe(2);
    cases[0].click();
    expect(window.textContent).toContain('Iron scrap');
    const go = window.querySelector<HTMLButtonElement>('.salvage-go')!;
    expect(go).toBeTruthy();
    go.click();
    window.querySelector<HTMLButtonElement>('.salvage-sure')?.click(); // (nothing in hand: the sword's better than nothing, so it's asked first)
    expect(model.salvage.breaking?.key).toBe('armingSword');
    for (let t = 0; t < BREAK_SECONDS + 0.1 && model.salvage.breaking; t += 1 / 30) [model.update(0, 0, 1 / 30), panel.update()];
    expect(model.hero.bag.ironScrap).toBe(1);
    expect(model.hero.bag.armingSword).toBe(1);
    model.hero.bag.armingSword = 3;
    panel.menu.refresh();
    window.querySelector<HTMLButtonElement>('.salvage-all')!.click(); // (the rest, one after another; and a button to stop them)
    window.querySelector<HTMLButtonElement>('.salvage-sure')?.click();
    panel.update();
    expect(model.salvage.breaking?.key).toBe('armingSword');
    window.querySelector<HTMLButtonElement>('.salvage-stop')!.click();
    expect([model.salvage.breaking, model.hero.bag.armingSword]).toEqual([null, 3]);
    panel.menu.close();
  });

  it('asks first before a piece better than what the hero wears (nothing worn in its slot, or less), and breaks it down only on the word', () => {
    const { model } = atTheBench();
    delete model.hero.bag.hatchet;
    model.hero.bag.armingSword = 1; // (nothing in hand: better than nothing)
    expect(betterThanWorn('armingSword', model.hero)).toBe(true);
    model.hero.equipment.mainHand = 'battleAxe';
    expect(betterThanWorn('armingSword', model.hero)).toBe(gearPower('armingSword') > gearPower('battleAxe'));
    model.hero.equipment.mainHand = undefined;
    const panel = createSalvagePanel(model);
    panel.open();
    const window = Array.from(document.querySelectorAll('.menu[aria-label="Salvage bench"]')).at(-1)!; // (this panel's: a closed one's stays in the document)
    window.querySelector<HTMLElement>('.menu-slot')!.click();
    window.querySelector<HTMLButtonElement>('.salvage-go')!.click();
    expect(model.salvage.breaking).toBeNull(); // (asked, not done)
    expect(window.querySelector('.salvage-warn')?.textContent).toContain('better than what you wear');
    window.querySelector<HTMLButtonElement>('.salvage-keep')!.click();
    expect([model.salvage.breaking, window.querySelector('.salvage-warn')]).toEqual([null, null]); // (kept: the plain button back)
    window.querySelector<HTMLButtonElement>('.salvage-go')!.click();
    window.querySelector<HTMLButtonElement>('.salvage-sure')!.click();
    expect(model.salvage.breaking?.key).toBe('armingSword');
    panel.menu.close();
  });

  it('asks first before the last axe carried for felling trees (none wielded), though a sword in hand is better', () => {
    const { model } = atTheBench();
    model.hero.equipment.mainHand = gearKey({ item: 'armingSword', level: 20, rarity: 'rare', roll: 0 });
    expect([betterThanWorn('hatchet', model.hero), model.lumber.axeKey]).toEqual([false, 'hatchet']);
    const panel = createSalvagePanel(model);
    panel.open();
    const window = Array.from(document.querySelectorAll('.menu[aria-label="Salvage bench"]')).at(-1)!;
    window.querySelector<HTMLElement>('.menu-slot')!.click();
    window.querySelector<HTMLButtonElement>('.salvage-go')!.click();
    expect(model.salvage.breaking).toBeNull();
    expect(window.querySelector('.salvage-warn')?.textContent).toContain('fell trees');
    window.querySelector<HTMLButtonElement>('.salvage-keep')!.click();
    model.hero.bag[gearKey({ item: 'hatchet', level: 9, rarity: 'common', roll: 0 })] = 1; // (another axe besides: not asked)
    panel.menu.refresh();
    window.querySelector<HTMLElement>('.menu-slot')!.click();
    window.querySelector<HTMLButtonElement>('.salvage-go')!.click();
    expect(model.salvage.breaking?.key).toBe('hatchet');
    panel.menu.close();
  });
});
