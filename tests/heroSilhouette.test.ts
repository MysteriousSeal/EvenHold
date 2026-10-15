// The hero's shape through what hides them outdoors (view/meshes/human/heroSilhouette.ts): a copy of each of their
// meshes, drawn only where the world's in front (after the world, before the hero, never writing depth), a new piece
// worn given its own; shown outdoors, hidden indoors.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { HeroSilhouette } from '../src/view/meshes/human/heroSilhouette';

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
