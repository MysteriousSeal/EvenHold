// A streamed world (16384 tiles a side, made a region at a time round the hero: model/worldgen/regions.ts,
// model/world/liveWorld.ts, worldStreamer.ts): its regions meeting seamlessly and the same every time; a game in it
// set out on made ground, its foes numbered by region; regions made ahead and let go behind, what's known of them
// kept (the same villages, doors, boards), the slain kept slain and the hurt as they were; a region handed over as a
// worker would (cloned), adopted; a game saved far from where it set out and taken up again; an older save (its doors
// by their place in the list) read as ever; and the view drawing and dropping regions as they come and go.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameModel } from '../src/model/GameModel';
import { REGION, STREAMED_SIZE, generateRegionLand, regionGround } from '../src/model/worldgen/regions';
import { buildRegion } from '../src/model/world/worldStreamer';
import { STREAMED_FOE_ID, isWorldFoe } from '../src/model/enemies/foeIds';
import { doorNumber } from '../src/model/interiors/interiors';
import { parseSave, restore, snapshot } from '../src/model/save';
import { ChunkStreamer } from '../src/view/world/chunkStreamer';
import { WorldRegions } from '../src/view/world/worldRegions';
import { FRAME, TEST_MAP_SIZE } from './support/testWorld';

const SEED = 7;
const LONG = 120_000; // ms: a region takes a few hundred to make, here on the test's own thread

// One streamed game for the tests that only look (made once: its regions take a while).
let shared: GameModel | null = null;
const game = () => (shared ??= new GameModel(SEED, STREAMED_SIZE));

describe('a streamed world\'s regions', () => {
  it(
    'meet their neighbours seamlessly (the same ground and water as made across the border), and are the same every time',
    () => {
      const [a, b] = [generateRegionLand(SEED, 15, 15), generateRegionLand(SEED, 16, 15)];
      const border = 16 * REGION;
      const across = regionGround(SEED, border - 40, 15 * REGION, 80, REGION, STREAMED_SIZE);
      for (let z = 15 * REGION; z < 16 * REGION; z++) {
        expect(Math.abs(a.tiles.height(border - 1, z) - b.tiles.height(border, z))).toBeLessThanOrEqual(1);
        for (const [x, land] of [[border - 1, a], [border, b]] as const) {
          expect(land.tiles.height(x, z)).toBe(across.heightMap[x - (border - 40)][z - 15 * REGION]);
          expect(land.tiles.lake(x, z)).toBe(across.lakeMap[x - (border - 40)][z - 15 * REGION]);
        }
      }
      const again = generateRegionLand(SEED, 15, 15);
      expect([...again.tiles.heights]).toEqual([...a.tiles.heights]);
      expect(again.villages).toEqual(a.villages);
      expect(again.trees.length).toBe(a.trees.length);
      for (const v of a.villages) expect(Math.min(v.x - a.x0, v.z - a.z0, a.x0 + REGION - 1 - v.x, a.z0 + REGION - 1 - v.z)).toBeGreaterThanOrEqual(24); // (none near its edges)
    },
    LONG,
  );

  it(
    'a game set out on made ground, its foes numbered by their region (none twice), its own',
    () => {
      const model = game();
      expect(model.world.streamed).toBe(true);
      expect(model.world.has(model.hero.x, model.hero.z)).toBe(true);
      expect(model.enemies.length).toBeGreaterThan(100);
      expect(model.enemies.every((e) => e.id >= STREAMED_FOE_ID && isWorldFoe(e.id))).toBe(true);
      expect(new Set(model.enemies.map((e) => e.id)).size).toBe(model.enemies.length);
      expect(new Set(model.npcs.map((n) => n.id)).size).toBe(model.npcs.length);
      expect(model.villages.length).toBeGreaterThan(10);
    },
    LONG,
  );
});

describe('walking a streamed world', () => {
  it(
    'makes the regions ahead and lets go those behind; what\'s known of them kept, the same; the slain slain, the hurt hurt',
    () => {
      const model = new GameModel(SEED, STREAMED_SIZE);
      const start = { x: model.hero.x, z: model.hero.z };
      const before = new Set(model.world.loaded());
      const foe = model.enemies.find((e) => e.kind === 'wolf' || e.kind === 'boar')!;
      const hurt = model.enemies.find((e) => e !== foe && Math.abs(e.x - foe.x) < 400 && Math.abs(e.z - foe.z) < 400)!;
      model.slain.add(foe.id);
      hurt.hp = 1;
      const village = model.villages.find((v) => Math.abs(v.x - start.x) < 300 && Math.abs(v.z - start.z) < 300) ?? model.villages[0];
      const door = model.entrances[0];
      // Off a long way east, a frame or so each region's worth: those behind let go.
      for (let x = start.x; x < start.x + 2000; x += 40) {
        model.teleport(x, start.z);
        for (let f = 0; f < 4; f++) model.update(0, 0, FRAME);
      }
      for (let f = 0; f < 20; f++) model.update(0, 0, FRAME);
      expect([...before].some((i) => !model.world.loaded().includes(i))).toBe(true); // (let go behind)
      expect(model.enemies.includes(hurt)).toBe(false);
      expect(model.world.has(start.x, start.z)).toBe(false);
      expect(model.isOpenTile(Math.floor(start.x), Math.floor(start.z))).toBe(false); // (its ground not made: no way on)
      expect(model.villages).toContain(village); // (known still)
      // And back: the same villages and doors, the slain still slain, the hurt still hurt.
      model.teleport(start.x, start.z);
      for (let f = 0; f < 20; f++) model.update(0, 0, FRAME);
      expect(model.world.has(start.x, start.z)).toBe(true);
      expect(model.villages.filter((v) => v.x === village.x && v.z === village.z)).toEqual([village]);
      expect(model.doorAt(doorNumber(door))).toBe(door);
      expect(model.enemies.some((e) => e.id === foe.id)).toBe(false);
      expect(model.enemies.find((e) => e.id === hurt.id)?.hp).toBe(1);
      for (const npc of model.npcs) expect(model.villages).toContain(npc.village); // (linked to the known villages)
    },
    LONG,
  );

  it(
    'a region made off the game\'s thread (cloned, as a worker\'s message is) adopted as any',
    () => {
      const model = game();
      const [rx, rz] = [Math.floor(model.hero.x / REGION) + 3, Math.floor(model.hero.z / REGION)];
      const built = structuredClone(buildRegion(SEED, STREAMED_SIZE, rx, rz));
      const enemies = model.enemies.length;
      model.world.adopt(built);
      expect(model.world.isLoaded(rx, rz)).toBe(true);
      expect(model.enemies.length).toBeGreaterThan(enemies);
      const x = rx * REGION + 200;
      expect(model.tiles.has(x, rz * REGION + 200)).toBe(true);
    },
    LONG,
  );
});

describe('a streamed game saved and taken up again', () => {
  it(
    'where they were (far from where they set out), the slain gone, a shop kept by its door, a quest by its board',
    () => {
      const model = new GameModel(SEED, STREAMED_SIZE);
      const village = model.villages[0];
      const board = model.boardOf(village);
      const offer = model.quests.offersAt(board)[0];
      expect(model.quests.accept(offer)).toBe(true);
      const foe = model.enemies.find((e) => e.kind === 'wolf')!;
      model.slain.add(foe.id);
      const inn = model.entrances.find((e) => e.type === 'inn')!;
      model.shops.set(doorNumber(inn), { money: 4321, stock: {}, restockedAt: Date.now() });
      model.teleport(model.hero.x + 900, model.hero.z + 300);
      const at = { x: model.hero.x, z: model.hero.z };
      const data = parseSave(JSON.stringify(snapshot(model)), SEED)!;
      expect(data.size).toEqual(STREAMED_SIZE);
      const again = new GameModel(SEED, STREAMED_SIZE);
      restore(again, data);
      expect([again.hero.x, again.hero.z]).toEqual([at.x, at.z]);
      expect(again.world.has(at.x, at.z)).toBe(true);
      expect(again.slain.has(foe.id)).toBe(true);
      expect(again.shops.get(doorNumber(inn))?.money).toBe(4321);
      expect(again.quests.taken.map((t) => t.quest.key)).toEqual([offer.key]);
      expect(again.villageOf(board)).toBeDefined();
    },
    LONG,
  );
});

describe('an older save (version 1: its doors by their place among the world\'s)', () => {
  it('read as ever: where they were indoors, a shop by its door', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    const data = snapshot(model);
    const index = model.entrances.indexOf(inn);
    const old = { ...data, version: 1, size: undefined, hero: { ...data.hero, inside: index, lastInn: index }, shops: [{ inn: index, money: 777, stock: {}, restockedAt: Date.now() }], doors: [], lets: [] };
    const again = new GameModel(1, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(old), 1)!);
    expect(again.inside?.entrance).toBe(again.entrances[index]);
    expect(again.lastInn).toBe(again.entrances[index]);
    expect(again.shops.get(doorNumber(again.entrances[index]))?.money).toBe(777);
  });
});

describe('a streamed world drawn', () => {
  it(
    'each region made drawn (its own layers), each let go dropped (its meshes and materials with it)',
    () => {
      const model = game();
      const scene = new THREE.Scene();
      const sink = new ChunkStreamer(scene);
      const regions = new WorldRegions(sink, model, () => {});
      regions.drawAll();
      sink.loadAround(model.hero.x, model.hero.z);
      const meshes = () => {
        let n = 0;
        scene.traverse((o) => void ((o as THREE.InstancedMesh).isInstancedMesh && n++));
        return n;
      };
      const [drawn, materials] = [meshes(), sink.materials().length];
      expect(drawn).toBeGreaterThan(50);
      const index = model.world.loaded().find((i) => model.world.contents(i)!.area.x0 <= model.hero.x && model.hero.x < model.world.contents(i)!.area.x1 && model.world.contents(i)!.area.z0 <= model.hero.z && model.hero.z < model.world.contents(i)!.area.z1)!;
      const across = Math.ceil(STREAMED_SIZE.depth / REGION);
      model.world.unload(Math.floor(index / across), index % across);
      regions.update();
      expect(meshes()).toBeLessThan(drawn);
      expect(sink.materials().length).toBeLessThan(materials);
    },
    LONG,
  );
});
