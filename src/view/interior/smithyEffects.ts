// The smithy at work: sparks flying off the anvil while the smith hammers
// (a burst to each blow), and steam rising off the trough while he quenches.
// Small unlit cubes, pooled, each living a moment: sparks thrown up and out,
// falling, shrinking; steam drifting up, swelling and fading.

import * as THREE from 'three';

const BLOW_EVERY = 0.45; // seconds between hammer blows
const SPARKS_A_BLOW = 7;
const SPARK_LIFE = 0.55;
const STEAM_EVERY = 0.07; // seconds between puffs, quenching
const STEAM_LIFE = 1.1;
const GRAVITY = 5;

interface Bit {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
}

export class SmithyEffects {
  private readonly cube = new THREE.BoxGeometry(0.03, 0.03, 0.03);
  private readonly spark = new THREE.MeshBasicMaterial({ color: 0xffc050, toneMapped: false });
  private readonly steam = new THREE.MeshBasicMaterial({ color: 0xe4ecec, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  private readonly bits: Bit[] = [];
  private blow = 0;
  private puff = 0;

  // `anvil`: the top of its face; `trough`: its water's surface (either missing, none).
  constructor(
    private readonly scene: THREE.Object3D,
    private readonly anvil: THREE.Vector3 | null,
    private readonly trough: THREE.Vector3 | null,
  ) {}

  update(dt: number, hammering: boolean, quenching: boolean): void {
    if (hammering && this.anvil && (this.blow -= dt) <= 0) {
      this.blow = BLOW_EVERY;
      for (let i = 0; i < SPARKS_A_BLOW; i++) {
        const a = Math.random() * Math.PI * 2;
        const out = 0.6 + Math.random() * 0.9;
        this.add(this.spark, this.anvil, Math.cos(a) * out, 1.2 + Math.random() * 1.3, Math.sin(a) * out, SPARK_LIFE * (0.6 + Math.random() * 0.6));
      }
    }
    if (quenching && this.trough && (this.puff -= dt) <= 0) {
      this.puff = STEAM_EVERY;
      const at = this.trough.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.3));
      this.add(this.steam, at, (Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08, STEAM_LIFE);
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.age += dt;
      if (b.age >= b.life) {
        this.scene.remove(b.mesh);
        this.bits.splice(i, 1);
        continue;
      }
      const spark = b.mesh.material === this.spark;
      if (spark) b.vy -= GRAVITY * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      const t = b.age / b.life;
      b.mesh.scale.setScalar(spark ? 1 - t * 0.8 : 1 + t * 2.5); // sparks dwindle, steam swells
    }
  }

  private add(material: THREE.Material, at: THREE.Vector3, vx: number, vy: number, vz: number, life: number): void {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.bits.push({ mesh, vx, vy, vz, age: 0, life });
  }

  dispose(): void {
    for (const b of this.bits) this.scene.remove(b.mesh);
    this.cube.dispose();
    this.spark.dispose();
    this.steam.dispose();
  }
}
