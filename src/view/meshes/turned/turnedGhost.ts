// Someone turned into a ghost (model/spells/turned.ts: for good): themselves as they stood, in what they wore (a
// foe: itself), every part of them the one pale blue-white, lighter or darker as theirs was (so their face is still
// theirs), seen through and faintly lit from within; nothing of them under the knees but a wisp, tapering, trailing
// a little behind; no shade on the ground. Drifting where they were turned: lifted off it, bobbing slowly, swaying,
// now more there and now less. Not the ghosts of the old ruins (enemy/ghostRig.ts: hooded, a foe's).
// Seen through, but never into: all of them is drawn to the depths first and coloured after, only what's nearest
// the eye (else their body would show through their clothes, and their back through their front).
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import type { Joint } from '../human/bodyVoxels';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { recoloured, weightOf } from './recoloured';

const V = HUMAN_VOXEL_SIZE;
// The palette, said first: the one pale blue-white all of them goes to; the wisp's three tones of it, paler at
// the knee, deeper to its tip; the light they're lit with from within.
export const PALE = 0xc4defa;
const WISP_PALETTE = [0xdcecf7, 0xb4cde0, 0x8aa5be];
const GLOW = 0x6c8aa6;
export const SEEN = 0.68; // how much of them shows
export const LIFT = 6 * V; // how far off the ground they hang, at rest
const BOB = 0.014;
const KNEE = 0.22; // of its height, where what has no legs of a person's is cut
const ORDER = 6; // drawn after all else that's see-through (its depths first, its colour after)

// A colour of theirs, a ghost's: the one pale blue-white, lighter or darker as theirs was.
const WHITE = new THREE.Color(PALE);
export const ghosted = (color: THREE.Color, into = new THREE.Color()): THREE.Color => {
  const weight = weightOf(color); // (weighed first: `into` may be `color` itself)
  return into.copy(WHITE).multiplyScalar(0.28 + 0.95 * Math.sqrt(weight)); // (by its root: what's dark of them told apart still)
};

// How a wisp tapers and trails, `t` down it (0 where it hangs from, 1 its tip): how wide it is there (of its top),
// and how far aside and behind its middle's gone (voxels). The staging's too (cinema/stagings/ghostStaging.ts).
export const wispAt = (t: number): { wide: number; aside: number; behind: number } => ({ wide: 0.1 + 0.9 * (1 - t) ** 0.8, aside: Math.sin(t * Math.PI * 1.3) * 1.1 * t, behind: 2.4 * t * t });

// How a ghost is drawn: its colours (and what has none of its own: `base`, the one colour of it), and its depths.
// Lit by itself, mostly (each colour of it its own light, so it's pale and cold whatever light it's in, and its face
// is told still); a little by the world, so it's a shape still. `ghostly`: how far it's drawn so (0: as the living
// are, lit by the world alone; a staging's, cinema/stagings/ghostStaging.ts).
const OWN_LIGHT = 0.72;
export interface GhostLooks {
  seen: THREE.MeshStandardMaterial;
  plain: THREE.MeshStandardMaterial;
  depth: THREE.Material;
  ghostly(k: number): void;
  dispose(): void;
}
export function ghostLooks(base = PALE): GhostLooks {
  const own = { value: OWN_LIGHT };
  const lit = (material: THREE.MeshStandardMaterial) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.ownLight = own;
      shader.fragmentShader = `uniform float ownLight;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ownLight;');
    };
    material.customProgramCacheKey = () => 'turned-ghost';
    return material;
  };
  const made = () => lit(new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: SEEN, depthWrite: false, emissive: GLOW }));
  const [seen, plain, depth] = [made(), made(), new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true })];
  seen.vertexColors = true;
  const ghostly = (k: number) => {
    // (Half its colour the world's light on it, the rest its own: together, about what it was.)
    seen.color.setScalar(1 - 0.5 * k);
    plain.color.set(base).multiplyScalar(1 - 0.5 * k);
    own.value = (OWN_LIGHT * k) / (1 - 0.5 * k);
    seen.emissiveIntensity = plain.emissiveIntensity = 0.12 * k;
  };
  ghostly(1);
  return { seen, plain, depth, ghostly, dispose: () => [seen, plain, depth].forEach((material) => material.dispose()) };
}
// `mesh` drawn as a ghost's is: its depths first (a twin of it, hung on it), its colour after.
export function seenThrough<M extends THREE.Mesh>(mesh: M, depth: THREE.Material): M {
  const twin = mesh.clone(false) as THREE.Mesh;
  twin.position.set(0, 0, 0);
  twin.quaternion.identity();
  twin.scale.set(1, 1, 1);
  [twin.material, twin.renderOrder, mesh.renderOrder] = [depth, ORDER, ORDER + 1];
  if (mesh instanceof THREE.InstancedMesh) (twin as THREE.InstancedMesh).instanceMatrix = mesh.instanceMatrix; // (the one set of places, both)
  mesh.add(twin);
  return mesh;
}

// Where `figure` is cut: someone's knees (half way up their legs, to a voxel), or as far up anything else.
export function kneeOf(figure: THREE.Object3D, tall: number): number {
  const joints = figure.userData.joints as Record<Joint, THREE.Group> | undefined;
  return joints ? Math.max(V, Math.round(joints.leftLeg.position.y / 2 / V) * V) : tall * KNEE;
}

// All of `meshes` under `height` (in `figure`'s own space) cut away: each face wholly under it gone, each that
// crosses it ended there. Where they end, given back (what the wisp hangs from).
function cutBelow(figure: THREE.Object3D, meshes: readonly THREE.Mesh[], height: number): THREE.Box3 {
  const [back, ends, at] = [figure.matrixWorld.clone().invert(), new THREE.Box3(), new THREE.Vector3()];
  for (const mesh of meshes) {
    const whole = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const placed = new THREE.Matrix4().multiplyMatrices(back, mesh.matrixWorld);
    const home = placed.clone().invert();
    const names = ['position', 'normal', 'color'].filter((name) => whole.hasAttribute(name));
    const kept = Object.fromEntries(names.map((name) => [name, [] as number[]]));
    const sizes = names.map((name) => whole.getAttribute(name).itemSize);
    const position = whole.getAttribute('position');
    for (let i = 0; i + 2 < position.count; i += 3) {
      const corners = [0, 1, 2].map((c) => new THREE.Vector3().fromBufferAttribute(position, i + c).applyMatrix4(placed));
      if (corners.every((corner) => corner.y <= height + 1e-6)) continue;
      for (const [c, corner] of corners.entries()) {
        if (corner.y < height) ends.expandByPoint(corner.setY(height));
        for (const name of names) {
          const attribute = whole.getAttribute(name);
          if (name === 'position') kept.position.push(...at.copy(corner).applyMatrix4(home).toArray());
          else for (let n = 0; n < attribute.itemSize; n++) kept[name].push(attribute.getComponent(i + c, n));
        }
      }
    }
    mesh.geometry.setIndex(null);
    for (const name of Object.keys(mesh.geometry.attributes)) mesh.geometry.deleteAttribute(name);
    for (const [n, name] of names.entries()) mesh.geometry.setAttribute(name, new THREE.Float32BufferAttribute(kept[name], sizes[n]));
    if (whole !== mesh.geometry) whole.dispose();
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
  }
  return ends;
}

// The wisp: `wide` by `deep` where it hangs from (world units), `long` down to its tip; round in section, tapering,
// its tip trailing behind. Its top's middle at the origin.
function wispGeometry(wide: number, deep: number, long: number): THREE.BufferGeometry {
  const [hw, hd, rows] = [Math.max(1, wide / V / 2), Math.max(1, deep / V / 2), Math.max(2, Math.round(long / V))];
  const size: [number, number, number] = [Math.ceil(hw * 2) + 4, rows, Math.ceil(hd * 2) + 7];
  const grid = createGrid(size);
  const [cx, cz] = [size[0] / 2, size[2] - 2 - hd];
  for (let row = 0; row < rows; row++) {
    const t = (row + 0.5) / rows;
    const { wide: k, aside, behind } = wispAt(t);
    const [rx, rz] = [Math.max(0.6, hw * k), Math.max(0.6, hd * k)];
    for (let x = 0; x < size[0]; x++) {
      for (let z = 0; z < size[2]; z++) {
        if (((x + 0.5 - cx - aside) / rx) ** 2 + ((z + 0.5 - cz + behind) / rz) ** 2 > 1) continue;
        setColor(grid, x, rows - 1 - row, z, t < 0.34 ? 1 : t < 0.7 ? 2 : 3);
      }
    }
  }
  return greedyMesh(grid, WISP_PALETTE, V, new THREE.Vector3(-cx * V, -rows * V, -cz * V));
}

export interface GhostFigure {
  root: THREE.Group;
  drift(time: number, solid?: number): void; // as it hangs, `time` on (`solid`: how much there it is, of what it is at rest)
  dispose(): void;
}

// `figure` (someone as they stand, at the origin) as a ghost of them, hung over where they stood.
export function ghostFigure(figure: THREE.Object3D): GhostFigure {
  const looks = ghostLooks();
  const made = recoloured(figure, ghosted, (coloured) => (coloured ? looks.seen : looks.plain));
  made.mix(1);
  const tall = Math.max(V, made.box.max.y);
  const knee = kneeOf(figure, tall);
  const ends = cutBelow(figure, made.meshes, knee);
  for (const mesh of made.meshes) seenThrough(mesh, looks.depth);
  // (What had nothing under the knee to cut, a thing with no legs: a wisp as wide as it, a little drawn in.)
  const top = ends.isEmpty() ? new THREE.Box3(made.box.min.clone().multiplyScalar(0.6), made.box.max.clone().multiplyScalar(0.6)) : ends;
  const span = top.getSize(new THREE.Vector3());
  const wisp = seenThrough(new THREE.Mesh(wispGeometry(span.x + V / 4, span.z + V / 4, knee + LIFT - V), looks.seen), looks.depth);
  const tail = new THREE.Group(); // (hung from the knee, to sway)
  tail.position.set((top.min.x + top.max.x) / 2, knee, (top.min.z + top.max.z) / 2);
  tail.add(wisp);
  const [root, float] = [new THREE.Group(), new THREE.Group()];
  float.add(figure, tail);
  root.add(float);
  const drift = (time: number, solid = 1) => {
    float.position.y = LIFT + Math.sin(time * 1.7) * BOB;
    float.rotation.set(Math.sin(time * 0.7 + 1) * 0.02, 0, Math.sin(time * 0.9) * 0.035);
    tail.rotation.set(0.1 + Math.sin(time * 2.6) * 0.14, 0, Math.sin(time * 1.9 + 1) * 0.2);
    // (Now more there, now less: slowly; and a shiver of it, now and then.)
    const flicker = 0.9 + 0.1 * Math.sin(time * 2.3) - 0.3 * Math.max(0, Math.sin(time * 0.83 + 2)) ** 24 * (0.5 + 0.5 * Math.sin(time * 31));
    looks.seen.opacity = looks.plain.opacity = SEEN * solid * flicker;
  };
  drift(0);
  return {
    root,
    drift,
    dispose() {
      root.removeFromParent();
      made.dispose();
      wisp.geometry.dispose();
      looks.dispose();
    },
  };
}

export class TurnedGhostRig {
  readonly root: THREE.Group;
  private readonly ghost: GhostFigure;
  private time = 0;

  constructor(figure: THREE.Object3D) {
    this.ghost = ghostFigure(figure);
    this.root = this.ghost.root;
  }

  update(ghost: Pick<Hen, 'id' | 'x' | 'y' | 'z' | 'facing'>, dt: number): void {
    this.time += dt;
    this.root.position.set(ghost.x, ghost.y, ghost.z);
    this.root.rotation.y = ghost.facing;
    this.ghost.drift(this.time + ghost.id * 1.7); // (each in its own time)
  }

  dispose(): void {
    this.ghost.dispose();
  }
}
