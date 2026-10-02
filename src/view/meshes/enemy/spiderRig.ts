// A spider on screen (spiderVoxels.ts: a cave spider, a hatchling, the brood
// mother), its parts on their joints, posed each frame from the model:
// - walking, its legs in two alternating fours (one side's first and third
//   with the other's second and fourth), each swung on and lifted, paced by
//   the ground it covers; at rest, now and then a leg twitches, its abdomen
//   swells and settles as it breathes;
// - its bite: rearing back, fangs spread, then lunging in, fangs closing;
// - its told moves (model/caves/caveMoves.ts): spitting a web (rearing, its
//   fangs wide, snapping forward as it spits); lunging (crouched, forelegs
//   raised, then a leap, arcing); the brood mother's volley (rearing high,
//   abdomen raised) and charge (head down, forelegs pawing, then the rush);
// - a red flash while hurt (its eyes and venom burn on, unlit), its bar over
//   it (a skull by the brood mother's name: a boss);
// - slain, it flips onto its back, legs curling in, then bursts.

import * as THREE from 'three';
import { CreatureRig } from '../common/creatureRig';
import { ENEMY_STATS } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { HealthBar, VoxelBurst, enemyName, type EnemyRig } from './enemyParts';
import { drawnAt } from '../common/overhead';
import { SPIDER_GLOW, SPIDER_VOXEL as V, type SpiderSpec } from './spiderVoxels';
import { LUNGE_TELL } from '../../../model/caves/caveMoves';
import { isBoss } from '../../../model/enemies/enemyLevels';

const STRIDE = 9; // gait radians per tile covered
const TURN_RATE = 10;
const FLIP_TIME = 0.4; // seconds to roll onto its back, slain
const LEAP = 0.22; // seconds a lunge's leap takes (caveMoves.ts)

export interface SpiderLook {
  spec: SpiderSpec;
  normal: THREE.Material;
  flash: THREE.Material;
  glow: THREE.Material; // its eyes and venom, unlit
  head: [THREE.BufferGeometry, THREE.BufferGeometry]; // lit, glowing
  abdomen: THREE.BufferGeometry;
  fangs: [THREE.BufferGeometry, THREE.BufferGeometry];
  legs: THREE.BufferGeometry[]; // a pair's, front first
}

// Shared by every spider of a kind: its parts meshed round their joints, its materials.
export function createSpiderLook(spec: SpiderSpec, flash: THREE.Material): SpiderLook {
  const mesh = (grid: VoxelGrid, pivot: [number, number, number], glows = false) =>
    greedyMesh(grid, spec.palette, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V), (c) => SPIDER_GLOW.has(c) === glows);
  const { head, abdomen, fangs, leg } = spec;
  const headGrid = head.build();
  const fangGrid = fangs.build();
  const headPivot: [number, number, number] = [head.size[0] / 2, 1.5, 0]; // (its back, at the hips' height)
  const fangPivot: [number, number, number] = [fangs.size[0] / 2, fangs.size[1], 0]; // (hung from their roots)
  return {
    spec,
    normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }), // (chitin: a little sheen)
    flash,
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    head: [mesh(headGrid, headPivot), mesh(headGrid, headPivot, true)],
    abdomen: mesh(abdomen.build(), [abdomen.size[0] / 2, abdomen.size[1] * 0.35, abdomen.size[2]]), // (from its front, at the waist)
    fangs: [mesh(fangGrid, fangPivot), mesh(fangGrid, fangPivot, true)],
    legs: [0, 1, 2, 3].map((pair) => mesh(leg.build(pair), [0, spec.hipY, leg.size[2] / 2])),
  };
}

interface SpiderLeg {
  yaw: THREE.Group; // swung on (about the hip, upright)
  lift: THREE.Group; // and lifted (about its own length)
  side: number; // +1 its left (+X), -1 its right
  pair: number;
  spread: number;
}

export class SpiderRig extends CreatureRig implements EnemyRig {
  private readonly body = new THREE.Group(); // all of it, pitched and raised
  private readonly abdomen = new THREE.Group();
  private readonly fangs = new THREE.Group();
  private readonly legs: SpiderLeg[] = [];
  private readonly lit: THREE.Mesh[] = [];
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;
  private readonly hip: number; // its hips' height (its legs' reach down)
  private readonly glow: THREE.Mesh[] = [];
  private phase = 0;

  constructor(
    enemy: Enemy,
    private readonly look: SpiderLook,
  ) {
    super(enemy.id * 1.3);
    const { spec } = look;
    this.hip = spec.hipY * V;
    const headLong = spec.head.size[2] * V;
    const tall = this.hip + (spec.head.size[1] + spec.abdomen.size[1] * 0.5) * V;
    this.bar = new HealthBar(tall + 0.16, enemyName(enemy), ENEMY_STATS[enemy.kind].passive, isBoss(enemy.kind));
    this.burst = new VoxelBurst(this.root, spec.palette.slice(0, 5), tall);
    const add = (geometry: THREE.BufferGeometry, parent: THREE.Object3D, glows = false) => {
      const m = new THREE.Mesh(geometry, glows ? look.glow : look.normal);
      parent.add(m);
      (glows ? this.glow : this.lit).push(m);
      return m;
    };
    const back = -headLong * 0.45; // (the head's back, behind the hips' middle)
    this.body.position.y = this.hip;
    const head = new THREE.Group();
    head.position.z = back;
    add(look.head[0], head);
    add(look.head[1], head, true);
    this.fangs.position.set(0, 0, headLong - V);
    add(look.fangs[0], this.fangs);
    add(look.fangs[1], this.fangs, true);
    head.add(this.fangs);
    this.abdomen.position.set(0, V, back + V); // (its waist, at the head's back)
    add(look.abdomen, this.abdomen);
    this.body.add(head, this.abdomen);
    spec.hips.forEach(([across, along], pair) => {
      for (const side of [1, -1]) {
        const yaw = new THREE.Group();
        yaw.position.set(side * across * V, 0, back + along * V);
        const lift = new THREE.Group();
        const m = add(look.legs[pair], lift);
        m.scale.x = side; // (built for the left: mirrored for the right)
        yaw.add(lift);
        this.body.add(yaw);
        this.legs.push({ yaw, lift, side, pair, spread: spec.spread[pair] });
      }
    });
    this.root.add(this.body, this.bar.group);
  }

  drawnAt(scale: number): void {
    drawnAt(this.root, scale, this.bar.group);
  }

  update(spider: Enemy, dt: number, heroX = spider.x, heroZ = spider.z): void {
    const set = spider.state === 'chase' && !!spider.told; // (a told move: it faces the way it began, as the model holds it)
    const moved = this.follow({ ...spider, heading: set || spider.swingFor !== null ? Math.atan2(heroX - spider.x, heroZ - spider.z) : undefined }, dt, TURN_RATE);
    this.bar.update(spider.hp, spider.maxHp, spider.state !== 'dead', this.facing, spider.level, spider.state === 'chase');
    if (spider.state === 'dead') return this.die(spider.deadFor, dt);
    if (moved > 1e-4) this.phase += ((moved / this.root.scale.x) * STRIDE * 4) / this.look.spec.hipY; // (as drawn: a bigger one takes longer strides)
    const walking = Math.min(1, moved / Math.max(1e-6, dt) / 0.4);
    const t = this.time;

    // At rest: the body low and still, its abdomen breathing; walking: the gait.
    this.body.position.set(0, this.hip + Math.abs(Math.sin(this.phase)) * 0.006 * walking, 0);
    this.body.rotation.set(0, 0, 0);
    this.abdomen.rotation.x = 0.15 + Math.sin(t * 1.8) * 0.03;
    this.abdomen.scale.setScalar(1 + Math.sin(t * 1.8) * 0.02);
    this.fangs.rotation.x = 0;
    for (const leg of this.legs) {
      const group = (leg.pair + (leg.side > 0 ? 0 : 1)) % 2; // (alternating fours)
      const step = this.phase + group * Math.PI;
      const twitch = walking < 0.1 && Math.sin(t * 0.7 + leg.pair * 2.1 + leg.side) > 0.985 ? 0.25 : 0;
      this.pose(leg, Math.sin(step) * 0.28 * walking, Math.max(0, Math.cos(step)) * 0.4 * walking + twitch);
    }

    if (spider.told) this.told(spider);
    else if (spider.swingFor !== null) this.bite(spider.swingFor / ENEMY_STATS[spider.kind].swing);
    const material = spider.hurtFor > 0 ? this.look.flash : this.look.normal;
    for (const m of this.lit) m.material = material;
  }

  // A leg swung on (`swing`, radians toward its front) and lifted (`lift`, radians, its foot up).
  private pose(leg: SpiderLeg, swing: number, lift: number): void {
    leg.yaw.rotation.y = -leg.side * (leg.spread + swing);
    leg.lift.rotation.z = leg.side * lift;
  }

  // Its told move, by how far into it (windUp: seconds).
  private told(spider: Enemy): void {
    const s = spider.windUp ?? 0;
    const k = (tell: number) => Math.min(1, s / tell); // (0 .. 1 over the tell)
    const fore = this.legs.filter((l) => l.pair === 0);
    if (spider.told === 'web' || spider.told === 'volley') {
      const tell = spider.told === 'web' ? 0.55 : 0.8;
      const snap = s > tell ? Math.max(0, 1 - (s - tell) / 0.2) : 0; // (spat: snapping forward, then back)
      const rear = s < tell ? k(tell) : snap;
      this.body.rotation.x = -(spider.told === 'volley' ? 0.6 : 0.45) * rear + (s > tell ? 0.25 * snap : 0);
      this.body.position.y += 0.03 * rear;
      this.abdomen.rotation.x = 0.15 + 0.5 * rear;
      this.fangs.rotation.x = -0.7 * rear; // (spread wide)
      for (const leg of fore) this.pose(leg, 0.5 * rear, 0.9 * rear);
    } else if (spider.told === 'lunge') {
      const leap = s > LUNGE_TELL ? Math.min(1, (s - LUNGE_TELL) / LEAP) : 0;
      const crouch = s < LUNGE_TELL ? k(LUNGE_TELL) : 1 - leap;
      this.body.position.y += -0.025 * crouch + Math.sin(Math.PI * leap) * 0.18;
      this.body.rotation.x = 0.12 * crouch - 0.3 * Math.sin(Math.PI * leap);
      this.fangs.rotation.x = -0.6 * Math.max(crouch, leap);
      for (const leg of fore) this.pose(leg, 0.6, 1.1 * Math.max(crouch, leap));
      for (const leg of this.legs.filter((l) => l.pair === 3)) this.pose(leg, -0.2, -0.2 * crouch); // (hind legs braced)
    } else if (spider.told === 'charge') {
      const tell = 0.9;
      const pawing = s < tell ? Math.max(0, Math.sin(s * 14)) * k(tell) : 0;
      this.body.rotation.x = 0.18 * k(tell); // (head down)
      this.abdomen.rotation.x = 0.45 * k(tell);
      for (const leg of fore) this.pose(leg, 0.4, 0.3 + pawing * (leg.side > 0 ? 0.6 : 0.3));
    }
  }

  // Its bite over p (0..1): rearing back, fangs spread; lunging in, fangs closing; settling.
  private bite(p: number): void {
    const key = (back: number, on: number) => (p < 0.4 ? back * (p / 0.4) : p < 0.6 ? back + (on - back) * ((p - 0.4) / 0.2) : on * (1 - (p - 0.6) / 0.4));
    this.body.rotation.x = key(-0.3, 0.2);
    this.body.position.z = key(-0.03, 0.08);
    this.fangs.rotation.x = key(-0.8, 0.2);
    for (const leg of this.legs.filter((l) => l.pair === 0)) this.pose(leg, key(0.4, 0.7), key(0.8, 0.2));
  }

  // Slain: rolled onto its back, its legs curled in over it; then bursting.
  private die(deadFor: number, dt: number): void {
    for (const m of this.lit) m.material = this.look.normal;
    const f = Math.min(1, deadFor / FLIP_TIME);
    const ease = f * f * (3 - 2 * f);
    this.body.rotation.set(0, 0, Math.PI * ease);
    this.body.position.set(0, this.hip * (1 - ease) + this.look.spec.head.size[1] * V * 0.6 * ease, 0);
    for (const leg of this.legs) this.pose(leg, 0, -1.1 * ease); // (curled in under, now over)
    for (const m of this.glow) m.visible = f < 1; // (its eyes gone dark)
    if (this.burst.play(deadFor, dt)) this.body.visible = false;
  }

  override dispose(): void {
    super.dispose();
    this.burst.dispose();
  }
}
