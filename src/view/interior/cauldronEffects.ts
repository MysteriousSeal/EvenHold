// A herbalist's cauldron bubbling (herbalistVoxels.ts draws it): green
// bubbles rising off the brew, swelling, then gone; now and then a pale wisp
// of steam drifting up; a soft green light over it, flickering. Small unlit
// cubes, pooled (common/bits.ts), each living a moment, as the smithy's sparks
// and steam are (smithyEffects.ts).

import * as THREE from 'three';
import { Bits } from '../meshes/common/bits';

const BUBBLE_EVERY = 0.16; // seconds between bubbles
const BUBBLE_LIFE = 0.7;
const STEAM_EVERY = 0.5; // and between wisps
const STEAM_LIFE = 1.6;
const SPREAD = 0.18; // tiles from the brew's middle a bubble rises

export class CauldronEffects {
  private readonly bits: Bits<'bubble' | 'steam'>;
  private readonly light = new THREE.PointLight(0x7ad86a, 0.8, 1.8, 1.6);
  private nextBubble = 0;
  private nextSteam = 0;

  // `brew`: the middle of its surface (none, nothing).
  constructor(
    private readonly scene: THREE.Object3D,
    private readonly brew: THREE.Vector3 | null,
  ) {
    this.bits = new Bits(scene, 0.04, {
      bubble: { material: new THREE.MeshBasicMaterial({ color: 0x8ae070, toneMapped: false }), size: (t) => 0.6 + t * 0.9 }, // (swelling till it's gone)
      steam: { material: new THREE.MeshBasicMaterial({ color: 0xdcf0d8, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }), size: (t) => 1 + t * 2.2 }, // (spreading)
    });
    if (brew) {
      this.light.position.copy(brew).add(new THREE.Vector3(0, 0.25, 0));
      scene.add(this.light);
    }
  }

  update(dt: number, time: number): void {
    const { brew } = this;
    if (!brew) return;
    this.light.intensity = 0.8 + Math.sin(time * 5.3) * 0.12 + Math.sin(time * 11.7) * 0.06;
    if ((this.nextBubble -= dt) <= 0) {
      this.nextBubble = BUBBLE_EVERY * (0.5 + Math.random());
      const [a, r] = [Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * SPREAD];
      this.bits.add('bubble', { x: brew.x + Math.cos(a) * r, y: brew.y, z: brew.z + Math.sin(a) * r }, 0, 0.12 + Math.random() * 0.1, 0, BUBBLE_LIFE * (0.6 + Math.random() * 0.6));
    }
    if ((this.nextSteam -= dt) <= 0) {
      this.nextSteam = STEAM_EVERY * (0.6 + Math.random() * 0.8);
      this.bits.add('steam', { x: brew.x + (Math.random() - 0.5) * SPREAD, y: brew.y + 0.04, z: brew.z + (Math.random() - 0.5) * SPREAD }, 0, 0.3 + Math.random() * 0.15, 0, STEAM_LIFE);
    }
    this.bits.update(dt);
  }

  dispose(): void {
    this.bits.dispose();
    this.scene.remove(this.light);
    this.light.dispose();
  }
}
