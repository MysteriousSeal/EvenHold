// Blood where a blow lands (GameView.struck, a 'hit' told by model/hero/fighting.ts): a burst of dark-red voxel
// drops thrown on the way the blow went, and up, falling back; on the ground, flat splats that lie a while, then
// darken into it and shrink away. More by the harm done, more again for a critical blow, a burst and a pool for a
// kill. What doesn't bleed sheds its own: the dead their bone chips, a draugr dark frost-black ichor, a ghost pale
// motes drifting up (no splat), the caves' crawlers green ichor (a bat bleeds). Chunky cubes the size of what's held
// (0.025: bodyVoxels.ts HELD_VOXEL_SIZE), three shades each (dark, mid, a highlight); one instanced mesh a burst, one
// material for all (warmed and stylized with the rest: GameView.finish).
import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import type { GameEvent } from '../../../model/types';

type Hit = Extract<GameEvent, { kind: 'hit' }>;
type Shed = 'blood' | 'bone' | 'ichor' | 'frost' | 'mote';

const SHADES: Record<Shed, number[]> = {
  blood: [0x3e0709, 0x5c0d10, 0x7a1616],
  bone: [0x8a8270, 0xb8ae94, 0xd8d0b8],
  ichor: [0x26300e, 0x3c4a18, 0x5a6a26],
  frost: [0x1e262c, 0x34444e, 0x5e7c88],
  mote: [0x8ab8d0, 0xb0d8ec, 0xdcf0fa],
};
const SIZE = 0.025; // world units a drop's side (a splat's twice as wide, flat)
const GRAVITY = 6; // world units a second, a second
const LIE = { hit: 4, kill: 9 }; // seconds a splat lies before it goes (a kill's pool the longer)
const GO = 1.2; // seconds it takes to darken and shrink away
const MOST = 32; // bursts at once (the oldest let go past it)

interface Drop {
  p: THREE.Vector3;
  v: THREE.Vector3;
  size: number;
  shade: THREE.Color;
  landed: boolean;
  pool?: boolean; // a kill's pool: lies flat from the first, under the foe, spreading
}

interface Burst {
  mesh: THREE.InstancedMesh;
  drops: Drop[];
  floor: number;
  age: number;
  lie: number;
  floats: boolean; // (a ghost's motes: drift up and go, never landing)
}

// What a foe sheds (the hero bleeds).
function shedOf(on: Hit['on']): Shed {
  if (on === 'hero' || on === 'caveBat') return 'blood';
  if (on === 'ghost') return 'mote';
  if (on === 'draugr') return 'frost';
  const family = ENEMY_STATS[on].family;
  return family === 'undead' ? 'bone' : family === 'vermin' ? 'ichor' : 'blood';
}

// How high on them a blow lands: a man's chest, a beast's flank (a crawler's lower still).
function heightOf(on: Hit['on']): number {
  if (on === 'hero') return 0.32;
  const family = ENEMY_STATS[on].family;
  return family === 'humanoid' || family === 'undead' || family === 'draugr' || family === 'ghost' ? 0.32 : family === 'vermin' ? 0.12 : 0.2;
}

// How many drops a hit throws: by the share of its health the blow took, more a critical one, most a kill.
export function dropsFor(hit: Pick<Hit, 'share' | 'crit' | 'killed'>): number {
  return 4 + Math.round(Math.min(1, hit.share ?? 0.2) * 8) + (hit.crit ? 4 : 0) + (hit.killed ? 8 : 0);
}

export class BloodBursts {
  readonly material = new THREE.MeshLambertMaterial({ color: 0xffffff }); // (each drop its shade, per instance)
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly bursts: Burst[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  // A hit's burst in `parent` (the world, or the room: drawn at `scale`, as all there is).
  burst(parent: THREE.Object3D, hit: Hit, scale: number): void {
    const shed = shedOf(hit.on);
    const floats = shed === 'mote';
    const count = dropsFor(hit);
    // The way the blow went (from whoever struck it to who it struck); none known (an arrow's), any way.
    const [dx, dz] = hit.from ? [hit.x - hit.from.x, hit.z - hit.from.z] : [0, 0];
    const len = Math.hypot(dx, dz);
    const way = len > 1e-6 ? Math.atan2(dx / len, dz / len) : Math.random() * Math.PI * 2;
    const spread = len > 1e-6 ? 0.9 : Math.PI;
    const at = new THREE.Vector3(hit.x, hit.y + heightOf(hit.on) * scale, hit.z);
    const shades = SHADES[shed].map((c) => new THREE.Color(c));
    const drops: Drop[] = Array.from({ length: count }, (_, i) => {
      const a = way + (Math.random() - 0.5) * 2 * spread;
      const speed = (0.6 + Math.random() * 1.1) * (hit.killed ? 1.25 : 1) * scale;
      const up = floats ? 0.2 + Math.random() * 0.3 : (0.5 + Math.random() * 1.1) * scale;
      const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06).multiplyScalar(scale));
      return { p, v: new THREE.Vector3(Math.sin(a) * speed, up, Math.cos(a) * speed), size: SIZE * scale * (i % 3 === 0 ? 1.3 : 1), shade: shades[i % 3].clone(), landed: false };
    });
    // A kill's pool, under it: a few flat splats spreading from where it fell (never a ghost's).
    if (hit.killed && !floats)
      for (let i = 0; i < 5; i++) {
        const [ox, oz] = [(Math.random() - 0.5) * 0.14 * scale, (Math.random() - 0.5) * 0.14 * scale];
        drops.push({ p: new THREE.Vector3(hit.x + ox, hit.y, hit.z + oz), v: new THREE.Vector3(), size: SIZE * scale * (1.6 + Math.random() * 0.8), shade: shades[i % 2].clone(), landed: true, pool: true });
      }
    const mesh = new THREE.InstancedMesh(this.box, this.material, drops.length);
    mesh.frustumCulled = false; // (its drops fly off where its bounds never were)
    drops.forEach((drop, i) => mesh.setColorAt(i, drop.shade));
    parent.add(mesh);
    this.bursts.push({ mesh, drops, floor: hit.y + 0.004 * scale, age: 0, lie: hit.killed ? LIE.kill : LIE.hit, floats });
    while (this.bursts.length > MOST) this.drop(0);
    this.place(this.bursts[this.bursts.length - 1], 0);
  }

  update(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.age += dt;
      for (const drop of burst.drops) {
        if (drop.landed) continue;
        drop.v.y -= (burst.floats ? -0.4 : GRAVITY) * dt; // (motes drift up)
        drop.p.addScaledVector(drop.v, dt);
        if (!burst.floats && drop.p.y <= burst.floor) [drop.p.y, drop.landed] = [burst.floor, true];
      }
      if (burst.age >= (burst.floats ? 0.8 : burst.lie) + GO) this.drop(i);
      else this.place(burst, burst.age);
    }
  }

  // Each drop where it is: a cube in the air, a flat splat on the ground; going, darker and smaller.
  private place(burst: Burst, age: number): void {
    const going = Math.max(0, (age - (burst.floats ? 0.8 : burst.lie)) / GO); // 0..1
    const grow = (drop: Drop) => (drop.pool ? Math.min(1, 0.3 + age * 2.5) : 1); // (a pool spreads, the first moment)
    burst.drops.forEach((drop, i) => {
      const s = drop.size * (1 - going) * grow(drop);
      if (drop.landed) this.scale.set(s * 2, Math.max(1e-4, drop.size * 0.25 * (1 - going)), s * 2);
      else this.scale.set(s, s, s);
      this.matrix.compose(drop.p, this.quaternion, this.scale);
      burst.mesh.setMatrixAt(i, this.matrix);
      if (going > 0) burst.mesh.setColorAt(i, drop.shade.clone().multiplyScalar(1 - going * 0.6));
    });
    burst.mesh.instanceMatrix.needsUpdate = true;
    if (going > 0 && burst.mesh.instanceColor) burst.mesh.instanceColor.needsUpdate = true;
  }

  private drop(i: number): void {
    const [burst] = this.bursts.splice(i, 1);
    burst.mesh.removeFromParent();
    burst.mesh.dispose();
  }
}
