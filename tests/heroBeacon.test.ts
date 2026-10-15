// The brackets at the hero's feet as a game begins (view/meshes/human/heroBeacon.ts): there, pulsing, for the first
// seconds, where the hero stands (in whatever scene they're in), then gone for good.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HeroBeacon } from '../src/view/meshes/human/heroBeacon';

describe("the hero's beacon", () => {
  it('shows at their feet, pulsing, for the first seconds, then is gone', () => {
    const scene = new THREE.Scene();
    const beacon = new HeroBeacon();
    const at = { x: 4, y: 1, z: 7 };
    const sizes: number[] = [];
    for (let t = 0; t < 6; t += 0.25) {
      beacon.update(t, scene, at);
      const mark = scene.children[0];
      expect([mark.visible, mark.position.x, mark.position.z]).toEqual([true, 4, 7]);
      sizes.push(mark.scale.x);
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(0.5); // (pulsing)
    beacon.update(6.1, scene, at);
    expect(scene.children).toHaveLength(0);
  });
});
