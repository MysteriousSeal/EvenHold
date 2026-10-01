// A crypt lord's told moves in its scene (model/crypts/cryptLord.ts): what
// shows on the floor before each lands, red and brightening (his slam's
// ring and his sweep's, round him; his charge's strip, from him at the hero;
// the circles where his bones will burst, the floor rumbling in them: grit
// jumping, the more as it nears, and `rumble` for the camera to shake by), and
// as it lands (the slam's blow, stone flying where the blade strikes, its ring
// flashing out, a jolt; the sweep's flash; bone spikes bursting up through the
// circles and sinking back, a jolt); and his souls, ghostly skulls drifting
// after the hero, a pale trail behind.

import * as THREE from 'three';
import type { CryptFoes } from '../../model/crypts/cryptFoes';
import { CHARGE_HALF, CHARGE_LENGTH, ERUPTION_RADIUS, ERUPTION_TELL, SLAM_RADIUS, SLAM_TELL, SWEEP_RADIUS, SWEEP_TELL, eruptionSpots } from '../../model/crypts/cryptLord';
import type { Told } from '../../model/enemies/toldMoves';
import { glowMaterial } from '../meshes/common/glow';
import { cubeCloud } from '../meshes/common/cubes';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { buildSkull } from '../meshes/enemy/skeletonVoxels';
import { INDOOR_SCALE } from '../../model/constants';
import type { ImpactView } from './impactView';

const SLAM_STRIKE = 1.4; // tiles before him his greatsword strikes the floor, slamming (drawn half again as big)

const RED = 0xff3020;
const SOUL_HEIGHT = 0.42 * INDOOR_SCALE;

// Marks on the floor of one shape, as many as are wanted each frame (made as needed, hidden when not).
class Marks {
  private readonly meshes: THREE.Mesh[] = [];
  private used = 0;
  constructor(
    private readonly scene: THREE.Scene,
    private readonly geometry: THREE.BufferGeometry,
    private readonly color = RED,
  ) {}
  begin(): void {
    this.used = 0;
  }
  show(x: number, z: number, opacity: number, turn = 0, y = 0.012, scale = 1): void {
    let mesh = this.meshes[this.used];
    if (!mesh) {
      mesh = new THREE.Mesh(this.geometry, glowMaterial(this.color));
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    mesh.visible = true;
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    mesh.scale.setScalar(scale);
    (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    this.used++;
  }
  end(): void {
    for (let i = this.used; i < this.meshes.length; i++) this.meshes[i].visible = false;
  }
  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      (mesh.material as THREE.Material).dispose();
    }
    this.geometry.dispose();
  }
}

const ring = (r: number) => new THREE.RingGeometry(r - 0.1, r, 48).rotateX(-Math.PI / 2);
const disc = (r: number) => new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2);

export class LordMovesView {
  private readonly slamRing: Marks;
  private readonly slamZone: Marks;
  private readonly sweepRing: Marks;
  private readonly sweepZone: Marks;
  private readonly strip: Marks;
  private readonly circles: Marks;
  private readonly circleEdges: Marks;
  private readonly spikes: THREE.InstancedMesh;
  private readonly bursts: Array<{ x: number; z: number; age: number }> = [];
  private readonly burst = new WeakSet<Told>();
  private readonly skull: THREE.BufferGeometry;
  private readonly soulMaterial = glowMaterial(0xc8ffe8);
  private readonly souls: THREE.Mesh[] = [];
  private readonly trail: THREE.InstancedMesh;
  private readonly wisps: Array<{ x: number; y: number; z: number; age: number }> = [];
  private readonly grit: THREE.InstancedMesh; // jumping in the circles as the floor rumbles
  private readonly bits: Array<{ x: number; y: number; z: number; vy: number; age: number; tone: number }> = [];
  rumble = 0; // how hard the floor's shaking now (0..1): the camera's to shake by
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private time = 0;

  private readonly slammed = new WeakSet<Told>(); // the slams already come down
  private readonly jolts: number[] = []; // seconds since each blow shook the floor

  constructor(
    private readonly scene: THREE.Scene,
    private readonly impacts: ImpactView, // where a blow hits the floor: chips, dust
  ) {
    this.slamRing = new Marks(scene, ring(SLAM_RADIUS));
    this.slamZone = new Marks(scene, disc(SLAM_RADIUS));
    this.sweepRing = new Marks(scene, ring(SWEEP_RADIUS));
    this.sweepZone = new Marks(scene, disc(SWEEP_RADIUS), 0xffa070);
    this.strip = new Marks(scene, new THREE.PlaneGeometry(CHARGE_LENGTH, CHARGE_HALF * 2).rotateX(-Math.PI / 2).translate(CHARGE_LENGTH / 2, 0, 0));
    this.circles = new Marks(scene, disc(ERUPTION_RADIUS));
    this.circleEdges = new Marks(scene, ring(ERUPTION_RADIUS));
    this.spikes = cubeCloud(120, new THREE.MeshStandardMaterial({ roughness: 0.8 }));
    scene.add(this.spikes);
    const grid = buildSkull();
    this.skull = greedyMesh(grid, [0xe8fff4, 0x9fe8cc, 0x5ab89a, 0x0a2a20], 0.022, new THREE.Vector3(-5.5 * 0.022, -5.5 * 0.022, -5.5 * 0.022));
    this.trail = cubeCloud(160, glowMaterial());
    scene.add(this.trail);
    this.grit = cubeCloud(220, new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    scene.add(this.grit);
  }

  update(crypt: CryptFoes | null, dt: number): void {
    this.time += dt;
    const marks = [this.slamRing, this.slamZone, this.sweepRing, this.sweepZone, this.strip, this.circles, this.circleEdges];
    for (const m of marks) m.begin();
    // The slam's ring, brightening till it lands; then the blow: stone flying where the blade strikes, the ring
    // flashing out as a shockwave, fading, and a jolt.
    for (const slam of crypt?.slams.moves ?? []) {
      const told = slam.t / SLAM_TELL;
      if (told < 1) {
        this.slamRing.show(slam.x, slam.z, 0.4 + 0.6 * told);
        this.slamZone.show(slam.x, slam.z, 0.08 + 0.25 * told, 0, 0.01);
        continue;
      }
      const since = slam.t - SLAM_TELL;
      this.slamZone.show(slam.x, slam.z, 0.6 * Math.max(0, 1 - since / 0.3), 0, 0.01);
      this.slamRing.show(slam.x, slam.z, Math.max(0, 1 - since / 0.4), 0, 0.012, 1 + since * 1.6); // (spreading out)
      if (since >= 0.08 && !this.slammed.has(slam)) {
        this.slammed.add(slam);
        this.impacts.hit(slam.x + slam.dx * SLAM_STRIKE, slam.z + slam.dz * SLAM_STRIKE, slam.dx, slam.dz);
        this.impacts.hit(slam.x + slam.dx * SLAM_STRIKE, slam.z + slam.dz * SLAM_STRIKE, -slam.dx, -slam.dz);
        this.jolts.push(0);
      }
    }
    // The sweep's: brightening; as the sword comes round, a flash fading out.
    for (const sweep of crypt?.sweeps.moves ?? []) {
      const told = sweep.t / SWEEP_TELL;
      if (told < 1) {
        this.sweepRing.show(sweep.x, sweep.z, 0.35 + 0.6 * told);
        this.sweepZone.show(sweep.x, sweep.z, 0.06 + 0.2 * told, 0, 0.01);
      } else this.sweepZone.show(sweep.x, sweep.z, 0.7 * Math.max(0, 1 - (told - 1) * 3), 0, 0.01);
    }
    // The charge's strip, from where he stands at the hero, brightening.
    for (const charge of crypt?.charges.moves ?? []) {
      if (charge.t < 0.9) this.strip.show(charge.x, charge.z, 0.15 + 0.45 * (charge.t / 0.9), Math.atan2(-charge.dz, charge.dx));
    }
    // Where his bones will burst: circles brightening, the floor rumbling in them; then the spikes, once.
    this.rumble = 0;
    for (const eruption of crypt?.eruptions.moves ?? []) {
      const told = eruption.t / ERUPTION_TELL;
      if (told < 1) this.rumble = Math.max(this.rumble, 0.25 + 0.5 * told * told);
      for (const spot of eruptionSpots(eruption)) {
        if (told < 1) {
          for (let k = 0; k < Math.ceil(dt * (20 + 60 * told)); k++) {
            const [a, r] = [Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * ERUPTION_RADIUS];
            this.bits.push({ x: spot.x + Math.cos(a) * r, y: 0.02, z: spot.z + Math.sin(a) * r, vy: 0.4 + Math.random() * (0.6 + 1.2 * told), age: 0, tone: Math.random() });
          }
          this.circles.show(spot.x, spot.z, 0.08 + 0.3 * told, 0, 0.01);
          this.circleEdges.show(spot.x, spot.z, (0.3 + 0.6 * told) * (0.75 + 0.25 * Math.sin(this.time * 18)));
        } else if (!this.burst.has(eruption)) this.bursts.push({ ...spot, age: 0 });
      }
      if (told >= 1) this.burst.add(eruption);
    }
    for (const m of marks) m.end();
    for (const b of this.bursts) if (b.age < 0.25) this.rumble = Math.max(this.rumble, 1 - b.age / 0.25); // (the jolt as they burst)
    for (let i = this.jolts.length - 1; i >= 0; i--) {
      this.jolts[i] += dt; // (a slam's: sharp, short)
      if (this.jolts[i] > 0.25) this.jolts.splice(i, 1);
      else this.rumble = Math.max(this.rumble, 1 - this.jolts[i] / 0.25);
    }
    this.spikesOn(dt);
    this.gritOn(dt);
    this.soulsOn(crypt, dt);
  }

  // Bone spikes bursting up through each circle (fast), standing a moment, sinking back.
  private spikesOn(dt: number): void {
    let n = 0;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      if (b.age > 0.9) {
        this.bursts.splice(i, 1);
        continue;
      }
      const rise = b.age < 0.12 ? b.age / 0.12 : b.age > 0.6 ? Math.max(0, 1 - (b.age - 0.6) / 0.3) : 1;
      for (let k = 0; k < 7; k++) {
        const a = k * 2.4 + b.x;
        const r = k === 0 ? 0 : 0.18 + (k % 3) * 0.17;
        const high = (k === 0 ? 0.75 : 0.35 + (k % 4) * 0.1) * rise;
        if (high < 0.01) continue;
        const w = k === 0 ? 0.11 : 0.07;
        this.matrix.makeScale(w, high, w).setPosition(b.x + Math.cos(a) * r, high / 2, b.z + Math.sin(a) * r);
        this.spikes.setMatrixAt(n, this.matrix);
        this.spikes.setColorAt(n, this.color.setHex(k % 2 ? 0xd8cfb4 : 0xb3a88e));
        n++;
      }
    }
    this.spikes.count = n;
    this.spikes.instanceMatrix.needsUpdate = true;
    if (this.spikes.instanceColor) this.spikes.instanceColor.needsUpdate = true;
  }

  // The grit, jumping up and falling back, gone as it lands.
  private gritOn(dt: number): void {
    let n = 0;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.age += dt;
      b.vy -= 9 * dt;
      b.y += b.vy * dt;
      if (b.y < 0.01 || n >= 220) {
        this.bits.splice(i, 1);
        continue;
      }
      const size = 0.025 + b.tone * 0.025;
      this.matrix.makeScale(size, size, size).setPosition(b.x, b.y, b.z);
      this.grit.setMatrixAt(n, this.matrix);
      this.grit.setColorAt(n, this.color.setHex(b.tone < 0.4 ? 0x6e6a66 : b.tone < 0.8 ? 0x57534f : 0xb3a88e));
      n++;
    }
    this.grit.count = n;
    this.grit.instanceMatrix.needsUpdate = true;
    if (this.grit.instanceColor) this.grit.instanceColor.needsUpdate = true;
  }

  // His souls: a ghostly skull each, bobbing as it drifts, facing the way it goes, a pale trail of wisps fading behind.
  private soulsOn(crypt: CryptFoes | null, dt: number): void {
    const souls = crypt?.souls ?? [];
    while (this.souls.length < souls.length) {
      const mesh = new THREE.Mesh(this.skull, this.soulMaterial);
      this.scene.add(mesh);
      this.souls.push(mesh);
    }
    this.souls.forEach((mesh, i) => {
      const soul = souls[i];
      mesh.visible = !!soul;
      if (!soul) return;
      const y = SOUL_HEIGHT + Math.sin(this.time * 6 + i * 2) * 0.06;
      mesh.position.set(soul.x, y, soul.z);
      mesh.rotation.set(0, Math.atan2(soul.dx, soul.dz), 0);
      if (Math.random() < dt * 40) this.wisps.push({ x: soul.x - soul.dx * 0.15, y, z: soul.z - soul.dz * 0.15, age: 0 });
    });
    let n = 0;
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      w.age += dt;
      if (w.age > 0.5 || n >= 160) {
        this.wisps.splice(i, 1);
        continue;
      }
      const left = 1 - w.age / 0.5;
      const size = 0.05 * left;
      this.matrix.makeScale(size, size, size).setPosition(w.x, w.y + w.age * 0.2, w.z);
      this.trail.setMatrixAt(n, this.matrix);
      this.trail.setColorAt(n, this.color.setHex(0x9fffd8).multiplyScalar(left));
      n++;
    }
    this.trail.count = n;
    this.trail.instanceMatrix.needsUpdate = true;
    if (this.trail.instanceColor) this.trail.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const m of [this.slamRing, this.slamZone, this.sweepRing, this.sweepZone, this.strip, this.circles, this.circleEdges]) m.dispose();
    for (const mesh of [this.spikes, this.trail, this.grit]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const mesh of this.souls) mesh.removeFromParent();
    this.skull.dispose();
    this.soulMaterial.dispose();
  }
}
