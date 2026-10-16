import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LIFE_CELL, LIFE_HOUR, lifeIn, lifeOut, perchesOn, type LifeWorld } from '../src/model/scenery/ambientSpots';
import { herdIn, inPasture, stepBeast, stockOf, troughOf, type Beast } from '../src/model/wildlife/livestock';
import { fenceEdges } from '../src/model/worldgen/fields';
import { stepWildlife } from '../src/model/wildlife/wildlife';
import { mapsAsTiles } from '../src/model/map/tiles';
import type { Field } from '../src/model/types';
import { AmbientLife, weathered } from '../src/view/meshes/wildlife/ambientLife';
import { DeerRig, createDeerLook } from '../src/view/meshes/wildlife/deerRig';
import { weatherNow } from '../src/view/meshes/common/weatherNow';
import { FRAME, TEST_SEEDS, testModel } from './support/testWorld';

// A 60x60 world: a lake in the middle, grass all round it.
function pondWorld(seed = 1): LifeWorld {
  const n = 60;
  const lakeMap = Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, z) => Math.hypot(x - 30, z - 30) < 14));
  const tiles = mapsAsTiles({ heightMap: lakeMap.map((r) => r.map(() => 0)), lakeMap, surfaceMap: lakeMap.map((r) => r.map(() => 'natural' as const)) });
  return { seed, tiles, isOpenTile: (x, z) => x >= 0 && z >= 0 && x < n && z < n };
}
const cells = (n: number) => Array.from({ length: n * n }, (_, i) => [Math.floor(i / n), i % n] as const);
const FIELD: Field = { x0: 10, z0: 20, width: 4, depth: 5, groundTier: 0, rowsAlongX: true, gate: [10, 22], corner: [13, 24] };

describe('the small life by the water, and the rabbits', () => {
  const world = pondWorld();
  const all = cells(10).flatMap(([cx, cz]) => lifeIn(world, cx, cz));
  const of = (kind: string) => all.filter((c) => c.kind === kind);
  const lake = (x: number, z: number) => world.tiles.lake(Math.floor(x), Math.floor(z));

  it('dragonflies and frogs keep to the bank, fish out on open water, rabbits on the grass', () => {
    for (const kind of ['dragonfly', 'frog', 'fish', 'rabbit']) expect(of(kind).length, kind).toBeGreaterThan(0);
    for (const c of [...of('dragonfly'), ...of('frog')]) {
      expect(lake(c.x, c.z)).toBe(false);
      const [x, z] = [Math.floor(c.x), Math.floor(c.z)];
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => lake(x + dx, z + dz))).toBe(true);
    }
    expect(of('heron').length).toBeGreaterThan(0);
    for (const c of of('heron')) {
      expect(lake(c.x, c.z)).toBe(true); // (in the shallows, a step off the bank)
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !lake(c.x + dx, c.z + dz))).toBe(true);
    }
    for (const c of of('fish')) for (const [dx, dz] of [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) expect(lake(c.x + dx, c.z + dz)).toBe(true);
  });

  it('are the same every time for a seed, and the older kinds where they ever were', () => {
    expect(cells(10).flatMap(([cx, cz]) => lifeIn(world, cx, cz))).toEqual(all);
    // (each patch's new kinds after its old ones: those where they were before there were any)
    for (const [cx, cz] of cells(10)) {
      const kinds = lifeIn(world, cx, cz).map((c) => ['butterfly', 'bird', 'firefly'].includes(c.kind));
      expect(kinds.indexOf(false) === -1 || kinds.lastIndexOf(true) < kinds.indexOf(false)).toBe(true);
    }
  });

  it('come out at their own hours: frogs of an evening and the night, dragonflies by day, fish always', () => {
    expect(lifeOut('frog', 22 * 60)).toBe(true);
    expect(lifeOut('frog', 13 * 60)).toBe(false);
    expect(lifeOut('dragonfly', 13 * 60)).toBe(true);
    expect(lifeOut('dragonfly', 23 * 60)).toBe(false);
    expect(lifeOut('fish', 3 * 60) && lifeOut('fish', 15 * 60)).toBe(true);
    expect(lifeOut('bird', 5.5 * 60)).toBe(true); // (up with the dawn)
    for (const [kind, hour] of Object.entries(LIFE_HOUR)) expect(lifeOut(kind as keyof typeof LIFE_HOUR, hour * 60), kind).toBe(true);
  });
});

describe('the small life, by country and weather', () => {
  it('frogs and dragonflies keep to the marsh\'s banks when there are any, rabbits out of the woods and the marsh', () => {
    const plain = pondWorld();
    const marshy: LifeWorld = { ...plain, biomes: { at: (x, z) => (z < 30 ? 'marsh' : x < 20 ? 'forest' : 'meadow'), woods: (x) => (x < 20 ? 1 : 0) } };
    const all = cells(10).flatMap(([cx, cz]) => lifeIn(marshy, cx, cz));
    const banked = (world: LifeWorld, marsh: boolean) => cells(10).flatMap(([cx, cz]) => lifeIn(world, cx, cz)).filter((c) => (c.kind === 'frog' || c.kind === 'dragonfly') && c.z < 30 === marsh).length;
    expect(banked(marshy, true)).toBe(banked(plain, true)); // (the marsh's banks as ever)
    expect(banked(marshy, false)).toBeLessThan(banked(plain, false)); // (and fewer elsewhere)
    expect(banked(marshy, false)).toBeGreaterThan(0);
    for (const c of all.filter((c) => c.kind === 'rabbit')) expect(Math.floor(c.z) < 30 || Math.floor(c.x) < 20).toBe(false);
  });

  it('each country its own: hares and grouse on the heath, goats on the hills, boar and owls in the woods, herons in the marsh\'s reeds', () => {
    const plain = pondWorld();
    const band = (x: number) => (['heath', 'hills', 'forest', 'marsh', 'meadow'] as const)[Math.min(4, Math.floor(x / 12))];
    const lands = (seed: number): LifeWorld => ({ ...pondWorld(seed), biomes: { at: (x) => band(x), woods: (x) => (band(x) === 'forest' ? 1 : 0) } });
    const all = [1, 2, 3, 4].flatMap((seed) => cells(10).flatMap(([cx, cz]) => lifeIn(lands(seed), cx, cz)));
    const home = { hare: 'heath', grouse: 'heath', goat: 'hills', boar: 'forest', owl: 'forest' } as const;
    for (const [kind, country] of Object.entries(home)) {
      const these = all.filter((c) => c.kind === kind);
      expect(these.length, kind).toBeGreaterThan(0);
      for (const c of these) expect([c.x - 1.6, c.x + 1.6].map((x) => band(Math.floor(x))), kind).toContain(country); // (a herd spread round its home)
    }
    expect(all.some((c) => c.kind === 'heron' && !plain.tiles.lake(Math.floor(c.x), Math.floor(c.z)) && band(Math.floor(c.x)) === 'marsh')).toBe(true);
    expect(cells(10).flatMap(([cx, cz]) => lifeIn(plain, cx, cz)).some((c) => c.kind in home)).toBe(false); // (none where the countries aren't known)
  });

  it('in the rain the birds and butterflies are under cover, and the frogs out even by day', () => {
    const dry = { x: 1, z: 0, strength: 0.4, rain: 0, fog: 0, snow: 0, season: 'spring' as const };
    const wet = { ...dry, rain: 0.8 };
    expect(weathered('bird', true, dry) + weathered('butterfly', true, dry)).toBe(2);
    expect(weathered('bird', true, wet) + weathered('butterfly', true, wet) + weathered('dragonfly', true, wet)).toBe(0);
    expect(weathered('frog', false, dry)).toBe(0);
    expect(weathered('frog', false, wet)).toBe(1);
    expect(weathered('dragonfly', true, { ...dry, fog: 0.8 })).toBe(0);
  });

  it('in winter no butterflies, dragonflies or frogs and fewer birds; fewer insects in autumn; fireflies only in summer', () => {
    const day = { x: 1, z: 0, strength: 0.4, rain: 0, fog: 0, snow: 0 };
    for (const kind of ['butterfly', 'dragonfly', 'frog', 'firefly'] as const) expect(weathered(kind, true, { ...day, season: 'winter' }), kind).toBe(0);
    expect(weathered('bird', true, { ...day, season: 'winter' })).toBeGreaterThan(0);
    expect(weathered('bird', true, { ...day, season: 'winter' })).toBeLessThan(1);
    expect(weathered('butterfly', true, { ...day, season: 'autumn' })).toBeLessThan(weathered('butterfly', true, { ...day, season: 'summer' }));
    expect(weathered('heron', true, { ...day, season: 'winter' })).toBe(1);
    for (const season of ['spring', 'autumn', 'winter'] as const) expect(weathered('firefly', true, { ...day, season }), season).toBe(0); // (fireflies: summer's only)
    expect(weathered('firefly', true, { ...day, season: 'summer' })).toBe(1);
    expect(weathered('crow', true, { ...day, season: 'winter' })).toBeLessThan(1); // (and fewer flocks over)
  });
});

describe('songbirds on the fences', () => {
  it('sit on a stretch of a field\'s fence (crows, a sown field\'s), at most one to a post, the same every time', () => {
    const perched = TEST_SEEDS.flatMap((seed) => perchesOn(FIELD, seed));
    expect(perched.length).toBeGreaterThan(0);
    const edges = fenceEdges(FIELD);
    for (const b of perched) {
      expect(b.perch).toBe(true);
      expect(edges.some(({ x, z }) => Math.abs(b.x - x) <= 0.46 + 1e-9 && Math.abs(b.z - z) <= 0.46 + 1e-9)).toBe(true);
    }
    for (const seed of TEST_SEEDS) {
      const birds = perchesOn(FIELD, seed);
      for (const b of birds) expect(b.kind).toBe(stockOf(FIELD, seed) === null ? 'crow' : 'bird'); // (crows on a sown field's fence, songbirds on a pasture's)
      expect(perchesOn(FIELD, seed)).toEqual(birds);
      expect(new Set(birds.map((b) => `${b.x},${b.z}`)).size).toBe(birds.length);
    }
  });
});

describe('livestock', () => {
  const fields = TEST_SEEDS.flatMap((seed) => testModel(seed).fields.map((field) => ({ seed, field })));
  const herds = fields.map(({ seed, field }) => ({ field, herd: herdIn(field, seed) }));

  it('some fields are pastures (most sown), the beasts of each of one kind, in the field and off its hay corner; the same every time', () => {
    expect(fields.length).toBeGreaterThan(4);
    const stocked = herds.filter((h) => h.herd.length > 0);
    expect(stocked.length).toBeGreaterThan(fields.length / 5);
    expect(stocked.length).toBeLessThan(fields.length * 0.6);
    expect(new Set(stocked.flatMap((h) => h.herd.map((b) => b.kind))).size).toBeGreaterThan(1);
    for (const { field, herd } of herds) {
      expect(new Set(herd.map((b) => b.kind)).size).toBeLessThanOrEqual(1);
      for (const b of herd) expect(inPasture(field, b.x, b.z, 0)).toBe(true);
    }
    for (const { seed, field } of fields) {
      expect(herdIn(field, seed)).toEqual(herdIn(field, seed));
      const herd = herdIn(field, seed);
      if (herd.length > 0) expect(stockOf(field, seed)).toBe(herd[0].kind);
    }
  });

  it('graze and wander about the field a few minutes, never out of it', () => {
    const stocked = herds.filter((h) => h.herd.length > 0).slice(0, 6);
    let walked = 0;
    let stood = 0;
    for (const { field, herd } of stocked) {
      for (let t = 0; t < 120; t += 0.1) {
        for (const b of herd) {
          stepBeast(b, field, { x: -100, z: -100 }, 0.1);
          expect(inPasture(field, b.x, b.z, 0)).toBe(true);
          if (b.speed > 0) walked++;
          else stood++;
        }
      }
    }
    expect(walked).toBeGreaterThan(0);
    expect(stood).toBeGreaterThan(walked); // (mostly stood grazing)
  });

  it('keep clear of the trough, beside the hay, inside the field', () => {
    for (const { field } of herds) {
      const [tx, tz] = troughOf(field);
      expect(tx >= field.x0 && tx < field.x0 + field.width && tz >= field.z0 && tz < field.z0 + field.depth).toBe(true);
      expect(Math.abs(tx - field.corner[0]) + Math.abs(tz - field.corner[1])).toBe(1);
      expect(inPasture(field, tx, tz)).toBe(false);
    }
  });

  it('shy off from the hero right by them, but stay in their field', () => {
    const { field, herd } = herds.find((h) => h.herd.length > 0)!;
    const beast: Beast = { ...herd[0], target: null };
    const hero = { x: beast.x + 0.3, z: beast.z };
    for (let t = 0; t < 1.5; t += 0.05) stepBeast(beast, field, hero, 0.05);
    expect(Math.hypot(beast.x - hero.x, beast.z - hero.z)).toBeGreaterThan(0.5);
    expect(inPasture(field, beast.x, beast.z, 0)).toBe(true);
  });
});

describe('deer, wary and abed', () => {
  const model = TEST_SEEDS.map(testModel).find((m) => m.wildlife.some((a) => a.kind === 'deer'))!;
  const herd = () => model.wildlife.find((a) => a.kind === 'deer')!.pack;

  it('stop and watch the hero come, heads up, before they run', () => {
    const deer = herd();
    const hero = { x: deer[0].x + 5, z: deer[0].z };
    for (let t = 0; t < 1; t += FRAME) stepWildlife(deer, model, hero, FRAME);
    for (const d of deer) {
      expect(d.wary).toBe(true);
      expect(d.fleeing).toBe(false);
      expect(d.speed).toBe(0);
      expect(d.dabble).toBeNull();
    }
    expect(Math.abs(deer[0].heading - Math.atan2(hero.x - deer[0].x, hero.z - deer[0].z))).toBeLessThan(1e-6);
    for (let t = 0; t < 1; t += FRAME) stepWildlife(deer, model, { x: deer[0].x + 1, z: deer[0].z }, FRAME);
    expect(deer.every((d) => d.fleeing && !d.wary)).toBe(true);
    for (let t = 0; t < 8; t += FRAME) stepWildlife(deer, model, { x: -500, z: -500 }, FRAME); // (left be)
  });

  it('lie down for the night, and are up and off when the hero comes on them', () => {
    const minutes = model.minutes;
    model.minutes = 23 * 60;
    const deer = herd();
    const far = { x: deer[0].x + 12, z: deer[0].z + 12 };
    for (let t = 0; t < 1; t += FRAME) stepWildlife(deer, model, far, FRAME);
    expect(deer.every((d) => d.bedded && d.speed === 0)).toBe(true);
    const rig = new DeerRig(deer[0], createDeerLook());
    const top = () => (rig.root.updateMatrixWorld(true), new THREE.Box3().setFromObject(rig.root).max.y);
    deer[0].bedded = false;
    rig.update(deer[0], FRAME);
    const standing = top();
    deer[0].bedded = true;
    for (let i = 0; i < 120; i++) rig.update(deer[0], FRAME);
    expect(top()).toBeLessThan(standing - 0.05);
    for (let t = 0; t < 1; t += FRAME) stepWildlife(deer, model, { x: deer[0].x + 1, z: deer[0].z }, FRAME);
    expect(deer.every((d) => d.fleeing && !d.bedded)).toBe(true);
    model.minutes = minutes;
  });
});

describe('the living world drawn round the hero', () => {
  it('draws the life near the hero only, the livestock in their fields, and smoke from the chimneys downwind', () => {
    const model = TEST_SEEDS.map(testModel).find((m) => m.fields.some((f) => herdIn(f, m.seed).length > 0) && m.houses.length > 0)!;
    const scene = new THREE.Scene();
    const life = new AmbientLife(scene, model);
    const field = model.fields.find((f) => herdIn(f, model.seed).length > 0)!;
    const hero = { x: field.x0 + field.width / 2, z: field.z0 - 4 };
    for (let i = 0; i < 30; i++) life.update(FRAME, hero, 12 * 60, true);
    const shown = scene.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && o.visible && o.count > 0);
    expect(shown.length).toBeGreaterThan(2); // (the beasts' parts, the smoke, and the life about)
    const point = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    for (const mesh of shown) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        point.setFromMatrixPosition(matrix);
        expect(Math.abs(point.x - hero.x)).toBeLessThan(LIFE_CELL * 5 + 3); // (nothing drawn far off)
        expect(Math.abs(point.z - hero.z)).toBeLessThan(LIFE_CELL * 5 + 3);
      }
    }
    // Far off from everything: none of it drawn.
    const away = { x: -5000, z: -5000 };
    for (let i = 0; i < 3; i++) life.update(FRAME, away, 12 * 60, true);
    expect(scene.children.filter((o) => o instanceof THREE.InstancedMesh && o.visible && o.count > 0).length).toBe(0);
  });

  it('the wind blows one way, from still to a full wind, gusting', () => {
    for (let m = 0; m < 24 * 60; m += 37) {
      const w = weatherNow(3, m, m * 0.7);
      expect(Math.hypot(w.x, w.z)).toBeCloseTo(1);
      expect(w.strength).toBeGreaterThanOrEqual(0);
      expect(w.strength).toBeLessThanOrEqual(1);
    }
  });
});
