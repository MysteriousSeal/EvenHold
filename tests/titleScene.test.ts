// @vitest-environment happy-dom
// The main menu's world (view/title/): the camp (its fire lit, the clearing
// left open), WebGL or none, the valley round it, and where the heroes stand
// before the fire.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTitleCamp } from '../src/view/title/titleCamp';
import { createTitleScene } from '../src/view/title/titleScene';
import { places } from '../src/view/title/titleHeroes';

describe("the main menu's world", () => {
  it('a camp: the fire lit, the woods round it, the clearing where the heroes stand left open', () => {
    const scene = new THREE.Scene();
    buildTitleCamp(scene);
    const meshes = scene.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(30);
    expect(meshes.some((m) => (m.material as THREE.MeshStandardMaterial).emissiveIntensity > 1)).toBe(true); // (the fire's glow)
    for (const m of meshes.filter((m) => m.scale.x > 1)) expect(Math.hypot(m.position.x / 4.4, (m.position.z + 1) / 3.2)).toBeGreaterThanOrEqual(1); // (no tree in the clearing)
  });

  it('without WebGL, none: the menu draws the hero flat', () => {
    expect(createTitleScene(document.createElement('div'))).toBeNull();
  });
});

describe("the main menu's valley", () => {
  it('level with the camp at its edge, rising away; a lake in a hollow; built whole, quickly', async () => {
    const { valleyHeight, buildTitleValley } = await import('../src/view/title/titleValley');
    expect(valleyHeight(0, 5.5)).toBe(0);
    expect(valleyHeight(-9.5, -3)).toBe(0);
    expect(valleyHeight(-40, -40)).toBeGreaterThan(3);
    expect(valleyHeight(0, -95)).toBeGreaterThanOrEqual(15); // (the far peaks, snowy)
    expect(valleyHeight(19, -26)).toBe(0); // (the lake)
    const scene = new THREE.Scene();
    const began = performance.now();
    buildTitleValley(scene);
    expect(performance.now() - began).toBeLessThan(3000);
    const forests = scene.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
    expect(forests.reduce((n, f) => n + f.count, 0)).toBeGreaterThan(500);
  });
});

describe("the heroes' places before the fire", () => {
  it.each([1, 3, 4, 5, 6, 7, 8])('%i: four in front, the rest behind in the gaps, nobody hidden, the whole centred', (n) => {
    const spots = places(n);
    expect(spots.filter((p) => !p.back)).toHaveLength(Math.min(n, 4));
    const front = spots.filter((p) => !p.back);
    for (const b of spots.filter((p) => p.back)) for (const f of front) expect(Math.abs(b.x - f.x)).toBeGreaterThan(0.25);
    const mid = spots.reduce((sum, p) => sum + p.x, 0) / n;
    expect(Math.abs(mid)).toBeLessThan(0.3);
  });
});
