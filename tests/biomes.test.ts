// The kinds of country (model/scenery/biomes.ts), their own landmarks (biomeScenery.ts) and what grows on their ground
// (view/meshes/cover: biomeCover.ts, wildVoxels.ts), the ground's colour by them (terrain/biomeGround.ts), the bushes'
// looks by them (bush/bushVoxels.ts).

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { generateWorld } from '../src/model/worldgen/world';
import { mapsAsTiles } from '../src/model/map/tiles';
import { BIOMES, createBiomes, type Biome } from '../src/model/scenery/biomes';
import { createForestDensity } from '../src/model/worldgen/trees';
import { sceneryTiles } from '../src/model/scenery/scenery';
import { createCoverScatter } from '../src/view/meshes/cover/groundCoverScatter';
import { BIOME_COVER } from '../src/view/meshes/cover/biomeCover';
import {
  FERN_GRID, FERN_SHAPES, HEATHER_GRID, HEATHER_SHAPES, MUSHROOM_GRID, MUSHROOM_SHAPES, REED_GRID, REED_SHAPES, STONE_GRID, STONE_SHAPES, WILD_PALETTE,
  buildFern, buildHeather, buildMushrooms, buildReeds, buildStone,
} from '../src/view/meshes/cover/wildVoxels';
import { buildScenery, sceneryGrid } from '../src/view/meshes/scenery/sceneryVoxels';
import { buildBushVoxels, BUSH_PALETTE } from '../src/view/meshes/bush/bushVoxels';
import { createGroundColours } from '../src/view/meshes/terrain/biomeGround';
import * as THREE from 'three';
import { TERRAIN_COLORS } from '../src/view/constants';

const MID = { width: 512, depth: 512 };
const world = generateWorld(7, MID);
const model = new GameModel(7, MID, world);

describe('kinds of country', () => {
  const biomes = createBiomes(7, mapsAsTiles(world));
  const counts = new Map<Biome, number>();
  for (let x = 0; x < MID.width; x++) for (let z = 0; z < MID.depth; z++) if (!world.lakeMap[x][z]) counts.set(biomes.at(x, z), (counts.get(biomes.at(x, z)) ?? 0) + 1);

  it('all five on a map, the meadows the most of it', () => {
    for (const kind of BIOMES) expect(counts.get(kind) ?? 0, kind).toBeGreaterThan(500);
    expect(Math.max(...counts.values())).toBe(counts.get('meadow'));
  });

  it('are the seed\'s, the same for any part of the map as the whole', () => {
    const again = createBiomes(7, mapsAsTiles(world));
    for (let i = 0; i < 2000; i++) {
      const [x, z] = [(i * 37) % MID.width, (i * 91) % MID.depth];
      expect(again.at(x, z)).toBe(biomes.at(x, z));
    }
  });

  it('the woods where the trees grow thick; marsh only on low ground, hills only on high', () => {
    const forest = createForestDensity(7);
    const [woods, open]: number[][] = [[], []];
    for (let x = 0; x < MID.width; x += 3) for (let z = 0; z < MID.depth; z += 3) {
      const kind = biomes.at(x, z);
      if (kind === 'forest') woods.push(forest(x, z));
      else open.push(forest(x, z));
      if (kind === 'marsh') expect(world.heightMap[x][z]).toBeLessThanOrEqual(1);
      if (kind === 'hills') expect(world.heightMap[x][z]).toBeGreaterThanOrEqual(3);
    }
    const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
    expect(mean(woods)).toBeGreaterThan(mean(open) * 2);
  });

  it('change no tree: the world made from the seed is as it was (its trees, their kinds, where they stand)', () => {
    expect(generateWorld(7, MID).trees).toEqual(world.trees);
  });
});

describe('the country\'s own landmarks', () => {
  const own = model.scenery.filter((s) => s.kind === 'snag' || s.kind === 'willow' || s.kind === 'tor');
  const biomes = createBiomes(7, model.tiles);

  it('stand here and there, each in its own country', () => {
    expect(own.length).toBeGreaterThan(5);
    const where = { snag: ['heath', 'marsh'], willow: ['marsh'], tor: ['hills'] } as Record<string, Biome[]>;
    for (const s of own) expect(where[s.kind]).toContain(biomes.at(s.x, s.z));
  });

  it('never on or by a dungeon\'s way in, a foe, an animal, a tree, or another piece', () => {
    const tiles = new Set(own.flatMap((s) => sceneryTiles(s).map(([x, z]) => `${x},${z}`)));
    const near = (x: number, z: number, r: number) => {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (tiles.has(`${Math.round(x) + dx},${Math.round(z) + dz}`)) return true;
      return false;
    };
    for (const s of model.strongholds) for (const t of [...s.footing, s.entrance]) expect(near(t.x, t.z, 1)).toBe(false);
    for (const e of [...model.enemies, ...model.wildlife]) expect(near(e.x, e.z, 1)).toBe(false);
    for (const t of model.trees) expect(tiles.has(`${t.x},${t.z}`)).toBe(false);
    const others = model.scenery.filter((s) => !own.includes(s)).flatMap((s) => sceneryTiles(s).map(([x, z]) => `${x},${z}`));
    for (const key of others) expect(tiles.has(key)).toBe(false);
  });

  it('block the way where they stand', () => {
    for (const s of own) expect(model.isOpenTile(s.x, s.z)).toBe(false);
  });

  it('in voxels: something drawn, within its grid', () => {
    for (const kind of ['snag', 'willow', 'tor'] as const) for (let v = 0; v < 4; v++) {
      const g = buildScenery(kind, v);
      expect(g.size).toEqual(sceneryGrid(kind));
      expect(g.cells.some((c) => c !== 0)).toBe(true);
    }
  });
});

describe('what grows on the ground', () => {
  const biomes = createBiomes(7, model.tiles);
  const cover = createCoverScatter(model)(0, 0, MID.width, MID.depth);

  it('each country\'s own plants, and only there', () => {
    const kinds = new Set(cover.wild.map((w) => w.kind));
    for (const kind of ['fern', 'mushroom', 'heather', 'reed', 'stone']) expect(kinds.has(kind as never), kind).toBe(true);
    for (const w of cover.wild) {
      const country = biomes.at(Math.round(w.x), Math.round(w.z));
      expect(w.country).toBe(country);
      expect(BIOME_COVER[country].wild.some((g) => g.kind === w.kind)).toBe(true);
    }
  });

  it('the grass thin in the woods and on the hills', () => {
    const per = (kind: Biome) => {
      const tufts = cover.tufts.filter((t) => t.country === kind).length;
      let tiles = 0;
      for (let x = 0; x < MID.width; x++) for (let z = 0; z < MID.depth; z++) if (!model.tiles.lake(x, z) && biomes.at(x, z) === kind) tiles++;
      return tufts / tiles;
    };
    expect(per('forest')).toBeLessThan(per('meadow'));
    expect(per('hills')).toBeLessThan(per('meadow'));
  });

  it('in voxels: every shape something drawn, in its palette', () => {
    const makers: Array<[(s: number) => { size: number[]; cells: Uint8Array }, number, number[]]> = [
      [buildFern, FERN_SHAPES, FERN_GRID], [buildMushrooms, MUSHROOM_SHAPES, MUSHROOM_GRID], [buildHeather, HEATHER_SHAPES, HEATHER_GRID], [buildReeds, REED_SHAPES, REED_GRID], [buildStone, STONE_SHAPES, STONE_GRID],
    ];
    for (const [build, shapes, grid] of makers) for (let s = 0; s < shapes; s++) {
      const g = build(s);
      expect(g.size).toEqual(grid);
      expect(g.cells.some((c) => c !== 0)).toBe(true);
      expect(Math.max(...g.cells)).toBeLessThanOrEqual(WILD_PALETTE.length);
    }
  });
});

describe('the ground\'s colour and the bushes\' looks', () => {
  it('each country\'s its own, shading into its neighbours\' over a few tiles at a border', () => {
    const tiles = model.tiles;
    const biomes = createBiomes(7, tiles);
    const ground = createGroundColours(biomes, tiles);
    const at = (x: number, z: number) => ground(x, z, tiles.height(x, z)).clone().multiply(new THREE.Color(TERRAIN_COLORS[tiles.height(x, z)]));
    let steps = 0;
    let borders = 0;
    for (let x = 4; x < MID.width - 4; x += 3) for (let z = 4; z < MID.depth - 4; z++) {
      if (tiles.lake(x, z) || tiles.lake(x, z + 1) || tiles.height(x, z) !== tiles.height(x, z + 1)) continue;
      if (biomes.at(x, z) === biomes.at(x, z + 1)) continue;
      if (biomes.at(x, z) === 'marsh' || biomes.at(x, z + 1) === 'marsh') continue; // (mud at the water: its own)
      borders++;
      const [a, b] = [at(x, z), at(x, z + 1)];
      steps = Math.max(steps, Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b));
    }
    expect(borders).toBeGreaterThan(50);
    expect(steps).toBeLessThan(0.2); // (no hard edge from one tile to the next)
  });

  it('gorse starred yellow, bramble with its blackberries; the bushes\' own kinds as they were', () => {
    const colours = (look: Parameters<typeof buildBushVoxels>[0]) => new Set(buildBushVoxels(look, 0).cells);
    expect(colours('gorse').has(BUSH_PALETTE.indexOf(0xd9b23a) + 1)).toBe(true);
    expect(colours('bramble').has(BUSH_PALETTE.indexOf(0x2e1c32) + 1)).toBe(true);
    expect(colours('leafy').has(BUSH_PALETTE.indexOf(0xd9b23a) + 1)).toBe(false);
  });
});
