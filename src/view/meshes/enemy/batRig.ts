// A cave bat on screen (batVoxels.ts), in the air (its height its own: the
// model has it on the ground): its wings beating fast (each beat lifting it,
// its body bobbing with them), leaning into its flight; now and then, at
// rest, a glide on still wings. Its bite: a swoop in, wings swept up over it,
// then a beat back off. A red flash while hurt (its eyes burning on, unlit);
// slain, its wings fold and it drops to the ground, then bursts.

import * as THREE from 'three';
import { CreatureRig } from '../common/creatureRig';
import { ENEMY_STATS } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { greedyMesh } from '../voxel/greedyMesh';
import { HealthBar, VoxelBurst, enemyName, type EnemyRig } from './enemyParts';
import { drawnAt } from '../common/overhead';
import { BAT_BODY, BAT_GLOW, BAT_PALETTE, BAT_SHOULDER, BAT_VOXEL as V, BAT_WING, batBody, batWing } from './batVoxels';

const HOVER = 0.34; // its height, flying (as built: drawn bigger in a room)
const BEAT = 17; // its wingbeat, radians a second
const TURN_RATE = 9;
const DROP_TIME = 0.35; // seconds it falls, slain

export interface BatLook {
  normal: THREE.Material;
  flash: THREE.Material;
  glow: THREE.Material;
  body: [THREE.BufferGeometry, THREE.BufferGeometry]; // lit, glowing (its eyes)
  wing: THREE.BufferGeometry;
}

export function createBatLook(flash: THREE.Material): BatLook {
  const mesh = (grid: ReturnType<typeof batBody>, pivot: [number, number, number], glows = false) =>
    greedyMesh(grid, BAT_PALETTE, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V), (c) => BAT_GLOW.has(c) === glows);
  const body = batBody();
  const pivot: [number, number, number] = [BAT_BODY[0] / 2, BAT_SHOULDER.y, BAT_SHOULDER.z];
  return {
    normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), // (its wings one voxel thin: seen from under too)
    flash,
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    body: [mesh(body, pivot), mesh(body, pivot, true)],
    wing: mesh(batWing(), [0, 0, BAT_WING[2] - 0.5]), // (from the shoulder, its leading edge)
  };
}

export class BatRig extends CreatureRig implements EnemyRig {
  private readonly fly = new THREE.Group(); // all of it, up in the air
  private readonly wings: Array<{ group: THREE.Group; side: number }> = [];
  private readonly lit: THREE.Mesh[] = [];
  private readonly eyes: THREE.Mesh;
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;

  constructor(
    enemy: Enemy,
    private readonly look: BatLook,
  ) {
    super(enemy.id * 2.3);
    this.bar = new HealthBar(HOVER + 0.3, enemyName(enemy));
    this.burst = new VoxelBurst(this.root, BAT_PALETTE.slice(0, 5), HOVER);
    const body = new THREE.Mesh(look.body[0], look.normal);
    this.eyes = new THREE.Mesh(look.body[1], look.glow);
    this.lit.push(body);
    this.fly.add(body, this.eyes);
    for (const side of [1, -1]) {
      const group = new THREE.Group();
      group.position.x = side * (BAT_BODY[0] / 2 - 0.5) * V;
      const wing = new THREE.Mesh(look.wing, look.normal);
      wing.scale.x = side; // (built for the left: mirrored for the right)
      group.add(wing);
      this.lit.push(wing);
      this.fly.add(group);
      this.wings.push({ group, side });
    }
    this.root.add(this.fly, this.bar.group);
  }

  drawnAt(scale: number): void {
    drawnAt(this.root, scale, this.bar.group);
  }

  update(bat: Enemy, dt: number, heroX = bat.x, heroZ = bat.z): void {
    const set = bat.state === 'chase';
    const moved = this.follow({ ...bat, heading: bat.swingFor !== null ? Math.atan2(heroX - bat.x, heroZ - bat.z) : undefined }, dt, TURN_RATE);
    this.bar.update(bat.hp, bat.maxHp, bat.state !== 'dead', this.facing, bat.level, set);
    if (bat.state === 'dead') return this.die(bat.deadFor, dt);
    const t = this.time;
    const speed = dt > 0 ? moved / dt : 0;
    // Beating, faster when set on the hero; at rest, now and then a glide (wings held out).
    const gliding = !set && Math.sin(t * 0.9) > 0.6;
    const beat = gliding ? 0 : Math.sin(t * BEAT * (set ? 1.2 : 1));
    this.fly.position.set(0, HOVER + beat * 0.025 + Math.sin(t * 2.3) * 0.03, 0);
    this.fly.rotation.set(Math.min(0.5, speed * 0.15), 0, Math.sin(t * 3.1) * 0.12);
    for (const w of this.wings) w.group.rotation.z = w.side * (gliding ? 0.08 : beat * 0.85 + 0.1);
    if (bat.swingFor !== null) this.swoop(bat.swingFor / ENEMY_STATS.caveBat.swing);
    const material = bat.hurtFor > 0 ? this.look.flash : this.look.normal;
    for (const m of this.lit) m.material = material;
  }

  // Its bite over p (0..1): rising, wings swept up over it; swooping in and down; beating back off.
  private swoop(p: number): void {
    const key = (up: number, down: number) => (p < 0.35 ? up * (p / 0.35) : p < 0.6 ? up + (down - up) * ((p - 0.35) / 0.25) : down * (1 - (p - 0.6) / 0.4));
    this.fly.position.y += key(0.08, -0.14);
    this.fly.position.z = key(-0.04, 0.14);
    this.fly.rotation.x = key(-0.3, 0.7);
    for (const w of this.wings) w.group.rotation.z = w.side * key(1.2, -0.3);
  }

  // Slain: its wings folded, dropping to the ground; then bursting.
  private die(deadFor: number, dt: number): void {
    for (const m of this.lit) m.material = this.look.normal;
    const f = Math.min(1, deadFor / DROP_TIME);
    this.fly.position.set(0, HOVER * (1 - f * f), 0);
    this.fly.rotation.set(0.4 * f, 0, 1.3 * f);
    for (const w of this.wings) w.group.rotation.z = w.side * 1.4 * f; // (folded up over it)
    this.eyes.visible = f < 1;
    if (this.burst.play(deadFor, dt)) this.fly.visible = false;
  }

  override dispose(): void {
    super.dispose();
    this.burst.dispose();
  }
}
