// A blow hitting the crypt's floor (a draugr's cleave: model/crypts/cleave.ts):
// chips of stone flying up from it, tumbling, bouncing once and settling,
// fading; a few sparks among them; and a ring of dust spreading out over the
// floor, fading. Small voxel cubes, one instanced mesh; the ring, one mesh each.

import * as THREE from 'three';

const MAX = 240;
const CHIPS = 26;
const GRAVITY = 7;
const STONE = [0x8a857e, 0x6e6a66, 0x4e4a46];
const SPARK = 0xffd8a0;

interface Chip {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  age: number;
  life: number;
  size: number;
  color: THREE.Color;
  bounced: boolean;
}

export class ImpactView {
  private readonly chips: Chip[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly rings: Array<{ mesh: THREE.Mesh; age: number }> = [];
  private readonly ring = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3(1, 1, 0).normalize();
  private readonly color = new THREE.Color();

  constructor(private readonly scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  // A blow lands at (x, z), coming along (dx, dz): the chips thrown up and on.
  hit(x: number, z: number, dx: number, dz: number): void {
    for (let i = 0; i < CHIPS; i++) {
      const a = Math.atan2(dz, dx) + (Math.random() - 0.5) * 2.6;
      const speed = 0.8 + Math.random() * 1.8;
      const spark = i < 4;
      if (this.chips.length >= MAX) this.chips.shift();
      this.chips.push({
        x, y: 0.05, z, vx: Math.cos(a) * speed, vy: 1.6 + Math.random() * 2.2, vz: Math.sin(a) * speed,
        spin: (Math.random() - 0.5) * 20, age: 0, life: spark ? 0.35 : 0.9 + Math.random() * 0.6, size: spark ? 0.025 : 0.035 + Math.random() * 0.05,
        color: new THREE.Color(spark ? SPARK : STONE[i % STONE.length]), bounced: false,
      });
    }
    const mesh = new THREE.Mesh(this.ring, new THREE.MeshBasicMaterial({ color: 0xb8b0a4, transparent: true, depthWrite: false }));
    mesh.position.set(x, 0.016, z);
    this.scene.add(mesh);
    this.rings.push({ mesh, age: 0 });
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i];
      c.age += dt;
      if (c.age >= c.life) {
        this.chips.splice(i, 1);
        continue;
      }
      c.vy -= GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < c.size / 2) {
        c.y = c.size / 2; // (the floor: once a bounce, then it lies)
        c.vy = c.bounced ? 0 : -c.vy * 0.35;
        c.vx *= 0.5;
        c.vz *= 0.5;
        c.spin *= 0.5;
        c.bounced = true;
      }
      const left = 1 - c.age / c.life;
      const size = c.size * Math.min(1, left * 3);
      this.turn.setFromAxisAngle(this.axis, c.age * c.spin);
      this.matrix.compose(new THREE.Vector3(c.x, c.y, c.z), this.turn, new THREE.Vector3(size, size, size));
      this.mesh.setMatrixAt(n, this.matrix);
      this.mesh.setColorAt(n, this.color.copy(c.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.age += dt;
      const p = ring.age / 0.6;
      ring.mesh.scale.setScalar(0.15 + 0.9 * (1 - (1 - Math.min(1, p)) ** 3));
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.max(0, 1 - p);
      if (p >= 1) {
        ring.mesh.removeFromParent();
        (ring.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.ring.dispose();
    for (const ring of this.rings) (ring.mesh.material as THREE.Material).dispose();
  }
}
