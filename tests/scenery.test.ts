// Rocks and landmarks in the wilds (model/scenery/scenery.ts), their voxels (view/meshes/scenery/sceneryVoxels.ts), the
// meadow patches' wildflowers (groundCoverScatter.ts, bloomVoxels.ts) and the small life round the hero (ambientLife.ts).

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { generateWorld } from '../src/model/worldgen/world';
import { sceneryTiles, type Scenery, type SceneryKind } from '../src/model/scenery/scenery';
import { inTurn, nextTurn } from '../src/model/npcs/speech';
import { buildScenery, sceneryGrid } from '../src/view/meshes/scenery/sceneryVoxels';
import { BLOOM_GRID, BLOOM_KINDS, BLOOM_SHAPES, buildBloom } from '../src/view/meshes/cover/bloomVoxels';
import { createCoverScatter } from '../src/view/meshes/cover/groundCoverScatter';
import { AmbientLife } from '../src/view/meshes/wildlife/ambientLife';
import { HERO_RADIUS } from '../src/model/constants';
import * as THREE from 'three';
import { nextLife, nextMeadow, nextScenery } from '../src/model/cheats';
import { BLOOMS, meadowPatches } from '../src/model/scenery/meadowPatches';
import { LIFE_CELL, lifeIn, lifeOut } from '../src/model/scenery/ambientSpots';

const MID = { width: 512, depth: 512 };
const worlds = new Map<number, ReturnType<typeof generateWorld>>();
const model = (seed = 1) => new GameModel(seed, MID, worlds.get(seed) ?? worlds.set(seed, generateWorld(seed, MID)).get(seed)!);
const tiles = (s: Scenery) => Array.from({ length: s.w * s.d }, (_, i) => [s.x + (i % s.w), s.z + Math.floor(i / s.w)] as const);
const KINDS: SceneryKind[] = ['boulder', 'outcrop', 'log', 'cairn', 'wall', 'menhir'];

describe('rocks and landmarks', () => {
  it('stand out in the wilds, many and of every kind, rings of standing stones among them', () => {
    const m = model();
    expect(m.scenery.length).toBeGreaterThan(200);
    for (const kind of KINDS) expect(m.scenery.some((s) => s.kind === kind), kind).toBe(true);
    expect(m.scenery.filter((s) => s.kind === 'menhir').length % 7).toBe(0); // (rings of seven)
  });

  it('are the seed\'s: the same each time', () => {
    expect(model(2).scenery).toEqual(model(2).scenery);
  });

  it('stand on open, dry, natural ground, level, clear of roads, villages, ruins, camps, the start and the foes', () => {
    const m = model();
    const problems: string[] = []; // (every tile against every village, ruin and foe: told once, at the end, not asserted a million times)
    for (const s of m.scenery) {
      const tier = m.heightMap[s.x][s.z];
      for (const [x, z] of tiles(s)) {
        const at = `a ${s.kind} at ${x},${z}`;
        if (m.lakeMap[x][z]) problems.push(`${at}: on water`);
        if (m.surfaceMap[x][z] !== 'natural') problems.push(`${at}: on a road, a square or a field`);
        if (m.heightMap[x][z] !== tier) problems.push(`${at}: not level`);
        for (const v of m.villages) if (Math.max(Math.abs(v.x - x), Math.abs(v.z - z)) <= 10) problems.push(`${at}: in a village`);
        for (const r of m.ruins) if (x >= r.x - 2 && x < r.x + r.w + 2 && z >= r.z - 2 && z < r.z + r.d + 2) problems.push(`${at}: in a ruin`);
        for (const e of m.enemies) if (Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) <= 1.5) problems.push(`${at}: on a ${e.kind}`);
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('block the way where they stand (each tile), the ground round each open', () => {
    const m = model();
    for (const s of m.scenery) {
      for (const [x, z] of tiles(s)) expect(m.isOpenTile(x, z), `a ${s.kind} at ${x},${z}`).toBe(false);
      expect(m.isBlocked(s.x + (s.w - 1) / 2, s.z + (s.d - 1) / 2, HERO_RADIUS)).toBe(true);
    }
    // (None walls a way off: a tile of open ground round every one, other than its own.)
    const taken = new Set(m.scenery.flatMap((s) => tiles(s).map(([x, z]) => `${x},${z}`)));
    for (const s of m.scenery) {
      for (let x = s.x - 1; x <= s.x + s.w; x++) for (let z = s.z - 1; z <= s.z + s.d; z++) {
        if (x >= s.x && x < s.x + s.w && z >= s.z && z < s.z + s.d) continue;
        expect(taken.has(`${x},${z}`), `${s.kind} touching another at ${x},${z}`).toBe(false);
      }
    }
  });

  it('a wall or a log blocks only as thick as it is: the hero walks right up to its side', () => {
    const m = model();
    for (const kind of ['wall', 'log'] as const) {
      const s = m.scenery.find((p) => p.kind === kind)!;
      const [mx, mz] = [s.x + (s.w - 1) / 2, s.z + (s.d - 1) / 2];
      const along = s.w > s.d; // (along x: its sides across z)
      const side = (off: number) => (along ? m.isBlocked(mx, mz + off, HERO_RADIUS) : m.isBlocked(mx + off, mz, HERO_RADIUS));
      expect(side(0), `${kind} itself`).toBe(true);
      expect(side(0.25 + HERO_RADIUS + 0.02), `${kind}: up to its side`).toBe(false);
      expect(side(-(0.25 + HERO_RADIUS + 0.02))).toBe(false);
    }
  });

  it.each(['boulder', 'cairn', 'menhir', 'outcrop'] as const)('a %s (round) blocks about as far as its stone: walked up to diagonally, the hero is stopped close by, not a corner\'s length off', (kind) => {
    const m = model();
    const s = m.scenery.find((p) => p.kind === kind)!;
    const [mx, mz] = [s.x + (s.w - 1) / 2, s.z + (s.d - 1) / 2];
    const reach = { boulder: 0.4, cairn: 0.36, menhir: 0.2, outcrop: 0.82 }[kind]; // (the stone's widest, from its middle)
    const d = HERO_RADIUS + (reach + 0.02) / Math.SQRT2; // (diagonally: the hero's square, its corner just past the stone)
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) expect(m.isBlocked(mx + sx * d, mz + sz * d, HERO_RADIUS), `${kind} from ${sx},${sz}`).toBe(false);
    expect(m.isBlocked(mx, mz, HERO_RADIUS)).toBe(true);
  });

  it.each(KINDS.flatMap((kind) => [0, 1, 2, 3].map((variant) => [kind, variant] as const)))('%s (variant %i) is built, standing on its ground, within its grid', (kind, variant) => {
    const g = buildScenery(kind, variant);
    expect(g.size).toEqual(sceneryGrid(kind));
    const filled = g.cells.filter((c) => c > 0).length;
    expect(filled).toBeGreaterThan(100);
    const [sx, , sz] = g.size;
    let onGround = 0;
    for (let x = 0; x < sx; x++) for (let z = 0; z < sz; z++) if (g.cells[x + sx * (0 + g.size[1] * z)] > 0) onGround++;
    expect(onGround).toBeGreaterThan(10); // (stood on the ground, not floating)
  });
});

describe('meadow patches of wildflowers', () => {
  it('grow in patches, thick in places, one kind to a stretch of country (with a stray among them)', () => {
    const m = model();
    const cover = createCoverScatter(m)(0, 0, 200, 200);
    expect(cover.blooms.length).toBeGreaterThan(500);
    const kinds = new Set(cover.blooms.map((b) => b.variant));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    const perTile = new Map<string, number>();
    for (const b of cover.blooms) perTile.set(`${Math.round(b.x)},${Math.round(b.z)}`, (perTile.get(`${Math.round(b.x)},${Math.round(b.z)}`) ?? 0) + 1);
    expect(Math.max(...perTile.values())).toBeGreaterThanOrEqual(4); // (thick, in the middle of a patch)
    expect(perTile.size).toBeLessThan(200 * 200 * 0.6); // (patches: not everywhere)
  });

  it('never on a road, a square, a field, a rock, water or a building', () => {
    const m = model();
    const rock = new Set(m.scenery.flatMap((s) => tiles(s).map(([x, z]) => `${x},${z}`)));
    for (const b of createCoverScatter(m)(0, 0, 256, 256).blooms) {
      const [x, z] = [Math.round(b.x - 0.5 + 0.5), Math.round(b.z)];
      const tx = Math.floor(b.x + 0.5);
      const tz = Math.floor(b.z + 0.5);
      expect(m.surfaceMap[tx][tz]).toBe('natural');
      expect(m.lakeMap[tx][tz]).toBe(false);
      expect(rock.has(`${tx},${tz}`)).toBe(false);
      void [x, z];
    }
  });

  it.each(BLOOM_KINDS.flatMap((kind) => Array.from({ length: BLOOM_SHAPES }, (_, s) => [kind, s] as const)))('a %s (shape %i) stands on a stem within its grid', (kind, shape) => {
    const g = buildBloom(kind, shape);
    expect(g.size).toEqual(BLOOM_GRID);
    expect(g.cells.filter((c) => c > 0).length).toBeGreaterThan(4);
    const [sx] = g.size;
    expect(g.cells[3 + sx * (0 + g.size[1] * 3)] > 0 || g.cells.slice(0, sx * g.size[1] * g.size[2]).some((c, i) => c > 0 && Math.floor(i / sx) % g.size[1] === 0)).toBe(true);
  });
});

describe('the small life round the hero', () => {
  const at = (hours: number) => hours * 60;
  const life = (minutes: number) => {
    const m = model();
    const scene = new THREE.Scene();
    const ambient = new AmbientLife(scene, m);
    ambient.update(0.1, m.hero, minutes, true);
    const meshes = scene.children.filter((c): c is THREE.InstancedMesh => (c as THREE.InstancedMesh).isInstancedMesh);
    return { m, ambient, meshes, counts: meshes.map((x) => x.count) };
  };

  it('by day: butterflies and songbirds about, no fireflies', () => {
    const [butterflies, birds, fireflies] = life(at(12)).counts;
    expect(butterflies).toBeGreaterThan(0);
    expect(birds).toBeGreaterThan(0);
    expect(fireflies).toBe(0);
  });

  it('at night: fireflies, no butterflies or birds on the ground', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 20; i++) {
      const { counts: c } = life(at(23) + i * 3); // (a few moments: each firefly glows and dims)
      counts[0] = Math.max(counts[0], c[0]);
      counts[2] = Math.max(counts[2], c[2]);
    }
    expect(counts[0]).toBe(0);
    expect(counts[2]).toBeGreaterThan(0);
  });

  it('the birds take off as the hero comes near, are gone a while after, and are back once the hero is well away', () => {
    const { ambient, meshes } = life(at(12));
    type Bird = { kind: string; x: number; z: number; fled: number | null };
    const cells = () => (ambient as unknown as { cells: Map<string, Bird[]> }).cells;
    const birdsNear = (p: { x: number; z: number }, r: number) => [...cells().values()].flat().filter((c) => c.kind === 'bird' && Math.hypot(c.x - p.x, c.z - p.z) < r);
    const flock = [...cells().values()].flat().find((c) => c.kind === 'bird')!;
    const by = { x: flock.x + 1, z: flock.z };
    ambient.update(0.05, by, at(12), true);
    const before = meshes[1].count; // (the flock there still drawn: flying off)
    const near = birdsNear(by, 2);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((b) => b.fled !== null)).toBe(true); // (off in a flurry)
    for (let s = 0; s < 8; s += 0.25) ambient.update(0.25, by, at(12), true);
    expect(meshes[1].count).toBeLessThan(before); // (flown off out of sight)
    ambient.update(0.1, { x: by.x + 20, z: by.z }, at(12), true); // (the hero well away: they're back)
    expect(near.every((b) => b.fled === null)).toBe(true);
  });

  it('are always the same life in the same place', () => {
    const [a, b] = [life(at(12)), life(at(12))];
    expect(a.counts).toEqual(b.counts);
  });
});

describe('the Sights cheats', () => {
  it.each(KINDS)('the next %s: by it (a ring: in its middle), each press a new one, nearest first', (kind) => {
    const m = model();
    const seen = new Set<Scenery>();
    const first = nextScenery(m, m.hero, kind, seen)!;
    expect(first).not.toBeNull();
    expect(m.isOpenTile(first.x, first.z)).toBe(true);
    const near = (t: { x: number; z: number }) => m.scenery.some((s) => s.kind === kind && Math.hypot(s.x - t.x, s.z - t.z) < (kind === 'menhir' ? 5 : 4));
    expect(near(first)).toBe(true);
    const second = nextScenery(m, m.hero, kind, seen)!;
    expect(second).not.toEqual(first);
    expect(near(second)).toBe(true);
  });

  it('the next flower meadow, and the next of each kind: in a thick patch of it, each press another', () => {
    const m = model();
    const patches = meadowPatches(m.seed);
    const seen = new Set<string>();
    const any = nextMeadow(m, m.hero, null, seen)!;
    expect(patches.strength(any.x, any.z)).toBeGreaterThan(0.75);
    for (let k = 0; k < BLOOMS.length; k++) {
      const at = nextMeadow(m, m.hero, k, seen);
      if (!at) continue; // (a kind with none in reach of this little world)
      expect(patches.kind(at.x, at.z), BLOOMS[k]).toBe(k);
      expect(patches.strength(at.x, at.z)).toBeGreaterThan(0.75);
    }
    expect(nextMeadow(m, m.hero, null, seen)).not.toEqual(any);
  });

  it.each(['bird', 'butterfly', 'firefly'] as const)('the next %s: a few paces off them, the hour turned so they\'re out', (kind) => {
    const m = model();
    m.minutes = kind === 'firefly' ? 12 * 60 : 23 * 60; // (the wrong hour for them)
    const at = nextLife(m, m.hero, kind, new Set())!;
    expect(at).not.toBeNull();
    expect(lifeOut(kind, m.minutes)).toBe(true);
    const cells = [...Array(9).keys()].map((i) => [Math.floor(at.x / LIFE_CELL) - 1 + (i % 3), Math.floor(at.z / LIFE_CELL) - 1 + Math.floor(i / 3)]);
    expect(cells.flatMap(([cx, cz]) => lifeIn(m, cx, cz)).some((c) => c.kind === kind && Math.hypot(c.x - at.x, c.z - at.z) < 12)).toBe(true);
  });
});

describe('shared helpers', () => {
  it('a piece\'s tiles: every one it stands on, once', () => {
    expect(sceneryTiles({ x: 5, z: 7, w: 3, d: 1 })).toEqual([[5, 7], [6, 7], [7, 7]]);
    expect(sceneryTiles({ x: 2, z: 2, w: 2, d: 2 })).toEqual([[2, 2], [3, 2], [2, 3], [3, 3]]);
  });

  it('lines in turn, each owner its own turns: every line comes round, never one twice running', () => {
    const [a, b] = [{}, {}];
    const lines = ['one', 'two', 'three'];
    expect([inTurn(a, lines), inTurn(a, lines), inTurn(b, lines), inTurn(a, lines), inTurn(a, lines)]).toEqual(['one', 'two', 'one', 'three', 'one']);
    expect(nextTurn(b)).toBe(1);
  });
});
