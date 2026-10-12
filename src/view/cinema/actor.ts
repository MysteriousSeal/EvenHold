// Whoever a transformation is played on (transformCinema.ts), made ready to be staged part by part: a figure of
// their own (a villager's, a traveller's, a foe's: GameView.standIn), what's over their head hidden, its parts found
// and each given a material of its own to tint. Someone human-shaped (humanRig.ts: its joints on its root): their
// legs, arms, torso and head, the upper body hung on a pivot at the hips so it can tip forward over legs that stay
// under it. A four-legged beast (beastRig.ts: its parts on its root): its hind legs, its forelegs (staged as arms
// are), its trunk and tail, its head. Anything else: one part, the whole of it. And things grown on them as they turn (`grow`: little blocks
// that swell out of nothing).
import * as THREE from 'three';
import type { Joint } from '../meshes/human/bodyVoxels';

export type Part = 'legs' | 'arms' | 'torso' | 'head' | 'all';
type Tinted = THREE.Material & { color: THREE.Color; emissive?: THREE.Color };

export interface Actor {
  root: THREE.Object3D;
  box: THREE.Box3; // the whole of them, as they stand
  size: THREE.Vector3;
  human: { joints: Record<Joint, THREE.Group>; hips: THREE.Group; body: THREE.Object3D; legLength: number; head: THREE.Box3; torso: THREE.Box3 } | null;
  beast: { body: THREE.Object3D; trunk: THREE.Group; head: THREE.Group; tail: THREE.Group; fore: THREE.Group[]; hind: THREE.Group[]; headBox: THREE.Box3; trunkBox: THREE.Box3 } | null;
  tint(part: Part, hue: THREE.Color, k: number): void; // `k` of the way to `hue` (0: as they were)
  glow(k: number): void; // all of them lit from within, toward white
  grow(on: THREE.Object3D, at: THREE.Vector3, size: THREE.Vector3, color: number): THREE.Mesh; // a block, placed as they stand, nothing of it yet (its scale 0)
}

const WHITE = new THREE.Color(1, 1, 1);

export function makeActor(root: THREE.Object3D): Actor {
  // What floats over their head in the world (a name, a bar of health): not here.
  root.traverse((o) => ((o as THREE.Sprite).isSprite || o.name === 'overhead') && (o.visible = false));
  root.updateMatrixWorld(true);
  const visibleBox = (of: THREE.Object3D) => {
    const box = new THREE.Box3();
    of.traverseVisible((o) => (o as THREE.Mesh).isMesh && !inHidden(o, of) && box.expandByObject(o));
    return box;
  };
  const joints = (root.userData.joints as Record<Joint, THREE.Group> | undefined) ?? null;
  const materials = new Map<Part, Tinted[]>();
  const own = (part: Part, of: THREE.Object3D) => {
    const cloned = new Map<THREE.Material, Tinted>();
    of.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || !('color' in mesh.material)) return;
      if (!cloned.has(mesh.material)) cloned.set(mesh.material, mesh.material.clone() as Tinted);
      mesh.material = cloned.get(mesh.material)!;
    });
    materials.set(part, [...(materials.get(part) ?? []), ...cloned.values()]);
  };
  let human: Actor['human'] = null;
  const parts = (root.userData.beast as { body: THREE.Object3D; trunk: THREE.Group; head: THREE.Group; tail: THREE.Group; legs: THREE.Group[] } | undefined) ?? null;
  let beast: Actor['beast'] = null;
  const box = joints ? visibleBox(joints.torso.parent!) : parts ? visibleBox(parts.body) : visibleBox(root);
  if (joints) {
    const body = joints.torso.parent!;
    const [head, torso] = [visibleBox(joints.head), visibleBox(joints.torso)];
    const legLength = Math.max(joints.leftLeg.position.y, torso.min.y);
    const hips = new THREE.Group();
    hips.position.set(0, legLength, 0);
    body.add(hips);
    for (const joint of ['torso', 'head', 'leftArm', 'rightArm'] as const) hips.attach(joints[joint]);
    own('legs', joints.leftLeg);
    own('legs', joints.rightLeg);
    own('arms', joints.leftArm);
    own('arms', joints.rightArm);
    own('torso', joints.torso);
    own('head', joints.head);
    human = { joints, hips, body, legLength, head, torso };
  } else if (parts) {
    const [fore, hind] = [parts.legs.filter((leg) => leg.position.z > 0), parts.legs.filter((leg) => leg.position.z <= 0)];
    for (const leg of hind) own('legs', leg);
    for (const leg of fore) own('arms', leg);
    own('torso', parts.trunk);
    own('torso', parts.tail);
    own('head', parts.head);
    for (const group of [...parts.legs, parts.head, parts.tail]) group.userData.rest = group.position.clone(); // (where each sits, to be moved from)
    beast = { body: parts.body, trunk: parts.trunk, head: parts.head, tail: parts.tail, fore, hind, headBox: visibleBox(parts.head), trunkBox: visibleBox(parts.trunk) };
  } else own('all', root);
  const each = (part: Part) => (part === 'all' ? [...materials.values()].flat() : materials.get(part) ?? materials.get('all') ?? []);
  return {
    root,
    box,
    size: box.getSize(new THREE.Vector3()),
    human,
    beast,
    tint(part, hue, k) {
      for (const material of each(part)) {
        material.color.copy(WHITE).lerp(hue, k * 0.55).multiplyScalar(1 - 0.5 * k); // their own colours dimmed,
        material.emissive?.copy(hue).multiplyScalar(0.62 * k); // the new one lit over them
      }
    },
    glow(k) {
      for (const material of each('all')) material.emissive?.lerp(WHITE, k);
    },
    grow(on, at, size, color) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
      mesh.position.copy(at);
      root.add(mesh);
      root.updateMatrixWorld(true);
      on.attach(mesh); // (kept where it's put, as its part moves after)
      mesh.userData.full = mesh.scale.clone();
      mesh.scale.setScalar(1e-4);
      return mesh;
    },
  };
}

const inHidden = (o: THREE.Object3D, top: THREE.Object3D): boolean => {
  for (let at: THREE.Object3D | null = o; at && at !== top; at = at.parent) if (!at.visible) return true;
  return false;
};

// `mesh` (a block grown: Actor.grow) swelled `k` of the way out, a little past and back (0: nothing of it, 1: all).
export function swell(mesh: THREE.Mesh, k: number): void {
  const full = mesh.userData.full as THREE.Vector3;
  const s = k <= 0 ? 1e-4 : k >= 1 ? 1 : 1 + 0.35 * Math.sin(k * Math.PI) - (1 - k) * (1 - k);
  mesh.scale.copy(full).multiplyScalar(Math.max(1e-4, s));
}

// Smoothly from 0 to 1 as `u` goes from `a` to `b` (0 before, 1 after).
export function over(u: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (u - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
