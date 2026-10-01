// A draugr's frost breath in a crypt's scene (model/crypts/frostBreath.ts):
// drawing breath, frost motes swirl in toward its mouth, a pale glow gathers
// there, and the cone's outline shows faintly on the floor, pulsing; loosed,
// a burst of icy motes pours out across the cone, spreading, slowing, sinking
// to the floor, shrinking and fading from white to ice blue, a sheet of frost
// sweeping out over the floor along it and fading slow, ice crystals left
// glinting where it passed. All small voxel cubes, one instanced mesh, lit by
// nothing (they glow), added on (never darkening what's under them).

import * as THREE from 'three';
import { INDOOR_SCALE } from '../../model/constants';
import { BREATH_REACH, BREATH_TELL, BREATH_WIDTH, type Breath } from '../../model/crypts/frostBreath';

const MAX = 600; // motes at once
const MOUTH = 0.42 * INDOOR_SCALE * 1.15; // its mouth's height (a draugr's, drawn big)
const BURST = 90; // motes loosed in a breath
const SHEET_GROW = 0.22; // seconds the sheet takes to sweep out
const SHEET_FADE = 1.4; // and to fade
const WHITE = new THREE.Color(0xf4fcff);
const ICE = new THREE.Color(0x5cc8ff);

interface Mote {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  drag: number;
  still: boolean; // a crystal left on the floor
}

export class FrostBreathView {
  private readonly motes: Mote[] = [];
  private readonly mesh: THREE.InstancedMesh;
  private readonly material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly fan = new THREE.CircleGeometry(BREATH_REACH, 32, -BREATH_WIDTH, BREATH_WIDTH * 2).rotateX(-Math.PI / 2); // (along +X)
  private readonly edge = new THREE.RingGeometry(BREATH_REACH - 0.06, BREATH_REACH, 32, 1, -BREATH_WIDTH, BREATH_WIDTH * 2).rotateX(-Math.PI / 2);
  private readonly sheets: Array<{ fan: THREE.Mesh; edge: THREE.Mesh; age: number; breath: Breath | null }> = [];
  private readonly glows = new Map<Breath, THREE.Mesh>(); // the light gathering at a mouth
  private readonly loosed = new WeakSet<Breath>();
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material, MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  update(breaths: readonly Breath[], dt: number): void {
    this.time += dt;
    for (const breath of breaths) {
      const mouth = { x: breath.x + breath.dx * 0.18, z: breath.z + breath.dz * 0.18 };
      if (breath.t < BREATH_TELL) this.drawIn(breath, mouth, dt);
      else if (!this.loosed.has(breath)) this.loose(breath, mouth);
    }
    for (const [breath, glow] of this.glows) {
      if (breaths.includes(breath) && breath.t < BREATH_TELL) continue;
      glow.removeFromParent();
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
      this.glows.delete(breath);
    }
    this.sheetsOn(breaths, dt);
    this.motesOn(dt);
  }

  // Drawing breath: motes swirl in toward its mouth; a glow gathers there; the cone's outline pulses on the floor.
  private drawIn(breath: Breath, mouth: { x: number; z: number }, dt: number): void {
    const drawn = breath.t / BREATH_TELL;
    for (let i = 0; i < Math.ceil(70 * dt); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 0.45;
      const [x, y, z] = [mouth.x + Math.cos(a) * r, MOUTH + (Math.random() - 0.3) * 0.4, mouth.z + Math.sin(a) * r];
      const life = 0.3 + Math.random() * 0.15;
      // Toward the mouth, swirling round it as they come.
      const [tx, ty, tz] = [(mouth.x - x) / life, (MOUTH - y) / life, (mouth.z - z) / life];
      this.add({ x, y, z, vx: tx - Math.sin(a) * 0.8, vy: ty, vz: tz + Math.cos(a) * 0.8, age: 0, life, size: 0.025 + Math.random() * 0.02, drag: 0, still: false });
    }
    let glow = this.glows.get(breath);
    if (!glow) {
      glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbfeeff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.scene.add(glow);
      this.glows.set(breath, glow);
    }
    glow.position.set(mouth.x, MOUTH, mouth.z);
    glow.scale.setScalar(0.4 + drawn * 1.1 + Math.sin(this.time * 30) * 0.08);
    (glow.material as THREE.MeshBasicMaterial).opacity = 0.25 + drawn * 0.6;
    if (!this.sheets.some((s) => s.breath === breath)) this.sheets.push({ ...this.sheet(breath), age: -1, breath });
  }

  // The frost loosed: a burst of motes pouring out across the cone, and the sheet sweeping out over the floor.
  private loose(breath: Breath, mouth: { x: number; z: number }): void {
    this.loosed.add(breath);
    const heading = Math.atan2(breath.dz, breath.dx);
    for (let i = 0; i < BURST; i++) {
      const a = heading + (Math.random() - 0.5) * 2 * BREATH_WIDTH * 0.95;
      const speed = 3.2 + Math.random() * 3.6;
      const [x, z] = [mouth.x + (Math.random() - 0.5) * 0.12, mouth.z + (Math.random() - 0.5) * 0.12];
      this.add({ x, y: MOUTH + (Math.random() - 0.5) * 0.08, z, vx: Math.cos(a) * speed, vy: -0.4 - Math.random() * 0.9, vz: Math.sin(a) * speed, age: 0, life: 0.55 + Math.random() * 0.55, size: 0.04 + Math.random() * 0.06, drag: 2.4, still: false });
    }
    // Crystals left on the floor, scattered over the cone, glinting as they fade.
    for (let i = 0; i < 26; i++) {
      const a = heading + (Math.random() - 0.5) * 2 * BREATH_WIDTH * 0.85;
      const r = 0.4 + Math.sqrt(Math.random()) * (BREATH_REACH - 0.5);
      this.add({ x: breath.x + Math.cos(a) * r, y: 0.02, z: breath.z + Math.sin(a) * r, vx: 0, vy: 0, vz: 0, age: -r / 6, life: 2 + Math.random(), size: 0.03 + Math.random() * 0.03, drag: 0, still: true });
    }
    const told = this.sheets.find((s) => s.breath === breath);
    if (told) told.age = 0;
    else this.sheets.push({ ...this.sheet(breath), age: 0, breath });
  }

  private sheet(breath: Breath): { fan: THREE.Mesh; edge: THREE.Mesh } {
    const make = (geometry: THREE.BufferGeometry) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      mesh.position.set(breath.x, 0.015, breath.z);
      mesh.rotation.y = Math.atan2(-breath.dz, breath.dx);
      this.scene.add(mesh);
      return mesh;
    };
    return { fan: make(this.fan), edge: make(this.edge) };
  }

  // The sheets: told (age -1: a faint pulsing outline), then sweeping out and fading.
  private sheetsOn(breaths: readonly Breath[], dt: number): void {
    for (let i = this.sheets.length - 1; i >= 0; i--) {
      const sheet = this.sheets[i];
      const [fan, edge] = [sheet.fan.material as THREE.MeshBasicMaterial, sheet.edge.material as THREE.MeshBasicMaterial];
      if (sheet.age < 0) {
        if (!sheet.breath || !breaths.includes(sheet.breath)) sheet.age = SHEET_GROW + SHEET_FADE; // (lost its breath: gone)
        else {
          const drawn = sheet.breath.t / BREATH_TELL;
          fan.opacity = 0.03 + 0.05 * drawn;
          edge.opacity = (0.15 + 0.35 * drawn) * (0.7 + 0.3 * Math.sin(this.time * 14));
          continue;
        }
      }
      sheet.age += dt;
      const grow = Math.min(1, sheet.age / SHEET_GROW);
      const fade = Math.max(0, 1 - (sheet.age - SHEET_GROW) / SHEET_FADE);
      const reach = 0.15 + 0.85 * (1 - (1 - grow) ** 3); // (eased out)
      sheet.fan.scale.setScalar(reach);
      sheet.edge.scale.setScalar(reach);
      fan.opacity = 0.42 * fade;
      edge.opacity = 0.8 * fade * (grow < 1 ? 1 : fade);
      if (sheet.age >= SHEET_GROW + SHEET_FADE) {
        for (const mesh of [sheet.fan, sheet.edge]) {
          mesh.removeFromParent();
          (mesh.material as THREE.Material).dispose();
        }
        this.sheets.splice(i, 1);
      }
    }
  }

  private add(mote: Mote): void {
    if (this.motes.length >= MAX) this.motes.shift();
    this.motes.push(mote);
  }

  // The motes on: moving, slowing, sinking (never through the floor), shrinking and fading white to ice; crystals glinting.
  private motesOn(dt: number): void {
    let n = 0;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += dt;
      if (m.age >= m.life) {
        this.motes.splice(i, 1);
        continue;
      }
      if (m.age < 0) continue; // (a crystal not yet reached by the frost)
      const slow = Math.exp(-m.drag * dt);
      [m.vx, m.vz] = [m.vx * slow, m.vz * slow];
      m.vy -= m.still ? 0 : 1.2 * dt;
      m.x += m.vx * dt;
      m.y = Math.max(0.02, m.y + m.vy * dt);
      m.z += m.vz * dt;
      const left = 1 - m.age / m.life;
      const glint = m.still ? 0.6 + 0.4 * Math.sin(this.time * 9 + m.x * 13 + m.z * 7) : 1;
      const size = m.size * (m.still ? Math.min(1, left * 2) : 0.4 + 0.6 * left);
      this.matrix.makeScale(size, m.still ? size * 0.4 : size, size).setPosition(m.x, m.y, m.z);
      this.mesh.setMatrixAt(n, this.matrix);
      this.color.copy(WHITE).lerp(ICE, Math.min(1, m.age / m.life + (m.still ? 0.5 : 0))).multiplyScalar(left * glint);
      this.mesh.setColorAt(n, this.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.fan.dispose();
    this.edge.dispose();
    for (const sheet of this.sheets) for (const mesh of [sheet.fan, sheet.edge]) (mesh.material as THREE.Material).dispose();
    for (const glow of this.glows.values()) {
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
    }
  }
}
