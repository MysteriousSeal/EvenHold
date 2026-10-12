// Puffs of smoke (someone turned into a chicken, or back: model/spells/chickens.ts): a burst of pale grey voxel
// cubes thrown out from a point and up, swelling and thinning away over most of a second. And feathers: white
// slivers thrown out likewise, a few or a burst of them, that then drift down, rocking, and fade. Cubes only, unlit,
// one material a puff (so each fades on its own); few at a time.
import * as THREE from 'three';

const LIFE = 0.75; // seconds
const CUBES = 14;
const SIZE = 0.05; // world units a cube's side, at first
const REACH = 0.2; // how far out they're thrown
const RISE = 0.28; // and up
const SHADES = [0xe8e6e0, 0xcfccc4, 0xb4b0a8];
const FEATHER_LIFE = 1.5;
const FEATHER_SHADES = [0xf4f0e6, 0xe2dccc];
const FALL = 0.22; // how far a feather drifts down, thrown out

interface Puff {
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  cubes: Array<{ mesh: THREE.Mesh; out: THREE.Vector3; spin: number }>;
  age: number;
  feathers?: boolean;
}

export class SmokePuffs {
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly puffs: Puff[] = [];

  // A puff at (x, y, z) in `parent`, drawn at `scale` (bigger indoors, as all there is).
  puff(parent: THREE.Object3D, x: number, y: number, z: number, scale: number): void {
    const group = new THREE.Group();
    group.position.set(x, y + 0.08 * scale, z);
    group.scale.setScalar(scale);
    const materials = SHADES.map((color) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    const cubes = Array.from({ length: CUBES }, (_, i) => {
      const mesh = new THREE.Mesh(this.box, materials[i % materials.length]);
      const angle = (i / CUBES) * Math.PI * 2 + Math.random();
      const out = new THREE.Vector3(Math.sin(angle) * REACH * (0.5 + Math.random() * 0.5), RISE * (0.3 + Math.random() * 0.7), Math.cos(angle) * REACH * (0.5 + Math.random() * 0.5));
      group.add(mesh);
      return { mesh, out, spin: (Math.random() - 0.5) * 4 };
    });
    parent.add(group);
    this.puffs.push({ group, materials, cubes, age: 0 });
  }

  // Feathers thrown off at (x, y, z): `count` of them.
  feathers(parent: THREE.Object3D, x: number, y: number, z: number, scale: number, count: number): void {
    const group = new THREE.Group();
    group.position.set(x, y + 0.14 * scale, z);
    group.scale.setScalar(scale);
    const materials = FEATHER_SHADES.map((color) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    const cubes = Array.from({ length: count }, (_, i) => {
      const mesh = new THREE.Mesh(this.box, materials[i % materials.length]);
      const angle = Math.random() * Math.PI * 2;
      const out = new THREE.Vector3(Math.sin(angle) * REACH * (0.6 + Math.random()), 0.1 + Math.random() * 0.18, Math.cos(angle) * REACH * (0.6 + Math.random()));
      mesh.scale.set(0.02, 0.006, 0.045); // a sliver
      group.add(mesh);
      return { mesh, out, spin: (Math.random() - 0.5) * 9 };
    });
    parent.add(group);
    this.puffs.push({ group, materials, cubes, age: 0, feathers: true });
  }

  update(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.age += dt;
      const t = Math.min(1, puff.age / (puff.feathers ? FEATHER_LIFE : LIFE));
      const eased = 1 - (1 - t) * (1 - t); // out fast, then drifting
      for (const { mesh, out, spin } of puff.cubes) {
        mesh.position.copy(out).multiplyScalar(eased);
        if (puff.feathers) {
          // Thrown up and out, then down again, rocking from side to side as it falls.
          mesh.position.y = out.y * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) - FALL * t * t;
          mesh.position.x += Math.sin(t * 9 + spin) * 0.03 * t;
          mesh.rotation.set(Math.sin(t * 7 + spin) * 0.8, spin * t, Math.cos(t * 6 + spin) * 0.6);
          continue;
        }
        mesh.scale.setScalar(SIZE * (0.6 + eased * 1.2));
        mesh.rotation.y = spin * t;
      }
      for (const material of puff.materials) material.opacity = puff.feathers ? Math.min(1, (1 - t) * 3) : 0.9 * (1 - t) * (1 - t * 0.3);
      if (t < 1) continue;
      puff.group.removeFromParent();
      for (const material of puff.materials) material.dispose();
      this.puffs.splice(i, 1);
    }
  }
}
