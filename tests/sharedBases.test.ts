// @vitest-environment happy-dom
// What's said once and built on everywhere: every creature foe's rig on one base (foeRig.ts: its bar, its burst); every
// dungeon's life on one (floorLife.ts: its foes, its floor's loot and coins); every four-legged beast's turning staged
// by one (fourLegged.ts); and where a cloud of cubes is (clouds.ts: its middle, its furthest along a way).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { makeEnemy } from '../src/model/enemies/enemies';
import type { Entrance } from '../src/model/interiors/interiors';
import type { Enemy } from '../src/model/types';
import { middleOf, most } from '../src/view/cinema/morph/clouds';
import type { Cloud } from '../src/view/cinema/morph/voxelMorph';
import { cowStagingOf } from '../src/view/cinema/stagings/cowStaging';
import { ON_ALL_FOURS } from '../src/view/cinema/stagings/fourLegged';
import { horseStaging } from '../src/view/cinema/stagings/horseStaging';
import { pigStagingOf } from '../src/view/cinema/stagings/pigStaging';
import { ratStagingOf } from '../src/view/cinema/stagings/ratStaging';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import { FloorLife } from '../src/view/dungeon/floorLife';
import { BatRig, createBatLook } from '../src/view/meshes/enemy/batRig';
import { BeastRig, WOLF_SPEC, createBeastLook } from '../src/view/meshes/enemy/beastRig';
import { FoeRig } from '../src/view/meshes/enemy/foeRig';
import { GhostRig, createGhostLook } from '../src/view/meshes/enemy/ghostRig';
import { HoundRig, createHoundLook } from '../src/view/meshes/enemy/houndRig';
import { SpiderRig, createSpiderLook } from '../src/view/meshes/enemy/spiderRig';
import { CAVE_SPIDER } from '../src/view/meshes/enemy/spiderVoxels';
import { WormRig, createWormLook } from '../src/view/meshes/enemy/wormRig';
import { PIG_VOXEL_SIZE } from '../src/view/meshes/turned/pigVoxels';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// No canvas in happy-dom: a 2D context that draws nothing (the foes' names over their bars), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

describe('a creature foe', () => {
  const flash = new THREE.MeshBasicMaterial();
  const FOES: Array<[string, Enemy['kind'], (enemy: Enemy) => FoeRig]> = [
    ['a wolf', 'wolf', () => new BeastRig(createBeastLook(WOLF_SPEC, flash))],
    ['a bat', 'caveBat', (enemy) => new BatRig(enemy, createBatLook(flash))],
    ['a worm', 'caveWorm', (enemy) => new WormRig(enemy, createWormLook(flash))],
    ['a spider', 'caveSpider', (enemy) => new SpiderRig(enemy, createSpiderLook(CAVE_SPIDER, flash))],
    ['a ghost', 'ghost', (enemy) => new GhostRig(enemy, createGhostLook(flash))],
    ['a war hound', 'warHound', (enemy) => new HoundRig(enemy, createHoundLook(flash))],
  ];

  it.each(FOES)('%s is drawn on the one base: its bar over it while it lives, gone once slain; let go whole', (_name, kind, make) => {
    const enemy = makeEnemy(1, kind, 0, 0);
    const rig = make(enemy);
    expect(rig).toBeInstanceOf(FoeRig);
    const scene = new THREE.Scene();
    scene.add(rig.root);
    rig.drawnAt(1.5);
    const bar = rig.root.getObjectByName('overhead')!;
    expect(bar).toBeDefined();
    expect(bar.parent).toBe(rig.root); // (over it, not on a part of it that moves)
    rig.update({ ...enemy, state: 'chase' }, 0.1, 1, 1);
    if (kind !== 'caveWorm') expect(bar.visible).toBe(true); // (a worm: only once it's up out of the ground)
    for (let t = 0; t < 30; t++) rig.update({ ...enemy, state: 'dead', hp: 0, deadFor: t * 0.1 }, 0.1, 1, 1);
    expect(bar.visible).toBe(false);
    rig.dispose();
    expect(rig.root.parent).toBeNull();
  });

  it('bursts into cubes once slain, but a ghost: it fades', () => {
    const cubes = (rig: FoeRig) => {
      let n = 0;
      rig.root.traverse((o) => (o instanceof THREE.InstancedMesh ? n++ : 0));
      return n;
    };
    for (const [name, kind, make] of FOES) {
      const enemy = makeEnemy(1, kind, 0, 0);
      const rig = make(enemy);
      for (let t = 0; t < 10; t++) rig.update({ ...enemy, state: 'dead', hp: 0, deadFor: 0.4 + t * 0.1 }, 0.1, 1, 1);
      if (kind === 'ghost') expect(cubes(rig), name).toBe(0);
      else expect(cubes(rig), name).toBeGreaterThan(0);
      rig.dispose();
    }
  });
});

describe("a dungeon's life", () => {
  const into = (model: GameModel, entrance: Entrance) => {
    model.teleport(entrance.x, entrance.z);
    model.useDoor();
    return buildDungeonScene(model.seed, entrance)!;
  };
  const KINDS: Array<[string, () => { model: GameModel; entrance: Entrance }]> = [
    ['a crypt', () => ((model) => ({ model, entrance: model.crypts[0].entrance }))(new GameModel(1, { width: 512, depth: 512 }))],
    ['a cave', () => ((model) => ({ model, entrance: model.caves[0].entrance }))(new GameModel(1, { width: 512, depth: 512 }))],
    ['a stronghold', () => ((model) => ({ model, entrance: model.strongholds[0].entrance }))(new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE))],
  ];

  it.each(KINDS)("%s's is drawn on the one base: its foes near the hero, each in the scene once", (_name, world) => {
    const { model, entrance } = world();
    const built = into(model, entrance);
    expect(built.life).toBeInstanceOf(FloorLife);
    const drawn = () => built.scene.getObjectsByProperty('name', 'overhead').filter((bar) => bar.parent?.parent === built.scene).length; // (a foe's bar, on its rig's root)
    built.life.update(model, 0.1);
    expect(model.foes.length).toBeGreaterThan(0);
    expect(drawn()).toBeGreaterThan(0);
    expect(drawn()).toBeLessThanOrEqual(model.foes.length); // (those near the hero: enemyViews.ts, by Nearby)
    built.life.dispose();
  });
});

describe('a four-legged beast turned into', () => {
  it('is staged by the one builder: down on all fours, the same two beats taken apart, its cubes at its own size', () => {
    for (const staging of [pigStagingOf(), cowStagingOf(), horseStaging, ratStagingOf()]) {
      expect(staging.looseLines?.map(([at]) => at)).toEqual([0, 0.08, 0.4, 0.72]);
      expect(staging.looseLines?.[1][1]).toBe('It comes apart, from the ground up.');
      expect(staging.direct).toBeTypeOf('function');
      const target = staging.target();
      expect(target.root.children.length).toBeGreaterThan(0);
      target.settle(0.5, 1); // (whatever it does, settling)
    }
    expect(pigStagingOf().cloud!().size).toBe(PIG_VOXEL_SIZE);
    expect(ON_ALL_FOURS.arms).toBe(''); // (all four legs at once: no arms told apart)
  });
});

describe('a cloud of cubes', () => {
  const cloud: Cloud = { at: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 1, -1), new THREE.Vector3(-2, 3, 1), new THREE.Vector3(0, 3, 0)], color: [], size: 1 };

  it('has its middle, and its furthest along any way (the first of those as far)', () => {
    expect(middleOf(cloud).toArray()).toEqual([0, 1.5, 0]);
    expect(most(cloud, 'y')).toBe(cloud.at[2]); // (the first of the two at 3)
    expect(most(cloud, 'y', -1)).toBe(cloud.at[0]);
    expect(most(cloud, 'z', -1)).toBe(cloud.at[1]);
    expect(most(cloud, 'x')).toBe(cloud.at[1]);
  });
});
