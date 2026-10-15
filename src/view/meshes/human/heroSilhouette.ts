// The hero seen through what's in the way outdoors (a tree's crown, a roof, a wall): where they're hidden, their
// shape drawn over it in a pale, dithered gold, so in a fight in the woods they never lose themselves; and the foes
// coming for them (or focused) likewise, in a dithered ember red (meshes/enemy/enemyViews.ts). A copy of each of
// their meshes drawn after the world and before them, only where the world is nearer the camera than they are; they
// drawn over it where they're seen, so it never shows on themselves.

import * as THREE from 'three';
import type { HumanRig } from './humanRig';

const WORLD = 0; // (everything else's render order)
const SILHOUETTE = WORLD + 1;
const FIGURE = WORLD + 2;

// Only past what's well in front of them (a crown, a roof): not the grass at their feet, the ground they stand in.
const NEAR = 0.004; // (of the camera's depth, -1 to 1 over its 100: about a fifth of a tile)

export const HERO_INK = 0xf6e2b0;
export const FOE_INK = 0xff7a50;

// Flat ink, every other pixel (a checker: what's in front shows through it), never fogged or lit.
function silhouetteMaterial(color: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, depthFunc: THREE.GreaterDepth, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n  gl_Position.z -= ${NEAR.toFixed(4)} * gl_Position.w;`);
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() {\n  if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) > 0.5) discard;');
  };
  material.customProgramCacheKey = () => 'silhouette';
  return material;
}

export class Silhouettes {
  private readonly material: THREE.MeshBasicMaterial;
  private readonly copies = new WeakMap<THREE.Mesh, THREE.Mesh>();

  constructor(color: number) {
    this.material = silhouetteMaterial(color);
  }

  // Each of `meshes` given its copy (once: a new piece worn, its own), shown or not.
  update(meshes: Iterable<THREE.Mesh>, on: boolean): void {
    for (const mesh of meshes) {
      let copy = this.copies.get(mesh);
      if (!copy) {
        copy = new THREE.Mesh(mesh.geometry, this.material);
        copy.renderOrder = SILHOUETTE;
        copy.frustumCulled = false; // (as small as they are: never worth the test)
        mesh.add(copy);
        mesh.renderOrder = FIGURE;
        this.copies.set(mesh, copy);
      }
      copy.visible = on;
    }
  }

  // The meshes of a figure (a foe's rig), not what's over its head (its bar, its name) nor the copies themselves.
  static meshesOf(root: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    const walk = (o: THREE.Object3D) => {
      if (o.name === 'overhead' || o.renderOrder === SILHOUETTE) return;
      if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o as THREE.Mesh);
      for (const child of o.children) walk(child);
    };
    walk(root);
    return meshes;
  }
}

// The hero's, over their rig.
export class HeroSilhouette {
  private readonly ink = new Silhouettes(HERO_INK);

  update(rig: HumanRig, on: boolean): void {
    this.ink.update(rig.meshes, on);
  }
}
