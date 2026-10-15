// The hero seen through what's in the way outdoors (a tree's crown, a roof, a wall): where they're hidden, their
// shape drawn over it in a pale, dithered gold, so in a fight in the woods they never lose themselves. A copy of each of
// their meshes (the body's, and what's worn and held) drawn after the world and before the hero, only where the world
// is nearer the camera than they are; the hero drawn over it where they're seen, so it never shows on themselves.

import * as THREE from 'three';
import type { HumanRig } from './humanRig';

const WORLD = 0; // (everything else's render order)
const SILHOUETTE = WORLD + 1;
const HERO = WORLD + 2;

// Only past what's well in front of them (a crown, a roof): not the grass at their feet, the ground they stand in.
const NEAR = 0.004; // (of the camera's depth, -1 to 1 over its 100: about a fifth of a tile)

// Flat pale gold, every other pixel (a checker: what's in front shows through it), never fogged or lit.
function silhouetteMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: 0xf6e2b0, fog: false, depthWrite: false, depthFunc: THREE.GreaterDepth, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n  gl_Position.z -= ${NEAR.toFixed(4)} * gl_Position.w;`);
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() {\n  if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) > 0.5) discard;');
  };
  material.customProgramCacheKey = () => 'hero-silhouette';
  return material;
}

export class HeroSilhouette {
  private readonly material = silhouetteMaterial();
  private readonly copies = new WeakMap<THREE.Mesh, THREE.Mesh>();

  // Each of the rig's meshes given its copy (once: a new piece worn, its own), shown or not.
  update(rig: HumanRig, on: boolean): void {
    for (const mesh of rig.meshes) {
      let copy = this.copies.get(mesh);
      if (!copy) {
        copy = new THREE.Mesh(mesh.geometry, this.material);
        copy.renderOrder = SILHOUETTE;
        copy.frustumCulled = false; // (as small as the hero: never worth the test)
        mesh.add(copy);
        mesh.renderOrder = HERO;
        this.copies.set(mesh, copy);
      }
      copy.visible = on;
    }
  }
}
