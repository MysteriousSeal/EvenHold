// The smithy at work: sparks flying off the anvil while the smith hammers
// (a burst to each blow), and steam rising off the trough while he quenches.
// Small unlit cubes, pooled (common/bits.ts), each living a moment: sparks thrown up and out,
// falling, shrinking; steam drifting up, swelling and fading.

import * as THREE from 'three';
import { Bits } from '../meshes/common/bits';

const BLOW_EVERY = 0.45; // seconds between hammer blows
const SPARKS_A_BLOW = 7;
const SPARK_LIFE = 0.55;
const STEAM_EVERY = 0.07; // seconds between puffs, quenching
const STEAM_LIFE = 1.1;
const GRAVITY = 5;

export class SmithyEffects {
  private readonly bits: Bits<'spark' | 'steam'>;
  private blow = 0;
  private puff = 0;

  // `anvil`: the top of its face; `trough`: its water's surface (either missing, none).
  constructor(
    scene: THREE.Object3D,
    private readonly anvil: THREE.Vector3 | null,
    private readonly trough: THREE.Vector3 | null,
  ) {
    this.bits = new Bits(scene, 0.03, {
      spark: { material: new THREE.MeshBasicMaterial({ color: 0xffc050, toneMapped: false }), size: (t) => 1 - t * 0.8, fall: GRAVITY }, // (dwindling as they fall)
      steam: { material: new THREE.MeshBasicMaterial({ color: 0xe4ecec, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), size: (t) => 1 + t * 2.5 }, // (swelling)
    });
  }

  update(dt: number, hammering: boolean, quenching: boolean): void {
    if (hammering && this.anvil && (this.blow -= dt) <= 0) {
      this.blow = BLOW_EVERY;
      for (let i = 0; i < SPARKS_A_BLOW; i++) {
        const a = Math.random() * Math.PI * 2;
        const out = 0.6 + Math.random() * 0.9;
        this.bits.add('spark', this.anvil, Math.cos(a) * out, 1.2 + Math.random() * 1.3, Math.sin(a) * out, SPARK_LIFE * (0.6 + Math.random() * 0.6));
      }
    }
    if (quenching && this.trough && (this.puff -= dt) <= 0) {
      this.puff = STEAM_EVERY;
      const at = { x: this.trough.x + (Math.random() - 0.5) * 0.5, y: this.trough.y, z: this.trough.z + (Math.random() - 0.5) * 0.3 };
      this.bits.add('steam', at, (Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08, STEAM_LIFE);
    }
    this.bits.update(dt);
  }

  dispose(): void {
    this.bits.dispose();
  }
}
