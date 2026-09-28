// One bandit on screen: the hero's rig wearing the bandit's parts
// (banditVoxels.ts), a short sword in the right hand, and the same swing
// animation, driven by the bandit's own blow. Flashes red when hit, shows a
// health bar once hurt, and on death falls flat on its back and bursts into
// voxel cubes.

import * as THREE from 'three';
import { BANDIT_SWING_TIME, ENEMY_CORPSE_TIME, ENEMY_STATS } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { HeroRig } from '../hero/heroMesh';
import { HERO_VOXEL_SIZE } from '../hero/heroVoxels';
import { greedyMesh } from '../voxel/greedyMesh';
import { BANDIT_PALETTE, BANDIT_PARTS, SWORD_GRID, buildSword } from './banditVoxels';
import { HealthBar, VoxelBurst } from './enemyParts';

const V = HERO_VOXEL_SIZE;
const HEIGHT = 18 * V;
const FALL_TIME = 0.4;
const BURST_AT = 0.7;

export interface BanditLook {
  normal: THREE.Material;
  flash: THREE.Material;
  sword: THREE.BufferGeometry;
}

export function createBanditLook(flash: THREE.Material): BanditLook {
  // Hilt at the hand, blade pointing forward (+Z).
  const origin = new THREE.Vector3((-SWORD_GRID[0] * V) / 2, -V / 2, -V);
  return {
    normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    flash,
    sword: greedyMesh(buildSword(), BANDIT_PALETTE, V, origin),
  };
}

export class BanditRig {
  private readonly rig: HeroRig;
  private readonly bar = new HealthBar(ENEMY_STATS.bandit.hp, HEIGHT + 0.12);
  private readonly burst: VoxelBurst;

  constructor(private readonly look: BanditLook) {
    this.rig = new HeroRig(BANDIT_PARTS, look.normal);
    const sword = new THREE.Mesh(look.sword, look.normal);
    sword.position.y = -5 * V; // in the hand, at the end of the arm
    this.rig.slots.rightArm.add(sword);
    this.rig.meshes.push(sword);
    this.rig.root.add(this.bar.group);
    this.burst = new VoxelBurst(this.rig.root, BANDIT_PALETTE.slice(2, 13), HEIGHT);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  update(bandit: Enemy, dt: number): void {
    this.bar.update(bandit.hp, bandit.state !== 'dead', this.rig.root.rotation.y);
    if (bandit.state === 'dead') {
      this.rig.root.position.set(bandit.x, bandit.y, bandit.z);
      this.rig.setMaterial(this.look.normal);
      this.rig.fall(bandit.deadFor / FALL_TIME);
      if (bandit.deadFor < BURST_AT) return;
      if (!this.burst.started) {
        for (const mesh of this.rig.meshes) mesh.visible = false;
        this.burst.start();
      }
      this.burst.update((bandit.deadFor - BURST_AT) / (ENEMY_CORPSE_TIME - BURST_AT), dt);
      return;
    }
    const swing = bandit.swingFor === null ? null : bandit.swingFor / BANDIT_SWING_TIME;
    this.rig.update(bandit.x, bandit.y, bandit.z, dt, swing);
    this.rig.setMaterial(bandit.hurtFor > 0 ? this.look.flash : this.look.normal);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.burst.dispose();
  }
}
