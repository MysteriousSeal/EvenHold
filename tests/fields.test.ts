import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { FENCE_THICKNESS, HERO_RADIUS } from '../src/model/constants';
import { TEST_MAP_SIZE, mapsOf } from './support/testWorld';
import { cellKey } from '../src/model/map/grid';
import { buildFieldGeometry } from '../src/view/meshes/field/fieldMesh';
import { WHEAT_VARIANTS } from '../src/view/meshes/field/fieldVoxels';
import { scatterGroundCover } from '../src/view/meshes/cover/groundCoverScatter';
import { TEST_SEEDS, testModel } from './support/testWorld';
import type { Field } from '../src/model/types';

const worlds = TEST_SEEDS.map((seed) => [seed, testModel(seed)] as const);

describe('crop fields', () => {
  it('villages get fields: at least one per village across the test worlds', () => {
    // Per village it depends on the land around it (cramped terrain can
    // leave no room), so this is checked over all worlds together.
    const fields = worlds.reduce((sum, [, w]) => sum + w.fields.length, 0);
    const villages = worlds.reduce((sum, [, w]) => sum + w.villages.length, 0);
    expect(fields).toBeGreaterThanOrEqual(villages);
  });

  it.each(worlds)('seed %i: fields are fenced, on flat, free ground a tile clear of roads', (_, world) => {
    const occupied = new Set([...world.trees, ...world.bushes, ...world.houses, ...world.villages].map((o) => cellKey(o.x, o.z)));
    const bad: string[] = [];
    for (const field of world.fields) {
      for (let x = field.x0; x < field.x0 + field.width; x++) {
        for (let z = field.z0; z < field.z0 + field.depth; z++) {
          if (mapsOf(world).surfaceMap[x][z] !== 'field') bad.push(`${x},${z} not a field tile`);
          if (mapsOf(world).heightMap[x][z] !== field.groundTier || mapsOf(world).lakeMap[x][z]) bad.push(`${x},${z} not flat and dry`);
          if (occupied.has(cellKey(x, z))) bad.push(`${x},${z} has something on it`);
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const s = mapsOf(world).surfaceMap[x + dx]?.[z + dz];
              if (s === 'path' || s === 'plaza') bad.push(`${x},${z} touches a road or square`);
            }
          }
        }
      }
      const [gx, gz] = field.gate;
      const onBorder = gx === field.x0 || gz === field.z0 || gx === field.x0 + field.width - 1 || gz === field.z0 + field.depth - 1;
      if (!onBorder) bad.push(`gate ${gx},${gz} not on the fence line`);
    }
    expect(bad).toEqual([]);
  });

  it.each(worlds)('seed %i: meadow grass and flowers stay out of the crops', (_, world) => {
    const { tufts, flowers, pebbles } = scatterGroundCover(world);
    const inField = [...tufts, ...flowers, ...pebbles].filter((i) => mapsOf(world).surfaceMap[Math.round(i.x)][Math.round(i.z)] === 'field');
    expect(inField).toEqual([]);
  });

  it.each(['corner', 'fence', ...Array.from({ length: WHEAT_VARIANTS }, (_, i) => `wheat:${i}`)])(
    '%s stays inside its tile',
    (model) => {
      const geometry = buildFieldGeometry(model);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
      expect(box.max.y).toBeLessThan(0.45); // below the hero's head: walkable crops
    },
  );

  it('keeps wheat tiles within a triangle budget', () => {
    // A village has a few dozen field tiles; each stays a few thousand triangles.
    for (let v = 0; v < WHEAT_VARIANTS; v++) {
      expect(buildFieldGeometry(`wheat:${v}`).getAttribute('position').count / 3).toBeLessThan(4000);
    }
  });
});

describe('field fences', () => {
  // Walks the hero from `from` toward +x or +z for a second and reports where it ends up.
  const walk = (field: Field, seed: number, from: [number, number], dir: [number, number]) => {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    model.teleport(from[0], from[1]);
    for (let i = 0; i < 60; i++) model.update(dir[0], dir[1], 1 / 60);
    return { model, field };
  };
  // A field with open ground on its -x side, next to a fenced (non-gate) tile.
  const pick = () => {
    for (const seed of TEST_SEEDS) {
      const world = testModel(seed);
      for (const field of world.fields) {
        for (let z = field.z0; z < field.z0 + field.depth; z++) {
          const gate = field.gate[0] === field.x0 && field.gate[1] === z;
          if (!gate && world.isOpenTile(field.x0 - 1, z) && world.isOpenTile(field.x0 - 2, z)) return { seed, field, z };
        }
      }
    }
    throw new Error('no fenced field edge with open ground beside it');
  };

  it('stops the hero at the fence', () => {
    const { seed, field, z } = pick();
    const { model } = walk(field, seed, [field.x0 - 2, z], [1, 0]);
    const fenceLine = field.x0 - 0.5;
    expect(model.hero.x + HERO_RADIUS).toBeLessThanOrEqual(fenceLine + 1e-9);
    expect(model.hero.x + HERO_RADIUS).toBeGreaterThan(fenceLine - 0.1);
  });

  it('lets the hero in through the gate', () => {
    for (const seed of TEST_SEEDS) {
      for (const field of testModel(seed).fields) {
        const [gx, gz] = field.gate;
        // Approach the gate straight on from outside, along whichever border it's on.
        const approaches: Array<[[number, number], [number, number]]> = [];
        if (gx === field.x0) approaches.push([[gx - 1, gz], [1, 0]]);
        if (gz === field.z0) approaches.push([[gx, gz - 1], [0, 1]]);
        for (const [from, dir] of approaches) {
          if (!testModel(seed).isOpenTile(from[0], from[1])) continue;
          const { model } = walk(field, seed, from, dir);
          const inside = model.hero.x > field.x0 - 0.5 + FENCE_THICKNESS && model.hero.z > field.z0 - 0.5 + FENCE_THICKNESS;
          expect(inside).toBe(true);
          return;
        }
      }
    }
    throw new Error('no gate on a -x or -z border with open ground in front');
  });
});
