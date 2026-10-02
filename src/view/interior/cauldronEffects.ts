// A herbalist's cauldron bubbling (herbalistVoxels.ts draws it): green
// bubbles rising off the brew, swelling, then gone; now and then a pale wisp
// of steam drifting up; a soft green light over it, flickering. Small unlit
// cubes, pooled, each living a moment, as the smithy's sparks and steam are
// (smithyEffects.ts).

import * as THREE from 'three';

const BUBBLE_EVERY = 0.16; // seconds between bubbles
const BUBBLE_LIFE = 0.7;
const STEAM_EVERY = 0.5; // and between wisps
const STEAM_LIFE = 1.6;
const SPREAD = 0.18; // tiles from the brew's middle a bubble rises

interface Bit {
  mesh: THREE.Mesh;
  vy: number;
  age: number;
  life: number;
  steam: boolean;
}

export class CauldronEffects {
  private readonly cube = new THREE.BoxGeometry(0.04, 0.04, 0.04);
  private readonly bubble = new THREE.MeshBasicMaterial({ color: 0x8ae070, toneMapped: false });
  private readonly steam = new THREE.MeshBasicMaterial({ color: 0xdcf0d8, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
  private readonly light = new THREE.PointLight(0x7ad86a, 0.8, 1.8, 1.6);
  private readonly bits: Bit[] = [];
  private nextBubble = 0;
  private nextSteam = 0;

  // `brew`: the middle of its surface (none, nothing).
  constructor(
    private readonly scene: THREE.Object3D,
    private readonly brew: THREE.Vector3 | null,
  ) {
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
      this.add(brew.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), 0.12 + Math.random() * 0.1, BUBBLE_LIFE * (0.6 + Math.random() * 0.6), false);
    }
    if ((this.nextSteam -= dt) <= 0) {
      this.nextSteam = STEAM_EVERY * (0.6 + Math.random() * 0.8);
      this.add(brew.clone().add(new THREE.Vector3((Math.random() - 0.5) * SPREAD, 0.04, (Math.random() - 0.5) * SPREAD)), 0.3 + Math.random() * 0.15, STEAM_LIFE, true);
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.age += dt;
      if (b.age >= b.life) {
        this.scene.remove(b.mesh);
        this.bits.splice(i, 1);
        continue;
      }
      b.mesh.position.y += b.vy * dt;
      const t = b.age / b.life;
      b.mesh.scale.setScalar(b.steam ? 1 + t * 2.2 : 0.6 + t * 0.9); // a wisp spreads; a bubble swells till it's gone
    }
  }

  private add(at: THREE.Vector3, vy: number, life: number, steam: boolean): void {
    const mesh = new THREE.Mesh(this.cube, steam ? this.steam : this.bubble);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.bits.push({ mesh, vy, age: 0, life, steam });
  }

  dispose(): void {
    for (const b of this.bits) this.scene.remove(b.mesh);
    this.scene.remove(this.light);
    this.light.dispose();
    this.cube.dispose();
    this.bubble.dispose();
    this.steam.dispose();
  }
}
