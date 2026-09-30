import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { FURNITURE_KINDS } from '../src/model/interiors/furniture';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { YARD_SIZE, furnitureYard } from '../src/model/interiors/furnitureYard';
import { buildFurnitureYard } from '../src/view/interior/furnitureYard';
import { HERO_RADIUS } from '../src/model/constants';
import { squareBenches } from '../src/model/worldgen/benches';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

describe('furniture yard', () => {
  const yard = furnitureYard();

  it('places every kind, and the copies that look different, in a tight block', () => {
    const kinds = new Set(yard.furniture.map((f) => f.kind));
    expect([...kinds].sort()).toEqual([...FURNITURE_KINDS].sort());
    expect(yard.furniture.filter((f) => f.kind === 'bed').map((f) => f.cloth).sort()).toEqual([0, 1, 2, 3]);
    expect(yard.furniture.filter((f) => f.kind === 'armorStand').map((f) => f.suit).sort()).toEqual([0, 1, 2, 3]);
    expect(yard.furniture.filter((f) => f.kind === 'hallDoor').map((f) => !!f.open).sort()).toEqual([false, true]);
    const walls = yard.furniture.filter((f) => f.kind === 'hallWall');
    expect(walls.some((f) => f.tall)).toBe(true);
    expect(walls.some((f) => !f.tall)).toBe(true);
    const maxX = Math.max(...yard.furniture.map((f) => f.x + f.w));
    const maxZ = Math.max(...yard.furniture.map((f) => f.z + f.d));
    expect(maxX).toBeLessThan(40);
    expect(maxZ).toBeLessThan(48);
    for (let i = 0; i < yard.furniture.length; i++) {
      for (let j = i + 1; j < yard.furniture.length; j++) {
        const a = yard.furniture[i];
        const b = yard.furniture[j];
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.z + a.d <= b.z || b.z + b.d <= a.z;
        expect(apart, `${a.kind} overlaps ${b.kind}`).toBe(true);
      }
    }
    expect(bumpsFurniture(yard.furniture, yard.spawn.x, yard.spawn.z, 0.14)).toBe(false);
  });

  it('sends the hero there and back, and keeps them on the grass', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const { x, z } = model.hero;
    expect(model.toggleFurnitureYard()).toBe('The furniture yard.');
    expect(model.yard).not.toBeNull();
    expect(model.inside).toBeNull();
    expect(model.hero.y).toBe(0);
    for (let i = 0; i < 400; i++) model.update(1, 0, 1 / 60);
    expect(model.hero.x).toBeGreaterThan(-0.5);
    expect(model.hero.x).toBeLessThan(YARD_SIZE);
    expect(model.toggleFurnitureYard()).toBe('Back where you were.');
    expect(model.yard).toBeNull();
    expect(model.hero.x).toBeCloseTo(x);
    expect(model.hero.z).toBeCloseTo(z);
  });

  it('lets go of the focused foe, and brings a hero sat on a bench back standing in front of it, free to walk', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    model.focus(model.enemies[0].id);
    const bench = squareBenches(model)[0];
    model.teleport(bench.x + bench.front[0] * 0.7, bench.z + bench.front[1] * 0.7);
    expect(model.sitOrStand()).toBe(true);
    const from = model.seated!.from;
    model.toggleFurnitureYard();
    expect(model.focused).toBeNull();
    model.toggleFurnitureYard();
    expect(model.seated).toBeNull();
    expect([model.hero.x, model.hero.z]).toEqual([from.x, from.z]);
    expect(model.isBlocked(model.hero.x, model.hero.z, HERO_RADIUS)).toBe(false);
    for (let i = 0; i < 60; i++) model.update(bench.front[0], bench.front[1], 1 / 60);
    expect(Math.hypot(model.hero.x - from.x, model.hero.z - from.z)).toBeGreaterThan(0.5);
  });

  it('builds a mesh for every piece', () => {
    const view = buildFurnitureYard(yard.furniture);
    const meshes = view.scene.children.filter((child) => (child as { isMesh?: boolean }).isMesh);
    expect(meshes.length).toBeGreaterThan(yard.furniture.length); // the grass, plus a leaf on each door
    view.dispose();
  });
});
