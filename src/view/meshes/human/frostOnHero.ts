// The hero Chilled (a draugr's frost: model/hero/blessing.ts): a few motes of
// frost drifting down round them, glinting, white to ice blue, fading as they
// fall; on their root, so they go where they go, as big as they're drawn.
// (The icy sheen on the body itself is a material: GameView.ts.)

import * as THREE from 'three';

const MOTES = 14;
const HEIGHT = 0.5; // over the feet the motes start from, at most
const SPREAD = 0.2; // round the middle

export class FrostOnHero {
  readonly group = new THREE.Group();
  private readonly motes: Array<{ mesh: THREE.Mesh; age: number; life: number; x: number; z: number; y: number }> = [];
  private readonly geometry = new THREE.BoxGeometry(0.018, 0.018, 0.018);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xcff2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  private time = 0;

  constructor() {
    for (let i = 0; i < MOTES; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material.clone());
      this.group.add(mesh);
      this.motes.push({ mesh, age: Math.random() * 1.2, life: 1, x: 0, z: 0, y: 0 });
      this.respawn(this.motes[i]);
    }
    this.group.visible = false;
  }

  private respawn(m: { age: number; life: number; x: number; z: number; y: number }): void {
    const a = Math.random() * Math.PI * 2;
    const r = SPREAD * Math.sqrt(Math.random());
    Object.assign(m, { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.15 + Math.random() * HEIGHT, life: 0.8 + Math.random() * 0.8, age: 0 });
  }

  // On while `chilled`: each mote drifting down and swaying, glinting, fading; afresh once faded.
  update(chilled: boolean, dt: number): void {
    this.group.visible = chilled;
    if (!chilled) return;
    this.time += dt;
    for (const m of this.motes) {
      m.age += dt;
      if (m.age >= m.life) this.respawn(m);
      const left = 1 - m.age / m.life;
      m.mesh.position.set(m.x + Math.sin(this.time * 2 + m.y * 9) * 0.03, Math.max(0.01, m.y - m.age * 0.18), m.z + Math.cos(this.time * 2.3 + m.x * 7) * 0.03);
      m.mesh.rotation.set(this.time * 3 + m.x, this.time * 2 + m.z, 0);
      const material = m.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = left * (0.55 + 0.45 * Math.sin(this.time * 11 + m.x * 40));
    }
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.motes) (m.mesh.material as THREE.Material).dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
