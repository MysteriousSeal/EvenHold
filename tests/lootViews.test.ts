// Loot lying about, drawn (view/meshes/loot/lootViews.ts): junk and gear by their models; gear as found (its level
// and rarity in its key) as its kind, which is what has a model. (A save with such a piece on the ground once
// opened onto nothing at all: the view threw on it, every frame.)
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LootViews } from '../src/view/meshes/loot/lootViews';
import { gearKey, isGear } from '../src/model/human/items/gear';
import { ITEMS } from '../src/model/human/equipment';
import { LOOT_VOXEL_SIZE } from '../src/view/meshes/loot/lootModel';
import { fresh } from './support/testWorld';

describe('loot on the ground, drawn', () => {
  it('draws gear as found (armingSword@3:rare…) as its kind, like plain gear and junk, nothing thrown', () => {
    const model = fresh();
    const { hero } = model;
    const found = gearKey({ item: 'armingSword', level: 3, rarity: 'rare', roll: 0.5 } as never);
    expect(isGear(found)).toBe(true);
    expect(found).not.toBe('armingSword');
    model.dropLoot(found, hero.x + 0.5, hero.z);
    model.dropLoot('armingSword', hero.x - 0.5, hero.z);
    model.dropLoot('bentSpoon', hero.x, hero.z + 0.5);
    const scene = new THREE.Scene();
    const views = new LootViews(scene);
    expect(() => views.update(model.loot, hero.x, hero.z, 1 / 30)).not.toThrow();
    expect(scene.children.length).toBe(3);
  });

  it('keeps every piece junk-sized: armour (a figure\'s worth of voxels) no longer than the longest junk', () => {
    const model = fresh();
    const { hero } = model;
    const armour = Object.entries(ITEMS).find(([, item]) => !['mainHand', 'offHand'].includes(item.slot))![0];
    model.dropLoot(armour as never, hero.x + 0.5, hero.z);
    model.dropLoot('bentSpoon', hero.x - 0.5, hero.z);
    const scene = new THREE.Scene();
    new LootViews(scene).update(model.loot, hero.x, hero.z, 1 / 30);
    const longest = (group: THREE.Object3D) => {
      const mesh = group.children.find((c) => c instanceof THREE.Mesh && c.geometry.boundingBox) as THREE.Mesh;
      const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
      return Math.max(size.x, size.y, size.z);
    };
    const sizes = scene.children.map(longest);
    expect(sizes.every((s) => s <= LOOT_VOXEL_SIZE * 8 + 1e-6)).toBe(true);
    expect(sizes.every((s) => s > LOOT_VOXEL_SIZE * 3)).toBe(true); // (and not shrunk to nothing)
  });
});
