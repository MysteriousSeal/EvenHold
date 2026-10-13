// Someone as a rag doll of themselves (what the one turned into a doll is shown as, while it's told:
// cinema/stagings/dollStaging.ts; in the world a doll's a thing on the ground, nobody's in particular:
// dollVoxels.ts): `figure` (someone as they stand, at the origin: GameView.standIn) made small, about a hand high,
// their head a doll's (big for the rest of them); every colour of theirs gone soft, toward linen, as cloth washed
// often; a seam sewn up the front of each limb and down their front, stitch by stitch; two buttons where their eyes
// were, thread through the middle of each, and two stitches across their mouth; their limbs slack, flung out,
// their head lolled; fallen on their back. Each of those said how far gone (0 themselves, 1 a doll), so it can be
// played step by step. The figure itself is what's changed (nothing put round it: it's set in a scene as it is).
import * as THREE from 'three';
import { HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import type { Joint } from '../human/bodyVoxels';
import { PERSON_GLOW } from '../human/humanParts';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { boxOf, recoloured, weightOf } from './recoloured';

const V = HUMAN_VOXEL_SIZE;
// The palette, said first: the linen all of them goes toward; thread; a button.
const [LINEN, THREAD, BUTTON] = [0xead8b8, 0x5a3e2c, 0x2a2630];
export const SMALL = 0.3; // a doll's size, of theirs
const HEAD = 1.22; // its head, of theirs
const EYES = { aside: 2, up: 5.5 }; // where their eyes are on their head: voxels either side of its middle, and up it (human/faceVoxels.ts)
const MOUTH = { aside: 1, up: 2.5 };
// How far each joint turns as they go slack (radians, about x and z; a left limb's, a right one's turned the other way about z).
const SLACK: Record<Joint, [x: number, z: number]> = { head: [0.1, 0.32], torso: [0, 0], leftArm: [0.15, 1.05], rightArm: [-0.2, 0.7], leftLeg: [0, 0.28], rightLeg: [0.1, 0.5] };

// A colour of theirs, a doll's: nearer linen, nearer the middle.
const [CLOTH, mid] = [new THREE.Color(LINEN), new THREE.Color()];
export const softened = (color: THREE.Color, into = new THREE.Color()): THREE.Color => {
  const weight = weightOf(color); // (weighed first: `into` may be `color` itself)
  return into.copy(color).lerp(mid.setScalar(0.1 + 0.8 * weight), 0.2).lerp(CLOTH, 0.1); // (lightly: in the light's own measure a little linen goes a long way)
};

const smooth = (t: number) => ((k) => k * k * (3 - 2 * k))(Math.max(0, Math.min(1, t)));

// The faces of `meshes` that look forward (+Z), in `figure`'s space: each one's room across and up, and how far forward it is.
function frontsOf(figure: THREE.Object3D, meshes: readonly THREE.Mesh[]): THREE.Box3[] {
  const [back, fronts] = [figure.matrixWorld.clone().invert(), [] as THREE.Box3[]];
  const [a, b, c, n] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const mesh of meshes) {
    const placed = new THREE.Matrix4().multiplyMatrices(back, mesh.matrixWorld);
    const [position, index] = [mesh.geometry.getAttribute('position'), mesh.geometry.index];
    for (let i = 0; i + 2 < (index ? index.count : position.count); i += 3) {
      const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(position, ia).applyMatrix4(placed);
      b.fromBufferAttribute(position, ib).applyMatrix4(placed);
      c.fromBufferAttribute(position, ic).applyMatrix4(placed);
      if (n.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize().z > 0.7) fronts.push(new THREE.Box3().setFromPoints([a, b, c]));
    }
  }
  return fronts;
}
// How far forward the foremost of `fronts` is at (x, y), `near` either way (null: none there).
const frontAt = (fronts: readonly THREE.Box3[], x: number, y: number, near = 0): number | null =>
  fronts.reduce<number | null>((best, f) => (x + near > f.min.x && x - near < f.max.x && y + near > f.min.y && y - near < f.max.y && (best === null || f.max.z > best) ? f.max.z : best), null);

// A button: round (a square, its corners off), three voxels across and half a voxel thick, thread through its middle.
function buttonGeometry(): THREE.BufferGeometry {
  const grid = createGrid([3, 3, 1]);
  fillBox(grid, 0, 0, 0, 2, 2, 0, (x, y) => (x === 1 && y === 1 ? 2 : x !== 1 && y !== 1 ? 0 : 1));
  return greedyMesh(grid, [BUTTON, THREAD], V, new THREE.Vector3(-1.5 * V, -1.5 * V, 0)).scale(1, 1, 0.5);
}

export interface RagDoll {
  root: THREE.Object3D; // the figure itself
  box: THREE.Box3; // the room they took up, as they stood
  shrink(k: number): void; // down to a doll's size, their head less than the rest
  soften(k: number | ((at: THREE.Vector3) => number)): void; // their colours, all alike or by where each is in them
  sew(k: number): void; // the seams, stitch by stitch: up their legs, their arms, then down their front
  button(k: number): void; // their eyes, and their mouth stitched
  slacken(k: number): void;
  fall(k: number): void; // onto their back (what's no person: onto its side)
  dispose(): void;
}

export function ragDollOf(figure: THREE.Object3D): RagDoll {
  const [cloth, plain] = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: PERSON_GLOW }), new THREE.MeshStandardMaterial({ color: LINEN, roughness: 1 })];
  const [thread, buttons] = [new THREE.MeshStandardMaterial({ color: THREAD, roughness: 1 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 })];
  const made = recoloured(figure, softened, (coloured) => (coloured ? cloth : plain));
  const joints = (figure.userData.joints as Record<Joint, THREE.Group> | undefined) ?? null;
  const [stitch, button] = [new THREE.BoxGeometry(V, V, V / 2), buttonGeometry()];
  const sewn: Array<{ mesh: THREE.Mesh; turn: number }> = [];
  const eyes: THREE.Mesh[] = [];
  // Something sewn on: put where it goes as they stand, then hung on the part of them it's on (to go where that does).
  const put = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, on: THREE.Object3D) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    figure.add(mesh);
    on.attach(mesh);
    mesh.userData.full = mesh.scale.clone();
    mesh.scale.setScalar(1e-4);
    return mesh;
  };
  // A seam up the front of each part: a stitch every other voxel, on whatever of it's foremost there.
  const under = (mesh: THREE.Object3D, part: THREE.Object3D): boolean => mesh === part || (!!mesh.parent && under(mesh.parent, part));
  const within = (part: THREE.Object3D) => made.meshes.filter((mesh) => under(mesh, part));
  const seams: Array<[on: THREE.Object3D, from: number, to: number]> = joints ? [[joints.leftLeg, 0, 0.3], [joints.rightLeg, 0, 0.3], [joints.leftArm, 0.3, 0.65], [joints.rightArm, 0.3, 0.65], [joints.torso, 1, 0.65]] : [[figure, 0, 1]];
  for (const [on, from, to] of seams) {
    const meshes = within(on);
    if (!meshes.length) continue;
    const [room, fronts] = [boxOf(figure, meshes), frontsOf(figure, meshes)];
    const x = (room.min.x + room.max.x) / 2;
    const rows = Math.max(1, Math.floor((room.max.y - room.min.y) / V));
    for (let row = 1; row < rows; row += 2) {
      const y = room.min.y + (row + 0.5) * V;
      const z = frontAt(fronts, x, y);
      if (z !== null) sewn.push({ mesh: put(stitch, thread, x, y, z + V / 4, on), turn: from + ((to - from) * row) / rows });
    }
  }
  // Their eyes, buttons; their mouth, two stitches across it: on whatever's foremost of their head there (their face, or what's over it).
  if (joints) {
    const head = joints.head;
    const fronts = frontsOf(figure, within(head));
    const at = new THREE.Vector3();
    for (const side of [-1, 1]) {
      for (const [spot, geometry, material] of [[EYES, button, buttons], [MOUTH, stitch, thread]] as const) {
        head.localToWorld(at.set(side * spot.aside * V, spot.up * V, 0));
        figure.worldToLocal(at);
        const z = frontAt(fronts, at.x, at.y, V);
        if (z !== null) eyes.push(put(geometry, material, at.x, at.y, z + (geometry === stitch ? V / 4 : 0), head));
      }
    }
  }
  const rest = joints ? (Object.keys(joints) as Joint[]).map((name) => ({ name, joint: joints[name], turned: joints[name].rotation.clone(), scale: joints[name].scale.clone(), side: Math.sign(joints[name].position.x) || 1 })) : [];
  const grown = (mesh: THREE.Mesh, k: number) => mesh.scale.copy(mesh.userData.full as THREE.Vector3).multiplyScalar(Math.max(1e-4, k <= 0 ? 0 : k >= 1 ? 1 : k + 0.4 * Math.sin(k * Math.PI)));
  const { box } = made;
  return {
    root: figure,
    box,
    shrink(k) {
      figure.scale.setScalar(1 + (SMALL - 1) * k);
      for (const { name, joint, scale } of rest) if (name === 'head') joint.scale.copy(scale).multiplyScalar(1 + (HEAD - 1) * k);
    },
    soften: (k) => made.mix(k),
    sew(k) {
      for (const { mesh, turn } of sewn) grown(mesh, smooth((k - turn * 0.88) / 0.12));
    },
    button(k) {
      for (const [i, mesh] of eyes.entries()) grown(mesh, smooth(k * 1.6 - (i >> 1) * 0.6)); // (one side, then the other)
    },
    slacken(k) {
      for (const { name, joint, turned, side } of rest) joint.rotation.set(turned.x + SLACK[name][0] * k, turned.y, turned.z + SLACK[name][1] * k * (name === 'head' ? 1 : side));
    },
    fall(k) {
      const [angle, size] = [(Math.PI / 2) * k, figure.scale.y];
      // (Someone: onto their back. Anything else, longer than it's tall: over onto its side.)
      if (joints) figure.rotation.x = -angle;
      else figure.rotation.z = angle;
      // (Lifted as they go over, by as much as the lowest of them would be under the ground.)
      const across = joints ? [box.min.z, box.max.z] : [box.min.x, box.max.x];
      const lowest = Math.min(...[box.min.y, box.max.y].flatMap((y) => across.map((a) => y * Math.cos(angle) + a * Math.sin(angle))));
      figure.position.y = Math.max(0, -lowest) * size;
    },
    dispose() {
      figure.removeFromParent();
      made.dispose();
      for (const thing of [cloth, plain, thread, buttons, stitch, button]) thing.dispose();
    },
  };
}
