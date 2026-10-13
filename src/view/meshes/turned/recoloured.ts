// What the stranger things someone's turned into share (turnedGhost.ts, painting.ts, ragDoll.ts), each being of
// them: `figure` (someone as they stand, at the origin: GameView.standIn) with what floats over them and the shade
// under them gone, and every colour of theirs changed for another of the same weight (as a statue's is, statue.ts),
// on geometries of its own (theirs being shared with the living). How far each colour's gone to its new one can be
// said after, vertex by vertex, by where it is in them (a change that passes over them: cinema/stagings/).
import * as THREE from 'three';

// How light a colour is, as the eye has it.
const WEIGHTS = new THREE.Color(0.3, 0.59, 0.11);
export const weightOf = (color: THREE.Color): number => Math.min(1, color.r * WEIGHTS.r + color.g * WEIGHTS.g + color.b * WEIGHTS.b);

// Whether a mesh of a figure is seen (itself, and all it hangs on).
const shown = (o: THREE.Object3D, top: THREE.Object3D): boolean => {
  for (let at: THREE.Object3D | null = o; at && at !== top; at = at.parent) if (!at.visible) return false;
  return top.visible || o !== top;
};

// The meshes of `figure` that are of them: what floats over them (a name, a bar) and whatever's see-through (their
// shade on the ground, a glow) hidden first.
// (One with nothing solid to it at all, a ruin's ghost: what's seen through is all there is of it, and is them.)
export function solidMeshes(figure: THREE.Object3D): THREE.Mesh[] {
  const [solid, thin]: [THREE.Mesh[], THREE.Mesh[]] = [[], []];
  figure.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if ((o as THREE.Sprite).isSprite || o.name === 'overhead') return void (o.visible = false);
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    (mesh.material.transparent ? thin : solid).push(mesh);
  });
  const [of, thinOf] = [solid.filter((mesh) => shown(mesh, figure)), thin.filter((mesh) => shown(mesh, figure))];
  if (of.length === 0) return thinOf;
  for (const mesh of thin) mesh.visible = false;
  return of;
}

// The room `meshes` take up, in `figure`'s own space (as it stands, wherever it's been put since).
export function boxOf(figure: THREE.Object3D, meshes: readonly THREE.Mesh[]): THREE.Box3 {
  figure.updateMatrixWorld(true);
  const [box, back, at] = [new THREE.Box3(), figure.matrixWorld.clone().invert(), new THREE.Vector3()];
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position');
    const placed = new THREE.Matrix4().multiplyMatrices(back, mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) box.expandByPoint(at.fromBufferAttribute(position, i).applyMatrix4(placed));
  }
  return box;
}

export interface Recoloured {
  meshes: THREE.Mesh[]; // all of them that's drawn, each with a geometry of its own
  box: THREE.Box3; // the room they take up, as they stand
  // Each colour `k` of the way to its new one (0: theirs still), all alike or by where it is in them.
  mix(k: number | ((at: THREE.Vector3) => number)): void;
  dispose(): void;
}

// `figure`, each colour of it to be changed for `hue`'s of it; drawn with `look(true)` (its colours its own), or
// `look(false)` for what has none (one colour, the material's). Theirs still, till it's mixed.
export function recoloured(figure: THREE.Object3D, hue: (color: THREE.Color, into: THREE.Color) => THREE.Color, look: (coloured: boolean) => THREE.Material): Recoloured {
  const meshes = solidMeshes(figure);
  const box = boxOf(figure, meshes);
  const back = figure.matrixWorld.clone().invert();
  const [tint, at] = [new THREE.Color(), new THREE.Vector3()];
  const parts = meshes.flatMap((mesh) => {
    const colors = mesh.geometry.getAttribute('color');
    mesh.geometry = mesh.geometry.clone();
    mesh.material = look(!!colors);
    if (!colors) return [];
    const [own, position] = [mesh.geometry.getAttribute('color'), mesh.geometry.getAttribute('position')];
    const placed = new THREE.Matrix4().multiplyMatrices(back, mesh.matrixWorld);
    const [from, to, where] = [new Float32Array(own.count * 3), new Float32Array(own.count * 3), new Float32Array(own.count * 3)];
    for (let i = 0; i < own.count; i++) {
      tint.fromBufferAttribute(colors, i).toArray(from, i * 3);
      hue(tint, tint).toArray(to, i * 3);
      at.fromBufferAttribute(position, i).applyMatrix4(placed).toArray(where, i * 3);
    }
    return [{ own, from, to, where }];
  });
  return {
    meshes,
    box,
    mix(k) {
      for (const { own, from, to, where } of parts) {
        for (let i = 0; i < own.count; i++) {
          const j = i * 3;
          const f = typeof k === 'number' ? k : k(at.fromArray(where, j));
          own.setXYZ(i, from[j] + (to[j] - from[j]) * f, from[j + 1] + (to[j + 1] - from[j + 1]) * f, from[j + 2] + (to[j + 2] - from[j + 2]) * f);
        }
        own.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of meshes) mesh.geometry.dispose();
    },
  };
}
