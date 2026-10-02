// A cave worm on screen (wormVoxels.ts). Underground (buried: the model's),
// all that shows is the hump of earth it heaves up as it goes, shuddering,
// heaving harder as it's about to burst up. Up, it rises out of a torn ring of
// earth, its rings strung along an arc rearing toward the hero, swaying, its
// maw at the top; its bite a rearing back and a strike down. Going under
// again, it sinks back into its hole. A red flash while hurt; slain, it
// slumps along the ground and bursts.

import * as THREE from 'three';
import { CreatureRig } from '../common/creatureRig';
import { ENEMY_STATS } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { HealthBar, VoxelBurst, enemyName, type EnemyRig } from './enemyParts';
import { drawnAt } from '../common/overhead';
import { MOUND, RING_LONG, WORM_HEAD, WORM_PALETTE, WORM_RINGS, WORM_VOXEL as V, wormHead, wormMound, wormRing } from './wormVoxels';

const TALL = 0.42; // how high its head rears, up (as built)
const REACH = 0.22; // and how far on toward the hero
const RISE = 3.5; // how fast it comes up and goes under (its share a second)
const SLUMP = 0.45; // seconds it takes to slump, slain
const TURN_RATE = 6;

export interface WormLook {
  normal: THREE.Material;
  flash: THREE.Material;
  head: THREE.BufferGeometry;
  rings: THREE.BufferGeometry[];
  mound: THREE.BufferGeometry;
  hole: THREE.BufferGeometry;
}

export function createWormLook(flash: THREE.Material): WormLook {
  const mesh = (grid: VoxelGrid, pivot: [number, number, number]) => greedyMesh(grid, WORM_PALETTE, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V));
  const centred = (grid: VoxelGrid) => mesh(grid, [grid.size[0] / 2, grid.size[1] / 2, grid.size[2] / 2]);
  return {
    normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), // (wet flesh)
    flash,
    head: centred(wormHead()),
    rings: WORM_RINGS.map((w) => centred(wormRing(w))),
    mound: mesh(wormMound(false), [MOUND[0] / 2, 0, MOUND[2] / 2]),
    hole: mesh(wormMound(true), [MOUND[0] / 2, 0, MOUND[2] / 2]),
  };
}

export class WormRig extends CreatureRig implements EnemyRig {
  private readonly chain: THREE.Mesh[] = []; // the tail's tip first, the head last
  private readonly mound: THREE.Mesh;
  private readonly hole: THREE.Mesh;
  private readonly lit: THREE.Mesh[] = [];
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;
  private up = 0; // how far up out of the ground (0 .. 1)

  constructor(
    enemy: Enemy,
    private readonly look: WormLook,
  ) {
    super(enemy.id * 0.9);
    this.bar = new HealthBar(TALL + 0.25, enemyName(enemy));
    this.burst = new VoxelBurst(this.root, WORM_PALETTE.slice(0, 5), TALL * 0.6);
    for (const geometry of [...look.rings].reverse()) this.chain.push(new THREE.Mesh(geometry, look.normal));
    this.chain.push(new THREE.Mesh(look.head, look.normal));
    this.mound = new THREE.Mesh(look.mound, look.normal);
    this.hole = new THREE.Mesh(look.hole, look.normal);
    this.lit.push(...this.chain);
    this.up = enemy.buried ? 0 : 1;
    this.root.add(...this.chain, this.mound, this.hole, this.bar.group);
  }

  drawnAt(scale: number): void {
    drawnAt(this.root, scale, this.bar.group);
  }

  update(worm: Enemy, dt: number, heroX = worm.x, heroZ = worm.z): void {
    const buried = !!worm.buried;
    this.follow({ ...worm, heading: buried ? undefined : Math.atan2(heroX - worm.x, heroZ - worm.z) }, dt, buried ? 12 : TURN_RATE);
    this.bar.update(worm.hp, worm.maxHp, worm.state !== 'dead' && !buried, this.facing, worm.level, worm.state === 'chase');
    if (worm.state === 'dead') return this.die(worm.deadFor, dt);
    const t = this.time;
    this.up = Math.max(0, Math.min(1, this.up + (buried ? -RISE : RISE) * dt));
    // Underground: its hump of earth, shuddering as it goes, heaving as it's about to burst up.
    const heaving = worm.told === 'erupt' ? Math.min(1, (worm.windUp ?? 0) / 1.0) : 0;
    this.mound.visible = this.up < 0.5;
    this.mound.scale.set(1 + heaving * 0.25, 0.7 + 0.3 * Math.abs(Math.sin(t * 9)) + heaving * 0.8 * Math.abs(Math.sin(t * 30)), 1 + heaving * 0.25);
    this.hole.visible = this.up > 0;
    this.hole.scale.setScalar(Math.max(0.01, this.up));
    // Up: strung along an arc out of the hole, rearing toward the hero; its bite rearing back and striking down.
    let [tall, reach] = [TALL, REACH];
    if (worm.swingFor !== null) {
      const p = worm.swingFor / ENEMY_STATS.caveWorm.swing;
      const key = (back: number, on: number) => (p < 0.4 ? back * (p / 0.4) : p < 0.6 ? back + (on - back) * ((p - 0.4) / 0.2) : on * (1 - (p - 0.6) / 0.4));
      tall += key(0.08, -0.18);
      reach += key(-0.1, 0.24);
    }
    this.arc(tall, reach, t, this.up);
    const material = worm.hurtFor > 0 ? this.look.flash : this.look.normal;
    for (const m of this.lit) m.material = material;
  }

  // Its rings strung along an arc `tall` high, leaning `reach` on (its tail's tip in the ground), swaying; `up`: how
  // far out of the ground it is (the rest sunk below the floor, hidden).
  private arc(tall: number, reach: number, t: number, up: number): void {
    const n = this.chain.length;
    const at = (s: number) => ({
      x: Math.sin(t * 2.2 + s * 3) * 0.035 * s,
      y: tall * Math.sin((s * Math.PI) / 2) - (1 - up) * (tall + 0.1),
      z: reach * (1 - Math.cos((s * Math.PI) / 2)) + Math.sin(t * 1.7 + s * 2) * 0.02 * s,
    });
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) / n;
      const [p, ahead] = [at(s), at(s + 0.05)];
      const ring = this.chain[i];
      ring.position.set(p.x, p.y, p.z);
      ring.rotation.set(-Math.atan2(ahead.y - p.y, Math.hypot(ahead.z - p.z, ahead.x - p.x)), Math.atan2(ahead.x - p.x, ahead.z - p.z), 0, 'YXZ');
      ring.visible = p.y > -0.03 && up > 0;
    }
  }

  // Slain: slumping along the ground (its arc laid down, lying out), then bursting.
  private die(deadFor: number, dt: number): void {
    for (const m of this.lit) m.material = this.look.normal;
    this.mound.visible = false;
    const f = Math.min(1, deadFor / SLUMP);
    this.arc(TALL * (1 - f) + RING_LONG * V * f, REACH + 0.25 * f, this.time * (1 - f), 1); // (struck only while up: it dies up)
    for (const ring of this.chain) ring.position.y = Math.max(ring.position.y, (WORM_HEAD[1] / 2) * V * f * 0.8);
    if (this.burst.play(deadFor, dt)) for (const ring of this.chain) ring.visible = false;
  }

  override dispose(): void {
    super.dispose();
    this.burst.dispose();
  }
}
