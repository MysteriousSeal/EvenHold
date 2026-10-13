// The hen-wife's turn (model/spells/chickens.ts): whoever's picked out turned into a chicken, for good. A foe counts
// as slain (a quest's count, the world's record: never back), nothing had for it; a villager or keeper is gone from
// their village, their quests let go and no more of them, no word or trade to be had; a traveller is off the roads. A
// hen in their place, wandering within 5 tiles of where they were turned, for ever; kept in a save, with who's lost.
// Never a boss or a camp's chief, never the hero, never without someone picked out. The hen herself
// (view/meshes/wildlife/chickenVoxels.ts): her parts, her few colours.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TEST_MAP_SIZE, TEST_SEEDS, fresh } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { makeEnemy } from '../src/model/enemies/enemies';
import { interactionOf } from '../src/model/hero/interaction';
import { parseSave, restore, snapshot } from '../src/model/save';
import { COW_COATS, ROAM, mayTurn, placeOf } from '../src/model/spells/chickens';
import { castSpell } from '../src/model/spells/casting';
import { SPELLS, learn } from '../src/model/spells/spells';
import { SmokePuffs } from '../src/view/meshes/common/smokePuffs';
import { BODY_GRID, CHICKEN_PALETTE, HEAD_GRID, buildChickenBody, buildChickenHead, buildChickenLeg } from '../src/view/meshes/wildlife/chickenVoxels';

// A game with a wolf a little ahead of the hero, focused, the hero knowing the charm; what's told kept.
function withWolf() {
  const model = fresh();
  const { hero } = model;
  model.enemies.length = 0;
  hero.facing = 0;
  const foe = { ...makeEnemy(900, 'wolf', hero.x, hero.z + 2), hp: 500, maxHp: 500 }; // (one of the world's own, by its number)
  model.enemies.push(foe);
  model.focus(foe.id);
  learn(hero, 'chicken');
  const told: string[] = [];
  const report = model.report;
  model.report = (event) => [told.push(event.kind), report.call(model, event)];
  return { model, hero, foe, told };
}
const run = (model: GameModel, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 0.1) [model.update(0, 0, 0.1), each?.()];
};

describe("the hen-wife's turn, on a foe", () => {
  it('turns it into a chicken for good: gone as if slain, a hen where it stood, nothing had for it', () => {
    const { model, hero, foe, told } = withWolf();
    expect(SPELLS.chicken).toMatchObject({ aim: 'anyone', turns: 'chicken', needsTarget: true, cooldown: 0 });
    const [xp, level, money] = [hero.xp, hero.level, hero.money];
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(model.enemies).not.toContain(foe); // (no more)
    expect(model.slain.has(foe.id)).toBe(true); // (the world's record: never back)
    expect(model.focused).toBeNull();
    expect(model.chickens.hens.length).toBe(1);
    expect(model.chickens.hens[0]).toMatchObject({ x: foe.x, z: foe.z, at: null });
    expect(told.filter((k) => k === 'transformed').length).toBe(1); // (told: its turning the view's to play)
    expect(foe.state).toBe('dead');
    expect([hero.xp, hero.level, hero.money]).toEqual([xp, level, money]); // (nothing had for it)
    expect(model.loot.length + model.coins.length).toBe(0);
    run(model, 60);
    expect(model.chickens.hens.length).toBe(1); // (for good)
    expect(model.chickens.here).toEqual(model.chickens.hens);
  });

  it('has the hen wander, never more than 5 tiles from where it was turned', () => {
    const { model, foe } = withWolf();
    const [x0, z0] = [foe.x, foe.z];
    castSpell(model, 'chicken');
    const hen = model.chickens.hens[0];
    let [farthest, went] = [0, 0];
    let last = { x: hen.x, z: hen.z };
    run(model, 40, () => {
      farthest = Math.max(farthest, Math.hypot(hen.x - x0, hen.z - z0));
      went += Math.hypot(hen.x - last.x, hen.z - last.z);
      last = { x: hen.x, z: hen.z };
    });
    expect(ROAM).toBe(5);
    expect(farthest).toBeLessThanOrEqual(ROAM + 1e-6);
    expect(went).toBeGreaterThan(1);
  });

  it('counts as a kill for whatever counts them: a board\'s quest, a quest someone gave', () => {
    const { model, foe } = withWolf();
    const counted: string[] = [];
    const [board, given] = [model.quests.onKill.bind(model.quests), model.story.onKill.bind(model.story)];
    model.quests.onKill = (enemy) => (counted.push(`board:${enemy.id}`), board(enemy));
    model.story.onKill = (enemy) => (counted.push(`given:${enemy.id}`), given(enemy));
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(counted).toEqual([`board:${foe.id}`, `given:${foe.id}`]);
  });

  it("counts as one of a camp's bandits slain: its count up by one, the camp cleared with its last", () => {
    const model = fresh();
    const { hero } = model;
    learn(hero, 'chicken');
    const camp = model.camps.find((c) => model.enemies.some((e) => e.kind === 'bandit' && e.homeX === c.x && e.homeZ === c.z))!;
    const crew = model.enemies.filter((e) => (e.kind === 'bandit' || e.kind === 'banditChief') && e.homeX === camp.x && e.homeZ === camp.z);
    Object.assign(hero, { x: camp.x, z: camp.z });
    const before = model.campLife.status(hero)!;
    expect(before.bandits.slain).toBe(0);
    const bandit = crew.find((e) => e.kind === 'bandit')!;
    expect(model.chickens.turn(bandit)).toBe(true);
    expect(model.campLife.status(hero)!.bandits.slain).toBe(1);
    expect(model.campLife.empty(camp)).toBe(false);
    // The rest of them turned, and the chief slain: no one left standing.
    for (const e of crew) if (e.kind === 'bandit' && e !== bandit) model.chickens.turn(e);
    for (const e of crew) if (e.kind === 'banditChief') e.state = 'dead';
    expect(model.campLife.status(hero)!).toMatchObject({ bandits: { slain: before.bandits.of, of: before.bandits.of }, cleared: true });
    expect(model.campLife.empty(camp)).toBe(true);
  });

  it('is never cast with no one picked out, at the hero, or at a boss or a chief: nothing spent', () => {
    const { model, hero, foe } = withWolf();
    model.focus(null);
    expect(castSpell(model, 'chicken')).toBe('noTarget'); // (a foe about, not picked out: not found for it)
    expect(model.moves.breath).toBe(100);
    const chief = { ...makeEnemy(901, 'banditChief', hero.x + 1, hero.z + 1), hp: 500, maxHp: 500 };
    model.enemies.push(chief);
    model.focus(chief.id);
    expect(mayTurn(chief)).toBe(false);
    expect(castSpell(model, 'chicken')).toBe('noTarget');
    expect(model.enemies).toContain(chief);
    expect(mayTurn(foe)).toBe(true);
    expect(model.chickens.hens.length).toBe(0);
  });

  it('may be cast again at once, each turned a hen of their own', () => {
    const { model, hero } = withWolf();
    castSpell(model, 'chicken');
    const other = { ...makeEnemy(902, 'boar', hero.x + 2, hero.z), hp: 500, maxHp: 500 };
    model.enemies.push(other);
    model.focus(other.id);
    model.moves.breath = 100;
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(model.chickens.hens.length).toBe(2);
    expect(model.enemies.length).toBe(0);
  });
});

describe("the hen-wife's turn, on someone who's no foe", () => {
  it('takes a traveller off the roads for good: no word to be had, a hen where they stood', () => {
    const model = fresh();
    const { hero } = model;
    model.enemies.length = 0;
    learn(hero, 'chicken');
    const one = model.travellers.list[0];
    model.teleport(Math.round(one.x) + 1, Math.round(one.z));
    model.update(0, 0, 0.01);
    Object.assign(hero, { x: one.x + 0.6, z: one.z });
    model.select(one);
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(model.travellers.list).not.toContain(one);
    expect(model.chosen.person).toBeNull();
    expect(JSON.stringify(interactionOf(model))).not.toContain(one.name);
    expect(model.chickens.hens[0]).toMatchObject({ x: one.x, z: one.z, at: null });
    run(model, 5); // (the roads go on without them)
  });

  it('takes a keeper from their village for good: no word or trade, her quests let go and no more of them, a hen in her house', () => {
    const model = fresh();
    const { hero, story } = model;
    learn(hero, 'chicken');
    const herbalist = model.npcs.find((n) => n.role === 'herbalist' && story.questsOf(n).some((q) => q.set))!;
    const hers = story.questsOf(herbalist).filter((q) => q.set);
    const key = hers[0].key;
    story.replay(key.split('@')[0], herbalist);
    story.accept(key);
    expect(story.taken.some((t) => t.id === key)).toBe(true);
    model.teleport(herbalist.home.x, herbalist.home.z);
    model.useDoor();
    model.update(0, 0, 0.1);
    Object.assign(hero, { x: herbalist.x, z: herbalist.z + 1.2 });
    model.select(herbalist);
    expect(castSpell(model, 'chicken')).toBe('cast');
    expect(model.npcs).not.toContain(herbalist);
    expect(model.folk).not.toContain(herbalist);
    expect(model.chickens.lost.has(herbalist.id)).toBe(true);
    expect(story.taken.some((t) => t.id === key)).toBe(false); // (let go)
    expect(story.questsOf(herbalist).filter((q) => q.set)).toEqual([]); // (and no more of hers)
    expect(JSON.stringify(interactionOf(model))).not.toContain(herbalist.name);
    const hen = model.chickens.hens[0];
    expect(hen.at).toBe(placeOf(herbalist.home));
    expect(model.chickens.here).toEqual([hen]);
    run(model, 20, () => [expect(hen.x).toBeGreaterThan(-0.6), expect(hen.z).toBeGreaterThan(-0.6)]); // (kept to the floor of it)
    expect(hen.at).not.toBeNull(); // (hers the house's: not out of doors with the rest)
  });

  it('is kept in a save: the hens where they are, the lost still lost, the slain still slain', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const villager = model.npcs.find((n) => n.role === 'villager')!;
    const foe = model.enemies[0];
    expect(model.chickens.turn(villager)).toBe(true);
    const may = mayTurn(foe);
    expect(model.chickens.turn(foe)).toBe(may);
    const again = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    expect(again.npcs.some((n) => n.id === villager.id)).toBe(true);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.npcs.some((n) => n.id === villager.id)).toBe(false);
    expect(again.chickens.lost.has(villager.id)).toBe(true);
    expect(again.chickens.hens.length).toBe(model.chickens.hens.length);
    expect(again.chickens.hens[0].at).toBe(model.chickens.hens[0].at);
    expect(again.chickens.hens[0].x).toBeCloseTo(model.chickens.hens[0].x, 1);
    again.chickens.load({ hens: [['x', 1, null, 0, 0], 'nonsense'], lost: ['a', 2.5] }); // (a broken save: none of it)
    expect(again.chickens.hens.length + again.chickens.lost.size).toBe(0);
  });
});

describe("the dairymaid's call", () => {
  it('turns whoever is picked out into a cow, for good: slow, stood long at her cud, kept so in a save; taught like the others', () => {
    const { model, hero, foe } = withWolf();
    learn(hero, 'cow');
    expect(SPELLS.cow).toMatchObject({ aim: 'anyone', turns: 'cow', needsTarget: true, cooldown: 0 });
    expect(SPELLS.cow.level).toBeGreaterThan(SPELLS.chicken.level);
    expect(castSpell(model, 'cow')).toBe('cast');
    expect(model.enemies).not.toContain(foe);
    const cow = model.chickens.hens[0];
    expect(cow).toMatchObject({ kind: 'cow', x: foe.x, z: foe.z });
    const [x0, z0] = [cow.x, cow.z];
    run(model, 60, () => expect(Math.hypot(cow.x - x0, cow.z - z0)).toBeLessThanOrEqual(ROAM + 1e-6));
    const again = fresh();
    again.chickens.load(JSON.parse(JSON.stringify(model.chickens.save())));
    expect(again.chickens.hens[0].kind).toBe('cow');
    // Her coat: one of them by chance, hers from then on; told with her turning, for it to be played in.
    expect(cow.coat).toBeGreaterThanOrEqual(0);
    expect(cow.coat).toBeLessThan(COW_COATS);
    expect(again.chickens.hens[0].coat).toBe(cow.coat);
    const coats = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const next = withWolf();
      learn(next.hero, 'cow');
      next.model.random = () => (i * 0.137) % 1;
      const told: Array<{ kind: string; coat?: number }> = [];
      const report = next.model.report;
      next.model.report = (event) => [told.push(event as never), report.call(next.model, event)];
      castSpell(next.model, 'cow');
      expect(told.find((e) => e.kind === 'transformed')!.coat).toBe(next.model.chickens.hens[0].coat);
      coats.add(next.model.chickens.hens[0].coat!);
    }
    expect(coats.size).toBe(COW_COATS); // (each of them, some time)
    again.chickens.load({ hens: [[1, 1, null, 1, 1, 'cow', 99], [2, 2, null, 2, 2, 'cow']], lost: [] }); // (a broken save's, an older one's: her first coat)
    expect(again.chickens.hens.map((h) => h.coat)).toEqual([0, 0]);
  });
});

describe("the horse-coper's word", () => {
  it('turns whoever is picked out into a horse, for good, as the other does into a hen: a horse where they stood, kept so in a save', () => {
    const { model, hero, foe } = withWolf();
    learn(hero, 'horse');
    expect(SPELLS.horse).toMatchObject({ aim: 'anyone', turns: 'horse', needsTarget: true });
    const told: unknown[] = [];
    const report = model.report;
    model.report = (event) => [told.push(event), report.call(model, event)];
    expect(castSpell(model, 'horse')).toBe('cast');
    expect(model.enemies).not.toContain(foe);
    expect(model.chickens.hens[0]).toMatchObject({ kind: 'horse', x: foe.x, z: foe.z });
    expect(told.find((e) => (e as { kind: string }).kind === 'transformed')).toMatchObject({ into: 'horse' });
    // It goes about: farther in a stroll than a hen, stood longer between them; never past its 5 tiles.
    const horse = model.chickens.hens[0];
    const [x0, z0] = [horse.x, horse.z];
    let went = 0;
    let last = { x: x0, z: z0 };
    run(model, 60, () => {
      expect(Math.hypot(horse.x - x0, horse.z - z0)).toBeLessThanOrEqual(ROAM + 1e-6);
      went += Math.hypot(horse.x - last.x, horse.z - last.z);
      last = { x: horse.x, z: horse.z };
    });
    expect(went).toBeGreaterThan(1);
    const again = fresh();
    again.chickens.load(JSON.parse(JSON.stringify(model.chickens.save())));
    expect(again.chickens.hens[0].kind).toBe('horse');
    again.chickens.load({ hens: [[1, 1, null, 1, 1], [2, 2, null, 2, 2, 'dragon']], lost: [] }); // (an older save's, or a broken one's: a hen)
    expect(again.chickens.hens.map((h) => h.kind)).toEqual(['chicken', 'chicken']);
  });
});

describe('the hen', () => {
  it('is a body, a head and a leg in voxels, in her few colours: white, red, yellow', () => {
    const count = (grid: { cells: ArrayLike<number> }) => Array.from(grid.cells).filter(Boolean).length;
    const [body, head, leg] = [buildChickenBody(), buildChickenHead(), buildChickenLeg()];
    expect(body.size).toEqual(BODY_GRID);
    expect(head.size).toEqual(HEAD_GRID);
    for (const part of [body, head, leg]) expect(count(part)).toBeGreaterThan(2);
    const used = new Set([...Array.from(body.cells), ...Array.from(head.cells), ...Array.from(leg.cells)].filter(Boolean));
    expect(Math.max(...used)).toBeLessThanOrEqual(CHICKEN_PALETTE.length);
    expect(CHICKEN_PALETTE.length).toBeLessThanOrEqual(8); // (a small palette, said first)
    expect(count(body)).toBeLessThan(200); // (small: read by her shape, not her detail)
  });

  it('throws off smoke and feathers that are gone again in a moment', () => {
    const [scene, smoke] = [new THREE.Group(), new SmokePuffs()];
    smoke.puff(scene, 0, 0, 0, 1);
    smoke.feathers(scene, 0, 0, 0, 1, 16);
    expect(scene.children.length).toBe(2);
    for (let t = 0; t < 1; t += 0.1) smoke.update(0.1);
    expect(scene.children.length).toBe(1); // (the smoke: thinned away; the feathers still falling)
    for (let t = 0; t < 1; t += 0.1) smoke.update(0.1);
    expect(scene.children.length).toBe(0);
  });
});
