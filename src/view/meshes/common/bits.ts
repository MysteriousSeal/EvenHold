// Small unlit cubes, each living a moment (a smithy's sparks and steam, smithyEffects.ts; a cauldron's bubbles and
// wisps, cauldronEffects.ts): pooled, each kind one instanced mesh (one draw, nothing made or let go per bit), each bit
// flying as it was thrown (falling, if its kind does), its size by how far through its life it is.

import * as THREE from 'three';

export interface BitLook {
  material: THREE.Material;
  size(t: number): number; // its size at `t` (0..1) of its life, as a share of a cube's
  fall?: number; // tiles a second, a second: how fast it's pulled down
}

interface Bit {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
}

const MOST = 96; // bits of a kind alive at once (any more, the oldest go)

export class Bits<K extends string> {
  private readonly cube: THREE.BoxGeometry;
  private readonly kinds = new Map<K, { look: BitLook; mesh: THREE.InstancedMesh; live: Bit[] }>();
  private readonly matrix = new THREE.Matrix4();

  constructor(
    private readonly scene: THREE.Object3D,
    side: number, // a cube's side, in tiles
    looks: Record<K, BitLook>,
  ) {
    this.cube = new THREE.BoxGeometry(side, side, side);
    for (const kind of Object.keys(looks) as K[]) {
      const mesh = new THREE.InstancedMesh(this.cube, looks[kind].material, MOST);
      mesh.count = 0;
      mesh.frustumCulled = false; // (spread about: never culled by the one box)
      scene.add(mesh);
      this.kinds.set(kind, { look: looks[kind], mesh, live: [] });
    }
  }

  // One more, at `at`, thrown at (vx, vy, vz) tiles a second, to live `life` seconds.
  add(kind: K, at: { x: number; y: number; z: number }, vx: number, vy: number, vz: number, life: number): void {
    const { live } = this.kinds.get(kind)!;
    if (live.length >= MOST) live.shift();
    live.push({ x: at.x, y: at.y, z: at.z, vx, vy, vz, age: 0, life });
  }

  update(dt: number): void {
    for (const { look, mesh, live } of this.kinds.values()) {
      let n = 0;
      for (const b of live) {
        b.age += dt;
        if (b.age >= b.life) continue;
        if (look.fall) b.vy -= look.fall * dt;
        [b.x, b.y, b.z] = [b.x + b.vx * dt, b.y + b.vy * dt, b.z + b.vz * dt];
        const s = look.size(b.age / b.life);
        mesh.setMatrixAt(n, this.matrix.makeScale(s, s, s).setPosition(b.x, b.y, b.z));
        live[n++] = b;
      }
      live.length = n;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // How many are alive, of a kind.
  count(kind: K): number {
    return this.kinds.get(kind)!.live.length;
  }

  dispose(): void {
    for (const { mesh, look } of this.kinds.values()) {
      this.scene.remove(mesh);
      mesh.dispose();
      look.material.dispose();
    }
    this.cube.dispose();
  }
}
