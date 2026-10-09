// @vitest-environment happy-dom
// Salvaging (model/skills/salvage.ts): gear broken down at a village's salvage bench (worldgen/salvageBenches.ts)
// into what it's made of, more of it the better the piece and something finer from a rare one, each asking a level
// of the skill; the bench on every square, a step in from the well, blocking its tile; the window (controller/skills/
// salvagePanel.ts) listing the gear carried with the button to break it down.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { TEST_SEEDS, TEST_MAP_SIZE } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { betterThanWorn, gearKey, gearPower } from '../src/model/human/items/gear';
import { BREAK_SECONDS, makeOf, salvageOf } from '../src/model/skills/salvage';
import { castOf } from '../src/controller/skills/castOf';
import { skillOf } from '../src/model/skills/skills';
import { BENCH_REACH, salvageBenches } from '../src/model/worldgen/salvageBenches';
import { VILLAGE_OUTER_RADIUS as R } from '../src/model/constants';
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

describe('the salvage benches', () => {
  it('stand on every square a step or two in from the well, not on the board, blocking their tile, and in reach from their front', () => {
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const benches = salvageBenches(model);
      expect(benches.length).toBe(model.villages.length);
      for (const b of benches) {
        const [dx, dz] = [b.x - b.village.x, b.z - b.village.z];
        expect(Math.max(Math.abs(dx), Math.abs(dz))).toBeGreaterThanOrEqual(2);
        expect(Math.max(Math.abs(dx), Math.abs(dz))).toBeLessThanOrEqual(R); // (a small square: on its edge at most)
        expect(model.isOpenTile(b.x, b.z)).toBe(false);
        model.teleport(b.x + b.front.dx * 0.9, b.z + b.front.dz * 0.9);
        expect(model.salvage.benchInReach).toBe(benches.indexOf(b));
        model.teleport(b.x + b.front.dx * (BENCH_REACH + 1), b.z + b.front.dz * (BENCH_REACH + 1));
        expect(model.salvage.benchInReach).toBeNull();
      }
    }
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
    const model = fresh();
    const { hero } = model;
    model.random = () => 0;
    hero.bag.armingSword = 2;
    expect(model.salvage.start('armingSword')).toBe('no bench');
    const bench = model.salvage.benches[0];
    model.teleport(bench.x + bench.front.dx * 0.9, bench.z + bench.front.dz * 0.9);
    expect(model.salvage.candidates).toContain('armingSword');
    expect(model.salvage.start('armingSword')).toBe('started');
    expect(model.salvage.start('armingSword')).toBe('busy');
    model.update(0, 0, BREAK_SECONDS / 2);
    expect(model.salvage.progress).toBeCloseTo(0.5, 1);
    expect(castOf(model)).toMatchObject({ label: 'Breaking down Arming sword' });
    model.update(1, 0, 1 / 30); // (a step away: dropped)
    expect([model.salvage.breaking, hero.bag.armingSword]).toEqual([null, 2]);
    model.teleport(bench.x + bench.front.dx * 0.9, bench.z + bench.front.dz * 0.9);
    expect(breakNow(model, 'armingSword')).toBe('started');
    expect([hero.bag.armingSword, hero.bag.ironScrap]).toEqual([1, 1]);
    expect(skillOf(hero, 'salvaging').level).toBe(2);
    expect(model.takeEvents().some((e) => e.kind === 'salvaged')).toBe(true);
    expect(model.salvage.start('bentSpoon' as never)).toBe('none');
    const rare = gearKey({ item: 'rubyRing', level: 9, rarity: 'rare', roll: 4 });
    hero.bag[rare] = 1;
    expect(model.salvage.start(rare)).toBe('skill');
    skillOf(hero, 'salvaging').level = 100;
    expect(breakNow(model, rare)).toBe('started');
    expect([hero.bag.silverFilings, hero.bag.gemShard, hero.bag.cutGem]).toEqual([2, 1, 1]);
  });

  it('has a window: the gear carried in cases as the bag\'s, the one picked told of, and a button that sets it on the bench', () => {
    const model = fresh();
    model.random = () => 0.99;
    delete model.hero.bag.hatchet; // (a new hero's: a piece like any other, left out for the count)
    model.hero.bag.armingSword = 2;
    model.hero.bag.leatherCap = 1;
    const bench = model.salvage.benches[0];
    model.teleport(bench.x + bench.front.dx * 0.9, bench.z + bench.front.dz * 0.9);
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
    const model = fresh();
    delete model.hero.bag.hatchet;
    model.hero.bag.armingSword = 1; // (nothing in hand: better than nothing)
    expect(betterThanWorn('armingSword', model.hero)).toBe(true);
    model.hero.equipment.mainHand = 'battleAxe';
    expect(betterThanWorn('armingSword', model.hero)).toBe(gearPower('armingSword') > gearPower('battleAxe'));
    model.hero.equipment.mainHand = undefined;
    const bench = model.salvage.benches[0];
    model.teleport(bench.x + bench.front.dx * 0.9, bench.z + bench.front.dz * 0.9);
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
