// A cave's beasts (model/caves/caveFoes.ts), gone down to: there of the
// cave's level, gone again climbing out. A spider spits a web: it flies at
// the hero and webs them (slower), or stops at the rock. A worm, underground,
// can't be seen, struck or bumped into; it bursts up under the hero (told
// first, the ground heaving), catching them; up a while to be fought; then
// down again. The silk walls her nest off till four fifths of the cave's
// cleared. The brood mother lies still on her silk till the hero comes
// into her nest; hurt, her brood hatches (not counted toward clearing it);
// slain, a point to spend (once), the cave cleared, her hoard, and the crack
// to the daylight open: the way out. The slain stay slain (out and back in, and
// in a save). And its beasts drop their own spoils (drawn: caveView.test.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { caveInside } from '../src/model/caves/caves';
import { CAVE_FOE_ID, TEARS_AT } from '../src/model/caves/caveFoes';
import { ERUPT_TELL, SURFACED } from '../src/model/caves/caveMoves';
import { isFloor } from '../src/model/dungeons/floorPlan';
import { walkFactor } from '../src/model/hero/blessing';
import { blowTarget } from '../src/model/hero/combat';
import { rollDrop } from '../src/model/loot/loot';
import { JUNK_ITEMS } from '../src/model/loot/junk';
import { parseSave, restore, snapshot } from '../src/model/save';
import { resetCrypts } from '../src/model/cheats';
import type { Enemy } from '../src/model/types';
import { FRAME } from './support/testWorld';

const MID = { width: 512, depth: 512 };
const goIn = (model: GameModel) => {
  const cave = model.caves[0];
  model.teleport(cave.entrance.x, cave.entrance.z);
  model.useDoor();
  return cave;
};
const run = (model: GameModel, seconds: number, until: () => boolean = () => false) => {
  for (let t = 0; t < seconds && !until(); t += FRAME) model.update(0, 0, FRAME);
};
// The foe alone (the rest slain, not counted), the hero `far` tiles from it along open floor in plain view.
const alone = (model: GameModel, foe: Enemy, far: number) => {
  for (const f of model.foes) if (f !== foe) f.state = 'dead';
  const { plan } = caveInside(model.seed, model.inside!.entrance);
  const spot = [[far, 0], [-far, 0], [0, far], [0, -far]]
    .map(([dx, dz]) => ({ x: foe.x + dx, z: foe.z + dz }))
    .find((p) => Array.from({ length: 9 }, (_, i) => i / 8).every((t) => model.cave!.free(foe.x + (p.x - foe.x) * t, foe.z + (p.z - foe.z) * t, 0.2) && isFloor(plan, Math.round(foe.x + (p.x - foe.x) * t), Math.round(foe.z + (p.z - foe.z) * t))));
  if (!spot) return false;
  Object.assign(model.hero, { x: spot.x, z: spot.z, maxHp: 10_000, hp: 10_000 });
  model.random = () => 0.99; // (no dodging)
  return true;
};

describe('a cave\'s beasts', () => {
  it('are there going in (the world\'s foes are not), of the cave\'s level, bats, spiders and worms (the worms underground), and the brood mother; gone again climbing out', () => {
    const model = new GameModel(1, MID);
    const cave = goIn(model);
    const kinds = new Set(model.foes.map((f) => f.kind));
    for (const kind of ['caveBat', 'caveSpider', 'caveWorm', 'broodMother'] as const) expect(kinds.has(kind)).toBe(true);
    expect(model.foes.every((f) => f.level === cave.level && f.id >= CAVE_FOE_ID)).toBe(true);
    expect(model.foes.filter((f) => f.kind === 'caveWorm').every((w) => w.buried)).toBe(true);
    expect(model.takeEvents()).toContainEqual({ kind: 'arrive', name: cave.name, level: cave.level });
    const { plan } = caveInside(model.seed, cave.entrance);
    Object.assign(model.hero, { x: plan.door, z: plan.depth - 1 });
    model.useDoor();
    expect(model.cave).toBeNull();
    expect(model.foes).toBe(model.enemies);
  });

  it('a spider spits a web at the hero from a little way off: it flies, and catching them, webs them (they walk slower)', () => {
    const model = new GameModel(1, MID);
    goIn(model);
    const spider = model.foes.find((f) => f.kind === 'caveSpider' && alone(model, f, 4))!;
    expect(spider).toBeDefined();
    run(model, 10, () => model.cave!.webs.length > 0);
    expect(model.cave!.webs.length).toBeGreaterThan(0);
    expect(spider.told === 'web' || spider.windUp === null).toBe(true);
    run(model, 3, () => walkFactor(model.hero) < 1);
    expect(walkFactor(model.hero)).toBeLessThan(0.5);
  });

  it('a worm underground can\'t be focused, struck or bumped into; it bursts up under the hero (the ground heaving first), catching them; up a while to be fought; then down again', () => {
    const model = new GameModel(1, MID);
    goIn(model);
    const worm = model.foes.find((f) => f.kind === 'caveWorm' && alone(model, f, 2.5))!;
    expect(worm).toBeDefined();
    model.focus(worm.id);
    expect(model.focused).toBeNull();
    Object.assign(model.hero, { x: worm.x + 0.4, z: worm.z, facing: -Math.PI / 2 });
    expect(blowTarget(model.hero, model.foes, null)).toBeNull();
    Object.assign(model.hero, { x: worm.x + 2.5, z: worm.z });
    const hp = model.hero.hp;
    run(model, 12, () => worm.told === 'erupt');
    expect(worm.told).toBe('erupt');
    const heave = model.cave!.eruptions.moves[0];
    expect(Math.hypot(heave.tx - model.hero.x, heave.tz - model.hero.z)).toBeLessThan(0.01); // (under where the hero stood)
    expect(worm.buried).toBe(true);
    run(model, ERUPT_TELL + 0.1);
    expect(worm.buried).toBe(false);
    expect(model.hero.hp).toBeLessThan(hp); // (still standing on it: caught)
    model.focus(worm.id);
    expect(model.focused).toBe(worm);
    const hole = { x: worm.x, z: worm.z };
    Object.assign(model.hero, { x: worm.x + 2, z: worm.z });
    run(model, 1.5);
    expect([worm.x, worm.z]).toEqual([hole.x, hole.z]); // (up, rooted in its hole: not coming on)
    run(model, SURFACED + 3, () => !!worm.buried);
    expect(worm.buried).toBe(true);
  });

  it('the brood mother lies still on her silk till the hero comes into her nest; hurt, her brood hatches (not counted); slain, a point (once), the cave cleared, her hoard, the crack open to the daylight: the way out', () => {
    const model = new GameModel(1, MID);
    const cave = goIn(model);
    const { plan } = caveInside(model.seed, cave.entrance);
    const nest = plan.hollows.at(-1)!;
    const mother = model.foes.find((f) => f.kind === 'broodMother')!;
    for (const f of model.foes) if (f !== mother) [(f.state = 'dead'), model.slayGuard(f)];
    Object.assign(model.hero, { x: nest.x, z: nest.z + nest.r + 4, maxHp: 10_000, hp: 10_000 });
    if (!model.cave!.free(model.hero.x, model.hero.z, 0.2)) Object.assign(model.hero, { x: plan.door, z: plan.depth - 1 });
    run(model, 2);
    expect(mother.state).toBe('wander');
    expect(Math.hypot(mother.x - nest.x, mother.z - nest.z)).toBeLessThan(0.01);
    model.takeEvents();
    Object.assign(model.hero, { x: nest.x + 1.5, z: nest.z });
    run(model, FRAME);
    expect(mother.state).toBe('chase');
    expect(model.takeEvents()).toContainEqual({ kind: 'stirs', name: 'The brood mother' });
    const share = model.clearedShare(cave.entrance);
    mother.hp = Math.floor(mother.maxHp * 0.6);
    run(model, FRAME);
    const young = model.foes.filter((f) => f.kind === 'hatchling');
    expect(young.length).toBeGreaterThan(0);
    expect(young.length).toBeLessThanOrEqual(3);
    expect(model.takeEvents().some((e) => e.kind === 'brood')).toBe(true);
    for (const y of young) [(y.state = 'dead'), model.slayGuard(y)];
    expect(model.clearedShare(cave.entrance)).toBe(share); // (her young aren't counted)
    mother.hp = Math.floor(mother.maxHp * 0.3);
    run(model, FRAME);
    expect(model.foes.filter((f) => f.kind === 'hatchling').length).toBeGreaterThan(young.length);
    const points = model.hero.statPoints;
    mother.hp = 0;
    mother.state = 'dead';
    model.slayGuard(mother);
    run(model, FRAME);
    expect(model.hero.statPoints).toBe(points + 1);
    expect(model.clearedShare(cave.entrance)).toBe(1);
    const told = model.takeEvents();
    expect(told).toContainEqual({ kind: 'cleared', name: cave.name, point: true, place: 'cave' });
    const hoard = model.cave!.chest!;
    expect(hoard.open).toBe(false);
    Object.assign(model.hero, { x: hoard.x, z: hoard.z + 0.5 });
    expect(model.cave!.chestInReach(model.hero)).toBe(true);
    const lying = model.groundHere.loot.length;
    model.cave!.openChest();
    expect(hoard.open).toBe(true);
    expect(model.groundHere.loot.length).toBe(lying + 1);
    // The way out: the crack, open; there, the door's the way back up to the hills, outside the cave's mouth.
    const exit = model.cave!.exitOpen!;
    Object.assign(model.hero, { x: exit.x, z: exit.z });
    expect(model.doorInReach).toBe(cave.entrance);
    model.useDoor();
    expect(model.inside).toBeNull();
    // Back in: she's gone, the hoard empty, still cleared; the point not given again.
    goIn(model);
    expect(model.foes.some((f) => f.kind === 'broodMother')).toBe(false);
    expect(model.cave!.chest?.open).toBe(true);
    expect(model.clearedShare(cave.entrance)).toBe(1);
  });

  it('the silk walls her nest off till most of the cave\'s cleared: the hero can\'t get through it, told so coming up to it; at four fifths cleared it tears (told), and stays torn (back in, in a save)', () => {
    const model = new GameModel(1, MID);
    const cave = goIn(model);
    const inside = caveInside(model.seed, cave.entrance);
    expect(model.cave!.sealed).toBe(true);
    const t = inside.seal[0];
    expect(model.cave!.free(t.x, t.z, 0.2)).toBe(false);
    for (const f of model.foes) f.state = 'dead'; // (none to bother the hero: not slain, not counted)
    Object.assign(model.hero, { x: t.x, z: t.z });
    for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (model.cave!.free(t.x + dx, t.z + dz, 0.2)) Object.assign(model.hero, { x: t.x + dx, z: t.z + dz });
    model.takeEvents();
    run(model, 0.2);
    expect(model.takeEvents().filter((e) => e.kind === 'walled')).toHaveLength(1);
    run(model, 0.5);
    expect(model.takeEvents().filter((e) => e.kind === 'walled')).toHaveLength(0); // (once, while they stay)
    const beasts = model.foes.filter((f) => f.kind !== 'broodMother');
    const needed = Math.ceil(TEARS_AT * (beasts.length + 1));
    for (const f of beasts.slice(0, needed - 1)) model.slayGuard(f);
    run(model, FRAME);
    expect(model.cave!.sealed).toBe(true);
    model.slayGuard(beasts[needed - 1]);
    run(model, FRAME);
    expect(model.cave!.sealed).toBe(false);
    expect(model.takeEvents()).toContainEqual({ kind: 'torn' });
    expect(model.cave!.free(t.x, t.z, 0.2)).toBe(true);
    const loaded = new GameModel(1, MID);
    restore(loaded, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(loaded.cave!.sealed).toBe(false);
    loaded.update(0, 0, FRAME);
    expect(loaded.takeEvents().some((e) => e.kind === 'torn')).toBe(false); // (torn before: not told again)
  });

  it('the slain stay slain, out and back in, and in a save; all back at their posts with the Reset dungeons cheat', () => {
    const model = new GameModel(1, MID);
    goIn(model);
    const all = model.foes.length;
    for (const f of model.foes.slice(0, 3)) [(f.state = 'dead'), model.slayGuard(f)];
    const loaded = new GameModel(1, MID);
    restore(loaded, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(loaded.cave).not.toBeNull();
    expect(loaded.foes).toHaveLength(all - 3);
    resetCrypts(model);
    expect(model.inside).toBeNull();
    goIn(model);
    expect(model.foes).toHaveLength(all);
  });

  it('drop their own spoils (silk, venom, chitin, wings, teeth), and only those', () => {
    const vermin = Object.entries(JUNK_ITEMS).filter(([, item]) => (item.droppedBy as Record<string, number>).vermin).map(([id]) => id);
    expect(vermin).toHaveLength(5);
    const drops = new Set(Array.from({ length: 400 }, (_, i) => rollDrop('vermin', i, 1)));
    expect([...drops].every((id) => id !== null && vermin.includes(id))).toBe(true);
    expect(drops.size).toBe(5);
  });
});
