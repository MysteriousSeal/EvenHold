// Marks glowing on the ground for told moves (a ring where a slam lands, a
// strip a charge runs down, the ground heaving), a pool reused frame to frame:
// begin() each frame, mark() each one shown (its shape, colour and how bright),
// end() hides the rest. Glows: light added over the ground (glow.ts). `through`: where a tree's crown (a roof) hides
// one, it's drawn over it all the same, a little fainter, so a told move under the trees is read in time.

import * as THREE from 'three';
import { glowMaterial } from './glow';

const THROUGH = 0.7; // how bright a mark is, seen through what hides it (of its own)
// Only past what's well in front of it (a crown, a roof): not the grass it lies in (as the hero's silhouette:
// heroSilhouette.ts).
const NEAR = 0.004;

// A mark's glow where it's hidden: drawn only where the world's nearer the camera.
function throughMaterial(color: number): THREE.MeshBasicMaterial {
  const material = glowMaterial(color, { depthFunc: THREE.GreaterDepth, fog: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n  gl_Position.z -= ${NEAR.toFixed(4)} * gl_Position.w;`);
  };
  material.customProgramCacheKey = () => 'glow-through';
  return material;
}

export class GlowMarks {
  private readonly marks: THREE.Mesh[] = [];
  private used = 0;

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly through = false,
  ) {}

  begin(): void {
    this.used = 0;
  }

  // A mark of `geometry` at (x, y, z), its colour and how bright; turned and sized afresh (the caller's to set).
  mark(geometry: THREE.BufferGeometry, color: number, opacity: number, x: number, y: number, z: number): THREE.Mesh {
    let m = this.marks[this.used];
    if (!m) {
      m = new THREE.Mesh(geometry, glowMaterial(color));
      if (this.through) {
        const hidden = new THREE.Mesh(geometry, throughMaterial(color));
        hidden.renderOrder = 1; // (after the world)
        m.add(hidden);
      }
      this.scene.add(m);
      this.marks.push(m);
    }
    m.geometry = geometry;
    const material = m.material as THREE.MeshBasicMaterial;
    material.color.setHex(color);
    material.opacity = opacity;
    const hidden = m.children[0] as THREE.Mesh | undefined;
    if (hidden) {
      hidden.geometry = geometry;
      (hidden.material as THREE.MeshBasicMaterial).color.setHex(color);
      (hidden.material as THREE.MeshBasicMaterial).opacity = opacity * THROUGH;
    }
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
    for (const m of this.marks) [(m.material as THREE.Material).dispose(), ...m.children.map((c) => ((c as THREE.Mesh).material as THREE.Material).dispose()), m.removeFromParent()];
  }
}
