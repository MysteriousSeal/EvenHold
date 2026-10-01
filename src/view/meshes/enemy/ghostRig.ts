// A ghost (ghostVoxels.ts), drawn see-through and faintly glowing, its eyes
// burning: floating over the ground, bobbing; its tail of wisps swaying,
// trailing as it goes; its sleeves hanging loose, drifting. Turned to the
// hero once set on them, leaning in, its hands reaching out. Its blow: it
// rears up, both hands raised, and lunges in raking down. Struck, a red flash;
// slain, it rises, thins and fades away (no bones to burst).

import * as THREE from 'three';
import { ENEMY_STATS, ENEMY_CORPSE_TIME } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import { CreatureRig, partMesher } from '../common/creatureRig';
import { HealthBar, enemyName, type EnemyRig } from './enemyParts';
import { drawnAt } from '../common/overhead';
import { GHOST_BODY, GHOST_PALETTE, GHOST_SHOULDER, GHOST_SLEEVE, GHOST_TAIL, ghostBody, ghostEyes, ghostSleeve, ghostTail } from './ghostVoxels';

const V = HUMAN_VOXEL_SIZE;
const mesh = partMesher(V);
const FLOAT = 0.1; // how high it floats, at the bottom of its bob
const TAIL_H = GHOST_TAIL[1] * V;
const HEIGHT = FLOAT + TAIL_H + GHOST_BODY[1] * V;
const TURN_RATE = 6;
const SEEN = 0.72; // how much of it shows (see-through)

export interface GhostLook {
  body: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  sleeve: THREE.BufferGeometry;
  flash: THREE.Material;
  eyeGlow: THREE.MeshBasicMaterial;
}

// Shared by every ghost: their shapes, the hit flash, their eyes' glow.
export function createGhostLook(flash: THREE.Material): GhostLook {
  return {
    body: mesh(ghostBody(), GHOST_PALETTE, [GHOST_BODY[0] / 2, 0, GHOST_BODY[2] / 2]),
    eyes: mesh(ghostEyes(), GHOST_PALETTE, [GHOST_BODY[0] / 2, 0, GHOST_BODY[2] / 2]),
    tail: mesh(ghostTail(), GHOST_PALETTE, [GHOST_TAIL[0] / 2, GHOST_TAIL[1], GHOST_TAIL[2] / 2]), // (hung from its top)
    sleeve: mesh(ghostSleeve(), GHOST_PALETTE, [GHOST_SLEEVE[0] / 2, GHOST_SLEEVE[1], GHOST_SLEEVE[2] / 2]), // (from the shoulder)
    flash,
    eyeGlow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, fog: false }),
  };
}

// Its own look (each fades on its own): pale, see-through, glowing faintly.
const ghostMaterial = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: SEEN, emissive: 0x6c8aa6, emissiveIntensity: 0.45 });

export class GhostRig extends CreatureRig implements EnemyRig {
  private readonly look: THREE.MeshStandardMaterial = ghostMaterial();
  private readonly glow: THREE.MeshBasicMaterial;
  private readonly float = new THREE.Group(); // all of it, bobbing and leaning
  private readonly tail = new THREE.Group();
  private readonly sleeves: THREE.Group[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly bar: HealthBar;

  constructor(enemy: Enemy, private readonly shared: GhostLook) {
    super(enemy.id * 1.7);
    this.glow = shared.eyeGlow.clone();
    this.bar = new HealthBar(HEIGHT + 0.14, enemyName(enemy));
    const part = (geometry: THREE.BufferGeometry, parent: THREE.Object3D, material: THREE.Material = this.look) => {
      const m = new THREE.Mesh(geometry, material);
      parent.add(m);
      if (material === this.look) this.meshes.push(m);
      return m;
    };
    const body = new THREE.Group();
    body.position.y = TAIL_H;
    part(shared.body, body);
    part(shared.eyes, body, this.glow);
    this.tail.position.y = TAIL_H;
    part(shared.tail, this.tail);
    for (const side of [1, -1]) {
      const sleeve = new THREE.Group();
      sleeve.position.set(side * GHOST_SHOULDER.x * V, GHOST_SHOULDER.y * V, 0);
      part(shared.sleeve, sleeve);
      body.add(sleeve);
      this.sleeves.push(sleeve);
    }
    this.float.add(body, this.tail);
    this.root.add(this.float, this.bar.group);
  }

  drawnAt(scale: number): void {
    drawnAt(this.root, scale, this.bar.group);
  }

  update(ghost: Enemy, dt: number, heroX = ghost.x, heroZ = ghost.z): void {
    const set = ghost.state === 'chase' || ghost.swingFor !== null;
    const moved = this.follow({ x: ghost.x, y: ghost.y, z: ghost.z, heading: set ? Math.atan2(heroX - ghost.x, heroZ - ghost.z) : undefined }, dt, TURN_RATE, 8);
    const speed = dt > 0 ? moved / dt : 0;
    this.bar.update(ghost.hp, ghost.maxHp, ghost.state !== 'dead', this.facing, ghost.level);
    const t = this.time;
    if (ghost.state === 'dead') return this.fade(ghost.deadFor);

    // Bobbing over the ground; leaning into its going (more when set on the hero); its tail trailing and swaying.
    this.float.position.set(0, FLOAT + Math.sin(t * 2.1) * 0.025, 0);
    const lean = Math.min(0.35, speed * 0.12) + (set ? 0.12 : 0);
    this.float.rotation.x = lean;
    this.tail.rotation.x = lean * 1.4 + Math.sin(t * 2.6) * 0.12;
    this.tail.rotation.z = Math.sin(t * 1.9 + 1) * 0.16;
    // Its sleeves: hanging, drifting; reaching for the hero when set on them.
    this.sleeves.forEach((sleeve, i) => {
      const drift = Math.sin(t * 1.7 + i * 2) * 0.15;
      sleeve.rotation.x = set ? -0.9 + drift * 0.5 : -0.15 + drift;
      sleeve.rotation.z = (i === 0 ? 1 : -1) * (0.18 + Math.abs(drift) * 0.3);
    });
    if (ghost.swingFor !== null) this.rake(ghost.swingFor / ENEMY_STATS.ghost.swing);
    this.glow.opacity = 0.85 + 0.15 * Math.sin(t * 5);
    const material = ghost.hurtFor > 0 ? this.shared.flash : this.look;
    for (const m of this.meshes) m.material = material;
  }

  // Its blow, over p (0..1): rearing up, both hands raised high; lunging in, raking down through the strike; drawing back.
  private rake(p: number): void {
    const key = (up: number, down: number) => (p < 0.4 ? up * (p / 0.4) : p < 0.6 ? up + (down - up) * ((p - 0.4) / 0.2) : down * (1 - (p - 0.6) / 0.4));
    this.float.position.y += key(0.1, -0.02);
    this.float.position.z = key(-0.06, 0.16);
    this.float.rotation.x = key(-0.25, 0.45);
    for (const sleeve of this.sleeves) sleeve.rotation.x = key(-2.7, -0.4);
  }

  // Slain: rising, drawn up thin, fading to nothing over its corpse time.
  private fade(deadFor: number): void {
    const f = Math.min(1, deadFor / ENEMY_CORPSE_TIME);
    for (const m of this.meshes) m.material = this.look;
    this.look.opacity = SEEN * (1 - f) ** 1.5;
    this.glow.opacity = 1 - f;
    this.float.position.y = FLOAT + f * 0.5;
    this.float.scale.set(1 - f * 0.5, 1 + f * 0.4, 1 - f * 0.5);
    for (const sleeve of this.sleeves) sleeve.rotation.x = -2.6 * Math.min(1, f * 3); // (arms flung up)
  }

  override dispose(): void {
    super.dispose();
    this.look.dispose();
    this.glow.dispose();
  }
}
