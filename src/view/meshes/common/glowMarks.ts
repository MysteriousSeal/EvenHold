// Marks glowing on the ground for told moves (a ring where a slam lands, a
// strip a charge runs down, the ground heaving), a pool reused frame to frame:
// begin() each frame, mark() each one shown (its shape, colour and how bright),
// end() hides the rest. Glows: light added over the ground (glow.ts).

import * as THREE from 'three';
import { glowMaterial } from './glow';

export class GlowMarks {
  private readonly marks: THREE.Mesh[] = [];
  private used = 0;

  constructor(private readonly scene: THREE.Object3D) {}

  begin(): void {
    this.used = 0;
  }

  // A mark of `geometry` at (x, y, z), its colour and how bright; turned and sized afresh (the caller's to set).
  mark(geometry: THREE.BufferGeometry, color: number, opacity: number, x: number, y: number, z: number): THREE.Mesh {
    let m = this.marks[this.used];
    if (!m) {
      m = new THREE.Mesh(geometry, glowMaterial(color));
      this.scene.add(m);
      this.marks.push(m);
    }
    m.geometry = geometry;
    const material = m.material as THREE.MeshBasicMaterial;
    material.color.setHex(color);
    material.opacity = opacity;
    m.position.set(x, y, z);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    m.visible = true;
    this.used++;
    return m;
  }

  end(): void {
    for (let i = this.used; i < this.marks.length; i++) this.marks[i].visible = false;
  }

  dispose(): void {
    for (const m of this.marks) [(m.material as THREE.Material).dispose(), m.removeFromParent()];
  }
}
