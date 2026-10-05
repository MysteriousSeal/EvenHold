import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { talkPrompt, talkingTo } from '../src/model/npcs/talk';
import { MAX_ENERGY } from '../src/model/hero/heroStats';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 30;

describe('talking', () => {
  it('is to whoever talks (the barmaid, the smith) nearest the hero in their room, within reach', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    expect(talkingTo(model.npcs, null, model.hero)).toBeNull(); // outdoors: no one
    enterNearest(model, 'inn', new Set());
    const inside = model.inside!;
    const barmaid = model.npcs.find((n) => n.role === 'barkeep' && n.where === inside.entrance)!;
    const server = model.npcs.find((n) => n.role === 'server' && n.where === inside.entrance)!;
    Object.assign(model.hero, { x: barmaid.x + 1, z: barmaid.z });
    Object.assign(server, { x: model.hero.x + 0.3, z: model.hero.z }); // the server closer: she doesn't talk (the inn's work's on its notice board)
    expect(talkingTo(model.npcs, inside, model.hero)).toBe(barmaid);
    Object.assign(model.hero, { x: barmaid.x + 3, z: barmaid.z }); // out of reach
    expect(talkingTo(model.npcs, inside, model.hero)).toBeNull();
  });

  it('is never to someone in another building', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(model, 'smithy', new Set());
    const inside = model.inside!;
    const smith = model.npcs.find((n) => n.role === 'smith' && n.where === inside.entrance)!;
    const barmaid = model.npcs.find((n) => n.role === 'barkeep')!;
    Object.assign(model.hero, { x: smith.x + 1, z: smith.z });
    Object.assign(barmaid, { x: model.hero.x, z: model.hero.z + 0.2 }); // right there, but in her inn
    expect(talkingTo(model.npcs, inside, model.hero)).toBe(smith);
  });

  it('is prompted each its own way', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const barmaid = model.npcs.find((n) => n.role === 'barkeep')!;
    const smith = model.npcs.find((n) => n.role === 'smith')!;
    expect(talkPrompt(barmaid)).toBe(`Talk to ${barmaid.name}`);
    expect(talkPrompt(smith)).toBe(`Trade with ${smith.name}`);
  });
});

describe('out of energy', () => {
  it('collapses outdoors and wakes in the nearest inn, before its hearth', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const inns = model.entrances.filter((e) => e.type === 'inn');
    const far = inns[inns.length - 1];
    model.teleport(far.x, far.z + 2); // by the last inn
    model.hero.energy = 0.0001;
    model.update(0, 0, FRAME);
    const nearest = inns.reduce((a, b) => (Math.hypot(b.x - far.x, b.z - far.z - 2) < Math.hypot(a.x - far.x, a.z - far.z - 2) ? b : a));
    expect(model.inside?.entrance).toBe(nearest);
    expect(model.inside?.seated?.seat.lying).toBe(true);
    expect(model.hero.energy).toBeGreaterThan(0);
  });

  it('collapses from inside a building too, to the inn nearest it', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(model, 'smithy', new Set());
    const smithy = model.inside!.entrance;
    model.hero.energy = 0.0001;
    model.update(0, 0, FRAME);
    const inns = model.entrances.filter((e) => e.type === 'inn');
    const nearest = inns.reduce((a, b) => (Math.hypot(b.x - smithy.x, b.z - smithy.z) < Math.hypot(a.x - smithy.x, a.z - smithy.z) ? b : a));
    expect(model.inside?.entrance).toBe(nearest);
  });

  it('never collapses asleep in a bed: energy comes back there', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(model, 'house', new Set());
    const house = model.inside!.entrance;
    const bed = model.inside!.furniture.find((f) => f.kind === 'bed')!;
    Object.assign(model.hero, { x: bed.x + 0.8, z: bed.z + 0.5 }); // beside it, within reach
    expect(model.sitOrStand()).toBe(true);
    expect(model.inside?.seated?.seat.lying).toBe(true);
    model.hero.energy = 0;
    model.update(0, 0, 1);
    expect(model.inside?.entrance).toBe(house); // still in bed, at home
    expect(model.hero.energy).toBeGreaterThan(0);
    expect(model.hero.energy).toBeLessThan(MAX_ENERGY);
  });
});
