// @vitest-environment happy-dom
// The hero's shape through what hides them outdoors (view/meshes/human/heroSilhouette.ts): a copy of each of their
// meshes, drawn only where the world's in front (after the world, before the hero, never writing depth), a new piece
// worn given its own; shown outdoors, hidden indoors. And a foe's, outdoors, while it comes for the hero or is focused.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { HeroSilhouette } from '../src/view/meshes/human/heroSilhouette';
import { EnemyViews } from '../src/view/meshes/enemy/enemyViews';
import { GameModel } from '../src/model/GameModel';
import { INDOOR_SCALE } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

describe("the hero's silhouette", () => {
  it('copies every mesh of theirs, drawn behind the world only, between it and the hero', () => {
    const rig = new HumanRig();
    const silhouette = new HeroSilhouette();
    silhouette.update(rig, true);
    const copies = rig.meshes.map((m) => m.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && c.renderOrder === 1)!);
    expect(copies.every((c) => c && c.visible)).toBe(true);
    const material = copies[0].material as THREE.MeshBasicMaterial;
    expect([material.depthFunc, material.depthWrite, material.fog]).toEqual([THREE.GreaterDepth, false, false]);
    expect(rig.meshes.every((m) => m.renderOrder === 2)).toBe(true); // (the hero over it, where they're seen)
    expect(copies.every((c, i) => c.geometry === rig.meshes[i].geometry)).toBe(true);
    const before = rig.meshes.length;
    rig.wear({ torso: 'gambeson', head: 'leatherCap' });
    silhouette.update(rig, false);
    expect(rig.meshes.length).toBeGreaterThan(before);
    for (const mesh of rig.meshes) expect(mesh.children.filter((c) => c.renderOrder === 1).map((c) => c.visible)).toEqual([false]); // (one each, hidden indoors)
  });
});

// No canvas in happy-dom: a 2D context that draws nothing (a foe's name, its bar), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

describe("a foe's silhouette", () => {
  it('outdoors, on a foe coming for the hero or focused, not on one wandering, nor down in a dungeon', () => {
    const wolf = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE).enemies.find((e) => e.kind === 'wolf')!;
    const inked = (scene: THREE.Scene) => {
      const copies: THREE.Object3D[] = [];
      scene.traverse((o) => o.renderOrder === 1 && copies.push(o));
      return copies.length > 0 && copies.every((c) => c.visible);
    };
    for (const [scale, state, focused, seen] of [[1, 'chase', null, true], [1, 'wander', null, false], [1, 'wander', wolf.id, true], [INDOOR_SCALE, 'chase', null, false]] as const) {
      const scene = new THREE.Scene();
      const views = new EnemyViews(scene, scale);
      views.update([{ ...wolf, state }], wolf.x + 2, wolf.z, 0.1, focused);
      expect(inked(scene), `${scale} ${state} ${focused}`).toBe(seen);
    }
  });
});
