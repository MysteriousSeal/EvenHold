import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DABBLE_TIME, WATER_Y, spawnDucks, stepDuckPack, swimmable, type DuckWorld } from '../src/model/wildlife/ducks';
import { stepWildlife, type Wildlife } from '../src/model/wildlife/wildlife';
import { DuckRig, createDuckLook } from '../src/view/meshes/wildlife/duckRig';

// A 60x60 world: a lake with a 4-tile shore all round and a small island.
function lakeWorld(seed = 1): DuckWorld {
  const size = { width: 60, depth: 60 };
  const lakeMap = Array.from({ length: 60 }, (_, x) =>
    Array.from({ length: 60 }, (_, z) => x >= 4 && x < 56 && z >= 4 && z < 56 && !(x >= 28 && x < 32 && z >= 28 && z < 32)),
  );
  return { seed, size, lakeMap };
}
const FRAME = 1 / 30;
const far = { x: -100, z: -100 };

describe('ducks', () => {
  const world = lakeWorld();
  const ducks = spawnDucks(world, 0);

  it('come in packs of 2 or 3 on open water, led by a drake or a hen', () => {
    expect(ducks.length).toBeGreaterThan(6);
    const packs = new Set(ducks.map((d) => d.pack));
    for (const pack of packs) {
      expect(pack.length === 2 || pack.length === 3).toBe(true);
      expect(['drake', 'hen']).toContain(pack[0].variant);
      if (pack.length === 2) expect(pack.map((d) => d.variant)).toEqual(['drake', 'hen']);
      else expect(pack.filter((d) => d.variant === 'duckling').length).toBeGreaterThan(0);
      for (const duck of pack) {
        expect(swimmable(world, duck.x, duck.z)).toBe(true);
        expect(duck.y).toBe(WATER_Y);
      }
    }
    expect(new Set(ducks.map((d) => d.id)).size).toBe(ducks.length);
  });

  it('are placed the same way every time, and never on dry land', () => {
    expect(spawnDucks(world, 0).map((d) => [d.x, d.z, d.variant])).toEqual(ducks.map((d) => [d.x, d.z, d.variant]));
    const dry: DuckWorld = { ...world, lakeMap: world.lakeMap.map((row) => row.map(() => false)) };
    expect(spawnDucks(dry, 0)).toEqual([]);
  });

  it('wander, rest and dabble without ever leaving the water, the pack staying together', () => {
    const own = spawnDucks(world, 0);
    let dabbled = false;
    let moved = false;
    const start = own.map((d) => [d.x, d.z]);
    const packs = [...new Set(own.map((d) => d.pack))];
    for (let t = 0; t < 60; t += FRAME) {
      for (const pack of packs) stepDuckPack(pack, world, far, FRAME); // stepWildlife would skip them all, the hero being far
      for (const duck of own) {
        expect(swimmable(world, duck.x, duck.z)).toBe(true);
        if (duck.dabble !== null && duck.dabble >= 0) {
          dabbled = true;
          expect(duck.dabble).toBeLessThan(DABBLE_TIME);
        }
        const leader = duck.pack[0];
        expect(Math.hypot(duck.x - leader.x, duck.z - leader.z)).toBeLessThan(2.5);
      }
    }
    own.forEach((d, i) => (moved ||= Math.hypot(d.x - start[i][0], d.z - start[i][1]) > 0.5));
    expect(moved).toBe(true);
    expect(dabbled).toBe(true);
  });

  it('paddle away when the hero comes near, then settle once they are gone', () => {
    const own = spawnDucks(world, 0);
    const pack = own[0].pack;
    const hero = { x: pack[0].x + 1.5, z: pack[0].z };
    const before = Math.hypot(pack[0].x - hero.x, pack[0].z - hero.z);
    stepDuckPack(pack, world, hero, FRAME);
    expect(pack.every((d) => d.fleeing)).toBe(true);
    for (let t = 0; t < 3; t += FRAME) stepDuckPack(pack, world, hero, FRAME);
    expect(Math.hypot(pack[0].x - hero.x, pack[0].z - hero.z)).toBeGreaterThan(before + 1);
    for (const duck of pack) expect(swimmable(world, duck.x, duck.z)).toBe(true);
    for (let t = 0; t < 1; t += FRAME) stepDuckPack(pack, world, far, FRAME);
    expect(pack.some((d) => d.fleeing)).toBe(false);
  });

  it('only act near the hero', () => {
    const own = spawnDucks(world, 0);
    const before = JSON.stringify(own.map((d) => [d.x, d.z]));
    for (let t = 0; t < 5; t += FRAME) stepWildlife(own, world, { x: 500, z: 500 }, FRAME);
    expect(JSON.stringify(own.map((d) => [d.x, d.z]))).toBe(before);
  });

  it('are in the game world too', async () => {
    const { GameModel } = await import('../src/model/GameModel');
    const { TEST_MAP_SIZE, TEST_SEEDS } = await import('./support/testWorld');
    const counts = TEST_SEEDS.slice(0, 4).map((seed) => new GameModel(seed, TEST_MAP_SIZE).wildlife.length);
    expect(counts.some((n) => n > 0)).toBe(true);
  });
});

describe('duck rig', () => {
  const look = createDuckLook();
  const at = (duck: Wildlife) => {
    const rig = new DuckRig(duck, look);
    rig.update(duck, FRAME);
    rig.root.updateMatrixWorld(true);
    return { rig, box: new THREE.Box3().setFromObject(rig.root) };
  };

  it('floats at the water line, small next to the hero, the duckling smaller still', () => {
    const [drake, hen] = spawnDucks(lakeWorld(), 0);
    const duckling = spawnDucks(lakeWorld(), 0).find((d) => d.variant === 'duckling')!;
    for (const duck of [drake, hen]) {
      const { box } = at(duck);
      expect(box.min.y).toBeLessThan(WATER_Y); // its underside is under water
      expect(box.max.y - WATER_Y).toBeGreaterThan(0.08);
      expect(box.max.y - WATER_Y).toBeLessThan(0.2);
    }
    const adult = at(drake).box.getSize(new THREE.Vector3());
    const small = at(duckling).box.getSize(new THREE.Vector3());
    expect(small.y).toBeLessThan(adult.y);
  });

  it('tips headfirst to dabble, tail in the air', () => {
    const [drake] = spawnDucks(lakeWorld(), 0);
    const { rig } = at(drake);
    drake.dabble = DABBLE_TIME / 2;
    rig.update(drake, FRAME);
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.root);
    expect(box.min.y).toBeLessThan(WATER_Y - 0.05); // the head is under
  });

  it('leaves a wake that floats clear of the water and swells smoothly, even when its pace jitters', () => {
    const [drake] = spawnDucks(lakeWorld(), 0);
    const { rig } = at(drake);
    const wake = rig.root.children[rig.root.children.length - 1];
    const foam = (wake.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const opacities: number[] = [];
    for (let i = 0; i < 90; i++) {
      drake.speed = i % 2 === 0 ? 1.2 : 0; // stop-start every frame
      rig.update(drake, FRAME);
      opacities.push(foam.opacity);
    }
    const late = opacities.slice(60);
    expect(Math.max(...late) - Math.min(...late)).toBeLessThan(0.05); // no blinking
    expect(late[0]).toBeGreaterThan(0.2); // but a wake all the same
    rig.root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(wake).min.y).toBeGreaterThan(WATER_Y); // never on the water's own plane
    drake.speed = 0;
    for (let i = 0; i < 90; i++) rig.update(drake, FRAME);
    expect(wake.visible).toBe(false); // gone once it's still
  });
});
