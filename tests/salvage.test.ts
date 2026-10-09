// @vitest-environment happy-dom
// Salvaging (model/skills/salvage.ts): gear broken down at a smithy's salvage bench (smithy/smithyLayout.ts) into
// what it's made of, more of it the better the piece and something finer from a rare one, each asking a level of the
// skill; the bench in every smithy, out on the floor, reached from the tile before it; the window (controller/skills/
// salvagePanel.ts) listing the gear carried with the button to break it down.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { TEST_SEEDS, TEST_MAP_SIZE } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { betterThanWorn, gearKey, gearPower } from '../src/model/human/items/gear';
import { BREAK_SECONDS, makeOf, salvageOf } from '../src/model/skills/salvage';
import { castOf } from '../src/controller/skills/castOf';
import { LOOT } from '../src/model/loot/loot';
import { ITEMS } from '../src/model/human/equipment';
import { canCarry } from '../src/model/hero/bagSlots';
import { skillOf } from '../src/model/skills/skills';
import { createSalvagePanel } from '../src/controller/skills/salvagePanel';

describe('what gear is made of, and leaves', () => {
  it('knows iron from leather, cloth, silver and wood', () => {
    expect(['armingSword', 'chainMail', 'greatHelm', 'gauntlets'].map((id) => makeOf(id as never))).toEqual(['iron', 'iron', 'iron', 'iron']);
    expect(['leatherCap', 'studdedJerkin', 'furBoots', 'leatherBracers'].map((id) => makeOf(id as never))).toEqual(['leather', 'leather', 'leather', 'leather']);
    expect(['linenShirt', 'gambeson', 'woolHose', 'silkGloves'].map((id) => makeOf(id as never))).toEqual(['cloth', 'cloth', 'cloth', 'cloth']);
    expect(['rubyRing', 'silverLocket', 'copperRing'].map((id) => makeOf(id as never))).toEqual(['silver', 'silver', 'silver']);
    expect(['quarterstaff', 'club', 'plankShield'].map((id) => makeOf(id as never))).toEqual(['wood', 'wood', 'wood']);
  });

  it('leaves one scrap, one more every six levels, a gem shard off a stone, and a finer thing from a rare piece; asks a level by its own and its rarity', () => {
    expect(salvageOf('armingSword')).toEqual({ make: 'iron', needs: 1, gives: [['ironScrap', 1]] });
    expect(salvageOf(gearKey({ item: 'armingSword', level: 13, rarity: 'rare', roll: 2 }))).toEqual({ make: 'iron', needs: 13 * 3 - 8 + 20, gives: [['ironScrap', 3], ['temperedIngot', 1]] });
    expect(salvageOf(gearKey({ item: 'rubyRing', level: 7, rarity: 'epic', roll: 1 }))).toEqual({ make: 'silver', needs: 7 * 3 - 8 + 60, gives: [['silverFilings', 2], ['gemShard', 1], ['cutGem', 2]] });
    expect(salvageOf('quarterstaff').gives).toEqual([['oakPlank', 1]]);
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
    expect(skillOf(hero, 'salvaging').level).toBe(2);
    expect(model.takeEvents().some((e) => e.kind === 'salvaged')).toBe(true);
    expect(model.salvage.start('bentSpoon' as never)).toBe('none');
    // A full bag (of other things): no starting, nothing of what it leaves to be lost.
    hero.bag.armingSword = 1;
    delete hero.bag.ironScrap; // (a stack of it would always take one more)
    for (const id of [...Object.keys(LOOT), ...Object.keys(ITEMS)]) if (canCarry(hero, 'ironScrap')) hero.bag[id as keyof typeof hero.bag] = 1; // (filled with one of everything)
    expect(canCarry(hero, 'ironScrap')).toBe(false);
    expect(model.salvage.start('armingSword')).toBe('full');
    delete hero.bag.bentSpoon;
    expect(model.salvage.start('armingSword')).toBe('started');
    model.salvage.stop();
    for (const id of [...Object.keys(LOOT), ...Object.keys(ITEMS)]) if (id !== 'ironScrap' && id !== 'armingSword') delete hero.bag[id as keyof typeof hero.bag]; // (emptied again)
    const rare = gearKey({ item: 'rubyRing', level: 9, rarity: 'rare', roll: 4 });
    hero.bag[rare] = 1;
    expect(model.salvage.start(rare)).toBe('skill');
    skillOf(hero, 'salvaging').level = 100;
    expect(breakNow(model, rare)).toBe('started');
    expect([hero.bag.silverFilings, hero.bag.gemShard, hero.bag.cutGem]).toEqual([2, 1, 1]);
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
});
